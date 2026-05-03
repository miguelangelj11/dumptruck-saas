import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

type PlanKey = 'owner' | 'fleet' | 'enterprise'

const PRICE_IDS: Record<PlanKey, string | undefined> = {
  owner:      process.env.STRIPE_OWNER_PRICE_ID,
  fleet:      process.env.STRIPE_FLEET_PRICE_ID,
  enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID,
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

  const priceId = PRICE_IDS[plan]
  if (!priceId) {
    return NextResponse.json({ error: `Price ID for plan "${plan}" is not configured` }, { status: 500 })
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const stripe   = new Stripe(secretKey)
  const siteUrl  = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin
  const isEnterprise = plan === 'enterprise'
  const trialParams = !isEnterprise ? {
    trial_period_days: 14,
    trial_settings: { end_behavior: { missing_payment_method: 'cancel' as const } },
  } : {}

  // ── Guest "pay first, create account after" flow ──────────────────────────
  if (!user) {
    const planLabel = plan === 'owner' ? 'owner_operator' : plan
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/signup?session_id={CHECKOUT_SESSION_ID}&plan=${planLabel}`,
      cancel_url:  `${siteUrl}/pricing`,
      metadata:    { plan },
      subscription_data: { metadata: { plan }, ...trialParams },
      payment_method_collection: isEnterprise ? 'always' : 'if_required',
      allow_promotion_codes: true,
    })
    return NextResponse.json({ url: session.url })
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
    metadata:    { company_id: companyId, plan },
    subscription_data: { metadata: { company_id: companyId, plan }, ...trialParams },
    payment_method_collection: isEnterprise ? 'always' : 'if_required',
    allow_promotion_codes: true,
  }

  const stripeCustomerId = (company as Record<string, unknown> | null)?.stripe_customer_id as string | null | undefined
  if (stripeCustomerId) {
    sessionParams.customer = stripeCustomerId
  } else {
    sessionParams.customer_email  = user.email
    sessionParams.customer_creation = 'always'
  }

  const session = await stripe.checkout.sessions.create(sessionParams)

  if (!stripeCustomerId && session.customer) {
    await admin
      .from('companies')
      .update({ stripe_customer_id: session.customer as string })
      .eq('id', companyId)
  }

  return NextResponse.json({ url: session.url })
}
