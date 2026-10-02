import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Package, FileText, BarChart3, Settings,
  ChevronLeft, ChevronRight, Receipt, ShoppingCart, FileCheck,
  CreditCard, BookOpen, Bell, BookMarked, Layers,
} from 'lucide-react'
import { useSettingsStore } from '../../store/useSettingsStore.js'

const navGroups = [
  {
    label: 'Data Entry',
    items: [
      { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/invoices',    icon: Receipt,          label: 'Sales Invoice' },
      { to: '/quotations',  icon: FileCheck,        label: 'Quotation' },
      { to: '/purchases',   icon: ShoppingCart,     label: 'Purchase Invoice' },
      { to: '/payments',    icon: CreditCard,       label: 'Payments/Receipts' },
      { to: '/journals',    icon: BookOpen,         label: 'Journal Voucher' },
      { to: '/products',    icon: Package,          label: 'Stock Master' },
    ],
  },
  {
    label: 'Master',
    items: [
      { to: '/customers',   icon: Users,      label: 'Customers' },
      { to: '/party-ledger', icon: BookMarked, label: 'Party Ledger' },
      { to: '/stock-ledger', icon: Layers,     label: 'Stock Ledger' },
      { to: '/reminders',  icon: Bell,       label: 'Reminders' },
      { to: '/reports',    icon: BarChart3, label: 'Reports' },
      { to: '/settings',   icon: Settings,  label: 'Settings' },
    ],
  },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { settings } = useSettingsStore()
  const [reminderBadge, setReminderBadge] = useState(0)

  useEffect(() => {
    async function fetchBadge() {
      try {
        const res = await window.api.invoices.getAll({ page: 1, limit: 500, status: 'final' })
        if (res.success) {
          const today = new Date(); today.setHours(0, 0, 0, 0)
          const count = res.data.filter(inv => {
            if (inv.payment_status !== 'unpaid' && inv.payment_status !== 'partial') return false
            if (!inv.due_date) return false
            const d = new Date(inv.due_date); d.setHours(0, 0, 0, 0)
            return d <= today
          }).length
          setReminderBadge(count)
        }
      } catch (_) {}
    }
    fetchBadge()
  }, [])

  return (
    <aside
      style={{ background: 'var(--sidebar-bg)' }}
      className={`flex flex-col h-full transition-all duration-300 ease-in-out border-r border-white/5 ${collapsed ? 'w-[64px]' : 'w-[220px]'}`}
    >
      {/* Brand */}
      <div className="flex items-center h-[58px] px-4 border-b border-white/5 overflow-hidden flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {settings?.company_logo ? (
            <img src={settings.company_logo} alt="logo" className="w-8 h-8 rounded-lg object-contain flex-shrink-0 ring-1 ring-white/10" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg">
              <FileText size={15} className="text-white" />
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white font-semibold text-[13px] truncate leading-tight">{settings?.company_name || 'Sunmarg Billing'}</p>
              <p className="text-white/30 text-[10px] font-medium tracking-wide">BILLING APP</p>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-2">
            {!collapsed && (
              <p className="text-white/20 text-[9px] font-bold tracking-widest uppercase px-3 pb-1.5 pt-2">{group.label}</p>
            )}
            {group.items.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 text-[12.5px] font-medium group relative
                   ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-white/45 hover:text-white/90 hover:bg-white/7'}`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={15} className="flex-shrink-0" />
                    {!collapsed && <span className="truncate">{label}</span>}
                    {collapsed && (
                      <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl border border-white/10 transition-opacity">
                        {label}
                      </div>
                    )}
                    {to === '/reminders' && reminderBadge > 0 && !collapsed && (
                      <span className="ml-auto px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-500 text-white leading-none">
                        {reminderBadge > 9 ? '9+' : reminderBadge}
                      </span>
                    )}
                    {to === '/reminders' && reminderBadge > 0 && collapsed && (
                      <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border border-gray-900 text-[8px] text-white font-bold flex items-center justify-center">
                        {reminderBadge > 9 ? '9' : reminderBadge}
                      </span>
                    )}
                    {isActive && !collapsed && to !== '/reminders' && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Collapse */}
      <div className="p-2 border-t border-white/5 flex-shrink-0">
        <button onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2.5 rounded-lg text-white/25 hover:bg-white/7 hover:text-white/70 transition-colors"
          title={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>
    </aside>
  )
}
