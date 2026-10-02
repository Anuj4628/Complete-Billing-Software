import { useEffect, useState } from 'react'
import { Plus, Trash2, CreditCard, FileText } from 'lucide-react'
import Button from '../components/ui/Button.jsx'
import { Table, Pagination } from '../components/ui/Table.jsx'
import Modal from '../components/ui/Modal.jsx'
import Input, { Select, Textarea } from '../components/ui/Input.jsx'
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx'
import { formatCurrency, formatDate, todayISO } from '../utils/formatters.js'
import { useSettingsStore } from '../store/useSettingsStore.js'

const EMPTY = {
  payment_date: todayISO(), payment_type: 'receipt',
  party_type: 'customer', party_name: '', party_id: '',
  amount: '', payment_mode: 'cash', reference_no: '', narration: '',
  selected_invoice_id: null, selected_purchase_id: null,
}

export default function Payments() {
  const { showToast } = useSettingsStore()
  const [data, setData]                       = useState([])
  const [total, setTotal]                     = useState(0)
  const [page, setPage]                       = useState(1)
  const [loading, setLoading]                 = useState(false)
  const [modal, setModal]                     = useState(false)
  const [form, setForm]                       = useState(EMPTY)
  const [saving, setSaving]                   = useState(false)
  const [deleteTarget, setDeleteTarget]       = useState(null)

  // Customer side
  const [customers, setCustomers]             = useState([])
  const [unpaidInvoices, setUnpaidInvoices]   = useState([])
  const [selectedInvoice, setSelectedInvoice] = useState(null)

  // Supplier side
  const [suppliers, setSuppliers]             = useState([])
  const [unpaidBills, setUnpaidBills]         = useState([])
  const [selectedBill, setSelectedBill]       = useState(null)

  const limit = 20

  useEffect(() => { fetchData() }, [page])

  useEffect(() => {
    window.api.customers.getAll({ limit: 500 }).then(r => { if (r.success) setCustomers(r.data) })
    window.api.purchases.getAllSuppliersForLedger().then(r => { if (r.success) setSuppliers(r.data) })
  }, [])

  // When customer changes → load unpaid sales invoices
  useEffect(() => {
    setUnpaidInvoices([])
    setSelectedInvoice(null)
    if (form.party_type === 'customer' && form.party_id) {
      window.api.invoices.getUnpaidByCustomer(parseInt(form.party_id)).then(r => {
        if (r.success) setUnpaidInvoices(r.data)
      })
    }
  }, [form.party_id, form.party_type])

  // When supplier changes → load unpaid purchase bills
  useEffect(() => {
    setUnpaidBills([])
    setSelectedBill(null)
    if (form.party_type === 'supplier' && form.party_name.trim()) {
      window.api.purchases.getUnpaidBySupplier(form.party_name.trim()).then(r => {
        if (r.success) setUnpaidBills(r.data)
      })
    }
  }, [form.party_name, form.party_type])

  async function fetchData() {
    setLoading(true)
    const res = await window.api.payments.getAll({ page, limit })
    if (res.success) { setData(res.data); setTotal(res.total) }
    setLoading(false)
  }

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  function handleCustomerChange(e) {
    const name = e.target.value
    const matched = customers.find(c => c.name === name)
    setForm(p => ({ ...p, party_name: name, party_id: matched ? String(matched.id) : '' }))
    setSelectedInvoice(null)
  }

  function handleSupplierChange(e) {
    const name = e.target.value
    setForm(p => ({ ...p, party_name: name, party_id: '' }))
    setSelectedBill(null)
  }

  function handleInvoiceSelect(inv) {
    if (selectedInvoice?.id === inv.id) {
      setSelectedInvoice(null)
      setForm(p => ({ ...p, amount: '', narration: '', selected_invoice_id: null }))
      return
    }
    setSelectedInvoice(inv)
    setForm(p => ({
      ...p,
      amount: String(parseFloat(inv.balance_due || 0).toFixed(2)),
      narration: `Payment for Invoice ${inv.invoice_number}`,
      selected_invoice_id: inv.id,
      selected_purchase_id: null,
    }))
  }

  function handleBillSelect(bill) {
    if (selectedBill?.id === bill.id) {
      setSelectedBill(null)
      setForm(p => ({ ...p, amount: '', narration: '', selected_purchase_id: null }))
      return
    }
    setSelectedBill(bill)
    // Use exact supplier_name from the purchase bill so ledger matching works correctly
    setForm(p => ({
      ...p,
      party_name: bill.supplier_name,
      amount: String(parseFloat(bill.balance_due || 0).toFixed(2)),
      narration: `Payment for Purchase Bill ${bill.bill_number || bill.id}`,
      selected_purchase_id: bill.id,
      selected_invoice_id: null,
    }))
  }

  async function handleSave() {
    if (!form.party_name.trim()) { showToast('Party name required', 'error'); return }
    if (!form.amount || parseFloat(form.amount) <= 0) { showToast('Amount must be > 0', 'error'); return }
    setSaving(true)
    let payloadForm = { ...form }
    if (form.party_type === 'customer' && form.party_id) {
      payloadForm.party_id = parseInt(form.party_id)
    }
    const res = await window.api.payments.create(payloadForm)
    setSaving(false)
    if (res.success) {
      showToast('Payment saved', 'success')
      setModal(false); setForm(EMPTY)
      setSelectedInvoice(null); setUnpaidInvoices([])
      setSelectedBill(null); setUnpaidBills([])
      fetchData()
    } else showToast(res.error, 'error')
  }

  function handleClose() {
    setModal(false); setForm(EMPTY)
    setSelectedInvoice(null); setUnpaidInvoices([])
    setSelectedBill(null); setUnpaidBills([])
  }

  const columns = [
    { key: 'payment_date', label: 'Date', render: v => formatDate(v) },
    { key: 'payment_type', label: 'Type', render: v => (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${v === 'receipt' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
        {v === 'receipt' ? 'Receipt' : 'Payment'}
      </span>
    )},
    { key: 'party_name', label: 'Party' },
    { key: 'party_type', label: 'Party Type', render: v => (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${v === 'customer' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
        {v === 'customer' ? 'Customer' : 'Supplier'}
      </span>
    )},
    { key: 'payment_mode', label: 'Mode', render: v => v?.toUpperCase() },
    { key: 'amount', label: 'Amount', render: v => formatCurrency(v) },
    { key: 'narration', label: 'Narration', render: v => v || '-' },
    { key: 'id', label: '', render: (v, row) => (
      <button onClick={() => setDeleteTarget(row)} className="text-red-500 p-1"><Trash2 size={14} /></button>
    )},
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CreditCard size={22} className="text-indigo-600" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Payments & Receipts</h2>
        </div>
        <Button icon={Plus} onClick={() => setModal(true)}>New Entry</Button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <Table columns={columns} data={data} loading={loading} emptyMessage="No payments yet" />
        <Pagination page={page} total={total} limit={limit} onPageChange={setPage} />
      </div>

      <ConfirmDialog
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { await window.api.payments.delete(deleteTarget.id); setDeleteTarget(null); fetchData() }}
        title="Delete Entry" message="Delete this payment entry?"
      />

      <Modal open={modal} onClose={handleClose} title="New Payment / Receipt">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="Type" value={form.payment_type} onChange={f('payment_type')}>
              <option value="receipt">Receipt (Money In)</option>
              <option value="payment">Payment (Money Out)</option>
            </Select>
            <Input label="Date" type="date" value={form.payment_date} onChange={f('payment_date')} />

            <Select label="Party Type" value={form.party_type} onChange={e => {
              setForm(p => ({ ...p, party_type: e.target.value, party_name: '', party_id: '' }))
              setUnpaidInvoices([]); setSelectedInvoice(null)
              setUnpaidBills([]); setSelectedBill(null)
            }}>
              <option value="customer">Customer (Debtor)</option>
              <option value="supplier">Supplier (Creditor)</option>
            </Select>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Party Name *</label>
              {form.party_type === 'customer' ? (
                <select
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
                  value={form.party_name} onChange={handleCustomerChange}
                >
                  <option value="">Select Customer...</option>
                  {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              ) : (
                <select
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
                  value={form.party_name} onChange={handleSupplierChange}
                >
                  <option value="">Select Supplier...</option>
                  {suppliers.map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* ── Pending Sales Invoices (Customer) ── */}
          {form.party_type === 'customer' && form.party_id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <span className="flex items-center gap-1.5"><FileText size={14} className="text-indigo-500" /> Pending Sales Invoices</span>
              </label>
              {unpaidInvoices.length === 0 ? (
                <div className="text-xs text-gray-400 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700">
                  No unpaid invoices for this customer
                </div>
              ) : (
                <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                        <th className="px-3 py-2 text-left font-semibold">Invoice</th>
                        <th className="px-3 py-2 text-left font-semibold">Date</th>
                        <th className="px-3 py-2 text-right font-semibold">Total</th>
                        <th className="px-3 py-2 text-right font-semibold">Balance Due</th>
                        <th className="px-3 py-2 text-center font-semibold">Status</th>
                        <th className="px-3 py-2 text-center font-semibold">Select</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unpaidInvoices.map(inv => (
                        <tr key={inv.id}
                          className={`border-t border-gray-100 dark:border-gray-600 cursor-pointer transition-colors ${selectedInvoice?.id === inv.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'}`}
                          onClick={() => handleInvoiceSelect(inv)}
                        >
                          <td className="px-3 py-2 font-mono font-bold text-indigo-600 dark:text-indigo-400">{inv.invoice_number}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{formatDate(inv.invoice_date)}</td>
                          <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{formatCurrency(inv.grand_total)}</td>
                          <td className="px-3 py-2 text-right font-bold text-red-600 dark:text-red-400">{formatCurrency(inv.balance_due)}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${inv.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
                              {inv.payment_status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input type="radio" checked={selectedInvoice?.id === inv.id} onChange={() => handleInvoiceSelect(inv)} className="accent-indigo-600" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Pending Purchase Bills (Supplier) ── */}
          {form.party_type === 'supplier' && form.party_name.trim() && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <span className="flex items-center gap-1.5"><FileText size={14} className="text-orange-500" /> Pending Purchase Bills</span>
              </label>
              {unpaidBills.length === 0 ? (
                <div className="text-xs text-gray-400 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700">
                  No unpaid purchase bills for this supplier
                </div>
              ) : (
                <div className="rounded-lg border border-orange-200 dark:border-orange-700 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400">
                        <th className="px-3 py-2 text-left font-semibold">Bill No.</th>
                        <th className="px-3 py-2 text-left font-semibold">Date</th>
                        <th className="px-3 py-2 text-right font-semibold">Total</th>
                        <th className="px-3 py-2 text-right font-semibold">Balance Due</th>
                        <th className="px-3 py-2 text-center font-semibold">Status</th>
                        <th className="px-3 py-2 text-center font-semibold">Select</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unpaidBills.map(bill => (
                        <tr key={bill.id}
                          className={`border-t border-orange-100 dark:border-orange-800 cursor-pointer transition-colors ${selectedBill?.id === bill.id ? 'bg-orange-50 dark:bg-orange-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'}`}
                          onClick={() => handleBillSelect(bill)}
                        >
                          <td className="px-3 py-2 font-mono font-bold text-orange-600 dark:text-orange-400">{bill.bill_number || `#${bill.id}`}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{formatDate(bill.bill_date)}</td>
                          <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{formatCurrency(bill.grand_total)}</td>
                          <td className="px-3 py-2 text-right font-bold text-red-600 dark:text-red-400">{formatCurrency(bill.balance_due)}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${bill.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
                              {bill.payment_status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input type="radio" checked={selectedBill?.id === bill.id} onChange={() => handleBillSelect(bill)} className="accent-orange-600" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input label="Amount *" type="number" value={form.amount} onChange={f('amount')} />
            <Select label="Payment Mode" value={form.payment_mode} onChange={f('payment_mode')}>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="neft">NEFT/RTGS</option>
              <option value="upi">UPI</option>
              <option value="other">Other</option>
            </Select>
            <Input label="Reference No." value={form.reference_no} onChange={f('reference_no')} placeholder="Cheque/UTR no." containerClassName="col-span-2" />
          </div>
          <Textarea label="Narration" value={form.narration} onChange={f('narration')} rows={2} placeholder="Purpose of payment..." />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button loading={saving} onClick={handleSave}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
