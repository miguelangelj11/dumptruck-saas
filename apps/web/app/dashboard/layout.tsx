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

  const { data: co } = await supabase
    .from('companies')
    .select('name, logo_url, primary_color, accent_color, onboarding_completed, trial_ends_at, subscription_status, plan')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Redirect incomplete onboarding
  if (co && (co as { onboarding_completed?: boolean | null }).onboarding_completed === false) {
    redirect('/onboarding')
  }

  // Trial expiry check — only runs when trial_ends_at is set (new signups)
  const trialEndsAt      = (co as { trial_ends_at?: string | null } | null)?.trial_ends_at ?? null
  const subscriptionStatus = (co as { subscription_status?: string | null } | null)?.subscription_status ?? null

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

  const primaryColor = (co as { primary_color?: string | null } | null)?.primary_color ?? '#1e3a2a'
  const accentColor  = (co as { accent_color?:  string | null } | null)?.accent_color  ?? '#2d7a4f'
  const plan         = (co as { plan?: string | null } | null)?.plan ?? null

  return (
    <>
      <ThemeInjector primaryColor={primaryColor} accentColor={accentColor} />
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar user={user} logoUrl={co?.logo_url ?? null} companyName={(co as { name?: string | null } | null)?.name ?? null} />
        <main className="flex-1 overflow-y-auto pt-14 md:pt-0 flex flex-col">
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
