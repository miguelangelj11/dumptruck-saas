import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const DRIVER_LIMITS: Record<string, number> = {
  owner_operator: 3,
  fleet:          15,
}

function getLimit(plan: string | null | undefined): number {
  if (plan === 'enterprise') return Infinity
  return DRIVER_LIMITS[plan ?? ''] ?? 3
}

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdmin()

  const { data: profile } = await admin
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()

  const companyId = profile?.organization_id
  if (!companyId) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  const { data: company } = await admin
    .from('companies')
    .select('plan')
    .eq('id', companyId)
    .maybeSingle()

  const limit = getLimit((company as Record<string, unknown> | null)?.plan as string | null)

  if (limit !== Infinity) {
    const { count } = await admin
      .from('drivers')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'active')

    if ((count ?? 0) >= limit) {
      return NextResponse.json(
        { error: 'Driver limit reached for your plan. Please upgrade.' },
        { status: 403 },
      )
    }
  }

  const body = await request.json().catch(() => ({}))
  const { name, email, phone, status } = body as Record<string, string>
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { data, error } = await admin
    .from('drivers')
    .insert({
      company_id: companyId,
      name:       name.trim(),
      email:      email || null,
      phone:      phone || null,
      status:     status ?? 'active',
    })
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ driver: data })
}
