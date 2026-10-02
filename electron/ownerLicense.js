/**
 * ============================================================
 *  OWNER LICENSE MANAGER — Sunmarg Billing App
 *
 *  Flow:
 *  1. Owner ke paas alag "GST-License-Generator.html" tool hai
 *  2. Woh usme customer naam + expiry daalkar .lic file banata hai
 *  3. Customer ko .lic file bhejta hai (WhatsApp/Email)
 *  4. Customer "Import License" karta hai → App unlock!
 *
 *  Security: HMAC-SHA256 secret key se signed — tamper proof
 *  No Machine ID check — kisi bhi computer pe kaam karta hai
 * ============================================================
 */

const fs     = require('fs')
const path   = require('path')
const crypto = require('crypto')
const os     = require('os')
let dialog
try {
  dialog = require('electron').dialog
} catch (_) {}
const { getDb } = require('./db/database')

// ── Secret key — SAME key generator tool mein bhi hogi ──
const SIGN_SECRET    = 'GST-OWNER-9f3a2b1c-7e4d-11ee-8c99-0242ac120002'
const OWNER_PASSWORD = (process.env.OWNER_PASS || 'OWNER@9999').trim()

// ── File paths ──
function getLicensePath(app) {
  // Store in userData so license survives app reinstalls and folder changes
  return path.join(app.getPath('userData'), 'gst-license.dat')
}
function getRegistrationPath(app) {
  return path.join(app.getPath('userData'), 'gst-registration.json')
}
function getAllRegistrationsPath(app) {
  return path.join(app.getPath('userData'), 'gst-all-registrations.json')
}
function getAccessLogPath(app) {
  return path.join(app.getPath('userData'), 'gst-owner-access.json')
}

// ── Helpers ──
function readJSON(p) {
  try { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) : null } catch { return null }
}
function writeJSON(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8')
}

function getMachineId() {
  try {
    const cpus = os.cpus()
    const raw  = `${cpus[0]?.model || 'cpu'}|${os.hostname()}|${os.platform()}|${os.arch()}|${os.totalmem()}`
    const hash = crypto.createHash('sha256').update(raw).digest('hex').toUpperCase()
    return `${hash.slice(0,4)}-${hash.slice(4,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}`
  } catch { return 'UNKN-0000-0000-0000' }
}

// ── HMAC sign/verify ──
function sign(data) {
  return crypto.createHmac('sha256', SIGN_SECRET).update(data).digest('hex')
}

// ── Encode .lic content ──
function encodeLicense(data) {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64')
  return `GST-LIC::${payload}::${sign(payload)}`
}

// ── Decode & verify .lic content ──
function decodeLicense(raw) {
  try {
    const parts = raw.trim().replace(/^\uFEFF/, '').split('::')
    if (parts.length !== 3 || parts[0] !== 'GST-LIC') return null
    const [, payload, sig] = parts
    if (sign(payload) !== sig) return null
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'))
  } catch { return null }
}

function readLicense(app) {
  try {
    const p = getLicensePath(app)
    if (!fs.existsSync(p)) return null
    const raw = fs.readFileSync(p, 'utf-8').replace(/^\uFEFF/, '').trim()
    return decodeLicense(raw)
  } catch { return null }
}
function writeLicense(app, data) { fs.writeFileSync(getLicensePath(app), encodeLicense(data), 'utf-8') }
function readRegistration(app)   { return readJSON(getRegistrationPath(app)) }
function writeRegistration(app, data) { writeJSON(getRegistrationPath(app), data) }

function saveToAllRegistrations(app, data) {
  const all = readJSON(getAllRegistrationsPath(app)) || []
  const idx = all.findIndex(r => r.machine_id === data.machine_id)
  if (idx >= 0) all[idx] = { ...all[idx], ...data, updated_at: new Date().toISOString() }
  else all.unshift({ ...data, added_at: new Date().toISOString() })
  writeJSON(getAllRegistrationsPath(app), all)
}

function writeAccessLog(app, entry) {
  const logs = readJSON(getAccessLogPath(app)) || []
  logs.unshift(entry)
  writeJSON(getAccessLogPath(app), logs.slice(0, 100))
}

function sameCompanyName(a, b) {
  return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase()
}

// ── Check license status ──
function checkLicense(app) {
  const machineId = getMachineId()
  const reg = readRegistration(app)
  const lic = readLicense(app)

  if (!reg) return { valid: false, reason: 'not_registered', machine_id: machineId }
  if (!lic)  return { valid: false, reason: 'pending_activation', machine_id: machineId, customer_name: reg.customer_name, company_name: reg.company_name, phone: reg.phone }

  // ── STRICT MACHINE ID CHECK ──
  // If license has machine_id, it MUST match current machine
  if (lic.machine_id) {
    const licMachineId = (lic.machine_id || '').trim().toUpperCase()
    const currentMachineId = machineId.toUpperCase()
    if (licMachineId !== currentMachineId) {
      return {
        valid: false,
        reason: 'machine_id_mismatch',
        error: `This license is locked to a different machine. License for: ${licMachineId}, Current: ${currentMachineId}. Contact owner for a new license.`,
        customer_name: lic.customer_name,
        company_name: lic.company_name || reg?.company_name || '',
        phone: lic.phone || reg?.phone || '',
        machine_id: machineId,
      }
    }
  }

  const regCompany = (reg.company_name || '').trim().toLowerCase()
  const licCompany = (lic.company_name || '').trim().toLowerCase()
  if (regCompany && (!licCompany || regCompany !== licCompany)) {
    return {
      valid: false,
      reason: 'company_mismatch',
      error: `License file company (${lic.company_name}) does not match registered company (${reg.company_name}).`,
      customer_name: lic.customer_name,
      company_name: lic.company_name,
      phone: lic.phone || reg.phone || '',
      machine_id: machineId,
    }
  }

  const today = new Date(); today.setHours(0,0,0,0)
  const expiry = new Date(lic.expiry_date); expiry.setHours(0,0,0,0)

  if (today > expiry) {
    return {
      valid: false,
      reason: 'expired',
      expiry_date: lic.expiry_date,
      customer_name: lic.customer_name,
      company_name: lic.company_name || reg?.company_name || '',
      phone: lic.phone || reg?.phone || '',
      machine_id: machineId,
    }
  }

  const diffDays = Math.ceil((expiry - today) / 86400000)
  return {
    valid: true,
    expiry_date:   lic.expiry_date,
    customer_name: lic.customer_name,
    company_name:  lic.company_name || reg?.company_name || '',
    days_left:     diffDays,
    warn:          diffDays <= 10,
    machine_id:    machineId,
  }
}

// ── IPC Handlers ──
function registerLicenseHandlers(ipcMain, app) {

  ipcMain.handle('license:info', () => checkLicense(app))
  ipcMain.handle('license:getMachineId', () => ({ machine_id: getMachineId() }))

  // Customer registers (first time)
  ipcMain.handle('license:register', (event, { customer_name, company_name, phone }) => {
    if (!customer_name || customer_name.trim().length < 2) return { success: false, error: 'Naam zaroori hai (min 2 chars)' }
    if (!phone || !/^\d{10}$/.test(phone.trim())) return { success: false, error: 'Valid 10-digit phone number zaroori hai' }
    const machine_id = getMachineId()
    const data = { customer_name: customer_name.trim(), company_name: (company_name||'').trim(), phone: phone.trim(), machine_id, registered_at: new Date().toISOString() }
    writeRegistration(app, data)
    saveToAllRegistrations(app, data)
    return { success: true, machine_id }
  })

  ipcMain.handle('license:getRegistration', () => readRegistration(app))
  ipcMain.handle('license:getAllRegistrations', () => readJSON(getAllRegistrationsPath(app)) || [])
  ipcMain.handle('license:getAccessLog', () => readJSON(getAccessLogPath(app)) || [])

  // ── CUSTOMER: Import .lic file — STRICT machine ID validation ──
  ipcMain.handle('license:import', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'License File Select Karo (.lic)',
      filters: [{ name: 'License File', extensions: ['lic'] }],
      properties: ['openFile'],
    })
    if (canceled || !filePaths?.length) return { success: false, error: 'Koi file select nahi ki' }

    let raw
    try {
      raw = fs.readFileSync(filePaths[0], 'utf-8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim()
    } catch (e) {
      return { success: false, error: 'File read nahi ho payi. Desktop par copy karke dobara try karo.\n' + e.message }
    }

    const data = decodeLicense(raw)
    if (!data) return { success: false, error: 'Invalid license file! Yeh file tamper ho gayi hai ya galat hai.\nOwner se naya .lic file maango.' }

    // ── STRICT MACHINE ID CHECK ON IMPORT ──
    const currentMachineId = getMachineId().toUpperCase()
    if (data.machine_id) {
      const licMachineId = (data.machine_id || '').trim().toUpperCase()
      if (licMachineId !== currentMachineId) {
        return { 
          success: false, 
          error: `This license is locked to a different machine!\n\nYour Machine: ${currentMachineId}\nLicense for: ${licMachineId}\n\nOwner se apke machine ke liye naya .lic file maango.` 
        }
      }
    } else {
      // License doesn't have machine_id - this is now NOT allowed for security
      return { 
        success: false, 
        error: `This license file is not machine-locked (old format).\n\nSecurity reasons se ab sirf machine-locked licenses accept hote hain.\n\nOwner se apke Machine ID (${currentMachineId}) ke saath naya .lic file banvao.` 
      }
    }

    const reg = readRegistration(app)
    const regCompany = (reg?.company_name || '').trim().toLowerCase()
    const dataCompany = (data.company_name || '').trim().toLowerCase()
    if (reg && regCompany && (!dataCompany || regCompany !== dataCompany)) {
      return { success: false, error: `License file company name (${data.company_name}) app ke registered company name (${reg.company_name}) se match nahi karta. Owner se same company name wala .lic file maango.` }
    }

    // Check expiry
    const today = new Date(); today.setHours(0,0,0,0)
    const expiry = new Date(data.expiry_date); expiry.setHours(0,0,0,0)
    if (today > expiry) return { success: false, error: `Yeh license expire ho chuki hai (${data.expiry_date}).\nOwner se naya .lic file maango.` }

    // Save license
    writeLicense(app, data)
    return { success: true, data }
  })

  // ── OWNER: Generate .lic file (inside app) ──
  ipcMain.handle('license:generate', async (event, { owner_password, customer_name, company_name, expiry_date, machine_id, phone }) => {
    if ((owner_password||'').trim() !== OWNER_PASSWORD) return { success: false, error: 'Invalid owner password' }
    if (!customer_name || !expiry_date) return { success: false, error: 'Customer naam aur expiry date zaroori hai' }
    if (isNaN(new Date(expiry_date).getTime())) return { success: false, error: 'Invalid date format' }
    // ── MACHINE ID IS NOW MANDATORY ──
    if (!machine_id || !machine_id.trim()) return { success: false, error: 'Machine ID zaroori hai - customer se apna Machine ID mangvo' }

    const licData = {
      customer_name: customer_name.trim(),
      company_name:  (company_name||'').trim(),
      phone:         (phone||'').trim(),
      expiry_date,
      machine_id:    machine_id.trim().toUpperCase(),
      issued_at:     new Date().toISOString(),
    }

    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'License File Save Karo',
      defaultPath: `GST-License-${customer_name.trim().replace(/\s+/g, '-')}.lic`,
      filters: [{ name: 'License File', extensions: ['lic'] }],
    })
    if (canceled || !filePath) return { success: false, error: 'Save canceled' }

    fs.writeFileSync(filePath, encodeLicense(licData), 'utf-8')
    return { success: true, filePath }
  })

  // ── OWNER AUTH ──
  ipcMain.handle('license:ownerAuth', (event, { owner_password, owner_name }) => {
    if ((owner_password||'').trim() !== OWNER_PASSWORD) {
      writeAccessLog(app, { type: 'failed_attempt', owner_name: owner_name||'Unknown', timestamp: new Date().toISOString(), machine: os.hostname() })
      return { success: false, error: 'Invalid owner password' }
    }
    writeAccessLog(app, { type: 'access', owner_name: owner_name||'Owner', timestamp: new Date().toISOString(), machine: os.hostname() })

    let lic = null
    try {
      const licPath = getLicensePath(app)
      if (fs.existsSync(licPath)) lic = decodeLicense(fs.readFileSync(licPath, 'utf-8').trim())
    } catch {}

    return { success: true, license: lic, registration: readRegistration(app) }
  })

  ipcMain.handle('license:addRegistration', (event, { owner_password, customer_name, company_name, phone, machine_id }) => {
    if ((owner_password||'').trim() !== OWNER_PASSWORD) return { success: false, error: 'Invalid owner password' }
    if (!customer_name) return { success: false, error: 'Naam zaroori hai' }
    saveToAllRegistrations(app, { customer_name: customer_name.trim(), company_name: (company_name||'').trim(), phone: (phone||'').trim(), machine_id: (machine_id||'').trim().toUpperCase(), registered_at: new Date().toISOString() })
    return { success: true }
  })

  // Backward compat — UPDATED with machine_id requirement
  ipcMain.handle('license:set', (event, { owner_password, customer_name, company_name, expiry_date, machine_id }) => {
    if ((owner_password||'').trim() !== OWNER_PASSWORD) return { success: false, error: 'Invalid owner password' }
    if (!customer_name || !expiry_date) return { success: false, error: 'Required fields missing' }
    if (!machine_id || !machine_id.trim()) return { success: false, error: 'Machine ID is required' }
    writeLicense(app, { 
      customer_name, 
      company_name: company_name||'', 
      machine_id: machine_id.trim().toUpperCase(),
      expiry_date, 
      issued_at: new Date().toISOString() 
    })
    return { success: true }
  })

  // ── Forgot Password: Verify Phone & Reset ──
  ipcMain.handle('license:verifyAndResetPassword', async (event, { phone, newPassword }) => {
    try {
      const reg = readRegistration(app)
      if (!reg) return { success: false, error: 'Registration not found. Please register first.' }
      
      const registeredPhone = (reg.phone || '').trim()
      const providedPhone = (phone || '').trim()
      
      if (registeredPhone !== providedPhone) {
        return { success: false, error: 'Phone number does not match registered number.' }
      }
      
      const db = getDb()
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
        .run('auth_password', newPassword)
        
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}

module.exports = { registerLicenseHandlers, checkLicense, getLicensePath }
