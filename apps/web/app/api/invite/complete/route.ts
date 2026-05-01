import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const { token, password, fullName } = await request.json() as {
    token?: string; password?: string; fullName?: string
  }

  if (!token || !password) {
    return NextResponse.json({ error: 'Missing token or password' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Validate the invite token
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

  // Create the auth account — email_confirm: true skips the verification email
  // (the invite token already proved they own the address)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email:         invite.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: (fullName ?? '').trim() },
  })

  if (createErr) {
    const alreadyExists =
      createErr.message.toLowerCase().includes('already') ||
      createErr.message.toLowerCase().includes('registered')
    if (alreadyExists) {
      return NextResponse.json(
        { error: 'already_registered', email: invite.email },
        { status: 409 }
      )
    }
    console.error('[invite/complete] createUser failed:', createErr.message)
    return NextResponse.json({ error: createErr.message }, { status: 400 })
  }

  const userId = created.user.id

  // Create the team_members row
  const { error: memberErr } = await admin
    .from('team_members')
    .upsert(
      { company_id: invite.company_id, user_id: userId, role: invite.role },
      { onConflict: 'company_id,user_id' }
    )

  if (memberErr) {
    // Roll back the created auth user so the invitee can retry cleanly
    await admin.auth.admin.deleteUser(userId)
    console.error('[invite/complete] team_members insert failed:', memberErr.message)
    return NextResponse.json({ error: 'Failed to link account — please try again' }, { status: 500 })
  }

  // Driver role: link auth_user_id to the pre-created driver row if one exists
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

  // Mark the invitation as accepted
  await admin
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('token', token)

  console.log(`[invite/complete] Created account for ${invite.email} in company ${invite.company_id} as ${invite.role}`)
  return NextResponse.json({ ok: true, role: invite.role, email: invite.email })
}
