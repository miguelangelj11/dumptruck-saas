'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCompanyId } from '@/lib/get-company-id'
import { Loader2, DollarSign, TrendingUp, TrendingDown, AlertCircle, CreditCard, Download, Percent } from 'lucide-react'
import LockedFeature from '@/components/dashboard/locked-feature'
import {
  RevenueByDriverChart,
  RevenueByMonthChart,
  LoadsPerDayChart,
  RevenueByJobChart,
} from '@/components/dashboard/revenue-charts'
import type { Load, Expense, ContractorTicket, Invoice, Payment, Driver } from '@/lib/types'
import { calculateDriverOwed } from '@/lib/drivers/calculate-owed'
import { getCategoryConfig } from '@/lib/expenses/categories'
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const BILLABLE_STATUSES = ['approved', 'invoiced', 'paid'] as const

type DateRange = 'week' | 'month' | 'quarter' | 'year'

function getRangeBounds(range: DateRange): { start: string; end: string } {
  const now = new Date()
  const today = now.toISOString().split('T')[0]!
  if (range === 'week') {
    const day = now.getDay()
    const daysToMon = day === 0 ? 6 : day - 1
    const mon = new Date(now)
    mon.setDate(now.getDate() - daysToMon)
    return { start: mon.toISOString().split('T')[0]!, end: today }
  }
  if (range === 'month') {
    return { start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, end: today }
  }
  if (range === 'quarter') {
    const q = Math.floor(now.getMonth() / 3)
    const mon = new Date(now.getFullYear(), q * 3, 1)
    return { start: mon.toISOString().split('T')[0]!, end: today }
  }
  return { start: `${now.getFullYear()}-01-01`, end: today }
}

function getLastPeriodBounds(bounds: { start: string; end: string }): { start: string; end: string } {
  const start = new Date(bounds.start + 'T00:00:00')
  const end = new Date(bounds.end + 'T00:00:00')
  const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
  const lastEnd = new Date(start.getTime() - 86400000)
  const lastStart = new Date(lastEnd.getTime() - (diffDays - 1) * 86400000)
  return {
    start: lastStart.toISOString().split('T')[0]!,
    end: lastEnd.toISOString().split('T')[0]!,
  }
}

function trendPct(current: number, last: number): number | null {
  if (last <= 0) return null
  return ((current - last) / last) * 100
}

function invDate(inv: Invoice): string {
  return inv.date_paid ?? inv.date_from ?? inv.created_at.split('T')[0]!
}

function buildRevExpChartData(
  range: DateRange,
  bounds: { start: string; end: string },
  invoices: Invoice[],
  expenses: Expense[],
): { label: string; revenue: number; expenses: number }[] {
  const start = new Date(bounds.start + 'T00:00:00')
  const end = new Date(bounds.end + 'T00:00:00')
  const paidInvoices = invoices.filter(i => i.status === 'paid')

  if (range === 'week') {
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const key = d.toISOString().split('T')[0]!
      const rev = paidInvoices.filter(inv => invDate(inv) === key).reduce((s, inv) => s + inv.total, 0)
      const exp = expenses.filter(e => e.date === key).reduce((s, e) => s + e.amount, 0)
      return { label: DAY_NAMES[d.getDay()]!, revenue: rev, expenses: exp }
    })
  }

  if (range === 'month') {
    const result: { label: string; revenue: number; expenses: number }[] = []
    let cur = new Date(start)
    let w = 1
    while (cur <= end) {
      const wEnd = new Date(cur)
      wEnd.setDate(cur.getDate() + 6)
      if (wEnd > end) wEnd.setTime(end.getTime())
      const s = cur.toISOString().split('T')[0]!
      const e2 = wEnd.toISOString().split('T')[0]!
      const rev = paidInvoices.filter(inv => { const d = invDate(inv); return d >= s && d <= e2 }).reduce((s2, inv) => s2 + inv.total, 0)
      const exp = expenses.filter(e => e.date >= s && e.date <= e2).reduce((s2, e) => s2 + e.amount, 0)
      result.push({ label: `W${w++}`, revenue: rev, expenses: exp })
      cur = new Date(cur)
      cur.setDate(cur.getDate() + 7)
    }
    return result
  }

  if (range === 'quarter') {
    const startMonth = start.getMonth()
    return Array.from({ length: 3 }, (_, i) => {
      const mo = startMonth + i
      const key = `${start.getFullYear()}-${String(mo + 1).padStart(2, '0')}`
      const rev = paidInvoices.filter(inv => invDate(inv).startsWith(key)).reduce((s, inv) => s + inv.total, 0)
      const exp = expenses.filter(e => (e.date ?? '').startsWith(key)).reduce((s, e) => s + e.amount, 0)
      return { label: MONTH_NAMES[mo % 12]!, revenue: rev, expenses: exp }
    })
  }

  return Array.from({ length: 12 }, (_, i) => {
    const key = `${start.getFullYear()}-${String(i + 1).padStart(2, '0')}`
    const rev = paidInvoices.filter(inv => invDate(inv).startsWith(key)).reduce((s, inv) => s + inv.total, 0)
    const exp = expenses.filter(e => (e.date ?? '').startsWith(key)).reduce((s, e) => s + e.amount, 0)
    return { label: MONTH_NAMES[i]!, revenue: rev, expenses: exp }
  })
}

function buildLoadsChartData(
  range: DateRange,
  bounds: { start: string; end: string },
  loads: Load[],
): { label: string; loads: number }[] {
  const start = new Date(bounds.start + 'T00:00:00')
  const end = new Date(bounds.end + 'T00:00:00')

  if (range === 'week') {
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const key = d.toISOString().split('T')[0]!
      return { label: DAY_NAMES[d.getDay()]!, loads: loads.filter(l => l.date === key).length }
    })
  }

  if (range === 'month') {
    const result: { label: string; loads: number }[] = []
    const cur = new Date(start)
    while (cur <= end) {
      const key = cur.toISOString().split('T')[0]!
      result.push({ label: String(cur.getDate()), loads: loads.filter(l => l.date === key).length })
      cur.setDate(cur.getDate() + 1)
    }
    return result
  }

  if (range === 'quarter') {
    const result: { label: string; loads: number }[] = []
    const cur = new Date(start)
    let w = 1
    while (cur <= end) {
      const wEnd = new Date(cur)
      wEnd.setDate(cur.getDate() + 6)
      if (wEnd > end) wEnd.setTime(end.getTime())
      const s = cur.toISOString().split('T')[0]!
      const e2 = wEnd.toISOString().split('T')[0]!
      result.push({ label: `W${w++}`, loads: loads.filter(l => l.date >= s && l.date <= e2).length })
      cur.setDate(cur.getDate() + 7)
    }
    return result
  }

  return Array.from({ length: 12 }, (_, i) => {
    const key = `${start.getFullYear()}-${String(i + 1).padStart(2, '0')}`
    return { label: MONTH_NAMES[i]!, loads: loads.filter(l => (l.date ?? '').startsWith(key)).length }
  })
}

function getWeekBounds(offset: 0 | -1) {
  const now = new Date()
  const day = now.getDay()
  const daysToMon = day === 0 ? 6 : day - 1
  const thisMon = new Date(now); thisMon.setDate(now.getDate() - daysToMon)
  if (offset === 0) {
    return { start: thisMon.toISOString().split('T')[0]!, end: now.toISOString().split('T')[0]! }
  }
  const lastMon = new Date(thisMon); lastMon.setDate(thisMon.getDate() - 7)
  const lastSun = new Date(thisMon); lastSun.setDate(thisMon.getDate() - 1)
  return { start: lastMon.toISOString().split('T')[0]!, end: lastSun.toISOString().split('T')[0]! }
}

export default function RevenuePage() {
  const t = useTranslations('revenue')
  const [planLocked, setPlanLocked] = useState<null | { plan: string; price: number }>(null)
  const [loads, setLoads] = useState<Load[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [contractorTickets, setContractorTickets] = useState<ContractorTicket[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [contractorNames, setContractorNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'driverpay'>('overview')
  const [payWeek, setPayWeek] = useState<0 | -1>(0)
  const [dateRange, setDateRange] = useState<DateRange>('month')
  const supabase = createClient()

  // Plan gate: Revenue/profit tracking requires Fleet+
  useEffect(() => {
    getCompanyId().then(async id => {
      if (!id) return
      const supaClient = createClient()
      const { data } = await supaClient.from('companies').select('plan, is_super_admin, subscription_override').eq('id', id).maybeSingle()
      if (data?.is_super_admin || data?.subscription_override) return
      const p = (data?.plan as string | null) ?? 'owner_operator'
      if (p === 'solo' || p === 'owner_operator') {
        setPlanLocked({ plan: 'Fleet', price: 125 })
      }
    })
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('new-expense') === '1') {
      window.location.replace('/dashboard/expenses')
    }
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const orgId = await getCompanyId()
      if (!orgId) return

      const cutoff = new Date()
      cutoff.setFullYear(cutoff.getFullYear() - 1)
      const fetchCutoff = cutoff.toISOString().split('T')[0]!

      const [lRes, eRes, ctRes, invRes, payRes, contractorsRes, driversRes] = await Promise.all([
        supabase.from('loads').select('*').eq('company_id', orgId).gte('date', fetchCutoff),
        supabase.from('expenses').select('*').eq('company_id', orgId).order('date', { ascending: false }),
        supabase.from('contractor_tickets').select('*').eq('company_id', orgId).gte('date', fetchCutoff),
        supabase.from('invoices').select('*').eq('company_id', orgId),
        supabase.from('payments').select('*').eq('company_id', orgId),
        supabase.from('contractors').select('id, name').eq('company_id', orgId),
        supabase.from('drivers').select('id, name, pay_type, pay_rate_value, pay_percent, ytd_paid').eq('company_id', orgId).eq('status', 'active'),
      ])

      if (lRes.error) console.error('[revenue] loads:', lRes.error.message)
      if (invRes.error) console.error('[revenue] invoices:', invRes.error.message)

      const cMap = new Map<string, string>()
      for (const c of (contractorsRes.data ?? [])) cMap.set(c.id, c.name)
      setContractorNames(cMap)

      setLoads((lRes.data ?? []) as Load[])
      setExpenses(eRes.data ?? [])
      setContractorTickets(ctRes.data ?? [])
      setInvoices(invRes.data ?? [])
      setPayments(payRes.data ?? [])
      setDrivers((driversRes.data ?? []) as Driver[])
    } catch (err) {
      console.error('[revenue] fetchData error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  // ── Date range filtering ──────────────────────────────────────────────────
  const bounds = getRangeBounds(dateRange)
  const lastBounds = getLastPeriodBounds(bounds)

  const filteredLoads = loads.filter(l => l.date >= bounds.start && l.date <= bounds.end)
  const filteredInvoices = invoices.filter(i => {
    const d = invDate(i)
    return d >= bounds.start && d <= bounds.end
  })
  const filteredExpenses = expenses.filter(e => (e.date ?? '') >= bounds.start && (e.date ?? '') <= bounds.end)

  // Last period filtered data
  const lastInvoices = invoices.filter(i => {
    const d = invDate(i)
    return d >= lastBounds.start && d <= lastBounds.end
  })
  const lastExpenses = expenses.filter(e => (e.date ?? '') >= lastBounds.start && (e.date ?? '') <= lastBounds.end)

  // ── Derived stats (all scoped to selected date range) ─────────────────────

  // Payments map: invoice_id → total paid
  const paymentsByInvoiceId = payments.reduce<Record<string, number>>((acc, p) => {
    acc[p.invoice_id] = (acc[p.invoice_id] ?? 0) + p.amount
    return acc
  }, {})

  // Cash Collected: for paid invoices in range
  const paidInvoices = filteredInvoices.filter(i => i.status === 'paid' && i.invoice_type === 'client')
  const cashCollected = paidInvoices.reduce((s, i) => {
    const pmtSum = paymentsByInvoiceId[i.id]
    return s + (pmtSum !== undefined ? pmtSum : i.total)
  }, 0)

  // Last period cash collected
  const lastPaidInvoices = lastInvoices.filter(i => i.status === 'paid' && i.invoice_type === 'client')
  const lastCashCollected = lastPaidInvoices.reduce((s, i) => {
    const pmtSum = paymentsByInvoiceId[i.id]
    return s + (pmtSum !== undefined ? pmtSum : i.total)
  }, 0)

  // Outstanding: draft + sent invoices in range
  const outstandingInvoices = filteredInvoices.filter(i => ['draft', 'sent'].includes(i.status))
  const outstandingTotal = outstandingInvoices.reduce((s, i) => s + (i.total ?? 0), 0)

  const lastOutstandingTotal = lastInvoices
    .filter(i => ['draft', 'sent'].includes(i.status))
    .reduce((s, i) => s + (i.total ?? 0), 0)

  // Lost / at-risk revenue
  const partialInvoices = invoices.filter(i => i.status === 'partially_paid' && (i.amount_remaining ?? 0) > 0)
  const overdueWithBalance = invoices.filter(i => i.status === 'overdue')
  const lostRevenueItems = [
    ...partialInvoices,
    ...overdueWithBalance.filter(i => !partialInvoices.some(p => p.id === i.id)),
  ].sort((a, b) => (b.amount_remaining ?? b.total) - (a.amount_remaining ?? a.total))
  const partiallyPaidRemaining = partialInvoices.reduce((s, i) => s + (i.amount_remaining ?? 0), 0)
  const overdueTotal = overdueWithBalance.reduce((s, i) => s + ((i.amount_remaining ?? i.total) ?? 0), 0)
  const totalLostRevenue = partiallyPaidRemaining + overdueWithBalance.reduce((s, i) => s + (i.amount_remaining ?? i.total ?? 0), 0)

  // Overpayments
  const overpaidInvoices = invoices.filter(i => i.status === 'overpaid' && (i.overpaid_amount ?? 0) > 0)
  const totalOverpaid = overpaidInvoices.reduce((s, i) => s + (i.overpaid_amount ?? 0), 0)

  const totalExpenses = filteredExpenses.reduce((s, e) => s + (e.amount ?? 0), 0)
  const lastExpensesTotal = lastExpenses.reduce((s, e) => s + (e.amount ?? 0), 0)

  // Driver costs (money OUT) = paystub invoices
  const driverCostInvoices = filteredInvoices.filter(i => i.invoice_type === 'paystub')
  const driverCosts = driverCostInvoices.reduce((s, i) => s + (i.total ?? 0), 0)
  const lastDriverCosts = lastInvoices.filter(i => i.invoice_type === 'paystub').reduce((s, i) => s + (i.total ?? 0), 0)

  // Subcontractor costs (money OUT) = contractor invoices received
  const contractorCostInvoices = filteredInvoices.filter(i => i.invoice_type === 'contractor')
  const contractorCosts = contractorCostInvoices.reduce((s, i) => s + (i.total ?? 0), 0)
  const lastContractorCosts = lastInvoices.filter(i => i.invoice_type === 'contractor').reduce((s, i) => s + (i.total ?? 0), 0)

  // Total money out = operating expenses + driver pay + subcontractor pay
  const totalMoneyOut = totalExpenses + driverCosts + contractorCosts
  const lastTotalMoneyOut = lastExpensesTotal + lastDriverCosts + lastContractorCosts

  // Net profit = money in minus all money out
  const profit = cashCollected - totalMoneyOut
  const lastProfit = lastCashCollected - lastTotalMoneyOut

  // Profit margin: null when no costs tracked (avoids misleading 100%)
  const profitMargin = totalMoneyOut > 0 && cashCollected > 0
    ? (profit / cashCollected) * 100
    : null

  // Trend percentages vs last period
  const trendCash          = trendPct(cashCollected, lastCashCollected)
  const trendExpenses      = trendPct(totalExpenses, lastExpensesTotal)
  const trendProfit        = trendPct(profit, lastProfit)
  const trendDriverCosts   = trendPct(driverCosts, lastDriverCosts)
  const trendOutstanding   = trendPct(outstandingTotal, lastOutstandingTotal)

  // Cost per load / revenue per load metrics
  const totalLoads      = filteredLoads.length
  const revenuePerLoad  = totalLoads > 0 && cashCollected > 0 ? cashCollected / totalLoads : null
  const costPerLoad     = totalLoads > 0 && totalMoneyOut > 0 ? totalMoneyOut / totalLoads : null

  // Revenue by driver — use total_pay (actual billing amount) not rate
  const billableLoads = filteredLoads.filter(l => (BILLABLE_STATUSES as readonly string[]).includes(l.status))
  const driverData = Object.entries(
    billableLoads.reduce<Record<string, number>>((acc, l) => {
      const key = l.driver_name || 'Unknown'
      acc[key] = (acc[key] ?? 0) + (l.total_pay ?? l.rate ?? 0)
      return acc
    }, {})
  ).map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6)

  // Revenue by job — use total_pay
  const jobData = Object.entries(
    billableLoads.reduce<Record<string, number>>((acc, l) => {
      const name = l.job_name ?? 'No Job'
      acc[name] = (acc[name] ?? 0) + (l.total_pay ?? l.rate ?? 0)
      return acc
    }, {})
  ).map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6)

  // Top contractors — group by contractor name (via contractorNames map), not job_name
  const filteredCTs = contractorTickets.filter(t => (t.date ?? '') >= bounds.start && (t.date ?? '') <= bounds.end)
  const contractorData = Object.entries(
    filteredCTs.reduce<Record<string, number>>((acc, t) => {
      const name = contractorNames.get(t.contractor_id) || t.job_name || 'Unknown'
      acc[name] = (acc[name] ?? 0) + (t.rate ?? 0)
      return acc
    }, {})
  ).map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  // Fixed costs for break-even (Insurance + Other from expense categories)
  const fixedCosts = filteredExpenses
    .filter(e => ['Insurance', 'Other'].includes(e.category))
    .reduce((s, e) => s + e.amount, 0)

  // Chart data
  const chartData = buildRevExpChartData(dateRange, bounds, filteredInvoices, filteredExpenses)
  const loadsChartData = buildLoadsChartData(dateRange, bounds, filteredLoads)

  // Export CSV
  function handleExportCSV() {
    const headers = ['Date', 'Driver', 'Job', 'Truck #', 'Material', 'Rate', 'Rate Type', 'Status']
    const rows = filteredLoads.map(l => [
      l.date, l.driver_name, l.job_name ?? '', l.truck_number ?? '', l.material ?? '', l.rate, l.rate_type ?? 'load', l.status,
    ])
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `revenue-${bounds.start}-to-${bounds.end}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-40">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--brand-primary)]" />
      </div>
    )
  }

  // ── Driver Pay Summary ─────────────────────────────────────────────────────
  const weekBounds = getWeekBounds(payWeek)
  const weekLoads  = loads.filter(l => l.date >= weekBounds.start && l.date <= weekBounds.end && (BILLABLE_STATUSES as readonly string[]).includes(l.status))

  // Enhanced driver pay: use calculateDriverOwed for each driver
  const driverPayData = drivers.map(driver => {
    const driverLoads = weekLoads.filter(l => l.driver_name === driver.name)
    const owed = calculateDriverOwed(driverLoads, driver)
    const revenue = driverLoads.reduce((s, l) => s + (l.total_pay ?? l.rate ?? 0), 0)
    return {
      name: driver.name,
      revenue,
      owed,
      ticketCount: driverLoads.length,
      payType: driver.pay_type,
      payRate: driver.pay_rate_value,
    }
  }).filter(d => d.ticketCount > 0)

  // Fallback: loads grouped by contractor/driver for drivers not in our driver list
  type DriverRow = { name: string; loads: number; total: number }
  type ContractorBlock = { contractor: string; drivers: DriverRow[]; total: number }

  const contractorBlocks: ContractorBlock[] = (() => {
    const map: Record<string, Record<string, DriverRow>> = {}
    for (const l of weekLoads) {
      const c = l.client_company || 'No Contractor'
      const d = l.driver_name   || 'Unknown'
      if (!map[c]) map[c] = {}
      if (!map[c]![d]) map[c]![d] = { name: d, loads: 0, total: 0 }
      map[c]![d]!.loads++
      map[c]![d]!.total += l.total_pay ?? l.rate ?? 0
    }
    return Object.entries(map).map(([contractor, drivers]) => ({
      contractor,
      drivers: Object.values(drivers).sort((a, b) => b.total - a.total),
      total: Object.values(drivers).reduce((s, dr) => s + dr.total, 0),
    })).sort((a, b) => b.total - a.total)
  })()

  const grandTotalOwed = contractorBlocks.reduce((s, b) => s + b.total, 0)

  const rangeLabels: Record<DateRange, string> = {
    week: 'This Week', month: 'This Month', quarter: 'This Quarter', year: 'This Year',
  }

  // Top expense categories for summary band
  const topExpenseCategories = Object.entries(
    filteredExpenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 4)

  if (planLocked) {
    return <LockedFeature title="Revenue & Profit Tracking" description="Get a full picture of your revenue, profit, and expenses. See what each driver and job is making you." plan={planLocked.plan} price={planLocked.price} />
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{t('subtitle')}</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['overview', 'driverpay'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {tab === 'overview' ? t('tabs.overview') : t('tabs.driverPay')}
            </button>
          ))}
        </div>
      </div>

      {/* ── Driver Pay Tab ─────────────────────────────────────────────── */}
      {activeTab === 'driverpay' && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
              {([0, -1] as const).map(w => (
                <button key={w} onClick={() => setPayWeek(w)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${payWeek === w ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {w === 0 ? t('thisWeek') : t('lastWeek')}
                </button>
              ))}
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">{new Date(weekBounds.start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(weekBounds.end + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">${grandTotalOwed.toLocaleString()} {t('totalDriverPay')}</p>
            </div>
          </div>

          {/* Per-driver owed view */}
          {driverPayData.length > 0 && (
            <div className="space-y-3 mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Driver Pay Breakdown</h3>
              {driverPayData.map(driver => (
                <div key={driver.name} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl">
                  <div>
                    <p className="font-semibold text-gray-900">{driver.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {driver.ticketCount} ticket{driver.ticketCount !== 1 ? 's' : ''} ·{' '}
                      {driver.payRate
                        ? ` $${driver.payRate}/${(driver.payType ?? '').replace('_', ' ')}`
                        : ' No rate set'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">${driver.revenue.toLocaleString()} revenue</p>
                    {driver.owed > 0 ? (
                      <p className="text-sm font-black text-red-600">${driver.owed.toFixed(2)} owed</p>
                    ) : (
                      <p className="text-xs text-green-600 font-medium">✅ Paid up</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {contractorBlocks.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
              <p className="text-sm text-gray-400">{t('noLoadsThisWeek')}</p>
              <a href="/dashboard/tickets" className="text-xs text-[var(--brand-primary)] underline mt-1 block">Add tickets →</a>
            </div>
          ) : (
            <div className="space-y-4">
              {contractorBlocks.map(block => (
                <div key={block.contractor} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <h3 className="font-semibold text-sm text-gray-900">{block.contractor}</h3>
                    <span className="text-sm font-bold text-[var(--brand-primary)]">${block.total.toLocaleString()}</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left">
                        {[t('driver'), t('loads'), t('totalPay')].map(h => (
                          <th key={h} className="px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {block.drivers.map(dr => (
                        <tr key={dr.name} className="hover:bg-gray-50/50">
                          <td className="px-5 py-3 font-medium text-gray-900">{dr.name}</td>
                          <td className="px-5 py-3 text-gray-500">{dr.loads} load{dr.loads !== 1 ? 's' : ''}</td>
                          <td className="px-5 py-3 font-semibold text-gray-900">${dr.total.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-100 bg-gray-50/50">
                        <td className="px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase" colSpan={2}>{t('subtotalRow', { contractor: block.contractor })}</td>
                        <td className="px-5 py-2.5 font-bold text-[var(--brand-primary)]">${block.total.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ))}
              <div className="bg-[var(--brand-dark)] rounded-xl px-5 py-4 flex items-center justify-between">
                <span className="text-white font-semibold">{t('grandTotal')}</span>
                <span className="text-2xl font-extrabold text-[#4ade80]">${grandTotalOwed.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Overview Tab ───────────────────────────────────────────────── */}
      {activeTab === 'overview' && (<>

      {/* Date range filter + Export */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
          {(['week', 'month', 'quarter', 'year'] as DateRange[]).map(r => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${dateRange === r ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {rangeLabels[r]}
            </button>
          ))}
        </div>
        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      </div>

      {/* Data quality banner — only when no costs tracked but revenue exists */}
      {totalMoneyOut === 0 && cashCollected > 0 && (
        <div className="mb-5 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <span className="text-amber-500 text-xl flex-shrink-0 mt-0.5">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800">Profit numbers may be incomplete</p>
            <p className="text-xs text-amber-700 mt-0.5">
              No expenses tracked this period. Add fuel, driver pay, and maintenance costs to see real profit margins.
            </p>
          </div>
          <a
            href="/dashboard/expenses"
            className="flex-shrink-0 text-xs font-bold text-amber-700 hover:text-amber-900 underline whitespace-nowrap"
          >
            Add Expenses →
          </a>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="inline-flex rounded-lg p-2 mb-3 text-[var(--brand-primary)] bg-[var(--brand-primary)]/10">
            <CreditCard className="h-4 w-4" />
          </div>
          <p className="text-xl font-bold text-gray-900">${cashCollected.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t('cashCollected')}</p>
          <p className="text-xs text-gray-300 mt-0.5">{t('invoiceCount', { count: paidInvoices.length })}</p>
          {trendCash !== null && (
            <span className={`text-xs font-bold mt-1 block ${trendCash >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {trendCash >= 0 ? '↑' : '↓'} {Math.abs(trendCash).toFixed(0)}%
              <span className="text-gray-400 font-normal ml-1">vs last period</span>
            </span>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="inline-flex rounded-lg p-2 mb-3 text-red-500 bg-red-50">
            <TrendingDown className="h-4 w-4" />
          </div>
          <p className="text-xl font-bold text-gray-900">${totalExpenses.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t('expenses')}</p>
          <p className="text-xs text-gray-300 mt-0.5">{t('expenseCount', { count: filteredExpenses.length })}</p>
          {trendExpenses !== null && (
            <span className={`text-xs font-bold mt-1 block ${trendExpenses <= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {trendExpenses >= 0 ? '↑' : '↓'} {Math.abs(trendExpenses).toFixed(0)}%
              <span className="text-gray-400 font-normal ml-1">vs last period</span>
            </span>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className={`inline-flex rounded-lg p-2 mb-3 ${profit >= 0 ? 'text-[var(--brand-primary)] bg-[var(--brand-primary)]/10' : 'text-red-500 bg-red-50'}`}>
            <TrendingUp className="h-4 w-4" />
          </div>
          <p className={`text-xl font-bold ${profit >= 0 ? 'text-gray-900' : 'text-red-600'}`}>${profit.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t('netProfit')}</p>
          <p className="text-xs text-gray-300 mt-0.5">{t('revenueMinusExpenses')}</p>
          {trendProfit !== null && (
            <span className={`text-xs font-bold mt-1 block ${trendProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {trendProfit >= 0 ? '↑' : '↓'} {Math.abs(trendProfit).toFixed(0)}%
              <span className="text-gray-400 font-normal ml-1">vs last period</span>
            </span>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className={`inline-flex rounded-lg p-2 mb-3 ${(profitMargin ?? 0) >= 0 ? 'text-[var(--brand-primary)] bg-[var(--brand-primary)]/10' : 'text-red-500 bg-red-50'}`}>
            <Percent className="h-4 w-4" />
          </div>
          {profitMargin === null ? (
            <>
              <p className="text-2xl font-black text-gray-300">—</p>
              <p className="text-xs text-gray-400 mt-0.5">Profit Margin</p>
              <p className="text-xs text-gray-300 mt-0.5 leading-relaxed">Add expenses to see real margin</p>
            </>
          ) : (
            <>
              <p className={`text-xl font-bold ${profitMargin > 14 ? 'text-gray-900' : profitMargin > 8 ? 'text-amber-600' : 'text-red-600'}`}>
                {profitMargin.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Profit Margin</p>
              <p className="text-xs text-gray-300 mt-0.5">After all costs</p>
            </>
          )}
        </div>

        <div className="bg-white rounded-xl border border-orange-100 p-5">
          <div className="inline-flex rounded-lg p-2 mb-3 text-orange-500 bg-orange-50">
            <AlertCircle className="h-4 w-4" />
          </div>
          <p className="text-xl font-bold text-gray-900">${outstandingTotal.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t('outstanding')}</p>
          <p className="text-xs text-gray-300 mt-0.5">{t('invoiceCount', { count: outstandingInvoices.length })}</p>
          {trendOutstanding !== null && (
            <span className={`text-xs font-bold mt-1 block ${trendOutstanding <= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {trendOutstanding >= 0 ? '↑' : '↓'} {Math.abs(trendOutstanding).toFixed(0)}%
              <span className="text-gray-400 font-normal ml-1">vs last period</span>
            </span>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="inline-flex rounded-lg p-2 mb-3 text-red-400 bg-red-50">
            <DollarSign className="h-4 w-4" />
          </div>
          <p className="text-xl font-bold text-gray-900">${(driverCosts + contractorCosts).toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">Labor Pay Out</p>
          <p className="text-xs text-gray-300 mt-0.5">
            {driverCosts > 0 && `$${driverCosts.toLocaleString()} drivers`}
            {driverCosts > 0 && contractorCosts > 0 && ' · '}
            {contractorCosts > 0 && `$${contractorCosts.toLocaleString()} subs`}
            {driverCosts === 0 && contractorCosts === 0 && 'No payouts this period'}
          </p>
          {trendDriverCosts !== null && (
            <span className={`text-xs font-bold mt-1 block ${trendDriverCosts <= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {trendDriverCosts >= 0 ? '↑' : '↓'} {Math.abs(trendDriverCosts).toFixed(0)}%
              <span className="text-gray-400 font-normal ml-1">vs last period</span>
            </span>
          )}
        </div>
      </div>

      {/* Cost per load / revenue per load benchmarks */}
      {totalLoads > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          <div className="p-4 bg-gray-50 rounded-xl text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Revenue / Load</p>
            <p className="text-xl font-black text-gray-900">
              {revenuePerLoad ? `$${revenuePerLoad.toFixed(2)}` : '—'}
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Cost / Load</p>
            <p className="text-xl font-black text-gray-900">
              {costPerLoad ? `$${costPerLoad.toFixed(2)}` : '—'}
            </p>
            {!costPerLoad && <p className="text-xs text-gray-300">Add expenses</p>}
          </div>
          <div className="p-4 bg-gray-50 rounded-xl text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Loads</p>
            <p className="text-xl font-black text-gray-900">{totalLoads}</p>
          </div>
        </div>
      )}

      {/* Loads per period */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
        <h2 className="font-semibold text-sm text-gray-900 mb-0.5">{t('loadsPerDay')}</h2>
        <p className="text-xs text-gray-400 mb-4">{rangeLabels[dateRange]} · {t('allLoads30Days')}</p>
        <LoadsPerDayChart data={loadsChartData} />
      </div>

      {/* Revenue vs Expenses + Revenue by Driver */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-sm text-gray-900 mb-0.5">{t('revenueVsExpenses')}</h2>
          <p className="text-xs text-gray-400 mb-4">{rangeLabels[dateRange]} · {t('paidVsExpenses')}</p>
          <RevenueByMonthChart data={chartData} />
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-sm text-gray-900 mb-0.5">{t('revenueByDriver')}</h2>
          <p className="text-xs text-gray-400 mb-4">{t('billableLoads')}</p>
          <RevenueByDriverChart data={driverData} />
        </div>
      </div>

      {/* Revenue by Job + Top Contractors */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-sm text-gray-900 mb-0.5">{t('revenueByJob')}</h2>
          <p className="text-xs text-gray-400 mb-4">{t('billableByJob')}</p>
          <RevenueByJobChart data={jobData} />
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-sm text-gray-900 mb-0.5">{t('topContractors')}</h2>
          <p className="text-xs text-gray-400 mb-4">{t('byContractorRevenue')}</p>
          {contractorData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-300 text-sm">{t('noContractorTickets')}</div>
          ) : (
            <div className="space-y-3 pt-2">
              {contractorData.map((c, i) => (
                <div key={c.name} className="flex items-center gap-3">
                  <span className="w-5 text-xs font-bold text-gray-400 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 truncate">{c.name}</span>
                      <span className="text-sm font-semibold text-gray-900 ml-2">${c.revenue.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--brand-primary)] rounded-full"
                        style={{ width: `${contractorData[0] ? (c.revenue / contractorData[0].revenue) * 100 : 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Break-even analysis — only when fixed cost data exists */}
      {fixedCosts > 0 && (
        <div className="p-5 bg-gray-900 text-white rounded-2xl mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Break-Even Analysis</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-400">Fixed Costs</p>
              <p className="text-lg font-black text-white">${fixedCosts.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Revenue</p>
              <p className="text-lg font-black text-white">${cashCollected.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">{cashCollected >= fixedCosts ? 'Surplus' : 'Deficit'}</p>
              <p className={`text-lg font-black ${cashCollected >= fixedCosts ? 'text-green-400' : 'text-red-400'}`}>
                ${Math.abs(cashCollected - fixedCosts).toLocaleString()}
              </p>
            </div>
          </div>
          {cashCollected < fixedCosts && (
            <p className="text-xs text-red-400 mt-3">
              ⚠️ Below break-even — need ${(fixedCosts - cashCollected).toLocaleString()} more to cover fixed costs
            </p>
          )}
        </div>
      )}

      {/* Outstanding invoices */}
      {outstandingInvoices.length > 0 && (
        <div className="bg-white rounded-xl border border-orange-100 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-orange-100 bg-orange-50/50">
            <h2 className="font-semibold text-sm text-orange-800">{t('outstandingInvoices')}</h2>
            <p className="text-xs text-orange-500">{t('invoicesOwed', { count: outstandingInvoices.length, total: outstandingTotal.toLocaleString() })}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {[t('invoiceTable.number'), t('invoiceTable.client'), t('invoiceTable.amount'), t('invoiceTable.status'), t('invoiceTable.dueDate')].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {outstandingInvoices
                  .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
                  .map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-mono text-xs text-gray-500">{inv.invoice_number}</td>
                      <td className="px-5 py-3 font-medium text-gray-900">{inv.client_name}</td>
                      <td className="px-5 py-3 font-semibold text-gray-900">${(inv.total ?? 0).toLocaleString()}</td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                          inv.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>{inv.status.replace('_', ' ')}</span>
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {inv.due_date ? new Date(inv.due_date + 'T00:00:00').toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lost Revenue / At-Risk Tracking */}
      {(lostRevenueItems.length > 0 || overpaidInvoices.length > 0) && (
        <div className="mb-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-1">Outstanding / Lost</p>
              <p className="text-xl font-black text-red-700">${totalLostRevenue.toLocaleString()}</p>
              <p className="text-xs text-red-400 mt-0.5">{lostRevenueItems.length} invoice{lostRevenueItems.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
              <p className="text-[10px] font-bold uppercase tracking-wider text-orange-500 mb-1">Partially Paid</p>
              <p className="text-xl font-black text-orange-700">${partiallyPaidRemaining.toLocaleString()}</p>
              <p className="text-xs text-orange-400 mt-0.5">{partialInvoices.length} with balance remaining</p>
            </div>
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
              <p className="text-[10px] font-bold uppercase tracking-wider text-purple-500 mb-1">Overpayments</p>
              <p className="text-xl font-black text-purple-700">${totalOverpaid.toLocaleString()}</p>
              <p className="text-xs text-purple-400 mt-0.5">{overpaidInvoices.length} invoice{overpaidInvoices.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {lostRevenueItems.length > 0 && (
            <div className="bg-white rounded-xl border border-red-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-red-100 bg-red-50/40">
                <h2 className="font-semibold text-sm text-red-800">At-Risk Revenue</h2>
                <p className="text-xs text-red-500">Partially paid &amp; overdue invoices with outstanding balances</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Invoice #', 'Client', 'Total', 'Paid', 'Outstanding', 'Status'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {lostRevenueItems.map(inv => {
                      const amtPaid = inv.amount_paid ?? 0
                      const amtRemaining = inv.amount_remaining ?? inv.total ?? 0
                      const pct = inv.total > 0 ? Math.min(100, (amtPaid / inv.total) * 100) : 0
                      return (
                        <tr key={inv.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">{inv.invoice_number}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{inv.client_name}</td>
                          <td className="px-4 py-3 text-gray-700">${(inv.total ?? 0).toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <div>
                              <span className="text-green-600 font-medium">${amtPaid.toLocaleString()}</span>
                              {amtPaid > 0 && (
                                <div className="w-16 h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                                  <div className="h-full bg-orange-400 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-bold text-red-600">${amtRemaining.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              inv.status === 'partially_paid' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {inv.status === 'partially_paid' ? 'Partial' : 'Overdue'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                      <td colSpan={4} className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Total Outstanding:</td>
                      <td className="px-4 py-3 font-black text-red-700 text-base">${totalLostRevenue.toLocaleString()}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {overpaidInvoices.length > 0 && (
            <div className="bg-white rounded-xl border border-purple-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-purple-100 bg-purple-50/40">
                <h2 className="font-semibold text-sm text-purple-800">Overpayments to Reconcile</h2>
                <p className="text-xs text-purple-500">${totalOverpaid.toLocaleString()} received above invoice total</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px] text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Invoice #', 'Client', 'Total', 'Overpaid By'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {overpaidInvoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{inv.invoice_number}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{inv.client_name}</td>
                        <td className="px-4 py-3 text-gray-700">${(inv.total ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-3 font-bold text-purple-700">${(inv.overpaid_amount ?? 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expenses summary band */}
      {filteredExpenses.length > 0 ? (
        <div className="mt-2 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{t('expenseTracker')}</p>
              <div className="flex gap-4 flex-wrap">
                {topExpenseCategories.map(([cat, amount]) => {
                  const catConfig = getCategoryConfig(cat)
                  return (
                    <span key={cat} className="text-sm text-gray-700">
                      {catConfig.emoji} {catConfig.label}: <strong>${(amount as number).toLocaleString()}</strong>
                    </span>
                  )
                })}
              </div>
            </div>
            <a href="/dashboard/expenses" className="text-sm font-bold text-[var(--brand-primary)] hover:underline whitespace-nowrap">View all →</a>
          </div>
        </div>
      ) : (
        <div className="mt-2 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-4">
          <p className="text-sm text-amber-800">{t('noExpenses')}</p>
          <a href="/dashboard/expenses" className="text-sm font-bold text-amber-700 hover:underline whitespace-nowrap">{t('addExpense')} →</a>
        </div>
      )}

      </>)} {/* end overview tab */}
    </div>
  )
}
