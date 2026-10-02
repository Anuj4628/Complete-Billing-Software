import { create } from 'zustand'
import { useSettingsStore } from './useSettingsStore.js'

export const useQuotationStore = create((set, get) => ({
  quotations: [],
  total: 0,
  page: 1,
  limit: 20,
  filters: {},
  loading: false,

  setFilters: (filters) => { set({ filters, page: 1 }); get().fetchQuotations() },
  setPage: (page) => { set({ page }); get().fetchQuotations() },

  fetchQuotations: async () => {
    const { page, limit, filters } = get()
    set({ loading: true })
    try {
      const res = await window.api.quotations.getAll({ page, limit, ...filters })
      if (res.success) set({ quotations: res.data, total: res.total })
      else useSettingsStore.getState().showToast(res.error, 'error')
    } catch (err) {
      useSettingsStore.getState().showToast(err.message, 'error')
    } finally {
      set({ loading: false })
    }
  },

  getNextNumber: async () => {
    try {
      const res = await window.api.quotations.getNextNumber()
      if (res.success) return res.data
      return ''
    } catch (err) {
      console.error('Error fetching quotation number:', err)
      return ''
    }
  },

  getById: async (id) => {
    const res = await window.api.quotations.getById(id)
    if (!res.success) useSettingsStore.getState().showToast(res.error, 'error')
    return res
  },

  createQuotation: async (data) => {
    const res = await window.api.quotations.create(data)
    if (res.success) {
      useSettingsStore.getState().showToast('Quotation created successfully', 'success')
      return { success: true, id: res.data.id, quotation_number: res.data.quotation_number }
    } else {
      useSettingsStore.getState().showToast(res.error, 'error')
      return { success: false, error: res.error }
    }
  },

  updateQuotation: async (data) => {
    const res = await window.api.quotations.update(data)
    if (res.success) {
      useSettingsStore.getState().showToast('Quotation updated successfully', 'success')
      return { success: true, id: res.data.id }
    } else {
      useSettingsStore.getState().showToast(res.error, 'error')
      return { success: false, error: res.error }
    }
  },

  deleteQuotation: async (id) => {
    const res = await window.api.quotations.delete(id)
    if (res.success) {
      useSettingsStore.getState().showToast('Quotation deleted', 'success')
      get().fetchQuotations()
      return { success: true }
    } else {
      useSettingsStore.getState().showToast(res.error, 'error')
      return { success: false, error: res.error }
    }
  },
}))
