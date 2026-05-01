import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const { token, password } = await request.json() as { token?: string; password?: string }

  if (!token || !password) {
    return NextResponse.json({ error: 'Missing token or password' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Validate the invite
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

  // Create the auth account
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email:         invite.email,
    password,
    email_confirm: true,
  })

  if (createErr) {
    const alreadyExists =
      createErr.message.toLowerCase().includes('already') ||
      createErr.message.toLowerCase().includes('registered')
    if (alreadyExists) {
      return NextResponse.json({ error: 'already_registered' }, { status: 409 })
    }
    return NextResponse.json({ error: createErr.message }, { status: 400 })
  }

  const userId = created.user.id

  // Create team_members row
  const { error: memberErr } = await admin
    .from('team_members')
    .upsert(
      { company_id: invite.company_id, user_id: userId, role: invite.role },
      { onConflict: 'company_id,user_id' }
    )

  if (memberErr) {
    await admin.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: 'Failed to link account — please try again' }, { status: 500 })
  }

  // Link driver row if applicable
  if (invite.role === 'driver') {
    const { data: driverRow } = await admin
      .from('drivers')
      .select('id')
      .eq('company_id', invite.company_id)
      .eq('email', invite.email)
      .is('auth_user_id', null)
      .maybeSingle()
    if (driverRow) {
      await admin.from('drivers').update({ auth_user_id: userId }).eq('id', driverRow.id)
    }
  }

  // Mark invite accepted
  await admin
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('token', token)

  return NextResponse.json({ ok: true, role: invite.role, email: invite.email })
}
