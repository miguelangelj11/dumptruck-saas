import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { EmailOtpType } from '@supabase/supabase-js'
import Stripe from 'stripe'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_KEY!
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code      = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type      = searchParams.get('type') as EmailOtpType | null
  const next      = searchParams.get('next') ?? '/dashboard'

  const supabase = await createClient()

  // ── Email-OTP / magic link / password recovery ────────────────────────────
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error) {
      if (type === 'recovery') return NextResponse.redirect(`${origin}/reset-password`)
      return NextResponse.redirect(`${origin}${next}`)
    }
    return NextResponse.redirect(`${origin}/login?error=invalid_reset_link`)
  }

  if (!code) return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)

  const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeErr) return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)

  if (next === '/reset-password') return NextResponse.redirect(`${origin}/reset-password`)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)

  const admin = getAdmin()

  // ── 1. Profile already exists → go to dashboard ──────────────────────────
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (existingProfile) {
    return NextResponse.redirect(`${origin}/dashboard`)
  }

  // ── 2. No profile — check for an invitation ───────────────────────────────
  const { data: invitation } = await admin
    .from('invitations')
    .select('id, company_id, role')
    .eq('email', user.email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (invitation?.company_id) {
    // Create profile linked to the inviting company
    await admin.from('profiles').insert({
      id:              user.id,
      email:           user.email,
      organization_id: invitation.company_id,
      role:            invitation.role ?? 'dispatcher',
    })
    // Mark invitation accepted
    await admin.from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)
    // Delete any ghost company the DB trigger may have auto-created
    await admin.from('companies').delete().eq('owner_id', user.id)
    return NextResponse.redirect(`${origin}/dashboard`)
  }

  // ── 3. No invitation — new owner signup ──────────────────────────────────
  // Delete ghost company if the DB trigger already created one
  await admin.from('companies').delete().eq('owner_id', user.id)

  const now = new Date()
  const { data: newCompany } = await admin
    .from('companies')
    .insert({
      owner_id:            user.id,
      name:                user.user_metadata?.company_name ?? user.email,
      plan:                user.user_metadata?.plan ?? 'owner_operator',
      trial_started_at:    now.toISOString(),
      trial_ends_at:       new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      subscription_status: 'trial',
    })
    .select('id')
    .single()

  if (newCompany) {
    await admin.from('profiles').insert({
      id:              user.id,
      email:           user.email,
      organization_id: newCompany.id,
      role:            'admin',
    })

    // Link Stripe subscription if the user paid before creating their account
    const stripeSessionId = user.user_metadata?.stripe_session_id as string | undefined
    if (stripeSessionId && process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe   = new Stripe(process.env.STRIPE_SECRET_KEY)
        const session  = await stripe.checkout.sessions.retrieve(stripeSessionId, { expand: ['subscription'] })
        if (session.status === 'complete' && session.customer) {
          const sub = session.subscription as Stripe.Subscription | null
          await admin.from('companies').update({
            stripe_customer_id:     session.customer as string,
            stripe_subscription_id: sub?.id ?? null,
            stripe_price_id:        sub?.items?.data[0]?.price?.id ?? null,
            subscription_status:    sub?.status === 'trialing' ? 'trial' : (sub?.status ?? null),
            ...(sub?.trial_end ? { trial_ends_at: new Date(sub.trial_end * 1000).toISOString() } : {}),
          }).eq('id', newCompany.id)
        }
      } catch {
        // Non-fatal: webhook will reconcile if linking fails
      }
    }
  }

  return NextResponse.redirect(`${origin}/onboarding`)
}
