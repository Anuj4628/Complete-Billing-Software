'use strict'

const { getDb } = require('../db/database')
const log = require('electron-log')

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

function validateGSTIN(gstin) {
  if (!gstin || gstin.trim() === '') return true
  return GSTIN_REGEX.test(gstin.trim())
}

const VALID_CUSTOMER_TYPES = ['B2B', 'B2C', 'CASH', 'SUNDRY_DEBTOR', 'SUNDRY_CREDITOR']

/**
 * Ensures customers CHECK constraint supports all 5 types.
 *
 * ROOT CAUSE FIX: The old migration assumed a 'balance' column existed and
 * omitted 'updated_at'. Both caused the INSERT...SELECT to fail silently,
 * so the old constraint (B2B/B2C only) stayed — rejecting SUNDRY_DEBTOR
 * with "CHECK constraint failed: customer_type IN ('B2B', 'B2C')".
 *
 * This version reads PRAGMA table_info at runtime to detect actual columns
 * and builds a safe SELECT — works against any schema version.
 */
function ensureCustomerTypeConstraint(db) {
  try {
    const row = db.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='customers'"
    ).get()

    if (row && row.sql && !row.sql.includes('SUNDRY_DEBTOR')) {
      log.info('customerHandlers: running on-demand customers constraint migration')

      const existingCols = db.prepare('PRAGMA table_info(customers)').all().map(c => c.name)
      const hasUpdatedAt = existingCols.includes('updated_at')
      const hasPhone     = existingCols.includes('phone')

      const safePhone     = hasPhone     ? 'phone'              : "'' AS phone"
      const safeUpdatedAt = hasUpdatedAt ? 'updated_at'         : "datetime('now') AS updated_at"
      const safeType =
        "CASE WHEN customer_type IN ('B2B','B2C','CASH','SUNDRY_DEBTOR','SUNDRY_CREDITOR')" +
        " THEN customer_type ELSE 'SUNDRY_DEBTOR' END AS customer_type"

      const colSelect = [
        'id', 'name', safePhone,
        'email', 'gstin', 'billing_address', 'shipping_address', 'state',
        safeType, 'created_at', safeUpdatedAt,
      ].join(', ')

      db.pragma('foreign_keys = OFF')

      // Use string concat so no backtick/quote escaping issues inside exec()
      db.exec(
        'CREATE TABLE IF NOT EXISTS customers_new (' +
          'id               INTEGER PRIMARY KEY AUTOINCREMENT,' +
          'name             TEXT NOT NULL,' +
          "phone            TEXT DEFAULT ''," +
          'email            TEXT,' +
          'gstin            TEXT,' +
          'billing_address  TEXT,' +
          'shipping_address TEXT,' +
          "state            TEXT NOT NULL DEFAULT 'Maharashtra'," +
          "customer_type    TEXT NOT NULL DEFAULT 'SUNDRY_DEBTOR'" +
          " CHECK (customer_type IN ('B2B','B2C','CASH','SUNDRY_DEBTOR','SUNDRY_CREDITOR'))," +
          "created_at       TEXT NOT NULL DEFAULT (datetime('now'))," +
          "updated_at       TEXT NOT NULL DEFAULT (datetime('now'))" +
        ');' +
        'INSERT INTO customers_new SELECT ' + colSelect + ' FROM customers;' +
        'DROP TABLE customers;' +
        'ALTER TABLE customers_new RENAME TO customers;' +
        'CREATE INDEX IF NOT EXISTS idx_customers_name  ON customers(name);' +
        'CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);' +
        'CREATE INDEX IF NOT EXISTS idx_customers_gstin ON customers(gstin);'
      )

      db.pragma('foreign_keys = ON')
      log.info('customerHandlers: customers constraint migration done')
    }
  } catch (e) {
    log.warn('ensureCustomerTypeConstraint failed:', e.message)
    try { db.pragma('foreign_keys = ON') } catch (_) {}
  }
}

/**
 * Auto-heal: fill NULL party_id in payments by name match.
 * Safe to run repeatedly — only touches rows where party_id IS NULL.
 */
function healPaymentPartyIds(db) {
  try {
    db.prepare(`
      UPDATE payments
      SET party_id = (
        SELECT id FROM customers
        WHERE LOWER(TRIM(customers.name)) = LOWER(TRIM(payments.party_name))
        LIMIT 1
      )
      WHERE party_type = 'customer'
        AND party_id IS NULL
        AND party_name IS NOT NULL
        AND party_name != ''
    `).run()
  } catch (e) {
    log.warn('healPaymentPartyIds:', e.message)
  }
}

function ensureCustomerShippingColumns(db) {
  try {
    const existingCols = db.prepare('PRAGMA table_info(customers)').all().map(c => c.name)
    if (!existingCols.includes('shipping_name')) {
      db.exec("ALTER TABLE customers ADD COLUMN shipping_name TEXT DEFAULT ''")
    }
    if (!existingCols.includes('shipping_gstin')) {
      db.exec("ALTER TABLE customers ADD COLUMN shipping_gstin TEXT DEFAULT ''")
    }
    if (!existingCols.includes('shipping_state')) {
      db.exec("ALTER TABLE customers ADD COLUMN shipping_state TEXT DEFAULT ''")
    }
  } catch (e) {
    log.warn('ensureCustomerShippingColumns:', e.message)
  }
}

function registerCustomerHandlers(ipcMain) {
  try {
    const db = getDb()
    ensureCustomerShippingColumns(db)
  } catch (_) {}

  ipcMain.handle('customers:getAll', (event, params = {}) => {
    try {
      const db = getDb()
      ensureCustomerShippingColumns(db)
      const { page = 1, limit = 20, search = '' } = params
      const offset = (page - 1) * limit
      let where = ''
      let args = []
      if (search.trim()) {
        where = `WHERE (name LIKE ? OR phone LIKE ? OR gstin LIKE ?)`
        const s = `%${search.trim()}%`
        args = [s, s, s]
      }
      const total = db.prepare(`SELECT COUNT(*) as cnt FROM customers ${where}`).get(...args).cnt
      const rows  = db.prepare(`SELECT * FROM customers ${where} ORDER BY name ASC LIMIT ? OFFSET ?`).all(...args, limit, offset)
      return { success: true, data: rows, total, page, limit }
    } catch (err) {
      log.error('customers:getAll', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('customers:getById', (event, id) => {
    try {
      const db = getDb()
      const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(id)
      if (!row) return { success: false, error: 'Customer not found' }
      return { success: true, data: row }
    } catch (err) {
      log.error('customers:getById', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('customers:create', (event, data) => {
    try {
      const db = getDb()
      ensureCustomerTypeConstraint(db)

      if (!data.name || data.name.trim().length < 2)
        return { success: false, error: 'Name must be at least 2 characters' }

      const phoneOptional = ['CASH', 'SUNDRY_DEBTOR', 'SUNDRY_CREDITOR'].includes(data.customer_type)
      if (!phoneOptional && (!data.phone || !/^\d{10}$/.test(data.phone.trim())))
        return { success: false, error: 'Phone must be 10 digits' }

      if (!validateGSTIN(data.gstin))
        return { success: false, error: 'Invalid GSTIN format' }
      if (data.shipping_gstin && !validateGSTIN(data.shipping_gstin))
        return { success: false, error: 'Invalid Shipping GSTIN format' }
      if (!data.state)
        return { success: false, error: 'State is required' }

      const safeType = VALID_CUSTOMER_TYPES.includes(data.customer_type)
        ? data.customer_type : 'SUNDRY_DEBTOR'

      const result = db.prepare(`
        INSERT INTO customers (name, phone, email, contact_person, gstin, billing_address, shipping_address, shipping_name, shipping_gstin, shipping_state, state, customer_type)
        VALUES (@name, @phone, @email, @contact_person, @gstin, @billing_address, @shipping_address, @shipping_name, @shipping_gstin, @shipping_state, @state, @customer_type)
      `).run({
        name:             data.name.trim(),
        phone:            (data.phone || '').trim(),
        email:            data.email || '',
        contact_person:   data.contact_person || '',
        gstin:            data.gstin ? data.gstin.trim().toUpperCase() : '',
        billing_address:  data.billing_address || '',
        shipping_address: data.shipping_address || '',
        shipping_name:    data.shipping_name || '',
        shipping_gstin:   data.shipping_gstin ? data.shipping_gstin.trim().toUpperCase() : '',
        shipping_state:   data.shipping_state || '',
        state:            data.state,
        customer_type:    safeType,
      })
      return { success: true, data: { id: result.lastInsertRowid } }
    } catch (err) {
      log.error('customers:create', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('customers:update', (event, data) => {
    try {
      const db = getDb()
      ensureCustomerTypeConstraint(db)

      if (!data.id) return { success: false, error: 'ID required' }
      if (!data.name || data.name.trim().length < 2)
        return { success: false, error: 'Name must be at least 2 characters' }

      const phoneOptional = ['CASH', 'SUNDRY_DEBTOR', 'SUNDRY_CREDITOR'].includes(data.customer_type)
      if (!phoneOptional && (!data.phone || !/^\d{10}$/.test(data.phone.trim())))
        return { success: false, error: 'Phone must be 10 digits' }

      if (!validateGSTIN(data.gstin))
        return { success: false, error: 'Invalid GSTIN format' }
      if (data.shipping_gstin && !validateGSTIN(data.shipping_gstin))
        return { success: false, error: 'Invalid Shipping GSTIN format' }

      const safeType = VALID_CUSTOMER_TYPES.includes(data.customer_type)
        ? data.customer_type : 'SUNDRY_DEBTOR'

      db.prepare(`
        UPDATE customers SET
          name             = @name,
          phone            = @phone,
          email            = @email,
          contact_person   = @contact_person,
          gstin            = @gstin,
          billing_address  = @billing_address,
          shipping_address = @shipping_address,
          shipping_name    = @shipping_name,
          shipping_gstin   = @shipping_gstin,
          shipping_state   = @shipping_state,
          state            = @state,
          customer_type    = @customer_type,
          updated_at       = datetime('now')
        WHERE id = @id
      `).run({
        id:               data.id,
        name:             data.name.trim(),
        phone:            (data.phone || '').trim(),
        email:            data.email || '',
        contact_person:   data.contact_person || '',
        gstin:            data.gstin ? data.gstin.trim().toUpperCase() : '',
        billing_address:  data.billing_address || '',
        shipping_address: data.shipping_address || '',
        shipping_name:    data.shipping_name || '',
        shipping_gstin:   data.shipping_gstin ? data.shipping_gstin.trim().toUpperCase() : '',
        shipping_state:   data.shipping_state || '',
        state:            data.state,
        customer_type:    safeType,
      })
      return { success: true }
    } catch (err) {
      log.error('customers:update', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('customers:delete', (event, id) => {
    try {
      const db = getDb()
      const invoiceCount = db.prepare('SELECT COUNT(*) as cnt FROM invoices WHERE customer_id = ?').get(id).cnt
      if (invoiceCount > 0)
        return { success: false, error: `Cannot delete: ${invoiceCount} invoice(s) exist for this customer` }
      db.prepare('DELETE FROM customers WHERE id = ?').run(id)
      return { success: true }
    } catch (err) {
      log.error('customers:delete', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('customers:getLedger', (event, id) => {
    try {
      const db = getDb()
      const rows = db.prepare(`
        SELECT id, invoice_number, invoice_date, due_date,
               grand_total, amount_received, balance_due, payment_status, status
        FROM invoices WHERE customer_id = ? ORDER BY invoice_date DESC
      `).all(id)
      return { success: true, data: rows }
    } catch (err) {
      log.error('customers:getLedger', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('customers:getPartyLedger', (event, params = {}) => {
    try {
      const db = getDb()
      const { customer_id, startDate, endDate } = params

      if (!customer_id) return { success: false, error: 'customer_id required' }

      healPaymentPartyIds(db)

      const customer = db.prepare('SELECT * FROM customers WHERE id=?').get(customer_id)
      if (!customer) return { success: false, error: 'Customer not found' }

      const custName = (customer.name || '').trim()

      const payMatchSQL = `
        party_type = 'customer'
        AND payment_type = 'receipt'
        AND (
          party_id = ?
          OR (party_id IS NULL AND LOWER(TRIM(party_name)) = LOWER(TRIM(?)))
        )
      `

      let openingBalance = 0
      if (startDate) {
        const obInv = db.prepare(`
          SELECT COALESCE(SUM(grand_total), 0) as total
          FROM invoices
          WHERE customer_id = ? AND status = 'final' AND invoice_date < ?
        `).get(customer_id, startDate)

        const obPay = db.prepare(`
          SELECT COALESCE(SUM(amount), 0) as total
          FROM payments
          WHERE ${payMatchSQL} AND payment_date < ?
        `).get(customer_id, custName, startDate)

        openingBalance = parseFloat(obInv.total || 0) - parseFloat(obPay.total || 0)
      }

      const invDateParts = []
      const invDateArgs  = []
      const payDateParts = []
      const payDateArgs  = []

      if (startDate) {
        invDateParts.push('invoice_date >= ?'); invDateArgs.push(startDate)
        payDateParts.push('payment_date >= ?'); payDateArgs.push(startDate)
      }
      if (endDate) {
        invDateParts.push('invoice_date <= ?'); invDateArgs.push(endDate)
        payDateParts.push('payment_date <= ?'); payDateArgs.push(endDate)
      }

      const invDateSQL = invDateParts.length ? 'AND ' + invDateParts.join(' AND ') : ''
      const payDateSQL = payDateParts.length ? 'AND ' + payDateParts.join(' AND ') : ''

      const invoices = db.prepare(`
        SELECT
          invoice_date   AS date,
          invoice_number AS ref,
          'Invoice'      AS type,
          grand_total    AS debit,
          0              AS credit,
          invoice_number AS narration,
          id             AS ref_id,
          payment_status,
          balance_due,
          amount_received,
          NULL           AS payment_mode
        FROM invoices
        WHERE customer_id = ? AND status = 'final'
        ${invDateSQL}
        ORDER BY invoice_date ASC, id ASC
      `).all(customer_id, ...invDateArgs)

      const standalonePayments = db.prepare(`
        SELECT
          payment_date  AS date,
          reference_no  AS ref,
          'Receipt'     AS type,
          0             AS debit,
          amount        AS credit,
          narration,
          id            AS ref_id,
          payment_mode,
          NULL          AS payment_status,
          NULL          AS balance_due,
          NULL          AS amount_received
        FROM payments
        WHERE ${payMatchSQL}
        ${payDateSQL}
        ORDER BY payment_date ASC, id ASC
      `).all(customer_id, custName, ...payDateArgs)

      const allEntries = [...invoices, ...standalonePayments].sort((a, b) => {
        if (a.date < b.date) return -1
        if (a.date > b.date) return 1
        if (a.type === 'Invoice' && b.type !== 'Invoice') return -1
        if (a.type !== 'Invoice' && b.type === 'Invoice') return 1
        return (a.ref_id || 0) - (b.ref_id || 0)
      })

      let running = openingBalance
      const ledger = allEntries.map(entry => {
        running = running + parseFloat(entry.debit || 0) - parseFloat(entry.credit || 0)
        return { ...entry, running_balance: running }
      })

      const totalDebit  = invoices.reduce((s, e) => s + parseFloat(e.debit || 0), 0)
      const totalCredit = standalonePayments.reduce((s, e) => s + parseFloat(e.credit || 0), 0)

      return {
        success: true,
        data: {
          customer,
          ledger,
          opening_balance: openingBalance,
          total_debit:     totalDebit,
          total_credit:    totalCredit,
          closing_balance: running,
        }
      }
    } catch (err) {
      log.error('customers:getPartyLedger', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('customers:getAllForLedger', () => {
    try {
      const db = getDb()
      const rows = db.prepare(
        'SELECT id, name, gstin, phone, customer_type FROM customers ORDER BY name ASC'
      ).all()
      return { success: true, data: rows }
    } catch (err) {
      log.error('customers:getAllForLedger', err)
      return { success: false, error: err.message }
    }
  })
}

module.exports = { registerCustomerHandlers }
