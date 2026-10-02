'use strict'

const { getDb } = require('../db/database')
let dialog
try {
  dialog = require('electron').dialog
} catch (_) {}
const fs = require('fs')
const path = require('path')
const log = require('electron-log')

function registerReportHandlers(ipcMain) {
  // ── Sales Summary ─────────────────────────────────────
  ipcMain.handle('reports:getSalesSummary', (event, params = {}) => {
    try {
      const db = getDb()
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth() + 1
      const monthStr = String(month).padStart(2, '0')
      const mtdStart = `${year}-${monthStr}-01`
      // FIX: India financial year runs April 1 – March 31
      const fyYear = month >= 4 ? year : year - 1
      const ytdStart = `${fyYear}-04-01`

      const mtd = db.prepare(`
        SELECT
          COUNT(*) as invoice_count,
          COALESCE(SUM(grand_total), 0) as total_sales,
          COALESCE(SUM(total_cgst), 0) as total_cgst,
          COALESCE(SUM(total_sgst), 0) as total_sgst,
          COALESCE(SUM(total_igst), 0) as total_igst,
          COALESCE(SUM(taxable_amount), 0) as taxable_amount
        FROM invoices
        WHERE status = 'final' AND invoice_date >= ?
      `).get(mtdStart)

      const ytd = db.prepare(`
        SELECT
          COUNT(*) as invoice_count,
          COALESCE(SUM(grand_total), 0) as total_sales,
          COALESCE(SUM(total_cgst), 0) as total_cgst,
          COALESCE(SUM(total_sgst), 0) as total_sgst,
          COALESCE(SUM(total_igst), 0) as total_igst,
          COALESCE(SUM(taxable_amount), 0) as taxable_amount
        FROM invoices
        WHERE status = 'final' AND invoice_date >= ?
      `).get(ytdStart)

      const pending = db.prepare(`
        SELECT COALESCE(SUM(balance_due), 0) as total_pending
        FROM invoices
        WHERE status = 'final' AND payment_status != 'paid'
      `).get()

      const lowStock = db.prepare(`
        SELECT COUNT(*) as cnt FROM products WHERE stock_qty <= min_stock_level
      `).get()

      // Monthly sales for last 6 months
      const monthlySales = db.prepare(`
        SELECT
          strftime('%Y-%m', invoice_date) as month,
          COALESCE(SUM(grand_total), 0) as total,
          COUNT(*) as count
        FROM invoices
        WHERE status = 'final'
          AND invoice_date >= date('now', '-6 months')
        GROUP BY strftime('%Y-%m', invoice_date)
        ORDER BY month ASC
      `).all()

      return {
        success: true,
        data: {
          mtd,
          ytd,
          pendingReceivables: pending.total_pending,
          lowStockCount: lowStock.cnt,
          monthlySales,
        },
      }
    } catch (err) {
      log.error('reports:getSalesSummary', err)
      return { success: false, error: err.message }
    }
  })

  // ── Sales Register ────────────────────────────────────
  ipcMain.handle('reports:getSalesRegister', (event, params = {}) => {
    try {
      const db = getDb()
      const { startDate, endDate } = params

      let conditions = ["i.status = 'final'"]
      let args = []

      if (startDate) { conditions.push('i.invoice_date >= ?'); args.push(startDate) }
      if (endDate) { conditions.push('i.invoice_date <= ?'); args.push(endDate) }

      const where = 'WHERE ' + conditions.join(' AND ')

      const rows = db.prepare(`
        SELECT
          i.invoice_number,
          i.invoice_date,
          c.name as customer_name,
          c.gstin as customer_gstin,
          c.state as customer_state,
          i.supply_type,
          i.place_of_supply,
          i.taxable_amount,
          i.total_cgst,
          i.total_sgst,
          i.total_igst,
          i.total_tax,
          i.grand_total,
          i.payment_status
        FROM invoices i
        LEFT JOIN customers c ON i.customer_id = c.id
        ${where}
        ORDER BY i.invoice_date DESC, i.invoice_number DESC
      `).all(...args)

      return { success: true, data: rows }
    } catch (err) {
      log.error('reports:getSalesRegister', err)
      return { success: false, error: err.message }
    }
  })

  // ── GST Summary (HSN-wise) ────────────────────────────
  ipcMain.handle('reports:getGSTSummary', (event, params = {}) => {
    try {
      const db = getDb()
      const { startDate, endDate } = params

      let conditions = ["i.status = 'final'"]
      let args = []

      if (startDate) { conditions.push('i.invoice_date >= ?'); args.push(startDate) }
      if (endDate) { conditions.push('i.invoice_date <= ?'); args.push(endDate) }

      const where = 'WHERE ' + conditions.join(' AND ')

      const rows = db.prepare(`
        SELECT
          ii.hsn_code,
          ii.description,
          ii.unit,
          SUM(ii.quantity) as total_qty,
          SUM(ii.taxable_amount) as taxable_amount,
          SUM(ii.cgst_amount) as total_cgst,
          SUM(ii.sgst_amount) as total_sgst,
          SUM(ii.igst_amount) as total_igst,
          SUM(ii.total_amount) as total_amount,
          ii.gst_percent
        FROM invoice_items ii
        JOIN invoices i ON ii.invoice_id = i.id
        ${where}
        GROUP BY ii.hsn_code, ii.gst_percent
        ORDER BY ii.hsn_code ASC
      `).all(...args)

      return { success: true, data: rows }
    } catch (err) {
      log.error('reports:getGSTSummary', err)
      return { success: false, error: err.message }
    }
  })

  // ── Stock Report ──────────────────────────────────────
  ipcMain.handle('reports:getStockReport', () => {
    try {
      const db = getDb()

      const products = db.prepare(`
        SELECT
          p.*,
          c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ORDER BY p.name ASC
      `).all()

      const movements = db.prepare(`
        SELECT
          sm.*,
          p.name as product_name
        FROM stock_movements sm
        LEFT JOIN products p ON sm.product_id = p.id
        ORDER BY sm.created_at DESC
        LIMIT 500
      `).all()

      return { success: true, data: { products, movements } }
    } catch (err) {
      log.error('reports:getStockReport', err)
      return { success: false, error: err.message }
    }
  })

  // ── Export CSV ────────────────────────────────────────
  ipcMain.handle('reports:exportCSV', async (event, params) => {
    try {
      const { type, rows, filename } = params

      const result = await dialog.showSaveDialog({
        title: 'Export CSV',
        defaultPath: filename || 'report.csv',
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      })

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Export cancelled' }
      }

      // Build CSV content
      if (!rows || rows.length === 0) {
        return { success: false, error: 'No data to export' }
      }

      const headers = Object.keys(rows[0])
      const csvLines = [
        headers.join(','),
        ...rows.map((row) =>
          headers
            .map((h) => {
              const val = row[h] ?? ''
              const str = String(val).replace(/"/g, '""')
              return `"${str}"`
            })
            .join(',')
        ),
      ]

      fs.writeFileSync(result.filePath, csvLines.join('\n'), 'utf-8')
      return { success: true, data: result.filePath }
    } catch (err) {
      log.error('reports:exportCSV', err)
      return { success: false, error: err.message }
    }
  })

  // ── Stock Ledger (per-product full transaction history with running balance) ──
  ipcMain.handle('reports:getStockLedger', (event, params = {}) => {
    try {
      const db = getDb()
      const { product_id, startDate, endDate } = params

      if (!product_id) return { success: false, error: 'product_id required' }

      const product = db.prepare(`
        SELECT p.*, c.name as category_name FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id=?
      `).get(product_id)
      if (!product) return { success: false, error: 'Product not found' }

      // Opening stock: total in - total out before startDate
      let openingStock = 0
      if (startDate) {
        const incoming = db.prepare(`
          SELECT COALESCE(SUM(quantity),0) as total FROM stock_movements
          WHERE product_id=? AND movement_type IN ('purchase','adjustment','sale_reversal') AND created_at < ?
        `).get(product_id, startDate + ' 00:00:00')
        const outgoing = db.prepare(`
          SELECT COALESCE(SUM(quantity),0) as total FROM stock_movements
          WHERE product_id=? AND movement_type='sale' AND created_at < ?
        `).get(product_id, startDate + ' 00:00:00')
        openingStock = parseFloat(incoming.total || 0) - parseFloat(outgoing.total || 0)
      }

      // Build where for date range
      let conds = ['product_id=?']
      let args = [product_id]
      if (startDate) { conds.push("date(created_at) >= ?"); args.push(startDate) }
      if (endDate)   { conds.push("date(created_at) <= ?"); args.push(endDate) }

      const movements = db.prepare(`
        SELECT
          sm.*,
          CASE
            WHEN sm.movement_type='sale'         THEN 'Sales'
            WHEN sm.movement_type='purchase'      THEN 'Purchase'
            WHEN sm.movement_type='sale_reversal' THEN 'Sale Reversal'
            WHEN sm.movement_type='adjustment'    THEN 'Adjustment'
            WHEN sm.movement_type='opening_stock'  THEN 'Opening Stock'
            ELSE sm.movement_type
          END as type_label,
          CASE WHEN sm.movement_type='sale' THEN sm.quantity ELSE 0 END as qty_out,
          CASE WHEN sm.movement_type IN ('purchase', 'opening_stock', 'sale_reversal', 'adjustment') THEN sm.quantity ELSE 0 END as qty_in
        FROM stock_movements sm
        WHERE ${conds.join(' AND ')}
        ORDER BY sm.created_at ASC, sm.id ASC
      `).all(...args)

      // Add running stock balance
      let running = openingStock
      const ledger = movements.map(m => {
        const qIn  = parseFloat(m.qty_in || 0)
        const qOut = parseFloat(m.qty_out || 0)
        running = running + qIn - qOut
        return { ...m, running_balance: running }
      })

      // All products for selector
      const allProducts = db.prepare(`SELECT id, name, hsn_code FROM products ORDER BY name ASC`).all()

      return {
        success: true,
        data: {
          product,
          ledger,
          opening_stock: openingStock,
          total_in: movements.reduce((s, m) => s + parseFloat(m.qty_in || 0), 0),
          total_out: movements.reduce((s, m) => s + parseFloat(m.qty_out || 0), 0),
          closing_stock: running,
          all_products: allProducts,
        }
      }
    } catch (err) {
      log.error('reports:getStockLedger', err)
      return { success: false, error: err.message }
    }
  })

  // ── Get all products for stock ledger selector ──
  ipcMain.handle('reports:getAllProductsForLedger', () => {
    try {
      const db = getDb()
      const rows = db.prepare(`SELECT id, name, hsn_code, unit, stock_qty FROM products ORDER BY name ASC`).all()
      return { success: true, data: rows }
    } catch (err) {
      log.error('reports:getAllProductsForLedger', err)
      return { success: false, error: err.message }
    }
  })

  // ── Purchase Register ────────────────────────────────────
  ipcMain.handle('reports:getPurchaseRegister', (event, params = {}) => {
    try {
      const db = getDb()
      const { startDate, endDate } = params

      let conditions = []
      let args = []

      if (startDate) { conditions.push('p.bill_date >= ?'); args.push(startDate) }
      if (endDate) { conditions.push('p.bill_date <= ?'); args.push(endDate) }

      const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

      const rows = db.prepare(`
        SELECT
          p.bill_number,
          p.bill_date,
          p.supplier_name,
          p.supplier_gstin,
          p.supplier_state,
          p.supply_type,
          p.taxable_amount,
          p.total_cgst,
          p.total_sgst,
          p.total_igst,
          p.total_tax,
          p.grand_total,
          p.payment_status
        FROM purchase_invoices p
        ${where}
        ORDER BY p.bill_date DESC, p.bill_number DESC
      `).all(...args)

      return { success: true, data: rows }
    } catch (err) {
      log.error('reports:getPurchaseRegister', err)
      return { success: false, error: err.message }
    }
  })

  // ── Purchase GST Summary (HSN-wise) ────────────────────────────
  ipcMain.handle('reports:getPurchaseGSTSummary', (event, params = {}) => {
    try {
      const db = getDb()
      const { startDate, endDate } = params

      let conditions = []
      let args = []

      if (startDate) { conditions.push('p.bill_date >= ?'); args.push(startDate) }
      if (endDate) { conditions.push('p.bill_date <= ?'); args.push(endDate) }

      const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

      const rows = db.prepare(`
        SELECT
          pi.hsn_code,
          pi.description,
          pi.unit,
          SUM(pi.quantity) as total_qty,
          SUM(pi.taxable_amount) as taxable_amount,
          SUM(pi.cgst_amount) as total_cgst,
          SUM(pi.sgst_amount) as total_sgst,
          SUM(pi.igst_amount) as total_igst,
          SUM(pi.total_amount) as total_amount,
          pi.gst_percent
        FROM purchase_invoice_items pi
        JOIN purchase_invoices p ON pi.purchase_id = p.id
        ${where}
        GROUP BY pi.hsn_code, pi.gst_percent
        ORDER BY pi.hsn_code ASC
      `).all(...args)

      return { success: true, data: rows }
    } catch (err) {
      log.error('reports:getPurchaseGSTSummary', err)
      return { success: false, error: err.message }
    }
  })


}

module.exports = { registerReportHandlers }
