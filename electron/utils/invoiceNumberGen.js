'use strict'

const { getDb } = require('../db/database')

function getFinancialYear() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  if (month >= 4) return `${String(year).slice(2)}-${String(year + 1).slice(2)}`
  return `${String(year - 1).slice(2)}-${String(year).slice(2)}`
}

function getCurrentResetKey(resetMode) {
  const now = new Date()
  if (resetMode === 'monthly') {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }
  if (resetMode === 'yearly') {
    const month = now.getMonth() + 1
    const year = now.getFullYear()
    return month >= 4 ? String(year) : String(year - 1)
  }
  return ''
}

function checkAndResetSequence() {
  const db = getDb()
  const resetRow = db.prepare("SELECT value FROM settings WHERE key = 'invoice_reset'").get()
  const resetMode = (resetRow && resetRow.value) || 'never'
  if (resetMode === 'never') return

  const currentKey = getCurrentResetKey(resetMode)
  const lastKeyRow = db.prepare("SELECT value FROM settings WHERE key = 'invoice_last_reset_key'").get()
  const lastKey = lastKeyRow ? lastKeyRow.value : ''

  if (currentKey !== lastKey) {
    db.prepare("UPDATE settings SET value = '1' WHERE key = 'invoice_sequence'").run()
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('invoice_last_reset_key', ?)").run(currentKey)
  }
}

function getNextInvoiceNumber() {
  const db = getDb()
  checkAndResetSequence()

  const prefix = db.prepare("SELECT value FROM settings WHERE key = 'invoice_prefix'").get()
  const seq    = db.prepare("SELECT value FROM settings WHERE key = 'invoice_sequence'").get()
  const fmt    = db.prepare("SELECT value FROM settings WHERE key = 'invoice_number_format'").get()

  const prefixVal = (prefix && prefix.value) || 'INV'
  const seqVal    = parseInt((seq && seq.value) || '1', 10)
  const fmtVal    = (fmt && fmt.value) || 'PREFIX/SEQ/FY'
  const fy        = getFinancialYear()
  const seqStr    = String(seqVal).padStart(4, '0')

  return fmtVal
    .replace('PREFIX', prefixVal)
    .replace('SEQ', seqStr)
    .replace('FY', fy)
    .replace('YEAR', new Date().getFullYear().toString())
}

function incrementSequence(dbParam) {
  const db = dbParam || getDb()
  // Atomic increment: first ensure the setting exists, then increment
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('invoice_sequence', '1')").run()
  db.prepare(`
    UPDATE settings 
    SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT) 
    WHERE key = 'invoice_sequence'
  `).run()
}

module.exports = { getNextInvoiceNumber, incrementSequence }
