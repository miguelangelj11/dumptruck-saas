'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, Loader2, FileText, Camera, X, ImageIcon, ChevronLeft, ChevronRight, Search, Filter, CheckCircle2, XCircle, DollarSign, Send, Bot, History, AlertTriangle } from 'lucide-react'
import { computeCompletenessScore, COMPLETENESS_BADGE, INVOICE_BLOCKING_FIELDS } from '@/lib/tickets/completeness'
import { logTicketAudit } from '@/lib/tickets/audit'
import { toast } from 'sonner'
import type { Load, LoadTicket, Contractor } from '@/lib/types'
import { linkTicketToDispatch, approveTicket } from '@/lib/workflows'
import { getCompanyId } from '@/lib/get-company-id'
import { PAGE_SIZE, pageRange } from '@/lib/pagination'
import Image from 'next/image'
import Link from 'next/link'
import PlanGate from '@/components/plan-gate'

const statusColor = {
  pending:  'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  disputed: 'bg-red-100 text-red-700',
  invoiced: 'bg-blue-100 text-blue-700',
  paid:     'bg-emerald-100 text-emerald-700',
}

const LOAD_TYPES = ['Asphalt', 'Dirt', 'Fill', 'Gravel', 'Millings', 'Mix', 'Rock', 'Sand', 'Other']

const TIME_OPTIONS: string[] = (() => {
  const opts: string[] = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      const ampm = h < 12 ? 'AM' : 'PM'
      const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h
      opts.push(`${h12}:${String(m).padStart(2, '0')} ${ampm}`)
    }
  }
  return opts
})()

type TicketRow = {
  id: string
  ticket_number: string
  tonnage: string
  imageFile: File | null
  imagePreview: string | null
}

// Controlled AM/PM time input — derives display state from the `value` prop string ("8:00 AM")
function TimeInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const hasPM   = /PM/i.test(value)
  const period  = hasPM ? 'PM' : 'AM'
  const timeStr = value.replace(/\s*(AM|PM)\s*/i, '').trim()
  const active  = timeStr.length > 0

  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex rounded-lg border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-[var(--brand-primary)]/20 focus-within:border-[var(--brand-primary)]">
        <input
          type="text"
          value={timeStr}
          onChange={e => onChange(e.target.value ? `${e.target.value} ${period}` : '')}
          placeholder="8:00"
          className="flex-1 px-3 py-2.5 text-sm focus:outline-none bg-white min-w-0"
        />
        <button
          type="button"
          onClick={() => onChange(timeStr ? `${timeStr} AM` : '')}
          className={`px-2.5 py-2 text-xs font-semibold border-l border-gray-200 transition-colors ${active && period === 'AM' ? 'bg-[var(--brand-primary)] text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
        >AM</button>
        <button
          type="button"
          onClick={() => onChange(timeStr ? `${timeStr} PM` : '')}
          className={`px-2.5 py-2 text-xs font-semibold border-l border-gray-200 transition-colors ${active && period === 'PM' ? 'bg-[var(--brand-primary)] text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
        >PM</button>
      </div>
    </div>
  )
}

function parseTimeToDecimal(t: string): number | null {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return null
  let h = parseInt(m[1]!, 10)
  const min = parseInt(m[2]!, 10)
  const pm = /pm/i.test(m[3]!)
  if (h === 12) h = pm ? 12 : 0
  else if (pm) h += 12
  return h + min / 60
}

function calculateHoursWorked(timeIn: string, timeOut: string): number | null {
  const start = parseTimeToDecimal(timeIn)
  const end   = parseTimeToDecimal(timeOut)
  if (start === null || end === null) return null
  let diff = end - start
  if (diff < 0) diff += 24
  return Math.round(diff * 100) / 100
}

function calculateTotalPay(rate: string, rateType: string, qty: string, timeIn: string, timeOut: string): string {
  const r = parseFloat(rate)
  if (isNaN(r) || r <= 0) return ''
  if (rateType === 'hr') {
    const hrs = calculateHoursWorked(timeIn, timeOut)
    if (hrs === null || hrs <= 0) return ''
    return (r * hrs).toFixed(2)
  }
  const q = parseFloat(qty)
  if (isNaN(q) || q <= 0) return ''
  return (r * q).toFixed(2)
}

const EMPTY_FORM = {
  job_name: '',
  client_company: '',
  load_type: '',
  origin: '',
  destination: '',
  driver_name: '',
  truck_number: '',
  date: new Date().toISOString().slice(0, 10),
  time_in: '',
  time_out: '',
  rate: '',
  rate_type: 'load',
  rate_quantity: '',
  total_pay: '',
  status: 'pending',
  notes: '',
}

function makeEmptyRow(): TicketRow {
  return { id: crypto.randomUUID(), ticket_number: '', tonnage: '', imageFile: null, imagePreview: null }
}

// ── Step 6: Audit Trail Drawer ─────────────────────────────────────────────

type AuditEvent = { id: string; action: string; changed_by_name: string | null; changed_by_type: string | null; new_values: Record<string, unknown> | null; created_at: string }

function AuditTrailDrawer({ ticketId, isOpen, onClose }: { ticketId: string | null; isOpen: boolean; onClose: () => void }) {
  const supabase = createClient()
  const [trail, setTrail] = useState<AuditEvent[]>([])

  useEffect(() => {
    if (!ticketId || !isOpen) return
    supabase.from('ticket_audit_trail').select('*').eq('load_id', ticketId).order('created_at', { ascending: false })
      .then(({ data }: { data: AuditEvent[] | null }) => setTrail((data ?? []) as AuditEvent[]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, isOpen])

  const typeIcon: Record<string, string> = { office: '💼', driver: '🚛', ai: '🤖', system: '⚙️' }
  const actionColor: Record<string, string> = {
    created: 'text-green-600', edited: 'text-blue-600',
    status_changed: 'text-purple-600', photo_added: 'text-amber-600', approved: 'text-green-700',
  }

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />}
      <div className={`fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 transform transition-transform duration-200 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900">Ticket History</h2>
            <p className="text-xs text-gray-500 mt-0.5">Full audit trail with timestamps</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="p-4 overflow-y-auto h-full pb-20">
          {trail.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">No history yet</p>
              <p className="text-gray-300 text-xs mt-1">Changes will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {trail.map(event => (
                <div key={event.id} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
                  <span className="text-lg flex-shrink-0 mt-0.5">{typeIcon[event.changed_by_type ?? ''] ?? '📝'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold capitalize ${actionColor[event.action] ?? 'text-gray-600'}`}>
                        {event.action?.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-gray-400">by {event.changed_by_name ?? 'System'}</span>
                    </div>
                    {event.new_values && (
                      <div className="text-xs text-gray-600">
                        {Object.entries(event.new_values).slice(0, 3).map(([k, v]) => (
                          <p key={k}><span className="font-medium">{k}:</span> {String(v)}</p>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{new Date(event.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default function TicketsPage() {
  const [loads, setLoads]         = useState<Load[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage]           = useState(0)
  const [hasMore, setHasMore]     = useState(true)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState<Load | null>(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [userId, setUserId]       = useState('')
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [clientCompanies, setClientCompanies] = useState<{ id: string; name: string }[]>([])
  const [driversList, setDriversList] = useState<{ id: string; name: string; primary_truck: string | null }[]>([])
  const [driverMode, setDriverMode] = useState<'dropdown' | 'manual'>('dropdown')
  const [activeJobs, setActiveJobs] = useState<{ id: string; job_name: string; rate: number | null; rate_type: string | null; material: string | null }[]>([])
  const [jobMode, setJobMode] = useState<'dropdown' | 'manual'>('dropdown')
  const [autoFilledFromJob, setAutoFilledFromJob] = useState(false)
  const [companyPlan,          setCompanyPlan]          = useState<string | null>(null)
  const [isInternal,           setIsInternal]           = useState(false)

  // Filters
  const [search, setSearch]               = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterContractor, setFilterContractor] = useState('')
  const [filterTruck, setFilterTruck]     = useState('')
  const [filterDriver, setFilterDriver]   = useState('')
  const [filterFrom, setFilterFrom]       = useState('')
  const [filterTo, setFilterTo]           = useState('')
  const [showFilters, setShowFilters]     = useState(false)

  // Multi-slip
  const [ticketRows, setTicketRows] = useState<TicketRow[]>([makeEmptyRow()])
  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  // Tabs — ?tab=missing deeplinks from dashboard alert
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<'tickets' | 'missing'>(
    searchParams.get('tab') === 'missing' ? 'missing' : 'tickets'
  )

  // Source filter
  const [sourceFilter, setSourceFilter] = useState<'all' | 'office' | 'driver' | 'ai'>('all')

  // Step 8 — Bulk select
  const [selectedTickets, setSelectedTickets] = useState<string[]>([])

  // Step 5 — Invoice block modal
  const [invoiceBlockModal, setInvoiceBlockModal] = useState<{
    open: boolean; ticketId?: string; missing?: string[]; ticket?: Load; newStatus?: string
  }>({ open: false })

  // Step 6 — Audit trail drawer
  const [auditDrawer, setAuditDrawer] = useState<string | null>(null)

  // Step 10 — AI verify sub-tab
  const [aiSubTab, setAiSubTab] = useState<'all' | 'verify'>('all')

  // Missing tickets
  type MissingDispatch = {
    id: string
    driver_name: string
    dispatch_date: string
    loads_completed: number
    job_name: string | null
    daysAgo: number
    ticketsFound: number
    missingCount: number
    expectedRevenue: number
    actualRevenue: number
    missingRevenue: number
    driverEmail: string | null
    followup_count: number
    last_followup_sent_at: string | null
  }
  const [missingDispatches, setMissingDispatches] = useState<MissingDispatch[]>([])
  const [loadingMissing, setLoadingMissing]       = useState(false)
  const [followUpSending, setFollowUpSending]     = useState<string | null>(null)

  // Lightbox
  const [viewingImages, setViewingImages] = useState<string[]>([])
  const [viewingIndex, setViewingIndex]   = useState(0)

  const supabase = createClient()

  async function getUid(): Promise<string | null> {
    if (userId) return userId
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? null
  }

  async function fetchData(uid?: string) {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)
    const orgId = await getCompanyId()
    if (!orgId) { setLoading(false); return }

    const [range0, range1] = pageRange(0)
    const [loadsRes, contractorsRes, clientCompaniesRes, countRes, driversRes, coRes] = await Promise.all([
      supabase.from('loads').select('*, load_tickets(*)').eq('company_id', orgId).order('date', { ascending: false }).range(range0, range1),
      supabase.from('contractors').select('*').eq('company_id', orgId).eq('status', 'active').order('name'),
      supabase.from('client_companies').select('id, name').eq('company_id', orgId).order('name'),
      supabase.from('loads').select('id', { count: 'exact', head: true }).eq('company_id', orgId),
      supabase.from('drivers').select('id, name, primary_truck').eq('company_id', orgId).eq('status', 'active').order('name'),
      supabase.from('companies').select('plan, is_internal').eq('id', orgId).maybeSingle(),
    ])
    if (loadsRes.error) toast.error('Failed to load tickets: ' + loadsRes.error.message)
    const loaded = loadsRes.data ?? []
    setLoads(loaded)
    setPage(0)
    setHasMore(loaded.length === PAGE_SIZE)
    setTotalCount(countRes.count ?? null)
    setContractors(contractorsRes.data ?? [])
    setClientCompanies(clientCompaniesRes.data ?? [])
    setDriversList(driversRes.data ?? [])
    const coData = coRes.data as Record<string, unknown> | null
    setCompanyPlan(coData?.plan as string | null ?? null)
    setIsInternal(!!(coData?.is_internal))
    setLoading(false)
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const nextPage = page + 1
    const [range0, range1] = pageRange(nextPage)
    const { data } = await supabase
      .from('loads')
      .select('*, load_tickets(*)')
      .eq('company_id', await getCompanyId() ?? userId)
      .order('date', { ascending: false })
      .range(range0, range1)
    const newItems = data ?? []
    setLoads(prev => [...prev, ...newItems])
    setPage(nextPage)
    setHasMore(newItems.length === PAGE_SIZE)
    setLoadingMore(false)
  }

  useEffect(() => {
    fetchData()
    if (searchParams.get('tab') === 'missing') fetchMissingTickets()
  }, [])

  // Debounce search input so the filter doesn't run on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200)
    return () => clearTimeout(t)
  }, [search])

  // Auto-calculate total_pay whenever rate, rate_type, qty, or time fields change
  useEffect(() => {
    const pay = calculateTotalPay(form.rate, form.rate_type, form.rate_quantity, form.time_in, form.time_out)
    if (pay !== '') {
      const hrs = form.rate_type === 'hr' ? calculateHoursWorked(form.time_in, form.time_out) : null
      setForm(p => ({
        ...p,
        total_pay: pay,
        ...(hrs !== null ? { rate_quantity: String(hrs) } : {}),
      }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.rate, form.rate_type, form.rate_quantity, form.time_in, form.time_out])

  const drivers = useMemo(
    () => [...new Set(loads.map(l => l.driver_name))].filter(Boolean),
    [loads],
  )
  const trucks = useMemo(
    () => [...new Set(loads.map(l => l.truck_number).filter(Boolean))] as string[],
    [loads],
  )

  const driverPendingCount = useMemo(
    () => loads.filter(l => l.source === 'driver' && l.status === 'pending').length,
    [loads],
  )
  const aiImportCount = useMemo(
    () => loads.filter(l => l.generated_by_ai).length,
    [loads],
  )

  const needsReviewCount = useMemo(
    () => loads.filter(l => l.generated_by_ai && (l as Record<string, unknown>).ai_field_confidence &&
      Object.values((l as Record<string, unknown>).ai_field_confidence as Record<string, number>).some(c => c < 0.8)
    ).length,
    [loads],
  )

  const filtered = useMemo(() => loads.filter(l => {
    if (sourceFilter === 'office' && (l.source === 'driver' || l.generated_by_ai)) return false
    if (sourceFilter === 'driver' && l.source !== 'driver') return false
    if (sourceFilter === 'ai'     && !l.generated_by_ai) return false
    if (sourceFilter === 'ai' && aiSubTab === 'verify') {
      const conf = (l as Record<string, unknown>).ai_field_confidence as Record<string, number> | null
      if (!conf || !Object.values(conf).some(c => c < 0.8)) return false
    }
    if (filterStatus && l.status !== filterStatus) return false
    if (filterContractor && l.client_company !== filterContractor) return false
    if (filterTruck && l.truck_number !== filterTruck) return false
    if (filterDriver && l.driver_name !== filterDriver) return false
    if (filterFrom && l.date < filterFrom) return false
    if (filterTo && l.date > filterTo) return false
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      const match = [l.job_name, l.driver_name, l.truck_number, l.client_company, l.load_type, l.origin, l.destination]
        .some(v => v?.toLowerCase().includes(q))
      if (!match) return false
    }
    return true
  }), [loads, sourceFilter, aiSubTab, filterStatus, filterContractor, filterTruck, filterDriver, filterFrom, filterTo, debouncedSearch])

  const allSelected = selectedTickets.length === filtered.length && filtered.length > 0

  function updateRow(id: string, updates: Partial<TicketRow>) {
    setTicketRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))
  }

  function handleTicketImageChange(rowId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB'); return }
    updateRow(rowId, { imageFile: file, imagePreview: URL.createObjectURL(file) })
  }

  async function uploadPhoto(uid: string, jobId: string, rowId: string, file: File): Promise<string | null> {
    const ext  = file.name.split('.').pop()
    const path = `${uid}/${jobId}/${rowId}.${ext}`
    const { error } = await supabase.storage.from('ticket-photos').upload(path, file, { upsert: true })
    if (error) { toast.error('Photo upload failed: ' + error.message); return null }
    return supabase.storage.from('ticket-photos').getPublicUrl(path).data.publicUrl
  }

  async function fetchActiveJobs() {
    const orgId = await getCompanyId()
    if (!orgId) return
    const { data } = await supabase
      .from('jobs')
      .select('id, job_name, rate, rate_type, material')
      .eq('company_id', orgId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    setActiveJobs((data ?? []) as typeof activeJobs)
  }

  async function openAdd() {
    setEditing(null)
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10) })
    setTicketRows([makeEmptyRow()])
    setDriverMode('dropdown')
    setJobMode('dropdown')
    setAutoFilledFromJob(false)
    await fetchActiveJobs()
    setShowForm(true)
  }

  async function openEdit(l: Load) {
    setEditing(l)
    const lAny = l as Record<string, unknown>
    setForm({
      job_name: l.job_name, client_company: l.client_company ?? '',
      load_type: l.load_type ?? '', origin: l.origin ?? '', destination: l.destination ?? '',
      driver_name: l.driver_name, truck_number: l.truck_number ?? '',
      date: l.date, time_in: l.time_in ?? '', time_out: l.time_out ?? '',
      rate: String(l.rate), rate_type: l.rate_type ?? 'load',
      rate_quantity: lAny.rate_quantity ? String(lAny.rate_quantity) : '',
      total_pay: lAny.total_pay ? String(lAny.total_pay) : '',
      status: l.status, notes: l.notes ?? '',
    })
    setTicketRows([makeEmptyRow()])
    setDriverMode(driversList.some(d => d.name === l.driver_name) ? 'dropdown' : 'manual')
    setAutoFilledFromJob(false)
    await fetchActiveJobs()
    setJobMode('dropdown')
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const uid = await getUid()
    const orgId = await getCompanyId()
    if (!uid || !orgId) { toast.error('Not authenticated'); setSaving(false); return }

    const jobRate  = parseFloat(form.rate) || 0
    const totalPay = parseFloat(form.total_pay) || null
    const rateQty  = parseFloat(form.rate_quantity) || null
    const payload = {
      job_name: form.job_name, client_company: form.client_company || null,
      load_type: form.load_type || null, origin: form.origin || null,
      destination: form.destination || null, driver_name: form.driver_name,
      truck_number: form.truck_number || null, date: form.date,
      time_in: form.time_in || null, time_out: form.time_out || null,
      rate: jobRate, rate_type: form.rate_type,
      total_pay: totalPay,
      rate_quantity: rateQty,
      status: form.status as Load['status'], notes: form.notes || null,
      company_id: orgId,
    }

    const filledRows = ticketRows.filter(r => r.tonnage || r.imageFile || r.ticket_number)

    if (editing) {
      const { error } = await supabase.from('loads').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); setSaving(false); return }
      for (const row of filledRows) {
        let image_url: string | null = null
        if (row.imageFile) image_url = await uploadPhoto(uid, editing.id, row.id, row.imageFile)
        const { error: slipErr } = await supabase.from('load_tickets').insert({
          id: row.id, load_id: editing.id, company_id: orgId,
          ticket_number: row.ticket_number || null,
          tonnage: parseFloat(row.tonnage) || null, image_url,
        })
        if (slipErr) toast.error('Slip save failed: ' + slipErr.message)
      }
      // Audit trail for edit
      await logTicketAudit(supabase, {
        companyId: orgId, loadId: editing.id,
        action: 'edited',
        userId: uid, userName: editing.driver_name ?? 'Office',
        userType: 'office',
        oldValues: { job_name: editing.job_name, driver_name: editing.driver_name, status: editing.status },
        newValues: { job_name: payload.job_name, driver_name: payload.driver_name, status: payload.status },
      })
      toast.success('Ticket updated')
    } else {
      const jobId = crypto.randomUUID()
      const { error } = await supabase.from('loads').insert({ ...payload, id: jobId })
      if (error) { toast.error(error.message); setSaving(false); return }
      for (const row of filledRows) {
        let image_url: string | null = null
        if (row.imageFile) image_url = await uploadPhoto(uid, jobId, row.id, row.imageFile)
        const { error: slipErr } = await supabase.from('load_tickets').insert({
          id: row.id, load_id: jobId, company_id: orgId,
          ticket_number: row.ticket_number || null,
          tonnage: parseFloat(row.tonnage) || null, image_url,
        })
        if (slipErr) toast.error('Slip save failed: ' + slipErr.message)
      }
      // Audit trail for create
      await logTicketAudit(supabase, {
        companyId: orgId, loadId: jobId,
        action: 'created',
        userId: uid, userName: payload.driver_name ?? 'Office',
        userType: 'office',
        newValues: { job_name: payload.job_name, driver_name: payload.driver_name, source: 'office' },
      })
      // Workflow 1: auto-link to active dispatch for this driver on this date
      const { linked } = await linkTicketToDispatch(jobId, payload.driver_name, payload.date, supabase)
      toast.success(linked ? 'Ticket added & linked to dispatch' : 'Ticket added')
    }

    setSaving(false); setShowForm(false); setTicketRows([makeEmptyRow()]); fetchData()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this ticket and all its slips?')) return
    // Delete slips first (in case no cascade is set up)
    await supabase.from('load_tickets').delete().eq('load_id', id)
    const { error } = await supabase.from('loads').delete().eq('id', id)
    if (error) { toast.error('Delete failed: ' + error.message); return }
    toast.success('Deleted')
    setLoads(prev => prev.filter(l => l.id !== id))
  }

  async function quickStatus(id: string, status: Load['status']) {
    const { error } = await supabase.from('loads').update({ status }).eq('id', id)
    if (error) { toast.error('Status update failed: ' + error.message); return }
    // Audit log
    const orgId = await getCompanyId()
    const { data: { user } } = await supabase.auth.getUser()
    if (orgId && user) {
      await logTicketAudit(supabase, {
        companyId: orgId, loadId: id,
        action: 'status_changed',
        userId: user.id, userName: user.email ?? 'Office',
        userType: 'office',
        newValues: { status },
      })
    }
    setLoads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
  }

  // Step 5 — intercept status change to 'invoiced' with completeness gate
  function handleStatusChange(ticket: Load, newStatus: string) {
    if (newStatus === 'invoiced') {
      const { missing } = computeCompletenessScore(ticket as unknown as Record<string, unknown>)
      const blockingMissing = missing.filter(f => INVOICE_BLOCKING_FIELDS.includes(f))
      if (blockingMissing.length > 0) {
        setInvoiceBlockModal({ open: true, ticketId: ticket.id, missing: blockingMissing, ticket, newStatus })
        return
      }
    }
    void quickStatus(ticket.id, newStatus as Load['status'])
  }

  // Step 8 — bulk actions
  async function bulkUpdateStatus(status: string) {
    const orgId = await getCompanyId()
    if (!orgId) return
    const { error } = await supabase.from('loads').update({ status }).in('id', selectedTickets).eq('company_id', orgId)
    if (error) { toast.error(error.message); return }
    setLoads(prev => prev.map(l => selectedTickets.includes(l.id) ? { ...l, status: status as Load['status'] } : l))
    toast.success(`Updated ${selectedTickets.length} tickets`)
    setSelectedTickets([])
  }

  function handleBulkExport() {
    const tickets = filtered.filter(t => selectedTickets.includes(t.id))
    const csv = [
      ['Date', 'Job', 'Driver', 'Truck', 'Material', 'Total Pay', 'Status'].join(','),
      ...tickets.map(t => [t.date, t.job_name, t.driver_name, t.truck_number, t.material, t.total_pay ?? t.rate, t.status].map(v => `"${v ?? ''}"`).join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tickets-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selectedTickets.length} tickets? This cannot be undone.`)) return
    const orgId = await getCompanyId()
    if (!orgId) return
    const { error } = await supabase.from('loads').delete().in('id', selectedTickets).eq('company_id', orgId)
    if (error) { toast.error(error.message); return }
    setLoads(prev => prev.filter(l => !selectedTickets.includes(l.id)))
    toast.success(`Deleted ${selectedTickets.length} tickets`)
    setSelectedTickets([])
  }

  async function fetchMissingTickets() {
    setLoadingMissing(true)
    const companyId = await getCompanyId()
    if (!companyId) { setLoadingMissing(false); return }
    const todayStr = new Date().toISOString().split('T')[0]!

    const [dispRes, driversRes] = await Promise.all([
      supabase
        .from('dispatches')
        .select('id, driver_name, dispatch_date, loads_completed, job_id, followup_count, last_followup_sent_at, jobs(job_name, rate, rate_type)')
        .eq('company_id', companyId)
        .lt('dispatch_date', todayStr)
        .neq('status', 'completed')
        .order('dispatch_date', { ascending: false })
        .limit(50),
      supabase
        .from('drivers')
        .select('name, email')
        .eq('company_id', companyId),
    ])

    if (dispRes.error && !dispRes.error.message.includes('schema cache')) {
      setLoadingMissing(false); return
    }

    const driverEmailMap = new Map<string, string | null>(
      (driversRes.data ?? []).map((d: { name: string; email: string | null }) => [d.name, d.email ?? null])
    )

    const now = new Date()
    const results: MissingDispatch[] = (dispRes.data ?? []).map((d: {
      id: string; driver_name: string; dispatch_date: string; loads_completed: number
      followup_count?: number | null; last_followup_sent_at?: string | null
      jobs?: { job_name?: string; rate?: number | null; rate_type?: string | null } | null
    }) => {
      const matchedLoads  = loads.filter(l => l.driver_name === d.driver_name && l.date === d.dispatch_date)
      const ticketsFound  = matchedLoads.length
      const missingCount  = Math.max(0, d.loads_completed - ticketsFound)
      const dispDate      = new Date(d.dispatch_date + 'T00:00:00')
      const daysAgo       = Math.floor((now.getTime() - dispDate.getTime()) / (1000 * 60 * 60 * 24))
      const job           = d.jobs as { job_name?: string; rate?: number | null; rate_type?: string | null } | null
      const rate          = job?.rate ?? 0
      const rateType      = job?.rate_type ?? 'load'
      const expectedRevenue = rateType === 'load' ? d.loads_completed * rate : 0
      const actualRevenue   = matchedLoads.reduce((s, l) => s + (l.rate ?? 0), 0)
      const missingRevenue  = Math.max(0, expectedRevenue - actualRevenue)
      return {
        id: d.id,
        driver_name: d.driver_name,
        dispatch_date: d.dispatch_date,
        loads_completed: d.loads_completed,
        job_name: job?.job_name ?? null,
        daysAgo,
        ticketsFound,
        missingCount,
        expectedRevenue,
        actualRevenue,
        missingRevenue,
        driverEmail: driverEmailMap.get(d.driver_name) ?? null,
        followup_count: d.followup_count ?? 0,
        last_followup_sent_at: d.last_followup_sent_at ?? null,
      }
    }).filter((d: MissingDispatch) => d.missingCount > 0 || d.ticketsFound === 0)

    setMissingDispatches(results)
    setLoadingMissing(false)
  }

  async function markNoWork(dispatchId: string) {
    await supabase.from('dispatches').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', dispatchId)
    setMissingDispatches(prev => prev.filter(d => d.id !== dispatchId))
    toast.success('Marked as no work done')
  }

  async function sendFollowUp(d: MissingDispatch) {
    if (!d.driverEmail) { toast.error(`No email on file for ${d.driver_name}`); return }
    setFollowUpSending(d.id)
    try {
      const res  = await fetch(`/api/dispatches/${d.id}/follow-up`, { method: 'POST' })
      const json = await res.json() as { sent?: boolean; error?: string; followup_count?: number; last_followup_sent_at?: string }
      if (json.sent) {
        toast.success(`Reminder sent to ${d.driver_name}`)
        // Update local state so button reflects new count immediately
        setMissingDispatches(prev => prev.map(x =>
          x.id === d.id
            ? { ...x, followup_count: json.followup_count ?? x.followup_count + 1, last_followup_sent_at: json.last_followup_sent_at ?? new Date().toISOString() }
            : x
        ))
      } else {
        toast.error(json.error ?? 'Could not send reminder')
      }
    } finally {
      setFollowUpSending(null)
    }
  }

  async function handleApprove(l: Load) {
    const orgId = await getCompanyId()
    if (!orgId) return
    const { error } = await approveTicket({ id: l.id, job_name: l.job_name, driver_name: l.driver_name }, orgId, supabase)
    if (error) { toast.error('Approval failed: ' + error); return }
    setLoads(prev => prev.map(t => t.id === l.id ? { ...t, status: 'approved' } : t))
    toast.success(`Approved: ${l.job_name} — ${l.driver_name}`, { description: 'Ready to invoice' })
  }

  async function handleReject(l: Load) {
    if (!confirm(`Reject this ticket from ${l.driver_name}? Status will be set to Disputed.`)) return
    const { error } = await supabase.from('loads').update({ status: 'disputed' }).eq('id', l.id)
    if (error) { toast.error('Failed to reject ticket'); return }
    setLoads(prev => prev.map(t => t.id === l.id ? { ...t, status: 'disputed' } : t))
    toast.success('Ticket rejected')
  }

  function getPhotos(l: Load): string[] {
    const slipPhotos = (l.load_tickets ?? []).map(t => t.image_url).filter(Boolean) as string[]
    return slipPhotos.length > 0 ? slipPhotos : (l.image_url ? [l.image_url] : [])
  }

  const activeFilters = useMemo(
    () => [filterStatus, filterContractor, filterTruck, filterDriver, filterFrom, filterTo].filter(Boolean).length,
    [filterStatus, filterContractor, filterTruck, filterDriver, filterFrom, filterTo],
  )

  return (
    <div className="p-6 md:p-8 max-w-screen-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
          <p className="text-gray-500 text-sm mt-0.5">{loads.length} total · {filtered.length} shown</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/tickets/import" className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            <Bot className="h-4 w-4" /> Import from Document
          </Link>
          <Link href="/dashboard/tickets/new" className="inline-flex items-center gap-2 rounded-lg border border-[var(--brand-primary)] px-3 py-2 text-sm font-medium text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 transition-colors">
            <Camera className="h-4 w-4" /> Quick Entry
          </Link>
          <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] transition-colors">
            <Plus className="h-4 w-4" /> Add Ticket
          </button>
        </div>
      </div>

      {/* Source filter tabs */}
      <div className="flex gap-1 mb-3 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => setSourceFilter('all')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${sourceFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          All Tickets
        </button>
        <button onClick={() => setSourceFilter('office')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${sourceFilter === 'office' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          Office Entered
        </button>
        <button onClick={() => setSourceFilter('driver')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${sourceFilter === 'driver' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          Driver Submitted
          {driverPendingCount > 0 && (
            <span className="h-4 min-w-[1rem] px-1 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">{driverPendingCount}</span>
          )}
        </button>
        <button onClick={() => setSourceFilter('ai')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${sourceFilter === 'ai' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          AI Imported
          {aiImportCount > 0 && (
            <span className="h-4 min-w-[1rem] px-1 rounded-full bg-violet-500 text-white text-[10px] flex items-center justify-center font-bold">{aiImportCount}</span>
          )}
        </button>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => setActiveTab('tickets')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'tickets' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          Tickets
        </button>
        <button onClick={() => { setActiveTab('missing'); if (missingDispatches.length === 0) fetchMissingTickets() }} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${activeTab === 'missing' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          Missing
          {missingDispatches.length > 0 && <span className="h-4 w-4 rounded-full bg-orange-500 text-white text-[10px] flex items-center justify-center font-bold">{missingDispatches.length}</span>}
        </button>
      </div>

      {/* Missing Tickets Tab */}
      {activeTab === 'missing' && (
        <PlanGate plan={companyPlan} feature="missing_money">
        <div>
          {loadingMissing ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[var(--brand-primary)]" /></div>
          ) : missingDispatches.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
              <CheckCircle2 className="h-10 w-10 text-green-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-400">No missing tickets</p>
              <p className="text-xs text-gray-400 mt-1">All dispatched drivers have submitted tickets</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-sm text-gray-900">Dispatches Without Tickets</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Past dispatches where no tickets were submitted</p>
                </div>
                <button onClick={fetchMissingTickets} className="text-xs text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)] font-medium">Refresh</button>
              </div>
              <div className="divide-y divide-gray-50">
                {missingDispatches.map(d => (
                  <div key={d.id} className="px-5 py-4 hover:bg-gray-50/50">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm shrink-0">
                        {d.driver_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <p className="font-semibold text-gray-900">{d.driver_name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {d.job_name ?? 'No job assigned'} · {new Date(d.dispatch_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                              {' · '}<span className="text-orange-500 font-medium">{d.daysAgo} day{d.daysAgo !== 1 ? 's' : ''} ago</span>
                            </p>
                          </div>
                          {d.missingRevenue > 0 && (
                            <div className="flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1 shrink-0">
                              <DollarSign className="h-3.5 w-3.5 text-red-500" />
                              <span className="text-sm font-bold text-red-600">${d.missingRevenue.toLocaleString()}</span>
                              <span className="text-xs text-red-400">at risk</span>
                            </div>
                          )}
                        </div>

                        {/* Expected vs submitted progress */}
                        <div className="mt-2.5 flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-gray-400 uppercase tracking-wider">Tickets submitted</span>
                              <span className="text-xs font-semibold text-gray-700">{d.ticketsFound} / {d.loads_completed}</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-orange-400"
                                style={{ width: `${d.loads_completed > 0 ? (d.ticketsFound / d.loads_completed) * 100 : 0}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-xs font-bold text-red-600 whitespace-nowrap shrink-0">
                            {d.missingCount} missing
                          </span>
                        </div>

                        {/* Follow-up status + action */}
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          {d.followup_count >= 2 ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">
                              📧 Max reminders sent
                            </span>
                          ) : (
                            <button
                              onClick={() => sendFollowUp(d)}
                              disabled={followUpSending === d.id}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                            >
                              {followUpSending === d.id
                                ? <><Loader2 className="h-3 w-3 animate-spin" /> Sending…</>
                                : <><Send className="h-3 w-3" /> Follow Up</>
                              }
                            </button>
                          )}
                          {d.last_followup_sent_at && (
                            <span className="text-xs text-gray-400">
                              {d.followup_count >= 2
                                ? '2 reminders sent — no response'
                                : `📧 Sent ${Math.round((Date.now() - new Date(d.last_followup_sent_at).getTime()) / 3_600_000)}h ago`
                              }
                            </span>
                          )}
                          {!d.last_followup_sent_at && d.followup_count < 2 && (
                            <span className="text-xs text-gray-400">Not sent</span>
                          )}
                          <button onClick={() => markNoWork(d.id)} className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 transition-colors ml-auto">
                            Mark No Work
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        </PlanGate>
      )}

      {activeTab === 'tickets' && (<>

      {/* Step 10 — Verify Queue sub-tab (only when AI filter active) */}
      {sourceFilter === 'ai' && (
        <div className="px-6 mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setAiSubTab('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${aiSubTab === 'all' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
              All AI Imported
            </button>
            <button
              onClick={() => setAiSubTab('verify')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all ${aiSubTab === 'verify' ? 'bg-amber-500 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
              Verify Queue
              {needsReviewCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-1.5 rounded-full">{needsReviewCount}</span>
              )}
            </button>
          </div>
          {aiSubTab === 'verify' && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              These AI-imported tickets have low confidence fields. Review and confirm before invoicing.
            </div>
          )}
        </div>
      )}

      {/* Search + Filters */}
      <div className="space-y-3 mb-5">
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tickets..." className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${showFilters || activeFilters > 0 ? 'border-[var(--brand-primary)] text-[var(--brand-primary)] bg-[var(--brand-primary)]/5' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            <Filter className="h-4 w-4" />
            Filters {activeFilters > 0 && <span className="h-4 w-4 rounded-full bg-[var(--brand-primary)] text-white text-[10px] flex items-center justify-center">{activeFilters}</span>}
          </button>
          {activeFilters > 0 && (
            <button onClick={() => { setFilterStatus(''); setFilterContractor(''); setFilterTruck(''); setFilterDriver(''); setFilterFrom(''); setFilterTo('') }} className="text-sm text-red-400 hover:text-red-600 font-medium">Clear</button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs bg-white focus:outline-none">
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="disputed">Disputed</option>
              <option value="invoiced">Invoiced</option>
              <option value="paid">Paid</option>
            </select>
            <select value={filterContractor} onChange={e => setFilterContractor(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs bg-white focus:outline-none">
              <option value="">All Companies</option>
              {contractors.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <select value={filterDriver} onChange={e => setFilterDriver(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs bg-white focus:outline-none">
              <option value="">All Drivers</option>
              {drivers.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={filterTruck} onChange={e => setFilterTruck(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs bg-white focus:outline-none">
              <option value="">All Trucks</option>
              {trucks.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs bg-white focus:outline-none" placeholder="From" />
            <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs bg-white focus:outline-none" placeholder="To" />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[var(--brand-primary)]" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-400">No tickets found</p>
            <button onClick={openAdd} className="mt-3 text-sm text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)]">Add your first ticket →</button>
          </div>
        ) : (
          <>
          {/* Step 8 — Bulk action toolbar */}
          {selectedTickets.length > 0 && (
            <div className="flex items-center gap-3 mb-3 p-3 bg-gray-900 text-white rounded-xl flex-wrap">
              <span className="text-sm font-semibold">{selectedTickets.length} selected</span>
              <div className="flex gap-2 flex-wrap ml-2">
                <button onClick={() => bulkUpdateStatus('invoiced')} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold">✅ Mark Invoiced</button>
                <button onClick={() => bulkUpdateStatus('pending')}  className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-xs font-bold">↩️ Mark Pending</button>
                <button onClick={handleBulkExport}                   className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold">📥 Export CSV</button>
                <button onClick={handleBulkDelete}                   className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold">🗑 Delete</button>
              </div>
              <button onClick={() => setSelectedTickets([])} className="ml-auto text-gray-400 hover:text-white text-sm">Clear ✕</button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] sm:min-w-[800px] text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <input type="checkbox" checked={allSelected} onChange={e => setSelectedTickets(e.target.checked ? filtered.map(t => t.id) : [])} className="w-4 h-4 rounded" />
                  </th>
                  {(['Photo', 'Date', 'Job / Company'] as const).map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Quality</th>
                  <th className="hidden sm:table-cell text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Load Type</th>
                  <th className="hidden sm:table-cell text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Driver</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Truck</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Origin → Dest</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Jobs</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Tons</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Total Pay</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(l => {
                  const photos  = getPhotos(l)
                  const tickets = l.load_tickets ?? []
                  const tons    = tickets.reduce((s, t) => s + (t.tonnage ?? 0), 0)
                  const lr = l as Record<string, unknown>
                  return (
                    <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                      {/* Checkbox */}
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={selectedTickets.includes(l.id)} onChange={e => setSelectedTickets(prev => e.target.checked ? [...prev, l.id] : prev.filter(id => id !== l.id))} className="w-4 h-4 rounded" />
                      </td>
                      <td className="px-4 py-3">
                        {photos.length > 0 ? (
                          <button onClick={() => { setViewingImages(photos); setViewingIndex(0) }} className="relative h-10 w-10 overflow-hidden rounded-lg border border-gray-200 hover:border-[var(--brand-primary)] transition-colors shrink-0">
                            <Image src={photos[0]!} alt="Ticket" fill className="object-cover" sizes="40px" />
                            {photos.length > 1 && <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-[10px] font-bold">+{photos.length}</div>}
                          </button>
                        ) : (
                          <div className="h-10 w-10 rounded-lg border border-dashed border-gray-200 flex items-center justify-center"><ImageIcon className="h-4 w-4 text-gray-300" /></div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">{new Date(l.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-gray-900 whitespace-nowrap">{l.job_name}</p>
                          {l.source === 'driver' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">Driver Upload</span>
                          )}
                          {l.generated_by_ai && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">🤖 AI Import</span>
                          )}
                        </div>
                        {l.client_company && <p className="text-xs text-gray-400">{l.client_company}</p>}
                        {/* Duplicate / anomaly badges */}
                        {!!lr.is_duplicate && <span className="inline-flex text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">⚠️ Duplicate</span>}
                        {!!lr.anomaly_flag && <span className="inline-flex text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium cursor-help" title={String(lr.anomaly_reason ?? '')}>🚨 Anomaly</span>}
                      </td>
                      {/* Step 4 — Quality badge */}
                      {(() => {
                        const { status, missing } = computeCompletenessScore(lr)
                        const badge = COMPLETENESS_BADGE[status]
                        return (
                          <td className="px-3 py-3">
                            <div className="relative group">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-help ${badge.color}`}>{badge.icon}</span>
                              {missing.length > 0 && (
                                <div className="absolute left-0 top-6 z-20 hidden group-hover:block bg-gray-900 text-white text-xs rounded-lg p-2 w-48 shadow-xl">
                                  <p className="font-semibold mb-1">Missing:</p>
                                  {missing.map(f => <p key={f} className="text-gray-300">• {f}</p>)}
                                </div>
                              )}
                            </div>
                          </td>
                        )
                      })()}
                      <td className="hidden sm:table-cell px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{l.load_type || '—'}</td>
                      <td className="hidden sm:table-cell px-4 py-3 text-gray-600 whitespace-nowrap">{l.driver_name}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{l.truck_number || '—'}</td>
                      <td className="hidden md:table-cell px-4 py-3 text-xs text-gray-500 max-w-[160px]">
                        {l.origin || l.destination ? <span>{l.origin || '?'} → {l.destination || '?'}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-sm font-medium text-gray-900">
                        {tickets.length > 0 ? tickets.length : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {tons > 0 ? `${tons % 1 === 0 ? tons : tons.toFixed(1)}T` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap font-medium">
                        {l.total_pay != null
                          ? `$${l.total_pay.toLocaleString()}`
                          : l.rate != null ? `$${l.rate.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {/* Step 7 — invoice link pill */}
                        {l.status === 'invoiced' && lr.invoice_id ? (
                          <Link href={`/dashboard/invoices`} className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium hover:bg-green-200">✅ Invoiced ↗</Link>
                        ) : (
                          <select
                            value={l.status}
                            onChange={e => handleStatusChange(l, e.target.value)}
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 cursor-pointer focus:outline-none ${statusColor[l.status as keyof typeof statusColor] ?? 'bg-gray-100 text-gray-600'}`}
                          >
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="disputed">Disputed</option>
                            <option value="invoiced">Invoiced</option>
                            <option value="paid">Paid</option>
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {l.status === 'pending' && (
                            <button onClick={() => handleApprove(l)} title="Approve ticket" className="p-1 text-gray-300 hover:text-green-500 transition-colors"><CheckCircle2 className="h-3.5 w-3.5" /></button>
                          )}
                          {l.status === 'pending' && l.source === 'driver' && (
                            <button onClick={() => handleReject(l)} title="Reject ticket" className="p-1 text-gray-300 hover:text-red-500 transition-colors"><XCircle className="h-3.5 w-3.5" /></button>
                          )}
                          <button onClick={() => openEdit(l)} className="p-1 text-gray-400 hover:text-[var(--brand-primary)] transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleDelete(l.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                          {/* Step 6 — History button */}
                          <button onClick={() => setAuditDrawer(l.id)} title="View ticket history" className="p-1 text-gray-300 hover:text-gray-600 transition-colors"><History className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
        )}

        {/* Load more / pagination footer */}
        {!loading && loads.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>
              Showing {filtered.length} of {totalCount ?? loads.length} tickets
              {hasMore ? ' (more available)' : ''}
            </span>
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {loadingMore ? 'Loading…' : 'Load More'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-2xl shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between z-10">
              <h2 className="font-semibold text-gray-900">{editing ? 'Edit Ticket' : 'New Ticket'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              {/* AI-Generated Record banner */}
              {editing?.generated_by_ai && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-base mt-0.5">🤖</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-800">AI-Generated Record</p>
                    <p className="text-xs text-amber-700 mt-0.5">This ticket was extracted by AI. Please verify all values before using in invoices or payroll.</p>
                  </div>
                </div>
              )}
              {/* Step 9 — AI field confidence panel */}
              {!!editing?.generated_by_ai && !!(editing as Record<string, unknown>).ai_field_confidence && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-xs font-bold text-amber-800 mb-2">🤖 AI-Extracted Field Confidence</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries((editing as Record<string, unknown>).ai_field_confidence as Record<string, number>).map(([field, conf]) => {
                      const pct = Math.round(conf * 100)
                      return (
                        <div key={field} className="flex items-center justify-between">
                          <span className="text-xs text-gray-600 capitalize">{field}</span>
                          <span className={`text-xs font-bold ${pct >= 90 ? 'text-green-600' : pct >= 70 ? 'text-amber-600' : 'text-red-500'}`}>{pct}%</span>
                        </div>
                      )
                    })}
                  </div>
                  {Object.values((editing as Record<string, unknown>).ai_field_confidence as Record<string, number>).some(c => c < 0.8) && (
                    <p className="text-xs text-amber-700 mt-2 font-medium">⚠️ Fields below 80% confidence should be verified</p>
                  )}
                </div>
              )}
              {/* Row 1: Job + Company */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-gray-700">Job Name *</label>
                    <button type="button" onClick={() => { setJobMode(m => m === 'dropdown' ? 'manual' : 'dropdown'); setAutoFilledFromJob(false) }} className="text-xs text-[var(--brand-primary)] hover:underline">
                      {jobMode === 'dropdown' ? '✏️ Enter manually' : '← Back to list'}
                    </button>
                  </div>
                  {jobMode === 'dropdown' && activeJobs.length > 0 ? (
                    <select
                      required
                      value={activeJobs.find(j => j.job_name === form.job_name)?.id ?? ''}
                      onChange={e => {
                        const job = activeJobs.find(j => j.id === e.target.value)
                        if (!job) { setForm(p => ({ ...p, job_name: '' })); setAutoFilledFromJob(false); return }
                        const updates: Partial<typeof form> = { job_name: job.job_name }
                        if (job.rate != null) { updates.rate = String(job.rate); setAutoFilledFromJob(true) } else { setAutoFilledFromJob(false) }
                        if (job.rate_type) updates.rate_type = job.rate_type
                        if (job.material) updates.load_type = job.material
                        setForm(p => ({ ...p, ...updates }))
                      }}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] bg-white"
                    >
                      <option value="">— Select a job —</option>
                      {activeJobs.map(j => <option key={j.id} value={j.id}>{j.job_name}</option>)}
                    </select>
                  ) : jobMode === 'dropdown' ? (
                    <div className="w-full rounded-lg border border-dashed border-gray-200 px-3 py-2.5 text-sm text-gray-400 flex items-center justify-between">
                      <span>No active jobs</span>
                      <button type="button" onClick={() => setJobMode('manual')} className="text-xs text-[var(--brand-primary)] shrink-0">Enter manually →</button>
                    </div>
                  ) : (
                    <input required value={form.job_name} onChange={e => { setForm(p => ({ ...p, job_name: e.target.value })); setAutoFilledFromJob(false) }} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" placeholder="Ironclad Grade Site" />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Working Under (Company)</label>
                  <select value={form.client_company} onChange={e => setForm(p => ({ ...p, client_company: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] bg-white">
                    <option value="">— Select company —</option>
                    {clientCompanies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>

                {/* Row 2: Load Type + Date */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Load Type</label>
                  <select value={form.load_type} onChange={e => setForm(p => ({ ...p, load_type: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] bg-white">
                    <option value="">Select type</option>
                    {LOAD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
                  <input required type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" />
                </div>

                {/* Row 3: Origin + Destination */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Origin Location</label>
                  <input value={form.origin} onChange={e => setForm(p => ({ ...p, origin: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" placeholder="Quarry Rd pit" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Destination</label>
                  <input value={form.destination} onChange={e => setForm(p => ({ ...p, destination: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" placeholder="Hwy 90 job site" />
                </div>

                {/* Row 4: Driver + Truck */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Driver Name *</label>
                  {driverMode === 'dropdown' ? (
                    <select
                      required
                      value={form.driver_name}
                      onChange={e => {
                        const name = e.target.value
                        if (name === '__manual__') {
                          setDriverMode('manual')
                          setForm(p => ({ ...p, driver_name: '', truck_number: '' }))
                        } else {
                          // Auto-fill truck: most recent load first, then primary_truck fallback
                          const recentTruck = [...loads]
                            .filter(l => l.driver_name === name && l.truck_number)
                            .sort((a, b) => b.date.localeCompare(a.date))[0]?.truck_number
                          const primaryTruck = driversList.find(d => d.name === name)?.primary_truck ?? ''
                          setForm(p => ({ ...p, driver_name: name, truck_number: recentTruck ?? primaryTruck }))
                        }
                      }}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] bg-white"
                    >
                      <option value="">— Select a driver —</option>
                      {driversList.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                      <option value="__manual__">Other / Manual Entry…</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        required
                        value={form.driver_name}
                        onChange={e => setForm(p => ({ ...p, driver_name: e.target.value }))}
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                        placeholder="Jake Morrison"
                      />
                      {driversList.length > 0 && (
                        <button
                          type="button"
                          onClick={() => { setDriverMode('dropdown'); setForm(p => ({ ...p, driver_name: '', truck_number: '' })) }}
                          className="text-xs text-[var(--brand-primary)] hover:underline whitespace-nowrap"
                        >
                          ← Pick from list
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Truck #</label>
                  <input value={form.truck_number} onChange={e => setForm(p => ({ ...p, truck_number: e.target.value }))} list="truck-dl" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" placeholder="SA07" />
                  <datalist id="truck-dl">{trucks.map(t => <option key={t} value={t} />)}</datalist>
                </div>

                {/* Row 5: Time in + Time out */}
                <div>
                  <TimeInput label="Time In" value={form.time_in} onChange={v => setForm(p => ({ ...p, time_in: v }))} />
                </div>
                <div>
                  <TimeInput label="Time Out" value={form.time_out} onChange={v => setForm(p => ({ ...p, time_out: v }))} />
                </div>

                {/* Rate Type Selector */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Rate Type</label>
                  <div className="flex gap-2">
                    {(['load', 'hr', 'ton'] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, rate_type: type, rate_quantity: '' }))}
                        className={`flex-1 rounded-lg border text-sm font-semibold py-2.5 transition-all ${
                          form.rate_type === type
                            ? 'bg-[var(--brand-dark)] border-[var(--brand-dark)] text-white'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                        style={{ minHeight: 44 }}
                      >
                        {type === 'load' ? '/job' : type === 'hr' ? '/hr' : '/ton'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Row 6: Job Rate + Qty */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {form.rate_type === 'hr' ? 'Hourly Rate' : form.rate_type === 'ton' ? 'Rate per Ton' : 'Job Rate'}
                  </label>
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-[var(--brand-primary)]/20 focus-within:border-[var(--brand-primary)]">
                    <span className="flex items-center px-3 bg-gray-50 text-sm text-gray-500 border-r border-gray-200">$</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={form.rate}
                      onChange={e => {
                        setAutoFilledFromJob(false)
                        setForm(p => ({ ...p, rate: e.target.value }))
                      }}
                      className="flex-1 px-3 py-2.5 text-sm focus:outline-none bg-white"
                      placeholder="0.00"
                    />
                  </div>
                  {autoFilledFromJob && <p className="text-xs text-green-600 mt-1">✓ Rate auto-filled from job settings</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {form.rate_type === 'hr' ? 'Hours Worked' : form.rate_type === 'ton' ? 'Total Tons' : '# of Jobs'}
                  </label>
                  <input
                    type="number" min="0" step="0.01"
                    value={form.rate_quantity}
                    readOnly={form.rate_type === 'hr'}
                    onChange={e => setForm(p => ({ ...p, rate_quantity: e.target.value }))}
                    className={`w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] ${form.rate_type === 'hr' ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                    placeholder={form.rate_type === 'hr' ? 'Auto from time in/out' : '0'}
                  />
                </div>

                {/* Auto-calc helper */}
                {parseFloat(form.rate) > 0 && (
                  <div className="col-span-2 -mt-2">
                    {form.rate_type === 'hr' && (() => {
                      const hrs = calculateHoursWorked(form.time_in, form.time_out)
                      if (hrs === null || hrs <= 0) return <p className="text-xs text-gray-400">Enter Time In + Time Out to auto-calculate hours</p>
                      return <p className="text-xs text-gray-400">${parseFloat(form.rate).toFixed(2)}/hr × {hrs} hrs = <span className="font-semibold text-gray-600">${(parseFloat(form.rate) * hrs).toFixed(2)}</span></p>
                    })()}
                    {form.rate_type === 'load' && parseFloat(form.rate_quantity) > 0 && (
                      <p className="text-xs text-gray-400">${parseFloat(form.rate).toFixed(2)}/job × {form.rate_quantity} jobs = <span className="font-semibold text-gray-600">${(parseFloat(form.rate) * parseFloat(form.rate_quantity)).toFixed(2)}</span></p>
                    )}
                    {form.rate_type === 'ton' && parseFloat(form.rate_quantity) > 0 && (
                      <p className="text-xs text-gray-400">${parseFloat(form.rate).toFixed(2)}/ton × {form.rate_quantity} tons = <span className="font-semibold text-gray-600">${(parseFloat(form.rate) * parseFloat(form.rate_quantity)).toFixed(2)}</span></p>
                    )}
                  </div>
                )}

                {/* Total Pay */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Total Pay ($) *</label>
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-[var(--brand-primary)]/20 focus-within:border-[var(--brand-primary)]">
                    <span className="flex items-center px-3 bg-gray-50 text-sm text-gray-500 border-r border-gray-200">$</span>
                    <input
                      required type="number" min="0" step="0.01"
                      value={form.total_pay}
                      onChange={e => setForm(p => ({ ...p, total_pay: e.target.value }))}
                      className="flex-1 px-3 py-2.5 text-sm focus:outline-none bg-white"
                      placeholder="0.00"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {form.rate_type === 'hr' ? 'Auto-calculated from rate × hours (time in/out)' : form.rate_type === 'ton' ? 'Auto-calculated from rate × total tons' : 'Auto-calculated from rate × # of jobs'}
                  </p>
                </div>

                {/* Status */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] bg-white">
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="disputed">Disputed</option>
                    <option value="invoiced">Invoiced</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] resize-none" placeholder="Optional notes..." />
                </div>
              </div>

              {/* Ticket Slips */}
              <div>
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">Load Tickets / Slips</p>
                {ticketRows[0] && (() => {
                  const main = ticketRows[0]
                  return (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                      <span className="text-xs font-semibold text-[var(--brand-primary)] bg-[var(--brand-primary)]/10 px-2 py-0.5 rounded-full">Main Ticket</span>
                      <div>
                        {main.imagePreview ? (
                          <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-white">
                            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                              <Image src={main.imagePreview} alt="Preview" fill className="object-contain" sizes="600px" />
                            </div>
                            <button type="button" onClick={() => { updateRow(main.id, { imageFile: null, imagePreview: null }); const el = fileInputRefs.current.get(main.id); if (el) el.value = '' }} className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 flex items-center justify-center text-white"><X className="h-3.5 w-3.5" /></button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => fileInputRefs.current.get(main.id)?.click()} className="w-full rounded-xl border-2 border-dashed border-gray-200 bg-white hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 transition-all py-6 flex flex-col items-center gap-2">
                            <Camera className="h-6 w-6 text-gray-400" />
                            <p className="text-sm font-medium text-gray-500">Take photo or upload</p>
                          </button>
                        )}
                        <input ref={el => { if (el) fileInputRefs.current.set(main.id, el); else fileInputRefs.current.delete(main.id) }} type="file" accept="image/*" onChange={e => handleTicketImageChange(main.id, e)} className="hidden" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Ticket #</label>
                          <input value={main.ticket_number} onChange={e => updateRow(main.id, { ticket_number: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] bg-white" placeholder="T-1001" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Tons / Qty</label>
                          <input type="number" min="0" step="0.01" value={main.tonnage} onChange={e => updateRow(main.id, { tonnage: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] bg-white" placeholder="14.5" />
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {ticketRows.slice(1).map((row, i) => (
                  <div key={row.id} className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-gray-400">Extra Ticket #{i + 2}</span>
                      <button type="button" onClick={() => setTicketRows(prev => prev.filter(r => r.id !== row.id))} className="text-gray-300 hover:text-red-400"><X className="h-4 w-4" /></button>
                    </div>
                    <div className="flex gap-3 items-start">
                      <div className="w-28 shrink-0">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Ticket #</label>
                        <input value={row.ticket_number} onChange={e => updateRow(row.id, { ticket_number: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none bg-white" placeholder="T-1002" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Tons / Qty</label>
                        <input type="number" min="0" step="0.01" value={row.tonnage} onChange={e => updateRow(row.id, { tonnage: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none bg-white" placeholder="14.5" />
                      </div>
                      <div className="shrink-0">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Photo</label>
                        {row.imagePreview ? (
                          <div className="relative h-[42px] w-[42px] rounded-lg overflow-hidden border border-gray-200">
                            <Image src={row.imagePreview} alt="Ticket" fill className="object-cover" sizes="42px" />
                          </div>
                        ) : (
                          <button type="button" onClick={() => fileInputRefs.current.get(row.id)?.click()} className="h-[42px] w-[42px] rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center hover:border-[var(--brand-primary)] transition-all">
                            <Camera className="h-4 w-4 text-gray-400" />
                          </button>
                        )}
                        <input ref={el => { if (el) fileInputRefs.current.set(row.id, el); else fileInputRefs.current.delete(row.id) }} type="file" accept="image/*" onChange={e => handleTicketImageChange(row.id, e)} className="hidden" />
                      </div>
                    </div>
                  </div>
                ))}

                <button type="button" onClick={() => setTicketRows(prev => [...prev, makeEmptyRow()])} className="mt-3 w-full rounded-xl border-2 border-dashed border-gray-200 py-2.5 text-sm font-medium text-gray-400 hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-all flex items-center justify-center gap-2">
                  <Plus className="h-4 w-4" /> Add Extra Ticket
                </button>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-gray-200 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-[var(--brand-primary)] py-3 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? 'Saving…' : editing ? 'Update Ticket' : 'Add Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      </>) /* end tickets tab */}

      {/* Step 5 — Invoice block modal */}
      {invoiceBlockModal.open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <span className="text-4xl block mb-3">⚠️</span>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Ticket Has Missing Data</h3>
            <p className="text-sm text-gray-600 mb-3">This ticket is missing information that may be needed to defend this invoice if disputed:</p>
            <ul className="mb-4 space-y-1">
              {(invoiceBlockModal.missing ?? []).map(f => (
                <li key={f} className="text-sm text-red-600 flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {f}</li>
              ))}
            </ul>
            <div className="flex gap-3">
              <button
                onClick={() => { setInvoiceBlockModal({ open: false }); if (invoiceBlockModal.ticket) openEdit(invoiceBlockModal.ticket) }}
                className="flex-1 py-2.5 bg-[var(--brand-primary)] text-white font-bold rounded-xl text-sm">
                Fix Missing Data
              </button>
              <button
                onClick={() => {
                  if (invoiceBlockModal.ticketId) void quickStatus(invoiceBlockModal.ticketId, 'invoiced')
                  setInvoiceBlockModal({ open: false })
                }}
                className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-xl text-sm">
                Invoice Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 6 — Audit trail drawer */}
      <AuditTrailDrawer
        ticketId={auditDrawer}
        isOpen={auditDrawer !== null}
        onClose={() => setAuditDrawer(null)}
      />

      {/* Lightbox */}
      {viewingImages.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setViewingImages([])}>
          <button className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-white" onClick={() => setViewingImages([])}><X className="h-5 w-5" /></button>
          {viewingImages.length > 1 && (
            <>
              <button className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-white" onClick={e => { e.stopPropagation(); setViewingIndex(i => Math.max(0, i - 1)) }}><ChevronLeft className="h-5 w-5" /></button>
              <button className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-white" onClick={e => { e.stopPropagation(); setViewingIndex(i => Math.min(viewingImages.length - 1, i + 1)) }}><ChevronRight className="h-5 w-5" /></button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/40 px-3 py-1 rounded-full">{viewingIndex + 1} / {viewingImages.length}</div>
            </>
          )}
          <div className="relative max-w-3xl w-full" style={{ maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
            <Image src={viewingImages[viewingIndex]!} alt="Ticket photo" width={1200} height={900} className="object-contain w-full rounded-lg" style={{ maxHeight: '85vh' }} />
          </div>
        </div>
      )}
    </div>
  )
}
