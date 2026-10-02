'use strict'

const { getDb } = require('../db/database')
const { getNextInvoiceNumber, incrementSequence } = require('../utils/invoiceNumberGen')
const { calculateLineItem, r2, getStateCode, getStateByCode } = require('../utils/gstCalculator')
const { findOrCreateProduct } = require('../utils/productUtils')
const log = require('electron-log')

function registerInvoiceHandlers(ipcMain) {
  // ── Get Next Number ───────────────────────────────────
  ipcMain.handle('invoices:getNextNumber', () => {
    try {
      const num = getNextInvoiceNumber()
      return { success: true, data: num }
    } catch (err) {
      log.error('invoices:getNextNumber', err)
      return { success: false, error: err.message }
    }
  })

  // ── Get All ───────────────────────────────────────────
  ipcMain.handle('invoices:getAll', (event, params = {}) => {
    try {
      const db = getDb()
      const {
        page = 1,
        limit = 20,
        startDate,
        endDate,
        customer_id,
        status,
        payment_status,
        search = '',
      } = params
      const offset = (page - 1) * limit

      let conditions = []
      let args = []

      if (startDate) { conditions.push('i.invoice_date >= ?'); args.push(startDate) }
      if (endDate) { conditions.push('i.invoice_date <= ?'); args.push(endDate) }
      if (customer_id) { conditions.push('i.customer_id = ?'); args.push(customer_id) }
      if (status) { conditions.push('i.status = ?'); args.push(status) }
      if (payment_status) { conditions.push('i.payment_status = ?'); args.push(payment_status) }
      if (search.trim()) {
        conditions.push('(i.invoice_number LIKE ? OR c.name LIKE ?)')
        const s = `%${search.trim()}%`
        args.push(s, s)
      }

      const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''

      const total = db
        .prepare(`
          SELECT COUNT(*) as cnt
          FROM invoices i
          LEFT JOIN customers c ON i.customer_id = c.id
          ${where}
        `)
        .get(...args).cnt

      const rows = db
        .prepare(`
          SELECT
            i.*,
            c.name as customer_name,
            c.phone as customer_phone,
            c.gstin as customer_gstin
          FROM invoices i
          LEFT JOIN customers c ON i.customer_id = c.id
          ${where}
          ORDER BY i.invoice_date DESC, i.id DESC
          LIMIT ? OFFSET ?
        `)
        .all(...args, limit, offset)

      return { success: true, data: rows, total, page, limit }
    } catch (err) {
      log.error('invoices:getAll', err)
      return { success: false, error: err.message }
    }
  })

  // ── Get By ID ─────────────────────────────────────────
  ipcMain.handle('invoices:getById', (event, id) => {
    try {
      const db = getDb()

      const invoice = db
        .prepare(`
          SELECT
            i.*,
            c.name as customer_name,
            c.phone as customer_phone,
            c.email as customer_email,
            c.contact_person as customer_contact_person,
            c.gstin as customer_gstin,
            c.billing_address as customer_billing_address,
            c.shipping_address as customer_shipping_address,
            c.shipping_name as customer_shipping_name,
            c.shipping_gstin as customer_shipping_gstin,
            c.shipping_state as customer_shipping_state,
            COALESCE(NULLIF(i.shipping_name, ''), c.shipping_name, c.name, '') as shipping_name,
            COALESCE(NULLIF(i.shipping_gstin, ''), c.shipping_gstin, c.gstin, '') as shipping_gstin,
            COALESCE(NULLIF(i.shipping_address, ''), c.shipping_address, c.billing_address, '') as shipping_address,
            COALESCE(NULLIF(i.shipping_state, ''), c.shipping_state, c.state, 'Maharashtra') as shipping_state,
            c.state as customer_state
          FROM invoices i
          LEFT JOIN customers c ON i.customer_id = c.id
          WHERE i.id = ?
        `)
        .get(id)

      if (!invoice) return { success: false, error: 'Invoice not found' }

      const customerState = invoice.customer_state || 'Maharashtra'
      const customerGstin = (invoice.customer_gstin || '').trim()
      const customerStateCode = (customerGstin.length >= 2 ? customerGstin.substring(0, 2) : '') || getStateCode(customerState) || '27'

      let shippingState = invoice.shipping_state || customerState || 'Maharashtra'
      const shippingGstin = (invoice.shipping_gstin || '').trim()
      let shippingStateCode = (shippingGstin.length >= 2 ? shippingGstin.substring(0, 2) : '') || getStateCode(shippingState) || customerStateCode || '27'

      if (!shippingState && shippingStateCode) {
        shippingState = getStateByCode(shippingStateCode) || customerState
      }

      invoice.customer_state = customerState
      invoice.customer_state_code = customerStateCode
      invoice.shipping_state = shippingState
      invoice.shipping_state_code = shippingStateCode

      const items = db
        .prepare(`
          SELECT ii.*, p.name as product_name, COALESCE(ii.item_notes, '') as item_notes
          FROM invoice_items ii
          LEFT JOIN products p ON ii.product_id = p.id
          WHERE ii.invoice_id = ?
          ORDER BY ii.id ASC
        `)
        .all(id)

      return { success: true, data: { ...invoice, items } }
    } catch (err) {
      log.error('invoices:getById', err)
      return { success: false, error: err.message }
    }
  })

  // ── Create ────────────────────────────────────────────
  ipcMain.handle('invoices:create', (event, data) => {
    try {
      const db = getDb()

      // Validation
      if (!data.customer_id) return { success: false, error: 'Customer is required' }
      if (!data.invoice_date) return { success: false, error: 'Invoice date is required' }
      if (!data.items || data.items.length === 0)
        return { success: false, error: 'At least one line item is required' }

      for (const item of data.items) {
        if (!item.quantity || parseFloat(item.quantity) <= 0)
          return { success: false, error: 'All item quantities must be > 0' }
        if (!item.rate || parseFloat(item.rate) <= 0)
          return { success: false, error: 'All item rates must be > 0' }
      }

      if (parseFloat(data.amount_received || 0) > parseFloat(data.grand_total || 0)) {
        return { success: false, error: 'Amount received cannot exceed grand total' }
      }

      // Check invoice number uniqueness
      const invNum = (data.invoice_number || '').trim()
      if (!invNum) return { success: false, error: 'Invoice number is required' }
      const existing = db
        .prepare('SELECT id FROM invoices WHERE invoice_number = ?')
        .get(invNum)
      if (existing) {
        return { success: false, error: 'Invoice number already exists' }
      }

      const createInvoice = db.transaction(() => {
        // First calculate all items and total line-level values
        const itemsWithCalc = data.items.map(item => {
          const calc = calculateLineItem(
            parseFloat(item.rate),
            parseFloat(item.quantity),
            'percent',
            parseFloat(item.discount_percent || 0),
            parseFloat(item.gst_percent || 0),
            data.supply_type || 'intra'
          )
          return { ...item, calc }
        })
        
        const totalLineTaxable = itemsWithCalc.reduce((sum, i) => sum + i.calc.taxableAmount, 0)
        const totalLineCGST = itemsWithCalc.reduce((sum, i) => sum + i.calc.cgst, 0)
        const totalLineSGST = itemsWithCalc.reduce((sum, i) => sum + i.calc.sgst, 0)
        const totalLineIGST = itemsWithCalc.reduce((sum, i) => sum + i.calc.igst, 0)
        const invoiceDiscount = parseFloat(data.discount_amount || 0)
        
        let ratio = 1
        if (invoiceDiscount > 0 && totalLineTaxable > 0) {
          const adjustedTotalTaxable = totalLineTaxable - invoiceDiscount
          ratio = adjustedTotalTaxable / totalLineTaxable
        }

        // Insert invoice
        const result = db
          .prepare(`
            INSERT INTO invoices (
              invoice_number, invoice_date, due_date, customer_id,
              supply_type, place_of_supply, subtotal, discount_type,
              discount_value, discount_amount, taxable_amount,
              total_cgst, total_sgst, total_igst, total_tax,
              shipping_charges, shipping_gst_percent, round_off, grand_total,
              payment_status, amount_received, balance_due,
              notes, shipping_name, shipping_gstin, shipping_address, shipping_state, delivery_note, payment_mode_terms, reference_no_date,
              other_references, buyers_order_no, order_date, dispatch_doc_no,
              delivery_note_date, dispatched_through, destination, vessel_flight_no,
              place_of_receipt_by_shipper, port_of_loading, port_of_discharge,
              terms_of_delivery, status
            ) VALUES (
              @invoice_number, @invoice_date, @due_date, @customer_id,
              @supply_type, @place_of_supply, @subtotal, @discount_type,
              @discount_value, @discount_amount, @taxable_amount,
              @total_cgst, @total_sgst, @total_igst, @total_tax,
              @shipping_charges, @shipping_gst_percent, @round_off, @grand_total,
              @payment_status, @amount_received, @balance_due,
              @notes, @shipping_name, @shipping_gstin, @shipping_address, @shipping_state, @delivery_note, @payment_mode_terms, @reference_no_date,
              @other_references, @buyers_order_no, @order_date, @dispatch_doc_no,
              @delivery_note_date, @dispatched_through, @destination, @vessel_flight_no,
              @place_of_receipt_by_shipper, @port_of_loading, @port_of_discharge,
              @terms_of_delivery, @status
            )
          `)
          .run({
            invoice_number: data.invoice_number,
            invoice_date: data.invoice_date,
            due_date: data.due_date || null,
            customer_id: data.customer_id,
            supply_type: data.supply_type || 'intra',
            place_of_supply: data.place_of_supply || 'Maharashtra',
            subtotal: parseFloat(data.subtotal || 0),
            discount_type: data.discount_type || 'flat',
            discount_value: parseFloat(data.discount_value || 0),
            discount_amount: parseFloat(data.discount_amount || 0),
            taxable_amount: parseFloat(data.taxable_amount || 0),
            total_cgst: parseFloat(data.total_cgst || 0),
            total_sgst: parseFloat(data.total_sgst || 0),
            total_igst: parseFloat(data.total_igst || 0),
            total_tax: parseFloat(data.total_tax || 0),
            shipping_charges: parseFloat(data.shipping_charges || 0),
            shipping_gst_percent: parseFloat(data.shipping_gst_percent || 0),
            round_off: parseFloat(data.round_off || 0),
            grand_total: parseFloat(data.grand_total || 0),
            payment_status: data.payment_status || 'unpaid',
            amount_received: parseFloat(data.amount_received || 0),
            balance_due: parseFloat(data.balance_due || data.grand_total || 0),
            notes: data.notes || '',
            shipping_name: data.shipping_name || data.customer_shipping_name || '',
            shipping_gstin: data.shipping_gstin || data.customer_shipping_gstin || '',
            shipping_address: data.shipping_address || data.customer_shipping_address || '',
            shipping_state: data.shipping_state || data.customer_shipping_state || data.customer_state || 'Maharashtra',
            delivery_note: data.delivery_note || '',
            payment_mode_terms: data.payment_mode_terms || '',
            reference_no_date: data.reference_no_date || '',
            other_references: data.other_references || '',
            buyers_order_no: data.buyers_order_no || '',
            order_date: data.order_date || '',
            dispatch_doc_no: data.dispatch_doc_no || '',
            delivery_note_date: data.delivery_note_date || '',
            dispatched_through: data.dispatched_through || '',
            destination: data.destination || '',
            vessel_flight_no: data.vessel_flight_no || '',
            place_of_receipt_by_shipper: data.place_of_receipt_by_shipper || '',
            port_of_loading: data.port_of_loading || '',
            port_of_discharge: data.port_of_discharge || '',
            terms_of_delivery: data.terms_of_delivery || '',
            status: data.status || 'draft',
          })

        const invoiceId = result.lastInsertRowid

        // Insert items and update stock
        for (const item of itemsWithCalc) {
          // Auto-find or create product in Stock Master for each line item
          const resolvedProductId = item.product_id || findOrCreateProduct(db, item)

          // Adjust for invoice-level discount
          const adjustedTaxable = r2(item.calc.taxableAmount * ratio)
          const adjustedCGST = r2(item.calc.cgst * ratio)
          const adjustedSGST = r2(item.calc.sgst * ratio)
          const adjustedIGST = r2(item.calc.igst * ratio)
          const adjustedTotal = r2(adjustedTaxable + adjustedCGST + adjustedSGST + adjustedIGST)

          db.prepare(`
            INSERT INTO invoice_items (
              invoice_id, product_id, description, hsn_code,
              quantity, unit, rate, discount_percent, discount_amount,
              taxable_amount, gst_percent, cgst_amount, sgst_amount,
              igst_amount, total_amount, item_notes
            ) VALUES (
              @invoice_id, @product_id, @description, @hsn_code,
              @quantity, @unit, @rate, @discount_percent, @discount_amount,
              @taxable_amount, @gst_percent, @cgst_amount, @sgst_amount,
              @igst_amount, @total_amount, @item_notes
            )
          `).run({
            invoice_id: invoiceId,
            product_id: resolvedProductId || null,
            description: item.description || '',
            hsn_code: item.hsn_code || '',
            quantity: parseFloat(item.quantity),
            unit: item.unit || 'pcs',
            rate: parseFloat(item.rate),
            discount_percent: parseFloat(item.discount_percent || 0),
            discount_amount: item.calc.discountAmount,
            taxable_amount: adjustedTaxable,
            gst_percent: parseFloat(item.gst_percent || 0),
            cgst_amount: adjustedCGST,
            sgst_amount: adjustedSGST,
            igst_amount: adjustedIGST,
            total_amount: adjustedTotal,
            item_notes: item.item_notes || '',
          })

          // Deduct stock if product exists and invoice is final
          // Allow negative stock — invoice can be created even if out of stock
          if (resolvedProductId && data.status === 'final') {
            db.prepare(
              'UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?'
            ).run(parseFloat(item.quantity), resolvedProductId)

            db.prepare(`
              INSERT INTO stock_movements
                (product_id, movement_type, quantity, reference_id, reference_type, notes)
              VALUES (?, 'sale', ?, ?, 'invoice', ?)
            `).run(resolvedProductId, parseFloat(item.quantity), invoiceId, `Invoice ${data.invoice_number}`)
          }
        }

        // Increment sequence whenever a NEW invoice is created
        incrementSequence(db)

        return invoiceId
      })

      const invoiceId = createInvoice()
      return { success: true, data: { id: invoiceId } }
    } catch (err) {
      log.error('invoices:create', err)
      return { success: false, error: err.message }
    }
  })

  // ── Update ────────────────────────────────────────────
  ipcMain.handle('invoices:update', (event, data) => {
    try {
      const db = getDb()

      if (!data.id) return { success: false, error: 'Invoice ID required' }

      const existing = db
        .prepare('SELECT * FROM invoices WHERE id = ?')
        .get(data.id)

      if (!existing) return { success: false, error: 'Invoice not found' }

      const updateInvoice = db.transaction(() => {
        // Restore old stock if was final
        if (existing.status === 'final') {
          const oldItems = db
            .prepare('SELECT * FROM invoice_items WHERE invoice_id = ?')
            .all(data.id)

          for (const item of oldItems) {
            if (item.product_id) {
              db.prepare(
                'UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?'
              ).run(item.quantity, item.product_id)

              db.prepare(`
                INSERT INTO stock_movements
                  (product_id, movement_type, quantity, reference_id, reference_type, notes)
                VALUES (?, 'sale_reversal', ?, ?, 'invoice', ?)
              `).run(item.product_id, item.quantity, data.id, `Reversal: Invoice ${existing.invoice_number}`)
            }
          }
        }

        // Delete old items
        db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(data.id)

        // First calculate all items and total line-level values
        const itemsWithCalc = data.items.map(item => {
          const calc = calculateLineItem(
            parseFloat(item.rate),
            parseFloat(item.quantity),
            'percent',
            parseFloat(item.discount_percent || 0),
            parseFloat(item.gst_percent || 0),
            data.supply_type || 'intra'
          )
          return { ...item, calc }
        })
        
        const totalLineTaxable = itemsWithCalc.reduce((sum, i) => sum + i.calc.taxableAmount, 0)
        const invoiceDiscount = parseFloat(data.discount_amount || 0)
        
        let ratio = 1
        if (invoiceDiscount > 0 && totalLineTaxable > 0) {
          const adjustedTotalTaxable = totalLineTaxable - invoiceDiscount
          ratio = adjustedTotalTaxable / totalLineTaxable
        }

        // Update invoice header
        db.prepare(`
          UPDATE invoices SET
            invoice_date = @invoice_date,
            due_date = @due_date,
            customer_id = @customer_id,
            supply_type = @supply_type,
            place_of_supply = @place_of_supply,
            subtotal = @subtotal,
            discount_type = @discount_type,
            discount_value = @discount_value,
            discount_amount = @discount_amount,
            taxable_amount = @taxable_amount,
            total_cgst = @total_cgst,
            total_sgst = @total_sgst,
            total_igst = @total_igst,
            total_tax = @total_tax,
            shipping_charges = @shipping_charges,
            shipping_gst_percent = @shipping_gst_percent,
            round_off = @round_off,
            grand_total = @grand_total,
            payment_status = @payment_status,
            amount_received = @amount_received,
            balance_due = @balance_due,
            notes = @notes,
            shipping_name = @shipping_name,
            shipping_gstin = @shipping_gstin,
            shipping_address = @shipping_address,
            shipping_state = @shipping_state,
            delivery_note = @delivery_note,
            payment_mode_terms = @payment_mode_terms,
            reference_no_date = @reference_no_date,
            other_references = @other_references,
            buyers_order_no = @buyers_order_no,
            order_date = @order_date,
            dispatch_doc_no = @dispatch_doc_no,
            delivery_note_date = @delivery_note_date,
            dispatched_through = @dispatched_through,
            destination = @destination,
            vessel_flight_no = @vessel_flight_no,
            place_of_receipt_by_shipper = @place_of_receipt_by_shipper,
            port_of_loading = @port_of_loading,
            port_of_discharge = @port_of_discharge,
            terms_of_delivery = @terms_of_delivery,
            status = @status,
            updated_at = datetime('now')
          WHERE id = @id
        `).run({
          id: data.id,
          invoice_date: data.invoice_date,
          due_date: data.due_date || null,
          customer_id: data.customer_id,
          supply_type: data.supply_type || 'intra',
          place_of_supply: data.place_of_supply || 'Maharashtra',
          subtotal: parseFloat(data.subtotal || 0),
          discount_type: data.discount_type || 'flat',
          discount_value: parseFloat(data.discount_value || 0),
          discount_amount: parseFloat(data.discount_amount || 0),
          taxable_amount: parseFloat(data.taxable_amount || 0),
          total_cgst: parseFloat(data.total_cgst || 0),
          total_sgst: parseFloat(data.total_sgst || 0),
          total_igst: parseFloat(data.total_igst || 0),
          total_tax: parseFloat(data.total_tax || 0),
          shipping_charges: parseFloat(data.shipping_charges || 0),
          shipping_gst_percent: parseFloat(data.shipping_gst_percent || 0),
          round_off: parseFloat(data.round_off || 0),
          grand_total: parseFloat(data.grand_total || 0),
          payment_status: data.payment_status || 'unpaid',
          amount_received: parseFloat(data.amount_received || 0),
          balance_due: parseFloat(data.balance_due || 0),
          notes: data.notes || '',
          shipping_name: data.shipping_name || data.customer_shipping_name || '',
          shipping_gstin: data.shipping_gstin || data.customer_shipping_gstin || '',
          shipping_address: data.shipping_address || data.customer_shipping_address || '',
          shipping_state: data.shipping_state || data.customer_shipping_state || data.customer_state || 'Maharashtra',
          delivery_note: data.delivery_note || '',
          payment_mode_terms: data.payment_mode_terms || '',
          reference_no_date: data.reference_no_date || '',
          other_references: data.other_references || '',
          buyers_order_no: data.buyers_order_no || '',
          order_date: data.order_date || '',
          dispatch_doc_no: data.dispatch_doc_no || '',
          delivery_note_date: data.delivery_note_date || '',
          dispatched_through: data.dispatched_through || '',
          destination: data.destination || '',
          vessel_flight_no: data.vessel_flight_no || '',
          place_of_receipt_by_shipper: data.place_of_receipt_by_shipper || '',
          port_of_loading: data.port_of_loading || '',
          port_of_discharge: data.port_of_discharge || '',
          terms_of_delivery: data.terms_of_delivery || '',
          status: data.status || 'draft',
        })

        // Re-insert items with new stock deduction
        for (const item of itemsWithCalc) {
          // Auto-find or create product in Stock Master for each line item
          const resolvedProductId = item.product_id || findOrCreateProduct(db, item)

          // Adjust for invoice-level discount
          const adjustedTaxable = r2(item.calc.taxableAmount * ratio)
          const adjustedCGST = r2(item.calc.cgst * ratio)
          const adjustedSGST = r2(item.calc.sgst * ratio)
          const adjustedIGST = r2(item.calc.igst * ratio)
          const adjustedTotal = r2(adjustedTaxable + adjustedCGST + adjustedSGST + adjustedIGST)

          db.prepare(`
            INSERT INTO invoice_items (
              invoice_id, product_id, description, hsn_code,
              quantity, unit, rate, discount_percent, discount_amount,
              taxable_amount, gst_percent, cgst_amount, sgst_amount,
              igst_amount, total_amount, item_notes
            ) VALUES (
              @invoice_id, @product_id, @description, @hsn_code,
              @quantity, @unit, @rate, @discount_percent, @discount_amount,
              @taxable_amount, @gst_percent, @cgst_amount, @sgst_amount,
              @igst_amount, @total_amount, @item_notes
            )
          `).run({
            invoice_id: data.id,
            product_id: resolvedProductId || null,
            description: item.description || '',
            hsn_code: item.hsn_code || '',
            quantity: parseFloat(item.quantity),
            unit: item.unit || 'pcs',
            rate: parseFloat(item.rate),
            discount_percent: parseFloat(item.discount_percent || 0),
            discount_amount: item.calc.discountAmount,
            taxable_amount: adjustedTaxable,
            gst_percent: parseFloat(item.gst_percent || 0),
            cgst_amount: adjustedCGST,
            sgst_amount: adjustedSGST,
            igst_amount: adjustedIGST,
            total_amount: adjustedTotal,
            item_notes: item.item_notes || '',
          })

          if (resolvedProductId && data.status === 'final') {
            db.prepare(
              'UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?'
            ).run(parseFloat(item.quantity), resolvedProductId)

            db.prepare(`
              INSERT INTO stock_movements
                (product_id, movement_type, quantity, reference_id, reference_type, notes)
              VALUES (?, 'sale', ?, ?, 'invoice', ?)
            `).run(resolvedProductId, parseFloat(item.quantity), data.id, `Invoice ${data.invoice_number}`)
          }
        }
      })

      updateInvoice()
      return { success: true }
    } catch (err) {
      log.error('invoices:update', err)
      return { success: false, error: err.message }
    }
  })

  // ── Delete ────────────────────────────────────────────
  ipcMain.handle('invoices:delete', (event, id) => {
    try {
      const db = getDb()

      const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id)
      if (!invoice) return { success: false, error: 'Invoice not found' }

      const deleteInvoice = db.transaction(() => {
        // Restore stock if was final
        if (invoice.status === 'final') {
          const items = db
            .prepare('SELECT * FROM invoice_items WHERE invoice_id = ?')
            .all(id)

          for (const item of items) {
            if (item.product_id) {
              db.prepare(
                'UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?'
              ).run(item.quantity, item.product_id)

              db.prepare(`
                INSERT INTO stock_movements
                  (product_id, movement_type, quantity, reference_id, reference_type, notes)
                VALUES (?, 'sale_reversal', ?, ?, 'invoice', ?)
              `).run(item.product_id, item.quantity, id, `Deleted Invoice ${invoice.invoice_number}`)
            }
          }
        }

        // Cascade delete handles invoice_items
        db.prepare('DELETE FROM invoices WHERE id = ?').run(id)
      })

      deleteInvoice()
      return { success: true }
    } catch (err) {
      log.error('invoices:delete', err)
      return { success: false, error: err.message }
    }
  })

  // ── Update Status ─────────────────────────────────────
  ipcMain.handle('invoices:updateStatus', (event, data) => {
    try {
      const db = getDb()
      const { id, payment_status, amount_received } = data

      const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id)
      if (!invoice) return { success: false, error: 'Invoice not found' }

      const received = parseFloat(amount_received || invoice.amount_received)
      const balance = parseFloat(invoice.grand_total) - received

      db.prepare(`
        UPDATE invoices SET
          payment_status = ?,
          amount_received = ?,
          balance_due = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(payment_status, received, balance, id)

      return { success: true }
    } catch (err) {
      log.error('invoices:updateStatus', err)
      return { success: false, error: err.message }
    }
  })

  // ── Settings handlers ─────────────────────────────────
  ipcMain.handle('settings:getAll', () => {
    try {
      const db = getDb()
      const rows = db.prepare('SELECT key, value FROM settings').all()
      const result = {}
      for (const row of rows) result[row.key] = row.value
      return { success: true, data: result }
    } catch (err) {
      log.error('settings:getAll', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('settings:set', (event, data) => {
    try {
      const db = getDb()
      const upsert = db.prepare(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
      )
      const upsertMany = db.transaction((entries) => {
        for (const [key, value] of entries) {
          upsert.run(key, String(value ?? ''))
        }
      })
      upsertMany(Object.entries(data))
      return { success: true }
    } catch (err) {
      log.error('settings:set', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('settings:get', (event, key) => {
    try {
      const db = getDb()
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
      return { success: true, data: row ? row.value : null }
    } catch (err) {
      log.error('settings:get', err)
      return { success: false, error: err.message }
    }
  })
  // Returns unpaid/partial sales invoices for a customer (used in Payments modal)
  ipcMain.handle('invoices:getUnpaidByCustomer', (event, customer_id) => {
    try {
      const db = getDb()
      const rows = db.prepare(`
        SELECT id, invoice_number, invoice_date, grand_total, amount_received, balance_due, payment_status
        FROM invoices
        WHERE customer_id = ? AND status = 'final'
          AND payment_status IN ('unpaid', 'partial')
        ORDER BY invoice_date ASC, id ASC
      `).all(customer_id)
      return { success: true, data: rows }
    } catch (err) {
      log.error('invoices:getUnpaidByCustomer', err)
      return { success: false, error: err.message }
    }
  })

  // ── E-Invoice / E-Way Bill stubs (future feature) ────
  ipcMain.handle('invoices:saveEInvoice', (event, data) => {
    try {
      const db = getDb()
      if (!data.id) return { success: false, error: 'Invoice ID required' }
      // Store e-invoice JSON as notes extension (future: add dedicated column)
      return { success: true }
    } catch (err) {
      log.error('invoices:saveEInvoice', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('invoices:saveEWayBill', (event, data) => {
    try {
      if (!data.id) return { success: false, error: 'Invoice ID required' }
      return { success: true }
    } catch (err) {
      log.error('invoices:saveEWayBill', err)
      return { success: false, error: err.message }
    }
  })
}

module.exports = { registerInvoiceHandlers }
