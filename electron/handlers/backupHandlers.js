'use strict'

let dialog
try {
  dialog = require('electron').dialog
} catch (_) {}
const fs     = require('fs')
const path   = require('path')
const crypto = require('crypto')
const os     = require('os')
const log    = require('electron-log')

// ── Same secret used in ownerLicense.js (internal to main process only) ──
const SIGN_SECRET  = 'GST-OWNER-9f3a2b1c-7e4d-11ee-8c99-0242ac120002'
const SIG_MARKER   = '\n---SUNMARG-SIG---\n'   // delimiter written into the file
const SIG_MARKER_BUF = Buffer.from(SIG_MARKER, 'utf-8')

// ── Derive the same machine fingerprint used in the license system ──
function getMachineId() {
  try {
    const cpus = os.cpus()
    const raw  = `${cpus[0]?.model || 'cpu'}|${os.hostname()}|${os.platform()}|${os.arch()}|${os.totalmem()}`
    const hash = crypto.createHash('sha256').update(raw).digest('hex').toUpperCase()
    return `${hash.slice(0,4)}-${hash.slice(4,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}`
  } catch { return 'UNKN-0000-0000-0000' }
}

// ── HMAC helper ──
function hmac(data) {
  return crypto.createHmac('sha256', SIGN_SECRET).update(data).digest('hex')
}

// ── Build a signed trailer and return it as a Buffer ──
function buildTrailer(machineId) {
  const payload = JSON.stringify({
    machine_id:  machineId,
    exported_at: new Date().toISOString(),
    app:         'SunMarg Billing App',
  })
  const sig     = hmac(payload)
  const block   = JSON.stringify({ payload, sig })
  const b64     = Buffer.from(block).toString('base64')
  return Buffer.from(SIG_MARKER + b64, 'utf-8')
}

// ── Parse & verify a trailer; returns { machine_id } or null if invalid ──
function verifyTrailer(fileBuffer) {
  try {
    // Find the last occurrence of the marker
    let markerIdx = -1
    for (let i = fileBuffer.length - SIG_MARKER_BUF.length; i >= 0; i--) {
      if (fileBuffer.slice(i, i + SIG_MARKER_BUF.length).equals(SIG_MARKER_BUF)) {
        markerIdx = i
        break
      }
    }
    if (markerIdx === -1) return null   // no signature found

    const b64    = fileBuffer.slice(markerIdx + SIG_MARKER_BUF.length).toString('utf-8').trim()
    const block  = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'))
    const { payload, sig } = block

    // Verify HMAC — reject if tampered
    if (hmac(payload) !== sig) return null

    const parsed = JSON.parse(payload)
    return {
      machine_id:  parsed.machine_id,
      exported_at: parsed.exported_at,
      dbBuffer:    fileBuffer.slice(0, markerIdx),   // pure SQLite bytes
    }
  } catch { return null }
}

// ─────────────────────────────────────────────────────────────────────────────

function registerBackupHandlers(ipcMain, app, getMainWindow) {
  const dbFileName = 'database.db'

  // ── Export / Backup ─────────────────────────────────────────────────────
  ipcMain.handle('backup:export', async () => {
    try {
      const userDataPath = app.getPath('userData')
      const dbPath       = path.join(userDataPath, dbFileName)

      if (!fs.existsSync(dbPath)) {
        return { success: false, error: 'Database file not found' }
      }

      const machineId   = getMachineId()
      const timestamp   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const defaultName = `sunmarg-backup-${timestamp}.sbak`

      const result = await dialog.showSaveDialog({
        title:       'Export Signed Backup',
        defaultPath: defaultName,
        filters: [
          { name: 'SunMarg Signed Backup', extensions: ['sbak'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      })

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Backup cancelled' }
      }

      // Read DB + append signed trailer
      const dbBytes  = fs.readFileSync(dbPath)
      const trailer  = buildTrailer(machineId)
      const combined = Buffer.concat([dbBytes, trailer])

      fs.writeFileSync(result.filePath, combined)
      log.info(`[Backup] Exported signed backup → ${result.filePath} (machine: ${machineId})`)
      return { success: true, data: result.filePath }

    } catch (err) {
      log.error('backup:export', err)
      return { success: false, error: err.message }
    }
  })

  // ── Import / Restore ─────────────────────────────────────────────────────
  ipcMain.handle('backup:import', async () => {
    try {
      const userDataPath = app.getPath('userData')
      const dbPath       = path.join(userDataPath, dbFileName)

      const result = await dialog.showOpenDialog({
        title: 'Import Signed Backup (.sbak)',
        filters: [
          { name: 'SunMarg Signed Backup', extensions: ['sbak'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
      })

      if (result.canceled || !result.filePaths?.length) {
        return { success: false, error: 'Import cancelled' }
      }

      const sourcePath = result.filePaths[0]
      let fileBuffer
      try {
        fileBuffer = fs.readFileSync(sourcePath)
      } catch (e) {
        return { success: false, error: 'Could not read the backup file.\n' + e.message }
      }

      // ── STEP 1: Verify signature trailer ─────────────────────────────────
      const verified = verifyTrailer(fileBuffer)

      if (!verified) {
        return {
          success: false,
          error:
            '❌ Invalid or unsigned backup file!\n\n' +
            'This file was not created by SunMarg Billing App, or it has been tampered with.\n\n' +
            'Only backups exported from this app (as .sbak files) can be imported.',
        }
      }

      // ── STEP 2: Machine ID check ──────────────────────────────────────────
      const currentMachineId = getMachineId().toUpperCase()
      const fileMachineId    = (verified.machine_id || '').trim().toUpperCase()

      if (fileMachineId !== currentMachineId) {
        return {
          success: false,
          error:
            `❌ This backup belongs to a DIFFERENT machine!\n\n` +
            `Backup was created on machine: ${fileMachineId}\n` +
            `This machine:                  ${currentMachineId}\n\n` +
            `Backup files can only be restored on the same device they were exported from.\n` +
            `Contact SunMarg support if you need to migrate data between devices.`,
        }
      }

      // ── STEP 3: Validate the extracted DB bytes ───────────────────────────
      const dbBytes = verified.dbBuffer
      if (dbBytes.length < 16 || dbBytes.slice(0, 6).toString('utf8') !== 'SQLite') {
        return {
          success: false,
          error: 'The backup file does not contain a valid database. It may be corrupted.',
        }
      }

      // ── STEP 4: Safety backup of existing DB ─────────────────────────────
      const backupPath = dbPath + '.bak'
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, backupPath)
      }

      // ── STEP 5: Write the pure DB bytes (trailer stripped) ────────────────
      fs.writeFileSync(dbPath, dbBytes)
      log.info(`[Backup] Restored database from ${sourcePath} (machine: ${fileMachineId}, exported: ${verified.exported_at})`)

      // Restart app
      setTimeout(() => {
        app.relaunch()
        app.exit(0)
      }, 500)

      return { success: true, message: 'Database restored. App will restart.' }

    } catch (err) {
      log.error('backup:import', err)
      return { success: false, error: err.message }
    }
  })
}

module.exports = { registerBackupHandlers }
