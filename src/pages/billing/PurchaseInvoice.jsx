import { useEffect, useState, useRef } from 'react'
import { Plus, Trash2, Save, ArrowLeft, MessageCircle, Search, UserPlus, X } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import Button from '../../components/ui/Button.jsx'
import Input, { Select, Textarea } from '../../components/ui/Input.jsx'
import Modal from '../../components/ui/Modal.jsx'
import { INDIAN_STATES, UNITS, GST_RATES, getStateCode } from '../../utils/gstHelpers.js'
import { formatCurrency, todayISO } from '../../utils/formatters.js'
import { useSettingsStore } from '../../store/useSettingsStore.js'

const EMPTY_SUPPLIER = {
  name: '', phone: '', email: '', gstin: '',
  billing_address: '', shipping_address: '',
  shipping_name: '', shipping_gstin: '',
  state: 'Maharashtra', customer_type: 'SUNDRY_CREDITOR',
}

function newItem() {
  return { _key: Math.random(), product_id: null, description: '', hsn_code: '', quantity: '1', unit: 'pcs', rate: '', gst_percent: '18' }
}

export default function PurchaseInvoice() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id
  const { showToast, settings } = useSettingsStore()

  const [billNumber, setBillNumber]           = useState('')
  const [billDate, setBillDate]               = useState(todayISO())
  const [dueDate, setDueDate]                 = useState('')
  const [supplierName, setSupplierName]       = useState('')
  const [supplierPhone, setSupplierPhone]     = useState('')
  const [supplierEmail, setSupplierEmail]     = useState('')
  const [supplierGstin, setSupplierGstin]     = useState('')
  const [supplierAddress, setSupplierAddress] = useState('')
  const [supplierState, setSupplierState]     = useState('Maharashtra')
  const [supplyType, setSupplyType]           = useState('intra')
  const [items, setItems]                     = useState([newItem()])
  const [amountPaid, setAmountPaid]           = useState('0')
  const [notes, setNotes]                     = useState('')
  const [saving, setSaving]                   = useState(false)
  const [loading, setLoading]                 = useState(false)
  const [products, setProducts]               = useState([])
  const [productSearches, setProductSearches] = useState({})
  const [productDropOpen, setProductDropOpen] = useState({})
  const [productResults, setProductResults]   = useState({})
  const productDropMouseDown = useRef(false)

  // Customer / Supplier Search State
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerSearch, setCustomerSearch]     = useState('')
  const [customerDropOpen, setCustomerDropOpen] = useState(false)
  const [customerResults, setCustomerResults]   = useState([])
  const [searchingCustomers, setSearchingCustomers] = useState(false)
  const [showSearch, setShowSearch]             = useState(false)
  const searchBoxRef                            = useRef(null)

  // New Customer / Supplier Modal State
  const [addCustModal, setAddCustModal]         = useState(false)
  const [newCust, setNewCust]                   = useState(EMPTY_SUPPLIER)
  const [custErrors, setCustErrors]             = useState({})
  const [savingCust, setSavingCust]             = useState(false)

  // Forwarding / Packaging / Extra charges
  const [forwarding, setForwarding]           = useState('0')
  const [forwardingGst, setForwardingGst]     = useState('0')
  const [packaging, setPackaging]             = useState('0')
  const [packagingGst, setPackagingGst]       = useState('0')
  const [otherCharges, setOtherCharges]       = useState('0')
  const [roundOff, setRoundOff]               = useState('0')

  const [whatsappLoading, setWhatsappLoading] = useState(false)

  function autoDetectSupplyType(supState, supGstin) {
    const compCode = (settings?.company_state_code || getStateCode(settings?.company_state || 'Maharashtra') || '27').toString().padStart(2, '0')
    const gstinPrefix = supGstin && supGstin.length >= 2 ? supGstin.substring(0, 2) : null
    const supCode = (gstinPrefix || getStateCode(supState || 'Maharashtra') || '27').toString().padStart(2, '0')
    return compCode === supCode ? 'intra' : 'inter'
  }

  useEffect(() => {
    window.api.products.getAll({ limit: 500 }).then(r => { if (r.success) setProducts(r.data) })
  }, [])

  useEffect(() => {
    function handleClickOutside(e) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setCustomerDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!isEdit) return
    setLoading(true)
    window.api.purchases.getById(parseInt(id)).then(res => {
      if (!res.success) { showToast('Purchase not found', 'error'); navigate('/purchases'); return }
      const p = res.data
      setBillNumber(p.bill_number || '')
      setBillDate(p.bill_date || todayISO())
      setDueDate(p.due_date || '')
      setSupplierName(p.supplier_name || '')
      setSupplierPhone(p.supplier_phone || '')
      setSupplierGstin(p.supplier_gstin || '')
      setSupplierAddress(p.supplier_address || '')
      setSupplierState(p.supplier_state || 'Maharashtra')
      setSupplyType(p.supply_type || 'intra')
      setAmountPaid(String(p.amount_paid || 0))
      setNotes(p.notes || '')
      setForwarding(String(p.forwarding_charges || 0))
      setForwardingGst(String(p.forwarding_gst || 0))
      setPackaging(String(p.packaging_charges || 0))
      setPackagingGst(String(p.packaging_gst || 0))
      setOtherCharges(String(p.other_charges || 0))
      setRoundOff(String(p.round_off || 0))

      if (p.supplier_name) {
        window.api.customers.getAll({ search: p.supplier_name, limit: 5 }).then(cRes => {
          if (cRes.success && cRes.data?.length > 0) {
            const match = cRes.data.find(c =>
              c.name.toLowerCase() === p.supplier_name.toLowerCase() ||
              (p.supplier_gstin && c.gstin && c.gstin.toLowerCase() === p.supplier_gstin.toLowerCase())
            )
            if (match) {
              setSelectedCustomer(match)
              if (match.email) setSupplierEmail(match.email)
            }
          }
        }).catch(() => {})
      }

      const loadedItems = (p.items || []).map(it => ({
        _key: Math.random(), product_id: it.product_id || null,
        description: it.description || '', hsn_code: it.hsn_code || '',
        quantity: String(it.quantity || 1), unit: it.unit || 'pcs',
        rate: String(it.rate || ''), gst_percent: String(it.gst_percent || 18),
      }))
      setItems(loadedItems)
      const initialSearches = {}
      loadedItems.forEach(it => {
        initialSearches[it._key] = it.description
      })
      setProductSearches(initialSearches)
      setLoading(false)
    })
  }, [id])

  async function handleSearchCustomers(q) {
    setCustomerSearch(q)
    setCustomerDropOpen(true)
    setSearchingCustomers(true)
    try {
      const res = await window.api.customers.getAll({ search: (q || '').trim(), limit: 12 })
      let results = res.success ? (res.data || []) : []

      // Also search past suppliers from purchase invoices
      try {
        const supRes = await window.api.purchases.getAllSuppliersForLedger()
        if (supRes.success && Array.isArray(supRes.data)) {
          const lowerQ = (q || '').trim().toLowerCase()
          const matchedSups = supRes.data.filter(s => {
            if (!s.name) return false
            if (lowerQ && !s.name.toLowerCase().includes(lowerQ) && !(s.gstin && s.gstin.toLowerCase().includes(lowerQ))) {
              return false
            }
            return !results.some(r => r.name.toLowerCase() === s.name.toLowerCase())
          })
          matchedSups.forEach(s => {
            results.push({
              id: null,
              name: s.name,
              gstin: s.gstin || '',
              customer_type: 'SUNDRY_CREDITOR',
              _fromPurchases: true,
            })
          })
        }
      } catch (_) {}

      setCustomerResults(results)
    } catch (e) {
      console.error('Customer search error:', e)
    } finally {
      setSearchingCustomers(false)
    }
  }

  function handleSelectCustomer(c) {
    setSelectedCustomer(c)
    setSupplierName(c.name || '')
    setSupplierPhone(c.phone || '')
    setSupplierEmail(c.email || '')
    setSupplierGstin(c.gstin || '')
    setSupplierAddress(c.billing_address || c.shipping_address || '')
    const targetState = c.state || 'Maharashtra'
    setSupplierState(targetState)
    setSupplyType(autoDetectSupplyType(targetState, c.gstin))
    setCustomerDropOpen(false)
    setShowSearch(false)
    setCustomerSearch(c.name || '')
    showToast(`Loaded details for ${c.name}`, 'success')
  }

  function handleClearCustomer() {
    setSelectedCustomer(null)
    setCustomerSearch('')
    showToast('Customer / supplier unlinked (fields kept for editing)', 'info')
  }

  function handleStateChange(newState) {
    setSupplierState(newState)
    setSupplyType(autoDetectSupplyType(newState, supplierGstin))
  }

  function handleGstinChange(newGstin) {
    const upper = newGstin.toUpperCase()
    setSupplierGstin(upper)
    if (upper.length >= 2) {
      setSupplyType(autoDetectSupplyType(supplierState, upper))
    }
  }

  async function handleAddCustomer() {
    const e = {}
    if (!newCust.name || newCust.name.trim().length < 2) e.name = 'Min 2 characters'
    if (newCust.phone && !/^\d{10}$/.test(newCust.phone.trim())) e.phone = 'Must be 10 digits'
    if (newCust.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(newCust.gstin.toUpperCase())) {
      e.gstin = 'Invalid GSTIN format'
    }
    setCustErrors(e)
    if (Object.keys(e).length > 0) return

    setSavingCust(true)
    const payload = {
      ...newCust,
      name: newCust.name.trim(),
      phone: (newCust.phone || '').trim(),
      email: (newCust.email || '').trim(),
      gstin: newCust.gstin ? newCust.gstin.trim().toUpperCase() : '',
      billing_address: newCust.billing_address || '',
      shipping_address: newCust.shipping_address || newCust.billing_address || '',
      shipping_name: newCust.shipping_name || '',
      shipping_gstin: newCust.shipping_gstin ? newCust.shipping_gstin.trim().toUpperCase() : '',
      state: newCust.state || 'Maharashtra',
      customer_type: newCust.customer_type || 'SUNDRY_CREDITOR',
    }
    const res = await window.api.customers.create(payload)
    setSavingCust(false)
    if (res.success) {
      const cRes = await window.api.customers.getById(res.data.id)
      const created = cRes.success ? cRes.data : { ...payload, id: res.data.id }
      handleSelectCustomer(created)
      setAddCustModal(false)
      setNewCust(EMPTY_SUPPLIER)
      showToast('New supplier / customer created and selected', 'success')
    } else {
      setCustErrors({ _: res.error })
    }
  }

  function updateItem(idx, field, value) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  function selectProduct(idx, p, key) {
    setItems(prev => prev.map((it, i) => i === idx ? {
      ...it, product_id: p.id, description: p.name, hsn_code: p.hsn_code,
      unit: p.unit, rate: String(p.purchase_price || p.selling_price || ''), gst_percent: String(p.gst_percent),
    } : it))
    setProductSearches(prev => ({ ...prev, [key]: p.name }))
    setProductDropOpen(prev => ({ ...prev, [key]: false }))
    productDropMouseDown.current = false
  }

  async function searchProducts(key, q, idx) {
    setProductSearches(prev => ({ ...prev, [key]: q }))
    setProductDropOpen(prev => ({ ...prev, [key]: true }))
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, description: q, product_id: null } : it))
    let filtered = q.trim()
      ? products.filter(p => 
          p.name.toLowerCase().includes(q.toLowerCase()) || 
          (p.hsn_code && p.hsn_code.toLowerCase().includes(q.toLowerCase()))
        ).slice(0, 10)
      : [...products].slice(0, 10)
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
    setProductResults(prev => ({ ...prev, [key]: filtered }))
  }

  async function handleProductBlur(key, idx) {
    await new Promise(r => setTimeout(r, 180))
    if (productDropMouseDown.current) return
    setProductDropOpen(prev => ({ ...prev, [key]: false }))

    const q = (productSearches[key] ?? '').trim()
    if (!q) return

    const rowItem = items[idx]
    if (rowItem && rowItem.product_id) return

    const exact = products.find(p => p.name.toLowerCase() === q.toLowerCase())
    if (exact) {
      selectProduct(idx, exact, key)
    }
  }

  function calcItem(item) {
    const taxable = parseFloat(item.quantity || 0) * parseFloat(item.rate || 0)
    const gst  = parseFloat(item.gst_percent || 0)
    const cgst = supplyType === 'intra' ? taxable * (gst / 2) / 100 : 0
    const sgst = supplyType === 'intra' ? taxable * (gst / 2) / 100 : 0
    const igst = supplyType === 'inter' ? taxable * gst / 100 : 0
    return { taxable, cgst, sgst, igst, total: taxable + cgst + sgst + igst }
  }

  function calcExtraWithGst(amount, gstPct) {
    const amt = parseFloat(amount || 0)
    const gst = parseFloat(gstPct || 0)
    const tax = amt * gst / 100
    return { amt, tax, total: amt + tax }
  }

  const subtotal   = items.reduce((s, it) => s + calcItem(it).taxable, 0)
  const totalCGST  = items.reduce((s, it) => s + calcItem(it).cgst, 0)
  const totalSGST  = items.reduce((s, it) => s + calcItem(it).sgst, 0)
  const totalIGST  = items.reduce((s, it) => s + calcItem(it).igst, 0)

  const fwd  = calcExtraWithGst(forwarding, forwardingGst)
  const pkg  = calcExtraWithGst(packaging, packagingGst)
  const othr = parseFloat(otherCharges || 0)

  const extraChargesTotal = fwd.total + pkg.total + othr
  const preRound = subtotal + totalCGST + totalSGST + totalIGST + extraChargesTotal
  const autoRoundOff = Math.round(preRound) - preRound
  const grandTotal = Math.round(preRound)
  const balanceDue = grandTotal - parseFloat(amountPaid || 0)

  async function handleSave() {
    if (!supplierName.trim()) { showToast('Supplier name is required', 'error'); return }
    if (!billDate) { showToast('Bill date is required', 'error'); return }
    setSaving(true)

    // If an existing customer master record was selected, update it without creating duplicates
    if (selectedCustomer && selectedCustomer.id) {
      try {
        const hasChanges = 
          supplierName.trim() !== (selectedCustomer.name || '').trim() ||
          supplierPhone.trim() !== (selectedCustomer.phone || '').trim() ||
          supplierGstin.trim() !== (selectedCustomer.gstin || '').trim() ||
          supplierAddress.trim() !== (selectedCustomer.billing_address || '').trim() ||
          supplierState !== (selectedCustomer.state || '') ||
          (supplierEmail && supplierEmail.trim() !== (selectedCustomer.email || '').trim())

        if (hasChanges) {
          await window.api.customers.update({
            id: selectedCustomer.id,
            name: supplierName.trim(),
            phone: supplierPhone.trim(),
            email: supplierEmail ? supplierEmail.trim() : (selectedCustomer.email || ''),
            contact_person: selectedCustomer.contact_person || '',
            gstin: supplierGstin.trim().toUpperCase(),
            billing_address: supplierAddress.trim(),
            shipping_address: selectedCustomer.shipping_address || supplierAddress.trim(),
            shipping_name: selectedCustomer.shipping_name || '',
            shipping_gstin: selectedCustomer.shipping_gstin || '',
            state: supplierState,
            customer_type: selectedCustomer.customer_type || 'SUNDRY_CREDITOR',
          })
        }
      } catch (err) {
        console.error('Failed to sync updated customer details:', err)
      }
    }

    const payload = {
      bill_number: billNumber, bill_date: billDate, due_date: dueDate || null,
      supplier_name: supplierName, supplier_phone: supplierPhone,
      supplier_gstin: supplierGstin, supplier_address: supplierAddress,
      supplier_state: supplierState, supply_type: supplyType,
      subtotal, taxable_amount: subtotal,
      total_cgst: totalCGST, total_sgst: totalSGST, total_igst: totalIGST,
      total_tax: totalCGST + totalSGST + totalIGST,
      forwarding_charges: fwd.amt, forwarding_gst: fwd.tax,
      packaging_charges:  pkg.amt, packaging_gst:  pkg.tax,
      other_charges: othr,
      round_off: autoRoundOff,
      grand_total: grandTotal,
      payment_status: parseFloat(amountPaid) >= grandTotal ? 'paid' : parseFloat(amountPaid) > 0 ? 'partial' : 'unpaid',
      amount_paid: parseFloat(amountPaid || 0), balance_due: balanceDue, notes,
      items: items.filter(it => it.description).map(it => {
        const c = calcItem(it)
        return {
          product_id: it.product_id || null, description: it.description, hsn_code: it.hsn_code,
          quantity: parseFloat(it.quantity), unit: it.unit, rate: parseFloat(it.rate),
          gst_percent: parseFloat(it.gst_percent), taxable_amount: c.taxable,
          cgst_amount: c.cgst, sgst_amount: c.sgst, igst_amount: c.igst, total_amount: c.total,
        }
      }),
    }
    const res = isEdit
      ? await window.api.purchases.update({ ...payload, id: parseInt(id) })
      : await window.api.purchases.create(payload)
    setSaving(false)
    if (res.success) { showToast(isEdit ? 'Purchase updated' : 'Purchase invoice saved', 'success'); navigate('/purchases') }
    else showToast(res.error, 'error')
  }

  function handleWhatsApp() {
    const phone = supplierPhone?.replace(/\D/g, '') || ''
    const companyName = settings?.company_name || 'Us'
    const balDue = balanceDue > 0
      ? `\nBalance Due: ₹${balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      : ''
    const msg = [
      `Dear ${supplierName},`,
      ``,
      `Please find purchase order details below:`,
      ``,
      `📄 Bill No: ${billNumber || 'N/A'}`,
      `📅 Date: ${billDate}`,
      `💰 Grand Total: ₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}${balDue}`,
      ``,
      `Regards,`,
      `${companyName}`,
    ].join('\n')

    const url = phone
      ? `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  const inputCls = 'w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-gray-100'
  const selCls   = 'text-xs border border-gray-300 dark:border-gray-600 rounded px-1 py-1 bg-white dark:bg-gray-700 dark:text-gray-100'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/purchases')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {isEdit ? 'Edit Purchase Invoice' : 'New Purchase Invoice'}
          </h2>
        </div>
        <button
          onClick={handleWhatsApp}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-[13px] text-white transition-all hover:opacity-90"
          style={{ background: '#25D366' }}
        >
          <MessageCircle size={15} /> WhatsApp
        </button>
      </div>

      {/* Supplier Info */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        {/* Supplier / Customer Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Supplier / Customer Details
            </h3>
            {selectedCustomer && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Linked: {selectedCustomer.name}
                <button
                  type="button"
                  onClick={handleClearCustomer}
                  className="ml-1 text-emerald-600 hover:text-emerald-900 dark:hover:text-emerald-100"
                  title="Unlink / Clear selected party"
                >
                  <X size={12} />
                </button>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowSearch(prev => {
                  const next = !prev
                  if (next) handleSearchCustomers(customerSearch)
                  return next
                })
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                showSearch
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-600 dark:text-indigo-200'
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              <Search size={14} />
              {showSearch ? 'Hide Search' : 'Select Existing Customer / Supplier'}
            </button>
            <button
              type="button"
              onClick={() => {
                setCustErrors({})
                setNewCust(EMPTY_SUPPLIER)
                setAddCustModal(true)
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <UserPlus size={14} />
              New Customer / Supplier
            </button>
          </div>
        </div>

        {/* Inline Searchable Dropdown Bar */}
        {showSearch && (
          <div ref={searchBoxRef} className="relative p-3 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-lg border border-indigo-200 dark:border-indigo-900/50 space-y-2">
            <div className="flex items-center justify-between text-xs text-indigo-950 dark:text-indigo-300 font-medium">
              <span>Search existing saved customer or supplier by name, phone, or GSTIN:</span>
              <button
                type="button"
                onClick={() => setShowSearch(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={14} />
              </button>
            </div>
            <div className="relative">
              <input
                autoFocus
                value={customerSearch}
                onChange={e => handleSearchCustomers(e.target.value)}
                onFocus={() => setCustomerDropOpen(true)}
                placeholder="Type name, phone number, or GSTIN..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {customerDropOpen && (
                <div className="absolute z-30 left-0 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-56 overflow-y-auto">
                  {searchingCustomers && (
                    <div className="px-3 py-2.5 text-xs text-gray-400">Searching records...</div>
                  )}
                  {!searchingCustomers && customerResults.length === 0 && (
                    <div className="px-3 py-3 text-xs text-gray-500 text-center">
                      No matching customer or supplier found. Click &quot;New Customer / Supplier&quot; to add.
                    </div>
                  )}
                  {!searchingCustomers && customerResults.map((c, i) => (
                    <button
                      key={c.id || `sup-${i}`}
                      type="button"
                      onClick={() => handleSelectCustomer(c)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border-b border-gray-100 dark:border-gray-700/50 last:border-0 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">{c.name}</div>
                        <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium">
                          {c.customer_type === 'SUNDRY_CREDITOR' ? 'Supplier' : (c.customer_type || 'Party')}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        {c.phone && <span>Ph: {c.phone}</span>}
                        {c.gstin && <span>GSTIN: {c.gstin}</span>}
                        {c.state && <span>State: {c.state}</span>}
                      </div>
                      {c.billing_address && (
                        <div className="text-[11px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
                          {c.billing_address}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <Input label="Bill Number" value={billNumber} onChange={e => setBillNumber(e.target.value)} placeholder="Supplier bill no." />
          <Input label="Bill Date" type="date" value={billDate} onChange={e => setBillDate(e.target.value)} />
          <Input label="Due Date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Supplier Name *" value={supplierName} onChange={e => setSupplierName(e.target.value)} />
          <Input label="Supplier Phone" value={supplierPhone} onChange={e => setSupplierPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10 digit number" />
          <Input label="Supplier GSTIN" value={supplierGstin} onChange={e => handleGstinChange(e.target.value)} placeholder="15-digit GSTIN" />
          <Input label="Supplier Email" type="email" value={supplierEmail} onChange={e => setSupplierEmail(e.target.value)} placeholder="supplier@example.com" />
          <Input label="Supplier Address" value={supplierAddress} onChange={e => setSupplierAddress(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Select label="Supplier State" value={supplierState} onChange={e => handleStateChange(e.target.value)}>
              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Input label="State Code" value={getStateCode(supplierState) || (supplierGstin.length >= 2 ? supplierGstin.substring(0, 2) : '')} readOnly className="bg-gray-50 dark:bg-gray-700/50" />
          </div>
          <Select label="Supply Type" value={supplyType} onChange={e => setSupplyType(e.target.value)}>
            <option value="intra">Intra-State (CGST + SGST)</option>
            <option value="inter">Inter-State (IGST)</option>
          </Select>
          {supplierGstin && supplierGstin.length >= 12 && (
            <Input label="PAN (from GSTIN)" value={supplierGstin.substring(2, 12)} readOnly className="bg-gray-50 dark:bg-gray-700/50" />
          )}
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="font-semibold mb-4 text-gray-900 dark:text-gray-100">Items</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-indigo-600 text-white">
                <th className="px-2 py-2 text-left" colSpan={2}>Product / Description</th>
                <th className="px-2 py-2">HSN</th>
                <th className="px-2 py-2">Qty</th>
                <th className="px-2 py-2">Unit</th>
                <th className="px-2 py-2">Rate</th>
                <th className="px-2 py-2">GST%</th>
                <th className="px-2 py-2 text-right">Amount</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const c = calcItem(item)
                return (
                  <tr key={item._key} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="px-2 py-1 min-w-[180px]" colSpan={2}>
                      <div className="relative">
                        <input
                          value={productSearches[item._key] ?? item.description}
                          onChange={e => searchProducts(item._key, e.target.value, idx)}
                          onFocus={() => setProductDropOpen(prev => ({ ...prev, [item._key]: true }))}
                          onBlur={() => handleProductBlur(item._key, idx)}
                          placeholder="Search or type product name..."
                          className={`w-full ${inputCls}`}
                        />
                        {productDropOpen[item._key] && (
                          <div className="absolute z-30 left-0 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-44 overflow-y-auto">
                            {(productResults[item._key] || []).map(p => (
                              <button
                                key={p.id}
                                onMouseDown={() => { productDropMouseDown.current = true }}
                                onClick={() => selectProduct(idx, p, item._key)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              >
                                <div className="font-medium text-gray-900 dark:text-gray-100">{p.name}</div>
                                <div className="text-gray-500">Rs. {p.selling_price} • GST {p.gst_percent}% • Stock: {p.stock_qty}</div>
                              </button>
                            ))}
                            {(productSearches[item._key] || '').trim() && (productResults[item._key] || []).length === 0 && (
                              <div className="px-3 py-2 text-xs text-gray-400">
                                No product found — will be auto-created on save
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1"><input className={`w-20 text-center ${inputCls}`} value={item.hsn_code} onChange={e => updateItem(idx, 'hsn_code', e.target.value)} /></td>
                    <td className="px-2 py-1"><input className={`w-16 text-center ${inputCls}`} type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} /></td>
                    <td className="px-2 py-1">
                      <select className={`w-16 ${selCls}`} value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}>
                        {UNITS.map(u => <option key={u}>{u}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1"><input className={`w-20 text-right ${inputCls}`} type="number" value={item.rate} onChange={e => updateItem(idx, 'rate', e.target.value)} /></td>
                    <td className="px-2 py-1">
                      <select className={`w-16 ${selCls}`} value={item.gst_percent} onChange={e => updateItem(idx, 'gst_percent', e.target.value)}>
                        {GST_RATES.map(r => <option key={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1 text-right font-medium text-gray-900 dark:text-gray-100">{formatCurrency(c.total)}</td>
                    <td className="px-2 py-1">
                      <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <button onClick={() => setItems(prev => [...prev, newItem()])} className="mt-3 flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800">
          <Plus size={14} /> Add Item
        </button>

        {/* Totals + Extra Charges */}
        <div className="flex justify-end mt-6">
          <div className="w-80 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            {supplyType === 'intra' ? <>
              <div className="flex justify-between"><span className="text-gray-500">CGST</span><span>{formatCurrency(totalCGST)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">SGST</span><span>{formatCurrency(totalSGST)}</span></div>
            </> : <div className="flex justify-between"><span className="text-gray-500">IGST</span><span>{formatCurrency(totalIGST)}</span></div>}

            {/* ── Forwarding Charges ── */}
            <div className="border-t pt-2 mt-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-gray-500 w-36 text-xs">Forwarding Charges</span>
                <input
                  type="number" min="0" step="0.01" value={forwarding}
                  onChange={e => setForwarding(e.target.value)}
                  className="w-24 text-right text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-gray-100"
                />
                <select value={forwardingGst} onChange={e => setForwardingGst(e.target.value)}
                  className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1 py-1 bg-white dark:bg-gray-700 dark:text-gray-100">
                  <option value="0">0%</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                </select>
              </div>
              {fwd.tax > 0 && <div className="flex justify-between text-xs text-gray-400 pl-36"><span>GST on Forwarding</span><span>{formatCurrency(fwd.tax)}</span></div>}
            </div>

            {/* ── Packaging Charges ── */}
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-36 text-xs">Packaging Charges</span>
              <input
                type="number" min="0" step="0.01" value={packaging}
                onChange={e => setPackaging(e.target.value)}
                className="w-24 text-right text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-gray-100"
              />
              <select value={packagingGst} onChange={e => setPackagingGst(e.target.value)}
                className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1 py-1 bg-white dark:bg-gray-700 dark:text-gray-100">
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
              </select>
            </div>
            {pkg.tax > 0 && <div className="flex justify-between text-xs text-gray-400 pl-36"><span>GST on Packaging</span><span>{formatCurrency(pkg.tax)}</span></div>}

            {/* ── Other Charges ── */}
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-36 text-xs">Other Charges</span>
              <input
                type="number" min="0" step="0.01" value={otherCharges}
                onChange={e => setOtherCharges(e.target.value)}
                className="w-24 text-right text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-gray-100"
              />
            </div>

            {/* ── Round Off ── */}
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-gray-500">Round Off</span>
              <span className={autoRoundOff >= 0 ? 'text-green-600' : 'text-red-600'}>
                {autoRoundOff >= 0 ? '+' : ''}{formatCurrency(autoRoundOff)}
              </span>
            </div>

            {/* Grand Total */}
            <div className="flex justify-between font-bold border-t pt-2 text-indigo-600 dark:text-indigo-400 text-base">
              <span>Grand Total</span><span>{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment + Notes */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 grid grid-cols-2 gap-4">
        <Input label="Amount Paid" type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} />
        <div className="flex items-end pb-1">
          <div className="text-sm text-gray-500">Balance Due: <span className="font-bold text-red-600">{formatCurrency(balanceDue)}</span></div>
        </div>
        <Textarea label="Notes / Narration" value={notes} onChange={e => setNotes(e.target.value)} rows={3} containerClassName="col-span-2" />
      </div>

      {/* Save Buttons */}
      <div className="flex justify-end gap-3 pb-6">
        <Button variant="secondary" onClick={() => navigate('/purchases')}>Cancel</Button>
        <Button icon={Save} loading={saving} onClick={handleSave}>
          {isEdit ? 'Save Changes' : 'Save Purchase Invoice'}
        </Button>
      </div>

      {/* Add New Customer / Supplier Modal */}
      <Modal isOpen={addCustModal} onClose={() => setAddCustModal(false)} title="New Customer / Supplier">
        <div className="space-y-3">
          {custErrors._ && (
            <div className="p-2 text-xs bg-red-600 text-white rounded">{custErrors._}</div>
          )}
          <Input
            label="Name *"
            value={newCust.name}
            onChange={e => setNewCust(p => ({ ...p, name: e.target.value }))}
            error={custErrors.name}
            placeholder="Company or party name"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Phone"
              value={newCust.phone}
              onChange={e => setNewCust(p => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
              error={custErrors.phone}
              placeholder="10 digit number"
            />
            <Input
              label="Email"
              type="email"
              value={newCust.email}
              onChange={e => setNewCust(p => ({ ...p, email: e.target.value }))}
              placeholder="Email address"
            />
          </div>
          <Input
            label="GSTIN"
            value={newCust.gstin}
            onChange={e => setNewCust(p => ({ ...p, gstin: e.target.value.toUpperCase() }))}
            error={custErrors.gstin}
            placeholder="15-digit GSTIN (optional)"
          />
          <Input
            label="Address"
            value={newCust.billing_address}
            onChange={e => setNewCust(p => ({ ...p, billing_address: e.target.value }))}
            placeholder="Billing / street address"
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="State"
              value={newCust.state}
              onChange={e => setNewCust(p => ({ ...p, state: e.target.value }))}
            >
              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Select
              label="Party Type"
              value={newCust.customer_type}
              onChange={e => setNewCust(p => ({ ...p, customer_type: e.target.value }))}
            >
              <option value="SUNDRY_CREDITOR">Supplier (Sundry Creditor)</option>
              <option value="SUNDRY_DEBTOR">Customer (Sundry Debtor)</option>
              <option value="B2B">B2B</option>
              <option value="B2C">B2C</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
            <Button variant="secondary" onClick={() => setAddCustModal(false)}>Cancel</Button>
            <Button loading={savingCust} onClick={handleAddCustomer}>Save &amp; Select</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

