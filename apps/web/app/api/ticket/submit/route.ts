import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyDispatchToken } from '@/lib/dispatch-token'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_KEY ?? ''
  if (!url || !key) console.warn('[getAdmin] Missing SUPABASE env vars')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    dispatchId: string
    token: string
    customerName: string
    signature: string
    ticketNumber?: string
    tonnage?: string
    notes?: string
  }

  const { dispatchId, token, customerName, signature, ticketNumber, tonnage, notes } = body

  if (!dispatchId || !token || !customerName?.trim() || !signature) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!verifyDispatchToken(dispatchId, token)) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 403 })
  }

  const admin = getAdmin()

  const { data: dispatch, error: dispErr } = await admin
    .from('dispatches')
    .select('*')
    .eq('id', dispatchId)
    .maybeSingle()

  if (dispErr || !dispatch) {
    return NextResponse.json({ error: 'Dispatch not found' }, { status: 404 })
  }

  const d = dispatch as Record<string, unknown>

  const { data: load, error: loadErr } = await admin.from('loads').insert({
    company_id:        d.company_id,
    dispatch_id:       dispatchId,
    job_name:          d.job_name ?? '',
    driver_name:       d.driver_name ?? '',
    truck_number:      d.truck_number ?? null,
    date:              (d.dispatch_date as string) ?? new Date().toISOString().split('T')[0]!,
    rate:              d.rate ?? 0,
    rate_type:         d.rate_type ?? 'load',
    material:          d.material ?? null,
    status:            'pending',
    source:            'driver',
    submitted_by_driver: true,
    customer_name:     customerName.trim(),
    customer_signature: signature,
    signed_at:         new Date().toISOString(),
    notes:             notes?.trim() || null,
    ...(ticketNumber ? { ticket_number: ticketNumber } : {}),
    ...(tonnage ? { tonnage: parseFloat(tonnage) } : {}),
  }).select('id').single()

  if (loadErr) {
    console.error('[ticket/submit] insert error:', loadErr)
    return NextResponse.json({ error: loadErr.message }, { status: 500 })
  }

  // Flip dispatch to working if still dispatched
  if (d.status === 'dispatched' || d.status === 'accepted') {
    await admin.from('dispatches')
      .update({ status: 'working', updated_at: new Date().toISOString() })
      .eq('id', dispatchId)
  }

  return NextResponse.json({ ok: true, loadId: (load as Record<string, unknown>).id })
}
