import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { Resend } from 'resend'
import { randomUUID } from 'crypto'

// Map Stripe price IDs → plan slugs
function priceToPlan(priceId: string | null | undefined): string | null {
  if (!priceId) return null
  const map: Record<string, string> = {
    [process.env.STRIPE_OWNER_PRICE_ID      ?? '__none__']: 'owner_operator',
    [process.env.STRIPE_FLEET_PRICE_ID      ?? '__none__']: 'fleet',
    [process.env.STRIPE_ENTERPRISE_PRICE_ID ?? '__none__']: 'growth',
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
        const signupEmail    = session.metadata?.email
        const signupCompany  = session.metadata?.company_name

        const sub    = await stripe.subscriptions.retrieve(subscriptionId)
        const plan   = planFromMeta ?? priceToPlan(sub.items.data[0]?.price.id) ?? 'fleet'
        const status = stripeStatus(sub.status)

        // ── New signup via Subscribe Now (no existing account) ────────────────
        if (!companyId && signupEmail) {
          console.log('[stripe-webhook] New signup checkout complete for', signupEmail)

          // Try to create the auth user
          const { data: { user: newUser }, error: createErr } = await admin.auth.admin.createUser({
            email:         signupEmail,
            password:      randomUUID(),
            email_confirm: true,
            user_metadata: { company_name: signupCompany ?? '', plan },
          })

          let userId: string | null = null

          if (createErr) {
            if (/already registered|already been registered/i.test(createErr.message)) {
              // User already exists — find them via profiles
              const { data: existing } = await admin
                .from('profiles')
                .select('id, organization_id')
                .eq('email', signupEmail)
                .maybeSingle()
              if (existing?.organization_id) {
                // They already have a company — just update subscription details
                await admin.from('companies').update({
                  stripe_customer_id:     customerId,
                  stripe_subscription_id: subscriptionId,
                  stripe_price_id:        sub.items.data[0]?.price.id ?? null,
                  plan, subscription_status: status,
                } as Record<string, unknown>).eq('id', existing.organization_id)
                console.log('[stripe-webhook] Updated existing company for', signupEmail)
                break
              }
              userId = existing?.id ?? null
            } else {
              console.error('[stripe-webhook] createUser error for new signup:', createErr)
              break
            }
          } else {
            userId = newUser?.id ?? null
          }

          if (!userId) { console.error('[stripe-webhook] could not resolve userId for', signupEmail); break }

          // Create company
          const { data: newCompany, error: companyErr } = await admin
            .from('companies')
            .insert({
              owner_id:               userId,
              name:                   signupCompany ?? 'My Company',
              plan,
              subscription_status:    status,
              stripe_customer_id:     customerId,
              stripe_subscription_id: subscriptionId,
              stripe_price_id:        sub.items.data[0]?.price.id ?? null,
              onboarding_completed:   true,
            })
            .select('id')
            .single()

          if (companyErr || !newCompany) {
            console.error('[stripe-webhook] company insert error:', companyErr)
            break
          }

          // Create profile
          await admin.from('profiles').upsert({
            id:              userId,
            email:           signupEmail,
            organization_id: newCompany.id,
            role:            'admin',
          }, { onConflict: 'id' })

          // Send password setup email via Supabase recovery link
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dumptruckboss.com'
          const { data: linkData } = await admin.auth.admin.generateLink({
            type:    'recovery',
            email:   signupEmail,
            options: { redirectTo: `${siteUrl}/dashboard` },
          })

          if (linkData?.properties?.action_link && process.env.RESEND_API_KEY) {
            const resend = new Resend(process.env.RESEND_API_KEY)
            resend.emails.send({
              from:    'DumpTruckBoss <noreply@dumptruckboss.com>',
              to:      signupEmail,
              subject: 'Your DumpTruckBoss account is ready — set your password 🚛',
              html:    buildSetupEmail({ email: signupEmail, companyName: signupCompany ?? 'Your Company', setupUrl: linkData.properties.action_link }),
            }).catch(err => console.error('[stripe-webhook] setup email failed:', err))
          }

          console.log(`[stripe-webhook] New account created: user=${userId} company=${newCompany.id} plan=${plan}`)
          break
        }

        // ── Existing account upgrade (company_id in metadata) ─────────────────
        if (!companyId) {
          console.error('[stripe-webhook] checkout.session.completed: no company_id or signup email in metadata')
          break
        }

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

        const { data: existingCo } = await admin
          .from('companies')
          .select('is_super_admin, subscription_override')
          .eq('stripe_customer_id', sub.customer as string)
          .maybeSingle()
        if (existingCo?.is_super_admin || existingCo?.subscription_override) {
          console.log('[stripe-webhook] Super admin account — skipping subscription.updated')
          break
        }

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

        const { data: existingCo } = await admin
          .from('companies')
          .select('is_super_admin, subscription_override')
          .eq('stripe_customer_id', sub.customer as string)
          .maybeSingle()
        if (existingCo?.is_super_admin || existingCo?.subscription_override) {
          console.log('[stripe-webhook] Super admin account — skipping subscription.deleted')
          break
        }

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

        const { data: existingCo } = await admin
          .from('companies')
          .select('is_super_admin, subscription_override')
          .eq('stripe_customer_id', invoice.customer as string)
          .maybeSingle()
        if (existingCo?.is_super_admin || existingCo?.subscription_override) {
          console.log('[stripe-webhook] Super admin account — skipping payment_failed')
          break
        }

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

function buildSetupEmail({ email, companyName, setupUrl }: { email: string; companyName: string; setupUrl: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /><title>Set your password</title></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <tr>
        <td style="background:#1e3a2a;padding:28px 40px;text-align:center;">
          <span style="font-size:22px;font-weight:800;color:#ffffff;">DumpTruckBoss 🚛</span>
        </td>
      </tr>
      <tr>
        <td style="padding:40px 40px 32px;">
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#111827;">Your account is ready!</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
            Payment confirmed for <strong>${companyName}</strong>. Click the button below to set your password and access your dashboard.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              <td align="center">
                <a href="${setupUrl}" style="display:inline-block;background:#2d7a4f;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;">
                  Set My Password &amp; Go to Dashboard →
                </a>
              </td>
            </tr>
          </table>
          <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.5;">
            This link expires in 24 hours. If you didn't subscribe to DumpTruckBoss, you can ignore this email.<br />
            Your account email: <strong>${email}</strong>
          </p>
        </td>
      </tr>
      <tr>
        <td style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#d1d5db;">© ${new Date().getFullYear()} DumpTruckBoss — operated by SALAO TRANSPORT INC</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}
