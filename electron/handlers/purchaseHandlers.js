'use strict'
const { getDb } = require('../db/database')
const { findOrCreateProduct } = require('../utils/productUtils')
const { getNextQuotationNumber, incrementQuotationSequence } = require('../utils/quotationNumberGen')
const log = require('electron-log')

function registerPurchaseHandlers(ipcMain) {

  ipcMain.handle('purchases:getAll', (event, params = {}) => {
    try {
      const db = getDb()
      const { page = 1, limit = 20, search = '' } = params
      const offset = (page - 1) * limit
      let where = ''
      let args = []
      if (search.trim()) {
        where = 'WHERE (bill_number LIKE ? OR supplier_name LIKE ?)'
        args = [`%${search}%`, `%${search}%`]
      }
      const total = db.prepare(`SELECT COUNT(*) as cnt FROM purchase_invoices ${where}`).get(...args).cnt
      const rows  = db.prepare(`SELECT * FROM purchase_invoices ${where} ORDER BY bill_date DESC LIMIT ? OFFSET ?`).all(...args, limit, offset)
      return { success: true, data: rows, total }
    } catch(err) { log.error('purchases:getAll', err); return { success: false, error: err.message } }
  })

  ipcMain.handle('purchases:getById', (event, id) => {
    try {
      const db = getDb()
      const purchase = db.prepare('SELECT * FROM purchase_invoices WHERE id = ?').get(id)
      if (!purchase) return { success: false, error: 'Purchase not found' }
      const items = db.prepare(`
        SELECT pi.*,
               COALESCE(p.name, pi.description) AS product_name
        FROM purchase_invoice_items pi
        LEFT JOIN products p ON p.id = pi.product_id
        WHERE pi.purchase_id = ?
        ORDER BY pi.id
      `).all(id)
      return { success: true, data: { ...purchase, items } }
    } catch(err) { log.error('purchases:getById', err); return { success: false, error: err.message } }
  })

  ipcMain.handle('purchases:create', (event, data) => {
    try {
      const db = getDb()
      const create = db.transaction(() => {
        const result = db.prepare(`
          INSERT INTO purchase_invoices
            (bill_number, bill_date, due_date, supplier_name, supplier_gstin, supplier_address, supplier_state,
             supply_type, subtotal, taxable_amount, total_cgst, total_sgst, total_igst, total_tax,
             forwarding_charges, forwarding_gst, packaging_charges, packaging_gst, other_charges,
             round_off, grand_total, payment_status, amount_paid, balance_due, notes)
          VALUES
            (@bill_number, @bill_date, @due_date, @supplier_name, @supplier_gstin, @supplier_address, @supplier_state,
             @supply_type, @subtotal, @taxable_amount, @total_cgst, @total_sgst, @total_igst, @total_tax,
             @forwarding_charges, @forwarding_gst, @packaging_charges, @packaging_gst, @other_charges,
             @round_off, @grand_total, @payment_status, @amount_paid, @balance_due, @notes)
        `).run({
          bill_number: data.bill_number || '',
          bill_date: data.bill_date,
          due_date: data.due_date || null,
          supplier_name: data.supplier_name,
          supplier_gstin: data.supplier_gstin || '',
          supplier_address: data.supplier_address || '',
          supplier_state: data.supplier_state || 'Maharashtra',
          supply_type: data.supply_type || 'intra',
          subtotal: parseFloat(data.subtotal || 0),
          taxable_amount: parseFloat(data.taxable_amount || 0),
          total_cgst: parseFloat(data.total_cgst || 0),
          total_sgst: parseFloat(data.total_sgst || 0),
          total_igst: parseFloat(data.total_igst || 0),
          total_tax: parseFloat(data.total_tax || 0),
          forwarding_charges: parseFloat(data.forwarding_charges || 0),
          forwarding_gst: parseFloat(data.forwarding_gst || 0),
          packaging_charges: parseFloat(data.packaging_charges || 0),
          packaging_gst: parseFloat(data.packaging_gst || 0),
          other_charges: parseFloat(data.other_charges || 0),
          round_off: parseFloat(data.round_off || 0),
          grand_total: parseFloat(data.grand_total || 0),
          payment_status: data.payment_status || 'unpaid',
          amount_paid: parseFloat(data.amount_paid || 0),
          balance_due: parseFloat(data.balance_due || data.grand_total || 0),
          notes: data.notes || '',
        })
        const purchaseId = result.lastInsertRowid
        for (const item of data.items || []) {
          // Auto-find or create product in Stock Master for each line item
          const resolvedProductId = item.product_id || findOrCreateProduct(db, item)

          db.prepare(`
            INSERT INTO purchase_invoice_items
              (purchase_id, product_id, description, hsn_code, quantity, unit, rate,
               taxable_amount, gst_percent, cgst_amount, sgst_amount, igst_amount, total_amount)
            VALUES
              (@purchase_id, @product_id, @description, @hsn_code, @quantity, @unit, @rate,
               @taxable_amount, @gst_percent, @cgst_amount, @sgst_amount, @igst_amount, @total_amount)
          `).run({
            purchase_id: purchaseId,
            product_id: resolvedProductId || null,
            description: item.description || '',
            hsn_code: item.hsn_code || '',
            quantity: parseFloat(item.quantity || 0),
            unit: item.unit || 'pcs',
            rate: parseFloat(item.rate || 0),
            taxable_amount: parseFloat(item.taxable_amount || 0),
            gst_percent: parseFloat(item.gst_percent || 18),
            cgst_amount: parseFloat(item.cgst_amount || 0),
            sgst_amount: parseFloat(item.sgst_amount || 0),
            igst_amount: parseFloat(item.igst_amount || 0),
            total_amount: parseFloat(item.total_amount || 0),
          })
          if (resolvedProductId) {
            db.prepare('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?').run(parseFloat(item.quantity || 0), resolvedProductId)
            db.prepare(`INSERT INTO stock_movements (product_id, movement_type, quantity, reference_id, reference_type, notes)
              VALUES (?, 'purchase', ?, ?, 'purchase', ?)`).run(
              resolvedProductId, parseFloat(item.quantity || 0), purchaseId, `Purchase Bill ${data.bill_number}`)
          }
        }
        return purchaseId
      })
      const id = create()
      return { success: true, data: { id } }
    } catch(err) { log.error('purchases:create', err); return { success: false, error: err.message } }
  })

  ipcMain.handle('purchases:update', (event, data) => {
    try {
      const db = getDb()
      const existing = db.prepare('SELECT * FROM purchase_invoices WHERE id = ?').get(data.id)
      if (!existing) return { success: false, error: 'Purchase not found' }

      const update = db.transaction(() => {
        // FIX: Reverse old stock AND record reversal movements
        const oldItems = db.prepare('SELECT * FROM purchase_invoice_items WHERE purchase_id = ?').all(data.id)
        for (const item of oldItems) {
          if (item.product_id) {
            db.prepare('UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?').run(item.quantity, item.product_id)
            // FIX: Insert reversal movement so stock ledger stays accurate
            db.prepare(`INSERT INTO stock_movements (product_id, movement_type, quantity, reference_id, reference_type, notes)
              VALUES (?, 'adjustment', ?, ?, 'purchase', ?)`).run(
              item.product_id, -Math.abs(item.quantity), data.id, `Purchase Edit Reversal: Bill ${existing.bill_number}`)
          }
        }

        db.prepare('DELETE FROM purchase_invoice_items WHERE purchase_id = ?').run(data.id)

        db.prepare(`
          UPDATE purchase_invoices SET
            bill_number=@bill_number, bill_date=@bill_date, due_date=@due_date,
            supplier_name=@supplier_name, supplier_gstin=@supplier_gstin,
            supplier_address=@supplier_address, supplier_state=@supplier_state,
            supply_type=@supply_type, subtotal=@subtotal, taxable_amount=@taxable_amount,
            total_cgst=@total_cgst, total_sgst=@total_sgst, total_igst=@total_igst,
            total_tax=@total_tax, 
            forwarding_charges=@forwarding_charges, forwarding_gst=@forwarding_gst,
            packaging_charges=@packaging_charges, packaging_gst=@packaging_gst,
            other_charges=@other_charges,
            round_off=@round_off, grand_total=@grand_total, payment_status=@payment_status,
            amount_paid=@amount_paid, balance_due=@balance_due, notes=@notes,
            updated_at=datetime('now')
          WHERE id=@id
        `).run({
          id: data.id,
          bill_number: data.bill_number || '',
          bill_date: data.bill_date,
          due_date: data.due_date || null,
          supplier_name: data.supplier_name,
          supplier_gstin: data.supplier_gstin || '',
          supplier_address: data.supplier_address || '',
          supplier_state: data.supplier_state || 'Maharashtra',
          supply_type: data.supply_type || 'intra',
          subtotal: parseFloat(data.subtotal || 0),
          taxable_amount: parseFloat(data.taxable_amount || 0),
          total_cgst: parseFloat(data.total_cgst || 0),
          total_sgst: parseFloat(data.total_sgst || 0),
          total_igst: parseFloat(data.total_igst || 0),
          total_tax: parseFloat(data.total_tax || 0),
          forwarding_charges: parseFloat(data.forwarding_charges || 0),
          forwarding_gst: parseFloat(data.forwarding_gst || 0),
          packaging_charges: parseFloat(data.packaging_charges || 0),
          packaging_gst: parseFloat(data.packaging_gst || 0),
          other_charges: parseFloat(data.other_charges || 0),
          round_off: parseFloat(data.round_off || 0),
          grand_total: parseFloat(data.grand_total || 0),
          payment_status: data.payment_status || 'unpaid',
          amount_paid: parseFloat(data.amount_paid || 0),
          balance_due: parseFloat(data.balance_due || 0),
          notes: data.notes || '',
        })

        for (const item of data.items || []) {
          // Auto-find or create product in Stock Master for each line item
          const resolvedProductId = item.product_id || findOrCreateProduct(db, item)

          db.prepare(`INSERT INTO purchase_invoice_items
            (purchase_id,product_id,description,hsn_code,quantity,unit,rate,
             taxable_amount,gst_percent,cgst_amount,sgst_amount,igst_amount,total_amount)
            VALUES (@purchase_id,@product_id,@description,@hsn_code,@quantity,@unit,@rate,
             @taxable_amount,@gst_percent,@cgst_amount,@sgst_amount,@igst_amount,@total_amount)`).run({
            purchase_id: data.id,
            product_id: resolvedProductId || null,
            description: item.description || '',
            hsn_code: item.hsn_code || '',
            quantity: parseFloat(item.quantity || 0),
            unit: item.unit || 'pcs',
            rate: parseFloat(item.rate || 0),
            taxable_amount: parseFloat(item.taxable_amount || 0),
            gst_percent: parseFloat(item.gst_percent || 18),
            cgst_amount: parseFloat(item.cgst_amount || 0),
            sgst_amount: parseFloat(item.sgst_amount || 0),
            igst_amount: parseFloat(item.igst_amount || 0),
            total_amount: parseFloat(item.total_amount || 0),
          })
          if (resolvedProductId) {
            db.prepare('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?').run(parseFloat(item.quantity || 0), resolvedProductId)
            // FIX: Record new purchase movement
            db.prepare(`INSERT INTO stock_movements (product_id, movement_type, quantity, reference_id, reference_type, notes)
              VALUES (?, 'purchase', ?, ?, 'purchase', ?)`).run(
              resolvedProductId, parseFloat(item.quantity || 0), data.id, `Purchase Bill ${data.bill_number} (Edited)`)
          }
        }
      })
      update()
      return { success: true }
    } catch(err) { log.error('purchases:update', err); return { success: false, error: err.message } }
  })

  ipcMain.handle('purchases:delete', (event, id) => {
    try {
      const db = getDb()
      const purchase = db.prepare('SELECT * FROM purchase_invoices WHERE id = ?').get(id)
      if (!purchase) return { success: false, error: 'Not found' }
      const del = db.transaction(() => {
        const items = db.prepare('SELECT * FROM purchase_invoice_items WHERE purchase_id = ?').all(id)
        for (const item of items) {
          if (item.product_id) {
            db.prepare('UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?').run(item.quantity, item.product_id)
            // FIX: Record reversal movement so stock ledger stays accurate
            db.prepare(`INSERT INTO stock_movements (product_id, movement_type, quantity, reference_id, reference_type, notes)
              VALUES (?, 'adjustment', ?, ?, 'purchase', ?)`).run(
              item.product_id, -Math.abs(item.quantity), id, `Purchase Deleted: Bill ${purchase.bill_number}`)
          }
        }
        db.prepare('DELETE FROM purchase_invoices WHERE id = ?').run(id)
      })
      del()
      return { success: true }
    } catch(err) { log.error('purchases:delete', err); return { success: false, error: err.message } }
  })

  // ── Quotations ────────────────────────────────────────
  ipcMain.handle('quotations:getNextNumber', () => {
    try {
      const num = getNextQuotationNumber()
      return { success: true, data: num }
    } catch (err) {
      log.error('quotations:getNextNumber', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('quotations:getById', (event, id) => {
    try {
      const db = getDb()
      const quotation = db.prepare(`
        SELECT q.*, c.name as customer_name_orig, c.phone as customer_phone_orig, c.email as customer_email_orig,
               c.billing_address as customer_address_orig, c.gstin as customer_gstin_orig, c.state as customer_state_orig,
               c.shipping_name as cust_shipping_name, c.shipping_gstin as cust_shipping_gstin,
               c.shipping_address as cust_shipping_address, c.shipping_state as cust_shipping_state
        FROM quotations q
        LEFT JOIN customers c ON q.customer_id = c.id
        WHERE q.id = ?
      `).get(id)
      if (!quotation) return { success: false, error: 'Quotation not found' }
      const items = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order ASC, id ASC').all(id)
      return { success: true, data: { ...quotation, items } }
    } catch(err) { log.error('quotations:getById', err); return { success: false, error: err.message } }
  })

  ipcMain.handle('quotations:getAll', (event, params = {}) => {
    try {
      const db = getDb()
      const { page = 1, limit = 20, search = '', status = '' } = params
      const offset = (page - 1) * limit
      let where = []
      let args = []
      if (search && search.trim()) {
        where.push('(q.quotation_number LIKE ? OR q.customer_name LIKE ? OR q.rfq_reference LIKE ?)')
        const term = `%${search.trim()}%`
        args.push(term, term, term)
      }
      if (status && status.trim() && status !== 'all') {
        where.push('q.status = ?')
        args.push(status.trim())
      }
      const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''
      const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM quotations q ${whereClause}`).get(...args)
      const total = countRow ? countRow.cnt : 0
      const rows = db.prepare(`
        SELECT q.*, c.phone as customer_phone_orig FROM quotations q
        LEFT JOIN customers c ON q.customer_id = c.id
        ${whereClause}
        ORDER BY q.id DESC LIMIT ? OFFSET ?
      `).all(...args, limit, offset)
      return { success: true, data: rows, total }
    } catch(err) { log.error('quotations:getAll', err); return { success: false, error: err.message } }
  })

  ipcMain.handle('quotations:create', (event, data) => {
    try {
      const db = getDb()
      const qNum = data.quotation_number || getNextQuotationNumber()
      
      const insertTx = db.transaction(() => {
        const stmt = db.prepare(`
          INSERT INTO quotations (
            quotation_number, quotation_date, valid_until, customer_id, customer_name,
            customer_address, customer_gstin, customer_state, customer_phone, customer_email,
            consignee_name, consignee_address, consignee_gstin, consignee_state,
            rfq_reference, salesperson, currency, supply_type,
            subtotal, taxable_amount, freight, packing_charges, other_charges,
            tax_rate, total_cgst, total_sgst, total_igst, total_tax,
            round_off, grand_total, amount_in_words, terms_conditions, notes, status
          ) VALUES (
            @quotation_number, @quotation_date, @valid_until, @customer_id, @customer_name,
            @customer_address, @customer_gstin, @customer_state, @customer_phone, @customer_email,
            @consignee_name, @consignee_address, @consignee_gstin, @consignee_state,
            @rfq_reference, @salesperson, @currency, @supply_type,
            @subtotal, @taxable_amount, @freight, @packing_charges, @other_charges,
            @tax_rate, @total_cgst, @total_sgst, @total_igst, @total_tax,
            @round_off, @grand_total, @amount_in_words, @terms_conditions, @notes, @status
          )
        `)

        const termsStr = Array.isArray(data.terms_conditions) 
          ? JSON.stringify(data.terms_conditions) 
          : (data.terms_conditions || '')

        const result = stmt.run({
          quotation_number: qNum,
          quotation_date: data.quotation_date,
          valid_until: data.valid_until || null,
          customer_id: data.customer_id || null,
          customer_name: data.customer_name || '',
          customer_address: data.customer_address || '',
          customer_gstin: data.customer_gstin || '',
          customer_state: data.customer_state || '',
          customer_phone: data.customer_phone || '',
          customer_email: data.customer_email || '',
          consignee_name: data.consignee_name || '',
          consignee_address: data.consignee_address || '',
          consignee_gstin: data.consignee_gstin || '',
          consignee_state: data.consignee_state || '',
          rfq_reference: data.rfq_reference || '',
          salesperson: data.salesperson || '',
          currency: data.currency || 'INR',
          supply_type: data.supply_type || 'intra',
          subtotal: parseFloat(data.subtotal || 0),
          taxable_amount: parseFloat(data.taxable_amount || 0),
          freight: parseFloat(data.freight || 0),
          packing_charges: parseFloat(data.packing_charges || 0),
          other_charges: parseFloat(data.other_charges || 0),
          tax_rate: parseFloat(data.tax_rate !== undefined ? data.tax_rate : 18),
          total_cgst: parseFloat(data.total_cgst || 0),
          total_sgst: parseFloat(data.total_sgst || 0),
          total_igst: parseFloat(data.total_igst || 0),
          total_tax: parseFloat(data.total_tax || 0),
          round_off: parseFloat(data.round_off || 0),
          grand_total: parseFloat(data.grand_total || 0),
          amount_in_words: data.amount_in_words || '',
          terms_conditions: termsStr,
          notes: data.notes || '',
          status: data.status || 'Draft',
        })

        const qId = result.lastInsertRowid

        const itemStmt = db.prepare(`
          INSERT INTO quotation_items (
            quotation_id, description, specification, hsn_code, quantity, unit, rate, gst_percent,
            taxable_amount, cgst_amount, sgst_amount, igst_amount, total_amount, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)

        let sortOrder = 1
        for (const item of data.items || []) {
          if (!item.description && !item.quantity && !item.rate) continue
          itemStmt.run(
            qId,
            item.description || '',
            item.specification || '',
            item.hsn_code || '',
            parseFloat(item.quantity || 1),
            item.unit || 'pcs',
            parseFloat(item.rate || 0),
            parseFloat(item.gst_percent !== undefined ? item.gst_percent : (data.tax_rate || 18)),
            parseFloat(item.taxable_amount || (parseFloat(item.quantity || 0) * parseFloat(item.rate || 0))),
            parseFloat(item.cgst_amount || 0),
            parseFloat(item.sgst_amount || 0),
            parseFloat(item.igst_amount || 0),
            parseFloat(item.total_amount || 0),
            item.sort_order || sortOrder++
          )
        }

        // Increment sequence after successful insert
        incrementQuotationSequence(qNum, db)

        return { id: qId, quotation_number: qNum }
      })

      const res = insertTx()
      return { success: true, data: res }
    } catch(err) {
      log.error('quotations:create', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('quotations:update', (event, data) => {
    try {
      const db = getDb()
      if (!data.id) return { success: false, error: 'Quotation ID required for update' }

      const updateTx = db.transaction(() => {
        const termsStr = Array.isArray(data.terms_conditions) 
          ? JSON.stringify(data.terms_conditions) 
          : (data.terms_conditions || '')

        db.prepare(`
          UPDATE quotations SET
            quotation_date = @quotation_date,
            valid_until = @valid_until,
            customer_id = @customer_id,
            customer_name = @customer_name,
            customer_address = @customer_address,
            customer_gstin = @customer_gstin,
            customer_state = @customer_state,
            customer_phone = @customer_phone,
            customer_email = @customer_email,
            consignee_name = @consignee_name,
            consignee_address = @consignee_address,
            consignee_gstin = @consignee_gstin,
            consignee_state = @consignee_state,
            rfq_reference = @rfq_reference,
            salesperson = @salesperson,
            currency = @currency,
            supply_type = @supply_type,
            subtotal = @subtotal,
            taxable_amount = @taxable_amount,
            freight = @freight,
            packing_charges = @packing_charges,
            other_charges = @other_charges,
            tax_rate = @tax_rate,
            total_cgst = @total_cgst,
            total_sgst = @total_sgst,
            total_igst = @total_igst,
            total_tax = @total_tax,
            round_off = @round_off,
            grand_total = @grand_total,
            amount_in_words = @amount_in_words,
            terms_conditions = @terms_conditions,
            notes = @notes,
            status = @status,
            updated_at = datetime('now')
          WHERE id = @id
        `).run({
          id: data.id,
          quotation_date: data.quotation_date,
          valid_until: data.valid_until || null,
          customer_id: data.customer_id || null,
          customer_name: data.customer_name || '',
          customer_address: data.customer_address || '',
          customer_gstin: data.customer_gstin || '',
          customer_state: data.customer_state || '',
          customer_phone: data.customer_phone || '',
          customer_email: data.customer_email || '',
          consignee_name: data.consignee_name || '',
          consignee_address: data.consignee_address || '',
          consignee_gstin: data.consignee_gstin || '',
          consignee_state: data.consignee_state || '',
          rfq_reference: data.rfq_reference || '',
          salesperson: data.salesperson || '',
          currency: data.currency || 'INR',
          supply_type: data.supply_type || 'intra',
          subtotal: parseFloat(data.subtotal || 0),
          taxable_amount: parseFloat(data.taxable_amount || 0),
          freight: parseFloat(data.freight || 0),
          packing_charges: parseFloat(data.packing_charges || 0),
          other_charges: parseFloat(data.other_charges || 0),
          tax_rate: parseFloat(data.tax_rate !== undefined ? data.tax_rate : 18),
          total_cgst: parseFloat(data.total_cgst || 0),
          total_sgst: parseFloat(data.total_sgst || 0),
          total_igst: parseFloat(data.total_igst || 0),
          total_tax: parseFloat(data.total_tax || 0),
          round_off: parseFloat(data.round_off || 0),
          grand_total: parseFloat(data.grand_total || 0),
          amount_in_words: data.amount_in_words || '',
          terms_conditions: termsStr,
          notes: data.notes || '',
          status: data.status || 'Draft',
        })

        // Delete existing items and re-insert
        db.prepare('DELETE FROM quotation_items WHERE quotation_id = ?').run(data.id)

        const itemStmt = db.prepare(`
          INSERT INTO quotation_items (
            quotation_id, description, specification, hsn_code, quantity, unit, rate, gst_percent,
            taxable_amount, cgst_amount, sgst_amount, igst_amount, total_amount, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)

        let sortOrder = 1
        for (const item of data.items || []) {
          if (!item.description && !item.quantity && !item.rate) continue
          itemStmt.run(
            data.id,
            item.description || '',
            item.specification || '',
            item.hsn_code || '',
            parseFloat(item.quantity || 1),
            item.unit || 'pcs',
            parseFloat(item.rate || 0),
            parseFloat(item.gst_percent !== undefined ? item.gst_percent : (data.tax_rate || 18)),
            parseFloat(item.taxable_amount || (parseFloat(item.quantity || 0) * parseFloat(item.rate || 0))),
            parseFloat(item.cgst_amount || 0),
            parseFloat(item.sgst_amount || 0),
            parseFloat(item.igst_amount || 0),
            parseFloat(item.total_amount || 0),
            item.sort_order || sortOrder++
          )
        }

        return { id: data.id }
      })

      const res = updateTx()
      return { success: true, data: res }
    } catch(err) {
      log.error('quotations:update', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('quotations:delete', (event, id) => {
    try {
      const db = getDb()
      db.prepare('DELETE FROM quotations WHERE id = ?').run(id)
      return { success: true }
    } catch(err) {
      log.error('quotations:delete', err)
      return { success: false, error: err.message }
    }
  })

  // ── Payments ──────────────────────────────────────────
  ipcMain.handle('payments:getAll', (event, params = {}) => {
    try {
      const db = getDb()
      const { page = 1, limit = 20 } = params
      const offset = (page - 1) * limit
      const total = db.prepare('SELECT COUNT(*) as cnt FROM payments').get().cnt
      const rows  = db.prepare('SELECT * FROM payments ORDER BY payment_date DESC LIMIT ? OFFSET ?').all(limit, offset)
      return { success: true, data: rows, total }
    } catch(err) { return { success: false, error: err.message } }
  })

  ipcMain.handle('payments:create', (event, data) => {
    try {
      const db = getDb()
      // FIX: Resolve party_id from party_name if not supplied
      let partyId = data.party_id || null
      if (!partyId && data.party_type === 'customer' && data.party_name) {
        const cust = db.prepare('SELECT id FROM customers WHERE name = ? LIMIT 1').get(data.party_name.trim())
        if (cust) partyId = cust.id
      }
      
      const paymentId = db.transaction(() => {
        // Find invoice/purchase id first
        let invoiceId = null
        let purchaseId = null
        
        if (data.party_type === 'customer') {
          // Use selected_invoice_id if available
          invoiceId = data.selected_invoice_id || null
          
          if (!invoiceId && data.narration) {
            const match = data.narration.match(/Invoice\s+(\S+)/i)
            if (match) {
              const inv = db.prepare('SELECT id FROM invoices WHERE invoice_number = ?').get(match[1])
              if (inv) invoiceId = inv.id
            }
          }
          
          // If no invoice found from selected id or narration, pick the oldest unpaid
          if (!invoiceId && partyId) {
            const inv = db.prepare('SELECT id, amount_received, grand_total FROM invoices WHERE customer_id = ? AND status = \'final\' AND payment_status IN (\'unpaid\', \'partial\') ORDER BY invoice_date ASC, id ASC LIMIT 1').get(partyId)
            if (inv) invoiceId = inv.id
          }
        } else if (data.party_type === 'supplier') {
          // Use selected_purchase_id if available
          purchaseId = data.selected_purchase_id || null
          
          if (!purchaseId && data.narration) {
            const match = data.narration.match(/Purchase Bill\s+(\S+)/i) || data.narration.match(/Bill\s+(\S+)/i)
            if (match) {
              const pur = db.prepare('SELECT id FROM purchase_invoices WHERE bill_number = ?').get(match[1])
              if (pur) purchaseId = pur.id
            }
          }
          
          if (!purchaseId && data.party_name) {
            const pur = db.prepare('SELECT id, amount_paid, grand_total FROM purchase_invoices WHERE LOWER(TRIM(supplier_name)) = LOWER(TRIM(?)) AND payment_status IN (\'unpaid\', \'partial\') ORDER BY bill_date ASC, id ASC LIMIT 1').get(data.party_name.trim())
            if (pur) purchaseId = pur.id
          }
        }
        
        // Insert payment
        const result = db.prepare(`
          INSERT INTO payments (payment_date, payment_type, party_type, party_id, party_name, amount, payment_mode, reference_no, narration, invoice_id, purchase_id)
          VALUES (@payment_date, @payment_type, @party_type, @party_id, @party_name, @amount, @payment_mode, @reference_no, @narration, @invoice_id, @purchase_id)
        `).run({
          payment_date: data.payment_date,
          payment_type: data.payment_type,
          party_type: data.party_type,
          party_id: partyId,
          party_name: data.party_name || '',
          amount: parseFloat(data.amount || 0),
          payment_mode: data.payment_mode || 'cash',
          reference_no: data.reference_no || '',
          narration: data.narration || '',
          invoice_id: invoiceId,
          purchase_id: purchaseId
        })

        // Update corresponding invoice or purchase bill
        const amount = parseFloat(data.amount || 0)

        if (invoiceId) {
          const inv = db.prepare('SELECT amount_received, grand_total FROM invoices WHERE id = ?').get(invoiceId)
          const newAmountReceived = parseFloat(inv.amount_received || 0) + amount
          const newBalanceDue = Math.max(0, parseFloat(inv.grand_total) - newAmountReceived)
          let newPaymentStatus = 'unpaid'
          if (newAmountReceived >= parseFloat(inv.grand_total)) {
            newPaymentStatus = 'paid'
          } else if (newAmountReceived > 0) {
            newPaymentStatus = 'partial'
          }

          db.prepare(`
            UPDATE invoices 
            SET amount_received = ?, balance_due = ?, payment_status = ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(newAmountReceived, newBalanceDue, newPaymentStatus, invoiceId)
        }

        if (purchaseId) {
          const pur = db.prepare('SELECT amount_paid, grand_total FROM purchase_invoices WHERE id = ?').get(purchaseId)
          const newAmountPaid = parseFloat(pur.amount_paid || 0) + amount
          const newBalanceDue = Math.max(0, parseFloat(pur.grand_total) - newAmountPaid)
          let newPaymentStatus = 'unpaid'
          if (newAmountPaid >= parseFloat(pur.grand_total)) {
            newPaymentStatus = 'paid'
          } else if (newAmountPaid > 0) {
            newPaymentStatus = 'partial'
          }

          db.prepare(`
            UPDATE purchase_invoices 
            SET amount_paid = ?, balance_due = ?, payment_status = ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(newAmountPaid, newBalanceDue, newPaymentStatus, purchaseId)
        }

        return result.lastInsertRowid
      })()

      return { success: true, data: { id: paymentId } }
    } catch(err) { 
      log.error('payments:create', err)
      return { success: false, error: err.message } 
    }
  })

  ipcMain.handle('payments:delete', (event, id) => {
    try {
      const db = getDb()
      
      db.transaction(() => {
        // Get payment details before deleting
        const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id)
        if (!payment) return
        
        const amount = parseFloat(payment.amount || 0)
        
        // Revert the corresponding invoice/purchase bill using stored ids
        if (payment.invoice_id) {
          const inv = db.prepare('SELECT amount_received, grand_total FROM invoices WHERE id = ?').get(payment.invoice_id)
          if (inv) {
            const newAmountReceived = Math.max(0, parseFloat(inv.amount_received || 0) - amount)
            const newBalanceDue = Math.max(0, parseFloat(inv.grand_total) - newAmountReceived)
            let newPaymentStatus = 'unpaid'
            if (newAmountReceived >= parseFloat(inv.grand_total)) {
              newPaymentStatus = 'paid'
            } else if (newAmountReceived > 0) {
              newPaymentStatus = 'partial'
            }

            db.prepare(`
              UPDATE invoices 
              SET amount_received = ?, balance_due = ?, payment_status = ?, updated_at = datetime('now')
              WHERE id = ?
            `).run(newAmountReceived, newBalanceDue, newPaymentStatus, payment.invoice_id)
          }
        }

        if (payment.purchase_id) {
          const pur = db.prepare('SELECT amount_paid, grand_total FROM purchase_invoices WHERE id = ?').get(payment.purchase_id)
          if (pur) {
            const newAmountPaid = Math.max(0, parseFloat(pur.amount_paid || 0) - amount)
            const newBalanceDue = Math.max(0, parseFloat(pur.grand_total) - newAmountPaid)
            let newPaymentStatus = 'unpaid'
            if (newAmountPaid >= parseFloat(pur.grand_total)) {
              newPaymentStatus = 'paid'
            } else if (newAmountPaid > 0) {
              newPaymentStatus = 'partial'
            }

            db.prepare(`
              UPDATE purchase_invoices 
              SET amount_paid = ?, balance_due = ?, payment_status = ?, updated_at = datetime('now')
              WHERE id = ?
            `).run(newAmountPaid, newBalanceDue, newPaymentStatus, payment.purchase_id)
          }
        }
        
        // Now delete payment
        db.prepare('DELETE FROM payments WHERE id = ?').run(id)
      })()

      return { success: true }
    } catch(err) { 
      log.error('payments:delete', err)
      return { success: false, error: err.message } 
    }
  })

  // ── Journal Vouchers ──────────────────────────────────
  ipcMain.handle('journals:getAll', (event, params = {}) => {
    try {
      const db = getDb()
      const { page = 1, limit = 20 } = params
      const offset = (page - 1) * limit
      const total = db.prepare('SELECT COUNT(*) as cnt FROM journal_vouchers').get().cnt
      const rows  = db.prepare('SELECT * FROM journal_vouchers ORDER BY voucher_date DESC LIMIT ? OFFSET ?').all(limit, offset)
      return { success: true, data: rows, total }
    } catch(err) { return { success: false, error: err.message } }
  })

  ipcMain.handle('journals:create', (event, data) => {
    try {
      const db = getDb()
      const result = db.prepare(`INSERT INTO journal_vouchers (voucher_date, voucher_number, narration) VALUES (?,?,?)`).run(
        data.voucher_date, data.voucher_number || ('JV-' + Date.now()), data.narration || '')
      const vId = result.lastInsertRowid
      for (const entry of data.entries || []) {
        db.prepare('INSERT INTO journal_entries (voucher_id, account, debit, credit) VALUES (?,?,?,?)').run(
          vId, entry.account||'', parseFloat(entry.debit||0), parseFloat(entry.credit||0))
      }
      return { success: true, data: { id: vId } }
    } catch(err) { return { success: false, error: err.message } }
  })

  ipcMain.handle('journals:delete', (event, id) => {
    try {
      const db = getDb()
      db.prepare('DELETE FROM journal_vouchers WHERE id = ?').run(id)
      return { success: true }
    } catch(err) { return { success: false, error: err.message } }
  })
  // ── Supplier Party Ledger ─────────────────────────────────────────────────
  // Returns all unique supplier names from purchase_invoices

  // Returns unpaid/partial purchase bills for a supplier (used in Payments modal)
  ipcMain.handle('purchases:getUnpaidBySupplier', (event, supplier_name) => {
    try {
      const db = getDb()
      const rows = db.prepare(`
        SELECT id, bill_number, bill_date, grand_total, balance_due, payment_status, supplier_name
        FROM purchase_invoices
        WHERE LOWER(TRIM(supplier_name)) = LOWER(TRIM(?))
          AND payment_status IN ('unpaid', 'partial')
        ORDER BY bill_date ASC
      `).all(supplier_name)
      return { success: true, data: rows }
    } catch (err) {
      log.error('purchases:getUnpaidBySupplier', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('purchases:getSupplierNames', () => {
    try {
      const db = getDb()
      // Use GROUP BY to ensure each name is only shown once
      const rows = db.prepare(`
        SELECT supplier_name as name, supplier_gstin as gstin
        FROM purchase_invoices
        GROUP BY LOWER(TRIM(supplier_name))
        ORDER BY supplier_name ASC
      `).all()
      return { success: true, data: rows }
    } catch (err) { log.error('purchases:getSupplierNames', err); return { success: false, error: err.message } }
  })

  ipcMain.handle('purchases:getAllSuppliersForLedger', () => {
    try {
      const db = getDb()
      // Use GROUP BY to ensure each name is only shown once
      const rows = db.prepare(`
        SELECT supplier_name as name, supplier_gstin as gstin
        FROM purchase_invoices
        GROUP BY LOWER(TRIM(supplier_name))
        ORDER BY supplier_name ASC
      `).all()
      return { success: true, data: rows }
    } catch (err) { log.error('purchases:getAllSuppliersForLedger', err); return { success: false, error: err.message } }
  })

  // Supplier ledger: purchase invoices as DEBIT, payments as CREDIT
  ipcMain.handle('purchases:getSupplierLedger', (event, params = {}) => {
    try {
      const db = getDb()
      const { supplier_name, startDate, endDate } = params
      if (!supplier_name) return { success: false, error: 'supplier_name required' }

      const supName = supplier_name.trim()

      // ── Opening balance (before startDate) ────────────────────────────
      let openingBalance = 0
      if (startDate) {
        const obInv = db.prepare(`
          SELECT COALESCE(SUM(grand_total), 0) as total
          FROM purchase_invoices
          WHERE LOWER(TRIM(supplier_name)) = LOWER(TRIM(?)) AND bill_date < ?
        `).get(supName, startDate)

        const obPay = db.prepare(`
          SELECT COALESCE(SUM(amount), 0) as total
          FROM payments
          WHERE party_type = 'supplier'
            AND payment_type = 'payment'
            AND LOWER(TRIM(party_name)) = LOWER(TRIM(?))
            AND payment_date < ?
        `).get(supName, startDate)

        openingBalance = parseFloat(obInv.total || 0) - parseFloat(obPay.total || 0)
      }

      // ── Date range conditions ─────────────────────────────────────────
      const invDateParts = [], invDateArgs = [], payDateParts = [], payDateArgs = []
      if (startDate) { invDateParts.push('bill_date >= ?'); invDateArgs.push(startDate); payDateParts.push('payment_date >= ?'); payDateArgs.push(startDate) }
      if (endDate)   { invDateParts.push('bill_date <= ?'); invDateArgs.push(endDate);   payDateParts.push('payment_date <= ?'); payDateArgs.push(endDate) }
      const invDateSQL = invDateParts.length ? 'AND ' + invDateParts.join(' AND ') : ''
      const payDateSQL = payDateParts.length ? 'AND ' + payDateParts.join(' AND ') : ''

      // ── 1. Purchase invoices — debit entries ──────────────────────────
      const purchases = db.prepare(`
        SELECT
          bill_date      AS date,
          bill_number    AS ref,
          'Purchase'     AS type,
          grand_total    AS debit,
          0              AS credit,
          bill_number    AS narration,
          id             AS ref_id,
          payment_status,
          balance_due,
          amount_paid    AS amount_received,
          NULL           AS payment_mode
        FROM purchase_invoices
        WHERE LOWER(TRIM(supplier_name)) = LOWER(TRIM(?))
        ${invDateSQL}
        ORDER BY bill_date ASC, id ASC
      `).all(supName, ...invDateArgs)

      // ── 2. Payments to supplier — credit entries ──────────────────────
      const supplierPayments = db.prepare(`
        SELECT
          payment_date  AS date,
          reference_no  AS ref,
          'Payment'     AS type,
          0             AS debit,
          amount        AS credit,
          narration,
          id            AS ref_id,
          payment_mode,
          NULL          AS payment_status,
          NULL          AS balance_due,
          NULL          AS amount_received
        FROM payments
        WHERE party_type = 'supplier'
          AND payment_type = 'payment'
          AND LOWER(TRIM(party_name)) = LOWER(TRIM(?))
        ${payDateSQL}
        ORDER BY payment_date ASC, id ASC
      `).all(supName, ...payDateArgs)

      // ── Merge + sort ──────────────────────────────────────────────────
      const allEntries = [...purchases, ...supplierPayments].sort((a, b) => {
        if (a.date < b.date) return -1
        if (a.date > b.date) return 1
        if (a.type === 'Purchase' && b.type !== 'Purchase') return -1
        if (a.type !== 'Purchase' && b.type === 'Purchase') return 1
        return (a.ref_id || 0) - (b.ref_id || 0)
      })

      // ── Running balance ───────────────────────────────────────────────
      let running = openingBalance
      const ledger = allEntries.map(entry => {
        running = running + parseFloat(entry.debit || 0) - parseFloat(entry.credit || 0)
        return { ...entry, running_balance: running }
      })

      const totalDebit  = purchases.reduce((s, e) => s + parseFloat(e.debit || 0), 0)
      const totalCredit = supplierPayments.reduce((s, e) => s + parseFloat(e.credit || 0), 0)

      return {
        success: true,
        data: {
          supplier: { name: supName, gstin: purchases[0]?.supplier_gstin || '' },
          ledger,
          opening_balance: openingBalance,
          total_debit: totalDebit,
          total_credit: totalCredit,
          closing_balance: running,
        }
      }
    } catch (err) { log.error('purchases:getSupplierLedger', err); return { success: false, error: err.message } }
  })
}

module.exports = { registerPurchaseHandlers }
