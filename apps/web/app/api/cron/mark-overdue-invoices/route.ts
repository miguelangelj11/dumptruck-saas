import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPaymentReminder } from '@/lib/invoices/send-payment-reminder'

export const runtime = 'nodejs'
export const maxDuration = 60

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://dumptruckboss.com'

export async function GET(request: Request) {
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const today = new Date().toISOString().split('T')[0]!

  // Mark sent + partially_paid invoices with passed due dates as overdue
  const { data: marked, error: markErr } = await admin
    .from('invoices')
    .update({ status: 'overdue' })
    .in('status', ['sent', 'partially_paid'])
    .not('due_date', 'is', null)
    .lt('due_date', today)
    .select('id')

  if (markErr) {
    console.error('[cron/mark-overdue-invoices] mark error:', markErr)
    return NextResponse.json({ error: markErr.message }, { status: 500 })
  }

  console.log(`[cron/mark-overdue-invoices] marked ${marked?.length ?? 0} invoices overdue`)

  // Auto-reminder pass: find overdue invoices for companies with auto_send_reminders = true
  // Triggers on day 1 and day 3 overdue, max 2 auto reminders per invoice
  const { data: overdueInvs } = await admin
    .from('invoices')
    .select(`
      id, company_id, invoice_number, client_name, client_email,
      total, due_date, reminder_count, last_reminder_sent_at,
      companies!inner(name, auto_send_reminders)
    `)
    .eq('status', 'overdue')
    .not('due_date', 'is', null)
    .lt('reminder_count', 2)

  let autoSent = 0
  let autoSkipped = 0

  for (const inv of (overdueInvs ?? [])) {
    const co = (inv.companies as unknown) as { name: string; auto_send_reminders: boolean } | null
    if (!co?.auto_send_reminders) { autoSkipped++; continue }
    if (!inv.client_email)        { autoSkipped++; continue }

    const daysOverdue = Math.floor(
      (Date.now() - new Date(inv.due_date + 'T00:00:00').getTime()) / 86_400_000
    )

    // Only send on day 1 (first reminder) or day 3 (second reminder)
    const shouldSend = (daysOverdue === 1 && (inv.reminder_count ?? 0) === 0)
      || (daysOverdue === 3 && (inv.reminder_count ?? 0) <= 1)
    if (!shouldSend) { autoSkipped++; continue }

    // Don't double-send on same calendar day
    if (inv.last_reminder_sent_at) {
      const lastDate = new Date(inv.last_reminder_sent_at).toISOString().split('T')[0]
      if (lastDate === today) { autoSkipped++; continue }
    }

    const { data: clientCo } = await admin
      .from('client_companies')
      .select('portal_token')
      .eq('company_id', inv.company_id)
      .eq('name', inv.client_name)
      .maybeSingle()

    const paymentLink = clientCo?.portal_token
      ? `${APP_URL}/client-portal/${clientCo.portal_token}`
      : `${APP_URL}/client-portal`

    const { sent } = await sendPaymentReminder({
      toEmail:       inv.client_email,
      toName:        inv.client_name,
      invoiceNumber: inv.invoice_number ?? inv.id.slice(0, 8),
      amountDue:     inv.total ?? 0,
      dueDate:       inv.due_date,
      daysOverdue,
      paymentLink,
      companyName:   co.name,
    })

    if (sent) {
      await admin
        .from('invoices')
        .update({
          reminder_count:        (inv.reminder_count ?? 0) + 1,
          last_reminder_sent_at: new Date().toISOString(),
        })
        .eq('id', inv.id)
      autoSent++
    } else {
      autoSkipped++
    }
  }

  console.log(`[cron/mark-overdue-invoices] auto-reminders: ${autoSent} sent, ${autoSkipped} skipped`)

  return NextResponse.json({
    ok: true,
    updated:           marked?.length ?? 0,
    reminders_sent:    autoSent,
    reminders_skipped: autoSkipped,
  })
}
