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

// Tables that can be restored and their unique conflict key
const RESTORABLE: { table: string; conflict: string }[] = [
  { table: 'loads',               conflict: 'id' },
  { table: 'invoices',            conflict: 'id' },
  { table: 'invoice_line_items',  conflict: 'id' },
  { table: 'drivers',             conflict: 'id' },
  { table: 'trucks',              conflict: 'id' },
  { table: 'dispatches',          conflict: 'id' },
  { table: 'jobs',                conflict: 'id' },
  { table: 'expenses',            conflict: 'id' },
  { table: 'client_companies',    conflict: 'id' },
  { table: 'contractors',         conflict: 'id' },
  { table: 'received_invoices',   conflict: 'id' },
]

export async function POST(request: Request) {
  const auth = await assertSuperAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const backup = body.backup as {
    version?: number
    company_id?: string
    tables?: Record<string, unknown[]>
  }

  if (!backup?.tables || !backup.company_id) {
    return NextResponse.json({ error: 'Invalid backup file' }, { status: 400 })
  }

  // Security: only allow restoring into the caller's own company
  if (backup.company_id !== auth.companyId) {
    return NextResponse.json({ error: 'Backup belongs to a different company' }, { status: 403 })
  }

  const admin   = getAdmin()
  const inserted: Record<string, number> = {}

  for (const { table } of RESTORABLE) {
    const rows = backup.tables[table]
    if (!rows?.length) { inserted[table] = 0; continue }

    // Upsert — on conflict do nothing (preserve existing data)
    const { error, data: upserted } = await admin
      .from(table)
      .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
      .select('id')

    if (error) {
      console.error(`[restore] ${table} error:`, error.message)
      inserted[table] = 0
    } else {
      inserted[table] = upserted?.length ?? 0
    }
  }

  return NextResponse.json({ ok: true, inserted })
}
