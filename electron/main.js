const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const log = require('electron-log')

// ── SINGLE INSTANCE LOCK ──
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

log.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), 'logs', 'main.log')
log.info('App starting...')

const { registerCustomerHandlers } = require('./handlers/customerHandlers')
const { registerProductHandlers }  = require('./handlers/productHandlers')
const { registerInvoiceHandlers }  = require('./handlers/invoiceHandlers')
const { registerReportHandlers }   = require('./handlers/reportHandlers')
const { registerBackupHandlers }   = require('./handlers/backupHandlers')
const { registerPurchaseHandlers } = require('./handlers/purchaseHandlers')
const { registerLicenseHandlers }  = require('./ownerLicense')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
let mainWindow = null
let splashWindow = null

function initDb() {
  try {
    const { initDatabase } = require('./db/database')
    const userDataPath = app.getPath('userData')
    log.info('userData path:', userDataPath)
    initDatabase(userDataPath)
    log.info('Database initialized successfully')
  } catch (err) {
    log.error('Database initialization failed:', err.message)
    dialog.showMessageBoxSync({
      type: 'warning', title: 'Database Warning',
      message: 'Database could not be initialized.',
      detail: 'Error: ' + err.message,
      buttons: ['Continue Anyway'],
    })
  }
}

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 400, height: 300,
    frame: false, transparent: true,
    alwaysOnTop: true, resizable: false,
    center: true, skipTaskbar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })
  splashWindow.loadFile(path.join(__dirname, '../assets/splash.html'))
  splashWindow.on('closed', () => { splashWindow = null })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 800, minWidth: 1200, minHeight: 700,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'), sandbox: false,
    },
    titleBarStyle: 'default', show: false,
    backgroundColor: '#0f172a',
    icon: path.join(__dirname, '../assets/icon.png'),
  })

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data: blob:; worker-src 'self' blob:; img-src 'self' data: blob:; connect-src 'self' blob:;"
        ]
      }
    })
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Show main window after 2s (splash shows during load), then close splash
  mainWindow.once('ready-to-show', () => {
    setTimeout(() => {
      if (splashWindow) { splashWindow.close() }
      mainWindow.show()
      mainWindow.focus()
    }, 2000)
  })

  mainWindow.on('closed', () => { mainWindow = null })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url); return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  initDb()
  registerCustomerHandlers(ipcMain)
  registerProductHandlers(ipcMain)
  registerInvoiceHandlers(ipcMain)
  registerReportHandlers(ipcMain)
  registerBackupHandlers(ipcMain, app, () => mainWindow)
  registerPurchaseHandlers(ipcMain)
  registerLicenseHandlers(ipcMain, app)

  // ── Print PDF via hidden window ──
  ipcMain.handle('pdf:print', async (event, { buffer }) => {
    try {
      const fs = require('fs')
      const os = require('os')
      const tempPath = path.join(os.tmpdir(), `print_${Date.now()}.pdf`)
      fs.writeFileSync(tempPath, Buffer.from(buffer))

      const printWin = new BrowserWindow({ show: false })
      await printWin.loadFile(tempPath)
      
      // Wait for the PDF to load then print
      printWin.webContents.on('did-finish-load', () => {
        printWin.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
          if (!success) log.error('Print failed:', failureReason)
          printWin.close()
          try { fs.unlinkSync(tempPath) } catch (e) {}
        })
      })
      return { success: true }
    } catch (err) {
      log.error('PDF print error:', err)
      return { success: false, error: err.message }
    }
  })

  // ── Save PDF via native dialog ──
  ipcMain.handle('pdf:save', async (event, { buffer, defaultName }) => {
    try {
      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: 'Save PDF',
        defaultPath: defaultName || 'invoice.pdf',
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      })
      if (canceled || !filePath) return { success: false, canceled: true }
      const fs = require('fs')
      fs.writeFileSync(filePath, Buffer.from(buffer))
      shell.showItemInFolder(filePath)
      return { success: true, filePath }
    } catch (err) {
      log.error('PDF save error:', err)
      return { success: false, error: err.message }
    }
  })

  // ── Save PDF silently to Downloads (for WhatsApp sharing) ──
  ipcMain.handle('pdf:saveForWhatsApp', async (event, { buffer, defaultName }) => {
    try {
      const fs   = require('fs')
      const downloads = app.getPath('downloads')
      const fileName = (defaultName || 'invoice.pdf').replace(/[<>:"/\\|?*]/g, '_')
      const filePath = path.join(downloads, fileName)
      fs.writeFileSync(filePath, Buffer.from(buffer))
      
      // Auto-open the folder and highlight the file for the user to drag
      shell.showItemInFolder(filePath)
      
      return { success: true, filePath, savedToDownloads: true }
    } catch (err) {
      log.error('PDF saveForWhatsApp error:', err)
      return { success: false, error: err.message }
    }
  })

  // ── Copy text to clipboard ──
  ipcMain.handle('clipboard:writeText', async (event, text) => {
    const { clipboard } = require('electron')
    clipboard.writeText(text)
    return { success: true }
  })

  // ── Show a file in Finder / Explorer ──
   ipcMain.handle('shell:showItemInFolder', async (event, filePath) => {
     shell.showItemInFolder(filePath)
     return { success: true }
   })

   // ── Copy file to clipboard (Windows only) ──
   ipcMain.handle('clipboard:copyFile', async (event, filePath) => {
     try {
       const { exec } = require('child_process')
       // PowerShell command to copy a file object to the clipboard
       const cmd = `powershell -Command "Set-Clipboard -Path '${filePath}'"`
       exec(cmd, (err) => {
         if (err) log.error('Clipboard copyFile error:', err)
       })
       return { success: true }
     } catch (err) {
       log.error('clipboard:copyFile', err)
       return { success: false, error: err.message }
     }
   })

  createSplash()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
process.on('uncaughtException', (error) => { log.error('Uncaught Exception:', error) })
process.on('unhandledRejection', (reason) => { log.error('Unhandled Rejection:', reason) })
module.exports = { getMainWindow: () => mainWindow }
