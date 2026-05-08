import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_KEY ?? ''
  if (!url || !key) console.warn('[getAdmin] Missing SUPABASE env vars')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ── GET: validate token and return invite details ─────────────────────────────
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token')

  if (!token) {
    return NextResponse.json({ valid: false, reason: 'Missing token' })
  }

  try {
    const admin = getAdmin()

    const { data: invite, error } = await admin
      .from('invitations')
      .select('email, role, company_id, expires_at, accepted_at')
      .eq('token', token)
      .maybeSingle()

    if (error) {
      console.error('[accept-invite GET] lookup error:', error.message)
      return NextResponse.json({ valid: false, reason: 'Lookup failed' })
    }
    if (!invite) {
      return NextResponse.json({ valid: false, reason: 'Invalid token' })
    }
    if (invite.accepted_at) {
      return NextResponse.json({ valid: false, reason: 'Already accepted' })
    }
    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, reason: 'Expired' })
    }

    const { data: company } = await admin
      .from('companies')
      .select('name')
      .eq('id', invite.company_id)
      .maybeSingle()

    return NextResponse.json({
      valid:        true,
      email:        invite.email,
      role:         invite.role,
      company_id:   invite.company_id,
      company_name: company?.name ?? 'your team',
    })
  } catch (e) {
    console.error('[accept-invite GET] unhandled error:', e)
    return NextResponse.json({ valid: false, reason: 'Server error' })
  }
}

// ── POST: create account, link to company, sign in ───────────────────────────
export async function POST(request: Request) {
  let token: string | undefined
  let password: string | undefined

  try {
    const body = await request.json()
    token    = body.token
    password = body.password
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!token || !password) {
    return NextResponse.json({ error: 'Token and password are required' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }

  try {
    const admin = getAdmin()

    // 1. Validate invitation
    const { data: invite, error: inviteErr } = await admin
      .from('invitations')
      .select('id, email, role, company_id, expires_at, accepted_at')
      .eq('token', token)
      .maybeSingle()

    if (inviteErr) {
      console.error('[accept-invite POST] invite lookup error:', inviteErr.message)
      return NextResponse.json({ error: 'Failed to look up invitation' }, { status: 500 })
    }
    if (!invite) {
      return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 })
    }
    if (invite.accepted_at) {
      return NextResponse.json({ error: 'This invite has already been accepted' }, { status: 409 })
    }
    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invite has expired. Ask your admin for a new one.' }, { status: 410 })
    }

    console.log('[accept-invite POST] processing for:', invite.email, 'company:', invite.company_id)

    // 2. Create auth user
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email:         invite.email,
      password,
      email_confirm: true,
    })

    let userId: string

    if (createErr) {
      const isExisting =
        createErr.message.toLowerCase().includes('already') ||
        createErr.message.toLowerCase().includes('registered') ||
        createErr.message.toLowerCase().includes('unique')

      if (isExisting) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Sign in instead.' },
          { status: 409 }
        )
      }
      console.error('[accept-invite POST] createUser failed:', createErr.message)
      return NextResponse.json({ error: createErr.message }, { status: 400 })
    }

    userId = created.user.id
    console.log('[accept-invite POST] created userId:', userId)

    // 3. Delete any ghost company a DB trigger may have auto-created
    const { error: delErr } = await admin.from('companies').delete().eq('owner_id', userId)
    if (delErr) console.error('[accept-invite POST] ghost company delete (non-fatal):', delErr.message)

    // 4. Upsert profile — links user to the inviting company with correct role
    const { error: profileErr } = await admin.from('profiles').upsert(
      {
        id:                   userId,
        company_id:           invite.company_id,
        role:                 invite.role,
        email:                invite.email,
        onboarding_completed: true,
      },
      { onConflict: 'id' }
    )
    if (profileErr) console.error('[accept-invite POST] profiles upsert (non-fatal):', profileErr.message)

    // 5. Upsert team_members — this is the critical link; fail hard if it breaks
    const { error: memberErr } = await admin.from('team_members').upsert(
      { user_id: userId, company_id: invite.company_id, role: invite.role },
      { onConflict: 'company_id,user_id' }
    )
    if (memberErr) {
      console.error('[accept-invite POST] team_members upsert FAILED:', memberErr.message)
      return NextResponse.json({ error: 'Failed to link account to company. Please contact support.' }, { status: 500 })
    }

    // 6. Link driver row if applicable
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

    // 7. Mark invitation accepted
    await admin
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('token', token)

    console.log('[accept-invite POST] success for:', invite.email)
    return NextResponse.json({ success: true, email: invite.email, role: invite.role })
  } catch (e) {
    console.error('[accept-invite POST] unhandled error:', e)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
