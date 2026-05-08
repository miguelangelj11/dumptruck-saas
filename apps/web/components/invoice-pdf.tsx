import {
  Document, Page, View, Text, Image, StyleSheet,
} from '@react-pdf/renderer'
import type { Invoice, InvoiceLineItem } from '@/lib/types'

export type TicketPhoto = {
  ticketNumber: string | null
  imageUrl: string
  date: string
  driverName: string | null
  jobName: string
  truckNumber?: string | null
  material?: string | null
  timeWorked?: string | null
}

type CompanyInfo = {
  name: string
  address: string | null
  phone: string | null
  email: string | null
  logo_url: string | null
}

type Props = {
  invoice: Invoice & { invoice_line_items?: InvoiceLineItem[] }
  company: CompanyInfo
  ticketPhotos: TicketPhoto[]
}

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9.5, color: '#1a1a1a', padding: 36 },
  row: { flexDirection: 'row' },
  flex1: { flex: 1 },
  mb4: { marginBottom: 4 },
  mb8: { marginBottom: 8 },
  mb16: { marginBottom: 16 },
  mb24: { marginBottom: 24 },
  bold: { fontFamily: 'Helvetica-Bold' },
  gray: { color: '#6b7280' },
  small: { fontSize: 8.5 },
  companyName: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#1e3a2a' },
  invoiceTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#1e3a2a', textAlign: 'right' },
  sectionLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  clientName: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 3 },
  accentDivider: { borderTopWidth: 2, borderTopColor: '#2d7a4f', marginVertical: 14 },
  // Table — 9 columns, no photo column
  tableHeader: { flexDirection: 'row', backgroundColor: '#1e3a2a', color: '#fff', fontSize: 7.5, fontFamily: 'Helvetica-Bold', paddingVertical: 6, paddingHorizontal: 6 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingVertical: 5, paddingHorizontal: 6 },
  tableRowAlt: { backgroundColor: '#f9fafb' },
  colDate:     { width: '12%' },
  colTruck:    { width: '8%' },
  colDesc:     { width: '10%' },
  colLocation: { width: '20%' },
  colTicket:   { width: '8%' },
  colTime:     { width: '15%' },
  colQty:      { width: '5%', textAlign: 'right' },
  colRate:     { width: '10%', textAlign: 'right' },
  colAmt:      { width: '12%', textAlign: 'right' },
  // Totals
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 },
  totalLabel: { width: 100, textAlign: 'right', color: '#6b7280' },
  totalValue: { width: 80, textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  divider: { borderTopWidth: 1, borderTopColor: '#e5e7eb', marginVertical: 12 },
  // Supporting Tickets section
  ticketsDivider: { borderTopWidth: 2, borderTopColor: '#2d6a4f', marginBottom: 12 },
  ticketsHeader: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1e3a2a', marginBottom: 4 },
  ticketsSubtitle: { fontSize: 9, color: '#6b7280', marginBottom: 16 },
  ticketLabelBar: { flexDirection: 'row', backgroundColor: '#f5f5f5', padding: 8, marginBottom: 4 },
  ticketLabelBold: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#1a1a1a', flex: 1 },
  ticketLabelCenter: { fontSize: 11, color: '#374151', flex: 1, textAlign: 'center' },
  ticketLabelRight: { fontSize: 11, color: '#6b7280', flex: 1, textAlign: 'right' },
  ticketDetails: { fontSize: 9, color: '#6b7280', marginBottom: 8 },
  ticketImage: { width: '100%', height: 350, objectFit: 'contain', border: '1px solid #e0e0e0', marginBottom: 20 },
})

const fmt = (v: number) =>
  `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtPdfDate = (d: string | null | undefined): string => {
  if (!d) return ''
  const parts = d.slice(0, 10).split('-')
  if (parts.length !== 3) return d
  return `${parts[1]}/${parts[2]}`
}

const fmtLongDate = (d: string | null | undefined): string => {
  if (!d) return ''
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const parts = d.slice(0, 10).split('-')
  if (parts.length !== 3) return d
  return `${months[parseInt(parts[1]!) - 1]} ${parseInt(parts[2]!)}, ${parts[0]}`
}

const fmtRate = (rate: number | null | undefined, rateType: string | null | undefined): string => {
  if (rate == null) return ''
  const label = rateType === 'hr' ? 'hr' : rateType === 'ton' ? 'ton' : 'job'
  return `${fmt(rate)}/${label}`
}

export default function InvoicePDF({ invoice, company, ticketPhotos }: Props) {
  const lineItems = invoice.invoice_line_items ?? []

  const firstDeduction = lineItems.find(i => (i.deduction_pct ?? 0) > 0)?.deduction_pct ?? 0
  const netTotal   = lineItems.reduce((s, i) => s + i.amount, 0)
  const grossTotal = firstDeduction > 0
    ? lineItems.reduce((s, i) => s + i.amount / (1 - firstDeduction / 100), 0)
    : netTotal
  const isPaystub  = invoice.invoice_type === 'paystub' || invoice.invoice_type === 'contractor'
  const taxRate    = (!isPaystub && (invoice.tax_rate ?? 0) > 0) ? (invoice.tax_rate ?? 0) : 0
  const taxAmount  = netTotal * taxRate / 100
  const grandTotal = netTotal + taxAmount

  return (
    <Document title={`Invoice ${invoice.invoice_number}`}>

      {/* ── PAGE 1: Invoice ── */}
      <Page size="LETTER" style={s.page}>

        {/* HEADER */}
        <View style={[s.row, s.mb16]}>
          <View style={s.flex1}>
            {company.logo_url && (
              <Image src={company.logo_url} style={{ width: 120, height: 120, marginBottom: 8, objectFit: 'contain' }} />
            )}
            <Text style={s.companyName}>{company.name}</Text>
            {company.address && <Text style={[s.small, s.gray, s.mb4]}>{company.address}</Text>}
            {company.phone && <Text style={[s.small, s.gray]}>{company.phone}</Text>}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.invoiceTitle}>
              {invoice.invoice_type === 'paystub' ? 'DRIVER PAYMENT' : invoice.invoice_type === 'contractor' ? 'PAYMENT VOUCHER' : 'INVOICE'}
            </Text>
            <Text style={s.mb4}># {invoice.invoice_number}</Text>
            <Text style={[s.small, s.gray]}>Date: {invoice.created_at?.split('T')[0]}</Text>
            {invoice.due_date && <Text style={[s.small, s.gray]}>Due: {invoice.due_date}</Text>}
            {invoice.date_from && invoice.date_to && (
              <Text style={[s.small, s.gray]}>Period: {invoice.date_from} – {invoice.date_to}</Text>
            )}
          </View>
        </View>

        {/* BILL TO */}
        <View style={s.mb8}>
          <Text style={s.sectionLabel}>{isPaystub ? 'Pay To' : 'Bill To'}</Text>
          <Text style={s.clientName}>{invoice.client_name}</Text>
          {invoice.client_address && <Text style={[s.small, s.gray]}>{invoice.client_address}</Text>}
          {invoice.client_phone && <Text style={[s.small, s.gray]}>{invoice.client_phone}</Text>}
          {invoice.client_email && <Text style={[s.small, s.gray]}>{invoice.client_email}</Text>}
        </View>

        <View style={s.accentDivider} />

        {/* LINE ITEMS TABLE */}
        <View style={s.mb16}>
          <View style={s.tableHeader}>
            <Text style={s.colDate}>Date</Text>
            <Text style={s.colTruck}>Truck #</Text>
            <Text style={s.colDesc}>Material</Text>
            <Text style={s.colLocation}>Location</Text>
            <Text style={s.colTicket}>Ticket #</Text>
            <Text style={s.colTime}>Time In / Out</Text>
            <Text style={s.colQty}>Qty</Text>
            <Text style={s.colRate}>Rate</Text>
            <Text style={s.colAmt}>Amount</Text>
          </View>
          {lineItems.map((item, i) => (
            <View key={item.id} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
              <Text style={s.colDate}>{fmtPdfDate(item.line_date)}</Text>
              <Text style={s.colTruck}>{item.truck_number ?? ''}</Text>
              <Text style={s.colDesc}>{item.material || '—'}</Text>
              <Text style={s.colLocation}>{item.driver_name ?? ''}</Text>
              <Text style={s.colTicket}>{item.ticket_number ?? '—'}</Text>
              <Text style={s.colTime}>{item.time_worked || '—'}</Text>
              <Text style={s.colQty}>{item.quantity ?? ''}</Text>
              <Text style={s.colRate}>{fmtRate(item.rate, item.rate_type)}</Text>
              <Text style={s.colAmt}>{fmt(item.amount)}</Text>
            </View>
          ))}
        </View>

        {/* TOTALS */}
        <View style={{ alignItems: 'flex-end' }}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Subtotal</Text>
            <Text style={s.totalValue}>{fmt(grossTotal)}</Text>
          </View>
          {firstDeduction > 0 && (
            <View style={s.totalRow}>
              <Text style={[s.totalLabel, { color: '#ef4444' }]}>Deduction ({firstDeduction}%)</Text>
              <Text style={[s.totalValue, { color: '#ef4444' }]}>−{fmt(grossTotal - netTotal)}</Text>
            </View>
          )}
          {taxRate > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Tax ({taxRate}%)</Text>
              <Text style={s.totalValue}>{fmt(taxAmount)}</Text>
            </View>
          )}
          <View style={[s.totalRow, { borderTopWidth: 1.5, borderTopColor: '#1e3a2a', paddingTop: 4 }]}>
            <Text style={[s.totalLabel, s.bold]}>{isPaystub ? 'Net Pay' : 'Total Due'}</Text>
            <Text style={[s.totalValue, s.bold, { color: '#1e3a2a', fontSize: 12 }]}>{fmt(taxRate > 0 ? grandTotal : netTotal)}</Text>
          </View>
        </View>

        {/* NOTES / PAYMENT TERMS */}
        {(invoice.payment_terms || invoice.notes) && (
          <>
            <View style={s.divider} />
            {invoice.payment_terms && (
              <Text style={[s.small, s.gray, s.mb4]}>
                <Text style={s.bold}>Payment Terms: </Text>{invoice.payment_terms}
              </Text>
            )}
            {invoice.notes && (
              <Text style={[s.small, s.gray]}>
                <Text style={s.bold}>Notes: </Text>{invoice.notes}
              </Text>
            )}
          </>
        )}

        {/* FOOTER */}
        <View style={s.divider} />
        <Text style={[s.small, s.gray, { textAlign: 'center' }]}>
          {invoice.invoice_type === 'contractor'
            ? (invoice.payment_method === 'ach'
                ? `Payment issued to ${invoice.client_name} via ACH/Bank Transfer.`
                : invoice.payment_method === 'cash'
                ? `Cash payment issued to ${invoice.client_name}.`
                : invoice.payment_method === 'zelle'
                ? `Zelle payment sent to ${invoice.client_name}.`
                : invoice.payment_method === 'other'
                ? `Payment issued to ${invoice.client_name}.`
                : `Payment by check issued to ${invoice.client_name}.`)
            : (invoice.payment_method === 'ach'
                ? 'Thank you for your business. Payment via ACH/Bank Transfer.'
                : invoice.payment_method === 'cash'
                ? 'Thank you for your business. Payment accepted in cash.'
                : invoice.payment_method === 'zelle'
                ? `Thank you for your business. Send Zelle payment to ${company.phone || company.email || company.name}.`
                : invoice.payment_method === 'other'
                ? 'Thank you for your business. Please contact us for payment details.'
                : `Thank you for your business. Make checks payable to ${company.name}.`)}
        </Text>
        {ticketPhotos.length > 0 && (
          <Text style={[s.small, s.gray, { textAlign: 'center', marginTop: 4 }]}>
            {ticketPhotos.length} supporting ticket photo{ticketPhotos.length !== 1 ? 's' : ''} attached below.
          </Text>
        )}
        <Text style={{ fontSize: 7.5, color: '#d1d5db', textAlign: 'center', marginTop: 16 }}>
          Powered by DumpTruckBoss · dumptruckboss.com
        </Text>

      </Page>

      {/* ── PAGES 2+: Supporting Tickets ── */}
      {ticketPhotos.length > 0 && (
        <Page size="LETTER" style={s.page}>
          <View style={s.ticketsDivider} />
          <Text style={s.ticketsHeader}>Supporting Tickets</Text>
          <Text style={s.ticketsSubtitle}>Original ticket photos attached for verification</Text>

          {ticketPhotos.map((photo, i) => (
            <View key={i}>
              {/* Label bar */}
              <View style={s.ticketLabelBar}>
                <Text style={s.ticketLabelBold}>
                  {photo.ticketNumber ? `Ticket #${photo.ticketNumber}` : 'Ticket'}
                </Text>
                <Text style={s.ticketLabelCenter}>{photo.jobName}</Text>
                <Text style={s.ticketLabelRight}>{fmtLongDate(photo.date)}</Text>
              </View>
              {/* Detail row */}
              <Text style={s.ticketDetails}>
                {[
                  photo.driverName ? `Driver: ${photo.driverName}` : null,
                  photo.truckNumber ? `Truck: ${photo.truckNumber}` : null,
                  photo.material ? `Material: ${photo.material}` : null,
                  photo.timeWorked || null,
                ].filter(Boolean).join('  |  ')}
              </Text>
              {/* Full-width image */}
              <Image src={photo.imageUrl} style={s.ticketImage} />
            </View>
          ))}
        </Page>
      )}

    </Document>
  )
}
