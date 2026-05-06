'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, X } from 'lucide-react'
import type { Load } from '@/lib/types'

type Props = {
  ticket: Load
  companyId: string
  onClose: () => void
  onSaved: () => void
}

export default function DriverModificationModal({ ticket, companyId, onClose, onSaved }: Props) {
  const [hours, setHours] = useState(ticket.hours_worked ?? '')
  const [rate, setRate] = useState(ticket.rate?.toString() ?? '')
  const [notes, setNotes] = useState(ticket.notes ?? '')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) { toast.error('Reason for modification is required'); return }
    setSaving(true)

    const supabase = createClient()
    const { error } = await supabase
      .from('loads')
      .update({
        hours_worked: hours || null,
        rate: rate ? parseFloat(rate) : ticket.rate,
        notes: notes || null,
        modification_reason: reason.trim(),
        original_hours: ticket.hours_worked,
        status: 'approved',
      })
      .eq('id', ticket.id)

    if (error) { toast.error('Failed to save: ' + error.message); setSaving(false); return }

    // Notify driver
    const { data: driverRow } = await supabase
      .from('drivers')
      .select('id')
      .eq('company_id', companyId)
      .eq('name', ticket.driver_name)
      .maybeSingle()

    if (driverRow) {
      const oldHours = ticket.hours_worked ?? '?'
      const newHours = hours || '?'
      const msg = `Your ticket for ${ticket.job_name} on ${ticket.date} was modified. Hours changed from ${oldHours} to ${newHours}. Reason: ${reason.trim()}`
      await supabase.from('driver_notifications').insert({
        driver_id: driverRow.id,
        company_id: companyId,
        load_id: ticket.id,
        type: 'modification',
        message: msg,
      })
    }

    toast.success('Ticket modified and driver notified')
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Modify Ticket</h2>
            <p className="text-xs text-gray-400 mt-0.5">{ticket.driver_name} · {ticket.job_name} · {ticket.date}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Hours Worked</label>
            <input
              type="number"
              step="0.25"
              min="0"
              value={hours}
              onChange={e => setHours(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20"
              placeholder="Hours"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Rate</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={rate}
              onChange={e => setRate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20"
              placeholder="Rate"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Reason for Modification <span className="text-red-400">*</span>
            </label>
            <textarea
              required
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20"
              placeholder="Explain why this ticket was modified…"
            />
            <p className="text-xs text-gray-400 mt-1">This will be shown to the driver.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-[var(--brand-primary)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Saving…' : 'Save & Notify Driver'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
