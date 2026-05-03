import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('company_id')
  if (!companyId) return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })

  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!serviceKey) return NextResponse.json({ error: 'Server error' }, { status: 500 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const today = new Date().toISOString().split('T')[0]!

  const [dispatchesRes, companyRes] = await Promise.all([
    admin
      .from('dispatches')
      .select('driver_name')
      .eq('company_id', companyId)
      .eq('dispatch_date', today)
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .neq('status', 'declined'),
    admin.from('companies').select('name').eq('id', companyId).maybeSingle(),
  ])

  if (!companyRes.data) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  const dispatches = dispatchesRes.data ?? []
  let drivers: { id: string; name: string }[]

  if (dispatches.length > 0) {
    // Unique driver names from today's active dispatches
    const uniqueNames = [...new Set(
      dispatches.map(d => d.driver_name).filter((n): n is string => Boolean(n))
    )].sort()

    // Resolve IDs from drivers table (for React keys); fall back to name as ID
    const { data: driverRows } = await admin
      .from('drivers')
      .select('id, name')
      .eq('company_id', companyId)
      .in('name', uniqueNames)

    const nameToId = new Map((driverRows ?? []).map(d => [d.name, d.id]))
    drivers = uniqueNames.map(name => ({ id: nameToId.get(name) ?? name, name }))
  } else {
    // No dispatches today — fall back to all active drivers
    const { data } = await admin
      .from('drivers')
      .select('id, name')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .order('name')
    drivers = data ?? []
  }

  return NextResponse.json({
    company: { name: companyRes.data.name },
    drivers,
  })
}
