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

  const [driversRes, companyRes] = await Promise.all([
    admin.from('drivers').select('id, name').eq('company_id', companyId).eq('status', 'active').order('name'),
    admin.from('companies').select('name').eq('id', companyId).maybeSingle(),
  ])

  if (!companyRes.data) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  return NextResponse.json({
    company: { name: companyRes.data.name },
    drivers: driversRes.data ?? [],
  })
}
