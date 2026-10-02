import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, BookOpen, X } from 'lucide-react'
import { useCustomerStore } from '../store/useCustomerStore.js'
import { Table, Pagination } from '../components/ui/Table.jsx'
import SearchBar from '../components/ui/SearchBar.jsx'
import Button from '../components/ui/Button.jsx'
import Modal from '../components/ui/Modal.jsx'
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx'
import Input, { Select } from '../components/ui/Input.jsx'
import Badge from '../components/ui/Badge.jsx'
import { StatusBadge } from '../components/ui/Badge.jsx'
import { formatCurrency, formatDate } from '../utils/formatters.js'
import { INDIAN_STATES, getStateByCode } from '../utils/gstHelpers.js'

const EMPTY = {
  name: '', phone: '', email: '', gstin: '',
  billing_address: '',
  shipping_name: '', shipping_gstin: '', shipping_address: '', shipping_state: '',
  state: 'Maharashtra', customer_type: 'SUNDRY_DEBTOR',
}

export default function Customers() {
  const {
    customers, total, page, limit, loading,
    fetchCustomers, setSearch, setPage,
    createCustomer, updateCustomer, deleteCustomer,
  } = useCustomerStore()

  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [ledger, setLedger] = useState(null)
  const [ledgerData, setLedgerData] = useState([])
  const [ledgerLoading, setLedgerLoading] = useState(false)

  useEffect(() => { fetchCustomers() }, [])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErrors({})
    setModal(true)
  }

  function openEdit(customer) {
    setEditing(customer)
    setForm({
      ...EMPTY,
      ...customer,
      shipping_name: customer.shipping_name || '',
      shipping_gstin: customer.shipping_gstin || '',
      shipping_address: customer.shipping_address || '',
      shipping_state: customer.shipping_state || (customer.shipping_gstin && customer.shipping_gstin.length >= 2 ? getStateByCode(customer.shipping_gstin.substring(0, 2)) : '') || customer.state || 'Maharashtra',
    })
    setErrors({})
    setModal(true)
  }

  async function openLedger(customer) {
    setLedger(customer)
    setLedgerLoading(true)
    setLedgerData([])
    const res = await window.api.customers.getLedger(customer.id)
    if (res.success) setLedgerData(res.data)
    setLedgerLoading(false)
  }

  function validate() {
    const e = {}
    if (!form.name || form.name.trim().length < 2) e.name = 'Name must be at least 2 characters'
    const phoneOptional = ['SUNDRY_DEBTOR', 'SUNDRY_CREDITOR'].includes(form.customer_type)
    if (!phoneOptional && (!form.phone || !/^\d{10}$/.test(form.phone.trim()))) e.phone = 'Enter valid 10-digit phone number'
    if (form.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstin.toUpperCase()))
      e.gstin = 'Invalid GSTIN format'
    if (form.shipping_gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.shipping_gstin.toUpperCase()))
      e.shipping_gstin = 'Invalid Shipping GSTIN format'
    if (!form.state) e.state = 'State is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    const payload = {
      ...form,
      gstin: form.gstin?.toUpperCase() || '',
      shipping_gstin: form.shipping_gstin?.toUpperCase() || '',
      shipping_state: form.shipping_state || (form.shipping_gstin && form.shipping_gstin.length >= 2 ? getStateByCode(form.shipping_gstin.substring(0, 2)) : '') || form.state || 'Maharashtra',
    }
    const res = editing
      ? await updateCustomer({ ...payload, id: editing.id })
      : await createCustomer(payload)
    setSaving(false)
    if (res.success) setModal(false)
    else setErrors({ _: res.error })
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await deleteCustomer(deleteTarget.id)
    setDeleting(false)
    if (res.success) setDeleteTarget(null)
  }

  const f = (k) => (v) => setForm((p) => ({ ...p, [k]: typeof v === 'string' ? v : v.target.value }))

  const columns = [
    { key: 'name', label: 'Name', render: (v) => <span className="font-medium">{v}</span> },
    { key: 'phone', label: 'Phone' },
    { key: 'gstin', label: 'GSTIN', render: (v) => v || <span className="text-gray-400">—</span> },
    { key: 'state', label: 'State' },
    {
      key: 'customer_type',
      label: 'Type',
      render: (v) => {
        const map = { SUNDRY_DEBTOR: ['blue', 'S.Debtor'], SUNDRY_CREDITOR: ['orange', 'S.Creditor'] }
        const [variant, label] = map[v] || ['gray', v]
        return <Badge variant={variant}>{label}</Badge>
      },
    },
    {
      key: 'id',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => openLedger(row)}
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="View ledger"
          >
            <BookOpen size={15} />
          </button>
          <button
            onClick={() => openEdit(row)}
            className="p-1.5 rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            title="Edit"
          >
            <Edit2 size={15} />
          </button>
          <button
            onClick={() => setDeleteTarget(row)}
            className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Delete"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  const ledgerColumns = [
    { key: 'invoice_number', label: 'Invoice No' },
    { key: 'invoice_date', label: 'Date', render: (v) => formatDate(v) },
    { key: 'grand_total', label: 'Total', render: (v) => formatCurrency(v) },
    { key: 'amount_received', label: 'Received', render: (v) => formatCurrency(v) },
    { key: 'balance_due', label: 'Balance', render: (v) => <span className={parseFloat(v) > 0 ? 'text-red-500 font-medium' : 'text-green-600'}>{formatCurrency(v)}</span> },
    { key: 'payment_status', label: 'Payment', render: (v) => <StatusBadge status={v} /> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
  ]

  return (
    <div className="space-y-4 max-w-[1400px]">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <SearchBar
          placeholder="Search by name, phone, GSTIN..."
          onChange={setSearch}
          className="w-80"
        />
        <Button icon={Plus} onClick={openCreate}>Add Customer</Button>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
        <Table
          columns={columns}
          data={customers}
          loading={loading}
          emptyMessage="No customers yet. Add your first customer!"
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Edit Customer' : 'Add Customer'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? 'Save Changes' : 'Create Customer'}
            </Button>
          </>
        }
      >
        {errors._ && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 text-sm rounded-lg">{errors._}</div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Customer Name" required
            value={form.name}
            onChange={f('name')}
            error={errors.name}
            placeholder="Enter customer / company name"
          />
          <Input
            label="Phone" required
            value={form.phone}
            onChange={f('phone')}
            error={errors.phone}
            placeholder="10-digit mobile"
            maxLength={10}
          />
          <Input
            label="Email"
            value={form.email}
            onChange={f('email')}
            error={errors.email}
            placeholder="email@example.com"
            type="email"
          />
          <Input
            label="GSTIN"
            value={form.gstin}
            onChange={(e) => setForm((p) => ({ ...p, gstin: e.target.value.toUpperCase() }))}
            error={errors.gstin}
            placeholder="22AAAAA0000A1Z5"
            maxLength={15}
          />
          <Select
            label="State" required
            value={form.state}
            onChange={f('state')}
            error={errors.state}
          >
            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Select
            label="Customer Type"
            value={form.customer_type}
            onChange={f('customer_type')}
          >
            <option value="SUNDRY_DEBTOR">Sundry Debtor (Sales Party)</option>
            <option value="SUNDRY_CREDITOR">Sundry Creditor (Purchase Party)</option>
          </Select>
          <Input
            label="Billing Address"
            value={form.billing_address}
            onChange={f('billing_address')}
            placeholder="Street, City"
            containerClassName="col-span-2"
          />
          <Input
            label="Shipping Customer Name"
            value={form.shipping_name}
            onChange={f('shipping_name')}
            placeholder="Enter shipping customer / company name"
            containerClassName="col-span-2"
          />
          <Input
            label="Shipping GSTIN"
            value={form.shipping_gstin}
            onChange={(e) => setForm((p) => ({ ...p, shipping_gstin: e.target.value.toUpperCase() }))}
            error={errors.shipping_gstin}
            placeholder="Enter shipping GSTIN"
            maxLength={15}
            containerClassName="col-span-2"
          />
          <Input
            label="Shipping Address"
            value={form.shipping_address}
            onChange={f('shipping_address')}
            placeholder="Enter shipping address"
            containerClassName="col-span-2"
          />
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Customer"
        message={`Delete "${deleteTarget?.name}"? This action cannot be undone.`}
        loading={deleting}
      />

      {/* Ledger Slide-out */}
      {ledger && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setLedger(null)}>
          <div
            className="w-3/5 bg-white dark:bg-gray-800 h-full flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">{ledger.name}</h2>
                <p className="text-xs text-gray-500">Customer Ledger</p>
              </div>
              <button onClick={() => setLedger(null)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <Table
                columns={ledgerColumns}
                data={ledgerData}
                loading={ledgerLoading}
                emptyMessage="No invoices for this customer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
