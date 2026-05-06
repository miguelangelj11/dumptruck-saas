import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { resolveCompanyId } from '@/lib/resolve-company'
import { sendMissingTicketEmail } from '@/lib/follow-up/send-missing-ticket-email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://dumptruckboss.com'
const SIX_HOURS_MS = 6 * 60 * 60 * 1000
const MAX_FOLLOWUPS = 2

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

  const { id: dispatchId } = await params

  // Verify dispatch belongs to this company
  const { data: dispatch } = await admin
    .from('dispatches')
    .select('id, company_id, driver_id, driver_name, dispatch_date, loads_completed, followup_count, last_followup_sent_at, jobs(job_name)')
    .eq('id', dispatchId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!dispatch) return NextResponse.json({ error: 'Dispatch not found' }, { status: 404 })

  // Dedup gate: refuse if sent within last 6 hours
  if (dispatch.last_followup_sent_at) {
    const lastSent = new Date(dispatch.last_followup_sent_at).getTime()
    if (Date.now() - lastSent < SIX_HOURS_MS) {
      const minAgo = Math.round((Date.now() - lastSent) / 60_000)
      return NextResponse.json(
        { error: `Follow-up already sent ${minAgo} minutes ago. Wait 6 hours between reminders.` },
        { status: 429 },
      )
    }
  }

  if ((dispatch.followup_count ?? 0) >= MAX_FOLLOWUPS) {
    return NextResponse.json(
      { error: 'Maximum follow-ups (2) already sent for this dispatch.' },
      { status: 400 },
    )
  }

  // Get driver email
  if (!dispatch.driver_id) {
    return NextResponse.json({ error: 'No driver assigned to this dispatch' }, { status: 400 })
  }

  const { data: driver } = await admin
    .from('drivers')
    .select('email')
    .eq('id', dispatch.driver_id)
    .maybeSingle()

  if (!driver?.email) {
    return NextResponse.json({ error: 'Driver has no email address on file' }, { status: 400 })
  }

  const job     = dispatch.jobs as { job_name?: string } | null
  const jobName = job?.job_name ?? 'your job'
  const isUrgent = (dispatch.followup_count ?? 0) >= 1

  const { sent, error: sendError } = await sendMissingTicketEmail({
    driverEmail:  driver.email,
    driverName:   dispatch.driver_name,
    jobName,
    dispatchDate: dispatch.dispatch_date,
    submitLink:   `${APP_URL}/driver`,
    isUrgent,
  })

  if (!sent) {
    return NextResponse.json({ error: sendError ?? 'Failed to send email' }, { status: 500 })
  }

  const newCount = (dispatch.followup_count ?? 0) + 1
  const now = new Date().toISOString()

  await Promise.all([
    admin
      .from('dispatches')
      .update({ last_followup_sent_at: now, followup_count: newCount, updated_at: now })
      .eq('id', dispatchId),

    admin.from('driver_notifications').insert({
      driver_id:  dispatch.driver_id,
      company_id: companyId,
      type:       'missing_ticket',
      message:    `You have a missing ticket for ${jobName} on ${dispatch.dispatch_date}. Please submit it.`,
    }),
  ])

  return NextResponse.json({
    sent: true,
    followup_count: newCount,
    last_followup_sent_at: now,
  })
}
