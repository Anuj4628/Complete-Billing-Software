import {
  Document, Page, Text, View, StyleSheet, Image
} from '@react-pdf/renderer'
import { numberToWords, formatDate } from './formatters.js'
import { getStateCode, getShippingInfo, getBuyerInfo } from './gstHelpers.js'

// Standard colors
const B = '#000000'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    padding: 10,
    color: '#000000',
    backgroundColor: '#ffffff',
  },

  // Main Bordered Container
  mainContainer: {
    borderWidth: 1,
    borderColor: B,
    flexDirection: 'column',
    flex: 1,
  },

  // ── HEADER ──
  headerTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: B,
  },
  
  // New Layout Styles
  topGrid: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: B,
  },
  topLeftCol: {
    flex: 1.2,
    borderRightWidth: 1,
    borderRightColor: B,
  },
  topRightCol: {
    flex: 1,
  },
  
  companyBox: {
    padding: 3,
    borderBottomWidth: 1,
    borderBottomColor: B,
    minHeight: 65,
  },
  logoBox: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  logo: { width: 40, height: 40, marginRight: 10 },
  companyName: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  companyDetail: { fontSize: 7, marginBottom: 1 },
  
  buyerBox: {
    padding: 3,
    minHeight: 45,
  },
  boxLabel: { fontSize: 7, marginBottom: 3 },
  partyName: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  partyDetail: { fontSize: 7, marginBottom: 1 },

  metaGridRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: B,
    minHeight: 20,
  },
  metaGridCell: {
    flex: 1,
    padding: 3,
    borderRightWidth: 1,
    borderRightColor: B,
  },
  metaGridCellLast: {
    flex: 1,
    padding: 3,
  },
  metaLabel: { fontSize: 6.5, color: '#333', marginBottom: 2 },
  metaValue: { fontSize: 8, fontFamily: 'Helvetica-Bold' },
  
  termsOfDeliveryBox: {
    padding: 3,
    flex: 1,
  },

  // ── TABLE ──
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: B,
    minHeight: 20,
    alignItems: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    minHeight: 14,
  },
  tableCell: {
    paddingHorizontal: 3,
    paddingVertical: 1,
    fontSize: 8,
    borderRightWidth: 1,
    borderRightColor: B,
  },
  noBorderRight: { borderRightWidth: 0 },

  // ── ITEMS CONTAINER ──
  itemsContainer: {
    flex: 1,
    flexDirection: 'column',
  },

  // ── TOTALS ──
  totalRow: {
    flexDirection: 'row',
    minHeight: 14,
    alignItems: 'center',
  },
  tableRowNoBorder: {
    flexDirection: 'row',
    minHeight: 14,
  },
  amountInWordsSection: {
    padding: 3,
    borderBottomWidth: 1,
    borderBottomColor: B,
    borderTopWidth: 1,
    borderTopColor: B,
  },

  // ── TAX SUMMARY TABLE ──
  taxSummarySection: {
    padding: 3,
    borderBottomWidth: 1,
    borderBottomColor: B,
  },
  taxTable: {
    borderWidth: 1,
    borderColor: B,
  },
  taxRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: B,
  },
  taxCell: { 
    fontSize: 7, 
    textAlign: 'center', 
    borderRightWidth: 1, 
    borderColor: B,
    paddingVertical: 1,
  },

  // ── FOOTER ──
  footerSection: {
    flexDirection: 'row',
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: B,
  },
  footerLeft: { 
    flex: 1.5, 
    borderRightWidth: 1, 
    borderRightColor: B, 
    padding: 3 
  },
  footerMiddle: {
    flex: 1.1,
    borderRightWidth: 1,
    borderRightColor: B,
    padding: 0,
  },
  footerRight: { 
    flex: 1, 
    padding: 3, 
    alignItems: 'center', 
    justifyContent: 'space-between' 
  },
  bankTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', marginBottom: 2, textDecoration: 'underline' },
  signLine: { borderTopWidth: 1, borderTopColor: B, width: '90%', marginTop: 2, textAlign: 'center', paddingTop: 1 },

  stampBox: {
    width: 50,
    height: 35,
    borderWidth: 1,
    borderColor: B,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 2,
  },
  stampText: {
    fontSize: 10,
    color: '#3b82f6',
    fontFamily: 'Helvetica-Bold',
  },

  bottomJurisdiction: { fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginTop: 2 },
  bottomComputer: { fontSize: 7, textAlign: 'center', marginTop: 1 },
})

function fmt(n) {
  return parseFloat(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

const TableCell = ({ width, children, bold, align = 'center', noBorder, flex = 0 }) => (
  <View style={[styles.tableCell, { width }, noBorder && styles.noBorderRight, flex ? { flex } : {}]}>
    <Text style={{ 
      textAlign: align, 
      fontFamily: bold ? 'Helvetica-Bold' : 'Helvetica',
      fontSize: 8
    }}>
      {children}
    </Text>
  </View>
)

export function InvoicePDF({ invoice, settings }) {
  const isIntra = invoice.supply_type === 'intra'
  const companyStateCode = settings?.company_state_code || getStateCode(settings?.company_state || '')
  const shippingInfo = getShippingInfo(invoice)
  const buyerInfo = getBuyerInfo(invoice)

  const hsnMap = {}
  invoice.items.forEach(item => {
    const key = `${item.hsn_code}-${item.gst_percent}`
    if (!hsnMap[key]) {
      hsnMap[key] = { hsn: item.hsn_code, rate: item.gst_percent, taxable: 0, cgst: 0, sgst: 0, igst: 0 }
    }
    hsnMap[key].taxable += parseFloat(item.taxable_amount || 0)
    hsnMap[key].cgst += parseFloat(item.cgst_amount || 0)
    hsnMap[key].sgst += parseFloat(item.sgst_amount || 0)
    hsnMap[key].igst += parseFloat(item.igst_amount || 0)
  })

  // Include Shipping/Forwarding charges in tax summary if GST was applied
  if (parseFloat(invoice.shipping_charges || 0) > 0 && parseFloat(invoice.shipping_gst_percent || 0) > 0) {
    const sRate = parseFloat(invoice.shipping_gst_percent)
    const sTaxable = parseFloat(invoice.shipping_charges)
    const sKey = `SHIPPING-${sRate}`
    
    let sCgst = 0, sSgst = 0, sIgst = 0
    if (isIntra) {
      sCgst = (sTaxable * (sRate / 2)) / 100
      sSgst = (sTaxable * (sRate / 2)) / 100
    } else {
      sIgst = (sTaxable * sRate) / 100
    }

    if (!hsnMap[sKey]) {
      hsnMap[sKey] = { hsn: '996511', rate: sRate, taxable: 0, cgst: 0, sgst: 0, igst: 0 }
    }
    hsnMap[sKey].taxable += sTaxable
    hsnMap[sKey].cgst += sCgst
    hsnMap[sKey].sgst += sSgst
    hsnMap[sKey].igst += sIgst
  }

  const hsnRows = Object.values(hsnMap)

  return (
    <Document title={`Invoice-${invoice.invoice_number}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.mainContainer}>
          {/* ── TOP TITLE ── */}
          <Text style={styles.headerTitle}>TAX INVOICE</Text>

          {/* ── TOP GRID ── */}
          <View style={styles.topGrid}>
            {/* LEFT COLUMN: COMPANY & BUYER */}
            <View style={styles.topLeftCol}>
              <View style={styles.companyBox}>
                <View style={styles.logoBox}>
                  {settings?.company_logo && <Image src={settings.company_logo} style={styles.logo} />}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.companyName}>{(settings?.company_name || 'Your Company').toUpperCase()}</Text>
                    <Text style={[styles.companyDetail, { fontSize: 7 }]}>{settings?.company_address}</Text>
                    <Text style={[styles.companyDetail, { fontSize: 7 }]}>
                      {`${settings?.company_city || ''}, ${settings?.company_state || ''} - ${settings?.company_pin || ''}`}
                    </Text>
                  </View>
                </View>
                <Text style={styles.companyDetail}>{`GSTIN/UIN: ${settings?.company_gstin || ''}`}</Text>
                <Text style={styles.companyDetail}>{`State Name: ${settings?.company_state || ''}, Code: ${companyStateCode || ''}`}</Text>
                <Text style={styles.companyDetail}>{`Contact: ${settings?.company_phone || ''}`}</Text>
                <Text style={styles.companyDetail}>{`E-Mail: ${settings?.company_email || ''}`}</Text>
                {settings?.company_website && <Text style={styles.companyDetail}>{`Website: ${settings.company_website}`}</Text>}
              </View>

              <View style={[styles.buyerBox, { borderBottomWidth: 1, borderBottomColor: B }]}>
                <Text style={styles.boxLabel}>Buyer (Bill to)</Text>
                <Text style={styles.partyName}>{buyerInfo.buyerName?.toUpperCase()}</Text>
                <Text style={styles.partyDetail}>{buyerInfo.buyerAddress}</Text>
                <Text style={styles.partyDetail}>{`GSTIN/UIN: ${buyerInfo.buyerGstin || ''}`}</Text>
                <Text style={styles.partyDetail}>{`State Name: ${buyerInfo.buyerState || ''}, Code: ${buyerInfo.buyerStateCode || ''}`}</Text>
                <Text style={styles.partyDetail}>{`Place of Supply: ${invoice.place_of_supply || ''}`}</Text>
                {invoice.customer_contact_person && <Text style={styles.partyDetail}>{`Contact person: ${invoice.customer_contact_person}`}</Text>}
                <Text style={styles.partyDetail}>{`Contact: ${invoice.customer_phone || ''}`}</Text>
                {invoice.customer_email && <Text style={styles.partyDetail}>{`E-Mail: ${invoice.customer_email}`}</Text>}
              </View>

              <View style={styles.buyerBox}>
                <Text style={styles.boxLabel}>Consignee (Ship to)</Text>
                <Text style={styles.partyName}>{shippingInfo.shippingName?.toUpperCase()}</Text>
                <Text style={styles.partyDetail}>{shippingInfo.shippingAddress}</Text>
                <Text style={styles.partyDetail}>{`GSTIN/UIN: ${shippingInfo.shippingGstin || ''}`}</Text>
                <Text style={styles.partyDetail}>{`State Name: ${shippingInfo.shippingState || ''}, Code: ${shippingInfo.shippingStateCode || ''}`}</Text>
              </View>
            </View>

            {/* RIGHT COLUMN: META GRID */}
            <View style={styles.topRightCol}>
              <View style={styles.metaGridRow}>
                <View style={styles.metaGridCell}>
                  <Text style={styles.metaLabel}>Invoice No.</Text>
                  <Text style={styles.metaValue}>{invoice.invoice_number?.toUpperCase()}</Text>
                </View>
                <View style={styles.metaGridCellLast}>
                  <Text style={styles.metaLabel}>Dated</Text>
                  <Text style={styles.metaValue}>{formatDate(invoice.invoice_date)}</Text>
                </View>
              </View>

              <View style={styles.metaGridRow}>
                <View style={styles.metaGridCell}>
                  <Text style={styles.metaLabel}>DISPATCH DELIVERY FROM</Text>
                  <Text style={styles.metaValue}>{invoice.delivery_note?.toUpperCase() || ''}</Text>
                </View>
                <View style={styles.metaGridCellLast}>
                  <Text style={styles.metaLabel}>Mode/Terms of Payment</Text>
                  <Text style={styles.metaValue}>{invoice.payment_mode_terms?.toUpperCase() || ''}</Text>
                </View>
              </View>

              <View style={styles.metaGridRow}>
                <View style={styles.metaGridCell}>
                  <Text style={styles.metaLabel}>Reference No. & Date.</Text>
                  <Text style={styles.metaValue}>{invoice.reference_no_date?.toUpperCase() || ''}</Text>
                </View>
                <View style={styles.metaGridCellLast}>
                  <Text style={styles.metaLabel}>Other References</Text>
                  <Text style={styles.metaValue}>{invoice.other_references?.toUpperCase() || ''}</Text>
                </View>
              </View>

              <View style={styles.metaGridRow}>
                <View style={styles.metaGridCell}>
                  <Text style={styles.metaLabel}>Buyer's Order No.</Text>
                  <Text style={styles.metaValue}>{invoice.buyers_order_no?.toUpperCase() || ''}</Text>
                </View>
                <View style={styles.metaGridCellLast}>
                  <Text style={styles.metaLabel}>Dated</Text>
                  <Text style={styles.metaValue}>{invoice.order_date ? formatDate(invoice.order_date) : ''}</Text>
                </View>
              </View>

              <View style={styles.metaGridRow}>
                <View style={styles.metaGridCell}>
                  <Text style={styles.metaLabel}>Dispatch Doc No.</Text>
                  <Text style={styles.metaValue}>{invoice.dispatch_doc_no?.toUpperCase() || ''}</Text>
                </View>
                <View style={styles.metaGridCellLast}>
                  <Text style={styles.metaLabel}>Delivery Note Date</Text>
                  <Text style={styles.metaValue}>{invoice.delivery_note_date ? formatDate(invoice.delivery_note_date) : ''}</Text>
                </View>
              </View>

              <View style={styles.metaGridRow}>
                <View style={styles.metaGridCell}>
                  <Text style={styles.metaLabel}>Dispatched through</Text>
                  <Text style={styles.metaValue}>{invoice.dispatched_through?.toUpperCase() || ''}</Text>
                </View>
                <View style={styles.metaGridCellLast}>
                  <Text style={styles.metaLabel}>Destination</Text>
                  <Text style={styles.metaValue}>{invoice.destination?.toUpperCase() || ''}</Text>
                </View>
              </View>

              <View style={styles.metaGridRow}>
                <View style={styles.metaGridCell}>
                  <Text style={styles.metaLabel}>Vessel/Flight No.</Text>
                  <Text style={styles.metaValue}>{invoice.vessel_flight_no?.toUpperCase() || ''}</Text>
                </View>
                <View style={styles.metaGridCellLast}>
                  <Text style={styles.metaLabel}>Place of receipt by shipper</Text>
                  <Text style={styles.metaValue}>{invoice.place_of_receipt_by_shipper?.toUpperCase() || ''}</Text>
                </View>
              </View>

              <View style={styles.metaGridRow}>
                <View style={styles.metaGridCell}>
                  <Text style={styles.metaLabel}>City/Port of Loading</Text>
                  <Text style={styles.metaValue}>{invoice.port_of_loading?.toUpperCase() || ''}</Text>
                </View>
                <View style={styles.metaGridCellLast}>
                  <Text style={styles.metaLabel}>City/Port of Discharge</Text>
                  <Text style={styles.metaValue}>{invoice.port_of_discharge?.toUpperCase() || ''}</Text>
                </View>
              </View>

              <View style={styles.termsOfDeliveryBox}>
                <Text style={styles.metaLabel}>Terms of Delivery</Text>
                <Text style={[styles.metaValue, { fontSize: 7, fontFamily: 'Helvetica' }]}>{invoice.terms_of_delivery?.toUpperCase() || ''}</Text>
              </View>
            </View>
          </View>

          {/* ── TABLE HEADER ── */}
          <View style={{ padding: 3, borderBottomWidth: 1, borderBottomColor: B, flexDirection: 'row' }}>
            <Text style={{ fontSize: 8.5 }}>{`Place of Supply : `}<Text style={{ fontFamily: 'Helvetica-Bold' }}>{invoice.place_of_supply || ''}</Text></Text>
          </View>

          <View style={[styles.tableHeader, { backgroundColor: '#fcfcfc' }]}>
            <View style={{ width: '4%', borderRightWidth: 1, borderRightColor: B, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold' }}>SL</Text>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold' }}>NO.</Text>
            </View>
            <View style={{ width: '40%', borderRightWidth: 1, borderRightColor: B, height: '100%', justifyContent: 'center', paddingLeft: 4 }}>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold' }}>DESCRIPTION OF GOODS</Text>
            </View>
            <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold' }}>HSN/SAC</Text>
            </View>
            <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold' }}>QUANTITY</Text>
            </View>
            <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold' }}>RATE</Text>
            </View>
            <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold' }}>PER</Text>
            </View>
            <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold' }}>DISC. %</Text>
            </View>
            <View style={{ width: '12%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold' }}>AMOUNT</Text>
            </View>
          </View>

          {/* ── ITEMS LIST ── */}
          <View style={styles.itemsContainer}>
            {invoice.items.map((item, idx) => (
              <View key={idx}>
                <View style={styles.tableRow}>
                  <TableCell width="4%" bold>{idx + 1}</TableCell>
                  <View style={[styles.tableCell, { width: '40%' }]}>
                    <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9 }}>{(item.product_name || item.description)?.toUpperCase()}</Text>
                    {item.item_notes && (
                      <Text style={{ fontSize: 8, marginTop: 1, fontFamily: 'Helvetica-Oblique', color: '#333' }}>
                        {item.item_notes}
                      </Text>
                    )}
                  </View>
                  <TableCell width="10%">{item.hsn_code}</TableCell>
                  <TableCell width="10%">{`${item.quantity} ${item.unit || ''}`}</TableCell>
                  <TableCell width="10%">{fmt(item.rate)}</TableCell>
                  <TableCell width="7%">{item.unit}</TableCell>
                  <TableCell width="7%">{item.discount_percent > 0 ? `${fmt(item.discount_percent)}%` : ''}</TableCell>
                  <TableCell width="12%" align="right" bold noBorder>{fmt(item.taxable_amount)}</TableCell>
                </View>
              </View>
            ))}

            {/* Subtotal row (Total before global discount) */}
            <View style={styles.tableRowNoBorder}>
              <View style={{ width: '4%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '40%', borderRightWidth: 1, borderRightColor: B, minHeight: 14, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 3 }}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>SUBTOTAL</Text>
              </View>
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '12%', minHeight: 14, justifyContent: 'center', paddingRight: 3, borderTopWidth: 1, borderTopColor: B }}>
                <Text style={{ textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>{fmt(parseFloat(invoice.taxable_amount || 0) + (parseFloat(invoice.discount_amount) || 0))}</Text>
              </View>
            </View>

            {/* Global Discount row */}
            {parseFloat(invoice.discount_amount || 0) > 0 && (
              <View style={styles.tableRowNoBorder}>
                <View style={{ width: '4%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '40%', borderRightWidth: 1, borderRightColor: B, minHeight: 14, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 3 }}>
                  <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>{`LESS: DISCOUNT ${invoice.discount_type === 'percent' ? `(${invoice.discount_value}%)` : ''}`}</Text>
                </View>
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '12%', minHeight: 14, justifyContent: 'center', paddingRight: 3 }}>
                  <Text style={{ textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>{`- ${fmt(invoice.discount_amount)}`}</Text>
                </View>
              </View>
            )}

            {/* Taxable Amount row */}
            <View style={styles.tableRowNoBorder}>
              <View style={{ width: '4%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '40%', borderRightWidth: 1, borderRightColor: B, minHeight: 14, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 3 }}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>TAXABLE AMOUNT</Text>
              </View>
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '12%', minHeight: 14, justifyContent: 'center', paddingRight: 3 }}>
                <Text style={{ textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>{fmt(invoice.taxable_amount)}</Text>
              </View>
            </View>

            {/* Packing & Forwarding row */}
            {parseFloat(invoice.shipping_charges || 0) > 0 && (
              <View style={styles.tableRowNoBorder}>
                <View style={{ width: '4%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '40%', borderRightWidth: 1, borderRightColor: B, minHeight: 14, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 3 }}>
                  <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>PACKING & FORWARDING</Text>
                </View>
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '12%', minHeight: 14, justifyContent: 'center', paddingRight: 3 }}>
                  <Text style={{ textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>{fmt(invoice.shipping_charges)}</Text>
                </View>
              </View>
            )}

            {/* SGST row */}
            {isIntra && (
              <View style={styles.tableRowNoBorder}>
                <View style={{ width: '4%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '40%', borderRightWidth: 1, borderRightColor: B, minHeight: 14, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 3 }}>
                  <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>SGST</Text>
                </View>
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '12%', minHeight: 14, justifyContent: 'center', paddingRight: 3 }}>
                  <Text style={{ textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>{fmt(invoice.total_sgst)}</Text>
                </View>
              </View>
            )}

            {/* CGST row */}
            {isIntra && (
              <View style={styles.tableRowNoBorder}>
                <View style={{ width: '4%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '40%', borderRightWidth: 1, borderRightColor: B, minHeight: 14, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 3 }}>
                  <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>CGST</Text>
                </View>
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '12%', minHeight: 14, justifyContent: 'center', paddingRight: 3 }}>
                  <Text style={{ textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>{fmt(invoice.total_cgst)}</Text>
                </View>
              </View>
            )}

            {/* IGST row */}
            {!isIntra && (
              <View style={styles.tableRowNoBorder}>
                <View style={{ width: '4%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '40%', borderRightWidth: 1, borderRightColor: B, minHeight: 14, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 3 }}>
                  <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>IGST</Text>
                </View>
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '12%', minHeight: 14, justifyContent: 'center', paddingRight: 3 }}>
                  <Text style={{ textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>{fmt(invoice.total_igst)}</Text>
                </View>
              </View>
            )}

            {/* ROUND OFF row */}
            <View style={styles.tableRowNoBorder}>
              <View style={{ width: '4%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '40%', borderRightWidth: 1, borderRightColor: B, minHeight: 14, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 3 }}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>ROUND OFF</Text>
              </View>
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '12%', minHeight: 14, justifyContent: 'center', paddingRight: 3 }}>
                <Text style={{ textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>{fmt(invoice.round_off || 0)}</Text>
              </View>
            </View>

            {/* Filler space to keep vertical lines consistent down to the bottom */}
            <View style={{ flex: 1, flexDirection: 'row' }}>
              <View style={{ width: '4%', borderRightWidth: 1, borderRightColor: B }} />
              <View style={{ width: '40%', borderRightWidth: 1, borderRightColor: B }} />
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B }} />
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B }} />
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B }} />
              <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B }} />
              <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B }} />
              <View style={{ width: '12%' }} />
            </View>

            {/* Total row at the very bottom */}
            <View style={[styles.tableRowNoBorder, { borderTopWidth: 1, borderTopColor: B }]}>
              <View style={{ width: '4%', borderRightWidth: 1, borderRightColor: B, minHeight: 16 }} />
              <View style={{ width: '40%', borderRightWidth: 1, borderRightColor: B, minHeight: 16, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 3 }}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>TOTAL</Text>
              </View>
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 16 }} />
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 16 }} />
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 16 }} />
              <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 16 }} />
              <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 16 }} />
              <View style={{ width: '12%', minHeight: 16, justifyContent: 'center', paddingRight: 3 }}>
                <Text style={{ textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 9.5 }}>{fmt(invoice.grand_total)}</Text>
              </View>
            </View>
          </View>

          {/* ── AMOUNT IN WORDS ── */}
          <View style={styles.amountInWordsSection}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 7.5 }}>AMOUNT CHARGEABLE (IN WORDS)</Text>
              <Text style={{ fontStyle: 'italic', fontSize: 8 }}>E. & O.E</Text>
            </View>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, marginTop: 1 }}>{numberToWords(invoice.grand_total)?.toUpperCase()}</Text>
          </View>

          {/* ── TAX SUMMARY TABLE ── */}
          <View style={styles.taxSummarySection}>
            <View style={styles.taxTable}>
              <View style={styles.taxRow}>
                <Text style={[styles.taxCell, { width: '20%' }]}>HSN/SAC</Text>
                <Text style={[styles.taxCell, { width: '15%' }]}>TAXABLE VALUE</Text>
                {isIntra ? (
                  <>
                    <Text style={[styles.taxCell, { width: '22.5%' }]}>CGST</Text>
                    <Text style={[styles.taxCell, { width: '22.5%' }]}>SGST/UTGST</Text>
                  </>
                ) : (
                  <Text style={[styles.taxCell, { width: '45%' }]}>IGST</Text>
                )}
                <Text style={[styles.taxCell, { width: '20%', borderRightWidth: 0 }]}>TOTAL TAX AMOUNT</Text>
              </View>
              <View style={styles.taxRow}>
                <Text style={[styles.taxCell, { width: '20%' }]}></Text>
                <Text style={[styles.taxCell, { width: '15%' }]}></Text>
                {isIntra ? (
                  <>
                    <Text style={[styles.taxCell, { width: '7.5%' }]}>Rate</Text>
                    <Text style={[styles.taxCell, { width: '15%' }]}>Amount</Text>
                    <Text style={[styles.taxCell, { width: '7.5%' }]}>Rate</Text>
                    <Text style={[styles.taxCell, { width: '15%' }]}>Amount</Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.taxCell, { width: '15%' }]}>Rate</Text>
                    <Text style={[styles.taxCell, { width: '30%' }]}>Amount</Text>
                  </>
                )}
                <Text style={[styles.taxCell, { width: '20%', borderRightWidth: 0 }]}></Text>
              </View>
              {hsnRows.map((h, i) => (
                <View key={i} style={styles.taxRow}>
                  <Text style={[styles.taxCell, { width: '20%' }]}>{h.hsn}</Text>
                  <Text style={[styles.taxCell, { width: '15%' }]}>{fmt(h.taxable)}</Text>
                  {isIntra ? (
                    <>
                      <Text style={[styles.taxCell, { width: '7.5%' }]}>{`${h.rate/2}%`}</Text>
                      <Text style={[styles.taxCell, { width: '15%' }]}>{fmt(h.cgst)}</Text>
                      <Text style={[styles.taxCell, { width: '7.5%' }]}>{`${h.rate/2}%`}</Text>
                      <Text style={[styles.taxCell, { width: '15%' }]}>{fmt(h.sgst)}</Text>
                      <Text style={[styles.taxCell, { width: '20%', borderRightWidth: 0, fontFamily: 'Helvetica-Bold' }]}>{fmt(h.cgst + h.sgst)}</Text>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.taxCell, { width: '15%' }]}>{`${h.rate}%`}</Text>
                      <Text style={[styles.taxCell, { width: '30%' }]}>{fmt(h.igst)}</Text>
                      <Text style={[styles.taxCell, { width: '20%', borderRightWidth: 0, fontFamily: 'Helvetica-Bold' }]}>{fmt(h.igst)}</Text>
                    </>
                  )}
                </View>
              ))}
              <View style={[styles.taxRow, { borderBottomWidth: 0, backgroundColor: '#fcfcfc' }]}>
                <Text style={[styles.taxCell, { width: '20%', fontFamily: 'Helvetica-Bold' }]}>TOTAL</Text>
                <Text style={[styles.taxCell, { width: '15%', fontFamily: 'Helvetica-Bold' }]}>{fmt(invoice.taxable_amount + (parseFloat(invoice.shipping_charges) || 0))}</Text>
                {isIntra ? (
                  <>
                    <Text style={[styles.taxCell, { width: '7.5%' }]}></Text>
                    <Text style={[styles.taxCell, { width: '15%', fontFamily: 'Helvetica-Bold' }]}>{fmt(invoice.total_cgst)}</Text>
                    <Text style={[styles.taxCell, { width: '7.5%' }]}></Text>
                    <Text style={[styles.taxCell, { width: '15%', fontFamily: 'Helvetica-Bold' }]}>{fmt(invoice.total_sgst)}</Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.taxCell, { width: '15%' }]}></Text>
                    <Text style={[styles.taxCell, { width: '30%', fontFamily: 'Helvetica-Bold' }]}>{fmt(invoice.total_igst)}</Text>
                  </>
                )}
                <Text style={[styles.taxCell, { width: '20%', borderRightWidth: 0, fontFamily: 'Helvetica-Bold' }]}>{fmt(invoice.total_tax)}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', marginTop: 4 }}>
              {`TAX AMOUNT (IN WORDS) : ${numberToWords(invoice.total_tax)?.toUpperCase()}`}
            </Text>
          </View>

          {/* ── FOOTER ── */}
          <View style={styles.footerSection}>
            <View style={styles.footerLeft}>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>TERMS :</Text>
              <Text style={{ fontSize: 7.5, lineHeight: 1.3 }}>{settings?.invoice_terms || '1. Goods sold once cannot be taken back.'}</Text>
              
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 8.5 }}>{"COMPANY'S PAN : "}<Text style={{ fontFamily: 'Helvetica-Bold' }}>{settings?.company_pan?.toUpperCase() || ''}</Text></Text>
              </View>
              
              <View style={{ marginTop: 5 }}>
                <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', textDecoration: 'underline' }}>DECLARATION</Text>
                <Text style={{ fontSize: 7, marginTop: 2, lineHeight: 1.2 }}>
                  {settings?.declaration || 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.'}
                </Text>
              </View>
            </View>

            <View style={styles.footerMiddle}>
              <View style={{ padding: 5, borderBottomWidth: 1, borderBottomColor: B }}>
                <Text style={styles.bankTitle}>{"COMPANY'S BANK DETAILS"}</Text>
                <Text style={{ fontSize: 8 }}>{`Bank Name : `}<Text style={{ fontFamily: 'Helvetica-Bold' }}>{settings?.bank_account_name?.toUpperCase() || settings?.company_name?.toUpperCase()}</Text></Text>
                <Text style={{ fontSize: 8 }}>{`Bank Name : `}<Text style={{ fontFamily: 'Helvetica-Bold' }}>{settings?.bank_name?.toUpperCase() || ''}</Text></Text>
                <Text style={{ fontSize: 8 }}>{`A/c No. : `}<Text style={{ fontFamily: 'Helvetica-Bold' }}>{settings?.bank_account?.toUpperCase() || ''}</Text></Text>
                <Text style={{ fontSize: 8 }}>{`Branch & IFS Code : `}<Text style={{ fontFamily: 'Helvetica-Bold' }}>{`${settings?.bank_branch?.toUpperCase() || ''} & ${settings?.bank_ifsc?.toUpperCase() || ''}`}</Text></Text>
              </View>
              <View style={{ padding: 5 }}>
                 <Text style={{ fontSize: 7, color: '#666' }}>E. & O.E</Text>
              </View>
            </View>

            <View style={styles.footerRight}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold' }}>{`FOR ${settings?.company_name?.toUpperCase() || 'YOUR COMPANY'}`}</Text>
              <View style={{ alignItems: 'center', width: '100%', position: 'relative', height: 45, justifyContent: 'center' }}>
                {settings?.company_stamp && settings?.company_signature ? (
                  <View style={{ width: '100%', height: 45, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
                    <Image src={settings.company_stamp} style={{ position: 'absolute', width: 45, height: 45, opacity: 0.85, left: 15 }} />
                    <Image src={settings.company_signature} style={{ width: 70, height: 35 }} />
                  </View>
                ) : settings?.company_stamp ? (
                  <Image src={settings.company_stamp} style={{ width: 45, height: 45 }} />
                ) : settings?.company_signature ? (
                  <Image src={settings.company_signature} style={{ width: 70, height: 35 }} />
                ) : (
                  <View style={styles.stampBox}>
                    <Text style={styles.stampText}>STAMP</Text>
                  </View>
                )}
              </View>
              <View style={styles.signLine}>
                <Text style={{ fontSize: 8 }}>Authorised Signatory</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          <Text style={styles.bottomJurisdiction}>
            {settings?.subject_to ? settings.subject_to.toUpperCase() : `SUBJECT TO ${settings?.company_city?.toUpperCase() || 'MUMBAI'} JURISDICTION`}
          </Text>
          <Text style={styles.bottomComputer}>This is a Computer Generated Invoice</Text>
        </View>
      </Page>
    </Document>
  )
}

export function PurchasePDF({ purchase, settings }) {
  const isIntra = (purchase.supply_type || 'intra') === 'intra'
  const companyStateCode = settings?.company_state_code || getStateCode(settings?.company_state || '')
  const supplierStateCode = getStateCode(purchase.supplier_state || '')

  const hsnMap = {}
  ;(purchase.items || []).forEach(item => {
    const key = `${item.hsn_code}-${item.gst_percent}`
    if (!hsnMap[key]) {
      hsnMap[key] = { hsn: item.hsn_code, rate: item.gst_percent, taxable: 0, cgst: 0, sgst: 0, igst: 0 }
    }
    hsnMap[key].taxable += parseFloat(item.taxable_amount || 0)
    hsnMap[key].cgst += parseFloat(item.cgst_amount || 0)
    hsnMap[key].sgst += parseFloat(item.sgst_amount || 0)
    hsnMap[key].igst += parseFloat(item.igst_amount || 0)
  })

  // Include Forwarding/Packaging charges in tax summary if GST was applied
  if (parseFloat(purchase.forwarding_charges || 0) > 0 && parseFloat(purchase.forwarding_gst || 0) > 0) {
    const fwdTaxable = parseFloat(purchase.forwarding_charges)
    const fwdTax = parseFloat(purchase.forwarding_gst)
    // Calculate effective rate
    const fwdRate = Math.round((fwdTax / fwdTaxable) * 100)
    const fwdKey = `FWD-${fwdRate}`
    
    if (!hsnMap[fwdKey]) {
      hsnMap[fwdKey] = { hsn: '996511', rate: fwdRate, taxable: 0, cgst: 0, sgst: 0, igst: 0 }
    }
    hsnMap[fwdKey].taxable += fwdTaxable
    if (isIntra) {
      hsnMap[fwdKey].cgst += fwdTax / 2
      hsnMap[fwdKey].sgst += fwdTax / 2
    } else {
      hsnMap[fwdKey].igst += fwdTax
    }
  }

  if (parseFloat(purchase.packaging_charges || 0) > 0 && parseFloat(purchase.packaging_gst || 0) > 0) {
    const pkgTaxable = parseFloat(purchase.packaging_charges)
    const pkgTax = parseFloat(purchase.packaging_gst)
    const pkgRate = Math.round((pkgTax / pkgTaxable) * 100)
    const pkgKey = `PKG-${pkgRate}`
    
    if (!hsnMap[pkgKey]) {
      hsnMap[pkgKey] = { hsn: '996511', rate: pkgRate, taxable: 0, cgst: 0, sgst: 0, igst: 0 }
    }
    hsnMap[pkgKey].taxable += pkgTaxable
    if (isIntra) {
      hsnMap[pkgKey].cgst += pkgTax / 2
      hsnMap[pkgKey].sgst += pkgTax / 2
    } else {
      hsnMap[pkgKey].igst += pkgTax
    }
  }

  const hsnRows = Object.values(hsnMap)

  return (
    <Document title={`Purchase-${purchase.bill_number || purchase.id}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.mainContainer}>
          <Text style={styles.headerTitle}>PURCHASE INVOICE</Text>

          {/* ── TOP GRID ── */}
          <View style={styles.topGrid}>
            {/* LEFT COLUMN: COMPANY & SUPPLIER */}
            <View style={styles.topLeftCol}>
              <View style={styles.companyBox}>
                <View style={styles.logoBox}>
                  {settings?.company_logo && <Image src={settings.company_logo} style={styles.logo} />}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.companyName}>{(settings?.company_name || 'Your Company').toUpperCase()}</Text>
                    <Text style={[styles.companyDetail, { fontSize: 7 }]}>{settings?.company_address}</Text>
                    <Text style={[styles.companyDetail, { fontSize: 7 }]}>
                      {`${settings?.company_city || ''}, ${settings?.company_state || ''} - ${settings?.company_pin || ''}`}
                    </Text>
                  </View>
                </View>
                <Text style={styles.companyDetail}>{`GSTIN/UIN: ${settings?.company_gstin || ''}`}</Text>
                <Text style={styles.companyDetail}>{`State Name: ${settings?.company_state || ''}, Code: ${companyStateCode || ''}`}</Text>
                <Text style={styles.companyDetail}>{`Contact: ${settings?.company_phone || ''}`}</Text>
              </View>

              <View style={[styles.buyerBox, { borderBottomWidth: 1, borderBottomColor: B }]}>
                <Text style={styles.boxLabel}>Supplier (Bill from)</Text>
                <Text style={styles.partyName}>{purchase.supplier_name?.toUpperCase()}</Text>
                <Text style={styles.partyDetail}>{purchase.supplier_address}</Text>
                <Text style={styles.partyDetail}>{`GSTIN/UIN: ${purchase.supplier_gstin || ''}`}</Text>
                <Text style={styles.partyDetail}>
                  {`State Name : ${purchase.supplier_state || ''}, Code : ${supplierStateCode || ''}`}
                </Text>
                <Text style={styles.partyDetail}>{`Contact: ${purchase.supplier_phone || ''}`}</Text>
              </View>

              <View style={styles.buyerBox}>
                <Text style={styles.boxLabel}>Buyer (Bill to)</Text>
                <Text style={styles.partyName}>{(settings?.company_name || 'Your Company').toUpperCase()}</Text>
                <Text style={styles.partyDetail}>{settings?.company_address}</Text>
                <Text style={styles.partyDetail}>{`GSTIN/UIN: ${settings?.company_gstin || ''}`}</Text>
                <Text style={styles.partyDetail}>{`State Name: ${settings?.company_state || ''}, Code: ${companyStateCode || ''}`}</Text>
              </View>
            </View>

            {/* RIGHT COLUMN: META GRID */}
            <View style={styles.topRightCol}>
              <View style={styles.metaGridRow}>
                <View style={styles.metaGridCell}>
                  <Text style={styles.metaLabel}>Bill No.</Text>
                  <Text style={styles.metaValue}>{purchase.bill_number?.toUpperCase() || purchase.id?.toString().toUpperCase()}</Text>
                </View>
                <View style={styles.metaGridCellLast}>
                  <Text style={styles.metaLabel}>Dated</Text>
                  <Text style={styles.metaValue}>{formatDate(purchase.bill_date)}</Text>
                </View>
              </View>

              <View style={styles.metaGridRow}>
                <View style={styles.metaGridCell}>
                  <Text style={styles.metaLabel}>Supply Type</Text>
                  <Text style={styles.metaValue}>{isIntra ? 'INTRA-STATE' : 'INTER-STATE'}</Text>
                </View>
                <View style={styles.metaGridCellLast}>
                  <Text style={styles.metaLabel}>Place of Supply</Text>
                  <Text style={styles.metaValue}>{purchase.place_of_supply?.toUpperCase() || ''}</Text>
                </View>
              </View>

              <View style={styles.metaGridRow}>
                <View style={styles.metaGridCell}>
                  <Text style={styles.metaLabel}>Payment Status</Text>
                  <Text style={styles.metaValue}>{purchase.payment_status?.toUpperCase() || 'UNPAID'}</Text>
                </View>
                <View style={styles.metaGridCellLast}>
                  <Text style={styles.metaLabel}>Due Date</Text>
                  <Text style={styles.metaValue}>{purchase.due_date ? formatDate(purchase.due_date) : ''}</Text>
                </View>
              </View>

              <View style={styles.termsOfDeliveryBox}>
                <Text style={styles.metaLabel}>Notes / Narration</Text>
                <Text style={[styles.metaValue, { fontSize: 7.5, fontFamily: 'Helvetica' }]}>{purchase.notes || ''}</Text>
              </View>
            </View>
          </View>

          {/* ── TABLE HEADER ── */}
          <View style={{ padding: 3, borderBottomWidth: 1, borderBottomColor: B, flexDirection: 'row' }}>
            <Text style={{ fontSize: 8.5 }}>{`Place of Supply : `}<Text style={{ fontFamily: 'Helvetica-Bold' }}>{purchase.place_of_supply || purchase.supplier_state || ''}</Text></Text>
          </View>

          <View style={[styles.tableHeader, { backgroundColor: '#fcfcfc' }]}>
            <View style={{ width: '4%', borderRightWidth: 1, borderRightColor: B, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold' }}>SL</Text>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold' }}>NO.</Text>
            </View>
            <View style={{ width: '40%', borderRightWidth: 1, borderRightColor: B, height: '100%', justifyContent: 'center', paddingLeft: 4 }}>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold' }}>DESCRIPTION OF GOODS</Text>
            </View>
            <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold' }}>HSN/SAC</Text>
            </View>
            <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold' }}>QUANTITY</Text>
            </View>
            <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold' }}>RATE</Text>
            </View>
            <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold' }}>PER</Text>
            </View>
            <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold' }}>DISC. %</Text>
            </View>
            <View style={{ width: '12%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold' }}>AMOUNT</Text>
            </View>
          </View>

          {/* ITEMS LIST */}
          <View style={styles.itemsContainer}>
            {(purchase.items || []).map((item, idx) => (
                <View key={idx}>
                  <View style={styles.tableRow}>
                    <TableCell width="4%" bold>{idx + 1}</TableCell>
                    <View style={[styles.tableCell, { width: '40%' }]}>
                      <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9 }}>{(item.product_name || item.description)?.toUpperCase()}</Text>
                    </View>
                  <TableCell width="10%">{item.hsn_code}</TableCell>
                  <TableCell width="10%">{`${item.quantity} ${item.unit || ''}`}</TableCell>
                  <TableCell width="10%">{fmt(item.rate)}</TableCell>
                  <TableCell width="7%">{item.unit}</TableCell>
                  <TableCell width="7%">{item.discount_percent > 0 ? `${fmt(item.discount_percent)}%` : ''}</TableCell>
                  <TableCell width="12%" align="right" bold noBorder>{fmt(item.taxable_amount)}</TableCell>
                </View>
              </View>
            ))}

            {/* Subtotal row (Total before global discount) */}
            <View style={styles.tableRowNoBorder}>
              <View style={{ width: '4%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '40%', borderRightWidth: 1, borderRightColor: B, minHeight: 14, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 3 }}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>SUBTOTAL</Text>
              </View>
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '12%', minHeight: 14, justifyContent: 'center', paddingRight: 3, borderTopWidth: 1, borderTopColor: B }}>
                <Text style={{ textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>{fmt(parseFloat(purchase.taxable_amount || 0) + (parseFloat(purchase.discount_amount) || 0))}</Text>
              </View>
            </View>

            {/* Global Discount row */}
            {parseFloat(purchase.discount_amount || 0) > 0 && (
              <View style={styles.tableRowNoBorder}>
                <View style={{ width: '4%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '40%', borderRightWidth: 1, borderRightColor: B, minHeight: 14, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 3 }}>
                  <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>{`LESS: DISCOUNT ${purchase.discount_type === 'percent' ? `(${purchase.discount_value}%)` : ''}`}</Text>
                </View>
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '12%', minHeight: 14, justifyContent: 'center', paddingRight: 3 }}>
                  <Text style={{ textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>{`- ${fmt(purchase.discount_amount)}`}</Text>
                </View>
              </View>
            )}

            {/* Taxable Amount row */}
            <View style={styles.tableRowNoBorder}>
              <View style={{ width: '4%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '40%', borderRightWidth: 1, borderRightColor: B, minHeight: 14, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 3 }}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>TAXABLE AMOUNT</Text>
              </View>
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '12%', minHeight: 14, justifyContent: 'center', paddingRight: 3 }}>
                <Text style={{ textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>{fmt(purchase.taxable_amount)}</Text>
              </View>
            </View>

            {/* Forwarding Charges row */}
            {parseFloat(purchase.forwarding_charges || 0) > 0 && (
              <View style={styles.tableRowNoBorder}>
                <View style={{ width: '4%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '40%', borderRightWidth: 1, borderRightColor: B, minHeight: 14, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 3 }}>
                  <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>FORWARDING CHARGES</Text>
                </View>
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '12%', minHeight: 14, justifyContent: 'center', paddingRight: 3 }}>
                  <Text style={{ textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>{fmt(purchase.forwarding_charges)}</Text>
                </View>
              </View>
            )}

            {/* Packaging Charges row */}
            {parseFloat(purchase.packaging_charges || 0) > 0 && (
              <View style={styles.tableRowNoBorder}>
                <View style={{ width: '4%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '40%', borderRightWidth: 1, borderRightColor: B, minHeight: 14, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 3 }}>
                  <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>PACKAGING CHARGES</Text>
                </View>
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '12%', minHeight: 14, justifyContent: 'center', paddingRight: 3 }}>
                  <Text style={{ textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>{fmt(purchase.packaging_charges)}</Text>
                </View>
              </View>
            )}

            {/* Other Charges row */}
            {parseFloat(purchase.other_charges || 0) > 0 && (
              <View style={styles.tableRowNoBorder}>
                <View style={{ width: '4%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '40%', borderRightWidth: 1, borderRightColor: B, minHeight: 14, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 3 }}>
                  <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>OTHER CHARGES</Text>
                </View>
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '12%', minHeight: 14, justifyContent: 'center', paddingRight: 3 }}>
                  <Text style={{ textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>{fmt(purchase.other_charges)}</Text>
                </View>
              </View>
            )}

            {/* SGST row */}
            {isIntra && (
              <View style={styles.tableRowNoBorder}>
                <View style={{ width: '4%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '40%', borderRightWidth: 1, borderRightColor: B, minHeight: 14, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 3 }}>
                  <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>SGST</Text>
                </View>
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '12%', minHeight: 14, justifyContent: 'center', paddingRight: 3 }}>
                  <Text style={{ textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>{fmt(purchase.total_sgst + (parseFloat(purchase.forwarding_gst || 0) / 2) + (parseFloat(purchase.packaging_gst || 0) / 2))}</Text>
                </View>
              </View>
            )}

            {/* CGST row */}
            {isIntra && (
              <View style={styles.tableRowNoBorder}>
                <View style={{ width: '4%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '40%', borderRightWidth: 1, borderRightColor: B, minHeight: 14, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 3 }}>
                  <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>CGST</Text>
                </View>
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '12%', minHeight: 14, justifyContent: 'center', paddingRight: 3 }}>
                  <Text style={{ textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>{fmt(purchase.total_cgst + (parseFloat(purchase.forwarding_gst || 0) / 2) + (parseFloat(purchase.packaging_gst || 0) / 2))}</Text>
                </View>
              </View>
            )}

            {/* IGST row */}
            {!isIntra && (
              <View style={styles.tableRowNoBorder}>
                <View style={{ width: '4%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '40%', borderRightWidth: 1, borderRightColor: B, minHeight: 14, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 3 }}>
                  <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>IGST</Text>
                </View>
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
                <View style={{ width: '12%', minHeight: 14, justifyContent: 'center', paddingRight: 3 }}>
                  <Text style={{ textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>{fmt(purchase.total_igst + parseFloat(purchase.forwarding_gst || 0) + parseFloat(purchase.packaging_gst || 0))}</Text>
                </View>
              </View>
            )}

            {/* ROUND OFF row */}
            <View style={styles.tableRowNoBorder}>
              <View style={{ width: '4%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '40%', borderRightWidth: 1, borderRightColor: B, minHeight: 14, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 3 }}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>ROUND OFF</Text>
              </View>
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 14 }} />
              <View style={{ width: '12%', minHeight: 14, justifyContent: 'center', paddingRight: 3 }}>
                <Text style={{ textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>{fmt(purchase.round_off || 0)}</Text>
              </View>
            </View>

            {/* Filler space */}
            <View style={{ flex: 1, flexDirection: 'row' }}>
              <View style={{ width: '4%', borderRightWidth: 1, borderRightColor: B }} />
              <View style={{ width: '40%', borderRightWidth: 1, borderRightColor: B }} />
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B }} />
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B }} />
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B }} />
              <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B }} />
              <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B }} />
              <View style={{ width: '12%' }} />
            </View>

            {/* Total row at the very bottom */}
            <View style={[styles.tableRowNoBorder, { borderTopWidth: 1, borderTopColor: B }]}>
              <View style={{ width: '4%', borderRightWidth: 1, borderRightColor: B, minHeight: 16 }} />
              <View style={{ width: '40%', borderRightWidth: 1, borderRightColor: B, minHeight: 16, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 3 }}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>TOTAL</Text>
              </View>
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 16 }} />
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 16 }} />
              <View style={{ width: '10%', borderRightWidth: 1, borderRightColor: B, minHeight: 16 }} />
              <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 16 }} />
              <View style={{ width: '7%', borderRightWidth: 1, borderRightColor: B, minHeight: 16 }} />
              <View style={{ width: '12%', minHeight: 16, justifyContent: 'center', paddingRight: 3 }}>
                <Text style={{ textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 9.5 }}>{fmt(purchase.grand_total)}</Text>
              </View>
            </View>
          </View>

          {/* AMOUNT IN WORDS */}
          <View style={styles.amountInWordsSection}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 7.5 }}>AMOUNT CHARGEABLE (IN WORDS)</Text>
              <Text style={{ fontStyle: 'italic', fontSize: 8 }}>E. & O.E</Text>
            </View>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, marginTop: 1 }}>{numberToWords(purchase.grand_total)?.toUpperCase()}</Text>
          </View>

          {/* TAX SUMMARY */}
          <View style={styles.taxSummarySection}>
            <View style={styles.taxTable}>
              <View style={styles.taxRow}>
                <Text style={[styles.taxCell, { width: '20%' }]}>HSN/SAC</Text>
                <Text style={[styles.taxCell, { width: '15%' }]}>TAXABLE VALUE</Text>
                {isIntra ? (
                  <>
                    <Text style={[styles.taxCell, { width: '22.5%' }]}>CGST</Text>
                    <Text style={[styles.taxCell, { width: '22.5%' }]}>SGST/UTGST</Text>
                  </>
                ) : (
                  <Text style={[styles.taxCell, { width: '45%' }]}>IGST</Text>
                )}
                <Text style={[styles.taxCell, { width: '20%', borderRightWidth: 0 }]}>TOTAL TAX AMOUNT</Text>
              </View>
              <View style={styles.taxRow}>
                <Text style={[styles.taxCell, { width: '20%' }]}></Text>
                <Text style={[styles.taxCell, { width: '15%' }]}></Text>
                {isIntra ? (
                  <>
                    <Text style={[styles.taxCell, { width: '7.5%' }]}>Rate</Text>
                    <Text style={[styles.taxCell, { width: '15%' }]}>Amount</Text>
                    <Text style={[styles.taxCell, { width: '7.5%' }]}>Rate</Text>
                    <Text style={[styles.taxCell, { width: '15%' }]}>Amount</Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.taxCell, { width: '15%' }]}>Rate</Text>
                    <Text style={[styles.taxCell, { width: '30%' }]}>Amount</Text>
                  </>
                )}
                <Text style={[styles.taxCell, { width: '20%', borderRightWidth: 0 }]}></Text>
              </View>
              {hsnRows.map((h, i) => (
                <View key={i} style={styles.taxRow}>
                  <Text style={[styles.taxCell, { width: '20%' }]}>{h.hsn}</Text>
                  <Text style={[styles.taxCell, { width: '15%' }]}>{fmt(h.taxable)}</Text>
                  {isIntra ? (
                    <>
                      <Text style={[styles.taxCell, { width: '7.5%' }]}>{`${h.rate/2}%`}</Text>
                      <Text style={[styles.taxCell, { width: '15%' }]}>{fmt(h.cgst)}</Text>
                      <Text style={[styles.taxCell, { width: '7.5%' }]}>{`${h.rate/2}%`}</Text>
                      <Text style={[styles.taxCell, { width: '15%' }]}>{fmt(h.sgst)}</Text>
                      <Text style={[styles.taxCell, { width: '20%', borderRightWidth: 0, fontFamily: 'Helvetica-Bold' }]}>{fmt(h.cgst + h.sgst)}</Text>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.taxCell, { width: '15%' }]}>{`${h.rate}%`}</Text>
                      <Text style={[styles.taxCell, { width: '30%' }]}>{fmt(h.igst)}</Text>
                      <Text style={[styles.taxCell, { width: '20%', borderRightWidth: 0, fontFamily: 'Helvetica-Bold' }]}>{fmt(h.igst)}</Text>
                    </>
                  )}
                </View>
              ))}
              <View style={[styles.taxRow, { borderBottomWidth: 0, backgroundColor: '#fcfcfc' }]}>
                <Text style={[styles.taxCell, { width: '20%', fontFamily: 'Helvetica-Bold' }]}>TOTAL</Text>
                <Text style={[styles.taxCell, { width: '15%', fontFamily: 'Helvetica-Bold' }]}>
                  {fmt(purchase.taxable_amount + parseFloat(purchase.forwarding_charges || 0) + parseFloat(purchase.packaging_charges || 0))}
                </Text>
                {isIntra ? (
                  <>
                    <Text style={[styles.taxCell, { width: '7.5%' }]}></Text>
                    <Text style={[styles.taxCell, { width: '15%', fontFamily: 'Helvetica-Bold' }]}>{fmt(purchase.total_cgst + (parseFloat(purchase.forwarding_gst || 0) / 2) + (parseFloat(purchase.packaging_gst || 0) / 2))}</Text>
                    <Text style={[styles.taxCell, { width: '7.5%' }]}></Text>
                    <Text style={[styles.taxCell, { width: '15%', fontFamily: 'Helvetica-Bold' }]}>{fmt(purchase.total_sgst + (parseFloat(purchase.forwarding_gst || 0) / 2) + (parseFloat(purchase.packaging_gst || 0) / 2))}</Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.taxCell, { width: '15%' }]}></Text>
                    <Text style={[styles.taxCell, { width: '30%', fontFamily: 'Helvetica-Bold' }]}>{fmt(purchase.total_igst + parseFloat(purchase.forwarding_gst || 0) + parseFloat(purchase.packaging_gst || 0))}</Text>
                  </>
                )}
                <Text style={[styles.taxCell, { width: '20%', borderRightWidth: 0, fontFamily: 'Helvetica-Bold' }]}>
                  {fmt(purchase.total_tax + parseFloat(purchase.forwarding_gst || 0) + parseFloat(purchase.packaging_gst || 0))}
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', marginTop: 4 }}>
              {`TAX AMOUNT (IN WORDS) : ${numberToWords(purchase.total_tax + parseFloat(purchase.forwarding_gst || 0) + parseFloat(purchase.packaging_gst || 0))?.toUpperCase()}`}
            </Text>
          </View>

          {/* ── FOOTER ── */}
          <View style={styles.footerSection}>
            <View style={styles.footerLeft}>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>TERMS :</Text>
              <Text style={{ fontSize: 7.5, lineHeight: 1.3 }}>{settings?.invoice_terms || '1. Goods sold once cannot be taken back.'}</Text>
              
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 8.5 }}>{"COMPANY'S PAN : "}<Text style={{ fontFamily: 'Helvetica-Bold' }}>{settings?.company_pan?.toUpperCase() || ''}</Text></Text>
              </View>
              
              <View style={{ marginTop: 5 }}>
                <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', textDecoration: 'underline' }}>DECLARATION</Text>
                <Text style={{ fontSize: 7, marginTop: 2, lineHeight: 1.2 }}>
                  {settings?.declaration || 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.'}
                </Text>
              </View>
            </View>

            <View style={styles.footerMiddle}>
              <View style={{ padding: 5, borderBottomWidth: 1, borderBottomColor: B }}>
                <Text style={styles.bankTitle}>{"COMPANY'S BANK DETAILS"}</Text>
                <Text style={{ fontSize: 8 }}>{`Bank Name : `}<Text style={{ fontFamily: 'Helvetica-Bold' }}>{settings?.bank_account_name?.toUpperCase() || settings?.company_name?.toUpperCase()}</Text></Text>
                <Text style={{ fontSize: 8 }}>{`Bank Name : `}<Text style={{ fontFamily: 'Helvetica-Bold' }}>{settings?.bank_name?.toUpperCase() || ''}</Text></Text>
                <Text style={{ fontSize: 8 }}>{`A/c No. : `}<Text style={{ fontFamily: 'Helvetica-Bold' }}>{settings?.bank_account?.toUpperCase() || ''}</Text></Text>
                <Text style={{ fontSize: 8 }}>{`Branch & IFS Code : `}<Text style={{ fontFamily: 'Helvetica-Bold' }}>{`${settings?.bank_branch?.toUpperCase() || ''} & ${settings?.bank_ifsc?.toUpperCase() || ''}`}</Text></Text>
              </View>
              <View style={{ padding: 5 }}>
                 <Text style={{ fontSize: 7, color: '#666' }}>E. & O.E</Text>
              </View>
            </View>

            <View style={styles.footerRight}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold' }}>{`FOR ${settings?.company_name?.toUpperCase() || 'YOUR COMPANY'}`}</Text>
              <View style={{ alignItems: 'center', width: '100%', position: 'relative', height: 45, justifyContent: 'center' }}>
                {settings?.company_stamp && settings?.company_signature ? (
                  <View style={{ width: '100%', height: 45, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
                    <Image src={settings.company_stamp} style={{ position: 'absolute', width: 45, height: 45, opacity: 0.85, left: 15 }} />
                    <Image src={settings.company_signature} style={{ width: 70, height: 35 }} />
                  </View>
                ) : settings?.company_stamp ? (
                  <Image src={settings.company_stamp} style={{ width: 45, height: 45 }} />
                ) : settings?.company_signature ? (
                  <Image src={settings.company_signature} style={{ width: 70, height: 35 }} />
                ) : (
                  <View style={styles.stampBox}>
                    <Text style={styles.stampText}>STAMP</Text>
                  </View>
                )}
              </View>
              <View style={styles.signLine}>
                <Text style={{ fontSize: 8 }}>Authorised Signatory</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          <Text style={styles.bottomJurisdiction}>
            {settings?.subject_to ? settings.subject_to.toUpperCase() : `SUBJECT TO ${settings?.company_city?.toUpperCase() || 'MUMBAI'} JURISDICTION`}
          </Text>
          <Text style={styles.bottomComputer}>This is a Computer Generated Purchase Invoice</Text>
        </View>
      </Page>
    </Document>
  )
}

export function QuotationPDF({ quotation, settings }) {
  const isIntra = (quotation.supply_type || 'intra') === 'intra'
  const companyStateCode = settings?.company_state_code || getStateCode(settings?.company_state || '')
  const customerStateCode = getStateCode(quotation.customer_state || '')

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

  const items = quotation.items || []
  const subtotal = parseFloat(quotation.subtotal || quotation.taxable_amount || 0)
  const freight = parseFloat(quotation.freight || 0)
  const packing = parseFloat(quotation.packing_charges || 0)
  const cgst = parseFloat(quotation.total_cgst || 0)
  const sgst = parseFloat(quotation.total_sgst || 0)
  const igst = parseFloat(quotation.total_igst || 0)
  const totalTax = cgst + sgst + igst
  const grandTotal = parseFloat(quotation.grand_total || 0)

  return (
    <Document title={`Quotation-${quotation.quotation_number || 'draft'}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.mainContainer}>
          {/* HEADER TITLE */}
          <Text style={styles.headerTitle}>QUOTATION</Text>

          {/* TOP GRID: Left (Company & Buyer) / Right (Quotation Meta) */}
          <View style={styles.topGrid}>
            {/* Left Column */}
            <View style={styles.topLeftCol}>
              {/* Company Box */}
              <View style={styles.companyBox}>
                <View style={styles.logoBox}>
                  {settings?.company_logo ? (
                    <Image src={settings.company_logo} style={styles.logo} />
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.companyName}>{settings?.company_name?.toUpperCase() || 'YOUR COMPANY'}</Text>
                    <Text style={styles.companyDetail}>{settings?.company_address}</Text>
                    <Text style={styles.companyDetail}>
                      {settings?.company_city}{settings?.company_city && settings?.company_state ? ', ' : ''}{settings?.company_state} {settings?.company_pin ? `- ${settings.company_pin}` : ''}
                    </Text>
                  </View>
                </View>
                <View style={{ marginTop: 2 }}>
                  <Text style={styles.companyDetail}><Text style={{ fontFamily: 'Helvetica-Bold' }}>GSTIN/UIN: </Text>{settings?.company_gstin || ''}</Text>
                  <Text style={styles.companyDetail}><Text style={{ fontFamily: 'Helvetica-Bold' }}>State Name: </Text>{settings?.company_state || ''}, <Text style={{ fontFamily: 'Helvetica-Bold' }}>Code: </Text>{companyStateCode}</Text>
                  <Text style={styles.companyDetail}><Text style={{ fontFamily: 'Helvetica-Bold' }}>Contact: </Text>{settings?.company_phone || ''}</Text>
                  <Text style={styles.companyDetail}><Text style={{ fontFamily: 'Helvetica-Bold' }}>E-Mail: </Text>{settings?.company_email || ''}</Text>
                </View>
              </View>

              {/* Buyer Box */}
              <View style={styles.buyerBox}>
                <Text style={styles.boxLabel}>BUYER (BILL TO)</Text>
                <Text style={styles.partyName}>{quotation.customer_name?.toUpperCase() || 'VALUED CUSTOMER'}</Text>
                {quotation.customer_address ? <Text style={styles.partyDetail}>{quotation.customer_address}</Text> : null}
                <View style={{ marginTop: 2 }}>
                  <Text style={styles.partyDetail}><Text style={{ fontFamily: 'Helvetica-Bold' }}>GSTIN/UIN: </Text>{quotation.customer_gstin || 'UNREGISTERED'}</Text>
                  <Text style={styles.partyDetail}><Text style={{ fontFamily: 'Helvetica-Bold' }}>State Name: </Text>{quotation.customer_state || ''}, <Text style={{ fontFamily: 'Helvetica-Bold' }}>Code: </Text>{customerStateCode}</Text>
                  {quotation.customer_phone ? <Text style={styles.partyDetail}><Text style={{ fontFamily: 'Helvetica-Bold' }}>Contact: </Text>{quotation.customer_phone}</Text> : null}
                </View>
              </View>

              {/* Consignee Box (if present and different) */}
              {(quotation.consignee_name && quotation.consignee_name !== quotation.customer_name) ? (
                <View style={[styles.buyerBox, { borderTopWidth: 1, borderTopColor: B }]}>
                  <Text style={styles.boxLabel}>CONSIGNEE (SHIP TO)</Text>
                  <Text style={styles.partyName}>{quotation.consignee_name?.toUpperCase()}</Text>
                  {quotation.consignee_address ? <Text style={styles.partyDetail}>{quotation.consignee_address}</Text> : null}
                  <Text style={styles.partyDetail}><Text style={{ fontFamily: 'Helvetica-Bold' }}>GSTIN/UIN: </Text>{quotation.consignee_gstin || ''}</Text>
                  <Text style={styles.partyDetail}><Text style={{ fontFamily: 'Helvetica-Bold' }}>State: </Text>{quotation.consignee_state || ''}</Text>
                </View>
              ) : null}
            </View>

            {/* Right Column: Meta details */}
            <View style={styles.topRightCol}>
              <View style={styles.metaGridRow}>
                <View style={styles.metaGridCell}>
                  <Text style={styles.metaLabel}>QUOTATION NO.</Text>
                  <Text style={styles.metaValue}>{quotation.quotation_number || ''}</Text>
                </View>
                <View style={styles.metaGridCellLast}>
                  <Text style={styles.metaLabel}>DATED</Text>
                  <Text style={styles.metaValue}>{formatDate(quotation.quotation_date)}</Text>
                </View>
              </View>

              <View style={styles.metaGridRow}>
                <View style={styles.metaGridCell}>
                  <Text style={styles.metaLabel}>VALID UNTIL</Text>
                  <Text style={styles.metaValue}>{formatDate(quotation.valid_until) || '15 DAYS'}</Text>
                </View>
                <View style={styles.metaGridCellLast}>
                  <Text style={styles.metaLabel}>STATUS</Text>
                  <Text style={styles.metaValue}>{(quotation.status || 'DRAFT').toUpperCase()}</Text>
                </View>
              </View>

              <View style={styles.metaGridRow}>
                <View style={styles.metaGridCell}>
                  <Text style={styles.metaLabel}>CUSTOMER RFQ / TENDER REF.</Text>
                  <Text style={styles.metaValue}>{quotation.rfq_reference || 'N/A'}</Text>
                </View>
                <View style={styles.metaGridCellLast}>
                  <Text style={styles.metaLabel}>PREPARED BY</Text>
                  <Text style={styles.metaValue}>{quotation.salesperson || settings?.authorized_signatory || 'N/A'}</Text>
                </View>
              </View>

              <View style={styles.metaGridRow}>
                <View style={styles.metaGridCellLast}>
                  <Text style={styles.metaLabel}>CURRENCY / SUPPLY TYPE</Text>
                  <Text style={styles.metaValue}>{quotation.currency || 'INR'} • {isIntra ? 'INTRASTATE (CGST+SGST)' : 'INTERSTATE (IGST)'}</Text>
                </View>
              </View>

              <View style={styles.termsOfDeliveryBox}>
                <Text style={styles.metaLabel}>TERMS OF DELIVERY / PAYMENT</Text>
                <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica' }}>
                  {quotation.notes || 'As per agreed commercial terms stated below.'}
                </Text>
              </View>
            </View>
          </View>

          {/* TABLE HEADER */}
          <View style={styles.tableHeader}>
            <TableCell width="6%" bold>S.N.</TableCell>
            <TableCell width="46%" bold align="left">DESCRIPTION OF GOODS & SPECIFICATION</TableCell>
            <TableCell width="12%" bold>HSN/SAC</TableCell>
            <TableCell width="10%" bold>QTY</TableCell>
            <TableCell width="12%" bold align="right">RATE (Rs.)</TableCell>
            <TableCell width="14%" bold align="right" noBorder>AMOUNT (Rs.)</TableCell>
          </View>

          {/* TABLE ITEMS */}
          <View style={styles.itemsContainer}>
            {items.map((it, idx) => {
              const q = parseFloat(it.quantity || 0)
              const r = parseFloat(it.rate || 0)
              const lineAmt = q * r
              return (
                <View key={idx} style={styles.tableRow}>
                  <TableCell width="6%">{idx + 1}</TableCell>
                  <View style={[styles.tableCell, { width: '46%' }]}>
                    <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8 }}>{it.description}</Text>
                    {it.specification ? (
                      <Text style={{ fontSize: 7, color: '#444', marginTop: 1 }}>{it.specification}</Text>
                    ) : null}
                  </View>
                  <TableCell width="12%">{it.hsn_code || '-'}</TableCell>
                  <TableCell width="10%">{`${q} ${it.unit || 'pcs'}`}</TableCell>
                  <TableCell width="12%" align="right">{fmt(r)}</TableCell>
                  <TableCell width="14%" align="right" noBorder>{fmt(lineAmt)}</TableCell>
                </View>
              )
            })}

            {/* Extra Charges Rows */}
            {freight > 0 ? (
              <View style={styles.tableRow}>
                <TableCell width="6%">-</TableCell>
                <TableCell width="46%" align="left">Freight / Transportation Charges</TableCell>
                <TableCell width="12%">996511</TableCell>
                <TableCell width="10%">1 L/S</TableCell>
                <TableCell width="12%" align="right">{fmt(freight)}</TableCell>
                <TableCell width="14%" align="right" noBorder>{fmt(freight)}</TableCell>
              </View>
            ) : null}

            {packing > 0 ? (
              <View style={styles.tableRow}>
                <TableCell width="6%">-</TableCell>
                <TableCell width="46%" align="left">Packing & Handling Charges</TableCell>
                <TableCell width="12%">996511</TableCell>
                <TableCell width="10%">1 L/S</TableCell>
                <TableCell width="12%" align="right">{fmt(packing)}</TableCell>
                <TableCell width="14%" align="right" noBorder>{fmt(packing)}</TableCell>
              </View>
            ) : null}

            {/* GST Tax rows */}
            {isIntra ? (
              <>
                <View style={styles.tableRow}>
                  <TableCell width="6%">-</TableCell>
                  <TableCell width="46%" align="left">{`OUTPUT CGST @ ${(parseFloat(quotation.tax_rate || 18) / 2)}%`}</TableCell>
                  <TableCell width="12%">-</TableCell>
                  <TableCell width="10%">-</TableCell>
                  <TableCell width="12%" align="right">-</TableCell>
                  <TableCell width="14%" align="right" noBorder>{fmt(cgst)}</TableCell>
                </View>
                <View style={styles.tableRow}>
                  <TableCell width="6%">-</TableCell>
                  <TableCell width="46%" align="left">{`OUTPUT SGST @ ${(parseFloat(quotation.tax_rate || 18) / 2)}%`}</TableCell>
                  <TableCell width="12%">-</TableCell>
                  <TableCell width="10%">-</TableCell>
                  <TableCell width="12%" align="right">-</TableCell>
                  <TableCell width="14%" align="right" noBorder>{fmt(sgst)}</TableCell>
                </View>
              </>
            ) : (
              <View style={styles.tableRow}>
                <TableCell width="6%">-</TableCell>
                <TableCell width="46%" align="left">{`OUTPUT IGST @ ${parseFloat(quotation.tax_rate || 18)}%`}</TableCell>
                <TableCell width="12%">-</TableCell>
                <TableCell width="10%">-</TableCell>
                <TableCell width="12%" align="right">-</TableCell>
                <TableCell width="14%" align="right" noBorder>{fmt(igst)}</TableCell>
              </View>
            )}
          </View>

          {/* TOTAL ROW */}
          <View style={[styles.totalRow, { borderTopWidth: 1, borderTopColor: B }]}>
            <TableCell width="6%" bold>-</TableCell>
            <TableCell width="46%" bold align="left">TOTAL</TableCell>
            <TableCell width="12%">-</TableCell>
            <TableCell width="10%" bold>{items.reduce((s, it) => s + parseFloat(it.quantity || 0), 0)}</TableCell>
            <TableCell width="12%" align="right">-</TableCell>
            <TableCell width="14%" bold align="right" noBorder>{`Rs. ${fmt(grandTotal)}`}</TableCell>
          </View>

          {/* AMOUNT IN WORDS */}
          <View style={styles.amountInWordsSection}>
            <Text style={{ fontSize: 7, color: '#333' }}>AMOUNT CHARGEABLE (IN WORDS):</Text>
            <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', marginTop: 1 }}>
              {quotation.amount_in_words || numberToWords(grandTotal)}
            </Text>
          </View>

          {/* TERMS & CONDITIONS SECTION */}
          {parsedTerms.length > 0 ? (
            <View style={{ padding: 4, borderBottomWidth: 1, borderBottomColor: B }}>
              <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', textDecoration: 'underline', marginBottom: 2 }}>
                TERMS & CONDITIONS:
              </Text>
              {parsedTerms.map((t, i) => (
                <Text key={i} style={{ fontSize: 6.8, lineHeight: 1.25, color: '#222' }}>
                  {`${i + 1}. ${t}`}
                </Text>
              ))}
            </View>
          ) : null}

          {/* FOOTER SECTION: Bank Details, Stamp, Signatory */}
          <View style={styles.footerSection}>
            <View style={styles.footerLeft}>
              <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', textDecoration: 'underline' }}>DECLARATION</Text>
              <Text style={{ fontSize: 7, marginTop: 2, lineHeight: 1.2 }}>
                {settings?.declaration || 'We declare that this quotation shows the actual proposed prices of goods and materials described and that all particulars are true and valid.'}
              </Text>
              <View style={{ marginTop: 4 }}>
                <Text style={{ fontSize: 7.5 }}>{"COMPANY'S PAN : "}<Text style={{ fontFamily: 'Helvetica-Bold' }}>{settings?.company_pan?.toUpperCase() || ''}</Text></Text>
              </View>
            </View>

            <View style={styles.footerMiddle}>
              <View style={{ padding: 3, borderBottomWidth: 1, borderBottomColor: B }}>
                <Text style={styles.bankTitle}>{"COMPANY'S BANK DETAILS"}</Text>
                <Text style={{ fontSize: 7.5 }}>{`Bank: `}<Text style={{ fontFamily: 'Helvetica-Bold' }}>{settings?.bank_name?.toUpperCase() || ''}</Text></Text>
                <Text style={{ fontSize: 7.5 }}>{`A/c No: `}<Text style={{ fontFamily: 'Helvetica-Bold' }}>{settings?.bank_account?.toUpperCase() || ''}</Text></Text>
                <Text style={{ fontSize: 7.5 }}>{`IFSC Code: `}<Text style={{ fontFamily: 'Helvetica-Bold' }}>{settings?.bank_ifsc?.toUpperCase() || ''}</Text></Text>
              </View>
              <View style={{ padding: 3 }}>
                <Text style={{ fontSize: 6.5, color: '#666' }}>E. & O.E • Quotation valid subject to acceptance</Text>
              </View>
            </View>

            <View style={styles.footerRight}>
              <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold' }}>{`FOR ${settings?.company_name?.toUpperCase() || 'YOUR COMPANY'}`}</Text>
              <View style={{ alignItems: 'center', width: '100%', position: 'relative', height: 40, justifyContent: 'center' }}>
                {settings?.company_stamp && settings?.company_signature ? (
                  <View style={{ width: '100%', height: 40, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
                    <Image src={settings.company_stamp} style={{ position: 'absolute', width: 38, height: 38, opacity: 0.85, left: 10 }} />
                    <Image src={settings.company_signature} style={{ width: 65, height: 30 }} />
                  </View>
                ) : settings?.company_stamp ? (
                  <Image src={settings.company_stamp} style={{ width: 38, height: 38 }} />
                ) : settings?.company_signature ? (
                  <Image src={settings.company_signature} style={{ width: 65, height: 30 }} />
                ) : (
                  <View style={styles.stampBox}>
                    <Text style={styles.stampText}>STAMP</Text>
                  </View>
                )}
              </View>
              <View style={styles.signLine}>
                <Text style={{ fontSize: 7.5 }}>Authorised Signatory</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 15, marginTop: 2 }}>
          <Text style={styles.bottomJurisdiction}>
            {settings?.subject_to ? settings.subject_to.toUpperCase() : `SUBJECT TO ${settings?.company_city?.toUpperCase() || 'MUMBAI'} JURISDICTION`}
          </Text>
          <Text style={styles.bottomComputer}>This is a Computer Generated Quotation</Text>
        </View>
      </Page>
    </Document>
  )
}

