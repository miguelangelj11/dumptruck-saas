import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

type PlanKey = 'solo' | 'pro' | 'owner_operator' | 'owner' | 'fleet' | 'growth' | 'enterprise' | 'founding_member'

const PRICE_IDS: Record<PlanKey, string | undefined | null> = {
  solo:            process.env.STRIPE_SOLO_PRICE_ID,
  pro:             process.env.STRIPE_OWNER_PRICE_ID,   // Owner Operator Pro reuses STRIPE_OWNER_PRICE_ID
  owner_operator:  process.env.STRIPE_OWNER_PRICE_ID,   // backward compat
  owner:           process.env.STRIPE_OWNER_PRICE_ID,   // backward compat
  fleet:           process.env.STRIPE_FLEET_PRICE_ID,
  founding_member: process.env.STRIPE_FOUNDING_MEMBER_PRICE_ID, // $99/mo locked-in rate
  growth:          null,   // enterprise — no Stripe checkout
  enterprise:      null,   // enterprise — no Stripe checkout
}

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  const body = await request.json().catch(() => ({}))
  const plan: PlanKey = body.plan ?? 'fleet'
  const skipTrial: boolean = body.skip_trial === true
  const guestEmail: string | undefined = body.guest_email || undefined
  const guestCompanyName: string | undefined = body.guest_company_name || undefined
  const foundingMemberAgreed: boolean = body.founding_member_agreed === true

  if (plan === 'enterprise' || plan === 'growth') {
    return NextResponse.json({ error: 'Enterprise requires custom setup', redirect: '/enterprise' }, { status: 400 })
  }

  // Founding members get fleet-level access; store agreement timestamp in metadata
  const planForAccess = plan === 'founding_member' ? 'fleet' : plan
  const foundingMemberMeta: Record<string, string> = plan === 'founding_member' && foundingMemberAgreed
    ? { founding_member: 'true', founding_member_agreed_at: new Date().toISOString() }
    : {}

  const priceId = PRICE_IDS[plan]
  if (!priceId) {
    return NextResponse.json({ error: `Price ID for plan "${plan}" is not configured` }, { status: 500 })
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const stripe   = new Stripe(secretKey)
  const siteUrl  = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin
  const trialParams = !skipTrial ? {
    trial_period_days: 7,
    trial_settings: { end_behavior: { missing_payment_method: 'cancel' as const } },
  } : {}
  const paymentCollection: Stripe.Checkout.SessionCreateParams['payment_method_collection'] =
    skipTrial ? 'always' : 'if_required'

  // ── Guest "pay first, create account after" flow ──────────────────────────
  if (!user) {
    try {
      const metadata: Record<string, string> = { plan: planForAccess, ...foundingMemberMeta }
      if (guestEmail)       metadata.email        = guestEmail
      if (guestCompanyName) metadata.company_name = guestCompanyName

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${siteUrl}/signup?paid=true`,
        cancel_url:  `${siteUrl}/pricing`,
        customer_email: guestEmail,
        metadata,
        subscription_data: { metadata, ...trialParams },
        payment_method_collection: paymentCollection,
        allow_promotion_codes: true,
      })
      return NextResponse.json({ url: session.url })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Stripe error'
      console.error('[checkout] Stripe guest session error:', msg)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  // ── Authenticated upgrade flow ────────────────────────────────────────────
  const admin = getAdmin()

  const { data: profile } = await admin
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()

  const companyId = profile?.organization_id
  if (!companyId) {
    return NextResponse.json({ redirect: '/onboarding' }, { status: 302 })
  }

  const { data: company } = await admin
    .from('companies')
    .select('stripe_customer_id, name')
    .eq('id', companyId)
    .maybeSingle()

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteUrl}/dashboard?checkout=success`,
    cancel_url:  `${siteUrl}/pricing`,
    metadata:    { company_id: companyId, plan: planForAccess, ...foundingMemberMeta },
    subscription_data: { metadata: { company_id: companyId, plan: planForAccess, ...foundingMemberMeta }, ...trialParams },
    payment_method_collection: paymentCollection,
    allow_promotion_codes: true,
  }

  const stripeCustomerId = (company as Record<string, unknown> | null)?.stripe_customer_id as string | null | undefined
  if (stripeCustomerId) {
    sessionParams.customer = stripeCustomerId
  } else {
    sessionParams.customer_email = user.email
  }

  try {
    const session = await stripe.checkout.sessions.create(sessionParams)

    if (!stripeCustomerId && session.customer) {
      await admin
        .from('companies')
        .update({ stripe_customer_id: session.customer as string })
        .eq('id', companyId)
    }

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Stripe error'
    console.error('[checkout] Stripe authenticated session error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
