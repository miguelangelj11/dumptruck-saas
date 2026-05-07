'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Truck, TrendingUp, Receipt, Radio, X } from 'lucide-react'
import Link from 'next/link'

type Panel = 'tickets' | 'revenue' | 'outstanding' | 'dispatched' | null

interface Props {
  companyId: string
  thisWeekTickets: number
  ticketPct: number | null
  thisMonthRev: number
  revPct: number | null
  outstandingTotal: number
  outstandingCount: number
  dispatchedToday: number
  thisWeekStartStr: string
  todayStr: string
  thisMonthStr: string
}

const ticketStatusColor: Record<string, string> = {
  pending:  'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  invoiced: 'bg-blue-100 text-blue-700',
  paid:     'bg-emerald-100 text-emerald-700',
  disputed: 'bg-red-100 text-red-700',
}

const invStatusColor: Record<string, string> = {
  draft:          'bg-gray-100 text-gray-600',
  sent:           'bg-blue-100 text-blue-700',
  overdue:        'bg-red-100 text-red-700',
  partially_paid: 'bg-orange-100 text-orange-700',
}

const dispStatusLabel: Record<string, string> = {
  dispatched: 'Sent', accepted: 'Accepted', working: 'Working',
  completed: 'Done', declined: 'Declined', cancelled: 'Cancelled',
}

const dispStatusColor: Record<string, string> = {
  dispatched: 'bg-gray-100 text-gray-600',
  accepted:   'bg-blue-100 text-blue-700',
  working:    'bg-green-100 text-green-700',
  completed:  'bg-emerald-100 text-emerald-700',
  declined:   'bg-red-100 text-red-700',
}

function fmt(n: number) { return '$' + n.toLocaleString() }

function PctBadge({ value, period }: { value: number | null; period: string }) {
  if (value === null) return null
  const pos = value >= 0
  return (
    <span className={`text-xs font-medium ${pos ? 'text-green-600' : 'text-red-500'}`}>
      {pos ? '↑' : '↓'} {Math.abs(value)}% vs last {period}
    </span>
  )
}

function CalculationExplainer({ source, dateRange, filter, note }: {
  source: string; dateRange: string; filter?: string; note?: string
}) {
  return (
    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl mb-5">
      <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">ℹ️ How this is calculated</p>
      <div className="space-y-1 text-xs text-blue-800">
        <p><span className="font-semibold">Source:</span> {source}</p>
        <p><span className="font-semibold">Date range:</span> {dateRange}</p>
        {filter && <p><span className="font-semibold">Filter:</span> {filter}</p>}
        {note && <p className="mt-2 text-blue-600 italic">{note}</p>}
      </div>
    </div>
  )
}

function StatDetailPanel({ isOpen, onClose, title, subtitle, children }: {
  isOpen: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode
}) {
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />}
      <div className={`fixed right-0 top-0 h-full w-full sm:max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5 shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-6 pb-24" style={{ height: 'calc(100% - 65px)' }}>
          {children}
        </div>
      </div>
    </>
  )
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-[var(--brand-primary)]" />
    </div>
  )
}

export default function DashboardStatCards({
  companyId, thisWeekTickets, ticketPct, thisMonthRev, revPct,
  outstandingTotal, outstandingCount, dispatchedToday,
  thisWeekStartStr, todayStr, thisMonthStr,
}: Props) {
  const [openPanel, setOpenPanel] = useState<Panel>(null)
  const supabase = createClient()

  // Tickets panel
  type TicketRow = { id: string; date: string; job_name: string; driver_name: string; rate: number; total_pay: number | null; status: string; client_company: string | null; truck_number: string | null }
  const [ticketRows, setTicketRows] = useState<TicketRow[]>([])
  const [ticketLoading, setTicketLoading] = useState(false)

  // Revenue panel
  type RevRow = { id: string; date: string; driver_name: string; rate: number; status: string }
  const [revRows, setRevRows] = useState<RevRow[]>([])
  const [revLoading, setRevLoading] = useState(false)

  // Outstanding panel
  type InvRow = { id: string; invoice_number: string; client_name: string; total: number; due_date: string | null; status: string }
  const [invRows, setInvRows] = useState<InvRow[]>([])
  const [invLoading, setInvLoading] = useState(false)

  // Dispatched panel
  type DispRow = { id: string; driver_name: string; truck_number: string | null; status: string; loads_completed: number; start_time: string | null; jobs: { job_name: string } | null }
  const [dispRows, setDispRows] = useState<DispRow[]>([])
  const [dispLoading, setDispLoading] = useState(false)

  useEffect(() => {
    if (openPanel !== 'tickets') return
    setTicketLoading(true)
    setTicketRows([])
    supabase.from('loads')
      .select('id, date, job_name, driver_name, rate, total_pay, status, client_company, truck_number')
      .eq('company_id', companyId)
      .gte('date', thisWeekStartStr)
      .lte('date', todayStr)
      .order('date', { ascending: false })
      .then(({ data }) => { setTicketRows((data ?? []) as TicketRow[]); setTicketLoading(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPanel])

  useEffect(() => {
    if (openPanel !== 'revenue') return
    setRevLoading(true)
    setRevRows([])
    supabase.from('loads')
      .select('id, date, driver_name, rate, status')
      .eq('company_id', companyId)
      .like('date', `${thisMonthStr}-%`)
      .order('date', { ascending: false })
      .then(({ data }) => { setRevRows((data ?? []) as RevRow[]); setRevLoading(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPanel])

  useEffect(() => {
    if (openPanel !== 'outstanding') return
    setInvLoading(true)
    setInvRows([])
    supabase.from('invoices')
      .select('id, invoice_number, client_name, total, due_date, status')
      .eq('company_id', companyId)
      .in('status', ['draft', 'sent', 'overdue', 'partially_paid'])
      .order('due_date', { ascending: true })
      .then(({ data }) => { setInvRows((data ?? []) as InvRow[]); setInvLoading(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPanel])

  useEffect(() => {
    if (openPanel !== 'dispatched') return
    setDispLoading(true)
    setDispRows([])
    supabase.from('dispatches')
      .select('id, driver_name, truck_number, status, loads_completed, start_time, jobs(job_name)')
      .eq('company_id', companyId)
      .eq('dispatch_date', todayStr)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setDispRows((data ?? []) as unknown as DispRow[]); setDispLoading(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPanel])

  function close() { setOpenPanel(null) }

  // Date labels
  const weekStartLabel = new Date(thisWeekStartStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const todayLabel     = new Date(todayStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const monthLabel     = new Date(thisMonthStr + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // Revenue panel: weekly breakdown + top drivers
  const [yearNum, monthNum] = thisMonthStr.split('-').map(Number) as [number, number]
  const daysInMonth  = new Date(yearNum, monthNum, 0).getDate()
  const numWeeks     = Math.ceil(daysInMonth / 7)
  const weeklyRevenue = Array.from({ length: numWeeks }, (_, w) => {
    const startDay = w * 7 + 1
    const endDay   = Math.min(startDay + 6, daysInMonth)
    const total    = revRows.filter(r => {
      const day = parseInt(r.date.split('-')[2] ?? '0', 10)
      return day >= startDay && day <= endDay
    }).reduce((s, r) => s + (r.rate ?? 0), 0)
    return { label: `W${w + 1} (${monthLabel.split(' ')[0]} ${startDay}–${endDay})`, total }
  })

  const byDriver = revRows.reduce<Record<string, number>>((acc, r) => {
    const key = r.driver_name || 'Unknown'
    acc[key] = (acc[key] ?? 0) + (r.rate ?? 0)
    return acc
  }, {})
  const topDrivers = Object.entries(byDriver).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const cards = [
    { key: 'tickets'     as Panel, label: 'Tickets This Week',   value: thisWeekTickets.toString(), sub: <PctBadge value={ticketPct} period="week" />,    icon: Truck,     color: 'text-[var(--brand-primary)] bg-[var(--brand-primary)]/10' },
    { key: 'revenue'     as Panel, label: 'Revenue This Month',  value: fmt(thisMonthRev),          sub: <PctBadge value={revPct} period="month" />,       icon: TrendingUp, color: 'text-blue-600 bg-blue-100' },
    { key: 'outstanding' as Panel, label: 'Outstanding Balance', value: fmt(outstandingTotal),      sub: <span className="text-xs font-medium text-gray-400">{outstandingCount} invoice{outstandingCount !== 1 ? 's' : ''} unpaid</span>, icon: Receipt, color: outstandingTotal > 0 ? 'text-orange-500 bg-orange-100' : 'text-gray-400 bg-gray-100' },
    { key: 'dispatched'  as Panel, label: 'Dispatched Today',    value: dispatchedToday.toString(), sub: <span className="text-xs font-medium text-gray-400">active drivers out</span>, icon: Radio, color: dispatchedToday > 0 ? 'text-purple-600 bg-purple-100' : 'text-gray-400 bg-gray-100' },
  ]

  return (
    <>
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map(({ key, label, value, sub, icon: Icon, color }) => (
          <button
            key={label}
            onClick={() => setOpenPanel(key)}
            className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md hover:border-gray-200 transition-all text-left w-full relative group cursor-pointer"
          >
            <div className={`inline-flex rounded-lg p-2 mb-3 ${color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            <div className="mt-0.5">{sub}</div>
            <span className="absolute top-3 right-3 text-gray-300 group-hover:text-gray-400 transition-colors text-xs select-none" title="Click for details">ⓘ</span>
          </button>
        ))}
      </div>

      {/* ── Tickets This Week Panel ─────────────────────────────────────────── */}
      <StatDetailPanel
        isOpen={openPanel === 'tickets'}
        onClose={close}
        title={`Tickets This Week — ${thisWeekTickets}`}
      >
        <CalculationExplainer
          source="Loads (tickets) table"
          dateRange={`${weekStartLabel} → ${todayLabel}`}
          filter="All statuses included (pending, approved, invoiced, paid)"
        />
        {ticketLoading ? <Spinner /> : ticketRows.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No tickets this week</p>
        ) : (
          <div className="space-y-2">
            {ticketRows.map(t => (
              <div key={t.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{t.job_name}</p>
                  <p className="text-xs text-gray-500">{t.driver_name}{t.truck_number ? ` · #${t.truck_number}` : ''}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(t.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-gray-900">{t.total_pay != null ? fmt(t.total_pay) : t.rate != null ? fmt(t.rate) : '—'}</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ticketStatusColor[t.status] ?? 'bg-gray-100 text-gray-600'}`}>{t.status}</span>
                </div>
              </div>
            ))}
            <p className="text-xs text-gray-400 text-center pt-2">{ticketRows.length} ticket{ticketRows.length !== 1 ? 's' : ''} this week</p>
          </div>
        )}
        <div className="pt-4 border-t border-gray-100 mt-4">
          <Link href="/dashboard/tickets" onClick={close} className="text-sm font-semibold text-[var(--brand-primary)] hover:underline">View all tickets →</Link>
        </div>
      </StatDetailPanel>

      {/* ── Revenue This Month Panel ────────────────────────────────────────── */}
      <StatDetailPanel
        isOpen={openPanel === 'revenue'}
        onClose={close}
        title="Revenue This Month"
        subtitle={fmt(thisMonthRev)}
      >
        <CalculationExplainer
          source="Loads (tickets) table — Rate field"
          dateRange={`${monthLabel} · 1st → today`}
          filter="All ticket statuses included — no status filter applied"
          note={'Revenue = sum of the "Rate" field on every ticket this month. Does not yet factor in Total Pay values entered on individual tickets.'}
        />
        {revLoading ? <Spinner /> : (
          <>
            <div className="mb-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">By Week</p>
              <div className="space-y-2.5">
                {weeklyRevenue.map(w => (
                  <div key={w.label} className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">{w.label}</span>
                    <span className="text-sm font-semibold text-gray-900">{fmt(w.total)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="text-xs font-bold text-gray-700">Total</span>
                  <span className="text-sm font-bold text-gray-900">{fmt(thisMonthRev)}</span>
                </div>
              </div>
            </div>
            {topDrivers.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Top Drivers This Month</p>
                <div className="space-y-2">
                  {topDrivers.map(([name, rev]) => (
                    <div key={name} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{name}</span>
                      <span className="text-sm font-semibold text-gray-900">{fmt(rev)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-gray-400">{revRows.length} ticket{revRows.length !== 1 ? 's' : ''} this month</p>
          </>
        )}
        <div className="pt-4 border-t border-gray-100 mt-4">
          <Link href="/dashboard/revenue" onClick={close} className="text-sm font-semibold text-[var(--brand-primary)] hover:underline">View Revenue page →</Link>
        </div>
      </StatDetailPanel>

      {/* ── Outstanding Balance Panel ───────────────────────────────────────── */}
      <StatDetailPanel
        isOpen={openPanel === 'outstanding'}
        onClose={close}
        title="Outstanding Balance"
        subtitle={fmt(outstandingTotal)}
      >
        <CalculationExplainer
          source="Invoices table"
          dateRange="All time — no date filter"
          filter="Status: Draft, Sent, Overdue, Partially Paid"
          note="Paid and archived invoices are not included in this total."
        />
        {invLoading ? <Spinner /> : invRows.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No outstanding invoices</p>
        ) : (
          <div className="space-y-2">
            {invRows.map(inv => {
              const isOverdue = inv.status === 'overdue'
              return (
                <div key={inv.id} className={`p-3 rounded-lg border ${isOverdue ? 'border-red-200 bg-red-50/50' : 'border-gray-100'} transition-shadow hover:shadow-sm`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{inv.client_name}</p>
                      <p className="text-xs text-gray-500">#{inv.invoice_number}</p>
                      {inv.due_date && (
                        <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                          Due {new Date(inv.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {isOverdue ? ' — OVERDUE' : ''}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>{fmt(inv.total)}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${invStatusColor[inv.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {inv.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-sm font-semibold text-gray-700">Total outstanding</span>
              <span className="text-sm font-bold text-orange-600">{fmt(outstandingTotal)}</span>
            </div>
          </div>
        )}
        <div className="pt-4 border-t border-gray-100 mt-4">
          <Link href="/dashboard/invoices" onClick={close} className="text-sm font-semibold text-[var(--brand-primary)] hover:underline">View all invoices →</Link>
        </div>
      </StatDetailPanel>

      {/* ── Dispatched Today Panel ──────────────────────────────────────────── */}
      <StatDetailPanel
        isOpen={openPanel === 'dispatched'}
        onClose={close}
        title="Dispatched Today"
        subtitle={todayLabel}
      >
        <CalculationExplainer
          source="Dispatches table"
          dateRange={`Today — ${todayLabel}`}
          filter="Excludes completed and cancelled dispatches"
        />
        {dispLoading ? <Spinner /> : dispRows.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No active dispatches today</p>
        ) : (
          <div className="space-y-2">
            {dispRows.map(d => {
              const isWorking = d.status === 'working'
              return (
                <div key={d.id} className={`p-3 rounded-lg border ${isWorking ? 'border-green-200 bg-green-50/40' : 'border-gray-100'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{d.driver_name}</p>
                      <p className="text-xs text-gray-500">{d.jobs?.job_name ?? 'No job assigned'}{d.truck_number ? ` · Truck #${d.truck_number}` : ''}</p>
                      {d.start_time && <p className="text-xs text-gray-400">Start: {d.start_time}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${dispStatusColor[d.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {dispStatusLabel[d.status] ?? d.status}
                      </span>
                      {d.loads_completed > 0 && (
                        <p className="text-xs text-gray-500 mt-1">{d.loads_completed} load{d.loads_completed !== 1 ? 's' : ''}</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            <p className="text-xs text-gray-400 text-center pt-2">{dispRows.length} dispatch{dispRows.length !== 1 ? 'es' : ''} today</p>
          </div>
        )}
        <div className="pt-4 border-t border-gray-100 mt-4">
          <Link href="/dashboard/dispatch" onClick={close} className="text-sm font-semibold text-[var(--brand-primary)] hover:underline">Go to Dispatch →</Link>
        </div>
      </StatDetailPanel>
    </>
  )
}
