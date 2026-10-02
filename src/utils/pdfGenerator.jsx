/**
   * PDF Generator — base64-js fix included
   * Use this instead of directly importing @react-pdf/renderer
   */

  // Patch base64-js default export issue BEFORE loading @react-pdf/renderer
  async function patchBase64js() {
    try {
      const mod = await import('base64-js')
      // If default export is missing, create it
      if (mod && typeof mod.fromByteArray === 'function' && !mod.default) {
        const patch = {
          fromByteArray: mod.fromByteArray,
          toByteArray:   mod.toByteArray,
          byteLength:    mod.byteLength,
        }
        // Force default onto the module namespace
        try { Object.defineProperty(mod, 'default', { value: patch, writable: true, configurable: true }) } catch (_) {}
        // Also set on globalThis for any CJS require() calls
        if (typeof globalThis !== 'undefined') globalThis.__base64js = patch
      }
    } catch (_) { /* ignore if base64-js not found */ }
  }

  let _patched = false

  export async function getPdfRenderer() {
    if (!_patched) {
      await patchBase64js()
      _patched = true
    }
    const { pdf, BlobProvider } = await import('@react-pdf/renderer')
    const { InvoicePDF, PurchasePDF, QuotationPDF } = await import('./pdfTemplate.jsx')
    return { pdf, BlobProvider, InvoicePDF, PurchasePDF, QuotationPDF }
  }

  /**
   * Ensures an image data URI is in a format compatible with @react-pdf/renderer (PNG or JPEG).
   * WebP, AVIF, SVG, etc. are converted to standard PNG via HTML Canvas.
   */
  export async function ensurePdfCompatibleImage(dataUri) {
    if (!dataUri || typeof dataUri !== 'string') return null
    const trimmed = dataUri.trim()
    if (!trimmed) return null

    // If it's already PNG or JPEG, it's natively supported
    if (
      trimmed.startsWith('data:image/png;') ||
      trimmed.startsWith('data:image/jpeg;') ||
      trimmed.startsWith('data:image/jpg;')
    ) {
      return trimmed
    }

    // Convert via canvas in browser / Electron renderer
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      try {
        return await new Promise((resolve) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas')
              canvas.width = img.naturalWidth || img.width || 200
              canvas.height = img.naturalHeight || img.height || 100
              const ctx = canvas.getContext('2d')
              ctx.drawImage(img, 0, 0)
              resolve(canvas.toDataURL('image/png'))
            } catch (err) {
              console.warn('Canvas conversion error:', err)
              resolve(trimmed)
            }
          }
          img.onerror = (e) => {
            console.warn('Failed to load image for canvas conversion:', e)
            resolve(trimmed)
          }
          img.src = trimmed
        })
      } catch (err) {
        console.warn('ensurePdfCompatibleImage error:', err)
        return trimmed
      }
    }
    return trimmed
  }

  export async function generatePDFBlob(data, settings, type = 'invoice') {
    const { pdf, InvoicePDF, PurchasePDF, QuotationPDF } = await getPdfRenderer()
    
    // Ensure we have settings
    let currentSettings = settings
    if (!currentSettings || !currentSettings.company_name || (!currentSettings.company_stamp && !currentSettings.company_signature)) {
      try {
        const res = await window.api?.settings?.getAll?.()
        if (res?.success && res.data) {
          currentSettings = { ...res.data, ...(currentSettings || {}) }
        }
      } catch (_) {}
    }
    currentSettings = currentSettings || {}

    // Convert all images to PNG/JPEG for react-pdf compatibility
    const [logo, stamp, signature] = await Promise.all([
      ensurePdfCompatibleImage(currentSettings.company_logo),
      ensurePdfCompatibleImage(currentSettings.company_stamp),
      ensurePdfCompatibleImage(currentSettings.company_signature),
    ])

    const safeSettings = {
      ...currentSettings,
      company_logo: logo,
      company_stamp: stamp,
      company_signature: signature,
    }

    // Normalize data for safe rendering
    const safeData = {
      ...data,
      items:          data.items          || [],
      supply_type:    data.supply_type    || 'intra',
      grand_total:    data.grand_total    || 0,
      taxable_amount: data.taxable_amount || 0,
      total_cgst:     data.total_cgst     || 0,
      total_sgst:     data.total_sgst     || 0,
      total_igst:     data.total_igst     || 0,
      round_off:      data.round_off      || 0,
    }

    if (type === 'purchase') {
      return await pdf(<PurchasePDF purchase={safeData} settings={safeSettings} />).toBlob()
    }
    if (type === 'quotation') {
      return await pdf(<QuotationPDF quotation={safeData} settings={safeSettings} />).toBlob()
    }
    return await pdf(<InvoicePDF invoice={safeData} settings={safeSettings} />).toBlob()
  }

  /**
   * Download PDF using Electron native save dialog (preferred),
   * falling back to browser blob-URL download in non-Electron environments.
   */
  export async function downloadPDF(data, settings, type = 'invoice') {
    const blob = await generatePDFBlob(data, settings, type)
    const defaultName = `${data.quotation_number || data.invoice_number || data.bill_number || type}.pdf`

    // Electron: use native save dialog via IPC
    if (window.api?.pdf?.save) {
      const arrayBuffer = await blob.arrayBuffer()
      const buffer = Array.from(new Uint8Array(arrayBuffer))
      const result = await window.api.pdf.save({ buffer, defaultName })
      if (!result.success && !result.canceled) {
        throw new Error(result.error || 'Failed to save PDF')
      }
      return result
    }

    // Browser fallback
    const url = URL.createObjectURL(blob)
    const a   = document.createElement('a')
    a.href     = url
    a.download = defaultName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /**
   * Build a WhatsApp message string for an invoice/purchase.
   */
  function buildWhatsAppMessage(invoice, companyName) {
    const name      = invoice.customer_name || invoice.supplier_name || 'Customer'
    const total     = parseFloat(invoice.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
    const invoiceNo = invoice.invoice_number || invoice.bill_number || ''
    const date      = invoice.invoice_date   || invoice.bill_date   || ''
    const balDue    = invoice.balance_due && parseFloat(invoice.balance_due) > 0
      ? `\nBalance Due: ₹${parseFloat(invoice.balance_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      : ''

    return [
      `Dear ${name},`,
      ``,
      `Thank you for your business!`,
      ``,
      `Invoice No: ${invoiceNo}`,
      `Date: ${date}`,
      `Total: ₹${total}${balDue}`,
      ``,
      `Please contact us for any invoice-related queries.`,
      ``,
      `Regards,`,
      `${companyName || 'Us'}`,
    ].join('\n')
  }

  /**
   * Build WhatsApp URL for an invoice (does NOT open it — caller decides when).
   */
  export function buildWhatsAppUrl(invoice, companyName) {
    let phone = (invoice.customer_phone || invoice.supplier_phone || '').replace(/\D/g, '')
    // Accuracy fix: ensure 10-digit numbers get 91 prefix, and existing 91 prefix is preserved
    if (phone.length === 10) {
      phone = '91' + phone
    } else if (phone.length === 12 && phone.startsWith('91')) {
      // already has 91
    } else if (phone.length > 10 && !phone.startsWith('91')) {
      // has some other country code or just longer — leave it as is
    }

    const msg = buildWhatsAppMessage(invoice, companyName)
    return phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
  }

  /**
   * Save PDF silently to Desktop (no dialog) for WhatsApp sharing.
   * Returns { filePath, fileName, waUrl } — caller shows WhatsAppModal.
   */
  export async function prepareForWhatsApp(data, settings, type = 'invoice') {
    const blob        = await generatePDFBlob(data, settings, type)
    const defaultName = `${data.invoice_number || data.bill_number || type}.pdf`
    const waUrl       = buildWhatsAppUrl(data, settings?.company_name)

    if (window.api?.pdf?.saveForWhatsApp) {
      // Electron: save silently to Downloads
      const arrayBuffer = await blob.arrayBuffer()
      const buffer      = Array.from(new Uint8Array(arrayBuffer))
      const result      = await window.api.pdf.saveForWhatsApp({ buffer, defaultName })
      if (!result?.success) throw new Error(result?.error || 'Failed to save PDF')
      
      // Accuracy fix: Automatically copy the file to clipboard so user can just Ctrl+V
      if (result.filePath && window.api?.clipboard?.copyFile) {
        await window.api.clipboard.copyFile(result.filePath)
      }
      
      return { filePath: result.filePath, fileName: defaultName, waUrl, savedToDownloads: result.savedToDownloads }
    } else {
      // Browser fallback: trigger download, return null path (user finds it in Downloads)
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href     = url
      a.download = defaultName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      return { filePath: null, fileName: defaultName, waUrl, savedToDesktop: false }
    }
  }

  /**
   * @deprecated — kept for backward compat. Use prepareForWhatsApp instead.
   */
  export async function downloadPDFAndWhatsApp(invoice, settings, companyName) {
    const { waUrl } = await prepareForWhatsApp(invoice, settings)
    window.open(waUrl, '_blank')
  }
  