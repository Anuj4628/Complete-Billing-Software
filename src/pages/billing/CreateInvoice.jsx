import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2, ChevronDown, UserPlus } from 'lucide-react'
import { useInvoiceStore } from '../../store/useInvoiceStore.js'
import { useSettingsStore } from '../../store/useSettingsStore.js'
import Button from '../../components/ui/Button.jsx'
import Input, { Select, Textarea } from '../../components/ui/Input.jsx'
import Modal from '../../components/ui/Modal.jsx'
import { calcLineItem, calcInvoiceTotals, GST_RATES, INDIAN_STATES, UNITS, getStateCode, getStateByCode } from '../../utils/gstHelpers.js'
import { formatCurrency, todayISO } from '../../utils/formatters.js'

const EMPTY_ITEM = {
  product_id: null, description: '', item_notes: '', hsn_code: '', quantity: '1',
  unit: 'pcs', rate: '', discount_percent: '0', gst_percent: '18',
}

function newItem() { return { ...EMPTY_ITEM, _key: Math.random() } }

const EMPTY_CUSTOMER = {
  name: '', phone: '', email: '', gstin: '',
  billing_address: '', shipping_address: '',
  shipping_name: '', shipping_gstin: '',
  state: 'Maharashtra', customer_type: 'SUNDRY_DEBTOR',
}

export default function CreateInvoice() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id
  const { createInvoice, updateInvoice, getById } = useInvoiceStore()
  const { settings, loadSettings, showToast } = useSettingsStore()

  // ── Header state ──────────────────────────────────────
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(todayISO())
  const [dueDate, setDueDate] = useState('')
  const [invoiceStatus, setInvoiceStatus] = useState('draft')

  // ── Customer state ────────────────────────────────────
  const [customers, setCustomers] = useState([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerDropOpen, setCustomerDropOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [supplyType, setSupplyType] = useState('intra')
  const [placeOfSupply, setPlaceOfSupply] = useState('Maharashtra')
  const [addCustModal, setAddCustModal] = useState(false)
  const [newCust, setNewCust] = useState(EMPTY_CUSTOMER)
  const [custErrors, setCustErrors] = useState({})
  const [savingCust, setSavingCust] = useState(false)

  // ── Line items ────────────────────────────────────────
  const [items, setItems] = useState([newItem()])
  const [products, setProducts] = useState([])
  const [productSearches, setProductSearches] = useState({})
  const [productDropOpen, setProductDropOpen] = useState({})
  const [productResults, setProductResults] = useState({})

  // ── Totals ────────────────────────────────────────────
  const [discType, setDiscType] = useState('flat')
  const [discValue, setDiscValue] = useState('0')
  const [shipping, setShipping] = useState('0')
  const [shippingGst, setShippingGst] = useState('0')
  const [amountReceived, setAmountReceived] = useState('0')
  const [notes, setNotes] = useState('')
  
  // ── New Meta Fields ──
  const [deliveryNote, setDeliveryNote] = useState('')
  const [paymentModeTerms, setPaymentModeTerms] = useState('')
  const [refNoDate, setRefNoDate] = useState('')
  const [otherRefs, setOtherRefs] = useState('')
  const [buyersOrderNo, setBuyersOrderNo] = useState('')
  const [orderDate, setOrderDate] = useState('')
  const [dispatchDocNo, setDispatchDocNo] = useState('')
  const [deliveryNoteDate, setDeliveryNoteDate] = useState('')
  const [dispatchedThrough, setDispatchedThrough] = useState('')
  const [destination, setDestination] = useState('')
  const [vesselFlightNo, setVesselFlightNo] = useState('')
  const [placeOfReceipt, setPlaceOfReceipt] = useState('')
  const [portLoading, setPortLoading] = useState('')
  const [portDischarge, setPortDischarge] = useState('')
  const [termsDelivery, setTermsDelivery] = useState('')

  const [totals, setTotals] = useState({
    subtotal: 0, discountAmount: 0, taxableAmount: 0,
    totalCGST: 0, totalSGST: 0, totalIGST: 0, totalTax: 0,
    shippingCharges: 0, roundOff: 0, grandTotal: 0,
  })

  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  // ── Load settings + invoice number ────────────────────
  useEffect(() => {
    loadSettings()
    window.api.products.getAll({ limit: 500 }).then(r => { 
      console.log('products loaded:', r)
      if (r.success) setProducts(r.data) 
    })
    if (!isEdit) {
      window.api.invoices.getNextNumber().then((res) => {
        if (res.success) setInvoiceNumber(res.data)
      })
    }
  }, [])

  useEffect(() => {
    if (settings?.invoice_terms && !notes) setNotes(settings.invoice_terms)
    if (!isEdit && settings?.company_state && !selectedCustomer) {
      setPlaceOfSupply(settings.company_state)
    }
  }, [settings, isEdit])

  // ── Load existing invoice for edit ───────────────────
  useEffect(() => {
    if (!isEdit) return
    setLoading(true)
    getById(id).then((res) => {
      if (!res.success) { showToast('Invoice not found', 'error'); navigate('/invoices'); return }
      const inv = res.data
      setInvoiceNumber(inv.invoice_number)
      setInvoiceDate(inv.invoice_date)
      setDueDate(inv.due_date || '')
      setInvoiceStatus(inv.status)
      setSupplyType(inv.supply_type)
      setPlaceOfSupply(inv.place_of_supply)
      setSelectedCustomer({
        id: inv.customer_id,
        name: inv.customer_name,
        phone: inv.customer_phone,
        gstin: inv.customer_gstin,
        billing_address: inv.customer_billing_address,
        shipping_name: inv.shipping_name || inv.customer_shipping_name || '',
        shipping_gstin: inv.shipping_gstin || inv.customer_shipping_gstin || '',
        shipping_address: inv.shipping_address || inv.customer_shipping_address || '',
        shipping_state: inv.shipping_state || inv.customer_shipping_state || inv.customer_state || 'Maharashtra',
        state: inv.customer_state,
      })
      setCustomerSearch(inv.customer_name)
      setDiscType(inv.discount_type)
      setDiscValue(String(inv.discount_value))
      setShipping(String(inv.shipping_charges))
      setShippingGst(String(inv.shipping_gst_percent || 0))
      setAmountReceived(String(inv.amount_received))
      setNotes(inv.notes || '')
      
      setDeliveryNote(inv.delivery_note || '')
      setPaymentModeTerms(inv.payment_mode_terms || '')
      setRefNoDate(inv.reference_no_date || '')
      setOtherRefs(inv.other_references || '')
      setBuyersOrderNo(inv.buyers_order_no || '')
      setOrderDate(inv.order_date || '')
      setDispatchDocNo(inv.dispatch_doc_no || '')
      setDeliveryNoteDate(inv.delivery_note_date || '')
      setDispatchedThrough(inv.dispatched_through || '')
      setDestination(inv.destination || '')
      setVesselFlightNo(inv.vessel_flight_no || '')
      setPlaceOfReceipt(inv.place_of_receipt_by_shipper || '')
      setPortLoading(inv.port_of_loading || '')
      setPortDischarge(inv.port_of_discharge || '')
      setTermsDelivery(inv.terms_of_delivery || '')

      const loadedItems = inv.items.map((it) => ({
        ...it, _key: Math.random(),
        quantity: String(it.quantity),
        rate: String(it.rate),
        discount_percent: String(it.discount_percent),
        gst_percent: String(it.gst_percent),
      }))
      setItems(loadedItems)
      // Initialize product searches
      const initialSearches = {}
      loadedItems.forEach(it => {
        initialSearches[it._key] = it.description
      })
      setProductSearches(initialSearches)
      setLoading(false)
    })
  }, [id])

  // ── Recalculate totals whenever inputs change ─────────
  useEffect(() => {
    const t = calcInvoiceTotals(
      items.map((i) => ({
        rate: parseFloat(i.rate || 0),
        quantity: parseFloat(i.quantity || 0),
        discount_percent: parseFloat(i.discount_percent || 0),
        gst_percent: parseFloat(i.gst_percent || 0),
      })),
      discType, parseFloat(discValue || 0),
      parseFloat(shipping || 0),
      supplyType,
      parseFloat(shippingGst || 0)
    )
    setTotals(t)
  }, [items, discType, discValue, shipping, shippingGst, supplyType])

  // ── Compute per-row calc ──────────────────────────────
  function rowCalc(item) {
    return calcLineItem(
      parseFloat(item.rate || 0),
      parseFloat(item.quantity || 0),
      parseFloat(item.discount_percent || 0),
      parseFloat(item.gst_percent || 0),
      supplyType
    )
  }

  // ── Payment status auto-set ───────────────────────────
  function paymentStatus() {
    const received = parseFloat(amountReceived || 0)
    const grand = totals.grandTotal
    if (received <= 0) return 'unpaid'
    if (received >= grand) return 'paid'
    return 'partial'
  }

  // ── Customer search ───────────────────────────────────
  async function searchCustomers(q) {
    setCustomerSearch(q)
    setCustomerDropOpen(true)
    if (q.length < 1) { setCustomers([]); return }
    const res = await window.api.customers.getAll({ search: q, limit: 8 })
    if (res.success) setCustomers(res.data)
  }

  function selectCustomer(c) {
    setSelectedCustomer({
      ...c,
      shipping_state: c.shipping_state || (c.shipping_gstin && c.shipping_gstin.length >= 2 ? getStateByCode(c.shipping_gstin.substring(0, 2)) : '') || c.state || 'Maharashtra'
    })
    setCustomerSearch(c.name)
    setCustomerDropOpen(false)
    if (c.state) {
      setPlaceOfSupply(c.state)
      const compCode = (settings?.company_state_code || getStateCode(settings?.company_state || 'Maharashtra') || '27').toString().padStart(2, '0')
      const custGstinCode = c.gstin && c.gstin.length >= 2 ? c.gstin.substring(0, 2) : null
      const custStateCode = (custGstinCode || getStateCode(c.state) || '').toString().padStart(2, '0')
      if (compCode && custStateCode) {
        setSupplyType(compCode === custStateCode ? 'intra' : 'inter')
      }
    }
  }

  // ── Add new customer inline ───────────────────────────
  async function handleAddCustomer() {
    const e = {}
    if (!newCust.name || newCust.name.trim().length < 2) e.name = 'Min 2 chars'
    if (!newCust.phone || !/^\d{10}$/.test(newCust.phone.trim())) e.phone = 'Must be 10 digits'
    if (newCust.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(newCust.gstin.toUpperCase())) e.gstin = 'Invalid GSTIN'
    setCustErrors(e)
    if (Object.keys(e).length > 0) return
    setSavingCust(true)
    const res = await window.api.customers.create({
      ...newCust,
      gstin: newCust.gstin?.toUpperCase() || '',
      shipping_gstin: newCust.shipping_gstin?.toUpperCase() || '',
    })
    setSavingCust(false)
    if (res.success) {
      const cRes = await window.api.customers.getById(res.data.id)
      if (cRes.success) selectCustomer(cRes.data)
      setAddCustModal(false)
      setNewCust(EMPTY_CUSTOMER)
      showToast('Customer created', 'success')
    } else {
      setCustErrors({ _: res.error })
    }
  }

  // ── Product search per row ────────────────────────────
  // Tracks whether user is clicking inside the dropdown (prevents onBlur race condition)
  const productDropMouseDown = useRef(false)

  async function searchProducts(key, q, idx) {
    setProductSearches((p) => ({ ...p, [key]: q }))
    setProductDropOpen((p) => ({ ...p, [key]: true }))
    // Sync description field so it gets saved even if no product selected from dropdown
    if (idx !== undefined) {
      setItems((prev) => prev.map((it, i) => i === idx ? { ...it, description: q, product_id: null } : it))
    }
    // First, filter local products as fallback
    let filtered = q.trim()
      ? products.filter(p => 
          p.name.toLowerCase().includes(q.toLowerCase()) || 
          (p.hsn_code && p.hsn_code.toLowerCase().includes(q.toLowerCase()))
        ).slice(0, 10)
      : [...products].slice(0, 10)
    // Try API call as backup for more accurate results
    try {
      if (q.trim()) {
        const res = await window.api.products.getAll({ search: q, limit: 10 })
        if (res.success && res.data.length > 0) {
          filtered = res.data
        }
      }
    } catch (e) {
      console.error("Product search API error:", e)
    }
    setProductResults((p) => ({ ...p, [key]: filtered }))
  }

  function selectProduct(key, product, idx) {
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? {
              ...it,
              product_id: product.id,
              description: product.name,
              item_notes: product.description || it.item_notes || '',
              hsn_code: product.hsn_code || it.hsn_code,
              unit: product.unit || it.unit,
              rate: String(product.selling_price || it.rate),
              gst_percent: String(product.gst_percent || it.gst_percent),
            }
          : it
      )
    )
    setProductSearches((p) => ({ ...p, [key]: product.name }))
    setProductDropOpen((p) => ({ ...p, [key]: false }))
    productDropMouseDown.current = false
  }

  // On blur: just close the dropdown.
  // If an exact product name was typed, automatically select it to fill details.
  async function handleProductBlur(key, idx) {
    await new Promise((r) => setTimeout(r, 180))
    if (productDropMouseDown.current) return
    setProductDropOpen((p) => ({ ...p, [key]: false }))

    const q = (productSearches[key] ?? '').trim()
    if (!q) return

    const rowItem = items[idx]
    if (rowItem && rowItem.product_id) return // Already linked

    // Find exact match (case insensitive) in local products
    const exact = products.find((p) => p.name.toLowerCase() === q.toLowerCase())
    if (exact) {
      selectProduct(key, exact, idx)
    }
  }

  function updateItem(idx, field, value) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  function addRow() { setItems((p) => [...p, newItem()]) }

  function removeRow(idx) {
    if (items.length === 1) return
    setItems((p) => p.filter((_, i) => i !== idx))
  }

  // ── Validate ──────────────────────────────────────────
  function validate() {
    const e = {}
    if (!selectedCustomer) e.customer = 'Customer is required'
    if (!invoiceNumber || invoiceNumber.trim() === '') e.invoiceNumber = 'Invoice number is required'
    if (!invoiceDate) e.invoiceDate = 'Invoice date is required'
    const validItems = items.filter((it) => it.description && parseFloat(it.rate || 0) > 0 && parseFloat(it.quantity || 0) > 0)
    if (validItems.length === 0) e.items = 'At least one valid line item is required'
    items.forEach((it, i) => {
      if (parseFloat(it.quantity || 0) <= 0) e[`qty_${i}`] = 'Required'
      if (parseFloat(it.rate || 0) <= 0) e[`rate_${i}`] = 'Required'
    })
    const received = parseFloat(amountReceived || 0)
    if (received > totals.grandTotal) e.amountReceived = 'Cannot exceed grand total'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Save ─────────────────────────────────────────────
  async function handleSave(status) {
    if (!validate()) return
    setSaving(true)
    const received = parseFloat(amountReceived || 0)
    const payload = {
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      due_date: dueDate || null,
      customer_id: selectedCustomer.id,
      customer_billing_address: selectedCustomer.billing_address || '',
      customer_shipping_address: selectedCustomer.shipping_address || '',
      shipping_name: selectedCustomer.shipping_name || '',
      shipping_gstin: selectedCustomer.shipping_gstin || '',
      shipping_address: selectedCustomer.shipping_address || '',
      shipping_state: selectedCustomer.shipping_state || (selectedCustomer.shipping_gstin && selectedCustomer.shipping_gstin.length >= 2 ? getStateByCode(selectedCustomer.shipping_gstin.substring(0, 2)) : '') || selectedCustomer.state || 'Maharashtra',
      supply_type: supplyType,
      place_of_supply: placeOfSupply,
      discount_type: discType,
      discount_value: parseFloat(discValue || 0),
      shipping_charges: parseFloat(shipping || 0),
      shipping_gst_percent: parseFloat(shippingGst || 0),
      notes,
      delivery_note: deliveryNote,
      payment_mode_terms: paymentModeTerms,
      reference_no_date: refNoDate,
      other_references: otherRefs,
      buyers_order_no: buyersOrderNo,
      order_date: orderDate,
      dispatch_doc_no: dispatchDocNo,
      delivery_note_date: deliveryNoteDate,
      dispatched_through: dispatchedThrough,
      destination: destination,
      vessel_flight_no: vesselFlightNo,
      place_of_receipt_by_shipper: placeOfReceipt,
      port_of_loading: portLoading,
      port_of_discharge: portDischarge,
      terms_of_delivery: termsDelivery,
      status,
      amount_received: received,
      balance_due: Math.max(0, totals.grandTotal - received),
      payment_status: paymentStatus(),
      subtotal: totals.subtotal,
      discount_amount: totals.discountAmount,
      taxable_amount: totals.taxableAmount,
      total_cgst: totals.totalCGST,
      total_sgst: totals.totalSGST,
      total_igst: totals.totalIGST,
      total_tax: totals.totalTax,
      round_off: totals.roundOff,
      grand_total: totals.grandTotal,
      items: items.map((it) => ({
        product_id: it.product_id || null,
        description: it.description,
        item_notes: it.item_notes || '',
        hsn_code: it.hsn_code,
        quantity: parseFloat(it.quantity || 0),
        unit: it.unit,
        rate: parseFloat(it.rate || 0),
        discount_percent: parseFloat(it.discount_percent || 0),
        gst_percent: parseFloat(it.gst_percent || 0),
      })),
    }

    let res
    if (isEdit) {
      res = await updateInvoice({ ...payload, id: parseInt(id) })
    } else {
      res = await createInvoice(payload)
    }
    setSaving(false)
    if (res.success) {
      navigate(isEdit ? `/invoices/${id}` : `/invoices/${res.id || ''}`)
    }
  }

  const balanceDue = Math.max(0, totals.grandTotal - parseFloat(amountReceived || 0))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* ── HEADER SECTION ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Invoice Details</h2>
        <div className="grid grid-cols-4 gap-4">
          <Input label="Invoice Number" required value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value.toUpperCase())} error={errors.invoiceNumber} className="font-mono" placeholder="e.g. INV-2026-0001" />
          <Input label="Invoice Date" required type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} error={errors.invoiceDate} />
          <Input label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
            <div className="flex gap-2">
              {['draft', 'final'].map((s) => (
                <button
                  key={s}
                  onClick={() => setInvoiceStatus(s)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${
                    invoiceStatus === s
                      ? s === 'final' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-gray-600 border-gray-600 text-white'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── CUSTOMER SECTION ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Customer</h2>
        {errors.customer && <p className="text-xs text-red-500 mb-2">{errors.customer}</p>}
        <div className="grid grid-cols-3 gap-4">
          {/* Customer search */}
          <div className="relative col-span-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
              Customer <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  value={customerSearch}
                  onChange={(e) => searchCustomers(e.target.value)}
                  onFocus={() => setCustomerDropOpen(true)}
                  placeholder="Search customer..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {customerDropOpen && customers.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {customers.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => selectCustomer(c)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      >
                        <div className="font-medium text-gray-900 dark:text-gray-100">{c.name}</div>
                        <div className="text-xs text-gray-500">{c.phone} {c.gstin ? `• ${c.gstin}` : ''}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => { setAddCustModal(true); setCustomerDropOpen(false) }}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                title="Add new customer"
              >
                <UserPlus size={16} />
              </button>
            </div>
          </div>

          {/* Supply type */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Supply Type</label>
            <div className="flex gap-2 mt-1">
              {[['intra', 'Intra-State (CGST+SGST)'], ['inter', 'Inter-State (IGST)']].map(([val, lbl]) => (
                <label key={val} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" value={val} checked={supplyType === val} onChange={() => setSupplyType(val)} className="accent-blue-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{lbl}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Place of supply */}
          <Select label="Place of Supply" value={placeOfSupply} onChange={(e) => {
            const pos = e.target.value
            setPlaceOfSupply(pos)
            const compCode = (settings?.company_state_code || getStateCode(settings?.company_state || 'Maharashtra') || '27').toString().padStart(2, '0')
            const posCode = (getStateCode(pos) || '').toString().padStart(2, '0')
            if (compCode && posCode) {
              setSupplyType(compCode === posCode ? 'intra' : 'inter')
            }
          }}>
            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>

        {/* Selected customer details */}
        {selectedCustomer && (
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
            <div className="flex items-center gap-4">
              <span className="font-semibold text-blue-700 dark:text-blue-300">{selectedCustomer.name}</span>
              {selectedCustomer.gstin && <span className="text-gray-600 dark:text-gray-400">GSTIN: {selectedCustomer.gstin}</span>}
              {selectedCustomer.phone && <span className="text-gray-600 dark:text-gray-400">Ph: {selectedCustomer.phone}</span>}
              {selectedCustomer.state && <span className="text-gray-600 dark:text-gray-400">{selectedCustomer.state}</span>}
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1 block">Bill To Details</label>
                <div className="text-xs font-medium text-gray-800 dark:text-gray-200 mb-1">
                  {selectedCustomer.name} {selectedCustomer.gstin ? `(${selectedCustomer.gstin})` : ''}
                </div>
                <textarea
                  rows={2}
                  value={selectedCustomer.billing_address || ''}
                  onChange={(e) => setSelectedCustomer((p) => ({ ...p, billing_address: e.target.value }))}
                  placeholder="Billing address..."
                  className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1 block">Ship To Details</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={selectedCustomer.shipping_name || ''}
                    onChange={(e) => setSelectedCustomer((p) => ({ ...p, shipping_name: e.target.value }))}
                    placeholder="Shipping Customer Name"
                    className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    value={selectedCustomer.shipping_gstin || ''}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase()
                      setSelectedCustomer((p) => {
                        const next = { ...p, shipping_gstin: val }
                        if (val.length >= 2) {
                          const derivedState = getStateByCode(val.substring(0, 2))
                          if (derivedState) next.shipping_state = derivedState
                        }
                        return next
                      })
                    }}
                    placeholder="Shipping GSTIN"
                    maxLength={15}
                    className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={selectedCustomer.shipping_state || selectedCustomer.state || 'Maharashtra'}
                    onChange={(e) => setSelectedCustomer((p) => ({ ...p, shipping_state: e.target.value }))}
                    className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    title="Shipping State"
                  >
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s} ({getStateCode(s)})</option>
                    ))}
                  </select>
                  <div className="text-[11px] flex items-center px-1 text-gray-500 dark:text-gray-400">
                    State Code: <span className="font-semibold text-gray-800 dark:text-gray-200 ml-1">{getStateCode(selectedCustomer.shipping_state || selectedCustomer.state || 'Maharashtra')}</span>
                  </div>
                </div>
                <textarea
                  rows={2}
                  value={selectedCustomer.shipping_address || ''}
                  onChange={(e) => setSelectedCustomer((p) => ({ ...p, shipping_address: e.target.value }))}
                  placeholder="Shipping address (leave blank to use billing address)..."
                  className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── SHIPPING & DELIVERY SECTION ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Shipping & Delivery Details</h2>
        <div className="grid grid-cols-4 gap-4">
          <Input label="DISPATCH DELIVERY FROM" value={deliveryNote} onChange={e => setDeliveryNote(e.target.value)} />
          <Input label="Mode/Terms of Payment" value={paymentModeTerms} onChange={e => setPaymentModeTerms(e.target.value)} />
          <Input label="Ref No. & Date" value={refNoDate} onChange={e => setRefNoDate(e.target.value)} />
          <Input label="Other References" value={otherRefs} onChange={e => setOtherRefs(e.target.value)} />
          
          <Input label="Buyer's Order No." value={buyersOrderNo} onChange={e => setBuyersOrderNo(e.target.value)} />
          <Input label="Order Date" type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
          <Input label="Dispatch Doc No." value={dispatchDocNo} onChange={e => setDispatchDocNo(e.target.value)} />
          <Input label="Delivery Note Date" type="date" value={deliveryNoteDate} onChange={e => setDeliveryNoteDate(e.target.value)} />
          
          <Input label="Dispatched through" value={dispatchedThrough} onChange={e => setDispatchedThrough(e.target.value)} />
          <Input label="Destination" value={destination} onChange={e => setDestination(e.target.value)} />
          <Input label="Vessel/Flight No." value={vesselFlightNo} onChange={e => setVesselFlightNo(e.target.value)} />
          <Input label="Place of Receipt" value={placeOfReceipt} onChange={e => setPlaceOfReceipt(e.target.value)} />
          
          <Input label="Port of Loading" value={portLoading} onChange={e => setPortLoading(e.target.value)} />
          <Input label="Port of Discharge" value={portDischarge} onChange={e => setPortDischarge(e.target.value)} />
          <div className="col-span-2">
            <Input label="Terms of Delivery" value={termsDelivery} onChange={e => setTermsDelivery(e.target.value)} placeholder="e.g. FOB, CIF, EXW..." />
          </div>
        </div>
      </div>

      {/* ── LINE ITEMS ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Line Items</h2>
          {errors.items && <p className="text-xs text-red-500">{errors.items}</p>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
                {['Product', 'Description', 'HSN', 'Qty', 'Unit', 'Rate', 'Disc%', 'Taxable', 'GST%',
                  supplyType === 'intra' ? 'CGST' : 'IGST',
                  supplyType === 'intra' ? 'SGST' : '',
                  'Total', ''].map((h, i) =>
                  h ? (
                    <th key={i} className="px-2 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
                  ) : <th key={i} className="w-8" />
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const calc = rowCalc(item)
                const key = item._key
                return (
                  <tr key={key} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-750/50">
                    {/* Product search */}
                    <td className="px-2 py-1.5 min-w-[160px]">
                      <div className="relative">
                        <input
                          value={productSearches[key] ?? item.description}
                          onChange={(e) => searchProducts(key, e.target.value, idx)}
                          onFocus={() => setProductDropOpen((p) => ({ ...p, [key]: true }))}
                          onBlur={() => handleProductBlur(key, idx)}
                          placeholder="Search product..."
                          className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {productDropOpen[key] && (
                          <div className="absolute z-20 left-0 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-44 overflow-y-auto">
                            {(productResults[key] || []).map((p) => (
                              <button
                                key={p.id}
                                onMouseDown={() => { productDropMouseDown.current = true }}
                                onClick={() => selectProduct(key, p, idx)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              >
                                <div className="font-medium text-gray-900 dark:text-gray-100">{p.name}</div>
                                <div className="text-gray-500">₹{p.selling_price} • GST {p.gst_percent}% • Stock: {p.stock_qty}</div>
                              </button>
                            ))}
                            {(productSearches[key] || '').trim() && (productResults[key] || []).length === 0 && (
                              <div className="px-3 py-2 text-xs text-gray-400 italic">
                                No matching product — type freely to add a custom description
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Item Description / Notes */}
                    <td className="px-2 py-1.5 min-w-[140px]">
                      <input
                        value={item.item_notes || ''}
                        onChange={(e) => updateItem(idx, 'item_notes', e.target.value)}
                        className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Description / notes (optional)"
                      />
                    </td>

                    {/* HSN */}
                    <td className="px-2 py-1.5 w-20">
                      <input
                        value={item.hsn_code}
                        onChange={(e) => updateItem(idx, 'hsn_code', e.target.value)}
                        className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="HSN"
                      />
                    </td>

                    {/* Qty */}
                    <td className="px-2 py-1.5 w-16">
                      <input
                        type="number" min="0.01" step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                        className={`w-full px-2 py-1.5 text-xs rounded border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 ${errors[`qty_${idx}`] ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                      />
                    </td>

                    {/* Unit */}
                    <td className="px-2 py-1.5 w-20">
                      <select
                        value={item.unit}
                        onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                        className="w-full px-1 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>

                    {/* Rate */}
                    <td className="px-2 py-1.5 w-24">
                      <input
                        type="number" min="0" step="0.01"
                        value={item.rate}
                        onChange={(e) => updateItem(idx, 'rate', e.target.value)}
                        className={`w-full px-2 py-1.5 text-xs rounded border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 ${errors[`rate_${idx}`] ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                        placeholder="0.00"
                      />
                    </td>

                    {/* Disc% */}
                    <td className="px-2 py-1.5 w-16">
                      <input
                        type="number" min="0" max="100" step="0.01"
                        value={item.discount_percent}
                        onChange={(e) => updateItem(idx, 'discount_percent', e.target.value)}
                        className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>

                    {/* Taxable */}
                    <td className="px-2 py-1.5 w-24 text-right text-xs text-gray-600 dark:text-gray-400 font-medium">
                      {calc.taxable.toFixed(2)}
                    </td>

                    {/* GST% */}
                    <td className="px-2 py-1.5 w-20">
                      <select
                        value={item.gst_percent}
                        onChange={(e) => updateItem(idx, 'gst_percent', e.target.value)}
                        className="w-full px-1 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </td>

                    {/* CGST or IGST */}
                    <td className="px-2 py-1.5 w-20 text-right text-xs text-gray-600 dark:text-gray-400">
                      {supplyType === 'intra' ? calc.cgst.toFixed(2) : calc.igst.toFixed(2)}
                    </td>

                    {/* SGST (intra only) */}
                    {supplyType === 'intra' && (
                      <td className="px-2 py-1.5 w-20 text-right text-xs text-gray-600 dark:text-gray-400">
                        {calc.sgst.toFixed(2)}
                      </td>
                    )}

                    {/* Total */}
                    <td className="px-2 py-1.5 w-24 text-right text-xs font-semibold text-gray-900 dark:text-gray-100">
                      {calc.lineTotal.toFixed(2)}
                    </td>

                    {/* Remove */}
                    <td className="px-2 py-1.5 w-8">
                      <button
                        onClick={() => removeRow(idx)}
                        disabled={items.length === 1}
                        className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={addRow}
            className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-indigo-200 font-medium transition-colors"
          >
            <Plus size={16} /> Add Row
          </button>
        </div>
      </div>

      {/* ── TOTALS + NOTES SECTION ── */}
      <div className="grid grid-cols-2 gap-5">
        {/* Notes */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Notes & Terms</h2>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={6}
            placeholder="Notes, terms and conditions..."
          />
        </div>

        {/* Totals summary */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Totals</h2>

          <div className="space-y-2">
            {/* Invoice discount */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Discount</span>
                <div className="flex rounded overflow-hidden border border-gray-300 dark:border-gray-600 text-xs">
                  {['flat', 'percent'].map((t) => (
                    <button key={t} onClick={() => setDiscType(t)}
                      className={`px-2 py-0.5 transition-colors ${discType === t ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
                      {t === 'flat' ? '₹' : '%'}
                    </button>
                  ))}
                </div>
                <input
                  type="number" min="0" step="0.01" value={discValue}
                  onChange={(e) => setDiscValue(e.target.value)}
                  className="w-24 px-2 py-0.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <span className="text-sm font-medium text-red-600">- {formatCurrency(totals.discountAmount)}</span>
            </div>

            {/* Subtotal */}
            <TotalRow label="Subtotal" value={formatCurrency(totals.subtotal)} />
            <TotalRow label="Taxable Amount" value={formatCurrency(totals.taxableAmount)} />

            {supplyType === 'intra' ? (
              <>
                <TotalRow label="CGST" value={formatCurrency(totals.totalCGST)} />
                <TotalRow label="SGST" value={formatCurrency(totals.totalSGST)} />
              </>
            ) : (
              <TotalRow label="IGST" value={formatCurrency(totals.totalIGST)} />
            )}

            {/* Shipping + GST */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Shipping / Forwarding / Packaging</span>
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-500">Rs. </span>
                <input
                  type="number" min="0" step="0.01" value={shipping}
                  onChange={(e) => setShipping(e.target.value)}
                  className="w-20 px-2 py-0.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                />
                <select value={shippingGst} onChange={e => setShippingGst(e.target.value)}
                  className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 bg-white dark:bg-gray-700 dark:text-gray-100 ml-1">
                  <option value="0">No GST</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>
            </div>

            <TotalRow label="Round Off" value={totals.roundOff > 0 ? `+ ${formatCurrency(totals.roundOff)}` : (totals.roundOff < 0 ? `- ${formatCurrency(Math.abs(totals.roundOff))}` : formatCurrency(0))} />

            {/* Grand total */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-gray-900 dark:text-gray-100">Grand Total</span>
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totals.grandTotal)}</span>
              </div>
            </div>

            {/* Amount received */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Amount Received</span>
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-500">Rs. </span>
                <input
                  type="number" min="0" step="0.01" value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  className={`w-28 px-2 py-0.5 text-sm rounded border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 text-right ${errors.amountReceived ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                />
              </div>
            </div>
            {errors.amountReceived && <p className="text-xs text-red-500 text-right">{errors.amountReceived}</p>}

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Balance Due</span>
              <span className={`text-sm font-bold ${balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(balanceDue)}
              </span>
            </div>

            {/* Payment status indicator */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Payment Status</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                paymentStatus() === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                paymentStatus() === 'partial' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {paymentStatus().charAt(0).toUpperCase() + paymentStatus().slice(1)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── ACTION BUTTONS ── */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-6 py-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
        <div className="flex gap-3">
          <Button variant="secondary" loading={saving} onClick={() => handleSave('draft')}>
            Save as Draft
          </Button>
          <Button loading={saving} onClick={() => handleSave('final')}>
            {isEdit ? 'Save Changes' : 'Finalize Invoice'}
          </Button>
        </div>
      </div>

      {/* ── ADD CUSTOMER MODAL ── */}
      <Modal
        open={addCustModal}
        onClose={() => setAddCustModal(false)}
        title="Add New Customer"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddCustModal(false)}>Cancel</Button>
            <Button onClick={handleAddCustomer} loading={savingCust}>Create Customer</Button>
          </>
        }
      >
        {custErrors._ && (
          <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 text-sm rounded-lg">{custErrors._}</div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Customer Name" required value={newCust.name} onChange={(e) => setNewCust((p) => ({ ...p, name: e.target.value }))} error={custErrors.name} placeholder="Enter customer / company name" />
          <Input label="Phone" required value={newCust.phone} onChange={(e) => setNewCust((p) => ({ ...p, phone: e.target.value }))} error={custErrors.phone} maxLength={10} />
          <Input label="Email" value={newCust.email} onChange={(e) => setNewCust((p) => ({ ...p, email: e.target.value }))} type="email" />
          <Input label="GSTIN" value={newCust.gstin} onChange={(e) => setNewCust((p) => ({ ...p, gstin: e.target.value.toUpperCase() }))} error={custErrors.gstin} maxLength={15} />
          <Select label="State" value={newCust.state} onChange={(e) => setNewCust((p) => ({ ...p, state: e.target.value }))}>
            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Select label="Customer Type" value={newCust.customer_type} onChange={(e) => setNewCust((p) => ({ ...p, customer_type: e.target.value }))}>
            <option value="SUNDRY_DEBTOR">Sundry Debtor (Sales Party)</option>
            <option value="SUNDRY_CREDITOR">Sundry Creditor (Purchase Party)</option>
          </Select>
          <Input label="Billing Address" value={newCust.billing_address} onChange={(e) => setNewCust((p) => ({ ...p, billing_address: e.target.value }))} containerClassName="col-span-2" />
          <Input label="Shipping Customer Name" value={newCust.shipping_name || ''} onChange={(e) => setNewCust((p) => ({ ...p, shipping_name: e.target.value }))} placeholder="Enter shipping customer / company name" containerClassName="col-span-2" />
          <Input label="Shipping GSTIN" value={newCust.shipping_gstin || ''} onChange={(e) => setNewCust((p) => ({ ...p, shipping_gstin: e.target.value.toUpperCase() }))} placeholder="Enter shipping GSTIN" maxLength={15} containerClassName="col-span-2" />
          <Input label="Shipping Address" value={newCust.shipping_address} onChange={(e) => setNewCust((p) => ({ ...p, shipping_address: e.target.value }))} containerClassName="col-span-2" placeholder="Enter shipping address" />
        </div>
      </Modal>
    </div>
  )
}

function TotalRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  )
}
