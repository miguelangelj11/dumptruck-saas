import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

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

  const body = await request.json().catch(() => ({}))
  const ext = String(body.ext ?? 'bin').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin'
  const path = `${companyId}/${crypto.randomUUID()}.${ext}`

  const { data, error } = await supabase.storage
    .from('company-documents')
    .createSignedUploadUrl(path)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage
    .from('company-documents')
    .getPublicUrl(path)

  return NextResponse.json({ path, token: data.token, signedUrl: data.signedUrl, publicUrl })
}
