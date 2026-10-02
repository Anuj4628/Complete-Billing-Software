export default function Input({
  label,
  error,
  hint,
  className = '',
  containerClassName = '',
  required,
  prefix,
  suffix,
  ...props
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-sm pointer-events-none" style={{ color: 'var(--text-muted)' }}>
            {prefix}
          </span>
        )}
        <input
          className={`
            w-full rounded-lg border text-[13px] transition-all duration-150
            py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:cursor-not-allowed disabled:opacity-60
            ${error
              ? 'border-red-400 bg-red-50 dark:bg-red-900/10 focus:ring-red-400'
              : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 focus:bg-white dark:focus:bg-white/8'
            }
            ${prefix ? 'pl-7' : 'pl-3'}
            ${suffix ? 'pr-10' : 'pr-3'}
            ${className}
          `}
          style={{ color: 'var(--text-primary)' }}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 text-sm pointer-events-none" style={{ color: 'var(--text-muted)' }}>
            {suffix}
          </span>
        )}
      </div>
      {error && <p className="text-[11px] text-red-500 font-medium">{error}</p>}
      {hint && !error && <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  )
}

export function Textarea({ label, error, hint, className = '', containerClassName = '', required, ...props }) {
  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <textarea
        className={`
          w-full rounded-lg border text-[13px] transition-all duration-150 resize-y
          px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          disabled:cursor-not-allowed disabled:opacity-60
          ${error
            ? 'border-red-400 bg-red-50 dark:bg-red-900/10'
            : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/5'
          }
          ${className}
        `}
        style={{ color: 'var(--text-primary)' }}
        {...props}
      />
      {error && <p className="text-[11px] text-red-500 font-medium">{error}</p>}
      {hint && !error && <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  )
}

export function Select({ label, error, hint, className = '', containerClassName = '', required, children, ...props }) {
  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <select
        className={`
          w-full rounded-lg border text-[13px] transition-all duration-150
          px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer
          ${error
            ? 'border-red-400 bg-red-50 dark:bg-red-900/10'
            : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/5'
          }
          ${className}
        `}
        style={{ color: 'var(--text-primary)' }}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-[11px] text-red-500 font-medium">{error}</p>}
      {hint && !error && <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  )
}
