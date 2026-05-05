import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// Map Stripe price IDs → plan slugs
function priceToPlan(priceId: string | null | undefined): string | null {
  if (!priceId) return null
  const map: Record<string, string> = {
    [process.env.STRIPE_OWNER_PRICE_ID      ?? '__none__']: 'owner_operator',
    [process.env.STRIPE_FLEET_PRICE_ID      ?? '__none__']: 'fleet',
    [process.env.STRIPE_ENTERPRISE_PRICE_ID ?? '__none__']: 'enterprise',
  }
  return map[priceId] ?? null
}

// Map Stripe subscription status → app status
function stripeStatus(s: string): string {
  const map: Record<string, string> = {
    active:             'active',
    trialing:           'trial',
    past_due:           'past_due',
    canceled:           'canceled',
    unpaid:             'expired',
    incomplete:         'incomplete',
    incomplete_expired: 'expired',
    paused:             'paused',
  }
  return map[s] ?? s
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function POST(request: Request) {
  const body      = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured')
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

  const admin = getAdmin()

  try {
    switch (event.type) {

      // ── Checkout completed → activate subscription OR mark invoice paid ──────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // Invoice payment (one-time, from client portal)
        if (session.mode === 'payment' && session.metadata?.invoice_id) {
          const invoiceId = session.metadata.invoice_id
          const companyId = session.metadata.company_id
          const { error } = await admin
            .from('invoices')
            .update({ status: 'paid', updated_at: new Date().toISOString() })
            .eq('id', invoiceId)
            .eq('company_id', companyId)
          if (error) console.error('[stripe-webhook] invoice paid update error:', error)
          else console.log(`[stripe-webhook] Invoice ${invoiceId} marked paid`)
          break
        }

        if (session.mode !== 'subscription') break

        const customerId     = session.customer as string
        const subscriptionId = session.subscription as string
        const companyId      = session.metadata?.company_id
        const planFromMeta   = session.metadata?.plan

        if (!companyId) {
          console.error('[stripe-webhook] checkout.session.completed: no company_id in metadata')
          break
        }

        const sub  = await stripe.subscriptions.retrieve(subscriptionId)
        const plan = planFromMeta ?? priceToPlan(sub.items.data[0]?.price.id) ?? 'fleet'
        const status = stripeStatus(sub.status)

        const { error } = await admin
          .from('companies')
          .update({
            stripe_customer_id:     customerId,
            stripe_subscription_id: subscriptionId,
            stripe_price_id:        sub.items.data[0]?.price.id ?? null,
            plan,
            subscription_status: status,
          } as Record<string, unknown>)
          .eq('id', companyId)

        if (error) {
          console.error('[stripe-webhook] checkout.session.completed DB error:', error)
          return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
        }
        console.log(`[stripe-webhook] Checkout complete: company=${companyId} plan=${plan} status=${status}`)
        break
      }

      // ── Subscription updated (upgrade / downgrade / renewal) ───────────────
      case 'customer.subscription.updated': {
        const sub    = event.data.object as Stripe.Subscription
        const plan   = priceToPlan(sub.items.data[0]?.price.id)
        const status = stripeStatus(sub.status)

        const updates: Record<string, unknown> = {
          stripe_subscription_id: sub.id,
          stripe_price_id:        sub.items.data[0]?.price.id ?? null,
          subscription_status:    status,
        }
        if (plan) updates.plan = plan

        const { error } = await admin
          .from('companies')
          .update(updates)
          .eq('stripe_customer_id', sub.customer as string)

        if (error) {
          console.error('[stripe-webhook] customer.subscription.updated DB error:', error)
          return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
        }
        console.log(`[stripe-webhook] Subscription updated: sub=${sub.id} plan=${plan ?? 'unchanged'} status=${status}`)
        break
      }

      // ── Subscription deleted ───────────────────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription

        const { error } = await admin
          .from('companies')
          .update({
            subscription_status:    'canceled',
            stripe_subscription_id: null,
          } as Record<string, unknown>)
          .eq('stripe_customer_id', sub.customer as string)

        if (error) {
          console.error('[stripe-webhook] customer.subscription.deleted DB error:', error)
          return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
        }
        console.log(`[stripe-webhook] Subscription ${sub.id} deleted — company marked canceled`)
        break
      }

      // ── Payment failed → past_due ──────────────────────────────────────────
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
        console.log(`[stripe-webhook] Payment failed for customer ${invoice.customer as string}`)
        break
      }

      // ── Trial ending soon (optional — log only) ────────────────────────────
      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object as Stripe.Subscription
        console.log(`[stripe-webhook] Trial ending soon for customer ${sub.customer as string}`)
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error(`[stripe-webhook] Error processing ${event.type}:`, err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
