import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { resolveCompanyId } from '@/lib/resolve-company'
import { sendPaymentReminder } from '@/lib/invoices/send-payment-reminder'

const MAX_REMINDERS = 3
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://dumptruckboss.com'

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdmin()
  const companyId = await resolveCompanyId(user.id, admin)
  if (!companyId) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  const { id: invoiceId } = await params

  // Fetch invoice — scoped to company
  const { data: inv } = await admin
    .from('invoices')
    .select('id, company_id, invoice_number, client_name, client_email, total, due_date, status, reminder_count, last_reminder_sent_at')
    .eq('id', invoiceId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (inv.status === 'paid') return NextResponse.json({ error: 'Invoice is already paid' }, { status: 400 })

  if ((inv.reminder_count ?? 0) >= MAX_REMINDERS) {
    return NextResponse.json(
      { error: `Maximum ${MAX_REMINDERS} reminders already sent for this invoice.` },
      { status: 400 },
    )
  }

  if (!inv.client_email) {
    return NextResponse.json({ error: 'No email address on file for this client' }, { status: 400 })
  }

  const daysOverdue = inv.due_date
    ? Math.max(0, Math.floor((Date.now() - new Date(inv.due_date + 'T00:00:00').getTime()) / 86_400_000))
    : 0

  // Build payment link using client company's portal token
  const { data: clientCo } = await admin
    .from('client_companies')
    .select('portal_token')
    .eq('company_id', companyId)
    .eq('name', inv.client_name)
    .maybeSingle()

  const paymentLink = clientCo?.portal_token
    ? `${APP_URL}/client-portal/${clientCo.portal_token}`
    : `${APP_URL}/client-portal`

  // Get company name for email sender line
  const { data: company } = await admin
    .from('companies')
    .select('name')
    .eq('id', companyId)
    .maybeSingle()

  const { sent, error: sendError } = await sendPaymentReminder({
    toEmail:       inv.client_email,
    toName:        inv.client_name,
    invoiceNumber: inv.invoice_number ?? invoiceId.slice(0, 8),
    amountDue:     inv.total ?? 0,
    dueDate:       inv.due_date ?? new Date().toISOString().split('T')[0]!,
    daysOverdue,
    paymentLink,
    companyName:   company?.name ?? 'Your Contractor',
  })

  if (!sent) {
    return NextResponse.json({ error: sendError ?? 'Failed to send reminder' }, { status: 500 })
  }

  const newCount = (inv.reminder_count ?? 0) + 1
  const now = new Date().toISOString()

  await admin
    .from('invoices')
    .update({ last_reminder_sent_at: now, reminder_count: newCount, updated_at: now })
    .eq('id', invoiceId)

  return NextResponse.json({ sent: true, reminder_count: newCount, last_reminder_sent_at: now })
}
