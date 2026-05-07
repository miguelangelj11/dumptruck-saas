'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCompanyId } from '@/lib/get-company-id'
import { getPlanGate } from '@/lib/plans'
import LockedFeature from '@/components/dashboard/locked-feature'
import {
  Plus, X, Loader2, Phone, Mail, Building2, DollarSign,
  FileText, ChevronRight, Trash2, Pencil, CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

type LeadStatus = 'new' | 'contacted' | 'quoted' | 'won' | 'lost'

type Lead = {
  id: string
  company_id: string
  name: string
  company_name: string | null
  phone: string | null
  email: string | null
  source: string | null
  value: number | null
  status: LeadStatus
  notes: string | null
  created_at: string
  updated_at: string
  quotes?: Quote[]
}

type Quote = {
  id: string
  company_id: string
  lead_id: string | null
  job_name: string
  material: string | null
  location: string | null
  rate: number | null
  rate_type: string | null
  est_loads: number | null
  notes: string | null
  status: 'draft' | 'sent' | 'accepted' | 'rejected'
  created_at: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STAGES: { status: LeadStatus; label: string; color: string; dot: string; bg: string }[] = [
  { status: 'new',       label: 'New Leads',  color: 'text-blue-700',   dot: 'bg-blue-500',    bg: 'bg-blue-50' },
  { status: 'contacted', label: 'Contacted',  color: 'text-purple-700', dot: 'bg-purple-500',  bg: 'bg-purple-50' },
  { status: 'quoted',    label: 'Quoted',     color: 'text-yellow-700', dot: 'bg-yellow-500',  bg: 'bg-yellow-50' },
  { status: 'won',       label: 'Won',        color: 'text-green-700',  dot: 'bg-green-500',   bg: 'bg-green-50' },
  { status: 'lost',      label: 'Lost',       color: 'text-red-700',    dot: 'bg-red-400',     bg: 'bg-red-50' },
]

const SOURCES = ['Referral', 'Website', 'Cold Call', 'Job Site', 'Social Media', 'Other']
const RATE_TYPES = ['load', 'ton', 'hour']
const QUOTE_STATUSES: Quote['status'][] = ['draft', 'sent', 'accepted', 'rejected']

const EMPTY_LEAD = { name: '', company_name: '', phone: '', email: '', source: '', value: '', status: 'new' as LeadStatus, notes: '' }
const EMPTY_QUOTE = { job_name: '', material: '', location: '', rate: '', rate_type: 'load', est_loads: '', notes: '', status: 'draft' as Quote['status'] }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  return n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`
}

function stageCfg(status: LeadStatus) {
  return STAGES.find(s => s.status === status) ?? STAGES[0]!
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CRMPage() {
  const supabase = createClient()

  const [leads,       setLeads]       = useState<Lead[]>([])
  const [loading,     setLoading]     = useState(true)
  const [companyId,   setCompanyId]   = useState<string | null>(null)
  const [plan,        setPlan]        = useState<string | null>(null)

  // Lead form
  const [showLeadForm, setShowLeadForm] = useState(false)
  const [editingLead,  setEditingLead]  = useState<Lead | null>(null)
  const [leadForm,     setLeadForm]     = useState(EMPTY_LEAD)
  const [savingLead,   setSavingLead]   = useState(false)

  // Quote form
  const [quotingLead,  setQuotingLead]  = useState<Lead | null>(null)
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null)
  const [quoteForm,    setQuoteForm]    = useState(EMPTY_QUOTE)
  const [savingQuote,  setSavingQuote]  = useState(false)

  // Lead detail panel
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  // Active pipeline stage filter
  const [stageFilter, setStageFilter] = useState<LeadStatus | 'all'>('all')

  // ── Data ────────────────────────────────────────────────────────────────────

  async function fetchData() {
    setLoading(true)
    const cid = await getCompanyId()
    if (!cid) { setLoading(false); return }
    setCompanyId(cid)

    const [leadsRes, companyRes, quotesRes] = await Promise.all([
      supabase.from('leads').select('*').eq('company_id', cid).order('created_at', { ascending: false }),
      supabase.from('companies').select('plan').eq('id', cid).maybeSingle(),
      supabase.from('quotes').select('*').eq('company_id', cid).order('created_at', { ascending: false }),
    ])

    const co = companyRes.data as Record<string, unknown> | null
    setPlan(co?.plan as string | null ?? null)

    const quotes = (quotesRes.data ?? []) as Quote[]
    const rawLeads = (leadsRes.data ?? []) as Lead[]
    setLeads(rawLeads.map(l => ({ ...l, quotes: quotes.filter(q => q.lead_id === l.id) })))
    setLoading(false)
  }

  useEffect(() => { fetchData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Plan gate ────────────────────────────────────────────────────────────────

  if (!loading) {
    const gate = getPlanGate({ plan })
    if (!gate.can('crm_pipeline')) {
      return (
        <LockedFeature
          title="CRM Pipeline"
          description="Track leads, send quotes, and convert prospects into jobs — all in one place."
        />
      )
    }
  }

  // ── Lead CRUD ────────────────────────────────────────────────────────────────

  function openAddLead() {
    setEditingLead(null)
    setLeadForm(EMPTY_LEAD)
    setShowLeadForm(true)
  }

  function openEditLead(l: Lead, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingLead(l)
    setLeadForm({
      name: l.name, company_name: l.company_name ?? '', phone: l.phone ?? '',
      email: l.email ?? '', source: l.source ?? '', value: l.value != null ? String(l.value) : '',
      status: l.status, notes: l.notes ?? '',
    })
    setShowLeadForm(true)
  }

  async function saveLead(e: React.FormEvent) {
    e.preventDefault()
    if (!companyId || !leadForm.name.trim()) return
    setSavingLead(true)
    const payload = {
      company_id:   companyId,
      name:         leadForm.name.trim(),
      company_name: leadForm.company_name.trim() || null,
      phone:        leadForm.phone.trim() || null,
      email:        leadForm.email.trim() || null,
      source:       leadForm.source || null,
      value:        leadForm.value ? parseFloat(leadForm.value) : null,
      status:       leadForm.status,
      notes:        leadForm.notes.trim() || null,
      updated_at:   new Date().toISOString(),
    }
    if (editingLead) {
      const { data } = await supabase.from('leads').update(payload).eq('id', editingLead.id).select().single()
      if (data) {
        const updated = { ...editingLead, ...(data as Lead) }
        setLeads(prev => prev.map(l => l.id === editingLead.id ? updated : l))
        if (selectedLead?.id === editingLead.id) setSelectedLead(updated)
        toast.success('Lead updated')
      }
    } else {
      const { data } = await supabase.from('leads').insert(payload).select().single()
      if (data) {
        setLeads(prev => [{ ...(data as Lead), quotes: [] }, ...prev])
        toast.success('Lead added')
      }
    }
    setSavingLead(false)
    setShowLeadForm(false)
  }

  async function deleteLead(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Delete this lead?')) return
    await supabase.from('leads').delete().eq('id', id)
    setLeads(prev => prev.filter(l => l.id !== id))
    if (selectedLead?.id === id) setSelectedLead(null)
    toast.success('Lead deleted')
  }

  async function moveStage(lead: Lead, status: LeadStatus) {
    await supabase.from('leads').update({ status, updated_at: new Date().toISOString() }).eq('id', lead.id)
    const updated = { ...lead, status }
    setLeads(prev => prev.map(l => l.id === lead.id ? updated : l))
    if (selectedLead?.id === lead.id) setSelectedLead(updated)
  }

  // ── Quote CRUD ───────────────────────────────────────────────────────────────

  function openAddQuote(lead: Lead) {
    setQuotingLead(lead)
    setEditingQuote(null)
    setQuoteForm(EMPTY_QUOTE)
  }

  function openEditQuote(q: Quote, lead: Lead, e: React.MouseEvent) {
    e.stopPropagation()
    setQuotingLead(lead)
    setEditingQuote(q)
    setQuoteForm({
      job_name: q.job_name, material: q.material ?? '', location: q.location ?? '',
      rate: q.rate != null ? String(q.rate) : '', rate_type: q.rate_type ?? 'load',
      est_loads: q.est_loads != null ? String(q.est_loads) : '',
      notes: q.notes ?? '', status: q.status,
    })
  }

  async function saveQuote(e: React.FormEvent) {
    e.preventDefault()
    if (!companyId || !quotingLead || !quoteForm.job_name.trim()) return
    setSavingQuote(true)
    const payload = {
      company_id: companyId,
      lead_id:    quotingLead.id,
      job_name:   quoteForm.job_name.trim(),
      material:   quoteForm.material.trim() || null,
      location:   quoteForm.location.trim() || null,
      rate:       quoteForm.rate ? parseFloat(quoteForm.rate) : null,
      rate_type:  quoteForm.rate_type,
      est_loads:  quoteForm.est_loads ? parseInt(quoteForm.est_loads) : null,
      notes:      quoteForm.notes.trim() || null,
      status:     quoteForm.status,
      updated_at: new Date().toISOString(),
    }
    if (editingQuote) {
      const { data } = await supabase.from('quotes').update(payload).eq('id', editingQuote.id).select().single()
      if (data) {
        const q = data as Quote
        setLeads(prev => prev.map(l =>
          l.id === quotingLead.id
            ? { ...l, quotes: (l.quotes ?? []).map(qx => qx.id === editingQuote.id ? q : qx) }
            : l
        ))
        if (selectedLead?.id === quotingLead.id) {
          setSelectedLead(sl => sl ? { ...sl, quotes: (sl.quotes ?? []).map(qx => qx.id === editingQuote.id ? q : qx) } : sl)
        }
        toast.success('Quote updated')
      }
    } else {
      const { data } = await supabase.from('quotes').insert(payload).select().single()
      if (data) {
        const q = data as Quote
        const updatedLeads = leads.map(l =>
          l.id === quotingLead.id
            ? { ...l, quotes: [...(l.quotes ?? []), q], status: 'quoted' as LeadStatus }
            : l
        )
        setLeads(updatedLeads)
        // auto-move lead to quoted stage
        if (quotingLead.status === 'new' || quotingLead.status === 'contacted') {
          await supabase.from('leads').update({ status: 'quoted', updated_at: new Date().toISOString() }).eq('id', quotingLead.id)
        }
        if (selectedLead?.id === quotingLead.id) {
          setSelectedLead(sl => sl ? { ...sl, quotes: [...(sl.quotes ?? []), q] } : sl)
        }
        toast.success('Quote created — lead moved to Quoted')
      }
    }
    setSavingQuote(false)
    setQuotingLead(null)
  }

  async function deleteQuote(q: Quote, leadId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Delete this quote?')) return
    await supabase.from('quotes').delete().eq('id', q.id)
    setLeads(prev => prev.map(l =>
      l.id === leadId ? { ...l, quotes: (l.quotes ?? []).filter(qx => qx.id !== q.id) } : l
    ))
    if (selectedLead?.id === leadId) {
      setSelectedLead(sl => sl ? { ...sl, quotes: (sl.quotes ?? []).filter(qx => qx.id !== q.id) } : sl)
    }
    toast.success('Quote deleted')
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const visibleLeads = stageFilter === 'all' ? leads : leads.filter(l => l.status === stageFilter)

  const pipelineValue = leads
    .filter(l => l.status !== 'lost')
    .reduce((s, l) => s + (l.value ?? 0), 0)

  const wonValue = leads
    .filter(l => l.status === 'won')
    .reduce((s, l) => s + (l.value ?? 0), 0)

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-full">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CRM Pipeline</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track leads and convert them into jobs</p>
        </div>
        <button
          onClick={openAddLead}
          className="flex items-center gap-2 bg-[var(--brand-dark)] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[var(--brand-primary-hover)] transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Lead
        </button>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 pb-4">
          {STAGES.map(s => {
            const count = leads.filter(l => l.status === s.status).length
            const val   = leads.filter(l => l.status === s.status).reduce((acc, l) => acc + (l.value ?? 0), 0)
            return (
              <button
                key={s.status}
                onClick={() => setStageFilter(prev => prev === s.status ? 'all' : s.status)}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  stageFilter === s.status
                    ? 'bg-[var(--brand-dark)] border-[var(--brand-dark)] text-white'
                    : 'bg-white border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`h-2 w-2 rounded-full ${stageFilter === s.status ? 'bg-white' : s.dot}`} />
                  <span className={`text-xs font-medium ${stageFilter === s.status ? 'text-white/80' : 'text-gray-500'}`}>{s.label}</span>
                </div>
                <p className={`text-2xl font-bold ${stageFilter === s.status ? 'text-white' : 'text-gray-900'}`}>{count}</p>
                {val > 0 && <p className={`text-xs mt-0.5 ${stageFilter === s.status ? 'text-white/60' : 'text-gray-400'}`}>{fmtMoney(val)}</p>}
              </button>
            )
          })}
        </div>
      )}

      {/* Pipeline value banner */}
      {!loading && pipelineValue > 0 && (
        <div className="mx-6 mb-4 flex items-center justify-between gap-4 rounded-xl bg-[var(--brand-dark)] text-white px-5 py-3">
          <div>
            <p className="text-xs text-white/60 font-medium">Pipeline Value</p>
            <p className="text-lg font-bold">{fmtMoney(pipelineValue)}</p>
          </div>
          {wonValue > 0 && (
            <div className="text-right">
              <p className="text-xs text-white/60 font-medium">Won Revenue</p>
              <p className="text-lg font-bold text-[#F5B731]">{fmtMoney(wonValue)}</p>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center flex-1 py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="flex-1 px-6 pb-8">

          {/* Desktop Kanban */}
          <div className="hidden lg:grid grid-cols-5 gap-4">
            {STAGES.map(stage => {
              const stageLeads = leads.filter(l => l.status === stage.status)
              return (
                <div key={stage.status} className="flex flex-col gap-2 min-h-[400px]">
                  <div className={`flex items-center justify-between rounded-xl px-3 py-2 ${stage.bg}`}>
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${stage.dot}`} />
                      <span className={`text-xs font-semibold ${stage.color}`}>{stage.label}</span>
                    </div>
                    <span className={`text-xs font-bold ${stage.color}`}>{stageLeads.length}</span>
                  </div>
                  {stageLeads.map(lead => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onSelect={() => setSelectedLead(lead)}
                      onEdit={(e) => openEditLead(lead, e)}
                      onDelete={(e) => deleteLead(lead.id, e)}
                      onQuote={() => openAddQuote(lead)}
                      onMove={moveStage}
                    />
                  ))}
                  {stageLeads.length === 0 && (
                    <div className="flex-1 flex items-center justify-center rounded-xl border-2 border-dashed border-gray-100 text-gray-300 text-xs py-8">
                      No leads
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Mobile list */}
          <div className="lg:hidden space-y-3">
            {visibleLeads.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
                <p className="font-medium text-gray-400">No leads yet</p>
                <p className="text-sm text-gray-300 mt-1">Click "Add Lead" to get started</p>
              </div>
            ) : (
              visibleLeads.map(lead => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onSelect={() => setSelectedLead(lead)}
                  onEdit={(e) => openEditLead(lead, e)}
                  onDelete={(e) => deleteLead(lead.id, e)}
                  onQuote={() => openAddQuote(lead)}
                  onMove={moveStage}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Lead detail panel ─────────────────────────────────────────────── */}
      {selectedLead && (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={() => setSelectedLead(null)}>
          <div
            className="w-full max-w-sm bg-white h-full shadow-2xl overflow-y-auto flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
              <div>
                <h2 className="font-bold text-gray-900 text-base">{selectedLead.name}</h2>
                {selectedLead.company_name && <p className="text-xs text-gray-500 mt-0.5">{selectedLead.company_name}</p>}
              </div>
              <button onClick={() => setSelectedLead(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 p-5 space-y-5">
              {/* Stage selector */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Move Stage</p>
                <div className="flex flex-wrap gap-1.5">
                  {STAGES.map(s => (
                    <button
                      key={s.status}
                      onClick={() => moveStage(selectedLead, s.status)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        selectedLead.status === s.status
                          ? `${s.bg} ${s.color} ring-1 ring-current`
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contact info */}
              <div className="space-y-2">
                {selectedLead.phone && (
                  <a href={`tel:${selectedLead.phone}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-[var(--brand-primary)]">
                    <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" /> {selectedLead.phone}
                  </a>
                )}
                {selectedLead.email && (
                  <a href={`mailto:${selectedLead.email}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-[var(--brand-primary)]">
                    <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" /> {selectedLead.email}
                  </a>
                )}
                {selectedLead.value && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <DollarSign className="h-3.5 w-3.5 text-gray-400 shrink-0" /> {fmtMoney(selectedLead.value)} est. value
                  </div>
                )}
                {selectedLead.source && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" /> Source: {selectedLead.source}
                  </div>
                )}
              </div>

              {selectedLead.notes && (
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-xs font-semibold text-gray-400 mb-1">Notes</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedLead.notes}</p>
                </div>
              )}

              {/* Quotes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Quotes</p>
                  <button
                    onClick={() => openAddQuote(selectedLead)}
                    className="text-xs font-semibold text-[var(--brand-primary)] hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> New Quote
                  </button>
                </div>
                {(selectedLead.quotes ?? []).length === 0 ? (
                  <p className="text-xs text-gray-300 italic">No quotes yet</p>
                ) : (
                  <div className="space-y-2">
                    {(selectedLead.quotes ?? []).map(q => (
                      <QuoteCard
                        key={q.id}
                        quote={q}
                        onEdit={(e) => openEditQuote(q, selectedLead, e)}
                        onDelete={(e) => deleteQuote(q, selectedLead.id, e)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Panel footer actions */}
            <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
              <button
                onClick={(e) => openEditLead(selectedLead, e)}
                className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl py-2.5 text-sm font-medium transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit Lead
              </button>
              <button
                onClick={(e) => deleteLead(selectedLead.id, e)}
                className="h-10 w-10 flex items-center justify-center rounded-xl border border-red-100 text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Lead modal ──────────────────────────────────────────── */}
      {showLeadForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowLeadForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">{editingLead ? 'Edit Lead' : 'Add Lead'}</h2>
              <button onClick={() => setShowLeadForm(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <form onSubmit={saveLead} className="p-6 space-y-4">
              <FormField label="Contact Name *">
                <input required value={leadForm.name} onChange={e => setLeadForm(p => ({ ...p, name: e.target.value }))} placeholder="Jane Smith" className={inputCls} />
              </FormField>
              <FormField label="Company Name">
                <input value={leadForm.company_name} onChange={e => setLeadForm(p => ({ ...p, company_name: e.target.value }))} placeholder="ABC Excavating" className={inputCls} />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Phone">
                  <input type="tel" value={leadForm.phone} onChange={e => setLeadForm(p => ({ ...p, phone: e.target.value }))} placeholder="(555) 000-0000" className={inputCls} />
                </FormField>
                <FormField label="Email">
                  <input type="email" value={leadForm.email} onChange={e => setLeadForm(p => ({ ...p, email: e.target.value }))} placeholder="jane@co.com" className={inputCls} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Source">
                  <select value={leadForm.source} onChange={e => setLeadForm(p => ({ ...p, source: e.target.value }))} className={inputCls}>
                    <option value="">Select…</option>
                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </FormField>
                <FormField label="Est. Value ($)">
                  <input type="number" min={0} value={leadForm.value} onChange={e => setLeadForm(p => ({ ...p, value: e.target.value }))} placeholder="5000" className={inputCls} />
                </FormField>
              </div>
              <FormField label="Pipeline Stage">
                <select value={leadForm.status} onChange={e => setLeadForm(p => ({ ...p, status: e.target.value as LeadStatus }))} className={inputCls}>
                  {STAGES.map(s => <option key={s.status} value={s.status}>{s.label}</option>)}
                </select>
              </FormField>
              <FormField label="Notes">
                <textarea value={leadForm.notes} onChange={e => setLeadForm(p => ({ ...p, notes: e.target.value }))} rows={3} placeholder="Job details, timeline, etc." className={`${inputCls} resize-none`} />
              </FormField>
              <button type="submit" disabled={savingLead} className="w-full py-3 rounded-xl bg-[var(--brand-dark)] text-white font-semibold text-sm hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50">
                {savingLead ? 'Saving…' : editingLead ? 'Update Lead' : 'Add Lead'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Add / Edit Quote modal ─────────────────────────────────────────── */}
      {quotingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setQuotingLead(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">{editingQuote ? 'Edit Quote' : 'New Quote'}</h2>
                <p className="text-xs text-gray-500 mt-0.5">For {quotingLead.name}</p>
              </div>
              <button onClick={() => setQuotingLead(null)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <form onSubmit={saveQuote} className="p-6 space-y-4">
              <FormField label="Job Name *">
                <input required value={quoteForm.job_name} onChange={e => setQuoteForm(p => ({ ...p, job_name: e.target.value }))} placeholder="Highway 10 gravel haul" className={inputCls} />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Material">
                  <input value={quoteForm.material} onChange={e => setQuoteForm(p => ({ ...p, material: e.target.value }))} placeholder="Crushed stone" className={inputCls} />
                </FormField>
                <FormField label="Location">
                  <input value={quoteForm.location} onChange={e => setQuoteForm(p => ({ ...p, location: e.target.value }))} placeholder="Exit 14 pit" className={inputCls} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Rate ($)">
                  <input type="number" min={0} step={0.01} value={quoteForm.rate} onChange={e => setQuoteForm(p => ({ ...p, rate: e.target.value }))} placeholder="85" className={inputCls} />
                </FormField>
                <FormField label="Per">
                  <select value={quoteForm.rate_type} onChange={e => setQuoteForm(p => ({ ...p, rate_type: e.target.value }))} className={inputCls}>
                    {RATE_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Est. Loads">
                  <input type="number" min={0} value={quoteForm.est_loads} onChange={e => setQuoteForm(p => ({ ...p, est_loads: e.target.value }))} placeholder="30" className={inputCls} />
                </FormField>
                <FormField label="Status">
                  <select value={quoteForm.status} onChange={e => setQuoteForm(p => ({ ...p, status: e.target.value as Quote['status'] }))} className={inputCls}>
                    {QUOTE_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </FormField>
              </div>
              <FormField label="Notes">
                <textarea value={quoteForm.notes} onChange={e => setQuoteForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Any specifics…" className={`${inputCls} resize-none`} />
              </FormField>
              {quoteForm.rate && quoteForm.est_loads && (
                <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-sm">
                  <span className="text-gray-500">Estimated total: </span>
                  <span className="font-bold text-green-700">${(parseFloat(quoteForm.rate) * parseInt(quoteForm.est_loads)).toLocaleString()}</span>
                </div>
              )}
              <button type="submit" disabled={savingQuote} className="w-full py-3 rounded-xl bg-[var(--brand-dark)] text-white font-semibold text-sm hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50">
                {savingQuote ? 'Saving…' : editingQuote ? 'Update Quote' : 'Create Quote'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LeadCard({
  lead, onSelect, onEdit, onDelete, onQuote, onMove,
}: {
  lead: Lead
  onSelect: () => void
  onEdit: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
  onQuote: () => void
  onMove: (lead: Lead, status: LeadStatus) => void
}) {
  const cfg = stageCfg(lead.status)
  const quoteCount = lead.quotes?.length ?? 0
  const nextStageIdx = STAGES.findIndex(s => s.status === lead.status) + 1
  const nextStage = nextStageIdx < STAGES.length ? STAGES[nextStageIdx] : null

  return (
    <div
      onClick={onSelect}
      className="bg-white rounded-xl border border-gray-200 p-3 cursor-pointer hover:shadow-sm hover:border-gray-300 transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{lead.name}</p>
          {lead.company_name && <p className="text-xs text-gray-500 truncate">{lead.company_name}</p>}
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.bg} ${cfg.color}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-400 mb-2.5">
        {lead.value != null && <span className="text-[var(--brand-primary)] font-semibold">{fmtMoney(lead.value)}</span>}
        {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</span>}
        {quoteCount > 0 && <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{quoteCount} quote{quoteCount !== 1 ? 's' : ''}</span>}
      </div>

      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
        {nextStage && lead.status !== 'won' && lead.status !== 'lost' && (
          <button
            onClick={() => onMove(lead, nextStage.status)}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold ${nextStage.bg} ${nextStage.color} transition-opacity hover:opacity-80`}
          >
            → {nextStage.label}
          </button>
        )}
        {lead.status !== 'won' && lead.status !== 'lost' && (
          <button
            onClick={onQuote}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <FileText className="h-3 w-3" /> Quote
          </button>
        )}
        {lead.status === 'won' && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-green-600">
            <CheckCircle2 className="h-3 w-3" /> Won
          </span>
        )}
        <button onClick={onEdit} className="h-6 w-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-[var(--brand-primary)]"><Pencil className="h-3 w-3" /></button>
        <button onClick={onDelete} className="h-6 w-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
      </div>
    </div>
  )
}

function QuoteCard({ quote, onEdit, onDelete }: {
  quote: Quote
  onEdit: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
}) {
  const statusColors: Record<Quote['status'], string> = {
    draft:    'bg-gray-100 text-gray-600',
    sent:     'bg-blue-100 text-blue-700',
    accepted: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-600',
  }
  const estTotal = quote.rate && quote.est_loads ? quote.rate * quote.est_loads : null

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm font-semibold text-gray-800">{quote.job_name}</p>
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColors[quote.status]}`}>
          {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-500">
        {quote.rate && <span>${quote.rate}/{quote.rate_type ?? 'load'}</span>}
        {quote.est_loads && <span>{quote.est_loads} loads</span>}
        {estTotal && <span className="font-semibold text-[var(--brand-primary)]">${estTotal.toLocaleString()}</span>}
      </div>
      {quote.material && <p className="text-xs text-gray-400 mt-1">{quote.material}{quote.location ? ` — ${quote.location}` : ''}</p>}
      <div className="flex gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
        <button onClick={onEdit} className="text-xs text-gray-500 hover:text-[var(--brand-primary)] flex items-center gap-1"><Pencil className="h-3 w-3" /> Edit</button>
        <span className="text-gray-200">|</span>
        <button onClick={onDelete} className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1"><Trash2 className="h-3 w-3" /> Delete</button>
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-600">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[var(--brand-primary)] bg-white'
