import { createClient } from '@supabase/supabase-js'
import { generateWeeklyReport } from '@/lib/reports/generate-weekly-report'
import { sendWeeklyReport } from '@/lib/reports/send-weekly-report'

export const runtime    = 'nodejs'
export const maxDuration = 60

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

async function getOwnerEmail(
  admin: ReturnType<typeof getAdmin>,
  ownerId: string,
  notificationEmail: string | null,
): Promise<string | null> {
  // Prefer explicit notification_email the user configured
  if (notificationEmail?.trim()) return notificationEmail.trim()

  // Fall back to profiles table email
  const { data: profile } = await admin
    .from('profiles')
    .select('email')
    .eq('id', ownerId)
    .maybeSingle()

  if (profile?.email) return profile.email

  // Last resort: auth admin API
  try {
    const { data } = await admin.auth.admin.getUserById(ownerId)
    return data.user?.email ?? null
  } catch {
    console.warn(`[cron/weekly-report] could not get email for owner ${ownerId}`)
    return null
  }
}

export async function GET(request: Request) {
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getAdmin()

  const { data: companies, error: coErr } = await admin
    .from('companies')
    .select('id, name, owner_id, notification_email, weekly_report_enabled')
    .eq('weekly_report_enabled', true)

  if (coErr) {
    console.error('[cron/weekly-report] failed to fetch companies:', coErr.message)
    return Response.json({ error: coErr.message }, { status: 500 })
  }

  const results = { sent: 0, skipped: 0, errors: [] as string[] }

  for (const company of (companies ?? [])) {
    try {
      const ownerEmail = await getOwnerEmail(admin, company.owner_id, company.notification_email)
      if (!ownerEmail) {
        console.warn(`[cron/weekly-report] no email for company ${company.id} — skipping`)
        results.skipped++
        continue
      }

      const reportData = await generateWeeklyReport(admin, company.id, company.name)

      // Skip companies with zero activity to avoid empty/useless emails
      if (reportData.totalLoads === 0 && reportData.totalRevenue === 0) {
        results.skipped++
        continue
      }

      const { sent } = await sendWeeklyReport(ownerEmail, company.name, reportData)
      if (sent) results.sent++
      else results.skipped++

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[cron/weekly-report] company ${company.id} failed:`, msg)
      results.errors.push(`${company.id}: ${msg}`)
      // Never let one company's failure stop the loop
    }
  }

  console.log('[cron/weekly-report]', results)
  return Response.json({ ok: true, ...results })
}
