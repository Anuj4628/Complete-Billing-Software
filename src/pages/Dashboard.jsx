import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { TrendingUp, FileText, Package, AlertTriangle, Eye, Plus, UserPlus, ArrowUpRight, IndianRupee, Bell } from 'lucide-react'
import { StatCard } from '../components/ui/Card.jsx'
import { Table } from '../components/ui/Table.jsx'
import { StatusBadge } from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import { formatCurrency, formatDate } from '../utils/formatters.js'
import { useSettingsStore } from '../store/useSettingsStore.js'

const PIE_COLORS = ['#2563eb', '#10b981', '#f59e0b']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div
      className="px-3 py-2.5 rounded-xl text-[12px] shadow-lg"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
      }}
    >
      <p className="font-semibold mb-1">{label}</p>
      <p style={{ color: 'var(--text-secondary)' }}>{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [recentInvoices, setRecentInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [reminderCount, setReminderCount] = useState(0)
  const navigate = useNavigate()
  const { showToast, settings } = useSettingsStore()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [summaryRes, invoiceRes, unpaidRes] = await Promise.all([
        window.api.reports.getSalesSummary(),
        window.api.invoices.getAll({ page: 1, limit: 8, status: 'final' }),
        window.api.invoices.getAll({ page: 1, limit: 500, status: 'final' }),
      ])
      if (summaryRes.success) setSummary(summaryRes.data)
      else showToast(summaryRes.error, 'error')
      if (invoiceRes.success) setRecentInvoices(invoiceRes.data)
      if (unpaidRes.success) {
        const today = new Date(); today.setHours(0,0,0,0)
        const alerts = unpaidRes.data.filter(inv => {
          if (inv.payment_status !== 'unpaid' && inv.payment_status !== 'partial') return false
          if (!inv.due_date) return false
          const d = new Date(inv.due_date); d.setHours(0,0,0,0)
          return d <= today || (d - today) / 86400000 <= 7
        })
        setReminderCount(alerts.length)
      }
    } catch { showToast('Failed to load dashboard', 'error') }
    finally { setLoading(false) }
  }

  const monthlyData = (summary?.monthlySales || []).map((m) => ({
    month: m.month,
    sales: parseFloat(m.total || 0),
  }))

  const pieData = summary
    ? [
        { name: 'CGST', value: parseFloat(summary.mtd?.total_cgst || 0) },
        { name: 'SGST', value: parseFloat(summary.mtd?.total_sgst || 0) },
        { name: 'IGST', value: parseFloat(summary.mtd?.total_igst || 0) },
      ].filter((d) => d.value > 0)
    : []

  const invoiceColumns = [
    {
      key: 'invoice_number',
      label: 'Invoice No',
      render: (v) => (
        <span className="font-mono text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>{v}</span>
      ),
    },
    { key: 'customer_name', label: 'Customer' },
    { key: 'invoice_date', label: 'Date', render: (v) => formatDate(v) },
    {
      key: 'grand_total',
      label: 'Amount',
      render: (v) => (
        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(v)}</span>
      ),
    },
    { key: 'payment_status', label: 'Payment', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'id',
      label: '',
      render: (v) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/invoices/${v}`) }}
          className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
        >
          <Eye size={14} />
        </button>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-bold" style={{ color: 'var(--text-primary)' }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'} 👋
          </h2>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Here's what's happening with your business today.
          </p>
        </div>
        <div className="flex gap-2">
          <Button icon={Plus} onClick={() => navigate('/invoices/new')}>New Invoice</Button>
          <Button icon={UserPlus} variant="outline" onClick={() => navigate('/customers')}>Add Customer</Button>
          <Button icon={Package} variant="outline" onClick={() => navigate('/products')}>Add Product</Button>
          {reminderCount > 0 && (
            <button
              onClick={() => navigate('/reminders')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
              <Bell size={15} className="animate-pulse" />
              {reminderCount} Payment Alert{reminderCount > 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="Sales This Month"
          value={formatCurrency(summary?.mtd?.total_sales || 0)}
          icon={IndianRupee}
          iconColor="text-blue-600"
          bg="bg-blue-50 dark:bg-blue-900/20"
          trend={`${summary?.mtd?.invoice_count || 0} invoices raised`}
        />
        <StatCard
          title="Total Invoices"
          value={summary?.mtd?.invoice_count || 0}
          icon={FileText}
          iconColor="text-violet-600"
          bg="bg-violet-50 dark:bg-violet-900/20"
        />
        <StatCard
          title="Low Stock Items"
          value={summary?.lowStockCount || 0}
          icon={AlertTriangle}
          iconColor={summary?.lowStockCount > 0 ? 'text-red-600' : 'text-emerald-600'}
          bg={summary?.lowStockCount > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}
          trend="Items below minimum"
        />
        <StatCard
          title="Pending Receivables"
          value={formatCurrency(summary?.pendingReceivables || 0)}
          icon={TrendingUp}
          iconColor="text-amber-600"
          bg="bg-amber-50 dark:bg-amber-900/20"
          trend="Outstanding balance"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-3 gap-4">
        <div
          className="col-span-2 p-5 rounded-2xl"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                Monthly Revenue
              </h3>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Last 6 months</p>
            </div>
          </div>
          {monthlyData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] gap-2">
              <BarChart className="opacity-20" size={32} />
              <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>No data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} margin={{ top: 0, right: 4, left: -10, bottom: 0 }} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(37,99,235,0.05)', radius: 6 }} />
                <Bar dataKey="sales" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div
          className="p-5 rounded-2xl"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <h3 className="text-[13px] font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>
            Tax Breakdown
          </h3>
          <p className="text-[11px] mb-3" style={{ color: 'var(--text-muted)' }}>Month to date</p>
          {pieData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] gap-2">
              <div className="w-8 h-8 rounded-full border-2 border-dashed opacity-20" style={{ borderColor: 'var(--text-muted)' }} />
              <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>No tax data</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" outerRadius={72} innerRadius={40} dataKey="value" paddingAngle={3}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent Invoices */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <h3 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Invoices</h3>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Latest finalized invoices</p>
          </div>
          <button
            onClick={() => navigate('/invoices')}
            className="flex items-center gap-1 text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            View all <ArrowUpRight size={13} />
          </button>
        </div>
        <Table
          columns={invoiceColumns}
          data={recentInvoices}
          loading={false}
          emptyMessage="No invoices yet. Create your first invoice!"
          onRowClick={(row) => navigate(`/invoices/${row.id}`)}
        />
      </div>
    </div>
  )
}
