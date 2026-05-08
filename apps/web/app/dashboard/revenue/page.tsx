'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCompanyId } from '@/lib/get-company-id'
import { Loader2, Plus, DollarSign, TrendingUp, TrendingDown, AlertCircle, CreditCard, Download, Percent, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  RevenueByDriverChart,
  RevenueByMonthChart,
  LoadsPerDayChart,
  RevenueByJobChart,
} from '@/components/dashboard/revenue-charts'
import type { Load, Expense, ContractorTicket, Invoice, Payment } from '@/lib/types'

const categories = ['Fuel', 'DEF', 'Tires', 'Maintenance', 'Insurance', 'Labor', 'Equipment', 'Tolls', 'Other']
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
  const [loads, setLoads] = useState<Load[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [contractorTickets, setContractorTickets] = useState<ContractorTicket[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [jobNames, setJobNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [expForm, setExpForm] = useState({
    description: '', amount: '', category: 'Fuel',
    date: new Date().toISOString().split('T')[0]!,
  })
  const [expCategoryFilter, setExpCategoryFilter] = useState('')
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'driverpay'>('overview')
  const [payWeek, setPayWeek] = useState<0 | -1>(0)
  const [dateRange, setDateRange] = useState<DateRange>('month')
  const supabase = createClient()

  async function fetchData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)
    const orgId = await getCompanyId()
    if (!orgId) { setLoading(false); return }

    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - 1)
    const fetchCutoff = cutoff.toISOString().split('T')[0]!

    const [lRes, eRes, ctRes, invRes, payRes, jobsRes] = await Promise.all([
      supabase.from('loads')
        .select('*, dispatches!loads_dispatch_id_fkey(job_id, jobs!dispatches_job_id_fkey(job_name))')
        .eq('company_id', orgId).gte('date', fetchCutoff),
      supabase.from('expenses').select('*').eq('company_id', orgId).order('date', { ascending: false }),
      supabase.from('contractor_tickets').select('*').eq('company_id', orgId).gte('date', fetchCutoff),
      supabase.from('invoices').select('*').eq('company_id', orgId),
      supabase.from('payments').select('*').eq('company_id', orgId),
      supabase.from('jobs').select('id, job_name').eq('company_id', orgId),
    ])

    if (lRes.error) console.error('[revenue] loads:', lRes.error.message)
    if (invRes.error) console.error('[revenue] invoices:', invRes.error.message)

    const jobMap = new Map<string, string>()
    for (const j of (jobsRes.data ?? [])) {
      jobMap.set(j.id, j.job_name)
    }
    setJobNames(jobMap)

    setLoads((lRes.data ?? []) as Load[])
    setExpenses(eRes.data ?? [])
    setContractorTickets(ctRes.data ?? [])
    setInvoices(invRes.data ?? [])
    setPayments(payRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  function openAddExpense() {
    setEditingExpense(null)
    setExpForm({ description: '', amount: '', category: 'Fuel', date: new Date().toISOString().split('T')[0]! })
    setShowExpenseForm(true)
  }

  function openEditExpense(exp: Expense) {
    setEditingExpense(exp)
    setExpForm({ description: exp.description, amount: String(exp.amount), category: exp.category, date: exp.date })
    setShowExpenseForm(true)
  }

  async function handleSaveExpense(e: React.FormEvent) {
    e.preventDefault()
    const orgId = await getCompanyId()
    if (!orgId) { toast.error('Not authenticated'); return }
    setSaving(true)
    const payload = {
      description: expForm.description,
      amount: parseFloat(expForm.amount) || 0,
      category: expForm.category,
      date: expForm.date,
    }
    if (editingExpense) {
      const { error } = await supabase.from('expenses').update(payload).eq('id', editingExpense.id)
      if (error) { toast.error('Failed to update expense'); setSaving(false); return }
      toast.success('Expense updated')
    } else {
      const { error } = await supabase.from('expenses').insert({ ...payload, company_id: orgId })
      if (error) { toast.error('Failed to add expense'); setSaving(false); return }
      toast.success('Expense added')
    }
    setSaving(false)
    setShowExpenseForm(false)
    setEditingExpense(null)
    fetchData()
  }

  async function handleDeleteExpense(id: string) {
    if (!confirm('Delete this expense?')) return
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) { toast.error('Failed to delete expense'); return }
    toast.success('Expense deleted')
    fetchData()
  }

  // ── Date range filtering ──────────────────────────────────────────────────
  const bounds = getRangeBounds(dateRange)

  const filteredLoads = loads.filter(l => l.date >= bounds.start && l.date <= bounds.end)
  const filteredInvoices = invoices.filter(i => {
    const d = invDate(i)
    return d >= bounds.start && d <= bounds.end
  })
  const filteredExpenses = expenses.filter(e => (e.date ?? '') >= bounds.start && (e.date ?? '') <= bounds.end)
  const displayedExpenses = expCategoryFilter ? filteredExpenses.filter(e => e.category === expCategoryFilter) : filteredExpenses

  // ── Derived stats (all scoped to selected date range) ─────────────────────

  // Payments map: invoice_id → total paid
  const paymentsByInvoiceId = payments.reduce<Record<string, number>>((acc, p) => {
    acc[p.invoice_id] = (acc[p.invoice_id] ?? 0) + p.amount
    return acc
  }, {})

  // Cash Collected: for paid invoices in range, use payment records if available else invoice total
  const paidInvoices = filteredInvoices.filter(i => i.status === 'paid' && i.invoice_type === 'client')
  const cashCollected = paidInvoices.reduce((s, i) => {
    const pmtSum = paymentsByInvoiceId[i.id]
    return s + (pmtSum !== undefined ? pmtSum : i.total)
  }, 0)

  // Outstanding: draft + sent invoices in range
  const outstandingInvoices = filteredInvoices.filter(i => ['draft', 'sent'].includes(i.status))
  const outstandingTotal = outstandingInvoices.reduce((s, i) => s + (i.total ?? 0), 0)

  const totalExpenses = filteredExpenses.reduce((s, e) => s + (e.amount ?? 0), 0)

  // Driver costs = paystub invoices (what we pay drivers)
  const driverCostInvoices = filteredInvoices.filter(i => i.invoice_type === 'paystub')
  const driverCosts = driverCostInvoices.reduce((s, i) => s + (i.total ?? 0), 0)

  // Net profit
  const profit = cashCollected - totalExpenses

  // Profit margin: (Revenue - Driver Costs) / Revenue
  const profitMarginPct = cashCollected > 0 ? Math.round(((cashCollected - driverCosts) / cashCollected) * 100) : 0

  // Revenue by driver
  const billableLoads = filteredLoads.filter(l => (BILLABLE_STATUSES as readonly string[]).includes(l.status))
  const driverData = Object.entries(
    billableLoads.reduce<Record<string, number>>((acc, l) => {
      const key = l.driver_name || 'Unknown'
      acc[key] = (acc[key] ?? 0) + (l.rate ?? 0)
      return acc
    }, {})
  ).map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6)

  // Revenue by job — resolve job name via dispatch join if available
  const jobData = Object.entries(
    billableLoads.reduce<Record<string, number>>((acc, l) => {
      const raw = l as Load & { dispatches?: { job_id?: string | null; jobs?: { job_name?: string } | null } | null }
      const resolvedName = raw.dispatches?.jobs?.job_name
        ?? (raw.dispatches?.job_id ? jobNames.get(raw.dispatches.job_id) : undefined)
        ?? l.job_name
        ?? 'No Job'
      acc[resolvedName] = (acc[resolvedName] ?? 0) + (l.rate ?? 0)
      return acc
    }, {})
  ).map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6)

  // Top contractors
  const filteredCTs = contractorTickets.filter(t => (t.date ?? '') >= bounds.start && (t.date ?? '') <= bounds.end)
  const contractorData = Object.entries(
    filteredCTs.reduce<Record<string, number>>((acc, t) => {
      const key = t.job_name || 'No Job'
      acc[key] = (acc[key] ?? 0) + (t.rate ?? 0)
      return acc
    }, {})
  ).map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  // Chart data
  const chartData = buildRevExpChartData(dateRange, bounds, filteredInvoices, filteredExpenses)
  const loadsChartData = buildLoadsChartData(dateRange, bounds, filteredLoads)

  // Export CSV
  function handleExportCSV() {
    const headers = ['Date', 'Driver', 'Job', 'Truck #', 'Material', 'Rate', 'Rate Type', 'Status']
    const rows = filteredLoads.map(l => {
      const raw = l as Load & { dispatches?: { job_id?: string | null; jobs?: { job_name?: string } | null } | null }
      const jobName = raw.dispatches?.jobs?.job_name
        ?? (raw.dispatches?.job_id ? jobNames.get(raw.dispatches.job_id) : undefined)
        ?? l.job_name ?? ''
      return [l.date, l.driver_name, jobName, l.truck_number ?? '', l.material ?? '', l.rate, l.rate_type ?? 'load', l.status]
    })
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
      map[c]![d]!.total += l.rate ?? 0
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

  return (
    <div className="p-6 md:p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue</h1>
          <p className="text-gray-500 text-sm mt-0.5">Track your earnings, expenses, and profit</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['overview', 'driverpay'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t === 'overview' ? 'Overview' : 'Driver Pay'}
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
                  {w === 0 ? 'This Week' : 'Last Week'}
                </button>
              ))}
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">{new Date(weekBounds.start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(weekBounds.end + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">${grandTotalOwed.toLocaleString()} total driver pay</p>
            </div>
          </div>

          {contractorBlocks.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
              <p className="text-sm text-gray-400">No approved/invoiced/paid loads for this week</p>
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
                        {['Driver', 'Jobs', 'Total Pay'].map(h => (
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
                        <td className="px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase" colSpan={2}>Subtotal — {block.contractor}</td>
                        <td className="px-5 py-2.5 font-bold text-[var(--brand-primary)]">${block.total.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ))}
              <div className="bg-[var(--brand-dark)] rounded-xl px-5 py-4 flex items-center justify-between">
                <span className="text-white font-semibold">Grand Total — All Drivers</span>
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

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="inline-flex rounded-lg p-2 mb-3 text-[var(--brand-primary)] bg-[var(--brand-primary)]/10">
            <CreditCard className="h-4 w-4" />
          </div>
          <p className="text-xl font-bold text-gray-900">${cashCollected.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">Cash Collected</p>
          <p className="text-xs text-gray-300 mt-0.5">{paidInvoices.length} paid invoices</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="inline-flex rounded-lg p-2 mb-3 text-red-500 bg-red-50">
            <TrendingDown className="h-4 w-4" />
          </div>
          <p className="text-xl font-bold text-gray-900">${totalExpenses.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">Expenses</p>
          <p className="text-xs text-gray-300 mt-0.5">{filteredExpenses.length} entries</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className={`inline-flex rounded-lg p-2 mb-3 ${profit >= 0 ? 'text-[var(--brand-primary)] bg-[var(--brand-primary)]/10' : 'text-red-500 bg-red-50'}`}>
            <TrendingUp className="h-4 w-4" />
          </div>
          <p className={`text-xl font-bold ${profit >= 0 ? 'text-gray-900' : 'text-red-600'}`}>${profit.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">Net Profit</p>
          <p className="text-xs text-gray-300 mt-0.5">Revenue − Expenses</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className={`inline-flex rounded-lg p-2 mb-3 ${profitMarginPct >= 0 ? 'text-[var(--brand-primary)] bg-[var(--brand-primary)]/10' : 'text-red-500 bg-red-50'}`}>
            <Percent className="h-4 w-4" />
          </div>
          <p className={`text-xl font-bold ${profitMarginPct >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{profitMarginPct}%</p>
          <p className="text-xs text-gray-400 mt-0.5">Profit Margin</p>
          <p className="text-xs text-gray-300 mt-0.5">After driver costs</p>
        </div>

        <div className="bg-white rounded-xl border border-orange-100 p-5">
          <div className="inline-flex rounded-lg p-2 mb-3 text-orange-500 bg-orange-50">
            <AlertCircle className="h-4 w-4" />
          </div>
          <p className="text-xl font-bold text-gray-900">${outstandingTotal.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">Outstanding</p>
          <p className="text-xs text-gray-300 mt-0.5">{outstandingInvoices.length} invoices</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="inline-flex rounded-lg p-2 mb-3 text-[var(--brand-primary)] bg-[var(--brand-primary)]/10">
            <DollarSign className="h-4 w-4" />
          </div>
          <p className="text-xl font-bold text-gray-900">${driverCosts.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">Driver Costs</p>
          <p className="text-xs text-gray-300 mt-0.5">{driverCostInvoices.length} pay stubs</p>
        </div>
      </div>

      {/* Loads per period */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
        <h2 className="font-semibold text-sm text-gray-900 mb-0.5">Loads Over Time</h2>
        <p className="text-xs text-gray-400 mb-4">{rangeLabels[dateRange]} · all loads</p>
        <LoadsPerDayChart data={loadsChartData} />
      </div>

      {/* Revenue vs Expenses + Revenue by Driver */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-sm text-gray-900 mb-0.5">Revenue vs Expenses</h2>
          <p className="text-xs text-gray-400 mb-4">{rangeLabels[dateRange]} · by invoice date</p>
          <RevenueByMonthChart data={chartData} />
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-sm text-gray-900 mb-0.5">Revenue by Driver</h2>
          <p className="text-xs text-gray-400 mb-4">Billable loads (approved / invoiced / paid)</p>
          <RevenueByDriverChart data={driverData} />
        </div>
      </div>

      {/* Revenue by Job + Top Contractors */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-sm text-gray-900 mb-0.5">Revenue by Job</h2>
          <p className="text-xs text-gray-400 mb-4">Billable loads by job name</p>
          <RevenueByJobChart data={jobData} />
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-sm text-gray-900 mb-0.5">Top Contractors</h2>
          <p className="text-xs text-gray-400 mb-4">By contractor ticket revenue</p>
          {contractorData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-300 text-sm">No contractor tickets yet</div>
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

      {/* Outstanding invoices */}
      {outstandingInvoices.length > 0 && (
        <div className="bg-white rounded-xl border border-orange-100 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-orange-100 bg-orange-50/50">
            <h2 className="font-semibold text-sm text-orange-800">Outstanding Invoices</h2>
            <p className="text-xs text-orange-500">{outstandingInvoices.length} invoices · ${outstandingTotal.toLocaleString()} owed</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Invoice #', 'Client', 'Amount', 'Status', 'Due Date'].map(h => (
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

      {/* Expense Tracker */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold text-sm text-gray-900">Expense Tracker</h2>
            <p className="text-xs text-gray-400">{filteredExpenses.length} expenses · ${totalExpenses.toLocaleString()} total</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={expCategoryFilter}
              onChange={e => setExpCategoryFilter(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20"
            >
              <option value="">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              onClick={openAddExpense}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add Expense
            </button>
          </div>
        </div>

        {/* Category breakdown */}
        {filteredExpenses.length > 0 && (() => {
          const byCategory = categories
            .map(cat => ({ cat, total: filteredExpenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0) }))
            .filter(r => r.total > 0)
            .sort((a, b) => b.total - a.total)
          if (byCategory.length === 0) return null
          const max = byCategory[0]!.total
          return (
            <div className="px-5 py-4 border-b border-gray-100 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
              {byCategory.map(({ cat, total }) => (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-gray-500">{cat}</span>
                    <span className="text-xs font-semibold text-gray-700">${total.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.round((total / max) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )
        })()}

        {displayedExpenses.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-400">
              {expCategoryFilter ? `No ${expCategoryFilter} expenses for ${rangeLabels[dateRange].toLowerCase()}` : `No expenses for ${rangeLabels[dateRange].toLowerCase()}`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Description', 'Category', 'Amount', 'Date', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayedExpenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-gray-50/50 group">
                    <td className="px-5 py-3 font-medium text-gray-900">{exp.description}</td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">{exp.category}</span>
                    </td>
                    <td className="px-5 py-3 font-semibold text-red-500">-${exp.amount.toLocaleString()}</td>
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{new Date(exp.date + 'T00:00:00').toLocaleDateString()}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditExpense(exp)} className="text-gray-400 hover:text-gray-700 transition-colors" title="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDeleteExpense(exp.id)} className="text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      </>)} {/* end overview tab */}

      {showExpenseForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{editingExpense ? 'Edit Expense' : 'Add Expense'}</h2>
              <button onClick={() => { setShowExpenseForm(false); setEditingExpense(null) }} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <form onSubmit={handleSaveExpense} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description *</label>
                <input
                  required
                  value={expForm.description}
                  onChange={e => setExpForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                  placeholder="Fuel for truck #3"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Amount ($) *</label>
                  <input
                    required type="number" min="0" step="0.01"
                    value={expForm.amount}
                    onChange={e => setExpForm(p => ({ ...p, amount: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                    placeholder="350.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={expForm.category}
                    onChange={e => setExpForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] bg-white"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
                <input
                  required type="date"
                  value={expForm.date}
                  onChange={e => setExpForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowExpenseForm(false); setEditingExpense(null) }}
                  className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-[var(--brand-primary)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
                >
                  {saving ? (editingExpense ? 'Saving…' : 'Adding…') : (editingExpense ? 'Save Changes' : 'Add Expense')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
