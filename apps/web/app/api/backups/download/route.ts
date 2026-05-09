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

async function assertSuperAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const admin = getAdmin()
  const { data: co } = await admin
    .from('companies')
    .select('is_super_admin')
    .eq('owner_id', user.id)
    .maybeSingle()

  return !!co?.is_super_admin
}

// GET /api/backups/download?path=companyId/2026-05-08.json
export async function GET(request: Request) {
  const isSuperAdmin = await assertSuperAdmin()
  if (!isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 })

  // Guard: only allow paths inside valid UUID/date patterns — no path traversal
  if (!/^[0-9a-f-]{36}\/\d{4}-\d{2}-\d{2}\.json$/.test(path)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const admin = getAdmin()
  const { data, error } = await admin.storage.from('backups').download(path)

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 404 })

  const buffer = Buffer.from(await data.arrayBuffer())
  const filename = path.split('/').pop() ?? 'backup.json'

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
