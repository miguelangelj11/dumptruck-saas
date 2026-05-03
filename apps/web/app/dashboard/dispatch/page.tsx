'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Pencil, Trash2, Loader2, X, MapPin, Users, Truck,
  DollarSign, Calendar, ChevronDown, ChevronUp, Send,
  AlertTriangle, Clock, PackageOpen, TrendingUp, RefreshCw, Radio, Link2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Job, Load, Dispatch, DispatchStatus } from '@/lib/types'
import { getCompanyId } from '@/lib/get-company-id'
import { logDispatchActivity } from '@/lib/workflows'

// ─── Types ────────────────────────────────────────────────────────────────────

type DriverBasic = { id: string; name: string }
type JobWithLoads = Job & { loads?: Load[] }
type ContractorBasic = { id: string; name: string; phone: string | null; email: string | null }

// ─── Config ───────────────────────────────────────────────────────────────────

const DISPATCH_STATUSES: { value: DispatchStatus; label: string; color: string; dot: string }[] = [
  { value: 'dispatched', label: 'Dispatched', color: 'bg-gray-100 text-gray-600',       dot: 'bg-gray-400'    },
  { value: 'accepted',   label: 'Accepted',   color: 'bg-blue-100 text-blue-700',       dot: 'bg-blue-500'    },
  { value: 'working',    label: 'Working',    color: 'bg-green-100 text-green-700',     dot: 'bg-green-500'   },
  { value: 'completed',  label: 'Completed',  color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  { value: 'cancelled',  label: 'Cancelled',  color: 'bg-red-100 text-red-700',         dot: 'bg-red-500'     },
  { value: 'declined',   label: 'Declined',   color: 'bg-orange-100 text-orange-700',   dot: 'bg-orange-500'  },
]

const NO_RESPONSE_CFG = { label: 'No Response', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' }
const ONE_HOUR_MS = 60 * 60 * 1000

function getDispCfg(d: Dispatch): { label: string; color: string; dot: string } {
  if (d.status === 'dispatched' && Date.now() - new Date(d.created_at).getTime() > ONE_HOUR_MS) {
    return NO_RESPONSE_CFG
  }
  return DISPATCH_STATUSES.find(s => s.value === d.status) ?? DISPATCH_STATUSES[0]!
}

const JOB_STATUSES = ['active', 'completed', 'on_hold'] as const

const jobStatusCfg = {
  active:    { label: 'Active',    color: 'bg-green-100 text-green-700'   },
  completed: { label: 'Completed', color: 'bg-blue-100 text-blue-700'     },
  on_hold:   { label: 'On Hold',   color: 'bg-yellow-100 text-yellow-700' },
}

const RATE_TYPES = ['load', 'ton', 'hour']

const EMPTY_JOB = {
  job_name: '', contractor: '', location: '', material: '',
  rate: '', rate_type: 'load', status: 'active' as Job['status'],
  start_date: new Date().toISOString().split('T')[0]!, end_date: '', notes: '',
}

const EMPTY_DISPATCH = { job_id: '', driver_id: '', truck_number: '', start_time: '07:00', instructions: '' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString()
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DispatchPage() {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]!

  const [jobs,        setJobs]        = useState<JobWithLoads[]>([])
  const [dispatches,  setDispatches]  = useState<Dispatch[]>([])
  const [drivers,     setDrivers]     = useState<DriverBasic[]>([])
  const [contractors, setContractors] = useState<ContractorBasic[]>([])
  const [loading,     setLoading]     = useState(true)
  const [userId,      setUserId]      = useState('')
  const [orgId,       setOrgId]       = useState('')

  const [mainTab,     setMainTab]     = useState<'board' | 'today' | 'subs'>('board')
  const [jobFilter,   setJobFilter]   = useState<'active' | 'on_hold' | 'completed' | 'all'>('active')
  const [expandedJob, setExpandedJob] = useState<string | null>(null)

  // Job form
  const [showJobForm,  setShowJobForm]  = useState(false)
  const [editingJob,   setEditingJob]   = useState<Job | null>(null)
  const [jobForm,      setJobForm]      = useState(EMPTY_JOB)
  const [savingJob,    setSavingJob]    = useState(false)

  // Dispatch form
  const [showDispForm,     setShowDispForm]     = useState(false)
  const [editingDispatch,  setEditingDispatch]  = useState<Dispatch | null>(null)
  const [dispForm,         setDispForm]         = useState(EMPTY_DISPATCH)
  const [savingDispatch,   setSavingDispatch]   = useState(false)
  const [dispFormType,     setDispFormType]     = useState<'driver' | 'subcontractor'>('driver')
  const [subcontractorId,  setSubcontractorId]  = useState('')

  // ── Data ────────────────────────────────────────────────────────────────────

  async function getUid(): Promise<string | null> {
    if (userId) return userId
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setUserId(user.id)
    return user?.id ?? null
  }

  async function fetchData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)

    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const cutoff = sixMonthsAgo.toISOString().split('T')[0]!

    const companyId = await getCompanyId()
    if (!companyId) { setLoading(false); return }
    setOrgId(companyId)

    const [loadsRes, driversRes, jobsRes, dispRes, contractorsRes] = await Promise.all([
      supabase.from('loads').select('id,job_name,driver_name,truck_number,date,status,rate,rate_type').eq('company_id', companyId).gte('date', cutoff),
      supabase.from('drivers').select('id,name').eq('company_id', companyId).order('name'),
      supabase.from('jobs').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
      supabase.from('dispatches').select('*').eq('company_id', companyId).eq('dispatch_date', today).order('created_at', { ascending: false }),
      supabase.from('contractors').select('id,name,phone,email').eq('company_id', companyId).eq('status', 'active').order('name'),
    ])

    if (jobsRes.error && !jobsRes.error.message.includes('schema cache'))
      toast.error('Failed to load jobs: ' + jobsRes.error.message)

    console.log('[dispatch] companyId:', companyId)
    console.log('[dispatch] drivers returned:', driversRes.data?.length ?? 0, driversRes.error?.message ?? 'no error')
    console.log('[dispatch] drivers data:', driversRes.data)

    const loads = (loadsRes.data ?? []) as Load[]
    setJobs((jobsRes.data ?? []).map((j: Job) => ({ ...j, loads: loads.filter(l => l.job_name === j.job_name) })))
    setDrivers(driversRes.data ?? [])
    setContractors(contractorsRes.data ?? [])
    if (!dispRes.error || dispRes.error.message.includes('schema cache'))
      setDispatches((dispRes.data ?? []) as Dispatch[])

    // Auto-complete dispatches from previous days that are still in 'working' state
    if (companyId && !dispRes.error) {
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]!
      await supabase.from('dispatches')
        .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('company_id', companyId)
        .eq('status', 'working')
        .lte('dispatch_date', yesterdayStr)
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel('dispatch-status-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'dispatches' },
        (payload: { new: Record<string, unknown> }) => {
          const updated = payload.new as unknown as Dispatch
          setDispatches(prev => prev.map(d => d.id === updated.id ? { ...d, ...updated } : d))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // ── Derived ─────────────────────────────────────────────────────────────────

  const todayLoads       = jobs.flatMap(j => j.loads ?? []).filter(l => l.date === today)
  const todayRevenue     = todayLoads.reduce((s, l) => s + (l.rate ?? 0), 0)
  const noResponseCount  = dispatches.filter(d =>
    d.status === 'dispatched' && Date.now() - new Date(d.created_at).getTime() > ONE_HOUR_MS
  ).length
  const displayedJobs    = jobs.filter(j => jobFilter === 'all' || j.status === jobFilter)

  const driverDispatches = dispatches.filter(d => d.dispatch_type !== 'subcontractor')
  const subDispatches    = dispatches.filter(d => d.dispatch_type === 'subcontractor')

  const driverDispMap = new Map<string, Dispatch>()
  driverDispatches.forEach(d => { if (d.driver_id) driverDispMap.set(d.driver_id, d) })

  const jobDispMap = new Map<string, Dispatch[]>()
  dispatches.forEach(d => {
    if (!d.job_id) return
    if (!jobDispMap.has(d.job_id)) jobDispMap.set(d.job_id, [])
    jobDispMap.get(d.job_id)!.push(d)
  })

  const availableDrivers = drivers.filter(d => !driverDispMap.has(d.id))

  // ── Job CRUD ────────────────────────────────────────────────────────────────

  function openAddJob() { setEditingJob(null); setJobForm(EMPTY_JOB); setShowJobForm(true) }

  function openEditJob(j: Job, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingJob(j)
    setJobForm({
      job_name: j.job_name, contractor: j.contractor ?? '', location: j.location ?? '',
      material: j.material ?? '', rate: j.rate != null ? String(j.rate) : '',
      rate_type: j.rate_type ?? 'load', status: j.status,
      start_date: j.start_date ?? '', end_date: j.end_date ?? '', notes: j.notes ?? '',
    })
    setShowJobForm(true)
  }

  async function handleSaveJob(e: React.FormEvent) {
    e.preventDefault()
    if (!jobForm.job_name.trim()) { toast.error('Job name required'); return }
    const uid = await getUid(); if (!uid) { toast.error('Not authenticated'); return }
    setSavingJob(true)
    const payload = {
      job_name: jobForm.job_name.trim(), contractor: jobForm.contractor || null,
      location: jobForm.location || null, material: jobForm.material || null,
      rate: jobForm.rate ? parseFloat(jobForm.rate) : null, rate_type: jobForm.rate_type || null,
      status: jobForm.status, start_date: jobForm.start_date || null,
      end_date: jobForm.end_date || null, notes: jobForm.notes || null,
    }
    if (editingJob) {
      const { error } = await supabase.from('jobs').update(payload).eq('id', editingJob.id)
      if (error) { toast.error(error.message); setSavingJob(false); return }
      toast.success('Job updated')
      setJobs(prev => prev.map(j => j.id === editingJob.id ? { ...j, ...payload } : j))
    } else {
      const companyId = await getCompanyId()
      if (!companyId) { toast.error('Company not found'); setSavingJob(false); return }
      const { data, error } = await supabase.from('jobs').insert({ ...payload, company_id: companyId }).select().maybeSingle()
      if (error) { toast.error(error.message); setSavingJob(false); return }
      toast.success('Job created')
      if (data) setJobs(prev => [{ ...data, loads: [] }, ...prev])
    }
    setSavingJob(false); setShowJobForm(false)
  }

  async function handleDeleteJob(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Delete this job?')) return
    const { error } = await supabase.from('jobs').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Job deleted')
    setJobs(prev => prev.filter(j => j.id !== id))
    if (expandedJob === id) setExpandedJob(null)
  }

  async function updateJobStatus(id: string, status: Job['status']) {
    const { error } = await supabase.from('jobs').update({ status }).eq('id', id)
    if (error) { toast.error(error.message); return }
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status } : j))
  }

  // ── Dispatch CRUD ────────────────────────────────────────────────────────────

  function openDispatchFromJob(job: Job, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingDispatch(null)
    setDispFormType('driver')
    setSubcontractorId('')
    setDispForm({ ...EMPTY_DISPATCH, job_id: job.id })
    setShowDispForm(true)
  }

  function openNewDispatch(type: 'driver' | 'subcontractor' = 'driver') {
    setEditingDispatch(null)
    setDispFormType(type)
    setSubcontractorId('')
    setDispForm(EMPTY_DISPATCH)
    setShowDispForm(true)
  }

  function openEditDispatch(d: Dispatch) {
    setEditingDispatch(d)
    setDispFormType(d.dispatch_type ?? 'driver')
    setSubcontractorId(d.subcontractor_id ?? '')
    setDispForm({
      job_id: d.job_id ?? '',
      driver_id: d.driver_id ?? '',
      truck_number: d.truck_number ?? '',
      start_time: d.start_time ?? '07:00',
      instructions: d.instructions ?? '',
    })
    setShowDispForm(true)
  }

  async function handleSaveDispatch(e: React.FormEvent) {
    e.preventDefault()
    const isSub = dispFormType === 'subcontractor'
    if (!isSub && !dispForm.driver_id) { toast.error('Select a driver'); return }
    if (isSub && !subcontractorId) { toast.error('Select a subcontractor'); return }
    const uid = await getUid(); if (!uid) { toast.error('Not authenticated'); return }
    setSavingDispatch(true)

    const driver = drivers.find(d => d.id === dispForm.driver_id)
    const sub    = contractors.find(c => c.id === subcontractorId)
    const displayName = isSub ? (sub?.name ?? '') : (driver?.name ?? '')

    const payload = {
      driver_id:        isSub ? null : dispForm.driver_id,
      driver_name:      displayName,
      truck_number:     dispForm.truck_number || null,
      start_time:       dispForm.start_time || null,
      instructions:     dispForm.instructions || null,
      job_id:           dispForm.job_id || null,
      dispatch_type:    dispFormType,
      subcontractor_id: isSub ? subcontractorId : null,
    }

    if (editingDispatch) {
      const { error } = await supabase.from('dispatches')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editingDispatch.id)
      if (error) { toast.error(error.message); setSavingDispatch(false); return }
      toast.success('Dispatch updated')
      setDispatches(prev => prev.map(d => d.id === editingDispatch.id ? { ...d, ...payload } : d))
    } else {
      const companyId = await getCompanyId()
      if (!companyId) { toast.error('Company not found'); setSavingDispatch(false); return }
      const { data, error } = await supabase.from('dispatches')
        .insert({ ...payload, company_id: companyId, dispatch_date: today, status: 'dispatched', loads_completed: 0 })
        .select().maybeSingle()
      if (error) { toast.error(error.message); setSavingDispatch(false); return }
      toast.success(`${displayName} dispatched!`)
      if (data) {
        setDispatches(prev => [data as Dispatch, ...prev])
        const jobName = jobs.find(j => j.id === dispForm.job_id)?.job_name ?? ''
        const jobLocation = jobs.find(j => j.id === dispForm.job_id)?.location ?? ''
        logDispatchActivity(companyId, displayName, jobName, data.id, supabase)

        // Send email notification to driver or subcontractor
        if (!isSub && dispForm.driver_id) {
          const { data: driverRow } = await supabase
            .from('drivers')
            .select('email')
            .eq('id', dispForm.driver_id)
            .maybeSingle()
          if (driverRow?.email) {
            fetch('/api/dispatches/notify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                driverEmail:  driverRow.email,
                driverName:   displayName,
                jobName:      jobName || undefined,
                location:     jobLocation || undefined,
                startTime:    dispForm.start_time || undefined,
                truckNumber:  dispForm.truck_number || undefined,
                instructions: dispForm.instructions || undefined,
                dispatchId:   data.id,
                companyId,
              }),
            }).catch(err => console.error('[dispatch notify]', err))
          }
        }
        if (isSub && sub?.email) {
          fetch('/api/dispatches/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              driverEmail:  sub.email,
              driverName:   displayName,
              jobName:      jobName || undefined,
              location:     jobLocation || undefined,
              startTime:    dispForm.start_time || undefined,
              truckNumber:  dispForm.truck_number || undefined,
              instructions: dispForm.instructions || undefined,
              dispatchId:   data.id,
              companyId,
            }),
          }).catch(err => console.error('[dispatch notify sub]', err))
        }
      }
    }
    setSavingDispatch(false); setShowDispForm(false)
  }

  async function updateDispStatus(id: string, status: DispatchStatus) {
    const { error } = await supabase.from('dispatches')
      .update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { toast.error(error.message); return }
    setDispatches(prev => prev.map(d => d.id === id ? { ...d, status } : d))

    if (status === 'cancelled') {
      const disp = dispatches.find(d => d.id === id)
      const jobName = jobs.find(j => j.id === disp?.job_id)?.job_name
      if (disp?.driver_id) {
        const { data: driverRow } = await supabase.from('drivers').select('email').eq('id', disp.driver_id).maybeSingle()
        if (driverRow?.email) {
          fetch('/api/dispatches/cancel-notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ driverEmail: driverRow.email, driverName: disp.driver_name, jobName, type: 'cancelled' }),
          }).catch(err => console.error('[cancel-notify]', err))
        }
      }
      if (disp?.subcontractor_id) {
        const { data: subRow } = await supabase.from('contractors').select('email,name').eq('id', disp.subcontractor_id).maybeSingle()
        if (subRow?.email) {
          fetch('/api/dispatches/cancel-notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ driverEmail: subRow.email, driverName: subRow.name ?? disp.driver_name, jobName, type: 'cancelled' }),
          }).catch(err => console.error('[cancel-notify sub]', err))
        }
      }
    }
  }

  async function updateLoads(id: string, delta: number) {
    const disp = dispatches.find(d => d.id === id)
    if (!disp) return
    const n = Math.max(0, disp.loads_completed + delta)
    const { error } = await supabase.from('dispatches')
      .update({ loads_completed: n, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { toast.error(error.message); return }
    setDispatches(prev => prev.map(d => d.id === id ? { ...d, loads_completed: n } : d))
  }

  async function deleteDispatch(id: string) {
    if (!confirm('Remove this dispatch?')) return
    const disp = dispatches.find(d => d.id === id)
    const { error } = await supabase.from('dispatches').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Dispatch removed')
    setDispatches(prev => prev.filter(d => d.id !== id))

    const jobName = jobs.find(j => j.id === disp?.job_id)?.job_name
    if (disp?.driver_id) {
      const { data: driverRow } = await supabase.from('drivers').select('email').eq('id', disp.driver_id).maybeSingle()
      if (driverRow?.email) {
        fetch('/api/dispatches/cancel-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ driverEmail: driverRow.email, driverName: disp.driver_name, jobName, type: 'cancelled' }),
        }).catch(err => console.error('[cancel-notify]', err))
      }
    }
    if (disp?.subcontractor_id) {
      const { data: subRow } = await supabase.from('contractors').select('email,name').eq('id', disp.subcontractor_id).maybeSingle()
      if (subRow?.email) {
        fetch('/api/dispatches/cancel-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ driverEmail: subRow.email, driverName: subRow.name ?? disp.driver_name, jobName, type: 'cancelled' }),
        }).catch(err => console.error('[cancel-notify sub]', err))
      }
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-full">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dispatch</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {orgId && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(`https://dumptruckboss.com/portal?c=${orgId}`)
                toast.success('Portal link copied!')
              }}
              title="Copy driver portal link"
              className="h-9 px-3 rounded-xl border border-gray-200 flex items-center gap-1.5 text-gray-500 hover:bg-gray-50 transition-colors text-xs font-medium"
            >
              <Link2 className="h-3.5 w-3.5" /> Portal Link
            </button>
          )}
          <button
            onClick={fetchData}
            className="h-9 w-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={openAddJob}
            className="flex items-center gap-2 bg-[#1e3a2a] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#2d4a3a] transition-colors"
          >
            <Plus className="h-4 w-4" /> New Job
          </button>
        </div>
      </div>

      {/* Summary stats */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 pb-4">
          {[
            { icon: Send,          iconColor: 'text-blue-600',       bg: 'bg-blue-50',         label: 'Dispatched Today', value: String(dispatches.length),   alert: false },
            { icon: Truck,         iconColor: 'text-[#2d7a4f]',      bg: 'bg-[#2d7a4f]/10',    label: "Loads Today",      value: String(todayLoads.length),    alert: false },
            { icon: TrendingUp,    iconColor: 'text-[#2d7a4f]',      bg: 'bg-[#2d7a4f]/10',    label: "Today's Revenue",  value: `$${fmtMoney(todayRevenue)}`, alert: false },
            { icon: AlertTriangle, iconColor: noResponseCount > 0 ? 'text-yellow-600' : 'text-gray-400', bg: noResponseCount > 0 ? 'bg-yellow-100' : 'bg-gray-50', label: 'No Response', value: String(noResponseCount), alert: noResponseCount > 0 },
          ].map(({ icon: Icon, iconColor, bg, label, value, alert }) => (
            <div key={label} className={`rounded-2xl border p-4 ${alert ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-100'}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`h-7 w-7 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
                </div>
                <span className="text-xs font-medium text-gray-500">{label}</span>
              </div>
              <p className={`text-2xl font-bold ${alert ? 'text-yellow-700' : 'text-gray-900'}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Main tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mx-6 mb-5">
        {([
          ['board', 'Dispatch Board', null],
          ['today', 'Your Drivers',   driverDispatches.length],
          ['subs',  'Subcontractors', subDispatches.length],
        ] as [string, string, number | null][]).map(([tab, label, count]) => (
          <button
            key={tab}
            onClick={() => setMainTab(tab as 'board' | 'today' | 'subs')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              mainTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
            {count != null && count > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[1rem] px-1 text-[10px] font-bold bg-[#2d7a4f] text-white rounded-full">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1 py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>

      ) : mainTab === 'board' ? (
        /* ══════════════════════════════════════════════════════════════
           BOARD VIEW
        ══════════════════════════════════════════════════════════════ */
        <div className="px-6 pb-8">
          <div className="flex gap-6 items-start">

            {/* Left: job cards */}
            <div className="flex-1 min-w-0">
              {/* Job filter */}
              <div className="flex gap-1.5 mb-4 flex-wrap">
                {(['active', 'on_hold', 'completed', 'all'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setJobFilter(tab)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      jobFilter === tab ? 'bg-[#1e3a2a] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tab === 'on_hold' ? 'On Hold' : tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    {tab !== 'all' && (
                      <span className={`ml-1 ${jobFilter === tab ? 'text-white/60' : 'text-gray-400'}`}>
                        {jobs.filter(j => j.status === tab).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {displayedJobs.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
                  <Truck className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                  <p className="font-medium text-gray-400">No jobs</p>
                  <p className="text-sm text-gray-300 mt-1">Create a job to start dispatching</p>
                  <button onClick={openAddJob} className="mt-4 text-sm text-[#2d7a4f] font-medium">+ New Job</button>
                </div>
              ) : (
                <div className="space-y-3">
                  {displayedJobs.map(job => {
                    const cfg         = jobStatusCfg[job.status]
                    const expanded    = expandedJob === job.id
                    const jobDisps    = jobDispMap.get(job.id) ?? []
                    const jobLoads    = job.loads ?? []
                    const todayJLoads = jobLoads.filter(l => l.date === today)
                    const jobRevenue  = jobLoads.reduce((s, l) => s + (l.rate ?? 0), 0)

                    return (
                      <div key={job.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-gray-900 text-base leading-tight">{job.job_name}</h3>
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                                {job.contractor && <span className="flex items-center gap-1 text-xs text-gray-500"><Users className="h-3 w-3" />{job.contractor}</span>}
                                {job.location   && <span className="flex items-center gap-1 text-xs text-gray-500"><MapPin className="h-3 w-3" />{job.location}</span>}
                                {job.material   && <span className="flex items-center gap-1 text-xs text-gray-500"><PackageOpen className="h-3 w-3" />{job.material}</span>}
                                {job.rate != null && <span className="flex items-center gap-1 text-xs text-gray-500"><DollarSign className="h-3 w-3" />${job.rate}/{job.rate_type}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={e => openDispatchFromJob(job, e)}
                                className="flex items-center gap-1.5 bg-[#2d7a4f] hover:bg-[#245f3e] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                              >
                                <Send className="h-3 w-3" /> Dispatch
                              </button>
                              <button onClick={e => openEditJob(job, e)} className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={e => handleDeleteJob(job.id, e)} className="h-8 w-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => setExpandedJob(expanded ? null : job.id)} className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
                                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>

                          {/* Stats */}
                          <div className="grid grid-cols-4 gap-2 mt-3">
                            <div className="bg-blue-50 rounded-xl p-2.5 text-center">
                              <p className="text-lg font-bold text-blue-700">{jobDisps.length}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">Dispatched</p>
                            </div>
                            <div className="bg-green-50 rounded-xl p-2.5 text-center">
                              <p className="text-lg font-bold text-green-700">{todayJLoads.length}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">Loads Today</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                              <p className="text-lg font-bold text-gray-900">{jobLoads.length}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">Total Loads</p>
                            </div>
                            <div className="bg-[#2d7a4f]/5 rounded-xl p-2.5 text-center">
                              <p className="text-base font-bold text-[#2d7a4f] leading-tight">${fmtMoney(jobRevenue)}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">Revenue</p>
                            </div>
                          </div>

                          {/* Today's dispatch chips */}
                          {jobDisps.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {jobDisps.map(d => {
                                const sc = getDispCfg(d)
                                return (
                                  <span key={d.id} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${sc.color}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                                    {d.driver_name}{d.truck_number ? ` · #${d.truck_number}` : ''} · {sc.label}
                                  </span>
                                )
                              })}
                            </div>
                          )}
                        </div>

                        {/* Expanded */}
                        {expanded && (
                          <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-4">
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Job Status</p>
                              <div className="flex gap-2 flex-wrap">
                                {JOB_STATUSES.map(s => (
                                  <button key={s} onClick={() => updateJobStatus(job.id, s)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                      job.status === s ? 'bg-[#1e3a2a] text-white border-[#1e3a2a]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                                    }`}>
                                    {s === 'on_hold' ? 'On Hold' : s.charAt(0).toUpperCase() + s.slice(1)}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {(job.start_date || job.end_date) && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Schedule</p>
                                <div className="flex gap-4 text-sm text-gray-600">
                                  {job.start_date && <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-gray-400" />Start: {new Date(job.start_date + 'T00:00:00').toLocaleDateString()}</span>}
                                  {job.end_date   && <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-gray-400" />End: {new Date(job.end_date + 'T00:00:00').toLocaleDateString()}</span>}
                                </div>
                              </div>
                            )}
                            {job.notes && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                                <p className="text-sm text-gray-600">{job.notes}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Right: Driver status panel (desktop) */}
            <div className="hidden lg:block w-72 shrink-0">
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden sticky top-6">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="h-4 w-4 text-[#2d7a4f]" />
                    <h3 className="text-sm font-semibold text-gray-900">Driver Status</h3>
                  </div>
                  <span className="text-xs text-gray-400">{drivers.length} active</span>
                </div>

                <div className="divide-y divide-gray-50 max-h-[560px] overflow-y-auto">
                  {drivers.length === 0 ? (
                    <p className="p-6 text-center text-sm text-gray-400">No active drivers</p>
                  ) : drivers.map(driver => {
                    const disp = driverDispMap.get(driver.id)
                    const sc   = disp ? getDispCfg(disp) : null
                    const job  = disp?.job_id ? jobs.find(j => j.id === disp.job_id) : null
                    const minsAgo = disp ? Math.floor((Date.now() - new Date(disp.updated_at).getTime()) / 60000) : null
                    return (
                      <div key={driver.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start gap-2.5">
                          <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${sc ? sc.dot : 'bg-green-400'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-sm font-medium text-gray-900 truncate">{driver.name}</p>
                              {disp?.truck_number && (
                                <span className="text-[10px] text-gray-400 shrink-0">#{disp.truck_number}</span>
                              )}
                            </div>
                            {disp ? (
                              <>
                                <p className="text-xs text-gray-500 truncate mt-0.5">{job?.job_name ?? 'No job assigned'}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${sc!.color}`}>{sc!.label}</span>
                                  {disp.status === 'working' && (
                                    <span className="text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">
                                      {disp.loads_completed} loads
                                    </span>
                                  )}
                                  {disp.status === 'working' && minsAgo !== null && minsAgo < 120 && (
                                    <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                      <Clock className="h-2.5 w-2.5" />
                                      {minsAgo < 1 ? 'just now' : `${minsAgo}m ago`}
                                    </span>
                                  )}
                                </div>
                              </>
                            ) : (
                              <p className="text-xs text-green-600 font-medium mt-0.5">Available</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {availableDrivers.length > 0 && (
                  <div className="px-4 py-2.5 border-t border-gray-100 bg-green-50">
                    <p className="text-xs text-green-700 font-medium">
                      {availableDrivers.length} driver{availableDrivers.length !== 1 ? 's' : ''} available to dispatch
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      ) : mainTab === 'today' ? (
        /* ══════════════════════════════════════════════════════════════
           YOUR DRIVERS VIEW
        ══════════════════════════════════════════════════════════════ */
        <div className="px-6 pb-8">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{driverDispatches.length} driver dispatch{driverDispatches.length !== 1 ? 'es' : ''} today</p>
            <button
              onClick={() => openNewDispatch('driver')}
              className="flex items-center gap-2 bg-[#1e3a2a] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#2d4a3a] transition-colors"
            >
              <Plus className="h-4 w-4" /> Dispatch Driver
            </button>
          </div>

          {driverDispatches.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
              <Send className="h-10 w-10 mx-auto mb-3 text-gray-200" />
              <p className="font-medium text-gray-400">No dispatches today</p>
              <p className="text-sm text-gray-300 mt-1">Click "Dispatch" on a job card to assign drivers</p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="lg:hidden space-y-3">
                {driverDispatches.map(d => {
                  const sc       = getDispCfg(d)
                  const job      = d.job_id ? jobs.find(j => j.id === d.job_id) : null
                  const minsAgo  = Math.floor((Date.now() - new Date(d.updated_at).getTime()) / 60000)
                  const lastTicketLabel = d.status === 'working'
                    ? (minsAgo < 1 ? 'just now' : minsAgo < 60 ? `${minsAgo}m ago` : `${Math.floor(minsAgo / 60)}h ago`)
                    : null
                  return (
                    <div key={d.id} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-900">{d.driver_name}</p>
                          {d.truck_number && <p className="text-xs text-gray-500 mt-0.5">Truck #{d.truck_number}</p>}
                          {job && <p className="text-xs text-gray-500 mt-0.5">{job.job_name}</p>}
                          {d.start_time && <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><Clock className="h-3 w-3" />{d.start_time}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                          {d.status === 'working' && (
                            <span className="text-xs font-bold text-green-700">{d.loads_completed} loads</span>
                          )}
                          {lastTicketLabel && (
                            <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" /> last ticket {lastTicketLabel}
                            </span>
                          )}
                        </div>
                      </div>
                      {d.instructions && <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">{d.instructions}</p>}
                      <div className="flex items-center gap-2">
                        <select
                          value={d.status}
                          onChange={e => updateDispStatus(d.id, e.target.value as DispatchStatus)}
                          className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs bg-white focus:outline-none"
                        >
                          {DISPATCH_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                        <button onClick={() => openEditDispatch(d)} className="h-8 w-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-[#2d7a4f]"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => deleteDispatch(d.id)} className="h-8 w-8 rounded-lg border border-red-100 flex items-center justify-center text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden lg:block bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Driver', 'Truck', 'Job', 'Start', 'Loads', 'Last Ticket', 'Status', ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {driverDispatches.map(d => {
                      const sc      = getDispCfg(d)
                      const job     = d.job_id ? jobs.find(j => j.id === d.job_id) : null
                      const minsAgo = Math.floor((Date.now() - new Date(d.updated_at).getTime()) / 60000)
                      return (
                        <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{d.driver_name}</td>
                          <td className="px-4 py-3 text-gray-600">{d.truck_number ? `#${d.truck_number}` : <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate">{job?.job_name ?? <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                            {d.start_time
                              ? <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{d.start_time}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-bold ${d.status === 'working' ? 'text-green-700' : 'text-gray-900'}`}>
                              {d.loads_completed}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                            {d.status === 'working'
                              ? (minsAgo < 1 ? 'just now' : minsAgo < 60 ? `${minsAgo}m ago` : `${Math.floor(minsAgo / 60)}h ago`)
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={d.status}
                              onChange={e => updateDispStatus(d.id, e.target.value as DispatchStatus)}
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 cursor-pointer focus:outline-none ${sc.color}`}
                            >
                              {DISPATCH_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => openEditDispatch(d)} className="p-1.5 text-gray-400 hover:text-[#2d7a4f] transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                              <button onClick={() => deleteDispatch(d.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
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
        </div>

      ) : (
        /* ══════════════════════════════════════════════════════════════
           SUBCONTRACTORS VIEW
        ══════════════════════════════════════════════════════════════ */
        <div className="px-6 pb-8">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{subDispatches.length} subcontractor dispatch{subDispatches.length !== 1 ? 'es' : ''} today</p>
            <button
              onClick={() => openNewDispatch('subcontractor')}
              className="flex items-center gap-2 bg-[#1e3a2a] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#2d4a3a] transition-colors"
            >
              <Plus className="h-4 w-4" /> Dispatch Sub
            </button>
          </div>

          {subDispatches.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
              <Users className="h-10 w-10 mx-auto mb-3 text-gray-200" />
              <p className="font-medium text-gray-400">No subcontractors dispatched today</p>
              <p className="text-sm text-gray-300 mt-1">Click "Dispatch Sub" to assign a subcontractor to a job</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Subcontractor', 'Job', 'Start', 'Loads', 'Status', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {subDispatches.map(d => {
                    const sc  = getDispCfg(d)
                    const job = d.job_id ? jobs.find(j => j.id === d.job_id) : null
                    return (
                      <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 whitespace-nowrap">{d.driver_name}</p>
                          {d.truck_number && <p className="text-xs text-gray-400">#{d.truck_number}</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate">{job?.job_name ?? <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {d.start_time
                            ? <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{d.start_time}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-bold ${d.status === 'working' ? 'text-green-700' : 'text-gray-900'}`}>
                            {d.loads_completed}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={d.status}
                            onChange={e => updateDispStatus(d.id, e.target.value as DispatchStatus)}
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 cursor-pointer focus:outline-none ${sc.color}`}
                          >
                            {DISPATCH_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => openEditDispatch(d)} className="p-1.5 text-gray-400 hover:text-[#2d7a4f] transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => deleteDispatch(d.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          DISPATCH MODAL
      ══════════════════════════════════════════════════════════════ */}
      {showDispForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingDispatch ? 'Edit Dispatch' : dispFormType === 'subcontractor' ? 'Dispatch Subcontractor' : 'Dispatch a Driver'}
                </h2>
                {dispForm.job_id && (
                  <p className="text-sm text-gray-500 mt-0.5">{jobs.find(j => j.id === dispForm.job_id)?.job_name}</p>
                )}
              </div>
              <button onClick={() => setShowDispForm(false)} className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveDispatch} className="p-5 space-y-4">

              {/* Type selector (new dispatch only) */}
              {!editingDispatch && (
                <div className="flex gap-2">
                  {(['driver', 'subcontractor'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setDispFormType(t)}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                        dispFormType === t ? 'bg-[#1e3a2a] text-white border-[#1e3a2a]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {t === 'driver' ? 'Driver' : 'Subcontractor'}
                    </button>
                  ))}
                </div>
              )}

              {/* Job selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job</label>
                <select
                  value={dispForm.job_id}
                  onChange={e => setDispForm(f => ({ ...f, job_id: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/30 focus:border-[#2d7a4f]"
                >
                  <option value="">— No specific job —</option>
                  {jobs.filter(j => j.status === 'active').map(j => (
                    <option key={j.id} value={j.id}>{j.job_name}{j.location ? ` · ${j.location}` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Driver or Subcontractor */}
              {dispFormType === 'driver' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Driver *</label>
                  <select
                    required
                    value={dispForm.driver_id}
                    onChange={e => {
                      const dId = e.target.value
                      const d   = drivers.find(d => d.id === dId)
                      setDispForm(f => ({ ...f, driver_id: dId }))
                    }}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/30 focus:border-[#2d7a4f]"
                  >
                    <option value="">— Select a driver —</option>
                    {availableDrivers.length > 0 && (
                      <optgroup label="Available">
                        {availableDrivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </optgroup>
                    )}
                    {drivers.filter(d => driverDispMap.has(d.id)).length > 0 && (
                      <optgroup label="Already dispatched today">
                        {drivers.filter(d => driverDispMap.has(d.id)).map(d => (
                          <option key={d.id} value={d.id}>{d.name} ↩ dispatched</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  {availableDrivers.length === 0 && !editingDispatch && (
                    <p className="text-xs text-amber-600 mt-1">No available drivers.</p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subcontractor *</label>
                  <select
                    required
                    value={subcontractorId}
                    onChange={e => setSubcontractorId(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/30 focus:border-[#2d7a4f]"
                  >
                    <option value="">— Select a subcontractor —</option>
                    {contractors.map(c => (
                      <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>
                    ))}
                  </select>
                  {contractors.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">No subcontractors found. Add them in the Subcontractors section.</p>
                  )}
                </div>
              )}

              {/* Truck + Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Truck #</label>
                  <input
                    value={dispForm.truck_number}
                    onChange={e => setDispForm(f => ({ ...f, truck_number: e.target.value }))}
                    placeholder="e.g. 12"
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/30 focus:border-[#2d7a4f]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={dispForm.start_time}
                    onChange={e => setDispForm(f => ({ ...f, start_time: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/30 focus:border-[#2d7a4f]"
                  />
                </div>
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Special Instructions</label>
                <textarea
                  value={dispForm.instructions}
                  onChange={e => setDispForm(f => ({ ...f, instructions: e.target.value }))}
                  rows={3}
                  placeholder="Loading site details, contact, special notes…"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/30 focus:border-[#2d7a4f]"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowDispForm(false)} className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDispatch}
                  className="flex-1 h-11 rounded-xl bg-[#1e3a2a] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#2d4a3a] disabled:opacity-60"
                >
                  {savingDispatch && <Loader2 className="h-4 w-4 animate-spin" />}
                  {savingDispatch ? 'Saving…' : editingDispatch ? 'Save Changes' : 'Dispatch Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          JOB FORM MODAL
      ══════════════════════════════════════════════════════════════ */}
      {showJobForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editingJob ? 'Edit Job' : 'New Job'}</h2>
              <button onClick={() => setShowJobForm(false)} className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveJob} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Name *</label>
                <input required value={jobForm.job_name} onChange={e => setJobForm(f => ({ ...f, job_name: e.target.value }))} placeholder="e.g. Downtown Grading Phase 1" className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/30 focus:border-[#2d7a4f]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contractor</label>
                  <input value={jobForm.contractor} onChange={e => setJobForm(f => ({ ...f, contractor: e.target.value }))} placeholder="Contractor name" className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/30 focus:border-[#2d7a4f]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input value={jobForm.location} onChange={e => setJobForm(f => ({ ...f, location: e.target.value }))} placeholder="Job site address" className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/30 focus:border-[#2d7a4f]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Material</label>
                  <input value={jobForm.material} onChange={e => setJobForm(f => ({ ...f, material: e.target.value }))} placeholder="e.g. Gravel, Dirt" className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/30 focus:border-[#2d7a4f]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={jobForm.status} onChange={e => setJobForm(f => ({ ...f, status: e.target.value as Job['status'] }))} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/30">
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rate</label>
                  <input type="number" value={jobForm.rate} onChange={e => setJobForm(f => ({ ...f, rate: e.target.value }))} placeholder="0.00" className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/30 focus:border-[#2d7a4f]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Per</label>
                  <select value={jobForm.rate_type} onChange={e => setJobForm(f => ({ ...f, rate_type: e.target.value }))} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/30">
                    {RATE_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" value={jobForm.start_date} onChange={e => setJobForm(f => ({ ...f, start_date: e.target.value }))} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/30 focus:border-[#2d7a4f]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input type="date" value={jobForm.end_date} onChange={e => setJobForm(f => ({ ...f, end_date: e.target.value }))} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/30 focus:border-[#2d7a4f]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={jobForm.notes} onChange={e => setJobForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Any notes about this job…" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/30 focus:border-[#2d7a4f]" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowJobForm(false)} className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={savingJob} className="flex-1 h-11 rounded-xl bg-[#1e3a2a] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#2d4a3a] disabled:opacity-60">
                  {savingJob && <Loader2 className="h-4 w-4 animate-spin" />}
                  {savingJob ? 'Saving…' : editingJob ? 'Save Changes' : 'Create Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
