import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/get-company-id'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  let nav_order: string[] | null
  try {
    const body = await request.json() as { nav_order: string[] | null }
    nav_order = body.nav_order
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { error } = await supabase
    .from('companies')
    .update({ nav_order } as Record<string, unknown>)
    .eq('id', companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
