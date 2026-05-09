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

async function fetchAll(admin: ReturnType<typeof getAdmin>, table: string, companyId: string) {
  const { data } = await admin.from(table).select('*').eq('company_id', companyId)
  return data ?? []
}

// POST /api/backups/trigger  — manual backup for caller's company
export async function POST() {
  const auth = await assertSuperAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin  = getAdmin()
  const today  = new Date().toISOString().slice(0, 10)
  const coId   = auth.companyId

  const { data: co } = await admin.from('companies').select('name').eq('id', coId).maybeSingle()

  const [loads, invoices, invoiceLineItems, drivers, trucks, dispatches, jobs,
         expenses, clientCompanies, contractors, receivedInvoices] = await Promise.all([
    fetchAll(admin, 'loads', coId),
    fetchAll(admin, 'invoices', coId),
    fetchAll(admin, 'invoice_line_items', coId),
    fetchAll(admin, 'drivers', coId),
    fetchAll(admin, 'trucks', coId),
    fetchAll(admin, 'dispatches', coId),
    fetchAll(admin, 'jobs', coId),
    fetchAll(admin, 'expenses', coId),
    fetchAll(admin, 'client_companies', coId),
    fetchAll(admin, 'contractors', coId),
    fetchAll(admin, 'received_invoices', coId),
  ])

  const backup = {
    version: 1,
    exported_at: new Date().toISOString(),
    company_id: coId,
    company_name: co?.name ?? '',
    tables: { loads, invoices, invoice_line_items: invoiceLineItems, drivers, trucks,
              dispatches, jobs, expenses, client_companies: clientCompanies,
              contractors, received_invoices: receivedInvoices },
  }

  const bytes = Buffer.from(JSON.stringify(backup), 'utf-8')
  const path  = `${coId}/${today}.json`

  const { error } = await admin.storage.from('backups').upload(path, bytes, {
    contentType: 'application/json', upsert: true,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, date: today, path })
}
