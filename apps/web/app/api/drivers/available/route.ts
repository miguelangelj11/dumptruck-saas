import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE env vars')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdmin()

  // Resolve company via profiles → owner → team_members
  const { data: profile } = await admin
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()

  let companyId = profile?.organization_id ?? null

  if (!companyId) {
    const { data: co } = await admin
      .from('companies')
      .select('id')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    companyId = co?.id ?? null
  }

  if (!companyId) {
    const { data: mem } = await admin
      .from('team_members')
      .select('company_id')
      .eq('user_id', user.id)
      .maybeSingle()
    companyId = mem?.company_id ?? null
  }

  if (!companyId) return NextResponse.json({ drivers: [] })

  const { data: drivers, error } = await admin
    .from('drivers')
    .select('id, name, truck_number')
    .eq('company_id', companyId)
    .eq('status', 'available')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ drivers: drivers ?? [] })
}
