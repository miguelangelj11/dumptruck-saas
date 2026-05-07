import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: profile } = await admin
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()

  const companyId = profile?.organization_id
  if (!companyId) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  const [
    { data: company },
    { data: drivers },
    { data: tickets },
    { data: invoices },
    { data: dispatches },
    { data: contractors },
    { data: leads },
  ] = await Promise.all([
    admin.from('companies').select('id, name, plan, created_at, terms_accepted_at').eq('id', companyId).maybeSingle(),
    admin.from('drivers').select('*').eq('company_id', companyId),
    admin.from('load_tickets').select('*').eq('company_id', companyId),
    admin.from('invoices').select('*').eq('company_id', companyId),
    admin.from('dispatches').select('*').eq('company_id', companyId),
    admin.from('contractors').select('*').eq('company_id', companyId),
    admin.from('leads').select('*').eq('company_id', companyId),
  ])

  const exportPayload = {
    exported_at: new Date().toISOString(),
    exported_by: user.email,
    version: '1.0',
    company,
    drivers:     drivers     ?? [],
    tickets:     tickets     ?? [],
    invoices:    invoices    ?? [],
    dispatches:  dispatches  ?? [],
    contractors: contractors ?? [],
    leads:       leads       ?? [],
  }

  const json = JSON.stringify(exportPayload, null, 2)
  const filename = `dumptruckboss-export-${companyId.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.json`

  return new Response(json, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
