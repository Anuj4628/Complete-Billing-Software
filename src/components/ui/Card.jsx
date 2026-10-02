export default function Card({ children, className = '', title, action }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        borderRadius: '12px',
      }}
      className={`overflow-hidden ${className}`}
    >
      {(title || action) && (
        <div
          style={{ borderBottom: '1px solid var(--border)' }}
          className="flex items-center justify-between px-5 py-3.5"
        >
          {title && (
            <h3 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h3>
          )}
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

export function StatCard({ title, value, icon: Icon, iconColor = 'text-blue-600', bg = 'bg-blue-50 dark:bg-blue-900/20', trend, trendUp, className = '' }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        borderRadius: '12px',
      }}
      className={`p-5 hover:shadow-md transition-shadow duration-200 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p
            className="text-[11px] font-semibold uppercase tracking-wider mb-1.5"
            style={{ color: 'var(--text-muted)' }}
          >
            {title}
          </p>
          <p
            className="text-[22px] font-bold truncate leading-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {value}
          </p>
          {trend && (
            <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
              {trend}
            </p>
          )}
        </div>
        {Icon && (
          <div className={`p-3 rounded-xl ${bg} flex-shrink-0`}>
            <Icon size={20} className={iconColor} />
          </div>
        )}
      </div>
    </div>
  )
}
