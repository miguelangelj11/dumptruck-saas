import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyDispatchToken } from '@/lib/dispatch-token'
import { checkForDuplicate, checkForAnomaly } from '@/lib/tickets/duplicate-detection'
import { logTicketAudit } from '@/lib/tickets/audit'

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

  const newLoadId = (load as Record<string, unknown>).id as string
  const companyId = d.company_id as string
  const driverName = (d.driver_name as string) ?? ''
  const tons = tonnage ? parseFloat(tonnage) : null

  // Duplicate detection (silent flag)
  const duplicate = await checkForDuplicate(admin, companyId, {
    driver_name: driverName,
    date: (d.dispatch_date as string) ?? new Date().toISOString().split('T')[0]!,
    job_name: (d.job_name as string) ?? '',
    total_pay: d.rate as number | null,
  })
  if (duplicate) {
    await admin.from('loads').update({ is_duplicate: true, duplicate_of_id: duplicate.id }).eq('id', newLoadId)
  }

  // Anomaly flagging (silent flag)
  const anomalyReason = await checkForAnomaly(admin, companyId, driverName, tons, d.rate as number | null)
  if (anomalyReason) {
    await admin.from('loads').update({ anomaly_flag: true, anomaly_reason: anomalyReason }).eq('id', newLoadId)
  }

  // Audit trail
  await logTicketAudit(admin, {
    companyId, loadId: newLoadId,
    action: 'created',
    userId: d.driver_id as string ?? '',
    userName: driverName,
    userType: 'driver',
    newValues: { job_name: d.job_name, driver_name: driverName, source: 'driver' },
  })

  // Flip dispatch to working if still dispatched
  if (d.status === 'dispatched' || d.status === 'accepted') {
    await admin.from('dispatches')
      .update({ status: 'working', updated_at: new Date().toISOString() })
      .eq('id', dispatchId)
  }

  return NextResponse.json({ ok: true, loadId: newLoadId })
}
