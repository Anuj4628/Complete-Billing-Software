import { create } from 'zustand'
import { useSettingsStore } from './useSettingsStore.js'

export const useCustomerStore = create((set, get) => ({
  customers: [],
  total: 0,
  page: 1,
  limit: 20,
  search: '',
  loading: false,

  setSearch: (search) => { set({ search, page: 1 }); get().fetchCustomers() },
  setPage: (page) => { set({ page }); get().fetchCustomers() },

  fetchCustomers: async () => {
    const { page, limit, search } = get()
    set({ loading: true })
    try {
      const res = await window.api.customers.getAll({ page, limit, search })
      if (res.success) set({ customers: res.data, total: res.total })
      else useSettingsStore.getState().showToast(res.error, 'error')
    } finally {
      set({ loading: false })
    }
  },

  createCustomer: async (data) => {
    const res = await window.api.customers.create(data)
    if (res.success) {
      useSettingsStore.getState().showToast('Customer created', 'success')
      get().fetchCustomers()
      return { success: true, id: res.data.id }
    } else {
      useSettingsStore.getState().showToast(res.error, 'error')
      return { success: false, error: res.error }
    }
  },

  updateCustomer: async (data) => {
    const res = await window.api.customers.update(data)
    if (res.success) {
      useSettingsStore.getState().showToast('Customer updated', 'success')
      get().fetchCustomers()
      return { success: true }
    } else {
      useSettingsStore.getState().showToast(res.error, 'error')
      return { success: false, error: res.error }
    }
  },

  deleteCustomer: async (id) => {
    const res = await window.api.customers.delete(id)
    if (res.success) {
      useSettingsStore.getState().showToast('Customer deleted', 'success')
      get().fetchCustomers()
      return { success: true }
    } else {
      useSettingsStore.getState().showToast(res.error, 'error')
      return { success: false, error: res.error }
    }
  },
}))
