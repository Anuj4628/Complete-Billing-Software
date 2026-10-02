'use strict'

const path = require('path')
const fs = require('fs')
const { initDatabase } = require('./db/database')

const userDataPath = process.env.APPDATA 
  ? path.join(process.env.APPDATA, 'gst-billing-app')
  : path.join(__dirname, '../data')

initDatabase(userDataPath)

const handlers = new Map()
const ipcMain = {
  handle(channel, fn) {
    handlers.set(channel, fn)
  }
}

const { registerCustomerHandlers } = require('./handlers/customerHandlers')
const { registerProductHandlers }  = require('./handlers/productHandlers')
const { registerInvoiceHandlers }  = require('./handlers/invoiceHandlers')
const { registerReportHandlers }   = require('./handlers/reportHandlers')
const { registerBackupHandlers }   = require('./handlers/backupHandlers')
const { registerPurchaseHandlers } = require('./handlers/purchaseHandlers')
const { registerLicenseHandlers }  = require('./ownerLicense')

registerCustomerHandlers(ipcMain)
registerProductHandlers(ipcMain)
registerInvoiceHandlers(ipcMain)
registerReportHandlers(ipcMain)
registerBackupHandlers(ipcMain, { getPath: () => userDataPath }, () => null)
registerPurchaseHandlers(ipcMain)
registerLicenseHandlers(ipcMain, { getPath: () => userDataPath })

// In browser/dev server, ensure valid license status so user can access login directly
const originalLicenseInfo = handlers.get('license:info')
ipcMain.handle('license:info', async (event, data) => {
  const res = originalLicenseInfo ? await originalLicenseInfo(event, data) : null
  if (!res || !res.valid) {
    return { valid: true, days_left: 365, machine_id: res?.machine_id || 'BROWSER-LOCAL' }
  }
  return res
})

// PDF / Clipboard / Shell fallback handlers
ipcMain.handle('clipboard:writeText', async (event, text) => {
  return { success: true }
})
ipcMain.handle('clipboard:copyFile', async (event, filePath) => {
  return { success: true }
})
ipcMain.handle('shell:showItemInFolder', async (event, filePath) => {
  return { success: true }
})
ipcMain.handle('pdf:print', async (event, { buffer }) => {
  return { success: true }
})
ipcMain.handle('pdf:save', async (event, { buffer, defaultName }) => {
  return { success: true, filePath: defaultName || 'invoice.pdf' }
})
ipcMain.handle('pdf:saveForWhatsApp', async (event, { buffer, defaultName }) => {
  return { success: true, filePath: defaultName || 'invoice.pdf' }
})

async function dispatch(channel, data) {
  const handler = handlers.get(channel)
  if (!handler) {
    return { success: false, error: `Handler not found for channel: ${channel}` }
  }
  try {
    const result = await handler({ sender: null }, data)
    return result
  } catch (err) {
    return { success: false, error: err.message }
  }
}

module.exports = { dispatch }
