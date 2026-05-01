import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/dashboard/sidebar'
import ThemeInjector from '@/components/theme-injector'
import ChatWidget from '@/components/chat-widget'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check if this user is a team member (invited, not an owner)
  const { data: memberRow } = await supabase
    .from('team_members')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const isTeamMember = !!memberRow

  let co: Record<string, unknown> | null = null

  if (isTeamMember && memberRow.company_id) {
    // Team member — load the company they were invited to
    const { data } = await supabase
      .from('companies')
      .select('name, logo_url, primary_color, accent_color, onboarding_completed, trial_ends_at, subscription_status, plan')
      .eq('id', memberRow.company_id)
      .maybeSingle()
    co = data as Record<string, unknown> | null
  } else {
    // Owner — load their own company
    const { data } = await supabase
      .from('companies')
      .select('name, logo_url, primary_color, accent_color, onboarding_completed, trial_ends_at, subscription_status, plan')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    co = data as Record<string, unknown> | null
  }

  // Redirect incomplete onboarding — owners only, never team members
  if (!isTeamMember && co && co.onboarding_completed === false) {
    redirect('/onboarding')
  }

  // Trial expiry check — only runs when trial_ends_at is set (new signups)
  const trialEndsAt        = (co?.trial_ends_at       as string | null | undefined) ?? null
  const subscriptionStatus = (co?.subscription_status as string | null | undefined) ?? null

  if (subscriptionStatus === 'expired') {
    redirect('/trial-expired')
  }

  if (subscriptionStatus === 'trial' && trialEndsAt && new Date(trialEndsAt) < new Date()) {
    // Mark expired and redirect
    await supabase
      .from('companies')
      .update({ trial_expired: true, subscription_status: 'expired' })
      .eq('owner_id', user.id)
    redirect('/trial-expired')
  }

  // Past-due payment banner — shown above everything else when payment has failed
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

  // Compute trial banner
  let trialBanner: React.ReactNode = null
  if (subscriptionStatus === 'trial' && trialEndsAt) {
    const msLeft   = new Date(trialEndsAt).getTime() - Date.now()
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24))
    if (daysLeft <= 7 && daysLeft > 0) {
      const isUrgent = daysLeft <= 3
      trialBanner = (
        <div style={{
          background: isUrgent ? '#fef2f2' : '#fffbeb',
          borderBottom: `1px solid ${isUrgent ? '#fca5a5' : '#fde68a'}`,
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '16px' }}>{isUrgent ? '🚨' : '⏰'}</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: isUrgent ? '#991b1b' : '#92400e', flex: 1 }}>
            Your free trial ends in {daysLeft} day{daysLeft !== 1 ? 's' : ''}.
            {isUrgent ? ' Subscribe now or lose access.' : ' Subscribe now to keep access.'}
          </span>
          <Link
            href="/pricing"
            style={{
              fontSize: '13px',
              fontWeight: 700,
              padding: '6px 14px',
              borderRadius: '8px',
              background: isUrgent ? '#dc2626' : '#d97706',
              color: '#fff',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {isUrgent ? 'Subscribe Now →' : 'Subscribe →'}
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
        <Sidebar user={user} logoUrl={(co?.logo_url as string | null | undefined) ?? null} companyName={(co?.name as string | null | undefined) ?? null} />
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
