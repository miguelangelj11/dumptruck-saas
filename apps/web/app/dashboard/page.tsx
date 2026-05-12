export const revalidate = 10

import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import {
  Truck, Radio,
  Send, Plus, Receipt, Users, FileText,
  AlertTriangle, Clock, Activity, FolderOpen,
} from 'lucide-react'
import RecentDocuments from '@/components/dashboard/recent-documents'
import LoadsChart from '@/components/dashboard/loads-chart'
import { ProfitAlerts } from '@/components/dashboard/profit-alerts'
import { DriverProfitTable } from '@/components/dashboard/driver-profit-table'
import SoloUpgradeNudge from '@/components/dashboard/solo-upgrade-nudge'
import DashboardStatCards from '@/components/dashboard/DashboardStatCards'
import SetupProgressBanner from '@/components/setup-progress-banner'
import { WeatherBanner } from '@/components/dashboard/WeatherBanner'
import Link from 'next/link'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_NAMES   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const ticketStatusColor: Record<string, string> = {
  pending:  'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  invoiced: 'bg-blue-100 text-blue-700',
  paid:     'bg-emerald-100 text-emerald-700',
  disputed: 'bg-red-100 text-red-700',
}

const dispStatusBadge: Record<string, { label: string; cls: string }> = {
  dispatched: { label: 'Sent',     cls: 'bg-gray-100 text-gray-600' },
  accepted:   { label: 'Accepted', cls: 'bg-blue-100 text-blue-700' },
  working:    { label: 'Working',  cls: 'bg-green-100 text-green-700' },
  completed:  { label: 'Done',     cls: 'bg-emerald-100 text-emerald-700' },
  declined:   { label: 'Declined', cls: 'bg-red-100 text-red-700' },
}

type TodayDispatch = {
  id: string
  driver_name: string
  status: string
  start_time: string | null
  jobs: { job_name: string } | null
}

export default async function DashboardPage() {
  const t = await getTranslations('dashboard')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const uid = user?.id ?? ''

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, full_name')
    .eq('id', uid)
    .maybeSingle()
  const effectiveCompanyId = profile?.organization_id ?? uid
  const profileFullName    = typeof (profile as Record<string, unknown> | null)?.full_name === 'string'
    ? ((profile as Record<string, unknown>).full_name as string)
    : null
  console.log('[dashboard] profile full_name:', profileFullName)

  // ── Date helpers ──────────────────────────────────────────────────────────
  const now        = new Date()
  const todayStr   = now.toISOString().split('T')[0]!
  const dayOfWeek  = now.getDay()
  const daysToMon  = dayOfWeek === 0 ? 6 : dayOfWeek - 1

  const thisWeekStart = new Date(now)
  thisWeekStart.setDate(now.getDate() - daysToMon)
  const thisWeekStartStr = thisWeekStart.toISOString().split('T')[0]!

  const lastWeekStartD = new Date(thisWeekStart)
  lastWeekStartD.setDate(thisWeekStart.getDate() - 7)
  const lastWeekStartStr = lastWeekStartD.toISOString().split('T')[0]!

  const lastWeekEndD = new Date(thisWeekStart)
  lastWeekEndD.setDate(thisWeekStart.getDate() - 1)
  const lastWeekEndStr = lastWeekEndD.toISOString().split('T')[0]!

  const thisMonthStr  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthStr  = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`

  // Fetch 13 months back so "This Year" Jan–Dec always has data
  const fetchCutoff = new Date(now)
  fetchCutoff.setMonth(now.getMonth() - 13)
  const fetchCutoffStr = fetchCutoff.toISOString().split('T')[0]!

  // ── Batch 1 ───────────────────────────────────────────────────────────────
  const [loadsRes, invoicesRes, companyRes, activityRes, leadsRes] = await Promise.all([
    supabase
      .from('loads')
      .select('id, rate, total_pay, status, driver_name, job_name, date, created_at, source, submitted_by_driver, client_company')
      .eq('company_id', effectiveCompanyId)
      .gte('date', fetchCutoffStr)
      .order('date', { ascending: false }),
    supabase
      .from('invoices')
      .select('id, status, total, invoice_type, date_paid, created_at')
      .eq('company_id', effectiveCompanyId),
    supabase
      .from('companies')
      .select('id, name, plan, monthly_revenue_goal')
      .eq('id', effectiveCompanyId)
      .maybeSingle(),
    supabase
      .from('activity_feed')
      .select('id, type, message, created_at')
      .eq('company_id', effectiveCompanyId)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('leads')
      .select('id, value, status')
      .eq('company_id', effectiveCompanyId)
      .not('status', 'in', '("won","lost")'),
  ])

  const loads       = loadsRes.data    ?? []
  const invoices    = invoicesRes.data ?? []
  const companyId          = companyRes.data?.id
  const companyName        = companyRes.data?.name ?? ''
  const companyPlan        = (companyRes.data as Record<string, unknown> | null)?.plan as string | null ?? null
  const monthlyRevenueGoal = (companyRes.data as Record<string, unknown> | null)?.monthly_revenue_goal as number | null ?? null
  const activityFeed       = activityRes.error ? [] : (activityRes.data ?? [])

  // Open leads (for Bid Pipeline)
  type LeadRow = { id: string; value: number | null; status: string }
  const openLeads     = (leadsRes.data ?? []) as LeadRow[]
  const openLeadCount = openLeads.length
  const openLeadValue = openLeads.reduce((s, l) => s + (l.value ?? 0), 0)

  // Paid client invoices — source of truth for revenue
  type InvoiceRow = { id: string; status: string; total: number | null; invoice_type: string | null; date_paid: string | null }
  const clientPaidInvs = (invoices as InvoiceRow[])
    .filter(i => i.invoice_type === 'client' && i.status === 'paid' && i.date_paid)
    .map(i => ({ ...i, date_paid: i.date_paid! }))

  // ── Display name: profiles.full_name → auth metadata → email prefix ──────
  const meta         = user?.user_metadata ?? {}
  const metaFullName = (meta.full_name as string | undefined) || (meta.name as string | undefined) || ''
  const sourceName   = profileFullName || metaFullName
  const rawFirst     = sourceName
    ? (sourceName.split(' ')[0] ?? '')
    : ((user?.email ?? '').split('@')[0] ?? '').split('.')[0] ?? ''
  const displayName = rawFirst
    ? rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1)
    : companyName

  // ── Batch 2 (needs companyId) ─────────────────────────────────────────────
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()

  const [dispTodayRes, dispDetailRes, missingRes, noResponseRes, missingRevenueRes, workingRes, pendingRDRes, coiRes, driverComplianceRes] = companyId
    ? await Promise.all([
        supabase.from('dispatches').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('dispatch_date', todayStr).neq('status', 'completed').neq('status', 'cancelled'),
        supabase.from('dispatches').select('id, driver_name, status, start_time, jobs(job_name)').eq('company_id', companyId).eq('dispatch_date', todayStr).neq('status', 'cancelled').order('created_at', { ascending: false }).limit(6),
        supabase.from('dispatches').select('id', { count: 'exact', head: true }).eq('company_id', companyId).lt('dispatch_date', todayStr).neq('status', 'completed').neq('status', 'cancelled'),
        supabase.from('dispatches').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('dispatch_date', todayStr).eq('status', 'dispatched').lt('created_at', oneHourAgo),
        // Estimate missing revenue: past dispatches with loads_completed > 0 and a per_load rate
        supabase.from('dispatches').select('loads_completed, jobs(rate, rate_type)').eq('company_id', companyId).lt('dispatch_date', todayStr).neq('status', 'completed').neq('status', 'cancelled').gt('loads_completed', 0).limit(100),
        // Drivers currently in 'working' status today
        supabase.from('dispatches').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('dispatch_date', todayStr).eq('status', 'working'),
        // Pending received dispatches (incoming work from other companies)
        supabase.from('received_dispatches').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'pending'),
        // Expiring/expired COIs
        supabase.from('contractors').select('name, coi_expiry').eq('company_id', companyId).eq('status', 'active').not('coi_expiry', 'is', null),
        // Driver compliance (CDL + medical)
        supabase.from('drivers').select('name, cdl_expiry, medical_card_expiry').eq('company_id', companyId).eq('status', 'active'),
      ])
    : [
        { count: 0, error: null },
        { data: [],  error: null },
        { count: 0, error: null },
        { count: 0, error: null },
        { data: [],  error: null },
        { count: 0, error: null },
        { count: 0, error: null },
        { data: [],  error: null },
        { data: [],  error: null },
      ] as const

  const dispatchedToday      = dispTodayRes.count  ?? 0
  const todayDispatches      = (dispDetailRes.data ?? []) as unknown as TodayDispatch[]
  const missingTickets       = missingRes.count    ?? 0
  const noResponseCount      = noResponseRes.count ?? 0
  type CoiRow = { name: string; coi_expiry: string }
  const expiringCOIs = ((coiRes as { data: CoiRow[] | null }).data ?? []).filter((c: CoiRow) =>
    Math.floor((new Date(c.coi_expiry).getTime() - Date.now()) / 86400000) <= 30
  )
  type DriverComplianceRow = { name: string; cdl_expiry: string | null; medical_card_expiry: string | null }
  const complianceAlerts = ((driverComplianceRes as { data: DriverComplianceRow[] | null }).data ?? []).filter((d: DriverComplianceRow) => {
    const cdlDays = d.cdl_expiry ? Math.floor((new Date(d.cdl_expiry).getTime() - Date.now()) / 86400000) : null
    const medDays = d.medical_card_expiry ? Math.floor((new Date(d.medical_card_expiry).getTime() - Date.now()) / 86400000) : null
    return (cdlDays !== null && cdlDays <= 30) || (medDays !== null && medDays <= 30)
  })
  const workingDrivers       = workingRes.count    ?? 0
  const pendingReceivedCount = (pendingRDRes as { count?: number | null }).count ?? 0

  // Estimate missing revenue from dispatches with unclaimed loads
  const missingRevenueEst: number = ((missingRevenueRes as { data: unknown[] | null }).data ?? []).reduce((sum: number, d: unknown) => {
    const row = d as { loads_completed?: number; jobs?: { rate?: number | null; rate_type?: string | null } | null }
    const rate = row.jobs?.rate ?? 0
    const type = row.jobs?.rate_type ?? 'load'
    return sum + (type === 'load' ? (row.loads_completed ?? 0) * rate : 0)
  }, 0)

  // ── Job costs for profit calculation ─────────────────────────────────────
  const jobCostRes = effectiveCompanyId
    ? await supabase.from('jobs').select('job_name, driver_cost, fuel_cost, other_costs').eq('company_id', effectiveCompanyId)
    : { data: [] }
  const jobsForCost = (jobCostRes.data ?? []) as { job_name: string; driver_cost: number | null; fuel_cost: number | null; other_costs: number | null }[]

  // ── Stat calculations ─────────────────────────────────────────────────────
  const thisWeekTickets = loads.filter(l => l.date >= thisWeekStartStr && l.date <= todayStr).length
  const lastWeekTickets = loads.filter(l => l.date >= lastWeekStartStr && l.date <= lastWeekEndStr).length
  const ticketPct = lastWeekTickets > 0 ? Math.round((thisWeekTickets - lastWeekTickets) / lastWeekTickets * 100) : null

  // Revenue = paid client invoices, using date_paid as the revenue date
  const thisMonthRev = clientPaidInvs.filter(i => i.date_paid.startsWith(thisMonthStr)).reduce((s, i) => s + (i.total ?? 0), 0)
  const prevMonthRev = clientPaidInvs.filter(i => i.date_paid.startsWith(prevMonthStr)).reduce((s, i) => s + (i.total ?? 0), 0)
  const revPct = prevMonthRev > 0 ? Math.round((thisMonthRev - prevMonthRev) / prevMonthRev * 100) : null

  // Outstanding = draft + sent invoices
  const outstandingInvs  = invoices.filter(i => ['draft', 'sent'].includes(i.status))
  const outstandingTotal = outstandingInvs.reduce((s, i) => s + (i.total ?? 0), 0)
  const draftInvCount    = invoices.filter(i => i.status === 'draft').length

  // Pending driver-submitted tickets
  const pendingDriverTickets = loads.filter(l => l.submitted_by_driver && l.status === 'pending').length

  // Panel stats
  const overdueInvs     = invoices.filter(i => i.status === 'overdue')
  const overdueTotal    = overdueInvs.reduce((s, i) => s + (i.total ?? 0), 0)
  const partialInvs     = invoices.filter(i => i.status === 'partially_paid')
  const partialTotal    = partialInvs.reduce((s, i) => s + ((i as { amount_remaining?: number | null }).amount_remaining ?? i.total ?? 0), 0)
  const loadsToday      = loads.filter(l => l.date === todayStr)
  const weekRevCollected = clientPaidInvs
    .filter(i => i.date_paid >= thisWeekStartStr && i.date_paid <= todayStr)
    .reduce((s, i) => s + (i.total ?? 0), 0)
  const weekRevProjected = loads
    .filter(l => l.date >= thisWeekStartStr && l.date <= todayStr)
    .reduce((s, l) => s + ((l.total_pay ?? l.rate) ?? 0), 0)

  // Week profit (costs attributed to jobs active this week)
  const weekJobNames = new Set(loads.filter(l => l.date >= thisWeekStartStr && l.date <= todayStr).map(l => l.job_name))
  const weekCosts    = jobsForCost
    .filter(j => weekJobNames.has(j.job_name))
    .reduce((s, j) => s + (j.driver_cost ?? 0) + (j.fuel_cost ?? 0) + (j.other_costs ?? 0), 0)
  const weekProfit = weekRevProjected - weekCosts
  const weekMargin = weekRevProjected > 0 ? Math.round((weekProfit / weekRevProjected) * 100) : null

  // Recent tickets
  const recentLoads = loads.slice(0, 6)

  // ── Top drivers by revenue (all loads.rate, no status filter) ─────────────
  const driverMap = loads.reduce<Record<string, { loads: number; revenue: number }>>((acc, l) => {
    const key = l.driver_name || 'Unknown'
    if (!acc[key]) acc[key] = { loads: 0, revenue: 0 }
    acc[key]!.loads++
    acc[key]!.revenue += (l.total_pay ?? l.rate) ?? 0
    return acc
  }, {})
  const topDrivers    = Object.entries(driverMap).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
  const maxDriverRev  = topDrivers[0]?.revenue ?? 1

  // ── Top customers by revenue ──────────────────────────────────────────────
  const customerMap = loads.reduce<Record<string, { loads: number; revenue: number }>>((acc, l) => {
    const key = (l as Record<string, unknown>).client_company as string | null || l.job_name || 'Unknown'
    if (!acc[key]) acc[key] = { loads: 0, revenue: 0 }
    acc[key]!.loads++
    acc[key]!.revenue += (l.total_pay ?? l.rate) ?? 0
    return acc
  }, {})
  const topCustomers   = Object.entries(customerMap).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
  const maxCustomerRev = topCustomers[0]?.revenue ?? 1

  // ── Chart data ────────────────────────────────────────────────────────────

  // Charts show cash collected = paid client invoices, by date_paid
  // This Week: Mon–Sun, revenue per day
  const weekData = DAY_NAMES.map((label, i) => {
    const d = new Date(thisWeekStart)
    d.setDate(thisWeekStart.getDate() + i)
    const ds = d.toISOString().split('T')[0]!
    const revenue = clientPaidInvs.filter(i => i.date_paid === ds).reduce((s, i) => s + (i.total ?? 0), 0)
    return { label, revenue }
  })

  // This Month: grouped by week (W1–W5)
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const numWeeks    = Math.ceil(daysInMonth / 7)
  const monthData   = Array.from({ length: numWeeks }, (_, w) => {
    const startDay = w * 7 + 1
    const endDay   = Math.min(startDay + 6, daysInMonth)
    const revenue  = clientPaidInvs.filter(i => {
      if (!i.date_paid.startsWith(thisMonthStr)) return false
      const day = parseInt(i.date_paid.split('-')[2] ?? '0')
      return day >= startDay && day <= endDay
    }).reduce((s, i) => s + (i.total ?? 0), 0)
    return { label: `W${w + 1}`, revenue }
  })

  // This Year: Jan–Dec of current year
  const yearData = MONTH_NAMES.map((label, i) => {
    const key     = `${now.getFullYear()}-${String(i + 1).padStart(2, '0')}`
    const revenue = clientPaidInvs.filter(i => i.date_paid.startsWith(key)).reduce((s, i) => s + (i.total ?? 0), 0)
    return { label, revenue }
  })

  const fmt = (n: number) => `$${n.toLocaleString()}`

  // ── Alerts ────────────────────────────────────────────────────────────────
  const alerts = [
    pendingDriverTickets > 0 && {
      label:   `${pendingDriverTickets} driver ticket${pendingDriverTickets !== 1 ? 's' : ''} pending review`,
      icon:    Clock,
      color:   'text-yellow-600 bg-yellow-50 border-yellow-200',
      iconCls: 'text-yellow-500',
      href:    '/dashboard/tickets',
      cta:     'Review →',
    },
    draftInvCount > 0 && {
      label:   `${draftInvCount} invoice${draftInvCount !== 1 ? 's' : ''} not yet sent`,
      icon:    FileText,
      color:   'text-blue-700 bg-blue-50 border-blue-200',
      iconCls: 'text-blue-500',
      href:    '/dashboard/invoices',
      cta:     'Send →',
    },
    noResponseCount > 0 && {
      label:   `${noResponseCount} dispatch${noResponseCount !== 1 ? 'es' : ''} with no driver response`,
      icon:    AlertTriangle,
      color:   'text-orange-700 bg-orange-50 border-orange-200',
      iconCls: 'text-orange-500',
      href:    '/dashboard/dispatch',
      cta:     'Follow up →',
    },
    missingTickets > 0 && {
      label:   missingRevenueEst > 0
        ? `⚠️ Missing ~${fmt(missingRevenueEst)} from ${missingTickets} dispatch${missingTickets !== 1 ? 'es' : ''} with unsubmitted tickets`
        : `${missingTickets} past dispatch${missingTickets !== 1 ? 'es' : ''} missing tickets`,
      icon:    AlertTriangle,
      color:   'text-amber-700 bg-amber-50 border-amber-200',
      iconCls: 'text-amber-500',
      href:    '/dashboard/tickets?tab=missing',
      cta:     'Review →',
    },
  ].filter(Boolean) as { label: string; icon: React.ElementType; color: string; iconCls: string; href: string; cta: string }[]

  // ── Revenue goal progress ─────────────────────────────────────────────────
  const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dayOfMonth         = now.getDate()
  const goalProgress       = monthlyRevenueGoal && monthlyRevenueGoal > 0
    ? Math.min(Math.round((thisMonthRev / monthlyRevenueGoal) * 100), 100)
    : null
  const goalPaceExpected   = monthlyRevenueGoal
    ? Math.round((dayOfMonth / daysInCurrentMonth) * monthlyRevenueGoal)
    : 0

  // ── AI Insights (computed from existing data, no model call) ──────────────
  const insights: string[] = []
  if (weekMargin !== null && weekMargin < 15 && weekRevProjected > 500) {
    insights.push(`Margin this week is ${weekMargin}% — review job costs to protect profit.`)
  }
  if (overdueInvs.length > 0 && overdueTotal > 500) {
    insights.push(`${fmt(overdueTotal)} overdue across ${overdueInvs.length} invoice${overdueInvs.length !== 1 ? 's' : ''}. Chase these to free up cash.`)
  }
  if (pendingDriverTickets > 0) {
    insights.push(`${pendingDriverTickets} driver ticket${pendingDriverTickets !== 1 ? 's' : ''} pending approval — approve before invoicing.`)
  }
  if (monthlyRevenueGoal && dayOfMonth > 5 && thisMonthRev < goalPaceExpected) {
    const gap = goalPaceExpected - thisMonthRev
    insights.push(`${fmt(gap)} behind pace for your ${fmt(monthlyRevenueGoal)} monthly goal.`)
  }
  if (thisWeekTickets === 0 && dispatchedToday === 0) {
    insights.push('No tickets or dispatches this week — is the fleet running?')
  }

  return (
    <div className="max-w-7xl">
      {/* Solo upgrade nudge */}
      {companyPlan === 'solo' && <SoloUpgradeNudge />}

      {/* Setup progress banner — self-fetches, hides when dismissed or complete */}
      <SetupProgressBanner />

      <div className="p-6 md:p-8">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {displayName} 👋</h1>
        <p className="text-gray-500 text-sm mt-1">
          {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* ── Profit Alerts (client component — self-fetches) ──────────────────── */}
      {companyId && <ProfitAlerts companyId={companyId} />}

      {/* ── AI Insights ──────────────────────────────────────────────────────── */}
      {insights.length > 0 && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2">💡 Insights</p>
          <ul className="space-y-1">
            {insights.map((insight, i) => (
              <li key={i} className="text-sm text-amber-800">• {insight}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Action Panels ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

        {/* Panel 1: Needs Attention */}
        <div className={`rounded-xl border p-4 ${(missingTickets > 0 || overdueInvs.length > 0 || noResponseCount > 0) ? 'border-red-200 bg-red-50/30' : 'border-gray-100 bg-white'}`}>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">🚨 {t('needsAttention')}</p>
          <div className="space-y-2.5">
            {missingTickets > 0 ? (
              <Link href="/dashboard/tickets?tab=missing" className="flex items-center justify-between gap-2 group">
                <span className="text-sm text-red-700 font-medium group-hover:underline">{missingTickets !== 1 ? t('missingTicketsPlural', { count: missingTickets }) : t('missingTickets', { count: missingTickets })}</span>
                {missingRevenueEst > 0 && <span className="text-xs font-bold text-red-600 shrink-0">~{fmt(missingRevenueEst)}</span>}
              </Link>
            ) : (
              <p className="text-sm text-gray-400">{t('noMissingTickets')}</p>
            )}
            {overdueInvs.length > 0 ? (
              <Link href="/dashboard/invoices?filter=overdue" className="flex items-center justify-between gap-2 group">
                <span className="text-sm text-orange-700 font-medium group-hover:underline">{overdueInvs.length !== 1 ? t('overdueInvoices_plural', { count: overdueInvs.length }) : t('overdueInvoice', { count: overdueInvs.length })}</span>
                <span className="text-xs font-bold text-orange-600 shrink-0">{fmt(overdueTotal)}</span>
              </Link>
            ) : (
              <p className="text-sm text-gray-400">{t('noOverdueInvoices')}</p>
            )}
            {partialInvs.length > 0 && (
              <Link href="/dashboard/revenue" className="flex items-center justify-between gap-2 group">
                <span className="text-sm text-amber-700 font-medium group-hover:underline">{partialInvs.length !== 1 ? t('partiallyPaidPlural', { count: partialInvs.length }) : t('partiallyPaid', { count: partialInvs.length })}</span>
                <span className="text-xs font-bold text-amber-600 shrink-0">${fmt(partialTotal)} {t('outstanding')}</span>
              </Link>
            )}
            {noResponseCount > 0 ? (
              <Link href="/dashboard/dispatch" className="flex items-center justify-between gap-2 group">
                <span className="text-sm text-amber-700 font-medium group-hover:underline">{noResponseCount !== 1 ? t('noResponsePlural', { count: noResponseCount }) : t('noResponse', { count: noResponseCount })}</span>
                <span className="text-xs text-amber-600 shrink-0">{t('followUp')}</span>
              </Link>
            ) : (
              <p className="text-sm text-gray-400">{t('allDriversResponded')}</p>
            )}
            {pendingReceivedCount > 0 && (
              <Link href="/dashboard/dispatch" className="flex items-center justify-between gap-2 group">
                <span className="text-sm text-blue-700 font-medium group-hover:underline">{pendingReceivedCount !== 1 ? t('incomingOfferPlural', { count: pendingReceivedCount }) : t('incomingOffer', { count: pendingReceivedCount })}</span>
                <span className="text-xs text-blue-600 shrink-0">{t('reviewMissing')}</span>
              </Link>
            )}
            {expiringCOIs.length > 0 && (
              <Link href="/dashboard/contractors" className="flex items-center justify-between gap-2 group border-t pt-2.5">
                <span className="text-sm text-red-700 font-medium group-hover:underline">🛡️ {expiringCOIs.length} subcontractor COI{expiringCOIs.length > 1 ? 's' : ''} expiring soon</span>
                <span className="text-xs font-bold text-red-600 shrink-0">Review →</span>
              </Link>
            )}
            {complianceAlerts.length > 0 && (
              <Link href="/dashboard/drivers" className="flex items-center justify-between gap-2 group border-t pt-2.5">
                <span className="text-sm text-amber-700 font-medium group-hover:underline">⚠️ {complianceAlerts.length} driver{complianceAlerts.length > 1 ? 's' : ''} with expiring CDL or medical</span>
                <span className="text-xs font-bold text-amber-600 shrink-0">Review →</span>
              </Link>
            )}
          </div>
        </div>

        {/* Panel 2: Today's Operations */}
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">🚛 {t('todaysOperations')}</p>
          <div className="space-y-2.5">
            <Link href="/dashboard/dispatch" className="flex items-center justify-between gap-2 group">
              <span className="text-sm text-gray-700 group-hover:underline">{t('activeDispatches')}</span>
              <span className="text-sm font-bold text-purple-700">{dispatchedToday}</span>
            </Link>
            <Link href="/dashboard/dispatch" className="flex items-center justify-between gap-2 group">
              <span className="text-sm text-gray-700 group-hover:underline">{t('driversWorking')}</span>
              <span className="text-sm font-bold text-green-700">{workingDrivers}</span>
            </Link>
            <Link href="/dashboard/tickets" className="flex items-center justify-between gap-2 group">
              <span className="text-sm text-gray-700 group-hover:underline">{t('jobsCompletedToday')}</span>
              <span className="text-sm font-bold text-[var(--brand-primary)]">{loadsToday.length}</span>
            </Link>
          </div>
        </div>

        {/* Panel 3: Money This Week */}
        <div className="rounded-xl border border-green-100 bg-green-50/30 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">💰 {t('moneyThisWeek')}</p>
          {monthlyRevenueGoal && goalProgress !== null && (
            <div className="mb-3 pb-3 border-b border-green-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">Monthly goal: {fmt(monthlyRevenueGoal)}</span>
                <span className="text-xs font-bold text-green-700">{goalProgress}%</span>
              </div>
              <div className="h-2 bg-green-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${goalProgress}%` }} />
              </div>
            </div>
          )}
          <div className="space-y-2.5">
            <Link href="/dashboard/revenue" className="flex items-center justify-between gap-2 group">
              <span className="text-sm text-gray-700 group-hover:underline">{t('revenue')}</span>
              <span className="text-sm font-bold text-green-700">{fmt(weekRevProjected)}</span>
            </Link>
            {weekCosts > 0 && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-gray-700">{t('jobCosts')}</span>
                <span className="text-sm font-bold text-red-600">-{fmt(weekCosts)}</span>
              </div>
            )}
            {weekCosts > 0 && (
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-green-100">
                <span className="text-sm font-semibold text-gray-900">{t('netProfit')}</span>
                <span className={`text-sm font-bold ${weekProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {weekProfit >= 0 ? '' : '-'}{fmt(Math.abs(weekProfit))}
                  {weekMargin !== null && (
                    <span className="text-xs font-medium text-gray-500 ml-1">({weekMargin}%)</span>
                  )}
                </span>
              </div>
            )}
            <Link href="/dashboard/invoices" className="flex items-center justify-between gap-2 group">
              <span className="text-sm text-gray-700 group-hover:underline">{t('outstandingInvoices')}</span>
              <span className={`text-sm font-bold ${outstandingTotal > 0 ? 'text-orange-600' : 'text-gray-500'}`}>{fmt(outstandingTotal)}</span>
            </Link>
            <Link href="/dashboard/revenue" className="flex items-center justify-between gap-2 group">
              <span className="text-sm text-gray-700 group-hover:underline">{t('revenueCollected')}</span>
              <span className="text-sm font-bold text-[var(--brand-primary)]">{fmt(weekRevCollected)}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <DashboardStatCards
        companyId={effectiveCompanyId}
        thisWeekTickets={thisWeekTickets}
        ticketPct={ticketPct}
        thisMonthRev={thisMonthRev}
        revPct={revPct}
        outstandingTotal={outstandingTotal}
        outstandingCount={outstandingInvs.length}
        dispatchedToday={dispatchedToday}
        thisWeekStartStr={thisWeekStartStr}
        todayStr={todayStr}
        thisMonthStr={thisMonthStr}
        weekProfit={weekProfit}
        weekMargin={weekMargin}
      />

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: t('dispatchDriver'), icon: Send,      href: '/dashboard/dispatch',       bg: 'bg-[var(--brand-dark)] text-white hover:bg-[var(--brand-primary-hover)]' },
          { label: t('addTicket'),      icon: Plus,      href: '/dashboard/tickets',        bg: 'bg-white text-gray-800 border border-gray-200 hover:border-[var(--brand-primary)] hover:bg-[#f0fdf4]' },
          { label: t('newInvoice'),     icon: FileText,  href: '/dashboard/invoices?new=1', bg: 'bg-white text-gray-800 border border-gray-200 hover:border-[var(--brand-primary)] hover:bg-[#f0fdf4]' },
          { label: t('addExpense'),     icon: Receipt,   href: '/dashboard/expenses?new-expense=1', bg: 'bg-white text-gray-800 border border-gray-200 hover:border-[var(--brand-primary)] hover:bg-[#f0fdf4]' },
        ].map(({ label, icon: Icon, href, bg }) => (
          <Link
            key={label}
            href={href}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl py-5 text-sm font-semibold transition-all ${bg}`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </div>

      {/* Pending Alerts */}
      {alerts.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {alerts.map((a) => {
            const Icon = a.icon
            return (
              <Link
                key={a.label}
                href={a.href}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 hover:opacity-90 transition-opacity ${a.color}`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${a.iconCls}`} />
                <span className="text-xs font-medium flex-1 leading-snug">{a.label}</span>
                <span className="text-xs font-semibold shrink-0 whitespace-nowrap">{a.cta}</span>
              </Link>
            )
          })}
        </div>
      )}

      {/* Chart + Top Drivers + Top Customers */}
      <div className="grid lg:grid-cols-4 gap-6 mb-6">

        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-gray-900 text-sm">{t('revenue')}</h2>
          </div>
          <p className="text-xs text-gray-400 mb-4">{t('revenueChartSubtitle')}</p>
          <LoadsChart week={weekData} month={monthData} year={yearData} />
        </div>

        {/* Top Drivers */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 text-sm">{t('topDrivers')}</h2>
            <Link href="/dashboard/drivers" className="text-xs text-[var(--brand-primary)] font-medium hover:underline">{t('viewAll')}</Link>
          </div>
          {topDrivers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">{t('noDriverData')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {topDrivers.map((d, i) => {
                const barPct = maxDriverRev > 0 ? Math.round((d.revenue / maxDriverRev) * 100) : 0
                const perLoad = d.loads > 0 ? Math.round(d.revenue / d.loads) : 0
                return (
                  <div key={d.name}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-5 w-5 rounded-full bg-[var(--brand-dark)] flex items-center justify-center text-[10px] font-bold text-white shrink-0">{i + 1}</div>
                      <p className="text-sm font-medium text-gray-900 truncate flex-1">{d.name}</p>
                      <span className="text-xs font-semibold text-[var(--brand-primary)] shrink-0">{fmt(d.revenue)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[var(--brand-primary)] rounded-full" style={{ width: `${barPct}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0 w-20 text-right">{d.loads} ld · {fmt(perLoad)}/ld</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top Customers */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 text-sm">Top Customers</h2>
          </div>
          {topCustomers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No customer data</p>
            </div>
          ) : (
            <div className="space-y-4">
              {topCustomers.map((c, i) => {
                const barPct = maxCustomerRev > 0 ? Math.round((c.revenue / maxCustomerRev) * 100) : 0
                return (
                  <div key={c.name}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-5 w-5 rounded-full bg-blue-800 flex items-center justify-center text-[10px] font-bold text-white shrink-0">{i + 1}</div>
                      <p className="text-sm font-medium text-gray-900 truncate flex-1">{c.name}</p>
                      <span className="text-xs font-semibold text-blue-600 shrink-0">{fmt(c.revenue)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${barPct}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0 w-14 text-right">{c.loads} load{c.loads !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bid Pipeline */}
      {openLeadCount > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-gray-900 text-sm">🎯 Bid Pipeline</h2>
              <p className="text-xs text-gray-400 mt-0.5">{openLeadCount} open bid{openLeadCount !== 1 ? 's' : ''}</p>
            </div>
            <Link href="/dashboard/leads" className="text-xs text-[var(--brand-primary)] font-medium hover:underline">View all →</Link>
          </div>
          <div className="flex items-center gap-8">
            <div>
              <p className="text-2xl font-bold text-gray-900">{fmt(openLeadValue)}</p>
              <p className="text-xs text-gray-500">Total pipeline value</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-700">{openLeadCount}</p>
              <p className="text-xs text-gray-500">Open bids</p>
            </div>
          </div>
        </div>
      )}

      {/* Driver Profit Table (client component — self-fetches) */}
      {companyId && <DriverProfitTable companyId={companyId} />}

      {/* Weather Banner */}
      <WeatherBanner />

      {/* Today's Dispatches */}
      {companyId && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-purple-500" />
              <h2 className="font-semibold text-gray-900 text-sm">{t('todaysDispatches')}</h2>
              {dispatchedToday > 0 && (
                <span className="rounded-full bg-purple-100 text-purple-700 px-2 py-0.5 text-xs font-bold">{dispatchedToday}</span>
              )}
            </div>
            <Link href="/dashboard/dispatch" className="text-xs text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)] font-medium">{t('viewAll')}</Link>
          </div>
          {todayDispatches.length === 0 ? (
            <div className="text-center py-10">
              <Radio className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">{t('noDispatchesToday')}</p>
              <Link href="/dashboard/dispatch" className="text-xs text-[var(--brand-primary)] mt-1 inline-block hover:underline">{t('dispatchADriver')}</Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {todayDispatches.map(d => {
                const badge = dispStatusBadge[d.status] ?? { label: d.status, cls: 'bg-gray-100 text-gray-600' }
                return (
                  <div key={d.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/50">
                    <div className="h-9 w-9 rounded-full bg-[var(--brand-dark)]/10 flex items-center justify-center text-[var(--brand-dark)] font-bold text-xs shrink-0">
                      {d.driver_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{d.driver_name}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {d.jobs?.job_name ?? 'No job assigned'}
                        {d.start_time ? ` · ${d.start_time}` : ''}
                      </p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Recent Tickets */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 text-sm">{t('recentTickets')}</h2>
          <Link href="/dashboard/tickets" className="text-xs text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)] font-medium">{t('viewAll')}</Link>
        </div>
        {recentLoads.length === 0 ? (
          <div className="text-center py-12">
            <Truck className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-medium">{t('noTickets')}</p>
            <Link href="/dashboard/tickets" className="text-xs text-[var(--brand-primary)] mt-1 inline-block hover:underline">{t('addFirstTicket')}</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {[t('tableJob'), t('tableDriver'), t('tableDate'), t('tableTotal'), t('tableStatus')].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentLoads.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-medium text-gray-900">{l.job_name}</td>
                    <td className="px-5 py-3 text-gray-600">{l.driver_name}</td>
                    <td className="px-5 py-3 text-gray-500">{l.date ? new Date(l.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</td>
                    <td className="px-5 py-3 font-medium text-gray-900">{l.total_pay != null ? fmt(l.total_pay) : l.rate != null ? fmt(l.rate) : '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${ticketStatusColor[l.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {l.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Documents */}
      {companyId && (
        <div className="mb-6">
          <RecentDocuments />
        </div>
      )}

      {/* Activity Feed */}
      {activityFeed.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Activity className="h-4 w-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900 text-sm">{t('recentActivity')}</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {activityFeed.map(a => (
              <div key={a.id} className="px-5 py-3 flex items-start gap-3">
                <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                  a.type === 'ticket_approved'  ? 'bg-green-400' :
                  a.type === 'dispatch_created' ? 'bg-blue-400'  :
                  'bg-gray-300'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{a.message}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(a.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
