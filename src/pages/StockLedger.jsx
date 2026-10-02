import { useEffect, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { Download, Package, Search, ChevronDown, TrendingUp, TrendingDown, Layers } from 'lucide-react'
import { formatDate, todayISO } from '../utils/formatters.js'
import { useSettingsStore } from '../store/useSettingsStore.js'

function getFirstDayOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function StockLedger() {
  const { showToast, loadSettings } = useSettingsStore()
  const location = useLocation()
  const [products, setProducts]       = useState([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [selectedId, setSelectedId]   = useState('')
  const [searchTerm, setSearchTerm]   = useState('')
  const [dropOpen, setDropOpen]       = useState(false)
  const [startDate, setStartDate]     = useState(getFirstDayOfMonth())
  const [endDate, setEndDate]         = useState(todayISO())
  const [ledgerData, setLedgerData]   = useState(null)
  const [loading, setLoading]         = useState(false)

  async function loadProducts() {
    setProductsLoading(true)
    try {
      // Primary: products:getAll — the battle-tested IPC used by all other pages
      const res = await window.api.products.getAll({ limit: 9999, page: 1 })
      if (res.success && res.data && res.data.length > 0) {
        setProducts(res.data)
        return
      }
      // Fallback: dedicated ledger handler
      const r2 = await window.api.reports.getAllProductsForLedger()
      if (r2.success && r2.data) {
        setProducts(r2.data)
        return
      }
      setProducts([])
    } catch (e) {
      // Last resort fallback
      try {
        const r2 = await window.api.reports.getAllProductsForLedger()
        if (r2.success && r2.data) setProducts(r2.data)
        else setProducts([])
      } catch { setProducts([]) }
    } finally {
      setProductsLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
    loadProducts().then(() => {
      const params = new URLSearchParams(location.search)
      const qid = params.get('id')
      if (qid) setSelectedId(qid)
    })
  }, [])

  const fetchLedger = useCallback(async () => {
    if (!selectedId) return
    setLoading(true)
    try {
      const res = await window.api.reports.getStockLedger({
        product_id: parseInt(selectedId),
        startDate,
        endDate,
      })
      if (res.success) setLedgerData(res.data)
      else showToast(res.error, 'error')
    } finally { setLoading(false) }
  }, [selectedId, startDate, endDate])

  useEffect(() => { fetchLedger() }, [fetchLedger])

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.hsn_code || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedProduct = products.find(p => p.id === parseInt(selectedId))

  async function handleExportCSV() {
    if (!ledgerData || !ledgerData.ledger.length) { showToast('No data to export', 'error'); return }
    const rows = [
      { Date: 'OPENING STOCK', Type: '', In: '', Out: '', Balance: ledgerData.opening_stock.toFixed(2), Reference: '', Notes: '' },
      ...ledgerData.ledger.map(e => ({
        Date: formatDate(e.created_at),
        Type: e.type_label,
        In: parseFloat(e.qty_in || 0) > 0 ? parseFloat(e.qty_in).toFixed(2) : '',
        Out: parseFloat(e.qty_out || 0) > 0 ? parseFloat(e.qty_out).toFixed(2) : '',
        Balance: parseFloat(e.running_balance || 0).toFixed(2),
        Reference: `${e.reference_type || ''} ${e.reference_id ? '#' + e.reference_id : ''}`.trim(),
        Notes: e.notes || '',
      })),
      { Date: 'CLOSING STOCK', Type: '', In: ledgerData.total_in.toFixed(2), Out: ledgerData.total_out.toFixed(2), Balance: ledgerData.closing_stock.toFixed(2), Reference: '', Notes: '' },
    ]
    const res = await window.api.reports.exportCSV({ rows, filename: `stock-ledger-${selectedProduct?.name || ''}-${startDate}-${endDate}.csv` })
    if (res.success) showToast(`Exported to ${res.data}`, 'success')
    else if (res.error !== 'Export cancelled') showToast(res.error, 'error')
  }

  const typeColor = (type) => {
    if (type === 'Sales') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    if (type === 'Purchase') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    if (type === 'Opening Stock') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    if (type === 'Sale Reversal') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    if (type === 'Adjustment') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  }

  const unit = ledgerData?.product?.unit || ''
  const totalPurchase  = ledgerData ? parseFloat(ledgerData.total_in  || 0) : 0
  const totalSales     = ledgerData ? parseFloat(ledgerData.total_out || 0) : 0
  const presentStock   = ledgerData ? parseFloat(ledgerData.closing_stock || 0) : 0
  const minLevel       = ledgerData ? parseFloat(ledgerData.product?.min_stock_level || 5) : 5
  const isLow          = presentStock <= minLevel

  return (
    <div className="space-y-4 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <Package size={18} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Stock Ledger</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Purchase Qty − Sales Qty = Present Stock</p>
          </div>
        </div>
        {ledgerData && (
          <button onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
            <Download size={14} /> Export CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-xl p-4 flex flex-wrap items-end gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex-1 min-w-[220px] relative">
          <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Product / Item</label>
          <div
            className="flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer text-sm"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            onClick={() => { if (!productsLoading) setDropOpen(o => !o) }}
          >
            <span className={selectedProduct ? '' : 'opacity-40'}>
              {productsLoading ? 'Loading products...' : selectedProduct ? selectedProduct.name : 'Select a product...'}
            </span>
            {productsLoading
              ? <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
            }
          </div>
          {dropOpen && (
            <div className="absolute z-30 w-full mt-1 rounded-xl shadow-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                  <Search size={13} style={{ color: 'var(--text-muted)' }} />
                  <input autoFocus value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search product..." className="flex-1 bg-transparent text-sm outline-none"
                    style={{ color: 'var(--text-primary)' }} />
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto">
                {filteredProducts.map(p => (
                  <button key={p.id} onClick={() => { setSelectedId(String(p.id)); setDropOpen(false); setSearchTerm('') }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors flex items-center justify-between">
                    <div>
                      <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</div>
                      <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>HSN: {p.hsn_code} · {p.unit}</div>
                    </div>
                    <span className={`text-xs font-semibold ${parseFloat(p.stock_qty) <= 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                      {parseFloat(p.stock_qty).toFixed(2)} {p.unit}
                    </span>
                  </button>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="py-6 text-center">
                    <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
                      {searchTerm ? 'No products match your search' : 'No products found'}
                    </p>
                    {!searchTerm && (
                      <button
                        onClick={(e) => { e.stopPropagation(); loadProducts() }}
                        className="text-xs font-medium text-emerald-600 hover:text-emerald-700 underline"
                      >
                        Tap to retry loading
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-muted)' }}>From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-muted)' }}>To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
      </div>

      {/* No selection */}
      {!selectedId && (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <Package size={40} className="text-emerald-300 mb-3" />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Select a product to view its stock ledger</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Choose any product from the dropdown above</p>
        </div>
      )}

      {selectedId && loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {selectedId && !loading && ledgerData && (
        <>
          {/* ── Stock Summary Formula Card ── */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <Layers size={15} style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Stock Summary — {ledgerData.product.name}
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                {ledgerData.product.hsn_code}
              </span>
            </div>
            <div className="p-5">
              {/* Formula display */}
              <div className="flex items-center justify-center gap-3 flex-wrap">
                {/* Purchase Qty */}
                <div className="flex flex-col items-center rounded-xl px-8 py-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <TrendingUp size={20} className="text-green-600 mb-1" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400 mb-1">Total Purchase</span>
                  <span className="text-2xl font-bold text-green-600">{totalPurchase.toFixed(2)}</span>
                  <span className="text-xs text-green-600 dark:text-green-400">{unit}</span>
                </div>

                <span className="text-2xl font-bold" style={{ color: 'var(--text-muted)' }}>−</span>

                {/* Sales Qty */}
                <div className="flex flex-col items-center rounded-xl px-8 py-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <TrendingDown size={20} className="text-red-600 mb-1" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-400 mb-1">Total Sales</span>
                  <span className="text-2xl font-bold text-red-600">{totalSales.toFixed(2)}</span>
                  <span className="text-xs text-red-600 dark:text-red-400">{unit}</span>
                </div>

                <span className="text-2xl font-bold" style={{ color: 'var(--text-muted)' }}>=</span>

                {/* Present Stock */}
                <div className={`flex flex-col items-center rounded-xl px-8 py-4 border-2 ${isLow ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-400' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400'}`}>
                  <Package size={20} className={isLow ? 'text-orange-600 mb-1' : 'text-emerald-600 mb-1'} />
                  <span className={`text-xs font-semibold uppercase tracking-wide mb-1 ${isLow ? 'text-orange-700 dark:text-orange-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                    Present Stock
                  </span>
                  <span className={`text-3xl font-bold ${isLow ? 'text-orange-600' : 'text-emerald-600'}`}>{presentStock.toFixed(2)}</span>
                  <span className={`text-xs ${isLow ? 'text-orange-600' : 'text-emerald-600'}`}>{unit}</span>
                  {isLow && <span className="text-[10px] mt-1 text-orange-500 font-semibold">⚠️ Low Stock</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  {['Date & Time', 'Type', 'Reference', 'Notes', 'In (Qty)', 'Out (Qty)', 'Balance'].map(h => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide ${['In (Qty)', 'Out (Qty)', 'Balance'].includes(h) ? 'text-right' : 'text-left'}`}
                      style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Opening row */}
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{formatDate(startDate)}</td>
                  <td className="px-4 py-2.5" colSpan={3}>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700" style={{ color: 'var(--text-secondary)' }}>Opening Stock</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs" style={{ color: 'var(--text-muted)' }}>—</td>
                  <td className="px-4 py-2.5 text-right text-xs" style={{ color: 'var(--text-muted)' }}>—</td>
                  <td className="px-4 py-2.5 text-right font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                    {parseFloat(ledgerData.opening_stock).toFixed(2)} <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>{unit}</span>
                  </td>
                </tr>

                {ledgerData.ledger.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No stock movements in this period</td>
                  </tr>
                )}

                {ledgerData.ledger.map((entry, idx) => {
                  const qIn  = parseFloat(entry.qty_in || 0)
                  const qOut = parseFloat(entry.qty_out || 0)
                  const bal  = parseFloat(entry.running_balance || 0)
                  return (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/3 transition-colors"
                      style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="px-4 py-2.5">
                        <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{formatDate(entry.created_at)}</div>
                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{entry.created_at?.slice(11, 16) || ''}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${typeColor(entry.type_label)}`}>
                          {entry.type_label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                        {entry.reference_type ? `${entry.reference_type}` : ''}{entry.reference_id ? ` #${entry.reference_id}` : ''}
                      </td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{entry.notes || '—'}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-green-600 dark:text-green-400">
                        {qIn > 0 ? `+${qIn.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-red-600 dark:text-red-400">
                        {qOut > 0 ? `-${qOut.toFixed(2)}` : '—'}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-bold ${bal <= 0 ? 'text-red-600' : bal <= minLevel ? 'text-orange-600' : 'text-emerald-600'}`}>
                        {bal.toFixed(2)} <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>{unit}</span>
                      </td>
                    </tr>
                  )
                })}

                {/* Closing row */}
                {ledgerData.ledger.length > 0 && (
                  <tr style={{ background: 'var(--surface-2)', borderTop: '2px solid var(--border)' }}>
                    <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{formatDate(endDate)}</td>
                    <td className="px-4 py-2.5" colSpan={3}>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">Closing Stock</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm font-bold text-green-600">+{totalPurchase.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right text-sm font-bold text-red-600">-{totalSales.toFixed(2)}</td>
                    <td className={`px-4 py-2.5 text-right text-base font-bold ${presentStock <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {presentStock.toFixed(2)} <span className="text-sm font-normal">{unit}</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
