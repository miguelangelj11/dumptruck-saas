import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { generateDispatchToken } from '@/lib/dispatch-token'

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = getAdmin()

  // Resolve caller's company
  const { data: profile } = await admin
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()
  const callerCompanyId = profile?.organization_id ?? user.id

  // Verify dispatch belongs to caller's company
  const { data: dispatch } = await admin
    .from('dispatches')
    .select('id, company_id')
    .eq('id', id)
    .maybeSingle()

  if (!dispatch) return NextResponse.json({ error: 'Dispatch not found' }, { status: 404 })
  if ((dispatch as Record<string, unknown>).company_id !== callerCompanyId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const token = generateDispatchToken(id)
  const base = `https://dumptruckboss.com/api/dispatches/respond?id=${encodeURIComponent(id)}&token=${token}`

  return NextResponse.json({
    acceptUrl:  `${base}&action=accepted`,
    declineUrl: `${base}&action=declined`,
  })
}
