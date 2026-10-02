let Database
try {
  Database = require('better-sqlite3')
  const test = new Database(':memory:')
  test.close()
} catch (e) {
  const { DatabaseSync } = require('node:sqlite')
  Database = class BetterSqlite3Compat {
    constructor(dbPath) {
      this._db = new DatabaseSync(dbPath)
    }
    pragma(sql) {
      try {
        if (!sql.trim().toUpperCase().startsWith('PRAGMA')) {
          this._db.exec(`PRAGMA ${sql}`)
        } else {
          this._db.exec(sql)
        }
      } catch (err) {}
    }
    exec(sql) {
      return this._db.exec(sql)
    }
    prepare(sql) {
      const stmt = this._db.prepare(sql)
      return {
        run: (...params) => {
          const res = stmt.run(...params)
          return {
            changes: res ? res.changes : 0,
            lastInsertRowid: res ? res.lastInsertRowid : 0
          }
        },
        get: (...params) => stmt.get(...params),
        all: (...params) => stmt.all(...params)
      }
    }
    transaction(fn) {
      const self = this
      return function(...args) {
        self._db.exec('BEGIN')
        try {
          const res = fn(...args)
          self._db.exec('COMMIT')
          return res
        } catch (err) {
          try { self._db.exec('ROLLBACK') } catch (_) {}
          throw err
        }
      }
    }
    close() {
      return this._db.close()
    }
  }
}
const path = require('path')
const fs = require('fs')
const log = require('electron-log')

let db = null

function initDatabase(userDataPath) {
  // Ensure the directory exists
  const fs = require('fs')
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true })
  }
  // Also ensure logs directory
  const logsDir = path.join(userDataPath, 'logs')
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true })
  }

  const dbPath = path.join(userDataPath, 'database.db')
  log.info('Database path:', dbPath)

  db = new Database(dbPath, {
    verbose: process.env.NODE_ENV === 'development' ? log.info : null,
    timeout: 5000,
  })

  // Enable WAL mode for better concurrency - disabled temporarily to fix lock
  // db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')

  // Run schema
  const schemaPath = path.join(__dirname, 'schema.sql')
  const schema = fs.readFileSync(schemaPath, 'utf-8')
  db.exec(schema)

  // ── Migrations ────────────────────────────────────────
  // Add shipping_gst_percent column to invoices if it doesn't exist
  try {
    const invCols = db.prepare("PRAGMA table_info(invoices)").all()
    const hasShGst = invCols.some(c => c.name === 'shipping_gst_percent')
    if (!hasShGst) {
      db.exec("ALTER TABLE invoices ADD COLUMN shipping_gst_percent REAL DEFAULT 0")
      log.info('Migration: added shipping_gst_percent column to invoices')
    }
  } catch (err) {
    log.warn('Migration invoices check failed:', err.message)
  }

  // Add item_notes column to invoice_items if it doesn't exist
  try {
    const cols = db.prepare("PRAGMA table_info(invoice_items)").all()
    const hasItemNotes = cols.some(c => c.name === 'item_notes')
    if (!hasItemNotes) {
      db.exec("ALTER TABLE invoice_items ADD COLUMN item_notes TEXT")
      log.info('Migration: added item_notes column to invoice_items')
    }
  } catch (err) {
    log.warn('Migration invoice_items check failed:', err.message)
  }

  // Add contact_person column to customers if it doesn't exist
  try {
    const cols = db.prepare("PRAGMA table_info(customers)").all()
    const hasContactPerson = cols.some(c => c.name === 'contact_person')
    if (!hasContactPerson) {
      db.exec("ALTER TABLE customers ADD COLUMN contact_person TEXT")
      log.info('Migration: added contact_person column to customers')
    }
  } catch (err) {
    log.warn('Migration customers check failed:', err.message)
  }

  // Add extended invoice fields if they don't exist
  try {
    const invCols = db.prepare("PRAGMA table_info(invoices)").all()
    const fields = [
      'delivery_note', 'payment_mode_terms', 'reference_no_date', 'other_references',
      'buyers_order_no', 'order_date', 'dispatch_doc_no', 'delivery_note_date',
      'dispatched_through', 'destination', 'vessel_flight_no', 'place_of_receipt_by_shipper',
      'port_of_loading', 'port_of_discharge', 'terms_of_delivery'
    ]
    fields.forEach(f => {
      if (!invCols.some(c => c.name === f)) {
        db.exec(`ALTER TABLE invoices ADD COLUMN ${f} TEXT`)
        log.info(`Migration: added ${f} column to invoices`)
      }
    })
  } catch (err) {
    log.warn('Migration invoices extended fields check failed:', err.message)
  }

  // Add round_off and extra charges to purchase_invoices if they don't exist
  try {
    const pCols = db.prepare("PRAGMA table_info(purchase_invoices)").all()
    const fields = [
      { name: 'round_off', type: 'REAL DEFAULT 0' },
      { name: 'forwarding_charges', type: 'REAL DEFAULT 0' },
      { name: 'forwarding_gst', type: 'REAL DEFAULT 0' },
      { name: 'packaging_charges', type: 'REAL DEFAULT 0' },
      { name: 'packaging_gst', type: 'REAL DEFAULT 0' },
      { name: 'other_charges', type: 'REAL DEFAULT 0' }
    ]
    fields.forEach(f => {
      if (!pCols.some(c => c.name === f.name)) {
        db.exec(`ALTER TABLE purchase_invoices ADD COLUMN ${f.name} ${f.type}`)
        log.info(`Migration: added ${f.name} column to purchase_invoices`)
      }
    })
  } catch (err) {
    log.warn('Migration purchase_invoices check failed:', err.message)
  }

  // ── Migration: Add 'opening_stock' to stock_movements movement_type ──────
    // SQLite doesn't support ALTER COLUMN for CHECK constraints, so we recreate the table
    try {
      const smCols = db.prepare("PRAGMA table_info(stock_movements)").all()
      if (smCols.length > 0) {
        // Check if the CHECK constraint already includes opening_stock by trying an insert+rollback
        try {
          const testStmt = db.prepare("INSERT INTO stock_movements (product_id, movement_type, quantity) VALUES (1, 'opening_stock', 0)")
          db.transaction(() => {
            testStmt.run()
            throw new Error('rollback') // always rollback — we just wanted to test the constraint
          })()
        } catch (constraintErr) {
          if (constraintErr.message && constraintErr.message.includes('CHECK constraint failed')) {
            // Need to migrate: recreate table with updated constraint
            db.exec(`
              PRAGMA foreign_keys = OFF;
              CREATE TABLE IF NOT EXISTS stock_movements_new (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id     INTEGER NOT NULL REFERENCES products(id),
                movement_type  TEXT NOT NULL CHECK (movement_type IN ('sale', 'purchase', 'adjustment', 'sale_reversal', 'opening_stock')),
                quantity       REAL NOT NULL,
                reference_id   INTEGER,
                reference_type TEXT,
                notes          TEXT,
                created_at     TEXT NOT NULL DEFAULT (datetime('now'))
              );
              INSERT INTO stock_movements_new SELECT * FROM stock_movements;
              DROP TABLE stock_movements;
              ALTER TABLE stock_movements_new RENAME TO stock_movements;
              CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
              PRAGMA foreign_keys = ON;
            `)
            log.info('Migration: updated stock_movements CHECK constraint to include opening_stock')
          }
          // If error is 'rollback' — constraint already supports opening_stock, no migration needed
        }
      }
    } catch (err) {
      log.warn('Migration stock_movements check failed:', err.message)
    }

  // ── Migration: Fix customers CHECK constraint to allow SUNDRY_DEBTOR & SUNDRY_CREDITOR ──
  // ROOT CAUSE FIX: Old migration assumed 'balance' column and omitted 'updated_at'.
  // The INSERT...SELECT failed silently => old constraint stayed => SUNDRY_DEBTOR rejected.
  // This version reads PRAGMA table_info to detect actual columns at runtime.
  try {
    const custSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='customers'").get()
    const needsMigration = custSchema && custSchema.sql && !custSchema.sql.includes('SUNDRY_DEBTOR')

    if (needsMigration) {
      log.info('Migration: customers table needs CHECK constraint update')

      const existingCols = db.prepare('PRAGMA table_info(customers)').all().map(c => c.name)
      const hasUpdatedAt = existingCols.includes('updated_at')
      const hasPhone     = existingCols.includes('phone')

      const safePhone     = hasPhone     ? 'phone'             : "'' AS phone"
      const safeUpdatedAt = hasUpdatedAt ? 'updated_at'        : "datetime('now') AS updated_at"
      const safeType =
        "CASE WHEN customer_type IN ('B2B','B2C','CASH','SUNDRY_DEBTOR','SUNDRY_CREDITOR')" +
        " THEN customer_type ELSE 'SUNDRY_DEBTOR' END AS customer_type"

      const colSelect = [
        'id', 'name', safePhone,
        'email', 'gstin', 'billing_address', 'shipping_address', 'state',
        safeType, 'created_at', safeUpdatedAt,
      ].join(', ')

      db.pragma('foreign_keys = OFF')
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
      log.info('Migration: customers CHECK constraint updated successfully')
    }
  } catch (err) {
    log.warn('Migration customers CHECK constraint failed:', err.message)
    try { db.pragma('foreign_keys = ON') } catch(_) {}
  }

  // ── Migration: Add shipping_name and shipping_gstin columns to customers ─
  try {
    const custCols = db.prepare("PRAGMA table_info(customers)").all().map(c => c.name)
    if (!custCols.includes('shipping_name')) {
      db.exec("ALTER TABLE customers ADD COLUMN shipping_name TEXT DEFAULT ''")
      log.info('Migration: added shipping_name column to customers')
    }
    if (!custCols.includes('shipping_gstin')) {
      db.exec("ALTER TABLE customers ADD COLUMN shipping_gstin TEXT DEFAULT ''")
      log.info('Migration: added shipping_gstin column to customers')
    }
  } catch (err) {
    log.warn('Migration customers shipping columns check failed:', err.message)
  }

  // ── Migration: Add shipping_name, shipping_gstin, shipping_address, shipping_state to invoices ─
  try {
    const invCols = db.prepare("PRAGMA table_info(invoices)").all().map(c => c.name)
    if (!invCols.includes('shipping_name')) {
      db.exec("ALTER TABLE invoices ADD COLUMN shipping_name TEXT DEFAULT ''")
      log.info('Migration: added shipping_name column to invoices')
    }
    if (!invCols.includes('shipping_gstin')) {
      db.exec("ALTER TABLE invoices ADD COLUMN shipping_gstin TEXT DEFAULT ''")
      log.info('Migration: added shipping_gstin column to invoices')
    }
    if (!invCols.includes('shipping_address')) {
      db.exec("ALTER TABLE invoices ADD COLUMN shipping_address TEXT DEFAULT ''")
      log.info('Migration: added shipping_address column to invoices')
    }
    if (!invCols.includes('shipping_state')) {
      db.exec("ALTER TABLE invoices ADD COLUMN shipping_state TEXT DEFAULT ''")
      log.info('Migration: added shipping_state column to invoices')
    }
  } catch (err) {
    log.warn('Migration invoices shipping columns check failed:', err.message)
  }

  // ── Migration: Add shipping_state to customers ─
  try {
    const custCols = db.prepare("PRAGMA table_info(customers)").all().map(c => c.name)
    if (!custCols.includes('shipping_state')) {
      db.exec("ALTER TABLE customers ADD COLUMN shipping_state TEXT DEFAULT ''")
      log.info('Migration: added shipping_state column to customers')
    }
  } catch (err) {
    log.warn('Migration customers shipping_state check failed:', err.message)
  }

  // ── Migration: Add invoice_id and purchase_id columns to payments ─────────
  try {
    const pCols = db.prepare("PRAGMA table_info(payments)").all()
    const hasInvoiceId = pCols.some(c => c.name === 'invoice_id')
    const hasPurchaseId = pCols.some(c => c.name === 'purchase_id')
    if (!hasInvoiceId) {
      db.exec("ALTER TABLE payments ADD COLUMN invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL")
      log.info('Migration: added invoice_id column to payments')
    }
    if (!hasPurchaseId) {
      db.exec("ALTER TABLE payments ADD COLUMN purchase_id INTEGER REFERENCES purchase_invoices(id) ON DELETE SET NULL")
      log.info('Migration: added purchase_id column to payments')
    }
  } catch (err) {
    log.warn('Migration payments check failed:', err.message)
  }

  // ── Migration: Add extended quotation fields ──
  try {
    const qCols = db.prepare("PRAGMA table_info(quotations)").all().map(c => c.name)
    const qFields = [
      { name: 'rfq_reference', type: "TEXT DEFAULT ''" },
      { name: 'salesperson', type: "TEXT DEFAULT ''" },
      { name: 'currency', type: "TEXT DEFAULT 'INR'" },
      { name: 'customer_address', type: "TEXT DEFAULT ''" },
      { name: 'customer_gstin', type: "TEXT DEFAULT ''" },
      { name: 'customer_state', type: "TEXT DEFAULT ''" },
      { name: 'customer_phone', type: "TEXT DEFAULT ''" },
      { name: 'customer_email', type: "TEXT DEFAULT ''" },
      { name: 'consignee_name', type: "TEXT DEFAULT ''" },
      { name: 'consignee_address', type: "TEXT DEFAULT ''" },
      { name: 'consignee_gstin', type: "TEXT DEFAULT ''" },
      { name: 'consignee_state', type: "TEXT DEFAULT ''" },
      { name: 'freight', type: "REAL DEFAULT 0" },
      { name: 'packing_charges', type: "REAL DEFAULT 0" },
      { name: 'other_charges', type: "REAL DEFAULT 0" },
      { name: 'tax_rate', type: "REAL DEFAULT 18" },
      { name: 'total_tax', type: "REAL DEFAULT 0" },
      { name: 'round_off', type: "REAL DEFAULT 0" },
      { name: 'amount_in_words', type: "TEXT DEFAULT ''" },
      { name: 'terms_conditions', type: "TEXT DEFAULT ''" },
      { name: 'updated_at', type: "TEXT DEFAULT (datetime('now'))" }
    ]
    qFields.forEach(f => {
      if (!qCols.includes(f.name)) {
        db.exec(`ALTER TABLE quotations ADD COLUMN ${f.name} ${f.type}`)
        log.info(`Migration: added ${f.name} column to quotations`)
      }
    })
  } catch (err) {
    log.warn('Migration quotations check failed:', err.message)
  }

  // ── Migration: Add extended quotation_items fields ──
  try {
    const qiCols = db.prepare("PRAGMA table_info(quotation_items)").all().map(c => c.name)
    const qiFields = [
      { name: 'specification', type: "TEXT DEFAULT ''" },
      { name: 'sort_order', type: "INTEGER DEFAULT 1" }
    ]
    qiFields.forEach(f => {
      if (!qiCols.includes(f.name)) {
        db.exec(`ALTER TABLE quotation_items ADD COLUMN ${f.name} ${f.type}`)
        log.info(`Migration: added ${f.name} column to quotation_items`)
      }
    })
  } catch (err) {
    log.warn('Migration quotation_items check failed:', err.message)
  }

  // ── Default Settings for Quotations ──
  try {
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('quotation_prefix', 'JMA')").run()
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('quotation_sequence', '1023')").run()
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('quotation_number_format', 'PREFIX-YEAR-SEQ')").run()
  } catch (err) {
    log.warn('Quotation settings initialization failed:', err.message)
  }

  log.info('Database schema applied')
  return db
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

function closeDb() {
  if (db) {
    db.close()
    db = null
  }
}

module.exports = { initDatabase, getDb, closeDb }
