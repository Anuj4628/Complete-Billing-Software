import { create } from 'zustand'
import { useSettingsStore } from './useSettingsStore.js'

export const useInvoiceStore = create((set, get) => ({
  invoices: [],
  total: 0,
  page: 1,
  limit: 20,
  filters: {},
  loading: false,

  setFilters: (filters) => { set({ filters, page: 1 }); get().fetchInvoices() },
  setPage: (page) => { set({ page }); get().fetchInvoices() },

  fetchInvoices: async () => {
    const { page, limit, filters } = get()
    set({ loading: true })
    try {
      const res = await window.api.invoices.getAll({ page, limit, ...filters })
      if (res.success) set({ invoices: res.data, total: res.total })
      else useSettingsStore.getState().showToast(res.error, 'error')
    } finally {
      set({ loading: false })
    }
  },

  getById: async (id) => {
    const res = await window.api.invoices.getById(id)
    if (!res.success) useSettingsStore.getState().showToast(res.error, 'error')
    return res
  },

  createInvoice: async (data) => {
    const res = await window.api.invoices.create(data)
    if (res.success) {
      useSettingsStore.getState().showToast('Invoice created', 'success')
      return { success: true, id: res.data.id }
    } else {
      useSettingsStore.getState().showToast(res.error, 'error')
      return { success: false, error: res.error }
    }
  },

  updateInvoice: async (data) => {
    const res = await window.api.invoices.update(data)
    if (res.success) {
      useSettingsStore.getState().showToast('Invoice updated', 'success')
      return { success: true }
    } else {
      useSettingsStore.getState().showToast(res.error, 'error')
      return { success: false, error: res.error }
    }
  },

  deleteInvoice: async (id) => {
    const res = await window.api.invoices.delete(id)
    if (res.success) {
      useSettingsStore.getState().showToast('Invoice deleted', 'success')
      get().fetchInvoices()
      return { success: true }
    } else {
      useSettingsStore.getState().showToast(res.error, 'error')
      return { success: false, error: res.error }
    }
  },

  updateStatus: async (data) => {
    const res = await window.api.invoices.updateStatus(data)
    if (res.success) {
      useSettingsStore.getState().showToast('Status updated', 'success')
      return { success: true }
    } else {
      useSettingsStore.getState().showToast(res.error, 'error')
      return { success: false, error: res.error }
    }
  },
}))
