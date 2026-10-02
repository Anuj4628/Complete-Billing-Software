import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Edit2, Trash2, Printer, MessageCircle } from 'lucide-react'
import Button from '../../components/ui/Button.jsx'
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx'
import { formatCurrency, formatDate, numberToWords } from '../../utils/formatters.js'
import { getStateCode } from '../../utils/gstHelpers.js'
import { useSettingsStore } from '../../store/useSettingsStore.js'
import { downloadPDF, prepareForWhatsApp, generatePDFBlob } from '../../utils/pdfGenerator.jsx'
import WhatsAppModal from '../../components/ui/WhatsAppModal.jsx'

function TotalLine({ label, value, bold, valueClass }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? 'font-bold' : ''}`}>
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className={valueClass || 'text-gray-900 dark:text-gray-100'}>{value}</span>
    </div>
  )
}

function StatusChip({ status }) {
  const map = {
    paid:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    partial: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    unpaid:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

export default function PurchaseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { settings, loadSettings, showToast } = useSettingsStore()

  const [purchase, setPurchase] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [waModal, setWaModal] = useState(null)

  useEffect(() => { loadData(); loadSettings() }, [id])

  async function loadData() {
    setLoading(true)
    const res = await window.api.purchases.getById(parseInt(id))
    if (res.success) setPurchase(res.data)
    else { showToast('Purchase not found', 'error'); navigate('/purchases') }
    setLoading(false)
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await window.api.purchases.delete(parseInt(id))
    setDeleting(false)
    if (res.success) { showToast('Deleted', 'success'); navigate('/purchases') }
    else showToast(res.error || 'Delete failed', 'error')
  }

  // ── Download PDF ──
  async function handleDownloadPDF() {
    setPdfLoading(true)
    try {
      await downloadPDF(purchase, settings, 'purchase')
      showToast('PDF downloaded!', 'success')
    } catch (e) {
      showToast('PDF error: ' + (e?.message || 'Unknown error'), 'error')
    } finally { setPdfLoading(false) }
  }

  async function handlePrint() {
    try {
      const blob = await generatePDFBlob(purchase, settings, 'purchase')
      const arrayBuffer = await blob.arrayBuffer()
      
      const res = await window.api.pdf.print({ buffer: arrayBuffer })
      if (!res.success) throw new Error(res.error)
    } catch (e) {
      showToast('Print error: ' + (e?.message || 'Unknown error'), 'error')
    }
  }

  // ── WhatsApp: save PDF silently, then show step-by-step modal ──
  async function handleSendWhatsApp() {
    setPdfLoading(true)
    try {
      const result = await prepareForWhatsApp(purchase, settings, 'purchase')
      setWaModal(result)
      
      if (result.waUrl) {
        window.open(result.waUrl, '_blank')
      }
    } catch (e) {
      console.error('WhatsApp error:', e)
      showToast('Error: ' + (e?.message || 'Unknown error'), 'error')
    } finally {
      setPdfLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!purchase) return null

  const isIntra     = (purchase.supply_type || 'intra') === 'intra'
  const items       = purchase.items || []
  const subtotal    = parseFloat(purchase.subtotal || purchase.taxable_amount) || 0
  const totalCGST   = parseFloat(purchase.total_cgst)  || 0
  const totalSGST   = parseFloat(purchase.total_sgst)  || 0
  const totalIGST   = parseFloat(purchase.total_igst)  || 0
  const fwd         = parseFloat(purchase.forwarding_charges) || 0
  const fwdGst      = parseFloat(purchase.forwarding_gst) || 0
  const pkg         = parseFloat(purchase.packaging_charges) || 0
  const pkgGst      = parseFloat(purchase.packaging_gst) || 0
  const othr        = parseFloat(purchase.other_charges) || 0
  const roundOff    = parseFloat(purchase.round_off) || 0
  const grandTotal  = parseFloat(purchase.grand_total) || 0
  const amountPaid  = parseFloat(purchase.amount_paid) || 0
  const balanceDue  = parseFloat(purchase.balance_due) || 0

  return (
    <div className="max-w-4xl mx-auto space-y-4">

      {/* ── Action Bar ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/purchases')}
          className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-2">
          <Button icon={Edit2} variant="secondary" onClick={() => navigate(`/purchases/${id}/edit`)}>
            Edit
          </Button>
          <Button icon={Printer} variant="secondary" onClick={handlePrint}>Print</Button>
          <Button icon={Download} variant="success" loading={pdfLoading} onClick={handleDownloadPDF}>
            Download PDF
          </Button>
          <button
            onClick={handleSendWhatsApp}
            disabled={pdfLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-green-500 hover:bg-green-600 disabled:opacity-60 disabled:cursor-not-allowed text-white transition-colors"
            title="Download PDF & open WhatsApp"
          >
            {pdfLoading
              ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <MessageCircle size={15} />
            }
            WhatsApp
          </button>
          <Button icon={Trash2} variant="danger" onClick={() => setDeleteOpen(true)}>Delete</Button>
        </div>
      </div>

      {/* ── Invoice Card (Tally Style) ── */}
      <div className="bg-white dark:bg-gray-800 border border-black dark:border-gray-600 rounded-none overflow-hidden text-[12px] shadow-sm mb-10">
        {/* Header Title */}
        <div className="border-b border-black dark:border-gray-600 py-1 text-center font-bold text-sm uppercase bg-gray-50 dark:bg-gray-700/30">
          Purchase Invoice
        </div>

        {/* Top Section Grid */}
        <div className="grid grid-cols-12 border-b border-black dark:border-gray-600">
          {/* Left Column: Company & Addresses */}
          <div className="col-span-7 border-r border-black dark:border-gray-600 flex flex-col">
            {/* Company Box */}
            <div className="p-3 border-b border-black dark:border-gray-600 min-h-[120px]">
              <div className="flex gap-4 mb-3">
                {settings?.company_logo && <img src={settings.company_logo} alt="logo" className="w-14 h-14 object-contain" />}
                <div className="flex-1">
                  <h1 className="text-base font-bold uppercase leading-tight mb-1">{settings?.company_name || 'Your Company'}</h1>
                  <p className="text-[11px] text-gray-700 dark:text-gray-300 leading-tight whitespace-pre-line">{settings?.company_address}</p>
                  <p className="text-[11px] text-gray-700 dark:text-gray-300 font-medium">
                    {settings?.company_city}{settings?.company_city && settings?.company_state && ', '}{settings?.company_state} {settings?.company_pin && `- ${settings.company_pin}`}
                  </p>
                </div>
              </div>
              <div className="space-y-0.5 text-[11px] text-gray-800 dark:text-gray-200">
                <p><span className="font-semibold">GSTIN/UIN:</span> {settings?.company_gstin || ''}</p>
                <p><span className="font-semibold">State Name:</span> {settings?.company_state || ''}, <span className="font-semibold">Code:</span> {settings?.company_state_code || ''}</p>
                <p><span className="font-semibold">Contact:</span> {settings?.company_phone || ''}</p>
              </div>
            </div>

            {/* Supplier Box (Bill from) */}
            <div className="p-3 border-b border-black dark:border-gray-600 min-h-[90px] bg-gray-50/30 dark:bg-gray-700/10">
              <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Supplier (Bill from)</p>
              <h2 className="font-bold uppercase text-[12px] mb-1">{purchase.supplier_name}</h2>
              <p className="text-[11px] text-gray-700 dark:text-gray-300 leading-tight mb-2 whitespace-pre-line">
                {purchase.supplier_address}
              </p>
              <div className="text-[11px] text-gray-800 dark:text-gray-200">
                <p><span className="font-semibold">GSTIN/UIN:</span> {purchase.supplier_gstin || ''}</p>
                <p><span className="font-semibold">State Name:</span> {purchase.supplier_state || ''}, <span className="font-semibold">Code:</span> {getStateCode(purchase.supplier_state)}</p>
                <p><span className="font-semibold">Contact:</span> {purchase.supplier_phone || ''}</p>
              </div>
            </div>

            {/* Buyer Box (Bill to) */}
            <div className="p-3 min-h-[110px]">
              <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Buyer (Bill to)</p>
              <h2 className="font-bold uppercase text-[12px] mb-1">{settings?.company_name || 'Your Company'}</h2>
              <p className="text-[11px] text-gray-700 dark:text-gray-300 leading-tight mb-2 whitespace-pre-line">
                {settings?.company_address}
              </p>
              <div className="text-[11px] text-gray-800 dark:text-gray-200 space-y-0.5">
                <p><span className="font-semibold">GSTIN/UIN:</span> {settings?.company_gstin || ''}</p>
                <p><span className="font-semibold">State Name:</span> {settings?.company_state || ''}, <span className="font-semibold">Code:</span> {settings?.company_state_code || ''}</p>
              </div>
            </div>
          </div>

          {/* Right Column: Meta Grid */}
          <div className="col-span-5 flex flex-col">
            {[
              { label: 'Bill No.', value: purchase.bill_number, label2: 'Dated', value2: formatDate(purchase.bill_date) },
              { label: 'Supply Type', value: isIntra ? 'INTRA-STATE' : 'INTER-STATE', label2: 'Place of Supply', value2: purchase.place_of_supply },
              { label: 'Payment Status', value: purchase.payment_status, label2: 'Due Date', value2: purchase.due_date ? formatDate(purchase.due_date) : '' },
              { label: 'Order No.', value: purchase.order_no, label2: 'Order Date', value2: purchase.order_date ? formatDate(purchase.order_date) : '' },
            ].map((row, i) => (
              <div key={i} className="grid grid-cols-2 border-b border-black dark:border-gray-600 min-h-[45px]">
                <div className="p-2 border-r border-black dark:border-gray-600">
                  <p className="text-[10px] font-medium text-gray-500 uppercase">{row.label}</p>
                  <p className="font-bold uppercase text-[11px] mt-0.5 text-gray-900 dark:text-gray-100">{row.value || ''}</p>
                </div>
                <div className="p-2">
                  <p className="text-[10px] font-medium text-gray-500 uppercase">{row.label2}</p>
                  <p className="font-bold uppercase text-[11px] mt-0.5 text-gray-900 dark:text-gray-100">{row.value2 || ''}</p>
                </div>
              </div>
            ))}
            <div className="p-2 flex-1 bg-gray-50/10 dark:bg-gray-700/5">
              <p className="text-[10px] font-medium text-gray-500 uppercase mb-1">Notes / Narration</p>
              <p className="text-[11px] uppercase text-gray-700 dark:text-gray-300 whitespace-pre-line leading-tight">
                {purchase.notes}
              </p>
            </div>
          </div>
        </div>

        {/* Place of Supply Bar */}
        <div className="px-3 py-1.5 border-b border-black dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-[12px]">
          Place of Supply : <span className="font-bold uppercase">{purchase.place_of_supply || purchase.supplier_state}</span>
        </div>

        {/* Line Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-black dark:border-gray-600 bg-gray-50 dark:bg-gray-700/70">
                <th className="border-r border-black dark:border-gray-600 p-1 w-[45px] text-center font-bold">SL NO.</th>
                <th className="border-r border-black dark:border-gray-600 p-2 text-left font-bold">DESCRIPTION OF GOODS</th>
                <th className="border-r border-black dark:border-gray-600 p-1 w-[90px] text-center font-bold">HSN/SAC</th>
                <th className="border-r border-black dark:border-gray-600 p-1 w-[90px] text-center font-bold">QUANTITY</th>
                <th className="border-r border-black dark:border-gray-600 p-1 w-[90px] text-center font-bold">RATE</th>
                <th className="border-r border-black dark:border-gray-600 p-1 w-[60px] text-center font-bold">PER</th>
                <th className="border-r border-black dark:border-gray-600 p-1 w-[70px] text-center font-bold">DISC. %</th>
                <th className="p-2 w-[110px] text-right font-bold">AMOUNT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {items.map((item, idx) => (
                <tr key={idx} className="min-h-[30px]">
                  <td className="border-r border-black dark:border-gray-600 p-2 text-center font-bold align-top">{idx + 1}</td>
                  <td className="border-r border-black dark:border-gray-600 p-2 align-top">
                    <div className="font-bold uppercase text-[12px] text-gray-900 dark:text-gray-100">{item.product_name || item.description}</div>
                    {item.item_notes && item.item_notes !== (item.product_name || item.description) && (
                      <div className="text-[10px] text-gray-500 mt-1 italic leading-tight">{item.item_notes}</div>
                    )}
                  </td>
                  <td className="border-r border-black dark:border-gray-600 p-2 text-center align-top font-mono">{item.hsn_code}</td>
                  <td className="border-r border-black dark:border-gray-600 p-2 text-center align-top font-bold text-[12px]">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="border-r border-black dark:border-gray-600 p-2 text-right align-top">{formatCurrency(item.rate)}</td>
                  <td className="border-r border-black dark:border-gray-600 p-2 text-center align-top uppercase">{item.unit}</td>
                  <td className="border-r border-black dark:border-gray-600 p-2 text-center align-top">{item.discount_percent > 0 ? `${item.discount_percent}%` : ''}</td>
                  <td className="p-2 text-right align-top font-bold text-[12px]">{formatCurrency(item.taxable_amount)}</td>
                </tr>
              ))}
              
              {/* Filler rows */}
              {items.length < 5 && Array.from({ length: 5 - items.length }).map((_, i) => (
                <tr key={`filler-${i}`} className="min-h-[25px]">
                  <td className="border-r border-black dark:border-gray-600 p-2"></td>
                  <td className="border-r border-black dark:border-gray-600 p-2"></td>
                  <td className="border-r border-black dark:border-gray-600 p-2"></td>
                  <td className="border-r border-black dark:border-gray-600 p-2"></td>
                  <td className="border-r border-black dark:border-gray-600 p-2"></td>
                  <td className="border-r border-black dark:border-gray-600 p-2"></td>
                  <td className="border-r border-black dark:border-gray-600 p-2"></td>
                  <td className="p-2"></td>
                </tr>
              ))}

              {/* Total Row */}
              <tr className="border-t border-black dark:border-gray-600 font-bold bg-gray-50/30 dark:bg-gray-700/20">
                <td className="border-r border-black dark:border-gray-600 p-1.5"></td>
                <td className="border-r border-black dark:border-gray-600 p-1.5 text-right uppercase">Total</td>
                <td className="border-r border-black dark:border-gray-600 p-1.5"></td>
                <td className="border-r border-black dark:border-gray-600 p-1.5"></td>
                <td className="border-r border-black dark:border-gray-600 p-1.5"></td>
                <td className="border-r border-black dark:border-gray-600 p-1.5"></td>
                <td className="border-r border-black dark:border-gray-600 p-1.5"></td>
                <td className="p-1.5 text-right font-bold text-[12px] border-t border-black dark:border-gray-600">{formatCurrency(subtotal)}</td>
              </tr>

              {/* SGST Row */}
              {isIntra && (
                <tr className="font-bold">
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1 text-right uppercase pr-4">SGST</td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="p-1 text-right">{formatCurrency(totalSGST + (fwdGst/2) + (pkgGst/2))}</td>
                </tr>
              )}

              {/* CGST Row */}
              {isIntra && (
                <tr className="font-bold">
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1 text-right uppercase pr-4">CGST</td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="p-1 text-right">{formatCurrency(totalCGST + (fwdGst/2) + (pkgGst/2))}</td>
                </tr>
              )}

              {/* IGST Row */}
              {!isIntra && (
                <tr className="font-bold">
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1 text-right uppercase pr-4">IGST</td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="p-1 text-right">{formatCurrency(totalIGST + fwdGst + pkgGst)}</td>
                </tr>
              )}

              {/* Additional Charges */}
              {fwd > 0 && (
                <tr className="font-bold">
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1 text-right uppercase pr-4">Forwarding Charges</td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="p-1 text-right">{formatCurrency(fwd)}</td>
                </tr>
              )}
              {pkg > 0 && (
                <tr className="font-bold">
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1 text-right uppercase pr-4">Packaging Charges</td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="p-1 text-right">{formatCurrency(pkg)}</td>
                </tr>
              )}
              {othr > 0 && (
                <tr className="font-bold">
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1 text-right uppercase pr-4">Other Charges</td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="p-1 text-right">{formatCurrency(othr)}</td>
                </tr>
              )}

              {/* Round Off Row */}
              {roundOff !== 0 && (
                <tr className="font-bold">
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1 text-right uppercase pr-4">Round Off</td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="border-r border-black dark:border-gray-600 p-1"></td>
                  <td className="p-1 text-right">{formatCurrency(roundOff)}</td>
                </tr>
              )}

              {/* Grand Total Row */}
              <tr className="border-t border-black dark:border-gray-600 font-bold bg-gray-100/50 dark:bg-gray-700/60 text-[14px]">
                <td className="border-r border-black dark:border-gray-600 p-2"></td>
                <td className="border-r border-black dark:border-gray-600 p-2 text-right uppercase font-black">Total</td>
                <td className="border-r border-black dark:border-gray-600 p-2"></td>
                <td className="border-r border-black dark:border-gray-600 p-2"></td>
                <td className="border-r border-black dark:border-gray-600 p-2"></td>
                <td className="border-r border-black dark:border-gray-600 p-2"></td>
                <td className="border-r border-black dark:border-gray-600 p-2"></td>
                <td className="p-2 text-right text-indigo-700 dark:text-indigo-300 font-black">{formatCurrency(grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Amount in Words */}
        <div className="p-3 border-t border-black dark:border-gray-600 bg-gray-50/20 dark:bg-gray-800/20">
          <div className="flex justify-between items-center text-[10px] font-semibold text-gray-500 uppercase mb-1">
            <span>Amount Chargeable (in words)</span>
            <span className="italic font-normal">E. & O.E</span>
          </div>
          <div className="font-bold uppercase text-[12px] text-gray-900 dark:text-gray-100">
            {numberToWords(grandTotal)} Only
          </div>
        </div>

        {/* Bank + Notes Footer */}
        <div className="grid grid-cols-12 border-t border-black dark:border-gray-600 min-h-[100px]">
          <div className="col-span-8 border-r border-black dark:border-gray-600 flex flex-col">
            <div className="p-3 border-b border-black dark:border-gray-600 flex-1">
               <p className="text-[10px] font-semibold text-gray-500 uppercase mb-2 underline">Company's Bank Details</p>
               <div className="grid grid-cols-2 text-[11px] gap-x-4 gap-y-1 text-gray-800 dark:text-gray-200">
                  <p><span className="font-semibold text-gray-600 dark:text-gray-400">Bank Name:</span> {settings?.bank_name || 'N/A'}</p>
                  <p><span className="font-semibold text-gray-600 dark:text-gray-400">A/c No.:</span> {settings?.bank_account || 'N/A'}</p>
                  <p><span className="font-semibold text-gray-600 dark:text-gray-400">IFS Code:</span> {settings?.bank_ifsc || 'N/A'}</p>
                  <p><span className="font-semibold text-gray-600 dark:text-gray-400">Branch:</span> {settings?.bank_branch || 'N/A'}</p>
               </div>
            </div>
            <div className="p-3 flex-1">
              <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Declaration</p>
              <p className="text-[10px] text-gray-700 dark:text-gray-300 leading-tight italic">
                {settings?.declaration || 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.'}
              </p>
            </div>
          </div>
          <div className="col-span-4 p-3 flex flex-col items-center justify-between text-center bg-gray-50/10 dark:bg-gray-700/5">
            <p className="text-[11px] font-bold uppercase">For {settings?.company_name || 'Your Company'}</p>
            <div className="h-16 relative flex items-center justify-center w-full overflow-hidden">
              {settings?.company_stamp && (
                <img
                  src={settings.company_stamp}
                  alt="Stamp"
                  className="absolute left-4 max-h-14 max-w-[60px] object-contain opacity-80 pointer-events-none select-none"
                />
              )}
              {settings?.company_signature && (
                <img
                  src={settings.company_signature}
                  alt="Signature"
                  className="max-h-12 max-w-[120px] object-contain relative z-10 pointer-events-none select-none"
                />
              )}
              {!settings?.company_signature && !settings?.company_stamp && (
                <span className="italic text-gray-400 text-[10px]">(Stamp & Signature)</span>
              )}
            </div>
            <div className="w-full border-t border-black dark:border-gray-600 pt-1">
              <p className="text-[10px] font-bold">Authorised Signatory</p>
            </div>
          </div>
        </div>
        <p className="text-center text-[10px] text-gray-400 mt-2 py-1">This is a computer generated purchase invoice.</p>
      </div>

      <WhatsAppModal
        open={!!waModal}
        onClose={() => setWaModal(null)}
        filePath={waModal?.filePath}
        waUrl={waModal?.waUrl}
        fileName={waModal?.fileName}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Purchase Invoice"
        message={`Delete bill "${purchase.bill_number}"? Stock will be reversed.`}
      />
    </div>
  )
}
