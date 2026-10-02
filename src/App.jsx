import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Customers from './pages/Customers.jsx'
import Products from './pages/Products.jsx'
import InvoiceList from './pages/billing/InvoiceList.jsx'
import CreateInvoice from './pages/billing/CreateInvoice.jsx'
import InvoiceDetail from './pages/billing/InvoiceDetail.jsx'
import PurchaseList from './pages/billing/PurchaseList.jsx'
import PurchaseInvoice from './pages/billing/PurchaseInvoice.jsx'
import PurchaseDetail from './pages/billing/PurchaseDetail.jsx'
import Quotation from './pages/Quotation.jsx'
import CreateQuotation from './pages/billing/CreateQuotation.jsx'
import QuotationDetail from './pages/billing/QuotationDetail.jsx'
import Payments from './pages/Payments.jsx'
import JournalVoucher from './pages/JournalVoucher.jsx'
import Reports from './pages/Reports.jsx'
import Settings from './pages/Settings.jsx'
import Reminders from './pages/Reminders.jsx'
import Login from './pages/Login.jsx'
import LicenseExpired from './pages/LicenseExpired.jsx'
import OwnerPanel from './pages/OwnerPanel.jsx'
import RegistrationScreen from './pages/RegistrationScreen.jsx'
import { useSettingsStore } from './store/useSettingsStore.js'
import PartyLedger from './pages/PartyLedger.jsx'
import StockLedger from './pages/StockLedger.jsx'
import { CheckCircle, XCircle, X, Shield, AlertTriangle } from 'lucide-react'

function Toast() {
  const { toast, clearToast } = useSettingsStore()
  if (!toast) return null
  return (
    <div className="toast-container">
      <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
        {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
        <span className="flex-1">{toast.message}</span>
        <button onClick={clearToast} className="opacity-60 hover:opacity-100"><X size={14} /></button>
      </div>
    </div>
  )
}

function ExpiryWarning({ daysLeft, onOwnerOpen }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed || daysLeft === null || daysLeft <= 0 || daysLeft > 10) return null
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 text-[12px] font-medium"
      style={{ background: daysLeft <= 3 ? '#dc2626' : '#d97706', color: '#fff' }}
    >
      <AlertTriangle size={14} className="flex-shrink-0" />
      <span className="flex-1">
        License expires in <strong>{daysLeft} day{daysLeft !== 1 ? 's' : ''}</strong>. Contact your software provider to renew.
      </span>
      <button
        onClick={onOwnerOpen}
        className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-white/40 hover:bg-white/20 transition-colors flex items-center gap-1"
      >
        <Shield size={11} /> Owner
      </button>
      <button onClick={() => setDismissed(true)} className="opacity-70 hover:opacity-100 ml-1">
        <X size={13} />
      </button>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#0f172a' }}>
      <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-[13px]" style={{ color: '#475569' }}>Loading...</p>
    </div>
  )
}

function App() {
  const { darkMode, loadSettings } = useSettingsStore()
  const [isLoggedIn, setIsLoggedIn]         = useState(sessionStorage.getItem('gst_auth') === '1')
  const [licenseInfo, setLicenseInfo]       = useState(null)
  const [licenseLoaded, setLicenseLoaded]   = useState(false)
  const [showOwnerPanel, setShowOwnerPanel] = useState(false)
  const [machineId, setMachineId]           = useState('')

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [darkMode])

  useEffect(() => { if (isLoggedIn) loadSettings() }, [isLoggedIn])

  async function checkLicense() {
    try {
      const res = await window.api?.license?.info?.()
      if (res) {
        setLicenseInfo(res)
        if (res.machine_id) setMachineId(res.machine_id)
      } else {
        setLicenseInfo({ valid: true, days_left: 999 })
      }
    } catch {
      setLicenseInfo({ valid: true, days_left: 999 })
    } finally {
      setLicenseLoaded(true)
    }
  }

  useEffect(() => { checkLicense() }, [])

  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); window.location.hash = '/invoices/new' }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!licenseLoaded) return <LoadingScreen />

  // ── STEP 1: Customer ne abhi register nahi kiya ──
  if (licenseInfo?.reason === 'not_registered') {
    return (
      <RegistrationScreen
        machineId={licenseInfo.machine_id || machineId}
        onRegistered={() => {
          setLicenseLoaded(false)
          checkLicense()
        }}
      />
    )
  }

  // ── STEP 2: Register ho gaya but owner ne activate nahi kiya ──
  if (licenseInfo?.reason === 'pending_activation') {
    return (
      <>
        <LicenseExpired
          licenseInfo={licenseInfo}
          machineId={licenseInfo.machine_id || machineId}
          onRenewed={() => { setLicenseLoaded(false); checkLicense() }}
        />
      </>
    )
  }

  // ── STEP 3: License expired ya machine mismatch ──
  const isBlocked = licenseInfo && (!licenseInfo.valid || licenseInfo.reason === 'no_license')
  if (isBlocked) {
    return (
      <LicenseExpired
        licenseInfo={licenseInfo}
        machineId={licenseInfo.machine_id || machineId}
        onRenewed={() => { setLicenseLoaded(false); checkLicense() }}
      />
    )
  }

  // ── STEP 4: License valid — login screen ──
  if (!isLoggedIn) return <Login onLogin={() => setIsLoggedIn(true)} />

  // ── STEP 5: Logged in — full app ──
  const daysLeft = licenseInfo?.days_left ?? null

  return (
    <HashRouter>
      <Toast />
      <ExpiryWarning daysLeft={daysLeft} onOwnerOpen={() => setShowOwnerPanel(true)} />
      {showOwnerPanel && (
        <OwnerPanel
          onClose={() => {
            setShowOwnerPanel(false)
            checkLicense()
          }}
        />
      )}
      <Routes>
        <Route
          path="/"
          element={
            <Layout
              onLogout={() => { sessionStorage.removeItem('gst_auth'); setIsLoggedIn(false) }}
              onOwnerOpen={() => setShowOwnerPanel(true)}
              licenseInfo={licenseInfo}
            />
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"          element={<Dashboard />} />
          <Route path="customers"          element={<Customers />} />
          <Route path="products"           element={<Products />} />
          <Route path="invoices"           element={<InvoiceList />} />
          <Route path="invoices/new"       element={<CreateInvoice />} />
          <Route path="invoices/:id/edit"  element={<CreateInvoice />} />
          <Route path="invoices/:id"       element={<InvoiceDetail />} />
          <Route path="purchases"          element={<PurchaseList />} />
          <Route path="purchases/new"      element={<PurchaseInvoice />} />
          <Route path="purchases/:id"      element={<PurchaseDetail />} />
          <Route path="purchases/:id/edit" element={<PurchaseInvoice />} />
          <Route path="quotations"         element={<Quotation />} />
          <Route path="quotations/new"     element={<CreateQuotation />} />
          <Route path="quotations/:id"     element={<QuotationDetail />} />
          <Route path="quotations/:id/edit" element={<CreateQuotation />} />
          <Route path="payments"           element={<Payments />} />
          <Route path="journals"           element={<JournalVoucher />} />
          <Route path="reports"            element={<Reports />} />
          <Route path="reminders"          element={<Reminders />} />
          <Route path="settings"           element={<Settings />} />
          <Route path="party-ledger"       element={<PartyLedger />} />
          <Route path="stock-ledger"       element={<StockLedger />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
