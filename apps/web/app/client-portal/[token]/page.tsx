'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  FileText, Loader2, CheckCircle, Clock, AlertCircle, Building2,
  Truck, CreditCard, ArrowLeft, Download,
} from 'lucide-react'
import { toast } from 'sonner'

type LineItem = {
  id: string
  line_date: string | null
  truck_number: string | null
  driver_name: string | null
  material: string | null
  ticket_number: string | null
  quantity: number | null
  rate: number | null
  rate_type: string | null
  amount: number | null
  job_name: string | null
  sort_order: number | null
}

type Invoice = {
  id: string
  invoice_number: string | null
  invoice_date: string
  due_date: string | null
  total_amount: number
  status: string
  notes: string | null
  invoice_line_items: LineItem[]
}

type Load = {
  id: string
  date: string
  job_name: string
  driver_name: string
  status: string
  rate: number | null
  rate_type: string | null
}

const statusCfg: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  paid:    { label: 'Paid',    color: 'bg-green-100 text-green-700',  icon: CheckCircle },
  sent:    { label: 'Sent',    color: 'bg-yellow-100 text-yellow-700', icon: Clock       },
  draft:   { label: 'Draft',   color: 'bg-gray-100 text-gray-600',    icon: FileText    },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700',      icon: AlertCircle },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusCfg[status] ?? statusCfg.draft!
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${cfg.color}`}>
      <Icon className="h-3 w-3" />{cfg.label}
    </span>
  )
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function buildJobSummary(items: LineItem[]) {
  const map = new Map<string, {
    name: string; materials: Set<string>
    minDate: string | null; maxDate: string | null; loads: number
  }>()
  for (const item of items) {
    const key   = item.job_name ?? 'Unnamed Job'
    const entry = map.get(key) ?? { name: key, materials: new Set<string>(), minDate: null, maxDate: null, loads: 0 }
    if (item.line_date) {
      if (!entry.minDate || item.line_date < entry.minDate) entry.minDate = item.line_date
      if (!entry.maxDate || item.line_date > entry.maxDate) entry.maxDate = item.line_date
    }
    if (item.material) entry.materials.add(item.material)
    entry.loads++
    map.set(key, entry)
  }
  return [...map.values()].sort((a, b) => b.loads - a.loads)
}

function TrustHeader({
  company, client,
}: {
  company: { name: string; logo_url: string | null }
  client: { name: string }
}) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 py-4 print:hidden">
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        {company.logo_url && (
          <img
            src={company.logo_url}
            alt={company.name}
            className="h-10 w-10 object-contain rounded shrink-0"
          />
        )}
        <div className="min-w-0">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Invoice from</p>
          <h1 className="text-lg font-bold text-gray-900 truncate">{company.name}</h1>
          <p className="text-xs text-gray-400 truncate">for {client.name}</p>
        </div>
      </div>
    </header>
  )
}

function ClientPortalContent({ params }: { params: { token: string } }) {
  const searchParams = useSearchParams()

  const [loading,            setLoading]            = useState(true)
  const [notFound,           setNotFound]           = useState(false)
  const [payingId,           setPayingId]           = useState<string | null>(null)
  const [selectedInvoiceId,  setSelectedInvoiceId]  = useState<string | null>(null)
  const [activeTab,          setActiveTab]          = useState<'invoices' | 'loads'>('invoices')
  const [data, setData] = useState<{
    client:   { id: string; name: string; address: string | null }
    company:  { name: string; logo_url: string | null }
    invoices: Invoice[]
    loads:    Load[]
  } | null>(null)

  useEffect(() => {
    fetch(`/api/public/client-portal?token=${encodeURIComponent(params.token)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setNotFound(true); setLoading(false); return }
        setData(d)
        setLoading(false)
        if (searchParams.get('paid')) toast.success('Payment received! Invoice marked as paid.')
      })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [params.token])

  async function handlePayInvoice(invoiceId: string) {
    setPayingId(invoiceId)
    try {
      const res  = await fetch('/api/public/invoice-checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ invoice_id: invoiceId, portal_token: params.token, return_url: window.location.href }),
      })
      const json = await res.json() as { url?: string; error?: string }
      if (!res.ok || !json.url) { toast.error(json.error ?? 'Could not start checkout'); setPayingId(null); return }
      window.location.href = json.url
    } catch {
      toast.error('Something went wrong')
      setPayingId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[#1e3a2a]" />
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Portal Not Found</h1>
          <p className="text-gray-500 text-sm">This portal link is invalid or has expired. Contact your contractor for a new link.</p>
        </div>
      </div>
    )
  }

  const totalOwed = data.invoices
    .filter(i => i.status !== 'paid')
    .reduce((s, i) => s + i.total_amount, 0)

  const totalPaid = data.invoices
    .filter(i => i.status === 'paid')
    .reduce((s, i) => s + i.total_amount, 0)

  const selectedInvoice = selectedInvoiceId
    ? (data.invoices.find(i => i.id === selectedInvoiceId) ?? null)
    : null

  // ── INVOICE DETAIL VIEW ──────────────────────────────────────────────────
  if (selectedInvoice) {
    const isOverdue = selectedInvoice.status === 'overdue'
    const isUnpaid  = selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'draft'
    const daysOverdue = isOverdue && selectedInvoice.due_date
      ? Math.max(0, Math.floor((Date.now() - new Date(selectedInvoice.due_date + 'T00:00:00').getTime()) / 86_400_000))
      : 0
    const lineItems  = (selectedInvoice.invoice_line_items ?? [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const jobSummary = buildJobSummary(lineItems)

    return (
      <div className="min-h-screen bg-gray-50">
        <TrustHeader company={data.company} client={data.client} />

        {/* Back + PDF bar */}
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-2 flex items-center justify-between print:hidden">
          <button
            onClick={() => setSelectedInvoiceId(null)}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors h-10 -ml-1 px-1"
          >
            <ArrowLeft className="h-4 w-4" />
            All Invoices
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 h-10"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
        </div>

        {/* Content — pb-28 leaves room for sticky pay bar on mobile */}
        <div className="max-w-2xl mx-auto px-4 pb-28 space-y-4">

          {/* Overdue banner */}
          {isOverdue && (
            <div className="bg-red-50 border border-red-300 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                <p className="font-bold text-red-800">Payment Overdue</p>
              </div>
              <p className="text-sm text-red-700">
                This invoice was due on {fmtDate(selectedInvoice.due_date)}.
                {daysOverdue > 0 && ` (${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} ago)`}
                {' '}Please arrange payment as soon as possible.
              </p>
            </div>
          )}

          {/* Invoice meta card */}
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                {selectedInvoice.invoice_number ? `Invoice #${selectedInvoice.invoice_number}` : 'Invoice'}
              </h2>
              <StatusBadge status={selectedInvoice.status} />
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-500">Invoice Date</p>
                <p className="text-sm font-semibold mt-0.5">{fmtDate(selectedInvoice.invoice_date)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Due Date</p>
                <p className={`text-sm font-semibold mt-0.5 ${isOverdue ? 'text-red-600' : ''}`}>
                  {selectedInvoice.due_date ? fmtDate(selectedInvoice.due_date) : 'On receipt'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Amount Due</p>
                <p className="text-xl font-bold text-gray-900 mt-0.5">
                  ${selectedInvoice.total_amount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Bill To</p>
                <p className="text-sm font-semibold mt-0.5">{data.client.name}</p>
              </div>
            </div>

            {selectedInvoice.notes && (
              <div className="mt-4 pt-4 border-t border-gray-50">
                <p className="text-xs text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-700">{selectedInvoice.notes}</p>
              </div>
            )}

            {/* Desktop Pay Now (hidden on mobile — shown in sticky bar) */}
            {isUnpaid && (
              <div className="mt-4 pt-4 border-t border-gray-50 hidden md:block print:hidden">
                <button
                  onClick={() => handlePayInvoice(selectedInvoice.id)}
                  disabled={payingId === selectedInvoice.id}
                  className={`w-full h-12 rounded-xl font-bold text-white text-base flex items-center justify-center gap-2 disabled:opacity-60 transition-colors ${
                    isOverdue ? 'bg-red-600 hover:bg-red-700' : 'bg-[#2d6a4f] hover:bg-[#245c43]'
                  }`}
                >
                  {payingId === selectedInvoice.id
                    ? <Loader2 className="h-5 w-5 animate-spin" />
                    : <CreditCard className="h-5 w-5" />}
                  {payingId === selectedInvoice.id
                    ? 'Redirecting…'
                    : isOverdue ? '⚠️ Pay Overdue Invoice' : '💳 Pay Now'}
                </button>
              </div>
            )}
          </div>

          {/* Job summary */}
          {jobSummary.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <h3 className="font-semibold text-gray-700 mb-3">Job Summary</h3>
              <div className="space-y-3">
                {jobSummary.map(job => (
                  <div key={job.name} className="flex justify-between items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">{job.name}</p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {[...job.materials].join(', ') || '—'}
                        {job.minDate && (
                          <>
                            {' · '}
                            {fmtDateShort(job.minDate)}
                            {job.minDate !== job.maxDate && ` – ${fmtDateShort(job.maxDate)}`}
                          </>
                        )}
                      </p>
                    </div>
                    <p className="text-sm text-gray-600 shrink-0 font-medium">
                      {job.loads} load{job.loads !== 1 ? 's' : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Load details */}
          {lineItems.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <h3 className="font-semibold text-gray-700 mb-3">Load Details</h3>
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full text-sm min-w-[320px]">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-gray-100">
                      <th className="text-left pb-2 pr-3 font-medium">Date</th>
                      <th className="text-left pb-2 pr-3 font-medium">Truck #</th>
                      <th className="text-left pb-2 pr-3 font-medium">Material</th>
                      <th className="text-right pb-2 font-medium">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.slice(0, 5).map(item => (
                      <tr key={item.id} className="border-b border-gray-50">
                        <td className="py-2 pr-3 text-gray-700">{fmtDateShort(item.line_date)}</td>
                        <td className="py-2 pr-3 text-gray-700">{item.truck_number || '—'}</td>
                        <td className="py-2 pr-3 text-gray-700">{item.material || '—'}</td>
                        <td className="py-2 text-right text-gray-700">{item.quantity ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {lineItems.length > 5 && (
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    +{lineItems.length - 5} more load{lineItems.length - 5 !== 1 ? 's' : ''} in full invoice
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mobile sticky Pay Now */}
        {isUnpaid && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 md:hidden z-50 print:hidden">
            <button
              onClick={() => handlePayInvoice(selectedInvoice.id)}
              disabled={payingId === selectedInvoice.id}
              className={`w-full h-14 rounded-xl font-bold text-white text-lg flex items-center justify-center gap-2 disabled:opacity-60 transition-colors ${
                isOverdue ? 'bg-red-600 hover:bg-red-700' : 'bg-[#2d6a4f] hover:bg-[#245c43]'
              }`}
            >
              {payingId === selectedInvoice.id
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : <CreditCard className="h-5 w-5" />}
              {payingId === selectedInvoice.id
                ? 'Redirecting…'
                : isOverdue
                  ? `⚠️ Pay Overdue — $${selectedInvoice.total_amount.toLocaleString()}`
                  : `💳 Pay $${selectedInvoice.total_amount.toLocaleString()}`}
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── LIST VIEW ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <TrustHeader company={data.company} client={data.client} />

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{data.invoices.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Invoices</p>
          </div>
          <div className={`rounded-xl border p-4 text-center ${totalOwed > 0 ? 'bg-amber-50 border-amber-100' : 'bg-white border-gray-100'}`}>
            <p className={`text-2xl font-bold ${totalOwed > 0 ? 'text-amber-700' : 'text-gray-900'}`}>
              ${totalOwed.toLocaleString()}
            </p>
            <p className={`text-xs mt-0.5 ${totalOwed > 0 ? 'text-amber-600' : 'text-gray-500'}`}>Balance Due</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-green-700">${totalPaid.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total Paid</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {([
            ['invoices', 'Invoices', data.invoices.length],
            ['loads',    'Loads',    data.loads.length],
          ] as [string, string, number][]).map(([tab, label, count]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as 'invoices' | 'loads')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              {label}
              {count > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[1rem] px-1 text-[10px] font-bold bg-[#2d7a4f] text-white rounded-full">
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Invoices tab */}
        {activeTab === 'invoices' && (
          data.invoices.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
              <FileText className="h-10 w-10 mx-auto mb-3 text-gray-200" />
              <p className="text-lg text-gray-400">📄 No invoices yet</p>
              <p className="text-sm text-gray-400 mt-1">Invoices will appear here when created</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.invoices.map(inv => {
                const isUnpaid  = inv.status !== 'paid'
                const isOverdue = inv.status === 'overdue'
                const daysOverdue = isOverdue && inv.due_date
                  ? Math.max(0, Math.floor((Date.now() - new Date(inv.due_date + 'T00:00:00').getTime()) / 86_400_000))
                  : 0
                const fmtDue = inv.due_date
                  ? new Date(inv.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                  : null

                return (
                  <div
                    key={inv.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedInvoiceId(inv.id)}
                    onKeyDown={e => e.key === 'Enter' && setSelectedInvoiceId(inv.id)}
                    className={`bg-white rounded-2xl border p-4 cursor-pointer hover:bg-gray-50 transition-colors ${isOverdue ? 'border-red-200' : 'border-gray-100'}`}
                  >
                    {/* Overdue banner */}
                    {isOverdue && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                          <p className="font-bold text-red-800 text-sm">This invoice is overdue</p>
                        </div>
                        {fmtDue && (
                          <p className="text-xs text-red-700 mb-2">
                            Payment was due on {fmtDue}
                            {daysOverdue > 0 ? ` — ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} ago` : ''}.
                            Please arrange payment as soon as possible.
                          </p>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); handlePayInvoice(inv.id) }}
                          disabled={payingId === inv.id}
                          className="w-full rounded-lg bg-red-600 hover:bg-red-700 text-white h-11 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition-colors"
                        >
                          {payingId === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                          {payingId === inv.id ? 'Redirecting…' : `Pay Now — $${inv.total_amount.toLocaleString()}`}
                        </button>
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {inv.invoice_number ? `#${inv.invoice_number}` : 'Invoice'}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(inv.invoice_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {inv.due_date && ` · Due ${new Date(inv.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <StatusBadge status={inv.status} />
                        <p className="text-base font-bold text-gray-900">${inv.total_amount.toLocaleString()}</p>
                      </div>
                    </div>

                    {inv.notes && (
                      <p className="text-xs text-gray-500 mt-2 bg-gray-50 rounded-lg p-2">{inv.notes}</p>
                    )}

                    {isUnpaid && inv.status !== 'draft' && !isOverdue && (
                      <div className="mt-3 pt-3 border-t border-gray-50">
                        <button
                          onClick={e => { e.stopPropagation(); handlePayInvoice(inv.id) }}
                          disabled={payingId === inv.id}
                          className="w-full rounded-xl bg-[#1e3a2a] text-white h-11 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 active:opacity-80 transition-opacity"
                        >
                          {payingId === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                          {payingId === inv.id ? 'Redirecting…' : `Pay $${inv.total_amount.toLocaleString()}`}
                        </button>
                      </div>
                    )}

                    {/* View details hint */}
                    <p className="text-xs text-gray-400 mt-2 text-right">Tap to view details →</p>
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* Loads tab */}
        {activeTab === 'loads' && (
          data.loads.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
              <Truck className="h-10 w-10 mx-auto mb-3 text-gray-200" />
              <p className="text-sm text-gray-400">No loads recorded</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="divide-y divide-gray-50">
                {data.loads.map(load => (
                  <div key={load.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{load.job_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(load.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {load.driver_name ? ` · ${load.driver_name}` : ''}
                      </p>
                    </div>
                    {load.rate != null && (
                      <p className="text-sm font-semibold text-gray-700">
                        ${load.rate}/{load.rate_type ?? 'load'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        <p className="text-center text-xs text-gray-300 pb-4">Powered by DumpTruckBoss</p>
      </div>
    </div>
  )
}

export default function ClientPortalPage({ params }: { params: { token: string } }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[#1e3a2a]" />
      </div>
    }>
      <ClientPortalContent params={params} />
    </Suspense>
  )
}
