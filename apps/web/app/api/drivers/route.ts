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

  // Look up company by owner first, then by team membership
  const { data: ownedCompany } = await admin
    .from('companies')
    .select('id, plan, is_internal')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let companyId: string | null = ownedCompany?.id ?? null
  let companyPlan: string | null = ownedCompany?.plan ?? null
  let companyIsInternal: boolean = ownedCompany?.is_internal ?? false

  if (!companyId) {
    const { data: membership } = await admin
      .from('team_members')
      .select('company_id')
      .eq('user_id', user.id)
      .maybeSingle()
    companyId = membership?.company_id ?? null
    if (companyId) {
      const { data: memberCompany } = await admin
        .from('companies')
        .select('plan, is_internal')
        .eq('id', companyId)
        .maybeSingle()
      companyPlan = memberCompany?.plan ?? null
      companyIsInternal = memberCompany?.is_internal ?? false
    }
  }

  if (!companyId) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  if (!companyIsInternal) {
    const limit = getLimit(companyPlan)

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
