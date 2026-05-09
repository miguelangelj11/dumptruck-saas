'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, ChevronDown, ChevronUp, MapPin, DollarSign, Calendar, Building2, Phone, Mail, Package } from 'lucide-react'
import type { ReceivedDispatch } from '@/lib/types'

const STATUS_CFG = {
  pending:   { label: 'Pending',   color: 'bg-yellow-100 text-yellow-800'  },
  accepted:  { label: 'Accepted',  color: 'bg-blue-100 text-blue-800'     },
  declined:  { label: 'Declined',  color: 'bg-red-100 text-red-700'       },
  converted: { label: 'Converted', color: 'bg-green-100 text-green-700'   },
  expired:   { label: 'Expired',   color: 'bg-gray-100 text-gray-500'     },
}

function fmt(d: string | null) {
  if (!d) return null
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ReceivedDispatchCard({
  dispatch,
  onUpdate,
}: {
  dispatch: ReceivedDispatch
  onUpdate: (updated: ReceivedDispatch) => void
}) {
  const supabase = createClient()
  const [expanded, setExpanded] = useState(false)
  const [converting, setConverting] = useState(false)

  const cfg = STATUS_CFG[dispatch.status] ?? STATUS_CFG.pending

  async function handleConvert() {
    setConverting(true)
    try {
      // Create a new job from this dispatch
      const jobRes = await fetch('/api/jobs/from-dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ received_dispatch_id: dispatch.id }),
      })
      const data = await jobRes.json() as { error?: string; job_id?: string }
      if (!jobRes.ok) {
        toast.error(data.error ?? 'Failed to convert')
        return
      }
      toast.success('Job created from dispatch!')
      onUpdate({ ...dispatch, status: 'converted', converted_job_id: data.job_id ?? null, converted_at: new Date().toISOString() })
    } catch {
      toast.error('Network error')
    } finally {
      setConverting(false)
    }
  }

  async function handleDecline() {
    const { error } = await supabase
      .from('received_dispatches')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .eq('id', dispatch.id)
    if (error) { toast.error(error.message); return }
    toast.success('Dispatch declined')
    onUpdate({ ...dispatch, status: 'declined', responded_at: new Date().toISOString() })
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 text-base leading-tight">{dispatch.job_name}</h3>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
            </div>

            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
              {dispatch.sender_company_name && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Building2 className="h-3 w-3" />{dispatch.sender_company_name}
                </span>
              )}
              {dispatch.job_location && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <MapPin className="h-3 w-3" />{dispatch.job_location}
                </span>
              )}
              {dispatch.material && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Package className="h-3 w-3" />{dispatch.material}
                </span>
              )}
              {dispatch.rate != null && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <DollarSign className="h-3 w-3" />${dispatch.rate}/{dispatch.rate_type ?? 'load'}
                </span>
              )}
              {dispatch.start_date && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Calendar className="h-3 w-3" />{fmt(dispatch.start_date)}{dispatch.end_date ? ` – ${fmt(dispatch.end_date)}` : ''}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => setExpanded(e => !e)}
            className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 shrink-0"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Actions for pending */}
        {dispatch.status === 'pending' && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleConvert}
              disabled={converting}
              className="flex items-center gap-1.5 bg-[#1e3a2a] hover:bg-[#2d5a3d] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
            >
              {converting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Convert to Job
            </button>
            <button
              onClick={handleDecline}
              className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              Decline
            </button>
          </div>
        )}

        {dispatch.status === 'converted' && dispatch.converted_job_id && (
          <a
            href="/dashboard/dispatch"
            className="inline-flex items-center gap-1 mt-2 text-xs text-[#1e3a2a] font-medium hover:underline"
          >
            View job →
          </a>
        )}
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
          {/* Sender contact */}
          {(dispatch.sender_phone || dispatch.sender_email) && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Sender Contact</p>
              <div className="flex flex-wrap gap-3">
                {dispatch.sender_phone && (
                  <a href={`tel:${dispatch.sender_phone}`} className="flex items-center gap-1 text-xs text-[#1e3a2a] font-medium hover:underline">
                    <Phone className="h-3 w-3" />{dispatch.sender_phone}
                  </a>
                )}
                {dispatch.sender_email && (
                  <a href={`mailto:${dispatch.sender_email}`} className="flex items-center gap-1 text-xs text-[#1e3a2a] font-medium hover:underline">
                    <Mail className="h-3 w-3" />{dispatch.sender_email}
                  </a>
                )}
              </div>
            </div>
          )}

          {dispatch.notes && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{dispatch.notes}</p>
            </div>
          )}

          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Received</p>
            <p className="text-xs text-gray-500">{new Date(dispatch.created_at).toLocaleString()}</p>
          </div>
        </div>
      )}
    </div>
  )
}
