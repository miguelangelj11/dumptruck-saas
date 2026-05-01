import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)

  const code      = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type      = searchParams.get('type') as EmailOtpType | null
  const next      = searchParams.get('next') ?? '/dashboard'

  const supabase = await createClient()

  // ── Email-OTP / token_hash flow (password recovery, magic link) ──────────
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

      const { data: { user } } = await supabase.auth.getUser()

      if (user?.email) {
        const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const adminKey = process.env.SUPABASE_SERVICE_KEY

        if (adminUrl && adminKey) {
          const admin = createAdminClient(adminUrl, adminKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          })

          // Check for an unaccepted invitation matching this email
          const { data: invitation } = await admin
            .from('invitations')
            .select('id, company_id, role')
            .eq('email', user.email)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (invitation && invitation.company_id) {
            // Upsert profiles (non-fatal)
            await admin.from('profiles').upsert(
              {
                id:                   user.id,
                company_id:           invitation.company_id,
                role:                 invitation.role,
                email:                user.email,
                onboarding_completed: true,
              },
              { onConflict: 'id' }
            ).then(({ error: e }) => {
              if (e) console.error('[callback] profiles upsert (non-fatal):', e.message)
            })

            // Link to the inviting company
            await admin.from('team_members').upsert(
              { company_id: invitation.company_id, user_id: user.id, role: invitation.role },
              { onConflict: 'company_id,user_id' }
            )

            // Mark invitation accepted
            await admin.from('invitations')
              .update({ accepted_at: new Date().toISOString() })
              .eq('id', invitation.id)

            // Delete any ghost company the DB trigger may have created
            await admin.from('companies').delete().eq('owner_id', user.id)

            return NextResponse.redirect(`${origin}/dashboard`)
          }

          // Auto-link driver account if unlinked driver row matches email
          const { data: driverRow } = await supabase
            .from('drivers')
            .select('id')
            .eq('email', user.email)
            .is('auth_user_id', null)
            .maybeSingle()

          if (driverRow) {
            await supabase.from('drivers').update({ auth_user_id: user.id }).eq('id', driverRow.id)
            return NextResponse.redirect(`${origin}/driver`)
          }
        }

        // Belt-and-suspenders: already a team member → go to dashboard
        if (user) {
          const { data: memberRow } = await supabase
            .from('team_members')
            .select('company_id')
            .eq('user_id', user.id)
            .maybeSingle()

          if (memberRow) {
            return NextResponse.redirect(`${origin}/dashboard`)
          }
        }

        // Owner flow — ensure company row exists
        if (user) {
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
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
