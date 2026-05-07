import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(request: Request) {
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Delete completed/failed ticket_imports older than 60 days to keep table lean
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 60)

  const { error, count } = await admin
    .from('ticket_imports')
    .delete({ count: 'exact' })
    .in('status', ['completed', 'failed'])
    .lt('created_at', cutoff.toISOString())

  if (error) {
    console.error('[cleanup-imports] delete error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[cleanup-imports] deleted ${count ?? 0} old import records`)
  return NextResponse.json({ ok: true, deleted: count ?? 0, cutoff: cutoff.toISOString() })
}
