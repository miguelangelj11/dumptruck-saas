import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Public GET — called by /invite/accept to display invite info before the user submits.
// Only returns non-sensitive fields (email, role, company name, validity flags).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('t')

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await admin
    .from('invitations')
    .select('email, role, expires_at, accepted_at, companies(name)')
    .eq('token', token)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ valid: false, reason: 'invalid' })
  }
  if (data.accepted_at) {
    return NextResponse.json({ valid: false, reason: 'accepted' })
  }
  if (new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, reason: 'expired' })
  }

  return NextResponse.json({
    valid:       true,
    email:       data.email,
    role:        data.role,
    companyName: (data.companies as unknown as { name: string } | null)?.name ?? 'your team',
  })
}
