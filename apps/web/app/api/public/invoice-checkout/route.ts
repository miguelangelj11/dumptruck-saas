import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

export async function POST(request: Request) {
  try {
    const { invoice_id, portal_token, return_url } = await request.json() as {
      invoice_id: string
      portal_token: string
      return_url: string
    }

    if (!invoice_id || !portal_token) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_KEY
    const stripeKey  = process.env.STRIPE_SECRET_KEY
    if (!serviceKey || !stripeKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Verify the portal token matches the invoice's company
    const { data: client } = await admin
      .from('client_companies')
      .select('id, name, company_id')
      .eq('portal_token', portal_token)
      .maybeSingle()

    if (!client) return NextResponse.json({ error: 'Invalid portal token' }, { status: 403 })

    const { data: invoice } = await admin
      .from('invoices')
      .select('id, invoice_number, total_amount, status, client_name, company_id')
      .eq('id', invoice_id)
      .eq('company_id', client.company_id)
      .maybeSingle()

    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    if (invoice.status === 'paid') return NextResponse.json({ error: 'Invoice already paid' }, { status: 400 })
    if (invoice.total_amount <= 0) return NextResponse.json({ error: 'Invalid invoice amount' }, { status: 400 })

    const { data: company } = await admin
      .from('companies')
      .select('name')
      .eq('id', client.company_id)
      .maybeSingle()

    const stripe = new Stripe(stripeKey)
    const origin = return_url ? new URL(return_url).origin : process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dumptruckboss.com'
    const portalUrl = `${origin}/client-portal/${portal_token}`

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(invoice.total_amount * 100),
          product_data: {
            name: `Invoice ${invoice.invoice_number ? `#${invoice.invoice_number}` : ''} — ${company?.name ?? 'DumpTruck'}`,
            description: `Payment from ${invoice.client_name}`,
          },
        },
        quantity: 1,
      }],
      success_url: `${portalUrl}?paid=${invoice_id}`,
      cancel_url:  portalUrl,
      metadata: {
        invoice_id,
        company_id: client.company_id,
        portal_token,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[invoice-checkout]', err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
