'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Plus, DollarSign, TrendingUp, TrendingDown, AlertCircle, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import {
  RevenueByDriverChart,
  RevenueByMonthChart,
  LoadsPerDayChart,
  RevenueByJobChart,
} from '@/components/dashboard/revenue-charts'
import type { Load, Expense, ContractorTicket, Invoice, Payment } from '@/lib/types'

const categories = ['Fuel', 'Maintenance', 'Insurance', 'Labor', 'Equipment', 'Other']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const BILLABLE_STATUSES = ['approved', 'invoiced', 'paid'] as const

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
  const [loading, setLoading] = useState(true)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expForm, setExpForm] = useState({
    description: '', amount: '', category: 'Fuel',
    date: new Date().toISOString().split('T')[0],
  })
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'driverpay'>('overview')
  const [payWeek, setPayWeek] = useState<0 | -1>(0)
  const supabase = createClient()

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

    const [lRes, eRes, ctRes, invRes, payRes] = await Promise.all([
      supabase.from('loads').select('*').eq('company_id', user.id).gte('date', cutoff),
      supabase.from('expenses').select('*').eq('company_id', user.id).order('date', { ascending: false }),
      supabase.from('contractor_tickets').select('*').eq('company_id', user.id).gte('date', cutoff),
      supabase.from('invoices').select('*').eq('company_id', user.id),
      supabase.from('payments').select('*').eq('company_id', user.id),
    ])

    if (lRes.error) console.error('[revenue] loads:', lRes.error.message)
    if (invRes.error) console.error('[revenue] invoices:', invRes.error.message)
    if (payRes.error && !payRes.error.message.includes('schema cache')) {
      console.error('[revenue] payments:', payRes.error.message)
    }

    setLoads(lRes.data ?? [])
    setExpenses(eRes.data ?? [])
    setContractorTickets(ctRes.data ?? [])
    setInvoices(invRes.data ?? [])
    setPayments(payRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault()
    const uid = await getUid()
    if (!uid) { toast.error('Not authenticated'); return }
    setSaving(true)
    const { error } = await supabase.from('expenses').insert({
      description: expForm.description,
      amount: parseFloat(expForm.amount) || 0,
      category: expForm.category,
      date: expForm.date,
      company_id: uid,
    })
    if (error) { toast.error('Failed to add expense'); setSaving(false); return }
    toast.success('Expense added')
    setSaving(false)
    setShowExpenseForm(false)
    setExpForm({ description: '', amount: '', category: 'Fuel', date: new Date().toISOString().split('T')[0] })
    fetchData()
  }

  // ── Derived stats ──────────────────────────────────────────────────────────

  // Revenue = paid invoice totals (invoices fully paid to completion)
  const paidInvoices = invoices.filter(i => i.status === 'paid')
  const totalRevenue = paidInvoices.reduce((s, i) => s + (i.total ?? 0), 0)

  // Actual cash collected = sum of all payment records
  const totalCollected = payments.reduce((s, p) => s + (p.amount ?? 0), 0)

  // Outstanding = sent + overdue + partially_paid
  const unpaidInvoices = invoices.filter(i => ['sent', 'overdue', 'partially_paid'].includes(i.status))
  const unpaidTotal = unpaidInvoices.reduce((s, i) => s + (i.total ?? 0), 0)

  const totalExpenses = expenses.reduce((s, e) => s + (e.amount ?? 0), 0)

  // Use total collected as the most accurate revenue figure; fall back to paid invoice totals if no payments recorded
  const revenueForProfit = totalCollected > 0 ? totalCollected : totalRevenue
  const profit = revenueForProfit - totalExpenses

  // Revenue by driver — all billable loads (approved/invoiced/paid)
  const billableLoads = loads.filter(l => (BILLABLE_STATUSES as readonly string[]).includes(l.status))
  const driverData = Object.entries(
    billableLoads.reduce<Record<string, number>>((acc, l) => {
      const key = l.driver_name || 'Unknown'
      acc[key] = (acc[key] ?? 0) + (l.rate ?? 0)
      return acc
    }, {})
  ).map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6)

  // Revenue by job — all billable loads
  const jobData = Object.entries(
    billableLoads.reduce<Record<string, number>>((acc, l) => {
      const key = l.job_name || 'No Job'
      acc[key] = (acc[key] ?? 0) + (l.rate ?? 0)
      return acc
    }, {})
  ).map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6)

  // Top 5 contractors by ticket revenue (all statuses — represents work done)
  const contractorData = Object.entries(
    contractorTickets.reduce<Record<string, number>>((acc, t) => {
      const key = t.job_name || 'No Job'
      acc[key] = (acc[key] ?? 0) + (t.rate ?? 0)
      return acc
    }, {})
  ).map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  // Monthly revenue = paid invoices bucketed by created_at month
  // Monthly expenses = expenses by date month
  const now = new Date()
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    const yr = d.getFullYear()
    const mo = d.getMonth()
    const key = `${yr}-${String(mo + 1).padStart(2, '0')}`

    // Revenue: paid invoices created in this month
    const rev = paidInvoices
      .filter(inv => (inv.created_at ?? '').startsWith(key))
      .reduce((s, inv) => s + (inv.total ?? 0), 0)

    // Also add payments made in this month (for partially-paid invoices)
    const payRev = payments
      .filter(p => (p.payment_date ?? '').startsWith(key))
      .reduce((s, p) => s + (p.amount ?? 0), 0)

    const exp = expenses
      .filter(e => (e.date ?? '').startsWith(key))
      .reduce((s, e) => s + (e.amount ?? 0), 0)

    // Use whichever is higher: paid invoice totals or actual payments for that month
    // Avoids double-counting while capturing both paths
    return { month: MONTH_NAMES[mo] ?? '', revenue: Math.max(rev, payRev), expenses: exp }
  })

  // Loads per day (last 30 days) — all loads regardless of status
  const loadsPerDay = (() => {
    const map: Record<string, number> = {}
    const today = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      map[d.toISOString().split('T')[0]!] = 0
    }
    loads.forEach(l => { if (l.date && l.date in map) map[l.date] = (map[l.date] ?? 0) + 1 })
    return Object.entries(map).map(([date, count]) => ({ day: date.slice(5), loads: count }))
  })()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-40">
        <Loader2 className="h-6 w-6 animate-spin text-[#2d7a4f]" />
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
          {/* Week toggle */}
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
                    <span className="text-sm font-bold text-[#2d7a4f]">${block.total.toLocaleString()}</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left">
                        {['Driver', 'Loads', 'Total Pay'].map(h => (
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
                        <td className="px-5 py-2.5 font-bold text-[#2d7a4f]">${block.total.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ))}
              {/* Grand Total */}
              <div className="bg-[#1e3a2a] rounded-xl px-5 py-4 flex items-center justify-between">
                <span className="text-white font-semibold">Grand Total — All Drivers</span>
                <span className="text-2xl font-extrabold text-[#4ade80]">${grandTotalOwed.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Overview Tab ───────────────────────────────────────────────── */}
      {activeTab === 'overview' && (<>


      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="inline-flex rounded-lg p-2 mb-3 text-[#2d7a4f] bg-[#2d7a4f]/10">
            <DollarSign className="h-4 w-4" />
          </div>
          <p className="text-xl font-bold text-gray-900">${totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">Paid Invoices</p>
          <p className="text-xs text-gray-300 mt-0.5">{paidInvoices.length} invoices</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="inline-flex rounded-lg p-2 mb-3 text-purple-600 bg-purple-50">
            <CreditCard className="h-4 w-4" />
          </div>
          <p className="text-xl font-bold text-gray-900">${totalCollected.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">Cash Collected</p>
          <p className="text-xs text-gray-300 mt-0.5">{payments.length} payments</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="inline-flex rounded-lg p-2 mb-3 text-red-500 bg-red-50">
            <TrendingDown className="h-4 w-4" />
          </div>
          <p className="text-xl font-bold text-gray-900">${totalExpenses.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">Expenses</p>
          <p className="text-xs text-gray-300 mt-0.5">{expenses.length} entries</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className={`inline-flex rounded-lg p-2 mb-3 ${profit >= 0 ? 'text-[#2d7a4f] bg-[#2d7a4f]/10' : 'text-red-500 bg-red-50'}`}>
            <TrendingUp className="h-4 w-4" />
          </div>
          <p className="text-xl font-bold text-gray-900">${profit.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">Net Profit</p>
          <p className="text-xs text-gray-300 mt-0.5">Revenue − Expenses</p>
        </div>

        <div className="bg-white rounded-xl border border-orange-100 p-5">
          <div className="inline-flex rounded-lg p-2 mb-3 text-orange-500 bg-orange-50">
            <AlertCircle className="h-4 w-4" />
          </div>
          <p className="text-xl font-bold text-gray-900">${unpaidTotal.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">Outstanding</p>
          <p className="text-xs text-gray-300 mt-0.5">{unpaidInvoices.length} invoices</p>
        </div>
      </div>

      {/* Loads per day */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
        <h2 className="font-semibold text-sm text-gray-900 mb-0.5">Loads Per Day</h2>
        <p className="text-xs text-gray-400 mb-4">All loads — last 30 days</p>
        <LoadsPerDayChart data={loadsPerDay} />
      </div>

      {/* Revenue vs Expenses + Revenue by Driver */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-sm text-gray-900 mb-0.5">Revenue vs Expenses</h2>
          <p className="text-xs text-gray-400 mb-4">Paid invoices vs expenses — last 6 months</p>
          <RevenueByMonthChart data={monthlyData} />
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
                        className="h-full bg-[#2d7a4f] rounded-full"
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
      {unpaidInvoices.length > 0 && (
        <div className="bg-white rounded-xl border border-orange-100 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-orange-100 bg-orange-50/50">
            <h2 className="font-semibold text-sm text-orange-800">Outstanding Invoices</h2>
            <p className="text-xs text-orange-500">{unpaidInvoices.length} invoices · ${unpaidTotal.toLocaleString()} owed</p>
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
                {unpaidInvoices
                  .sort((a, b) => {
                    // Sort overdue first, then by due date
                    if (a.status === 'overdue' && b.status !== 'overdue') return -1
                    if (b.status === 'overdue' && a.status !== 'overdue') return 1
                    return (a.due_date ?? '').localeCompare(b.due_date ?? '')
                  })
                  .map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-mono text-xs text-gray-500">{inv.invoice_number}</td>
                      <td className="px-5 py-3 font-medium text-gray-900">{inv.client_name}</td>
                      <td className="px-5 py-3 font-semibold text-gray-900">${(inv.total ?? 0).toLocaleString()}</td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                          inv.status === 'overdue'        ? 'bg-red-100 text-red-700'      :
                          inv.status === 'partially_paid' ? 'bg-yellow-100 text-yellow-700' :
                                                            'bg-blue-100 text-blue-700'
                        }`}>{inv.status.replace('_', ' ')}</span>
                      </td>
                      <td className={`px-5 py-3 ${inv.status === 'overdue' ? 'font-semibold text-red-600' : 'text-gray-500'}`}>
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
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-sm text-gray-900">Expense Tracker</h2>
            <p className="text-xs text-gray-400">{expenses.length} expenses · ${totalExpenses.toLocaleString()} total</p>
          </div>
          <button
            onClick={() => setShowExpenseForm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add Expense
          </button>
        </div>
        {expenses.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-400">No expenses recorded yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Description', 'Category', 'Amount', 'Date'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {expenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-medium text-gray-900">{exp.description}</td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">{exp.category}</span>
                    </td>
                    <td className="px-5 py-3 font-semibold text-red-500">-${exp.amount.toLocaleString()}</td>
                    <td className="px-5 py-3 text-gray-500">{new Date(exp.date + 'T00:00:00').toLocaleDateString()}</td>
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
              <h2 className="font-semibold text-gray-900">Add Expense</h2>
              <button onClick={() => setShowExpenseForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <form onSubmit={handleAddExpense} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description *</label>
                <input
                  required
                  value={expForm.description}
                  onChange={e => setExpForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]"
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
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]"
                    placeholder="350.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={expForm.category}
                    onChange={e => setExpForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f] bg-white"
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
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExpenseForm(false)}
                  className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-[#2d7a4f] py-2.5 text-sm font-semibold text-white hover:bg-[#245f3e] disabled:opacity-50"
                >
                  {saving ? 'Adding…' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
