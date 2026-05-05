'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, Loader2, FileText, Camera, X, ImageIcon, ChevronLeft, ChevronRight, Search, Filter, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { Load, LoadTicket, Contractor } from '@/lib/types'
import { linkTicketToDispatch, approveTicket } from '@/lib/workflows'
import { getCompanyId } from '@/lib/get-company-id'
import { PAGE_SIZE, pageRange } from '@/lib/pagination'
import Image from 'next/image'
import Link from 'next/link'

const statusColor = {
  pending:  'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  disputed: 'bg-red-100 text-red-700',
  invoiced: 'bg-blue-100 text-blue-700',
  paid:     'bg-emerald-100 text-emerald-700',
}

const LOAD_TYPES = ['Dirt', 'Gravel', 'Asphalt', 'Sand', 'Rock', 'Fill', 'Millings', 'Other']

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
  status: 'pending',
  notes: '',
}

function makeEmptyRow(): TicketRow {
  return { id: crypto.randomUUID(), ticket_number: '', tonnage: '', imageFile: null, imagePreview: null }
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
  const [driversList, setDriversList] = useState<{ id: string; name: string }[]>([])
  const [driverMode, setDriverMode] = useState<'dropdown' | 'manual'>('dropdown')
  const [companyPlan,          setCompanyPlan]          = useState<string | null>(null)
  const [isInternal,           setIsInternal]           = useState(false)
  const [monthTicketCount,     setMonthTicketCount]     = useState(0)
  const [ticketBannerDismissed, setTicketBannerDismissed] = useState(false)

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

  // Tabs
  const [activeTab, setActiveTab] = useState<'tickets' | 'missing'>('tickets')

  // Source filter
  const [sourceFilter, setSourceFilter] = useState<'all' | 'office' | 'driver'>('all')

  // Missing tickets
  type MissingDispatch = { id: string; driver_name: string; dispatch_date: string; loads_completed: number; job_name: string | null; daysAgo: number; ticketsFound: number }
  const [missingDispatches, setMissingDispatches] = useState<MissingDispatch[]>([])
  const [loadingMissing, setLoadingMissing]       = useState(false)

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
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const [loadsRes, contractorsRes, clientCompaniesRes, countRes, driversRes, coRes, monthRes] = await Promise.all([
      supabase.from('loads').select('*, load_tickets(*)').eq('company_id', orgId).order('date', { ascending: false }).range(range0, range1),
      supabase.from('contractors').select('*').eq('company_id', orgId).eq('status', 'active').order('name'),
      supabase.from('client_companies').select('id, name').eq('company_id', orgId).order('name'),
      supabase.from('loads').select('id', { count: 'exact', head: true }).eq('company_id', orgId),
      supabase.from('drivers').select('id, name').eq('company_id', orgId).eq('status', 'active').order('name'),
      supabase.from('companies').select('plan, is_internal').eq('id', orgId).maybeSingle(),
      supabase.from('loads').select('id', { count: 'exact', head: true }).eq('company_id', orgId).gte('date', monthStart),
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
    setMonthTicketCount(monthRes.count ?? 0)
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

  useEffect(() => { fetchData() }, [])

  // Debounce search input so the filter doesn't run on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200)
    return () => clearTimeout(t)
  }, [search])

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

  const filtered = useMemo(() => loads.filter(l => {
    if (sourceFilter === 'office' && l.source === 'driver') return false
    if (sourceFilter === 'driver' && l.source !== 'driver') return false
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
  }), [loads, sourceFilter, filterStatus, filterContractor, filterTruck, filterDriver, filterFrom, filterTo, debouncedSearch])

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

  function openAdd() {
    setEditing(null); setForm(EMPTY_FORM); setTicketRows([makeEmptyRow()])
    setDriverMode('dropdown')
    setShowForm(true)
  }

  function openEdit(l: Load) {
    setEditing(l)
    setForm({
      job_name: l.job_name, client_company: l.client_company ?? '',
      load_type: l.load_type ?? '', origin: l.origin ?? '', destination: l.destination ?? '',
      driver_name: l.driver_name, truck_number: l.truck_number ?? '',
      date: l.date, time_in: l.time_in ?? '', time_out: l.time_out ?? '',
      rate: String(l.rate), rate_type: l.rate_type ?? 'load',
      status: l.status, notes: l.notes ?? '',
    })
    setTicketRows([makeEmptyRow()])
    // Keep dropdown mode if the driver exists in the list, otherwise manual
    setDriverMode(driversList.some(d => d.name === l.driver_name) ? 'dropdown' : 'manual')
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const uid = await getUid()
    const orgId = await getCompanyId()
    if (!uid || !orgId) { toast.error('Not authenticated'); setSaving(false); return }

    const payload = {
      job_name: form.job_name, client_company: form.client_company || null,
      load_type: form.load_type || null, origin: form.origin || null,
      destination: form.destination || null, driver_name: form.driver_name,
      truck_number: form.truck_number || null, date: form.date,
      time_in: form.time_in || null, time_out: form.time_out || null,
      rate: parseFloat(form.rate) || 0, rate_type: form.rate_type,
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
      toast.success('Ticket updated')
    } else {
      if (!isInternal && companyPlan === 'owner_operator' && monthTicketCount >= 200) {
        toast.error('Monthly ticket limit reached (200/mo). Upgrade to Fleet for unlimited tickets.')
        setSaving(false)
        return
      }
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
      setMonthTicketCount(c => c + 1)
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
    setLoads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
  }

  async function fetchMissingTickets() {
    setLoadingMissing(true)
    const companyId = await getCompanyId()
    if (!companyId) { setLoadingMissing(false); return }
    const todayStr = new Date().toISOString().split('T')[0]!
    const { data: dispatches, error } = await supabase
      .from('dispatches')
      .select('id, driver_name, dispatch_date, loads_completed, job_id, jobs(job_name)')
      .eq('company_id', companyId)
      .lt('dispatch_date', todayStr)
      .neq('status', 'completed')
      .order('dispatch_date', { ascending: false })
      .limit(50)
    if (error && !error.message.includes('schema cache')) {
      setLoadingMissing(false); return
    }
    const now = new Date()
    const results: MissingDispatch[] = (dispatches ?? []).map((d: { id: string; driver_name: string; dispatch_date: string; loads_completed: number; jobs?: { job_name?: string } | null }) => {
      const ticketsFound = loads.filter(l => l.driver_name === d.driver_name && l.date === d.dispatch_date).length
      const dispDate     = new Date(d.dispatch_date + 'T00:00:00')
      const daysAgo      = Math.floor((now.getTime() - dispDate.getTime()) / (1000 * 60 * 60 * 24))
      return { id: d.id, driver_name: d.driver_name, dispatch_date: d.dispatch_date, loads_completed: d.loads_completed, job_name: (d.jobs as { job_name?: string } | null)?.job_name ?? null, daysAgo, ticketsFound }
    }).filter((d: MissingDispatch) => d.ticketsFound === 0)
    setMissingDispatches(results)
    setLoadingMissing(false)
  }

  async function markNoWork(dispatchId: string) {
    await supabase.from('dispatches').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', dispatchId)
    setMissingDispatches(prev => prev.filter(d => d.id !== dispatchId))
    toast.success('Marked as no work done')
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
          <Link href="/dashboard/tickets/new" className="inline-flex items-center gap-2 rounded-lg border border-[#2d7a4f] px-3 py-2 text-sm font-medium text-[#2d7a4f] hover:bg-[#2d7a4f]/5 transition-colors">
            <Camera className="h-4 w-4" /> Quick Entry
          </Link>
          <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-lg bg-[#2d7a4f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#245f3e] transition-colors">
            <Plus className="h-4 w-4" /> Add Ticket
          </button>
        </div>
      </div>

      {/* Monthly ticket limit banner (owner_operator at 80%+ of 200/mo) */}
      {!ticketBannerDismissed && companyPlan === 'owner_operator' && monthTicketCount >= 160 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="text-base shrink-0">📋</span>
          <p className="flex-1 text-sm font-medium text-amber-800">
            You&apos;ve used <strong>{monthTicketCount}/200</strong> tickets this month.{' '}
            {monthTicketCount >= 200
              ? 'You\'ve hit your monthly limit. '
              : 'Approaching your monthly limit. '}
            <a href="/pricing" className="underline font-semibold hover:no-underline">
              Upgrade to Fleet for unlimited tickets →
            </a>
          </p>
          <button onClick={() => setTicketBannerDismissed(true)} className="text-amber-500 hover:text-amber-700 shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
        <div>
          {loadingMissing ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#2d7a4f]" /></div>
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
                <button onClick={fetchMissingTickets} className="text-xs text-[#2d7a4f] hover:text-[#245f3e] font-medium">Refresh</button>
              </div>
              <div className="divide-y divide-gray-50">
                {missingDispatches.map(d => (
                  <div key={d.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50">
                    <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm shrink-0">
                      {d.driver_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{d.driver_name}</p>
                      <p className="text-xs text-gray-500">{d.job_name ?? 'No job assigned'} · {new Date(d.dispatch_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                    </div>
                    <div className="text-right shrink-0 mr-4">
                      <p className="text-xs font-semibold text-orange-600">{d.daysAgo} day{d.daysAgo !== 1 ? 's' : ''} ago</p>
                      <p className="text-xs text-gray-400">{d.loads_completed} loads on dispatch</p>
                    </div>
                    <button onClick={() => markNoWork(d.id)} className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 whitespace-nowrap hover:border-gray-300 transition-colors">
                      Mark No Work
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'tickets' && (<>

      {/* Search + Filters */}
      <div className="space-y-3 mb-5">
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tickets..." className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${showFilters || activeFilters > 0 ? 'border-[#2d7a4f] text-[#2d7a4f] bg-[#2d7a4f]/5' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            <Filter className="h-4 w-4" />
            Filters {activeFilters > 0 && <span className="h-4 w-4 rounded-full bg-[#2d7a4f] text-white text-[10px] flex items-center justify-center">{activeFilters}</span>}
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
          <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#2d7a4f]" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-400">No tickets found</p>
            <button onClick={openAdd} className="mt-3 text-sm text-[#2d7a4f] hover:text-[#245f3e]">Add your first ticket →</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Photo', 'Date', 'Job / Company', 'Load Type', 'Driver', 'Truck', 'Origin → Dest', 'Slips', 'Rate', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(l => {
                  const photos  = getPhotos(l)
                  const tickets = l.load_tickets ?? []
                  const tons    = tickets.reduce((s, t) => s + (t.tonnage ?? 0), 0)
                  return (
                    <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        {photos.length > 0 ? (
                          <button onClick={() => { setViewingImages(photos); setViewingIndex(0) }} className="relative h-10 w-10 overflow-hidden rounded-lg border border-gray-200 hover:border-[#2d7a4f] transition-colors shrink-0">
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
                        </div>
                        {l.client_company && <p className="text-xs text-gray-400">{l.client_company}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{l.load_type || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{l.driver_name}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{l.truck_number || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[160px]">
                        {l.origin || l.destination ? <span>{l.origin || '?'} → {l.destination || '?'}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {tickets.length > 0 ? (
                          <div>
                            <span className="text-sm font-medium text-gray-900">{tickets.length}</span>
                            {tons > 0 && <p className="text-xs text-gray-400">{tons.toFixed(1)} tons</p>}
                          </div>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">${l.rate?.toLocaleString()}<span className="text-xs text-gray-400">/{l.rate_type ?? 'load'}</span></td>
                      <td className="px-4 py-3">
                        <select
                          value={l.status}
                          onChange={e => quickStatus(l.id, e.target.value as Load['status'])}
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 cursor-pointer focus:outline-none ${statusColor[l.status as keyof typeof statusColor] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="disputed">Disputed</option>
                          <option value="invoiced">Invoiced</option>
                          <option value="paid">Paid</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {l.status === 'pending' && (
                            <button onClick={() => handleApprove(l)} title="Approve ticket" className="p-1 text-gray-300 hover:text-green-500 transition-colors"><CheckCircle2 className="h-3.5 w-3.5" /></button>
                          )}
                          {l.status === 'pending' && l.source === 'driver' && (
                            <button onClick={() => handleReject(l)} title="Reject ticket" className="p-1 text-gray-300 hover:text-red-500 transition-colors"><XCircle className="h-3.5 w-3.5" /></button>
                          )}
                          <button onClick={() => openEdit(l)} className="p-1 text-gray-400 hover:text-[#2d7a4f] transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleDelete(l.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
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
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-2xl shadow-2xl max-h-[95dvh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between z-10">
              <h2 className="font-semibold text-gray-900">{editing ? 'Edit Ticket' : 'New Ticket'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              {/* Row 1: Job + Company */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Job Name *</label>
                  <input required value={form.job_name} onChange={e => setForm(p => ({ ...p, job_name: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]" placeholder="Ironclad Grade Site" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Working Under (Company)</label>
                  <select value={form.client_company} onChange={e => setForm(p => ({ ...p, client_company: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f] bg-white">
                    <option value="">— Select company —</option>
                    {clientCompanies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>

                {/* Row 2: Load Type + Date */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Load Type</label>
                  <select value={form.load_type} onChange={e => setForm(p => ({ ...p, load_type: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f] bg-white">
                    <option value="">Select type</option>
                    {LOAD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
                  <input required type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]" />
                </div>

                {/* Row 3: Origin + Destination */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Origin Location</label>
                  <input value={form.origin} onChange={e => setForm(p => ({ ...p, origin: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]" placeholder="Quarry Rd pit" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Destination</label>
                  <input value={form.destination} onChange={e => setForm(p => ({ ...p, destination: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]" placeholder="Hwy 90 job site" />
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
                          // Auto-fill truck from most recent load for this driver
                          const recentTruck = [...loads]
                            .filter(l => l.driver_name === name && l.truck_number)
                            .sort((a, b) => b.date.localeCompare(a.date))[0]?.truck_number ?? ''
                          setForm(p => ({ ...p, driver_name: name, truck_number: recentTruck }))
                        }
                      }}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f] bg-white"
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
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]"
                        placeholder="Jake Morrison"
                      />
                      {driversList.length > 0 && (
                        <button
                          type="button"
                          onClick={() => { setDriverMode('dropdown'); setForm(p => ({ ...p, driver_name: '', truck_number: '' })) }}
                          className="text-xs text-[#2d7a4f] hover:underline whitespace-nowrap"
                        >
                          ← Pick from list
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Truck #</label>
                  <input value={form.truck_number} onChange={e => setForm(p => ({ ...p, truck_number: e.target.value }))} list="truck-dl" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]" placeholder="SA07" />
                  <datalist id="truck-dl">{trucks.map(t => <option key={t} value={t} />)}</datalist>
                </div>

                {/* Row 5: Time in + Time out */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Time In</label>
                  <input
                    type="text"
                    value={form.time_in}
                    onChange={e => setForm(p => ({ ...p, time_in: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]"
                    placeholder="e.g. 7:00AM"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Time Out</label>
                  <input
                    type="text"
                    value={form.time_out}
                    onChange={e => setForm(p => ({ ...p, time_out: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]"
                    placeholder="e.g. 5:00PM"
                  />
                </div>

                {/* Row 6: Rate + Status */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Rate ($) *</label>
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-[#2d7a4f]/20 focus-within:border-[#2d7a4f]">
                    <span className="flex items-center px-3 bg-gray-50 text-sm text-gray-500 border-r border-gray-200">$</span>
                    <input required type="number" min="0" step="0.01" value={form.rate} onChange={e => setForm(p => ({ ...p, rate: e.target.value }))} className="flex-1 px-3 py-2.5 text-sm focus:outline-none bg-white" placeholder="450.00" />
                    <select value={form.rate_type} onChange={e => setForm(p => ({ ...p, rate_type: e.target.value }))} className="px-2 text-xs font-medium text-gray-600 bg-gray-50 border-l border-gray-200 focus:outline-none">
                      <option value="load">/ load</option>
                      <option value="ton">/ ton</option>
                      <option value="hr">/ hr</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f] bg-white">
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="disputed">Disputed</option>
                    <option value="invoiced">Invoiced</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f] resize-none" placeholder="Optional notes..." />
                </div>
              </div>

              {/* Ticket Slips */}
              <div>
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">Load Tickets / Slips</p>
                {ticketRows[0] && (() => {
                  const main = ticketRows[0]
                  return (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                      <span className="text-xs font-semibold text-[#2d7a4f] bg-[#2d7a4f]/10 px-2 py-0.5 rounded-full">Main Ticket</span>
                      <div>
                        {main.imagePreview ? (
                          <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-white">
                            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                              <Image src={main.imagePreview} alt="Preview" fill className="object-contain" sizes="600px" />
                            </div>
                            <button type="button" onClick={() => { updateRow(main.id, { imageFile: null, imagePreview: null }); const el = fileInputRefs.current.get(main.id); if (el) el.value = '' }} className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 flex items-center justify-center text-white"><X className="h-3.5 w-3.5" /></button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => fileInputRefs.current.get(main.id)?.click()} className="w-full rounded-xl border-2 border-dashed border-gray-200 bg-white hover:border-[#2d7a4f] hover:bg-[#2d7a4f]/5 transition-all py-6 flex flex-col items-center gap-2">
                            <Camera className="h-6 w-6 text-gray-400" />
                            <p className="text-sm font-medium text-gray-500">Take photo or upload</p>
                          </button>
                        )}
                        <input ref={el => { if (el) fileInputRefs.current.set(main.id, el); else fileInputRefs.current.delete(main.id) }} type="file" accept="image/*" capture="environment" onChange={e => handleTicketImageChange(main.id, e)} className="hidden" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Ticket #</label>
                          <input value={main.ticket_number} onChange={e => updateRow(main.id, { ticket_number: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f] bg-white" placeholder="T-1001" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Tons / Qty</label>
                          <input type="number" min="0" step="0.01" value={main.tonnage} onChange={e => updateRow(main.id, { tonnage: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f] bg-white" placeholder="14.5" />
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
                          <button type="button" onClick={() => fileInputRefs.current.get(row.id)?.click()} className="h-[42px] w-[42px] rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center hover:border-[#2d7a4f] transition-all">
                            <Camera className="h-4 w-4 text-gray-400" />
                          </button>
                        )}
                        <input ref={el => { if (el) fileInputRefs.current.set(row.id, el); else fileInputRefs.current.delete(row.id) }} type="file" accept="image/*" capture="environment" onChange={e => handleTicketImageChange(row.id, e)} className="hidden" />
                      </div>
                    </div>
                  </div>
                ))}

                <button type="button" onClick={() => setTicketRows(prev => [...prev, makeEmptyRow()])} className="mt-3 w-full rounded-xl border-2 border-dashed border-gray-200 py-2.5 text-sm font-medium text-gray-400 hover:border-[#2d7a4f] hover:text-[#2d7a4f] transition-all flex items-center justify-center gap-2">
                  <Plus className="h-4 w-4" /> Add Extra Ticket
                </button>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-gray-200 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-[#2d7a4f] py-3 text-sm font-semibold text-white hover:bg-[#245f3e] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? 'Saving…' : editing ? 'Update Ticket' : 'Add Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      </>) /* end tickets tab */}

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
          <div className="relative max-w-3xl w-full" style={{ maxHeight: '85dvh' }} onClick={e => e.stopPropagation()}>
            <Image src={viewingImages[viewingIndex]!} alt="Ticket photo" width={1200} height={900} className="object-contain w-full rounded-lg" style={{ maxHeight: '85dvh' }} />
          </div>
        </div>
      )}
    </div>
  )
}
