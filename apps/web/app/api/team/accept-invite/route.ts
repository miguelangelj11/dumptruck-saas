import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  console.log('[accept-invite] handler reached')

  let token: string | undefined
  let password: string | undefined

  try {
    const body = await request.json()
    token    = body.token
    password = body.password
  } catch (e) {
    console.error('[accept-invite] failed to parse request body:', e)
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!token || !password) {
    console.error('[accept-invite] missing token or password')
    return NextResponse.json({ error: 'Missing token or password' }, { status: 400 })
  }

  const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey  = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[accept-invite] missing env vars — SUPABASE_URL or SUPABASE_SERVICE_KEY not set')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── 1. Validate the invite ────────────────────────────────────────────────
  let invite: { id: string; company_id: string; email: string; role: string; expires_at: string; accepted_at: string | null } | null = null
  try {
    const { data, error } = await admin
      .from('invitations')
      .select('id, company_id, email, role, expires_at, accepted_at')
      .eq('token', token)
      .maybeSingle()
    if (error) throw error
    invite = data
  } catch (e) {
    console.error('[accept-invite] invite lookup failed:', e)
    return NextResponse.json({ error: 'Failed to look up invite' }, { status: 500 })
  }

  if (!invite) {
    console.error('[accept-invite] no invite found for token:', token)
    return NextResponse.json({ error: 'Invalid invite token' }, { status: 404 })
  }
  if (invite.accepted_at) {
    return NextResponse.json({ error: 'Invite already accepted' }, { status: 409 })
  }
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invite has expired' }, { status: 410 })
  }

  console.log('[accept-invite] invite valid for:', invite.email, 'role:', invite.role)

  // ── 2. Create auth user (or find existing) ────────────────────────────────
  let userId: string

  try {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email:         invite.email,
      password,
      email_confirm: true,
    })

    if (createErr) {
      const isExisting =
        createErr.message.toLowerCase().includes('already') ||
        createErr.message.toLowerCase().includes('registered') ||
        createErr.message.toLowerCase().includes('unique')

      if (isExisting) {
        // User already exists from a previous attempt — look them up and reuse
        console.log('[accept-invite] user already exists, looking up existing account')
        const { data: { users }, error: listErr } = await admin.auth.admin.listUsers()
        if (listErr) throw listErr
        const existing = users.find(u => u.email === invite!.email)
        if (!existing) throw new Error('User exists per createUser but not found in listUsers')
        // Update their password to the one they just set
        await admin.auth.admin.updateUserById(existing.id, { password })
        userId = existing.id
      } else {
        throw createErr
      }
    } else {
      userId = created.user.id
    }
  } catch (e) {
    console.error('[accept-invite] createUser failed:', e)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }

  console.log('[accept-invite] userId:', userId)

  // ── 2b. Delete any company auto-created by a DB trigger ──────────────────
  // Some Supabase projects have an on_auth_user_created trigger that inserts a
  // companies row for every new user. Invited team members are NOT owners, so
  // we remove it immediately to prevent the onboarding redirect.
  try {
    const { error: delErr } = await admin
      .from('companies')
      .delete()
      .eq('owner_id', userId)
    if (delErr) console.error('[accept-invite] company cleanup error (non-fatal):', delErr.message)
    else console.log('[accept-invite] cleaned up any auto-created company for team member')
  } catch (e) {
    console.error('[accept-invite] company cleanup threw (non-fatal):', e)
  }

  // ── 3. Upsert team_members ────────────────────────────────────────────────
  try {
    const { error: memberErr } = await admin
      .from('team_members')
      .upsert(
        { company_id: invite.company_id, user_id: userId, role: invite.role },
        { onConflict: 'company_id,user_id' }
      )
    if (memberErr) throw memberErr
  } catch (e) {
    console.error('[accept-invite] team_members upsert failed:', e)
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    return NextResponse.json({ error: 'Failed to link account — please try again' }, { status: 500 })
  }

  // ── 4. Link driver row if applicable ─────────────────────────────────────
  if (invite.role === 'driver') {
    try {
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
    } catch (e) {
      console.error('[accept-invite] driver link failed (non-fatal):', e)
    }
  }

  // ── 5. Mark invite accepted ───────────────────────────────────────────────
  try {
    await admin
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('token', token)
  } catch (e) {
    console.error('[accept-invite] failed to mark invite accepted (non-fatal):', e)
  }

  console.log('[accept-invite] success for:', invite.email)
  return NextResponse.json({ ok: true, role: invite.role, email: invite.email })
}
