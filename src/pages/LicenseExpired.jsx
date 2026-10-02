import { useState } from 'react'
import { Phone, AlertTriangle, Calendar, Building2, Lock, Upload, AlertCircle, Copy, CheckCircle2 } from 'lucide-react'
import OwnerPanel from './OwnerPanel.jsx'

export default function LicenseExpired({ licenseInfo, machineId, onRenewed }) {
  const [showOwner, setShowOwner]   = useState(false)
  const [clickCount, setClickCount] = useState(0)
  const [importing, setImporting]   = useState(false)
  const [importError, setImportError] = useState('')
  const [copied, setCopied] = useState(false)

  const expDate = licenseInfo?.expiry_date
    ? new Date(licenseInfo.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  const isPending   = licenseInfo?.reason === 'pending_activation'
  const isExpired   = licenseInfo?.reason === 'expired'

  function handleLogoClick() {
    const next = clickCount + 1
    setClickCount(next)
    if (next >= 5) { setClickCount(0); setShowOwner(true) }
    setTimeout(() => setClickCount(0), 3000)
  }

  function copyMachineId() {
    if (!machineId) return
    navigator.clipboard.writeText(machineId).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function handleImportLic() {
    setImporting(true)
    setImportError('')
    try {
      const res = await window.api.license.import()
      if (res.success) {
        onRenewed()
      } else {
        setImportError(res.error || 'Import failed')
      }
    } catch {
      setImportError('File import mein error aaya.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6 select-none"
        style={{ background: '#0f172a' }}
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-red-500 to-red-600" />

        <div className="w-full max-w-[440px] rounded-2xl overflow-hidden shadow-2xl" style={{ background: '#1e293b', border: '1px solid rgba(239,68,68,0.3)' }}>

          {/* Header */}
          <div className={`px-6 py-5 text-center ${isPending ? 'bg-amber-600' : 'bg-red-600'}`}>
            <div
              className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3 cursor-pointer"
              onClick={handleLogoClick}
            >
              <Lock size={26} className="text-white" />
            </div>
            <h1 className="text-white text-[20px] font-bold">
              {isPending ? '⏳ Activation Pending' : isExpired ? 'License Expired' : 'Software Not Activated'}
            </h1>
            <p className="text-white/80 text-[12px] mt-1">
              {isPending
                ? 'Aapne register kar liya! Owner ki .lic file ka intezaar karo.'
                : isExpired
                ? 'Aapki license expire ho gayi. Naya .lic file import karo.'
                : 'Yeh software activate nahi hua hai.'}
            </p>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">

            {/* Info box */}
            {(licenseInfo?.customer_name || expDate || isPending || machineId) && (
              <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {machineId && (
                  <div className="pb-2 mb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">🔑 Aapka Machine ID</span>
                      <button 
                        onClick={copyMachineId}
                        className="flex items-center gap-1 text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase"
                      >
                        {copied ? <><CheckCircle2 size={10} /> Copied</> : <><Copy size={10} /> Copy ID</>}
                      </button>
                    </div>
                    <div className="bg-[#0f172a] px-3 py-2 rounded-lg border border-white/5 flex items-center justify-center">
                      <span className="font-mono text-[16px] font-bold text-blue-400 tracking-widest">{machineId}</span>
                    </div>
                  </div>
                )}
                
                {isPending && licenseInfo?.customer_name && (
                  <div className="flex items-center gap-3 text-[13px] text-slate-300">
                    <Building2 size={14} className="text-amber-400 flex-shrink-0" />
                    <span className="text-slate-400 w-24">Naam:</span>
                    <span className="font-bold text-white">{licenseInfo.customer_name}</span>
                  </div>
                )}
                {isPending && licenseInfo?.company_name && (
                  <div className="flex items-center gap-3 text-[13px] text-slate-300">
                    <Building2 size={14} className="text-amber-400 flex-shrink-0" />
                    <span className="text-slate-400 w-24">Company:</span>
                    <span className="font-bold text-white">{licenseInfo.company_name}</span>
                  </div>
                )}
                {isPending && licenseInfo?.phone && (
                  <div className="flex items-center gap-3 text-[13px] text-slate-300">
                    <Phone size={14} className="text-amber-400 flex-shrink-0" />
                    <span className="text-slate-400 w-24">Phone:</span>
                    <span className="font-bold text-white">{licenseInfo.phone}</span>
                  </div>
                )}
                {licenseInfo?.customer_name && !isPending && (
                  <div className="flex items-center gap-3 text-[13px] text-slate-300">
                    <Building2 size={14} className="text-red-400 flex-shrink-0" />
                    <span className="text-slate-400 w-24">Naam:</span>
                    <span className="font-bold text-white">{licenseInfo.customer_name}</span>
                  </div>
                )}
                {licenseInfo?.company_name && !isPending && (
                  <div className="flex items-center gap-3 text-[13px] text-slate-300">
                    <Building2 size={14} className="text-red-400 flex-shrink-0" />
                    <span className="text-slate-400 w-24">Company:</span>
                    <span className="font-bold text-white">{licenseInfo.company_name}</span>
                  </div>
                )}
                {licenseInfo?.phone && !isPending && (
                  <div className="flex items-center gap-3 text-[13px] text-slate-300">
                    <Phone size={14} className="text-red-400 flex-shrink-0" />
                    <span className="text-slate-400 w-24">Phone:</span>
                    <span className="font-bold text-white">{licenseInfo.phone}</span>
                  </div>
                )}
                {expDate && (
                  <div className="flex items-center gap-3 text-[13px] text-slate-300">
                    <Calendar size={14} className="text-red-400 flex-shrink-0" />
                    <span className="text-slate-400 w-24">Expired:</span>
                    <span className="font-bold text-red-400">{expDate}</span>
                  </div>
                )}
              </div>
            )}

            {/* ── MAIN ACTION: Import .lic file ── */}
            <div>
              <p className="text-[12px] font-bold text-slate-300 mb-2">
                {isPending ? '📂 Owner ki .lic file mil gayi? Import karo:' : '🔄 Naya License Import Karo:'}
              </p>
              <button
                onClick={handleImportLic}
                disabled={importing}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-[14px] transition-all hover:opacity-90 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', color: 'white', boxShadow: '0 4px 15px rgba(22,163,74,0.3)' }}
              >
                {importing
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Upload size={18} />}
                {importing ? 'Import ho raha hai...' : 'License File Import Karo (.lic)'}
              </button>
              {importError && (
                <div className="mt-2 flex items-start gap-2 text-[12px] text-red-400 bg-red-900/20 border border-red-800 px-3 py-2.5 rounded-lg">
                  <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                  <span className="whitespace-pre-line">{importError}</span>
                </div>
              )}
            </div>

            {/* Steps */}
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-[12px] font-bold text-white mb-3 flex items-center gap-2">
                <Phone size={14} className="text-blue-400" /> Owner Se License Kaise Lein:
              </p>
              <div className="space-y-2">
                {[
                  'Owner ko call/WhatsApp karo',
                  'Upar diya gaya Machine ID batao',
                  'Owner .lic file WhatsApp pe bhejega',
                  'Upar "Import" button se file select karo → Done!',
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-blue-400">{i + 1}</span>
                    </div>
                    <p className="text-[12px] text-slate-400">{s}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="px-6 py-3 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[11px] text-slate-600">Sunmarg Billing App — Licensed Software · Access Blocked</p>
          </div>
        </div>
      </div>

      {showOwner && (
        <OwnerPanel onClose={() => { setShowOwner(false); if (onRenewed) onRenewed() }} />
      )}
    </>
  )
}
