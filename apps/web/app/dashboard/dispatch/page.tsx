'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Pencil, Trash2, Loader2, X, MapPin, Users, Truck,
  DollarSign, Calendar, ChevronDown, ChevronUp, Send,
  AlertTriangle, Clock, PackageOpen, TrendingUp, RefreshCw, Radio, Link2, Smartphone,
  Mail, MessageSquare,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Job, Load, Dispatch, DispatchStatus, DriverRecommendation, RateInsight, DispatchOptimizationHint, ReceivedDispatch } from '@/lib/types'
import ReceivedDispatchCard from '@/components/dispatch/ReceivedDispatchCard'
import { getCompanyId } from '@/lib/get-company-id'
import LockedFeature from '@/components/dashboard/locked-feature'
import { logDispatchActivity, getRecommendedDriver, getRateInsights, getDispatchOptimizationHints } from '@/lib/workflows'

// ─── Types ────────────────────────────────────────────────────────────────────

type DriverBasic = { id: string; name: string; email: string | null; phone: string | null }
type JobWithLoads = Job & { loads?: Load[] }
type ContractorBasic = { id: string; name: string; phone: string | null; email: string | null }
type ClientCompanyBasic = { id: string; name: string; address: string | null }

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

type DriverStatus = 'not_started' | 'working' | 'completed'

function getDriverStatus(dispatch: Dispatch | undefined): DriverStatus {
  if (!dispatch) return 'not_started'
  if (dispatch.status === 'completed') return 'completed'
  if (dispatch.status === 'working') return 'working'
  if (dispatch.status === 'dispatched' && dispatch.loads_completed > 0) return 'working'
  return 'not_started'
}

const DRIVER_STATUS_CFG: Record<DriverStatus, { color: string; label: string; pulse: boolean }> = {
  not_started: { color: 'bg-gray-400',   label: 'Not started', pulse: false },
  working:     { color: 'bg-yellow-400', label: 'Working',     pulse: true  },
  completed:   { color: 'bg-green-500',  label: 'Completed',   pulse: false },
}

function DriverStatusDot({ dispatch }: { dispatch: Dispatch | undefined }) {
  const status = getDriverStatus(dispatch)
  const { color, label, pulse } = DRIVER_STATUS_CFG[status]
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${color} ${pulse ? 'animate-pulse' : ''}`} />
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  )
}

const JOB_STATUSES = ['active', 'completed', 'on_hold'] as const

const jobStatusCfg = {
  active:    { label: 'Active',    color: 'bg-green-100 text-green-700'   },
  completed: { label: 'Completed', color: 'bg-blue-100 text-blue-700'     },
  on_hold:   { label: 'On Hold',   color: 'bg-yellow-100 text-yellow-700' },
}

const RATE_TYPES = ['load', 'ton', 'hour']

const EMPTY_JOB = {
  job_name: '', contractor: '', pick_up_location: '', drop_location: '', material: '',
  rate: '', rate_type: 'load', status: 'active' as Job['status'],
  start_date: new Date().toISOString().split('T')[0]!, end_date: '', notes: '',
}

const EMPTY_DISPATCH = { job_id: '', driver_id: '', truck_number: '', start_time: '7:00 AM', end_time: '', estimated_loads: '', instructions: '' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString()
}

function toSmsHref(rawPhone: string, body: string): string {
  const digits = rawPhone.replace(/\D/g, '')
  // 10-digit → US number, prepend +1; 11-digit starting with 1 → already has country code
  const e164 = digits.length === 10
    ? `+1${digits}`
    : digits.length === 11 && digits.startsWith('1')
      ? `+${digits}`
      : `+${digits}`
  return `sms:${e164}?body=${encodeURIComponent(body)}`
}

async function copyMobileTicketLink(dispatchId: string) {
  const res = await fetch(`/api/ticket/link?id=${encodeURIComponent(dispatchId)}`)
  if (res.status === 403) {
    toast.error('Mobile Ticket requires the Growth plan. Upgrade in Settings → Billing.')
    return
  }
  if (!res.ok) { toast.error('Could not generate link.'); return }
  const { url } = await res.json() as { url: string }
  await navigator.clipboard.writeText(url)
  toast.success('📱 Mobile ticket link copied!')
}

// ─── Job Profit Panel ─────────────────────────────────────────────────────────

function JobProfitPanel({ job, revenue, supabase }: {
  job: JobWithLoads
  revenue: number
  supabase: ReturnType<typeof createClient>
}) {
  const r = job as Record<string, unknown>
  const [driverCost, setDriverCost] = useState(Number(r.driver_cost ?? 0))
  const [fuelCost,   setFuelCost]   = useState(Number(r.fuel_cost   ?? 0))
  const [otherCosts, setOtherCosts] = useState(Number(r.other_costs ?? 0))
  const [saving,     setSaving]     = useState(false)

  const totalCost  = driverCost + fuelCost + otherCosts
  const profit     = revenue - totalCost
  const profitPos  = profit >= 0

  async function saveCost(field: string, value: number) {
    setSaving(true)
    await supabase.from('jobs').update({ [field]: value }).eq('id', job.id)
    setSaving(false)
  }

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <TrendingUp className="h-3.5 w-3.5" /> Job Profit
        {saving && <Loader2 className="h-3 w-3 animate-spin ml-1 text-gray-400" />}
      </p>
      <div className="grid grid-cols-2 gap-2 mb-2">
        {([
          ['Driver Costs',  'driver_cost', driverCost, setDriverCost],
          ['Fuel Costs',    'fuel_cost',   fuelCost,   setFuelCost],
          ['Other Costs',   'other_costs', otherCosts, setOtherCosts],
        ] as [string, string, number, React.Dispatch<React.SetStateAction<number>>][]).map(([label, field, val, set]) => (
          <div key={field}>
            <label className="text-[10px] text-gray-400 font-medium">{label}</label>
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white mt-0.5">
              <span className="px-2 text-gray-400 text-xs">$</span>
              <input
                type="number" min={0} step={0.01}
                value={val}
                onChange={e => set(Number(e.target.value))}
                onBlur={() => saveCost(field, val)}
                className="flex-1 py-1.5 pr-2 text-sm text-gray-900 focus:outline-none bg-white"
              />
            </div>
          </div>
        ))}
        <div className={`rounded-lg p-2 flex flex-col justify-center ${profitPos ? 'bg-green-50' : 'bg-red-50'}`}>
          <p className="text-[10px] text-gray-400 font-medium">Net Profit</p>
          <p className={`text-base font-bold mt-0.5 ${profitPos ? 'text-green-700' : 'text-red-600'}`}>
            {profitPos ? '+' : '-'}${Math.abs(profit).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>Revenue: <span className="text-gray-700 font-medium">${revenue.toLocaleString()}</span></span>
        <span>Costs: <span className="text-gray-700 font-medium">${totalCost.toLocaleString()}</span></span>
      </div>
    </div>
  )
}

// ─── Timeline helpers ─────────────────────────────────────────────────────────

const TIMELINE_HOURS = Array.from({ length: 14 }, (_, i) => i + 5) // 5am–7pm

function parseTimeToHour(t: string): number {
  const isPM = /PM/i.test(t)
  const timeStr = t.replace(/\s*(AM|PM)\s*/i, '').trim()
  const parts = timeStr.split(':').map(Number)
  let hour = parts[0] ?? 8
  const min = parts[1] ?? 0
  if (isPM && hour !== 12) hour += 12
  if (!isPM && hour === 12) hour = 0
  return hour + min / 60
}

function parseTimeToMin(t: string): number {
  const isPM = /PM/i.test(t)
  const timeStr = t.replace(/\s*(AM|PM)\s*/i, '').trim()
  const parts = timeStr.split(':').map(Number)
  let hour = parts[0] ?? 0
  const min = parts[1] ?? 0
  if (isPM && hour !== 12) hour += 12
  if (!isPM && hour === 12) hour = 0
  return hour * 60 + min
}

function normalizeTimeToAmPm(t: string): string {
  if (!t) return ''
  if (/AM|PM/i.test(t)) return t
  const parts = t.split(':').map(Number)
  const h = parts[0]
  const m = parts[1] ?? 0
  if (h === undefined || isNaN(h)) return t
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

function DispatchTimeInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const isPM    = /PM/i.test(value)
  const period  = isPM ? 'PM' : 'AM'
  const timeStr = value.replace(/\s*(AM|PM)\s*/i, '').trim()
  const active  = timeStr.length > 0
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex rounded-xl border border-gray-200 overflow-hidden h-10 focus-within:ring-2 focus-within:ring-[var(--brand-primary)]/30 focus-within:border-[var(--brand-primary)]">
        <input
          type="text"
          value={timeStr}
          onChange={e => onChange(e.target.value ? `${e.target.value} ${period}` : '')}
          placeholder={placeholder ?? '8:00'}
          className="flex-1 px-3 text-sm focus:outline-none bg-white min-w-0"
        />
        <button type="button" onClick={() => onChange(timeStr ? `${timeStr} AM` : '')}
          className={`px-2.5 text-xs font-semibold border-l border-gray-200 transition-colors ${active && period === 'AM' ? 'bg-[var(--brand-primary)] text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
        >AM</button>
        <button type="button" onClick={() => onChange(timeStr ? `${timeStr} PM` : '')}
          className={`px-2.5 text-xs font-semibold border-l border-gray-200 transition-colors ${active && period === 'PM' ? 'bg-[var(--brand-primary)] text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
        >PM</button>
      </div>
    </div>
  )
}

type JobTemplate = {
  id: string; name: string; job_name: string | null; location: string | null
  material: string | null; rate: number | null; rate_type: string | null
  estimated_loads: number | null; notes: string | null; use_count: number
}

// ─── Timeline view (Step 3) ───────────────────────────────────────────────────
// 🗺️ Map view — coming when GPS is integrated

function TimelineView({ dispatches, drivers, jobs }: { dispatches: Dispatch[]; drivers: DriverBasic[]; jobs: JobWithLoads[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        {/* Time header */}
        <div className="flex border-b border-gray-100 min-w-[560px]">
          <div className="w-28 flex-shrink-0" />
          {TIMELINE_HOURS.map(h => (
            <div key={h} className="flex-1 text-[10px] text-gray-400 text-center py-2 border-l border-gray-50 min-w-[44px]">
              {h === 12 ? '12pm' : h > 12 ? `${h - 12}pm` : `${h}am`}
            </div>
          ))}
        </div>
        {/* Driver rows */}
        <div className="min-w-[560px]">
          {drivers.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">No drivers to show on timeline</p>
          ) : drivers.map(driver => {
            const driverDisps = dispatches.filter(d => d.driver_id === driver.id || d.driver_name === driver.name)
            return (
              <div key={driver.id} className="flex items-center border-b border-gray-50 last:border-0">
                <div className="w-28 flex-shrink-0 px-3 py-2">
                  <p className="text-xs font-semibold text-gray-800 truncate">{driver.name}</p>
                  <p className="text-[10px] text-gray-400">{driverDisps.length} job{driverDisps.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex-1 relative h-9 bg-gray-50">
                  {driverDisps.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-[10px] text-gray-300">Available</p>
                    </div>
                  )}
                  {driverDisps.map(d => {
                    if (!d.start_time) return null
                    const startH = parseTimeToHour(d.start_time)
                    const endTime = (d as Record<string, unknown>).end_time as string | null
                    const endH    = endTime ? parseTimeToHour(endTime) : startH + 4
                    const left    = Math.max(0, ((startH - 5) / 14) * 100)
                    const width   = Math.max(2, ((endH - startH) / 14) * 100)
                    const job     = d.job_id ? jobs.find(j => j.id === d.job_id) : null
                    const bg      = d.status === 'working'   ? 'bg-green-400'
                                  : d.status === 'completed' ? 'bg-emerald-500'
                                  : d.status === 'accepted'  ? 'bg-blue-400'
                                  : 'bg-amber-400'
                    return (
                      <div
                        key={d.id}
                        className={`absolute top-1 bottom-1 rounded flex items-center px-1.5 overflow-hidden ${bg} opacity-90 hover:opacity-100 transition-opacity cursor-default`}
                        style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}
                        title={`${d.driver_name} — ${job?.job_name ?? 'No job'} · ${d.start_time}${endTime ? ` → ${endTime}` : ''}`}
                      >
                        <p className="text-[10px] text-white font-medium truncate">{job?.job_name ?? d.driver_name}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Live activity feed (Step 11) ─────────────────────────────────────────────

function DispatchActivityFeed({ companyId, collapsed, onToggle }: { companyId: string; collapsed: boolean; onToggle: () => void }) {
  const t = useTranslations('dispatch')
  const supabase = createClient()
  const [activities, setActivities] = useState<{ id: string; type: string; message: string; created_at: string }[]>([])

  useEffect(() => {
    if (!companyId) return
    let active = true
    async function load() {
      const { data } = await supabase.from('activity_feed').select('id,type,message,created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(20)
      if (active) setActivities(data ?? [])
    }
    void load()
    const channel = supabase.channel('dispatch-activity-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_feed', filter: `company_id=eq.${companyId}` }, () => void load())
      .subscribe()
    return () => { active = false; void supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  function timeAgo(ts: string) {
    const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
    if (m < 1) return t('justNow')
    if (m < 60) return t('minutesAgo', { m })
    const h = Math.floor(m / 60)
    return h < 24 ? t('hoursAgo', { h }) : `${Math.floor(h / 24)}d ago`
  }

  return (
    <div className={`border-l border-gray-200 flex-shrink-0 transition-all duration-200 ${collapsed ? 'w-9' : 'w-56'} hidden xl:flex flex-col sticky top-0 max-h-screen`}>
      <div className={`flex items-center px-2 py-3 border-b border-gray-100 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Live Activity</span>}
        <button onClick={onToggle} className="text-gray-400 hover:text-gray-600 p-1 rounded" title={collapsed ? 'Show activity' : 'Hide activity'}>
          {collapsed ? '◀' : '▶'}
        </button>
      </div>
      {!collapsed && (
        <div className="overflow-y-auto flex-1">
          {activities.length === 0 ? (
            <p className="text-[11px] text-gray-400 p-3 text-center">No activity yet</p>
          ) : activities.map(a => (
            <div key={a.id} className="px-3 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50">
              <p className="text-[11px] text-gray-800 leading-relaxed">{a.message}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(a.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DispatchPage() {
  const t = useTranslations('dispatch')
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]!

  const [planLocked, setPlanLocked] = useState<null | { plan: string; price: number }>(null)
  const [jobs,           setJobs]           = useState<JobWithLoads[]>([])
  const [dispatches,     setDispatches]     = useState<Dispatch[]>([])
  const [drivers,        setDrivers]        = useState<DriverBasic[]>([])
  const [contractors,    setContractors]    = useState<ContractorBasic[]>([])
  const [clientCompanies, setClientCompanies] = useState<ClientCompanyBasic[]>([])
  const [loading,        setLoading]        = useState(true)
  const [userId,      setUserId]      = useState('')
  const [orgId,       setOrgId]       = useState('')
  const [companyPlan, setCompanyPlan] = useState<string | null>(null)
  const [dispatchBannerDismissed, setDispatchBannerDismissed] = useState(false)
  const [flashingIds, setFlashingIds] = useState<Set<string>>(new Set())

  // Ref mirrors dispatches for use inside realtime callbacks (avoids stale closure)
  const dispatchesRef = useRef<Dispatch[]>([])
  useEffect(() => { dispatchesRef.current = dispatches }, [dispatches])
  const lastToastRef  = useRef(0)

  const [receivedDispatches, setReceivedDispatches] = useState<ReceivedDispatch[]>([])
  const [sharingJobId,       setSharingJobId]       = useState<string | null>(null)

  const [mainTab,     setMainTab]     = useState<'board' | 'today' | 'subs' | 'received'>('board')
  const [jobFilter,   setJobFilter]   = useState<'active' | 'on_hold' | 'completed' | 'all'>('active')
  const [expandedJob, setExpandedJob] = useState<string | null>(null)

  // Step 3 — View mode (List | Timeline)
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list')

  // Step 5 — Templates
  const [templates,      setTemplates]      = useState<JobTemplate[]>([])
  const [savingTemplate, setSavingTemplate] = useState(false)

  // Step 4 — Conflict detection
  const [conflict, setConflict] = useState<{ id: string; job_name: string; start_time: string } | null>(null)

  // Step 6 — Copy yesterday
  const [yesterdayCount,   setYesterdayCount]   = useState(0)
  const [copyingYesterday, setCopyingYesterday] = useState(false)

  // Step 7 — Search / filter
  const [searchQuery,  setSearchQuery]  = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterDriver, setFilterDriver] = useState<string>('all')

  // Step 9 — Resend
  const [resendingId, setResendingId] = useState<string | null>(null)

  // Step 11 — Activity feed collapsed state
  const [activityCollapsed, setActivityCollapsed] = useState(true)

  // Job form
  const [showJobForm,     setShowJobForm]     = useState(false)
  const [editingJob,      setEditingJob]      = useState<Job | null>(null)
  const [jobForm,         setJobForm]         = useState(EMPTY_JOB)
  const [savingJob,       setSavingJob]       = useState(false)
  const [contractorMode,  setContractorMode]  = useState<'dropdown' | 'manual'>('dropdown')

  // Dispatch form
  const [showDispForm,     setShowDispForm]     = useState(false)
  const [editingDispatch,  setEditingDispatch]  = useState<Dispatch | null>(null)
  const [dispForm,         setDispForm]         = useState(EMPTY_DISPATCH)
  const [savingDispatch,   setSavingDispatch]   = useState(false)
  const [dispFormType,     setDispFormType]     = useState<'driver' | 'subcontractor'>('driver')
  const [subcontractorId,  setSubcontractorId]  = useState('')
  const [notifyVia,        setNotifyVia]        = useState<'email' | 'sms' | 'both' | 'none'>('email')

  // Bulk dispatch
  const [showBulkForm,   setShowBulkForm]   = useState(false)
  const [bulkJobId,      setBulkJobId]      = useState('')
  const [bulkStartTime,  setBulkStartTime]  = useState('7:00 AM')
  const [bulkNotifyVia,  setBulkNotifyVia]  = useState<'email' | 'sms' | 'both' | 'none'>('email')
  const [bulkSelections, setBulkSelections] = useState<Record<string, { selected: boolean; truckNumber: string }>>({})
  const [savingBulk,     setSavingBulk]     = useState(false)

  // AI Dispatch Brain
  const [recommendation,    setRecommendation]    = useState<DriverRecommendation | null>(null)
  const [loadingRec,        setLoadingRec]        = useState(false)
  const [rateInsight,       setRateInsight]       = useState<RateInsight | null>(null)
  const [optimizationHints, setOptimizationHints] = useState<DispatchOptimizationHint[]>([])
  const [hintsDismissed,    setHintsDismissed]    = useState(false)
  const rateInsightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Plan gate: Dispatch requires Owner Operator+
  useEffect(() => {
    getCompanyId().then(async id => {
      if (!id) return
      const { data } = await supabase.from('companies').select('plan, is_super_admin, subscription_override').eq('id', id).maybeSingle()
      if (data?.is_super_admin || data?.subscription_override) return
      const p = (data?.plan as string | null) ?? 'owner_operator'
      if (p === 'solo') setPlanLocked({ plan: 'Owner Operator Pro', price: 65 })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
    const yDate = yesterday.toISOString().split('T')[0]!

    const [loadsRes, driversRes, jobsRes, dispRes, contractorsRes, clientCoRes, coRes, rdRes, templatesRes, yCountRes] = await Promise.all([
      supabase.from('loads').select('id,job_name,driver_name,truck_number,date,status,rate,rate_type').eq('company_id', companyId).gte('date', cutoff),
      supabase.from('drivers').select('id,name,email,phone').eq('company_id', companyId).eq('status', 'active').order('name'),
      supabase.from('jobs').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
      supabase.from('dispatches').select('*').eq('company_id', companyId).eq('dispatch_date', today).order('created_at', { ascending: false }),
      supabase.from('contractors').select('id,name,phone,email').eq('company_id', companyId).eq('status', 'active').order('name'),
      supabase.from('client_companies').select('id,name,address').eq('company_id', companyId).order('name'),
      supabase.from('companies').select('plan').eq('id', companyId).maybeSingle(),
      supabase.from('received_dispatches').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
      supabase.from('job_templates').select('id,name,job_name,location,material,rate,rate_type,estimated_loads,notes,use_count').eq('company_id', companyId).order('use_count', { ascending: false }),
      supabase.from('dispatches').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('dispatch_date', yDate).neq('status', 'cancelled'),
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
    setClientCompanies((clientCoRes.data ?? []) as ClientCompanyBasic[])
    setCompanyPlan((coRes.data as Record<string, unknown> | null)?.plan as string | null ?? null)
    if (!dispRes.error || dispRes.error.message.includes('schema cache'))
      setDispatches((dispRes.data ?? []) as Dispatch[])
    if (!rdRes.error) setReceivedDispatches((rdRes.data ?? []) as ReceivedDispatch[])
    if (!templatesRes.error) setTemplates((templatesRes.data ?? []) as JobTemplate[])
    setYesterdayCount(yCountRes.count ?? 0)

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

    function handleNewTicket(newLoad: Record<string, unknown>) {
      const load = newLoad as Load & { dispatch_id?: string | null }

      // Append load to matching job (updates todayLoads + stats panel reactively)
      setJobs(prev => prev.map(j =>
        j.job_name === load.job_name
          ? { ...j, loads: [...(j.loads ?? []), load] }
          : j
      ))

      // Flip 'dispatched' → 'working' if this is their first ticket
      setDispatches(prev => prev.map(d => {
        const matchesDispatch = d.id === load.dispatch_id
        const matchesDriver   = d.driver_name === load.driver_name && d.dispatch_date === load.date
        if ((matchesDispatch || matchesDriver) && d.status === 'dispatched') {
          return { ...d, status: 'working' as DispatchStatus }
        }
        return d
      }))

      // Flash the dispatch card (find ID from ref to avoid stale closure)
      const target = dispatchesRef.current.find(d =>
        d.id === load.dispatch_id ||
        (d.driver_name === load.driver_name && d.dispatch_date === load.date)
      )
      if (target) {
        setFlashingIds(f => { const s = new Set(f); s.add(target.id); return s })
        setTimeout(() => setFlashingIds(f => { const s = new Set(f); s.delete(target.id); return s }), 650)
      }

      // Debounced toast — max 1 per 2 seconds
      const now = Date.now()
      if (now - lastToastRef.current > 2000) {
        lastToastRef.current = now
        toast(`🎫 New ticket from ${load.driver_name ?? 'a driver'}`, {
          duration: 3000,
          position: 'bottom-right',
        })
      }
    }

    const channel = supabase
      .channel('dispatch-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'dispatches' },
        (payload: { new: Record<string, unknown> }) => {
          const updated = payload.new as unknown as Dispatch
          setDispatches(prev => prev.map(d => d.id === updated.id ? { ...d, ...updated } : d))
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'loads' },
        (payload: { new: Record<string, unknown> }) => {
          handleNewTicket(payload.new)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch optimization hints on mount + every 10 minutes
  useEffect(() => {
    async function loadHints() {
      const companyId = await getCompanyId()
      if (!companyId) return
      try {
        const hints = await getDispatchOptimizationHints(supabase, companyId)
        setOptimizationHints(hints)
      } catch { /* non-critical */ }
    }
    loadHints()
    const id = setInterval(loadHints, 10 * 60 * 1000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch driver recommendation when dispatch form opens
  useEffect(() => {
    if (!showDispForm || dispFormType !== 'driver') { setRecommendation(null); return }
    let cancelled = false
    async function loadRec() {
      setLoadingRec(true)
      const companyId = await getCompanyId()
      if (!companyId || cancelled) { setLoadingRec(false); return }
      try {
        const rec = await getRecommendedDriver(supabase, { companyId })
        if (!cancelled) setRecommendation(rec)
      } catch { /* non-critical */ }
      if (!cancelled) setLoadingRec(false)
    }
    loadRec()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDispForm, dispFormType])

  // Step 4 — reactive conflict detection while filling dispatch form
  useEffect(() => {
    if (!showDispForm || editingDispatch || !dispForm.driver_id || !dispForm.start_time) { setConflict(null); return }
    let cancelled = false
    checkConflict(dispForm.driver_id, dispForm.start_time, dispForm.end_time).then(hit => {
      if (!cancelled) setConflict(hit)
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDispForm, dispForm.driver_id, dispForm.start_time, dispForm.end_time])

  // Debounced rate insight when job form material/rate changes
  useEffect(() => {
    if (rateInsightTimerRef.current) clearTimeout(rateInsightTimerRef.current)
    const mat  = jobForm.material?.trim()
    const rate = parseFloat(jobForm.rate)
    if (!mat || !rate || rate <= 0) { setRateInsight(null); return }
    rateInsightTimerRef.current = setTimeout(async () => {
      const companyId = await getCompanyId()
      if (!companyId) return
      try {
        const insight = await getRateInsights(supabase, { companyId, material: mat, rate })
        setRateInsight(insight)
      } catch { setRateInsight(null) }
    }, 500)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobForm.material, jobForm.rate])

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

  // Step 7 — filtered driver dispatches for Today tab
  const uniqueDriverNames = [...new Set(driverDispatches.map(d => d.driver_name).filter(Boolean))]
  const filteredDispatches = driverDispatches.filter(d => {
    const q = searchQuery.toLowerCase()
    const matchesSearch = !q || (d.driver_name ?? '').toLowerCase().includes(q) || (d.job_id ? (jobs.find(j => j.id === d.job_id)?.job_name ?? '').toLowerCase().includes(q) : false)
    const matchesStatus = filterStatus === 'all' || (() => {
      if (filterStatus === 'no_response') return d.status === 'dispatched' && Date.now() - new Date(d.created_at).getTime() > ONE_HOUR_MS
      return d.status === filterStatus
    })()
    const matchesDriver = filterDriver === 'all' || d.driver_name === filterDriver
    return matchesSearch && matchesStatus && matchesDriver
  })

  // Load counts per driver name → "suggested" driver in dispatch form
  const driverLoadCountMap = new Map<string, number>()
  todayLoads.forEach(l => {
    if (l.driver_name) driverLoadCountMap.set(l.driver_name, (driverLoadCountMap.get(l.driver_name) ?? 0) + 1)
  })
  const suggestedDriverId = availableDrivers.length > 0
    ? [...availableDrivers].sort((a, b) =>
        (driverLoadCountMap.get(a.name) ?? 0) - (driverLoadCountMap.get(b.name) ?? 0)
      )[0]?.id
    : null

  // ── Share job ────────────────────────────────────────────────────────────────

  async function shareJob(job: Job) {
    setSharingJobId(job.id)
    try {
      // Enable sharing if not already on
      let token = job.share_token
      if (!job.is_shared || !token) {
        const expires = new Date()
        expires.setDate(expires.getDate() + 30)
        const { data } = await supabase
          .from('jobs')
          .update({ is_shared: true, share_expires_at: expires.toISOString() })
          .eq('id', job.id)
          .select('share_token')
          .single()
        token = (data as { share_token: string | null } | null)?.share_token ?? token
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, is_shared: true, share_expires_at: expires.toISOString() } : j))
      }
      const url = `${window.location.origin}/dispatch/${token}`
      if (navigator.share) {
        await navigator.share({ title: `Dispatch: ${job.job_name}`, url })
      } else {
        await navigator.clipboard.writeText(url)
        toast.success('Share link copied to clipboard!')
      }
    } catch {
      toast.error('Failed to generate share link')
    } finally {
      setSharingJobId(null)
    }
  }

  // ── Job CRUD ────────────────────────────────────────────────────────────────

  function openAddJob() {
    setEditingJob(null)
    setJobForm(EMPTY_JOB)
    setContractorMode(clientCompanies.length > 0 ? 'dropdown' : 'manual')
    setShowJobForm(true)
  }

  function openEditJob(j: Job, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingJob(j)
    const r = j as Record<string, unknown>
    const existingContractor = (j.contractor ?? '') as string
    setJobForm({
      job_name: j.job_name,
      contractor: existingContractor,
      pick_up_location: (r.pick_up_location as string) ?? (j.location ?? ''),
      drop_location: (r.drop_location as string) ?? '',
      material: j.material ?? '',
      rate: j.rate != null ? String(j.rate) : '',
      rate_type: j.rate_type ?? 'load',
      status: j.status,
      start_date: j.start_date ?? '',
      end_date: j.end_date ?? '',
      notes: j.notes ?? '',
    })
    // If editing and contractor matches a saved client company, use dropdown; else manual
    const matched = clientCompanies.some(c => c.name === existingContractor)
    setContractorMode(matched || !existingContractor ? 'dropdown' : 'manual')
    setShowJobForm(true)
  }

  async function handleSaveJob(e: React.FormEvent) {
    e.preventDefault()
    if (!jobForm.job_name.trim()) { toast.error('Job name required'); return }
    const uid = await getUid(); if (!uid) { toast.error('Not authenticated'); return }
    setSavingJob(true)
    const payload = {
      job_name: jobForm.job_name.trim(), contractor: jobForm.contractor || null,
      pick_up_location: jobForm.pick_up_location || null, drop_location: jobForm.drop_location || null,
      material: jobForm.material || null,
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
    if (!confirm(t('deleteJobConfirm'))) return
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
    setNotifyVia('email')
    setDispForm({ ...EMPTY_DISPATCH, job_id: job.id })
    setShowDispForm(true)
  }

  function openBulkDispatch(job: Job, e: React.MouseEvent) {
    e.stopPropagation()
    setBulkJobId(job.id)
    setBulkStartTime('7:00 AM')
    setBulkNotifyVia('email')
    const init: Record<string, { selected: boolean; truckNumber: string }> = {}
    drivers.forEach(d => { init[d.id] = { selected: false, truckNumber: '' } })
    setBulkSelections(init)
    setShowBulkForm(true)
  }

  async function handleBulkDispatch(e: React.FormEvent) {
    e.preventDefault()
    const selected = drivers.filter(d => bulkSelections[d.id]?.selected)
    if (selected.length === 0) { toast.error('Select at least one driver'); return }
    const uid = await getUid(); if (!uid) { toast.error('Not authenticated'); return }
    const companyId = await getCompanyId()
    if (!companyId) { toast.error('Company not found'); return }
    setSavingBulk(true)

    const job     = jobs.find(j => j.id === bulkJobId)
    const jobName = job?.job_name ?? ''
    const jobLocation = job?.location ?? ''

    const inserts = selected.map(d => ({
      company_id:    companyId,
      driver_id:     d.id,
      driver_name:   d.name,
      truck_number:  bulkSelections[d.id]?.truckNumber || null,
      start_time:    bulkStartTime || null,
      job_id:        bulkJobId || null,
      dispatch_type: 'driver' as const,
      dispatch_date: today,
      status:        'dispatched' as const,
      loads_completed: 0,
    }))

    const { data: created, error } = await supabase
      .from('dispatches')
      .insert(inserts)
      .select()

    if (error) { toast.error(error.message); setSavingBulk(false); return }

    toast.success(`${selected.length} driver${selected.length !== 1 ? 's' : ''} dispatched!`)
    setDispatches(prev => [...(created as Dispatch[]), ...prev])

    // Log activity + send notifications
    for (const d of selected) {
      const row = created?.find((r: Record<string, unknown>) => r.driver_id === d.id)
      if (row) logDispatchActivity(companyId, d.name, jobName, row.id as string, supabase)

      const notifyPayload = {
        driverName: d.name, jobName: jobName || undefined,
        location: jobLocation || undefined, startTime: bulkStartTime || undefined,
        truckNumber: bulkSelections[d.id]?.truckNumber || undefined,
        dispatchId: row?.id as string | undefined, companyId,
      }

      if ((bulkNotifyVia === 'email' || bulkNotifyVia === 'both') && d.email) {
        fetch('/api/dispatches/notify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...notifyPayload, driverEmail: d.email }),
        }).catch(err => console.error('[bulk notify email]', err))
      }

      if ((bulkNotifyVia === 'sms' || bulkNotifyVia === 'both') && d.phone) {
        let acceptUrl = '', declineUrl = ''
        if (row?.id) {
          try {
            const linksRes = await fetch(`/api/dispatches/sms-links?id=${encodeURIComponent(row.id as string)}`)
            if (linksRes.ok) {
              const links = await linksRes.json() as { acceptUrl: string; declineUrl: string }
              acceptUrl  = links.acceptUrl
              declineUrl = links.declineUrl
            }
          } catch { /* send without links if fetch fails */ }
        }
        const msg = [
          `🚛 You've been dispatched!`,
          jobName       ? `Job: ${jobName}`              : null,
          jobLocation   ? `Location: ${jobLocation}`     : null,
          bulkStartTime ? `Start: ${bulkStartTime}`      : null,
          bulkSelections[d.id]?.truckNumber ? `Truck #${bulkSelections[d.id]?.truckNumber}` : null,
          `\nSubmit ticket: https://dumptruckboss.com/portal?c=${companyId}`,
          acceptUrl  ? `\n✅ Accept: ${acceptUrl}`  : null,
          declineUrl ? `❌ Decline: ${declineUrl}` : null,
        ].filter(Boolean).join('\n')
        window.open(toSmsHref(d.phone, msg), '_blank')
      }
    }

    setSavingBulk(false)
    setShowBulkForm(false)
  }

  function openNewDispatch(type: 'driver' | 'subcontractor' = 'driver') {
    setEditingDispatch(null)
    setDispFormType(type)
    setSubcontractorId('')
    setNotifyVia('email')
    setDispForm(EMPTY_DISPATCH)
    setShowDispForm(true)
  }

  function openEditDispatch(d: Dispatch) {
    setEditingDispatch(d)
    setDispFormType(d.dispatch_type ?? 'driver')
    setSubcontractorId(d.subcontractor_id ?? '')
    setConflict(null)
    setDispForm({
      job_id:          d.job_id          ?? '',
      driver_id:       d.driver_id       ?? '',
      truck_number:    d.truck_number    ?? '',
      start_time:      normalizeTimeToAmPm(d.start_time ?? '7:00 AM'),
      end_time:        normalizeTimeToAmPm((d as Record<string, unknown>).end_time as string ?? ''),
      estimated_loads: String((d as Record<string, unknown>).estimated_loads ?? ''),
      instructions:    d.instructions    ?? '',
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

    // Step 4 — conflict check before saving
    if (!isSub && dispForm.driver_id && dispForm.start_time && !editingDispatch) {
      const hit = await checkConflict(dispForm.driver_id, dispForm.start_time, dispForm.end_time)
      if (hit) {
        setConflict(hit)
        setSavingDispatch(false)
        return
      }
    }

    const payload = {
      driver_id:        isSub ? null : dispForm.driver_id,
      driver_name:      displayName,
      truck_number:     dispForm.truck_number || null,
      start_time:       dispForm.start_time || null,
      end_time:         dispForm.end_time   || null,
      estimated_loads:  dispForm.estimated_loads ? parseInt(dispForm.estimated_loads, 10) : null,
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

        // Resolve contact info for the dispatched party
        const driverFull = !isSub ? drivers.find(d => d.id === dispForm.driver_id) : null
        const contactEmail = isSub ? sub?.email : driverFull?.email
        const contactPhone = isSub ? sub?.phone : driverFull?.phone

        const notifyPayload = {
          driverName:   displayName,
          jobName:      jobName || undefined,
          location:     jobLocation || undefined,
          startTime:    dispForm.start_time || undefined,
          truckNumber:  dispForm.truck_number || undefined,
          instructions: dispForm.instructions || undefined,
          dispatchId:   data.id,
          companyId,
        }

        // Email notification
        if ((notifyVia === 'email' || notifyVia === 'both') && contactEmail) {
          fetch('/api/dispatches/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...notifyPayload, driverEmail: contactEmail }),
          }).catch(err => console.error('[dispatch notify email]', err))
        }

        // SMS notification — opens the device SMS app pre-filled
        if (notifyVia === 'sms' || notifyVia === 'both') {
          if (contactPhone) {
            let acceptUrl = '', declineUrl = ''
            try {
              const linksRes = await fetch(`/api/dispatches/sms-links?id=${encodeURIComponent(data.id)}`)
              if (linksRes.ok) {
                const links = await linksRes.json() as { acceptUrl: string; declineUrl: string }
                acceptUrl  = links.acceptUrl
                declineUrl = links.declineUrl
              }
            } catch { /* send without links if fetch fails */ }

            const msgLines = [
              `🚛 You've been dispatched!`,
              jobName      ? `Job: ${jobName}`                  : null,
              jobLocation  ? `Location: ${jobLocation}`         : null,
              dispForm.start_time   ? `Start: ${dispForm.start_time}`     : null,
              dispForm.truck_number ? `Truck #${dispForm.truck_number}`   : null,
              dispForm.instructions ? `Notes: ${dispForm.instructions}`   : null,
              `\nSubmit ticket: https://dumptruckboss.com/portal?c=${companyId}`,
              acceptUrl  ? `\n✅ Accept: ${acceptUrl}`  : null,
              declineUrl ? `❌ Decline: ${declineUrl}` : null,
            ].filter(Boolean).join('\n')
            window.open(toSmsHref(contactPhone, msgLines), '_blank')
          } else {
            toast.warning('No phone number on file — add one in the Drivers page to send texts')
          }
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

  // ── Step 4: Conflict detection ───────────────────────────────────────────────

  async function checkConflict(driverId: string, startTime: string, endTime: string, excludeId?: string): Promise<{ id: string; job_name: string; start_time: string } | null> {
    if (!driverId || !startTime) return null
    const companyId = await getCompanyId(); if (!companyId) return null
    const { data } = await supabase.from('dispatches')
      .select('id, job_id, start_time, end_time')
      .eq('company_id', companyId).eq('dispatch_date', today).eq('driver_id', driverId)
      .not('status', 'in', '("completed","cancelled")')
    if (!data?.length) return null
    const newStart = parseTimeToMin(startTime)
    const newEnd   = endTime ? parseTimeToMin(endTime) : newStart + 240
    const hit = (data as Record<string, unknown>[]).find(d => {
      if (!d.start_time || d.id === excludeId) return false
      const existStart = parseTimeToMin(d.start_time as string)
      const existEnd   = d.end_time ? parseTimeToMin(d.end_time as string) : existStart + 240
      return newStart < existEnd && newEnd > existStart
    })
    if (!hit) return null
    const jobName = jobs.find(j => j.id === hit.job_id as string)?.job_name ?? 'another job'
    return { id: hit.id as string, job_name: jobName, start_time: hit.start_time as string }
  }

  // ── Step 5: Job templates ─────────────────────────────────────────────────────

  async function saveAsTemplate(job: Job) {
    const companyId = await getCompanyId(); if (!companyId) return
    const name = window.prompt('Template name:', job.job_name) ?? job.job_name
    if (!name) return
    setSavingTemplate(true)
    const { data, error } = await supabase.from('job_templates').insert({
      company_id:     companyId,
      name,
      job_name:       job.job_name,
      location:       (job as Record<string, unknown>).pick_up_location as string ?? null,
      material:       job.material ?? null,
      rate:           job.rate ?? null,
      rate_type:      job.rate_type ?? null,
      notes:          job.notes ?? null,
    }).select().maybeSingle()
    setSavingTemplate(false)
    if (error) { toast.error(error.message); return }
    if (data) {
      setTemplates(prev => [data as JobTemplate, ...prev])
      toast.success(`Template "${name}" saved!`)
    }
  }

  // ── Step 6: Copy yesterday's dispatches ──────────────────────────────────────

  async function copyYesterdaysDispatches() {
    const companyId = await getCompanyId(); if (!companyId) return
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
    const yDate = yesterday.toISOString().split('T')[0]!
    const { data: yDisps } = await supabase.from('dispatches').select('*').eq('company_id', companyId).eq('dispatch_date', yDate).neq('status', 'cancelled')
    if (!yDisps?.length) { toast.error('No dispatches from yesterday'); return }
    if (!confirm(`Copy ${yDisps.length} dispatch${yDisps.length > 1 ? 'es' : ''} from yesterday to today?`)) return
    setCopyingYesterday(true)
    const newDisps = (yDisps as Dispatch[]).map(d => ({
      company_id:      d.company_id,
      driver_id:       d.driver_id,
      driver_name:     d.driver_name,
      job_id:          d.job_id,
      truck_number:    d.truck_number,
      start_time:      d.start_time,
      end_time:        (d as Record<string, unknown>).end_time as string ?? null,
      estimated_loads: (d as Record<string, unknown>).estimated_loads as number ?? null,
      instructions:    d.instructions,
      dispatch_type:   d.dispatch_type,
      subcontractor_id: d.subcontractor_id,
      dispatch_date:   today,
      status:          'dispatched' as const,
      loads_completed: 0,
    }))
    const { data: created, error } = await supabase.from('dispatches').insert(newDisps).select()
    setCopyingYesterday(false)
    if (error) { toast.error(error.message); return }
    toast.success(`✅ Copied ${newDisps.length} dispatch${newDisps.length !== 1 ? 'es' : ''} to today!`)
    setDispatches(prev => [...(created as Dispatch[]), ...prev])
    setYesterdayCount(0)
  }

  // ── Step 9: Resend no-response dispatch ───────────────────────────────────────

  async function resendDispatch(d: Dispatch) {
    const companyId = await getCompanyId(); if (!companyId) return
    const driver = drivers.find(dr => dr.id === d.driver_id)
    setResendingId(d.id)
    await supabase.from('dispatches')
      .update({ followup_count: (d.followup_count ?? 0) + 1, last_followup_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', d.id)
    setDispatches(prev => prev.map(dp => dp.id === d.id ? { ...dp, followup_count: (dp.followup_count ?? 0) + 1, last_followup_sent_at: new Date().toISOString() } : dp))
    const job = d.job_id ? jobs.find(j => j.id === d.job_id) : null
    if (driver?.phone) {
      const msg = [`🔔 Reminder: You have a dispatch today!`, job ? `Job: ${job.job_name}` : null, d.start_time ? `Start: ${d.start_time}` : null, `Respond: https://dumptruckboss.com/portal?c=${companyId}`].filter(Boolean).join('\n')
      window.open(toSmsHref(driver.phone, msg), '_blank')
    } else if (driver?.email) {
      await fetch('/api/dispatches/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ driverEmail: driver.email, driverName: d.driver_name, jobName: job?.job_name, companyId }) }).catch(console.error)
      toast.success('Reminder email sent')
    } else {
      toast.warning('No contact info for this driver — add phone/email in Drivers page')
    }
    setResendingId(null)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (planLocked) {
    return <LockedFeature title="Dispatch & Job Management" description="Create jobs, dispatch drivers, and track your entire operation in real time. Upgrade to start dispatching." plan={planLocked.plan} price={planLocked.price} />
  }

  return (
    <div className="flex flex-col min-h-full">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
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
            aria-label={t('refresh')}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={openAddJob}
            className="flex items-center gap-2 bg-[var(--brand-dark)] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[var(--brand-primary-hover)] transition-colors"
          >
            <Plus className="h-4 w-4" /> {t('newJob')}
          </button>
        </div>
      </div>

      {/* Summary stats */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 pb-4">
          {[
            { icon: Send,          iconColor: 'text-blue-600',       bg: 'bg-blue-50',         label: t('dispatchedToday'), value: String(dispatches.length),   alert: false },
            { icon: Truck,         iconColor: 'text-[var(--brand-primary)]',      bg: 'bg-[var(--brand-primary)]/10',    label: t('loadsToday'),       value: String(todayLoads.length),    alert: false },
            { icon: TrendingUp,    iconColor: 'text-[var(--brand-primary)]',      bg: 'bg-[var(--brand-primary)]/10',    label: t('todaysRevenue'),  value: `$${fmtMoney(todayRevenue)}`, alert: false },
            { icon: AlertTriangle, iconColor: noResponseCount > 0 ? 'text-yellow-600' : 'text-gray-400', bg: noResponseCount > 0 ? 'bg-yellow-100' : 'bg-gray-50', label: t('noResponse'), value: String(noResponseCount), alert: noResponseCount > 0 },
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

      {/* All-drivers-dispatched upsell banner */}
      {!loading && !dispatchBannerDismissed && availableDrivers.length === 0 && drivers.length > 0 && companyPlan !== 'enterprise' && (
        <div className="mx-6 mb-4 flex items-center gap-3 rounded-xl border border-[var(--brand-primary)]/30 bg-[var(--brand-primary)]/8 px-4 py-3" style={{ background: 'rgba(45,122,79,0.07)' }}>
          <span className="text-base shrink-0">🚛</span>
          <p className="flex-1 text-sm text-[var(--brand-dark)] font-medium">
            All {drivers.length} driver{drivers.length !== 1 ? 's' : ''} are out! Need more capacity?{' '}
            <a
              href={companyPlan === 'owner_operator' ? '/pricing' : '/schedule-demo'}
              className="font-semibold text-[var(--brand-primary)] underline hover:no-underline"
            >
              Upgrade your plan →
            </a>
          </p>
          <button onClick={() => setDispatchBannerDismissed(true)} className="text-gray-400 hover:text-gray-600 shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mx-6 mb-5 flex-wrap">
        {([
          ['board',    t('board'),         null],
          ['today',    t('yourDrivers'),   driverDispatches.length],
          ['subs',     t('subcontractors'),subDispatches.length],
          ['received', 'Received',         receivedDispatches.filter(r => r.status === 'pending').length],
        ] as [string, string, number | null][]).map(([tab, label, count]) => (
          <button
            key={tab}
            onClick={() => setMainTab(tab as 'board' | 'today' | 'subs' | 'received')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              mainTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
            {count != null && count > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[1rem] px-1 text-[10px] font-bold bg-[var(--brand-primary)] text-white rounded-full">
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
              {/* Optimization hints banner */}
              {!hintsDismissed && optimizationHints.length > 0 && (
                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="text-base shrink-0">💡</span>
                      <div className="space-y-1.5 min-w-0">
                        {optimizationHints.map((hint, i) => (
                          <div key={i}>
                            <p className="text-xs font-semibold text-blue-900">{hint.message}</p>
                            <p className="text-xs text-blue-700">{hint.suggestion}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => setHintsDismissed(true)}
                      className="shrink-0 text-blue-400 hover:text-blue-600 transition-colors"
                      aria-label="Dismiss"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Job filter + Copy Yesterday */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <div className="flex gap-1.5 flex-wrap flex-1">
                  {(['active', 'on_hold', 'completed', 'all'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setJobFilter(tab)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                        jobFilter === tab ? 'bg-[var(--brand-dark)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {tab === 'on_hold' ? t('onHold') : tab === 'all' ? t('all') : tab === 'active' ? t('active') : t('completed')}
                      {tab !== 'all' && (
                        <span className={`ml-1 ${jobFilter === tab ? 'text-white/60' : 'text-gray-400'}`}>
                          {jobs.filter(j => j.status === tab).length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {yesterdayCount > 0 && (
                  <button
                    onClick={copyYesterdaysDispatches}
                    disabled={copyingYesterday}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors shrink-0"
                  >
                    {copyingYesterday ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Copy Yesterday ({yesterdayCount})
                  </button>
                )}
              </div>

              {displayedJobs.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
                  <Truck className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                  <p className="font-medium text-gray-400">{t('noJobs')}</p>
                  <p className="text-sm text-gray-300 mt-1">{t('createJobToStart')}</p>
                  <button onClick={openAddJob} className="mt-4 text-sm text-[var(--brand-primary)] font-medium">+ {t('newJobBtn')}</button>
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
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-gray-900 text-base leading-tight">{job.job_name}</h3>
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                                {job.contractor && <span className="flex items-center gap-1 text-xs text-gray-500"><Users className="h-3 w-3" />{job.contractor}</span>}
                                {!!(job as Record<string, unknown>).pick_up_location && <span className="flex items-center gap-1 text-xs text-gray-500"><MapPin className="h-3 w-3" />Pick Up: {String((job as Record<string, unknown>).pick_up_location)}</span>}
                                {!!(job as Record<string, unknown>).drop_location && <span className="flex items-center gap-1 text-xs text-gray-500"><MapPin className="h-3 w-3" />Drop: {String((job as Record<string, unknown>).drop_location)}</span>}
                                {job.material   && <span className="flex items-center gap-1 text-xs text-gray-500"><PackageOpen className="h-3 w-3" />{job.material}</span>}
                                {job.rate != null && <span className="flex items-center gap-1 text-xs text-gray-500"><DollarSign className="h-3 w-3" />${job.rate}/{job.rate_type}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => shareJob(job)}
                                disabled={sharingJobId === job.id}
                                title="Share dispatch link"
                                className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-blue-600"
                              >
                                {sharingJobId === job.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                              </button>
                              <button
                                onClick={() => saveAsTemplate(job)}
                                disabled={savingTemplate}
                                title="Save as job template"
                                className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-amber-600"
                              >
                                {savingTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PackageOpen className="h-3.5 w-3.5" />}
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
                          {/* Dispatch + Multi — own row so they don't squeeze job info */}
                          <div className="flex gap-2 mt-2.5">
                            <button
                              onClick={e => openDispatchFromJob(job, e)}
                              className="flex items-center gap-1.5 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <Send className="h-3 w-3" /> {t('newDispatch')}
                            </button>
                            <button
                              onClick={e => openBulkDispatch(job, e)}
                              title="Dispatch multiple drivers to this job"
                              className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                              <Users className="h-3 w-3" /> Multi
                            </button>
                          </div>

                          {/* Stats */}
                          <div className="grid grid-cols-4 gap-2 mt-3">
                            <div className="bg-blue-50 rounded-xl p-2.5 text-center">
                              <p className="text-lg font-bold text-blue-700">{jobDisps.length}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">Dispatched</p>
                            </div>
                            <div className="bg-green-50 rounded-xl p-2.5 text-center">
                              <p className="text-lg font-bold text-green-700">{todayJLoads.length}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">Jobs Today</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                              <p className="text-lg font-bold text-gray-900">{jobLoads.length}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">Total Jobs</p>
                            </div>
                            <div className="bg-[var(--brand-primary)]/5 rounded-xl p-2.5 text-center">
                              <p className="text-base font-bold text-[var(--brand-primary)] leading-tight">${fmtMoney(jobRevenue)}</p>
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

                          {/* Step 8 — Cycle progress bar */}
                          {(() => {
                            const totalEst = jobDisps.reduce((s, d) => s + ((d as Record<string, unknown>).estimated_loads as number | null ?? 0), 0)
                            const totalDone = jobDisps.reduce((s, d) => s + (d.loads_completed ?? 0), 0)
                            if (totalEst <= 0) return null
                            const pct = Math.min(100, Math.round((totalDone / totalEst) * 100))
                            return (
                              <div className="mt-2.5">
                                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                  <span>Cycle Progress</span>
                                  <span>{totalDone} / {totalEst} loads ({pct}%)</span>
                                </div>
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : 'bg-[var(--brand-primary)]'}`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            )
                          })()}
                        </div>

                        {/* Expanded */}
                        {expanded && (
                          <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-4">
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('jobStatus')}</p>
                              <div className="flex gap-2 flex-wrap">
                                {JOB_STATUSES.map(s => (
                                  <button key={s} onClick={() => updateJobStatus(job.id, s)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                      job.status === s ? 'bg-[var(--brand-dark)] text-white border-[#1e3a2a]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                                    }`}>
                                    {s === 'on_hold' ? t('onHold') : s === 'active' ? t('active') : t('completed')}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Profit tracker */}
                            <JobProfitPanel job={job} revenue={jobRevenue} supabase={supabase} />

                            {(job.start_date || job.end_date) && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('schedule')}</p>
                                <div className="flex gap-4 text-sm text-gray-600">
                                  {job.start_date && <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-gray-400" />{t('startDate', { date: new Date(job.start_date + 'T00:00:00').toLocaleDateString() })}</span>}
                                  {job.end_date   && <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-gray-400" />{t('endDate', { date: new Date(job.end_date + 'T00:00:00').toLocaleDateString() })}</span>}
                                </div>
                              </div>
                            )}
                            {job.notes && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t('notes')}</p>
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
                    <Radio className="h-4 w-4 text-[var(--brand-primary)]" />
                    <h3 className="text-sm font-semibold text-gray-900">{t('driverStatus')}</h3>
                  </div>
                  <span className="text-xs text-gray-400">{drivers.length} active</span>
                </div>

                <div className="divide-y divide-gray-50 max-h-[560px] overflow-y-auto">
                  {drivers.length === 0 ? (
                    <p className="p-6 text-center text-sm text-gray-400">No active drivers</p>
                  ) : drivers.map(driver => {
                    const disp    = driverDispMap.get(driver.id)
                    const job     = disp?.job_id ? jobs.find(j => j.id === disp.job_id) : null
                    const minsAgo = disp ? Math.floor((Date.now() - new Date(disp.updated_at).getTime()) / 60000) : null
                    return (
                      <div key={driver.id} className={`px-4 py-3 hover:bg-gray-50 transition-colors ${disp && flashingIds.has(disp.id) ? 'ticket-flash' : ''}`}>
                        <div className="flex items-start gap-2.5">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-sm font-medium text-gray-900 truncate">{driver.name}</p>
                              {disp?.truck_number && (
                                <span className="text-[10px] text-gray-400 shrink-0">#{disp.truck_number}</span>
                              )}
                            </div>
                            <DriverStatusDot dispatch={disp} />
                            {disp ? (
                              <>
                                <p className="text-xs text-gray-500 truncate mt-0.5">{job?.job_name ?? 'No job assigned'}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  {disp.status === 'working' && (
                                    <span className="text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">
                                      {t('loads', { count: disp.loads_completed })}
                                    </span>
                                  )}
                                  {disp.status === 'working' && minsAgo !== null && minsAgo < 120 && (
                                    <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                      <Clock className="h-2.5 w-2.5" />
                                      {minsAgo < 1 ? t('justNow') : t('minutesAgo', { m: minsAgo })}
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
                      {availableDrivers.length === 1 ? t('availableDrivers', { count: availableDrivers.length }) : t('availableDriversPlural', { count: availableDrivers.length })}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Step 11 — Live activity feed */}
            {orgId && (
              <DispatchActivityFeed
                companyId={orgId}
                collapsed={activityCollapsed}
                onToggle={() => setActivityCollapsed(c => !c)}
              />
            )}
          </div>
        </div>

      ) : mainTab === 'today' ? (
        /* ══════════════════════════════════════════════════════════════
           YOUR DRIVERS VIEW
        ══════════════════════════════════════════════════════════════ */
        <div className="px-6 pb-8">
          {/* Step 3 — View toggle + dispatch button */}
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-500">{filteredDispatches.length === 1 ? t('dispatchedDrivers', { count: filteredDispatches.length }) : t('dispatchedDriversPlural', { count: filteredDispatches.length })}</p>
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                {(['list', 'timeline'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${viewMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {mode === 'list' ? 'List' : 'Timeline'}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => openNewDispatch('driver')}
              className="flex items-center gap-2 bg-[var(--brand-dark)] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[var(--brand-primary-hover)] transition-colors"
            >
              <Plus className="h-4 w-4" /> {t('dispatchDriver')}
            </button>
          </div>

          {/* Step 7 — Search + filter bar */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <input
              type="text"
              placeholder="Search driver or job…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 min-w-[160px] h-9 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30 focus:border-[var(--brand-primary)]"
            />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="h-9 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30"
            >
              <option value="all">All statuses</option>
              {DISPATCH_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              <option value="no_response">No Response</option>
            </select>
            <select
              value={filterDriver}
              onChange={e => setFilterDriver(e.target.value)}
              className="h-9 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30"
            >
              <option value="all">All drivers</option>
              {uniqueDriverNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          {driverDispatches.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
              <Send className="h-10 w-10 mx-auto mb-3 text-gray-200" />
              <p className="font-medium text-gray-400">{t('noDispatchesToday')}</p>
              <p className="text-sm text-gray-300 mt-1">{t('clickDispatch')}</p>
            </div>
          ) : viewMode === 'timeline' ? (
            <TimelineView dispatches={filteredDispatches} drivers={drivers} jobs={jobs} />
          ) : (
            <>
              {/* Mobile cards */}
              <div className="lg:hidden space-y-3">
                {filteredDispatches.map(d => {
                  const sc       = getDispCfg(d)
                  const job      = d.job_id ? jobs.find(j => j.id === d.job_id) : null
                  const minsAgo  = Math.floor((Date.now() - new Date(d.updated_at).getTime()) / 60000)
                  const lastTicketLabel = d.status === 'working'
                    ? (minsAgo < 1 ? t('justNow') : minsAgo < 60 ? t('minutesAgo', { m: minsAgo }) : t('hoursAgo', { h: Math.floor(minsAgo / 60) }))
                    : null
                  const ticketsForDispatch = todayLoads.filter(l => l.driver_name === d.driver_name).length
                  const missingCount       = Math.max(0, d.loads_completed - ticketsForDispatch)
                  const isFlashing         = flashingIds.has(d.id)
                  return (
                    <div key={d.id} className={`bg-white rounded-2xl border p-4 space-y-3 ${missingCount > 0 ? 'border-red-200' : 'border-gray-200'} ${isFlashing ? 'ticket-flash' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-900">{d.driver_name}</p>
                          <DriverStatusDot dispatch={d} />
                          {d.truck_number && <p className="text-xs text-gray-500 mt-0.5">Truck #{d.truck_number}</p>}
                          {job && <p className="text-xs text-gray-500 mt-0.5">{job.job_name}</p>}
                          {d.start_time && <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><Clock className="h-3 w-3" />{d.start_time}</p>}
                          {missingCount > 0 && (
                            <p className="text-xs font-bold text-red-500 mt-1">⚠️ {missingCount} missing ticket{missingCount !== 1 ? 's' : ''}</p>
                          )}
                          {(d.followup_count ?? 0) >= 2 && (
                            <p className="text-xs text-gray-400 mt-0.5">📧 2 reminders sent — no response</p>
                          )}
                          {(d.followup_count ?? 0) === 1 && d.last_followup_sent_at && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              📧 Follow-up sent {Math.round((Date.now() - new Date(d.last_followup_sent_at).getTime()) / 3_600_000)}h ago
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                          {d.status === 'working' && (
                            <span className="text-xs font-bold text-green-700">{t('loads', { count: d.loads_completed })}</span>
                          )}
                          {lastTicketLabel && (
                            <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" /> {t('lastTicket', { label: lastTicketLabel })}
                            </span>
                          )}
                        </div>
                      </div>
                      {d.instructions && <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">{d.instructions}</p>}
                      {/* Step 9 — No response alert + resend */}
                      {d.status === 'dispatched' && Date.now() - new Date(d.created_at).getTime() > ONE_HOUR_MS && (
                        <div className="flex items-center gap-2 bg-yellow-50 rounded-lg px-2.5 py-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 shrink-0" />
                          <p className="text-xs text-yellow-700 flex-1">No response in 1h+</p>
                          <button
                            onClick={() => resendDispatch(d)}
                            disabled={resendingId === d.id}
                            className="text-xs font-semibold text-yellow-800 hover:text-yellow-900 flex items-center gap-1"
                          >
                            {resendingId === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                            Resend
                          </button>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <select
                          value={d.status}
                          onChange={e => updateDispStatus(d.id, e.target.value as DispatchStatus)}
                          className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs bg-white focus:outline-none"
                        >
                          {DISPATCH_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                        {/* Step 10 — Call/Text buttons */}
                        {(() => {
                          const driver = drivers.find(dr => dr.id === d.driver_id)
                          return driver?.phone ? (
                            <>
                              <a
                                href={`tel:${driver.phone.replace(/\D/g, '')}`}
                                title="Call driver"
                                className="h-8 w-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-green-600"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </a>
                              <a
                                href={toSmsHref(driver.phone, `Hey ${d.driver_name}, checking in on your dispatch today.`)}
                                title="Text driver"
                                className="h-8 w-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-blue-600"
                              >
                                <Mail className="h-3.5 w-3.5" />
                              </a>
                            </>
                          ) : null
                        })()}
                        <button
                          onClick={() => copyMobileTicketLink(d.id)}
                          title="Copy mobile ticket link"
                          className="h-8 w-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-[var(--brand-primary)]"
                        >
                          <Smartphone className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => openEditDispatch(d)} className="h-8 w-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-[var(--brand-primary)]"><Pencil className="h-3.5 w-3.5" /></button>
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
                      {[t('table.driver'), t('table.truck'), t('table.job'), t('table.start'), t('table.loads'), t('table.lastTicket'), t('table.status'), ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredDispatches.map(d => {
                      const sc        = getDispCfg(d)
                      const job       = d.job_id ? jobs.find(j => j.id === d.job_id) : null
                      const minsAgo   = Math.floor((Date.now() - new Date(d.updated_at).getTime()) / 60000)
                      const isFlashTr = flashingIds.has(d.id)
                      const isNoResp  = d.status === 'dispatched' && Date.now() - new Date(d.created_at).getTime() > ONE_HOUR_MS
                      const driverInfo = drivers.find(dr => dr.id === d.driver_id)
                      return (
                        <tr key={d.id} className={`hover:bg-gray-50/50 transition-colors ${isFlashTr ? 'ticket-flash' : ''}`}>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="font-medium text-gray-900">{d.driver_name}</p>
                            <DriverStatusDot dispatch={d} />
                          </td>
                          <td className="px-4 py-3 text-gray-600">{d.truck_number ? `#${d.truck_number}` : <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate">{job?.job_name ?? <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                            {d.start_time
                              ? <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{d.start_time}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-0.5">
                              <span className={`text-sm font-bold ${d.status === 'working' ? 'text-green-700' : 'text-gray-900'}`}>
                                {d.loads_completed}
                              </span>
                              {(() => {
                                const tix     = todayLoads.filter(l => l.driver_name === d.driver_name).length
                                const missing = Math.max(0, d.loads_completed - tix)
                                return missing > 0 ? (
                                  <span className="text-[10px] font-bold text-red-500">⚠️ {missing} missing</span>
                                ) : null
                              })()}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                            {d.status === 'working'
                              ? (minsAgo < 1 ? t('justNow') : minsAgo < 60 ? t('minutesAgo', { m: minsAgo }) : t('hoursAgo', { h: Math.floor(minsAgo / 60) }))
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
                              {/* Step 9 — resend */}
                              {isNoResp && (
                                <button
                                  onClick={() => resendDispatch(d)}
                                  disabled={resendingId === d.id}
                                  title="Resend — no response"
                                  className="p-1.5 text-yellow-500 hover:text-yellow-700 transition-colors"
                                >
                                  {resendingId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                                </button>
                              )}
                              {/* Step 10 — call/text */}
                              {driverInfo?.phone && (
                                <>
                                  <a href={`tel:${driverInfo.phone.replace(/\D/g, '')}`} title="Call driver" className="p-1.5 text-gray-400 hover:text-green-600 transition-colors"><MessageSquare className="h-3.5 w-3.5" /></a>
                                  <a href={toSmsHref(driverInfo.phone, `Hey ${d.driver_name}, checking in on your dispatch today.`)} title="Text driver" className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"><Mail className="h-3.5 w-3.5" /></a>
                                </>
                              )}
                              <button onClick={() => copyMobileTicketLink(d.id)} title="Copy mobile ticket link" className="p-1.5 text-gray-400 hover:text-[var(--brand-primary)] transition-colors"><Smartphone className="h-3.5 w-3.5" /></button>
                              <button onClick={() => openEditDispatch(d)} className="p-1.5 text-gray-400 hover:text-[var(--brand-primary)] transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
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

      ) : mainTab === 'subs' ? (
        /* ══════════════════════════════════════════════════════════════
           SUBCONTRACTORS VIEW
        ══════════════════════════════════════════════════════════════ */
        <div className="px-6 pb-8">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{subDispatches.length === 1 ? t('subDispatchedToday', { count: subDispatches.length }) : t('subDispatchedTodayPlural', { count: subDispatches.length })}</p>
            <button
              onClick={() => openNewDispatch('subcontractor')}
              className="flex items-center gap-2 bg-[var(--brand-dark)] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[var(--brand-primary-hover)] transition-colors"
            >
              <Plus className="h-4 w-4" /> {t('dispatchSub')}
            </button>
          </div>

          {subDispatches.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
              <Users className="h-10 w-10 mx-auto mb-3 text-gray-200" />
              <p className="font-medium text-gray-400">{t('noSubsToday')}</p>
              <p className="text-sm text-gray-300 mt-1">{t('clickDispatchSub')}</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {[t('table.subcontractor'), t('table.job'), t('table.start'), t('table.loads'), t('table.status'), ''].map(h => (
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
                            <button onClick={() => openEditDispatch(d)} className="p-1.5 text-gray-400 hover:text-[var(--brand-primary)] transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
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
      ) : mainTab === 'received' ? (
        /* ══════════════════════════════════════════════════════════════
           RECEIVED DISPATCHES INBOX
        ══════════════════════════════════════════════════════════════ */
        <div className="px-6 pb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500">{receivedDispatches.length} received dispatch{receivedDispatches.length !== 1 ? 'es' : ''}</p>
              <p className="text-xs text-gray-400 mt-0.5">Jobs sent to you by other companies via share link</p>
            </div>
          </div>

          {receivedDispatches.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
              <Link2 className="h-10 w-10 mx-auto mb-3 text-gray-200" />
              <p className="font-medium text-gray-400">No received dispatches</p>
              <p className="text-sm text-gray-300 mt-1">When another company shares a job with you, it will appear here</p>
            </div>
          ) : (
            <div className="space-y-3 max-w-2xl">
              {receivedDispatches.map(rd => (
                <ReceivedDispatchCard
                  key={rd.id}
                  dispatch={rd}
                  onUpdate={updated => setReceivedDispatches(prev => prev.map(r => r.id === updated.id ? updated : r))}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════
          DISPATCH MODAL
      ══════════════════════════════════════════════════════════════ */}
      {showDispForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingDispatch ? t('editDispatch') : dispFormType === 'subcontractor' ? t('dispatchSubcontractor') : t('dispatchADriver')}
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
                        dispFormType === t ? 'bg-[var(--brand-dark)] text-white border-[#1e3a2a]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {t === 'driver' ? 'Driver' : 'Subcontractor'}
                    </button>
                  ))}
                </div>
              )}

              {/* Step 5 — Template selector */}
              {templates.length > 0 && !editingDispatch && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Load from Template</label>
                  <select
                    defaultValue=""
                    onChange={e => {
                      const tpl = templates.find(t => t.id === e.target.value)
                      if (!tpl) return
                      const matchedJob = jobs.find(j => j.job_name === tpl.job_name)
                      setDispForm(f => ({
                        ...f,
                        job_id:          matchedJob?.id ?? f.job_id,
                        estimated_loads: tpl.estimated_loads != null ? String(tpl.estimated_loads) : f.estimated_loads,
                      }))
                      void supabase.from('job_templates').update({ use_count: (tpl.use_count ?? 0) + 1 }).eq('id', tpl.id)
                      setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, use_count: (t.use_count ?? 0) + 1 } : t))
                      toast.success(`Template "${tpl.name}" loaded`)
                    }}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30 focus:border-[var(--brand-primary)]"
                  >
                    <option value="">— Select a template —</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}{t.job_name ? ` (${t.job_name})` : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Job selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job</label>
                <select
                  value={dispForm.job_id}
                  onChange={e => setDispForm(f => ({ ...f, job_id: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30 focus:border-[var(--brand-primary)]"
                >
                  <option value="">— {t('noSpecificJob')} —</option>
                  {jobs.filter(j => j.status === 'active').map(j => (
                    <option key={j.id} value={j.id}>{j.job_name}{j.location ? ` · ${j.location}` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Driver or Subcontractor */}
              {dispFormType === 'driver' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Driver *</label>
                  {loadingRec ? (
                    <div className="flex items-center gap-2 py-3 text-sm text-gray-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Scoring drivers…
                    </div>
                  ) : recommendation && recommendation.rankedDrivers.length > 0 ? (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {recommendation.rankedDrivers.map((ds, i) => (
                        <button
                          key={ds.driverId}
                          type="button"
                          onClick={() => setDispForm(f => ({ ...f, driver_id: ds.driverId }))}
                          className={`w-full text-left p-2.5 rounded-xl border-2 transition-all ${
                            dispForm.driver_id === ds.driverId
                              ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                              : i === 0 && !recommendation.noDriversAvailable
                                ? 'border-green-300 bg-green-50/40 hover:border-green-400'
                                : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`h-2 w-2 rounded-full shrink-0 ${
                                ds.isWorking ? 'bg-yellow-400' : ds.isAvailable ? 'bg-green-500' : 'bg-gray-400'
                              }`} />
                              <span className="text-sm font-medium text-gray-900 truncate">{ds.driverName}</span>
                              {i === 0 && !recommendation.noDriversAvailable && (
                                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium shrink-0">
                                  Best
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-gray-400 shrink-0">{Math.round(ds.score)}pts</span>
                          </div>
                          {ds.explanations.length > 0 && (
                            <p className="text-[11px] text-gray-500 mt-0.5 ml-4 truncate">
                              {ds.explanations.join(' · ')}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <select
                      required
                      value={dispForm.driver_id}
                      onChange={e => setDispForm(f => ({ ...f, driver_id: e.target.value }))}
                      className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30 focus:border-[var(--brand-primary)]"
                    >
                      <option value="">— {t('selectDriverPlaceholder')} —</option>
                      {availableDrivers.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  )}
                  {recommendation?.fallbackReason && (
                    <p className="text-xs text-amber-600 mt-1">{recommendation.fallbackReason}</p>
                  )}
                  {availableDrivers.length === 0 && !editingDispatch && !recommendation && (
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
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30 focus:border-[var(--brand-primary)]"
                  >
                    <option value="">— {t('selectSubPlaceholder')} —</option>
                    {contractors.map(c => (
                      <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>
                    ))}
                  </select>
                  {contractors.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">{t('noSubsFound')}</p>
                  )}
                </div>
              )}

              {/* Step 4 — Conflict warning */}
              {conflict && (
                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-800">Schedule conflict</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Driver already has a dispatch for <strong>{conflict.job_name}</strong> at {conflict.start_time}. You can still save.
                    </p>
                  </div>
                  <button type="button" onClick={() => setConflict(null)} className="text-amber-400 hover:text-amber-600"><X className="h-3.5 w-3.5" /></button>
                </div>
              )}

              {/* Truck + Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('truckNum')}</label>
                  <input
                    value={dispForm.truck_number}
                    onChange={e => setDispForm(f => ({ ...f, truck_number: e.target.value }))}
                    placeholder="e.g. 12"
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30 focus:border-[var(--brand-primary)]"
                  />
                </div>
                <DispatchTimeInput
                  label={t('startTime')}
                  value={dispForm.start_time}
                  onChange={v => setDispForm(f => ({ ...f, start_time: v }))}
                />
              </div>

              {/* End Time + Estimated Loads */}
              <div className="grid grid-cols-2 gap-3">
                <DispatchTimeInput
                  label="End Time"
                  value={dispForm.end_time}
                  onChange={v => setDispForm(f => ({ ...f, end_time: v }))}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Est. Loads</label>
                  <input
                    type="number"
                    min={0}
                    value={dispForm.estimated_loads}
                    onChange={e => setDispForm(f => ({ ...f, estimated_loads: e.target.value }))}
                    placeholder="e.g. 8"
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30 focus:border-[var(--brand-primary)]"
                  />
                </div>
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('specialInstructions')}</label>
                <textarea
                  value={dispForm.instructions}
                  onChange={e => setDispForm(f => ({ ...f, instructions: e.target.value }))}
                  rows={3}
                  placeholder="Loading site details, contact, special notes…"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30 focus:border-[var(--brand-primary)]"
                />
              </div>

              {/* Notify Via — only for new dispatches */}
              {!editingDispatch && (() => {
                const contactEmail = dispFormType === 'driver'
                  ? drivers.find(d => d.id === dispForm.driver_id)?.email
                  : contractors.find(c => c.id === subcontractorId)?.email
                const contactPhone = dispFormType === 'driver'
                  ? drivers.find(d => d.id === dispForm.driver_id)?.phone
                  : contractors.find(c => c.id === subcontractorId)?.phone
                const hasContact = !!(contactEmail || contactPhone)
                return (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Notify Driver Via</label>
                    {hasContact && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
                        {contactEmail && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Mail className="h-3 w-3" />{contactEmail}
                          </span>
                        )}
                        {contactPhone && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <MessageSquare className="h-3 w-3" />{contactPhone}
                          </span>
                        )}
                      </div>
                    )}
                    {!hasContact && (dispForm.driver_id || subcontractorId) && (
                      <p className="text-xs text-amber-600 mb-2">No contact info on file — add email/phone in the Drivers page.</p>
                    )}
                    <div className="grid grid-cols-4 gap-1.5">
                      {([
                        ['email', 'Email',     !contactEmail],
                        ['sms',  'Text',       !contactPhone],
                        ['both', 'Both',       !contactEmail && !contactPhone],
                        ['none', 'Skip',       false],
                      ] as [string, string, boolean][]).map(([val, label, disabled]) => (
                        <button
                          key={val}
                          type="button"
                          disabled={disabled}
                          onClick={() => setNotifyVia(val as 'email' | 'sms' | 'both' | 'none')}
                          className={`py-2 rounded-xl text-xs font-medium border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                            notifyVia === val
                              ? 'bg-[var(--brand-dark)] text-white border-[#1e3a2a]'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })()}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowDispForm(false)} className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDispatch}
                  className="flex-1 h-11 rounded-xl bg-[var(--brand-dark)] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
                >
                  {savingDispatch && <Loader2 className="h-4 w-4 animate-spin" />}
                  {savingDispatch ? 'Saving…' : editingDispatch ? t('saveChanges') : t('dispatchNow')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          BULK DISPATCH MODAL
      ══════════════════════════════════════════════════════════════ */}
      {showBulkForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Dispatch Multiple Drivers</h2>
                {bulkJobId && (
                  <p className="text-sm text-gray-500 mt-0.5">{jobs.find(j => j.id === bulkJobId)?.job_name}</p>
                )}
              </div>
              <button onClick={() => setShowBulkForm(false)} className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleBulkDispatch} className="p-5 space-y-4">

              {/* Job selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job</label>
                <select
                  value={bulkJobId}
                  onChange={e => setBulkJobId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30 focus:border-[var(--brand-primary)]"
                >
                  <option value="">— No specific job —</option>
                  {jobs.filter(j => j.status === 'active').map(j => (
                    <option key={j.id} value={j.id}>{j.job_name}</option>
                  ))}
                </select>
              </div>

              {/* Shared start time */}
              <DispatchTimeInput
                label="Start Time (all drivers)"
                value={bulkStartTime}
                onChange={v => setBulkStartTime(v)}
              />

              {/* Driver checklist */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Select Drivers</label>
                  <button
                    type="button"
                    onClick={() => {
                      const allSelected = drivers.every(d => bulkSelections[d.id]?.selected)
                      setBulkSelections(prev => {
                        const next = { ...prev }
                        drivers.forEach(d => { next[d.id] = { ...next[d.id]!, selected: !allSelected } })
                        return next
                      })
                    }}
                    className="text-xs text-[var(--brand-primary)] font-medium hover:underline"
                  >
                    {drivers.every(d => bulkSelections[d.id]?.selected) ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                {drivers.length === 0 ? (
                  <p className="text-sm text-amber-600">No drivers found. Add drivers first.</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {drivers.map(d => {
                      const sel = bulkSelections[d.id]
                      const alreadyDispatched = driverDispMap.has(d.id)
                      return (
                        <div key={d.id} className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                          sel?.selected ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5' : 'border-gray-200'
                        } ${alreadyDispatched ? 'opacity-50' : ''}`}>
                          <input
                            type="checkbox"
                            id={`bulk-${d.id}`}
                            disabled={alreadyDispatched}
                            checked={sel?.selected ?? false}
                            onChange={e => setBulkSelections(prev => ({
                              ...prev,
                              [d.id]: { ...prev[d.id]!, selected: e.target.checked },
                            }))}
                            className="h-4 w-4 rounded text-[var(--brand-primary)] accent-[var(--brand-primary)]"
                          />
                          <label htmlFor={`bulk-${d.id}`} className="flex-1 min-w-0 cursor-pointer">
                            <p className="text-sm font-medium text-gray-900 truncate">{d.name}</p>
                            {alreadyDispatched && <p className="text-[10px] text-amber-600">{t('alreadyDispatchedGroup')}</p>}
                          </label>
                          {sel?.selected && (
                            <input
                              type="text"
                              value={sel.truckNumber}
                              onChange={e => setBulkSelections(prev => ({
                                ...prev,
                                [d.id]: { ...prev[d.id]!, truckNumber: e.target.value },
                              }))}
                              placeholder="Truck #"
                              className="w-20 h-8 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-[var(--brand-primary)]"
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {drivers.filter(d => bulkSelections[d.id]?.selected).length} selected
                </p>
              </div>

              {/* Notify Via */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notify All Via</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['email', 'sms', 'both', 'none'] as const).map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setBulkNotifyVia(val)}
                      className={`py-2 rounded-xl text-xs font-medium border transition-all ${
                        bulkNotifyVia === val
                          ? 'bg-[var(--brand-dark)] text-white border-[#1e3a2a]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {val === 'email' ? 'Email' : val === 'sms' ? 'Text' : val === 'both' ? 'Both' : 'Skip'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowBulkForm(false)} className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBulk || drivers.filter(d => bulkSelections[d.id]?.selected).length === 0}
                  className="flex-1 h-11 rounded-xl bg-[var(--brand-dark)] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
                >
                  {savingBulk && <Loader2 className="h-4 w-4 animate-spin" />}
                  {savingBulk
                    ? 'Dispatching…'
                    : `Dispatch ${drivers.filter(d => bulkSelections[d.id]?.selected).length} Driver${drivers.filter(d => bulkSelections[d.id]?.selected).length !== 1 ? 's' : ''}`}
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
              <h2 className="text-lg font-bold text-gray-900">{editingJob ? 'Edit Job' : t('newJobModal')}</h2>
              <button onClick={() => setShowJobForm(false)} className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveJob} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('jobNameRequired')}</label>
                <input required value={jobForm.job_name} onChange={e => setJobForm(f => ({ ...f, job_name: e.target.value }))} placeholder="e.g. Downtown Grading Phase 1" className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30 focus:border-[var(--brand-primary)]" />
              </div>
              {/* Working Under (Company) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">{t('contractor')}</label>
                  {clientCompanies.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setContractorMode(m => m === 'dropdown' ? 'manual' : 'dropdown')}
                      className="text-xs text-[var(--brand-primary)] hover:underline"
                    >
                      {contractorMode === 'dropdown' ? '✏️ Enter manually' : '← Back to list'}
                    </button>
                  )}
                </div>
                {contractorMode === 'dropdown' && clientCompanies.length > 0 ? (
                  <select
                    value={jobForm.contractor}
                    onChange={e => setJobForm(f => ({ ...f, contractor: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30 focus:border-[var(--brand-primary)]"
                  >
                    <option value="">— Select a company —</option>
                    {clientCompanies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                ) : (
                  <input
                    value={jobForm.contractor}
                    onChange={e => setJobForm(f => ({ ...f, contractor: e.target.value }))}
                    placeholder="Company name"
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30 focus:border-[var(--brand-primary)]"
                  />
                )}
              </div>

              {/* Pick Up Location + Drop Location */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pick Up Location *</label>
                  <input required value={jobForm.pick_up_location} onChange={e => setJobForm(f => ({ ...f, pick_up_location: e.target.value }))} placeholder="e.g. 123 Quarry Rd, Atlanta GA" className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30 focus:border-[var(--brand-primary)]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Drop Location *</label>
                  <input required value={jobForm.drop_location} onChange={e => setJobForm(f => ({ ...f, drop_location: e.target.value }))} placeholder="e.g. 456 Site Blvd, Atlanta GA" className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30 focus:border-[var(--brand-primary)]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('material')}</label>
                  <input value={jobForm.material} onChange={e => setJobForm(f => ({ ...f, material: e.target.value }))} placeholder="e.g. Gravel, Dirt" className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30 focus:border-[var(--brand-primary)]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('jobStatus')}</label>
                  <select value={jobForm.status} onChange={e => setJobForm(f => ({ ...f, status: e.target.value as Job['status'] }))} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30">
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('rate')}</label>
                  <input type="number" value={jobForm.rate} onChange={e => setJobForm(f => ({ ...f, rate: e.target.value }))} placeholder="0.00" className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30 focus:border-[var(--brand-primary)]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('per')}</label>
                  <select value={jobForm.rate_type} onChange={e => setJobForm(f => ({ ...f, rate_type: e.target.value }))} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30">
                    {RATE_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              {rateInsight && showJobForm && (
                <div className={`flex items-start gap-2 p-3 rounded-xl text-xs ${
                  rateInsight.isBelowAverage ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'
                }`}>
                  <span className="shrink-0 text-base">{rateInsight.isBelowAverage ? '⚠️' : '✅'}</span>
                  <p className={rateInsight.isBelowAverage ? 'text-yellow-800' : 'text-green-800'}>
                    {rateInsight.recommendation}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('startDateLabel')}</label>
                  <input type="date" value={jobForm.start_date} onChange={e => setJobForm(f => ({ ...f, start_date: e.target.value }))} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30 focus:border-[var(--brand-primary)]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('endDateLabel')}</label>
                  <input type="date" value={jobForm.end_date} onChange={e => setJobForm(f => ({ ...f, end_date: e.target.value }))} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30 focus:border-[var(--brand-primary)]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('notes')}</label>
                <textarea value={jobForm.notes} onChange={e => setJobForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Any notes about this job…" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30 focus:border-[var(--brand-primary)]" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowJobForm(false)} className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={savingJob} className="flex-1 h-11 rounded-xl bg-[var(--brand-dark)] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[var(--brand-primary-hover)] disabled:opacity-60">
                  {savingJob && <Loader2 className="h-4 w-4 animate-spin" />}
                  {savingJob ? 'Saving…' : editingJob ? t('saveChanges') : t('createJob')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
