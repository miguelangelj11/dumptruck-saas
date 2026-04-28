import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { logger } from '@/lib/logger'

// Only available outside production
export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!serviceKey) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_KEY not set in .env.local. Get it from Supabase Dashboard → Settings → API → service_role key.' },
      { status: 500 }
    )
  }

  try {
    const { action, email, password, userId } = await request.json()
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    if (action === 'create-user') {
      logger.info('test-setup: create-user', { email })
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { company_name: 'Test Company' },
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      const { data: signIn, error: signInErr } = await admin.auth.signInWithPassword({ email, password })
      if (signInErr) return NextResponse.json({ error: signInErr.message }, { status: 400 })

      return NextResponse.json({
        userId: data.user.id,
        accessToken: signIn.session?.access_token,
        refreshToken: signIn.session?.refresh_token,
      })
    }

    if (action === 'delete-user') {
      logger.info('test-setup: delete-user', { userId })
      const { error } = await admin.auth.admin.deleteUser(userId)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ deleted: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    logger.error('test-setup: unexpected error', err)
    Sentry.captureException(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
