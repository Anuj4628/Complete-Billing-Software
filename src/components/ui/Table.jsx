import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Table({ columns, data, loading, emptyMessage = 'No records found', onRowClick }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest whitespace-nowrap ${col.className || ''}`}
                style={{ color: 'var(--text-muted)' }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-14">
                <div className="flex flex-col items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{ background: 'var(--surface-2)' }}>📋</div>
                  <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{emptyMessage}</span>
                </div>
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr
                key={row.id ?? idx}
                onClick={() => onRowClick?.(row)}
                className="transition-colors duration-100 group"
                style={{
                  borderBottom: '1px solid var(--border)',
                  cursor: onRowClick ? 'pointer' : 'default',
                }}
                onMouseEnter={(e) => { if (onRowClick) e.currentTarget.style.background = 'var(--surface-2)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 ${col.cellClassName || ''}`}
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export function Pagination({ page, limit, total, onPageChange }) {
  const totalPages = Math.ceil(total / limit)
  if (totalPages <= 1) return null

  const start = (page - 1) * limit + 1
  const end = Math.min(page * limit, total)

  return (
    <div
      className="flex items-center justify-between px-5 py-3.5"
      style={{ borderTop: '1px solid var(--border)' }}
    >
      <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
        Showing <b>{start}–{end}</b> of <b>{total}</b>
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-white/8"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ChevronLeft size={14} />
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let p
          if (totalPages <= 5) p = i + 1
          else if (page <= 3) p = i + 1
          else if (page >= totalPages - 2) p = totalPages - 4 + i
          else p = page - 2 + i
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className="w-7 h-7 rounded-lg text-[12px] font-semibold transition-colors"
              style={{
                background: p === page ? '#2563eb' : 'transparent',
                color: p === page ? 'white' : 'var(--text-secondary)',
              }}
            >
              {p}
            </button>
          )
        })}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-white/8"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
