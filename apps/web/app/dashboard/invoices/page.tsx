'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Loader2, Receipt, ArrowLeft, Printer, Check, CreditCard, X, ChevronDown, FileText, Upload, Trash2, Mail, Lock, Pencil, DollarSign } from 'lucide-react'
import InvoicePDFButton from '@/components/invoice-pdf-button'
import RecordPaymentModal from '@/components/invoices/RecordPaymentModal'
import CompanyAvatar from '@/components/dashboard/company-avatar'
import { toast } from 'sonner'
import type { Invoice, InvoiceLineItem, Load, LoadTicket, Contractor, ContractorTicket, ContractorTicketSlip, Payment, ReceivedInvoice } from '@/lib/types'
import { getCompanyId } from '@/lib/get-company-id'
import { PAGE_SIZE, pageRange } from '@/lib/pagination'
import { canUse } from '@/lib/plan-gate'

type View = 'list' | 'create' | 'detail'
type InvoiceType = 'client' | 'paystub' | 'contractor'

type LoadWithTickets = Load & { load_tickets: LoadTicket[] }
type CTWithSlips = ContractorTicket & { contractor_ticket_slips: ContractorTicketSlip[] }

type InvoiceWithItems = Invoice & { invoice_line_items: InvoiceLineItem[] }

const statusColor = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-green-100 text-green-700',
  partially_paid: 'bg-orange-100 text-orange-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  overpaid: 'bg-purple-100 text-purple-700',
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  const [y, m, day] = d.slice(0, 10).split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m!) - 1]} ${parseInt(day!)}, ${y}`
}

function localDatePlus(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isOverdue(invoice: Invoice): boolean {
  if (['paid', 'draft', 'cancelled'].includes(invoice.status)) return false
  if (!invoice.due_date) return false
  return new Date(invoice.due_date + 'T00:00:00') < new Date()
}

function daysOverdueFn(invoice: Invoice): number {
  if (!isOverdue(invoice)) return 0
  return Math.floor((Date.now() - new Date(invoice.due_date! + 'T00:00:00').getTime()) / 86400000)
}

function formatPaymentTerms(terms: string): string {
  const map: Record<string, string> = {
    due_on_receipt: 'Due on Receipt',
    net_15: 'Net 15',
    net_30: 'Net 30',
    net_45: 'Net 45',
    net_60: 'Net 60',
    '2_10_net_30': '2/10 Net 30',
  }
  return map[terms] ?? terms
}

function calcAmount(item: { rate: number | null; rate_type: string | null; quantity: number | null }): number {
  const rate = item.rate ?? 0
  const qty = item.quantity ?? 1
  if (item.rate_type === 'hr') return rate
  return rate * qty
}

function fmtTime(t: string | null | undefined) {
  return t?.trim() || null
}
function buildTimeWorked(load: { time_in: string | null; time_out: string | null; hours_worked: string | null }): string | null {
  const t1 = fmtTime(load.time_in)
  const t2 = fmtTime(load.time_out)
  if (t1 && t2) return `${t1} – ${t2}`
  if (t1) return t1
  return load.hours_worked ?? null
}
async function urlToBase64(url: string): Promise<string> {
  try {
    const res = await fetch(url)
    const buf = await res.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let bin = ''
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]!)
    const ct = res.headers.get('content-type') ?? 'image/jpeg'
    return `data:${ct};base64,${btoa(bin)}`
  } catch {
    return url
  }
}

function buildMaterial(load: { material: string | null; load_type: string | null }): string | null {
  return load.material || load.load_type || null
}
function buildLocation(load: { origin: string | null; destination: string | null }): string | null {
  return [load.origin, load.destination].filter(Boolean).join(' → ') || null
}

function buildLineItems(loads: LoadWithTickets[], deductionPct: number): InvoiceLineItem[] {
  const items: InvoiceLineItem[] = []
  let order = 0

  for (const load of loads) {
    const slips = load.load_tickets ?? []
    const mat = buildMaterial(load)
    const loc = buildLocation(load)
    const tw  = buildTimeWorked(load)
    const totalPay = load.total_pay ?? null

    if (totalPay != null) {
      // total_pay is pre-computed — use it directly as a single line item
      const gross = totalPay
      const amount = deductionPct > 0 ? gross * (1 - deductionPct / 100) : gross
      items.push({
        id: crypto.randomUUID(),
        invoice_id: '',
        line_date: load.date,
        truck_number: load.truck_number,
        driver_name: loc,
        material: mat,
        ticket_number: slips[0]?.ticket_number ?? null,
        time_worked: tw,
        quantity: load.rate_quantity ?? 1,
        rate: load.rate,
        rate_type: load.rate_type,
        amount,
        deduction_pct: deductionPct > 0 ? deductionPct : null,
        sort_order: order++,
        photo_url: slips[0]?.image_url ?? load.image_url ?? null,
        description: null, unit_price: null, line_type: null,
      })
    } else if (slips.length === 0) {
      const amount = load.rate
      const deducted = amount * (1 - deductionPct / 100)
      items.push({
        id: crypto.randomUUID(),
        invoice_id: '',
        line_date: load.date,
        truck_number: load.truck_number,
        driver_name: loc,
        material: mat,
        ticket_number: null,
        time_worked: tw,
        quantity: 1,
        rate: load.rate,
        rate_type: load.rate_type,
        amount: deductionPct > 0 ? deducted : amount,
        deduction_pct: deductionPct > 0 ? deductionPct : null,
        sort_order: order++,
        photo_url: load.image_url ?? null,
        description: null, unit_price: null, line_type: null,
      })
    } else {
      for (const slip of slips) {
        const qty = slip.tonnage ?? 1
        const baseAmount = load.rate_type === 'hr' ? load.rate : load.rate * qty
        const amount = deductionPct > 0 ? baseAmount * (1 - deductionPct / 100) : baseAmount
        items.push({
          id: crypto.randomUUID(),
          invoice_id: '',
          line_date: load.date,
          truck_number: load.truck_number,
          driver_name: loc,
          material: mat,
          ticket_number: slip.ticket_number,
          time_worked: tw,
          quantity: load.rate_type === 'hr' ? null : qty,
          rate: load.rate,
          rate_type: load.rate_type,
          amount,
          deduction_pct: deductionPct > 0 ? deductionPct : null,
          sort_order: order++,
          photo_url: slip.image_url ?? load.image_url ?? null,
          description: null, unit_price: null, line_type: null,
        })
      }
    }
  }

  return items.sort((a, b) => (a.line_date ?? '') < (b.line_date ?? '') ? -1 : 1)
}

function buildDriverPayLineItems(
  loads: LoadWithTickets[],
  payType: 'percentage' | 'hourly',
  payPct: number,
  hourlyRate: number,
  totalHours: number,
): InvoiceLineItem[] {
  if (payType === 'hourly') {
    return [{
      id: crypto.randomUUID(), invoice_id: '',
      line_date: loads[0]?.date ?? null,
      truck_number: null,
      driver_name: loads[0]?.driver_name ?? null,
      material: 'Hours Worked',
      ticket_number: null,
      time_worked: `${totalHours} hrs`,
      quantity: totalHours,
      rate: hourlyRate,
      rate_type: 'hr',
      amount: hourlyRate * totalHours,
      deduction_pct: null,
      sort_order: 0,
      description: null, unit_price: null, line_type: null,
    }]
  }
  // Percentage pay — one line per load/slip
  const items: InvoiceLineItem[] = []
  let order = 0
  for (const load of loads) {
    const slips = load.load_tickets ?? []
    const mat = buildMaterial(load)
    const loc = buildLocation(load)
    const tw  = buildTimeWorked(load)
    const totalPay = load.total_pay ?? null
    if (totalPay != null || slips.length === 0) {
      const gross = totalPay ?? load.rate
      items.push({
        id: crypto.randomUUID(), invoice_id: '',
        line_date: load.date, truck_number: load.truck_number,
        driver_name: loc, material: mat,
        ticket_number: slips[0]?.ticket_number ?? null, time_worked: tw,
        quantity: load.rate_quantity ?? 1, rate: load.rate, rate_type: load.rate_type,
        amount: gross * (payPct / 100),
        deduction_pct: null, sort_order: order++,
        photo_url: slips[0]?.image_url ?? load.image_url ?? null,
        description: null, unit_price: null, line_type: null,
      })
    } else {
      for (const slip of slips) {
        const qty = slip.tonnage ?? 1
        const gross = load.rate_type === 'hr' ? load.rate : load.rate * qty
        items.push({
          id: crypto.randomUUID(), invoice_id: '',
          line_date: load.date, truck_number: load.truck_number,
          driver_name: loc, material: mat,
          ticket_number: slip.ticket_number, time_worked: tw,
          quantity: load.rate_type === 'hr' ? null : qty,
          rate: load.rate, rate_type: load.rate_type,
          amount: gross * (payPct / 100),
          deduction_pct: null, sort_order: order++,
          photo_url: slip.image_url ?? load.image_url ?? null,
          description: null, unit_price: null, line_type: null,
        })
      }
    }
  }
  return items.sort((a, b) => (a.line_date ?? '') < (b.line_date ?? '') ? -1 : 1)
}

// singleLinePerTicket=true → one line per ticket (used for client invoices)
// singleLinePerTicket=false → one line per slip (used for contractor pay stubs)
function buildContractorLineItems(tickets: CTWithSlips[], deductionPct: number, singleLinePerTicket = false): InvoiceLineItem[] {
  const items: InvoiceLineItem[] = []
  let order = 0
  for (const ticket of tickets) {
    const slips = ticket.contractor_ticket_slips ?? []
    if (slips.length === 0 || singleLinePerTicket) {
      const base = ticket.rate
      const amount = deductionPct > 0 ? base * (1 - deductionPct / 100) : base
      // Use stored unit_rate/rate_quantity for proper QTY × RATE display when available
      const hasBreakdown = ticket.unit_rate != null && ticket.rate_quantity != null
      items.push({
        id: crypto.randomUUID(), invoice_id: '',
        line_date: ticket.date, truck_number: ticket.truck_number ?? null,
        driver_name: ticket.job_name, material: ticket.material,
        ticket_number: ticket.ticket_number ?? null, time_worked: ticket.hours_worked,
        quantity: hasBreakdown ? ticket.rate_quantity! : 1,
        rate: hasBreakdown ? ticket.unit_rate! : ticket.rate,
        rate_type: ticket.rate_type,
        amount, deduction_pct: deductionPct > 0 ? deductionPct : null,
        sort_order: order++,
        description: null, unit_price: null, line_type: null,
      })
    } else {
      for (const slip of slips) {
        const qty = slip.tonnage ?? 1
        const unitRate = ticket.unit_rate ?? ticket.rate
        const base = ticket.rate_type === 'hr' ? ticket.rate : unitRate * qty
        const amount = deductionPct > 0 ? base * (1 - deductionPct / 100) : base
        items.push({
          id: crypto.randomUUID(), invoice_id: '',
          line_date: ticket.date, truck_number: ticket.truck_number ?? null,
          driver_name: ticket.job_name, material: ticket.material,
          ticket_number: null, time_worked: ticket.hours_worked,
          quantity: ticket.rate_type === 'hr' ? null : qty,
          rate: unitRate, rate_type: ticket.rate_type,
          amount, deduction_pct: deductionPct > 0 ? deductionPct : null,
          sort_order: order++,
          description: null, unit_price: null, line_type: null,
        })
      }
    }
  }
  return items.sort((a, b) => (a.line_date ?? '') < (b.line_date ?? '') ? -1 : 1)
}

export default function InvoicesPage() {
  const searchParams = useSearchParams()
  const [view, setView] = useState<View>(searchParams.get('new') === '1' ? 'create' : 'list')
  const [invStatusFilter, setInvStatusFilter] = useState<string>(searchParams.get('filter') ?? '')
  const [reminderSending, setReminderSending] = useState<string | null>(null)
  const [reminderSentIds, setReminderSentIds] = useState<Set<string>>(new Set())
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [invoicePage, setInvoicePage] = useState(0)
  const [hasMoreInvoices, setHasMoreInvoices] = useState(false)
  const [invoiceTotalCount, setInvoiceTotalCount] = useState<number | null>(null)
  const [loadingMoreInvoices, setLoadingMoreInvoices] = useState(false)
  const [userId, setUserId] = useState('')
  const [companyName, setCompanyName]       = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [userEmail, setUserEmail]           = useState('')
  const [userPhone, setUserPhone]           = useState('')
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null)

  // Create form
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('client')
  const [createForm, setCreateForm] = useState({
    client_name: '',
    client_address: '',
    client_phone: '',
    client_email: '',
    date_from: '',
    date_to: '',
    notes: '',
    due_date: localDatePlus(30),
    date_paid: '',
    payment_method: 'check',
  })
  const [clientCompanies, setClientCompanies] = useState<{ id: string; name: string; address: string | null; email: string | null; phone: string | null; payment_terms: string | null; tax_exempt: boolean | null; default_tax_rate: number | null }[]>([])
  // Custom line items (additional charges on client invoices)
  type CustomLineItem = { id: string; description: string; quantity: number; unit_price: number; amount: number; line_type: string }
  const [customLineItems, setCustomLineItems] = useState<CustomLineItem[]>([])
  // Tax exempt + early payment state for auto-fill from client
  const [taxExemptDisplay, setTaxExemptDisplay] = useState(false)
  const [earlyPaymentDeadline, setEarlyPaymentDeadline] = useState('')
  const [clientNameMode, setClientNameMode] = useState<'dropdown' | 'manual'>('dropdown')
  const [deductionPct, setDeductionPct] = useState('')
  // Driver Pay Invoice state
  const [driverPayType, setDriverPayType] = useState<'percentage' | 'hourly'>('percentage')
  const [driverPayPct, setDriverPayPct] = useState('')
  const [driverHourlyRate, setDriverHourlyRate] = useState('')
  const [driverTotalHours, setDriverTotalHours] = useState('')
  const [allLoads, setAllLoads] = useState<LoadWithTickets[]>([])
  const [selectedLoadIds, setSelectedLoadIds] = useState<Set<string>>(new Set())
  const [driverFilter, setDriverFilter] = useState('')
  const [driversList, setDriversList] = useState<{ id: string; name: string }[]>([])
  // Contractor invoice state
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [selectedContractorId, setSelectedContractorId] = useState('')
  const [contractorTickets, setContractorTickets] = useState<CTWithSlips[]>([])
  const [selectedCTIds, setSelectedCTIds] = useState<Set<string>>(new Set())
  // Subcontractor tickets available for client invoices (separate from pay stub flow)
  const [allContractorTicketsForClient, setAllContractorTicketsForClient] = useState<CTWithSlips[]>([])
  const [selectedCTIdsForClient, setSelectedCTIdsForClient] = useState<Set<string>>(new Set())
  const [taxRate, setTaxRate] = useState('')
  const [saving, setSaving] = useState(false)
  const [companyPlan, setCompanyPlan] = useState<string | null>(null)

  // Received invoices tab
  const [invoiceTab, setInvoiceTab]             = useState<'sent' | 'received'>('sent')
  const [receivedInvoices, setReceivedInvoices] = useState<ReceivedInvoice[]>([])
  const [showRecvForm, setShowRecvForm]         = useState(false)
  const [savingRecv, setSavingRecv]             = useState(false)
  const [recvForm, setRecvForm] = useState({
    subcontractor_name: '',
    their_invoice_number: '',
    amount: '',
    date_received: localDatePlus(0),
    work_start_date: '',
    work_end_date: '',
    notes: '',
  })
  const [recvFile, setRecvFile]           = useState<File | null>(null)
  const [recvFilePreview, setRecvFilePreview] = useState<string | null>(null)
  const recvFileRef = useRef<HTMLInputElement>(null)

  // Detail view
  const [detailInvoice, setDetailInvoice] = useState<InvoiceWithItems | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [payments, setPayments] = useState<Payment[]>([])
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_date: localDatePlus(0), payment_method: 'Check', notes: '' })
  const [savingPayment, setSavingPayment] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [sendForm, setSendForm] = useState({ toEmail: '', toPhone: '', subject: '', message: '' })
  const [sendVia, setSendVia] = useState<'email' | 'sms' | 'both'>('email')
  const [sending, setSending] = useState(false)
  const [detailTicketPhotos, setDetailTicketPhotos] = useState<{ ticketNumber: string | null; imageUrl: string; date: string; driverName: string | null; jobName: string; truckNumber?: string | null; material?: string | null; timeWorked?: string | null }[]>([])
  const [includeTicketPhotos, setIncludeTicketPhotos] = useState(true)

  const [uninvoicedCount, setUninvoicedCount] = useState(0)
  const [generatingInvoice, setGeneratingInvoice] = useState(false)

  // Edit invoice modal
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [editInvForm, setEditInvForm] = useState({ client_name: '', client_address: '', client_phone: '', client_email: '', date_from: '', date_to: '', due_date: '', notes: '', payment_method: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  // Record payment modal (triggered from status dropdown)
  const [paymentModal, setPaymentModal] = useState<{ open: boolean; invoice: Invoice | null }>({ open: false, invoice: null })

  const supabase = createClient()

  async function getUid(): Promise<string | null> {
    if (userId) return userId
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setUserId(user.id)
    return user?.id ?? null
  }

  async function fetchInvoices() {
    setLoading(true)
    setInvoicePage(0)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)
    setUserEmail(user.email ?? '')

    const [range0, range1] = pageRange(0)
    const companyIdForQuery = await getCompanyId()
    const effectiveId = companyIdForQuery ?? user.id
    // Load company info from companies table (source of truth)
    const [invRes, coRes] = await Promise.all([
      supabase.from('invoices').select('*', { count: 'exact' }).eq('company_id', effectiveId).order('created_at', { ascending: false }).range(range0, range1),
      supabase.from('companies').select('name, address, phone, logo_url, plan, is_super_admin, subscription_override').eq('id', effectiveId).maybeSingle(),
    ])

    if (invRes.error) toast.error('Failed to load invoices: ' + invRes.error.message)

    setCompanyName(coRes.data?.name ?? '')
    setCompanyAddress((coRes.data as { address?: string | null } | null)?.address ?? '')
    setUserPhone((coRes.data as { phone?: string | null } | null)?.phone ?? user.user_metadata?.phone ?? '')
    setCompanyLogoUrl((coRes.data as { logo_url?: string | null } | null)?.logo_url ?? null)
    const coData = coRes.data as { plan?: string | null; is_super_admin?: boolean | null; subscription_override?: string | null } | null
    setCompanyPlan(coData?.is_super_admin || coData?.subscription_override ? 'growth' : coData?.plan ?? null)

    // Load received invoices
    if (companyIdForQuery) {
      const { data: recvData } = await supabase.from('received_invoices').select('*').eq('company_id', companyIdForQuery).order('created_at', { ascending: false })
      setReceivedInvoices(recvData ?? [])
    }

    const invoiceList = invRes.data ?? []
    const total = invRes.count ?? 0
    setInvoiceTotalCount(total)
    setHasMoreInvoices(invoiceList.length < total)

    // Auto-flag overdue: sent or partially_paid invoices whose due_date has passed
    const today = new Date().toISOString().split('T')[0]!
    const toFlag = invoiceList.filter(
      (i: Invoice) => (i.status === 'sent' || i.status === 'partially_paid') && i.due_date && i.due_date < today
    )
    if (toFlag.length > 0) {
      const ids = toFlag.map((i: Invoice) => i.id)
      await supabase.from('invoices').update({ status: 'overdue' }).in('id', ids)
      toFlag.forEach((i: Invoice) => { i.status = 'overdue' })
    }

    setInvoices(invoiceList)
    setLoading(false)
  }

  async function loadMoreInvoices() {
    const uid = await getCompanyId()
    if (!uid || loadingMoreInvoices) return
    setLoadingMoreInvoices(true)
    const nextPage = invoicePage + 1
    const [range0, range1] = pageRange(nextPage)
    const { data } = await supabase
      .from('invoices').select('*')
      .eq('company_id', uid)
      .order('created_at', { ascending: false })
      .range(range0, range1)
    if (data && data.length > 0) {
      setInvoices(prev => [...prev, ...(data as Invoice[])])
      setInvoicePage(nextPage)
      setHasMoreInvoices(invoices.length + data.length < (invoiceTotalCount ?? 0))
    } else {
      setHasMoreInvoices(false)
    }
    setLoadingMoreInvoices(false)
  }

  async function fetchLoadsForCreate() {
    const uid = await getCompanyId()
    if (!uid) return
    const { data } = await supabase
      .from('loads')
      .select('*, load_tickets(*)')
      .eq('company_id', uid)
      .order('date', { ascending: false })
    setAllLoads((data ?? []) as LoadWithTickets[])
  }

  async function fetchContractors() {
    const uid = await getCompanyId()
    if (!uid) return
    const { data } = await supabase
      .from('contractors')
      .select('*')
      .eq('company_id', uid)
      .eq('status', 'active')
      .order('name')
    setContractors(data ?? [])
  }

  async function fetchClientCompaniesForCreate() {
    const uid = await getCompanyId()
    if (!uid) return
    const { data } = await supabase
      .from('client_companies')
      .select('id, name, address, email, phone, payment_terms, tax_exempt, default_tax_rate')
      .eq('company_id', uid)
      .order('name')
    setClientCompanies(data ?? [])
  }

  async function fetchDriversForCreate() {
    const uid = await getCompanyId()
    if (!uid) return
    const { data } = await supabase
      .from('drivers')
      .select('id, name')
      .eq('company_id', uid)
      .eq('status', 'active')
      .order('name')
    setDriversList(data ?? [])
  }

  async function fetchContractorTickets(contractorId: string) {
    const uid = await getCompanyId()
    if (!uid) return
    const { data } = await supabase
      .from('contractor_tickets')
      .select('*, contractor_ticket_slips(*)')
      .eq('contractor_id', contractorId)
      .eq('company_id', uid)
      .not('status', 'in', '("invoiced","paid")')
      .order('date', { ascending: false })
    setContractorTickets((data ?? []) as CTWithSlips[])
    setSelectedCTIds(new Set())
  }

  async function fetchAllContractorTicketsForClient() {
    const uid = await getCompanyId()
    if (!uid) return
    const { data } = await supabase
      .from('contractor_tickets')
      .select('*, contractor_ticket_slips(*)')
      .eq('company_id', uid)
      .not('payment_status', 'eq', 'paid')
      .not('status', 'eq', 'paid')
      .is('client_invoice_id', null)
      .order('date', { ascending: false })
    setAllContractorTicketsForClient((data ?? []) as CTWithSlips[])
    setSelectedCTIdsForClient(new Set())
  }

  useEffect(() => { fetchInvoices(); fetchUninvoicedCount() }, [])

  async function sendReminder(inv: Invoice) {
    setReminderSending(inv.id)
    try {
      const res  = await fetch(`/api/invoices/${inv.id}/send-reminder`, { method: 'POST' })
      const json = await res.json() as { sent?: boolean; error?: string; reminder_count?: number; last_reminder_sent_at?: string }
      if (json.sent) {
        toast.success(`Reminder sent to ${inv.client_name}`)
        setReminderSentIds(s => new Set(s).add(inv.id))
        setInvoices(prev => prev.map(i => i.id === inv.id
          ? { ...i, reminder_count: json.reminder_count ?? (i.reminder_count ?? 0) + 1, last_reminder_sent_at: json.last_reminder_sent_at ?? new Date().toISOString() }
          : i
        ))
        setTimeout(() => setReminderSentIds(s => { const next = new Set(s); next.delete(inv.id); return next }), 3000)
      } else {
        toast.error(json.error ?? 'Could not send reminder')
      }
    } finally {
      setReminderSending(null)
    }
  }

  const filteredInvoices = invStatusFilter
    ? invoices.filter(i => i.status === invStatusFilter)
    : invoices

  useEffect(() => {
    if (view === 'create') {
      fetchLoadsForCreate()
      fetchContractors()
      fetchClientCompaniesForCreate()
      fetchDriversForCreate()
      fetchAllContractorTicketsForClient()
    }
  }, [view])

  useEffect(() => {
    if (selectedContractorId) fetchContractorTickets(selectedContractorId)
  }, [selectedContractorId])

  const drivers = [...new Set(allLoads.map(l => l.driver_name))].filter(Boolean)

  const filteredLoads = allLoads.filter(l => {
    // Hide loads already on a client invoice from the client invoice picker
    if (invoiceType === 'client' && l.client_invoice_id != null) return false
    // Hide loads already on a pay stub from the paystub picker
    if (invoiceType === 'paystub' && (l.invoice_id != null || l.status === 'invoiced' || l.status === 'paid')) return false
    if (driverFilter && l.driver_name !== driverFilter) return false
    if (createForm.date_from && l.date < createForm.date_from) return false
    if (createForm.date_to && l.date > createForm.date_to) return false
    return true
  })

  const selectedLoads = allLoads.filter(l => selectedLoadIds.has(l.id))
  const selectedCTs = contractorTickets.filter(t => selectedCTIds.has(t.id))
  const selectedCTsForClient = allContractorTicketsForClient.filter(t => selectedCTIdsForClient.has(t.id))

  const previewItems = invoiceType === 'contractor'
    ? buildContractorLineItems(selectedCTs, parseFloat(deductionPct) || 0)
    : invoiceType === 'paystub'
    ? buildDriverPayLineItems(
        selectedLoads,
        driverPayType,
        parseFloat(driverPayPct) || 0,
        parseFloat(driverHourlyRate) || 0,
        parseFloat(driverTotalHours) || 0,
      )
    : [
        ...buildLineItems(selectedLoads, 0),
        ...buildContractorLineItems(selectedCTsForClient, parseFloat(deductionPct) || 0, true),
      ]
  const ticketsSubtotal    = previewItems.reduce((s, i) => s + i.amount, 0)
  const customItemsTotal   = customLineItems.reduce((s, i) => s + i.amount, 0)
  const subtotal           = ticketsSubtotal + customItemsTotal
  const taxRateNum         = invoiceType === 'client' ? (parseFloat(taxRate) || 0) : 0
  const taxAmountCalc      = subtotal * taxRateNum / 100
  const invoiceTotal       = subtotal + taxAmountCalc
  const activeSelectionSize = invoiceType === 'contractor'
    ? selectedCTIds.size
    : invoiceType === 'client'
    ? selectedLoadIds.size + selectedCTIdsForClient.size
    : selectedLoadIds.size

  // Approved loads not yet selected — used for the "you're leaving money behind" warning
  const unselectedApprovedLoads = allLoads.filter(l => l.status === 'approved' && !selectedLoadIds.has(l.id))
  const unselectedApprovedTotal = unselectedApprovedLoads.reduce((s, l) => s + (l.total_pay ?? l.rate ?? 0), 0)

  function toggleLoad(id: string) {
    setSelectedLoadIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function selectAllUninvoiced() {
    const ids = new Set(allLoads.filter(l => l.status === 'approved').map(l => l.id))
    setSelectedLoadIds(ids)
  }

  function selectAllFiltered() {
    setSelectedLoadIds(prev => {
      const n = new Set(prev)
      filteredLoads.forEach(l => n.add(l.id))
      return n
    })
  }

  // Step 11: Auto-populate date range from selected contractor tickets
  useEffect(() => {
    if (invoiceType !== 'contractor' || selectedCTIds.size === 0) return
    const dates = contractorTickets.filter(t => selectedCTIds.has(t.id)).map(t => t.date).filter(Boolean).sort()
    if (dates.length > 0) {
      setCreateForm(p => ({ ...p, date_from: dates[0]!, date_to: dates[dates.length - 1]! }))
    }
  }, [selectedCTIds, contractorTickets, invoiceType])

  // Step 3: AR aging computation
  const arAging = useMemo(() => {
    const now = new Date()
    const buckets = {
      current:    { amount: 0, count: 0 },
      days30:     { amount: 0, count: 0 },
      days60:     { amount: 0, count: 0 },
      days90:     { amount: 0, count: 0 },
      days90plus: { amount: 0, count: 0 },
    }
    invoices
      .filter(inv => !['paid', 'draft'].includes(inv.status))
      .forEach(inv => {
        const days = Math.floor((now.getTime() - new Date(inv.created_at).getTime()) / 86400000)
        const remaining = inv.amount_remaining ?? inv.total ?? 0
        if (days <= 0)       { buckets.current.amount += remaining; buckets.current.count++ }
        else if (days <= 30) { buckets.days30.amount += remaining; buckets.days30.count++ }
        else if (days <= 60) { buckets.days60.amount += remaining; buckets.days60.count++ }
        else if (days <= 90) { buckets.days90.amount += remaining; buckets.days90.count++ }
        else                 { buckets.days90plus.amount += remaining; buckets.days90plus.count++ }
      })
    return buckets
  }, [invoices])
  const totalAR = Object.values(arAging).reduce((s, b) => s + b.amount, 0)

  async function openDetail(inv: Invoice) {
    setDetailLoading(true)
    setView('detail')
    setPayments([])
    setDetailTicketPhotos([])
    const uid = await getCompanyId()

    const [invRes, paymentsRes] = await Promise.all([
      supabase.from('invoices').select('*, invoice_line_items(*)').eq('id', inv.id).single(),
      supabase.from('payments').select('*').eq('invoice_id', inv.id).order('payment_date', { ascending: false }),
    ])
    const lineItems: InvoiceLineItem[] = (invRes.data?.invoice_line_items ?? []).sort(
      (a: InvoiceLineItem, b: InvoiceLineItem) => a.sort_order - b.sort_order
    )
    const sorted = { ...invRes.data, invoice_line_items: lineItems }
    setDetailInvoice(sorted as InvoiceWithItems)
    setPayments(paymentsRes.data ?? [])

    // Fetch ticket photos for all loads in the invoice date range
    if (uid && inv.date_from && inv.date_to) {
      const { data: loadsData } = await supabase
        .from('loads')
        .select('id, job_name, date, driver_name, truck_number, material, load_type, image_url, load_tickets(ticket_number, image_url, time_in, time_out)')
        .eq('company_id', uid)
        .gte('date', inv.date_from)
        .lte('date', inv.date_to)

      const rawPhotos: typeof detailTicketPhotos = []
      for (const load of loadsData ?? []) {
        const slips = (load.load_tickets ?? []) as { ticket_number: string | null; image_url: string | null; time_in?: string | null; time_out?: string | null }[]
        const slipPhotos = slips.filter(s => s.image_url)
        const mat = (load as { material?: string | null; load_type?: string | null }).material || (load as { load_type?: string | null }).load_type || null
        const truck = (load as { truck_number?: string | null }).truck_number || null
        if (slipPhotos.length > 0) {
          for (const slip of slipPhotos) {
            const timeWorked = slip.time_in && slip.time_out ? `${slip.time_in} – ${slip.time_out}` : null
            rawPhotos.push({
              ticketNumber: slip.ticket_number,
              imageUrl: slip.image_url!,
              date: load.date,
              driverName: load.driver_name,
              jobName: load.job_name,
              truckNumber: truck,
              material: mat,
              timeWorked,
            })
          }
        } else if ((load as { image_url?: string | null }).image_url) {
          rawPhotos.push({
            ticketNumber: null,
            imageUrl: (load as { image_url?: string | null }).image_url!,
            date: load.date,
            driverName: load.driver_name,
            jobName: load.job_name,
            truckNumber: truck,
            material: mat,
            timeWorked: null,
          })
        }
      }

      // Convert to base64 so react-pdf can embed images without CORS issues
      const photos = await Promise.all(rawPhotos.map(async p => ({
        ...p,
        imageUrl: await urlToBase64(p.imageUrl),
      })))
      setDetailTicketPhotos(photos)
    }

    setDetailLoading(false)
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!detailInvoice) return
    const amount = parseFloat(paymentForm.amount) || 0
    if (amount <= 0) { toast.error('Amount must be greater than 0'); return }

    const alreadyPaid = payments.reduce((s, p) => s + p.amount, 0)
    const invoiceTotal = detailInvoice.total
    const remaining = invoiceTotal - alreadyPaid

    setSavingPayment(true)
    const uid = await getCompanyId()
    if (!uid) { toast.error('Not authenticated'); setSavingPayment(false); return }

    const newPaidTotal = alreadyPaid + amount
    const newRemaining = invoiceTotal - newPaidTotal
    const isOverpaid = newPaidTotal > invoiceTotal + 0.01
    const overpaidAmt = isOverpaid ? newPaidTotal - invoiceTotal : 0
    const newStatus: Invoice['status'] = isOverpaid ? 'overpaid' : newPaidTotal >= invoiceTotal - 0.01 ? 'paid' : 'partially_paid'
    const resolvedType = isOverpaid ? 'overpayment' : newStatus === 'paid' ? 'full' : 'partial'

    const { error } = await supabase.from('payments').insert({
      company_id: uid,
      invoice_id: detailInvoice.id,
      amount,
      payment_date: paymentForm.payment_date,
      payment_method: paymentForm.payment_method || null,
      notes: paymentForm.notes || null,
      payment_type: resolvedType,
    })
    if (error) { toast.error('Failed to record payment: ' + error.message); setSavingPayment(false); return }

    await supabase.from('invoices').update({
      status: newStatus,
      amount_paid: newPaidTotal,
      amount_remaining: Math.max(0, newRemaining),
      overpaid_amount: overpaidAmt,
      ...(newStatus === 'paid' ? { date_paid: paymentForm.payment_date } : {}),
    }).eq('id', detailInvoice.id)
    const invUpdate = { status: newStatus, amount_paid: newPaidTotal, amount_remaining: Math.max(0, newRemaining), overpaid_amount: overpaidAmt }
    setDetailInvoice(prev => prev ? { ...prev, ...invUpdate } : prev)
    setInvoices(prev => prev.map(i => i.id === detailInvoice.id ? { ...i, ...invUpdate } : i))

    // Refetch real payments list
    const { data } = await supabase
      .from('payments').select('*')
      .eq('invoice_id', detailInvoice.id)
      .order('payment_date', { ascending: false })
    setPayments(data ?? [])
    toast.success(newStatus === 'paid' ? 'Invoice fully paid!' : newStatus === 'overpaid' ? `Overpayment recorded — $${fmt(overpaidAmt)} over` : 'Partial payment recorded')
    setShowPaymentForm(false)
    setPaymentForm({ amount: '', payment_date: localDatePlus(0), payment_method: 'Check', notes: '' })
    setSavingPayment(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (activeSelectionSize === 0) { toast.error('Select at least one job'); return }
    setSaving(true)

    const uid = await getCompanyId()
    if (!uid) { toast.error('Not authenticated'); setSaving(false); return }

    const prefix = invoiceType === 'client' ? 'INV' : invoiceType === 'paystub' ? 'PAY' : 'CONT'
    const { count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', uid)
      .eq('invoice_type', invoiceType)
    const seq = (count ?? 0) + 1
    const num = `${prefix}-${String(seq).padStart(4, '0')}`
    const invoiceId = crypto.randomUUID()

    const { error: invErr } = await supabase.from('invoices').insert({
      id: invoiceId,
      company_id: uid,
      invoice_number: num,
      invoice_type: invoiceType,
      client_name: createForm.client_name,
      client_address: createForm.client_address || null,
      client_phone: createForm.client_phone || null,
      client_email: createForm.client_email || null,
      total: invoiceTotal,
      tax_rate: taxRateNum > 0 ? taxRateNum : null,
      status: 'draft',
      due_date: createForm.due_date || null,
      date_paid: createForm.date_paid || null,
      date_from: createForm.date_from || null,
      date_to: createForm.date_to || null,
      payment_method: createForm.payment_method || 'check',
      notes: createForm.notes || null,
      early_payment_deadline: earlyPaymentDeadline || null,
    })

    if (invErr) { toast.error(invErr.message); setSaving(false); return }

    const lineItemsToInsert = previewItems.map(({ photo_url: _p, ...item }) => ({ ...item, invoice_id: invoiceId, company_id: uid }))
    const { error: itemErr } = await supabase.from('invoice_line_items').insert(lineItemsToInsert)
    if (itemErr) { toast.error(itemErr.message); setSaving(false); return }

    // Save custom/additional line items
    if (customLineItems.length > 0) {
      const customToInsert = customLineItems
        .filter(item => item.description.trim())
        .map((item, i) => ({
          company_id: uid,
          invoice_id: invoiceId,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount,
          line_type: item.line_type,
          sort_order: previewItems.length + i,
        }))
      if (customToInsert.length > 0) {
        await supabase.from('invoice_line_items').insert(customToInsert)
      }
    }

    if (invoiceType === 'contractor') {
      await supabase.from('contractor_tickets').update({ status: 'invoiced', invoice_id: invoiceId }).in('id', [...selectedCTIds])
    } else if (invoiceType === 'paystub') {
      await supabase.from('loads').update({ status: 'invoiced', invoice_id: invoiceId }).in('id', [...selectedLoadIds])
    } else {
      // Client invoice: link via client_invoice_id so pay stub links (invoice_id) remain separate
      if (selectedLoadIds.size > 0) {
        await supabase.from('loads').update({ client_invoice_id: invoiceId }).in('id', [...selectedLoadIds])
      }
      if (selectedCTIdsForClient.size > 0) {
        await supabase.from('contractor_tickets').update({ client_invoice_id: invoiceId }).in('id', [...selectedCTIdsForClient])
      }
    }

    toast.success('Invoice created')
    setSaving(false)
    setView('list')
    resetCreateForm()
    fetchInvoices()
  }

  async function fetchUninvoicedCount() {
    const companyId = await getCompanyId()
    if (!companyId) return
    const { count } = await supabase
      .from('loads')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .in('status', ['pending', 'approved'])
    setUninvoicedCount(count ?? 0)
  }

  async function handleGenerateFromTickets() {
    setGeneratingInvoice(true)
    resetCreateForm()
    setInvoiceType('client')
    await Promise.all([fetchLoadsForCreate(), fetchClientCompaniesForCreate(), fetchDriversForCreate()])

    const companyId = await getCompanyId()
    if (companyId) {
      const { data: uninvoiced } = await supabase
        .from('loads')
        .select('id, client_company')
        .eq('company_id', companyId)
        .eq('status', 'approved')  // auto-select approved loads only (not pending)

      if (uninvoiced && uninvoiced.length > 0) {
        // Auto-select ALL approved loads; pre-fill client from most common
        const freq = new Map<string, number>()
        uninvoiced.forEach((l: { id: string; client_company: string | null }) => { if (l.client_company) freq.set(l.client_company, (freq.get(l.client_company) ?? 0) + 1) })
        const topClient = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
        setSelectedLoadIds(new Set(uninvoiced.map((l: { id: string; client_company: string | null }) => l.id)))
        if (topClient) setCreateForm(f => ({ ...f, client_name: topClient }))
      }
    }

    setGeneratingInvoice(false)
    setView('create')
  }

  function resetCreateForm() {
    setInvoiceType('client')
    setCreateForm({ client_name: '', client_address: '', client_phone: '', client_email: '', date_from: '', date_to: '', notes: '', due_date: localDatePlus(30), date_paid: '', payment_method: 'check' })
    setClientNameMode('dropdown')
    setDeductionPct('')
    setTaxRate('')
    setDriverPayType('percentage')
    setDriverPayPct('')
    setDriverHourlyRate('')
    setDriverTotalHours('')
    setSelectedLoadIds(new Set())
    setSelectedCTIds(new Set())
    setSelectedCTIdsForClient(new Set())
    setSelectedContractorId('')
    setContractorTickets([])
    setAllContractorTicketsForClient([])
    setDriverFilter('')
    setCustomLineItems([])
    setTaxExemptDisplay(false)
    setEarlyPaymentDeadline('')
  }

  function addLineItem() {
    setCustomLineItems(prev => [...prev, { id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0, amount: 0, line_type: 'custom' }])
  }

  function updateLineItem(id: string, field: string, value: string | number) {
    setCustomLineItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const updated = { ...item, [field]: value }
      if (field === 'quantity' || field === 'unit_price') {
        updated.amount = (Number(updated.quantity) || 0) * (Number(updated.unit_price) || 0)
      }
      return updated
    }))
  }

  async function handleSaveReceived(e: React.FormEvent) {
    e.preventDefault()
    setSavingRecv(true)
    const companyId = await getCompanyId()
    if (!companyId) { toast.error('Company not found'); setSavingRecv(false); return }

    let file_url: string | null = null
    if (recvFile) {
      const ext  = recvFile.name.split('.').pop() ?? 'bin'
      const path = `received-invoices/${companyId}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from('ticket-photos').upload(path, recvFile, { upsert: true })
      if (upErr) { toast.error('File upload failed: ' + upErr.message); setSavingRecv(false); return }
      file_url = supabase.storage.from('ticket-photos').getPublicUrl(path).data.publicUrl
    }

    const { error } = await supabase.from('received_invoices').insert({
      company_id: companyId,
      subcontractor_name: recvForm.subcontractor_name,
      their_invoice_number: recvForm.their_invoice_number || null,
      amount: parseFloat(recvForm.amount) || 0,
      date_received: recvForm.date_received || null,
      work_start_date: recvForm.work_start_date || null,
      work_end_date: recvForm.work_end_date || null,
      notes: recvForm.notes || null,
      status: 'pending_review',
      file_url,
    })
    if (error) { toast.error(error.message); setSavingRecv(false); return }
    toast.success('Invoice received added')
    setSavingRecv(false)
    setShowRecvForm(false)
    setRecvForm({ subcontractor_name: '', their_invoice_number: '', amount: '', date_received: localDatePlus(0), work_start_date: '', work_end_date: '', notes: '' })
    setRecvFile(null)
    setRecvFilePreview(null)
    fetchInvoices()
  }

  async function handleDeleteInvoice(inv: Invoice) {
    if (!confirm(`Are you sure you want to delete invoice ${inv.invoice_number}? This cannot be undone.`)) return
    await supabase.from('invoice_line_items').delete().eq('invoice_id', inv.id)
    const { error } = await supabase.from('invoices').delete().eq('id', inv.id)
    if (error) { toast.error('Delete failed: ' + error.message); return }
    setInvoices(prev => prev.filter(i => i.id !== inv.id))
    toast.success('Invoice deleted')
  }

  async function updateReceivedStatus(id: string, status: ReceivedInvoice['status']) {
    const updates: Partial<ReceivedInvoice> = { status }
    if (status === 'paid') updates.paid_date = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('received_invoices').update(updates).eq('id', id)
    if (error) { toast.error(error.message); return }
    setReceivedInvoices(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))
  }

  async function updateStatus(id: string, status: Invoice['status'], invoiceType?: string | null) {
    const today = new Date().toISOString().split('T')[0]!
    // When marking paid: stamp date_paid so dashboard revenue queries pick it up.
    // When un-marking paid: clear date_paid so it doesn't count as collected revenue.
    const extra: Partial<Invoice> =
      status === 'paid' ? { date_paid: today } :
      ['draft', 'sent', 'overdue'].includes(status) ? { date_paid: null } :
      {}
    const { error } = await supabase.from('invoices').update({ status, ...extra }).eq('id', id)
    if (error) { toast.error('Status update failed: ' + error.message); return }
    const patch = { status, ...extra }
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...patch } : inv))
    if (detailInvoice?.id === id) setDetailInvoice(prev => prev ? { ...prev, ...patch } : prev)

    // Cascade ticket status when pay stub is paid or reverted
    // Client invoices do NOT cascade — client payment ≠ worker being paid
    const ticketStatus =
      status === 'paid' ? 'paid' :
      ['draft', 'sent', 'overdue'].includes(status) ? 'invoiced' :
      null
    if (ticketStatus) {
      if (invoiceType === 'contractor') {
        const ctUpdate = ticketStatus === 'paid'
          ? { status: 'paid', payment_status: 'paid', paid_at: today }
          : { status: ticketStatus, payment_status: null as string | null, paid_at: null as string | null }
        await supabase.from('contractor_tickets').update(ctUpdate).eq('invoice_id', id)
      } else if (invoiceType === 'paystub') {
        await supabase.from('loads').update({ status: ticketStatus }).eq('invoice_id', id)
      }
    }
  }

  function handleStatusChange(inv: Invoice, newStatus: string) {
    if (newStatus === 'partially_paid' || newStatus === 'overpaid') {
      setPaymentModal({ open: true, invoice: inv })
    } else {
      updateStatus(inv.id, newStatus as Invoice['status'], inv.invoice_type)
    }
  }

  function handlePaymentSaved(updated: Partial<Invoice> & { id: string }) {
    setInvoices(prev => prev.map(inv => inv.id === updated.id ? { ...inv, ...updated } : inv))
    if (detailInvoice?.id === updated.id) {
      setDetailInvoice(prev => prev ? { ...prev, ...updated } : prev)
    }
    setPaymentModal({ open: false, invoice: null })
  }

  const printRef = useRef<HTMLDivElement>(null)
  function handlePrint() { window.print() }

  function openEditModal(inv: Invoice) {
    setEditingInvoice(inv)
    setEditInvForm({
      client_name:    inv.client_name    ?? '',
      client_address: inv.client_address ?? '',
      client_phone:   (inv as { client_phone?: string | null }).client_phone   ?? '',
      client_email:   (inv as { client_email?: string | null }).client_email   ?? '',
      date_from:      inv.date_from      ?? '',
      date_to:        inv.date_to        ?? '',
      due_date:       inv.due_date       ?? '',
      notes:          inv.notes          ?? '',
      payment_method: (inv as { payment_method?: string | null }).payment_method ?? '',
    })
  }

  async function handleSaveEditInvoice(e: React.FormEvent) {
    e.preventDefault()
    if (!editingInvoice) return
    setSavingEdit(true)
    const { error } = await supabase.from('invoices').update({
      client_name:    editInvForm.client_name    || null,
      client_address: editInvForm.client_address || null,
      client_phone:   editInvForm.client_phone   || null,
      client_email:   editInvForm.client_email   || null,
      date_from:      editInvForm.date_from       || null,
      date_to:        editInvForm.date_to         || null,
      due_date:       editInvForm.due_date        || null,
      notes:          editInvForm.notes           || null,
      payment_method: editInvForm.payment_method  || null,
    }).eq('id', editingInvoice.id)
    if (error) { toast.error(error.message); setSavingEdit(false); return }
    toast.success('Invoice updated')
    setInvoices(prev => prev.map(i => i.id === editingInvoice.id ? { ...i, ...editInvForm } : i))
    if (detailInvoice?.id === editingInvoice.id) setDetailInvoice(prev => prev ? { ...prev, ...editInvForm } : prev)
    setEditingInvoice(null)
    setSavingEdit(false)
  }

  async function openSendModal(inv: InvoiceWithItems) {
    const typeLabel = inv.invoice_type === 'paystub' ? 'Driver Pay Stub' : inv.invoice_type === 'contractor' ? 'Subcontractor Invoice' : 'Invoice'

    let toEmail = inv.client_email ?? ''
    let toPhone = inv.client_phone ?? ''

    if (inv.invoice_type === 'contractor') {
      // For contractor invoices, match against contractors list
      let contractorList = contractors
      if (contractorList.length === 0) {
        await fetchContractors()
        const uid = await getCompanyId()
        if (uid) {
          const { data } = await supabase
            .from('contractors')
            .select('*')
            .eq('company_id', uid)
            .eq('status', 'active')
            .order('name')
          contractorList = data ?? []
          setContractors(contractorList)
        }
      }
      const matched = contractorList.find(c => c.name === inv.client_name)
      toEmail = toEmail || matched?.email || ''
      toPhone = toPhone || matched?.phone || ''
    } else {
      // Fetch client companies if not loaded yet (detail view doesn't pre-fetch them)
      let companies = clientCompanies
      if (companies.length === 0) {
        await fetchClientCompaniesForCreate()
        const uid = await getCompanyId()
        if (uid) {
          const { data } = await supabase
            .from('client_companies')
            .select('id, name, address, email, phone')
            .eq('company_id', uid)
            .order('name')
          companies = data ?? []
          setClientCompanies(companies)
        }
      }
      // Auto-match by client_name to fill email/phone from saved client companies
      const matched = companies.find(c => c.name === inv.client_name)
      toEmail = toEmail || matched?.email || ''
      toPhone = toPhone || matched?.phone || ''
    }

    const hasEmail = !!toEmail
    const hasPhone = !!toPhone
    setSendVia(hasPhone && !hasEmail ? 'sms' : hasPhone && hasEmail ? 'both' : 'email')
    setSendForm({
      toEmail,
      toPhone,
      subject: `${typeLabel} ${inv.invoice_number} from ${companyName}`,
      message: `Hi ${inv.client_name},\n\nPlease find your ${typeLabel.toLowerCase()} attached below.\n\nTotal: $${fmt(inv.total)}\n\nThank you for your business!`,
    })
    setShowSendModal(true)
  }

  async function handleSendInvoice(e: React.FormEvent) {
    e.preventDefault()
    if (!detailInvoice) return
    setSending(true)

    const sendEmail = sendVia === 'email' || sendVia === 'both'
    const sendSms   = sendVia === 'sms'   || sendVia === 'both'

    if (sendEmail) {
      const res = await fetch('/api/invoices/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: detailInvoice.id, toEmail: sendForm.toEmail, subject: sendForm.subject, message: sendForm.message, includeTicketPhotos }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to send email'); setSending(false); return }
    }

    if (sendSms && sendForm.toPhone) {
      // Open native SMS app — no backend needed, sends from the user's own phone
      const smsBody = encodeURIComponent(sendForm.message || `Hi ${detailInvoice.client_name}, please find your invoice ${detailInvoice.invoice_number} for $${fmt(detailInvoice.total)} attached. Thank you!`)
      const phone = sendForm.toPhone.replace(/\D/g, '')
      window.open(`sms:${phone}?body=${smsBody}`, '_self')
    }

    if (sendEmail || sendSms) {
      await supabase.from('invoices').update({ status: 'sent' }).eq('id', detailInvoice.id)
    }

    const sentTo = [sendEmail && sendForm.toEmail, sendSms && sendForm.toPhone].filter(Boolean).join(' & ')
    toast.success(sendSms && !sendEmail ? 'Messages app opened — tap Send to deliver invoice' : `Invoice sent to ${sentTo}`)
    setShowSendModal(false)
    setSending(false)
    setDetailInvoice(prev => prev ? { ...prev, status: 'sent' } : prev)
    setInvoices(prev => prev.map(i => i.id === detailInvoice.id ? { ...i, status: 'sent' } : i))
  }

  const recvStatusColor: Record<string, string> = {
    pending_review: 'bg-yellow-100 text-yellow-700',
    approved:       'bg-green-100 text-green-700',
    paid:           'bg-emerald-100 text-emerald-700',
    disputed:       'bg-red-100 text-red-700',
  }
  const recvOutstanding = receivedInvoices.filter(r => r.status !== 'paid').reduce((s, r) => s + (r.amount ?? 0), 0)

  // ─── LIST VIEW ────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="p-6 md:p-8 max-w-5xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
            <p className="text-gray-500 text-sm mt-0.5">Client invoices, pay stubs &amp; bills received</p>
          </div>
          {invoiceTab === 'sent' ? (
            <button onClick={() => { resetCreateForm(); setView('create') }} className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] transition-colors">
              <Plus className="h-4 w-4" /> New Invoice
            </button>
          ) : (
            <button onClick={() => setShowRecvForm(true)} className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] transition-colors">
              <Plus className="h-4 w-4" /> Add Received Invoice
            </button>
          )}
        </div>

        {/* Uninvoiced tickets banner */}
        {uninvoicedCount > 0 && invoiceTab === 'sent' && (
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">
                {uninvoicedCount} ticket{uninvoicedCount !== 1 ? 's' : ''} ready to invoice
              </span>
            </div>
            {canUse(companyPlan, 'auto_invoicing') ? (
              <button
                onClick={handleGenerateFromTickets}
                disabled={generatingInvoice}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
              >
                {generatingInvoice ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Generate Invoice
              </button>
            ) : (
              <a href="/dashboard/settings#billing" className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors">
                <Lock className="h-3 w-3" /> Fleet Plan →
              </a>
            )}
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
          {(['sent', 'received'] as const).map(t => (
            <button key={t} onClick={() => setInvoiceTab(t)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${invoiceTab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t === 'sent' ? 'Invoices Sent' : (
                <span className="flex items-center gap-1.5">
                  Invoices Received
                  {recvOutstanding > 0 && <span className="text-[10px] bg-orange-500 text-white rounded-full px-1.5 py-0.5 font-bold">${(recvOutstanding / 1000).toFixed(0)}k</span>}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Received Invoices ────────────────────────────────────────── */}
        {invoiceTab === 'received' && (
          <div>
            {recvOutstanding > 0 && (
              <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl px-5 py-3 mb-4">
                <span className="text-sm font-medium text-orange-800">Outstanding to subcontractors</span>
                <span className="text-lg font-bold text-orange-700">${recvOutstanding.toLocaleString()}</span>
              </div>
            )}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[var(--brand-primary)]" /></div>
              ) : receivedInvoices.length === 0 ? (
                <div className="text-center py-16">
                  <Receipt className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-400">No received invoices yet</p>
                  <button onClick={() => setShowRecvForm(true)} className="mt-3 text-sm text-[var(--brand-primary)]">Add first received invoice →</button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[380px] sm:min-w-[700px] text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Subcontractor</th>
                        <th className="hidden sm:table-cell text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Their Invoice #</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                        <th className="hidden sm:table-cell text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date Received</th>
                        <th className="hidden sm:table-cell text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Work Period</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Doc</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {receivedInvoices.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-medium text-gray-900">{r.subcontractor_name}</td>
                          <td className="hidden sm:table-cell px-4 py-3 font-mono text-xs text-gray-500">{r.their_invoice_number || '—'}</td>
                          <td className="px-4 py-3 font-semibold text-gray-900">${fmt(r.amount)}</td>
                          <td className="hidden sm:table-cell px-4 py-3 text-gray-500 text-xs">{r.date_received ? fmtDate(r.date_received) : '—'}</td>
                          <td className="hidden sm:table-cell px-4 py-3 text-gray-500 text-xs">
                            {r.work_start_date ? `${fmtDate(r.work_start_date)} – ${fmtDate(r.work_end_date)}` : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={r.status}
                              onChange={e => updateReceivedStatus(r.id, e.target.value as ReceivedInvoice['status'])}
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 cursor-pointer focus:outline-none ${recvStatusColor[r.status] ?? 'bg-gray-100 text-gray-600'}`}
                            >
                              <option value="pending_review">Pending Review</option>
                              <option value="approved">Approved</option>
                              <option value="paid">Paid</option>
                              <option value="disputed">Disputed</option>
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            {r.file_url ? (
                              r.file_url.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                                <a href={r.file_url} target="_blank" rel="noopener noreferrer">
                                  <img src={r.file_url} alt="attachment" className="h-8 w-8 object-cover rounded border border-gray-200 hover:opacity-80 transition-opacity" />
                                </a>
                              ) : (
                                <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-8 w-8 rounded border border-gray-200 bg-red-50 hover:bg-red-100 transition-colors" title="View PDF">
                                  <FileText className="h-4 w-4 text-red-500" />
                                </a>
                              )
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400">{r.notes ? r.notes.slice(0, 40) : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Add Received Invoice Modal ────────────────────────────── */}
        {showRecvForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
                <h2 className="font-bold text-gray-900">Add Received Invoice</h2>
                <button onClick={() => setShowRecvForm(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
              </div>
              <form onSubmit={handleSaveReceived} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Subcontractor Name *</label>
                  <input required value={recvForm.subcontractor_name} onChange={e => setRecvForm(p => ({ ...p, subcontractor_name: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" placeholder="ABC Trucking LLC" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Their Invoice #</label>
                    <input value={recvForm.their_invoice_number} onChange={e => setRecvForm(p => ({ ...p, their_invoice_number: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" placeholder="INV-0042" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Amount Billed ($) *</label>
                    <input required type="number" min="0" step="0.01" value={recvForm.amount} onChange={e => setRecvForm(p => ({ ...p, amount: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" placeholder="2500.00" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date Received</label>
                  <input type="date" value={recvForm.date_received} onChange={e => setRecvForm(p => ({ ...p, date_received: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Work Period From</label>
                    <input type="date" value={recvForm.work_start_date} onChange={e => setRecvForm(p => ({ ...p, work_start_date: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Work Period To</label>
                    <input type="date" value={recvForm.work_end_date} onChange={e => setRecvForm(p => ({ ...p, work_end_date: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                  <textarea value={recvForm.notes} onChange={e => setRecvForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] resize-none" placeholder="Optional notes..." />
                </div>

                {/* ── File / Photo Upload ── */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Invoice Document / Photo</label>
                  {recvFilePreview ? (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200">
                      {recvFile?.type === 'application/pdf' ? (
                        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50">
                          <FileText className="h-8 w-8 text-red-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{recvFile.name}</p>
                            <p className="text-xs text-gray-400">{(recvFile.size / 1024).toFixed(0)} KB</p>
                          </div>
                        </div>
                      ) : (
                        <img src={recvFilePreview} alt="Preview" className="w-full max-h-48 object-contain bg-gray-50" />
                      )}
                      <button
                        type="button"
                        onClick={() => { setRecvFile(null); setRecvFilePreview(null); if (recvFileRef.current) recvFileRef.current.value = '' }}
                        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => recvFileRef.current?.click()}
                      className="w-full rounded-xl border-2 border-dashed border-gray-200 bg-white hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 transition-all py-5 flex flex-col items-center gap-2"
                    >
                      <Upload className="h-5 w-5 text-gray-400" />
                      <p className="text-sm font-medium text-gray-500">Tap to upload or take photo</p>
                      <p className="text-xs text-gray-400">JPG, PNG, or PDF · max 10MB</p>
                    </button>
                  )}
                  <input
                    ref={recvFileRef}
                    type="file"
                    accept="image/*,.pdf"
                   
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (file.size > 10 * 1024 * 1024) { toast.error('File must be under 10MB'); return }
                      setRecvFile(file)
                      setRecvFilePreview(file.type === 'application/pdf' ? 'pdf' : URL.createObjectURL(file))
                    }}
                  />
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => { setShowRecvForm(false); setRecvFile(null); setRecvFilePreview(null) }} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={savingRecv} className="flex-1 h-10 rounded-xl bg-[var(--brand-primary)] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[var(--brand-primary-hover)] disabled:opacity-60">
                    {savingRecv && <Loader2 className="h-4 w-4 animate-spin" />}
                    {savingRecv ? 'Saving…' : 'Add Invoice'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Sent Invoices (original table) ───────────────────────── */}
        {invoiceTab === 'sent' && <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">

          {/* Status filter tabs */}
          {!loading && invoices.length > 0 && (
            <div className="px-4 pt-3 pb-0 flex gap-1 flex-wrap">
              {([
                ['', 'All'],
                ['overdue', 'Overdue'],
                ['sent', 'Sent'],
                ['partially_paid', 'Partial'],
                ['overpaid', 'Overpaid'],
                ['paid', 'Paid'],
                ['draft', 'Draft'],
              ] as [string, string][]).map(([val, label]) => {
                const count = val ? invoices.filter(i => i.status === val).length : invoices.length
                const isActive = invStatusFilter === val
                return (
                  <button
                    key={val}
                    onClick={() => setInvStatusFilter(val)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      isActive ? 'bg-[var(--brand-dark)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    } ${val === 'overdue' && count > 0 && !isActive ? 'bg-red-100 text-red-700 hover:bg-red-200' : ''}`}
                  >
                    {label}
                    {count > 0 && (
                      <span className={`ml-1.5 text-[10px] ${isActive ? 'text-white/70' : val === 'overdue' && count > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* AR Aging Summary Band */}
          {!loading && totalAR > 0 && (
            <div className="mx-4 mt-4 p-4 bg-gray-50 rounded-2xl border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">AR Aging Summary</p>
                <p className="text-sm font-bold text-gray-900">${fmt(totalAR)} total outstanding</p>
              </div>
              <div className="overflow-x-auto -mx-1">
                <div className="grid grid-cols-5 gap-2 min-w-[340px] px-1">
                {([
                  { label: 'Current',    data: arAging.current,    color: 'text-green-600',  bg: 'bg-green-50' },
                  { label: '1–30 Days',  data: arAging.days30,     color: 'text-blue-600',   bg: 'bg-blue-50' },
                  { label: '31–60 Days', data: arAging.days60,     color: 'text-amber-600',  bg: 'bg-amber-50' },
                  { label: '61–90 Days', data: arAging.days90,     color: 'text-orange-600', bg: 'bg-orange-50' },
                  { label: '90+ Days',   data: arAging.days90plus, color: 'text-red-600',    bg: 'bg-red-50' },
                ] as const).map(bucket => (
                  <div key={bucket.label} className={`p-2.5 rounded-xl text-center ${bucket.bg}`}>
                    <p className={`text-sm font-black ${bucket.color}`}>${fmt(bucket.data.amount)}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-tight">{bucket.label}</p>
                    {bucket.data.count > 0 && <p className="text-xs text-gray-400">{bucket.data.count} inv</p>}
                  </div>
                ))}
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--brand-primary)]" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-16">
              <Receipt className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-400">No invoices yet</p>
              <button onClick={() => { resetCreateForm(); setView('create') }} className="mt-3 text-sm text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)]">
                Create your first invoice →
              </button>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-400">No {invStatusFilter} invoices</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[380px] sm:min-w-[600px] text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {(['Invoice #', 'Type', 'Bill To'] as const).map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                    <th className="hidden sm:table-cell text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date Range</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="hidden sm:table-cell text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Due Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredInvoices.map(inv => {
                    const overdueFlag = isOverdue(inv)
                    const daysOverdue = overdueFlag ? daysOverdueFn(inv) : 0
                    const maxReminders = 3
                    const reminderCount = inv.reminder_count ?? 0
                    return (
                    <tr key={inv.id} className={`hover:bg-gray-50/50 transition-colors ${overdueFlag ? 'border-l-4 border-l-red-400 bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3 font-mono font-medium text-gray-900">{inv.invoice_number}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${inv.invoice_type === 'paystub' ? 'bg-purple-100 text-purple-700' : inv.invoice_type === 'contractor' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                          {inv.invoice_type === 'paystub' ? 'Pay Stub' : inv.invoice_type === 'contractor' ? 'Subcontractor' : 'Client Invoice'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-medium">{inv.client_name}</td>
                      <td className="hidden sm:table-cell px-4 py-3 text-gray-500 text-xs">
                        {inv.date_from ? `${fmtDate(inv.date_from)} – ${fmtDate(inv.date_to)}` : '—'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">${fmt(inv.total)}</td>
                      <td className="hidden sm:table-cell px-4 py-3 text-xs">
                        <p className={overdueFlag ? 'text-red-600 font-medium' : 'text-gray-500'}>{fmtDate(inv.due_date)}</p>
                        {daysOverdue > 0 && (
                          <p className="text-red-500 font-semibold mt-0.5">{daysOverdue}d overdue</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <select
                            value={inv.status}
                            onChange={e => handleStatusChange(inv, e.target.value)}
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 cursor-pointer focus:outline-none ${statusColor[inv.status as keyof typeof statusColor] ?? 'bg-gray-100 text-gray-600'}`}
                          >
                            <option value="draft">Draft</option>
                            <option value="sent">Sent</option>
                            <option value="partially_paid">Partially Paid</option>
                            <option value="overpaid">Overpaid</option>
                            <option value="paid">Paid</option>
                            <option value="overdue">Overdue</option>
                          </select>
                          {(inv.status === 'partially_paid' || inv.status === 'overpaid') && (inv.amount_paid ?? 0) > 0 && (
                            <div className="w-24">
                              <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                                <span>${fmt(inv.amount_paid ?? 0)}</span>
                                <span>${fmt(inv.amount_remaining ?? 0)}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1">
                                <div
                                  className={`h-1 rounded-full ${inv.status === 'overpaid' ? 'bg-purple-400' : 'bg-orange-400'}`}
                                  style={{ width: `${Math.min(100, ((inv.amount_paid ?? 0) / inv.total) * 100)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <button onClick={() => openDetail(inv)} className="text-xs text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)] font-medium">
                            View →
                          </button>
                          <button onClick={() => openEditModal(inv)} className="p-1 text-gray-300 hover:text-[var(--brand-primary)] transition-colors" title="Edit invoice">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {overdueFlag && (
                            reminderCount >= maxReminders ? (
                              <span className="text-xs text-gray-400">Max reminders</span>
                            ) : reminderSentIds.has(inv.id) ? (
                              <span className="text-xs font-semibold text-green-700">✓ Sent</span>
                            ) : (
                              <div className="flex flex-col items-start gap-0.5">
                                <button
                                  onClick={() => sendReminder(inv)}
                                  disabled={reminderSending === inv.id}
                                  className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50 flex items-center gap-1"
                                >
                                  {reminderSending === inv.id
                                    ? <><Loader2 className="h-3 w-3 animate-spin" /> Sending…</>
                                    : 'Send Reminder'
                                  }
                                </button>
                                {inv.last_reminder_sent_at && (
                                  <span className="text-[10px] text-gray-400">
                                    Last sent {Math.round((Date.now() - new Date(inv.last_reminder_sent_at).getTime()) / 3_600_000)}h ago
                                  </span>
                                )}
                              </div>
                            )
                          )}
                          <button onClick={() => handleDeleteInvoice(inv)} className="p-1 text-gray-300 hover:text-red-500 transition-colors" title="Delete invoice">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!loading && hasMoreInvoices && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
              <span>Showing {invoices.length} of {invoiceTotalCount} invoices</span>
              <button
                onClick={loadMoreInvoices}
                disabled={loadingMoreInvoices}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {loadingMoreInvoices ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {loadingMoreInvoices ? 'Loading…' : 'Load More'}
              </button>
            </div>
          )}
        </div>} {/* end invoiceTab === 'sent' */}

      {/* Edit Invoice Modal */}
      {editingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Edit Invoice</h2>
                <p className="text-xs text-gray-400 mt-0.5">{editingInvoice.invoice_number}</p>
              </div>
              <button onClick={() => setEditingInvoice(null)} className="h-7 w-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEditInvoice} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Client / Bill To *</label>
                  <input required value={editInvForm.client_name} onChange={e => setEditInvForm(p => ({ ...p, client_name: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
                  <input value={editInvForm.client_address} onChange={e => setEditInvForm(p => ({ ...p, client_address: e.target.value }))}
                    placeholder="123 Main St, City, ST"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Client Email</label>
                  <input type="email" value={editInvForm.client_email} onChange={e => setEditInvForm(p => ({ ...p, client_email: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Client Phone</label>
                  <input type="tel" value={editInvForm.client_phone} onChange={e => setEditInvForm(p => ({ ...p, client_phone: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Period From</label>
                  <input type="date" value={editInvForm.date_from} onChange={e => setEditInvForm(p => ({ ...p, date_from: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Period To</label>
                  <input type="date" value={editInvForm.date_to} onChange={e => setEditInvForm(p => ({ ...p, date_to: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Due Date</label>
                  <input type="date" value={editInvForm.due_date} onChange={e => setEditInvForm(p => ({ ...p, due_date: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Payment Method</label>
                  <select value={editInvForm.payment_method} onChange={e => setEditInvForm(p => ({ ...p, payment_method: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] bg-white">
                    <option value="">— Select —</option>
                    {['Check','ACH / Bank Transfer','Zelle','Cash','Credit Card','Other'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                  <textarea rows={3} value={editInvForm.notes} onChange={e => setEditInvForm(p => ({ ...p, notes: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] resize-none" />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditingInvoice(null)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={savingEdit} className="flex-1 h-10 rounded-xl bg-[var(--brand-primary)] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[var(--brand-primary-hover)] disabled:opacity-60">
                  {savingEdit && <Loader2 className="h-4 w-4 animate-spin" />}
                  {savingEdit ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <RecordPaymentModal
        isOpen={paymentModal.open}
        onClose={() => setPaymentModal({ open: false, invoice: null })}
        invoice={paymentModal.invoice}
        onSave={handlePaymentSaved}
      />

      </div>
    )
  }

  // ─── CREATE VIEW ──────────────────────────────────────────────────────────
  if (view === 'create') {
    return (
      <div className="p-6 md:p-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView('list')} className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">New Invoice</h1>
            <p className="text-gray-500 text-sm mt-0.5">Create a client invoice, pay your drivers, or pay your contractors</p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="space-y-6">
          {/* Invoice Type */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">Invoice Type</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([
                { type: 'client',     label: 'Client Invoice',        desc: 'Bill a client for work completed',          locked: false },
                { type: 'paystub',    label: 'Driver Pay Stub',       desc: 'Pay your drivers for jobs completed',       locked: companyPlan === 'pro' || companyPlan === 'owner_operator' },
                { type: 'contractor', label: 'Subcontractor Invoice', desc: 'Pay a subcontractor for work completed',    locked: companyPlan === 'pro' || companyPlan === 'owner_operator' },
              ] as const).map(({ type, label, desc, locked }) => (
                <div key={type} className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (locked) { toast.error('Upgrade to Fleet to use this invoice type'); return }
                      setInvoiceType(type)
                    }}
                    className={`w-full rounded-xl border-2 px-4 py-3 text-left transition-all ${
                      locked ? 'border-gray-100 bg-gray-50 opacity-70 cursor-not-allowed' :
                      invoiceType === type ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {locked && <Lock className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                      <p className={`text-sm font-semibold ${locked ? 'text-gray-400' : invoiceType === type ? 'text-[var(--brand-primary)]' : 'text-gray-700'}`}>{label}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{locked ? 'Fleet Plan only' : desc}</p>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Bill To / Pay To */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">
              {invoiceType === 'client' ? 'Bill To' : 'Pay To'}
            </p>
            <div className="grid grid-cols-2 gap-4">
              {/* Contractor type: pick from dropdown */}
              {invoiceType === 'contractor' ? (
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Select Contractor *</label>
                  <select
                    required
                    value={selectedContractorId}
                    onChange={e => {
                      setSelectedContractorId(e.target.value)
                      const c = contractors.find(c => c.id === e.target.value)
                      if (c) setCreateForm(p => ({ ...p, client_name: c.name, client_address: c.address ?? '', client_phone: c.phone ?? '', client_email: c.email ?? '' }))
                    }}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] bg-white"
                  >
                    <option value="">— Select a contractor —</option>
                    {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              ) : (
                <>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {invoiceType === 'client' ? 'Client / Company Name *' : 'Driver Name *'}
                    </label>
                    {invoiceType === 'paystub' ? (
                      <select
                        required
                        value={createForm.client_name}
                        onChange={e => {
                          const name = e.target.value
                          setCreateForm(p => ({ ...p, client_name: name, client_address: '' }))
                          setDriverFilter(name)
                        }}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] bg-white"
                      >
                        <option value="">— Select a driver —</option>
                        {driversList.map(d => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                    ) : invoiceType === 'client' && clientNameMode === 'dropdown' ? (
                      <select
                        required
                        value={createForm.client_name}
                        onChange={e => {
                          const val = e.target.value
                          if (val === '__manual__') {
                            setClientNameMode('manual')
                            setCreateForm(p => ({ ...p, client_name: '', client_address: '' }))
                          } else {
                            const co = clientCompanies.find(c => c.name === val)
                            const termDays: Record<string, number> = { due_on_receipt: 0, net_15: 15, net_30: 30, net_45: 45, net_60: 60, '2_10_net_30': 30 }
                            const daysToAdd = termDays[co?.payment_terms ?? ''] ?? 30
                            const dueDate = localDatePlus(daysToAdd)
                            setCreateForm(p => ({ ...p, client_name: val, client_address: co?.address ?? p.client_address, client_email: co?.email ?? p.client_email, client_phone: co?.phone ?? p.client_phone, due_date: dueDate }))
                            if (co?.tax_exempt) { setTaxRate('0'); setTaxExemptDisplay(true) }
                            else { setTaxExemptDisplay(false); if (co?.default_tax_rate) setTaxRate(String(co.default_tax_rate)) }
                            if (co?.payment_terms === '2_10_net_30') setEarlyPaymentDeadline(localDatePlus(10))
                            else setEarlyPaymentDeadline('')
                          }
                        }}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] bg-white"
                      >
                        <option value="">— Select a client —</option>
                        {clientCompanies.map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                        <option value="__manual__">Other / Manual Entry…</option>
                      </select>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          required
                          value={createForm.client_name}
                          onChange={e => setCreateForm(p => ({ ...p, client_name: e.target.value }))}
                          className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                          placeholder={invoiceType === 'client' ? 'Atlas Hauling Co.' : 'Jake Morrison'}
                        />
                        {invoiceType === 'client' && clientCompanies.length > 0 && (
                          <button
                            type="button"
                            onClick={() => { setClientNameMode('dropdown'); setCreateForm(p => ({ ...p, client_name: '', client_address: '' })) }}
                            className="text-xs text-[var(--brand-primary)] hover:underline whitespace-nowrap"
                          >
                            ← Pick from list
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                    <input
                      value={createForm.client_address}
                      onChange={e => setCreateForm(p => ({ ...p, client_address: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                      placeholder="123 Main St, City, ST 00000"
                    />
                  </div>
                </>
              )}
              {/* Driver Pay Invoice — pay type selector */}
              {invoiceType === 'paystub' && (
                <div className="col-span-2 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">Pay Type</p>
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        { type: 'percentage', label: 'Percentage %', desc: 'Driver gets a % of load revenue' },
                        { type: 'hourly', label: 'Hourly', desc: 'Driver gets paid by the hour' },
                      ] as const).map(({ type, label, desc }) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setDriverPayType(type)}
                          className={`rounded-xl border-2 px-4 py-3 text-left transition-all ${driverPayType === type ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5' : 'border-gray-200 hover:border-gray-300'}`}
                        >
                          <p className={`text-sm font-semibold ${driverPayType === type ? 'text-[var(--brand-primary)]' : 'text-gray-700'}`}>{label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  {driverPayType === 'percentage' ? (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Pay Percentage *</label>
                      <div className="flex rounded-lg border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-[var(--brand-primary)]/20 focus-within:border-[var(--brand-primary)]">
                        <input
                          required type="number" min="0" max="100" step="0.1"
                          value={driverPayPct} onChange={e => setDriverPayPct(e.target.value)}
                          className="flex-1 px-3 py-2.5 text-sm focus:outline-none bg-white" placeholder="30"
                        />
                        <span className="flex items-center px-3 bg-gray-50 text-sm text-gray-500 border-l border-gray-200">%</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Driver receives this % of total job revenue</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Hourly Rate *</label>
                        <div className="flex rounded-lg border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-[var(--brand-primary)]/20 focus-within:border-[var(--brand-primary)]">
                          <span className="flex items-center px-3 bg-gray-50 text-sm text-gray-500 border-r border-gray-200">$</span>
                          <input
                            required type="number" min="0" step="0.01"
                            value={driverHourlyRate} onChange={e => setDriverHourlyRate(e.target.value)}
                            className="flex-1 px-3 py-2.5 text-sm focus:outline-none bg-white" placeholder="25.00"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Total Hours *</label>
                        <input
                          required type="number" min="0" step="0.5"
                          value={driverTotalHours} onChange={e => setDriverTotalHours(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                          placeholder="40"
                        />
                      </div>
                      <p className="col-span-2 text-xs text-gray-400 -mt-1">Total pay = hourly rate × total hours</p>
                    </div>
                  )}
                </div>
              )}
              {/* Contractor Invoice — deduction % */}
              {invoiceType === 'contractor' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Deduction %</label>
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-[var(--brand-primary)]/20 focus-within:border-[var(--brand-primary)]">
                    <input
                      type="number" min="0" max="100" step="0.1"
                      value={deductionPct} onChange={e => setDeductionPct(e.target.value)}
                      className="flex-1 px-3 py-2.5 text-sm focus:outline-none bg-white" placeholder="0"
                    />
                    <span className="flex items-center px-3 bg-gray-50 text-sm text-gray-500 border-l border-gray-200">%</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Deduction from contractor total</p>
                </div>
              )}
              <div className={invoiceType === 'client' ? 'col-span-2' : ''}>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea
                  value={createForm.notes}
                  onChange={e => setCreateForm(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] resize-none"
                  placeholder="Optional notes..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
                <select
                  value={createForm.payment_method}
                  onChange={e => setCreateForm(p => ({ ...p, payment_method: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] bg-white"
                >
                  <option value="check">Check</option>
                  <option value="ach">ACH / Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="zelle">Zelle</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
                <input
                  type="date"
                  value={createForm.due_date}
                  onChange={e => setCreateForm(p => ({ ...p, due_date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                />
              </div>
            </div>
          </div>

          {/* Job / Ticket Selection */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">
              {invoiceType === 'contractor' ? 'Select Contractor Tickets' : 'Select Jobs'}
            </p>

            {invoiceType === 'contractor' ? (
              /* ── Contractor ticket picker ── */
              !selectedContractorId ? (
                <p className="text-sm text-gray-400 text-center py-6">Select a contractor above to see their tickets</p>
              ) : contractorTickets.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No tickets found for this contractor</p>
              ) : (
                <>
                  <div className="flex gap-3 mb-3">
                    <button type="button" onClick={() => setSelectedCTIds(new Set(contractorTickets.map(t => t.id)))} className="text-xs text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)] font-medium">
                      Select all ({contractorTickets.length})
                    </button>
                    {selectedCTIds.size > 0 && (
                      <button type="button" onClick={() => setSelectedCTIds(new Set())} className="text-xs text-red-400 hover:text-red-600 font-medium">
                        Clear ({selectedCTIds.size})
                      </button>
                    )}
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {contractorTickets.map(ticket => {
                      const slips = ticket.contractor_ticket_slips ?? []
                      const totalTons = slips.reduce((s, t) => s + (t.tonnage ?? 0), 0)
                      const sel = selectedCTIds.has(ticket.id)
                      return (
                        <label key={ticket.id} className={`flex items-start gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all ${sel ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5' : 'border-gray-100 hover:border-gray-200'}`}>
                          <div className={`mt-0.5 h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${sel ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)]' : 'border-gray-300'}`}>
                            {sel && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <input type="checkbox" className="hidden" checked={sel} onChange={() => setSelectedCTIds(prev => { const n = new Set(prev); n.has(ticket.id) ? n.delete(ticket.id) : n.add(ticket.id); return n })} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-gray-900 truncate">{ticket.job_name}</p>
                              <p className="text-sm font-semibold text-gray-700 shrink-0">${fmt(ticket.rate)}<span className="text-xs font-normal text-gray-400">/{ticket.rate_type ?? 'job'}</span></p>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              {ticket.material && <span className="text-xs text-gray-500">{ticket.material}</span>}
                              <span className="text-xs text-gray-400">{fmtDate(ticket.date)}</span>
                              {slips.length > 0 && <span className="text-xs text-gray-400">{slips.length} slip{slips.length !== 1 ? 's' : ''}{totalTons > 0 ? ` · ${totalTons} tons` : ''}</span>}
                            </div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </>
              )
            ) : (
              /* ── Load / job picker ── */
              <>
                <div className="flex flex-wrap gap-3 mb-4">
                  <div className="flex gap-2">
                    <input type="date" value={createForm.date_from} onChange={e => setCreateForm(p => ({ ...p, date_from: e.target.value }))} className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20" />
                    <input type="date" value={createForm.date_to} onChange={e => setCreateForm(p => ({ ...p, date_to: e.target.value }))} className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20" />
                  </div>
                  <select value={driverFilter} onChange={e => setDriverFilter(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20">
                    <option value="">All Drivers</option>
                    {drivers.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  {unselectedApprovedLoads.length > 0 && canUse(companyPlan, 'auto_invoicing') && (
                    <button
                      type="button"
                      onClick={selectAllUninvoiced}
                      className="text-xs font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Select All Uninvoiced ({unselectedApprovedLoads.length})
                    </button>
                  )}
                  <button type="button" onClick={selectAllFiltered} className="text-xs text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)] font-medium">Select filtered ({filteredLoads.length})</button>
                  {selectedLoadIds.size > 0 && (
                    <button type="button" onClick={() => setSelectedLoadIds(new Set())} className="text-xs text-red-400 hover:text-red-600 font-medium">Clear ({selectedLoadIds.size})</button>
                  )}
                </div>
                {unselectedApprovedTotal > 0 && canUse(companyPlan, 'auto_invoicing') && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-3">
                    <span className="text-sm">⚠️</span>
                    <p className="text-xs font-medium text-amber-800 flex-1">
                      <strong>${fmt(unselectedApprovedTotal)}</strong> in approved tickets not included in this invoice.{' '}
                      <button type="button" onClick={selectAllUninvoiced} className="underline font-semibold hover:no-underline">Add all →</button>
                    </p>
                  </div>
                )}

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {filteredLoads.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">No jobs match the current filters</p>
                  ) : filteredLoads.map(load => {
                    const slips = load.load_tickets ?? []
                    const totalTons = slips.reduce((s, t) => s + (t.tonnage ?? 0), 0)
                    const selected = selectedLoadIds.has(load.id)
                    return (
                      <label key={load.id} className={`flex items-start gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all ${selected ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5' : 'border-gray-100 hover:border-gray-200'}`}>
                        <div className={`mt-0.5 h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${selected ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)]' : 'border-gray-300'}`}>
                          {selected && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <input type="checkbox" className="hidden" checked={selected} onChange={() => toggleLoad(load.id)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">{load.job_name}</p>
                            <p className="text-sm font-semibold text-gray-700 shrink-0">
                              {load.total_pay != null
                                ? `$${fmt(load.total_pay)}`
                                : `$${fmt(load.rate)}`}
                              {load.total_pay == null && <span className="text-xs font-normal text-gray-400">/{load.rate_type ?? 'job'}</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            <span className="text-xs text-gray-500">{load.driver_name}</span>
                            {load.truck_number && <span className="text-xs text-gray-400">Truck {load.truck_number}</span>}
                            <span className="text-xs text-gray-400">{fmtDate(load.date)}</span>
                            {slips.length > 0 && <span className="text-xs text-gray-400">{slips.length} ticket{slips.length !== 1 ? 's' : ''}{totalTons > 0 ? ` · ${totalTons} tons` : ''}</span>}
                            {load.generated_by_ai && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wide">🤖 AI — Verify before invoicing</span>}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>

                {/* Subcontractor tickets — only for client invoices */}
                {invoiceType === 'client' && (
                  <div className="mt-5 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Subcontractor Tickets
                        {allContractorTicketsForClient.length > 0 && (
                          <span className="ml-1.5 text-gray-400 font-normal normal-case">({allContractorTicketsForClient.length} available)</span>
                        )}
                      </p>
                      <div className="flex items-center gap-3">
                        {allContractorTicketsForClient.length > 0 && (
                          <button type="button" onClick={() => setSelectedCTIdsForClient(new Set(allContractorTicketsForClient.map(t => t.id)))} className="text-xs text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)] font-medium">Select all</button>
                        )}
                        {selectedCTIdsForClient.size > 0 && (
                          <button type="button" onClick={() => setSelectedCTIdsForClient(new Set())} className="text-xs text-red-400 hover:text-red-600 font-medium">Clear ({selectedCTIdsForClient.size})</button>
                        )}
                      </div>
                    </div>
                    {allContractorTicketsForClient.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">No subcontractor tickets available</p>
                    ) : (
                      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                        {allContractorTicketsForClient.map(ticket => {
                          const sel = selectedCTIdsForClient.has(ticket.id)
                          const contractorName = contractors.find(c => c.id === ticket.contractor_id)?.name ?? 'Subcontractor'
                          return (
                            <label key={ticket.id} className={`flex items-start gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all ${sel ? 'border-orange-400 bg-orange-50' : 'border-gray-100 hover:border-gray-200'}`}>
                              <div className={`mt-0.5 h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${sel ? 'bg-orange-400 border-orange-400' : 'border-gray-300'}`}>
                                {sel && <Check className="h-3 w-3 text-white" />}
                              </div>
                              <input type="checkbox" className="hidden" checked={sel} onChange={() => setSelectedCTIdsForClient(prev => { const n = new Set(prev); n.has(ticket.id) ? n.delete(ticket.id) : n.add(ticket.id); return n })} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{ticket.job_name || ticket.client_company || 'Ticket'}</p>
                                    <p className="text-xs text-orange-600 font-medium">{contractorName}</p>
                                  </div>
                                  <p className="text-sm font-semibold text-gray-700 shrink-0">${fmt(ticket.rate)}<span className="text-xs font-normal text-gray-400">/{ticket.rate_type ?? 'job'}</span></p>
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                  {ticket.truck_number && <span className="text-xs text-gray-400">Truck {ticket.truck_number}</span>}
                                  <span className="text-xs text-gray-400">{fmtDate(ticket.date)}</span>
                                  {ticket.material && <span className="text-xs text-gray-400">{ticket.material}</span>}
                                </div>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Line Items Preview */}
          {activeSelectionSize > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-700">Line Items Preview</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Date', 'Truck #', 'Material', 'Location', 'Ticket #', 'Time', 'Qty', 'Rate', 'Amount'].map(h => (
                        <th key={h} className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {previewItems.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmtDate(item.line_date)}</td>
                        <td className="px-3 py-2.5 font-medium text-gray-700">{item.truck_number || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-600">{item.material || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{item.driver_name || '—'}</td>
                        <td className="px-3 py-2.5 font-mono text-gray-600">{item.ticket_number || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{item.time_worked || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-600">{item.quantity != null ? item.quantity : '—'}</td>
                        <td className="px-3 py-2.5 text-gray-600">${fmt(item.rate ?? 0)}<span className="text-gray-400">/{item.rate_type ?? 'job'}</span></td>
                        <td className="px-3 py-2.5 font-semibold text-gray-900">${fmt(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-4 border-t border-gray-100 flex flex-col items-end gap-1.5">
                {/* Deduction rows (contractor) */}
                {parseFloat(deductionPct) > 0 && (() => {
                  const pct = parseFloat(deductionPct)
                  const gross = previewItems.reduce((s, i) => s + i.amount / (1 - pct / 100), 0)
                  const deductAmt = gross - subtotal
                  return (
                    <>
                      <div className="flex items-center gap-8 text-sm text-gray-500">
                        <span className="w-32 text-right">Subtotal</span>
                        <span className="w-24 text-right tabular-nums">${fmt(gross)}</span>
                      </div>
                      <div className="flex items-center gap-8 text-sm text-red-500">
                        <span className="w-32 text-right">Deduction ({deductionPct}%)</span>
                        <span className="w-24 text-right tabular-nums">−${fmt(deductAmt)}</span>
                      </div>
                    </>
                  )
                })()}
                {/* Tax row (client, Growth plan) */}
                {invoiceType === 'client' && taxRateNum > 0 && (
                  <>
                    <div className="flex items-center gap-8 text-sm text-gray-500">
                      <span className="w-32 text-right">Subtotal</span>
                      <span className="w-24 text-right tabular-nums">${fmt(subtotal)}</span>
                    </div>
                    <div className="flex items-center gap-8 text-sm text-gray-500">
                      <span className="w-32 text-right">Tax ({taxRate}%)</span>
                      <span className="w-24 text-right tabular-nums">+${fmt(taxAmountCalc)}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center gap-8 pt-1.5 border-t border-gray-100 mt-0.5">
                  <span className="w-32 text-right text-sm font-bold text-gray-900">
                    {invoiceType === 'contractor' ? 'Net Pay' : 'Total Due'}
                  </span>
                  <span className="w-24 text-right text-base font-bold text-[var(--brand-primary)] tabular-nums">${fmt(invoiceTotal)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Tax exempt badge */}
          {taxExemptDisplay && invoiceType === 'client' && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 mb-3">
              <span>🏛️</span>
              <span className="font-medium">Tax Exempt — Certificate on file for this client</span>
            </div>
          )}

          {/* Early payment discount hint */}
          {earlyPaymentDeadline && invoiceTotal > 0 && invoiceType === 'client' && (
            <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 mb-3">
              <p className="font-semibold">💡 Early Payment Discount Available</p>
              <p className="text-xs mt-0.5">Pay by {fmtDate(earlyPaymentDeadline)} to save <strong>${fmt(invoiceTotal * 0.02)}</strong> (2% discount)</p>
            </div>
          )}

          {/* Additional line items (custom charges) */}
          {invoiceType === 'client' && (
            <div className="border border-gray-200 rounded-xl overflow-hidden mb-3">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700">Additional Line Items</h3>
                <button type="button" onClick={addLineItem}
                  className="text-xs px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-700">
                  + Add Line Item
                </button>
              </div>
              {customLineItems.length > 0 && (
                <div className="p-3 space-y-2">
                  {/* Quick type presets */}
                  <div className="flex gap-2 flex-wrap pb-2 border-b border-gray-100">
                    {([
                      { type: 'equipment',     label: '🚜 Equipment Rental' },
                      { type: 'fuel_surcharge',label: '⛽ Fuel Surcharge' },
                      { type: 'demurrage',     label: '⏱️ Demurrage' },
                      { type: 'standby',       label: '🅿️ Standby Time' },
                      { type: 'material',      label: '🪨 Materials' },
                    ]).map(preset => (
                      <button key={preset.type} type="button"
                        onClick={() => setCustomLineItems(prev => [...prev, { id: crypto.randomUUID(), description: preset.label.split(' ').slice(1).join(' '), quantity: 1, unit_price: 0, amount: 0, line_type: preset.type }])}
                        className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600">
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  {/* Line item rows */}
                  <div className="space-y-2">
                    {customLineItems.map(item => (
                      <div key={item.id} className="grid grid-cols-12 gap-2 items-center p-2 bg-gray-50 rounded-xl">
                        <div className="col-span-5">
                          <input value={item.description} onChange={e => updateLineItem(item.id, 'description', e.target.value)}
                            placeholder="Description…"
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-[var(--brand-primary)]" />
                        </div>
                        <div className="col-span-2">
                          <input type="number" value={item.quantity} onChange={e => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                            placeholder="Qty"
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white text-center focus:outline-none focus:border-[var(--brand-primary)]" />
                        </div>
                        <div className="col-span-2 relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                          <input type="number" value={item.unit_price} onChange={e => updateLineItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="w-full pl-5 pr-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-[var(--brand-primary)]" />
                        </div>
                        <div className="col-span-2 text-right">
                          <span className="text-sm font-semibold text-gray-900">${fmt(item.amount)}</span>
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <button type="button" onClick={() => setCustomLineItems(prev => prev.filter(i => i.id !== item.id))}
                            className="text-gray-300 hover:text-red-500 text-lg leading-none">×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end pt-2 border-t border-gray-100">
                    <p className="text-sm font-bold text-gray-700">Line Items Total: ${fmt(customItemsTotal)}</p>
                  </div>
                </div>
              )}
              {customLineItems.length === 0 && (
                <div className="px-4 py-3 text-xs text-gray-400 text-center">Equipment rental, fuel surcharges, materials, etc.</div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={() => setView('list')} className="flex-1 rounded-lg border border-gray-200 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || activeSelectionSize === 0} className="flex-1 rounded-lg bg-[var(--brand-primary)] py-3 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Creating…' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  // ─── DETAIL VIEW ──────────────────────────────────────────────────────────
  if (view === 'detail') {
    if (detailLoading || !detailInvoice) {
      return (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--brand-primary)]" />
        </div>
      )
    }

    const inv = detailInvoice
    const lineItems = inv.invoice_line_items ?? []
    const ticketLineItems = lineItems.filter(i => !i.line_type || i.line_type === 'ticket')
    const customDetailItems = lineItems.filter(i => i.line_type && i.line_type !== 'ticket')
    const total = lineItems.reduce((s, i) => s + i.amount, 0)
    const isPaystub = inv.invoice_type === 'paystub' || inv.invoice_type === 'contractor'
    const firstDeduction = lineItems.find(i => (i.deduction_pct ?? 0) > 0)?.deduction_pct ?? 0
    const grossTotal = firstDeduction > 0
      ? lineItems.reduce((s, i) => s + i.amount / (1 - firstDeduction / 100), 0)
      : total
    const detailTaxRate   = (!isPaystub && (inv.tax_rate ?? 0) > 0) ? (inv.tax_rate ?? 0) : 0
    const detailTaxAmount = total * detailTaxRate / 100
    const detailGrandTotal = total + detailTaxAmount
    const initials = (companyName || 'MY').slice(0, 2).toUpperCase()
    const invoiceDate = new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    return (
      <>
        <style>{`
          @media print {
            .no-print { display: none !important; }
            aside { display: none !important; }
            header { display: none !important; }
            nav { display: none !important; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
            .print-doc { box-shadow: none !important; border: none !important; border-radius: 0 !important; overflow: visible !important; max-width: 100% !important; }
            .print-page { padding: 0 !important; background: white !important; overflow: visible !important; }
            .invoice-table-wrap { overflow: visible !important; }
          }
        `}</style>

        {/* Controls bar — hidden on print */}
        <div className="no-print flex flex-col sm:flex-row sm:items-center gap-3 px-4 md:px-8 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={() => { setView('list'); setDetailInvoice(null) }}
              className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <span className="font-mono font-semibold text-gray-900 text-sm">{inv.invoice_number}</span>
              <span className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[inv.status as keyof typeof statusColor]}`}>
                {inv.status.replace('_', ' ')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={inv.status}
              onChange={e => handleStatusChange(inv, e.target.value)}
              className="rounded-lg border border-gray-200 px-2 py-2 text-xs text-gray-700 bg-white focus:outline-none"
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="overpaid">Overpaid</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
            <button
              onClick={() => setShowPaymentForm(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <CreditCard className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Record </span>Payment
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
            {detailTicketPhotos.length > 0 && (
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-gray-600 no-print">
                <input
                  type="checkbox"
                  checked={includeTicketPhotos}
                  onChange={e => setIncludeTicketPhotos(e.target.checked)}
                  className="h-3.5 w-3.5 rounded accent-[var(--brand-primary)]"
                />
                Include photos
              </label>
            )}
            <InvoicePDFButton
              invoice={inv}
              company={{ name: companyName, address: companyAddress || null, phone: userPhone || null, email: userEmail || null, logo_url: companyLogoUrl }}
              ticketPhotos={detailTicketPhotos}
              includeTicketPhotos={includeTicketPhotos}
            />
            <button
              onClick={() => openSendModal(inv)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--brand-primary)] bg-[var(--brand-primary)] px-3 py-2 text-xs font-medium text-white hover:bg-[var(--brand-primary-hover)] transition-colors"
            >
              <Mail className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Send </span>Invoice
            </button>
          </div>
        </div>

        {/* Payment history — screen only */}
        {(payments.length > 0 || true) && (
          <div className="no-print px-6 md:px-8 py-4 border-b border-gray-100 bg-white">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Payment History</h3>
                {payments.length > 0 && (
                  <span className="text-xs text-gray-400">
                    Paid: ${fmt(payments.reduce((s, p) => s + p.amount, 0))} / ${fmt(inv.total)}
                  </span>
                )}
              </div>
              {payments.length === 0 ? (
                <p className="text-sm text-gray-400">No payments recorded yet.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {payments.map(p => (
                    <div key={p.id} className="flex items-start justify-between py-2 gap-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-semibold text-green-700">${fmt(p.amount)}</span>
                        <span className="text-xs text-gray-500">{fmtDate(p.payment_date)}</span>
                        {p.payment_method && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{p.payment_method}</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.payment_type === 'full' ? 'bg-green-100 text-green-700' :
                          p.payment_type === 'overpayment' ? 'bg-purple-100 text-purple-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {p.payment_type === 'full' ? 'Full' : p.payment_type === 'overpayment' ? 'Overpaid' : 'Partial'}
                        </span>
                      </div>
                      {p.notes && <span className="text-xs text-gray-400 truncate max-w-[140px]">{p.notes}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Invoice document */}
        <div className="print-page bg-gray-50 min-h-screen px-2 py-6 md:px-8 md:py-10 overflow-x-hidden" ref={printRef}>
          <div className="print-doc w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

            {/* ── TOP HEADER ── */}
            <div className="px-4 md:px-8 pt-6 pb-6 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">

                {/* Left: INVOICE label + number */}
                <div>
                  <p className="text-xs font-bold text-[var(--brand-primary)] uppercase tracking-[0.18em] mb-2">
                    {inv.invoice_type === 'paystub' ? 'Pay Stub' : inv.invoice_type === 'contractor' ? 'Payment Voucher' : 'Invoice'}
                  </p>
                  <p className="text-4xl font-extrabold text-gray-900 tracking-tight leading-none">
                    {inv.invoice_number}
                  </p>
                  {(inv.date_from || inv.date_to) && (
                    <p className="text-sm text-gray-400 mt-2">
                      Period: {fmtDate(inv.date_from)} – {fmtDate(inv.date_to)}
                    </p>
                  )}
                </div>

                {/* Right: logo + company info */}
                <div className="flex items-start gap-4">
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-900 leading-tight">{companyName || 'Your Company'}</p>
                    {companyAddress && <p className="text-xs text-gray-400 mt-0.5 whitespace-pre-line leading-snug">{companyAddress}</p>}
                    {userPhone && <p className="text-sm text-gray-500 mt-0.5">{userPhone}</p>}
                    {userEmail && <p className="text-sm text-gray-500">{userEmail}</p>}
                  </div>
                  {/* Company logo / initials */}
                  <CompanyAvatar logoUrl={companyLogoUrl} name={companyName || 'MY'} size={56} />
                </div>
              </div>
            </div>

            {/* ── BILL TO + INVOICE DETAILS ── */}
            <div className="px-4 md:px-8 py-5 grid grid-cols-1 sm:grid-cols-2 gap-6 border-b border-gray-100">

              {/* Bill To */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-2">
                  {isPaystub ? 'Pay To' : 'Bill To'}
                </p>
                <p className="text-base font-bold text-gray-900">{inv.client_name}</p>
                {inv.client_address && (
                  <p className="text-sm text-gray-500 mt-1 whitespace-pre-line leading-relaxed">{inv.client_address}</p>
                )}
                {inv.client_phone && <p className="text-sm text-gray-500 mt-0.5">{inv.client_phone}</p>}
                {inv.client_email && <p className="text-sm text-gray-500 mt-0.5">{inv.client_email}</p>}
              </div>

              {/* Invoice details — 2-col key/value */}
              <div>
                <table className="w-full text-sm">
                  <tbody>
                    {([
                      ['Invoice No',      inv.invoice_number],
                      ['Invoice Date',    invoiceDate],
                      ['Due Date',        fmtDate(inv.due_date)],
                      ...(inv.payment_terms ? [['Terms', formatPaymentTerms(inv.payment_terms)] as [string, string]] : []),
                      ...(inv.date_paid ? [['Paid On', fmtDate(inv.date_paid)] as [string, string]] : []),
                      ...(inv.payment_method ? [[
                        'Payment Method',
                        ({ check: 'Check', ach: 'ACH / Bank Transfer', cash: 'Cash', zelle: 'Zelle', other: 'Other' } as Record<string, string>)[inv.payment_method] ?? inv.payment_method,
                      ] as [string, string]] : []),
                    ] as [string, string][]).map(([label, value]) => (
                      <tr key={label} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 pr-4 text-gray-500 font-medium whitespace-nowrap w-28">{label}</td>
                        <td className={`py-2 font-semibold text-right ${label === 'Due Date' && inv.status === 'overdue' ? 'text-red-600' : label === 'Paid On' ? 'text-green-700' : 'text-gray-900'}`}>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── LINE ITEMS TABLE ── */}
            <div className="invoice-table-wrap overflow-x-auto">
              <table className="w-full min-w-[580px] text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th style={{paddingLeft:16,paddingRight:8,paddingTop:12,paddingBottom:12}} className="text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap border-b border-gray-200">Date</th>
                    <th style={{paddingLeft:8,paddingRight:8,paddingTop:12,paddingBottom:12}} className="text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap border-b border-gray-200">Truck #</th>
                    <th style={{paddingLeft:8,paddingRight:8,paddingTop:12,paddingBottom:12}} className="text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap border-b border-gray-200">Material</th>
                    <th style={{paddingLeft:8,paddingRight:8,paddingTop:12,paddingBottom:12}} className="text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap border-b border-gray-200">Location</th>
                    <th style={{paddingLeft:8,paddingRight:8,paddingTop:12,paddingBottom:12}} className="text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap border-b border-gray-200">Ticket #</th>
                    <th style={{paddingLeft:8,paddingRight:8,paddingTop:12,paddingBottom:12}} className="text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap border-b border-gray-200">Time</th>
                    <th style={{paddingLeft:8,paddingRight:8,paddingTop:12,paddingBottom:12}} className="text-right text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap border-b border-gray-200">Qty</th>
                    <th style={{paddingLeft:8,paddingRight:8,paddingTop:12,paddingBottom:12}} className="text-right text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap border-b border-gray-200">Rate</th>
                    <th style={{paddingLeft:8,paddingRight:16,paddingTop:12,paddingBottom:12}} className="text-right text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap border-b border-gray-200">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {ticketLineItems.map((item, idx) => (
                    <tr key={item.id} className={`border-b border-gray-100 ${idx % 2 === 1 ? 'bg-gray-50/60' : 'bg-white'}`}>
                      <td style={{paddingLeft:16,paddingRight:8,paddingTop:12,paddingBottom:12}} className="text-gray-600 whitespace-nowrap text-xs">{fmtDate(item.line_date)}</td>
                      <td style={{paddingLeft:8,paddingRight:8,paddingTop:12,paddingBottom:12}} className="font-semibold text-gray-800">{item.truck_number || <span className="text-gray-300 font-normal">—</span>}</td>
                      <td style={{paddingLeft:8,paddingRight:8,paddingTop:12,paddingBottom:12}} className="text-gray-600">{item.material || <span className="text-gray-300">—</span>}</td>
                      <td style={{paddingLeft:8,paddingRight:8,paddingTop:12,paddingBottom:12}} className="text-gray-700 whitespace-nowrap">{item.driver_name || <span className="text-gray-300">—</span>}</td>
                      <td style={{paddingLeft:8,paddingRight:8,paddingTop:12,paddingBottom:12}} className="font-mono text-gray-600 text-xs">{item.ticket_number || <span className="text-gray-300 font-sans">—</span>}</td>
                      <td style={{paddingLeft:8,paddingRight:8,paddingTop:12,paddingBottom:12}} className="text-gray-500 text-xs whitespace-nowrap">{item.time_worked || <span className="text-gray-300">—</span>}</td>
                      <td style={{paddingLeft:8,paddingRight:8,paddingTop:12,paddingBottom:12}} className="text-gray-700 text-right tabular-nums">{item.quantity != null ? item.quantity : <span className="text-gray-300">—</span>}</td>
                      <td style={{paddingLeft:8,paddingRight:8,paddingTop:12,paddingBottom:12}} className="text-gray-700 text-right whitespace-nowrap tabular-nums">
                        ${fmt(item.rate ?? 0)}<span className="text-xs text-gray-400">/{item.rate_type ?? 'job'}</span>
                      </td>
                      <td style={{paddingLeft:8,paddingRight:16,paddingTop:12,paddingBottom:12}} className="font-semibold text-gray-900 text-right tabular-nums whitespace-nowrap">${fmt(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── TOTALS ── */}
            <div style={{borderTop:'1px solid #f3f4f6', padding:'24px 32px 24px 24px', display:'flex', justifyContent:'flex-end'}}>
              <div style={{width:240}}>
                <div style={{display:'flex', justifyContent:'space-between', fontSize:14, color:'#6b7280', paddingBottom:10, borderBottom:'1px solid #f3f4f6'}}>
                  <span>Subtotal</span>
                  <span style={{fontVariantNumeric:'tabular-nums'}}>${fmt(grossTotal)}</span>
                </div>
                {firstDeduction > 0 && (
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:14, color:'#ef4444', padding:'10px 0', borderBottom:'1px solid #f3f4f6'}}>
                    <span>Deduction ({firstDeduction}%)</span>
                    <span>−${fmt(grossTotal - total)}</span>
                  </div>
                )}
                {detailTaxRate > 0 && (
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:14, color:'#6b7280', padding:'10px 0', borderBottom:'1px solid #f3f4f6'}}>
                    <span>Tax ({detailTaxRate}%)</span>
                    <span style={{fontVariantNumeric:'tabular-nums'}}>${fmt(detailTaxAmount)}</span>
                  </div>
                )}
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', paddingTop:14}}>
                  <span style={{fontSize:14, fontWeight:700, color:'#111827'}}>{isPaystub ? 'Net Pay' : 'Total Due'}</span>
                  <span style={{fontSize:22, fontWeight:800, color:'var(--brand-primary)', fontVariantNumeric:'tabular-nums'}}>${fmt(detailTaxRate > 0 ? detailGrandTotal : total)}</span>
                </div>
              </div>
            </div>

            {/* ── ADDITIONAL CHARGES (custom line items) ── */}
            {customDetailItems.length > 0 && (
              <div className="px-6 md:px-8 py-5 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.15em] mb-3">Additional Charges</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-semibold text-gray-500 pb-2">Description</th>
                      <th className="text-right text-xs font-semibold text-gray-500 pb-2 w-16">Qty</th>
                      <th className="text-right text-xs font-semibold text-gray-500 pb-2 w-24">Unit Price</th>
                      <th className="text-right text-xs font-semibold text-gray-500 pb-2 w-24">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customDetailItems.map(item => (
                      <tr key={item.id} className="border-b border-gray-50">
                        <td className="py-2 pr-4 text-gray-700">{item.description || '—'}</td>
                        <td className="py-2 pr-4 text-gray-600 text-right">{item.quantity ?? 1}</td>
                        <td className="py-2 pr-4 text-gray-600 text-right">${fmt(item.unit_price ?? 0)}</td>
                        <td className="py-2 font-semibold text-gray-900 text-right">${fmt(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── NOTES ── */}
            {inv.notes && (
              <div className="px-6 md:px-8 py-6 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.15em] mb-2">Notes</p>
                <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{inv.notes}</p>
              </div>
            )}

            {/* ── FOOTER ── */}
            <div className="px-6 md:px-8 py-7 bg-gray-50 border-t border-gray-100 text-center">
              {inv.invoice_type === 'contractor' ? (
                <p className="text-xs text-gray-400">
                  {inv.payment_method === 'ach'
                    ? `Payment issued to ${inv.client_name} via ACH/Bank Transfer.`
                    : inv.payment_method === 'cash'
                    ? `Cash payment issued to ${inv.client_name}.`
                    : inv.payment_method === 'zelle'
                    ? `Zelle payment sent to ${inv.client_name}.`
                    : inv.payment_method === 'other'
                    ? `Payment issued to ${inv.client_name}.`
                    : `Payment by check issued to ${inv.client_name}.`}
                </p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Thank you for your business!</p>
                  <p className="text-xs text-gray-400">
                    {inv.payment_method === 'ach'
                      ? 'Payment via ACH/Bank Transfer.'
                      : inv.payment_method === 'cash'
                      ? 'Payment accepted in cash.'
                      : inv.payment_method === 'zelle'
                      ? `Send Zelle payment to ${userPhone || userEmail || 'your company contact'}.`
                      : inv.payment_method === 'other'
                      ? 'Please contact us for payment details.'
                      : `Make checks payable to ${companyName}.`}
                  </p>
                </>
              )}
            </div>

          </div>
        </div>

        {/* Supporting Tickets — web preview */}
        {includeTicketPhotos && detailTicketPhotos.length > 0 && (
          <div className="mx-auto max-w-4xl px-6 md:px-8 py-8 border-t-2 border-[#2d6a4f] mt-6">
            <h2 className="text-lg font-bold text-[#1e3a2a] mb-1">Supporting Tickets</h2>
            <p className="text-xs text-gray-400 mb-6">Original ticket photos attached for verification</p>
            <div className="space-y-8">
              {detailTicketPhotos.map((photo, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5 mb-2">
                    <span className="text-sm font-bold text-gray-900">
                      {photo.ticketNumber ? `Ticket #${photo.ticketNumber}` : 'Ticket'}
                    </span>
                    <span className="text-sm text-gray-600">{photo.jobName}</span>
                    <span className="text-xs text-gray-400">{fmtDate(photo.date)}</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">
                    {[
                      photo.driverName ? `Driver: ${photo.driverName}` : null,
                      photo.truckNumber ? `Truck: ${photo.truckNumber}` : null,
                      photo.material ? `Material: ${photo.material}` : null,
                      photo.timeWorked || null,
                    ].filter(Boolean).join('  |  ')}
                  </p>
                  <img
                    src={photo.imageUrl}
                    alt={`Ticket ${photo.ticketNumber ?? i + 1}`}
                    className="w-full max-h-[500px] object-contain rounded-lg border border-gray-200"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Send Invoice Modal */}
        {showSendModal && (
          <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
                <h2 className="text-base font-bold text-gray-900">Send Invoice</h2>
                <button onClick={() => setShowSendModal(false)} className="h-7 w-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={handleSendInvoice} className="p-5 space-y-4">
                {/* Subcontractor dropdown for contractor invoices */}
                {detailInvoice?.invoice_type === 'contractor' && contractors.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Subcontractor</label>
                    <select
                      value={contractors.find(c => c.name === detailInvoice?.client_name || c.email === sendForm.toEmail)?.id ?? ''}
                      onChange={e => {
                        const co = contractors.find(c => c.id === e.target.value)
                        if (co) {
                          setSendForm(p => ({ ...p, toEmail: co.email ?? p.toEmail, toPhone: co.phone ?? p.toPhone }))
                          if (co.email && co.phone) setSendVia('both')
                          else if (co.phone && !co.email) setSendVia('sms')
                          else setSendVia('email')
                        }
                      }}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] bg-white"
                    >
                      <option value="">— Select a subcontractor —</option>
                      {contractors.map(c => (
                        <option key={c.id} value={c.id}>{c.name}{c.email ? ` · ${c.email}` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Client dropdown for client invoices — auto-fills email + phone */}
                {detailInvoice?.invoice_type !== 'contractor' && clientCompanies.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Client</label>
                    <select
                      value={clientCompanies.find(c => c.name === detailInvoice?.client_name || c.email === sendForm.toEmail)?.id ?? ''}
                      onChange={e => {
                        const co = clientCompanies.find(c => c.id === e.target.value)
                        if (co) {
                          setSendForm(p => ({ ...p, toEmail: co.email ?? p.toEmail, toPhone: co.phone ?? p.toPhone }))
                          if (co.email && co.phone) setSendVia('both')
                          else if (co.phone && !co.email) setSendVia('sms')
                          else setSendVia('email')
                        }
                      }}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] bg-white"
                    >
                      <option value="">— Select a client —</option>
                      {clientCompanies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}{c.email ? ` · ${c.email}` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Send via toggle */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Send Via</label>
                  <div className="flex gap-2">
                    {(['email', 'sms', 'both'] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setSendVia(mode)}
                        className={`flex-1 h-9 rounded-lg text-xs font-semibold border transition-colors ${sendVia === mode ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      >
                        {mode === 'email' ? 'Email' : mode === 'sms' ? 'Text (SMS)' : 'Both'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Email fields */}
                {(sendVia === 'email' || sendVia === 'both') && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Email To *</label>
                      <input
                        required={sendVia === 'email' || sendVia === 'both'}
                        type="email"
                        value={sendForm.toEmail}
                        onChange={e => setSendForm(p => ({ ...p, toEmail: e.target.value }))}
                        placeholder="client@example.com"
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Subject *</label>
                      <input
                        required
                        value={sendForm.subject}
                        onChange={e => setSendForm(p => ({ ...p, subject: e.target.value }))}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                      />
                    </div>
                  </>
                )}

                {/* SMS phone field */}
                {(sendVia === 'sms' || sendVia === 'both') && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number *</label>
                    <input
                      required={sendVia === 'sms' || sendVia === 'both'}
                      type="tel"
                      value={sendForm.toPhone}
                      onChange={e => setSendForm(p => ({ ...p, toPhone: e.target.value }))}
                      placeholder="+1 (555) 000-0000"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
                  <textarea
                    value={sendForm.message}
                    onChange={e => setSendForm(p => ({ ...p, message: e.target.value }))}
                    rows={4}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] resize-none"
                  />
                </div>

                {(sendVia === 'email' || sendVia === 'both') && detailTicketPhotos.length > 0 && (
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeTicketPhotos}
                      onChange={e => setIncludeTicketPhotos(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded accent-[var(--brand-primary)]"
                    />
                    <span className="text-sm text-gray-700">
                      Include ticket photos in PDF
                      <span className="block text-xs text-gray-400">Sends invoice + {detailTicketPhotos.length} photo{detailTicketPhotos.length !== 1 ? 's' : ''} as one attachment (recommended)</span>
                    </span>
                  </label>
                )}
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowSendModal(false)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={sending} className="flex-1 h-10 rounded-xl bg-[var(--brand-primary)] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[var(--brand-primary-hover)] disabled:opacity-60">
                    {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {sending ? 'Sending…' : 'Send Invoice'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Record Payment Modal */}
        {showPaymentForm && (
          <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
                <h2 className="text-base font-bold text-gray-900">Record Payment</h2>
                <button onClick={() => setShowPaymentForm(false)} className="h-7 w-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={handleRecordPayment} className="p-5 space-y-4">
                {/* Balance summary */}
                <div className="rounded-xl bg-gray-50 px-4 py-3 flex items-center justify-between text-sm">
                  <span className="text-gray-500">Invoice total</span>
                  <span className="font-semibold text-gray-900">${fmt(inv.total)}</span>
                </div>
                {payments.length > 0 && (
                  <div className="rounded-xl bg-green-50 px-4 py-3 flex items-center justify-between text-sm -mt-2">
                    <span className="text-green-700">Already paid</span>
                    <span className="font-semibold text-green-700">-${fmt(payments.reduce((s, p) => s + p.amount, 0))}</span>
                  </div>
                )}
                <div className="rounded-xl bg-blue-50 px-4 py-3 flex items-center justify-between text-sm -mt-2">
                  <span className="text-blue-700 font-medium">Remaining balance</span>
                  <span className="font-bold text-blue-700">${fmt(inv.total - payments.reduce((s, p) => s + p.amount, 0))}</span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Amount ($) *</label>
                  <input
                    required type="number" min="0.01" step="0.01"
                    value={paymentForm.amount}
                    onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))}
                    placeholder={fmt(Math.max(0, inv.total - payments.reduce((s, p) => s + p.amount, 0)))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Payment Date *</label>
                    <input
                      required type="date"
                      value={paymentForm.payment_date}
                      onChange={e => setPaymentForm(p => ({ ...p, payment_date: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Method</label>
                    <select
                      value={paymentForm.payment_method}
                      onChange={e => setPaymentForm(p => ({ ...p, payment_method: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                    >
                      {['Check', 'ACH', 'Cash', 'Zelle', 'Other'].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                  <input
                    value={paymentForm.notes}
                    onChange={e => setPaymentForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Check #1234, reference, etc."
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                  />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowPaymentForm(false)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={savingPayment} className="flex-1 h-10 rounded-xl bg-[var(--brand-primary)] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[var(--brand-primary-hover)] disabled:opacity-60">
                    {savingPayment && <Loader2 className="h-4 w-4 animate-spin" />}
                    {savingPayment ? 'Saving…' : 'Record Payment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    )
  }

  return null
}
