import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

export default function SearchBar({ value, onChange, placeholder = 'Search...', debounce = 300, className = '' }) {
  const [local, setLocal] = useState(value || '')
  const timer = useRef(null)

  useEffect(() => { setLocal(value || '') }, [value])

  const handleChange = (e) => {
    const v = e.target.value
    setLocal(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange(v), debounce)
  }

  const clear = () => {
    setLocal('')
    clearTimeout(timer.current)
    onChange('')
  }

  return (
    <div className={`relative flex items-center ${className}`}>
      <Search size={14} className="absolute left-3 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
      <input
        type="text"
        value={local}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full pl-8 pr-8 py-2 text-[13px] rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent border-slate-200 dark:border-white/10 bg-white dark:bg-white/5"
        style={{ color: 'var(--text-primary)' }}
      />
      {local && (
        <button
          onClick={clear}
          className="absolute right-2.5 p-0.5 rounded transition-colors hover:text-blue-500"
          style={{ color: 'var(--text-muted)' }}
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}
