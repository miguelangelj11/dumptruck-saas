import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// Cancel all active/trialing Stripe subscriptions then delete the customer.
// Safe to call even if no Stripe key or customer ID is configured.
async function cleanupStripe(stripeCustomerId: string | null) {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey || !stripeCustomerId) return

  const stripe = new Stripe(secretKey)

  try {
    const [active, trialing] = await Promise.all([
      stripe.subscriptions.list({ customer: stripeCustomerId, status: 'active' }),
      stripe.subscriptions.list({ customer: stripeCustomerId, status: 'trialing' }),
    ])

    await Promise.all([
      ...active.data.map(s => stripe.subscriptions.cancel(s.id)),
      ...trialing.data.map(s => stripe.subscriptions.cancel(s.id)),
    ])

    // Deleting the customer removes all attached payment methods automatically
    await stripe.customers.del(stripeCustomerId)
  } catch (err) {
    console.error('[delete-account] Stripe cleanup error:', err)
    // Non-fatal: continue with DB deletion even if Stripe fails
  }
}

// Delete all rows belonging to a company in dependency order (children first).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function deleteCompanyData(admin: any, companyId: string) {
  // Gather child-table IDs that are not directly keyed by company_id
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

  // Contractor tickets (referenced by contractor_ticket_slips)
  const contractorTicketsRes = dispatchIds.length
    ? await admin.from('contractor_tickets').select('id').in('dispatch_id', dispatchIds)
    : { data: [] as Array<{ id: string }> }
  const contractorTicketIds = ids(contractorTicketsRes)

  // ── Delete leaf rows first ───────────────────────────────────────────────

  await Promise.all([
    loadIds.length       ? admin.from('load_tickets').delete().in('load_id', loadIds) : null,
    driverIds.length     ? admin.from('driver_notifications').delete().in('driver_id', driverIds) : null,
    driverIds.length     ? admin.from('driver_payments').delete().in('driver_id', driverIds) : null,
    invoiceIds.length    ? admin.from('payments').delete().in('invoice_id', invoiceIds) : null,
    invoiceIds.length    ? admin.from('invoice_line_items').delete().in('invoice_id', invoiceIds) : null,
    contractorTicketIds.length
      ? admin.from('contractor_ticket_slips').delete().in('contractor_ticket_id', contractorTicketIds)
      : null,
  ])

  // ── Delete mid-tier rows ─────────────────────────────────────────────────

  await Promise.all([
    contractorIds.length  ? admin.from('contractor_tickets').delete().in('contractor_id', contractorIds) : null,
    dispatchIds.length    ? admin.from('dispatches').delete().in('id', dispatchIds) : null,
  ])

  // ── Delete top-level company-keyed rows ──────────────────────────────────

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
  ])

  // ── Delete the company record itself ─────────────────────────────────────
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

  // 2. Fetch company to get stripe_customer_id
  const { data: company } = await admin
    .from('companies')
    .select('id, stripe_customer_id')
    .eq('owner_id', user.id)
    .maybeSingle()

  // 3. Cancel Stripe subscriptions + delete customer
  await cleanupStripe(company?.stripe_customer_id ?? null)

  // 4. Delete all company data and the company record
  if (company?.id) {
    await deleteCompanyData(admin, company.id)
  }

  // 5. For full account deletion, remove the auth user
  if (mode === 'account') {
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) {
      console.error('[delete-account] Auth user deletion error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
