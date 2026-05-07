import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { resolveCompanyId } from '@/lib/resolve-company'
import { normalizePlan, PLAN_LIMITS } from '@/lib/plan-gate'

function getLimit(plan: string | null | undefined): number {
  return PLAN_LIMITS[normalizePlan(plan)].maxDrivers
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

  // Single shared resolver: profiles → owner → team_member (auto-backfills profile)
  const companyId = await resolveCompanyId(user.id, admin)
  if (!companyId) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  const { data: company } = await admin
    .from('companies')
    .select('plan, is_internal')
    .eq('id', companyId)
    .maybeSingle()

  const plan       = company?.plan as string | null
  const isInternal = company?.is_internal as boolean ?? false

  if (!isInternal) {
    const limit = getLimit(plan)
    if (limit !== Infinity) {
      const { count } = await admin
        .from('drivers')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'active')

      if ((count ?? 0) >= limit) {
        const required_plan = plan === 'solo' ? 'owner_operator' : 'fleet'
        const msg = plan === 'solo'
          ? `Solo plan allows 1 driver. Upgrade to Owner Operator for up to 5 drivers.`
          : `Driver limit (${limit}) reached for your plan. Upgrade to Fleet for unlimited drivers.`
        return NextResponse.json(
          { error: 'upgrade_required', feature: 'drivers', required_plan, message: msg },
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
