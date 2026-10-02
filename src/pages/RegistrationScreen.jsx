import { useState } from 'react'
import {
  Receipt, User, Building2, Phone, CheckCircle2,
  Copy, MessageCircle, AlertCircle, Upload, FileCheck
} from 'lucide-react'

export default function RegistrationScreen({ machineId, onRegistered }) {
  const [step, setStep]   = useState('form') // 'form' | 'done'
  const [form, setForm]   = useState({ customer_name: '', company_name: '', phone: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading]     = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [savedMachineId, setSavedMachineId] = useState(machineId || '')
  const [copied, setCopied] = useState(false)

  function validate() {
    const e = {}
    if (!form.customer_name.trim() || form.customer_name.trim().length < 2)
      e.customer_name = 'Kam se kam 2 characters chahiye'
    if (!form.company_name.trim())
      e.company_name = 'Company/Shop naam zaroori hai'
    if (!form.phone.trim() || !/^\d{10}$/.test(form.phone.trim()))
      e.phone = '10 digit ka phone number daalo'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const res = await window.api.license.register({
        customer_name: form.customer_name,
        company_name:  form.company_name,
        phone:         form.phone,
      })
      if (res.success) {
        setSavedMachineId(res.machine_id)
        setStep('done')
      } else {
        setErrors({ _: res.error || 'Registration failed' })
      }
    } catch {
      setErrors({ _: 'Error hua. Dobara try karo.' })
    } finally {
      setLoading(false)
    }
  }

  // Import .lic file — works on both form and done step
  async function handleImportLic() {
    setImporting(true)
    setImportError('')
    try {
      const res = await window.api.license.import()
      if (res.success) {
        // License imported successfully — re-check
        onRegistered()
      } else {
        setImportError(res.error || 'Import failed')
      }
    } catch {
      setImportError('File import mein error aaya.')
    } finally {
      setImporting(false)
    }
  }

  function copyMachineId() {
    navigator.clipboard.writeText(savedMachineId).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  function sendWhatsApp() {
    const msg = encodeURIComponent(
      `Namaskar! Mujhe Sunmarg Billing App activate karna hai.\n\n` +
      `👤 Naam: ${form.customer_name}\n` +
      `🏢 Company: ${form.company_name}\n` +
      `📱 Phone: ${form.phone}\n` +
      `🔑 Machine ID: ${savedMachineId}\n\n` +
      `Kripya meri Machine ID se .lic file bana ke bhej dijiye.`
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#0f172a' }}>
      {/* Left panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-[380px] flex-shrink-0 p-10"
        style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <Receipt size={18} className="text-white" />
          </div>
          <span className="text-white font-bold text-[15px]">Sunmarg Billing App</span>
        </div>
        <div>
          <div className="w-12 h-1 bg-blue-600 rounded-full mb-6" />
          <h2 className="text-3xl font-bold text-white leading-snug mb-4">
            Software<br /><span className="text-blue-400">Activate Karo</span>
          </h2>
          <p className="text-white/40 text-[13px] leading-relaxed mb-8">
            Apna naam aur Machine ID owner ko bhejo. Owner .lic file banayega — import karo aur app khul jayegi!
          </p>
          <div className="space-y-4">
            {[
              { n: '1', t: 'Apna naam, company, phone bharo' },
              { n: '2', t: 'Machine ID WhatsApp se owner ko bhejo' },
              { n: '3', t: 'Owner .lic file banayega aur bhejega' },
              { n: '4', t: '"Import License" karo → App unlock! ✅' },
            ].map((s) => (
              <div key={s.n} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-[11px] font-bold text-blue-400">{s.n}</span>
                </div>
                <p className="text-white/50 text-[13px]">{s.t}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-white/20 text-[12px]">© {new Date().getFullYear()} Sunmarg Billing App</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6" style={{ background: '#1e293b' }}>
        <div className="w-full max-w-[440px]">

          {step === 'form' ? (
            <>
              <div className="mb-7">
                <h1 className="text-[24px] font-bold text-white mb-1.5">Pehli Baar Setup</h1>
                <p className="text-[13px] text-slate-400">Details bharo ya seedha .lic file import karo</p>
              </div>

              {/* ── IMPORT SHORTCUT (agar owner ne pehle hi file bhej di) ── */}
              <div
                className="mb-5 p-4 rounded-xl cursor-pointer border-2 border-dashed transition-all hover:border-green-500/60 hover:bg-green-500/5"
                style={{ borderColor: 'rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.04)' }}
                onClick={handleImportLic}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    {importing
                      ? <div className="w-5 h-5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                      : <FileCheck size={20} className="text-green-400" />}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-green-400">
                      {importing ? 'Import ho raha hai...' : 'Owner ne .lic file bhej di? Yahan click karo!'}
                    </p>
                    <p className="text-[11px] text-green-500/60 mt-0.5">
                      .lic file select karo → automatic unlock
                    </p>
                  </div>
                </div>
                {importError && (
                  <div className="mt-3 flex items-start gap-2 text-[12px] text-red-400 bg-red-900/20 border border-red-800 px-3 py-2 rounded-lg">
                    <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                    <span className="whitespace-pre-line">{importError}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                <span className="text-[11px] text-slate-500 font-medium">YA PEHLE REGISTER KARO</span>
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
              </div>

              {/* Registration form */}
              <div className="p-6 rounded-2xl" style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)' }}>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Aapka Naam *</label>
                    <div className="relative">
                      <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text" value={form.customer_name}
                        onChange={(e) => setForm((p) => ({ ...p, customer_name: e.target.value }))}
                        placeholder="Jaise: Ramesh Kumar"
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-lg text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        style={{ background: '#1e293b', border: `1px solid ${errors.customer_name ? '#ef4444' : 'rgba(255,255,255,0.1)'}` }}
                        autoFocus
                      />
                    </div>
                    {errors.customer_name && <p className="text-red-400 text-[11px] mt-1 flex items-center gap-1"><AlertCircle size={10} />{errors.customer_name}</p>}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Company / Shop Naam *</label>
                    <div className="relative">
                      <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text" value={form.company_name}
                        onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))}
                        placeholder="Jaise: Sharma Traders"
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-lg text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        style={{ background: '#1e293b', border: `1px solid ${errors.company_name ? '#ef4444' : 'rgba(255,255,255,0.1)'}` }}
                      />
                    </div>
                    {errors.company_name && <p className="text-red-400 text-[11px] mt-1 flex items-center gap-1"><AlertCircle size={10} />{errors.company_name}</p>}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Mobile Number *</label>
                    <div className="relative">
                      <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="tel" value={form.phone}
                        onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                        placeholder="10 digit number"
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-lg text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        style={{ background: '#1e293b', border: `1px solid ${errors.phone ? '#ef4444' : 'rgba(255,255,255,0.1)'}` }}
                      />
                    </div>
                    {errors.phone && <p className="text-red-400 text-[11px] mt-1 flex items-center gap-1"><AlertCircle size={10} />{errors.phone}</p>}
                  </div>

                  {/* Machine ID display */}
                  <div className="pt-1">
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Aapka Machine ID</label>
                    <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg" style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <span className="font-mono text-[13px] text-blue-400 flex-1 tracking-widest font-bold">{machineId || 'Loading...'}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Yeh ID owner ko dena hoga</p>
                  </div>

                  {errors._ && (
                    <div className="flex items-center gap-2 text-[12px] text-red-400 bg-red-900/20 border border-red-800 px-3 py-2.5 rounded-lg">
                      <AlertCircle size={13} />{errors._}
                    </div>
                  )}

                  <button
                    type="submit" disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-[13px] transition-all"
                  >
                    {loading
                      ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <CheckCircle2 size={15} />}
                    {loading ? 'Saving...' : 'Details Save Karo'}
                  </button>
                </form>
              </div>
            </>
          ) : (
            /* ── STEP 2: Done — share machine ID + import option ── */
            <>
              <div className="mb-6">
                <div className="w-14 h-14 bg-green-500/20 rounded-2xl flex items-center justify-center mb-4">
                  <CheckCircle2 size={28} className="text-green-400" />
                </div>
                <h1 className="text-[22px] font-bold text-white mb-1">Details Save! ✅</h1>
                <p className="text-[13px] text-slate-400">Ab owner ko Machine ID bhejo — woh .lic file bhejega</p>
              </div>

              <div className="p-6 rounded-2xl space-y-5" style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)' }}>

                {/* Summary */}
                <div className="space-y-2 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Aapki Details</p>
                  <div className="flex items-center gap-3"><User size={13} className="text-slate-500" /><span className="text-[13px] text-slate-300">{form.customer_name}</span></div>
                  <div className="flex items-center gap-3"><Building2 size={13} className="text-slate-500" /><span className="text-[13px] text-slate-300">{form.company_name}</span></div>
                  <div className="flex items-center gap-3"><Phone size={13} className="text-slate-500" /><span className="text-[13px] text-slate-300">{form.phone}</span></div>
                </div>

                {/* Machine ID */}
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">🔑 Machine ID — Owner Ko Bhejo</p>
                  <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl" style={{ background: '#1e293b', border: '1px solid rgba(59,130,246,0.3)' }}>
                    <span className="font-mono text-[18px] text-blue-400 flex-1 tracking-widest font-bold">{savedMachineId}</span>
                    <button
                      onClick={copyMachineId}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                      style={{ background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(59,130,246,0.2)', color: copied ? '#4ade80' : '#60a5fa', border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(59,130,246,0.3)'}` }}
                    >
                      {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* WhatsApp */}
                <button
                  onClick={sendWhatsApp}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-[13px] transition-all hover:opacity-90"
                  style={{ background: '#25D366', color: 'white' }}
                >
                  <MessageCircle size={16} />
                  WhatsApp se Owner ko Machine ID Bhejo
                </button>

                {/* Import .lic */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Owner ne .lic file bhej di?</p>
                  <button
                    onClick={handleImportLic}
                    disabled={importing}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-[13px] transition-all hover:opacity-90 disabled:opacity-60"
                    style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}
                  >
                    {importing
                      ? <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                      : <Upload size={15} />}
                    {importing ? 'Import ho raha hai...' : 'License File Import Karo (.lic)'}
                  </button>
                  {importError && (
                    <div className="mt-2 flex items-start gap-2 text-[12px] text-red-400 bg-red-900/20 border border-red-800 px-3 py-2 rounded-lg">
                      <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                      <span className="whitespace-pre-line">{importError}</span>
                    </div>
                  )}
                </div>

                {/* Waiting */}
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[12px] font-semibold text-amber-400">Owner ka intezaar kar rahe hain...</p>
                    <p className="text-[11px] text-amber-500/70 mt-0.5">.lic file milne par "Import" button dabao</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
