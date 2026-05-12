import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/get-company-id'
import { logTicketAudit } from '@/lib/tickets/audit'

export const runtime = 'nodejs'

const MONTHLY_LIMITS: Record<string, number> = {
  owner_operator: 10,
  fleet:          50,
  growth:         200,
  enterprise:     Infinity,
}

function mapRateType(rt: string | null | undefined): string {
  if (rt === 'per_hour') return 'hr'
  if (rt === 'per_ton')  return 'ton'
  return 'load'
}

type ImportRow = Record<string, unknown>

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Company not found' }, { status: 403 })

  let body: {
    rows: ImportRow[]
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

  // ── Plan monthly limit check ───────────────────────────────────────────
  const { data: co } = await supabase
    .from('companies')
    .select('plan, is_internal')
    .eq('id', companyId)
    .maybeSingle()

  const plan       = (co?.plan as string) ?? 'owner_operator'
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

  // ── Create import session ─────────────────────────────────────────────
  const { data: importSession } = await supabase
    .from('ticket_imports')
    .insert({
      company_id:     companyId,
      document_url:   sourceDocumentUrl ?? null,
      document_name:  documentName ?? null,
      document_type:  documentType ?? null,
      status:         'processing',
      total_rows:     rows.length,
      raw_extraction: rawExtraction ?? null,
    })
    .select('id')
    .maybeSingle()

  const importId = importSession?.id

  // ── Fetch contractors for billed_to_us matching ───────────────────────
  const { data: contractors } = await supabase
    .from('contractors')
    .select('id, name')
    .eq('company_id', companyId)
    .eq('status', 'active')

  const contractorMap = new Map<string, string>() // name.toLowerCase() → id
  for (const c of contractors ?? []) {
    contractorMap.set(c.name.toLowerCase().trim(), c.id)
  }

  // ── Process rows ──────────────────────────────────────────────────────
  const paidIds:   string[] = []
  const billedIds: string[] = []
  const failed:   Array<{ row: number; error: string }> = []

  let paidTotal   = 0
  let billedTotal = 0

  for (let i = 0; i < rows.length; i++) {
    const row      = rows[i]!
    const billing  = String(row.billing_direction ?? 'paid_to_us')
    const rateVal  = parseFloat(String(row.rate ?? 0)) || 0
    const amount   = parseFloat(String(row.estimated_amount ?? 0)) || 0
    const timeIn   = String(row.start_time ?? '')
    const timeOut  = String(row.end_time   ?? '')
    const jobName  = String(row.job_name   || 'Imported Job')
    const driver   = String(row.driver_name || 'Unknown Driver')
    const rowDate  = String(row.date || new Date().toISOString().slice(0, 10))
    const brokerName = row.broker_name ? String(row.broker_name) : null

    // ── billed_to_us: try contractor_tickets first ────────────────────
    if (billing === 'billed_to_us') {
      const brokerKey = brokerName?.toLowerCase().trim() ?? ''
      const contractorId = brokerKey ? contractorMap.get(brokerKey) : undefined

      if (contractorId) {
        // Insert into contractor_tickets
        const { data: ct, error } = await supabase
          .from('contractor_tickets')
          .insert({
            company_id:    companyId,
            contractor_id: contractorId,
            job_name:      jobName,
            client_company: null,
            date:          rowDate,
            truck_number:  row.truck_number ? String(row.truck_number) : null,
            ticket_number: row.ticket_number ? String(row.ticket_number) : null,
            material:      row.material ? String(row.material) : null,
            rate:          rateVal,
            rate_type:     mapRateType(row.rate_type as string | undefined),
            hours_worked:  timeIn && timeOut ? `${timeIn}–${timeOut}` : (row.hours ? String(row.hours) : null),
            status:        'pending',
            notes:         `AI imported${brokerName ? ` · ${brokerName}` : ''}`,
          })
          .select('id')
          .maybeSingle()

        if (error || !ct) {
          failed.push({ row: i, error: error?.message ?? 'contractor_ticket insert failed' })
          continue
        }

        billedIds.push(ct.id)
        billedTotal += amount

        // Add tonnage slip if available
        const tonnage = row.tons != null ? parseFloat(String(row.tons)) : null
        if ((row.ticket_number || tonnage) && tonnage) {
          await supabase.from('contractor_ticket_slips').insert({
            ticket_id:     ct.id,
            company_id:    companyId,
            tonnage:       tonnage || null,
            image_url:     null,
          })
        }
        continue
      }
      // No contractor match → fall through and insert into loads with billing_direction flag
    }

    // ── paid_to_us (and unmatched billed_to_us fallback) → loads ──────
    const loadPayload: Record<string, unknown> = {
      company_id:          companyId,
      job_name:            jobName,
      material:            row.material ? String(row.material) : null,
      load_type:           row.material ? String(row.material) : null,
      driver_name:         driver,
      truck_number:        row.truck_number ? String(row.truck_number) : null,
      date:                rowDate,
      rate:                rateVal,
      rate_type:           mapRateType(row.rate_type as string | undefined),
      time_in:             timeIn || null,
      time_out:            timeOut || null,
      hours_worked:        timeIn && timeOut ? `${timeIn}–${timeOut}` : (row.hours ? String(row.hours) : null),
      client_company:      brokerName,
      status:              'pending',
      source:              'office',
      generated_by_ai:     true,
      source_document_url: sourceDocumentUrl ?? null,
      ai_confidence:       row.confidence != null ? Number(row.confidence) : null,
      shift:               row.shift          ? String(row.shift)          : null,
      phase:               row.phase          ? String(row.phase)          : null,
      broker_name:         brokerName,
      project_number:      row.project_number ? String(row.project_number) : null,
      billing_direction:   billing,
      notes:               billing === 'billed_to_us' && !brokerName
        ? 'Billed to us — assign contractor manually'
        : billing === 'billed_to_us'
        ? `Billed to us by ${brokerName} — no contractor match found`
        : null,
    }

    const { data: newLoad, error } = await supabase
      .from('loads')
      .insert(loadPayload)
      .select('id')
      .maybeSingle()

    if (error || !newLoad) {
      failed.push({ row: i, error: error?.message ?? 'Insert failed' })
      continue
    }

    if (billing === 'billed_to_us') {
      billedIds.push(newLoad.id)
      billedTotal += amount
    } else {
      paidIds.push(newLoad.id)
      paidTotal += amount
    }

    // Store AI field confidence
    const conf = row.confidence != null ? Number(row.confidence) : null
    if (conf != null) {
      await supabase.from('loads').update({
        ai_field_confidence: {
          tons:      row.confidence_by_field ? (row.confidence_by_field as Record<string, number>).tons  ?? conf : conf,
          origin:    row.confidence_by_field ? (row.confidence_by_field as Record<string, number>).origin ?? conf : conf,
          total_pay: row.confidence_by_field ? (row.confidence_by_field as Record<string, number>).amount ?? conf : conf,
          driver:    row.confidence_by_field ? (row.confidence_by_field as Record<string, number>).driver ?? conf : conf,
          date:      row.confidence_by_field ? (row.confidence_by_field as Record<string, number>).date   ?? conf : conf,
        },
      }).eq('id', newLoad.id)
    }

    // Audit trail for AI import
    const { data: { user: authUser } } = await supabase.auth.getUser()
    await logTicketAudit(supabase, {
      companyId, loadId: newLoad.id,
      action: 'created',
      userId:    authUser?.id ?? '',
      userName:  authUser?.email ?? 'AI Import',
      userType:  'ai',
      newValues: { job_name: jobName, driver_name: driver, source: 'ai', generated_by_ai: true },
    })

    // Create load_ticket for tonnage / ticket number
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

  // ── Update import session ─────────────────────────────────────────────
  const totalImported = paidIds.length + billedIds.length
  if (importId) {
    await supabase
      .from('ticket_imports')
      .update({
        status:        failed.length === rows.length ? 'failed' : 'completed',
        imported_rows: totalImported,
        skipped_rows:  failed.length,
        completed_at:  new Date().toISOString(),
      })
      .eq('id', importId)
  }

  return NextResponse.json({
    success: true,
    paid_to_us:   { count: paidIds.length,   total: paidTotal,   ids: paidIds },
    billed_to_us: { count: billedIds.length, total: billedTotal, ids: billedIds },
    total_imported: totalImported,
    failed,
    importId,
    // legacy field for backward compat
    imported: totalImported,
    ids: [...paidIds, ...billedIds],
  })
}
