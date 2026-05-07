'use client'

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
  // Header
  companyName: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#1e3a2a' },
  // Invoice title
  invoiceTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#1e3a2a', textAlign: 'right' },
  // Section header
  sectionLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  // Bill To client name — large and bold
  clientName: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 3 },
  // Colored divider
  accentDivider: { borderTopWidth: 2, borderTopColor: '#2d7a4f', marginVertical: 14 },
  // Table
  tableHeader: { flexDirection: 'row', backgroundColor: '#1e3a2a', color: '#fff', fontSize: 7.5, fontFamily: 'Helvetica-Bold', paddingVertical: 6, paddingHorizontal: 6 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingVertical: 5, paddingHorizontal: 6 },
  tableRowAlt: { backgroundColor: '#f9fafb' },
  // Column widths — 10 columns totalling 100%
  colPhoto:    { width: '5%' },
  colDate:     { width: '9%' },
  colTruck:    { width: '8%' },
  colDesc:     { width: '17%' },
  colLocation: { width: '12%' },
  colTicket:   { width: '8%' },
  colTime:     { width: '13%' },
  colQty:      { width: '6%', textAlign: 'right' },
  colRate:     { width: '11%', textAlign: 'right' },
  colAmt:      { width: '11%', textAlign: 'right' },
  // Totals
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 },
  totalLabel: { width: 100, textAlign: 'right', color: '#6b7280' },
  totalValue: { width: 80, textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  // Divider
  divider: { borderTopWidth: 1, borderTopColor: '#e5e7eb', marginVertical: 12 },
  // Photo page
  photoHeader: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1e3a2a', marginBottom: 4 },
  photoSubtitle: { fontSize: 9, color: '#6b7280', marginBottom: 16 },
  photoImage: { width: '100%', objectFit: 'contain', flex: 1 },
  exhibitLabel: { position: 'absolute', bottom: 40, right: 40, fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#6b7280' },
})

const fmt = (v: number) =>
  `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtRate = (rate: number | null | undefined, rateType: string | null | undefined): string => {
  if (rate == null) return ''
  const label = rateType === 'hr' ? 'hr' : rateType === 'ton' ? 'ton' : 'load'
  return `${fmt(rate)}/${label}`
}

export default function InvoicePDF({ invoice, company, ticketPhotos }: Props) {
  const lineItems = invoice.invoice_line_items ?? []
  const exhibitLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const photoByTicket = new Map(ticketPhotos.map(p => [p.ticketNumber, p.imageUrl]))

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
      {/* PAGE 1: Invoice summary */}
      <Page size="LETTER" style={s.page}>

        {/* ── HEADER ── */}
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

        {/* ── BILL TO / PAY TO ── */}
        <View style={s.mb8}>
          <Text style={s.sectionLabel}>{invoice.invoice_type === 'paystub' || invoice.invoice_type === 'contractor' ? 'Pay To' : 'Bill To'}</Text>
          <Text style={s.clientName}>{invoice.client_name}</Text>
          {invoice.client_address && <Text style={[s.small, s.gray]}>{invoice.client_address}</Text>}
          {invoice.client_phone && <Text style={[s.small, s.gray]}>{invoice.client_phone}</Text>}
          {invoice.client_email && <Text style={[s.small, s.gray]}>{invoice.client_email}</Text>}
        </View>

        {/* ── ACCENT DIVIDER ── */}
        <View style={s.accentDivider} />

        {/* ── LINE ITEMS TABLE ── */}
        <View style={s.mb16}>
          <View style={s.tableHeader}>
            <Text style={s.colPhoto}></Text>
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
          {lineItems.map((item, i) => {
            const photoUrl = item.ticket_number ? photoByTicket.get(item.ticket_number) : undefined
            return (
            <View key={item.id} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
              <View style={s.colPhoto}>
                {photoUrl
                  ? <Image src={photoUrl} style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 2 }} />
                  : <View style={{ width: 24, height: 24, backgroundColor: '#f3f4f6', borderRadius: 2 }} />}
              </View>
              <Text style={s.colDate}>{item.line_date ?? ''}</Text>
              <Text style={s.colTruck}>{item.truck_number ?? ''}</Text>
              <Text style={s.colDesc}>{item.material || '—'}</Text>
              <Text style={s.colLocation}>{item.driver_name ?? ''}</Text>
              <Text style={s.colTicket}>{item.ticket_number ?? '—'}</Text>
              <Text style={s.colTime}>{item.time_worked || '—'}</Text>
              <Text style={s.colQty}>{item.quantity ?? ''}</Text>
              <Text style={s.colRate}>{fmtRate(item.rate, item.rate_type)}</Text>
              <Text style={s.colAmt}>{fmt(item.amount)}</Text>
            </View>
          )})}
        </View>

        {/* ── TOTALS ── */}
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
            <Text style={[s.totalLabel, s.bold]}>
              {isPaystub ? 'Net Pay' : 'Total Due'}
            </Text>
            <Text style={[s.totalValue, s.bold, { color: '#1e3a2a', fontSize: 12 }]}>{fmt(taxRate > 0 ? grandTotal : netTotal)}</Text>
          </View>
        </View>

        {/* ── NOTES / PAYMENT TERMS (above thank-you) ── */}
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

        {/* ── FOOTER ── */}
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
            See attached Exhibit{ticketPhotos.length > 1 ? 's' : ''} A
            {ticketPhotos.length > 1 ? `–${exhibitLetters[ticketPhotos.length - 1]}` : ''} for supporting ticket photos.
          </Text>
        )}

      </Page>

      {/* PAGES 2+: Ticket Photos */}
      {ticketPhotos.map((photo, i) => (
        <Page key={i} size="LETTER" style={s.page}>
          <Text style={s.photoHeader}>
            Supporting Ticket {photo.ticketNumber ? `— #${photo.ticketNumber}` : ''}
          </Text>
          <Text style={s.photoSubtitle}>
            {photo.date} · {photo.driverName ?? 'Driver'} · {photo.jobName}
          </Text>
          <Image src={photo.imageUrl} style={s.photoImage} />
          <Text style={s.exhibitLabel}>Exhibit {exhibitLetters[i]}</Text>
        </Page>
      ))}
    </Document>
  )
}
