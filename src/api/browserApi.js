// Browser API Bridge: Provides window.api contract when running in standard browser mode

const invoke = async (channel, data) => {
  try {
    const res = await fetch('/__api/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, data })
    })
    if (!res.ok) {
      const errText = await res.text()
      try {
        const json = JSON.parse(errText)
        return json
      } catch (_) {
        return { success: false, error: errText || `HTTP ${res.status}` }
      }
    }
    return await res.json()
  } catch (err) {
    return { success: false, error: err.message }
  }
}

if (typeof window !== 'undefined' && !window.api) {
  window.api = {
    customers: {
      getAll: (p) => invoke('customers:getAll', p),
      getById: (id) => invoke('customers:getById', id),
      create: (d) => invoke('customers:create', d),
      update: (d) => invoke('customers:update', d),
      delete: (id) => invoke('customers:delete', id),
      getLedger: (id) => invoke('customers:getLedger', id),
      getPartyLedger: (p) => invoke('customers:getPartyLedger', p),
      getAllForLedger: () => invoke('customers:getAllForLedger'),
    },
    products: {
      getAll: (p) => invoke('products:getAll', p),
      getById: (id) => invoke('products:getById', id),
      create: (d) => invoke('products:create', d),
      update: (d) => invoke('products:update', d),
      delete: (id) => invoke('products:delete', id),
      adjustStock: (d) => invoke('products:adjustStock', d),
      getLowStock: () => invoke('products:getLowStock'),
      getCategories: () => invoke('products:getCategories'),
    },
    invoices: {
      getNextNumber: () => invoke('invoices:getNextNumber'),
      getAll: (p) => invoke('invoices:getAll', p),
      getById: (id) => invoke('invoices:getById', id),
      create: (d) => invoke('invoices:create', d),
      update: (d) => invoke('invoices:update', d),
      delete: (id) => invoke('invoices:delete', id),
      updateStatus: (d) => invoke('invoices:updateStatus', d),
      getUnpaidByCustomer: (id) => invoke('invoices:getUnpaidByCustomer', id),
      saveEInvoice: (d) => invoke('invoices:saveEInvoice', d),
      saveEWayBill: (d) => invoke('invoices:saveEWayBill', d),
    },
    purchases: {
      getAll: (p) => invoke('purchases:getAll', p),
      getById: (id) => invoke('purchases:getById', id),
      create: (d) => invoke('purchases:create', d),
      update: (d) => invoke('purchases:update', d),
      delete: (id) => invoke('purchases:delete', id),
      getAllSuppliersForLedger: () => invoke('purchases:getAllSuppliersForLedger'),
      getUnpaidBySupplier: (name) => invoke('purchases:getUnpaidBySupplier', name),
      getSupplierLedger: (p) => invoke('purchases:getSupplierLedger', p),
    },
    quotations: {
      getNextNumber: () => invoke('quotations:getNextNumber'),
      getAll: (p) => invoke('quotations:getAll', p),
      getById: (id) => invoke('quotations:getById', id),
      create: (d) => invoke('quotations:create', d),
      update: (d) => invoke('quotations:update', d),
      delete: (id) => invoke('quotations:delete', id),
    },
    payments: {
      getAll: (p) => invoke('payments:getAll', p),
      create: (d) => invoke('payments:create', d),
      delete: (id) => invoke('payments:delete', id),
    },
    journals: {
      getAll: (p) => invoke('journals:getAll', p),
      create: (d) => invoke('journals:create', d),
      delete: (id) => invoke('journals:delete', id),
    },
    reports: {
      getSalesSummary: (p) => invoke('reports:getSalesSummary', p),
      getSalesRegister: (p) => invoke('reports:getSalesRegister', p),
      getGSTSummary: (p) => invoke('reports:getGSTSummary', p),
      getStockReport: () => invoke('reports:getStockReport'),
      getStockLedger: (p) => invoke('reports:getStockLedger', p),
      getAllProductsForLedger: () => invoke('reports:getAllProductsForLedger'),
      getPurchaseRegister: (p) => invoke('reports:getPurchaseRegister', p),
      getPurchaseGSTSummary: (p) => invoke('reports:getPurchaseGSTSummary', p),
      exportCSV: (p) => invoke('reports:exportCSV', p),
    },
    settings: {
      getAll: () => invoke('settings:getAll'),
      set: (d) => invoke('settings:set', d),
      get: (k) => invoke('settings:get', k),
    },
    backup: {
      export: () => invoke('backup:export'),
      import: () => invoke('backup:import'),
    },
    license: {
      info:            ()  => invoke('license:info'),
      set:             (d) => invoke('license:set', d),
      ownerAuth:       (d) => invoke('license:ownerAuth', d),
      getMachineId:    ()  => invoke('license:getMachineId'),
      register:        (d) => invoke('license:register', d),
      getRegistration: ()  => invoke('license:getRegistration'),
      generate:        (d) => invoke('license:generate', d),
      import:          ()  => invoke('license:import'),
      getAccessLog:         ()  => invoke('license:getAccessLog'),
      getAllRegistrations:  ()  => invoke('license:getAllRegistrations'),
      addRegistration:     (d) => invoke('license:addRegistration', d),
      verifyAndResetPassword: (d) => invoke('license:verifyAndResetPassword', d),
    },
    pdf: {
      save: (d) => invoke('pdf:save', d),
      saveForWhatsApp: (d) => invoke('pdf:saveForWhatsApp', d),
      print: (d) => invoke('pdf:print', d),
    },
    clipboard: {
      writeText: async (text) => {
        if (navigator.clipboard?.writeText) {
          try {
            await navigator.clipboard.writeText(text)
            return { success: true }
          } catch (_) {}
        }
        return invoke('clipboard:writeText', text)
      },
      copyFile: (path) => invoke('clipboard:copyFile', path),
    },
    shell: {
      showItemInFolder: (path) => invoke('shell:showItemInFolder', path),
    },
  }
}
