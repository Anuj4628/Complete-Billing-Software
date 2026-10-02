import { create } from 'zustand'
import { useSettingsStore } from './useSettingsStore.js'

export const useProductStore = create((set, get) => ({
  products: [],
  total: 0,
  page: 1,
  limit: 20,
  search: '',
  lowStockOnly: false,
  categories: [],
  loading: false,

  setSearch: (search) => { set({ search, page: 1 }); get().fetchProducts() },
  setPage: (page) => { set({ page }); get().fetchProducts() },
  setLowStockOnly: (v) => { set({ lowStockOnly: v, page: 1 }); get().fetchProducts() },

  fetchProducts: async () => {
    const { page, limit, search, lowStockOnly } = get()
    set({ loading: true })
    try {
      const res = await window.api.products.getAll({ page, limit, search, lowStock: lowStockOnly })
      if (res.success) set({ products: res.data, total: res.total })
      else useSettingsStore.getState().showToast(res.error, 'error')
    } finally {
      set({ loading: false })
    }
  },

  fetchCategories: async () => {
    const res = await window.api.products.getCategories()
    if (res.success) set({ categories: res.data })
  },

  createProduct: async (data) => {
    const res = await window.api.products.create(data)
    if (res.success) {
      useSettingsStore.getState().showToast('Product created', 'success')
      get().fetchProducts()
      return { success: true, id: res.data.id }
    } else {
      useSettingsStore.getState().showToast(res.error, 'error')
      return { success: false, error: res.error }
    }
  },

  updateProduct: async (data) => {
    const res = await window.api.products.update(data)
    if (res.success) {
      useSettingsStore.getState().showToast('Product updated', 'success')
      get().fetchProducts()
      return { success: true }
    } else {
      useSettingsStore.getState().showToast(res.error, 'error')
      return { success: false, error: res.error }
    }
  },

  deleteProduct: async (id) => {
    const res = await window.api.products.delete(id)
    if (res.success) {
      useSettingsStore.getState().showToast('Product deleted', 'success')
      get().fetchProducts()
      return { success: true }
    } else {
      useSettingsStore.getState().showToast(res.error, 'error')
      return { success: false, error: res.error }
    }
  },

  adjustStock: async (data) => {
    const res = await window.api.products.adjustStock(data)
    if (res.success) {
      useSettingsStore.getState().showToast('Stock adjusted', 'success')
      get().fetchProducts()
      return { success: true }
    } else {
      useSettingsStore.getState().showToast(res.error, 'error')
      return { success: false, error: res.error }
    }
  },
}))
