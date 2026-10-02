/**
 * Frontend GST helpers — mirrors backend gstCalculator logic
 */

export function r2(n) {
  return Math.round((parseFloat(n || 0) + Number.EPSILON) * 100) / 100
}

export function calcLineItem(rate, qty, discountPercent, gstPercent, supplyType) {
  const base = r2(parseFloat(rate || 0) * parseFloat(qty || 0))
  const discAmt = r2(base * (parseFloat(discountPercent || 0) / 100))
  const taxable = r2(base - discAmt)

  let cgst = 0, sgst = 0, igst = 0
  const gst = parseFloat(gstPercent || 0)

  if (supplyType === 'intra') {
    cgst = r2(taxable * (gst / 2) / 100)
    sgst = r2(taxable * (gst / 2) / 100)
  } else {
    igst = r2(taxable * gst / 100)
  }

  const lineTotal = r2(taxable + cgst + sgst + igst)
  return { base, discAmt, taxable, cgst, sgst, igst, lineTotal }
}

export function calcInvoiceTotals(items, discType, discValue, shipping, supplyType, shippingGstPercent = 0) {
  let subtotal = 0
  let totalTaxable = 0
  let totalCGST = 0
  let totalSGST = 0
  let totalIGST = 0

  for (const item of items) {
    const calc = calcLineItem(
      item.rate, item.quantity, item.discount_percent,
      item.gst_percent, supplyType
    )
    subtotal = r2(subtotal + calc.base)
    totalTaxable = r2(totalTaxable + calc.taxable)
    totalCGST = r2(totalCGST + calc.cgst)
    totalSGST = r2(totalSGST + calc.sgst)
    totalIGST = r2(totalIGST + calc.igst)
  }

  // Invoice-level discount
  let discountAmount = 0
  if (discType === 'percent') {
    discountAmount = r2(subtotal * (parseFloat(discValue || 0) / 100))
  } else {
    discountAmount = r2(Math.min(parseFloat(discValue || 0), subtotal))
  }

  // Adjust proportionally
  let taxableAmount = r2(totalTaxable - discountAmount)
  if (discountAmount > 0 && totalTaxable > 0) {
    const ratio = totalTaxable > 0 ? taxableAmount / totalTaxable : 1
    totalCGST = r2(totalCGST * ratio)
    totalSGST = r2(totalSGST * ratio)
    totalIGST = r2(totalIGST * ratio)
  }

  const shippingAmt = r2(parseFloat(shipping || 0))

  // GST on shipping/forwarding/packaging charges (requirement 4)
  if (shippingAmt > 0 && shippingGstPercent > 0) {
    if (supplyType === 'intra') {
      const shCGST = r2(shippingAmt * (shippingGstPercent / 2) / 100)
      totalCGST = r2(totalCGST + shCGST)
      totalSGST = r2(totalSGST + shCGST)
    } else {
      const shIGST = r2(shippingAmt * shippingGstPercent / 100)
      totalIGST = r2(totalIGST + shIGST)
    }
  }

  const totalTax = r2(totalCGST + totalSGST + totalIGST)
  const preRound = r2(taxableAmount + totalTax + shippingAmt)
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
    shippingCharges: shippingAmt,
    roundOff,
    grandTotal,
  }
}

export const GST_RATES = [0, 5, 12, 18, 28]

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Lakshadweep',
]

export const UNITS = ['pcs', 'kg', 'g', 'l', 'ml', 'm', 'cm', 'box', 'set', 'pair', 'dozen', 'nos', 'sq ft', 'sq m']

export const STATE_CODES = {
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

export const CODE_TO_STATE = Object.entries(STATE_CODES).reduce((acc, [name, code]) => {
  if (!acc[code]) acc[code] = name
  return acc
}, {})

export function getStateCode(stateName) {
  if (!stateName) return ''
  return STATE_CODES[stateName] || ''
}

export function getStateByCode(code) {
  if (!code) return ''
  const cleanCode = code.toString().padStart(2, '0')
  return CODE_TO_STATE[cleanCode] || ''
}

/**
 * Returns complete shipping/consignee display details for an invoice,
 * ensuring independent state name and state code resolution.
 */
export function getShippingInfo(invoice) {
  if (!invoice) return { shippingName: '', shippingAddress: '', shippingGstin: '', shippingState: 'Maharashtra', shippingStateCode: '27' }

  const shippingName = invoice.shipping_name || invoice.customer_shipping_name || invoice.customer_name || ''
  const shippingAddress = invoice.shipping_address || invoice.customer_shipping_address || invoice.customer_billing_address || ''
  const shippingGstin = (invoice.shipping_gstin || invoice.customer_shipping_gstin || '').trim()

  // Determine shipping state:
  // 1. Explicit invoice shipping_state
  // 2. Customer shipping_state
  // 3. Derived from shipping GSTIN first 2 digits
  // 4. Fallback to customer billing state
  // 5. Fallback to place of supply, or default 'Maharashtra'
  let shippingState = invoice.shipping_state || invoice.customer_shipping_state || ''
  if (!shippingState && shippingGstin && shippingGstin.length >= 2) {
    shippingState = getStateByCode(shippingGstin.substring(0, 2))
  }
  if (!shippingState) {
    shippingState = invoice.customer_state || invoice.place_of_supply || 'Maharashtra'
  }

  // Determine shipping state code:
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

/**
 * Returns complete buyer display details for an invoice.
 */
export function getBuyerInfo(invoice) {
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
