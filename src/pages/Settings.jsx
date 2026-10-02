import { useEffect, useState, useRef } from 'react'
import {
  Save, Upload, Download, AlertTriangle, Building2, CreditCard,
  FileText, Database, Lock, CheckCircle2, Mail, Globe, Printer,
  Hash, List, ToggleLeft, Calendar, HardDrive, Settings2, Shield
} from 'lucide-react'
import { useSettingsStore } from '../store/useSettingsStore.js'
import Button from '../components/ui/Button.jsx'
import Input, { Textarea, Select } from '../components/ui/Input.jsx'
import { INDIAN_STATES, getStateCode } from '../utils/gstHelpers.js'

function Section({ title, icon: Icon, description, children }) {
  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
      <div className="flex items-center gap-3 px-6 py-4"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
          <Icon size={16} className="text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          {description && <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>}
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

function Toggle({ label, value, onChange, hint }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
        {hint && <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${value ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${value ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}

export default function Settings() {
  const { settings, loadSettings, saveSettings, loading, showToast } = useSettingsStore()
  const [form, setForm] = useState({})
  const [backupLoading, setBackupLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const logoRef = useRef(null)
  const sigRef = useRef(null)
  const stampRef = useRef(null)
  const [licenseInfo, setLicenseInfo] = useState(null)

  // Quotation terms list
  const [quotTerms, setQuotTerms] = useState([
    'PRICE BASIS :', 'PAYMENT TERMS :', 'TAXES :', 'VALIDITY :',
    'DELIVERY :', 'TRANSPORTATION :', 'LOADING :', 'INSPECTION :', 'MTC :', 'TESTING CHARGES :'
  ])

  const [pwForm, setPwForm] = useState({ newUsername: '', newPassword: '', confirmPassword: '' })
  const [pwLoading, setPwLoading] = useState(false)

  useEffect(() => { loadSettings() }, [])
  useEffect(() => {
    const st = settings.company_state || 'Maharashtra'
    const code = settings.company_state_code !== undefined && settings.company_state_code !== ''
      ? settings.company_state_code
      : (getStateCode(st) || '27')
    setForm({ ...settings, company_state_code: code })
    if (settings.quotation_terms) {
      try { setQuotTerms(JSON.parse(settings.quotation_terms)) } catch {}
    }
  }, [settings])

  // Load license info to show expiry and lock company name
  useEffect(() => {
    async function fetchLic() {
      try {
        const res = await window.api.license.info()
        setLicenseInfo(res)
      } catch { setLicenseInfo(null) }
    }
    fetchLic()
  }, [])

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))
  const tog = (k) => (val) => setForm((p) => ({ ...p, [k]: val ? 'true' : 'false' }))
  const isOn = (k) => form[k] === 'true'

  function handleStateChange(e) {
    const newState = e.target.value
    setForm((p) => {
      const oldState = p.company_state || 'Maharashtra'
      const oldCode = getStateCode(oldState)
      const currentCode = (p.company_state_code ?? '').trim()
      const shouldAutoUpdate = !currentCode || currentCode === oldCode
      const newCode = shouldAutoUpdate ? (getStateCode(newState) || currentCode) : currentCode
      return {
        ...p,
        company_state: newState,
        company_state_code: newCode,
      }
    })
  }

  function handleStateCodeChange(e) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2)
    setForm((p) => ({ ...p, company_state_code: val }))
  }

  function convertFileToPngDataUrl(file, maxWidth = 1000, maxHeight = 1000) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          let width = img.width
          let height = img.height
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height)
            width = Math.round(width * ratio)
            height = Math.round(height * ratio)
          }
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/png'))
        }
        img.onerror = () => resolve(e.target.result)
        img.src = e.target.result
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { showToast('Logo must be under 2MB', 'error'); return }
    convertFileToPngDataUrl(file).then((dataUrl) => {
      setForm((p) => ({ ...p, company_logo: dataUrl }))
    }).catch(() => {
      showToast('Failed to process logo image', 'error')
    })
  }

  function handleSigUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { showToast('Signature must be under 2MB', 'error'); return }
    convertFileToPngDataUrl(file).then((dataUrl) => {
      setForm((p) => ({ ...p, company_signature: dataUrl }))
    }).catch(() => {
      showToast('Failed to process signature image', 'error')
    })
  }

  function handleStampUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { showToast('Stamp must be under 2MB', 'error'); return }
    convertFileToPngDataUrl(file).then((dataUrl) => {
      setForm((p) => ({ ...p, company_stamp: dataUrl }))
    }).catch(() => {
      showToast('Failed to process stamp image', 'error')
    })
  }

  async function handleSave() {
    if (form.company_state_code && !/^\d{1,2}$/.test(form.company_state_code.trim())) {
      showToast('State Code must be 1 to 2 numeric digits', 'error')
      return
    }
    const saveData = { ...form, quotation_terms: JSON.stringify(quotTerms) }
    await saveSettings(saveData)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleChangeCredentials() {
    const { newUsername, newPassword, confirmPassword } = pwForm
    if (!newUsername.trim()) { showToast('Username cannot be empty', 'error'); return }
    if (!newPassword.trim()) { showToast('Password cannot be empty', 'error'); return }
    if (newPassword !== confirmPassword) { showToast('Passwords do not match', 'error'); return }
    if (newPassword.length < 4) { showToast('Password must be at least 4 characters', 'error'); return }
    setPwLoading(true)
    const res = await window.api.settings.set({ auth_username: newUsername.trim(), auth_password: newPassword })
    setPwLoading(false)
    if (res.success) {
      showToast('Credentials updated successfully', 'success')
      setPwForm({ newUsername: '', newPassword: '', confirmPassword: '' })
    } else {
      showToast(res.error || 'Failed to update', 'error')
    }
  }

  async function handleBackupExport() {
    setBackupLoading(true)
    const res = await window.api.backup.export()
    setBackupLoading(false)
    if (res.success) showToast(`Backup saved to ${res.data}`, 'success')
    else if (res.error !== 'Backup cancelled') showToast(res.error, 'error')
  }

  async function handleBackupImport() {
    const confirmed = window.confirm(
      'WARNING: Importing will REPLACE all current data and restart the app.\n\n' +
      'Only .sbak backup files created on THIS device are accepted.\n\nContinue?'
    )
    if (!confirmed) return
    setImportLoading(true)
    const res = await window.api.backup.import()
    setImportLoading(false)
    if (res.success) {
      showToast('Backup restored successfully. App is restarting…', 'success')
    } else if (res.error && res.error !== 'Import cancelled') {
      showToast(res.error, 'error')
    }
  }

  function updateQuotTerm(idx, val) {
    setQuotTerms(prev => prev.map((t, i) => i === idx ? val : t))
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-10">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>Company Settings</h2>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Configure all company details and preferences</p>
        </div>
        <Button icon={saved ? CheckCircle2 : Save} loading={loading} onClick={handleSave} size="lg"
          variant={saved ? 'success' : 'primary'}>
          {saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>

      {/* ── COMPANY DETAILS ── */}
      <Section title="Company Details" icon={Building2} description="Name, address and contact information">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Company Name" value={form.company_name || ''} onChange={f('company_name')} containerClassName="col-span-2" placeholder="e.g. Your Company Pvt Ltd" />
          <Input label="Nature of Business / Description" value={form.company_nature || ''} onChange={f('company_nature')} containerClassName="col-span-2" placeholder="e.g. Stockist, Manufacturer & Suppliers of FERROUS" />
          <Input label="Address Line 1" value={form.company_address || ''} onChange={f('company_address')} containerClassName="col-span-2" placeholder="Shop/Office No., Building, Street" />
          <Input label="Address Line 2" value={form.company_address2 || ''} onChange={f('company_address2')} containerClassName="col-span-2" placeholder="Area, Landmark" />
          <Input label="City" value={form.company_city || ''} onChange={f('company_city')} />
          <Select label="State" value={form.company_state || 'Maharashtra'} onChange={handleStateChange}>
            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Input label="State Code" value={form.company_state_code ?? ''} onChange={handleStateCodeChange} maxLength={2} placeholder="e.g. 27" />
          <Input label="PIN Code" value={form.company_pin || ''} onChange={f('company_pin')} maxLength={6} />
          <Input label="Contact Numbers" value={form.company_phone || ''} onChange={f('company_phone')} placeholder="MOBILE NO: +91-XXXXXXXXXX" />
          <Input label="Contact Person" value={form.contact_person || ''} onChange={f('contact_person')} placeholder="Owner / Manager name" />
          <Input label="Website" value={form.company_website || ''} onChange={f('company_website')} placeholder="www.yourcompany.com" />
          <Input label="GSTIN" value={form.company_gstin || ''} onChange={(e) => setForm((p) => ({ ...p, company_gstin: e.target.value.toUpperCase() }))} maxLength={15} placeholder="22AAAAA0000A1Z5" />
          <Input label="PAN" value={form.company_pan || ''} onChange={(e) => setForm((p) => ({ ...p, company_pan: e.target.value.toUpperCase() }))} maxLength={10} />
          <Input label="Subject To (Jurisdiction)" value={form.subject_to || ''} onChange={f('subject_to')} placeholder="e.g. Subject to MUMBAI Jurisdiction" containerClassName="col-span-2" />
          <Input label="God Name (Print Header)" value={form.god_name || ''} onChange={f('god_name')} containerClassName="col-span-2" placeholder="e.g. || Shri Ganeshaya Namah || (shown at top of invoice)" />
        </div>

        {/* Toggles row */}
        <div className="mt-4 grid grid-cols-2 gap-x-8 divide-y divide-gray-100 dark:divide-gray-700">
          <Toggle label="Show Website on Invoice" value={isOn('show_website')} onChange={tog('show_website')} />
          <Toggle label="Show Email on Invoice" value={isOn('show_email')} onChange={tog('show_email')} />
          <Toggle label="Is GST Registered" value={isOn('is_gst')} onChange={tog('is_gst')} hint="Show GSTIN on invoice" />
          <Toggle label="Use Rounding" value={isOn('use_round')} onChange={tog('use_round')} hint="Round off grand total" />
          <Toggle label="Show NOS (Quantity Unit)" value={isOn('show_nos')} onChange={tog('show_nos')} />
          <Toggle label="Show E-Way Bill No." value={isOn('show_eway')} onChange={tog('show_eway')} />
          <Toggle label="Print on Letterhead" value={isOn('print_letterhead')} onChange={tog('print_letterhead')} hint="Show company header on printout" />
          <Toggle label="Show Serial No. in Items" value={isOn('show_serial')} onChange={tog('show_serial')} />
        </div>

        {/* Logo + Signature */}
        <div className="mt-6 grid grid-cols-2 gap-6">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>Company Logo</p>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                {form.company_logo
                  ? <img src={form.company_logo} alt="Logo" className="w-full h-full object-contain p-1" />
                  : <Building2 size={22} style={{ color: 'var(--text-muted)' }} />}
              </div>
              <div className="space-y-1.5">
                <input type="file" ref={logoRef} accept="image/*" className="hidden" onChange={handleLogoUpload} />
                <Button variant="outline" size="sm" icon={Upload} onClick={() => logoRef.current?.click()}>
                  {form.company_logo ? 'Change Logo' : 'Upload Logo'}
                </Button>
                {form.company_logo && (
                  <button onClick={() => setForm((p) => ({ ...p, company_logo: '' }))}
                    className="block text-[11px] text-red-500 hover:text-red-600">Remove</button>
                )}
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>PNG/JPG · max 500KB</p>
              </div>
            </div>
          </div>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>Authorised Signature</p>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                {form.company_signature
                  ? <img src={form.company_signature} alt="Sig" className="w-full h-full object-contain p-1" />
                  : <FileText size={22} style={{ color: 'var(--text-muted)' }} />}
              </div>
              <div className="space-y-1.5">
                <input type="file" ref={sigRef} accept="image/*" className="hidden" onChange={handleSigUpload} />
                <Button variant="outline" size="sm" icon={Upload} onClick={() => sigRef.current?.click()}>
                  {form.company_signature ? 'Change Sig' : 'Upload Signature'}
                </Button>
                {form.company_signature && (
                  <button onClick={() => setForm((p) => ({ ...p, company_signature: '' }))}
                    className="block text-[11px] text-red-500 hover:text-red-600">Remove</button>
                )}
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>PNG/JPG · max 300KB</p>
              </div>
            </div>
          </div>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>Company Stamp</p>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                {form.company_stamp
                  ? <img src={form.company_stamp} alt="Stamp" className="w-full h-full object-contain p-1" />
                  : <Printer size={22} style={{ color: 'var(--text-muted)' }} />}
              </div>
              <div className="space-y-1.5">
                <input type="file" ref={stampRef} accept="image/*" className="hidden" onChange={handleStampUpload} />
                <Button variant="outline" size="sm" icon={Upload} onClick={() => stampRef.current?.click()}>
                  {form.company_stamp ? 'Change Stamp' : 'Upload Stamp'}
                </Button>
                {form.company_stamp && (
                  <button onClick={() => setForm((p) => ({ ...p, company_stamp: '' }))}
                    className="block text-[11px] text-red-500 hover:text-red-600">Remove</button>
                )}
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>PNG/JPG · max 500KB</p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── EMAIL SETTINGS ── */}
      <Section title="Email Settings" icon={Mail} description="Email configuration for sending invoices">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Company Email" type="email" value={form.company_email || ''} onChange={f('company_email')} placeholder="yourname@company.com" />
          <Input label="Email Password (SMTP)" type="password" value={form.email_password || ''} onChange={f('email_password')} placeholder="App password for sending" />
          <Input label="SMTP Server" value={form.smtp_server || ''} onChange={f('smtp_server')} placeholder="e.g. smtp.gmail.com" />
          <Input label="SMTP Port" value={form.smtp_port || '587'} onChange={f('smtp_port')} placeholder="587" />
          <Input label="Intro Letter File" value={form.intro_letter_file || ''} onChange={f('intro_letter_file')} placeholder="IntroductionLetter.pdf path" containerClassName="col-span-2" />
        </div>
        <div className="mt-3 divide-y divide-gray-100 dark:divide-gray-700">
          <Toggle label="Show Email ID on Invoice" value={isOn('show_email')} onChange={tog('show_email')} />
          <Toggle label="Enable Email Sending" value={isOn('email_enabled')} onChange={tog('email_enabled')} hint="Send invoice directly via email" />
        </div>
      </Section>

      {/* ── BANK DETAILS ── */}
      <Section title="Bank Details" icon={CreditCard} description="Shown in the footer of every invoice">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Account / Beneficiary Name" value={form.bank_account_name || ''} onChange={f('bank_account_name')} containerClassName="col-span-2" placeholder="e.g. Miracle Technologies" hint="Displayed as first 'Bank Name' line on invoice" />
          <Input label="Bank Name" value={form.bank_name || ''} onChange={f('bank_name')} />
          <Input label="Account Number" value={form.bank_account || ''} onChange={f('bank_account')} />
          <Input label="IFSC Code" value={form.bank_ifsc || ''} onChange={(e) => setForm((p) => ({ ...p, bank_ifsc: e.target.value.toUpperCase() }))} maxLength={11} />
          <Input label="Branch" value={form.bank_branch || ''} onChange={f('bank_branch')} />
          <Input label="Default GST %" value={form.default_gst || '18'} onChange={f('default_gst')} type="number" hint="Default GST rate for new items" />
          <Input label="Account Type" value={form.bank_account_type || 'Current'} onChange={f('bank_account_type')} placeholder="Current / Savings" />
        </div>
      </Section>

      {/* ── INVOICE SETTINGS ── */}
      <Section title="Invoice Settings" icon={Hash} description="Numbering format and default content">
        <div className="grid grid-cols-3 gap-4">
          <Input label="Invoice Prefix" value={form.invoice_prefix || 'INV'} onChange={f('invoice_prefix')} hint="e.g. INV, BILL, MT" />
          <Input label="Initial / Starting No." type="number" min="1" value={form.invoice_sequence || '1'} onChange={f('invoice_sequence')} hint="Next invoice sequence" />
          <Select label="Reset On" value={form.invoice_reset || 'never'} onChange={f('invoice_reset')}>
            <option value="never">Never</option>
            <option value="yearly">Every Year (Apr)</option>
            <option value="monthly">Every Month</option>
          </Select>
          <Input label="Invoice Number Format" value={form.invoice_number_format || 'PREFIX/SEQ/FY'} onChange={f('invoice_number_format')} hint="PREFIX, SEQ, FY, YEAR → e.g. PREFIX/SEQ/FY gives INV/0001/26-27" containerClassName="col-span-3" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <Input label="Financial Year Start" type="date" value={form.fy_start || ''} onChange={f('fy_start')} hint="e.g. 01/04/2026" />
          <Input label="Financial Year End" type="date" value={form.fy_end || ''} onChange={f('fy_end')} hint="e.g. 31/03/2027" />
        </div>
        <div className="mt-4">
          <Textarea label="Default Terms & Conditions" value={form.invoice_terms || ''} onChange={f('invoice_terms')} rows={4}
            placeholder="Enter terms line by line. Each line becomes a numbered term on the invoice..." />
        </div>
        <div className="mt-4">
          <Textarea label="Declaration (TDS / Legal)" value={form.declaration || ''} onChange={f('declaration')} rows={3}
            placeholder="TDS declaration or other legal text shown at bottom of invoice..." />
        </div>
        <div className="mt-4 divide-y divide-gray-100 dark:divide-gray-700">
          <Toggle label="Show NOS (Number of Sets)" value={isOn('show_nos')} onChange={tog('show_nos')} />
          <Toggle label="Show F-Way Bill No." value={isOn('show_fway')} onChange={tog('show_fway')} />
          <Toggle label="Show E-Way Bill No." value={isOn('show_eway')} onChange={tog('show_eway')} />
          <Toggle label="Use Rounding on Grand Total" value={isOn('use_round')} onChange={tog('use_round')} />
        </div>
      </Section>

      {/* ── PRINT SETTINGS ── */}
      <Section title="Print Settings" icon={Printer} description="Control what appears on printed invoices">
        <div className="grid grid-cols-2 gap-4">
          <Select label="Print Mode" value={form.print_mode || 'letterhead'} onChange={f('print_mode')}>
            <option value="letterhead">With Letterhead (Logo + Header)</option>
            <option value="plain">Without Letterhead (Plain)</option>
            <option value="both">Ask Every Time</option>
          </Select>
          <Input label="Copies to Print" type="number" min="1" max="5" value={form.print_copies || '1'} onChange={f('print_copies')} hint="Number of copies per print" />
        </div>
        <div className="mt-3 divide-y divide-gray-100 dark:divide-gray-700">
          <Toggle label="Print Letterhead (Company Header)" value={isOn('print_letterhead')} onChange={tog('print_letterhead')} hint="Show company name/logo/address on printout" />
          <Toggle label="Print Signature on Invoice" value={isOn('print_signature')} onChange={tog('print_signature')} hint="Show uploaded signature image" />
          <Toggle label="Print Serial No. in Items" value={isOn('show_serial')} onChange={tog('show_serial')} />
        </div>
      </Section>

      {/* ── AUTO BACKUP ── */}
      <Section title="Auto Backup" icon={HardDrive} description="Automatic database backup settings">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Backup Path / Folder" value={form.backup_path || ''} onChange={f('backup_path')} placeholder="e.g. F:\\MyBackups\\" containerClassName="col-span-2" />
          <Input label="Backup Every (Days)" type="number" min="1" value={form.backup_day || '7'} onChange={f('backup_day')} hint="e.g. 7 = weekly backup" />
        </div>
        <div className="mt-3">
          <Toggle label="Enable Auto Backup" value={isOn('auto_backup')} onChange={tog('auto_backup')} hint="Automatically backup database at set interval" />
        </div>
        <div className="flex gap-3 mt-4">
          <Button icon={Download} variant="secondary" loading={backupLoading} onClick={handleBackupExport}>Export Backup (.sbak)</Button>
          <Button icon={Upload} variant="outline" loading={importLoading} onClick={handleBackupImport}>Import Backup (.sbak)</Button>
        </div>
        {/* ── Security notice ── */}
        <div className="mt-4 flex items-start gap-2.5 px-3 py-2.5 rounded-lg"
          style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <Shield size={13} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-semibold text-blue-600 dark:text-blue-400">Machine-Locked Backups: </span>
            Backup files (.sbak) are cryptographically signed and locked to this device.
            They cannot be opened or restored on any other computer, protecting your data from unauthorised access.
          </p>
        </div>
        <p className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>
          Stored at: <span className="font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)' }}>%APPDATA%/gst-billing-app/database.db</span>
        </p>
      </Section>

      {/* ── TERMS FOR QUOTATION ── */}
      <Section title="Terms for Quotation" icon={List} description="Default terms shown on every quotation">
        <p className="text-[12px] mb-3" style={{ color: 'var(--text-muted)' }}>
          These terms appear on all quotations. Edit the text for each term.
        </p>
        <div className="space-y-2">
          {quotTerms.map((term, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg text-[12px] font-bold flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{idx + 1}</span>
              <input
                className="flex-1 px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                value={term}
                onChange={(e) => updateQuotTerm(idx, e.target.value)}
              />
              <button onClick={() => setQuotTerms(prev => prev.filter((_, i) => i !== idx))}
                className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded">✕</button>
            </div>
          ))}
        </div>
        <button onClick={() => setQuotTerms(prev => [...prev, ''])}
          className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium">+ Add Term</button>
      </Section>

      {/* ── LICENSE INFO ── */}
      <Section title="Software License" icon={Shield} description="Your software license status and expiry">
        {licenseInfo && licenseInfo.valid ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: licenseInfo.warn ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${licenseInfo.warn ? 'rgba(245,158,11,0.25)' : 'rgba(34,197,94,0.25)'}` }}>
              <CheckCircle2 size={16} className={licenseInfo.warn ? 'text-amber-500' : 'text-green-500'} />
              <div>
                <p className={`text-[13px] font-semibold ${licenseInfo.warn ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                  {licenseInfo.warn ? `License expiring soon — ${licenseInfo.days_left} day(s) left` : 'License Active'}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Expiry Date: <span className="font-semibold">{licenseInfo.expiry_date}</span>
                  {licenseInfo.customer_name && <> &nbsp;·&nbsp; Licensed to: <span className="font-semibold">{licenseInfo.customer_name}</span></>}
                </p>
              </div>
            </div>
            {licenseInfo.warn && (
              <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                Please contact your software provider for renewal. Renewal requires a personal call.
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <AlertTriangle size={16} className="text-red-500" />
            <div>
              <p className="text-[13px] font-semibold text-red-500">
                {licenseInfo?.reason === 'expired' ? 'License Expired' : 'No License Found'}
              </p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Contact your software provider to activate or renew your license.
              </p>
            </div>
          </div>
        )}
      </Section>

      {/* ── SAVE BUTTON ── */}
      <div className="flex justify-end">
        <Button icon={saved ? CheckCircle2 : Save} loading={loading} onClick={handleSave} size="lg"
          variant={saved ? 'success' : 'primary'}>
          {saved ? 'Saved!' : 'Save All Settings'}
        </Button>
      </div>

      {/* ── LOGIN CREDENTIALS ── */}
      <Section title="Login Credentials" icon={Lock} description="Change your app username and password">
        <p className="text-[12px] mb-4 px-3 py-2.5 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
          Current username: <span className="font-bold">{settings.auth_username || 'admin'}</span>
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Input label="New Username" value={pwForm.newUsername}
            onChange={(e) => setPwForm((p) => ({ ...p, newUsername: e.target.value }))}
            placeholder="Enter new username" containerClassName="col-span-2" />
          <Input label="New Password" type="password" value={pwForm.newPassword}
            onChange={(e) => setPwForm((p) => ({ ...p, newPassword: e.target.value }))}
            placeholder="Min 4 characters" />
          <Input label="Confirm Password" type="password" value={pwForm.confirmPassword}
            onChange={(e) => setPwForm((p) => ({ ...p, confirmPassword: e.target.value }))}
            placeholder="Repeat password" />
        </div>
        <div className="mt-4">
          <Button icon={Lock} loading={pwLoading} onClick={handleChangeCredentials} variant="secondary">
            Update Credentials
          </Button>
        </div>
      </Section>

    </div>
  )
}
