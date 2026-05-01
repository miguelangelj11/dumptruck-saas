import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)

  const code        = searchParams.get('code')
  const tokenHash   = searchParams.get('token_hash')
  const type        = searchParams.get('type') as EmailOtpType | null
  const next        = searchParams.get('next') ?? '/dashboard'

  const supabase = await createClient()

  // ── Email-OTP / token_hash flow (password recovery, magic link) ──────────
  // Supabase sends token_hash + type when the project uses email-link style
  // rather than PKCE.  Must be verified before the PKCE branch.
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error) {
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/reset-password`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
    return NextResponse.redirect(`${origin}/login?error=invalid_reset_link`)
  }

  // ── PKCE code flow ────────────────────────────────────────────────────────
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      if (next === '/reset-password') {
        return NextResponse.redirect(`${origin}/reset-password`)
      }

      // ── New-user account setup (owner signups only) ─────────────────────
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Auto-link driver account if the email matches an unlinked driver row
        if (user.email) {
          const { data: driverRow } = await supabase
            .from('drivers')
            .select('id, auth_user_id')
            .eq('email', user.email)
            .is('auth_user_id', null)
            .maybeSingle()
          if (driverRow) {
            await supabase.from('drivers').update({ auth_user_id: user.id }).eq('id', driverRow.id)
            return NextResponse.redirect(`${origin}/driver`)
          }
        }

        // ── Check for pending/accepted invitation by email ────────────────
        // Invited users may hit this callback before or after accept-invite runs.
        // Either way, the invitation record always exists first — use it to
        // link the user to the right company and skip creating a new one.
        if (user.email) {
          const { data: invitation } = await supabase
            .from('invitations')
            .select('company_id, role, accepted_at')
            .eq('email', user.email)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (invitation) {
            // Use service role to write team_members (RLS blocks regular client)
            const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
            const adminKey = process.env.SUPABASE_SERVICE_KEY
            if (adminUrl && adminKey) {
              const admin = createAdminClient(adminUrl, adminKey, {
                auth: { autoRefreshToken: false, persistSession: false },
              })
              await admin.from('team_members').upsert(
                { company_id: invitation.company_id, user_id: user.id, role: invitation.role },
                { onConflict: 'company_id,user_id' }
              )
              if (!invitation.accepted_at) {
                await admin.from('invitations')
                  .update({ accepted_at: new Date().toISOString() })
                  .eq('email', user.email)
                  .is('accepted_at', null)
              }
              // Delete any ghost company a DB trigger may have created
              await admin.from('companies').delete().eq('owner_id', user.id)
            }
            return NextResponse.redirect(`${origin}/dashboard`)
          }
        }

        // ── Also check team_members directly (belt-and-suspenders) ───────
        const { data: memberRow } = await supabase
          .from('team_members')
          .select('company_id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (memberRow) {
          return NextResponse.redirect(`${origin}/dashboard`)
        }

        // Ensure company row exists for owner accounts
        const { data: existing } = await supabase
          .from('companies')
          .select('id')
          .eq('owner_id', user.id)
          .limit(1)
        if (!existing?.[0]) {
          const name = user.user_metadata?.company_name ?? user.email ?? 'My Company'
          const plan = user.user_metadata?.plan ?? 'owner_operator'
          const now  = new Date()
          const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
          await supabase.from('companies').insert({
            owner_id:            user.id,
            name,
            plan,
            trial_started_at:    now.toISOString(),
            trial_ends_at:       trialEndsAt.toISOString(),
            subscription_status: 'trial',
          })
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
