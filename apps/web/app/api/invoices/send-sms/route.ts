import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export async function POST(request: Request) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const fromPhone  = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !fromPhone) {
    return NextResponse.json(
      { error: 'SMS not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to your environment variables.' },
      { status: 500 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const { invoiceId, toPhone, message } = body as {
    invoiceId?: string
    toPhone?: string
    message?: string
  }

  if (!invoiceId || !toPhone) {
    return NextResponse.json({ error: 'invoiceId and toPhone are required' }, { status: 400 })
  }

  const admin = getAdmin()

  const { data: inv, error: invErr } = await admin
    .from('invoices')
    .select('invoice_number, total, client_name')
    .eq('id', invoiceId)
    .single()

  if (invErr || !inv) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  const { data: co } = await admin
    .from('companies')
    .select('name')
    .eq('id', (inv as { company_id?: string }).company_id ?? '')
    .maybeSingle()

  const smsBody = message?.trim() || [
    `Hi ${inv.client_name ?? 'there'},`,
    ``,
    `You have a new invoice ${inv.invoice_number} for $${fmt(inv.total ?? 0)} from ${co?.name ?? 'your contractor'}.`,
    ``,
    `Please contact us to arrange payment. Thank you!`,
  ].join('\n')

  // Twilio REST API — no SDK needed
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const params = new URLSearchParams({
    From: fromPhone,
    To: toPhone,
    Body: smsBody,
  })

  const res = await fetch(twilioUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
    },
    body: params.toString(),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return NextResponse.json(
      { error: (err as { message?: string }).message ?? 'Failed to send SMS' },
      { status: 500 },
    )
  }

  await admin.from('invoices').update({ status: 'sent' }).eq('id', invoiceId)

  return NextResponse.json({ ok: true })
}
