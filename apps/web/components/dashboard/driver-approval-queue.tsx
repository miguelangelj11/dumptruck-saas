'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Check, X, Pencil, Clock, Loader2 } from 'lucide-react'
import type { Load } from '@/lib/types'
import DriverModificationModal from './driver-modification-modal'

export default function DriverApprovalQueue({ companyId }: { companyId: string }) {
  const [tickets, setTickets] = useState<Load[]>([])
  const [loading, setLoading] = useState(true)
  const [modifyTicket, setModifyTicket] = useState<Load | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  const fetchTickets = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('loads')
      .select('*')
      .eq('company_id', companyId)
      .eq('submitted_by_driver', true)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setTickets((data ?? []) as Load[])
    setLoading(false)
  }, [companyId])

  useEffect(() => { fetchTickets() }, [fetchTickets])

  async function handleApprove(ticket: Load) {
    setActionId(ticket.id)
    const supabase = createClient()
    const { error } = await supabase.from('loads').update({ status: 'approved' }).eq('id', ticket.id)
    if (error) { toast.error('Failed to approve'); setActionId(null); return }

    // Notify driver
    const { data: driverRow } = await supabase
      .from('drivers')
      .select('id')
      .eq('company_id', companyId)
      .eq('name', ticket.driver_name)
      .maybeSingle()
    if (driverRow) {
      await supabase.from('driver_notifications').insert({
        driver_id: driverRow.id,
        company_id: companyId,
        load_id: ticket.id,
        type: 'approval',
        message: `Your ticket for ${ticket.job_name} on ${ticket.date} was approved.`,
      })
    }

    toast.success('Ticket approved')
    setActionId(null)
    fetchTickets()
  }

  async function handleReject(ticket: Load) {
    setActionId(ticket.id)
    const supabase = createClient()
    const { error } = await supabase.from('loads').update({ status: 'disputed' }).eq('id', ticket.id)
    if (error) { toast.error('Failed to reject'); setActionId(null); return }

    const { data: driverRow } = await supabase
      .from('drivers')
      .select('id')
      .eq('company_id', companyId)
      .eq('name', ticket.driver_name)
      .maybeSingle()
    if (driverRow) {
      await supabase.from('driver_notifications').insert({
        driver_id: driverRow.id,
        company_id: companyId,
        load_id: ticket.id,
        type: 'rejection',
        message: `Your ticket for ${ticket.job_name} on ${ticket.date} was returned. Please check with your manager.`,
      })
    }

    toast.success('Ticket returned to driver')
    setActionId(null)
    fetchTickets()
  }

  if (loading) return null
  if (!tickets.length) return null

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <Clock className="h-4 w-4 text-yellow-500" />
          <h2 className="font-semibold text-sm text-gray-900">
            Driver Tickets Pending Approval
            <span className="ml-2 rounded-full bg-yellow-100 text-yellow-700 px-2 py-0.5 text-xs font-bold">{tickets.length}</span>
          </h2>
        </div>
        <div className="divide-y divide-gray-50">
          {tickets.map(ticket => (
            <div key={ticket.id} className="px-6 py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{ticket.driver_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {ticket.job_name} · {ticket.date}
                  {ticket.hours_worked ? ` · ${ticket.hours_worked}h` : ''}
                </p>
                {ticket.image_url && (
                  <a href={ticket.image_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline mt-0.5 inline-block">View photo</a>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleApprove(ticket)}
                  disabled={actionId === ticket.id}
                  className="h-8 w-8 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 flex items-center justify-center transition-colors disabled:opacity-40"
                  title="Approve"
                >
                  {actionId === ticket.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => setModifyTicket(ticket)}
                  disabled={actionId === ticket.id}
                  className="h-8 w-8 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 flex items-center justify-center transition-colors disabled:opacity-40"
                  title="Modify"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleReject(ticket)}
                  disabled={actionId === ticket.id}
                  className="h-8 w-8 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 flex items-center justify-center transition-colors disabled:opacity-40"
                  title="Reject"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {modifyTicket && (
        <DriverModificationModal
          ticket={modifyTicket}
          companyId={companyId}
          onClose={() => setModifyTicket(null)}
          onSaved={() => { setModifyTicket(null); fetchTickets() }}
        />
      )}
    </>
  )
}
