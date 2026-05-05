import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { resolveCompanyId } from '@/lib/resolve-company'
import { getDriverProfitability } from '@/lib/workflows'

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function GET(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdmin()
  const companyId = await resolveCompanyId(user.id, admin)
  if (!companyId) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start') ?? undefined
  const end   = searchParams.get('end')   ?? undefined
  const dateRange = start && end ? { start, end } : undefined

  try {
    const drivers = await getDriverProfitability(admin, companyId, dateRange)
    return NextResponse.json({ drivers })
  } catch (err) {
    console.error('[driver-profitability]', err)
    return NextResponse.json({ drivers: [] })
  }
}
