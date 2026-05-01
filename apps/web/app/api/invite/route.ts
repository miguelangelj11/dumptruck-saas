import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  // 1. Verify authenticated caller
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { email } = body as { email?: string }

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!serviceKey) {
    console.error('[invite] SUPABASE_SERVICE_KEY is not configured — invite cannot be sent')
    return NextResponse.json(
      { error: 'Server configuration error — contact support' },
      { status: 500 }
    )
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin

  const { error } = await admin.auth.admin.inviteUserByEmail(email.trim(), {
    redirectTo: `${siteUrl}/auth/callback`,
  })

  if (error) {
    // Log server-side so failures surface in Vercel logs / monitoring
    console.error(`[invite] Failed to invite ${email.trim()} (invited by user ${user.id}):`, error.message)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  console.log(`[invite] Invite sent to ${email.trim()} by user ${user.id}`)
  return NextResponse.json({ ok: true })
}
