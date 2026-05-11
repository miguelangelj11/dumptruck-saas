'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BarChart2, Users, TrendingUp, ArrowLeft } from 'lucide-react'

type ReferralRow = { referral_source: string | null; count: number }
type PlanRow     = { plan: string | null; count: number }
type SignupDay   = { day: string; count: number }

export default function AdminAnalyticsPage() {
  const router = useRouter()
  const [authorized, setAuthorized]   = useState<boolean | null>(null)
  const [referrals, setReferrals]     = useState<ReferralRow[]>([])
  const [plans, setPlans]             = useState<PlanRow[]>([])
  const [signupDays, setSignupDays]   = useState<SignupDay[]>([])
  const [totalCompanies, setTotal]    = useState(0)
  const [trialCount, setTrialCount]   = useState(0)
  const [paidCount, setPaidCount]     = useState(0)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle()
      if (!profile?.organization_id) { router.replace('/dashboard'); return }

      const { data: company } = await supabase
        .from('companies')
        .select('is_super_admin')
        .eq('id', profile.organization_id)
        .maybeSingle()

      if (!(company as Record<string, unknown> | null)?.is_super_admin) {
        router.replace('/dashboard')
        return
      }
      setAuthorized(true)

      const [
        { data: allCompanies },
        { data: refRows },
        { data: planRows },
      ] = await Promise.all([
        supabase.from('companies').select('id, subscription_status, plan, created_at'),
        supabase.rpc('referral_source_breakdown') as Promise<{ data: ReferralRow[] | null }>,
        supabase.rpc('plan_distribution') as Promise<{ data: PlanRow[] | null }>,
      ])

      type CompanyRow = { id: string; subscription_status: string | null; plan: string | null; created_at: string | null }
      if (allCompanies) {
        setTotal(allCompanies.length)
        setTrialCount((allCompanies as CompanyRow[]).filter(c => c.subscription_status === 'trial').length)
        setPaidCount((allCompanies as CompanyRow[]).filter(c => c.subscription_status === 'active').length)

        const byDay: Record<string, number> = {}
        ;(allCompanies as CompanyRow[]).forEach(c => {
          if (!c.created_at) return
          const d = c.created_at.slice(0, 10)
          byDay[d] = (byDay[d] ?? 0) + 1
        })
        const sorted = Object.entries(byDay)
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-30)
          .map(([day, count]) => ({ day, count }))
        setSignupDays(sorted)
      }

      if (refRows)  setReferrals(refRows)
      if (planRows) setPlans(planRows)
    }
    load()
  }, [router])

  if (authorized === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-6 w-6 border-2 border-[var(--brand-primary)] border-t-transparent rounded-full" />
      </div>
    )
  }

  const refTotal  = referrals.reduce((s, r) => s + r.count, 0)
  const maxSig    = Math.max(...signupDays.map(d => d.count), 1)

  const REFERRAL_LABELS: Record<string, string> = {
    google:        'Google Search',
    facebook:      'Facebook / Instagram',
    youtube:       'YouTube',
    friend:        'Friend or colleague',
    industry_show: 'Trade show / event',
    other:         'Other',
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/settings" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-[var(--brand-primary)]" />
            Business Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Owner-only view · All companies</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Signups',    value: totalCompanies, icon: Users,      color: 'text-blue-600' },
          { label: 'Active Trials',    value: trialCount,     icon: TrendingUp, color: 'text-amber-500' },
          { label: 'Paid Subscribers', value: paidCount,      icon: BarChart2,  color: 'text-green-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-5">
            <div className={`${color} mb-2`}>
              <Icon className="h-5 w-5" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Signups over time (last 30 days) */}
      {signupDays.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="font-semibold text-sm text-gray-700 mb-4">Signups — last 30 days</h2>
          <div className="flex items-end gap-1.5 h-32">
            {signupDays.map(({ day, count }) => (
              <div key={day} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div
                  className="w-full bg-[var(--brand-primary)] rounded-sm opacity-80 group-hover:opacity-100 transition-opacity"
                  style={{ height: `${(count / maxSig) * 100}%`, minHeight: '4px' }}
                />
                <span className="text-[9px] text-gray-400 rotate-45 origin-left hidden group-hover:block absolute bottom-0 left-1 translate-y-full whitespace-nowrap">
                  {day.slice(5)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>{signupDays[0]?.day.slice(5)}</span>
            <span>{signupDays[signupDays.length - 1]?.day.slice(5)}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

        {/* Referral sources */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="font-semibold text-sm text-gray-700 mb-4">How did they hear about us?</h2>
          {referrals.length === 0 ? (
            <p className="text-xs text-gray-400">No referral data yet.</p>
          ) : (
            <div className="space-y-3">
              {referrals.map(r => {
                const label = REFERRAL_LABELS[r.referral_source ?? ''] ?? r.referral_source ?? 'Unknown'
                const pct   = refTotal > 0 ? Math.round((r.count / refTotal) * 100) : 0
                return (
                  <div key={r.referral_source ?? 'null'}>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>{label}</span>
                      <span className="font-semibold">{r.count} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--brand-primary)] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Plan distribution */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="font-semibold text-sm text-gray-700 mb-4">Plan distribution</h2>
          {plans.length === 0 ? (
            <p className="text-xs text-gray-400">No plan data yet.</p>
          ) : (
            <div className="space-y-3">
              {plans.map(p => {
                const planTotal = plans.reduce((s, x) => s + x.count, 0)
                const pct = planTotal > 0 ? Math.round((p.count / planTotal) * 100) : 0
                const COLORS: Record<string, string> = {
                  solo: '#6366f1', pro: '#3b82f6', fleet: '#F5B731', enterprise: '#10b981',
                }
                const color = COLORS[p.plan ?? ''] ?? '#94a3b8'
                return (
                  <div key={p.plan ?? 'null'}>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span className="capitalize">{p.plan ?? 'unknown'}</span>
                      <span className="font-semibold">{p.count} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* PostHog deep-link */}
      <div className="bg-[#1a1a1a] rounded-xl p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Full event analytics in PostHog</p>
          <p className="text-xs text-gray-400 mt-0.5">Funnels, session recordings, feature flags, and more.</p>
        </div>
        <a
          href="https://app.posthog.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-[var(--brand-primary)] border border-[var(--brand-primary)] rounded-lg px-4 py-2 hover:bg-[var(--brand-primary)] hover:text-black transition-colors whitespace-nowrap"
        >
          Open PostHog →
        </a>
      </div>

    </div>
  )
}
