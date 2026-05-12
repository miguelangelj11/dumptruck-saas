'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCompanyId } from '@/lib/get-company-id'
import { getPlanGate } from '@/lib/plans'
import LockedFeature from '@/components/dashboard/locked-feature'
import {
  Plus, X, Loader2, Phone, Mail, Trash2, Pencil,
  LayoutList, Columns, ChevronDown, ChevronUp,
  TrendingUp, Calendar, Flame, Trophy, FileText,
  ArrowRight, CheckCircle2, Building2, MapPin, Star,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  PIPELINE_STAGES, ACTIVE_STAGES, JOB_TYPES, LEAD_SOURCES,
  PRIORITY_CONFIG, computeLeadScore, scoreColor, scoreBadgeClass,
  getStage, normalizeStage, type StageId,
} from '@/lib/crm/stages'

// ─── Types ────────────────────────────────────────────────────────────────────

type Lead = {
  id: string
  company_id: string
  name: string
  company_name: string | null
  phone: string | null
  email: string | null
  location: string | null
  source: string | null
  value: number | null
  status: string
  stage: string | null
  priority: string | null
  job_type: string | null
  estimated_revenue: number | null
  estimated_loads: number | null
  estimated_tons: number | null
  estimated_trucks: number | null
  expected_start_date: string | null
  job_duration_days: number | null
  rate: number | null
  rate_type: string | null
  next_follow_up_at: string | null
  last_contacted_at: string | null
  follow_up_count: number | null
  follow_up_notes: string | null
  contact_name: string | null
  contact_title: string | null
  converted_job_id: string | null
  converted_client_id: string | null
  converted_at: string | null
  win_amount: number | null
  ai_score: number | null
  lost_reason: string | null
  lost_reason_notes: string | null
  stage_entered_at: Record<string, string> | null
  notes: string | null
  created_at: string
  updated_at: string
  quotes?: Quote[]
}

type LeadNote = {
  id: string
  lead_id: string
  company_id: string
  note: string
  note_type: string
  created_by_name: string | null
  created_at: string
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STUCK_THRESHOLDS: Record<string, number> = {
  new_lead: 3, contacted: 5, quoted: 7, negotiating: 10, scheduled: 14,
}

const LOST_REASON_LABELS: Record<string, string> = {
  price: '💰 Price Too High', timing: '⏰ Bad Timing',
  competitor: '🏆 Lost to Competitor', no_response: '📵 No Response',
  wrong_fit: '❌ Wrong Fit', other: '📋 Other',
}

const NOTE_TYPE_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  note:       { icon: '📝', label: 'Note',       color: 'bg-gray-100 text-gray-700' },
  call:       { icon: '📞', label: 'Call',        color: 'bg-green-100 text-green-700' },
  email:      { icon: '✉️', label: 'Email',       color: 'bg-blue-100 text-blue-700' },
  text:       { icon: '💬', label: 'Text',        color: 'bg-purple-100 text-purple-700' },
  meeting:    { icon: '🤝', label: 'Meeting',     color: 'bg-amber-100 text-amber-700' },
  quote_sent: { icon: '📋', label: 'Quote Sent',  color: 'bg-orange-100 text-orange-700' },
  system:     { icon: '⚙️', label: 'System',      color: 'bg-gray-50 text-gray-400' },
}

const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${n}`
const fmtFull = (n: number) => `$${n.toLocaleString()}`

function fmtDate(s: string | null | undefined) {
  if (!s) return null
  return new Date(s + (s.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysSince(iso: string | null | undefined) {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

function getLeadStage(l: Lead): StageId { return normalizeStage(l) }
function getEffectiveRevenue(l: Lead) { return l.estimated_revenue ?? l.value ?? 0 }

function getDaysInStage(lead: Lead): number | null {
  const entry = lead.stage_entered_at?.[lead.stage ?? 'new_lead']
  if (!entry) return null
  return Math.floor((Date.now() - new Date(entry).getTime()) / 86400000)
}

function getAiInsights(l: Lead): { emoji: string; text: string }[] {
  const insights: { emoji: string; text: string }[] = []
  const daysSinceContact = daysSince(l.last_contacted_at)
  const daysToStart = l.expected_start_date
    ? Math.ceil((new Date(l.expected_start_date).getTime() - Date.now()) / 86400000)
    : null

  if (daysSinceContact !== null && daysSinceContact > 7)
    insights.push({ emoji: '⚠️', text: `Lead has gone cold (${daysSinceContact} days, no contact)` })
  const rev = getEffectiveRevenue(l)
  if (rev > 5000)
    insights.push({ emoji: '💰', text: `High-value opportunity (${fmtFull(rev)})` })
  if ((l.follow_up_count ?? 0) > 3)
    insights.push({ emoji: '🔄', text: 'Multiple follow-ups — consider closing or dropping' })
  if (daysToStart !== null && daysToStart >= 0 && daysToStart <= 7)
    insights.push({ emoji: '🚨', text: `Job starts in ${daysToStart} day${daysToStart !== 1 ? 's' : ''} — confirm details` })
  if (l.source === 'repeat_customer')
    insights.push({ emoji: '⭐', text: 'Repeat customer — high close probability' })
  if (l.source === 'referral')
    insights.push({ emoji: '👥', text: 'Referral lead — typically higher quality' })
  return insights
}

// ─── Empty forms ──────────────────────────────────────────────────────────────

const EMPTY_LEAD_FORM = {
  name: '', company_name: '', contact_name: '', contact_title: '',
  phone: '', email: '', location: '',
  source: '', priority: 'medium',
  job_type: '', estimated_revenue: '', estimated_loads: '',
  estimated_tons: '', estimated_trucks: '1',
  rate: '', rate_type: 'per_load',
  expected_start_date: '', job_duration_days: '',
  next_follow_up_at: '', last_contacted_at: '', follow_up_notes: '',
  notes: '', stage: 'new_lead',
}
type LeadForm = typeof EMPTY_LEAD_FORM

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CRMPage() {
  const supabase = createClient()

  const [leads,          setLeads]          = useState<Lead[]>([])
  const [loading,        setLoading]        = useState(true)
  const [companyId,      setCompanyId]      = useState<string | null>(null)
  const [plan,           setPlan]           = useState<string | null>(null)
  const [isSuperAdmin,   setIsSuperAdmin]   = useState(false)
  const [subOverride,    setSubOverride]    = useState<string | null>(null)

  const [view,           setView]           = useState<'pipeline' | 'list'>('pipeline')
  const [wonLostOpen,    setWonLostOpen]    = useState(false)

  // Lead modal
  const [showModal,      setShowModal]      = useState(false)
  const [editingLead,    setEditingLead]    = useState<Lead | null>(null)
  const [leadForm,       setLeadForm]       = useState<LeadForm>(EMPTY_LEAD_FORM)
  const [modalTab,       setModalTab]       = useState<'basic' | 'job' | 'followup'>('basic')
  const [savingLead,     setSavingLead]     = useState(false)
  const [initialStage,   setInitialStage]   = useState<string>('new_lead')

  // Detail panel
  const [selectedLead,   setSelectedLead]   = useState<Lead | null>(null)

  // Quote modal
  const [quotingLead,    setQuotingLead]    = useState<Lead | null>(null)
  const [editingQuote,   setEditingQuote]   = useState<Quote | null>(null)
  const [quoteForm,      setQuoteForm]      = useState({ job_name: '', material: '', location: '', rate: '', rate_type: 'load', est_loads: '', notes: '', status: 'draft' as Quote['status'] })
  const [savingQuote,    setSavingQuote]    = useState(false)

  // Convert to job
  const [convertLead,    setConvertLead]    = useState<Lead | null>(null)
  const [converting,     setConverting]     = useState(false)

  // List view
  const [listSort,       setListSort]       = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'created_at', dir: 'desc' })
  const [listStageFilter, setListStageFilter] = useState<string>('all')
  const [listSearch,     setListSearch]     = useState('')

  // Mobile stage tab
  const [mobileStage,    setMobileStage]    = useState<string>('new_lead')

  // Lost reason modal
  const [lostModal,      setLostModal]      = useState<{ lead: Lead; newStage: StageId } | null>(null)

  // Activity log
  const [detailTab,      setDetailTab]      = useState<'details' | 'activity'>('details')
  const [activityNotes,  setActivityNotes]  = useState<LeadNote[]>([])
  const [noteText,       setNoteText]       = useState('')
  const [noteType,       setNoteType]       = useState('note')
  const [loadingNotes,   setLoadingNotes]   = useState(false)
  const [userName,       setUserName]       = useState('')

  // Client autocomplete
  const [nameSuggestions, setNameSuggestions] = useState<{ id: string; name: string; phone: string | null; email: string | null }[]>([])

  // ── Data ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const cid = await getCompanyId()
      if (!cid) return
      setCompanyId(cid)

      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) setUserName(user.email.split('@')[0] ?? '')

      const [leadsRes, companyRes, quotesRes] = await Promise.all([
        supabase.from('leads').select('*').eq('company_id', cid).order('created_at', { ascending: false }),
        supabase.from('companies').select('plan, is_super_admin, subscription_override').eq('id', cid).maybeSingle(),
        supabase.from('quotes').select('*').eq('company_id', cid).order('created_at', { ascending: false }),
      ])

      const co = companyRes.data as Record<string, unknown> | null
      setPlan(co?.plan as string | null ?? null)
      setIsSuperAdmin(!!(co?.is_super_admin))
      setSubOverride(co?.subscription_override as string | null ?? null)

      const quotes = (quotesRes.data ?? []) as Quote[]
      const rawLeads = (leadsRes.data ?? []) as Lead[]
      setLeads(rawLeads.map(l => ({ ...l, quotes: quotes.filter(q => q.lead_id === l.id) })))
    } catch (err) {
      console.error('[CRM] fetchData error:', err)
      setLeads([])
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData() }, [fetchData])

  // Client autocomplete
  useEffect(() => {
    if (!companyId || leadForm.name.length < 2) { setNameSuggestions([]); return }
    supabase.from('client_companies')
      .select('id, name, phone, email')
      .eq('company_id', companyId)
      .ilike('name', `%${leadForm.name}%`)
      .limit(5)
      .then(({ data }: { data: typeof nameSuggestions | null }) => setNameSuggestions(data ?? []))
  }, [leadForm.name, companyId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch notes when detail panel opens or tab changes
  const fetchNotes = useCallback(async (leadId: string) => {
    if (!leadId) return
    setLoadingNotes(true)
    try {
      const { data } = await supabase.from('lead_notes').select('*').eq('lead_id', leadId).order('created_at', { ascending: false })
      setActivityNotes((data ?? []) as LeadNote[])
    } finally {
      setLoadingNotes(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedLead && detailTab === 'activity') fetchNotes(selectedLead.id)
  }, [selectedLead?.id, detailTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Plan gate ───────────────────────────────────────────────────────────────

  if (!loading) {
    const gate = getPlanGate({ plan, is_super_admin: isSuperAdmin, subscription_override: subOverride })
    if (!gate.can('crm_pipeline')) {
      return (
        <LockedFeature
          title="Growth Pipeline"
          description="Track leads, close jobs, and grow revenue — all in one place."
        />
      )
    }
  }

  // ── Derived stats ───────────────────────────────────────────────────────────

  const activeLeads  = leads.filter(l => !['won', 'lost'].includes(getLeadStage(l)))
  const wonLeads     = leads.filter(l => getLeadStage(l) === 'won')
  const lostLeads    = leads.filter(l => getLeadStage(l) === 'lost')
  const quotedLeads  = leads.filter(l => getLeadStage(l) === 'quoted')

  const totalPipelineRevenue = activeLeads.reduce((s, l) => s + getEffectiveRevenue(l), 0)
  const quotedRevenue        = quotedLeads.reduce((s, l) => s + getEffectiveRevenue(l), 0)

  const now = new Date()
  const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7)
  const scheduledThisWeek = leads.filter(l => {
    if (!l.expected_start_date) return false
    const d = new Date(l.expected_start_date)
    return d >= now && d <= weekEnd
  })

  const overdueFollowUps = activeLeads.filter(l =>
    l.next_follow_up_at && new Date(l.next_follow_up_at) < new Date()
  )

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const wonThisMonth = wonLeads.filter(l => l.updated_at && new Date(l.updated_at) >= monthStart)
  const closedThisMonth = leads.filter(l =>
    ['won', 'lost'].includes(getLeadStage(l)) && new Date(l.updated_at) >= monthStart
  )
  const winRate = closedThisMonth.length > 0
    ? Math.round((wonThisMonth.length / closedThisMonth.length) * 100)
    : 0

  const wonRevenue  = wonLeads.reduce((s, l) => s + getEffectiveRevenue(l), 0)
  const lostRevenue = lostLeads.reduce((s, l) => s + getEffectiveRevenue(l), 0)
  const avgDeal     = wonLeads.length > 0 ? Math.round(wonRevenue / wonLeads.length) : 0

  // ── CRUD ────────────────────────────────────────────────────────────────────

  function openAddLead(stageId?: string) {
    setEditingLead(null)
    setInitialStage(stageId ?? 'new_lead')
    setLeadForm({ ...EMPTY_LEAD_FORM, stage: stageId ?? 'new_lead' })
    setModalTab('basic')
    setShowModal(true)
  }

  function openDetailPanel(lead: Lead) {
    setSelectedLead(lead)
    setDetailTab('details')
    setActivityNotes([])
    setNoteText('')
    setNoteType('note')
  }

  function openEditLead(l: Lead, e?: React.MouseEvent) {
    e?.stopPropagation()
    setEditingLead(l)
    setLeadForm({
      name:               l.name,
      company_name:       l.company_name ?? '',
      contact_name:       l.contact_name ?? '',
      contact_title:      l.contact_title ?? '',
      phone:              l.phone ?? '',
      email:              l.email ?? '',
      location:           l.location ?? '',
      source:             l.source ?? '',
      priority:           l.priority ?? 'medium',
      job_type:           l.job_type ?? '',
      estimated_revenue:  l.estimated_revenue != null ? String(l.estimated_revenue) : '',
      estimated_loads:    l.estimated_loads != null ? String(l.estimated_loads) : '',
      estimated_tons:     l.estimated_tons != null ? String(l.estimated_tons) : '',
      estimated_trucks:   l.estimated_trucks != null ? String(l.estimated_trucks) : '1',
      rate:               l.rate != null ? String(l.rate) : '',
      rate_type:          l.rate_type ?? 'per_load',
      expected_start_date: l.expected_start_date ?? '',
      job_duration_days:  l.job_duration_days != null ? String(l.job_duration_days) : '',
      next_follow_up_at:  l.next_follow_up_at ? l.next_follow_up_at.slice(0, 16) : '',
      last_contacted_at:  l.last_contacted_at ? l.last_contacted_at.slice(0, 16) : '',
      follow_up_notes:    l.follow_up_notes ?? '',
      notes:              l.notes ?? '',
      stage:              getLeadStage(l),
    })
    setModalTab('basic')
    setShowModal(true)
  }

  async function saveLead(e: React.FormEvent) {
    e.preventDefault()
    if (!companyId || !leadForm.name.trim()) return
    setSavingLead(true)
    const n = (s: string) => s.trim() || null
    const num = (s: string) => s.trim() ? parseFloat(s) : null
    const partialLead = {
      estimated_revenue: num(leadForm.estimated_revenue),
      source: n(leadForm.source),
      phone: n(leadForm.phone),
      email: n(leadForm.email),
      last_contacted_at: n(leadForm.last_contacted_at),
      next_follow_up_at: n(leadForm.next_follow_up_at),
      stage: leadForm.stage,
      status: leadForm.stage,
    }
    const payload = {
      company_id:         companyId,
      name:               leadForm.name.trim(),
      company_name:       n(leadForm.company_name),
      contact_name:       n(leadForm.contact_name),
      contact_title:      n(leadForm.contact_title),
      phone:              n(leadForm.phone),
      email:              n(leadForm.email),
      location:           n(leadForm.location),
      source:             n(leadForm.source),
      priority:           leadForm.priority || 'medium',
      job_type:           n(leadForm.job_type),
      estimated_revenue:  num(leadForm.estimated_revenue),
      estimated_loads:    num(leadForm.estimated_loads),
      estimated_tons:     num(leadForm.estimated_tons),
      estimated_trucks:   num(leadForm.estimated_trucks),
      rate:               num(leadForm.rate),
      rate_type:          n(leadForm.rate_type),
      expected_start_date: n(leadForm.expected_start_date),
      job_duration_days:  leadForm.job_duration_days ? parseInt(leadForm.job_duration_days) : null,
      next_follow_up_at:  n(leadForm.next_follow_up_at),
      last_contacted_at:  n(leadForm.last_contacted_at),
      follow_up_notes:    n(leadForm.follow_up_notes),
      notes:              n(leadForm.notes),
      stage:              leadForm.stage,
      status:             leadForm.stage,
      ai_score:           computeLeadScore(partialLead),
      updated_at:         new Date().toISOString(),
    }
    if (editingLead) {
      const { data, error } = await supabase.from('leads').update(payload).eq('id', editingLead.id).select().single()
      if (error) { toast.error('Failed to save: ' + error.message); setSavingLead(false); return }
      if (data) {
        const updated = { ...editingLead, ...(data as Lead), quotes: editingLead.quotes }
        setLeads(prev => prev.map(l => l.id === editingLead.id ? updated : l))
        if (selectedLead?.id === editingLead.id) setSelectedLead(updated)
        toast.success('Lead updated')
      }
    } else {
      const { data, error } = await supabase.from('leads').insert(payload).select().single()
      if (error) { toast.error('Failed to add: ' + error.message); setSavingLead(false); return }
      if (data) {
        setLeads(prev => [{ ...(data as Lead), quotes: [] }, ...prev])
        toast.success('Lead added')
      }
    }
    setSavingLead(false)
    setShowModal(false)
  }

  async function deleteLead(id: string, e?: React.MouseEvent) {
    e?.stopPropagation()
    if (!confirm('Delete this lead?')) return
    await supabase.from('leads').delete().eq('id', id)
    setLeads(prev => prev.filter(l => l.id !== id))
    if (selectedLead?.id === id) setSelectedLead(null)
    toast.success('Lead deleted')
  }

  async function moveStage(lead: Lead, stageId: StageId) {
    if (stageId === 'lost') {
      setLostModal({ lead, newStage: stageId })
      return
    }
    await commitStageMove(lead, stageId, null, null)
  }

  async function commitStageMove(lead: Lead, stageId: StageId, lostReason: string | null, lostNotes: string | null) {
    const stageEnteredAt = { ...(lead.stage_entered_at ?? {}), [stageId]: new Date().toISOString() }
    const { error } = await supabase.from('leads').update({
      stage: stageId, status: stageId,
      lost_reason: lostReason,
      lost_reason_notes: lostNotes,
      stage_entered_at: stageEnteredAt,
      updated_at: new Date().toISOString(),
    }).eq('id', lead.id)
    if (error) { toast.error('Failed to move'); return }
    const updated = { ...lead, stage: stageId, status: stageId, lost_reason: lostReason, lost_reason_notes: lostNotes, stage_entered_at: stageEnteredAt }
    setLeads(prev => prev.map(l => l.id === lead.id ? updated : l))
    if (selectedLead?.id === lead.id) setSelectedLead(updated)
    // Auto-log stage change
    if (companyId) {
      await supabase.from('lead_notes').insert({
        lead_id: lead.id, company_id: companyId,
        note: `Stage → ${stageId.replace(/_/g, ' ')}${lostReason ? ` — ${lostReason.replace(/_/g, ' ')}` : ''}`,
        note_type: 'system', created_by_name: 'System',
      })
    }
    setLostModal(null)
  }

  // ── Convert to Job ──────────────────────────────────────────────────────────

  async function handleConvert() {
    if (!convertLead || !companyId) return
    setConverting(true)
    const jt = JOB_TYPES.find(j => j.id === convertLead.job_type)
    const { data: newJob, error } = await supabase.from('jobs').insert({
      company_id: companyId,
      job_name:   convertLead.name,
      location:   convertLead.location,
      material:   jt?.label ?? null,
      rate:       convertLead.rate,
      rate_type:  convertLead.rate_type,
      status:     'active',
      contractor: convertLead.contact_name,
      notes:      convertLead.notes,
      start_date: convertLead.expected_start_date,
    }).select('id').single()
    if (error || !newJob) { toast.error('Failed to convert: ' + (error?.message ?? 'unknown')); setConverting(false); return }
    await supabase.from('leads').update({
      stage: 'active_job', status: 'active_job',
      converted_job_id: newJob.id,
      converted_at: new Date().toISOString(),
    }).eq('id', convertLead.id)
    const updated = { ...convertLead, stage: 'active_job', status: 'active_job', converted_job_id: newJob.id }
    setLeads(prev => prev.map(l => l.id === convertLead.id ? updated : l))
    if (selectedLead?.id === convertLead.id) setSelectedLead(updated)
    setConverting(false)
    setConvertLead(null)
    toast.success('Lead converted to active job!')
  }

  // ── Activity / Notes ────────────────────────────────────────────────────────

  async function addNote() {
    if (!noteText.trim() || !selectedLead || !companyId) return
    const contactTypes = ['call', 'email', 'text', 'meeting']
    await supabase.from('lead_notes').insert({
      lead_id: selectedLead.id, company_id: companyId,
      note: noteText.trim(), note_type: noteType,
      created_by_name: userName || null,
    })
    if (contactTypes.includes(noteType)) {
      const updated = { ...selectedLead, last_contacted_at: new Date().toISOString(), follow_up_count: (selectedLead.follow_up_count ?? 0) + 1 }
      await supabase.from('leads').update({ last_contacted_at: updated.last_contacted_at, follow_up_count: updated.follow_up_count }).eq('id', selectedLead.id)
      setLeads(prev => prev.map(l => l.id === selectedLead.id ? updated : l))
      setSelectedLead(updated)
    }
    setNoteText('')
    fetchNotes(selectedLead.id)
  }

  // ── Quote CRUD ──────────────────────────────────────────────────────────────

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
        setLeads(prev => prev.map(l => l.id === quotingLead.id ? { ...l, quotes: (l.quotes ?? []).map(qx => qx.id === editingQuote.id ? q : qx) } : l))
        if (selectedLead?.id === quotingLead.id) setSelectedLead(sl => sl ? { ...sl, quotes: (sl.quotes ?? []).map(qx => qx.id === editingQuote.id ? q : qx) } : sl)
        toast.success('Quote updated')
      }
    } else {
      const { data } = await supabase.from('quotes').insert(payload).select().single()
      if (data) {
        const q = data as Quote
        setLeads(prev => prev.map(l => l.id === quotingLead.id ? { ...l, quotes: [...(l.quotes ?? []), q] } : l))
        if (quotingLead.stage !== 'quoted' && quotingLead.stage !== 'negotiating') {
          await moveStage(quotingLead, 'quoted')
        }
        if (selectedLead?.id === quotingLead.id) setSelectedLead(sl => sl ? { ...sl, quotes: [...(sl.quotes ?? []), q] } : sl)
        toast.success('Quote created')
      }
    }
    setSavingQuote(false)
    setQuotingLead(null)
  }

  async function deleteQuote(q: Quote, leadId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Delete this quote?')) return
    await supabase.from('quotes').delete().eq('id', q.id)
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, quotes: (l.quotes ?? []).filter(qx => qx.id !== q.id) } : l))
    if (selectedLead?.id === leadId) setSelectedLead(sl => sl ? { ...sl, quotes: (sl.quotes ?? []).filter(qx => qx.id !== q.id) } : sl)
    toast.success('Quote deleted')
  }

  // ── List view ───────────────────────────────────────────────────────────────

  const sortedFilteredLeads = useMemo(() => {
    let arr = leads.filter(l => !['won', 'lost'].includes(getLeadStage(l)))
    if (listStageFilter !== 'all') arr = arr.filter(l => getLeadStage(l) === listStageFilter)
    if (listSearch.trim()) {
      const q = listSearch.toLowerCase()
      arr = arr.filter(l => l.name.toLowerCase().includes(q) || (l.contact_name ?? '').toLowerCase().includes(q))
    }
    arr = [...arr].sort((a, b) => {
      let av: unknown, bv: unknown
      if (listSort.col === 'name')               { av = a.name; bv = b.name }
      else if (listSort.col === 'stage')          { av = getLeadStage(a); bv = getLeadStage(b) }
      else if (listSort.col === 'revenue')        { av = getEffectiveRevenue(a); bv = getEffectiveRevenue(b) }
      else if (listSort.col === 'score')          { av = computeLeadScore(a); bv = computeLeadScore(b) }
      else if (listSort.col === 'follow_up')      { av = a.next_follow_up_at ?? ''; bv = b.next_follow_up_at ?? '' }
      else                                        { av = a.created_at; bv = b.created_at }
      if (av! < bv!) return listSort.dir === 'asc' ? -1 : 1
      if (av! > bv!) return listSort.dir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [leads, listStageFilter, listSearch, listSort])

  function toggleSort(col: string) {
    setListSort(prev => prev.col === col
      ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { col, dir: 'desc' })
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-full pb-20">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Growth Pipeline</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track leads, close jobs, grow revenue</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView('pipeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-all ${view === 'pipeline' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
            >
              <Columns className="h-3.5 w-3.5" /> Pipeline
            </button>
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-all ${view === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
            >
              <LayoutList className="h-3.5 w-3.5" /> List
            </button>
          </div>
          <button
            onClick={() => openAddLead()}
            className="flex items-center gap-2 bg-[var(--brand-dark)] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[var(--brand-primary-hover)] transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Lead
          </button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 px-6 pb-4">
          {[
            {
              label: 'Pipeline Revenue', value: fmt(totalPipelineRevenue),
              sub: 'across active stages', icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50',
            },
            {
              label: 'Active Quotes', value: String(quotedLeads.length),
              sub: fmt(quotedRevenue) + ' at stake', icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50',
            },
            {
              label: 'Starting This Week', value: String(scheduledThisWeek.length),
              sub: 'jobs scheduled', icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50',
            },
            {
              label: 'Follow-Ups Due', value: String(overdueFollowUps.length),
              sub: overdueFollowUps.length > 0 ? 'need attention' : 'all clear',
              icon: Flame, color: overdueFollowUps.length > 0 ? 'text-red-600' : 'text-gray-400', bg: overdueFollowUps.length > 0 ? 'bg-red-50' : 'bg-gray-50',
            },
            {
              label: 'Win Rate', value: winRate + '%',
              sub: wonThisMonth.length + ' won this month', icon: Trophy, color: 'text-purple-600', bg: 'bg-purple-50',
            },
          ].map(stat => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className={`inline-flex rounded-lg p-1.5 mb-2 ${stat.bg}`}>
                  <Icon className={`h-3.5 w-3.5 ${stat.color}`} />
                </div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{stat.sub}</p>
              </div>
            )
          })}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center flex-1 py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : !loading && leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-20 px-6 text-center">
          <span className="text-6xl block mb-4">📊</span>
          <h3 className="text-lg font-bold text-gray-900 mb-2">No leads yet</h3>
          <p className="text-gray-500 mb-6 max-w-sm">Add your first lead to start tracking your pipeline and closing more jobs.</p>
          <button
            onClick={() => openAddLead()}
            className="px-6 py-3 bg-[var(--brand-dark)] text-white font-bold rounded-xl hover:bg-[var(--brand-primary-hover)] transition-colors"
          >
            + Add Your First Lead
          </button>
        </div>
      ) : view === 'pipeline' ? (
        <>
          {/* ── DESKTOP: Horizontal kanban ── */}
          <div className="hidden md:block">
            <div className="flex gap-3 overflow-x-auto px-6 pb-4">
              {ACTIVE_STAGES.map(stage => {
                const stageLeads = leads.filter(l => getLeadStage(l) === stage.id)
                const stageRevenue = stageLeads.reduce((s, l) => s + getEffectiveRevenue(l), 0)
                return (
                  <div key={stage.id} className="flex-shrink-0 w-[260px] flex flex-col">
                    {/* Column header */}
                    <div className={`flex items-center justify-between rounded-xl px-3 py-2 mb-2 ${stage.bgClass}`}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{stage.emoji}</span>
                        <span className={`text-xs font-semibold ${stage.textClass}`}>{stage.label}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/60 ${stage.textClass}`}>{stageLeads.length}</span>
                      </div>
                      {stageRevenue > 0 && (
                        <span className="text-[10px] font-bold text-green-700">{fmt(stageRevenue)}</span>
                      )}
                    </div>
                    {/* Cards */}
                    <div className="flex flex-col gap-2 flex-1 min-h-[200px]">
                      {stageLeads.map(lead => (
                        <MiniLeadCard
                          key={lead.id}
                          lead={lead}
                          onSelect={() => openDetailPanel(lead)}
                          onMove={moveStage}
                        />
                      ))}
                      {stageLeads.length === 0 && (
                        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-100 rounded-xl text-gray-300 text-xs py-6">
                          Drop leads here
                        </div>
                      )}
                    </div>
                    {/* Add to stage */}
                    <button
                      onClick={() => openAddLead(stage.id)}
                      className="mt-2 w-full py-2 text-xs text-gray-400 hover:text-gray-600 border-2 border-dashed border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
                    >
                      + Add Lead
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── MOBILE: Vertical stage tabs ── */}
          <div className="md:hidden px-4">
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
              {ACTIVE_STAGES.map(stage => {
                const count = leads.filter(l => getLeadStage(l) === stage.id).length
                return (
                  <button
                    key={stage.id}
                    onClick={() => setMobileStage(stage.id)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      mobileStage === stage.id ? `${stage.bgClass} ${stage.textClass} ring-1 ring-current` : 'bg-white border border-gray-200 text-gray-500'
                    }`}
                  >
                    {stage.emoji} {stage.label}
                    {count > 0 && <span className="font-bold">{count}</span>}
                  </button>
                )
              })}
            </div>
            <div className="space-y-3">
              {leads.filter(l => getLeadStage(l) === mobileStage).map(lead => (
                <MiniLeadCard
                  key={lead.id}
                  lead={lead}
                  onSelect={() => openDetailPanel(lead)}
                  onMove={moveStage}
                  fullWidth
                />
              ))}
              {leads.filter(l => getLeadStage(l) === mobileStage).length === 0 && (
                <div className="text-center py-12 text-gray-300 text-sm">No leads in this stage</div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* ── LIST VIEW ── */
        <div className="px-6">
          {/* Lost reason analytics */}
          {lostLeads.length > 0 && (() => {
            const byReason = lostLeads.reduce<Record<string, number>>((acc, l) => {
              const r = l.lost_reason ?? 'unknown'
              acc[r] = (acc[r] ?? 0) + 1
              return acc
            }, {})
            return (
              <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-3">Lost Deal Analysis</p>
                <div className="flex gap-3 flex-wrap">
                  {Object.entries(byReason).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                    <div key={reason} className="flex items-center gap-1.5 text-xs bg-white px-2 py-1 rounded-lg border border-red-100">
                      <span>{LOST_REASON_LABELS[reason] ?? reason}</span>
                      <span className="font-bold text-red-600">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <input
              type="text"
              placeholder="Search leads…"
              value={listSearch}
              onChange={e => setListSearch(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-primary)] flex-1 min-w-[160px]"
            />
            <select
              value={listStageFilter}
              onChange={e => setListStageFilter(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-primary)]"
            >
              <option value="all">All Stages</option>
              {ACTIVE_STAGES.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}
            </select>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-gray-50">
                  <tr>
                    {[
                      { col: 'name', label: 'Lead' },
                      { col: 'stage', label: 'Stage' },
                      { col: 'revenue', label: 'Est. Revenue' },
                      { col: 'score', label: 'Score' },
                      { col: 'follow_up', label: 'Follow-Up' },
                    ].map(h => (
                      <th
                        key={h.col}
                        onClick={() => toggleSort(h.col)}
                        className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
                      >
                        {h.label}
                        {listSort.col === h.col && <span className="ml-1">{listSort.dir === 'asc' ? '↑' : '↓'}</span>}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sortedFilteredLeads.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-gray-400">No leads found</td></tr>
                  ) : sortedFilteredLeads.map(lead => {
                    const stage = getStage(getLeadStage(lead))
                    const score = computeLeadScore(lead)
                    const rev   = getEffectiveRevenue(lead)
                    const isOverdue = lead.next_follow_up_at && new Date(lead.next_follow_up_at) < new Date()
                    return (
                      <tr key={lead.id} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => openDetailPanel(lead)}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900">{lead.name}</p>
                          {lead.contact_name && <p className="text-xs text-gray-400">{lead.contact_name}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${stage.bgClass} ${stage.textClass}`}>
                            {stage.emoji} {stage.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{rev > 0 ? fmtFull(rev) : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreBadgeClass(score)}`}>{score}</span>
                        </td>
                        <td className="px-4 py-3">
                          {lead.next_follow_up_at ? (
                            <span className={`text-xs ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                              {isOverdue ? '🔥 ' : ''}{fmtDate(lead.next_follow_up_at)}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                            <button onClick={() => openEditLead(lead)} className="p-1.5 rounded-lg text-gray-400 hover:text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 transition-colors">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={(e) => deleteLead(lead.id, e)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
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
          </div>
        </div>
      )}

      {/* ── Won / Lost section ── */}
      {!loading && (wonLeads.length > 0 || lostLeads.length > 0) && (
        <div className="px-6 mt-4">
          <button
            onClick={() => setWonLostOpen(o => !o)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors mb-3"
          >
            {wonLostOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Won & Lost
            <span className="text-xs font-normal text-gray-400">({wonLeads.length} won · {lostLeads.length} lost)</span>
          </button>
          {wonLostOpen && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                <p className="text-xs text-green-600 font-semibold">Won This Month</p>
                <p className="text-2xl font-bold text-green-700 mt-1">{wonThisMonth.length}</p>
                <p className="text-xs text-green-600">{fmt(wonThisMonth.reduce((s, l) => s + getEffectiveRevenue(l), 0))}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                <p className="text-xs text-red-600 font-semibold">Lost Revenue</p>
                <p className="text-2xl font-bold text-red-700 mt-1">{fmtFull(lostRevenue)}</p>
                <p className="text-xs text-red-500">{lostLeads.length} deal{lostLeads.length !== 1 ? 's' : ''} lost</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                <p className="text-xs text-purple-600 font-semibold">Win Rate</p>
                <p className="text-2xl font-bold text-purple-700 mt-1">{winRate}%</p>
                <p className="text-xs text-purple-500">of closed deals</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <p className="text-xs text-blue-600 font-semibold">Avg Deal Size</p>
                <p className="text-2xl font-bold text-blue-700 mt-1">{fmt(avgDeal)}</p>
                <p className="text-xs text-blue-500">per won job</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile FAB */}
      <button
        onClick={() => openAddLead()}
        className="md:hidden fixed bottom-6 right-6 z-30 h-14 w-14 rounded-full bg-[var(--brand-dark)] text-white shadow-xl flex items-center justify-center hover:bg-[var(--brand-primary-hover)] transition-colors"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* ── Lead Detail Slide-Over ── */}
      {selectedLead && (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={() => setSelectedLead(null)}>
          <div
            className="w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-gray-900 text-base truncate">{selectedLead.name}</h2>
                  {selectedLead.contact_name && <p className="text-xs text-gray-500 mt-0.5">{selectedLead.contact_name}{selectedLead.contact_title ? ` · ${selectedLead.contact_title}` : ''}</p>}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {(() => { const s = getStage(getLeadStage(selectedLead)); return (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.bgClass} ${s.textClass}`}>{s.emoji} {s.label}</span>
                    )})()}
                    {selectedLead.priority && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORITY_CONFIG[selectedLead.priority as keyof typeof PRIORITY_CONFIG]?.bgClass ?? 'bg-gray-100'} ${PRIORITY_CONFIG[selectedLead.priority as keyof typeof PRIORITY_CONFIG]?.textClass ?? 'text-gray-600'}`}>
                        {PRIORITY_CONFIG[selectedLead.priority as keyof typeof PRIORITY_CONFIG]?.label ?? selectedLead.priority}
                      </span>
                    )}
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreBadgeClass(computeLeadScore(selectedLead))}`}>
                      Score: {computeLeadScore(selectedLead)}
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedLead(null)} className="text-gray-400 hover:text-gray-600 mt-0.5">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Detail / Activity tabs */}
            <div className="flex border-b border-gray-100">
              {(['details', 'activity'] as const).map(tab => (
                <button key={tab} onClick={() => setDetailTab(tab)}
                  className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${detailTab === tab ? 'text-[var(--brand-primary)] border-b-2 border-[var(--brand-primary)]' : 'text-gray-400 hover:text-gray-600'}`}>
                  {tab === 'details' ? '📋 Details' : '🗒️ Activity'}
                </button>
              ))}
            </div>

            {detailTab === 'activity' ? (
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
                {/* Add note */}
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex gap-1.5 mb-2 flex-wrap">
                    {Object.entries(NOTE_TYPE_CONFIG).filter(([k]) => k !== 'system').map(([type, cfg]) => (
                      <button key={type} type="button" onClick={() => setNoteType(type)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all ${noteType === type ? cfg.color + ' ring-2 ring-offset-1 ring-gray-300' : 'bg-white border border-gray-200 text-gray-500'}`}>
                        {cfg.icon} {cfg.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <textarea
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder={`Log a ${noteType}…`}
                      rows={2}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:border-[var(--brand-primary)]"
                      onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) addNote() }}
                    />
                    <button onClick={addNote} disabled={!noteText.trim()}
                      className="px-3 py-2 bg-[var(--brand-dark)] text-white font-bold rounded-xl text-sm disabled:opacity-40 self-end">
                      Log
                    </button>
                  </div>
                </div>
                {/* Timeline */}
                {loadingNotes ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div>
                ) : activityNotes.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No activity logged yet</p>
                ) : (
                  <div className="space-y-2">
                    {activityNotes.map(n => {
                      const cfg = NOTE_TYPE_CONFIG[n.note_type] ?? NOTE_TYPE_CONFIG.note!
                      return (
                        <div key={n.id} className="flex gap-3 p-3 bg-white border border-gray-100 rounded-xl">
                          <span className="text-lg flex-shrink-0">{cfg.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                              {n.created_by_name && <span className="text-xs text-gray-400">{n.created_by_name}</span>}
                            </div>
                            <p className="text-sm text-gray-800 leading-relaxed">{n.note}</p>
                            <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* Quick actions */}
              <div className="grid grid-cols-3 gap-2">
                {selectedLead.phone && (
                  <a href={`tel:${selectedLead.phone}`} className="flex flex-col items-center gap-1 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs font-medium text-gray-700 transition-colors min-h-[44px] justify-center">
                    <Phone className="h-4 w-4" /> Call
                  </a>
                )}
                {selectedLead.email && (
                  <a href={`mailto:${selectedLead.email}`} className="flex flex-col items-center gap-1 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs font-medium text-gray-700 transition-colors min-h-[44px] justify-center">
                    <Mail className="h-4 w-4" /> Email
                  </a>
                )}
                <button onClick={() => { setQuotingLead(selectedLead); setEditingQuote(null); setQuoteForm({ job_name: '', material: '', location: '', rate: '', rate_type: 'load', est_loads: '', notes: '', status: 'draft' }) }}
                  className="flex flex-col items-center gap-1 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs font-medium text-gray-700 transition-colors min-h-[44px] justify-center">
                  <FileText className="h-4 w-4" /> Quote
                </button>
              </div>

              {/* Convert to job */}
              {(getLeadStage(selectedLead) === 'scheduled' || getLeadStage(selectedLead) === 'active_job' || getLeadStage(selectedLead) === 'negotiating') && !selectedLead.converted_job_id && (
                <button
                  onClick={() => setConvertLead(selectedLead)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-[var(--brand-dark)] text-white rounded-xl text-sm font-semibold hover:bg-[var(--brand-primary-hover)] transition-colors"
                >
                  <ArrowRight className="h-4 w-4" /> Convert to Active Job
                </button>
              )}
              {selectedLead.converted_job_id && (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-100">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="text-xs font-medium text-green-700">Converted to active job</span>
                </div>
              )}

              {/* Move stage */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Move Stage</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {PIPELINE_STAGES.map(s => (
                    <button
                      key={s.id}
                      onClick={() => moveStage(selectedLead, s.id)}
                      className={`px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors text-center ${
                        getLeadStage(selectedLead) === s.id
                          ? `${s.bgClass} ${s.textClass} ring-1 ring-current`
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {s.emoji} {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2">
                {selectedLead.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <a href={`tel:${selectedLead.phone}`} className="hover:text-[var(--brand-primary)]">{selectedLead.phone}</a>
                  </div>
                )}
                {selectedLead.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <a href={`mailto:${selectedLead.email}`} className="hover:text-[var(--brand-primary)] truncate">{selectedLead.email}</a>
                  </div>
                )}
                {selectedLead.location && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span>{selectedLead.location}</span>
                  </div>
                )}
                {selectedLead.source && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span>{LEAD_SOURCES.find(s => s.id === selectedLead.source)?.label ?? selectedLead.source}</span>
                  </div>
                )}
              </div>

              {/* Revenue details */}
              {getEffectiveRevenue(selectedLead) > 0 && (
                <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-green-700">Estimated Revenue</span>
                    <span className="font-bold text-green-700">{fmtFull(getEffectiveRevenue(selectedLead))}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-green-600">
                    {(selectedLead.estimated_loads ?? 0) > 0 && <span>🚛 {selectedLead.estimated_loads} jobs</span>}
                    {(selectedLead.estimated_trucks ?? 0) > 0 && <span>🚚 {selectedLead.estimated_trucks} trucks</span>}
                    {(selectedLead.estimated_tons ?? 0) > 0 && <span>⚖️ {selectedLead.estimated_tons}T</span>}
                    {selectedLead.rate && <span>💲{selectedLead.rate}/{selectedLead.rate_type ?? 'job'}</span>}
                  </div>
                </div>
              )}

              {/* Job type + start */}
              {(selectedLead.job_type || selectedLead.expected_start_date) && (
                <div className="flex flex-wrap gap-2">
                  {selectedLead.job_type && (() => { const jt = JOB_TYPES.find(j => j.id === selectedLead.job_type); return jt ? (
                    <span className="text-xs bg-gray-100 px-2.5 py-1 rounded-full">{jt.emoji} {jt.label}</span>
                  ) : null })()}
                  {selectedLead.expected_start_date && (
                    <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">📅 Starts {fmtDate(selectedLead.expected_start_date)}</span>
                  )}
                  {selectedLead.job_duration_days && (
                    <span className="text-xs bg-gray-100 px-2.5 py-1 rounded-full">⏱ {selectedLead.job_duration_days}d job</span>
                  )}
                </div>
              )}

              {/* Follow-up */}
              {(selectedLead.next_follow_up_at || selectedLead.follow_up_notes) && (
                <div className={`p-3 rounded-xl border ${selectedLead.next_follow_up_at && new Date(selectedLead.next_follow_up_at) < new Date() ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
                  <p className="text-xs font-semibold text-amber-700 mb-1">Follow-Up</p>
                  {selectedLead.next_follow_up_at && (
                    <p className={`text-sm font-medium ${selectedLead.next_follow_up_at && new Date(selectedLead.next_follow_up_at) < new Date() ? 'text-red-700' : 'text-amber-700'}`}>
                      {new Date(selectedLead.next_follow_up_at) < new Date() ? '🔥 OVERDUE — ' : ''}
                      {fmtDate(selectedLead.next_follow_up_at)}
                    </p>
                  )}
                  {selectedLead.follow_up_notes && <p className="text-xs text-gray-600 mt-1">{selectedLead.follow_up_notes}</p>}
                </div>
              )}

              {/* AI Insights */}
              {(() => {
                const insights = getAiInsights(selectedLead)
                if (insights.length === 0) return null
                return (
                  <div className="p-3 bg-violet-50 rounded-xl border border-violet-100">
                    <p className="text-xs font-semibold text-violet-700 mb-2 flex items-center gap-1.5">
                      <Star className="h-3 w-3" /> AI Insights
                    </p>
                    <div className="space-y-1.5">
                      {insights.map((ins, i) => (
                        <p key={i} className="text-xs text-violet-700">{ins.emoji} {ins.text}</p>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Notes */}
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
                    onClick={() => { setQuotingLead(selectedLead); setEditingQuote(null); setQuoteForm({ job_name: '', material: '', location: '', rate: '', rate_type: 'load', est_loads: '', notes: '', status: 'draft' }) }}
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
                        onEdit={(e) => { setQuotingLead(selectedLead); setEditingQuote(q); setQuoteForm({ job_name: q.job_name, material: q.material ?? '', location: q.location ?? '', rate: q.rate != null ? String(q.rate) : '', rate_type: q.rate_type ?? 'load', est_loads: q.est_loads != null ? String(q.est_loads) : '', notes: q.notes ?? '', status: q.status }); e.stopPropagation() }}
                        onDelete={(e) => deleteQuote(q, selectedLead.id, e)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
            )} {/* end details tab */}

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
              <button
                onClick={() => openEditLead(selectedLead)}
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

      {/* ── Add / Edit Lead Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">{editingLead ? 'Edit Lead' : 'Add Lead'}</h2>
              <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              {(['basic', 'job', 'followup'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setModalTab(tab)}
                  className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${modalTab === tab ? 'text-[var(--brand-primary)] border-b-2 border-[var(--brand-primary)]' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {tab === 'basic' ? '👤 Basic' : tab === 'job' ? '🚛 Job Details' : '📅 Follow-Up'}
                </button>
              ))}
            </div>
            <form onSubmit={saveLead} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-4">

                {modalTab === 'basic' && (
                  <>
                    <FF label="Lead / Company Name *">
                      <div className="relative">
                        <input
                          required
                          value={leadForm.name}
                          onChange={e => setLeadForm(p => ({ ...p, name: e.target.value }))}
                          onBlur={() => setTimeout(() => setNameSuggestions([]), 150)}
                          placeholder="ABC Excavating"
                          className={inp}
                          autoComplete="off"
                        />
                        {nameSuggestions.length > 0 && (
                          <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                            {nameSuggestions.map(client => (
                              <button key={client.id} type="button"
                                onMouseDown={() => {
                                  setLeadForm(p => ({ ...p, name: client.name, phone: client.phone ?? p.phone, email: client.email ?? p.email }))
                                  setNameSuggestions([])
                                  toast.success(`Pre-filled from ${client.name}`)
                                }}
                                className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                              >
                                <p className="text-sm font-medium">{client.name}</p>
                                {client.phone && <p className="text-xs text-gray-400">{client.phone}</p>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </FF>
                    <div className="grid grid-cols-2 gap-3">
                      <FF label="Contact Name">
                        <input value={leadForm.contact_name} onChange={e => setLeadForm(p => ({ ...p, contact_name: e.target.value }))} placeholder="John Smith" className={inp} />
                      </FF>
                      <FF label="Contact Title">
                        <input value={leadForm.contact_title} onChange={e => setLeadForm(p => ({ ...p, contact_title: e.target.value }))} placeholder="Project Manager" className={inp} />
                      </FF>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FF label="Phone">
                        <input type="tel" value={leadForm.phone} onChange={e => setLeadForm(p => ({ ...p, phone: e.target.value }))} placeholder="(555) 000-0000" className={inp} />
                      </FF>
                      <FF label="Email">
                        <input type="email" value={leadForm.email} onChange={e => setLeadForm(p => ({ ...p, email: e.target.value }))} placeholder="john@abc.com" className={inp} />
                      </FF>
                    </div>
                    <FF label="Location">
                      <input value={leadForm.location} onChange={e => setLeadForm(p => ({ ...p, location: e.target.value }))} placeholder="City, State or project address" className={inp} />
                    </FF>
                    <div className="grid grid-cols-2 gap-3">
                      <FF label="Source">
                        <select value={leadForm.source} onChange={e => setLeadForm(p => ({ ...p, source: e.target.value }))} className={inp}>
                          <option value="">Select…</option>
                          {LEAD_SOURCES.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}
                        </select>
                      </FF>
                      <FF label="Priority">
                        <select value={leadForm.priority} onChange={e => setLeadForm(p => ({ ...p, priority: e.target.value }))} className={inp}>
                          <option value="low">⬇️ Low</option>
                          <option value="medium">➡️ Medium</option>
                          <option value="high">⬆️ High</option>
                          <option value="urgent">🚨 Urgent</option>
                        </select>
                      </FF>
                    </div>
                    <FF label="Pipeline Stage">
                      <select value={leadForm.stage} onChange={e => setLeadForm(p => ({ ...p, stage: e.target.value }))} className={inp}>
                        {PIPELINE_STAGES.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}
                      </select>
                    </FF>
                    <FF label="Notes">
                      <textarea value={leadForm.notes} onChange={e => setLeadForm(p => ({ ...p, notes: e.target.value }))} rows={3} placeholder="Job details, timeline, anything else…" className={`${inp} resize-none`} />
                    </FF>
                  </>
                )}

                {modalTab === 'job' && (
                  <>
                    <FF label="Job Type">
                      <select value={leadForm.job_type} onChange={e => setLeadForm(p => ({ ...p, job_type: e.target.value }))} className={inp}>
                        <option value="">Select…</option>
                        {JOB_TYPES.map(j => <option key={j.id} value={j.id}>{j.emoji} {j.label}</option>)}
                      </select>
                    </FF>
                    <FF label="Estimated Revenue ($)">
                      <input type="number" min={0} value={leadForm.estimated_revenue} onChange={e => setLeadForm(p => ({ ...p, estimated_revenue: e.target.value }))} placeholder="5000" className={inp} />
                    </FF>
                    <div className="grid grid-cols-3 gap-3">
                      <FF label="Est. Jobs">
                        <input type="number" min={0} value={leadForm.estimated_loads} onChange={e => setLeadForm(p => ({ ...p, estimated_loads: e.target.value }))} placeholder="30" className={inp} />
                      </FF>
                      <FF label="Est. Trucks">
                        <input type="number" min={1} value={leadForm.estimated_trucks} onChange={e => setLeadForm(p => ({ ...p, estimated_trucks: e.target.value }))} placeholder="2" className={inp} />
                      </FF>
                      <FF label="Est. Tons">
                        <input type="number" min={0} step={0.1} value={leadForm.estimated_tons} onChange={e => setLeadForm(p => ({ ...p, estimated_tons: e.target.value }))} placeholder="250" className={inp} />
                      </FF>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FF label="Rate ($)">
                        <input type="number" min={0} step={0.01} value={leadForm.rate} onChange={e => setLeadForm(p => ({ ...p, rate: e.target.value }))} placeholder="85" className={inp} />
                      </FF>
                      <FF label="Per">
                        <select value={leadForm.rate_type} onChange={e => setLeadForm(p => ({ ...p, rate_type: e.target.value }))} className={inp}>
                          <option value="per_load">Job</option>
                          <option value="per_ton">Ton</option>
                          <option value="per_hour">Hour</option>
                        </select>
                      </FF>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FF label="Expected Start">
                        <input type="date" value={leadForm.expected_start_date} onChange={e => setLeadForm(p => ({ ...p, expected_start_date: e.target.value }))} className={inp} />
                      </FF>
                      <FF label="Duration (days)">
                        <input type="number" min={1} value={leadForm.job_duration_days} onChange={e => setLeadForm(p => ({ ...p, job_duration_days: e.target.value }))} placeholder="5" className={inp} />
                      </FF>
                    </div>
                    {leadForm.estimated_revenue && (
                      <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-sm">
                        <span className="text-gray-500">Estimated total: </span>
                        <span className="font-bold text-green-700">{fmtFull(parseFloat(leadForm.estimated_revenue))}</span>
                      </div>
                    )}
                  </>
                )}

                {modalTab === 'followup' && (
                  <>
                    <FF label="Next Follow-Up Date">
                      <input type="datetime-local" value={leadForm.next_follow_up_at} onChange={e => setLeadForm(p => ({ ...p, next_follow_up_at: e.target.value }))} className={inp} />
                    </FF>
                    <FF label="Last Contacted">
                      <input type="datetime-local" value={leadForm.last_contacted_at} onChange={e => setLeadForm(p => ({ ...p, last_contacted_at: e.target.value }))} className={inp} />
                    </FF>
                    <FF label="Follow-Up Notes">
                      <textarea value={leadForm.follow_up_notes} onChange={e => setLeadForm(p => ({ ...p, follow_up_notes: e.target.value }))} rows={4} placeholder="What to discuss, objections, etc." className={`${inp} resize-none`} />
                    </FF>
                  </>
                )}
              </div>
              <div className="px-6 pb-6">
                <button type="submit" disabled={savingLead} className="w-full py-3 rounded-xl bg-[var(--brand-dark)] text-white font-semibold text-sm hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50">
                  {savingLead ? <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> : null}
                  {savingLead ? 'Saving…' : editingLead ? 'Update Lead' : 'Add Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Quote Modal ── */}
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
              <FF label="Job Name *">
                <input required value={quoteForm.job_name} onChange={e => setQuoteForm(p => ({ ...p, job_name: e.target.value }))} placeholder="Highway 10 gravel haul" className={inp} />
              </FF>
              <div className="grid grid-cols-2 gap-3">
                <FF label="Material">
                  <input value={quoteForm.material} onChange={e => setQuoteForm(p => ({ ...p, material: e.target.value }))} placeholder="Crushed stone" className={inp} />
                </FF>
                <FF label="Location">
                  <input value={quoteForm.location} onChange={e => setQuoteForm(p => ({ ...p, location: e.target.value }))} placeholder="Exit 14 pit" className={inp} />
                </FF>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FF label="Rate ($)">
                  <input type="number" min={0} step={0.01} value={quoteForm.rate} onChange={e => setQuoteForm(p => ({ ...p, rate: e.target.value }))} placeholder="85" className={inp} />
                </FF>
                <FF label="Per">
                  <select value={quoteForm.rate_type} onChange={e => setQuoteForm(p => ({ ...p, rate_type: e.target.value }))} className={inp}>
                    <option value="load">Job</option>
                    <option value="ton">Ton</option>
                    <option value="hour">Hour</option>
                  </select>
                </FF>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FF label="Est. Jobs">
                  <input type="number" min={0} value={quoteForm.est_loads} onChange={e => setQuoteForm(p => ({ ...p, est_loads: e.target.value }))} placeholder="30" className={inp} />
                </FF>
                <FF label="Status">
                  <select value={quoteForm.status} onChange={e => setQuoteForm(p => ({ ...p, status: e.target.value as Quote['status'] }))} className={inp}>
                    {(['draft', 'sent', 'accepted', 'rejected'] as const).map(s => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </FF>
              </div>
              <FF label="Notes">
                <textarea value={quoteForm.notes} onChange={e => setQuoteForm(p => ({ ...p, notes: e.target.value }))} rows={2} className={`${inp} resize-none`} />
              </FF>
              {quoteForm.rate && quoteForm.est_loads && (
                <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-sm">
                  <span className="text-gray-500">Est. total: </span>
                  <span className="font-bold text-green-700">{fmtFull(parseFloat(quoteForm.rate) * parseInt(quoteForm.est_loads))}</span>
                </div>
              )}
              <button type="submit" disabled={savingQuote} className="w-full py-3 rounded-xl bg-[var(--brand-dark)] text-white font-semibold text-sm hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50">
                {savingQuote ? 'Saving…' : editingQuote ? 'Update Quote' : 'Create Quote'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Lost Reason Modal ── */}
      {lostModal && (
        <LostReasonModal
          lead={lostModal.lead}
          onConfirm={(lostReason, lostNotes) => commitStageMove(lostModal.lead, 'lost', lostReason, lostNotes)}
          onCancel={() => setLostModal(null)}
        />
      )}

      {/* ── Convert to Job Modal ── */}
      {convertLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setConvertLead(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900 text-base">Convert Lead to Active Job</h2>
              <p className="text-xs text-gray-500 mt-0.5">This will create a job record and move the lead to Active Job</p>
            </div>
            <div className="p-6 space-y-3">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm font-semibold text-gray-900">{convertLead.name}</p>
                {convertLead.contact_name && <p className="text-xs text-gray-500">{convertLead.contact_name}</p>}
                {convertLead.location && <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="h-3 w-3" /> {convertLead.location}</p>}
                {getEffectiveRevenue(convertLead) > 0 && <p className="text-sm font-bold text-green-700 mt-1">{fmtFull(getEffectiveRevenue(convertLead))}</p>}
                {convertLead.expected_start_date && <p className="text-xs text-blue-600 mt-0.5">📅 Start: {fmtDate(convertLead.expected_start_date)}</p>}
              </div>
              <p className="text-xs text-gray-500">A job record will be created. You can then assign tickets and dispatch drivers from the Jobs dashboard.</p>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setConvertLead(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button onClick={handleConvert} disabled={converting} className="flex-1 py-2.5 rounded-xl bg-[var(--brand-dark)] text-white text-sm font-bold hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-60">
                  {converting ? <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> : null}
                  {converting ? 'Converting…' : '🚛 Convert to Job'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Mini Lead Card (kanban) ──────────────────────────────────────────────────

function MiniLeadCard({
  lead, onSelect, onMove, fullWidth = false,
}: {
  lead: Lead
  onSelect: () => void
  onMove: (lead: Lead, stage: StageId) => void
  fullWidth?: boolean
}) {
  const isOverdue = !!(lead.next_follow_up_at && new Date(lead.next_follow_up_at) < new Date())
  const daysSinceContact = daysSince(lead.last_contacted_at)
  const isCold = daysSinceContact !== null && daysSinceContact > 7
  const score = computeLeadScore(lead)
  const rev = getEffectiveRevenue(lead)
  const jt = JOB_TYPES.find(j => j.id === lead.job_type)
  const stage = getStage(getLeadStage(lead))
  const nextStageIdx = ACTIVE_STAGES.findIndex(s => s.id === stage.id) + 1
  const nextStage = nextStageIdx < ACTIVE_STAGES.length ? ACTIVE_STAGES[nextStageIdx] : null

  return (
    <div
      onClick={onSelect}
      className={`bg-white rounded-xl p-3.5 shadow-sm border cursor-pointer hover:shadow-md transition-all ${
        isOverdue ? 'border-red-200' : 'border-gray-100'
      } ${fullWidth ? 'w-full' : ''}`}
    >
      {/* Top: urgency + priority + score */}
      <div className="flex items-start justify-between mb-2 gap-1">
        <div className="flex flex-wrap gap-1">
          {isOverdue && (
            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-semibold">🔥 Due</span>
          )}
          {isCold && !isOverdue && (
            <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">⚠️ Cold</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className={`h-2 w-2 rounded-full ${scoreColor(score)}`} title={`Score: ${score}`} />
          {lead.priority && lead.priority !== 'medium' && (() => {
            const pc = PRIORITY_CONFIG[lead.priority as keyof typeof PRIORITY_CONFIG]
            return pc ? <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${pc.bgClass} ${pc.textClass}`}>{pc.label}</span> : null
          })()}
        </div>
      </div>

      {/* Name + contact */}
      <p className="text-sm font-bold text-gray-900 truncate">{lead.name}</p>
      {lead.contact_name && <p className="text-[11px] text-gray-500 truncate">{lead.contact_name}</p>}

      {/* Job type + location */}
      <div className="flex flex-wrap gap-1 mt-1.5">
        {jt && <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded-full">{jt.emoji} {jt.label}</span>}
        {lead.location && <span className="text-[10px] text-gray-400 truncate max-w-[100px]">📍 {lead.location}</span>}
      </div>

      {/* Revenue */}
      {rev > 0 && (
        <div className="mt-2 px-2 py-1.5 bg-green-50 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400">Est. Revenue</span>
            <span className="text-xs font-bold text-green-700">{fmt(rev)}</span>
          </div>
          {((lead.estimated_loads ?? 0) > 0 || (lead.estimated_trucks ?? 0) > 0) && (
            <div className="flex gap-2 mt-0.5 text-[10px] text-gray-400">
              {(lead.estimated_loads ?? 0) > 0 && <span>🚛 {lead.estimated_loads}L</span>}
              {(lead.estimated_trucks ?? 0) > 0 && <span>🚚 {lead.estimated_trucks}T</span>}
            </div>
          )}
        </div>
      )}

      {/* Start date */}
      {lead.expected_start_date && (
        <p className="text-[10px] text-gray-400 mt-1.5">📅 {fmtDate(lead.expected_start_date)}</p>
      )}

      {/* Stage velocity */}
      {(() => {
        const days = getDaysInStage(lead)
        if (days === null) return null
        const threshold = STUCK_THRESHOLDS[lead.stage ?? 'new_lead']
        const isStuck = threshold !== undefined && days >= threshold
        return (
          <div className={`flex items-center gap-1 text-[10px] mt-1 ${isStuck ? 'text-red-500' : 'text-gray-400'}`}>
            <span>{isStuck ? '🔴' : '⏱️'}</span>
            <span>{days}d in {(lead.stage ?? 'new_lead').replace(/_/g, ' ')}{isStuck ? ' — follow up!' : ''}</span>
          </div>
        )
      })()}

      {/* Actions */}
      <div className="flex gap-1.5 mt-2.5 pt-2.5 border-t border-gray-50" onClick={e => e.stopPropagation()}>
        {lead.phone && (
          <a href={`tel:${lead.phone}`} className="flex-1 py-1.5 text-center text-[10px] bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors">
            📞 Call
          </a>
        )}
        {nextStage && (
          <button
            onClick={() => onMove(lead, nextStage.id)}
            className={`flex-1 py-1.5 text-center text-[10px] ${nextStage.bgClass} ${nextStage.textClass} rounded-lg font-medium hover:opacity-80 transition-opacity`}
          >
            → {nextStage.label}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Quote Card ───────────────────────────────────────────────────────────────

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
      <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
        {quote.rate && <span>${quote.rate}/{quote.rate_type ?? 'job'}</span>}
        {quote.est_loads && <span>{quote.est_loads} jobs</span>}
        {estTotal && <span className="font-semibold text-[var(--brand-primary)]">${estTotal.toLocaleString()}</span>}
      </div>
      {quote.material && <p className="text-xs text-gray-400 mt-1">{quote.material}{quote.location ? ` — ${quote.location}` : ''}</p>}
      <div className="flex gap-2 mt-2" onClick={e => e.stopPropagation()}>
        <button onClick={onEdit} className="text-xs text-gray-500 hover:text-[var(--brand-primary)] flex items-center gap-1">
          <Pencil className="h-3 w-3" /> Edit
        </button>
        <span className="text-gray-200">|</span>
        <button onClick={onDelete} className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1">
          <Trash2 className="h-3 w-3" /> Delete
        </button>
      </div>
    </div>
  )
}

// ─── Lost Reason Modal ───────────────────────────────────────────────────────

function LostReasonModal({ lead, onConfirm, onCancel }: {
  lead: Lead
  onConfirm: (reason: string, notes: string) => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const reasons = [
    { id: 'price', label: '💰 Price Too High' },
    { id: 'timing', label: '⏰ Bad Timing' },
    { id: 'competitor', label: '🏆 Lost to Competitor' },
    { id: 'no_response', label: '📵 No Response' },
    { id: 'wrong_fit', label: '❌ Wrong Fit' },
    { id: 'other', label: '📋 Other' },
  ]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Mark Lead as Lost</h3>
        <p className="text-sm text-gray-500 mb-5">{lead.name} — Why did you lose this one?</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {reasons.map(r => (
            <button key={r.id} type="button" onClick={() => setReason(r.id)}
              className={`py-2.5 px-3 rounded-xl text-sm font-medium border-2 text-left transition-all ${reason === r.id ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              {r.label}
            </button>
          ))}
        </div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Any additional notes? (optional)" rows={2}
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none mb-5 focus:outline-none focus:border-[var(--brand-primary)]" />
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={() => onConfirm(reason, notes)} disabled={!reason}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white ${reason ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-300 cursor-not-allowed'}`}>
            Mark as Lost
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function FF({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-600">{label}</label>
      {children}
    </div>
  )
}

const inp = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[var(--brand-primary)] bg-white'
