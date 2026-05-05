import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { resolveCompanyId } from '@/lib/resolve-company'
import { getProfitAlerts } from '@/lib/workflows'

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdmin()
  const companyId = await resolveCompanyId(user.id, admin)
  if (!companyId) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  try {
    const alerts = await getProfitAlerts(admin, companyId)
    return NextResponse.json({ alerts })
  } catch (err) {
    console.error('[profit-alerts]', err)
    return NextResponse.json({ alerts: [] })
  }
}
