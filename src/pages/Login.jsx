import { useState } from 'react'
import { useSettingsStore } from '../store/useSettingsStore.js'
import { LogIn, Eye, EyeOff, Receipt } from 'lucide-react'

export default function Login({ onLogin }) {
  const [view, setView] = useState('login') // 'login' | 'forgot'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const { settings } = useSettingsStore()

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      // Always fetch fresh credentials from DB to avoid stale store state
      const res = await window.api?.settings?.getAll?.()
      const s = (res?.success ? res.data : null) || settings || {}
      const correctUser = s.auth_username || 'admin'
      const correctPass = s.auth_password || 'admin123'
      if (username === correctUser && password === correctPass) {
        sessionStorage.setItem('gst_auth', '1')
        onLogin()
      } else {
        setError('Invalid username or password')
      }
    } catch (err) {
      setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    
    if (newPassword.length < 4) {
      setError('Password must be at least 4 characters long')
      return
    }

    setLoading(true)
    try {
      const res = await window.api.license.verifyAndResetPassword({ phone, newPassword })
      if (res.success) {
        setSuccess('Password reset successfully! You can now login.')
        setView('login')
        setPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setError(res.error || 'Reset failed')
      }
    } catch {
      setError('Error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--sidebar-bg)' }}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 p-10"
        style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <Receipt size={18} className="text-white" />
          </div>
          <span className="text-white font-bold text-[15px]">GST Billing</span>
        </div>
        <div>
          <div className="w-12 h-1 bg-blue-600 rounded-full mb-6" />
          <h2 className="text-3xl font-bold text-white leading-snug mb-4">
            Manage invoices<br />
            <span className="text-blue-400">smarter & faster</span>
          </h2>
          <p className="text-white/40 text-[14px] leading-relaxed">
            Complete GST billing solution for Indian businesses. Create invoices, track inventory, and manage customers — all in one place.
          </p>
          <div className="mt-8 space-y-3">
            {['GST-compliant tax invoices', 'Inventory management', 'Financial reports'].map((f) => (
              <div key={f} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span className="text-white/50 text-[13px]">{f}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-white/20 text-[12px]">© {new Date().getFullYear()} Sunmarg Billing App</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6" style={{ background: 'var(--surface-2)' }}>
        <div className="w-full max-w-[380px]">
          <div className="mb-8">
            <h1 className="text-[26px] font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>
              {view === 'login' ? 'Welcome back' : 'Reset Password'}
            </h1>
            <p className="text-[14px]" style={{ color: 'var(--text-muted)' }}>
              {view === 'login' ? 'Sign in to your billing account' : 'Verify your registered phone to reset password'}
            </p>
          </div>

          <div
            className="p-7 rounded-2xl"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {view === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border text-[13px] transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent border-slate-200 dark:border-white/10 bg-white dark:bg-white/5"
                    style={{ color: 'var(--text-primary)' }}
                    placeholder="Enter username"
                    autoFocus
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setView('forgot')
                        setError('')
                        setSuccess('')
                      }}
                      className="text-[11px] font-semibold text-blue-500 hover:text-blue-600 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 pr-10 rounded-lg border text-[13px] transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent border-slate-200 dark:border-white/10 bg-white dark:bg-white/5"
                      style={{ color: 'var(--text-primary)' }}
                      placeholder="Enter password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors hover:text-blue-500"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-[12px] font-medium px-3.5 py-2.5 rounded-lg">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                    {error}
                  </div>
                )}

                {success && (
                  <div className="flex items-center gap-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 text-[12px] font-medium px-3.5 py-2.5 rounded-lg">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-all text-[13px] shadow-sm shadow-blue-600/30 mt-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <LogIn size={15} />
                  )}
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                    Registered Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="w-full px-3.5 py-2.5 rounded-lg border text-[13px] transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent border-slate-200 dark:border-white/10 bg-white dark:bg-white/5"
                    style={{ color: 'var(--text-primary)' }}
                    placeholder="10 digit mobile number"
                    autoFocus
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border text-[13px] transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent border-slate-200 dark:border-white/10 bg-white dark:bg-white/5"
                    style={{ color: 'var(--text-primary)' }}
                    placeholder="Enter new password"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border text-[13px] transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent border-slate-200 dark:border-white/10 bg-white dark:bg-white/5"
                    style={{ color: 'var(--text-primary)' }}
                    placeholder="Confirm new password"
                    required
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-[12px] font-medium px-3.5 py-2.5 rounded-lg">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <div className="flex gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setView('login')
                      setError('')
                    }}
                    className="flex-1 py-2.5 rounded-lg border border-slate-200 dark:border-white/10 text-[13px] font-semibold transition-all hover:bg-slate-50 dark:hover:bg-white/5"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    Back to Login
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-[2] flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-all text-[13px] shadow-sm shadow-blue-600/30"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Reset Password'
                    )}
                  </button>
                </div>
              </form>
            )}

            <p className="text-center text-[11px] mt-5" style={{ color: 'var(--text-muted)' }}>
              Default credentials: <span className="font-mono">admin / admin123</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
