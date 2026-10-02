import { format, parseISO } from 'date-fns'

export function formatCurrency(amount, symbol = 'Rs. ') {
  const n = parseFloat(amount || 0)
  return `${symbol}${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDate(dateStr, fmt = 'dd/MM/yyyy') {
  if (!dateStr) return ''
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr
    return format(d, fmt)
  } catch {
    return dateStr
  }
}

export function formatDateTime(dateStr) {
  return formatDate(dateStr, 'dd/MM/yyyy HH:mm')
}

export function todayISO() {
  return format(new Date(), 'yyyy-MM-dd')
}

/**
 * Convert number to Indian words (handles lakhs/crores)
 */
const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen']
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function wordsLessThanThousand(n) {
  if (n === 0) return ''
  if (n < 20) return ones[n]
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '')
  return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + wordsLessThanThousand(n % 100) : '')
}

export function numberToWords(amount) {
  const n = Math.round(parseFloat(amount || 0))
  if (n === 0) return 'Zero Rupees Only'

  let result = ''
  let remaining = n

  if (remaining >= 10000000) {
    result += wordsLessThanThousand(Math.floor(remaining / 10000000)) + ' Crore '
    remaining = remaining % 10000000
  }
  if (remaining >= 100000) {
    result += wordsLessThanThousand(Math.floor(remaining / 100000)) + ' Lakh '
    remaining = remaining % 100000
  }
  if (remaining >= 1000) {
    result += wordsLessThanThousand(Math.floor(remaining / 1000)) + ' Thousand '
    remaining = remaining % 1000
  }
  if (remaining > 0) {
    result += wordsLessThanThousand(remaining)
  }

  return 'Rupees ' + result.trim() + ' Only'
}

export function truncate(str, max = 30) {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + '…' : str
}
