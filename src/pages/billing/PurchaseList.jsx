import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Edit2, ShoppingCart, Eye, Download, MessageCircle, Printer } from 'lucide-react'
import Button from '../../components/ui/Button.jsx'
import { Table, Pagination } from '../../components/ui/Table.jsx'
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx'
import { formatCurrency, formatDate } from '../../utils/formatters.js'
import { useSettingsStore } from '../../store/useSettingsStore.js'
import { prepareForWhatsApp } from '../../utils/pdfGenerator.jsx'
import WhatsAppModal from '../../components/ui/WhatsAppModal.jsx'

export default function PurchaseList() {
  const navigate = useNavigate()
  const { showToast, settings } = useSettingsStore()
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(null)
  const [waModal, setWaModal] = useState(null)
  const limit = 20

  useEffect(() => { fetchData() }, [page])

  async function fetchData() {
    setLoading(true)
    const res = await window.api.purchases.getAll({ page, limit })
    if (res.success) { setData(res.data); setTotal(res.total) }
    setLoading(false)
  }

  async function handleDelete() {
    const res = await window.api.purchases.delete(deleteTarget.id)
    setDeleteTarget(null)
    if (res.success) { showToast('Deleted', 'success'); fetchData() }
    else showToast(res.error, 'error')
  }

  // ── Download PDF via native save dialog ──
  async function handleDownloadPDF(purchaseId) {
    setPdfLoading(purchaseId)
    try {
      const res = await window.api.purchases.getById(purchaseId)
      if (!res.success) { showToast('Purchase not found', 'error'); return }
      const p = res.data

      const { pdf } = await import('@react-pdf/renderer')
      const { PurchasePDF } = await import('../../utils/pdfTemplate.jsx')
      const blob = await pdf(<PurchasePDF purchase={p} settings={settings} />).toBlob()
      const arrayBuffer = await blob.arrayBuffer()
      const buffer = Array.from(new Uint8Array(arrayBuffer))
      const defaultName = `Purchase-${p.bill_number || p.id}.pdf`
      const saveRes = await window.api.pdf.save({ buffer, defaultName })
      if (saveRes?.success) showToast('PDF saved!', 'success')
      else if (saveRes && !saveRes.canceled) showToast('PDF save failed: ' + (saveRes.error || ''), 'error')
    } catch (e) {
      console.error('PDF error:', e)
      showToast('Failed to generate PDF: ' + (e?.message || 'Unknown error'), 'error')
    } finally {
      setPdfLoading(null)
    }
  }

  // ── Print ──
  async function handlePrint(purchaseId) {
    setPdfLoading(purchaseId + '_p')
    try {
      const res = await window.api.purchases.getById(purchaseId)
      if (!res.success) { showToast('Purchase not found', 'error'); return }
      const p = res.data

      const { pdf } = await import('@react-pdf/renderer')
      const { PurchasePDF } = await import('../../utils/pdfTemplate.jsx')
      const blob = await pdf(<PurchasePDF purchase={p} settings={settings} />).toBlob()
      const url = URL.createObjectURL(blob)
      const w = window.open(url)
      if (w) w.addEventListener('load', () => { w.print(); URL.revokeObjectURL(url) })
    } catch (e) {
      console.error('Print error:', e)
      showToast('Failed to print: ' + (e?.message || 'Unknown error'), 'error')
    } finally {
      setPdfLoading(null)
    }
  }

  // ── WhatsApp: save PDF silently, then show step-by-step modal ──
  async function handleSendWhatsApp(row) {
    if (!row.supplier_phone) {
      showToast('Supplier phone number is missing!', 'error')
      return
    }
    setPdfLoading(row.id + '_wa')
    try {
      const res = await window.api.purchases.getById(row.id)
      if (!res.success || !res.data) { showToast('Could not load purchase', 'error'); return }
      const p = res.data

      const result = await prepareForWhatsApp(res.data, settings, 'purchase')
      setWaModal(result)
      showToast('PDF saved to Downloads!', 'success')
      
      if (result.waUrl) {
        window.open(result.waUrl, '_blank')
      }
    } catch (e) {
      console.error('WhatsApp error:', e)
      showToast('Error: ' + (e?.message || 'Unknown error'), 'error')
    } finally {
      setPdfLoading(null)
    }
  }

  const columns = [
    { key: 'bill_number', label: 'Bill No', render: v => <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">{v || '-'}</span> },
    { key: 'bill_date', label: 'Date', render: v => formatDate(v) },
    { key: 'supplier_name', label: 'Supplier' },
    { key: 'grand_total', label: 'Total', render: v => formatCurrency(v) },
    { key: 'payment_status', label: 'Payment', render: v => (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${v === 'paid' ? 'bg-green-100 text-green-700' : v === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{v}</span>
    )},
    { key: 'id', label: '', render: (v, row) => (
      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => navigate(`/purchases/${v}`)} className="p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="View"><Eye size={14} /></button>
        <button onClick={() => navigate(`/purchases/${v}/edit`)} className="p-1.5 rounded text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors" title="Edit"><Edit2 size={14} /></button>
        
        <button 
          onClick={() => handlePrint(v)} 
          disabled={pdfLoading === v + '_p'} 
          className="p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" 
          title="Print"
        >
          {pdfLoading === v + '_p' ? <div className="w-3.5 h-3.5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" /> : <Printer size={14} />}
        </button>

        <button 
          onClick={() => handleDownloadPDF(v)} 
          disabled={pdfLoading === v} 
          className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors" 
          title="Download PDF"
        >
          {pdfLoading === v ? <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" /> : <Download size={14} />}
        </button>

        <button 
          onClick={() => handleSendWhatsApp(row)} 
          disabled={pdfLoading === row.id + '_wa'} 
          className="p-1.5 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors" 
          title="WhatsApp PDF"
        >
          {pdfLoading === row.id + '_wa' ? <div className="w-3.5 h-3.5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" /> : <MessageCircle size={14} />}
        </button>

        <button onClick={() => setDeleteTarget(row)} className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete"><Trash2 size={14} /></button>
      </div>
    )},
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShoppingCart size={22} className="text-indigo-600" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Purchase Invoices</h2>
        </div>
        <Button icon={Plus} onClick={() => navigate('/purchases/new')}>New Purchase</Button>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <Table
          columns={columns}
          data={data}
          loading={loading}
          emptyMessage="No purchase invoices yet"
          onRowClick={(row) => navigate(`/purchases/${row.id}`)}
        />
        <Pagination page={page} total={total} limit={limit} onPageChange={setPage} />
      </div>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Purchase Invoice" message={`Delete bill "${deleteTarget?.bill_number}"? Stock will be reversed.`} />
      
      <WhatsAppModal
        open={!!waModal}
        onClose={() => setWaModal(null)}
        filePath={waModal?.filePath}
        waUrl={waModal?.waUrl}
        fileName={waModal?.fileName}
      />
    </div>
  )
}
