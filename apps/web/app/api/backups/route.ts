import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

function getAdmin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

async function assertSuperAdmin(): Promise<{ companyId: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = getAdmin()
  const { data: co } = await admin
    .from('companies')
    .select('id, is_super_admin')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!co?.is_super_admin) return null
  return { companyId: co.id }
}

// GET /api/backups?companyId=xxx  — list backup files
export async function GET(request: Request) {
  const auth = await assertSuperAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('companyId') ?? auth.companyId
  const admin = getAdmin()

  const { data: files, error } = await admin.storage
    .from('backups')
    .list(companyId, { sortBy: { column: 'name', order: 'desc' } })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const backups = (files ?? []).map(f => ({
    name: f.name,
    date: f.name.replace('.json', ''),
    size: f.metadata?.size ?? null,
    path: `${companyId}/${f.name}`,
  }))

  return NextResponse.json({ ok: true, backups })
}
