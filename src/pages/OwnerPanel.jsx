import { useState } from 'react'
import {
  Shield, Key, User, CheckCircle2, AlertTriangle, Lock,
  Eye, EyeOff, Building2, Phone, Monitor, Copy, Download,
  Clock, FileCheck, History, XCircle, Users, Plus, ChevronRight
} from 'lucide-react'

export default function OwnerPanel({ onClose }) {
  const [step, setStep]               = useState('auth')
  const [ownerPass, setOwnerPass]     = useState('')
  const [ownerName, setOwnerName]     = useState('')
  const [showPass, setShowPass]       = useState(false)
  const [authError, setAuthError]     = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [activeTab, setActiveTab]     = useState('customers')

  const [license, setLicense]   = useState(null)
  const [registration, setReg]  = useState(null)
  const [form, setForm]         = useState({ customer_name: '', company_name: '', phone: '', expiry_date: '' })
  const [formPass, setFormPass] = useState('')

  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated]   = useState(false)
  const [genError, setGenError]     = useState('')
  const [copiedId, setCopiedId]     = useState(false)

  const [accessLog, setAccessLog]           = useState([])
  const [allRegistrations, setAllRegs]      = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)

  // Manual add form
  const [showAddForm, setShowAddForm]   = useState(false)
  const [addForm, setAddForm]           = useState({ customer_name: '', company_name: '', phone: '', machine_id: '' })
  const [addError, setAddError]         = useState('')
  const [addSuccess, setAddSuccess]     = useState(false)

  async function handleOwnerAuth(e) {
    e.preventDefault()
    if (!ownerName.trim()) { setAuthError('Apna naam daalo'); return }
    setAuthLoading(true); setAuthError('')
    try {
      const res = await window.api.license.ownerAuth({ owner_password: ownerPass, owner_name: ownerName.trim() })
      if (res.success) {
        setLicense(res.license)
        setReg(res.registration)
        setFormPass(ownerPass)
        setStep('panel')
        const [log, regs] = await Promise.all([
          window.api.license.getAccessLog(),
          window.api.license.getAllRegistrations(),
        ])
        setAccessLog(log || [])
        setAllRegs(regs || [])
      } else {
        setAuthError(res.error || 'Invalid owner password')
      }
    } catch { setAuthError('Authentication failed') }
    finally { setAuthLoading(false) }
  }

  function selectCustomer(reg) {
    setSelectedCustomer(reg)
    setForm({
      customer_name: reg.customer_name || '',
      company_name:  reg.company_name  || '',
      phone:         reg.phone         || '',
      machine_id:    reg.machine_id    || '',
      expiry_date:   '',
    })
    setGenerated(false)
    setGenError('')
    setActiveTab('generate')
  }

  async function handleGenerate(e) {
    e.preventDefault()
    if (!form.customer_name || !form.expiry_date || !form.machine_id) {
      setGenError('Naam, Machine ID aur Expiry Date zaroori hai'); return
    }
    setGenerating(true); setGenError(''); setGenerated(false)
    try {
      const res = await window.api.license.generate({
        owner_password: formPass,
        customer_name:  form.customer_name,
        company_name:   form.company_name,
        phone:          form.phone,
        machine_id:     form.machine_id,
        expiry_date:    form.expiry_date,
      })
      if (res.success) { setGenerated(true); setTimeout(() => setGenerated(false), 6000) }
      else setGenError(res.error || 'Generation failed')
    } catch { setGenError('Error hua. Dobara try karo.') }
    finally { setGenerating(false) }
  }

  async function handleAddRegistration(e) {
    e.preventDefault()
    if (!addForm.customer_name) { setAddError('Naam zaroori hai'); return }
    if (!addForm.machine_id) { setAddError('Machine ID zaroori hai'); return }
    setAddError('')
    try {
      const res = await window.api.license.addRegistration({ owner_password: formPass, ...addForm, machine_id: addForm.machine_id.toUpperCase() })
      if (res.success) {
        setAddSuccess(true)
        setAddForm({ customer_name: '', company_name: '', phone: '', machine_id: '' })
        setTimeout(() => setAddSuccess(false), 3000)
        const regs = await window.api.license.getAllRegistrations()
        setAllRegs(regs || [])
        setShowAddForm(false)
      } else setAddError(res.error || 'Failed')
    } catch { setAddError('Error aaya') }
  }

  function daysLeft(dateStr) {
    if (!dateStr) return null
    const today = new Date(); today.setHours(0,0,0,0)
    const expiry = new Date(dateStr); expiry.setHours(0,0,0,0)
    return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24))
  }

  function formatTime(iso) {
    try {
      return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
    } catch { return iso }
  }

  function formatDate(iso) {
    try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
    catch { return iso }
  }

  const tabs = [
    { id: 'customers', label: 'Customers', icon: <Users size={13} /> },
    { id: 'generate',  label: 'Generate .lic', icon: <Download size={13} /> },
    { id: 'log',       label: 'Access Log', icon: <History size={13} /> },
  ]

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-[520px] rounded-2xl overflow-hidden shadow-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <div className="w-9 h-9 bg-amber-500/20 rounded-xl flex items-center justify-center">
            <Shield size={18} className="text-amber-500" />
          </div>
          <div className="flex-1">
            <h2 className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>Owner License Panel</h2>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {step === 'panel' ? `✅ Logged in: ${ownerName}` : 'Restricted — Owner access only'}
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-lg font-bold hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors" style={{ color: 'var(--text-muted)' }}>×</button>
        </div>

        {/* ── AUTH ── */}
        {step === 'auth' && (
          <div className="px-6 py-6">
            <div className="flex items-center gap-2 mb-5 p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <Lock size={14} className="text-amber-500 flex-shrink-0" />
              <p className="text-[12px] text-amber-600 dark:text-amber-400">Sirf software owner ka yahan access hai.</p>
            </div>
            <form onSubmit={handleOwnerAuth} className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-secondary)' }}>Aapka Naam <span className="text-red-400">*</span></label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                  <input type="text" value={ownerName} onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border text-[13px] focus:outline-none focus:ring-2 focus:ring-amber-400"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    placeholder="Apna naam likhein" autoFocus required />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-secondary)' }}>Owner Password</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={ownerPass} onChange={(e) => setOwnerPass(e.target.value)}
                    className="w-full px-3.5 py-2.5 pr-10 rounded-lg border text-[13px] focus:outline-none focus:ring-2 focus:ring-amber-400"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    placeholder="Owner password daalo" required />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              {authError && (
                <div className="flex items-center gap-2 text-[12px] text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2.5 rounded-lg">
                  <AlertTriangle size={13} />{authError}
                </div>
              )}
              <button type="submit" disabled={authLoading}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-[13px] transition-all">
                {authLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Key size={14} />}
                {authLoading ? 'Verify ho raha hai...' : 'Owner Panel Kholo'}
              </button>
            </form>
          </div>
        )}

        {/* ── PANEL TABS ── */}
        {step === 'panel' && (
          <>
            <div className="flex" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold transition-all"
                  style={{ color: activeTab === tab.id ? '#f59e0b' : 'var(--text-muted)', borderBottom: activeTab === tab.id ? '2px solid #f59e0b' : '2px solid transparent' }}>
                  {tab.icon}{tab.label}
                  {tab.id === 'customers' && allRegistrations.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400">{allRegistrations.length}</span>
                  )}
                </button>
              ))}
            </div>

            {/* ── CUSTOMERS TAB ── */}
            {activeTab === 'customers' && (
              <div className="px-6 py-4 max-h-[72vh] overflow-y-auto space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                    Registered Customers ({allRegistrations.length})
                  </p>
                  <button onClick={() => setShowAddForm(!showAddForm)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                    style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                    <Plus size={12} /> Manual Add
                  </button>
                </div>

                {/* Manual add form */}
                {showAddForm && (
                  <form onSubmit={handleAddRegistration} className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <p className="text-[11px] font-bold text-amber-400">Customer ka data manually add karo</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" placeholder="Customer Naam *" value={addForm.customer_name}
                        onChange={e => setAddForm(p => ({ ...p, customer_name: e.target.value }))}
                        className="px-3 py-2 rounded-lg border text-[12px] focus:outline-none focus:ring-1 focus:ring-amber-400"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} required />
                      <input type="text" placeholder="Company" value={addForm.company_name}
                        onChange={e => setAddForm(p => ({ ...p, company_name: e.target.value }))}
                        className="px-3 py-2 rounded-lg border text-[12px] focus:outline-none focus:ring-1 focus:ring-amber-400"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                      <input type="text" placeholder="Phone" value={addForm.phone}
                        onChange={e => setAddForm(p => ({ ...p, phone: e.target.value }))}
                        className="px-3 py-2 rounded-lg border text-[12px] focus:outline-none focus:ring-1 focus:ring-amber-400"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                      <input type="text" placeholder="Machine ID *" value={addForm.machine_id}
                        onChange={e => setAddForm(p => ({ ...p, machine_id: e.target.value.toUpperCase() }))}
                        className="px-3 py-2 rounded-lg border text-[12px] focus:outline-none focus:ring-1 focus:ring-amber-400 font-mono"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} required />
                    </div>
                    {addError && <p className="text-[11px] text-red-400">{addError}</p>}
                    {addSuccess && <p className="text-[11px] text-green-400">✅ Customer add ho gaya!</p>}
                    <div className="flex gap-2">
                      <button type="submit" className="flex-1 py-2 rounded-lg text-[12px] font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-all">Add Karo</button>
                      <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 rounded-lg text-[12px]" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>Cancel</button>
                    </div>
                  </form>
                )}

                {allRegistrations.length === 0 ? (
                  <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
                    <Users size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-[12px]">Abhi koi customer registered nahi hai</p>
                    <p className="text-[11px] mt-1 opacity-60">Jab customer app mein register karega, yahan dikhega</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allRegistrations.map((reg, i) => (
                      <button key={i} onClick={() => selectCustomer(reg)}
                        className="w-full text-left rounded-xl px-4 py-3 transition-all hover:opacity-90 group"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{reg.customer_name}</span>
                              {reg.company_name && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>{reg.company_name}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>📱 {reg.phone || '—'}</span>
                              {reg.machine_id && (
                                <span className="text-[10px] px-2 py-1 rounded font-mono" style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc' }}>🖥️ {reg.machine_id}</span>
                              )}
                            </div>
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Registered: {formatDate(reg.registered_at || reg.added_at)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold px-2 py-1 rounded-lg" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                              .lic Banao
                            </span>
                            <ChevronRight size={14} className="text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── GENERATE TAB ── */}
            {activeTab === 'generate' && (
              <div className="px-6 py-5 space-y-4 max-h-[72vh] overflow-y-auto">
                {selectedCustomer && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <CheckCircle2 size={13} className="text-green-400" />
                    <span className="text-[12px] text-green-400 font-semibold">{selectedCustomer.customer_name} ka data auto-filled hai</span>
                    <button onClick={() => setSelectedCustomer(null)} className="ml-auto text-[11px]" style={{ color: 'var(--text-muted)' }}>Clear</button>
                  </div>
                )}
                <form onSubmit={handleGenerate} className="space-y-3">
                  <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>🔑 .lic File Banao</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>Customer Naam *</label>
                      <input type="text" value={form.customer_name} onChange={(e) => setForm(p => ({ ...p, customer_name: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border text-[12px] focus:outline-none focus:ring-2 focus:ring-amber-400"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                        placeholder="Customer naam" required />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>Company</label>
                      <input type="text" value={form.company_name} onChange={(e) => setForm(p => ({ ...p, company_name: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border text-[12px] focus:outline-none focus:ring-2 focus:ring-amber-400"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                        placeholder="Company naam" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>Machine ID *</label>
                      <input type="text" value={form.machine_id} onChange={(e) => setForm(p => ({ ...p, machine_id: e.target.value.toUpperCase() }))}
                        className="w-full px-3 py-2 rounded-lg border text-[12px] focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                        placeholder="A1B2-C3D4-E5F6-G7H8" required />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>Phone</label>
                      <input type="tel" value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} maxLength="10"
                        className="w-full px-3 py-2 rounded-lg border text-[12px] focus:outline-none focus:ring-2 focus:ring-amber-400"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                        placeholder="10 digit" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>Expiry Date *</label>
                    <input type="date" value={form.expiry_date} onChange={(e) => setForm(p => ({ ...p, expiry_date: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border text-[12px] focus:outline-none focus:ring-2 focus:ring-amber-400"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      required />
                  </div>
                  {genError && (
                    <div className="flex items-center gap-2 text-[12px] text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-800 px-3 py-2 rounded-lg">
                      <AlertTriangle size={13} />{genError}
                    </div>
                  )}
                  <button type="submit" disabled={generating}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[13px] transition-all hover:opacity-90 disabled:opacity-60"
                    style={{ background: generated ? 'linear-gradient(135deg,#16a34a,#15803d)' : 'linear-gradient(135deg,#d97706,#b45309)', color: 'white' }}>
                    {generating ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : generated ? <CheckCircle2 size={16} /> : <Download size={16} />}
                    {generating ? 'File ban rahi hai...' : generated ? '✅ .lic File Save Ho Gayi! Customer Ko Bhejo' : '.lic License File Generate Karo'}
                  </button>
                  {generated && (
                    <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                      <p className="text-[12px] text-green-400 font-semibold">🎉 .lic file save ho gayi!</p>
                      <p className="text-[11px] text-green-500/70 mt-1">Machine-locked license: {form.machine_id}</p>
                      <p className="text-[11px] text-green-500/70">Ab yeh file WhatsApp ya Email se customer ko bhejo.</p>
                    </div>
                  )}
                </form>
              </div>
            )}

            {/* ── ACCESS LOG TAB ── */}
            {activeTab === 'log' && (
              <div className="px-6 py-5 max-h-[72vh] overflow-y-auto">
                <p className="text-[12px] font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>Owner Panel Access History</p>
                {accessLog.length === 0 ? (
                  <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
                    <History size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-[12px]">Abhi koi log nahi hai</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {accessLog.map((entry, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-xl px-3 py-2.5" style={{
                        background: entry.type === 'failed_attempt' ? 'rgba(239,68,68,0.07)' : 'rgba(34,197,94,0.07)',
                        border: `1px solid ${entry.type === 'failed_attempt' ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.15)'}`,
                      }}>
                        <div className="mt-0.5">
                          {entry.type === 'failed_attempt' ? <XCircle size={14} className="text-red-500" /> : <CheckCircle2 size={14} className="text-green-500" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>{entry.owner_name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${entry.type === 'failed_attempt' ? 'bg-red-500/15 text-red-400' : 'bg-green-500/15 text-green-400'}`}>
                              {entry.type === 'failed_attempt' ? 'FAILED' : 'SUCCESS'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>🕐 {formatTime(entry.timestamp)}</span>
                            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>💻 {entry.machine}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
