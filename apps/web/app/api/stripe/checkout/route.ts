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
  const skipTrial: boolean = body.skip_trial === true
  const guestEmail: string | undefined = body.guest_email || undefined
  const guestCompanyName: string | undefined = body.guest_company_name || undefined

  const priceId = PRICE_IDS[plan]
  if (!priceId) {
    return NextResponse.json({ error: `Price ID for plan "${plan}" is not configured` }, { status: 500 })
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const stripe   = new Stripe(secretKey)
  const siteUrl  = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin
  const isEnterprise = plan === 'enterprise'
  const trialParams = (!isEnterprise && !skipTrial) ? {
    trial_period_days: 7,
    trial_settings: { end_behavior: { missing_payment_method: 'cancel' as const } },
  } : {}
  const paymentCollection: Stripe.Checkout.SessionCreateParams['payment_method_collection'] =
    (isEnterprise || skipTrial) ? 'always' : 'if_required'

  // ── Guest "pay first, create account after" flow ──────────────────────────
  if (!user) {
    try {
      const metadata: Record<string, string> = { plan }
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
    metadata:    { company_id: companyId, plan },
    subscription_data: { metadata: { company_id: companyId, plan }, ...trialParams },
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
