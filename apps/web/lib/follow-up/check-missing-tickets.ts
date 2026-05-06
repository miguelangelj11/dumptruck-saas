import type { SupabaseClient } from '@supabase/supabase-js'
import { sendMissingTicketEmail } from './send-missing-ticket-email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://dumptruckboss.com'
const SIX_HOURS_MS = 6 * 60 * 60 * 1000
const MAX_FOLLOWUPS = 2

export interface FollowUpResult {
  sent: number
  skipped: number
  errors: string[]
}

export async function checkAndSendFollowUps(
  supabase: SupabaseClient,
  companyId?: string,
): Promise<FollowUpResult> {
  const result: FollowUpResult = { sent: 0, skipped: 0, errors: [] }

  const todayStr = new Date().toISOString().split('T')[0]!
  const sixHoursAgo = new Date(Date.now() - SIX_HOURS_MS).toISOString()

  // Query dispatches eligible for follow-up:
  // - Had work (loads_completed > 0) OR dispatch_date is in the past
  // - Not already maxed out on reminders
  // - Haven't been sent a follow-up in the last 6 hours
  let query = supabase
    .from('dispatches')
    .select('id, company_id, driver_id, driver_name, dispatch_date, loads_completed, job_id, followup_count, last_followup_sent_at, jobs(job_name)')
    .lt('dispatch_date', todayStr)
    .neq('status', 'completed')
    .neq('status', 'cancelled')
    .lt('followup_count', MAX_FOLLOWUPS)

  if (companyId) query = query.eq('company_id', companyId)

  const { data: dispatches, error: dispError } = await query

  if (dispError) {
    result.errors.push(`dispatch query failed: ${dispError.message}`)
    return result
  }

  for (const dispatch of (dispatches ?? [])) {
    // Skip if sent a follow-up within the last 6 hours
    if (dispatch.last_followup_sent_at && new Date(dispatch.last_followup_sent_at) > new Date(sixHoursAgo)) {
      result.skipped++
      continue
    }

    // Count actual submitted tickets for this dispatch
    const { count: ticketCount } = await supabase
      .from('loads')
      .select('id', { count: 'exact', head: true })
      .eq('dispatch_id', dispatch.id)

    const submitted = ticketCount ?? 0
    const expected  = dispatch.loads_completed ?? 0

    if (expected <= submitted) {
      result.skipped++
      continue
    }

    // Get driver email
    if (!dispatch.driver_id) {
      result.skipped++
      continue
    }

    const { data: driver } = await supabase
      .from('drivers')
      .select('email')
      .eq('id', dispatch.driver_id)
      .maybeSingle()

    if (!driver?.email) {
      console.warn(`[follow-up] driver ${dispatch.driver_id} has no email — skipping`)
      result.skipped++
      continue
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
      result.errors.push(`dispatch ${dispatch.id}: ${sendError ?? 'send failed'}`)
      continue
    }

    // Update dispatch follow-up tracking
    await supabase
      .from('dispatches')
      .update({
        last_followup_sent_at: new Date().toISOString(),
        followup_count: (dispatch.followup_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dispatch.id)

    // Insert driver notification (in-app bell)
    await supabase.from('driver_notifications').insert({
      driver_id:  dispatch.driver_id,
      company_id: dispatch.company_id,
      type:       'missing_ticket',
      message:    `You have a missing ticket for ${jobName} on ${dispatch.dispatch_date}. Please submit it.`,
    })

    result.sent++
  }

  return result
}
