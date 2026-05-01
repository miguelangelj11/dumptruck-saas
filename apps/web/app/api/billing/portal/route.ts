import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import Stripe from 'stripe'
import { logger } from '@/lib/logger'

// Creates a Stripe Customer Portal session and returns its URL.
// The frontend redirects the user to this URL — Stripe handles
// card updates, invoice history, and subscription cancellation.
export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const log = logger.withContext({ userId: user.id })

  const { data: company } = await supabase
    .from('companies')
    .select('stripe_customer_id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!company?.stripe_customer_id) {
    log.warn('billing.portal.no_customer')
    return NextResponse.json(
      { error: 'No Stripe billing account found. Subscribe to a plan first.' },
      { status: 404 },
    )
  }

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    log.error('billing.portal.no_stripe_key')
    return NextResponse.json({ error: 'Billing not configured' }, { status: 500 })
  }

  const stripe   = new Stripe(secretKey)
  const siteUrl  = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin

  const session = await stripe.billingPortal.sessions.create({
    customer:   company.stripe_customer_id,
    return_url: `${siteUrl}/dashboard/settings`,
  })

  log.info('billing.portal.created', { customerId: company.stripe_customer_id })
  return NextResponse.json({ url: session.url })
}
