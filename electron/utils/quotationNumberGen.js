'use strict'

const { getDb } = require('../db/database')

function getFinancialYear() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  if (month >= 4) return `${String(year).slice(2)}-${String(year + 1).slice(2)}`
  return `${String(year - 1).slice(2)}-${String(year).slice(2)}`
}

function getNextQuotationNumber() {
  const db = getDb()
  const prefixRow = db.prepare("SELECT value FROM settings WHERE key = 'quotation_prefix'").get()
  const seqRow    = db.prepare("SELECT value FROM settings WHERE key = 'quotation_sequence'").get()
  const fmtRow    = db.prepare("SELECT value FROM settings WHERE key = 'quotation_number_format'").get()

  const prefixVal = (prefixRow && prefixRow.value) || 'JMA'
  let seqVal      = parseInt((seqRow && seqRow.value) || '1023', 10)
  const fmtVal    = (fmtRow && fmtRow.value) || 'PREFIX-YEAR-SEQ'
  const yearStr   = new Date().getFullYear().toString()
  const fy        = getFinancialYear()

  // Verify against existing quotation numbers in the database to ensure sequential integrity and avoid duplicate numbers
  const existing = db.prepare("SELECT quotation_number FROM quotations WHERE quotation_number LIKE ? ORDER BY id DESC").all(`${prefixVal}-${yearStr}-%`)
  if (existing && existing.length > 0) {
    let maxFound = seqVal - 1
    for (const row of existing) {
      const parts = (row.quotation_number || '').split('-')
      const num = parseInt(parts[parts.length - 1], 10)
      if (!isNaN(num) && num > maxFound) {
        maxFound = num
      }
    }
    if (maxFound >= seqVal) {
      seqVal = maxFound + 1
    }
  }

  const seqStr = String(seqVal).padStart(4, '0')

  return fmtVal
    .replace('PREFIX', prefixVal)
    .replace('SEQ', seqStr)
    .replace('FY', fy)
    .replace('YEAR', yearStr)
}

function incrementQuotationSequence(usedNumber, dbParam) {
  const db = dbParam || getDb()
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('quotation_sequence', '1023')").run()

  if (usedNumber) {
    const parts = String(usedNumber).split('-')
    const lastNum = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(lastNum)) {
      const curr = db.prepare("SELECT value FROM settings WHERE key = 'quotation_sequence'").get()
      const currVal = parseInt((curr && curr.value) || '1023', 10)
      if (lastNum >= currVal) {
        db.prepare("UPDATE settings SET value = ? WHERE key = 'quotation_sequence'").run(String(lastNum + 1))
        return
      }
    }
  }

  db.prepare(`
    UPDATE settings 
    SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT) 
    WHERE key = 'quotation_sequence'
  `).run()
}

module.exports = { getNextQuotationNumber, incrementQuotationSequence }
