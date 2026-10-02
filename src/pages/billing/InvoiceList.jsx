import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Edit2, Trash2, Download, Plus, Filter, X, FileText, MessageCircle } from 'lucide-react'
import { useInvoiceStore } from '../../store/useInvoiceStore.js'
import { Table, Pagination } from '../../components/ui/Table.jsx'
import Button from '../../components/ui/Button.jsx'
import SearchBar from '../../components/ui/SearchBar.jsx'
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx'
import { StatusBadge } from '../../components/ui/Badge.jsx'
import { formatCurrency, formatDate } from '../../utils/formatters.js'
import { useSettingsStore } from '../../store/useSettingsStore.js'
import { downloadPDF, prepareForWhatsApp } from '../../utils/pdfGenerator.jsx'
import WhatsAppModal from '../../components/ui/WhatsAppModal.jsx'

export default function InvoiceList() {
  const navigate = useNavigate()
  const { invoices, total, page, limit, loading, fetchInvoices, setFilters, setPage, deleteInvoice } = useInvoiceStore()
  const { settings, loadSettings, showToast } = useSettingsStore()

  const [startDate, setStartDate]       = useState('')
  const [endDate, setEndDate]           = useState('')
  const [status, setStatus]             = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [search, setSearch]             = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]         = useState(false)
  const [pdfLoading, setPdfLoading]     = useState(null)
  const [waModal, setWaModal]           = useState(null)

  useEffect(() => { fetchInvoices(); loadSettings() }, [])

  function applyFilters() {
    setFilters({ startDate, endDate, status, payment_status: paymentStatus, search })
  }

  function clearFilters() {
    setStartDate(''); setEndDate(''); setStatus(''); setPaymentStatus(''); setSearch('')
    setFilters({})
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await deleteInvoice(deleteTarget.id)
    setDeleting(false)
    if (res.success) setDeleteTarget(null)
  }

  async function handleDownloadPDF(invoiceId) {
    setPdfLoading(invoiceId)
    try {
      const res = await window.api.invoices.getById(invoiceId)
      if (!res.success || !res.data) { showToast('Could not load invoice', 'error'); return }
      await downloadPDF(res.data, settings)
    } catch (e) {
      showToast('PDF error: ' + (e?.message || 'Unknown error'), 'error')
    } finally { setPdfLoading(null) }
  }

  async function handleSendWhatsApp(row) {
    if (!row.customer_phone) {
      showToast('Customer phone number is missing!', 'error')
      return
    }
    setPdfLoading(row.id)
    try {
      const res = await window.api.invoices.getById(row.id)
      if (!res.success || !res.data) { showToast('Could not load invoice', 'error'); return }
      const result = await prepareForWhatsApp(res.data, settings)
      setWaModal(result)
      showToast('PDF saved to Downloads!', 'success')
      
      // Accuracy/Speed fix: Automatically open WhatsApp chat after PDF is ready
      if (result.waUrl) {
        window.open(result.waUrl, '_blank')
      }
    } catch (e) {
      showToast('Error: ' + (e?.message || 'Unknown error'), 'error')
    } finally { setPdfLoading(null) }
  }

  const inputCls = "px-3 py-2 text-[13px] rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent border-slate-200 dark:border-white/10 bg-white dark:bg-white/5"

  const columns = [
    {
      key: 'invoice_number', label: 'Invoice No',
      render: (v) => <span className="font-mono text-[12px] font-bold text-blue-600 dark:text-blue-400">{v}</span>,
    },
    { key: 'invoice_date', label: 'Date', render: (v) => <span className="text-[12px]">{formatDate(v)}</span> },
    { key: 'customer_name', label: 'Customer' },
    { key: 'taxable_amount', label: 'Taxable', render: (v) => formatCurrency(v) },
    { key: 'total_tax', label: 'Tax', render: (v) => formatCurrency(v) },
    {
      key: 'grand_total', label: 'Total',
      render: (v) => <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(v)}</span>,
    },
    { key: 'payment_status', label: 'Payment', render: (v) => <StatusBadge status={v} /> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'id', label: '',
      render: (v, row) => (
        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => navigate(`/invoices/${v}`)}
            className="p-1.5 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-white/8"
            style={{ color: 'var(--text-muted)' }} title="View">
            <Eye size={14} />
          </button>
          <button onClick={() => navigate(`/invoices/${v}/edit`)}
            className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" title="Edit">
            <Edit2 size={14} />
          </button>
          <button onClick={() => handleDownloadPDF(v)} disabled={pdfLoading === v}
            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-40" title="Download PDF">
            {pdfLoading === v
              ? <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              : <Download size={14} />}
          </button>
          <button onClick={() => handleSendWhatsApp(row)}
            className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors" title="Send on WhatsApp">
            <MessageCircle size={14} />
          </button>
          <button onClick={() => setDeleteTarget(row)}
            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4 max-w-[1400px]">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between gap-3 flex-wrap p-4 rounded-xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <SearchBar placeholder="Invoice no, customer..." onChange={(v) => setSearch(v)} className="w-52" />
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className={inputCls} style={{ color: 'var(--text-primary)' }} />
          <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>to</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className={inputCls} style={{ color: 'var(--text-primary)' }} />
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className={inputCls} style={{ color: 'var(--text-primary)' }}>
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="final">Final</option>
          </select>
          <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}
            className={inputCls} style={{ color: 'var(--text-primary)' }}>
            <option value="">All Payments</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
          </select>
          <Button icon={Filter} size="sm" onClick={applyFilters}>Apply</Button>
          {(startDate || endDate || status || paymentStatus || search) && (
            <button onClick={clearFilters}
              className="flex items-center gap-1 text-[12px] font-medium text-red-500 hover:text-red-600 transition-colors">
              <X size={12} /> Clear
            </button>
          )}
        </div>
        <Button icon={Plus} onClick={() => navigate('/invoices/new')}>New Invoice</Button>
      </div>

      {/* Table card */}
      <div className="rounded-xl overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <FileText size={15} style={{ color: 'var(--text-muted)' }} />
            <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              All Invoices
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
              {total}
            </span>
          </div>
        </div>
        <Table
          columns={columns}
          data={invoices}
          loading={loading}
          emptyMessage="No invoices found. Create your first invoice!"
          onRowClick={(row) => navigate(`/invoices/${row.id}`)}
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </div>

      <WhatsAppModal
        open={!!waModal}
        onClose={() => setWaModal(null)}
        filePath={waModal?.filePath}
        waUrl={waModal?.waUrl}
        fileName={waModal?.fileName}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Invoice"
        message={`Delete invoice "${deleteTarget?.invoice_number}"? Stock will be restored for finalized invoices.`}
        loading={deleting}
      />
    </div>
  )
}
