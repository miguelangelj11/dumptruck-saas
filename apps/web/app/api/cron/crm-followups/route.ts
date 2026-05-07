import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request) {
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const now = new Date().toISOString()
  const today = now.split('T')[0]!
  const coldThreshold = new Date(Date.now() - 14 * 86_400_000).toISOString()

  // Find leads due for follow-up today (and not already won/lost)
  const { data: dueLeads, error: dueErr } = await admin
    .from('leads')
    .select('id, company_id, name, stage, next_follow_up_at, last_contacted_at, follow_up_count')
    .not('stage', 'in', '("won","lost")')
    .not('next_follow_up_at', 'is', null)
    .lte('next_follow_up_at', now)

  if (dueErr) {
    console.error('[cron/crm-followups] query error:', dueErr)
    return NextResponse.json({ error: dueErr.message }, { status: 500 })
  }

  let notified = 0
  let coldMarked = 0

  for (const lead of (dueLeads ?? [])) {
    // Insert a notification for the company owner
    const { error: notifErr } = await admin.from('notifications').insert({
      company_id: lead.company_id,
      type: 'crm_followup',
      title: 'Follow-up due',
      body: `Follow up with "${lead.name}" is due today.`,
      data: { lead_id: lead.id },
      created_at: now,
      read: false,
    })

    if (!notifErr) notified++

    // Clear the follow-up timestamp so it doesn't fire again until rescheduled
    await admin
      .from('leads')
      .update({ next_follow_up_at: null })
      .eq('id', lead.id)
  }

  // Mark leads as cold if last_contacted_at > 14 days and not won/lost
  const { data: coldLeads, error: coldErr } = await admin
    .from('leads')
    .select('id')
    .not('stage', 'in', '("won","lost")')
    .not('last_contacted_at', 'is', null)
    .lt('last_contacted_at', coldThreshold)
    .neq('priority', 'cold') // avoid re-processing already-marked cold leads

  if (!coldErr) {
    for (const lead of (coldLeads ?? [])) {
      await admin
        .from('leads')
        .update({ priority: 'low' })
        .eq('id', lead.id)
      coldMarked++
    }
  }

  console.log(`[cron/crm-followups] notified=${notified} cold_marked=${coldMarked} date=${today}`)

  return NextResponse.json({ ok: true, notified, cold_marked: coldMarked })
}
