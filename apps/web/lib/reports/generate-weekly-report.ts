import type { SupabaseClient } from '@supabase/supabase-js'

export interface WeeklyReportData {
  companyName: string
  weekStart: string       // "Apr 28"
  weekEnd: string         // "May 4"
  weekStartIso: string    // "2025-04-28"
  weekEndIso: string      // "2025-05-04"
  totalRevenue: number
  totalLoads: number
  outstandingAmount: number
  missingTicketValue: number
  topJob: { name: string; revenue: number } | null
  overdueCount: number
}

function fmtShort(iso: string): string {
  const [, m, d] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m!) - 1]} ${parseInt(d!)}`
}

export async function generateWeeklyReport(
  supabase: SupabaseClient,
  companyId: string,
  companyName: string,
): Promise<WeeklyReportData> {
  // Week = last Monday → last Sunday (yesterday when run on Monday)
  const today    = new Date()
  const weekEnd  = new Date(today)
  weekEnd.setDate(today.getDate() - 1)                       // yesterday (Sunday)
  const weekStart = new Date(weekEnd)
  weekStart.setDate(weekEnd.getDate() - 6)                   // 7 days back (last Monday)

  const weekStartIso = weekStart.toISOString().split('T')[0]!
  const weekEndIso   = weekEnd.toISOString().split('T')[0]!

  // Run all queries in parallel
  const [invRes, loadsRes, outstandingRes, overdueRes, dispatchRes] = await Promise.all([
    // Paid invoices this week (by date_paid)
    supabase
      .from('invoices')
      .select('total, date_paid')
      .eq('company_id', companyId)
      .eq('status', 'paid')
      .gte('date_paid', weekStartIso)
      .lte('date_paid', weekEndIso),

    // All loads this week (by ticket date)
    supabase
      .from('loads')
      .select('id, job_name, rate, dispatch_id')
      .eq('company_id', companyId)
      .gte('date', weekStartIso)
      .lte('date', weekEndIso),

    // All unpaid/outstanding invoices
    supabase
      .from('invoices')
      .select('total')
      .eq('company_id', companyId)
      .in('status', ['sent', 'overdue', 'partially_paid']),

    // Overdue invoice count
    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'overdue'),

    // Dispatches this week with loads_completed > 0 (for missing ticket calc)
    supabase
      .from('dispatches')
      .select('id, loads_completed, jobs(rate)')
      .eq('company_id', companyId)
      .gte('dispatch_date', weekStartIso)
      .lte('dispatch_date', weekEndIso)
      .gt('loads_completed', 0),
  ])

  // 1. Revenue
  const totalRevenue = (invRes.data ?? []).reduce((s, i) => s + (i.total ?? 0), 0)

  // 2. Loads
  const weekLoads  = loadsRes.data ?? []
  const totalLoads = weekLoads.length

  // 3. Outstanding
  const outstandingAmount = (outstandingRes.data ?? []).reduce((s, i) => s + (i.total ?? 0), 0)

  // 4. Overdue count
  const overdueCount = overdueRes.count ?? 0

  // 5. Missing ticket value
  //    Build dispatch_id → ticket count map from this week's loads
  const ticketsByDispatch = new Map<string, number>()
  for (const l of weekLoads) {
    if (l.dispatch_id) {
      ticketsByDispatch.set(l.dispatch_id, (ticketsByDispatch.get(l.dispatch_id) ?? 0) + 1)
    }
  }
  let missingTicketValue = 0
  for (const d of (dispatchRes.data ?? [])) {
    const submitted = ticketsByDispatch.get(d.id) ?? 0
    const missing   = Math.max(0, (d.loads_completed ?? 0) - submitted)
    if (missing > 0) {
      const rate = (d.jobs as { rate?: number } | null)?.rate ?? 0
      missingTicketValue += missing * rate
    }
  }

  // 6. Top job by sum of rates on loads this week
  const jobRevMap = new Map<string, number>()
  for (const l of weekLoads) {
    if (l.job_name) {
      jobRevMap.set(l.job_name, (jobRevMap.get(l.job_name) ?? 0) + (l.rate ?? 0))
    }
  }
  const sortedJobs = [...jobRevMap.entries()].sort((a, b) => b[1] - a[1])
  const topJob = sortedJobs[0]
    ? { name: sortedJobs[0][0], revenue: sortedJobs[0][1] }
    : null

  return {
    companyName,
    weekStart:    fmtShort(weekStartIso),
    weekEnd:      fmtShort(weekEndIso),
    weekStartIso,
    weekEndIso,
    totalRevenue,
    totalLoads,
    outstandingAmount,
    missingTicketValue,
    topJob,
    overdueCount,
  }
}
