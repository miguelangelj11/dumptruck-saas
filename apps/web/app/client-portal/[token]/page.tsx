'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { FileText, Loader2, CheckCircle, Clock, AlertCircle, Building2, Truck, CreditCard } from 'lucide-react'
import { toast } from 'sonner'

type Invoice = {
  id: string
  invoice_number: string | null
  invoice_date: string
  due_date: string | null
  total_amount: number
  status: string
  notes: string | null
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

const invoiceStatusCfg: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  paid:    { label: 'Paid',    color: 'bg-green-100 text-green-700',  icon: CheckCircle  },
  sent:    { label: 'Sent',    color: 'bg-blue-100 text-blue-700',    icon: Clock        },
  draft:   { label: 'Draft',   color: 'bg-gray-100 text-gray-600',    icon: FileText     },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700',      icon: AlertCircle  },
}

function ClientPortalContent({ params }: { params: { token: string } }) {
  const searchParams = useSearchParams()
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [data, setData]         = useState<{
    client: { id: string; name: string; address: string | null }
    company: { name: string }
    invoices: Invoice[]
    loads: Load[]
  } | null>(null)
  const [activeTab, setActiveTab] = useState<'invoices' | 'loads'>('invoices')

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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id:   invoiceId,
          portal_token: params.token,
          return_url:   window.location.href,
        }),
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1e3a2a] px-6 py-5 text-white">
        <p className="text-xs text-green-300 font-semibold uppercase tracking-wider mb-1">Client Portal</p>
        <h1 className="text-xl font-bold">{data.client.name}</h1>
        <p className="text-green-300 text-sm mt-0.5">Managed by {data.company.name}</p>
      </div>

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
              <p className="text-sm text-gray-400">No invoices yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.invoices.map(inv => {
                const cfg = invoiceStatusCfg[inv.status] ?? invoiceStatusCfg.draft!
                const Icon = cfg.icon
                const isUnpaid = inv.status !== 'paid'
                return (
                  <div key={inv.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {inv.invoice_number ? `#${inv.invoice_number}` : `Invoice`}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(inv.invoice_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {inv.due_date && ` · Due ${new Date(inv.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
                          <Icon className="h-3 w-3" />{cfg.label}
                        </span>
                        <p className="text-base font-bold text-gray-900">${inv.total_amount.toLocaleString()}</p>
                      </div>
                    </div>
                    {inv.notes && (
                      <p className="text-xs text-gray-500 mt-2 bg-gray-50 rounded-lg p-2">{inv.notes}</p>
                    )}
                    {isUnpaid && inv.status !== 'draft' && (
                      <div className="mt-3 pt-3 border-t border-gray-50">
                        <button
                          onClick={() => handlePayInvoice(inv.id)}
                          disabled={payingId === inv.id}
                          className="w-full rounded-xl bg-[#1e3a2a] text-white py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 active:opacity-80 transition-opacity"
                        >
                          {payingId === inv.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <CreditCard className="h-4 w-4" />}
                          {payingId === inv.id ? 'Redirecting…' : `Pay $${inv.total_amount.toLocaleString()}`}
                        </button>
                      </div>
                    )}
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
