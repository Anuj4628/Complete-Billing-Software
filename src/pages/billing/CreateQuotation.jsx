import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { 
  Building2, Calendar, Package, FileText, Plus, Trash2, 
  Save, ArrowLeft, ClipboardList, Check, AlertCircle, X, ChevronDown, UserPlus
} from 'lucide-react'
import { useQuotationStore } from '../../store/useQuotationStore.js'
import { useSettingsStore } from '../../store/useSettingsStore.js'
import Button from '../../components/ui/Button.jsx'
import Modal from '../../components/ui/Modal.jsx'
import { GST_RATES, INDIAN_STATES, UNITS } from '../../utils/gstHelpers.js'
import { formatCurrency, todayISO, numberToWords } from '../../utils/formatters.js'

function newEmptyItem() {
  return {
    _key: Math.random(),
    description: '',
    specification: '',
    hsn_code: '',
    quantity: '1',
    unit: 'MTR',
    rate: '',
    amount: 0
  }
}

const EMPTY_CUSTOMER = {
  name: '',
  phone: '',
  email: '',
  gstin: '',
  billing_address: '',
  shipping_address: '',
  shipping_name: '',
  shipping_gstin: '',
  shipping_state: 'Maharashtra',
  state: 'Maharashtra',
  customer_type: 'SUNDRY_DEBTOR'
}

const DEFAULT_TERMS = [
  'PRICE BASIS : Ex-Works / FOR Destination',
  'PAYMENT TERMS : 100% against delivery / 30 Days Credit',
  'TAXES : GST 18% Extra as applicable',
  'VALIDITY : 15 Days from quotation date',
  'DELIVERY : Ready Stock / 2-3 Weeks from PO',
  'TRANSPORTATION : Extra at actuals / Borne by buyer',
  'LOADING : Included in price',
  'INSPECTION : At our works prior to dispatch',
  'MTC : Mill Test Certificate will be provided along with supply',
  'TESTING CHARGES : Included'
]

export default function CreateQuotation() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id

  const { getNextNumber, getById, createQuotation, updateQuotation } = useQuotationStore()
  const { settings, loadSettings, showToast } = useSettingsStore()

  // ── Header / Quotation Parameters ─────────────────────────
  const [quotationNumber, setQuotationNumber] = useState('')
  const [quotationDate, setQuotationDate] = useState(todayISO())
  const [validUntilDate, setValidUntilDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 15)
    return d.toISOString().split('T')[0]
  })
  const [rfqReference, setRfqReference] = useState('')
  const [salesperson, setSalesperson] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [quotationStatus, setQuotationStatus] = useState('Draft')
  const [notes, setNotes] = useState('')

  // ── Customer & Consignee ─────────────────────────────────
  const [customers, setCustomers] = useState([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerGstin, setCustomerGstin] = useState('')
  const [customerState, setCustomerState] = useState('Maharashtra')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')

  const [hasConsignee, setHasConsignee] = useState(false)
  const [consigneeName, setConsigneeName] = useState('')
  const [consigneeAddress, setConsigneeAddress] = useState('')
  const [consigneeGstin, setConsigneeGstin] = useState('')
  const [consigneeState, setConsigneeState] = useState('Maharashtra')

  const [addCustModal, setAddCustModal] = useState(false)
  const [newCust, setNewCust] = useState(EMPTY_CUSTOMER)
  const [custErrors, setCustErrors] = useState({})
  const [savingCust, setSavingCust] = useState(false)

  // ── Items ────────────────────────────────────────────────
  const [taxRate, setTaxRate] = useState(18)
  const [items, setItems] = useState([newEmptyItem()])
  const itemDescRefs = useRef({})

  // ── Terms & Conditions ───────────────────────────────────
  const [terms, setTerms] = useState(DEFAULT_TERMS)

  // ── Extra Charges ────────────────────────────────────────
  const [freight, setFreight] = useState('0')
  const [packingCharges, setPackingCharges] = useState('0')

  // ── Bulk Paste Modal ─────────────────────────────────────
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkError, setBulkError] = useState('')
  const [bulkPreview, setBulkPreview] = useState([])

  // ── State for Saving ─────────────────────────────────────
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  // ── Initial Load ─────────────────────────────────────────
  useEffect(() => {
    loadSettings()
    loadCustomers()

    if (isEdit) {
      loadQuotationForEdit()
    } else {
      // Create mode: fetch next sequential number
      getNextNumber().then(num => {
        if (num) setQuotationNumber(num)
        else setQuotationNumber('JMA-2026-1023')
      })
      // Preload default salesperson
      if (settings?.company_name) {
        setSalesperson(settings?.authorized_signatory || '')
      }
      // Preload default terms from settings if configured
      if (settings?.quotation_terms) {
        try {
          const parsed = typeof settings.quotation_terms === 'string' 
            ? JSON.parse(settings.quotation_terms) 
            : settings.quotation_terms
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTerms(parsed)
          }
        } catch (_) {}
      }
    }
  }, [id])

  async function loadCustomers() {
    try {
      const res = await window.api.customers.getAll({ limit: 500 })
      if (res.success) {
        setCustomers(res.data)
      }
    } catch (err) {
      console.error('Failed to load customers:', err)
    }
  }

  async function loadQuotationForEdit() {
    setLoading(true)
    try {
      const res = await getById(parseInt(id, 10))
      if (res.success && res.data) {
        const q = res.data
        setQuotationNumber(q.quotation_number || '')
        setQuotationDate(q.quotation_date || todayISO())
        setValidUntilDate(q.valid_until || '')
        setRfqReference(q.rfq_reference || '')
        setSalesperson(q.salesperson || '')
        setCurrency(q.currency || 'INR')
        setQuotationStatus(q.status || 'Draft')
        setNotes(q.notes || '')

        setSelectedCustomerId(q.customer_id ? String(q.customer_id) : '')
        setCustomerName(q.customer_name || '')
        setCustomerAddress(q.customer_address || '')
        setCustomerGstin(q.customer_gstin || '')
        setCustomerState(q.customer_state || 'Maharashtra')
        setCustomerPhone(q.customer_phone || '')
        setCustomerEmail(q.customer_email || '')

        if (q.consignee_name || q.consignee_address || q.consignee_gstin) {
          setHasConsignee(true)
          setConsigneeName(q.consignee_name || '')
          setConsigneeAddress(q.consignee_address || '')
          setConsigneeGstin(q.consignee_gstin || '')
          setConsigneeState(q.consignee_state || 'Maharashtra')
        }

        setTaxRate(q.tax_rate !== undefined ? q.tax_rate : 18)
        setFreight(String(q.freight || 0))
        setPackingCharges(String(q.packing_charges || 0))

        if (q.items && q.items.length > 0) {
          setItems(q.items.map(it => ({
            _key: Math.random(),
            description: it.description || '',
            specification: it.specification || '',
            hsn_code: it.hsn_code || '',
            quantity: String(it.quantity || 1),
            unit: it.unit || 'MTR',
            rate: String(it.rate || 0),
            amount: (parseFloat(it.quantity || 0) * parseFloat(it.rate || 0))
          })))
        }

        if (q.terms_conditions) {
          try {
            const parsed = typeof q.terms_conditions === 'string'
              ? JSON.parse(q.terms_conditions)
              : q.terms_conditions
            if (Array.isArray(parsed) && parsed.length > 0) {
              setTerms(parsed)
            } else if (typeof q.terms_conditions === 'string' && q.terms_conditions.trim()) {
              setTerms(q.terms_conditions.split('\n').filter(Boolean))
            }
          } catch (_) {
            if (typeof q.terms_conditions === 'string' && q.terms_conditions.trim()) {
              setTerms(q.terms_conditions.split('\n').filter(Boolean))
            }
          }
        }
      } else {
        showToast('Quotation not found', 'error')
        navigate('/quotations')
      }
    } catch (err) {
      showToast('Error loading quotation: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // ── Customer Selection Handler ───────────────────────────
  function handleSelectCustomer(custId) {
    setSelectedCustomerId(custId)
    if (!custId) {
      setCustomerName('')
      setCustomerAddress('')
      setCustomerGstin('')
      setCustomerState('Maharashtra')
      setCustomerPhone('')
      setCustomerEmail('')
      return
    }

    const c = customers.find(item => String(item.id) === String(custId))
    if (c) {
      setCustomerName(c.name || '')
      setCustomerAddress(c.billing_address || '')
      setCustomerGstin(c.gstin || '')
      setCustomerState(c.state || 'Maharashtra')
      setCustomerPhone(c.phone || '')
      setCustomerEmail(c.email || '')

      if (c.shipping_name || c.shipping_address || c.shipping_gstin) {
        setHasConsignee(true)
        setConsigneeName(c.shipping_name || c.name || '')
        setConsigneeAddress(c.shipping_address || c.billing_address || '')
        setConsigneeGstin(c.shipping_gstin || c.gstin || '')
        setConsigneeState(c.shipping_state || c.state || 'Maharashtra')
      }
    }
  }

  // ── Add New Customer Modal Handler ───────────────────────
  async function handleSaveNewCustomer() {
    if (!newCust.name.trim()) {
      setCustErrors({ name: 'Customer name is required' })
      return
    }
    setSavingCust(true)
    try {
      const res = await window.api.customers.create(newCust)
      if (res.success) {
        showToast('Customer created successfully', 'success')
        await loadCustomers()
        handleSelectCustomer(String(res.data.id))
        setAddCustModal(false)
        setNewCust(EMPTY_CUSTOMER)
        setCustErrors({})
      } else {
        showToast(res.error || 'Failed to create customer', 'error')
      }
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSavingCust(false)
    }
  }

  // ── Items Management & Calculations ──────────────────────
  function updateItem(idx, field, value) {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: value }
      if (field === 'quantity' || field === 'rate') {
        const q = parseFloat(field === 'quantity' ? value : updated.quantity) || 0
        const r = parseFloat(field === 'rate' ? value : updated.rate) || 0
        updated.amount = Math.round(q * r * 100) / 100
      }
      return updated
    }))
  }

  function addItem() {
    const newItemObj = newEmptyItem()
    setItems(prev => [...prev, newItemObj])
    setTimeout(() => {
      const newIndex = items.length
      if (itemDescRefs.current[newIndex]) {
        itemDescRefs.current[newIndex].focus()
      }
    }, 50)
  }

  function deleteItem(idx) {
    if (items.length <= 1) {
      setItems([newEmptyItem()])
      return
    }
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  // Fast Keyboard workflow: Enter on Rate field creates/focuses next row
  function handleRateKeyDown(e, idx) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (idx === items.length - 1) {
        addItem()
      } else {
        const nextIdx = idx + 1
        if (itemDescRefs.current[nextIdx]) {
          itemDescRefs.current[nextIdx].focus()
        }
      }
    }
  }

  // ── Terms Management ─────────────────────────────────────
  function updateTerm(idx, val) {
    setTerms(prev => prev.map((t, i) => i === idx ? val : t))
  }

  function addTerm() {
    setTerms(prev => [...prev, ''])
  }

  function deleteTerm(idx) {
    setTerms(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Bulk Paste Parser ────────────────────────────────────
  function handleBulkTextChange(text) {
    setBulkText(text)
    setBulkError('')
    if (!text.trim()) {
      setBulkPreview([])
      return
    }

    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0)
    const parsed = []
    let hasErr = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      let parts = []

      if (line.includes('\t')) {
        parts = line.split('\t').map(p => p.trim())
      } else if (line.includes(',')) {
        parts = line.split(',').map(p => p.trim())
      } else {
        parts = line.split(/\s{2,}/).map(p => p.trim())
      }

      parts = parts.filter(p => p.length > 0)

      if (parts.length >= 4) {
        // [Description, Qty, Unit, Rate] or [SNo, Description, Qty, Unit, Rate]
        let desc = ''
        let qtyStr = ''
        let unit = 'MTR'
        let rateStr = ''

        if (parts.length >= 5 && /^\d+$/.test(parts[0])) {
          desc = parts[1]
          qtyStr = parts[2]
          unit = parts[3]
          rateStr = parts[4]
        } else {
          desc = parts[0]
          qtyStr = parts[1]
          unit = parts[2]
          rateStr = parts[3]
        }

        const qtyClean = qtyStr.replace(/[^\d.-]/g, '')
        const rateClean = rateStr.replace(/[^\d.-]/g, '')
        const qNum = parseFloat(qtyClean)
        const rNum = parseFloat(rateClean)

        if (isNaN(qNum) || isNaN(rNum)) {
          hasErr = true
          setBulkError(`Row ${i + 1} has invalid quantity or rate: "${line}"`)
        }

        parsed.push({
          _key: Math.random(),
          description: desc,
          specification: '',
          hsn_code: '',
          quantity: isNaN(qNum) ? '1' : String(qNum),
          unit: unit.toUpperCase() || 'MTR',
          rate: isNaN(rNum) ? '0' : String(rNum),
          amount: (isNaN(qNum) || isNaN(rNum)) ? 0 : Math.round(qNum * rNum * 100) / 100
        })
      } else if (parts.length === 3) {
        // [Description, Qty, Rate]
        const desc = parts[0]
        const qtyClean = parts[1].replace(/[^\d.-]/g, '')
        const rateClean = parts[2].replace(/[^\d.-]/g, '')
        const qNum = parseFloat(qtyClean)
        const rNum = parseFloat(rateClean)

        if (isNaN(qNum) || isNaN(rNum)) {
          hasErr = true
          setBulkError(`Row ${i + 1} has invalid quantity or rate: "${line}"`)
        }

        parsed.push({
          _key: Math.random(),
          description: desc,
          specification: '',
          hsn_code: '',
          quantity: isNaN(qNum) ? '1' : String(qNum),
          unit: 'MTR',
          rate: isNaN(rNum) ? '0' : String(rNum),
          amount: (isNaN(qNum) || isNaN(rNum)) ? 0 : Math.round(qNum * rNum * 100) / 100
        })
      } else {
        hasErr = true
        setBulkError(`Row ${i + 1} format not recognized: "${line}". Expected: Description [Tab] Qty [Tab] Unit [Tab] Rate`)
      }
    }

    setBulkPreview(parsed)
  }

  function handleApplyBulkPaste() {
    if (bulkPreview.length === 0) {
      setBulkError('No valid items found to import.')
      return
    }

    // Replace items if currently single empty item, otherwise append
    const isSingleEmpty = items.length === 1 && !items[0].description.trim() && !items[0].rate
    if (isSingleEmpty) {
      setItems(bulkPreview)
    } else {
      setItems(prev => [...prev, ...bulkPreview])
    }

    setBulkModalOpen(false)
    setBulkText('')
    setBulkPreview([])
    setBulkError('')
    showToast(`Successfully added ${bulkPreview.length} item(s)`, 'success')
  }

  // ── Financial Calculations ───────────────────────────────
  const companyState = settings?.company_state || 'Maharashtra'
  const isIntraState = !customerState || customerState.trim().toLowerCase() === companyState.trim().toLowerCase()

  const subtotal = items.reduce((sum, it) => {
    const q = parseFloat(it.quantity || 0)
    const r = parseFloat(it.rate || 0)
    return sum + (q * r)
  }, 0)

  const taxableAmount = Math.round(subtotal * 100) / 100

  const freightNum = parseFloat(freight || 0) || 0
  const packingNum = parseFloat(packingCharges || 0) || 0
  const effectiveTaxableForGst = taxableAmount // Base for GST calculation

  const effectiveTaxRate = parseFloat(taxRate || 0)
  let cgstAmount = 0
  let sgstAmount = 0
  let igstAmount = 0

  if (isIntraState) {
    cgstAmount = Math.round((effectiveTaxableForGst * (effectiveTaxRate / 2) / 100) * 100) / 100
    sgstAmount = Math.round((effectiveTaxableForGst * (effectiveTaxRate / 2) / 100) * 100) / 100
  } else {
    igstAmount = Math.round((effectiveTaxableForGst * effectiveTaxRate / 100) * 100) / 100
  }

  const totalTax = cgstAmount + sgstAmount + igstAmount
  const grandTotalExact = taxableAmount + freightNum + packingNum + totalTax
  const grandTotal = Math.round(grandTotalExact * 100) / 100
  const grandTotalWords = numberToWords(grandTotal)

  // ── Save Quotation Handler ───────────────────────────────
  async function handleSaveQuotation() {
    // Validations
    if (!customerName.trim()) {
      showToast('Please select or enter a Customer Name', 'error')
      return
    }
    if (!quotationNumber.trim()) {
      showToast('Quotation Number is required', 'error')
      return
    }
    if (!quotationDate) {
      showToast('Quotation Date is required', 'error')
      return
    }

    const validItems = items.filter(it => it.description.trim() || parseFloat(it.rate || 0) > 0)
    if (validItems.length === 0) {
      showToast('Please add at least one quotation item with description', 'error')
      return
    }

    for (let i = 0; i < validItems.length; i++) {
      const it = validItems[i]
      if (!it.description.trim()) {
        showToast(`Item ${i + 1} is missing a description`, 'error')
        return
      }
      if (parseFloat(it.quantity || 0) <= 0) {
        showToast(`Item ${i + 1} has invalid quantity`, 'error')
        return
      }
    }

    setSaving(true)

    const payload = {
      quotation_number: quotationNumber.trim(),
      quotation_date: quotationDate,
      valid_until: validUntilDate || null,
      customer_id: selectedCustomerId ? parseInt(selectedCustomerId, 10) : null,
      customer_name: customerName.trim(),
      customer_address: customerAddress.trim(),
      customer_gstin: customerGstin.trim(),
      customer_state: customerState || 'Maharashtra',
      customer_phone: customerPhone.trim(),
      customer_email: customerEmail.trim(),

      consignee_name: hasConsignee ? consigneeName.trim() : customerName.trim(),
      consignee_address: hasConsignee ? consigneeAddress.trim() : customerAddress.trim(),
      consignee_gstin: hasConsignee ? consigneeGstin.trim() : customerGstin.trim(),
      consignee_state: hasConsignee ? consigneeState : (customerState || 'Maharashtra'),

      rfq_reference: rfqReference.trim(),
      salesperson: salesperson.trim(),
      currency: currency || 'INR',
      supply_type: isIntraState ? 'intra' : 'inter',

      subtotal: taxableAmount,
      taxable_amount: taxableAmount,
      freight: freightNum,
      packing_charges: packingNum,
      other_charges: 0,
      tax_rate: effectiveTaxRate,
      total_cgst: cgstAmount,
      total_sgst: sgstAmount,
      total_igst: igstAmount,
      total_tax: totalTax,
      round_off: 0,
      grand_total: grandTotal,
      amount_in_words: grandTotalWords,
      terms_conditions: terms.filter(t => t.trim().length > 0),
      notes: notes.trim(),
      status: quotationStatus,

      items: validItems.map((it, idx) => {
        const q = parseFloat(it.quantity || 0)
        const r = parseFloat(it.rate || 0)
        const itemTaxable = Math.round(q * r * 100) / 100
        const itemCgst = isIntraState ? Math.round((itemTaxable * (effectiveTaxRate / 2) / 100) * 100) / 100 : 0
        const itemSgst = isIntraState ? Math.round((itemTaxable * (effectiveTaxRate / 2) / 100) * 100) / 100 : 0
        const itemIgst = !isIntraState ? Math.round((itemTaxable * effectiveTaxRate / 100) * 100) / 100 : 0
        const itemTotal = itemTaxable + itemCgst + itemSgst + itemIgst

        return {
          description: it.description.trim(),
          specification: it.specification ? it.specification.trim() : '',
          hsn_code: it.hsn_code ? it.hsn_code.trim() : '',
          quantity: q,
          unit: it.unit || 'MTR',
          rate: r,
          gst_percent: effectiveTaxRate,
          taxable_amount: itemTaxable,
          cgst_amount: itemCgst,
          sgst_amount: itemSgst,
          igst_amount: itemIgst,
          total_amount: itemTotal,
          sort_order: idx + 1
        }
      })
    }

    try {
      let res
      if (isEdit) {
        payload.id = parseInt(id, 10)
        res = await updateQuotation(payload)
      } else {
        res = await createQuotation(payload)
      }

      if (res.success) {
        const targetId = isEdit ? id : res.id
        navigate(`/quotations/${targetId}`)
      }
    } catch (err) {
      showToast('Save error: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20 max-w-[1440px] mx-auto">
      {/* ── TOP HEADER / BREADCRUMB ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/quotations')}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Back to Quotations"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {isEdit ? `Edit Quotation ${quotationNumber}` : 'Create New Quotation'}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Professional quotation creation & pricing worksheet
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold border border-gray-200 dark:border-gray-700">
            GST: {settings?.company_gstin || '27ATUPD4241P1Z3'}
          </span>
        </div>
      </div>

      {/* ── TWO-COLUMN MAIN WORKFLOW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ══════════════════════════════════════════════════════ */}
        {/* LEFT COLUMN: FORM DETAILS (lg:col-span-8)           */}
        {/* ══════════════════════════════════════════════════════ */}
        <div className="lg:col-span-8 space-y-6">

          {/* CARD 1: CUSTOMER & CONSIGNEE INFORMATION */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm transition-all">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-700/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600">
                  <Building2 size={18} />
                </div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">
                  1. Customer & Consignee Information
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAddCustModal(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 hover:underline transition-colors"
              >
                <UserPlus size={14} />
                + Add New Customer
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Select Existing Customer <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 transition-shadow appearance-none cursor-pointer"
                    value={selectedCustomerId}
                    onChange={e => handleSelectCustomer(e.target.value)}
                  >
                    <option value="">-- Choose Customer from Database --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.city ? `(${c.city})` : ''} {c.state ? `- ${c.state}` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3.5 top-3.5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Customer Selected Details Preview / Manual Override */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">
                    Customer / Company Name *
                  </label>
                  <input
                    type="text"
                    className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-750 px-3 py-2 text-gray-900 dark:text-gray-100 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Enter customer name"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">
                    Customer GSTIN
                  </label>
                  <input
                    type="text"
                    className="w-full text-xs font-mono uppercase rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-750 px-3 py-2 text-gray-900 dark:text-gray-100 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="e.g. 27AABCS5678K1Z4"
                    value={customerGstin}
                    onChange={e => setCustomerGstin(e.target.value.toUpperCase())}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">
                    Customer State *
                  </label>
                  <select
                    className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-750 px-3 py-2 text-gray-900 dark:text-gray-100 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    value={customerState}
                    onChange={e => setCustomerState(e.target.value)}
                  >
                    {INDIAN_STATES.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">
                    Billing Address
                  </label>
                  <input
                    type="text"
                    className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-750 px-3 py-2 text-gray-900 dark:text-gray-100 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Factory / Office Address"
                    value={customerAddress}
                    onChange={e => setCustomerAddress(e.target.value)}
                  />
                </div>
              </div>

              {/* Consignee Toggle & Section */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700/60">
                <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={hasConsignee}
                    onChange={e => setHasConsignee(e.target.checked)}
                    className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                  />
                  <span>Consignee (Ship To) is different from Buyer (Bill To)</span>
                </label>

                {hasConsignee && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 p-3.5 rounded-lg bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-600">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">
                        Shipping Customer / Company Name
                      </label>
                      <input
                        type="text"
                        className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-gray-100"
                        placeholder="Consignee company name"
                        value={consigneeName}
                        onChange={e => setConsigneeName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">
                        Shipping GSTIN
                      </label>
                      <input
                        type="text"
                        className="w-full text-xs font-mono uppercase rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-gray-100"
                        placeholder="Consignee GSTIN"
                        value={consigneeGstin}
                        onChange={e => setConsigneeGstin(e.target.value.toUpperCase())}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">
                        Shipping Address
                      </label>
                      <input
                        type="text"
                        className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-gray-100"
                        placeholder="Warehouse / Site delivery address"
                        value={consigneeAddress}
                        onChange={e => setConsigneeAddress(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">
                        Shipping State
                      </label>
                      <select
                        className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-gray-100"
                        value={consigneeState}
                        onChange={e => setConsigneeState(e.target.value)}
                      >
                        {INDIAN_STATES.map(st => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CARD 2: QUOTATION PARAMETERS & TERMS */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm transition-all">
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-gray-100 dark:border-gray-700/60">
              <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600">
                <Calendar size={18} />
              </div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">
                2. Quotation Parameters & Terms
              </h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Quotation Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full text-sm font-mono font-bold rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-750 px-3.5 py-2 text-gray-900 dark:text-gray-100 cursor-not-allowed"
                    value={quotationNumber}
                    readOnly
                    title="Auto-generated sequential quotation number"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Quotation Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                    value={quotationDate}
                    onChange={e => setQuotationDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Valid Until Date
                  </label>
                  <input
                    type="date"
                    className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                    value={validUntilDate}
                    onChange={e => setValidUntilDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Customer RFQ / Tender Ref
                  </label>
                  <input
                    type="text"
                    className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="e.g. ENQ/LT/HE/2026/01"
                    value={rfqReference}
                    onChange={e => setRfqReference(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Salesperson / Prepared By
                  </label>
                  <input
                    type="text"
                    className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="e.g. Rajesh Sharma"
                    value={salesperson}
                    onChange={e => setSalesperson(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Currency
                  </label>
                  <select
                    className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                  >
                    <option value="INR">INR (₹ - Indian Rupee)</option>
                    <option value="USD">USD ($ - US Dollar)</option>
                    <option value="EUR">EUR (€ - Euro)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 3: QUOTATION ITEMS (COUNT) */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm transition-all">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100 dark:border-gray-700/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600">
                  <Package size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">
                    3. Quotation Items ({items.length})
                  </h2>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Tally-style quick entry • Paste complete product description, enter Qty & Rate
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-750 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs">
                  <span className="text-gray-500 font-medium">Tax:</span>
                  <select
                    className="bg-transparent font-semibold text-gray-900 dark:text-gray-100 focus:outline-none cursor-pointer"
                    value={taxRate}
                    onChange={e => setTaxRate(parseFloat(e.target.value))}
                  >
                    {GST_RATES.map(r => (
                      <option key={r} value={r}>
                        {r}% GST {r === 18 ? '(Standard)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setBulkModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-650 text-xs font-semibold text-gray-700 dark:text-gray-200 shadow-sm transition-colors"
                >
                  <ClipboardList size={14} className="text-gray-500" />
                  Bulk Paste
                </button>

                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm transition-colors"
                >
                  <Plus size={14} />
                  + Add Item
                </button>
              </div>
            </div>

            {/* Item Table */}
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-750/50">
                    <th className="py-2.5 px-2 text-center w-12">S.No.</th>
                    <th className="py-2.5 px-3 min-w-[280px]">Item Description (Copy & Paste Full Specs)</th>
                    <th className="py-2.5 px-2 text-center w-24">Qty</th>
                    <th className="py-2.5 px-2 text-center w-28">Unit</th>
                    <th className="py-2.5 px-2 text-right w-32">Rate (₹)</th>
                    <th className="py-2.5 px-3 text-right w-36">Amount (₹)</th>
                    <th className="py-2.5 px-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {items.map((it, idx) => (
                    <tr key={it._key} className="group hover:bg-gray-50/50 dark:hover:bg-gray-750/30 transition-colors">
                      {/* S.NO (Automatic sequential renumbering) */}
                      <td className="py-2 px-2 text-center font-bold text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 select-none">
                        {idx + 1}
                      </td>

                      {/* ITEM DESCRIPTION */}
                      <td className="py-2 px-3">
                        <textarea
                          rows={2}
                          ref={el => itemDescRefs.current[idx] = el}
                          className="w-full text-xs font-normal rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 resize-y placeholder:text-gray-400 leading-relaxed"
                          placeholder="Enter complete material/product specs (e.g. SS 304 Seamless Pipe, 2 inch NB, SCH 40)..."
                          value={it.description}
                          onChange={e => updateItem(idx, 'description', e.target.value)}
                        />
                      </td>

                      {/* QUANTITY */}
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          className="w-full text-xs font-bold text-center rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                          value={it.quantity}
                          onChange={e => updateItem(idx, 'quantity', e.target.value)}
                        />
                      </td>

                      {/* UNIT */}
                      <td className="py-2 px-2">
                        <select
                          className="w-full text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
                          value={it.unit}
                          onChange={e => updateItem(idx, 'unit', e.target.value)}
                        >
                          {UNITS.map(u => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </td>

                      {/* RATE */}
                      <td className="py-2 px-2">
                        <div className="relative">
                          <span className="absolute left-2.5 top-2 text-gray-400 select-none text-xs">₹</span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            className="w-full text-xs font-semibold text-right pl-6 pr-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                            placeholder="0.00"
                            value={it.rate}
                            onChange={e => updateItem(idx, 'rate', e.target.value)}
                            onKeyDown={e => handleRateKeyDown(e, idx)}
                          />
                        </div>
                      </td>

                      {/* AMOUNT (READONLY BOX) */}
                      <td className="py-2 px-3 text-right">
                        <div className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-750 font-bold font-mono text-gray-900 dark:text-gray-100 select-none">
                          {formatCurrency(it.amount, '₹')}
                        </div>
                      </td>

                      {/* DELETE */}
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => deleteItem(idx)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          title="Delete Item"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Quick Workflow Guide & Add Button */}
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/60 text-xs">
              <div className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Quick Workflow:</span>
                <span>Paste description</span>
                <span className="text-gray-400">→</span>
                <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 border text-[10px]">Tab</kbd>
                <span>to Qty</span>
                <span className="text-gray-400">→</span>
                <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 border text-[10px]">Tab</kbd>
                <span>to Unit</span>
                <span className="text-gray-400">→</span>
                <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 border text-[10px]">Tab</kbd>
                <span>to Rate</span>
                <span className="text-gray-400">→</span>
                <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 border text-[10px]">Enter</kbd>
                <span>to add next row.</span>
              </div>

              <button
                type="button"
                onClick={addItem}
                className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline"
              >
                + Add another item
              </button>
            </div>
          </div>

          {/* CARD 4: TERMS & CONDITIONS */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm transition-all">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-700/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600">
                  <FileText size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">
                    4. Terms & Conditions
                  </h2>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Terms saved with this quotation. These will print on the quotation PDF.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={addTerm}
                className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline"
              >
                + Add Term
              </button>
            </div>

            <div className="space-y-2">
              {terms.map((t, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-6 text-center text-xs font-bold text-gray-400 select-none">
                    {idx + 1}.
                  </span>
                  <input
                    type="text"
                    className="flex-1 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                    value={t}
                    onChange={e => updateTerm(idx, e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => deleteTerm(idx)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg"
                    title="Remove Term"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Quotation Remarks / Notes */}
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/60">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Special Remarks / Notes (Optional)
              </label>
              <textarea
                rows={2}
                className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 p-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Any special packaging instructions or payment notes..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════ */}
        {/* RIGHT COLUMN: SUMMARY & TAXES (lg:col-span-4)       */}
        {/* ══════════════════════════════════════════════════════ */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-5">
            
            {/* Header with Supply Type Badge */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700/60">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-red-600" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">
                  Summary & Taxes
                </h3>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                isIntraState 
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300' 
                  : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-300'
              }`}>
                {isIntraState ? 'Intrastate (CGST+SGST)' : 'Interstate (IGST)'}
              </span>
            </div>

            {/* Subtotal & Taxable Amount */}
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                <span>Gross Subtotal:</span>
                <span className="font-mono font-bold text-gray-900 dark:text-gray-100">
                  {formatCurrency(subtotal, '₹')}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                <span className="font-semibold">Taxable Amount:</span>
                <span className="font-mono font-bold text-gray-900 dark:text-gray-100">
                  {formatCurrency(taxableAmount, '₹')}
                </span>
              </div>
            </div>

            {/* Extra Charges Section */}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-700/60 space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Extra Charges
              </div>

              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-gray-600 dark:text-gray-300 font-medium">Freight:</span>
                <div className="relative w-36">
                  <span className="absolute left-2.5 top-1.5 text-gray-400 select-none">₹</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="w-full text-xs font-mono font-semibold text-right pl-6 pr-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-750 text-gray-900 dark:text-gray-100 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    value={freight}
                    onChange={e => setFreight(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-gray-600 dark:text-gray-300 font-medium">Packing & Handling:</span>
                <div className="relative w-36">
                  <span className="absolute left-2.5 top-1.5 text-gray-400 select-none">₹</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="w-full text-xs font-mono font-semibold text-right pl-6 pr-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-750 text-gray-900 dark:text-gray-100 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    value={packingCharges}
                    onChange={e => setPackingCharges(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Goods & Services Tax (GST) */}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-700/60 space-y-2 text-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Goods & Services Tax (GST)
              </div>

              {isIntraState ? (
                <>
                  <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                    <span>CGST ({effectiveTaxRate / 2}%):</span>
                    <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                      {formatCurrency(cgstAmount, '₹')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                    <span>SGST ({effectiveTaxRate / 2}%):</span>
                    <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                      {formatCurrency(sgstAmount, '₹')}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                  <span>IGST ({effectiveTaxRate}%):</span>
                  <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                    {formatCurrency(igstAmount, '₹')}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center text-gray-700 dark:text-gray-200 pt-1 font-semibold">
                <span>Total Tax:</span>
                <span className="font-mono font-bold text-gray-900 dark:text-gray-100">
                  {formatCurrency(totalTax, '₹')}
                </span>
              </div>
            </div>

            {/* ── PROMINENT RED GRAND TOTAL CARD ── */}
            <div className="bg-gradient-to-br from-red-600 via-red-600 to-rose-700 text-white rounded-xl p-4 sm:p-5 shadow-lg shadow-red-500/20 space-y-1">
              <div className="text-[11px] font-bold tracking-wider uppercase text-red-100">
                Grand Total (Inc. All Taxes)
              </div>
              <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight">
                {formatCurrency(grandTotal, '₹')}
              </div>
            </div>

            {/* AMOUNT IN WORDS */}
            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                Amount in Words
              </div>
              <div className="text-xs italic font-medium text-gray-700 dark:text-gray-200 leading-snug">
                {grandTotalWords}
              </div>
            </div>

            {/* Quotation Status Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                Quotation Status
              </label>
              <select
                className="w-full text-xs font-semibold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
                value={quotationStatus}
                onChange={e => setQuotationStatus(e.target.value)}
              >
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Accepted">Accepted</option>
                <option value="Rejected">Rejected</option>
                <option value="Expired">Expired</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={handleSaveQuotation}
                disabled={saving}
                className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving Quotation...</span>
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    <span>Save Quotation & View</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate('/quotations')}
                disabled={saving}
                className="w-full py-2.5 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-750 font-semibold text-xs transition-colors"
              >
                Cancel & Return
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* ── BULK PASTE MODAL ── */}
      <Modal
        open={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        title="Bulk Paste Quotation Items"
        size="lg"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 text-xs leading-relaxed space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <ClipboardList size={15} />
              Quick Import from Excel, Google Sheets, or CSV:
            </div>
            <div>
              Copy multiple rows from your spreadsheet and paste below. The parser handles columns:
              <strong className="ml-1">Description [Tab] Quantity [Tab] Unit [Tab] Rate</strong>
            </div>
          </div>

          <div>
            <textarea
              rows={7}
              className="w-full text-xs font-mono rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-3 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 placeholder:text-gray-400"
              placeholder={`Example:\nSS 304 Seamless Pipe\t50\tMTR\t1450\nSS 316 Seamless Pipe\t25\tMTR\t2200\nCarbon Steel Pipe\t100\tMTR\t850`}
              value={bulkText}
              onChange={e => handleBulkTextChange(e.target.value)}
            />
          </div>

          {bulkError && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="flex-shrink-0" />
              <span>{bulkError}</span>
            </div>
          )}

          {bulkPreview.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Preview ({bulkPreview.length} items parsed):
              </div>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 text-xs">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 dark:bg-gray-750 text-[11px] text-gray-500 uppercase sticky top-0">
                    <tr>
                      <th className="p-2">Description</th>
                      <th className="p-2 text-center">Qty</th>
                      <th className="p-2 text-center">Unit</th>
                      <th className="p-2 text-right">Rate</th>
                      <th className="p-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {bulkPreview.map((it, i) => (
                      <tr key={i}>
                        <td className="p-2 font-medium">{it.description}</td>
                        <td className="p-2 text-center font-bold">{it.quantity}</td>
                        <td className="p-2 text-center">{it.unit}</td>
                        <td className="p-2 text-right">₹{it.rate}</td>
                        <td className="p-2 text-right font-bold">{formatCurrency(it.amount, '₹')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-700">
            <Button variant="secondary" onClick={() => setBulkModalOpen(false)}>
              Cancel
            </Button>
            <button
              type="button"
              onClick={handleApplyBulkPaste}
              disabled={bulkPreview.length === 0}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs disabled:opacity-40 transition-colors"
            >
              Add {bulkPreview.length} Item(s) to Quotation
            </button>
          </div>
        </div>
      </Modal>

      {/* ── ADD NEW CUSTOMER MODAL ── */}
      <Modal
        open={addCustModal}
        onClose={() => setAddCustModal(false)}
        title="Add New Customer"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Customer / Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={`w-full text-xs rounded-lg border px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 ${
                  custErrors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="ABC Steel Industries"
                value={newCust.name}
                onChange={e => setNewCust(p => ({ ...p, name: e.target.value }))}
              />
              {custErrors.name && <p className="text-[11px] text-red-500 mt-0.5">{custErrors.name}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                GSTIN
              </label>
              <input
                type="text"
                className="w-full text-xs font-mono uppercase rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="27AABCS5678K1Z4"
                value={newCust.gstin}
                onChange={e => setNewCust(p => ({ ...p, gstin: e.target.value.toUpperCase() }))}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                className="w-full text-xs rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="9876543210"
                value={newCust.phone}
                onChange={e => setNewCust(p => ({ ...p, phone: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                className="w-full text-xs rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="purchase@abcsteel.com"
                value={newCust.email}
                onChange={e => setNewCust(p => ({ ...p, email: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                State
              </label>
              <select
                className="w-full text-xs rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                value={newCust.state}
                onChange={e => setNewCust(p => ({ ...p, state: e.target.value }))}
              >
                {INDIAN_STATES.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Billing Address
              </label>
              <input
                type="text"
                className="w-full text-xs rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Plot No. 12, Industrial Area"
                value={newCust.billing_address}
                onChange={e => setNewCust(p => ({ ...p, billing_address: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-700">
            <Button variant="secondary" onClick={() => setAddCustModal(false)}>
              Cancel
            </Button>
            <button
              type="button"
              onClick={handleSaveNewCustomer}
              disabled={savingCust}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs disabled:opacity-40 transition-colors"
            >
              {savingCust ? 'Saving...' : 'Save & Select Customer'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
