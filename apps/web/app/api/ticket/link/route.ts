import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createBrowserClient } from '@/lib/supabase/server'
import { generateDispatchToken } from '@/lib/dispatch-token'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_KEY ?? ''
  if (!url || !key) console.warn('[getAdmin] Missing SUPABASE env vars')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing dispatch id' }, { status: 400 })

  const supabase = await createBrowserClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdmin()
  const { data: dispatch } = await admin
    .from('dispatches')
    .select('id, company_id')
    .eq('id', id)
    .maybeSingle()

  if (!dispatch) return NextResponse.json({ error: 'Dispatch not found' }, { status: 404 })

  const d = dispatch as Record<string, unknown>
  const { data: company } = await admin
    .from('companies')
    .select('plan')
    .eq('id', d.company_id as string)
    .maybeSingle()

  const plan = (company as Record<string, unknown> | null)?.plan as string | null
  if (plan !== 'growth' && plan !== 'enterprise') {
    return NextResponse.json({ error: 'upgrade_required' }, { status: 403 })
  }

  const hmac = generateDispatchToken(id)
  const token = `${id}.${hmac}`
  const base = process.env.NEXT_PUBLIC_APP_URL ?? `https://${request.headers.get('host')}`
  const url = `${base}/ticket/${token}`

  return NextResponse.json({ url })
}
