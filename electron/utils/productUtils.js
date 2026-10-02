'use strict'

const log = require('electron-log')

/**
 * Given an invoice/purchase item, find an existing product by name or create a new one.
 * Returns the product_id (integer) to link to the item row.
 */
function findOrCreateProduct(db, item) {
  const name = (item.description || '').trim()
  if (!name) return null

  // Try to find existing product by exact name (case-insensitive)
  const existing = db
    .prepare("SELECT id FROM products WHERE LOWER(name) = LOWER(?)")
    .get(name)

  if (existing) return existing.id

  // Validate HSN — use '0000' as placeholder if missing or non-numeric
  const hsnRaw = (item.hsn_code || '').trim()
  const hsn = /^\d{4,8}$/.test(hsnRaw) ? hsnRaw : '0000'

  // Create new product using item details
  const res = db.prepare(`
    INSERT INTO products
      (name, hsn_code, unit, purchase_price, selling_price, gst_percent,
       stock_qty, min_stock_level, description)
    VALUES
      (@name, @hsn, @unit, @price, @price, @gst, 0, 5, '')
  `).run({
    name,
    hsn,
    unit: item.unit || 'pcs',
    price: parseFloat(item.rate || 0),
    gst: parseFloat(item.gst_percent || 18),
  })

  const productId = res.lastInsertRowid

  // Record opening stock entry (qty=0) so product appears in Stock Master
  db.prepare(`
    INSERT INTO stock_movements
      (product_id, movement_type, quantity, reference_type, notes)
    VALUES (?, 'opening_stock', 0, 'initial', 'Auto-created from invoice/purchase')
  `).run(productId)

  log.info(`Auto-created product "${name}" (id=${productId}) from item`)
  return productId
}

module.exports = { findOrCreateProduct }
