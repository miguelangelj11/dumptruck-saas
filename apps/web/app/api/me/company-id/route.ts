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
  if (!user) return NextResponse.json({ companyId: null }, { status: 401 })

  const admin = getAdmin()

  // 1. profiles.organization_id
  const { data: profile } = await admin
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.organization_id) {
    return NextResponse.json({ companyId: profile.organization_id })
  }

  // 2. owner lookup
  const { data: company } = await admin
    .from('companies')
    .select('id')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (company?.id) {
    return NextResponse.json({ companyId: company.id })
  }

  // 3. team_members lookup
  const { data: membership } = await admin
    .from('team_members')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({ companyId: membership?.company_id ?? null })
}
