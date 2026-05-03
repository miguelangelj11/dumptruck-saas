'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Loader2, Receipt, ArrowLeft, Printer, Check, CreditCard, X, ChevronDown, FileText, Upload, Trash2, Mail } from 'lucide-react'
import InvoicePDFButton from '@/components/invoice-pdf-button'
import CompanyAvatar from '@/components/dashboard/company-avatar'
import { toast } from 'sonner'
import type { Invoice, InvoiceLineItem, Load, LoadTicket, Contractor, ContractorTicket, ContractorTicketSlip, Payment, ReceivedInvoice } from '@/lib/types'
import { getCompanyId } from '@/lib/get-company-id'
import { PAGE_SIZE, pageRange } from '@/lib/pagination'

type View = 'list' | 'create' | 'detail'
type InvoiceType = 'client' | 'paystub' | 'contractor'

type LoadWithTickets = Load & { load_tickets: LoadTicket[] }
type CTWithSlips = ContractorTicket & { contractor_ticket_slips: ContractorTicketSlip[] }

type InvoiceWithItems = Invoice & { invoice_line_items: InvoiceLineItem[] }

const statusColor = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-green-100 text-green-700',
  partially_paid: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
function buildMaterial(load: { material: string | null; load_type: string | null; origin: string | null; destination: string | null }): string | null {
  const mat = load.material || load.load_type || null
  const loc = [load.origin, load.destination].filter(Boolean).join(' → ')
  return [mat, loc].filter(Boolean).join(' · ') || null
}

function buildLineItems(loads: LoadWithTickets[], deductionPct: number): InvoiceLineItem[] {
  const items: InvoiceLineItem[] = []
  let order = 0

  for (const load of loads) {
    const slips = load.load_tickets ?? []
    const mat = buildMaterial(load)
    const tw  = buildTimeWorked(load)
    if (slips.length === 0) {
      const amount = load.rate
      const deducted = amount * (1 - deductionPct / 100)
      items.push({
        id: crypto.randomUUID(),
        invoice_id: '',
        line_date: load.date,
        truck_number: load.truck_number,
        driver_name: load.driver_name,
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
          driver_name: load.driver_name,
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
    }]
  }
  // Percentage pay — one line per load/slip
  const items: InvoiceLineItem[] = []
  let order = 0
  for (const load of loads) {
    const slips = load.load_tickets ?? []
    const mat = buildMaterial(load)
    const tw  = buildTimeWorked(load)
    if (slips.length === 0) {
      const gross = load.rate
      items.push({
        id: crypto.randomUUID(), invoice_id: '',
        line_date: load.date, truck_number: load.truck_number,
        driver_name: load.driver_name, material: mat,
        ticket_number: null, time_worked: tw,
        quantity: 1, rate: load.rate, rate_type: load.rate_type,
        amount: gross * (payPct / 100),
        deduction_pct: null, sort_order: order++,
        photo_url: load.image_url ?? null,
      })
    } else {
      for (const slip of slips) {
        const qty = slip.tonnage ?? 1
        const gross = load.rate_type === 'hr' ? load.rate : load.rate * qty
        items.push({
          id: crypto.randomUUID(), invoice_id: '',
          line_date: load.date, truck_number: load.truck_number,
          driver_name: load.driver_name, material: mat,
          ticket_number: slip.ticket_number, time_worked: tw,
          quantity: load.rate_type === 'hr' ? null : qty,
          rate: load.rate, rate_type: load.rate_type,
          amount: gross * (payPct / 100),
          deduction_pct: null, sort_order: order++,
          photo_url: slip.image_url ?? load.image_url ?? null,
        })
      }
    }
  }
  return items.sort((a, b) => (a.line_date ?? '') < (b.line_date ?? '') ? -1 : 1)
}

function buildContractorLineItems(tickets: CTWithSlips[], deductionPct: number): InvoiceLineItem[] {
  const items: InvoiceLineItem[] = []
  let order = 0
  for (const ticket of tickets) {
    const slips = ticket.contractor_ticket_slips ?? []
    if (slips.length === 0) {
      const base = ticket.rate
      const amount = deductionPct > 0 ? base * (1 - deductionPct / 100) : base
      items.push({
        id: crypto.randomUUID(), invoice_id: '',
        line_date: ticket.date, truck_number: null,
        driver_name: ticket.job_name, material: ticket.material,
        ticket_number: null, time_worked: ticket.hours_worked,
        quantity: 1, rate: ticket.rate, rate_type: ticket.rate_type,
        amount, deduction_pct: deductionPct > 0 ? deductionPct : null,
        sort_order: order++,
      })
    } else {
      for (const slip of slips) {
        const qty = slip.tonnage ?? 1
        const base = ticket.rate_type === 'hr' ? ticket.rate : ticket.rate * qty
        const amount = deductionPct > 0 ? base * (1 - deductionPct / 100) : base
        items.push({
          id: crypto.randomUUID(), invoice_id: '',
          line_date: ticket.date, truck_number: null,
          driver_name: ticket.job_name, material: ticket.material,
          ticket_number: null, time_worked: ticket.hours_worked,
          quantity: ticket.rate_type === 'hr' ? null : qty,
          rate: ticket.rate, rate_type: ticket.rate_type,
          amount, deduction_pct: deductionPct > 0 ? deductionPct : null,
          sort_order: order++,
        })
      }
    }
  }
  return items.sort((a, b) => (a.line_date ?? '') < (b.line_date ?? '') ? -1 : 1)
}

export default function InvoicesPage() {
  const [view, setView] = useState<View>('list')
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
  })
  const [clientCompanies, setClientCompanies] = useState<{ id: string; name: string; address: string | null }[]>([])
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
  const [saving, setSaving] = useState(false)

  // Received invoices tab
  const [invoiceTab, setInvoiceTab]             = useState<'sent' | 'received'>('sent')
  const [receivedInvoices, setReceivedInvoices] = useState<ReceivedInvoice[]>([])
  const [showRecvForm, setShowRecvForm]         = useState(false)
  const [savingRecv, setSavingRecv]             = useState(false)
  const [recvForm, setRecvForm] = useState({
    subcontractor_name: '',
    their_invoice_number: '',
    amount: '',
    date_received: new Date().toISOString().split('T')[0],
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
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_date: new Date().toISOString().split('T')[0], payment_method: 'Check', notes: '' })
  const [savingPayment, setSavingPayment] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [sendForm, setSendForm] = useState({ toEmail: '', subject: '', message: '' })
  const [sending, setSending] = useState(false)
  const [detailTicketPhotos, setDetailTicketPhotos] = useState<{ ticketNumber: string | null; imageUrl: string; date: string; driverName: string | null; jobName: string }[]>([])

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
      supabase.from('companies').select('name, address, phone, logo_url').eq('id', effectiveId).maybeSingle(),
    ])

    if (invRes.error) toast.error('Failed to load invoices: ' + invRes.error.message)

    setCompanyName(coRes.data?.name ?? '')
    setCompanyAddress((coRes.data as { address?: string | null } | null)?.address ?? '')
    setUserPhone((coRes.data as { phone?: string | null } | null)?.phone ?? user.user_metadata?.phone ?? '')
    setCompanyLogoUrl((coRes.data as { logo_url?: string | null } | null)?.logo_url ?? null)

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
      .select('id, name, address')
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
      .order('date', { ascending: false })
    setContractorTickets((data ?? []) as CTWithSlips[])
    setSelectedCTIds(new Set())
  }

  useEffect(() => { fetchInvoices() }, [])

  useEffect(() => {
    if (view === 'create') {
      fetchLoadsForCreate()
      fetchContractors()
      fetchClientCompaniesForCreate()
      fetchDriversForCreate()
    }
  }, [view])

  useEffect(() => {
    if (selectedContractorId) fetchContractorTickets(selectedContractorId)
  }, [selectedContractorId])

  const drivers = [...new Set(allLoads.map(l => l.driver_name))].filter(Boolean)

  const filteredLoads = allLoads.filter(l => {
    if (driverFilter && l.driver_name !== driverFilter) return false
    if (createForm.date_from && l.date < createForm.date_from) return false
    if (createForm.date_to && l.date > createForm.date_to) return false
    return true
  })

  const selectedLoads = allLoads.filter(l => selectedLoadIds.has(l.id))
  const selectedCTs = contractorTickets.filter(t => selectedCTIds.has(t.id))

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
    : buildLineItems(selectedLoads, 0)
  const subtotal = previewItems.reduce((s, i) => s + i.amount, 0)
  const activeSelectionSize = invoiceType === 'contractor' ? selectedCTIds.size : selectedLoadIds.size

  function toggleLoad(id: string) {
    setSelectedLoadIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function selectAllFiltered() {
    setSelectedLoadIds(prev => {
      const n = new Set(prev)
      filteredLoads.forEach(l => n.add(l.id))
      return n
    })
  }

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

    // Fetch ticket photos: find loads matching the invoice date/drivers, get their load_tickets with images
    if (uid && inv.date_from && inv.date_to) {
      const driverNames = [...new Set(lineItems.map(li => li.driver_name).filter(Boolean))]
      const { data: loadsData } = await supabase
        .from('loads')
        .select('id, job_name, date, driver_name, load_tickets(ticket_number, image_url)')
        .eq('company_id', uid)
        .gte('date', inv.date_from)
        .lte('date', inv.date_to)
        .in('driver_name', driverNames.length > 0 ? driverNames : ['__none__'])

      const photos: typeof detailTicketPhotos = []
      for (const load of loadsData ?? []) {
        const slips = (load.load_tickets ?? []) as { ticket_number: string | null; image_url: string | null }[]
        for (const slip of slips) {
          if (slip.image_url) {
            photos.push({
              ticketNumber: slip.ticket_number,
              imageUrl: slip.image_url,
              date: load.date,
              driverName: load.driver_name,
              jobName: load.job_name,
            })
          }
        }
      }
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

    if (amount > remaining + 0.01) {
      toast.error(`Amount $${fmt(amount)} exceeds remaining balance $${fmt(remaining)}`)
      return
    }

    setSavingPayment(true)
    const uid = await getCompanyId()
    if (!uid) { toast.error('Not authenticated'); setSavingPayment(false); return }

    const { error } = await supabase.from('payments').insert({
      company_id: uid,
      invoice_id: detailInvoice.id,
      amount,
      payment_date: paymentForm.payment_date,
      payment_method: paymentForm.payment_method || null,
      notes: paymentForm.notes || null,
    })
    if (error) { toast.error('Failed to record payment: ' + error.message); setSavingPayment(false); return }

    const newPaidTotal = alreadyPaid + amount
    const newStatus: Invoice['status'] = newPaidTotal >= invoiceTotal - 0.01 ? 'paid' : 'partially_paid'
    await supabase.from('invoices').update({ status: newStatus }).eq('id', detailInvoice.id)
    setDetailInvoice(prev => prev ? { ...prev, status: newStatus } : prev)
    setInvoices(prev => prev.map(i => i.id === detailInvoice.id ? { ...i, status: newStatus } : i))

    // Refetch real payments list
    const { data } = await supabase
      .from('payments').select('*')
      .eq('invoice_id', detailInvoice.id)
      .order('payment_date', { ascending: false })
    setPayments(data ?? [])
    toast.success(newStatus === 'paid' ? 'Invoice fully paid!' : 'Partial payment recorded')
    setShowPaymentForm(false)
    setPaymentForm({ amount: '', payment_date: new Date().toISOString().split('T')[0], payment_method: 'Check', notes: '' })
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

    // Auto-set due_date to net 30 from today
    const due = new Date()
    due.setDate(due.getDate() + 30)
    const dueDate = due.toISOString().split('T')[0]

    const { error: invErr } = await supabase.from('invoices').insert({
      id: invoiceId,
      company_id: uid,
      invoice_number: num,
      invoice_type: invoiceType,
      client_name: createForm.client_name,
      client_address: createForm.client_address || null,
      client_phone: createForm.client_phone || null,
      client_email: createForm.client_email || null,
      total: subtotal,
      status: 'draft',
      due_date: dueDate,
      date_from: createForm.date_from || null,
      date_to: createForm.date_to || null,
      notes: createForm.notes || null,
    })

    if (invErr) { toast.error(invErr.message); setSaving(false); return }

    const lineItemsToInsert = previewItems.map(({ photo_url: _p, ...item }) => ({ ...item, invoice_id: invoiceId }))
    const { error: itemErr } = await supabase.from('invoice_line_items').insert(lineItemsToInsert)
    if (itemErr) { toast.error(itemErr.message); setSaving(false); return }

    if (invoiceType === 'contractor') {
      await supabase.from('contractor_tickets').update({ status: 'invoiced' }).in('id', [...selectedCTIds])
    } else {
      await supabase.from('loads').update({ status: 'invoiced' }).in('id', [...selectedLoadIds])
    }

    toast.success('Invoice created')
    setSaving(false)
    setView('list')
    resetCreateForm()
    fetchInvoices()
  }

  function resetCreateForm() {
    setInvoiceType('client')
    setCreateForm({ client_name: '', client_address: '', client_phone: '', client_email: '', date_from: '', date_to: '', notes: '' })
    setClientNameMode('dropdown')
    setDeductionPct('')
    setDriverPayType('percentage')
    setDriverPayPct('')
    setDriverHourlyRate('')
    setDriverTotalHours('')
    setSelectedLoadIds(new Set())
    setSelectedCTIds(new Set())
    setSelectedContractorId('')
    setContractorTickets([])
    setDriverFilter('')
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
    setRecvForm({ subcontractor_name: '', their_invoice_number: '', amount: '', date_received: new Date().toISOString().split('T')[0], work_start_date: '', work_end_date: '', notes: '' })
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

  async function updateStatus(id: string, status: Invoice['status']) {
    const { error } = await supabase.from('invoices').update({ status }).eq('id', id)
    if (error) { toast.error('Status update failed: ' + error.message); return }
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status } : inv))
    if (detailInvoice?.id === id) setDetailInvoice(prev => prev ? { ...prev, status } : prev)
  }

  const printRef = useRef<HTMLDivElement>(null)
  function handlePrint() { window.print() }

  function openSendModal(inv: InvoiceWithItems) {
    const typeLabel = inv.invoice_type === 'paystub' ? 'Driver Pay Invoice' : inv.invoice_type === 'contractor' ? 'Subcontractor Invoice' : 'Invoice'
    setSendForm({
      toEmail: inv.client_email ?? '',
      subject: `${typeLabel} ${inv.invoice_number} from ${companyName}`,
      message: `Hi ${inv.client_name},\n\nPlease find your ${typeLabel.toLowerCase()} attached below.\n\nTotal: $${fmt(inv.total)}\n\nThank you for your business!`,
    })
    setShowSendModal(true)
  }

  async function handleSendInvoice(e: React.FormEvent) {
    e.preventDefault()
    if (!detailInvoice) return
    setSending(true)
    const res = await fetch('/api/invoices/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: detailInvoice.id, toEmail: sendForm.toEmail, subject: sendForm.subject, message: sendForm.message }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Failed to send'); setSending(false); return }
    toast.success(`Invoice sent to ${sendForm.toEmail}`)
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
            <button onClick={() => { resetCreateForm(); setView('create') }} className="inline-flex items-center gap-2 rounded-lg bg-[#2d7a4f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#245f3e] transition-colors">
              <Plus className="h-4 w-4" /> New Invoice
            </button>
          ) : (
            <button onClick={() => setShowRecvForm(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#2d7a4f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#245f3e] transition-colors">
              <Plus className="h-4 w-4" /> Add Received Invoice
            </button>
          )}
        </div>

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
                <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#2d7a4f]" /></div>
              ) : receivedInvoices.length === 0 ? (
                <div className="text-center py-16">
                  <Receipt className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-400">No received invoices yet</p>
                  <button onClick={() => setShowRecvForm(true)} className="mt-3 text-sm text-[#2d7a4f]">Add first received invoice →</button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>{['Subcontractor', 'Their Invoice #', 'Amount', 'Date Received', 'Work Period', 'Status', 'Doc', ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {receivedInvoices.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-medium text-gray-900">{r.subcontractor_name}</td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.their_invoice_number || '—'}</td>
                          <td className="px-4 py-3 font-semibold text-gray-900">${fmt(r.amount)}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{r.date_received ? fmtDate(r.date_received) : '—'}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
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
                  <input required value={recvForm.subcontractor_name} onChange={e => setRecvForm(p => ({ ...p, subcontractor_name: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]" placeholder="ABC Trucking LLC" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Their Invoice #</label>
                    <input value={recvForm.their_invoice_number} onChange={e => setRecvForm(p => ({ ...p, their_invoice_number: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]" placeholder="INV-0042" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Amount Billed ($) *</label>
                    <input required type="number" min="0" step="0.01" value={recvForm.amount} onChange={e => setRecvForm(p => ({ ...p, amount: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]" placeholder="2500.00" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date Received</label>
                  <input type="date" value={recvForm.date_received} onChange={e => setRecvForm(p => ({ ...p, date_received: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Work Period From</label>
                    <input type="date" value={recvForm.work_start_date} onChange={e => setRecvForm(p => ({ ...p, work_start_date: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Work Period To</label>
                    <input type="date" value={recvForm.work_end_date} onChange={e => setRecvForm(p => ({ ...p, work_end_date: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                  <textarea value={recvForm.notes} onChange={e => setRecvForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f] resize-none" placeholder="Optional notes..." />
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
                      className="w-full rounded-xl border-2 border-dashed border-gray-200 bg-white hover:border-[#2d7a4f] hover:bg-[#2d7a4f]/5 transition-all py-5 flex flex-col items-center gap-2"
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
                    capture="environment"
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
                  <button type="submit" disabled={savingRecv} className="flex-1 h-10 rounded-xl bg-[#2d7a4f] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#245f3e] disabled:opacity-60">
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
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-[#2d7a4f]" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-16">
              <Receipt className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-400">No invoices yet</p>
              <button onClick={() => { resetCreateForm(); setView('create') }} className="mt-3 text-sm text-[#2d7a4f] hover:text-[#245f3e]">
                Create your first invoice →
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Invoice #', 'Type', 'Bill To', 'Date Range', 'Total', 'Status', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-gray-900">{inv.invoice_number}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${inv.invoice_type === 'paystub' ? 'bg-purple-100 text-purple-700' : inv.invoice_type === 'contractor' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                          {inv.invoice_type === 'paystub' ? 'Driver Pay' : inv.invoice_type === 'contractor' ? 'Subcontractor' : 'Client Invoice'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-medium">{inv.client_name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {inv.date_from ? `${fmtDate(inv.date_from)} – ${fmtDate(inv.date_to)}` : '—'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">${fmt(inv.total)}</td>
                      <td className="px-4 py-3">
                        <select
                          value={inv.status}
                          onChange={e => updateStatus(inv.id, e.target.value as Invoice['status'])}
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 cursor-pointer focus:outline-none ${statusColor[inv.status as keyof typeof statusColor]}`}
                        >
                          <option value="draft">Draft</option>
                          <option value="sent">Sent</option>
                          <option value="partially_paid">Partially Paid</option>
                          <option value="paid">Paid</option>
                          <option value="overdue">Overdue</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button onClick={() => openDetail(inv)} className="text-xs text-[#2d7a4f] hover:text-[#245f3e] font-medium">
                            View →
                          </button>
                          <button onClick={() => handleDeleteInvoice(inv)} className="p-1 text-gray-300 hover:text-red-500 transition-colors" title="Delete invoice">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
                { type: 'client', label: 'Client Invoice', desc: 'Bill a client for work completed' },
                { type: 'paystub', label: 'Driver Pay Invoice', desc: 'Pay your drivers for loads completed' },
                { type: 'contractor', label: 'Subcontractor Invoice', desc: 'Pay a subcontractor for work completed' },
              ] as const).map(({ type, label, desc }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setInvoiceType(type)}
                  className={`rounded-xl border-2 px-4 py-3 text-left transition-all ${invoiceType === type ? 'border-[#2d7a4f] bg-[#2d7a4f]/5' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <p className={`text-sm font-semibold ${invoiceType === type ? 'text-[#2d7a4f]' : 'text-gray-700'}`}>{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </button>
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
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f] bg-white"
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
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f] bg-white"
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
                            setCreateForm(p => ({ ...p, client_name: val, client_address: co?.address ?? p.client_address }))
                          }
                        }}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f] bg-white"
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
                          className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]"
                          placeholder={invoiceType === 'client' ? 'Atlas Hauling Co.' : 'Jake Morrison'}
                        />
                        {invoiceType === 'client' && clientCompanies.length > 0 && (
                          <button
                            type="button"
                            onClick={() => { setClientNameMode('dropdown'); setCreateForm(p => ({ ...p, client_name: '', client_address: '' })) }}
                            className="text-xs text-[#2d7a4f] hover:underline whitespace-nowrap"
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
                      className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]"
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
                          className={`rounded-xl border-2 px-4 py-3 text-left transition-all ${driverPayType === type ? 'border-[#2d7a4f] bg-[#2d7a4f]/5' : 'border-gray-200 hover:border-gray-300'}`}
                        >
                          <p className={`text-sm font-semibold ${driverPayType === type ? 'text-[#2d7a4f]' : 'text-gray-700'}`}>{label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  {driverPayType === 'percentage' ? (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Pay Percentage *</label>
                      <div className="flex rounded-lg border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-[#2d7a4f]/20 focus-within:border-[#2d7a4f]">
                        <input
                          required type="number" min="0" max="100" step="0.1"
                          value={driverPayPct} onChange={e => setDriverPayPct(e.target.value)}
                          className="flex-1 px-3 py-2.5 text-sm focus:outline-none bg-white" placeholder="30"
                        />
                        <span className="flex items-center px-3 bg-gray-50 text-sm text-gray-500 border-l border-gray-200">%</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Driver receives this % of total load revenue</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Hourly Rate *</label>
                        <div className="flex rounded-lg border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-[#2d7a4f]/20 focus-within:border-[#2d7a4f]">
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
                          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]"
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
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-[#2d7a4f]/20 focus-within:border-[#2d7a4f]">
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
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f] resize-none"
                  placeholder="Optional notes..."
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
                    <button type="button" onClick={() => setSelectedCTIds(new Set(contractorTickets.map(t => t.id)))} className="text-xs text-[#2d7a4f] hover:text-[#245f3e] font-medium">
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
                        <label key={ticket.id} className={`flex items-start gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all ${sel ? 'border-[#2d7a4f] bg-[#2d7a4f]/5' : 'border-gray-100 hover:border-gray-200'}`}>
                          <div className={`mt-0.5 h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${sel ? 'bg-[#2d7a4f] border-[#2d7a4f]' : 'border-gray-300'}`}>
                            {sel && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <input type="checkbox" className="hidden" checked={sel} onChange={() => setSelectedCTIds(prev => { const n = new Set(prev); n.has(ticket.id) ? n.delete(ticket.id) : n.add(ticket.id); return n })} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-gray-900 truncate">{ticket.job_name}</p>
                              <p className="text-sm font-semibold text-gray-700 shrink-0">${fmt(ticket.rate)}<span className="text-xs font-normal text-gray-400">/{ticket.rate_type ?? 'load'}</span></p>
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
                    <input type="date" value={createForm.date_from} onChange={e => setCreateForm(p => ({ ...p, date_from: e.target.value }))} className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20" />
                    <input type="date" value={createForm.date_to} onChange={e => setCreateForm(p => ({ ...p, date_to: e.target.value }))} className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20" />
                  </div>
                  <select value={driverFilter} onChange={e => setDriverFilter(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20">
                    <option value="">All Drivers</option>
                    {drivers.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <button type="button" onClick={selectAllFiltered} className="text-xs text-[#2d7a4f] hover:text-[#245f3e] font-medium">Select all ({filteredLoads.length})</button>
                  {selectedLoadIds.size > 0 && (
                    <button type="button" onClick={() => setSelectedLoadIds(new Set())} className="text-xs text-red-400 hover:text-red-600 font-medium">Clear ({selectedLoadIds.size})</button>
                  )}
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {filteredLoads.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">No jobs match the current filters</p>
                  ) : filteredLoads.map(load => {
                    const slips = load.load_tickets ?? []
                    const totalTons = slips.reduce((s, t) => s + (t.tonnage ?? 0), 0)
                    const selected = selectedLoadIds.has(load.id)
                    return (
                      <label key={load.id} className={`flex items-start gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all ${selected ? 'border-[#2d7a4f] bg-[#2d7a4f]/5' : 'border-gray-100 hover:border-gray-200'}`}>
                        <div className={`mt-0.5 h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${selected ? 'bg-[#2d7a4f] border-[#2d7a4f]' : 'border-gray-300'}`}>
                          {selected && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <input type="checkbox" className="hidden" checked={selected} onChange={() => toggleLoad(load.id)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">{load.job_name}</p>
                            <p className="text-sm font-semibold text-gray-700 shrink-0">${fmt(load.rate)}<span className="text-xs font-normal text-gray-400">/{load.rate_type ?? 'load'}</span></p>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-gray-500">{load.driver_name}</span>
                            {load.truck_number && <span className="text-xs text-gray-400">Truck {load.truck_number}</span>}
                            <span className="text-xs text-gray-400">{fmtDate(load.date)}</span>
                            {slips.length > 0 && <span className="text-xs text-gray-400">{slips.length} ticket{slips.length !== 1 ? 's' : ''}{totalTons > 0 ? ` · ${totalTons} tons` : ''}</span>}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
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
                      {['', 'Date', 'Truck #', 'Driver', 'Material / Location', 'Ticket #', 'Time', 'Qty', 'Rate', 'Amount'].map(h => (
                        <th key={h} className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {previewItems.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2.5">
                          {item.photo_url
                            ? <img src={item.photo_url} alt="ticket" className="h-8 w-8 object-cover rounded border border-gray-200" />
                            : <span className="inline-block h-8 w-8 rounded border border-dashed border-gray-200 bg-gray-50" />}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmtDate(item.line_date)}</td>
                        <td className="px-3 py-2.5 font-medium text-gray-700">{item.truck_number || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{item.driver_name}</td>
                        <td className="px-3 py-2.5 text-gray-600">{item.material || '—'}</td>
                        <td className="px-3 py-2.5 font-mono text-gray-600">{item.ticket_number || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{item.time_worked || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-600">{item.quantity != null ? item.quantity : '—'}</td>
                        <td className="px-3 py-2.5 text-gray-600">${fmt(item.rate ?? 0)}<span className="text-gray-400">/{item.rate_type ?? 'load'}</span></td>
                        <td className="px-3 py-2.5 font-semibold text-gray-900">${fmt(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-4 border-t border-gray-100 flex flex-col items-end gap-1">
                {parseFloat(deductionPct) > 0 && (
                  <div className="flex items-center gap-6 text-sm text-gray-500">
                    <span>Deduction ({deductionPct}%)</span>
                    <span>−${fmt(previewItems.reduce((s, i) => s + i.amount / (1 - parseFloat(deductionPct) / 100) * (parseFloat(deductionPct) / 100), 0))}</span>
                  </div>
                )}
                <div className="flex items-center gap-6 text-base font-bold text-gray-900">
                  <span>Total</span>
                  <span>${fmt(subtotal)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={() => setView('list')} className="flex-1 rounded-lg border border-gray-200 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || activeSelectionSize === 0} className="flex-1 rounded-lg bg-[#2d7a4f] py-3 text-sm font-semibold text-white hover:bg-[#245f3e] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
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
          <Loader2 className="h-6 w-6 animate-spin text-[#2d7a4f]" />
        </div>
      )
    }

    const inv = detailInvoice
    const lineItems = inv.invoice_line_items ?? []
    const photoByTicket = new Map(detailTicketPhotos.map(p => [p.ticketNumber, p.imageUrl]))
    const total = lineItems.reduce((s, i) => s + i.amount, 0)
    const isPaystub = inv.invoice_type === 'paystub' || inv.invoice_type === 'contractor'
    const firstDeduction = lineItems.find(i => (i.deduction_pct ?? 0) > 0)?.deduction_pct ?? 0
    const grossTotal = firstDeduction > 0
      ? lineItems.reduce((s, i) => s + i.amount / (1 - firstDeduction / 100), 0)
      : total
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
              onChange={e => updateStatus(inv.id, e.target.value as Invoice['status'])}
              className="rounded-lg border border-gray-200 px-2 py-2 text-xs text-gray-700 bg-white focus:outline-none"
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="partially_paid">Partially Paid</option>
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
            <InvoicePDFButton
              invoice={inv}
              company={{ name: companyName, address: companyAddress || null, phone: userPhone || null, logo_url: companyLogoUrl }}
              ticketPhotos={detailTicketPhotos}
            />
            <button
              onClick={() => openSendModal(inv)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#2d7a4f] bg-[#2d7a4f] px-3 py-2 text-xs font-medium text-white hover:bg-[#245f3e] transition-colors"
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
                    <div key={p.id} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-semibold text-green-700">${fmt(p.amount)}</span>
                        <span className="text-xs text-gray-500">{fmtDate(p.payment_date)}</span>
                        {p.payment_method && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{p.payment_method}</span>}
                      </div>
                      {p.notes && <span className="text-xs text-gray-400 truncate max-w-xs">{p.notes}</span>}
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
                  <p className="text-xs font-bold text-[#2d7a4f] uppercase tracking-[0.18em] mb-2">
                    {inv.invoice_type === 'paystub' ? 'Driver Pay Invoice' : inv.invoice_type === 'contractor' ? 'Subcontractor Invoice' : 'Invoice'}
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
                      ['Invoice No',   inv.invoice_number],
                      ['Invoice Date', invoiceDate],
                      ['Due Date',     fmtDate(inv.due_date)],
                    ] as [string, string][]).map(([label, value]) => (
                      <tr key={label} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 pr-4 text-gray-500 font-medium whitespace-nowrap w-28">{label}</td>
                        <td className={`py-2 font-semibold text-right ${label === 'Due Date' && inv.status === 'overdue' ? 'text-red-600' : 'text-gray-900'}`}>{value}</td>
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
                    <th style={{paddingLeft:8,paddingRight:4,paddingTop:12,paddingBottom:12}} className="text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap border-b border-gray-200"></th>
                    <th style={{paddingLeft:16,paddingRight:8,paddingTop:12,paddingBottom:12}} className="text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap border-b border-gray-200">Date</th>
                    <th style={{paddingLeft:8,paddingRight:8,paddingTop:12,paddingBottom:12}} className="text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap border-b border-gray-200">Truck #</th>
                    <th style={{paddingLeft:8,paddingRight:8,paddingTop:12,paddingBottom:12}} className="text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap border-b border-gray-200">Driver</th>
                    <th style={{paddingLeft:8,paddingRight:8,paddingTop:12,paddingBottom:12}} className="text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap border-b border-gray-200">Material / Location</th>
                    <th style={{paddingLeft:8,paddingRight:8,paddingTop:12,paddingBottom:12}} className="text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap border-b border-gray-200">Ticket #</th>
                    <th style={{paddingLeft:8,paddingRight:8,paddingTop:12,paddingBottom:12}} className="text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap border-b border-gray-200">Time</th>
                    <th style={{paddingLeft:8,paddingRight:8,paddingTop:12,paddingBottom:12}} className="text-right text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap border-b border-gray-200">Qty</th>
                    <th style={{paddingLeft:8,paddingRight:8,paddingTop:12,paddingBottom:12}} className="text-right text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap border-b border-gray-200">Rate</th>
                    <th style={{paddingLeft:8,paddingRight:16,paddingTop:12,paddingBottom:12}} className="text-right text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap border-b border-gray-200">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, idx) => {
                    const photoUrl = item.ticket_number ? photoByTicket.get(item.ticket_number) : undefined
                    return (
                    <tr key={item.id} className={`border-b border-gray-100 ${idx % 2 === 1 ? 'bg-gray-50/60' : 'bg-white'}`}>
                      <td style={{paddingLeft:8,paddingRight:4,paddingTop:8,paddingBottom:8}}>
                        {photoUrl
                          ? <img src={photoUrl} alt="ticket" style={{width:32,height:32,objectFit:'cover',borderRadius:4,border:'1px solid #e5e7eb'}} />
                          : <span style={{display:'inline-block',width:32,height:32,borderRadius:4,border:'1px dashed #e5e7eb',background:'#f9fafb'}} />}
                      </td>
                      <td style={{paddingLeft:16,paddingRight:8,paddingTop:12,paddingBottom:12}} className="text-gray-600 whitespace-nowrap text-xs">{fmtDate(item.line_date)}</td>
                      <td style={{paddingLeft:8,paddingRight:8,paddingTop:12,paddingBottom:12}} className="font-semibold text-gray-800">{item.truck_number || <span className="text-gray-300 font-normal">—</span>}</td>
                      <td style={{paddingLeft:8,paddingRight:8,paddingTop:12,paddingBottom:12}} className="text-gray-700 whitespace-nowrap">{item.driver_name}</td>
                      <td style={{paddingLeft:8,paddingRight:8,paddingTop:12,paddingBottom:12}} className="text-gray-600">{item.material || <span className="text-gray-300">—</span>}</td>
                      <td style={{paddingLeft:8,paddingRight:8,paddingTop:12,paddingBottom:12}} className="font-mono text-gray-600 text-xs">{item.ticket_number || <span className="text-gray-300 font-sans">—</span>}</td>
                      <td style={{paddingLeft:8,paddingRight:8,paddingTop:12,paddingBottom:12}} className="text-gray-500 text-xs whitespace-nowrap">{item.time_worked || <span className="text-gray-300">—</span>}</td>
                      <td style={{paddingLeft:8,paddingRight:8,paddingTop:12,paddingBottom:12}} className="text-gray-700 text-right tabular-nums">{item.quantity != null ? item.quantity : <span className="text-gray-300">—</span>}</td>
                      <td style={{paddingLeft:8,paddingRight:8,paddingTop:12,paddingBottom:12}} className="text-gray-700 text-right whitespace-nowrap tabular-nums">
                        ${fmt(item.rate ?? 0)}<span className="text-xs text-gray-400">/{item.rate_type ?? 'load'}</span>
                      </td>
                      <td style={{paddingLeft:8,paddingRight:16,paddingTop:12,paddingBottom:12}} className="font-semibold text-gray-900 text-right tabular-nums whitespace-nowrap">${fmt(item.amount)}</td>
                    </tr>
                  )})}
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
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', paddingTop:14}}>
                  <span style={{fontSize:14, fontWeight:700, color:'#111827'}}>{isPaystub ? 'Net Pay' : 'Total Due'}</span>
                  <span style={{fontSize:22, fontWeight:800, color:'#2d7a4f', fontVariantNumeric:'tabular-nums'}}>${fmt(total)}</span>
                </div>
              </div>
            </div>

            {/* ── NOTES ── */}
            {inv.notes && (
              <div className="px-6 md:px-8 py-6 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.15em] mb-2">Notes</p>
                <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{inv.notes}</p>
              </div>
            )}

            {/* ── FOOTER ── */}
            <div className="px-6 md:px-8 py-7 bg-gray-50 border-t border-gray-100 text-center">
              <p className="text-sm font-semibold text-gray-700 mb-1">Thank you for your business!</p>
              <p className="text-xs text-gray-400">
                Please make payment by the due date. For questions, contact us at {userEmail || 'your company email'}.
              </p>
            </div>

          </div>
        </div>

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
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">To *</label>
                  <input
                    required type="email"
                    value={sendForm.toEmail}
                    onChange={e => setSendForm(p => ({ ...p, toEmail: e.target.value }))}
                    placeholder="client@example.com"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Subject *</label>
                  <input
                    required
                    value={sendForm.subject}
                    onChange={e => setSendForm(p => ({ ...p, subject: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
                  <textarea
                    value={sendForm.message}
                    onChange={e => setSendForm(p => ({ ...p, message: e.target.value }))}
                    rows={5}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f] resize-none"
                  />
                </div>
                <p className="text-xs text-gray-400">Invoice details and line items will be included in the email body.</p>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowSendModal(false)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={sending} className="flex-1 h-10 rounded-xl bg-[#2d7a4f] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#245f3e] disabled:opacity-60">
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
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Payment Date *</label>
                    <input
                      required type="date"
                      value={paymentForm.payment_date}
                      onChange={e => setPaymentForm(p => ({ ...p, payment_date: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Method</label>
                    <select
                      value={paymentForm.payment_method}
                      onChange={e => setPaymentForm(p => ({ ...p, payment_method: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]"
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
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]"
                  />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowPaymentForm(false)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={savingPayment} className="flex-1 h-10 rounded-xl bg-[#2d7a4f] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#245f3e] disabled:opacity-60">
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
