'use strict'

/**
 * Round to 2 decimal places
 */
function r2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Calculate a single line item's GST breakdown
 *
 * @param {number} rate          - Unit price
 * @param {number} qty           - Quantity
 * @param {string} discountType  - 'percent' | 'flat'
 * @param {number} discountVal   - Discount value
 * @param {number} gstPercent    - GST rate (0/5/12/18/28)
 * @param {string} supplyType    - 'intra' | 'inter'
 * @returns {{ taxableAmount, discountAmount, cgst, sgst, igst, lineTotal }}
 */
function calculateLineItem(rate, qty, discountType, discountVal, gstPercent, supplyType) {
  const baseAmount = r2(rate * qty)

  let discountAmount = 0
  if (discountType === 'percent') {
    discountAmount = r2(baseAmount * (discountVal / 100))
  } else {
    discountAmount = r2(Math.min(discountVal || 0, baseAmount))
  }

  const taxableAmount = r2(baseAmount - discountAmount)

  let cgst = 0
  let sgst = 0
  let igst = 0

  if (supplyType === 'intra') {
    cgst = r2(taxableAmount * (gstPercent / 2) / 100)
    sgst = r2(taxableAmount * (gstPercent / 2) / 100)
    igst = 0
  } else {
    cgst = 0
    sgst = 0
    igst = r2(taxableAmount * (gstPercent / 100))
  }

  const lineTotal = r2(taxableAmount + cgst + sgst + igst)

  return {
    taxableAmount,
    discountAmount,
    cgst,
    sgst,
    igst,
    lineTotal,
  }
}

/**
 * Calculate full invoice totals from line items + header discounts
 *
 * @param {Array}  lineItems           - Array of computed line items
 * @param {string} invoiceDiscType     - 'percent' | 'flat'
 * @param {number} invoiceDiscValue    - Discount value
 * @param {number} shippingCharges     - Shipping amount
 * @param {string} supplyType          - 'intra' | 'inter'
 * @param {number} shippingGstPercent  - GST % on shipping (0/5/12/18/28), default 0
 * @returns {Object} Full invoice totals
 */
function calculateInvoiceTotals(lineItems, invoiceDiscType, invoiceDiscValue, shippingCharges, supplyType, shippingGstPercent = 0) {
  // Sum up line-level totals
  let subtotal = 0
  let lineTaxable = 0
  let totalCGST = 0
  let totalSGST = 0
  let totalIGST = 0

  for (const item of lineItems) {
    subtotal = r2(subtotal + r2((item.rate || 0) * (item.quantity || 0)))
    lineTaxable = r2(lineTaxable + (item.taxableAmount || 0))
    totalCGST = r2(totalCGST + (item.cgst || 0))
    totalSGST = r2(totalSGST + (item.sgst || 0))
    totalIGST = r2(totalIGST + (item.igst || 0))
  }

  // Invoice-level discount
  let discountAmount = 0
  if (invoiceDiscType === 'percent') {
    discountAmount = r2(subtotal * ((invoiceDiscValue || 0) / 100))
  } else {
    discountAmount = r2(Math.min(invoiceDiscValue || 0, subtotal))
  }

  // Recalculate taxable after invoice discount
  // Distribute proportionally across items
  const taxableAmount = r2(lineTaxable - discountAmount)

  // Adjust tax proportionally for invoice discount
  if (discountAmount > 0 && lineTaxable > 0) {
    const ratio = taxableAmount / lineTaxable
    totalCGST = r2(totalCGST * ratio)
    totalSGST = r2(totalSGST * ratio)
    totalIGST = r2(totalIGST * ratio)
  }

  const shipping = r2(shippingCharges || 0)

  // FIX: Apply GST on shipping charges (mirrors frontend gstHelpers.js)
  if (shipping > 0 && shippingGstPercent > 0) {
    if (supplyType === 'intra') {
      const shCGST = r2(shipping * (shippingGstPercent / 2) / 100)
      totalCGST = r2(totalCGST + shCGST)
      totalSGST = r2(totalSGST + shCGST)
    } else {
      const shIGST = r2(shipping * shippingGstPercent / 100)
      totalIGST = r2(totalIGST + shIGST)
    }
  }

  const totalTax = r2(totalCGST + totalSGST + totalIGST)

  const preRound = r2(taxableAmount + totalTax + shipping)
  const roundOff = r2(Math.round(preRound) - preRound)
  const grandTotal = r2(preRound + roundOff)

  return {
    subtotal,
    discountAmount,
    taxableAmount,
    totalCGST,
    totalSGST,
    totalIGST,
    totalTax,
    shippingCharges: shipping,
    roundOff,
    grandTotal,
  }
}

const STATE_CODES = {
  'Andaman and Nicobar Islands': '35',
  'Andhra Pradesh': '37',
  'Arunachal Pradesh': '12',
  'Assam': '18',
  'Bihar': '10',
  'Chandigarh': '04',
  'Chhattisgarh': '22',
  'Dadra and Nagar Haveli and Daman and Diu': '26',
  'Delhi': '07',
  'Goa': '30',
  'Gujarat': '24',
  'Haryana': '06',
  'Himachal Pradesh': '02',
  'Jammu and Kashmir': '01',
  'Jharkhand': '20',
  'Karnataka': '29',
  'Kerala': '32',
  'Ladakh': '38',
  'Lakshadweep': '31',
  'Madhya Pradesh': '23',
  'Maharashtra': '27',
  'Manipur': '14',
  'Meghalaya': '17',
  'Mizoram': '15',
  'Nagaland': '13',
  'Odisha': '21',
  'Puducherry': '34',
  'Punjab': '03',
  'Rajasthan': '08',
  'Sikkim': '11',
  'Tamil Nadu': '33',
  'Telangana': '36',
  'Tripura': '16',
  'Uttar Pradesh': '09',
  'Uttarakhand': '05',
  'West Bengal': '19',
}

const CODE_TO_STATE = Object.entries(STATE_CODES).reduce((acc, [name, code]) => {
  if (!acc[code]) acc[code] = name
  return acc
}, {})

function getStateCode(stateName) {
  if (!stateName) return ''
  return STATE_CODES[stateName] || ''
}

function getStateByCode(code) {
  if (!code) return ''
  const cleanCode = code.toString().padStart(2, '0')
  return CODE_TO_STATE[cleanCode] || ''
}

function getShippingInfo(invoice) {
  if (!invoice) return { shippingName: '', shippingAddress: '', shippingGstin: '', shippingState: 'Maharashtra', shippingStateCode: '27' }

  const shippingName = invoice.shipping_name || invoice.customer_shipping_name || invoice.customer_name || ''
  const shippingAddress = invoice.shipping_address || invoice.customer_shipping_address || invoice.customer_billing_address || ''
  const shippingGstin = (invoice.shipping_gstin || invoice.customer_shipping_gstin || '').trim()

  let shippingState = invoice.shipping_state || invoice.customer_shipping_state || ''
  if (!shippingState && shippingGstin && shippingGstin.length >= 2) {
    shippingState = getStateByCode(shippingGstin.substring(0, 2))
  }
  if (!shippingState) {
    shippingState = invoice.customer_state || invoice.place_of_supply || 'Maharashtra'
  }

  let shippingStateCode = invoice.shipping_state_code || ''
  if (!shippingStateCode && shippingGstin && shippingGstin.length >= 2) {
    shippingStateCode = shippingGstin.substring(0, 2)
  }
  if (!shippingStateCode && shippingState) {
    shippingStateCode = getStateCode(shippingState)
  }
  if (!shippingStateCode && invoice.customer_state) {
    shippingStateCode = getStateCode(invoice.customer_state)
  }

  return {
    shippingName,
    shippingAddress,
    shippingGstin,
    shippingState,
    shippingStateCode: shippingStateCode || (shippingState === 'Maharashtra' ? '27' : '')
  }
}

function getBuyerInfo(invoice) {
  if (!invoice) return { buyerName: '', buyerAddress: '', buyerGstin: '', buyerState: 'Maharashtra', buyerStateCode: '27' }

  const buyerName = invoice.customer_name || ''
  const buyerAddress = invoice.customer_billing_address || ''
  const buyerGstin = (invoice.customer_gstin || '').trim()
  const buyerState = invoice.customer_state || invoice.place_of_supply || 'Maharashtra'

  let buyerStateCode = invoice.customer_state_code || ''
  if (!buyerStateCode && buyerGstin && buyerGstin.length >= 2) {
    buyerStateCode = buyerGstin.substring(0, 2)
  }
  if (!buyerStateCode && buyerState) {
    buyerStateCode = getStateCode(buyerState)
  }

  return {
    buyerName,
    buyerAddress,
    buyerGstin,
    buyerState,
    buyerStateCode: buyerStateCode || (buyerState === 'Maharashtra' ? '27' : '')
  }
}

module.exports = {
  calculateLineItem,
  calculateInvoiceTotals,
  r2,
  STATE_CODES,
  CODE_TO_STATE,
  getStateCode,
  getStateByCode,
  getShippingInfo,
  getBuyerInfo
}
