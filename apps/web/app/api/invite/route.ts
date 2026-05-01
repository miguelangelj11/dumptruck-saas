import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export async function POST(request: Request) {
  // 1. Verify authenticated caller
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { email } = body as { email?: string }

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  // 2. Check required env vars before doing anything
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY
  const resendKey   = process.env.RESEND_API_KEY

  if (!serviceKey) {
    console.error('[invite] SUPABASE_SERVICE_KEY is not configured')
    return NextResponse.json({ error: 'Server configuration error — contact support' }, { status: 500 })
  }

  if (!resendKey) {
    console.error('[invite] RESEND_API_KEY is not configured')
    return NextResponse.json({ error: 'Server configuration error — contact support' }, { status: 500 })
  }

  // 3. Generate a Supabase invite magic link (creates the auth user + issues the token)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'invite',
    email: email.trim(),
    options: { redirectTo: `${siteUrl}/auth/callback` },
  })

  if (linkError) {
    console.error(`[invite] Failed to generate invite link for ${email.trim()} (invited by ${user.id}):`, linkError.message)
    return NextResponse.json({ error: linkError.message }, { status: 400 })
  }

  const inviteUrl = linkData.properties?.action_link
  if (!inviteUrl) {
    console.error('[invite] generateLink succeeded but action_link was empty')
    return NextResponse.json({ error: 'Failed to generate invite link' }, { status: 500 })
  }

  // 4. Send the email via Resend from the verified domain
  const resend = new Resend(resendKey)

  const { error: emailError } = await resend.emails.send({
    from: 'DumpTruckBoss <noreply@dumptruckboss.com>',
    to:   email.trim(),
    subject: "You've been invited to DumpTruckBoss",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="color:#1e3a2a;margin-bottom:8px">You've been invited</h2>
        <p style="color:#374151;margin-bottom:24px">
          You've been invited to join a team on <strong>DumpTruckBoss</strong>,
          a dispatch &amp; invoicing platform for hauling companies.
        </p>
        <a href="${inviteUrl}"
           style="display:inline-block;background:#2d7a4f;color:#fff;font-weight:700;
                  padding:12px 24px;border-radius:8px;text-decoration:none;font-size:15px">
          Accept Invitation →
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:32px">
          This link expires in 24 hours. If you didn't expect this, you can ignore it.
        </p>
      </div>
    `,
  })

  if (emailError) {
    console.error(`[invite] Resend failed to send invite to ${email.trim()} (invited by ${user.id}):`, emailError)
    return NextResponse.json({ error: 'Failed to send invitation email' }, { status: 500 })
  }

  console.log(`[invite] Invite sent to ${email.trim()} by user ${user.id}`)
  return NextResponse.json({ ok: true })
}
