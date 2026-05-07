import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/get-company-id'

export const runtime = 'nodejs'

const MONTHLY_LIMITS: Record<string, number> = {
  owner_operator: 10,
  fleet:          50,
  growth:         Infinity,
  enterprise:     Infinity,
}

function mapRateType(rt: string | null | undefined): string {
  if (rt === 'per_hour') return 'hr'
  if (rt === 'per_ton')  return 'ton'
  return 'load'
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Company not found' }, { status: 403 })

  let body: {
    rows: Record<string, unknown>[]
    sourceDocumentUrl?: string
    documentName?: string
    documentType?: string
    rawExtraction?: Record<string, unknown>
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { rows, sourceDocumentUrl, documentName, documentType, rawExtraction } = body
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows to import' }, { status: 400 })
  }

  // Check plan + monthly import limit
  const { data: co } = await supabase
    .from('companies')
    .select('plan, is_internal')
    .eq('id', companyId)
    .maybeSingle()

  const plan = (co?.plan as string) ?? 'owner_operator'
  const isInternal = !!(co as Record<string, unknown> | null)?.is_internal

  if (!isInternal) {
    const limit = MONTHLY_LIMITS[plan] ?? 10
    if (isFinite(limit)) {
      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)

      const { count } = await supabase
        .from('ticket_imports')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('created_at', monthStart.toISOString())

      if ((count ?? 0) >= limit) {
        return NextResponse.json(
          { error: `Your plan allows ${limit} document imports per month. Upgrade to import more.` },
          { status: 429 }
        )
      }
    }
  }

  // Create import session record
  const { data: importSession } = await supabase
    .from('ticket_imports')
    .insert({
      company_id:    companyId,
      document_url:  sourceDocumentUrl ?? null,
      document_name: documentName ?? null,
      document_type: documentType ?? null,
      status:        'processing',
      total_rows:    rows.length,
      raw_extraction: rawExtraction ?? null,
    })
    .select('id')
    .maybeSingle()

  const importId = importSession?.id

  // Insert loads
  const imported: string[] = []
  const failed:   Array<{ row: number; error: string }> = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!

    const rateVal = parseFloat(String(row.rate ?? row.estimated_amount ?? 0)) || 0
    const timeIn  = String(row.start_time ?? '')
    const timeOut = String(row.end_time ?? '')

    const payload: Record<string, unknown> = {
      company_id:          companyId,
      job_name:            String(row.job_name || 'Imported Job'),
      material:            row.material ? String(row.material) : null,
      load_type:           row.material ? String(row.material) : null,
      driver_name:         String(row.driver_name || 'Unknown Driver'),
      truck_number:        row.truck_number ? String(row.truck_number) : null,
      date:                String(row.date || new Date().toISOString().slice(0, 10)),
      rate:                rateVal,
      rate_type:           mapRateType(row.rate_type as string | undefined),
      time_in:             timeIn || null,
      time_out:            timeOut || null,
      hours_worked:        timeIn && timeOut ? `${timeIn}–${timeOut}` : (row.hours ? String(row.hours) : null),
      client_company:      row.broker_name ? String(row.broker_name) : null,
      status:              'pending',
      source:              'office',
      generated_by_ai:     true,
      source_document_url: sourceDocumentUrl ?? null,
      ai_confidence:       row.confidence != null ? Number(row.confidence) : null,
      shift:               row.shift ? String(row.shift) : null,
      phase:               row.phase ? String(row.phase) : null,
      broker_name:         row.broker_name ? String(row.broker_name) : null,
      project_number:      row.project_number ? String(row.project_number) : null,
    }

    const { data: newLoad, error } = await supabase
      .from('loads')
      .insert(payload)
      .select('id')
      .maybeSingle()

    if (error || !newLoad) {
      failed.push({ row: i, error: error?.message ?? 'Insert failed' })
      continue
    }

    imported.push(newLoad.id)

    // Create load_ticket if we have ticket number or tonnage
    const ticketNumber = row.ticket_number ? String(row.ticket_number) : null
    const tonnage      = row.tons != null ? parseFloat(String(row.tons)) : null

    if (ticketNumber || (tonnage && tonnage > 0)) {
      await supabase.from('load_tickets').insert({
        load_id:       newLoad.id,
        company_id:    companyId,
        ticket_number: ticketNumber,
        tonnage:       tonnage || null,
        image_url:     null,
      })
    }
  }

  // Update import session
  if (importId) {
    await supabase
      .from('ticket_imports')
      .update({
        status:        failed.length === rows.length ? 'failed' : 'completed',
        imported_rows: imported.length,
        skipped_rows:  failed.length,
        completed_at:  new Date().toISOString(),
      })
      .eq('id', importId)
  }

  return NextResponse.json({
    imported: imported.length,
    failed,
    ids: imported,
    importId,
  })
}
