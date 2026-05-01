import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { email, role = 'dispatcher' } = body as { email?: string; role?: string }

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  const resendKey  = process.env.RESEND_API_KEY
  if (!serviceKey) {
    console.error('[invite] SUPABASE_SERVICE_KEY is not configured')
    return NextResponse.json({ error: 'Server configuration error — contact support' }, { status: 500 })
  }
  if (!resendKey) {
    console.error('[invite] RESEND_API_KEY is not configured')
    return NextResponse.json({ error: 'Server configuration error — contact support' }, { status: 500 })
  }

  // Look up the caller's company (RLS-scoped to the authenticated user)
  const { data: company } = await supabase
    .from('companies')
    .select('id, name')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!company) {
    return NextResponse.json({ error: 'No company found for this account' }, { status: 404 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Create the invitation record — the generated token travels with the magic link
  const { data: invitation, error: inviteDbError } = await admin
    .from('invitations')
    .insert({
      company_id: company.id,
      email:      email.trim(),
      role:       role.toLowerCase(),
      invited_by: user.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('token')
    .single()

  if (inviteDbError || !invitation) {
    console.error('[invite] Failed to create invitation record:', inviteDbError?.message)
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
  }

  const siteUrl     = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin
  const inviteToken = invitation.token as string

  // Generate the Supabase magic link — invite_token rides along so auth/callback
  // can route to /invite/accept instead of creating a new company
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type:    'invite',
    email:   email.trim(),
    options: { redirectTo: `${siteUrl}/auth/callback?invite_token=${inviteToken}` },
  })

  if (linkError) {
    await admin.from('invitations').delete().eq('token', inviteToken)
    console.error(`[invite] generateLink failed for ${email.trim()}:`, linkError.message)
    return NextResponse.json({ error: linkError.message }, { status: 400 })
  }

  const inviteUrl = linkData.properties?.action_link
  if (!inviteUrl) {
    await admin.from('invitations').delete().eq('token', inviteToken)
    console.error('[invite] generateLink returned no action_link')
    return NextResponse.json({ error: 'Failed to generate invite link' }, { status: 500 })
  }

  const resend    = new Resend(resendKey)
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1)

  const { error: emailError } = await resend.emails.send({
    from:    'DumpTruckBoss <noreply@dumptruckboss.com>',
    to:      email.trim(),
    subject: `You've been invited to join ${company.name} on DumpTruckBoss`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="color:#1e3a2a;margin-bottom:8px">You've been invited</h2>
        <p style="color:#374151;margin-bottom:8px">
          You've been invited to join <strong>${company.name}</strong> on DumpTruckBoss
          as a <strong>${roleLabel}</strong>.
        </p>
        <p style="color:#374151;margin-bottom:24px">
          Click the button below to create your account and accept the invitation.
          This link expires in 7 days.
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

  if (emailError) {
    console.error(`[invite] Resend failed for ${email.trim()}:`, emailError)
    return NextResponse.json({ error: 'Failed to send invitation email' }, { status: 500 })
  }

  console.log(`[invite] Invite sent to ${email.trim()} as ${role} by user ${user.id}`)
  return NextResponse.json({ ok: true })
}
