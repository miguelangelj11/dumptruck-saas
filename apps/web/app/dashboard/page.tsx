export const revalidate = 30

import { createClient } from '@/lib/supabase/server'
import { TrendingUp, Truck, Users, Receipt, Activity, AlertTriangle, Radio } from 'lucide-react'
import LoadsChart from '@/components/dashboard/loads-chart'
import DriverApprovalQueue from '@/components/dashboard/driver-approval-queue'
import Link from 'next/link'

const statusColor: Record<string, string> = {
  pending:  'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  invoiced: 'bg-blue-100 text-blue-700',
  paid:     'bg-emerald-100 text-emerald-700',
  disputed: 'bg-red-100 text-red-700',
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const uid = user?.id ?? ''

  // For team members, company_id on data rows = the owner's user id (= companies.id).
  // Look it up via team_members so all queries use the correct id.
  const { data: memberRow } = await supabase
    .from('team_members')
    .select('company_id')
    .eq('user_id', uid)
    .maybeSingle()
  const effectiveCompanyId = memberRow?.company_id ?? uid

  // ── Date helpers ──────────────────────────────────────────────────────────
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]!
  const dayOfWeek = now.getDay()
  const daysToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const thisWeekStart = new Date(now)
  thisWeekStart.setDate(now.getDate() - daysToMon)
  const thisWeekStartStr = thisWeekStart.toISOString().split('T')[0]!
  const lastWeekStartD = new Date(thisWeekStart)
  lastWeekStartD.setDate(thisWeekStart.getDate() - 7)
  const lastWeekStartStr = lastWeekStartD.toISOString().split('T')[0]!
  const lastWeekEndD = new Date(thisWeekStart)
  lastWeekEndD.setDate(thisWeekStart.getDate() - 1)
  const lastWeekEndStr = lastWeekEndD.toISOString().split('T')[0]!
  const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const prevMonthD = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthStr = `${prevMonthD.getFullYear()}-${String(prevMonthD.getMonth() + 1).padStart(2, '0')}`

  // ── Date filter for chart (6 months of data) ─────────────────────────────
  const sixMonthsAgo = new Date(now)
  sixMonthsAgo.setMonth(now.getMonth() - 6)
  const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0]!

  // ── Batch 1: core data ────────────────────────────────────────────────────
  const [loadsRes, invoicesRes, companyRes, activityRes] = await Promise.all([
    supabase.from('loads').select('id, rate, status, driver_name, job_name, date, created_at').eq('company_id', effectiveCompanyId).gte('date', sixMonthsAgoStr).order('created_at', { ascending: false }),
    supabase.from('invoices').select('id, status, total, created_at').eq('company_id', effectiveCompanyId),
    supabase.from('companies').select('id, name, address, phone, email, logo_url, primary_color, onboarding_completed').eq('id', effectiveCompanyId).maybeSingle(),
    supabase.from('activity_feed').select('id, type, message, created_at').eq('company_id', effectiveCompanyId).order('created_at', { ascending: false }).limit(8),
  ])

  const loads    = loadsRes.data    ?? []
  const invoices = invoicesRes.data ?? []
  const companyId    = companyRes.data?.id
  const companyName  = companyRes.data?.name ?? ''
  const activityFeed = activityRes.error ? [] : (activityRes.data ?? [])

  // ── Setup completion banner ───────────────────────────────────────────────
  const co = companyRes.data as Record<string, unknown> | null
  // If the onboarding wizard was completed, never show the banner regardless of field state.
  // logo_url and primary_color are cosmetic — not required for the business to function.
  const onboardingCompleted = co?.onboarding_completed === true
  const setupChecks = [
    !!(co?.name),
    !!(co?.address),
    !!(co?.phone),
    !!(co?.email),
  ]

  // ── Batch 2: dispatch counts + driver count (needs companyId) ───────────────
  const [dispTodayRes, missingRes, driverCountRes] = companyId
    ? await Promise.all([
        supabase.from('dispatches').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('dispatch_date', todayStr).neq('status', 'completed'),
        supabase.from('dispatches').select('id', { count: 'exact', head: true }).eq('company_id', companyId).lt('dispatch_date', todayStr).neq('status', 'completed'),
        supabase.from('drivers').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
      ])
    : [{ count: 0, error: null }, { count: 0, error: null }, { count: 0, error: null }]

  const dispatchedToday = dispTodayRes.count ?? 0
  const missingTickets  = missingRes.count ?? 0
  const hasDrivers      = (driverCountRes.count ?? 0) > 0

  const allSetupChecks = [...setupChecks, hasDrivers]
  const setupDone  = allSetupChecks.filter(Boolean).length
  const setupTotal = allSetupChecks.length
  const setupPct   = Math.round((setupDone / setupTotal) * 100)
  const showSetupBanner = !onboardingCompleted && setupPct < 100

  // ── Stat calculations ─────────────────────────────────────────────────────
  const thisWeekTickets = loads.filter(l => l.date >= thisWeekStartStr && l.date <= todayStr).length
  const lastWeekTickets = loads.filter(l => l.date >= lastWeekStartStr && l.date <= lastWeekEndStr).length
  const ticketPct = lastWeekTickets > 0 ? Math.round((thisWeekTickets - lastWeekTickets) / lastWeekTickets * 100) : null

  const paidInvoices    = invoices.filter(i => i.status === 'paid')
  const thisMonthRev    = paidInvoices.filter(i => (i.created_at ?? '').startsWith(thisMonthStr)).reduce((s, i) => s + (i.total ?? 0), 0)
  const prevMonthRev    = paidInvoices.filter(i => (i.created_at ?? '').startsWith(prevMonthStr)).reduce((s, i) => s + (i.total ?? 0), 0)
  const revPct = prevMonthRev > 0 ? Math.round((thisMonthRev - prevMonthRev) / prevMonthRev * 100) : null

  const outstandingInvs  = invoices.filter(i => ['sent', 'overdue', 'partially_paid'].includes(i.status))
  const outstandingTotal = outstandingInvs.reduce((s, i) => s + (i.total ?? 0), 0)

  const recentLoads = loads.slice(0, 6)

  // Top drivers
  const driverMap = loads.reduce<Record<string, { loads: number; revenue: number }>>((acc, l) => {
    const key = l.driver_name || 'Unknown'
    if (!acc[key]) acc[key] = { loads: 0, revenue: 0 }
    acc[key]!.loads++
    if (l.status === 'paid' || l.status === 'invoiced') acc[key]!.revenue += l.rate ?? 0
    return acc
  }, {})
  const topDrivers = Object.entries(driverMap).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.loads - a.loads).slice(0, 5)

  // Chart
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const mo = (now.getMonth() - 5 + i + 12) % 12
    const yr = now.getFullYear() - (now.getMonth() - 5 + i < 0 ? 1 : 0)
    const key     = `${yr}-${String(mo + 1).padStart(2, '0')}`
    const prevKey = `${yr - 1}-${String(mo + 1).padStart(2, '0')}`
    return { month: MONTH_NAMES[mo] ?? '', current: loads.filter(l => l.date?.startsWith(key)).length, previous: loads.filter(l => l.date?.startsWith(prevKey)).length }
  })

  function pctBadge(value: number | null, period: 'week' | 'month') {
    if (value === null) return null
    const pos = value >= 0
    return <span className={`text-xs mt-1 font-medium ${pos ? 'text-green-600' : 'text-red-500'}`}>{pos ? '↑' : '↓'} {Math.abs(value)}% vs last {period}</span>
  }

  const stats = [
    {
      label: 'Tickets This Week',
      value: thisWeekTickets.toString(),
      sub: pctBadge(ticketPct, 'week'),
      icon: Truck,
      color: 'text-[#2d7a4f] bg-[#2d7a4f]/10',
      href: '/dashboard/tickets',
    },
    {
      label: 'Revenue This Month',
      value: `$${thisMonthRev.toLocaleString()}`,
      sub: pctBadge(revPct, 'month'),
      icon: TrendingUp,
      color: 'text-blue-600 bg-blue-100',
      href: '/dashboard/revenue',
    },
    {
      label: 'Outstanding Balance',
      value: `$${outstandingTotal.toLocaleString()}`,
      sub: <span className="text-xs mt-1 text-gray-400">{outstandingInvs.length} invoice{outstandingInvs.length !== 1 ? 's' : ''} unpaid</span>,
      icon: Receipt,
      color: outstandingTotal > 0 ? 'text-orange-500 bg-orange-100' : 'text-gray-400 bg-gray-100',
      href: '/dashboard/invoices',
    },
    {
      label: 'Dispatched Today',
      value: dispatchedToday.toString(),
      sub: <span className="text-xs mt-1 text-gray-400">active drivers out</span>,
      icon: Radio,
      color: dispatchedToday > 0 ? 'text-purple-600 bg-purple-100' : 'text-gray-400 bg-gray-100',
      href: '/dashboard/dispatch',
    },
  ]

  return (
    <div className="p-6 md:p-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {companyName}</h1>
        <p className="text-gray-500 text-sm mt-1">Here&apos;s what&apos;s happening with your operation today.</p>
      </div>

      {/* Incomplete setup banner */}
      {showSetupBanner && (
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-6 hover:bg-amber-100 transition-colors group"
        >
          <div className="shrink-0">
            <div className="h-10 w-10 rounded-full bg-amber-100 border-2 border-amber-200 flex items-center justify-center">
              <span className="text-xs font-bold text-amber-700">{setupPct}%</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">Finish setting up your account</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {setupTotal - setupDone} item{setupTotal - setupDone !== 1 ? 's' : ''} remaining — add your company contact info and first driver to complete setup.
            </p>
            <div className="mt-2 h-1.5 w-48 bg-amber-200 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${setupPct}%` }} />
            </div>
          </div>
          <span className="text-xs text-amber-600 font-medium group-hover:underline shrink-0">Complete setup →</span>
        </Link>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Link key={s.label} href={s.href} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md hover:border-gray-200 transition-all block">
              <div className={`inline-flex rounded-lg p-2 mb-3 ${s.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              {s.sub}
            </Link>
          )
        })}
      </div>

      {/* Driver Approval Queue */}
      {companyId && (
        <div className="mb-6">
          <DriverApprovalQueue companyId={companyId} />
        </div>
      )}

      {/* Missing Tickets Alert */}
      {missingTickets > 0 && (
        <Link href="/dashboard/tickets" className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-5 py-3 mb-6 hover:bg-orange-100 transition-colors">
          <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
          <span className="text-sm font-medium text-orange-800">
            {missingTickets} dispatch{missingTickets !== 1 ? 'es' : ''} from previous days have no tickets submitted
          </span>
          <span className="ml-auto text-xs text-orange-500 font-medium">Review →</span>
        </Link>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900 text-sm">Load Activity</h2>
              <p className="text-xs text-gray-400">This year vs last year</p>
            </div>
          </div>
          <LoadsChart data={chartData} />
        </div>

        {/* Top Drivers */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">Top Drivers</h2>
          {topDrivers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No driver data yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topDrivers.map((d, i) => (
                <div key={d.name} className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-full bg-[#1e3a2a] flex items-center justify-center text-xs font-bold text-white shrink-0">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{d.name}</p>
                    <p className="text-xs text-gray-400">{d.loads} loads</p>
                  </div>
                  <span className="text-sm font-semibold text-[#2d7a4f]">${d.revenue.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Tickets */}
      <div className="mt-6 bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 text-sm">Recent Tickets</h2>
          <a href="/dashboard/tickets" className="text-xs text-[#2d7a4f] hover:text-[#245f3e] font-medium">View all →</a>
        </div>
        {recentLoads.length === 0 ? (
          <div className="text-center py-12">
            <Truck className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-medium">No tickets yet</p>
            <p className="text-xs text-gray-400 mt-1"><a href="/dashboard/tickets" className="text-[#2d7a4f]">Add your first load ticket →</a></p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-gray-50">
                <tr>{['Job', 'Driver', 'Date', 'Rate', 'Status'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentLoads.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-medium text-gray-900">{l.job_name}</td>
                    <td className="px-5 py-3 text-gray-600">{l.driver_name}</td>
                    <td className="px-5 py-3 text-gray-500">{l.date ? new Date(l.date + 'T00:00:00').toLocaleDateString() : '—'}</td>
                    <td className="px-5 py-3 font-medium text-gray-900">{l.rate != null ? `$${l.rate.toLocaleString()}` : '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusColor[l.status] ?? 'bg-gray-100 text-gray-600'}`}>{l.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Activity Feed */}
      {activityFeed.length > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Activity className="h-4 w-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900 text-sm">Recent Activity</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {activityFeed.map(a => (
              <div key={a.id} className="px-5 py-3 flex items-start gap-3">
                <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${a.type === 'ticket_approved' ? 'bg-green-400' : a.type === 'dispatch_created' ? 'bg-blue-400' : 'bg-gray-300'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{a.message}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(a.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
