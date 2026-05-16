import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { EmailOtpType } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { Resend } from 'resend'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_KEY!
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code      = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type      = searchParams.get('type') as EmailOtpType | null
  const next      = searchParams.get('next') ?? '/dashboard'

  const supabase = await createClient()

  // ── Email-OTP / magic link / password recovery ────────────────────────────
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error) {
      if (type === 'recovery') return NextResponse.redirect(`${origin}/reset-password`)
      return NextResponse.redirect(`${origin}${next}`)
    }
    return NextResponse.redirect(`${origin}/login?error=invalid_reset_link`)
  }

  if (!code) return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)

  const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeErr) return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)

  if (next === '/reset-password') return NextResponse.redirect(`${origin}/reset-password`)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)

  const admin = getAdmin()

  // ── 0. Check if this auth user is linked to a driver record ──────────────
  const { data: driverRecord } = await admin
    .from('drivers')
    .select('id, company_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (driverRecord) {
    // A user may have a driver record AND an elevated profile role (e.g. co-owner).
    // Check the existing profile role first — if it's not 'driver', send to the owner dashboard.
    const { data: existingDriverProf } = await admin
      .from('profiles').select('role').eq('id', user.id).maybeSingle()

    if (existingDriverProf && existingDriverProf.role !== 'driver') {
      return NextResponse.redirect(`${origin}/dashboard`)
    }

    await admin.from('profiles').upsert({
      id:              user.id,
      email:           user.email,
      organization_id: driverRecord.company_id,
      role:            'driver',
    }, { onConflict: 'id', ignoreDuplicates: true })
    return NextResponse.redirect(`${origin}/driver`)
  }

  // ── 1. Profile already exists → go to dashboard ──────────────────────────
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (existingProfile) {
    const dest = (existingProfile as Record<string, unknown>).role === 'driver' ? '/driver' : '/dashboard'
    return NextResponse.redirect(`${origin}${dest}`)
  }

  // ── 2. No profile — check for an invitation ───────────────────────────────
  const { data: invitation } = await admin
    .from('invitations')
    .select('id, company_id, role')
    .eq('email', user.email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (invitation?.company_id) {
    // Create profile linked to the inviting company
    await admin.from('profiles').insert({
      id:              user.id,
      email:           user.email,
      organization_id: invitation.company_id,
      role:            invitation.role ?? 'dispatcher',
    })
    // Mark invitation accepted
    await admin.from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)
    // Delete any ghost company the DB trigger may have auto-created
    await admin.from('companies').delete().eq('owner_id', user.id)
    return NextResponse.redirect(`${origin}/dashboard`)
  }

  // ── 3. No invitation — new owner signup ──────────────────────────────────
  // Delete ghost company if the DB trigger already created one
  await admin.from('companies').delete().eq('owner_id', user.id)

  const now = new Date()
  const { data: newCompany } = await admin
    .from('companies')
    .insert({
      owner_id:            user.id,
      name:                user.user_metadata?.company_name ?? user.email,
      plan:                user.user_metadata?.plan ?? 'pro',
      trial_started_at:    now.toISOString(),
      trial_ends_at:       new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      subscription_status: 'trial',
    })
    .select('id')
    .single()

  if (newCompany) {
    await admin.from('profiles').insert({
      id:              user.id,
      email:           user.email,
      organization_id: newCompany.id,
      role:            'admin',
    })

    // Send welcome + admin notification emails (non-fatal)
    if (process.env.RESEND_API_KEY) {
      try {
        const resend      = new Resend(process.env.RESEND_API_KEY)
        const firstName   = (user.user_metadata?.full_name as string | undefined)?.split(' ')[0]?.trim() || 'there'
        const companyName = (user.user_metadata?.company_name as string | undefined) || user.email
        const plan        = (user.user_metadata?.plan as string | undefined) ?? 'pro'
        const trialEnd    = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        const trialEndStr = trialEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        const planLabel   = plan === 'fleet' ? 'Fleet Plan' : plan === 'enterprise' ? 'Enterprise Plan' : plan === 'solo' ? 'Owner Operator Solo Plan' : 'Owner Operator Pro Plan'

        await Promise.allSettled([
          // Welcome email to new user
          resend.emails.send({
            from:    'DumpTruckBoss <noreply@dumptruckboss.com>',
            to:      user.email,
            subject: 'Welcome to DumpTruckBoss! Here\'s how to get started 🚛',
            html:    buildWelcomeEmail({ firstName, trialEndStr }),
          }),
          // Internal signup notification
          resend.emails.send({
            from:    'DumpTruckBoss Alerts <noreply@dumptruckboss.com>',
            to:      'mj@dumptruckboss.com',
            subject: `New signup: ${companyName}`,
            html:    buildAdminNotificationEmail({ email: user.email, companyName, planLabel, trialEndStr }),
          }),
        ])
      } catch {
        // Non-fatal: don't block the user from proceeding
      }
    }

    // Link Stripe subscription if the user paid before creating their account
    const stripeSessionId = user.user_metadata?.stripe_session_id as string | undefined
    if (stripeSessionId && process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe   = new Stripe(process.env.STRIPE_SECRET_KEY)
        const session  = await stripe.checkout.sessions.retrieve(stripeSessionId, { expand: ['subscription'] })
        if (session.status === 'complete' && session.customer) {
          const sub = session.subscription as Stripe.Subscription | null
          await admin.from('companies').update({
            stripe_customer_id:     session.customer as string,
            stripe_subscription_id: sub?.id ?? null,
            stripe_price_id:        sub?.items?.data[0]?.price?.id ?? null,
            subscription_status:    sub?.status === 'trialing' ? 'trial' : (sub?.status ?? null),
            ...(sub?.trial_end ? { trial_ends_at: new Date(sub.trial_end * 1000).toISOString() } : {}),
          }).eq('id', newCompany.id)
        }
      } catch {
        // Non-fatal: webhook will reconcile if linking fails
      }
    }
  }

  return NextResponse.redirect(`${origin}/onboarding`)
}

// ── Email templates ───────────────────────────────────────────────────────────

function buildWelcomeEmail({ firstName, trialEndStr }: { firstName: string; trialEndStr: string }): string {
  const steps = [
    { n: '1', title: 'Add your first driver', body: 'Go to the Drivers page and add the drivers in your fleet. You can include their name, phone, and email.' },
    { n: '2', title: 'Create a job and dispatch', body: 'Head to Dispatch and create your first job assignment. Assign a driver, set the job site, and track loads in real time.' },
    { n: '3', title: 'Log a ticket and invoice', body: 'Once a job is done, add a ticket under Tickets. Then generate a professional PDF invoice in seconds from the Invoices page.' },
  ]

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Welcome to DumpTruckBoss</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

      <!-- Header -->
      <tr>
        <td style="background:#1e3a2a;padding:28px 40px;text-align:center;">
          <img src="https://dumptruckboss.com/dtb-logo.png" alt="DumpTruckBoss" width="72" height="72" style="border-radius:50%;margin-bottom:14px;display:block;margin-left:auto;margin-right:auto;" />
          <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">DumpTruckBoss</span>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:40px 40px 32px;">
          <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#111827;letter-spacing:-0.4px;">
            Welcome to DumpTruckBoss, ${firstName}! 🚛
          </h1>
          <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
            Your account is live. You've got everything you need to run your hauling business smarter — tickets, dispatch, invoices, and revenue tracking in one place.
          </p>

          <!-- Trial callout -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;margin-bottom:32px;">
            <tr>
              <td style="padding:18px 22px;">
                <p style="margin:0;font-size:13px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.05em;">✅ 7-Day Free Trial Active</p>
                <p style="margin:6px 0 0;font-size:14px;color:#166534;">
                  Your trial runs until <strong>${trialEndStr}</strong>. Full access, no credit card required.
                </p>
              </td>
            </tr>
          </table>

          <!-- Getting started steps -->
          <h2 style="margin:0 0 20px;font-size:17px;font-weight:700;color:#111827;">Get started in 3 steps</h2>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${steps.map(s => `
            <tr>
              <td style="padding:0 0 20px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="40" valign="top" style="padding-right:14px;">
                      <div style="width:36px;height:36px;border-radius:50%;background:#2d7a4f;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:15px;text-align:center;line-height:36px;">${s.n}</div>
                    </td>
                    <td valign="top">
                      <p style="margin:0 0 3px;font-size:14px;font-weight:700;color:#111827;">${s.title}</p>
                      <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.55;">${s.body}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`).join('')}
          </table>

          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
            <tr>
              <td align="center">
                <a href="https://dumptruckboss.com/dashboard"
                   style="display:inline-block;background:#2d7a4f;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;letter-spacing:-0.2px;">
                  Go to Dashboard →
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:24px 40px;text-align:center;">
          <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;">Questions? We're here to help.</p>
          <a href="mailto:mj@dumptruckboss.com" style="font-size:12px;color:#2d7a4f;text-decoration:none;font-weight:600;">mj@dumptruckboss.com</a>
          <p style="margin:14px 0 0;font-size:11px;color:#d1d5db;">© ${new Date().getFullYear()} DumpTruckBoss — DumpTruckBoss LLC</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`
}

function buildAdminNotificationEmail({ email, companyName, planLabel, trialEndStr }: {
  email: string; companyName: string; planLabel: string; trialEndStr: string
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>New Signup</title></head>
<body style="margin:0;padding:32px;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td>
    <p style="margin:0 0 20px;font-size:20px;font-weight:800;color:#111827;">🚛 New DumpTruckBoss Signup</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
      ${[
        ['Company', companyName],
        ['Email', email],
        ['Plan', planLabel],
        ['Trial Ends', trialEndStr],
        ['Signed Up', new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }) + ' ET'],
      ].map(([label, value], i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'};">
        <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#6b7280;width:120px;white-space:nowrap;">${label}</td>
        <td style="padding:12px 16px;font-size:13px;color:#111827;font-weight:500;">${value}</td>
      </tr>`).join('')}
    </table>
    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">This is an automated alert from DumpTruckBoss.</p>
  </td></tr>
</table>
</body>
</html>`
}
