import { createClient } from '@supabase/supabase-js'
import { checkAndSendFollowUps } from '@/lib/follow-up/check-missing-tickets'

export async function GET(request: Request) {
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const result = await checkAndSendFollowUps(admin)

  console.log('[cron/missing-tickets]', result)

  return Response.json({
    ok: true,
    processed: result.sent + result.skipped,
    sent: result.sent,
    skipped: result.skipped,
    errors: result.errors,
  })
}
