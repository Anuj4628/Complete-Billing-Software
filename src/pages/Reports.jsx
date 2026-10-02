import { useEffect, useState } from 'react'
import { Download, FileText, Package, BarChart3 } from 'lucide-react'
import { Table } from '../components/ui/Table.jsx'
import Button from '../components/ui/Button.jsx'
import Badge from '../components/ui/Badge.jsx'
import { formatCurrency, formatDate, todayISO } from '../utils/formatters.js'
import { useSettingsStore } from '../store/useSettingsStore.js'

const TABS = [
  { id: 'sales', label: 'Sales Register', icon: FileText },
  { id: 'gst', label: 'Sales GST Summary', icon: BarChart3 },
  { id: 'purchase', label: 'Purchase Register', icon: Package },
  { id: 'purchase_gst', label: 'Purchase GST Summary', icon: BarChart3 },
  { id: 'stock', label: 'Stock Report', icon: Package },
]

function getFirstDayOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function Reports() {
  const [tab, setTab] = useState('sales')
  const [startDate, setStartDate] = useState(getFirstDayOfMonth())
  const [endDate, setEndDate] = useState(todayISO())
  const [salesData, setSalesData] = useState([])
  const [gstData, setGstData] = useState([])
  const [purchaseData, setPurchaseData] = useState([])
  const [purchaseGstData, setPurchaseGstData] = useState([])
  const [stockData, setStockData] = useState({ products: [], movements: [] })
  const [loading, setLoading] = useState(false)
  const [expandedProduct, setExpandedProduct] = useState(null)
  const { showToast } = useSettingsStore()

  useEffect(() => { fetchData() }, [tab, startDate, endDate])

  async function fetchData() {
    setLoading(true)
    try {
      if (tab === 'sales') {
        const res = await window.api.reports.getSalesRegister({ startDate, endDate })
        if (res.success) setSalesData(res.data)
        else showToast(res.error, 'error')
      } else if (tab === 'gst') {
        const res = await window.api.reports.getGSTSummary({ startDate, endDate })
        if (res.success) setGstData(res.data)
        else showToast(res.error, 'error')
      } else if (tab === 'purchase') {
        const res = await window.api.reports.getPurchaseRegister({ startDate, endDate })
        if (res.success) setPurchaseData(res.data)
        else showToast(res.error, 'error')
      } else if (tab === 'purchase_gst') {
        const res = await window.api.reports.getPurchaseGSTSummary({ startDate, endDate })
        if (res.success) setPurchaseGstData(res.data)
        else showToast(res.error, 'error')
      } else if (tab === 'stock') {
        const res = await window.api.reports.getStockReport()
        if (res.success) setStockData(res.data)
        else showToast(res.error, 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleExportCSV() {
    let rows = []
    let filename = 'report.csv'
    if (tab === 'sales') { rows = salesData; filename = `sales-register-${startDate}-${endDate}.csv` }
    else if (tab === 'gst') { rows = gstData; filename = `sales-gst-summary-${startDate}-${endDate}.csv` }
    else if (tab === 'purchase') { rows = purchaseData; filename = `purchase-register-${startDate}-${endDate}.csv` }
    else if (tab === 'purchase_gst') { rows = purchaseGstData; filename = `purchase-gst-summary-${startDate}-${endDate}.csv` }
    else if (tab === 'stock') { rows = stockData.products; filename = `stock-report-${todayISO()}.csv` }

    if (rows.length === 0) { showToast('No data to export', 'error'); return }
    const res = await window.api.reports.exportCSV({ rows, filename })
    if (res.success) showToast(`Exported to ${res.data}`, 'success')
    else if (res.error !== 'Export cancelled') showToast(res.error, 'error')
  }

  // ── Sales Register columns
  const salesCols = [
    { key: 'invoice_number', label: 'Invoice No', render: (v) => <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{v}</span> },
    { key: 'invoice_date', label: 'Date', render: (v) => formatDate(v) },
    { key: 'customer_name', label: 'Customer' },
    { key: 'customer_gstin', label: 'GSTIN', render: (v) => v || '—' },
    { key: 'supply_type', label: 'Type', render: (v) => <Badge variant={v === 'intra' ? 'indigo' : 'warning'}>{v}</Badge> },
    { key: 'taxable_amount', label: 'Taxable', render: (v) => formatCurrency(v) },
    { key: 'total_cgst', label: 'CGST', render: (v) => formatCurrency(v) },
    { key: 'total_sgst', label: 'SGST', render: (v) => formatCurrency(v) },
    { key: 'total_igst', label: 'IGST', render: (v) => formatCurrency(v) },
    { key: 'grand_total', label: 'Total', render: (v) => <span className="font-semibold">{formatCurrency(v)}</span> },
  ]

  // ── GST Summary columns
  const gstCols = [
    { key: 'hsn_code', label: 'HSN Code', render: (v) => <span className="font-mono">{v}</span> },
    { key: 'description', label: 'Description' },
    { key: 'unit', label: 'UOM' },
    { key: 'total_qty', label: 'Qty', render: (v) => parseFloat(v || 0).toFixed(2) },
    { key: 'taxable_amount', label: 'Taxable', render: (v) => formatCurrency(v) },
    { key: 'total_cgst', label: 'CGST', render: (v) => formatCurrency(v) },
    { key: 'total_sgst', label: 'SGST', render: (v) => formatCurrency(v) },
    { key: 'total_igst', label: 'IGST', render: (v) => formatCurrency(v) },
    { key: 'total_amount', label: 'Total', render: (v) => <span className="font-semibold">{formatCurrency(v)}</span> },
    { key: 'gst_percent', label: 'Rate', render: (v) => `${v}%` },
  ]

  // ── Purchase Register columns
  const purchaseCols = [
    { key: 'bill_number', label: 'Bill No', render: (v) => <span className="font-mono font-semibold text-green-600 dark:text-green-400">{v}</span> },
    { key: 'bill_date', label: 'Date', render: (v) => formatDate(v) },
    { key: 'supplier_name', label: 'Supplier' },
    { key: 'supplier_gstin', label: 'GSTIN', render: (v) => v || '—' },
    { key: 'supply_type', label: 'Type', render: (v) => <Badge variant={v === 'intra' ? 'indigo' : 'warning'}>{v}</Badge> },
    { key: 'taxable_amount', label: 'Taxable', render: (v) => formatCurrency(v) },
    { key: 'total_cgst', label: 'CGST', render: (v) => formatCurrency(v) },
    { key: 'total_sgst', label: 'SGST', render: (v) => formatCurrency(v) },
    { key: 'total_igst', label: 'IGST', render: (v) => formatCurrency(v) },
    { key: 'grand_total', label: 'Total', render: (v) => <span className="font-semibold">{formatCurrency(v)}</span> },
  ]

  // ── Purchase GST Summary columns
  const purchaseGstCols = [
    { key: 'hsn_code', label: 'HSN Code', render: (v) => <span className="font-mono">{v}</span> },
    { key: 'description', label: 'Description' },
    { key: 'unit', label: 'UOM' },
    { key: 'total_qty', label: 'Qty', render: (v) => parseFloat(v || 0).toFixed(2) },
    { key: 'taxable_amount', label: 'Taxable', render: (v) => formatCurrency(v) },
    { key: 'total_cgst', label: 'CGST', render: (v) => formatCurrency(v) },
    { key: 'total_sgst', label: 'SGST', render: (v) => formatCurrency(v) },
    { key: 'total_igst', label: 'IGST', render: (v) => formatCurrency(v) },
    { key: 'total_amount', label: 'Total', render: (v) => <span className="font-semibold">{formatCurrency(v)}</span> },
    { key: 'gst_percent', label: 'Rate', render: (v) => `${v}%` },
  ]

  // ── Stock columns
  const stockCols = [
    { key: 'name', label: 'Product', render: (v) => <span className="font-medium">{v}</span> },
    { key: 'hsn_code', label: 'HSN', render: (v) => <span className="font-mono">{v}</span> },
    { key: 'category_name', label: 'Category', render: (v) => v || '—' },
    { key: 'unit', label: 'Unit' },
    {
      key: 'stock_qty',
      label: 'Current Stock',
      render: (v, row) => (
        <span className={parseFloat(v) <= parseFloat(row.min_stock_level) ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
          {parseFloat(v).toFixed(2)}
        </span>
      ),
    },
    { key: 'min_stock_level', label: 'Min Level', render: (v) => parseFloat(v).toFixed(2) },
    {
      key: 'id',
      label: 'Status',
      render: (_, row) => {
        const qty = parseFloat(row.stock_qty)
        const min = parseFloat(row.min_stock_level)
        if (qty <= 0) return <Badge variant="danger">Out of Stock</Badge>
        if (qty <= min) return <Badge variant="warning">Low Stock</Badge>
        return <Badge variant="success">OK</Badge>
      },
    },
    {
      key: 'id',
      label: 'Movements',
      render: (v) => (
        <button
          onClick={(e) => { e.stopPropagation(); setExpandedProduct(expandedProduct === v ? null : v) }}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {expandedProduct === v ? 'Hide' : 'View'} History
        </button>
      ),
    },
  ]

  // Summary footer for GST
  const gstSummary = gstData.reduce(
    (acc, row) => ({
      taxable: acc.taxable + parseFloat(row.taxable_amount || 0),
      cgst: acc.cgst + parseFloat(row.total_cgst || 0),
      sgst: acc.sgst + parseFloat(row.total_sgst || 0),
      igst: acc.igst + parseFloat(row.total_igst || 0),
      total: acc.total + parseFloat(row.total_amount || 0),
    }),
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }
  )

  const salesSummary = salesData.reduce(
    (acc, row) => ({
      taxable: acc.taxable + parseFloat(row.taxable_amount || 0),
      cgst: acc.cgst + parseFloat(row.total_cgst || 0),
      sgst: acc.sgst + parseFloat(row.total_sgst || 0),
      igst: acc.igst + parseFloat(row.total_igst || 0),
      total: acc.total + parseFloat(row.grand_total || 0),
    }),
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }
  )

  const purchaseSummary = purchaseData.reduce(
    (acc, row) => ({
      taxable: acc.taxable + parseFloat(row.taxable_amount || 0),
      cgst: acc.cgst + parseFloat(row.total_cgst || 0),
      sgst: acc.sgst + parseFloat(row.total_sgst || 0),
      igst: acc.igst + parseFloat(row.total_igst || 0),
      total: acc.total + parseFloat(row.grand_total || 0),
    }),
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }
  )

  const purchaseGstSummary = purchaseGstData.reduce(
    (acc, row) => ({
      taxable: acc.taxable + parseFloat(row.taxable_amount || 0),
      cgst: acc.cgst + parseFloat(row.total_cgst || 0),
      sgst: acc.sgst + parseFloat(row.total_sgst || 0),
      igst: acc.igst + parseFloat(row.total_igst || 0),
      total: acc.total + parseFloat(row.total_amount || 0),
    }),
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }
  )

  return (
    <div className="space-y-4 max-w-[1400px]">
      {/* Tab nav */}
      <div className="flex items-center gap-1 bg-white dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {/* Filters */}
      {!['stock'].includes(tab) && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">From</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">To</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <Button icon={Download} variant="outline" size="sm" onClick={handleExportCSV}>Export CSV</Button>
        </div>
      )}
      {tab === 'stock' && (
        <div className="flex justify-end">
          <Button icon={Download} variant="outline" size="sm" onClick={handleExportCSV}>Export CSV</Button>
        </div>
      )}

      {/* ── SALES REGISTER ── */}
      {tab === 'sales' && (
        <div className="space-y-2">
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
            <Table columns={salesCols} data={salesData} loading={loading} emptyMessage="No sales in this period" />
          </div>
          {salesData.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-indigo-200 dark:border-blue-800 p-4">
              <div className="grid grid-cols-5 gap-4 text-sm">
                <SummaryItem label="Taxable" value={formatCurrency(salesSummary.taxable)} />
                <SummaryItem label="CGST" value={formatCurrency(salesSummary.cgst)} />
                <SummaryItem label="SGST" value={formatCurrency(salesSummary.sgst)} />
                <SummaryItem label="IGST" value={formatCurrency(salesSummary.igst)} />
                <SummaryItem label="Grand Total" value={formatCurrency(salesSummary.total)} bold />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── GST SUMMARY ── */}
      {tab === 'gst' && (
        <div className="space-y-2">
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
            <Table columns={gstCols} data={gstData} loading={loading} emptyMessage="No GST data in this period" />
          </div>
          {gstData.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-indigo-200 dark:border-blue-800 p-4">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase mb-2">Summary</p>
              <div className="grid grid-cols-5 gap-4 text-sm">
                <SummaryItem label="Total Taxable" value={formatCurrency(gstSummary.taxable)} />
                <SummaryItem label="Total CGST" value={formatCurrency(gstSummary.cgst)} />
                <SummaryItem label="Total SGST" value={formatCurrency(gstSummary.sgst)} />
                <SummaryItem label="Total IGST" value={formatCurrency(gstSummary.igst)} />
                <SummaryItem label="Grand Total" value={formatCurrency(gstSummary.total)} bold />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PURCHASE REGISTER ── */}
      {tab === 'purchase' && (
        <div className="space-y-2">
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
            <Table columns={purchaseCols} data={purchaseData} loading={loading} emptyMessage="No purchases in this period" />
          </div>
          {purchaseData.length > 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-4">
              <div className="grid grid-cols-5 gap-4 text-sm">
                <SummaryItem label="Taxable" value={formatCurrency(purchaseSummary.taxable)} />
                <SummaryItem label="CGST" value={formatCurrency(purchaseSummary.cgst)} />
                <SummaryItem label="SGST" value={formatCurrency(purchaseSummary.sgst)} />
                <SummaryItem label="IGST" value={formatCurrency(purchaseSummary.igst)} />
                <SummaryItem label="Grand Total" value={formatCurrency(purchaseSummary.total)} bold />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PURCHASE GST SUMMARY ── */}
      {tab === 'purchase_gst' && (
        <div className="space-y-2">
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
            <Table columns={purchaseGstCols} data={purchaseGstData} loading={loading} emptyMessage="No purchase GST data in this period" />
          </div>
          {purchaseGstData.length > 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-4">
              <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase mb-2">Summary</p>
              <div className="grid grid-cols-5 gap-4 text-sm">
                <SummaryItem label="Total Taxable" value={formatCurrency(purchaseGstSummary.taxable)} />
                <SummaryItem label="Total CGST" value={formatCurrency(purchaseGstSummary.cgst)} />
                <SummaryItem label="Total SGST" value={formatCurrency(purchaseGstSummary.sgst)} />
                <SummaryItem label="Total IGST" value={formatCurrency(purchaseGstSummary.igst)} />
                <SummaryItem label="Grand Total" value={formatCurrency(purchaseGstSummary.total)} bold />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STOCK REPORT ── */}
      {tab === 'stock' && (
        <div className="space-y-1">
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {stockData.products.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">No products found</div>
                ) : (
                  stockData.products.map((product, idx) => {
                    const movements = stockData.movements.filter((m) => m.product_id === product.id)
                    return (
                      <div key={product.id}>
                        <div className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-3 text-sm items-center ${
                          idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-750/50'
                        } border-b border-gray-100 dark:border-gray-700`}>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{product.name}</span>
                          <span className="font-mono text-gray-500 text-xs">{product.hsn_code}</span>
                          <span className="text-gray-500 text-xs">{product.category_name || '—'}</span>
                          <span className="text-gray-500 text-xs">{product.unit}</span>
                          <span className={`font-semibold ${parseFloat(product.stock_qty) <= parseFloat(product.min_stock_level) ? 'text-red-600' : 'text-green-600'}`}>
                            {parseFloat(product.stock_qty).toFixed(2)}
                          </span>
                          <span className="text-gray-500">{parseFloat(product.min_stock_level).toFixed(2)}</span>
                          <span>
                            {parseFloat(product.stock_qty) <= 0
                              ? <Badge variant="danger">Out of Stock</Badge>
                              : parseFloat(product.stock_qty) <= parseFloat(product.min_stock_level)
                              ? <Badge variant="warning">Low Stock</Badge>
                              : <Badge variant="success">OK</Badge>}
                          </span>
                          <button
                            onClick={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline text-left"
                          >
                            {expandedProduct === product.id ? 'Hide' : 'History'}
                            {movements.length > 0 ? ` (${movements.length})` : ''}
                          </button>
                        </div>

                        {expandedProduct === product.id && (
                          <div className="bg-blue-50 dark:bg-blue-900/10 px-8 py-3 border-b border-blue-100 dark:border-blue-800">
                            {movements.length === 0 ? (
                              <p className="text-xs text-gray-400">No movements recorded</p>
                            ) : (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-gray-500 dark:text-gray-400">
                                    <th className="text-left py-1 pr-4">Date</th>
                                    <th className="text-left py-1 pr-4">Type</th>
                                    <th className="text-right py-1 pr-4">Qty</th>
                                    <th className="text-left py-1 pr-4">Reference</th>
                                    <th className="text-left py-1">Notes</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {movements.slice(0, 20).map((m) => (
                                    <tr key={m.id} className="border-t border-blue-100 dark:border-blue-800">
                                      <td className="py-1 pr-4 text-gray-600 dark:text-gray-400">{formatDate(m.created_at)}</td>
                                      <td className="py-1 pr-4">
                                        <Badge variant={
                                          m.movement_type === 'sale' ? 'danger' :
                                          m.movement_type === 'sale_reversal' ? 'success' :
                                          m.movement_type === 'purchase' ? 'success' : 'info'
                                        }>{m.movement_type}</Badge>
                                      </td>
                                      <td className="py-1 pr-4 text-right font-medium">{parseFloat(m.quantity).toFixed(2)}</td>
                                      <td className="py-1 pr-4 text-gray-500">{m.reference_type} {m.reference_id ? `#${m.reference_id}` : ''}</td>
                                      <td className="py-1 text-gray-500">{m.notes}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
                {/* Stock header row */}
                {stockData.products.length > 0 && (
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase border-t border-gray-200 dark:border-gray-700">
                    <span>Product</span><span>HSN</span><span>Category</span><span>Unit</span>
                    <span>Stock</span><span>Min Level</span><span>Status</span><span>Movements</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryItem({ label, value, bold = false }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
      <p className={`${bold ? 'text-base font-bold text-blue-700 dark:text-blue-400' : 'text-sm font-semibold text-gray-800 dark:text-gray-200'}`}>{value}</p>
    </div>
  )
}
