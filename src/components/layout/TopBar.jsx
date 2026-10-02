import { Sun, Moon, Plus, LogOut, Bell, Shield } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettingsStore } from '../../store/useSettingsStore.js'

export default function TopBar({ title, onLogout, onOwnerOpen, licenseInfo }) {
  const { darkMode, toggleDarkMode, settings } = useSettingsStore()
  const navigate = useNavigate()
  const [reminderCount, setReminderCount] = useState(0)

  useEffect(() => {
    async function fetchReminderCount() {
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
          setReminderCount(count)
        }
      } catch (_) {}
    }
    fetchReminderCount()
    const interval = setInterval(fetchReminderCount, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const daysLeft = licenseInfo?.days_left ?? null
  const licWarn  = daysLeft !== null && daysLeft <= 10

  return (
    <header
      style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}
      className="h-[58px] flex items-center justify-between px-6 flex-shrink-0"
    >
      <div className="flex items-center gap-3">
        <h1 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2">

        {/* New Invoice CTA */}
        <button
          onClick={() => navigate('/invoices/new')}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-[13px] font-semibold rounded-lg transition-all duration-150 shadow-sm shadow-blue-600/30"
          title="New Invoice (Ctrl+N)"
        >
          <Plus size={14} strokeWidth={2.5} />
          New Invoice
        </button>

        {/* License expiry badge — only shows when <=10 days left */}
        {licWarn && (
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer"
            style={{
              background: daysLeft <= 3 ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
              color: daysLeft <= 3 ? '#dc2626' : '#d97706',
            }}
            onClick={onOwnerOpen}
            title="Click to open Owner Panel"
          >
            <Shield size={12} />
            {daysLeft <= 0 ? 'Expired' : `${daysLeft}d left`}
          </div>
        )}

        {/* Reminder bell */}
        <button
          onClick={() => navigate('/reminders')}
          className="relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-orange-50 dark:hover:bg-orange-900/20"
          style={{ color: reminderCount > 0 ? '#ea580c' : 'var(--text-secondary)' }}
          title={reminderCount > 0 ? `${reminderCount} overdue payment${reminderCount > 1 ? 's' : ''}` : 'Reminders'}
        >
          <Bell size={16} className={reminderCount > 0 ? 'animate-pulse' : ''} />
          {reminderCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
              {reminderCount > 9 ? '9+' : reminderCount}
            </span>
          )}
        </button>

        <div className="w-px h-5 bg-gray-200 dark:bg-white/10 mx-1" />

        {/* Dark mode toggle */}
        <button
          onClick={toggleDarkMode}
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100 dark:hover:bg-white/8"
          style={{ color: 'var(--text-secondary)' }}
          title="Toggle theme"
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Owner Panel button */}
        <button
          onClick={onOwnerOpen}
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-amber-50 dark:hover:bg-amber-900/20"
          style={{ color: licWarn ? '#f59e0b' : 'var(--text-muted)' }}
          title="Owner Panel"
        >
          <Shield size={15} />
        </button>

        {/* Logout */}
        <button
          onClick={() => {
            if (window.confirm('Are you sure you want to logout?')) onLogout?.()
          }}
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500"
          style={{ color: 'var(--text-secondary)' }}
          title="Logout"
        >
          <LogOut size={16} />
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-[12px] font-bold ml-1 ring-2 ring-blue-200 dark:ring-blue-900">
          {(settings?.company_name || 'G').charAt(0).toUpperCase()}
        </div>

      </div>
    </header>
  )
}
