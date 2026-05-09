import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { amount, payment_date, payment_method, notes, payment_type } = body as {
    amount: number
    payment_date: string
    payment_method: string
    notes: string
    payment_type: string
  }

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 })
  }

  // Fetch invoice + company ownership check
  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .select('id, company_id, invoice_number, total, amount_paid, status')
    .eq('id', params.id)
    .single()

  if (invErr || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  // Verify ownership via companies table
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('id', invoice.company_id)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!company) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const previouslyPaid = invoice.amount_paid ?? 0
  const invoiceTotal = invoice.total ?? 0
  const newAmountPaid = previouslyPaid + amount
  const newRemaining = invoiceTotal - newAmountPaid
  const isOverpaid = newAmountPaid > invoiceTotal + 0.01
  const overpaidAmount = isOverpaid ? newAmountPaid - invoiceTotal : 0

  let resolvedType = payment_type
  let newStatus: string
  if (isOverpaid) {
    newStatus = 'overpaid'
    resolvedType = 'overpayment'
  } else if (newRemaining <= 0.01) {
    newStatus = 'paid'
    resolvedType = 'full'
  } else {
    newStatus = 'partially_paid'
    resolvedType = 'partial'
  }

  // Insert payment record
  const { error: pmtErr } = await supabase.from('payments').insert({
    company_id: invoice.company_id,
    invoice_id: params.id,
    amount,
    payment_date,
    payment_method: payment_method || null,
    notes: notes || null,
    payment_type: resolvedType,
  })
  if (pmtErr) {
    return NextResponse.json({ error: 'Failed to record payment: ' + pmtErr.message }, { status: 500 })
  }

  // Update invoice
  const { error: updErr } = await supabase.from('invoices').update({
    amount_paid: newAmountPaid,
    amount_remaining: Math.max(0, newRemaining),
    overpaid_amount: overpaidAmount,
    status: newStatus,
    payment_notes: notes || null,
    ...(newStatus === 'paid' ? { date_paid: payment_date } : {}),
  }).eq('id', params.id)

  if (updErr) {
    return NextResponse.json({ error: 'Failed to update invoice: ' + updErr.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    new_status: newStatus,
    amount_paid: newAmountPaid,
    amount_remaining: Math.max(0, newRemaining),
    overpaid_amount: overpaidAmount,
    payment_type: resolvedType,
  })
}
