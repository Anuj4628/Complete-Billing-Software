import { useEffect, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { Download, BookOpen, Search, ChevronDown, FileText, Wallet, TrendingDown, ShoppingCart, Users } from 'lucide-react'
import { formatCurrency, formatDate, todayISO } from '../utils/formatters.js'
import { useSettingsStore } from '../store/useSettingsStore.js'

function getFirstDayOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function PartyLedger() {
  const { showToast, loadSettings } = useSettingsStore()
  const location = useLocation()

  // Tab: 'customer' or 'supplier'
  const [tab, setTab]                   = useState('customer')

  // Customer ledger state
  const [customers, setCustomers]       = useState([])
  const [selectedCustId, setSelectedCustId] = useState('')
  const [custSearch, setCustSearch]     = useState('')
  const [custDropOpen, setCustDropOpen] = useState(false)

  // Supplier ledger state
  const [suppliers, setSuppliers]       = useState([])
  const [selectedSupName, setSelectedSupName] = useState('')
  const [supSearch, setSupSearch]       = useState('')
  const [supDropOpen, setSupDropOpen]   = useState(false)

  const [startDate, setStartDate]       = useState(getFirstDayOfMonth())
  const [endDate, setEndDate]           = useState(todayISO())
  const [ledgerData, setLedgerData]     = useState(null)
  const [loading, setLoading]           = useState(false)

  useEffect(() => {
    loadSettings()
    window.api.customers.getAllForLedger().then(res => {
      if (res.success) {
        setCustomers(res.data)
        const params = new URLSearchParams(location.search)
        const qid = params.get('id')
        if (qid) setSelectedCustId(qid)
      }
    })
    window.api.purchases.getAllSuppliersForLedger().then(res => {
      if (res.success) setSuppliers(res.data)
    })
  }, [])

  // ── Fetch ledger based on active tab ─────────────────────────────────────
  const fetchLedger = useCallback(async () => {
    if (tab === 'customer') {
      if (!selectedCustId) { setLedgerData(null); return }
      setLoading(true)
      try {
        const res = await window.api.customers.getPartyLedger({ customer_id: parseInt(selectedCustId), startDate, endDate })
        if (res.success) setLedgerData({ ...res.data, mode: 'customer' })
        else showToast(res.error, 'error')
      } finally { setLoading(false) }
    } else {
      if (!selectedSupName) { setLedgerData(null); return }
      setLoading(true)
      try {
        const res = await window.api.purchases.getSupplierLedger({ supplier_name: selectedSupName, startDate, endDate })
        if (res.success) setLedgerData({ ...res.data, mode: 'supplier' })
        else showToast(res.error, 'error')
      } finally { setLoading(false) }
    }
  }, [tab, selectedCustId, selectedSupName, startDate, endDate])

  useEffect(() => { fetchLedger() }, [fetchLedger])

  // Reset ledger when switching tabs
  useEffect(() => { setLedgerData(null) }, [tab])

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(custSearch.toLowerCase()) ||
    (c.gstin || '').toLowerCase().includes(custSearch.toLowerCase()) ||
    (c.phone || '').includes(custSearch)
  )
  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(supSearch.toLowerCase()) ||
    (s.gstin || '').toLowerCase().includes(supSearch.toLowerCase())
  )

  const selectedCustomer = customers.find(c => c.id === parseInt(selectedCustId))

  async function handleExportCSV() {
    if (!ledgerData || !ledgerData.ledger.length) { showToast('No data to export', 'error'); return }
    const partyName = ledgerData.mode === 'customer' ? selectedCustomer?.name : selectedSupName
    const rows = [
      { Date: 'OPENING BALANCE', Reference: '', Type: '', Debit: '', Credit: '', Balance: ledgerData.opening_balance.toFixed(2) },
      ...ledgerData.ledger.map(e => ({
        Date: e.date, Reference: e.ref || '', Type: e.type,
        Debit: parseFloat(e.debit || 0).toFixed(2),
        Credit: parseFloat(e.credit || 0).toFixed(2),
        Balance: parseFloat(e.running_balance || 0).toFixed(2),
        Narration: e.narration || e.payment_mode || '',
      })),
      { Date: 'CLOSING BALANCE', Reference: '', Type: '', Debit: '', Credit: '', Balance: ledgerData.closing_balance.toFixed(2) },
    ]
    const res = await window.api.reports.exportCSV({ rows, filename: `party-ledger-${partyName || ''}-${startDate}-${endDate}.csv` })
    if (res.success) showToast(`Exported to ${res.data}`, 'success')
    else if (res.error !== 'Export cancelled') showToast(res.error, 'error')
  }

  // Summary computations
  const isSupplier = ledgerData?.mode === 'supplier'
  const totalBills    = ledgerData ? ledgerData.ledger.filter(e => e.type === (isSupplier ? 'Purchase' : 'Invoice')).reduce((s, e) => s + parseFloat(e.debit || 0), 0) : 0
  const totalPayments = ledgerData ? ledgerData.ledger.filter(e => e.type === (isSupplier ? 'Payment' : 'Receipt')).reduce((s, e) => s + parseFloat(e.credit || 0), 0) : 0
  const balanceDiff   = totalBills - totalPayments

  const partyInfo = ledgerData?.mode === 'customer' ? ledgerData.customer : ledgerData?.supplier

  return (
    <div className="space-y-4 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <BookOpen size={18} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Party Ledger</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Account statement for customers & suppliers</p>
          </div>
        </div>
        {ledgerData && (
          <button onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
            <Download size={14} /> Export CSV
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <button
          onClick={() => setTab('customer')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'customer' ? 'bg-indigo-600 text-white shadow' : ''}`}
          style={tab !== 'customer' ? { color: 'var(--text-muted)' } : {}}
        >
          <Users size={14} /> Customer Ledger
        </button>
        <button
          onClick={() => setTab('supplier')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'supplier' ? 'bg-orange-500 text-white shadow' : ''}`}
          style={tab !== 'supplier' ? { color: 'var(--text-muted)' } : {}}
        >
          <ShoppingCart size={14} /> Supplier Ledger
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-xl p-4 flex flex-wrap items-end gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {/* Customer Dropdown */}
        {tab === 'customer' && (
          <div className="flex-1 min-w-[220px] relative">
            <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Party / Customer</label>
            <div
              className="flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer text-sm"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              onClick={() => setCustDropOpen(o => !o)}
            >
              <span className={selectedCustomer ? '' : 'opacity-40'}>{selectedCustomer ? selectedCustomer.name : 'Select a customer...'}</span>
              <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
            </div>
            {custDropOpen && (
              <div className="absolute z-30 w-full mt-1 rounded-xl shadow-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                    <Search size={13} style={{ color: 'var(--text-muted)' }} />
                    <input autoFocus value={custSearch} onChange={e => setCustSearch(e.target.value)}
                      placeholder="Search customer..." className="flex-1 bg-transparent text-sm outline-none"
                      style={{ color: 'var(--text-primary)' }} />
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {filteredCustomers.map(c => (
                    <button key={c.id} onClick={() => { setSelectedCustId(String(c.id)); setCustDropOpen(false); setCustSearch('') }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors flex items-center justify-between">
                      <div>
                        <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{c.name}</div>
                        {c.gstin && <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{c.gstin}</div>}
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500">{c.customer_type}</span>
                    </button>
                  ))}
                  {filteredCustomers.length === 0 && <div className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No customers found</div>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Supplier Dropdown */}
        {tab === 'supplier' && (
          <div className="flex-1 min-w-[220px] relative">
            <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Supplier</label>
            <div
              className="flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer text-sm"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              onClick={() => setSupDropOpen(o => !o)}
            >
              <span className={selectedSupName ? '' : 'opacity-40'}>{selectedSupName || 'Select a supplier...'}</span>
              <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
            </div>
            {supDropOpen && (
              <div className="absolute z-30 w-full mt-1 rounded-xl shadow-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                    <Search size={13} style={{ color: 'var(--text-muted)' }} />
                    <input autoFocus value={supSearch} onChange={e => setSupSearch(e.target.value)}
                      placeholder="Search supplier..." className="flex-1 bg-transparent text-sm outline-none"
                      style={{ color: 'var(--text-primary)' }} />
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {filteredSuppliers.map((s, i) => (
                    <button key={i} onClick={() => { setSelectedSupName(s.name); setSupDropOpen(false); setSupSearch('') }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors">
                      <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{s.name}</div>
                      {s.gstin && <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{s.gstin}</div>}
                    </button>
                  ))}
                  {filteredSuppliers.length === 0 && <div className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No suppliers found</div>}
                </div>
              </div>
            )}
          </div>
        )}

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

      {/* Empty state */}
      {((tab === 'customer' && !selectedCustId) || (tab === 'supplier' && !selectedSupName)) && (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <BookOpen size={40} className={tab === 'supplier' ? 'text-orange-300 mb-3' : 'text-indigo-300 mb-3'} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Select a {tab === 'customer' ? 'customer' : 'supplier'} to view their ledger
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Choose from the dropdown above</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Ledger Content */}
      {!loading && ledgerData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl p-4 flex items-center gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${isSupplier ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                <FileText size={20} className={isSupplier ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>
                  {isSupplier ? 'Total Purchase Bills' : 'Total Sales Bills'}
                </p>
                <p className={`text-xl font-bold ${isSupplier ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400'}`}>{formatCurrency(totalBills)}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {ledgerData.ledger.filter(e => e.type === (isSupplier ? 'Purchase' : 'Invoice')).length} bill(s) · {formatDate(startDate)} – {formatDate(endDate)}
                </p>
              </div>
            </div>

            <div className="rounded-xl p-4 flex items-center gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="w-11 h-11 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <Wallet size={20} className="text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>
                  {isSupplier ? 'Total Payments Made' : 'Total Payment Received'}
                </p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalPayments)}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {ledgerData.ledger.filter(e => e.type === (isSupplier ? 'Payment' : 'Receipt')).length} payment(s) · {formatDate(startDate)} – {formatDate(endDate)}
                </p>
              </div>
            </div>

            <div className={`rounded-xl p-4 flex items-center gap-4 ${balanceDiff > 0 ? 'bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800' : balanceDiff < 0 ? 'bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800' : 'border'}`}
              style={balanceDiff === 0 ? { background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' } : {}}>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${balanceDiff > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                <TrendingDown size={20} className={balanceDiff > 0 ? 'text-red-600' : 'text-green-600'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>
                  Balance Due (Bills − Payments)
                </p>
                <p className={`text-xl font-bold ${balanceDiff > 0 ? 'text-red-600' : balanceDiff < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                  {formatCurrency(Math.abs(balanceDiff))}
                  <span className="text-sm font-normal ml-1">{balanceDiff > 0 ? 'Due' : balanceDiff < 0 ? 'Advance' : 'Settled'}</span>
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{formatCurrency(totalBills)} − {formatCurrency(totalPayments)}</p>
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="px-5 py-3 flex items-center justify-between" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${isSupplier ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'}`}>
                  {isSupplier ? 'Supplier' : 'Customer'}
                </span>
                <span className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>{partyInfo?.name}</span>
                {partyInfo?.gstin && <span className="ml-1 text-xs font-mono px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700" style={{ color: 'var(--text-muted)' }}>{partyInfo.gstin}</span>}
                {partyInfo?.phone && <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>📱 {partyInfo.phone}</span>}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    {['Date', 'Reference', 'Type', 'Narration', 'Debit (₹)', 'Credit (₹)', 'Balance (₹)'].map(h => (
                      <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide ${h.includes('₹') ? 'text-right' : 'text-left'}`}
                        style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Opening balance row */}
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    <td className="px-4 py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{startDate ? formatDate(startDate) : '—'}</td>
                    <td className="px-4 py-2" colSpan={3}>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700" style={{ color: 'var(--text-secondary)' }}>Opening Balance</span>
                    </td>
                    <td className="px-4 py-2 text-right text-xs" style={{ color: 'var(--text-muted)' }}>—</td>
                    <td className="px-4 py-2 text-right text-xs" style={{ color: 'var(--text-muted)' }}>—</td>
                    <td className={`px-4 py-2 text-right text-sm font-bold ${ledgerData.opening_balance > 0 ? 'text-red-600' : ledgerData.opening_balance < 0 ? 'text-green-600' : ''}`}>
                      {ledgerData.opening_balance !== 0
                        ? <>{formatCurrency(Math.abs(ledgerData.opening_balance))} <span className="text-xs font-normal">{ledgerData.opening_balance > 0 ? 'Dr' : 'Cr'}</span></>
                        : '0.00'}
                    </td>
                  </tr>

                  {ledgerData.ledger.length === 0 && (
                    <tr><td colSpan={7} className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No transactions in this period</td></tr>
                  )}

                  {ledgerData.ledger.map((entry, idx) => {
                    const isPurchaseOrInvoice = entry.type === 'Purchase' || entry.type === 'Invoice'
                    const bal = parseFloat(entry.running_balance || 0)
                    return (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/3 transition-colors" style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="px-4 py-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>{formatDate(entry.date)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`font-mono text-xs font-bold ${isPurchaseOrInvoice ? (isSupplier ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400') : 'text-green-700 dark:text-green-400'}`}>
                            {entry.ref || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            entry.type === 'Invoice' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : entry.type === 'Purchase' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          }`}>{entry.type}</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {entry.narration || entry.payment_mode || '—'}
                          {entry.payment_status && entry.payment_status !== 'paid' && (
                            <span className={`ml-1.5 px-1 py-0.5 rounded text-[10px] ${entry.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'}`}>
                              {entry.payment_status}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-red-600 dark:text-red-400">
                          {parseFloat(entry.debit || 0) > 0 ? formatCurrency(entry.debit) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-green-600 dark:text-green-400">
                          {parseFloat(entry.credit || 0) > 0 ? formatCurrency(entry.credit) : '—'}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-bold text-sm ${bal > 0 ? 'text-red-600' : bal < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                          {formatCurrency(Math.abs(bal))}
                          {bal !== 0 && <span className="ml-1 text-xs font-normal">{bal > 0 ? 'Dr' : 'Cr'}</span>}
                        </td>
                      </tr>
                    )
                  })}

                  {/* Closing balance row */}
                  {ledgerData.ledger.length > 0 && (
                    <tr style={{ background: 'var(--surface-2)', borderTop: '2px solid var(--border)' }}>
                      <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{formatDate(endDate)}</td>
                      <td className="px-4 py-2.5" colSpan={3}>
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">Closing Balance</span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm font-bold text-red-600">{formatCurrency(ledgerData.total_debit)}</td>
                      <td className="px-4 py-2.5 text-right text-sm font-bold text-green-600">{formatCurrency(ledgerData.total_credit)}</td>
                      <td className={`px-4 py-2.5 text-right text-base font-bold ${ledgerData.closing_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(Math.abs(ledgerData.closing_balance))}
                        {ledgerData.closing_balance !== 0 && <span className="ml-1 text-sm font-normal">{ledgerData.closing_balance > 0 ? 'Dr' : 'Cr'}</span>}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
