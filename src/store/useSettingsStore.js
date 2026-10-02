import { create } from 'zustand'

export const useSettingsStore = create((set, get) => ({
  darkMode: localStorage.getItem('darkMode') === 'true',
  settings: {},
  loading: false,
  toast: null,

  toggleDarkMode: () => {
    const next = !get().darkMode
    localStorage.setItem('darkMode', String(next))
    set({ darkMode: next })
    if (next) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  },

  loadSettings: async () => {
    set({ loading: true })
    try {
      const res = await window.api.settings.getAll()
      if (res.success) {
        const loaded = res.data || {}
        set({ settings: loaded })

        // Auto-migrate any legacy WebP or AVIF images in settings to PNG
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
          const keys = ['company_stamp', 'company_logo', 'company_signature']
          const updates = {}
          for (const key of keys) {
            const val = loaded[key]
            if (val && typeof val === 'string' && (val.startsWith('data:image/webp') || val.startsWith('data:image/avif'))) {
              try {
                const png = await new Promise((resolve) => {
                  const img = new Image()
                  img.crossOrigin = 'anonymous'
                  img.onload = () => {
                    const canvas = document.createElement('canvas')
                    canvas.width = img.naturalWidth || img.width
                    canvas.height = img.naturalHeight || img.height
                    const ctx = canvas.getContext('2d')
                    ctx.drawImage(img, 0, 0)
                    resolve(canvas.toDataURL('image/png'))
                  }
                  img.onerror = () => resolve(null)
                  img.src = val
                })
                if (png && png.startsWith('data:image/png')) {
                  updates[key] = png
                }
              } catch (_) {}
            }
          }
          if (Object.keys(updates).length > 0) {
            try {
              await window.api.settings.set(updates)
              set((s) => ({ settings: { ...s.settings, ...updates } }))
            } catch (_) {}
          }
        }
      }
    } finally {
      set({ loading: false })
    }
  },

  saveSettings: async (data) => {
    set({ loading: true })
    try {
      const res = await window.api.settings.set(data)
      if (res.success) {
        set((s) => ({ settings: { ...s.settings, ...data } }))
        get().showToast('Settings saved', 'success')
        return true
      } else {
        get().showToast(res.error, 'error')
        return false
      }
    } finally {
      set({ loading: false })
    }
  },

  showToast: (message, type = 'success') => {
    const id = Date.now()
    set({ toast: { id, message, type } })
    setTimeout(() => {
      set((s) => (s.toast?.id === id ? { toast: null } : s))
    }, 4000)
  },

  clearToast: () => set({ toast: null }),
}))
