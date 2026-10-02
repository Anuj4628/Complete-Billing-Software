import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, FileText, Download, Printer, Search, Edit2, Eye } from 'lucide-react'
import Button from '../components/ui/Button.jsx'
import { Table, Pagination } from '../components/ui/Table.jsx'
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx'
import { formatCurrency, formatDate } from '../utils/formatters.js'
import { useSettingsStore } from '../store/useSettingsStore.js'
import { useQuotationStore } from '../store/useQuotationStore.js'
import { downloadPDF, generatePDFBlob } from '../utils/pdfGenerator.jsx'

export default function Quotation() {
  const navigate = useNavigate()
  const { showToast, settings, loadSettings } = useSettingsStore()
  const { quotations, total, page, limit, loading, setPage, setFilters, fetchQuotations, deleteQuotation } = useQuotationStore()

  const [pdfLoading, setPdfLoading] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    loadSettings()
    fetchQuotations()
  }, [])

  function handleSearch(e) {
    e.preventDefault()
    setFilters({ search: searchTerm, status: statusFilter === 'all' ? '' : statusFilter })
  }

  function handleStatusChange(status) {
    setStatusFilter(status)
    setFilters({ search: searchTerm, status: status === 'all' ? '' : status })
  }

  async function handleDownloadPDF(quotationId, quotationData) {
    setPdfLoading(quotationId)
    try {
      let data = quotationData
      if (!data.items) {
        const res = await window.api.quotations.getById(quotationId)
        if (res.success) data = res.data
        else throw new Error(res.error || 'Failed to load quotation')
      }
      await downloadPDF(data, settings, 'quotation')
      showToast('Quotation PDF downloaded!', 'success')
    } catch (e) {
      showToast('Failed to generate PDF: ' + (e?.message || 'Unknown error'), 'error')
    } finally {
      setPdfLoading(null)
    }
  }

  async function handlePrint(quotationId, quotationData) {
    setPdfLoading(quotationId + '_p')
    try {
      let data = quotationData
      if (!data.items) {
        const res = await window.api.quotations.getById(quotationId)
        if (res.success) data = res.data
        else throw new Error(res.error || 'Failed to load quotation')
      }
      const blob = await generatePDFBlob(data, settings, 'quotation')
      if (window.api?.pdf?.print) {
        const arrayBuffer = await blob.arrayBuffer()
        const res = await window.api.pdf.print({ buffer: Array.from(new Uint8Array(arrayBuffer)) })
        if (!res.success) throw new Error(res.error)
      } else {
        const url = URL.createObjectURL(blob)
        const w = window.open(url)
        if (w) {
          w.addEventListener('load', () => {
            w.print()
            URL.revokeObjectURL(url)
          })
        }
      }
    } catch (e) {
      showToast('Failed to print: ' + (e?.message || 'Unknown error'), 'error')
    } finally {
      setPdfLoading(null)
    }
  }

  const columns = [
    {
      key: 'quotation_number',
      label: 'Quotation No',
      render: (v, row) => (
        <span
          className="font-mono text-red-600 dark:text-red-400 font-bold hover:underline cursor-pointer"
          onClick={() => navigate(`/quotations/${row.id}`)}
        >
          {v}
        </span>
      ),
    },
    {
      key: 'quotation_date',
      label: 'Date',
      render: v => formatDate(v),
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: (v, row) => (
        <div>
          <div className="font-semibold text-gray-900 dark:text-gray-100">{v}</div>
          {row.customer_phone_orig && (
            <div className="text-[11px] text-gray-400">{row.customer_phone_orig}</div>
          )}
        </div>
      ),
    },
    {
      key: 'grand_total',
      label: 'Amount',
      render: v => (
        <span className="font-mono font-bold text-gray-900 dark:text-gray-100">
          {formatCurrency(v, '₹')}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: v => {
        const s = v || 'Draft'
        let colorClasses = 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
        if (s.toLowerCase() === 'accepted') colorClasses = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
        if (s.toLowerCase() === 'sent') colorClasses = 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
        if (s.toLowerCase() === 'rejected') colorClasses = 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'
        if (s.toLowerCase() === 'expired') colorClasses = 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
        return (
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${colorClasses}`}>
            {s}
          </span>
        )
      },
    },
    {
      key: 'id',
      label: 'Actions',
      render: (v, row) => (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => navigate(`/quotations/${v}`)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="View Quotation"
          >
            <Eye size={15} />
          </button>
          <button
            onClick={() => navigate(`/quotations/${v}/edit`)}
            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            title="Edit Quotation"
          >
            <Edit2 size={15} />
          </button>
          <button
            onClick={() => handlePrint(v, row)}
            disabled={pdfLoading === v + '_p'}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Print"
          >
            {pdfLoading === v + '_p' ? (
              <div className="w-3.5 h-3.5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Printer size={15} />
            )}
          </button>
          <button
            onClick={() => handleDownloadPDF(v, row)}
            disabled={pdfLoading === v}
            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
            title="Download PDF"
          >
            {pdfLoading === v ? (
              <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download size={15} />
            )}
          </button>
          <button
            onClick={() => setDeleteTarget(row)}
            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Delete"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {/* ── HEADER ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600">
            <FileText size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Quotations</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Manage, prepare, and track industrial client quotations
            </p>
          </div>
        </div>

        <Button icon={Plus} variant="primary" onClick={() => navigate('/quotations/new')}>
          New Quotation
        </Button>
      </div>

      {/* ── SEARCH & FILTER BAR ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search size={15} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search by Quotation No, Customer, RFQ..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-750 text-gray-900 dark:text-gray-100 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">Search</Button>
        </form>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">Status:</span>
          <select
            className="text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-750 px-2.5 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
            value={statusFilter}
            onChange={e => handleStatusChange(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Sent">Sent</option>
            <option value="Accepted">Accepted</option>
            <option value="Rejected">Rejected</option>
            <option value="Expired">Expired</option>
          </select>
        </div>
      </div>

      {/* ── TABLE LISTING ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <Table
          columns={columns}
          data={quotations}
          loading={loading}
          emptyMessage="No quotations yet. Click 'New Quotation' to create one."
          onRowClick={row => navigate(`/quotations/${row.id}`)}
        />
        <Pagination page={page} total={total} limit={limit} onPageChange={setPage} />
      </div>

      {/* ── DELETE CONFIRMATION DIALOG ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteQuotation(deleteTarget.id)
            setDeleteTarget(null)
          }
        }}
        title="Delete Quotation"
        message={`Are you sure you want to delete quotation ${deleteTarget?.quotation_number}? This action cannot be undone.`}
      />
    </div>
  )
}
