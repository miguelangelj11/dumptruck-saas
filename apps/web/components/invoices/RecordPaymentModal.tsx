'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Invoice } from '@/lib/types'

interface Props {
  isOpen: boolean
  onClose: () => void
  invoice: Invoice | null
  onSave: (updatedInvoice: Partial<Invoice> & { id: string }) => void
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function RecordPaymentModal({ isOpen, onClose, invoice, onSave }: Props) {
  const [amountPaid, setAmountPaid] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]!)
  const [paymentMethod, setPaymentMethod] = useState('check')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  if (!isOpen || !invoice) return null

  const invoiceTotal = invoice.total ?? 0
  const previouslyPaid = invoice.amount_paid ?? 0
  const remaining = invoiceTotal - previouslyPaid

  const enteredAmount = parseFloat(amountPaid) || 0
  const newTotalPaid = previouslyPaid + enteredAmount
  const newRemaining = invoiceTotal - newTotalPaid
  const isOverpaid = newTotalPaid > invoiceTotal + 0.01
  const overpaidBy = isOverpaid ? newTotalPaid - invoiceTotal : 0
  const isFullPay = !isOverpaid && newRemaining <= 0.01

  async function handleSave() {
    if (!amountPaid || enteredAmount <= 0) {
      toast.error('Enter an amount greater than $0')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/invoices/${invoice!.id}/record-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: enteredAmount,
          payment_date: paymentDate,
          payment_method: paymentMethod,
          notes,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to record payment')
        return
      }
      toast.success(
        data.new_status === 'paid' ? 'Invoice fully paid!' :
        data.new_status === 'overpaid' ? `Overpayment recorded — $${fmt(data.overpaid_amount)} over` :
        `Partial payment of $${fmt(enteredAmount)} recorded`
      )
      onSave({
        id: invoice!.id,
        status: data.new_status,
        amount_paid: data.amount_paid,
        amount_remaining: data.amount_remaining,
        overpaid_amount: data.overpaid_amount,
        ...(data.new_status === 'paid' ? { date_paid: paymentDate } : {}),
      })
      // Reset form
      setAmountPaid('')
      setPaymentDate(new Date().toISOString().split('T')[0]!)
      setPaymentMethod('check')
      setNotes('')
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Record Payment</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {invoice.invoice_number} · Total ${fmt(invoiceTotal)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Payment summary */}
          <div className="p-3 bg-gray-50 rounded-xl text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Invoice Total</span>
              <span className="font-semibold">${fmt(invoiceTotal)}</span>
            </div>
            {previouslyPaid > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Previously Paid</span>
                <span className="font-semibold text-green-600">-${fmt(previouslyPaid)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1.5 border-t border-gray-200 mt-1">
              <span className="font-semibold text-gray-700">Balance Due</span>
              <span className="font-bold text-amber-600">${fmt(remaining)}</span>
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Amount Received *
            </label>
            <div className="flex rounded-xl border border-gray-300 overflow-hidden focus-within:border-[var(--brand-primary)] focus-within:ring-2 focus-within:ring-[var(--brand-primary)]/20">
              <span className="px-3 py-2.5 bg-gray-50 text-gray-500 border-r border-gray-300 font-medium text-sm">$</span>
              <input
                type="number"
                value={amountPaid}
                onChange={e => setAmountPaid(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                autoFocus
                className="flex-1 px-3 py-2.5 text-base font-semibold outline-none bg-white"
              />
            </div>
            {/* Quick fill */}
            <div className="flex gap-2 mt-2 flex-wrap">
              <button
                type="button"
                onClick={() => setAmountPaid(remaining.toFixed(2))}
                className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-full font-medium hover:bg-green-200"
              >
                Full balance ${fmt(remaining)}
              </button>
              {remaining > 1 && (
                <button
                  type="button"
                  onClick={() => setAmountPaid((remaining / 2).toFixed(2))}
                  className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full font-medium hover:bg-gray-200"
                >
                  Half ${fmt(remaining / 2)}
                </button>
              )}
            </div>
          </div>

          {/* Live feedback */}
          {enteredAmount > 0 && (
            <div className={`p-3 rounded-xl text-sm ${
              isOverpaid
                ? 'bg-purple-50 border border-purple-200'
                : isFullPay
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-amber-50 border border-amber-200'
            }`}>
              {isOverpaid ? (
                <div className="text-purple-800 space-y-0.5">
                  <p className="font-bold">Overpayment Detected</p>
                  <p className="text-xs">Received: <strong>${fmt(newTotalPaid)}</strong> · Total: <strong>${fmt(invoiceTotal)}</strong></p>
                  <p className="font-semibold text-purple-600">Overpaid by ${fmt(overpaidBy)}</p>
                </div>
              ) : isFullPay ? (
                <div className="text-green-800 space-y-0.5">
                  <p className="font-bold">Invoice will be fully paid</p>
                  <p className="text-xs">Remaining balance: $0.00</p>
                </div>
              ) : (
                <div className="text-amber-800 space-y-0.5">
                  <p className="font-bold">Partial Payment</p>
                  <p className="text-xs">Paying <strong>${fmt(enteredAmount)}</strong> · Remaining after: <strong className="text-red-600">${fmt(newRemaining)}</strong></p>
                  <p className="text-xs text-amber-600">${fmt(newRemaining)} will be tracked as outstanding</p>
                </div>
              )}
            </div>
          )}

          {/* Date + Method */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Payment Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Method</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
              >
                <option value="check">Check</option>
                <option value="ach">ACH / Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="zelle">Zelle</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Check #, reference number, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 rounded-xl font-medium text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !amountPaid || enteredAmount <= 0}
              className={`flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 ${
                saving || !amountPaid || enteredAmount <= 0
                  ? 'bg-gray-300 cursor-not-allowed'
                  : isOverpaid
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'bg-[var(--brand-primary)] hover:opacity-90'
              }`}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isOverpaid ? 'Record Overpayment' : 'Record Payment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
