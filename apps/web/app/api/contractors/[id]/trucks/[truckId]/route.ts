import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

async function resolveCompanyId(userId: string): Promise<string | null> {
  const { data } = await admin()
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .maybeSingle()
  return data?.organization_id ?? null
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; truckId: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = await resolveCompanyId(user.id)
  if (!companyId) return NextResponse.json({ error: 'Company not found' }, { status: 403 })

  const { truckId } = await params

  const { error } = await admin()
    .from('contractor_trucks')
    .delete()
    .eq('id', truckId)
    .eq('company_id', companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
