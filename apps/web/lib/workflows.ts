import type { SupabaseClient } from '@supabase/supabase-js'
import type { JobProfitMetrics, DriverProfitability, ProfitAlert, CompanyProfitSummary, DriverScore, DriverRecommendation, RateInsight, DispatchOptimizationHint } from './types'

// Workflow 1: After a ticket (load) is saved, link it to today's active dispatch for that driver
export async function linkTicketToDispatch(
  loadId: string,
  driverName: string,
  loadDate: string,
  supabase: SupabaseClient
): Promise<{ linked: boolean; dispatchId?: string }> {
  const { data: dispatch, error } = await supabase
    .from('dispatches')
    .select('id, loads_completed, first_ticket_at')
    .eq('driver_name', driverName)
    .eq('dispatch_date', loadDate)
    .not('status', 'in', '(completed)')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !dispatch) return { linked: false }

  // Set dispatch_id on load (column may not exist yet — fail silently)
  await supabase.from('loads').update({ dispatch_id: dispatch.id }).eq('id', loadId)

  const isFirstTicket = !dispatch.first_ticket_at && (dispatch.loads_completed ?? 0) === 0
  await supabase
    .from('dispatches')
    .update({
      status: 'working',
      loads_completed: (dispatch.loads_completed ?? 0) + 1,
      updated_at: new Date().toISOString(),
      ...(isFirstTicket ? { first_ticket_at: new Date().toISOString() } : {}),
    })
    .eq('id', dispatch.id)

  return { linked: true, dispatchId: dispatch.id }
}

// Shared: insert a row into activity_feed (silently skip if table doesn't exist)
export async function logActivity(
  companyId: string,
  type: string,
  message: string,
  relatedId: string | null,
  relatedType: string | null,
  supabase: SupabaseClient
): Promise<void> {
  await supabase.from('activity_feed').insert({
    company_id: companyId,
    type,
    message,
    related_id: relatedId,
    related_type: relatedType,
  })
  // Ignore error — table may not exist until user runs SQL migration
}

// Workflow 2: Approve a ticket and log the action.
// For driver-submitted tickets linked to a dispatch, increments loads_completed.
export async function approveTicket(
  load: { id: string; job_name: string; driver_name: string },
  companyId: string,
  supabase: SupabaseClient
): Promise<{ error: string | null }> {
  // Fetch dispatch linkage before updating
  const { data: fullLoad } = await supabase
    .from('loads')
    .select('dispatch_id, source')
    .eq('id', load.id)
    .maybeSingle()

  const { error } = await supabase
    .from('loads')
    .update({ status: 'approved' })
    .eq('id', load.id)

  if (error) return { error: error.message }

  // If this is a driver-submitted ticket linked to a dispatch, update the dispatch
  if (fullLoad?.source === 'driver' && fullLoad?.dispatch_id) {
    const { data: dispatch } = await supabase
      .from('dispatches')
      .select('loads_completed, status')
      .eq('id', fullLoad.dispatch_id)
      .maybeSingle()

    if (dispatch) {
      const updates: Record<string, unknown> = {
        loads_completed: (dispatch.loads_completed ?? 0) + 1,
        updated_at: new Date().toISOString(),
      }
      if (dispatch.status === 'accepted') {
        updates.status = 'working'
        updates.first_ticket_at = new Date().toISOString()
      }
      await supabase.from('dispatches').update(updates).eq('id', fullLoad.dispatch_id)
    }
  }

  await logActivity(
    companyId,
    'ticket_approved',
    `Approved: ${load.job_name} — ${load.driver_name}`,
    load.id,
    'load',
    supabase
  )

  return { error: null }
}

// ── Profit Intelligence ───────────────────────────────────────────────────────

function costOf(j: Record<string, unknown>): number {
  return (Number(j.driver_cost) || 0) + (Number(j.fuel_cost) || 0) + (Number(j.other_costs) || 0)
}

export async function getJobProfitMetrics(
  supabase: SupabaseClient,
  jobId: string,
  companyId: string,
): Promise<JobProfitMetrics> {
  const { data: job } = await supabase
    .from('jobs')
    .select('id, job_name, driver_cost, fuel_cost, other_costs')
    .eq('id', jobId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!job) {
    return { jobId, jobName: '', totalRevenue: 0, totalCosts: 0, profit: 0, profitMargin: 0, loadsCount: 0, profitPerLoad: 0 }
  }

  const { data: loads } = await supabase
    .from('loads')
    .select('rate')
    .eq('company_id', companyId)
    .eq('job_name', (job as Record<string, unknown>).job_name as string)
    .in('status', ['approved', 'invoiced', 'paid'])

  const totalRevenue = (loads ?? []).reduce((s, l) => s + (Number((l as Record<string, unknown>).rate) || 0), 0)
  const totalCosts   = costOf(job as Record<string, unknown>)
  const profit       = totalRevenue - totalCosts
  const loadsCount   = (loads ?? []).length

  return {
    jobId,
    jobName:      (job as Record<string, unknown>).job_name as string,
    totalRevenue,
    totalCosts,
    profit,
    profitMargin:  totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0,
    loadsCount,
    profitPerLoad: loadsCount > 0 ? profit / loadsCount : 0,
  }
}

export async function getDriverProfitability(
  supabase: SupabaseClient,
  companyId: string,
  dateRange?: { start: string; end: string },
): Promise<DriverProfitability[]> {
  const today = new Date().toISOString().split('T')[0]!
  const start = dateRange?.start ?? '2000-01-01'
  const end   = dateRange?.end   ?? today

  const [driversRes, loadsRes] = await Promise.all([
    supabase.from('drivers').select('id, name').eq('company_id', companyId).eq('status', 'active'),
    supabase.from('loads').select('driver_name, rate, total_pay')
      .eq('company_id', companyId)
      .gte('date', start).lte('date', end)
      .in('status', ['approved', 'invoiced', 'paid']),
  ])

  const drivers = driversRes.data ?? []
  const loads   = loadsRes.data   ?? []

  const statsMap = new Map<string, { revenue: number; loads: number }>()
  for (const l of loads) {
    const key = (l as Record<string, unknown>).driver_name as string | null
    if (!key) continue
    const entry = statsMap.get(key) ?? { revenue: 0, loads: 0 }
    entry.revenue += Number((l as Record<string, unknown>).total_pay ?? (l as Record<string, unknown>).rate) || 0
    entry.loads++
    statsMap.set(key, entry)
  }

  // Only include drivers with >= 3 loads
  const qualified: DriverProfitability[] = drivers
    .map(d => {
      const stats      = statsMap.get(d.name) ?? { revenue: 0, loads: 0 }
      const loadsCount = stats.loads
      const totalRevenue = stats.revenue
      return {
        driverId:      d.id,
        driverName:    d.name,
        totalRevenue,
        estimatedCost: 0,
        profit:        totalRevenue,
        profitMargin:  0,
        loadsCount,
        profitPerLoad: loadsCount > 0 ? totalRevenue / loadsCount : 0,
        isTopPerformer: false,
        isBelowAverage: false,
      }
    })
    .filter(d => d.loadsCount >= 3)
    .sort((a, b) => b.profit - a.profit)

  const totalRevAll  = qualified.reduce((s, d) => s + d.totalRevenue, 0)
  const totalLoadsAll = qualified.reduce((s, d) => s + d.loadsCount, 0)
  const companyAvg   = totalLoadsAll > 0 ? totalRevAll / totalLoadsAll : 0

  return qualified.map((d, i) => ({
    ...d,
    isTopPerformer: i < 3,
    isBelowAverage: companyAvg > 0 && d.profitPerLoad < companyAvg * 0.8 && d.loadsCount >= 5,
  }))
}

export async function getProfitAlerts(
  supabase: SupabaseClient,
  companyId: string,
): Promise<ProfitAlert[]> {
  const [jobsRes, loadsRes] = await Promise.all([
    supabase.from('jobs').select('id, job_name, driver_cost, fuel_cost, other_costs')
      .eq('company_id', companyId)
      .in('status', ['active', 'on_hold']),
    supabase.from('loads').select('job_name, driver_name, rate')
      .eq('company_id', companyId)
      .in('status', ['approved', 'invoiced', 'paid']),
  ])

  const jobs  = jobsRes.data  ?? []
  const loads = loadsRes.data ?? []

  // Revenue grouped by job_name
  const revByJob = new Map<string, number>()
  for (const l of loads) {
    const jn = (l as Record<string, unknown>).job_name as string | null
    if (!jn) continue
    revByJob.set(jn, (revByJob.get(jn) ?? 0) + (Number((l as Record<string, unknown>).rate) || 0))
  }

  const alerts: ProfitAlert[] = []

  for (const job of jobs) {
    const j            = job as Record<string, unknown>
    const totalCosts   = costOf(j)
    const totalRevenue = revByJob.get(job.job_name) ?? 0
    const profit       = totalRevenue - totalCosts
    const margin       = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0
    const fuelCost     = Number(j.fuel_cost)   || 0
    const otherCosts   = Number(j.other_costs) || 0

    if (totalCosts > 0 && profit < 0) {
      alerts.push({
        id: `losing-${job.id}`, type: 'losing_money', severity: 'critical',
        title: `Job '${job.job_name}' is losing money`,
        description: `Revenue: $${totalRevenue.toLocaleString()} · Costs: $${totalCosts.toLocaleString()}`,
        dollarImpact: Math.abs(profit), entityId: job.id, entityType: 'job',
      })
    } else if (totalCosts > 0 && margin < 10) {
      alerts.push({
        id: `margin-${job.id}`, type: 'low_margin', severity: 'warning',
        title: `Job '${job.job_name}' has only ${margin.toFixed(1)}% margin`,
        description: `Revenue: $${totalRevenue.toLocaleString()} · Costs: $${totalCosts.toLocaleString()}`,
        dollarImpact: totalCosts, entityId: job.id, entityType: 'job',
      })
    }

    if (fuelCost > 500 || otherCosts > 1000) {
      const parts: string[] = []
      if (fuelCost  > 500)  parts.push(`Fuel: $${fuelCost.toLocaleString()}`)
      if (otherCosts > 1000) parts.push(`Other: $${otherCosts.toLocaleString()}`)
      alerts.push({
        id: `cost-${job.id}`, type: 'cost_spike', severity: 'warning',
        title: `High costs on job '${job.job_name}'`,
        description: parts.join(' · '),
        dollarImpact: fuelCost + otherCosts, entityId: job.id, entityType: 'job',
      })
    }
  }

  // Driver underperforming alerts
  const driverStats = new Map<string, { revenue: number; loads: number }>()
  for (const l of loads) {
    const dn = (l as Record<string, unknown>).driver_name as string | null
    if (!dn) continue
    const entry = driverStats.get(dn) ?? { revenue: 0, loads: 0 }
    entry.revenue += Number((l as Record<string, unknown>).rate) || 0
    entry.loads++
    driverStats.set(dn, entry)
  }
  const qualified   = [...driverStats.entries()].filter(([, d]) => d.loads >= 5)
  const totalRevAll  = qualified.reduce((s, [, d]) => s + d.revenue, 0)
  const totalLoads   = qualified.reduce((s, [, d]) => s + d.loads, 0)
  const companyAvg   = totalLoads > 0 ? totalRevAll / totalLoads : 0

  if (companyAvg > 0) {
    for (const [driverName, stats] of qualified) {
      const ppl = stats.loads > 0 ? stats.revenue / stats.loads : 0
      if (ppl < companyAvg * 0.8) {
        const pctBelow = Math.round((1 - ppl / companyAvg) * 100)
        alerts.push({
          id: `driver-${driverName.toLowerCase().replace(/\W+/g, '-')}`,
          type: 'driver_underperforming', severity: 'warning',
          title: `Driver ${driverName} is below average`,
          description: `${pctBelow}% below average revenue per load`,
          dollarImpact: Math.round((companyAvg - ppl) * stats.loads),
          entityId: driverName, entityType: 'driver',
        })
      }
    }
  }

  return alerts
    .sort((a, b) => {
      if (a.severity === 'critical' && b.severity !== 'critical') return -1
      if (b.severity === 'critical' && a.severity !== 'critical') return 1
      return b.dollarImpact - a.dollarImpact
    })
    .slice(0, 10)
}

export async function getCompanyProfitSummary(
  supabase: SupabaseClient,
  companyId: string,
): Promise<CompanyProfitSummary> {
  const today      = new Date()
  const weekAgo    = new Date(today); weekAgo.setDate(today.getDate() - 7)
  const todayStr   = today.toISOString().split('T')[0]!
  const weekStart  = weekAgo.toISOString().split('T')[0]!

  const [allLoadsRes, weekLoadsRes, jobsRes] = await Promise.all([
    supabase.from('loads').select('rate, total_pay').eq('company_id', companyId).in('status', ['approved', 'invoiced', 'paid']),
    supabase.from('loads').select('rate, total_pay').eq('company_id', companyId).in('status', ['approved', 'invoiced', 'paid']).gte('date', weekStart).lte('date', todayStr),
    supabase.from('jobs').select('driver_cost, fuel_cost, other_costs').eq('company_id', companyId),
  ])

  const sumRev = (rows: Record<string, unknown>[] | null) =>
    (rows ?? []).reduce((s, l) => s + (Number(l.total_pay ?? l.rate) || 0), 0)

  const totalRevenue = sumRev(allLoadsRes.data  as Record<string, unknown>[] | null)
  const weekRevenue  = sumRev(weekLoadsRes.data as Record<string, unknown>[] | null)
  const totalCosts   = (jobsRes.data ?? []).reduce((s, j) => s + costOf(j as Record<string, unknown>), 0)
  const netProfit    = totalRevenue - totalCosts

  return {
    totalRevenue, totalCosts, netProfit,
    profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
    weekRevenue, weekCosts: 0, weekProfit: weekRevenue,
  }
}

// Workflow 5: Log a dispatch event (called from dispatch page)
export async function logDispatchActivity(
  companyId: string,
  driverName: string,
  jobName: string,
  dispatchId: string,
  supabase: SupabaseClient
): Promise<void> {
  await logActivity(
    companyId,
    'dispatch_created',
    `Dispatched ${driverName} to ${jobName}`,
    dispatchId,
    'dispatch',
    supabase
  )
}

// Workflow 6: Score and rank drivers for a dispatch (AI Dispatch Brain)
export async function getRecommendedDriver(
  supabase: SupabaseClient,
  { companyId, jobId }: { companyId: string; jobId?: string }
): Promise<DriverRecommendation> {
  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [driversRes, todayDispatchesRes, recentLoadsRes] = await Promise.all([
    supabase
      .from('drivers')
      .select('id, name, is_active, status')
      .eq('company_id', companyId)
      .eq('is_active', true),
    supabase
      .from('dispatches')
      .select('driver_name, status, loads_completed')
      .eq('company_id', companyId)
      .eq('dispatch_date', today),
    supabase
      .from('loads')
      .select('driver_name, rate, date')
      .eq('company_id', companyId)
      .gte('date', thirtyDaysAgo),
  ])

  const drivers = driversRes.data ?? []
  const todayDispatches = todayDispatchesRes.data ?? []
  const recentLoads = recentLoadsRes.data ?? []

  if (drivers.length === 0) {
    return { bestDriver: null, rankedDrivers: [], noDriversAvailable: true, fallbackReason: 'No active drivers found' }
  }

  // Build per-driver maps
  const dispatchMap = new Map<string, { loadsToday: number; isWorking: boolean }>()
  for (const d of todayDispatches) {
    const name = d.driver_name as string
    const existing = dispatchMap.get(name)
    const loadsCompleted = (d.loads_completed as number) ?? 0
    const isWorking = (d.status as string) === 'working'
    if (!existing) {
      dispatchMap.set(name, { loadsToday: loadsCompleted, isWorking })
    } else {
      dispatchMap.set(name, {
        loadsToday: existing.loadsToday + loadsCompleted,
        isWorking: existing.isWorking || isWorking,
      })
    }
  }

  const revenueByDriver = new Map<string, number>()
  const loadCountByDriver = new Map<string, number>()
  for (const l of recentLoads) {
    const name = l.driver_name as string
    revenueByDriver.set(name, (revenueByDriver.get(name) ?? 0) + (Number(l.rate) || 0))
    loadCountByDriver.set(name, (loadCountByDriver.get(name) ?? 0) + 1)
  }

  const scored: DriverScore[] = drivers.map(driver => {
    const name = driver.name as string
    const dispatched = dispatchMap.get(name)
    const loadsToday = dispatched?.loadsToday ?? 0
    const isWorking = dispatched?.isWorking ?? false
    const isAvailable = (driver.status as string) === 'available' || !dispatched
    const loadCount30 = loadCountByDriver.get(name) ?? 0
    const revenue30 = revenueByDriver.get(name) ?? 0
    const profitPerLoad = loadCount30 > 0 ? revenue30 / loadCount30 : 0

    const explanations: string[] = []
    let score = 0

    // Profit weight (40 pts)
    const allProfitPerLoad = drivers.map(d => {
      const lc = loadCountByDriver.get(d.name as string) ?? 0
      const rev = revenueByDriver.get(d.name as string) ?? 0
      return lc > 0 ? rev / lc : 0
    })
    const maxProfitPerLoad = Math.max(...allProfitPerLoad, 1)
    const profitScore = (profitPerLoad / maxProfitPerLoad) * 40
    score += profitScore
    if (profitPerLoad > 0) explanations.push(`Avg $${profitPerLoad.toFixed(0)}/load (30d)`)

    // Availability weight (35 pts) — fewer loads today = higher score
    const maxLoadsToday = Math.max(...Array.from(dispatchMap.values()).map(v => v.loadsToday), 1)
    const availScore = ((maxLoadsToday - loadsToday) / maxLoadsToday) * 35
    score += availScore
    if (loadsToday > 0) explanations.push(`${loadsToday} load${loadsToday !== 1 ? 's' : ''} today`)

    // Idle bonus (15 pts) — not currently working
    if (!isWorking) {
      score += 15
      explanations.push('Not currently on a job')
    }

    // Available status bonus (10 pts)
    if (isAvailable) {
      score += 10
    }

    return { driverId: driver.id as string, driverName: name, score, loadsToday, profitPerLoad, isWorking, isAvailable, explanations }
  })

  scored.sort((a, b) => b.score - a.score)

  const available = scored.filter(d => !d.isWorking)
  const bestDriver: DriverScore | null = available.length > 0 ? (available[0] ?? null) : (scored[0] ?? null)

  return {
    bestDriver,
    rankedDrivers: scored,
    noDriversAvailable: scored.length === 0,
    fallbackReason: available.length === 0 ? 'All drivers are currently working' : undefined,
  }
}

// Workflow 7: Rate insights for a material type (AI Dispatch Brain)
export async function getRateInsights(
  supabase: SupabaseClient,
  { companyId, material, rate }: { companyId: string; material: string; rate: number }
): Promise<RateInsight | null> {
  if (!material || rate <= 0) return null

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data } = await supabase
    .from('jobs')
    .select('rate')
    .eq('company_id', companyId)
    .ilike('material', `%${material}%`)
    .gte('created_at', ninetyDaysAgo)
    .not('rate', 'is', null)

  const rates = (data ?? []).map(j => Number(j.rate)).filter(r => r > 0)
  if (rates.length < 3) return null

  const avgRate = rates.reduce((s, r) => s + r, 0) / rates.length
  const percentDiff = ((rate - avgRate) / avgRate) * 100
  const isBelowAverage = percentDiff < -10

  let recommendation: string
  if (isBelowAverage) {
    recommendation = `This rate is ${Math.abs(percentDiff).toFixed(0)}% below the ${rates.length}-job average of $${avgRate.toFixed(0)} for ${material}`
  } else if (percentDiff > 10) {
    recommendation = `This rate is ${percentDiff.toFixed(0)}% above the average — great margin`
  } else {
    recommendation = `Rate is in line with historical average of $${avgRate.toFixed(0)} for ${material}`
  }

  return { avgRate, percentDiff, recommendation, isBelowAverage, sampleSize: rates.length }
}

// Workflow 8: Dispatch optimization hints (AI Dispatch Brain)
export async function getDispatchOptimizationHints(
  supabase: SupabaseClient,
  companyId: string
): Promise<DispatchOptimizationHint[]> {
  const today = new Date().toISOString().split('T')[0]

  const [dispatchesRes, driversRes] = await Promise.all([
    supabase
      .from('dispatches')
      .select('driver_name, status, loads_completed')
      .eq('company_id', companyId)
      .eq('dispatch_date', today),
    supabase
      .from('drivers')
      .select('name')
      .eq('company_id', companyId)
      .eq('is_active', true),
  ])

  const dispatches = dispatchesRes.data ?? []
  const allDrivers = (driversRes.data ?? []).map(d => d.name as string)

  const loadsByDriver = new Map<string, number>()
  const workingDrivers = new Set<string>()
  for (const d of dispatches) {
    const name = d.driver_name as string
    const loads = (d.loads_completed as number) ?? 0
    loadsByDriver.set(name, (loadsByDriver.get(name) ?? 0) + loads)
    if ((d.status as string) === 'working') workingDrivers.add(name)
  }

  const hints: DispatchOptimizationHint[] = []

  // Idle driver hint
  const idleDrivers = allDrivers.filter(name => !workingDrivers.has(name) && (loadsByDriver.get(name) ?? 0) === 0)
  if (idleDrivers.length > 0 && workingDrivers.size > 0) {
    hints.push({
      type: 'idle_driver',
      message: `${idleDrivers.length} driver${idleDrivers.length !== 1 ? 's' : ''} ${idleDrivers.length !== 1 ? 'have' : 'has'} no loads today`,
      affectedDrivers: idleDrivers,
      suggestion: `Consider assigning ${idleDrivers[0]} to a job to balance workload`,
    })
  }

  // Uneven load distribution hint
  if (loadsByDriver.size >= 2) {
    const loadCounts = Array.from(loadsByDriver.values())
    const max = Math.max(...loadCounts)
    const min = Math.min(...loadCounts)
    if (max - min >= 3) {
      const overloaded = Array.from(loadsByDriver.entries())
        .filter(([, v]) => v === max)
        .map(([k]) => k)
      const underloaded = Array.from(loadsByDriver.entries())
        .filter(([, v]) => v === min)
        .map(([k]) => k)
      hints.push({
        type: 'uneven_load_distribution',
        message: `Load distribution is uneven — ${overloaded[0]} has ${max} loads, ${underloaded[0]} has ${min}`,
        affectedDrivers: [...overloaded, ...underloaded],
        suggestion: `Shift next dispatches to ${underloaded[0]} to balance the team`,
      })
    }
  }

  return hints.slice(0, 2)
}
