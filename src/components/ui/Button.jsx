import { Loader2 } from 'lucide-react'

const variants = {
  primary:   'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm shadow-blue-600/20 disabled:bg-blue-300',
  secondary: 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 dark:bg-white/8 dark:hover:bg-white/12 dark:text-slate-200 disabled:opacity-50',
  danger:    'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-sm shadow-red-600/20 disabled:bg-red-300',
  success:   'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-sm shadow-emerald-600/20 disabled:bg-emerald-300',
  ghost:     'bg-transparent hover:bg-slate-100 dark:hover:bg-white/8 text-slate-600 dark:text-slate-300',
  outline:   'border border-slate-200 dark:border-white/10 bg-transparent hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300',
}

const sizes = {
  sm: 'px-3 py-1.5 text-[12px]',
  md: 'px-4 py-2 text-[13px]',
  lg: 'px-5 py-2.5 text-[14px]',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  icon: Icon,
  onClick,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 rounded-lg font-semibold
        transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
        disabled:cursor-not-allowed
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : Icon ? (
        <Icon size={14} strokeWidth={2.5} />
      ) : null}
      {children}
    </button>
  )
}
