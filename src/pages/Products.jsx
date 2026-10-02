import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, Package, AlertTriangle, ArrowUpDown } from 'lucide-react'
import { useProductStore } from '../store/useProductStore.js'
import { Table, Pagination } from '../components/ui/Table.jsx'
import SearchBar from '../components/ui/SearchBar.jsx'
import Button from '../components/ui/Button.jsx'
import Modal from '../components/ui/Modal.jsx'
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx'
import Input, { Select, Textarea } from '../components/ui/Input.jsx'
import Badge from '../components/ui/Badge.jsx'
import { formatCurrency } from '../utils/formatters.js'
import { GST_RATES, UNITS } from '../utils/gstHelpers.js'

const EMPTY = {
  name: '', hsn_code: '', category_id: '',
  unit: 'pcs', purchase_price: '', selling_price: '',
  gst_percent: '18', stock_qty: '0', min_stock_level: '5', description: '',
}

const ADJ_EMPTY = { quantity: '', movement_type: 'purchase', notes: '' }

function stockVariant(qty, min) {
  const q = parseFloat(qty), m = parseFloat(min)
  if (q <= 0) return 'danger'
  if (q <= m) return 'warning'
  return 'success'
}

function stockLabel(qty, min) {
  const q = parseFloat(qty), m = parseFloat(min)
  if (q <= 0) return 'Out of Stock'
  if (q <= m) return 'Low Stock'
  return 'In Stock'
}

export default function Products() {
  const {
    products, total, page, limit, loading, categories,
    fetchProducts, fetchCategories, setSearch, setPage, setLowStockOnly, lowStockOnly,
    createProduct, updateProduct, deleteProduct, adjustStock,
  } = useProductStore()

  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [adjModal, setAdjModal] = useState(null)
  const [adjForm, setAdjForm] = useState(ADJ_EMPTY)
  const [adjSaving, setAdjSaving] = useState(false)

  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErrors({})
    setModal(true)
  }

  function openEdit(p) {
    setEditing(p)
    setForm({
      name: p.name, hsn_code: p.hsn_code, category_id: p.category_id || '',
      unit: p.unit, purchase_price: String(p.purchase_price),
      selling_price: String(p.selling_price), gst_percent: String(p.gst_percent),
      stock_qty: String(p.stock_qty), min_stock_level: String(p.min_stock_level),
      description: p.description || '',
    })
    setErrors({})
    setModal(true)
  }

  function validate() {
    const e = {}
    if (!form.name?.trim()) e.name = 'Name is required'
    if (!form.hsn_code || !/^\d{4,8}$/.test(form.hsn_code.trim())) e.hsn_code = 'HSN must be 4-8 digits'
    if (!form.selling_price || parseFloat(form.selling_price) <= 0) e.selling_price = 'Must be greater than 0'
    if (!GST_RATES.includes(parseFloat(form.gst_percent))) e.gst_percent = 'Must be 0, 5, 12, 18 or 28'
    if (parseFloat(form.stock_qty || 0) < 0) e.stock_qty = 'Cannot be negative'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    const payload = {
      ...form,
      category_id: form.category_id ? parseInt(form.category_id) : null,
      purchase_price: parseFloat(form.purchase_price || 0),
      selling_price: parseFloat(form.selling_price),
      gst_percent: parseFloat(form.gst_percent),
      stock_qty: parseFloat(form.stock_qty || 0),
      min_stock_level: parseFloat(form.min_stock_level || 5),
    }
    const res = editing
      ? await updateProduct({ ...payload, id: editing.id })
      : await createProduct(payload)
    setSaving(false)
    if (res.success) setModal(false)
    else setErrors({ _: res.error })
  }

  async function handleAdjust() {
    if (!adjForm.quantity) return
    setAdjSaving(true)
    const res = await adjustStock({
      product_id: adjModal.id,
      quantity: parseFloat(adjForm.quantity),
      movement_type: adjForm.movement_type,
      notes: adjForm.notes,
    })
    setAdjSaving(false)
    if (res.success) setAdjModal(null)
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await deleteProduct(deleteTarget.id)
    setDeleting(false)
    if (res.success) setDeleteTarget(null)
  }

  const f = (k) => (v) => setForm((p) => ({ ...p, [k]: typeof v === 'string' ? v : v.target.value }))

  const columns = [
    { key: 'name', label: 'Product', render: (v) => <span className="font-medium">{v}</span> },
    { key: 'hsn_code', label: 'HSN' },
    { key: 'category_name', label: 'Category', render: (v) => v || '—' },
    { key: 'selling_price', label: 'Price', render: (v) => formatCurrency(v) },
    { key: 'gst_percent', label: 'GST%', render: (v) => `${v}%` },
    {
      key: 'stock_qty',
      label: 'Stock',
      render: (v, row) => (
        <div className="flex items-center gap-2">
          <span>{v}</span>
          <Badge variant={stockVariant(v, row.min_stock_level)}>
            {stockLabel(v, row.min_stock_level)}
          </Badge>
        </div>
      ),
    },
    { key: 'min_stock_level', label: 'Min Level' },
    {
      key: 'id',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => { setAdjModal(row); setAdjForm(ADJ_EMPTY) }}
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Adjust stock"
          >
            <ArrowUpDown size={15} />
          </button>
          <button
            onClick={() => openEdit(row)}
            className="p-1.5 rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
            title="Edit"
          >
            <Edit2 size={15} />
          </button>
          <button
            onClick={() => setDeleteTarget(row)}
            className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            title="Delete"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4 max-w-[1400px]">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <SearchBar
            placeholder="Search by name or HSN..."
            onChange={setSearch}
            className="w-72"
          />
          <button
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${
              lowStockOnly
                ? 'bg-red-50 border-red-300 text-red-700 dark:bg-red-900/20 dark:border-red-700 dark:text-red-400'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <AlertTriangle size={14} />
            Low Stock
          </button>
        </div>
        <Button icon={Plus} onClick={openCreate}>Add Product</Button>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
        <Table
          columns={columns}
          data={products}
          loading={loading}
          emptyMessage="No products yet. Add your first product!"
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Edit Product' : 'Add Product'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? 'Save Changes' : 'Create Product'}
            </Button>
          </>
        }
      >
        {errors._ && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 text-sm rounded-lg">{errors._}</div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Product Name" required value={form.name} onChange={f('name')} error={errors.name} containerClassName="col-span-2" />
          <Input label="HSN Code" required value={form.hsn_code} onChange={f('hsn_code')} error={errors.hsn_code} placeholder="4-8 digits" maxLength={8} />
          <Select label="Category" value={form.category_id} onChange={f('category_id')}>
            <option value="">— Select Category —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select label="Unit" value={form.unit} onChange={f('unit')}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
          <Select label="GST Rate" required value={form.gst_percent} onChange={f('gst_percent')} error={errors.gst_percent}>
            {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
          </Select>
          <Input label="Purchase Price" value={form.purchase_price} onChange={f('purchase_price')} type="number" min="0" step="0.01" prefix="₹" />
          <Input label="Selling Price" required value={form.selling_price} onChange={f('selling_price')} error={errors.selling_price} type="number" min="0.01" step="0.01" prefix="₹" />
          <Input label="Opening Stock" value={form.stock_qty} onChange={f('stock_qty')} error={errors.stock_qty} type="number" min="0" />
          <Input label="Min Stock Level" value={form.min_stock_level} onChange={f('min_stock_level')} type="number" min="0" />
          <Textarea label="Description" value={form.description} onChange={f('description')} rows={2} containerClassName="col-span-2" />
        </div>
      </Modal>

      {/* Stock Adjust Modal */}
      <Modal
        open={!!adjModal}
        onClose={() => setAdjModal(null)}
        title={`Adjust Stock — ${adjModal?.name}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdjModal(null)}>Cancel</Button>
            <Button onClick={handleAdjust} loading={adjSaving}>Apply Adjustment</Button>
          </>
        }
      >
        {adjModal && (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Current Stock: <span className="font-bold">{adjModal.stock_qty} {adjModal.unit}</span>
              </p>
            </div>
            <Select
              label="Movement Type"
              value={adjForm.movement_type}
              onChange={(e) => setAdjForm((p) => ({ ...p, movement_type: e.target.value }))}
            >
              <option value="purchase">Purchase (Add Stock)</option>
              <option value="adjustment">Manual Adjustment</option>
            </Select>
            <Input
              label="Quantity"
              required
              type="number"
              step="0.01"
              value={adjForm.quantity}
              onChange={(e) => setAdjForm((p) => ({ ...p, quantity: e.target.value }))}
              hint="Use negative value to reduce stock"
            />
            <Input
              label="Notes / Reason"
              value={adjForm.notes}
              onChange={(e) => setAdjForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Reason for adjustment"
            />
          </div>
        )}
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Product"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        loading={deleting}
      />
    </div>
  )
}
