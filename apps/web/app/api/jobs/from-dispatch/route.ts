import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_KEY ?? ''
  return createAdmin(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { received_dispatch_id } = await request.json() as { received_dispatch_id: string }
  if (!received_dispatch_id) return NextResponse.json({ error: 'received_dispatch_id required' }, { status: 400 })

  const admin = getAdmin()

  // Get user's company
  const { data: profile } = await admin.from('profiles').select('organization_id').eq('id', user.id).maybeSingle()
  const { data: company } = await admin
    .from('companies')
    .select('id')
    .eq(profile?.organization_id ? 'id' : 'owner_id', profile?.organization_id ?? user.id)
    .single()

  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  // Fetch the received dispatch (must belong to this company)
  const { data: rd } = await admin
    .from('received_dispatches')
    .select('*')
    .eq('id', received_dispatch_id)
    .eq('company_id', company.id)
    .single()

  if (!rd) return NextResponse.json({ error: 'Dispatch not found' }, { status: 404 })

  // Create a job from the dispatch data
  const { data: job, error: jobErr } = await admin
    .from('jobs')
    .insert({
      company_id: company.id,
      job_name: rd.job_name,
      contractor: rd.sender_company_name ?? null,
      location: rd.job_location ?? null,
      material: rd.material ?? null,
      rate: rd.rate ?? null,
      rate_type: rd.rate_type ?? 'load',
      start_date: rd.start_date ?? null,
      end_date: rd.end_date ?? null,
      notes: rd.notes ?? null,
      status: 'active',
    })
    .select('id')
    .single()

  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 })

  // Mark the received dispatch as converted
  await admin
    .from('received_dispatches')
    .update({
      status: 'converted',
      converted_job_id: job.id,
      converted_at: new Date().toISOString(),
      responded_at: new Date().toISOString(),
    })
    .eq('id', received_dispatch_id)

  return NextResponse.json({ success: true, job_id: job.id })
}
