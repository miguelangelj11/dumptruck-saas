import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_KEY ?? ''
  if (!url || !key) console.warn('[getAdmin] Missing SUPABASE env vars')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { email, role = 'dispatcher' } = body as { email?: string; role?: string }

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.error('[team/invite] RESEND_API_KEY not configured')
    return NextResponse.json({ error: 'Server configuration error — contact support' }, { status: 500 })
  }

  const admin = getAdmin()

  // Resolve which company the caller belongs to
  let companyId:   string | null = null
  let companyName: string | null = null

  // Path 1: caller owns a company
  const { data: ownedCompany } = await supabase
    .from('companies')
    .select('id, name')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (ownedCompany) {
    companyId   = ownedCompany.id
    companyName = ownedCompany.name
  } else {
    // Path 2: caller is an invited team member
    const { data: memberRow } = await supabase
      .from('team_members')
      .select('company_id, role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!memberRow) {
      return NextResponse.json({ error: 'No company found for this account' }, { status: 404 })
    }
    if (memberRow.role !== 'owner' && memberRow.role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can send invitations' }, { status: 403 })
    }

    const { data: teamCompany } = await admin
      .from('companies')
      .select('id, name')
      .eq('id', memberRow.company_id)
      .maybeSingle()

    if (!teamCompany) {
      return NextResponse.json({ error: 'No company found for this account' }, { status: 404 })
    }
    companyId   = teamCompany.id
    companyName = teamCompany.name
  }

  // Block solo and owner_operator plans from inviting team members
  const { data: companyForPlan } = await admin
    .from('companies')
    .select('plan')
    .eq('id', companyId!)
    .maybeSingle()

  if (companyForPlan?.plan === 'solo' || companyForPlan?.plan === 'owner_operator') {
    return NextResponse.json(
      { error: 'upgrade_required', message: 'Team invitations require the Fleet plan. Upgrade at /dashboard/settings#billing.' },
      { status: 403 },
    )
  }

  // Insert invitation — DB generates the UUID token
  const { data: invitation, error: inviteErr } = await admin
    .from('invitations')
    .insert({
      company_id: companyId!,
      email:      email.trim(),
      role:       role.toLowerCase(),
      invited_by: user.id,
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    })
    .select('token')
    .single()

  if (inviteErr || !invitation) {
    console.error('[team/invite] failed to insert invitation:', inviteErr?.message)
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
  }

  const siteUrl    = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin
  const inviteUrl  = `${siteUrl}/join?token=${invitation.token as string}`
  const roleLabel  = role.charAt(0).toUpperCase() + role.slice(1)
  const resend     = new Resend(resendKey)

  const { error: emailErr } = await resend.emails.send({
    from:    'DumpTruckBoss <noreply@dumptruckboss.com>',
    to:      email.trim(),
    subject: `You've been invited to join ${companyName} on DumpTruckBoss`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="color:#1e3a2a;margin-bottom:8px">You've been invited</h2>
        <p style="color:#374151;margin-bottom:8px">
          You've been invited to join <strong>${companyName}</strong> on DumpTruckBoss
          as a <strong>${roleLabel}</strong>.
        </p>
        <p style="color:#374151;margin-bottom:24px">
          Click the button below to create your account and accept the invitation.
          This link expires in 48 hours.
        </p>
        <a href="${inviteUrl}"
           style="display:inline-block;background:#2d7a4f;color:#fff;font-weight:700;
                  padding:12px 24px;border-radius:8px;text-decoration:none;font-size:15px">
          Accept Invitation →
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:32px">
          If you didn't expect this invitation, you can safely ignore this email.
        </p>
      </div>
    `,
  })

  if (emailErr) {
    console.error(`[team/invite] Resend failed for ${email.trim()}:`, emailErr)
    return NextResponse.json({ error: 'Failed to send invitation email' }, { status: 500 })
  }

  console.log(`[team/invite] invite sent to ${email.trim()} as ${role} by ${user.id}`)
  return NextResponse.json({ ok: true })
}
