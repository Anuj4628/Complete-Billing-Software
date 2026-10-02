import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Edit2, Trash2, Printer, CheckCircle } from 'lucide-react'
import Button from '../../components/ui/Button.jsx'
import Badge from '../../components/ui/Badge.jsx'
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx'
import { formatCurrency, formatDate, numberToWords } from '../../utils/formatters.js'
import { useSettingsStore } from '../../store/useSettingsStore.js'
import { useQuotationStore } from '../../store/useQuotationStore.js'
import { downloadPDF, generatePDFBlob } from '../../utils/pdfGenerator.jsx'
import { getStateCode } from '../../utils/gstHelpers.js'

export default function QuotationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getById, deleteQuotation } = useQuotationStore()
  const { settings, loadSettings, showToast } = useSettingsStore()

  const [quotation, setQuotation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  useEffect(() => {
    loadData()
    loadSettings()
  }, [id])

  async function loadData() {
    setLoading(true)
    const res = await getById(parseInt(id, 10))
    if (res.success && res.data) {
      setQuotation(res.data)
    } else {
      navigate('/quotations')
    }
    setLoading(false)
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await deleteQuotation(parseInt(id, 10))
    setDeleting(false)
    if (res.success) {
      navigate('/quotations')
    }
  }

  async function handleDownloadPDF() {
    setPdfLoading(true)
    try {
      await downloadPDF(quotation, settings, 'quotation')
      showToast('Quotation PDF downloaded!', 'success')
    } catch (e) {
      showToast('PDF error: ' + (e?.message || 'Unknown error'), 'error')
    } finally {
      setPdfLoading(false)
    }
  }

  async function handlePrint() {
    try {
      const blob = await generatePDFBlob(quotation, settings, 'quotation')
      if (window.api?.pdf?.print) {
        const arrayBuffer = await blob.arrayBuffer()
        const res = await window.api.pdf.print({ buffer: Array.from(new Uint8Array(arrayBuffer)) })
        if (!res.success) throw new Error(res.error)
      } else {
        const url = URL.createObjectURL(blob)
        const w = window.open(url)
        if (w) {
          w.addEventListener('load', () => {
            w.print()
            URL.revokeObjectURL(url)
          })
        }
      }
    } catch (e) {
      showToast('Print error: ' + (e?.message || 'Unknown error'), 'error')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!quotation) return null

  const isIntra = (quotation.supply_type || 'intra') === 'intra'
  const items = quotation.items || []
  const subtotal = parseFloat(quotation.subtotal || quotation.taxable_amount || 0)
  const freight = parseFloat(quotation.freight || 0)
  const packing = parseFloat(quotation.packing_charges || 0)
  const cgst = parseFloat(quotation.total_cgst || 0)
  const sgst = parseFloat(quotation.total_sgst || 0)
  const igst = parseFloat(quotation.total_igst || 0)
  const grandTotal = parseFloat(quotation.grand_total || 0)
  const words = quotation.amount_in_words || numberToWords(grandTotal)

  let parsedTerms = []
  if (quotation.terms_conditions) {
    try {
      const parsed = typeof quotation.terms_conditions === 'string'
        ? JSON.parse(quotation.terms_conditions)
        : quotation.terms_conditions
      if (Array.isArray(parsed)) parsedTerms = parsed
      else if (typeof quotation.terms_conditions === 'string') parsedTerms = quotation.terms_conditions.split('\n').filter(Boolean)
    } catch (_) {
      if (typeof quotation.terms_conditions === 'string') parsedTerms = quotation.terms_conditions.split('\n').filter(Boolean)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* ── ACTION BAR ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => navigate('/quotations')}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={16} /> Back to Quotations
        </button>

        <div className="flex items-center gap-2.5">
          <Button
            icon={Edit2}
            variant="secondary"
            onClick={() => navigate(`/quotations/${id}/edit`)}
          >
            Edit
          </Button>
          <Button icon={Printer} variant="secondary" onClick={handlePrint}>
            Print
          </Button>
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-sm transition-colors disabled:opacity-50"
          >
            {pdfLoading ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download size={14} />
            )}
            Download PDF
          </button>
          <Button icon={Trash2} variant="danger" onClick={() => setDeleteOpen(true)}>
            Delete
          </Button>
        </div>
      </div>

      {/* ── QUOTATION PREVIEW CARD (Tally / Industrial Style) ── */}
      <div className="bg-white dark:bg-gray-800 border border-gray-900 dark:border-gray-600 rounded-none overflow-hidden text-xs shadow-md">
        
        {/* Header Title */}
        <div className="border-b border-gray-900 dark:border-gray-600 py-2 text-center font-bold text-sm uppercase tracking-wider bg-gray-50 dark:bg-gray-750">
          Quotation
        </div>

        {/* Top Section Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 border-b border-gray-900 dark:border-gray-600">
          {/* Left Column: Company & Buyer */}
          <div className="md:col-span-7 border-b md:border-b-0 md:border-r border-gray-900 dark:border-gray-600 flex flex-col">
            
            {/* Company Box */}
            <div className="p-3.5 border-b border-gray-900 dark:border-gray-600 min-h-[110px]">
              <div className="flex gap-3 mb-2.5">
                {settings?.company_logo && (
                  <img src={settings.company_logo} alt="logo" className="w-12 h-12 object-contain" />
                )}
                <div>
                  <h1 className="text-sm font-bold uppercase leading-tight text-gray-900 dark:text-gray-100">
                    {settings?.company_name || 'YOUR COMPANY'}
                  </h1>
                  <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-tight">
                    {settings?.company_address}
                  </p>
                  <p className="text-[11px] text-gray-600 dark:text-gray-300">
                    {settings?.company_city}{settings?.company_city && settings?.company_state ? ', ' : ''}{settings?.company_state} {settings?.company_pin ? `- ${settings.company_pin}` : ''}
                  </p>
                </div>
              </div>
              <div className="space-y-0.5 text-[11px] text-gray-700 dark:text-gray-300">
                <p><span className="font-semibold">GSTIN/UIN:</span> {settings?.company_gstin || ''}</p>
                <p><span className="font-semibold">State Name:</span> {settings?.company_state || ''}, <span className="font-semibold">Code:</span> {settings?.company_state_code || getStateCode(settings?.company_state || '') || ''}</p>
                <p><span className="font-semibold">Contact:</span> {settings?.company_phone || ''}</p>
                <p><span className="font-semibold">E-Mail:</span> {settings?.company_email || ''}</p>
              </div>
            </div>

            {/* Buyer Box */}
            <div className="p-3.5 min-h-[90px]">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Buyer (Bill To)
              </p>
              <h2 className="font-bold uppercase text-xs text-gray-900 dark:text-gray-100 mb-1">
                {quotation.customer_name || 'VALUED CUSTOMER'}
              </h2>
              {quotation.customer_address && (
                <p className="text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                  {quotation.customer_address}
                </p>
              )}
              <div className="text-[11px] text-gray-700 dark:text-gray-300 space-y-0.5">
                <p><span className="font-semibold">GSTIN/UIN:</span> {quotation.customer_gstin || 'UNREGISTERED'}</p>
                <p><span className="font-semibold">State Name:</span> {quotation.customer_state || ''}, <span className="font-semibold">Code:</span> {getStateCode(quotation.customer_state || '') || ''}</p>
                {quotation.customer_phone && <p><span className="font-semibold">Contact:</span> {quotation.customer_phone}</p>}
                {quotation.customer_email && <p><span className="font-semibold">E-Mail:</span> {quotation.customer_email}</p>}
              </div>
            </div>

            {/* Consignee Box (if present and distinct) */}
            {quotation.consignee_name && quotation.consignee_name !== quotation.customer_name && (
              <div className="p-3.5 border-t border-gray-900 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-750/30">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Consignee (Ship To)
                </p>
                <h3 className="font-bold uppercase text-xs text-gray-900 dark:text-gray-100 mb-1">
                  {quotation.consignee_name}
                </h3>
                {quotation.consignee_address && (
                  <p className="text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                    {quotation.consignee_address}
                  </p>
                )}
                <div className="text-[11px] text-gray-700 dark:text-gray-300 space-y-0.5">
                  <p><span className="font-semibold">GSTIN/UIN:</span> {quotation.consignee_gstin || ''}</p>
                  <p><span className="font-semibold">State:</span> {quotation.consignee_state || ''}</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Meta Information */}
          <div className="md:col-span-5 flex flex-col justify-between">
            <div className="divide-y divide-gray-900 dark:divide-gray-600">
              <div className="grid grid-cols-2 divide-x divide-gray-900 dark:divide-gray-600">
                <div className="p-2.5">
                  <p className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold">Quotation No.</p>
                  <p className="text-xs font-mono font-bold text-gray-900 dark:text-gray-100">{quotation.quotation_number}</p>
                </div>
                <div className="p-2.5">
                  <p className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold">Dated</p>
                  <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{formatDate(quotation.quotation_date)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 divide-x divide-gray-900 dark:divide-gray-600">
                <div className="p-2.5">
                  <p className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold">Valid Until</p>
                  <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{formatDate(quotation.valid_until) || '15 Days'}</p>
                </div>
                <div className="p-2.5">
                  <p className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold">Status</p>
                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                    {quotation.status || 'Draft'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 divide-x divide-gray-900 dark:divide-gray-600">
                <div className="p-2.5">
                  <p className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold">Customer RFQ Ref.</p>
                  <p className="text-xs font-medium text-gray-900 dark:text-gray-100">{quotation.rfq_reference || 'N/A'}</p>
                </div>
                <div className="p-2.5">
                  <p className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold">Prepared By</p>
                  <p className="text-xs font-medium text-gray-900 dark:text-gray-100">{quotation.salesperson || settings?.authorized_signatory || 'N/A'}</p>
                </div>
              </div>

              <div className="p-2.5">
                <p className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold">Currency & Supply</p>
                <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                  {quotation.currency || 'INR'} • {isIntra ? 'INTRASTATE (CGST+SGST)' : 'INTERSTATE (IGST)'}
                </p>
              </div>
            </div>

            {quotation.notes && (
              <div className="p-3 border-t border-gray-900 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-750/30">
                <p className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold mb-0.5">Notes / Terms of Delivery</p>
                <p className="text-xs text-gray-800 dark:text-gray-200">{quotation.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── ITEMS TABLE ── */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-900 dark:border-gray-600 text-[10px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-750">
                <th className="py-2 px-2 text-center w-12 border-r border-gray-900 dark:border-gray-600">S.N.</th>
                <th className="py-2 px-3 border-r border-gray-900 dark:border-gray-600">Description of Goods & Specification</th>
                <th className="py-2 px-2 text-center w-24 border-r border-gray-900 dark:border-gray-600">HSN/SAC</th>
                <th className="py-2 px-2 text-center w-24 border-r border-gray-900 dark:border-gray-600">Qty</th>
                <th className="py-2 px-3 text-right w-28 border-r border-gray-900 dark:border-gray-600">Rate (₹)</th>
                <th className="py-2 px-3 text-right w-36">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {items.map((it, idx) => {
                const q = parseFloat(it.quantity || 0)
                const r = parseFloat(it.rate || 0)
                const amt = q * r
                return (
                  <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-750/50">
                    <td className="py-2 px-2 text-center font-bold text-gray-500 border-r border-gray-900 dark:border-gray-600 select-none">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 border-r border-gray-900 dark:border-gray-600">
                      <div className="font-bold text-gray-900 dark:text-gray-100">{it.description}</div>
                      {it.specification && (
                        <div className="text-[11px] text-gray-500 mt-0.5">{it.specification}</div>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center border-r border-gray-900 dark:border-gray-600 text-gray-600 dark:text-gray-400">
                      {it.hsn_code || '-'}
                    </td>
                    <td className="py-2 px-2 text-center font-semibold border-r border-gray-900 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                      {q} {it.unit || 'pcs'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono border-r border-gray-900 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                      {formatCurrency(r, '₹')}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-gray-900 dark:text-gray-100">
                      {formatCurrency(amt, '₹')}
                    </td>
                  </tr>
                )
              })}

              {/* Extra Charges Rows */}
              {freight > 0 && (
                <tr className="bg-gray-50/30 dark:bg-gray-750/30">
                  <td className="py-1.5 px-2 text-center text-gray-400 border-r border-gray-900 dark:border-gray-600">-</td>
                  <td className="py-1.5 px-3 font-medium text-gray-700 dark:text-gray-300 border-r border-gray-900 dark:border-gray-600">
                    Freight / Transportation Charges
                  </td>
                  <td className="py-1.5 px-2 text-center border-r border-gray-900 dark:border-gray-600 text-gray-400">996511</td>
                  <td className="py-1.5 px-2 text-center border-r border-gray-900 dark:border-gray-600">1 L/S</td>
                  <td className="py-1.5 px-3 text-right font-mono border-r border-gray-900 dark:border-gray-600">{formatCurrency(freight, '₹')}</td>
                  <td className="py-1.5 px-3 text-right font-mono font-semibold">{formatCurrency(freight, '₹')}</td>
                </tr>
              )}

              {packing > 0 && (
                <tr className="bg-gray-50/30 dark:bg-gray-750/30">
                  <td className="py-1.5 px-2 text-center text-gray-400 border-r border-gray-900 dark:border-gray-600">-</td>
                  <td className="py-1.5 px-3 font-medium text-gray-700 dark:text-gray-300 border-r border-gray-900 dark:border-gray-600">
                    Packing & Handling Charges
                  </td>
                  <td className="py-1.5 px-2 text-center border-r border-gray-900 dark:border-gray-600 text-gray-400">996511</td>
                  <td className="py-1.5 px-2 text-center border-r border-gray-900 dark:border-gray-600">1 L/S</td>
                  <td className="py-1.5 px-3 text-right font-mono border-r border-gray-900 dark:border-gray-600">{formatCurrency(packing, '₹')}</td>
                  <td className="py-1.5 px-3 text-right font-mono font-semibold">{formatCurrency(packing, '₹')}</td>
                </tr>
              )}

              {/* Tax Rows */}
              {isIntra ? (
                <>
                  <tr className="bg-gray-50/30 dark:bg-gray-750/30">
                    <td className="py-1.5 px-2 text-center text-gray-400 border-r border-gray-900 dark:border-gray-600">-</td>
                    <td className="py-1.5 px-3 font-medium text-gray-700 dark:text-gray-300 border-r border-gray-900 dark:border-gray-600">
                      OUTPUT CGST @ {(parseFloat(quotation.tax_rate || 18) / 2)}%
                    </td>
                    <td className="py-1.5 px-2 text-center border-r border-gray-900 dark:border-gray-600 text-gray-400">-</td>
                    <td className="py-1.5 px-2 text-center border-r border-gray-900 dark:border-gray-600">-</td>
                    <td className="py-1.5 px-3 text-right font-mono border-r border-gray-900 dark:border-gray-600">-</td>
                    <td className="py-1.5 px-3 text-right font-mono font-semibold">{formatCurrency(cgst, '₹')}</td>
                  </tr>
                  <tr className="bg-gray-50/30 dark:bg-gray-750/30">
                    <td className="py-1.5 px-2 text-center text-gray-400 border-r border-gray-900 dark:border-gray-600">-</td>
                    <td className="py-1.5 px-3 font-medium text-gray-700 dark:text-gray-300 border-r border-gray-900 dark:border-gray-600">
                      OUTPUT SGST @ {(parseFloat(quotation.tax_rate || 18) / 2)}%
                    </td>
                    <td className="py-1.5 px-2 text-center border-r border-gray-900 dark:border-gray-600 text-gray-400">-</td>
                    <td className="py-1.5 px-2 text-center border-r border-gray-900 dark:border-gray-600">-</td>
                    <td className="py-1.5 px-3 text-right font-mono border-r border-gray-900 dark:border-gray-600">-</td>
                    <td className="py-1.5 px-3 text-right font-mono font-semibold">{formatCurrency(sgst, '₹')}</td>
                  </tr>
                </>
              ) : (
                <tr className="bg-gray-50/30 dark:bg-gray-750/30">
                  <td className="py-1.5 px-2 text-center text-gray-400 border-r border-gray-900 dark:border-gray-600">-</td>
                  <td className="py-1.5 px-3 font-medium text-gray-700 dark:text-gray-300 border-r border-gray-900 dark:border-gray-600">
                    OUTPUT IGST @ {parseFloat(quotation.tax_rate || 18)}%
                  </td>
                  <td className="py-1.5 px-2 text-center border-r border-gray-900 dark:border-gray-600 text-gray-400">-</td>
                  <td className="py-1.5 px-2 text-center border-r border-gray-900 dark:border-gray-600">-</td>
                  <td className="py-1.5 px-3 text-right font-mono border-r border-gray-900 dark:border-gray-600">-</td>
                  <td className="py-1.5 px-3 text-right font-mono font-semibold">{formatCurrency(igst, '₹')}</td>
                </tr>
              )}
            </tbody>

            {/* Total Row */}
            <tfoot>
              <tr className="border-t-2 border-gray-900 dark:border-gray-600 bg-gray-50 dark:bg-gray-750 font-bold">
                <td className="py-2.5 px-2 text-center border-r border-gray-900 dark:border-gray-600">-</td>
                <td className="py-2.5 px-3 border-r border-gray-900 dark:border-gray-600 uppercase">
                  Grand Total
                </td>
                <td className="py-2.5 px-2 text-center border-r border-gray-900 dark:border-gray-600">-</td>
                <td className="py-2.5 px-2 text-center border-r border-gray-900 dark:border-gray-600">
                  {items.reduce((s, it) => s + parseFloat(it.quantity || 0), 0)}
                </td>
                <td className="py-2.5 px-3 text-right border-r border-gray-900 dark:border-gray-600">-</td>
                <td className="py-2.5 px-3 text-right font-mono text-sm text-red-600 dark:text-red-400">
                  {formatCurrency(grandTotal, '₹')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── AMOUNT IN WORDS ── */}
        <div className="p-3 border-t border-gray-900 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-750/30">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Amount Chargeable (in words):</p>
          <p className="text-xs font-semibold italic text-gray-800 dark:text-gray-200 mt-0.5">{words}</p>
        </div>

        {/* ── TERMS & CONDITIONS ── */}
        {parsedTerms.length > 0 && (
          <div className="p-3.5 border-t border-gray-900 dark:border-gray-600">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100 underline mb-2">
              Terms & Conditions:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-gray-700 dark:text-gray-300">
              {parsedTerms.map((t, i) => (
                <div key={i} className="flex gap-2">
                  <span className="font-bold text-gray-400 select-none">{i + 1}.</span>
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── FOOTER: Bank Details & Signatory ── */}
        <div className="grid grid-cols-1 md:grid-cols-12 border-t border-gray-900 dark:border-gray-600">
          <div className="md:col-span-4 p-3 border-b md:border-b-0 md:border-r border-gray-900 dark:border-gray-600">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100 underline mb-1">Declaration</p>
            <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-tight">
              {settings?.declaration || 'We declare that this quotation shows the actual proposed prices of goods and materials described and that all particulars are true and valid.'}
            </p>
            <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 mt-2">
              COMPANY'S PAN: <span className="font-mono">{settings?.company_pan || ''}</span>
            </p>
          </div>

          <div className="md:col-span-4 p-3 border-b md:border-b-0 md:border-r border-gray-900 dark:border-gray-600">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100 underline mb-1">Company's Bank Details</p>
            <div className="text-[11px] text-gray-700 dark:text-gray-300 space-y-0.5">
              <p><span className="font-semibold">Bank Name:</span> {settings?.bank_name || ''}</p>
              <p><span className="font-semibold">A/c No.:</span> <span className="font-mono">{settings?.bank_account || ''}</span></p>
              <p><span className="font-semibold">IFSC Code:</span> <span className="font-mono">{settings?.bank_ifsc || ''}</span></p>
            </div>
          </div>

          <div className="md:col-span-4 p-3 flex flex-col items-center justify-between text-center min-h-[110px]">
            <p className="text-[11px] font-bold uppercase text-gray-900 dark:text-gray-100">
              For {settings?.company_name || 'YOUR COMPANY'}
            </p>

            <div className="my-1 relative flex items-center justify-center h-12 w-full">
              {settings?.company_stamp && settings?.company_signature ? (
                <div className="relative flex items-center justify-center">
                  <img src={settings.company_stamp} alt="stamp" className="absolute w-12 h-12 object-contain opacity-85 left-4" />
                  <img src={settings.company_signature} alt="signature" className="h-10 object-contain relative z-10" />
                </div>
              ) : settings?.company_stamp ? (
                <img src={settings.company_stamp} alt="stamp" className="h-12 object-contain" />
              ) : settings?.company_signature ? (
                <img src={settings.company_signature} alt="signature" className="h-10 object-contain" />
              ) : (
                <div className="border border-dashed border-gray-300 dark:border-gray-600 px-4 py-1 text-[10px] text-gray-400">
                  Stamp / Signature
                </div>
              )}
            </div>

            <p className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 pt-1 border-t border-gray-400 w-3/4">
              Authorised Signatory
            </p>
          </div>
        </div>

      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Quotation"
        message={`Are you sure you want to delete quotation ${quotation.quotation_number}? This action cannot be undone.`}
      />
    </div>
  )
}
