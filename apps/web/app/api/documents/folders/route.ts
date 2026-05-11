import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

async function getCompanyId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from('profiles').select('organization_id').eq('id', userId).maybeSingle()
  return data?.organization_id ?? userId
}

// GET /api/documents/folders — list folders with item counts
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = await getCompanyId(supabase, user.id)

  const { data: folders } = await supabase
    .from('document_folders')
    .select('id, name, color, created_at, document_folder_items(count)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })

  const result = (folders ?? []).map(f => ({
    id:         f.id,
    name:       f.name,
    color:      f.color,
    created_at: f.created_at,
    count:      (f.document_folder_items as unknown as { count: number }[])?.[0]?.count ?? 0,
  }))

  return NextResponse.json({ folders: result })
}

// POST /api/documents/folders — create folder
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = await getCompanyId(supabase, user.id)
  const { name, color } = await request.json()

  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const { data, error } = await supabase
    .from('document_folders')
    .insert({ company_id: companyId, name: name.trim(), color: color ?? '#6366f1' })
    .select('id, name, color, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ folder: { ...data, count: 0 } })
}
