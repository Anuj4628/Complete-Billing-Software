const variants = {
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-800',
  danger:  'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800',
  info:    'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-800',
  gray:    'bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-white/8 dark:text-slate-400 dark:ring-white/10',
  indigo:  'bg-blue-50 text-blue-700 ring-1 ring-indigo-200 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-800',
}

export default function Badge({ children, variant = 'gray', className = '' }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ status }) {
  const map = {
    paid:    { label: 'Paid',    variant: 'success' },
    unpaid:  { label: 'Unpaid',  variant: 'danger' },
    partial: { label: 'Partial', variant: 'warning' },
    draft:   { label: 'Draft',   variant: 'gray' },
    final:   { label: 'Final',   variant: 'indigo' },
  }
  const { label, variant } = map[status] || { label: status, variant: 'gray' }
  return <Badge variant={variant}>{label}</Badge>
}
