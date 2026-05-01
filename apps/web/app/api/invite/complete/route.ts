import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await request.json() as { token?: string }
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: invite, error: lookupErr } = await admin
    .from('invitations')
    .select('id, company_id, email, role, expires_at, accepted_at')
    .eq('token', token)
    .maybeSingle()

  if (lookupErr || !invite) {
    return NextResponse.json({ error: 'Invalid invite token' }, { status: 404 })
  }
  if (invite.accepted_at) {
    return NextResponse.json({ error: 'Invite already accepted' }, { status: 409 })
  }
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invite has expired' }, { status: 410 })
  }
  // Security: the logged-in user's email must match the invite email
  if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
    return NextResponse.json({ error: 'Email mismatch' }, { status: 403 })
  }

  // Create the team_members row (upsert is safe if they somehow get here twice)
  const { error: memberErr } = await admin
    .from('team_members')
    .upsert(
      { company_id: invite.company_id, user_id: user.id, role: invite.role },
      { onConflict: 'company_id,user_id' }
    )

  if (memberErr) {
    console.error('[invite/complete] team_members insert failed:', memberErr.message)
    return NextResponse.json({ error: 'Failed to link account' }, { status: 500 })
  }

  // Driver role: link auth_user_id to the pre-created driver row if one exists
  if (invite.role === 'driver' && user.email) {
    const { data: driverRow } = await admin
      .from('drivers')
      .select('id')
      .eq('company_id', invite.company_id)
      .eq('email', user.email)
      .is('auth_user_id', null)
      .maybeSingle()
    if (driverRow) {
      await admin.from('drivers').update({ auth_user_id: user.id }).eq('id', driverRow.id)
    }
  }

  // Mark the invitation as accepted
  await admin
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('token', token)

  console.log(`[invite/complete] User ${user.id} accepted invite to company ${invite.company_id} as ${invite.role}`)
  return NextResponse.json({ ok: true, role: invite.role })
}
