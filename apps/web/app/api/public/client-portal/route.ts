import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!serviceKey) return NextResponse.json({ error: 'Server error' }, { status: 500 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: client } = await admin
    .from('client_companies')
    .select('id, name, address, company_id')
    .eq('portal_token', token)
    .maybeSingle()

  if (!client) return NextResponse.json({ error: 'Portal not found' }, { status: 404 })

  const { data: company } = await admin
    .from('companies')
    .select('name')
    .eq('id', client.company_id)
    .maybeSingle()

  const [invoicesRes, loadsRes] = await Promise.all([
    admin
      .from('invoices')
      .select('id, invoice_number, invoice_date, due_date, total_amount, status, notes')
      .eq('company_id', client.company_id)
      .eq('client_name', client.name)
      .order('invoice_date', { ascending: false })
      .limit(50),
    admin
      .from('loads')
      .select('id, date, job_name, driver_name, status, rate, rate_type')
      .eq('company_id', client.company_id)
      .eq('client_company', client.name)
      .order('date', { ascending: false })
      .limit(100),
  ])

  return NextResponse.json({
    client: { id: client.id, name: client.name, address: client.address },
    company: { name: company?.name ?? '' },
    invoices: invoicesRes.data ?? [],
    loads: loadsRes.data ?? [],
  })
}
