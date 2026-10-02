import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, AlertCircle, Clock, CheckCircle, MessageCircle, Eye, RefreshCw } from 'lucide-react'
import { formatCurrency, formatDate } from '../utils/formatters.js'
import { useSettingsStore } from '../store/useSettingsStore.js'

function daysDiff(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  return Math.ceil((d - today) / (1000 * 60 * 60 * 24))
}

function UrgencyBadge({ days, type = 'payment' }) {
  if (days === null) return null
  if (days < 0) {
    const label = type === 'payment' ? `${Math.abs(days)}d overdue` : `Expired ${Math.abs(days)}d ago`
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">{label}</span>
  }
  if (days === 0) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">Due Today</span>
  if (days <= 3) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Due in {days}d</span>
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Due in {days}d</span>
}

export default function Reminders() {
  const navigate = useNavigate()
  const { settings, loadSettings } = useSettingsStore()

  const [overdueInvoices, setOverdueInvoices] = useState([])
  const [upcomingInvoices, setUpcomingInvoices] = useState([])
  const [expiringQuotations, setExpiringQuotations] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('payment')

  useEffect(() => {
    loadSettings()
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      // Load all unpaid / partial invoices
      const invRes = await window.api.invoices.getAll({
        page: 1, limit: 500, status: 'final',
      })
      if (invRes.success) {
        const unpaid = invRes.data.filter(inv =>
          inv.payment_status === 'unpaid' || inv.payment_status === 'partial'
        )
        const today = new Date(); today.setHours(0,0,0,0)
        const overdue = []
        const upcoming = []
        unpaid.forEach(inv => {
          const days = inv.due_date ? daysDiff(inv.due_date) : null
          if (days !== null && days < 0) overdue.push({ ...inv, _days: days })
          else if (days !== null && days <= 7) upcoming.push({ ...inv, _days: days })
          else if (days === null) {
            // No due date — flag if invoice is older than 30 days
            const invDays = daysDiff(inv.invoice_date)
            if (invDays === null || invDays < 0) overdue.push({ ...inv, _days: invDays !== null ? invDays : 0 })
          }
        })
        overdue.sort((a, b) => a._days - b._days)
        upcoming.sort((a, b) => a._days - b._days)
        setOverdueInvoices(overdue)
        setUpcomingInvoices(upcoming)
      }

      // Load quotations
      const quotRes = await window.api.quotations.getAll({ page: 1, limit: 500 })
      if (quotRes.success) {
        const expiring = quotRes.data
          .filter(q => q.valid_until && daysDiff(q.valid_until) !== null && daysDiff(q.valid_until) <= 7)
          .map(q => ({ ...q, _days: daysDiff(q.valid_until) }))
          .sort((a, b) => a._days - b._days)
        setExpiringQuotations(expiring)
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  function sendWhatsApp(inv) {
    const phone = inv.customer_phone?.replace(/\D/g, '')
    const companyName = settings?.company_name || 'Us'
    const days = inv._days
    let urgency = ''
    if (days < 0) urgency = `⚠️ This payment is *${Math.abs(days)} days overdue*. Please arrange payment at the earliest.\n\n`
    else if (days === 0) urgency = `⚠️ This payment is *due today*. Kindly make the payment today.\n\n`
    else urgency = `📅 This payment is due in *${days} days*. Please make arrangements.\n\n`

    const balance = parseFloat(inv.balance_due || inv.grand_total || 0)
    const message = `Dear ${inv.customer_name},\n\nThis is a friendly payment reminder from ${companyName}.\n\n${urgency}📄 Invoice No: ${inv.invoice_number}\n📅 Invoice Date: ${formatDate(inv.invoice_date)}${inv.due_date ? `\n🗓️ Due Date: ${formatDate(inv.due_date)}` : ''}\n💰 Amount Due: ₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n\nKindly arrange the payment at your earliest convenience.\n\nThank you for your business! 🙏\n\nRegards,\n${companyName}`

    const url = phone
      ? `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  function sendQuotWhatsApp(q) {
    const phone = q.customer_phone?.replace(/\D/g, '')
    const companyName = settings?.company_name || 'Us'
    const days = q._days
    let urgency = days < 0
      ? `⚠️ Your quotation has *expired ${Math.abs(days)} days ago*. Please contact us to renew it.\n\n`
      : days === 0
        ? `⚠️ Your quotation *expires today*! Confirm your order to lock in the price.\n\n`
        : `📅 Your quotation expires in *${days} days*. Please confirm your order soon.\n\n`

    const name = q.customer_name || 'Valued Customer'
    const message = `Dear ${name},\n\n${urgency}📋 Quotation No: ${q.quotation_number || q.id}\n📅 Valid Until: ${formatDate(q.valid_until)}\n💰 Total: ₹${parseFloat(q.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n\nPlease get in touch to confirm your order.\n\nRegards,\n${companyName}`

    const url = phone
      ? `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  const paymentCount = overdueInvoices.length + upcomingInvoices.length
  const expiryCount = expiringQuotations.length

  const tabs = [
    { id: 'payment', label: 'Payment Reminders', count: paymentCount, color: 'red' },
    { id: 'expiry', label: 'Expiry Reminders', count: expiryCount, color: 'orange' },
  ]

  return (
    <div className="space-y-4 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <Bell size={18} className="text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Reminders</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Payment dues & quotation expiry alerts</p>
          </div>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-white/8"
          style={{ color: 'var(--text-muted)' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard
          icon={AlertCircle}
          label="Overdue Invoices"
          count={overdueInvoices.length}
          color="red"
          sub={overdueInvoices.length > 0 ? `₹${overdueInvoices.reduce((s, i) => s + parseFloat(i.balance_due || i.grand_total || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} total` : 'All clear!'}
        />
        <SummaryCard
          icon={Clock}
          label="Due in 7 Days"
          count={upcomingInvoices.length}
          color="yellow"
          sub={upcomingInvoices.length > 0 ? `₹${upcomingInvoices.reduce((s, i) => s + parseFloat(i.balance_due || i.grand_total || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} total` : 'Nothing upcoming'}
        />
        <SummaryCard
          icon={CheckCircle}
          label="Expiring Quotations"
          count={expiringQuotations.length}
          color="orange"
          sub={expiringQuotations.length > 0 ? 'Need follow-up' : 'All good!'}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow'
                : 'hover:bg-gray-100 dark:hover:bg-white/8'
            }`}
            style={{ color: activeTab === tab.id ? undefined : 'var(--text-secondary)' }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeTab === 'payment' ? (
        <div className="space-y-4">
          {/* Overdue */}
          {overdueInvoices.length > 0 && (
            <Section title="Overdue Invoices" icon={AlertCircle} iconColor="text-red-500" count={overdueInvoices.length}>
              {overdueInvoices.map(inv => (
                <InvoiceReminderRow key={inv.id} inv={inv} onView={() => navigate(`/invoices/${inv.id}`)} onWhatsApp={() => sendWhatsApp(inv)} />
              ))}
            </Section>
          )}

          {/* Upcoming */}
          {upcomingInvoices.length > 0 && (
            <Section title="Due in Next 7 Days" icon={Clock} iconColor="text-yellow-500" count={upcomingInvoices.length}>
              {upcomingInvoices.map(inv => (
                <InvoiceReminderRow key={inv.id} inv={inv} onView={() => navigate(`/invoices/${inv.id}`)} onWhatsApp={() => sendWhatsApp(inv)} />
              ))}
            </Section>
          )}

          {overdueInvoices.length === 0 && upcomingInvoices.length === 0 && (
            <EmptyState icon={CheckCircle} message="No pending payment reminders!" sub="All invoices are paid or have no upcoming dues." color="green" />
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {expiringQuotations.length > 0 ? (
            <Section title="Expiring Quotations" icon={Clock} iconColor="text-orange-500" count={expiringQuotations.length}>
              {expiringQuotations.map(q => (
                <QuotationReminderRow key={q.id} q={q} onWhatsApp={() => sendQuotWhatsApp(q)} />
              ))}
            </Section>
          ) : (
            <EmptyState icon={CheckCircle} message="No expiring quotations!" sub="All quotations are valid or have no expiry date." color="green" />
          )}
        </div>
      )}
    </div>
  )
}

function SummaryCard({ icon: Icon, label, count, color, sub }) {
  const colors = {
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
  }
  return (
    <div className="rounded-xl p-4 flex items-center gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{count}</p>
        <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</p>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{sub}</p>
      </div>
    </div>
  )
}

function Section({ title, icon: Icon, iconColor, count, children }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
      <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
        <Icon size={15} className={iconColor} />
        <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</span>
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">{count}</span>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {children}
      </div>
    </div>
  )
}

function InvoiceReminderRow({ inv, onView, onWhatsApp }) {
  const balance = parseFloat(inv.balance_due || inv.grand_total || 0)
  return (
    <div className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-white/3 transition-colors">
      <div className="flex items-center gap-4 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-mono text-[12px] font-bold text-blue-600 dark:text-blue-400">{inv.invoice_number}</span>
            <UrgencyBadge days={inv._days} type="payment" />
          </div>
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{inv.customer_name}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Invoice: {formatDate(inv.invoice_date)}
            {inv.due_date ? ` · Due: ${formatDate(inv.due_date)}` : ''}
            {inv.customer_phone ? ` · 📱 ${inv.customer_phone}` : ''}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right">
          <p className="text-sm font-bold text-red-600 dark:text-red-400">{formatCurrency(balance)}</p>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {inv.payment_status === 'partial' ? 'Partial paid' : 'Unpaid'}
          </p>
        </div>
        <button
          onClick={onWhatsApp}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500 hover:bg-green-600 text-white transition-colors"
          title="Send WhatsApp reminder"
        >
          <MessageCircle size={13} />
          Remind
        </button>
        <button
          onClick={onView}
          className="p-1.5 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-white/8"
          style={{ color: 'var(--text-muted)' }}
          title="View invoice"
        >
          <Eye size={15} />
        </button>
      </div>
    </div>
  )
}

function QuotationReminderRow({ q, onWhatsApp }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-white/3 transition-colors">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-mono text-[12px] font-bold text-indigo-600 dark:text-indigo-400">
            {q.quotation_number || `Q-${q.id}`}
          </span>
          <UrgencyBadge days={q._days} type="expiry" />
        </div>
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          {q.customer_name || 'Unknown Customer'}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Valid Until: {formatDate(q.valid_until)}
          {q.customer_phone ? ` · 📱 ${q.customer_phone}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right">
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {formatCurrency(q.grand_total || 0)}
          </p>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Quotation value</p>
        </div>
        <button
          onClick={onWhatsApp}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500 hover:bg-green-600 text-white transition-colors"
          title="Send WhatsApp follow-up"
        >
          <MessageCircle size={13} />
          Follow Up
        </button>
      </div>
    </div>
  )
}

function EmptyState({ icon: Icon, message, sub, color }) {
  const colors = { green: 'text-green-500', blue: 'text-blue-500' }
  return (
    <div className="flex flex-col items-center justify-center py-16 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <Icon size={40} className={`${colors[color] || 'text-gray-400'} mb-3`} />
      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{message}</p>
      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>
    </div>
  )
}
