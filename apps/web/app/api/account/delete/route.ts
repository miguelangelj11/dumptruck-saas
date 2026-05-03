import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// Cancel the subscription identified by stripe_subscription_id, then delete
// the customer record.  Throws on any Stripe API error so the caller can
// abort the account deletion rather than orphaning a paying subscription.
async function cancelStripeSubscription(
  stripeCustomerId: string,
  stripeSubscriptionId: string | null,
): Promise<void> {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    // No Stripe key configured — skip silently (dev / staging without Stripe)
    return
  }

  const stripe = new Stripe(secretKey)

  // Cancel the specific subscription stored on the company row.
  // We use prorate: false (no partial refund) because the user is deleting
  // their account — they won't benefit from the remaining period anyway.
  // If you prefer cancel_at_period_end: true so the sub naturally expires,
  // swap the call below; just note the user's data will already be gone.
  if (stripeSubscriptionId) {
    await stripe.subscriptions.cancel(stripeSubscriptionId, { prorate: false })
  } else {
    // Fallback: list and cancel any active/trialing subscriptions on the customer
    const [active, trialing] = await Promise.all([
      stripe.subscriptions.list({ customer: stripeCustomerId, status: 'active' }),
      stripe.subscriptions.list({ customer: stripeCustomerId, status: 'trialing' }),
    ])
    await Promise.all([
      ...active.data.map(s => stripe.subscriptions.cancel(s.id, { prorate: false })),
      ...trialing.data.map(s => stripe.subscriptions.cancel(s.id, { prorate: false })),
    ])
  }

  // Delete customer — removes all attached payment methods automatically.
  await stripe.customers.del(stripeCustomerId)
}

// Delete all rows belonging to a company in dependency order (children first).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function deleteCompanyData(admin: any, companyId: string) {
  const [loadsRes, driversRes, invoicesRes, dispatchesRes, contractorsRes] =
    await Promise.all([
      admin.from('loads').select('id').eq('company_id', companyId),
      admin.from('drivers').select('id').eq('company_id', companyId),
      admin.from('invoices').select('id').eq('company_id', companyId),
      admin.from('dispatches').select('id').eq('company_id', companyId),
      admin.from('contractors').select('id').eq('company_id', companyId),
    ])

  const ids = (res: { data: Array<{ id: string }> | null }) =>
    (res.data ?? []).map(r => r.id)

  const loadIds       = ids(loadsRes)
  const driverIds     = ids(driversRes)
  const invoiceIds    = ids(invoicesRes)
  const dispatchIds   = ids(dispatchesRes)
  const contractorIds = ids(contractorsRes)

  const contractorTicketsRes = dispatchIds.length
    ? await admin.from('contractor_tickets').select('id').in('dispatch_id', dispatchIds)
    : { data: [] as Array<{ id: string }> }
  const contractorTicketIds = ids(contractorTicketsRes)

  // ── Leaf rows ─────────────────────────────────────────────────────────────
  await Promise.all([
    loadIds.length             ? admin.from('load_tickets').delete().in('load_id', loadIds) : null,
    driverIds.length           ? admin.from('driver_notifications').delete().in('driver_id', driverIds) : null,
    driverIds.length           ? admin.from('driver_payments').delete().in('driver_id', driverIds) : null,
    invoiceIds.length          ? admin.from('payments').delete().in('invoice_id', invoiceIds) : null,
    invoiceIds.length          ? admin.from('invoice_line_items').delete().in('invoice_id', invoiceIds) : null,
    contractorTicketIds.length ? admin.from('contractor_ticket_slips').delete().in('contractor_ticket_id', contractorTicketIds) : null,
  ])

  // ── Mid-tier rows ─────────────────────────────────────────────────────────
  await Promise.all([
    contractorIds.length ? admin.from('contractor_tickets').delete().in('contractor_id', contractorIds) : null,
    dispatchIds.length   ? admin.from('dispatches').delete().in('id', dispatchIds) : null,
  ])

  // ── Top-level company-keyed rows ──────────────────────────────────────────
  await Promise.all([
    admin.from('loads').delete().eq('company_id', companyId),
    admin.from('invoices').delete().eq('company_id', companyId),
    admin.from('expenses').delete().eq('company_id', companyId),
    admin.from('drivers').delete().eq('company_id', companyId),
    admin.from('trucks').delete().eq('company_id', companyId),
    admin.from('jobs').delete().eq('company_id', companyId),
    admin.from('contractors').delete().eq('company_id', companyId),
    admin.from('received_invoices').delete().eq('company_id', companyId),
    admin.from('activity_feed').delete().eq('company_id', companyId),
    admin.from('client_companies').delete().eq('company_id', companyId),
    admin.from('team_members').delete().eq('company_id', companyId),
    admin.from('invitations').delete().eq('company_id', companyId),
  ])

  await admin.from('companies').delete().eq('id', companyId)
}

export async function POST(request: Request) {
  // 1. Verify authenticated caller
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { mode } = await request.json() as { mode: 'data' | 'account' }
  if (mode !== 'data' && mode !== 'account') {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!serviceKey) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_KEY is not configured on the server' },
      { status: 500 },
    )
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // 2. Fetch company — we need both stripe IDs
  const { data: company } = await admin
    .from('companies')
    .select('id, stripe_customer_id, stripe_subscription_id')
    .eq('owner_id', user.id)
    .maybeSingle()

  // 3. Cancel Stripe subscription BEFORE deleting data.
  //    If Stripe API fails, abort the deletion so we don't orphan a paying sub.
  if (company?.stripe_customer_id) {
    try {
      await cancelStripeSubscription(
        company.stripe_customer_id,
        company.stripe_subscription_id ?? null,
      )
      console.log(`[delete-account] Stripe subscription canceled for customer ${company.stripe_customer_id}`)
    } catch (err) {
      console.error('[delete-account] Stripe cancellation failed — aborting delete:', err)
      return NextResponse.json(
        { error: 'Failed to cancel Stripe subscription. Please try again or contact support.' },
        { status: 500 },
      )
    }
  }

  // 4. Delete all company data and the company record
  if (company?.id) {
    await deleteCompanyData(admin, company.id)
  }

  // 5. Delete profile
  await admin.from('profiles').delete().eq('id', user.id)

  // 6. For full account deletion, remove the auth user
  if (mode === 'account') {
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) {
      console.error('[delete-account] Auth user deletion error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  console.log(`[delete-account] mode=${mode} completed for user ${user.id}`)
  return NextResponse.json({ ok: true })
}
