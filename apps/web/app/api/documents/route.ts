import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export type DocumentItem = {
  id: string
  category: 'ai_import' | 'ticket_photo' | 'subcontractor_photo' | 'received_invoice' | 'uploaded'
  name: string
  url: string
  mime: string
  job_name: string | null
  created_at: string
  meta: Record<string, unknown>
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()
  const companyId = profile?.organization_id ?? user.id

  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') ?? 'all'
  const search   = (searchParams.get('search') ?? '').toLowerCase().trim()
  const folderId = searchParams.get('folder_id') ?? null

  // When filtering by folder, pre-load the doc_refs in that folder
  let folderDocRefs: Set<string> | null = null
  if (folderId) {
    const { data: items } = await supabase
      .from('document_folder_items')
      .select('doc_ref')
      .eq('folder_id', folderId)
      .eq('company_id', companyId)
    folderDocRefs = new Set((items ?? []).map(i => i.doc_ref))
  }

  const docs: DocumentItem[] = []

  // ── AI Imports ───────────────────────────────────────────────────────────
  if (category === 'all' || category === 'ai_import') {
    const { data: imports } = await supabase
      .from('ticket_imports')
      .select('id, document_url, document_name, document_type, status, imported_rows, created_at')
      .eq('company_id', companyId)
      .not('document_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200)

    for (const imp of imports ?? []) {
      if (!imp.document_url) continue
      const name = imp.document_name ?? imp.document_type ?? 'AI Import'
      if (search && !name.toLowerCase().includes(search)) continue
      docs.push({
        id:       `import_${imp.id}`,
        category: 'ai_import',
        name,
        url:      imp.document_url,
        mime:     imp.document_type?.toLowerCase().includes('pdf') ? 'application/pdf' : 'image/*',
        job_name: null,
        created_at: imp.created_at,
        meta: {
          status:        imp.status,
          imported_rows: imp.imported_rows,
          import_id:     imp.id,
        },
      })
    }
  }

  // ── Ticket Photos ─────────────────────────────────────────────────────────
  if (category === 'all' || category === 'ticket_photo') {
    const { data: tickets } = await supabase
      .from('load_tickets')
      .select('id, image_url, ticket_number, created_at, loads(job_name, driver_name, date)')
      .eq('company_id', companyId)
      .not('image_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500)

    for (const t of tickets ?? []) {
      if (!t.image_url) continue
      const load = t.loads as { job_name?: string; driver_name?: string; date?: string } | null
      const name = `Ticket #${t.ticket_number ?? 'Photo'}${load?.job_name ? ` – ${load.job_name}` : ''}`
      if (search && !name.toLowerCase().includes(search) && !load?.driver_name?.toLowerCase().includes(search)) continue
      docs.push({
        id:       `lt_${t.id}`,
        category: 'ticket_photo',
        name,
        url:      t.image_url,
        mime:     'image/*',
        job_name: load?.job_name ?? null,
        created_at: t.created_at,
        meta: {
          ticket_number: t.ticket_number,
          driver_name:   load?.driver_name ?? null,
          date:          load?.date ?? null,
        },
      })
    }
  }

  // ── Subcontractor Photos ──────────────────────────────────────────────────
  if (category === 'all' || category === 'subcontractor_photo') {
    const { data: slips } = await supabase
      .from('contractor_ticket_slips')
      .select('id, image_url, tonnage, created_at, contractor_tickets(job_name, date, contractor_id, contractors(name))')
      .eq('company_id', companyId)
      .not('image_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500)

    for (const s of slips ?? []) {
      if (!s.image_url) continue
      const ct = s.contractor_tickets as { job_name?: string; date?: string; contractors?: { name?: string } | null } | null
      const contractorName = ct?.contractors?.name ?? null
      const name = `Sub Ticket${contractorName ? ` – ${contractorName}` : ''}${ct?.job_name ? ` · ${ct.job_name}` : ''}`
      if (search && !name.toLowerCase().includes(search)) continue
      docs.push({
        id:       `slip_${s.id}`,
        category: 'subcontractor_photo',
        name,
        url:      s.image_url,
        mime:     'image/*',
        job_name: ct?.job_name ?? null,
        created_at: s.created_at,
        meta: {
          contractor_name: contractorName,
          tonnage:         s.tonnage,
          date:            ct?.date ?? null,
        },
      })
    }
  }

  // ── Received Invoices ─────────────────────────────────────────────────────
  if (category === 'all' || category === 'received_invoice') {
    const { data: received } = await supabase
      .from('received_invoices')
      .select('id, file_url, subcontractor_name, their_invoice_number, amount, date_received, created_at')
      .eq('company_id', companyId)
      .not('file_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200)

    for (const r of received ?? []) {
      if (!r.file_url) continue
      const name = `Invoice from ${r.subcontractor_name}${r.their_invoice_number ? ` #${r.their_invoice_number}` : ''}`
      if (search && !name.toLowerCase().includes(search)) continue
      docs.push({
        id:       `ri_${r.id}`,
        category: 'received_invoice',
        name,
        url:      r.file_url,
        mime:     r.file_url.endsWith('.pdf') ? 'application/pdf' : 'image/*',
        job_name: null,
        created_at: r.created_at,
        meta: {
          subcontractor_name:   r.subcontractor_name,
          their_invoice_number: r.their_invoice_number,
          amount:               r.amount,
          date_received:        r.date_received,
        },
      })
    }
  }

  // ── Manually Uploaded Documents ───────────────────────────────────────────
  if (category === 'all' || category === 'uploaded') {
    const { data: uploaded } = await supabase
      .from('company_documents')
      .select('id, name, url, mime, notes, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(500)

    for (const u of uploaded ?? []) {
      if (!u.url) continue
      if (search && !u.name.toLowerCase().includes(search)) continue
      docs.push({
        id:         `upload_${u.id}`,
        category:   'uploaded',
        name:       u.name,
        url:        u.url,
        mime:       u.mime ?? 'application/octet-stream',
        job_name:   null,
        created_at: u.created_at,
        meta:       u.notes ? { notes: u.notes } : {},
      })
    }
  }

  // Filter by folder if requested
  const filtered = folderDocRefs ? docs.filter(d => folderDocRefs!.has(d.id)) : docs

  // Also attach which folder(s) each doc is in (for the UI "move" button)
  // — skip for folder-filtered views to keep response lean

  // Sort all merged docs by created_at desc
  filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return NextResponse.json({ docs: filtered, total: filtered.length })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()
  const companyId = profile?.organization_id ?? user.id

  const formData = await request.formData()
  const file  = formData.get('file') as File | null
  const name  = (formData.get('name') as string | null)?.trim() || null
  const notes = (formData.get('notes') as string | null)?.trim() || null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const ext      = file.name.split('.').pop() ?? 'bin'
  const safeName = name || file.name
  const path     = `${companyId}/${crypto.randomUUID()}.${ext}`

  const { error: storageErr } = await supabase.storage
    .from('company-documents')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (storageErr) return NextResponse.json({ error: storageErr.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage
    .from('company-documents')
    .getPublicUrl(path)

  const { data: doc, error: dbErr } = await supabase
    .from('company_documents')
    .insert({ company_id: companyId, name: safeName, url: publicUrl, mime: file.type || 'application/octet-stream', notes })
    .select('id')
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({ id: doc.id, url: publicUrl })
}
