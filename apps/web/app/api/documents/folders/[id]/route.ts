import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

async function getCompanyId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from('profiles').select('organization_id').eq('id', userId).maybeSingle()
  return data?.organization_id ?? userId
}

type Params = { params: Promise<{ id: string }> }

// DELETE /api/documents/folders/[id] — delete folder
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = await getCompanyId(supabase, user.id)

  const { error } = await supabase
    .from('document_folders')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PATCH /api/documents/folders/[id] — rename folder
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = await getCompanyId(supabase, user.id)
  const { name, color } = await request.json()

  const updates: Record<string, string> = {}
  if (name?.trim()) updates.name = name.trim()
  if (color) updates.color = color

  const { error } = await supabase
    .from('document_folders')
    .update(updates)
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// POST /api/documents/folders/[id] — add or remove a doc from this folder
// body: { doc_ref: string, action: 'add' | 'remove' }
export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = await getCompanyId(supabase, user.id)
  const { doc_ref, action } = await request.json()

  if (!doc_ref) return NextResponse.json({ error: 'doc_ref required' }, { status: 400 })

  if (action === 'remove') {
    await supabase
      .from('document_folder_items')
      .delete()
      .eq('folder_id', id)
      .eq('doc_ref', doc_ref)
      .eq('company_id', companyId)
  } else {
    await supabase
      .from('document_folder_items')
      .upsert({ folder_id: id, doc_ref, company_id: companyId }, { onConflict: 'folder_id,doc_ref' })
  }

  return NextResponse.json({ ok: true })
}
