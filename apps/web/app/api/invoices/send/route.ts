import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

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

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  const [y, m, day] = d.slice(0, 10).split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m!) - 1]} ${parseInt(day!)}, ${y}`
}

export async function POST(request: Request) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
  }

  const body = await request.json().catch(() => ({}))
  const { invoiceId, toEmail, subject, message } = body as {
    invoiceId?: string
    toEmail?: string
    subject?: string
    message?: string
  }

  if (!invoiceId || !toEmail || !subject) {
    return NextResponse.json({ error: 'invoiceId, toEmail, and subject are required' }, { status: 400 })
  }

  const admin = getAdmin()

  const { data: inv, error: invErr } = await admin
    .from('invoices')
    .select('*, invoice_line_items(*)')
    .eq('id', invoiceId)
    .single()

  if (invErr || !inv) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  // Load company info for sender name
  const { data: co } = await admin
    .from('companies')
    .select('name, address, phone')
    .eq('id', inv.company_id)
    .maybeSingle()

  const companyName: string = co?.name ?? 'Your Company'
  const lineItems: Record<string, unknown>[] = (inv.invoice_line_items ?? []).sort(
    (a: Record<string, unknown>, b: Record<string, unknown>) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0)
  )

  const isPaystub = inv.invoice_type === 'paystub'
  const total: number = inv.total ?? 0

  const lineItemsHtml = lineItems.map((item: Record<string, unknown>) => {
    const amount = Number(item.amount ?? 0)
    const qty = item.quantity != null ? String(item.quantity) : '—'
    const rate = item.rate != null ? `$${fmt(Number(item.rate))}/${item.rate_type ?? 'job'}` : '—'
    return `
      <tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:10px 8px;font-size:13px;color:#374151;">${fmtDate(item.line_date as string | null)}</td>
        <td style="padding:10px 8px;font-size:13px;color:#374151;">${item.truck_number ?? '—'}</td>
        <td style="padding:10px 8px;font-size:13px;color:#374151;">${item.driver_name ?? '—'}</td>
        <td style="padding:10px 8px;font-size:13px;color:#374151;">${item.material ?? '—'}</td>
        <td style="padding:10px 8px;font-size:13px;color:#374151;font-family:monospace;">${item.ticket_number ?? '—'}</td>
        <td style="padding:10px 8px;font-size:13px;color:#374151;text-align:right;">${qty}</td>
        <td style="padding:10px 8px;font-size:13px;color:#374151;text-align:right;">${rate}</td>
        <td style="padding:10px 8px;font-size:13px;font-weight:600;color:#111827;text-align:right;">$${fmt(amount)}</td>
      </tr>`
  }).join('')

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:700px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#1e3a2a;padding:28px 32px;">
      <p style="margin:0;font-size:11px;font-weight:700;color:#6ee7a8;letter-spacing:0.15em;text-transform:uppercase;">${inv.invoice_type === 'paystub' ? 'Driver Pay Invoice' : inv.invoice_type === 'contractor' ? 'Subcontractor Invoice' : 'Invoice'}</p>
      <p style="margin:4px 0 0;font-size:32px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">${inv.invoice_number}</p>
      <p style="margin:4px 0 0;font-size:13px;color:#86efac;">${companyName}</p>
    </div>

    <!-- Message -->
    ${message ? `
    <div style="padding:24px 32px;border-bottom:1px solid #f3f4f6;">
      <p style="margin:0;font-size:14px;color:#4b5563;line-height:1.6;white-space:pre-line;">${message.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
    </div>` : ''}

    <!-- Invoice Details -->
    <div style="padding:24px 32px;display:flex;justify-content:space-between;border-bottom:1px solid #f3f4f6;gap:24px;flex-wrap:wrap;">
      <div>
        <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:0.1em;text-transform:uppercase;">${isPaystub ? 'Pay To' : 'Bill To'}</p>
        <p style="margin:0;font-size:15px;font-weight:700;color:#111827;">${inv.client_name ?? '—'}</p>
        ${inv.client_email ? `<p style="margin:2px 0 0;font-size:13px;color:#6b7280;">${inv.client_email}</p>` : ''}
      </div>
      <div style="text-align:right;">
        <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:0.1em;text-transform:uppercase;">Invoice Details</p>
        <p style="margin:0;font-size:13px;color:#374151;"><strong>Invoice #:</strong> ${inv.invoice_number}</p>
        ${inv.date_from ? `<p style="margin:2px 0 0;font-size:13px;color:#374151;"><strong>Period:</strong> ${fmtDate(inv.date_from)} – ${fmtDate(inv.date_to)}</p>` : ''}
        ${inv.due_date ? `<p style="margin:2px 0 0;font-size:13px;color:#374151;"><strong>Due:</strong> ${fmtDate(inv.due_date)}</p>` : ''}
      </div>
    </div>

    <!-- Line Items -->
    <div style="padding:0 32px 8px;">
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">
        <thead>
          <tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb;">
            <th style="padding:10px 8px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Date</th>
            <th style="padding:10px 8px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Truck #</th>
            <th style="padding:10px 8px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Driver</th>
            <th style="padding:10px 8px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Material</th>
            <th style="padding:10px 8px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Ticket #</th>
            <th style="padding:10px 8px;text-align:right;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Qty</th>
            <th style="padding:10px 8px;text-align:right;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Rate</th>
            <th style="padding:10px 8px;text-align:right;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lineItemsHtml}
        </tbody>
      </table>
    </div>

    <!-- Total -->
    <div style="padding:20px 32px 28px;display:flex;justify-content:flex-end;">
      <div style="width:200px;border-top:2px solid #e5e7eb;padding-top:14px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;">
          <span style="font-size:14px;font-weight:700;color:#111827;">${isPaystub ? 'Net Pay' : 'Total Due'}</span>
          <span style="font-size:22px;font-weight:800;color:#2d7a4f;">$${fmt(total)}</span>
        </div>
      </div>
    </div>

    ${inv.notes ? `
    <div style="padding:16px 32px 24px;border-top:1px solid #f3f4f6;">
      <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;">Notes</p>
      <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;white-space:pre-line;">${String(inv.notes).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
    </div>` : ''}

    <!-- Footer -->
    <div style="background:#f9fafb;padding:20px 32px;border-top:1px solid #f3f4f6;text-align:center;">
      <p style="margin:0;font-size:13px;font-weight:600;color:#374151;">Thank you for your business!</p>
      <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">Powered by DumpTruckBoss</p>
    </div>
  </div>
</body>
</html>`

  const resend = new Resend(resendKey)
  const { error: sendErr } = await resend.emails.send({
    from: 'DumpTruckBoss <invoices@dumptruckboss.com>',
    to: toEmail,
    subject,
    html,
  })

  if (sendErr) {
    return NextResponse.json({ error: (sendErr as { message?: string }).message ?? 'Send failed' }, { status: 500 })
  }

  // Mark invoice as sent
  await admin.from('invoices').update({ status: 'sent' }).eq('id', invoiceId)

  return NextResponse.json({ ok: true })
}
