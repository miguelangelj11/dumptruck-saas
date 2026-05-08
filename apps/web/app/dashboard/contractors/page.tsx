'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCompanyId } from '@/lib/get-company-id'
import { Plus, Pencil, Trash2, Loader2, Truck, ChevronLeft, Camera, X, ImageIcon, ChevronRight, Phone, Mail } from 'lucide-react'
import { toast } from 'sonner'
import type { Contractor, ContractorTicket, ContractorTicketSlip, ClientCompany } from '@/lib/types'
import Image from 'next/image'

const statusColor = {
  pending: 'bg-yellow-100 text-yellow-700',
  invoiced: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
}

const materials = ['Asphalt', 'Concrete', 'Dirt', 'Gravel', 'Mix', 'Mulch', 'Rock', 'Sand', 'Other']

type SlipRow = { id: string; tonnage: string; imageFile: File | null; imagePreview: string | null }

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Pure string split — no Date object, no timezone shift possible.
// Works whether the DB column returns "2026-04-06", "2026-04-06T00:00:00", or "2026-04-06T00:00:00+00:00".
function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  const ymd = s.slice(0, 10) // always "YYYY-MM-DD"
  const [y, m, d] = ymd.split('-')
  return `${parseInt(m!)}/${parseInt(d!)}/${y}`
}

function calcContractorTotal(unitRate: string, rateType: string, qty: string): string {
  const r = parseFloat(unitRate)
  const q = parseFloat(qty)
  if (isNaN(r) || r <= 0 || isNaN(q) || q <= 0) return ''
  return (r * q).toFixed(2)
}

const EMPTY_TICKET = {
  job_name: '', client_company: '', date: '',
  hours_worked: '', truck_number: '', ticket_number: '', material: '',
  unit_rate: '', rate_quantity: '', rate: '', rate_type: 'load', status: 'pending', notes: '',
}

function makeEmptySlip(): SlipRow {
  return { id: crypto.randomUUID(), tonnage: '', imageFile: null, imagePreview: null }
}

export default function ContractorsPage() {
  const [userId, setUserId] = useState('')
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [loading, setLoading] = useState(true)
  const [companyPlan,          setCompanyPlan]          = useState<string | null>(null)
  const [companyIsSuperAdmin,  setCompanyIsSuperAdmin]  = useState(false)
  const [companySubOverride,   setCompanySubOverride]   = useState<string | null>(null)
  const [selected, setSelected] = useState<Contractor | null>(null)
  const [clientCompanies, setClientCompanies] = useState<ClientCompany[]>([])

  // Contractor form
  const [showContractorForm, setShowContractorForm] = useState(false)
  const [editingContractor, setEditingContractor] = useState<Contractor | null>(null)
  const [contractorForm, setContractorForm] = useState({ name: '', address: '', phone: '', email: '', status: 'active', notes: '' })
  const [savingContractor, setSavingContractor] = useState(false)

  // Ticket list + form
  const [tickets, setTickets] = useState<ContractorTicket[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [ticketTab, setTicketTab] = useState<'pending' | 'invoiced' | 'all'>('pending')
  const [showTicketForm, setShowTicketForm] = useState(false)
  const [editingTicket, setEditingTicket] = useState<ContractorTicket | null>(null)
  const [ticketForm, setTicketForm] = useState(EMPTY_TICKET)
  const [savingTicket, setSavingTicket] = useState(false)
  const [trucks, setTrucks] = useState<{ id: string; truck_number: string }[]>([])
  const [truckMode, setTruckMode] = useState<'dropdown' | 'manual'>('dropdown')
  const [activeJobs, setActiveJobs] = useState<{ id: string; job_name: string }[]>([])
  const [jobMode, setJobMode] = useState<'dropdown' | 'manual'>('dropdown')
  const [contractorTrucks, setContractorTrucks] = useState<{ id: string; truck_number: string }[]>([])
  const [addingContractorTruck, setAddingContractorTruck] = useState(false)
  const [newContractorTruckNumber, setNewContractorTruckNumber] = useState('')
  const [savingContractorTruck, setSavingContractorTruck] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [slipRows, setSlipRows] = useState<SlipRow[]>([makeEmptySlip()])
  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  // Lightbox
  const [viewingImages, setViewingImages] = useState<string[]>([])
  const [viewingIndex, setViewingIndex] = useState(0)

  const supabase = createClient()

  async function getUid(): Promise<string | null> {
    if (userId) return userId
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setUserId(user.id)
    return user?.id ?? null
  }

  async function init() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)
    const orgId = await getCompanyId()
    if (!orgId) { setLoading(false); return }
    const [contractorsRes, companiesRes, trucksRes, planRes] = await Promise.all([
      supabase.from('contractors').select('*').eq('company_id', orgId).order('name'),
      supabase.from('client_companies').select('*').eq('company_id', orgId).order('name'),
      supabase.from('trucks').select('id,truck_number').eq('company_id', orgId).order('truck_number'),
      supabase.from('companies').select('plan, is_super_admin, subscription_override').eq('id', orgId).maybeSingle(),
    ])
    if (contractorsRes.error) toast.error('Failed to load subcontractors: ' + contractorsRes.error.message)
    setContractors(contractorsRes.data ?? [])
    setClientCompanies(companiesRes.data ?? [])
    setTrucks((trucksRes.data ?? []) as { id: string; truck_number: string }[])
    const planCoData = planRes.data as Record<string, unknown> | null
    setCompanyPlan(planCoData?.plan as string | null ?? null)
    setCompanyIsSuperAdmin(!!(planCoData?.is_super_admin))
    setCompanySubOverride(planCoData?.subscription_override as string | null ?? null)
    setLoading(false)
  }

  useEffect(() => { init() }, [])

  useEffect(() => {
    const total = calcContractorTotal(ticketForm.unit_rate, ticketForm.rate_type, ticketForm.rate_quantity)
    if (total !== '') setTicketForm(p => ({ ...p, rate: total }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketForm.unit_rate, ticketForm.rate_type, ticketForm.rate_quantity])

  async function fetchTickets(contractorId: string) {
    setLoadingTickets(true)
    const { data } = await supabase
      .from('contractor_tickets')
      .select('*, contractor_ticket_slips(*)')
      .eq('contractor_id', contractorId)
      .order('date', { ascending: false })
    setTickets(data ?? [])
    setLoadingTickets(false)
  }

  async function fetchActiveJobs(orgId: string) {
    const { data } = await supabase
      .from('jobs')
      .select('id, job_name')
      .eq('company_id', orgId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    setActiveJobs(data ?? [])
  }

  async function fetchContractorTrucks(contractorId: string) {
    const res = await fetch(`/api/contractors/${contractorId}/trucks`)
    if (res.ok) {
      const data = await res.json() as { id: string; truck_number: string }[]
      setContractorTrucks(data)
    }
  }

  async function saveContractorTruck() {
    if (!newContractorTruckNumber.trim() || !selected) return
    setSavingContractorTruck(true)
    const res = await fetch(`/api/contractors/${selected.id}/trucks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ truck_number: newContractorTruckNumber.trim() }),
    })
    if (res.ok) {
      const truck = await res.json() as { id: string; truck_number: string }
      setContractorTrucks(prev => [...prev, truck].sort((a, b) => a.truck_number.localeCompare(b.truck_number)))
      setNewContractorTruckNumber('')
      setAddingContractorTruck(false)
    } else {
      const d = await res.json() as { error?: string }
      toast.error(d.error ?? 'Failed to add truck')
    }
    setSavingContractorTruck(false)
  }

  async function deleteContractorTruck(truckId: string) {
    if (!selected) return
    const res = await fetch(`/api/contractors/${selected.id}/trucks/${truckId}`, { method: 'DELETE' })
    if (res.ok) {
      setContractorTrucks(prev => prev.filter(t => t.id !== truckId))
    } else {
      toast.error('Failed to remove truck')
    }
  }

  function selectContractor(c: Contractor) {
    setSelected(c)
    setTicketTab('pending')
    fetchTickets(c.id)
    fetchContractorTrucks(c.id)
    setAddingContractorTruck(false)
    setNewContractorTruckNumber('')
  }

  // --- Contractor CRUD ---
  function openAddContractor() {
    setEditingContractor(null)
    setContractorForm({ name: '', address: '', phone: '', email: '', status: 'active', notes: '' })
    setShowContractorForm(true)
  }

  function openEditContractor(c: Contractor) {
    setEditingContractor(c)
    setContractorForm({ name: c.name, address: c.address ?? '', phone: c.phone ?? '', email: c.email ?? '', status: c.status, notes: c.notes ?? '' })
    setShowContractorForm(true)
  }

  async function handleSaveContractor(e: React.FormEvent) {
    e.preventDefault()
    setSavingContractor(true)
    const orgId = await getCompanyId()
    if (!orgId) { toast.error('Not authenticated'); setSavingContractor(false); return }

    const fields = {
      name: contractorForm.name,
      address: contractorForm.address || null,
      phone: contractorForm.phone || null,
      email: contractorForm.email || null,
      status: contractorForm.status,
      notes: contractorForm.notes || null,
    }

    if (editingContractor) {
      const { error } = await supabase.from('contractors').update(fields).eq('id', editingContractor.id)
      if (error) { toast.error(error.message); setSavingContractor(false); return }
      toast.success('Subcontractor updated')
      if (selected?.id === editingContractor.id) setSelected({ ...editingContractor, ...fields } as Contractor)
    } else {
      const { error } = await supabase.from('contractors').insert({ ...fields, company_id: orgId })
      if (error) { toast.error(error.message); setSavingContractor(false); return }
      toast.success('Subcontractor added')
    }
    setSavingContractor(false)
    setShowContractorForm(false)
    init()
  }

  async function handleDeleteContractor(id: string, name: string) {
    if (!confirm(`Delete "${name}" and all their tickets?`)) return
    const { error } = await supabase.from('contractors').delete().eq('id', id)
    if (error) { toast.error('Delete failed: ' + error.message); return }
    toast.success(`"${name}" deleted`)
    if (selected?.id === id) setSelected(null)
    setContractors(prev => prev.filter(c => c.id !== id))
  }

  // --- Ticket CRUD ---
  async function openAddTicket() {
    setEditingTicket(null)
    setTicketForm({ ...EMPTY_TICKET, date: localToday() })
    const allTrucks = [...contractorTrucks, ...trucks]
    setTruckMode(allTrucks.length > 0 ? 'dropdown' : 'manual')
    setJobMode('dropdown')
    setSlipRows([makeEmptySlip()])
    const orgId = await getCompanyId()
    if (orgId) fetchActiveJobs(orgId)
    setShowTicketForm(true)
  }

  async function openEditTicket(t: ContractorTicket) {
    setEditingTicket(t)
    const existingTruck = t.truck_number ?? ''
    setTicketForm({
      job_name: t.job_name, client_company: t.client_company ?? '',
      date: t.date, hours_worked: t.hours_worked ?? '',
      truck_number: existingTruck,
      ticket_number: t.ticket_number ?? '',
      material: t.material ?? '',
      rate: String(t.rate), unit_rate: '', rate_quantity: '', rate_type: t.rate_type ?? 'load', status: t.status, notes: t.notes ?? '',
    })
    const allTrucks = [...contractorTrucks, ...trucks]
    setTruckMode(allTrucks.some(tr => tr.truck_number === existingTruck) || !existingTruck ? 'dropdown' : 'manual')
    // If job_name matches an active job → show dropdown; else manual
    const orgId = await getCompanyId()
    if (orgId) {
      const { data: jobs } = await supabase.from('jobs').select('id, job_name').eq('company_id', orgId).eq('status', 'active').order('created_at', { ascending: false })
      setActiveJobs(jobs ?? [])
      setJobMode(jobs?.some((j: { job_name: string }) => j.job_name === t.job_name) ? 'dropdown' : 'manual')
    }
    setSlipRows([makeEmptySlip()])
    setShowTicketForm(true)
  }

  function updateSlipRow(id: string, updates: Partial<SlipRow>) {
    setSlipRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))
  }

  function handleSlipImageChange(rowId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB'); return }
    updateSlipRow(rowId, { imageFile: file, imagePreview: URL.createObjectURL(file) })
  }

  async function uploadSlipPhoto(uid: string, ticketId: string, slipId: string, file: File): Promise<string | null> {
    const ext = file.name.split('.').pop()
    const path = `${uid}/contractors/${ticketId}/${slipId}.${ext}`
    const { error } = await supabase.storage.from('ticket-photos').upload(path, file, { upsert: true })
    if (error) { toast.error('Photo upload failed: ' + error.message); return null }
    const { data } = supabase.storage.from('ticket-photos').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSaveTicket(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setSavingTicket(true)

    const uid = await getUid()
    const orgId = await getCompanyId()
    if (!uid || !orgId) { toast.error('Not authenticated'); setSavingTicket(false); return }

    const basePayload = {
      job_name: ticketForm.job_name,
      client_company: ticketForm.client_company || null,
      date: ticketForm.date,
      hours_worked: ticketForm.hours_worked || null,
      truck_number: ticketForm.truck_number || null,
      ticket_number: ticketForm.ticket_number || null,
      material: ticketForm.material || null,
      rate: parseFloat(ticketForm.rate) || 0,
      rate_type: ticketForm.rate_type,
      status: ticketForm.status as ContractorTicket['status'],
      notes: ticketForm.notes || null,
      contractor_id: selected.id,
      company_id: orgId,
    }

    if (editingTicket) {
      const { job_name, client_company, date, hours_worked, truck_number, ticket_number, material, rate, rate_type, status, notes } = basePayload
      const { error } = await supabase.from('contractor_tickets').update({ job_name, client_company, date, hours_worked, truck_number, ticket_number, material, rate, rate_type, status, notes }).eq('id', editingTicket.id)
      if (error) { toast.error(error.message); setSavingTicket(false); return }
      const newSlips = slipRows.filter(r => r.tonnage || r.imageFile)
      if (newSlips.length > 0) {
        setUploadingImage(true)
        for (const row of newSlips) {
          let image_url: string | null = null
          if (row.imageFile) image_url = await uploadSlipPhoto(uid, editingTicket.id, row.id, row.imageFile)
          const { error: slipErr } = await supabase.from('contractor_ticket_slips').insert({ id: row.id, ticket_id: editingTicket.id, company_id: orgId, tonnage: parseFloat(row.tonnage) || null, image_url })
          if (slipErr) toast.error('Slip save failed: ' + slipErr.message)
        }
        setUploadingImage(false)
      }
      toast.success('Ticket updated')
    } else {
      const ticketId = crypto.randomUUID()
      const { error } = await supabase.from('contractor_tickets').insert({ ...basePayload, id: ticketId })
      if (error) { toast.error(error.message); setSavingTicket(false); return }
      setUploadingImage(true)
      for (const row of slipRows) {
        if (!row.tonnage && !row.imageFile) continue
        let image_url: string | null = null
        if (row.imageFile) image_url = await uploadSlipPhoto(uid, ticketId, row.id, row.imageFile)
        const { error: slipErr } = await supabase.from('contractor_ticket_slips').insert({ id: row.id, ticket_id: ticketId, company_id: orgId, tonnage: parseFloat(row.tonnage) || null, image_url })
        if (slipErr) toast.error('Slip save failed: ' + slipErr.message)
      }
      setUploadingImage(false)
      toast.success('Ticket added')
    }

    setSavingTicket(false)
    setShowTicketForm(false)
    setSlipRows([makeEmptySlip()])
    fetchTickets(selected.id)
  }

  async function handleDeleteTicket(id: string) {
    if (!confirm('Delete this ticket?')) return
    await supabase.from('contractor_ticket_slips').delete().eq('ticket_id', id)
    const { error } = await supabase.from('contractor_tickets').delete().eq('id', id)
    if (error) { toast.error('Delete failed: ' + error.message); return }
    toast.success('Ticket deleted')
    setTickets(prev => prev.filter(t => t.id !== id))
  }

  function getTicketPhotos(t: ContractorTicket): string[] {
    return (t.contractor_ticket_slips ?? []).map(s => s.image_url).filter(Boolean) as string[]
  }

  // --- Render ---
  if (loading) {
    return <div className="flex items-center justify-center py-40"><Loader2 className="h-6 w-6 animate-spin text-[var(--brand-primary)]" /></div>
  }

  // Detail view — selected contractor's tickets
  if (selected) {
    return (
      <div className="p-6 md:p-8 max-w-7xl">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{selected.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-0.5">
              {selected.address && <span className="text-xs text-gray-400">{selected.address}</span>}
              {selected.phone && <span className="flex items-center gap-1 text-xs text-gray-400"><Phone className="h-3 w-3" />{selected.phone}</span>}
              {selected.email && <span className="flex items-center gap-1 text-xs text-gray-400"><Mail className="h-3 w-3" />{selected.email}</span>}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${selected.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{selected.status}</span>
            </div>
          </div>
          <button onClick={openAddTicket} className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] transition-colors">
            <Plus className="h-4 w-4" /> Add Ticket
          </button>
        </div>

        {/* Contractor trucks */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-700">Truck Numbers</h4>
            {!addingContractorTruck && (
              <button
                onClick={() => setAddingContractorTruck(true)}
                className="text-xs text-[var(--brand-primary)] font-medium hover:underline"
              >
                + Add Truck
              </button>
            )}
          </div>
          {contractorTrucks.length === 0 && !addingContractorTruck ? (
            <p className="text-xs text-gray-400">No trucks added yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {contractorTrucks.map(truck => (
                <span key={truck.id} className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg text-sm font-medium">
                  🚛 {truck.truck_number}
                  <button onClick={() => deleteContractorTruck(truck.id)} className="text-gray-400 hover:text-red-500 ml-1 text-xs leading-none">×</button>
                </span>
              ))}
            </div>
          )}
          {addingContractorTruck && (
            <div className="flex gap-2 mt-2">
              <input
                value={newContractorTruckNumber}
                onChange={e => setNewContractorTruckNumber(e.target.value)}
                placeholder="e.g. SE17"
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveContractorTruck() } }}
                autoFocus
              />
              <button
                onClick={saveContractorTruck}
                disabled={savingContractorTruck || !newContractorTruckNumber.trim()}
                className="px-3 py-1.5 bg-[var(--brand-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brand-primary-hover)] disabled:opacity-50 transition-colors"
              >
                {savingContractorTruck ? '…' : 'Add'}
              </button>
              <button
                onClick={() => { setAddingContractorTruck(false); setNewContractorTruckNumber('') }}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Ticket status tabs */}
        <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
          {(['pending', 'invoiced', 'all'] as const).map(tab => {
            const count = tab === 'all' ? tickets.length : tickets.filter(t => t.status === tab).length
            return (
              <button
                key={tab}
                onClick={() => setTicketTab(tab)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 capitalize ${ticketTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${ticketTab === tab ? 'bg-gray-100 text-gray-600' : 'bg-gray-200/70 text-gray-500'}`}>{count}</span>
              </button>
            )
          })}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {loadingTickets ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[var(--brand-primary)]" /></div>
          ) : (() => {
            const visibleTickets = ticketTab === 'all' ? tickets : tickets.filter(t => t.status === ticketTab)
            return visibleTickets.length === 0 ? (
              <div className="text-center py-16">
                <Truck className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-400">
                  {tickets.length === 0 ? `No tickets yet for ${selected.name}` : `No ${ticketTab} tickets`}
                </p>
                {tickets.length === 0 && <button onClick={openAddTicket} className="mt-3 text-sm text-[var(--brand-primary)]">Add first ticket →</button>}
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Photos', 'Job', 'Ticket #', 'Company', 'Truck #', 'Material', 'Rate', 'Tickets', 'Hours', 'Date', 'Status', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {visibleTickets.map(t => {
                    const photos = getTicketPhotos(t)
                    const slips = t.contractor_ticket_slips ?? []
                    const totalTonnage = slips.reduce((s, r) => s + (r.tonnage ?? 0), 0)
                    return (
                      <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3">
                          {photos.length > 0 ? (
                            <div className="flex gap-1">
                              {photos.slice(0, 3).map((url, i) => (
                                <button key={i} onClick={() => { setViewingImages(photos); setViewingIndex(i) }} className="relative h-10 w-10 overflow-hidden rounded-lg border border-gray-200 hover:border-[var(--brand-primary)] transition-colors shrink-0">
                                  <Image src={url} alt="Ticket" fill className="object-cover" sizes="40px" />
                                  {i === 2 && photos.length > 3 && <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs font-bold">+{photos.length - 3}</div>}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="h-10 w-10 rounded-lg border border-dashed border-gray-200 flex items-center justify-center">
                              <ImageIcon className="h-4 w-4 text-gray-300" />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{t.job_name}</td>
                        <td className="px-4 py-3 font-mono text-gray-600 text-xs">{t.ticket_number || <span className="text-gray-300 font-sans">—</span>}</td>
                        <td className="px-4 py-3 text-gray-600">{t.client_company || <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-gray-600">{t.truck_number ? `#${t.truck_number}` : <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-gray-500">{t.material || '—'}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">${t.rate?.toLocaleString()}<span className="text-xs text-gray-400 font-normal">/{t.rate_type ?? 'job'}</span></td>
                        <td className="px-4 py-3">
                          {slips.length > 0 ? (
                            <div>
                              <span className="text-sm font-medium text-gray-900">{slips.length} ticket{slips.length !== 1 ? 's' : ''}</span>
                              {totalTonnage > 0 && <p className="text-xs text-gray-400">{totalTonnage.toLocaleString()} tons</p>}
                            </div>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{t.hours_worked || <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-gray-500">{fmtDate(t.date)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusColor[t.status as keyof typeof statusColor] ?? 'bg-gray-100 text-gray-600'}`}>{t.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openEditTicket(t)} className="p-1 text-gray-400 hover:text-[var(--brand-primary)] transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => handleDeleteTicket(t.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
          })()}
        </div>

        {/* Ticket form modal */}
        {showTicketForm && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
            <div className="bg-white w-full sm:rounded-2xl sm:max-w-lg shadow-2xl max-h-[95dvh] overflow-y-auto">
              <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between z-10">
                <h2 className="font-semibold text-gray-900">{editingTicket ? 'Edit Ticket' : 'New Ticket'} — {selected.name}</h2>
                <button onClick={() => setShowTicketForm(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
              </div>
              <form onSubmit={handleSaveTicket} className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-gray-700">Working Under (Company)</label>
                      <a href="/dashboard/settings" target="_blank" className="text-xs text-[var(--brand-primary)]">+ Manage companies</a>
                    </div>
                    {clientCompanies.length === 0 ? (
                      <div className="w-full rounded-lg border border-dashed border-gray-200 px-3 py-2.5 text-sm text-gray-400 flex items-center justify-between">
                        <span>No companies added yet</span>
                        <a href="/dashboard/settings" target="_blank" className="text-xs text-[var(--brand-primary)] shrink-0">Add in Settings →</a>
                      </div>
                    ) : (
                      <select value={ticketForm.client_company} onChange={e => setTicketForm(p => ({ ...p, client_company: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] bg-white">
                        <option value="">— Select a company —</option>
                        {clientCompanies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-gray-700">Job Name *</label>
                      <button
                        type="button"
                        onClick={() => setJobMode(m => m === 'dropdown' ? 'manual' : 'dropdown')}
                        className="text-xs text-[var(--brand-primary)] hover:underline"
                      >
                        {jobMode === 'dropdown' ? '✏️ Enter manually' : '← Back to list'}
                      </button>
                    </div>
                    {jobMode === 'dropdown' ? (
                      activeJobs.length > 0 ? (
                        <select
                          required
                          value={ticketForm.job_name}
                          onChange={e => setTicketForm(p => ({ ...p, job_name: e.target.value }))}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] bg-white"
                        >
                          <option value="">— Select a job —</option>
                          {activeJobs.map(j => <option key={j.id} value={j.job_name}>{j.job_name}</option>)}
                        </select>
                      ) : (
                        <div className="w-full rounded-lg border border-dashed border-gray-200 px-3 py-2.5 text-sm text-gray-400 flex items-center justify-between">
                          <span>No active jobs</span>
                          <button type="button" onClick={() => setJobMode('manual')} className="text-xs text-[var(--brand-primary)] shrink-0">Enter manually →</button>
                        </div>
                      )
                    ) : (
                      <input
                        required
                        value={ticketForm.job_name}
                        onChange={e => setTicketForm(p => ({ ...p, job_name: e.target.value }))}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                        placeholder="Ironclad Grade Site"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
                    <input required type="date" value={ticketForm.date} onChange={e => setTicketForm(p => ({ ...p, date: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Hours Worked</label>
                    <input value={ticketForm.hours_worked} onChange={e => setTicketForm(p => ({ ...p, hours_worked: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" placeholder="7:30am – 5:30pm" />
                  </div>
                  <div className="col-span-2">
                    {(() => {
                      const allTrucks = [...contractorTrucks, ...trucks.filter(t => !contractorTrucks.some(ct => ct.truck_number === t.truck_number))]
                      return (
                        <>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-medium text-gray-700">Truck #</label>
                            {allTrucks.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setTruckMode(m => m === 'dropdown' ? 'manual' : 'dropdown')}
                                className="text-xs text-[var(--brand-primary)] hover:underline"
                              >
                                {truckMode === 'dropdown' ? '✏️ Enter manually' : '← Back to list'}
                              </button>
                            )}
                          </div>
                          {truckMode === 'dropdown' && allTrucks.length > 0 ? (
                            <select
                              value={ticketForm.truck_number}
                              onChange={e => setTicketForm(p => ({ ...p, truck_number: e.target.value }))}
                              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] bg-white"
                            >
                              <option value="">— Select a truck —</option>
                              {contractorTrucks.length > 0 && (
                                <optgroup label={`${selected?.name ?? 'Contractor'} trucks`}>
                                  {contractorTrucks.map(tr => <option key={tr.id} value={tr.truck_number}>#{tr.truck_number}</option>)}
                                </optgroup>
                              )}
                              {trucks.filter(t => !contractorTrucks.some(ct => ct.truck_number === t.truck_number)).length > 0 && (
                                <optgroup label="Company trucks">
                                  {trucks.filter(t => !contractorTrucks.some(ct => ct.truck_number === t.truck_number)).map(tr => <option key={tr.id} value={tr.truck_number}>#{tr.truck_number}</option>)}
                                </optgroup>
                              )}
                            </select>
                          ) : (
                            <div>
                              <input
                                value={ticketForm.truck_number}
                                onChange={e => setTicketForm(p => ({ ...p, truck_number: e.target.value }))}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                                placeholder="e.g. SE17"
                              />
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Ticket #</label>
                    <input
                      value={ticketForm.ticket_number}
                      onChange={e => setTicketForm(p => ({ ...p, ticket_number: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                      placeholder="e.g. T-1001"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Material</label>
                    <select value={ticketForm.material} onChange={e => setTicketForm(p => ({ ...p, material: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] bg-white">
                      <option value="">Select material</option>
                      {materials.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Job Rate</label>
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-[var(--brand-primary)]/20 focus-within:border-[var(--brand-primary)]">
                      <span className="flex items-center px-3 bg-gray-50 text-sm text-gray-500 border-r border-gray-200">$</span>
                      <input type="number" min="0" step="0.01" value={ticketForm.unit_rate} onChange={e => setTicketForm(p => ({ ...p, unit_rate: e.target.value }))} className="flex-1 px-3 py-2.5 text-sm focus:outline-none bg-white" placeholder="0.00" />
                      <select value={ticketForm.rate_type} onChange={e => setTicketForm(p => ({ ...p, rate_type: e.target.value, rate_quantity: '' }))} className="px-2 text-xs font-medium text-gray-600 bg-gray-50 border-l border-gray-200 focus:outline-none">
                        <option value="load">/ job</option>
                        <option value="ton">/ ton</option>
                        <option value="hr">/ hr</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {ticketForm.rate_type === 'hr' ? 'Hours Worked' : ticketForm.rate_type === 'ton' ? 'Total Tons' : '# of Jobs'}
                    </label>
                    <input type="number" min="0" step="0.01" value={ticketForm.rate_quantity} onChange={e => setTicketForm(p => ({ ...p, rate_quantity: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" placeholder="0" />
                  </div>
                  {parseFloat(ticketForm.unit_rate) > 0 && parseFloat(ticketForm.rate_quantity) > 0 && (
                    <div className="col-span-2 -mt-2">
                      <p className="text-xs text-gray-400">
                        ${parseFloat(ticketForm.unit_rate).toFixed(2)}/{ticketForm.rate_type} × {ticketForm.rate_quantity} {ticketForm.rate_type === 'ton' ? 'tons' : ticketForm.rate_type === 'hr' ? 'hrs' : 'jobs'} = <span className="font-semibold text-gray-600">${(parseFloat(ticketForm.unit_rate) * parseFloat(ticketForm.rate_quantity)).toFixed(2)}</span>
                      </p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Total Pay ($) *</label>
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-[var(--brand-primary)]/20 focus-within:border-[var(--brand-primary)]">
                      <span className="flex items-center px-3 bg-gray-50 text-sm text-gray-500 border-r border-gray-200">$</span>
                      <input required type="number" min="0" step="0.01" value={ticketForm.rate} onChange={e => setTicketForm(p => ({ ...p, rate: e.target.value }))} className="flex-1 px-3 py-2.5 text-sm focus:outline-none bg-white" placeholder="450.00" />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {ticketForm.rate_type === 'hr' ? 'Auto-calculated from rate × hours' : ticketForm.rate_type === 'ton' ? 'Auto-calculated from rate × total tons' : 'Auto-calculated from rate × # of jobs'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                    <select value={ticketForm.status} onChange={e => setTicketForm(p => ({ ...p, status: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] bg-white">
                      <option value="pending">Pending</option>
                      <option value="invoiced">Invoiced</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                    <textarea value={ticketForm.notes} onChange={e => setTicketForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] resize-none" placeholder="Optional notes..." />
                  </div>
                </div>

                {/* Ticket slips */}
                <div>
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">Load Ticket</p>
                  {/* Main slip */}
                  {(() => {
                    const main = slipRows[0]!
                    return (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                        <span className="text-xs font-semibold text-[var(--brand-primary)] bg-[var(--brand-primary)]/10 px-2 py-0.5 rounded-full">Main Ticket</span>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-2">Ticket Photo <span className="text-gray-400 font-normal">(tap to snap)</span></label>
                          {main.imagePreview ? (
                            <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-white">
                              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                                <Image src={main.imagePreview} alt="Ticket" fill className="object-contain" sizes="512px" />
                              </div>
                              <button type="button" onClick={() => { updateSlipRow(main.id, { imageFile: null, imagePreview: null }); const el = fileInputRefs.current.get(main.id); if (el) el.value = '' }} className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80">
                                <X className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" onClick={() => fileInputRefs.current.get(main.id)?.click()} className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-lg bg-black/60 px-3 py-1.5 text-xs font-medium text-white hover:bg-black/80">
                                <Camera className="h-3 w-3" /> Retake
                              </button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => fileInputRefs.current.get(main.id)?.click()} className="w-full rounded-xl border-2 border-dashed border-gray-200 bg-white hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 transition-all py-8 flex flex-col items-center gap-2 group">
                              <div className="h-12 w-12 rounded-full bg-white border border-gray-200 flex items-center justify-center group-hover:border-[var(--brand-primary)] shadow-sm">
                                <Camera className="h-5 w-5 text-gray-400 group-hover:text-[var(--brand-primary)]" />
                              </div>
                              <div className="text-center">
                                <p className="text-sm font-medium text-gray-600 group-hover:text-[var(--brand-primary)]">Take photo or upload</p>
                                <p className="text-xs text-gray-400 mt-0.5">JPG, PNG up to 10MB</p>
                              </div>
                            </button>
                          )}
                          <input ref={el => { if (el) fileInputRefs.current.set(main.id, el); else fileInputRefs.current.delete(main.id) }} type="file" accept="image/*" capture="environment" onChange={e => handleSlipImageChange(main.id, e)} className="hidden" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Tonnage / Count</label>
                          <input type="number" min="0" step="0.01" value={main.tonnage} onChange={e => updateSlipRow(main.id, { tonnage: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] bg-white" placeholder="14.5" />
                        </div>
                      </div>
                    )
                  })()}

                  {/* Extra slips */}
                  {slipRows.slice(1).map((row, i) => (
                    <div key={row.id} className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-gray-400">Extra Ticket #{i + 2}</span>
                        <button type="button" onClick={() => setSlipRows(prev => prev.filter(r => r.id !== row.id))} className="text-gray-300 hover:text-red-400 transition-colors"><X className="h-4 w-4" /></button>
                      </div>
                      <div className="flex gap-3 items-start">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Tonnage / Count</label>
                          <input type="number" min="0" step="0.01" value={row.tonnage} onChange={e => updateSlipRow(row.id, { tonnage: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] bg-white" placeholder="14.5" />
                        </div>
                        <div className="shrink-0">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Photo</label>
                          {row.imagePreview ? (
                            <div className="relative h-[42px] w-[42px] rounded-lg overflow-hidden border border-gray-200">
                              <Image src={row.imagePreview} alt="Slip" fill className="object-cover" sizes="42px" />
                              <button type="button" onClick={() => { updateSlipRow(row.id, { imageFile: null, imagePreview: null }); const el = fileInputRefs.current.get(row.id); if (el) el.value = '' }} className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 hover:opacity-100 transition-opacity"><X className="h-3 w-3" /></button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => fileInputRefs.current.get(row.id)?.click()} className="h-[42px] w-[42px] rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 transition-all">
                              <Camera className="h-4 w-4 text-gray-400" />
                            </button>
                          )}
                          <input ref={el => { if (el) fileInputRefs.current.set(row.id, el); else fileInputRefs.current.delete(row.id) }} type="file" accept="image/*" capture="environment" onChange={e => handleSlipImageChange(row.id, e)} className="hidden" />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button type="button" onClick={() => setSlipRows(prev => [...prev, makeEmptySlip()])} className="mt-3 w-full rounded-xl border-2 border-dashed border-gray-200 py-2.5 text-sm font-medium text-gray-400 hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-all flex items-center justify-center gap-2">
                    <Plus className="h-4 w-4" /> Add Extra Ticket
                  </button>
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowTicketForm(false)} className="flex-1 rounded-lg border border-gray-200 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                  <button type="submit" disabled={savingTicket || uploadingImage} className="flex-1 rounded-lg bg-[var(--brand-primary)] py-3 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {(savingTicket || uploadingImage) && <Loader2 className="h-4 w-4 animate-spin" />}
                    {savingTicket ? 'Saving…' : uploadingImage ? 'Uploading…' : editingTicket ? 'Update Ticket' : 'Add Ticket'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Lightbox */}
        {viewingImages.length > 0 && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setViewingImages([])}>
            <button className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20" onClick={() => setViewingImages([])}><X className="h-5 w-5" /></button>
            {viewingImages.length > 1 && <>
              <button className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20" onClick={e => { e.stopPropagation(); setViewingIndex(i => Math.max(0, i - 1)) }}><ChevronLeft className="h-5 w-5" /></button>
              <button className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20" onClick={e => { e.stopPropagation(); setViewingIndex(i => Math.min(viewingImages.length - 1, i + 1)) }}><ChevronRight className="h-5 w-5" /></button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/40 px-3 py-1 rounded-full">{viewingIndex + 1} / {viewingImages.length}</div>
            </>}
            <div className="relative max-w-3xl w-full" style={{ maxHeight: '85dvh' }} onClick={e => e.stopPropagation()}>
              <Image src={viewingImages[viewingIndex]!} alt="Ticket photo" width={1200} height={900} className="object-contain w-full rounded-lg" style={{ maxHeight: '85dvh' }} />
            </div>
          </div>
        )}
      </div>
    )
  }

  // Fleet plan gate — owner_operator cannot access subcontractors (super admin bypasses)
  if (!loading && companyPlan === 'owner_operator' && !companyIsSuperAdmin && !companySubOverride) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
        <span className="text-6xl mb-4">🔒</span>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Subcontractor Management</h2>
        <p className="text-gray-600 mb-2">
          Manage subcontractors, track their tickets, and pay them with one click.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          This feature requires the Fleet plan ($200/mo)
        </p>
        <a
          href="/dashboard/settings?tab=billing"
          className="px-6 py-3 font-bold rounded-xl transition-colors"
          style={{ background: '#F5B731', color: '#1a1a1a' }}
        >
          Upgrade to Fleet →
        </a>
      </div>
    )
  }

  // List view — all contractors
  return (
    <div className="p-6 md:p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subcontractors</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage your independent operators</p>
        </div>
        <button onClick={openAddContractor} className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] transition-colors">
          <Plus className="h-4 w-4" /> Add Subcontractor
        </button>
      </div>

      {contractors.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 text-center py-16">
          <Truck className="h-10 w-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-400">No subcontractors yet</p>
          <button onClick={openAddContractor} className="mt-3 text-sm text-[var(--brand-primary)]">Add your first subcontractor →</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {contractors.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[var(--brand-dark)] flex items-center justify-center text-sm font-bold text-white shrink-0">
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{c.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.status}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEditContractor(c)} className="p-1 text-gray-400 hover:text-[var(--brand-primary)] transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleDeleteContractor(c.id, c.name)} className="p-1 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              {(c.address || c.phone || c.email) && (
                <div className="space-y-1 mb-4">
                  {c.address && <p className="text-xs text-gray-500">{c.address}</p>}
                  {c.phone && <p className="flex items-center gap-1.5 text-xs text-gray-500"><Phone className="h-3 w-3 text-gray-400" />{c.phone}</p>}
                  {c.email && <p className="flex items-center gap-1.5 text-xs text-gray-500"><Mail className="h-3 w-3 text-gray-400" />{c.email}</p>}
                </div>
              )}
              <button onClick={() => selectContractor(c)} className="w-full rounded-lg bg-[var(--brand-primary)]/10 hover:bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] text-sm font-medium py-2 transition-colors">
                View Tickets →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Contractor form modal */}
      {showContractorForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{editingContractor ? 'Edit Subcontractor' : 'New Subcontractor'}</h2>
              <button onClick={() => setShowContractorForm(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSaveContractor} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                <input required value={contractorForm.name} onChange={e => setContractorForm(p => ({ ...p, name: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" placeholder="Danny Schultz" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
                <input value={contractorForm.address} onChange={e => setContractorForm(p => ({ ...p, address: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" placeholder="123 Main St, City, ST 00000" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                  <input type="tel" value={contractorForm.phone} onChange={e => setContractorForm(p => ({ ...p, phone: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" placeholder="(555) 000-0000" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select value={contractorForm.status} onChange={e => setContractorForm(p => ({ ...p, status: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] bg-white">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={contractorForm.email} onChange={e => setContractorForm(p => ({ ...p, email: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" placeholder="danny@atlashauling.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={contractorForm.notes} onChange={e => setContractorForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] resize-none" placeholder="Optional notes..." />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowContractorForm(false)} className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={savingContractor} className="flex-1 rounded-lg bg-[var(--brand-primary)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingContractor && <Loader2 className="h-4 w-4 animate-spin" />}
                  {savingContractor ? 'Saving…' : editingContractor ? 'Update' : 'Add Subcontractor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
