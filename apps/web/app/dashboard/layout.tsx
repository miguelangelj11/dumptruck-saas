import { redirect } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import Sidebar from '@/components/dashboard/sidebar'
import ThemeInjector from '@/components/theme-injector'
import ChatWidget from '@/components/chat-widget'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_KEY!
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const hdrs = await headers()
  const xPathname = hdrs.get('x-pathname') ?? ''
  const isSettingsPath = xPathname.startsWith('/dashboard/settings')

  const admin = getAdmin()

  // Single source of truth: profile.organization_id
  const { data: profile } = await admin
    .from('profiles')
    .select('organization_id, role, full_name')
    .eq('id', user.id)
    .maybeSingle()

  const organizationId = profile?.organization_id ?? null
  const isTeamMember   = !!profile && profile.role !== 'admin'

  // Load company via organization_id (profiles path), falling back to owner lookup
  // so the sidebar shows correctly even before the profiles backfill SQL has been run.
  let coData: Record<string, unknown> | null = null

  if (organizationId) {
    const { data } = await admin
      .from('companies')
      .select('name, logo_url, primary_color, accent_color, onboarding_completed, trial_ends_at, subscription_status, plan, owner_id')
      .eq('id', organizationId)
      .maybeSingle()
    coData = data as Record<string, unknown> | null
  }

  if (!coData) {
    const { data } = await admin
      .from('companies')
      .select('name, logo_url, primary_color, accent_color, onboarding_completed, trial_ends_at, subscription_status, plan, owner_id')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    coData = data as Record<string, unknown> | null
  }

  const co = coData

  // Redirect incomplete onboarding — only for the company owner
  if (!isTeamMember && co && co.onboarding_completed === false) {
    redirect('/onboarding')
  }

  const trialEndsAt        = (co?.trial_ends_at       as string | null | undefined) ?? null
  const subscriptionStatus = (co?.subscription_status as string | null | undefined) ?? null

  if (subscriptionStatus === 'expired' && !isSettingsPath) {
    redirect('/subscribe')
  }

  if (subscriptionStatus === 'trial' && trialEndsAt && new Date(trialEndsAt) < new Date()) {
    await admin
      .from('companies')
      .update({ trial_expired: true, subscription_status: 'expired' })
      .eq('id', organizationId)
    if (!isSettingsPath) redirect('/subscribe')
  }

  // Past-due payment banner
  let pastDueBanner: React.ReactNode = null
  if (subscriptionStatus === 'past_due') {
    pastDueBanner = (
      <div style={{
        background: '#fef2f2',
        borderBottom: '1px solid #fca5a5',
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '16px' }}>🚨</span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#991b1b', flex: 1 }}>
          Your last payment failed. Update your payment method to avoid losing access.
        </span>
        <Link
          href="/dashboard/settings?tab=billing"
          style={{
            fontSize: '13px',
            fontWeight: 700,
            padding: '6px 14px',
            borderRadius: '8px',
            background: '#dc2626',
            color: '#fff',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Update Payment →
        </Link>
      </div>
    )
  }

  // Trial banner — show for all 14 days
  let trialBanner: React.ReactNode = null
  if (subscriptionStatus === 'trial' && trialEndsAt) {
    const msLeft   = new Date(trialEndsAt).getTime() - Date.now()
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24))
    if (daysLeft > 0) {
      const isUrgent = daysLeft <= 3
      trialBanner = (
        <div style={{
          background: isUrgent ? '#fef2f2' : '#f0fdf4',
          borderBottom: `1px solid ${isUrgent ? '#fca5a5' : '#86efac'}`,
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '16px' }}>{isUrgent ? '🚨' : '⏰'}</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: isUrgent ? '#991b1b' : '#166534', flex: 1 }}>
            {isUrgent
              ? `Your free trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Subscribe now or lose access.`
              : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left in your free trial.`
            }
          </span>
          <Link
            href="/subscribe"
            style={{
              fontSize: '13px',
              fontWeight: 700,
              padding: '6px 14px',
              borderRadius: '8px',
              background: isUrgent ? '#dc2626' : '#2d7a4f',
              color: '#fff',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {isUrgent ? 'Subscribe Now →' : 'View Plans →'}
          </Link>
        </div>
      )
    }
  }

  const primaryColor = (co?.primary_color as string | null | undefined) ?? '#1e3a2a'
  const accentColor  = (co?.accent_color  as string | null | undefined) ?? '#2d7a4f'
  const plan         = (co?.plan          as string | null | undefined) ?? null

  return (
    <>
      <ThemeInjector primaryColor={primaryColor} accentColor={accentColor} />
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar
          user={user}
          logoUrl={(co?.logo_url as string | null | undefined) ?? null}
          companyName={(co?.name as string | null | undefined) ?? null}
          profileName={(profile as { full_name?: string | null } | null)?.full_name ?? null}
          plan={plan}
        />
        <main className="flex-1 overflow-y-auto pt-14 md:pt-0 flex flex-col">
          {pastDueBanner}
          {trialBanner}
          <div className="flex-1">
            {children}
          </div>
        </main>
      </div>
      <ChatWidget plan={plan} />
    </>
  )
}
