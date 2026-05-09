import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime     = 'nodejs'
export const maxDuration = 300

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

async function fetchAll(admin: ReturnType<typeof getAdmin>, table: string, companyId: string) {
  const { data, error } = await admin.from(table).select('*').eq('company_id', companyId)
  if (error) console.warn(`[backup] ${table} error:`, error.message)
  return data ?? []
}

export async function GET(request: Request) {
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getAdmin()

  // Get all companies
  const { data: companies, error: coErr } = await admin
    .from('companies')
    .select('id, name, owner_id')

  if (coErr || !companies?.length) {
    return NextResponse.json({ error: coErr?.message ?? 'No companies found' }, { status: 500 })
  }

  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const results: { company: string; ok: boolean; error?: string }[] = []

  for (const co of companies) {
    try {
      const [
        loads,
        invoices,
        invoiceLineItems,
        drivers,
        trucks,
        dispatches,
        jobs,
        expenses,
        clientCompanies,
        contractors,
        receivedInvoices,
      ] = await Promise.all([
        fetchAll(admin, 'loads', co.id),
        fetchAll(admin, 'invoices', co.id),
        fetchAll(admin, 'invoice_line_items', co.id),
        fetchAll(admin, 'drivers', co.id),
        fetchAll(admin, 'trucks', co.id),
        fetchAll(admin, 'dispatches', co.id),
        fetchAll(admin, 'jobs', co.id),
        fetchAll(admin, 'expenses', co.id),
        fetchAll(admin, 'client_companies', co.id),
        fetchAll(admin, 'contractors', co.id),
        fetchAll(admin, 'received_invoices', co.id),
      ])

      const backup = {
        version: 1,
        exported_at: new Date().toISOString(),
        company_id: co.id,
        company_name: co.name,
        tables: {
          loads,
          invoices,
          invoice_line_items: invoiceLineItems,
          drivers,
          trucks,
          dispatches,
          jobs,
          expenses,
          client_companies: clientCompanies,
          contractors,
          received_invoices: receivedInvoices,
        },
      }

      const json    = JSON.stringify(backup)
      const bytes   = Buffer.from(json, 'utf-8')
      const path    = `${co.id}/${today}.json`

      const { error: upErr } = await admin.storage
        .from('backups')
        .upload(path, bytes, { contentType: 'application/json', upsert: true })

      if (upErr) throw new Error(upErr.message)

      // Keep only last 30 days — list and prune older files
      const { data: files } = await admin.storage.from('backups').list(co.id, { sortBy: { column: 'name', order: 'asc' } })
      if (files && files.length > 30) {
        const toDelete = files.slice(0, files.length - 30).map(f => `${co.id}/${f.name}`)
        await admin.storage.from('backups').remove(toDelete)
      }

      results.push({ company: co.name, ok: true })
    } catch (err) {
      results.push({ company: co.name, ok: false, error: String(err) })
    }
  }

  const failed = results.filter(r => !r.ok)
  console.log(`[cron/daily-backup] ${results.length} companies, ${failed.length} errors`)

  return NextResponse.json({ ok: true, date: today, results })
}
