'use strict'

const { getDb } = require('../db/database')
const log = require('electron-log')

const VALID_GST = [0, 5, 12, 18, 28]

function registerProductHandlers(ipcMain) {
  // ── Get All ───────────────────────────────────────────
  ipcMain.handle('products:getAll', (event, params = {}) => {
    try {
      const db = getDb()
      const { page = 1, limit = 20, search = '', lowStock = false } = params
      const offset = (page - 1) * limit

      let conditions = []
      let args = []

      if (search.trim()) {
        conditions.push('(p.name LIKE ? OR p.hsn_code LIKE ?)')
        const s = `%${search.trim()}%`
        args.push(s, s)
      }

      if (lowStock) {
        conditions.push('p.stock_qty <= p.min_stock_level')
      }

      const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''

      const total = db
        .prepare(`SELECT COUNT(*) as cnt FROM products p ${where}`)
        .get(...args).cnt

      let rows
      // If limit is large (like for search), return all products without pagination
      if (limit >= 100) {
        rows = db
          .prepare(`
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            ${where}
            ORDER BY p.name ASC
          `)
          .all(...args)
      } else {
        rows = db
          .prepare(`
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            ${where}
            ORDER BY p.name ASC
            LIMIT ? OFFSET ?
          `)
          .all(...args, limit, offset)
      }

      return { success: true, data: rows, total, page, limit }
    } catch (err) {
      log.error('products:getAll', err)
      return { success: false, error: err.message }
    }
  })

  // ── Get By ID ─────────────────────────────────────────
  ipcMain.handle('products:getById', (event, id) => {
    try {
      const db = getDb()
      const row = db
        .prepare(`
          SELECT p.*, c.name as category_name
          FROM products p
          LEFT JOIN categories c ON p.category_id = c.id
          WHERE p.id = ?
        `)
        .get(id)
      if (!row) return { success: false, error: 'Product not found' }
      return { success: true, data: row }
    } catch (err) {
      log.error('products:getById', err)
      return { success: false, error: err.message }
    }
  })

  // ── Create ────────────────────────────────────────────
  ipcMain.handle('products:create', (event, data) => {
    try {
      const db = getDb()

      if (!data.name || !data.name.trim())
        return { success: false, error: 'Name is required' }
      if (!data.hsn_code || !/^\d{4,8}$/.test(data.hsn_code.trim()))
        return { success: false, error: 'HSN code must be 4-8 digits' }
      if (!data.selling_price || parseFloat(data.selling_price) <= 0)
        return { success: false, error: 'Selling price must be greater than 0' }
      if (!VALID_GST.includes(parseFloat(data.gst_percent)))
        return { success: false, error: 'GST% must be 0, 5, 12, 18, or 28' }
      if (parseFloat(data.stock_qty || 0) < 0)
        return { success: false, error: 'Stock quantity cannot be negative' }

      const result = db
        .prepare(`
          INSERT INTO products
            (name, hsn_code, category_id, unit, purchase_price,
             selling_price, gst_percent, stock_qty, min_stock_level, description)
          VALUES
            (@name, @hsn_code, @category_id, @unit, @purchase_price,
             @selling_price, @gst_percent, @stock_qty, @min_stock_level, @description)
        `)
        .run({
          name: data.name.trim(),
          hsn_code: data.hsn_code.trim(),
          category_id: data.category_id || null,
          unit: data.unit || 'pcs',
          purchase_price: parseFloat(data.purchase_price || 0),
          selling_price: parseFloat(data.selling_price),
          gst_percent: parseFloat(data.gst_percent),
          stock_qty: parseFloat(data.stock_qty || 0),
          min_stock_level: parseFloat(data.min_stock_level || 5),
          description: data.description || '',
        })

      // Always register opening stock in stock master (even if qty = 0)
      db.prepare(`
        INSERT INTO stock_movements
          (product_id, movement_type, quantity, reference_type, notes)
        VALUES (?, 'opening_stock', ?, 'initial', 'Opening stock entry')
      `).run(result.lastInsertRowid, parseFloat(data.stock_qty || 0))

      return { success: true, data: { id: result.lastInsertRowid } }
    } catch (err) {
      log.error('products:create', err)
      return { success: false, error: err.message }
    }
  })

  // ── Update ────────────────────────────────────────────
  ipcMain.handle('products:update', (event, data) => {
    try {
      const db = getDb()

      if (!data.id) return { success: false, error: 'ID required' }
      if (!data.name || !data.name.trim())
        return { success: false, error: 'Name is required' }
      if (!data.hsn_code || !/^\d{4,8}$/.test(data.hsn_code.trim()))
        return { success: false, error: 'HSN code must be 4-8 digits' }
      if (!data.selling_price || parseFloat(data.selling_price) <= 0)
        return { success: false, error: 'Selling price must be greater than 0' }
      if (!VALID_GST.includes(parseFloat(data.gst_percent)))
        return { success: false, error: 'GST% must be 0, 5, 12, 18, or 28' }

      db.prepare(`
        UPDATE products SET
          name = @name,
          hsn_code = @hsn_code,
          category_id = @category_id,
          unit = @unit,
          purchase_price = @purchase_price,
          selling_price = @selling_price,
          gst_percent = @gst_percent,
          min_stock_level = @min_stock_level,
          description = @description
        WHERE id = @id
      `).run({
        id: data.id,
        name: data.name.trim(),
        hsn_code: data.hsn_code.trim(),
        category_id: data.category_id || null,
        unit: data.unit || 'pcs',
        purchase_price: parseFloat(data.purchase_price || 0),
        selling_price: parseFloat(data.selling_price),
        gst_percent: parseFloat(data.gst_percent),
        min_stock_level: parseFloat(data.min_stock_level || 5),
        description: data.description || '',
      })

      return { success: true }
    } catch (err) {
      log.error('products:update', err)
      return { success: false, error: err.message }
    }
  })

  // ── Delete ────────────────────────────────────────────
  ipcMain.handle('products:delete', (event, id) => {
    try {
      const db = getDb()

      const count = db
        .prepare(`
          SELECT COUNT(*) as cnt FROM invoice_items ii
          JOIN invoices i ON ii.invoice_id = i.id
          WHERE ii.product_id = ? AND i.status = 'final'
        `)
        .get(id).cnt

      if (count > 0) {
        return {
          success: false,
          error: `Cannot delete: product used in ${count} finalized invoice(s)`,
        }
      }

      db.prepare('DELETE FROM products WHERE id = ?').run(id)
      return { success: true }
    } catch (err) {
      log.error('products:delete', err)
      return { success: false, error: err.message }
    }
  })

  // ── Adjust Stock ──────────────────────────────────────
  ipcMain.handle('products:adjustStock', (event, data) => {
    try {
      const db = getDb()
      const { product_id, quantity, movement_type = 'adjustment', notes } = data

      if (!product_id) return { success: false, error: 'Product ID required' }

      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id)
      if (!product) return { success: false, error: 'Product not found' }

      const newStock = parseFloat(product.stock_qty) + parseFloat(quantity)
      if (newStock < 0) {
        return { success: false, error: 'Insufficient stock for this adjustment' }
      }

      db.prepare('UPDATE products SET stock_qty = ? WHERE id = ?').run(newStock, product_id)

      db.prepare(`
        INSERT INTO stock_movements
          (product_id, movement_type, quantity, reference_type, notes)
        VALUES (?, ?, ?, 'manual', ?)
      `).run(product_id, movement_type, parseFloat(quantity), notes || '')

      return { success: true, data: { new_stock: newStock } }
    } catch (err) {
      log.error('products:adjustStock', err)
      return { success: false, error: err.message }
    }
  })

  // ── Get Low Stock ─────────────────────────────────────
  ipcMain.handle('products:getLowStock', (event) => {
    try {
      const db = getDb()
      const rows = db
        .prepare(`
          SELECT p.*, c.name as category_name
          FROM products p
          LEFT JOIN categories c ON p.category_id = c.id
          WHERE p.stock_qty <= p.min_stock_level
          ORDER BY p.stock_qty ASC
        `)
        .all()
      return { success: true, data: rows }
    } catch (err) {
      log.error('products:getLowStock', err)
      return { success: false, error: err.message }
    }
  })

  // ── Get Categories ────────────────────────────────────
  ipcMain.handle('products:getCategories', (event) => {
    try {
      const db = getDb()
      const rows = db.prepare('SELECT * FROM categories ORDER BY name ASC').all()
      return { success: true, data: rows }
    } catch (err) {
      log.error('products:getCategories', err)
      return { success: false, error: err.message }
    }
  })
}

module.exports = { registerProductHandlers }
