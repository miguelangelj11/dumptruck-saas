import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// Stripe requires the raw request body for signature verification.
// Next.js App Router provides it via request.text().
export async function POST(request: Request) {
  const body      = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    switch (event.type) {

      // ── Checkout completed → activate subscription ─────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const customerId     = session.customer as string
        const subscriptionId = session.subscription as string

        const sub = await stripe.subscriptions.retrieve(subscriptionId)

        const { error } = await admin
          .from('companies')
          .update({
            stripe_customer_id:     customerId,
            stripe_subscription_id: subscriptionId,
            stripe_price_id:        sub.items.data[0]?.price.id ?? null,
            subscription_status:    'active',
          })
          .eq('stripe_customer_id', customerId)

        if (error) {
          console.error('[stripe-webhook] checkout.session.completed DB error:', error)
          return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
        }
        console.log(`[stripe-webhook] Activated subscription ${subscriptionId} for customer ${customerId}`)
        break
      }

      // ── Subscription updated (upgrade, downgrade, renewal) ─────────────────
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription

        const statusMap: Record<string, string> = {
          active:             'active',
          trialing:           'trial',
          past_due:           'past_due',
          canceled:           'canceled',
          unpaid:             'expired',
          incomplete:         'incomplete',
          incomplete_expired: 'expired',
          paused:             'paused',
        }
        const newStatus = statusMap[sub.status] ?? sub.status

        const { error } = await admin
          .from('companies')
          .update({
            stripe_subscription_id: sub.id,
            stripe_price_id:        sub.items.data[0]?.price.id ?? null,
            subscription_status:    newStatus,
          })
          .eq('stripe_customer_id', sub.customer as string)

        if (error) {
          console.error('[stripe-webhook] customer.subscription.updated DB error:', error)
          return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
        }
        console.log(`[stripe-webhook] Subscription ${sub.id} updated to status "${newStatus}"`)
        break
      }

      // ── Subscription deleted (cancelled through Stripe dashboard or API) ───
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription

        const { error } = await admin
          .from('companies')
          .update({
            subscription_status:    'canceled',
            stripe_subscription_id: null,
          })
          .eq('stripe_customer_id', sub.customer as string)

        if (error) {
          console.error('[stripe-webhook] customer.subscription.deleted DB error:', error)
          return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
        }
        console.log(`[stripe-webhook] Subscription ${sub.id} deleted — company marked canceled`)
        break
      }

      // ── Payment failed → mark past_due ────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice

        const { error } = await admin
          .from('companies')
          .update({ subscription_status: 'past_due' })
          .eq('stripe_customer_id', invoice.customer as string)

        if (error) {
          console.error('[stripe-webhook] invoice.payment_failed DB error:', error)
          return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
        }
        console.log(`[stripe-webhook] Payment failed for customer ${invoice.customer as string} — marked past_due`)
        break
      }

      default:
        // Unhandled event types — acknowledge without error
        break
    }
  } catch (err) {
    console.error(`[stripe-webhook] Unhandled error processing ${event.type}:`, err)
    // Return 500 so Stripe retries transient failures (e.g. DB unavailable)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
