'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, X } from 'lucide-react'

type Billing = 'monthly' | 'annually'

const tiers = [
  {
    name: 'Owner Operator Plan',
    badge: 'Most Popular for Solo Operators',
    badgeStyle: 'gold' as const,
    monthlyPrice: '$80',
    annualPrice: '$64',
    annualSavings: 'Save $192/year',
    period: '/mo',
    description: 'Perfect for owner-operators with 1–3 trucks',
    trialBanner: { icon: '🎉', line1: '14-Day Free Trial', line2: 'No credit card required' },
    sectionHeader: null,
    cta: 'Start Free Trial →',
    href: '/signup?plan=owner_operator',
    checkoutPlan: 'owner' as string | null,
    ctaStyle: 'gold' as const,
    showTrustBullets: true,
    showEnterpriseNote: false,
    style: 'light' as const,
    features: [
      'Up to 3 drivers',
      'Up to 200 tickets/month',
      'Basic ticket management (create, edit, delete)',
      'Ticket photo upload',
      'Basic loads tracking',
      'Simple client invoices',
      'Download invoice as PDF',
      'Basic revenue dashboard',
      'Single user login (owner only)',
      'Company logo on invoices',
    ],
  },
  {
    name: 'Fleet Plan',
    badge: 'Best for Growing Fleets',
    badgeStyle: 'green' as const,
    monthlyPrice: '$150',
    annualPrice: '$120',
    annualSavings: 'Save $360/year',
    period: '/mo',
    description: 'For growing companies with 4–15 trucks',
    trialBanner: { icon: '🎉', line1: '14-Day Free Trial', line2: 'No credit card required' },
    sectionHeader: 'Everything in Owner Operator Plan, plus:',
    cta: 'Start Free Trial →',
    href: '/signup?plan=fleet',
    checkoutPlan: 'fleet' as string | null,
    ctaStyle: 'green' as const,
    showTrustBullets: true,
    showEnterpriseNote: false,
    style: 'dark-green' as const,
    features: [
      'Up to 15 drivers',
      'Unlimited tickets',
      'Ticket photo upload (snap paper tickets)',
      'Full dispatch board (assign drivers to jobs)',
      'All 3 invoice types (Client, Driver Pay, Subcontractor)',
      'Send invoices via email',
      'Weekly auto-invoice builder',
      'Payment tracking (mark invoices paid/unpaid)',
      'Outstanding balance tracker',
      'Missing tickets alerts',
      'Driver payment history',
      'Subcontractor management',
      'Basic reporting (revenue by driver, by job)',
      'Up to 3 team logins (owner + 2 staff)',
      'Company logo on invoices',
      'Priority email support',
    ],
  },
  {
    name: 'Enterprise Plan',
    badge: 'Custom & Premium',
    badgeStyle: 'dark-gold' as const,
    monthlyPrice: '$300+',
    annualPrice: null,
    annualSavings: null,
    period: '/mo',
    description: 'For large operations with 15+ trucks or multiple locations',
    trialBanner: { icon: '🏢', line1: 'Custom Onboarding', line2: 'Tailored to your operation' },
    sectionHeader: 'Everything in Fleet Plan, plus:',
    cta: 'Join Waitlist →',
    href: '#',
    checkoutPlan: null as string | null,
    ctaStyle: 'gold-outline' as const,
    showTrustBullets: false,
    showEnterpriseNote: true,
    style: 'navy' as const,
    features: [
      'Unlimited drivers and trucks',
      'Unlimited team logins with role-based access',
      'Driver mobile app (drivers submit tickets from phone)',
      'AI ticket photo reader (auto-fills ticket data)',
      'Advanced reporting (aging reports, 30/60/90 day)',
      'Revenue by contractor, truck, job with charts',
      'Send invoices via text/SMS',
      'Auto-follow up on overdue invoices',
      'QuickBooks export (CSV)',
      'Dedicated account manager',
      'Custom onboarding included',
      'Priority phone support',
      'Custom contract available',
      'Pilot program available',
    ],
  },
]

export default function PricingSection() {
  const [billing,          setBilling]          = useState<Billing>('monthly')
  const [checkoutLoading,  setCheckoutLoading]  = useState<string | null>(null)
  const [showWaitlist,     setShowWaitlist]     = useState(false)
  const [waitlistEmail,    setWaitlistEmail]    = useState('')
  const [waitlistSent,     setWaitlistSent]     = useState(false)
  const [waitlistLoading,  setWaitlistLoading]  = useState(false)

  async function handleWaitlist(e: React.FormEvent) {
    e.preventDefault()
    if (!waitlistEmail.trim()) return
    setWaitlistLoading(true)
    try {
      await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: waitlistEmail, plan: 'enterprise' }),
      })
    } catch { /* best-effort */ }
    setWaitlistLoading(false)
    setWaitlistSent(true)
  }

  async function handleCheckout(planKey: string, fallbackHref: string) {
    if (checkoutLoading) return
    setCheckoutLoading(planKey)
    try {
      const res  = await fetch('/api/stripe/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan: planKey }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
        return
      }
    } catch {
      // fall through to fallback
    }
    setCheckoutLoading(null)
    window.location.href = fallbackHref
  }

  return (
    <section className="bg-gray-50 py-12 md:py-16" id="pricing" style={{ overflow: 'visible' }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" style={{ overflow: 'visible' }}>

        {/* Heading */}
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-[#F5B731] uppercase tracking-wider mb-3">Pricing</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Simple, honest pricing</h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">No contracts, no surprises. Owner Operator and Fleet plans include a free 14-day trial.</p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <span className={`text-sm font-medium ${billing === 'monthly' ? 'text-gray-900' : 'text-gray-400'}`}>Monthly</span>
          <button
            onClick={() => setBilling(billing === 'monthly' ? 'annually' : 'monthly')}
            className={`relative h-6 w-11 rounded-full overflow-hidden transition-colors ${billing === 'annually' ? 'bg-[#F5B731]' : 'bg-gray-300'}`}
          >
            <span
              className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
              style={{ transform: billing === 'annually' ? 'translateX(20px)' : 'translateX(0px)' }}
            />
          </button>
          <span className={`text-sm font-medium ${billing === 'annually' ? 'text-gray-900' : 'text-gray-400'}`}>Annual</span>
          <span className="text-xs font-semibold bg-[#F5B731] text-[#1a1a1a] px-2 py-0.5 rounded-full">Save 20%</span>
        </div>

        {/* Cards — single col on mobile, 3 cols on lg+ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-[1100px] mx-auto pt-5 overflow-visible items-start">
          {tiers.map((tier) => {
            const isDarkGreen = tier.style === 'dark-green'
            const isNavy = tier.style === 'navy'
            const isDark = isDarkGreen || isNavy

            const displayPrice = billing === 'annually'
              ? (tier.annualPrice ?? 'Contact us')
              : tier.monthlyPrice

            const isContactEnterprise = tier.annualPrice === null && billing === 'annually'
            const cardPadding = isNavy ? '20px' : '28px'

            const badgeColors: Record<string, { background: string; color: string }> = {
              gold:        { background: '#FFB800', color: '#000000' },
              green:       { background: '#F5B731', color: '#1a1a1a' },
              'dark-gold': { background: '#0f1923', color: '#FFB800' },
              dark:        { background: '#374151', color: '#ffffff' },
            }
            const badgeColor = badgeColors[tier.badgeStyle] ?? { background: '#374151', color: '#ffffff' }

            const trialBannerBg = isDarkGreen
              ? 'rgba(45,122,79,0.25)'
              : isNavy
              ? 'rgba(255,184,0,0.1)'
              : 'rgba(255,184,0,0.08)'
            const trialBannerBorder = isDarkGreen
              ? 'rgba(45,122,79,0.4)'
              : isNavy
              ? 'rgba(255,184,0,0.25)'
              : 'rgba(255,184,0,0.3)'
            const trialTitleColor = isDark ? '#fff' : '#374151'
            const trialSubColor = isDark ? 'rgba(255,255,255,0.55)' : '#6b7280'

            return (
              <div
                key={tier.name}
                style={{ padding: cardPadding }}
                className={`relative rounded-2xl flex flex-col ${
                  isDarkGreen
                    ? 'bg-[#1a1a1a] text-white shadow-2xl ring-2 ring-[#F5B731]'
                    : isNavy
                    ? 'bg-[#0f1923] text-white border border-white/10'
                    : 'bg-white border border-gray-200 text-gray-900'
                }`}
              >
                {/* Badge */}
                {tier.badge && (
                  <div
                    className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap"
                    style={{ background: badgeColor.background, color: badgeColor.color }}
                  >
                    {tier.badge}
                  </div>
                )}

                {/* Trial / onboarding banner */}
                <div style={{
                  background: trialBannerBg,
                  border: `1px solid ${trialBannerBorder}`,
                  borderRadius: '8px',
                  padding: '10px 14px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}>
                  <span style={{ fontSize: '20px', flexShrink: 0 }}>{tier.trialBanner.icon}</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: trialTitleColor, lineHeight: 1.3 }}>{tier.trialBanner.line1}</div>
                    <div style={{ fontSize: '12px', color: trialSubColor, lineHeight: 1.3 }}>{tier.trialBanner.line2}</div>
                  </div>
                </div>

                {/* Name + price */}
                <div style={{ marginBottom: isNavy ? '12px' : '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {tier.name}
                    </h3>
                    {isNavy && (
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: 'rgba(255,184,0,0.15)', color: '#FFB800', whiteSpace: 'nowrap' }}>
                        Coming Soon
                      </span>
                    )}
                  </div>

                  {isContactEnterprise ? (
                    <div className="mb-2">
                      <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Contact us</span>
                      <p className={`text-xs mt-1 ${isDark ? 'text-white/50' : 'text-gray-400'}`}>for annual pricing</p>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{displayPrice}</span>
                      <span className={`text-sm ${isDark ? 'text-white/50' : 'text-gray-400'}`}>{tier.period}</span>
                    </div>
                  )}

                  {billing === 'annually' && tier.annualSavings && (
                    <p className={`text-xs mb-2 font-medium ${isDark ? 'text-[#4ade80]' : 'text-[#F5B731]'}`}>
                      {tier.annualSavings} · billed annually
                    </p>
                  )}

                  <p className={`text-sm leading-relaxed ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                    {tier.description}
                  </p>
                </div>

                {/* CTA button */}
                {tier.checkoutPlan ? (
                  <button
                    type="button"
                    onClick={() => handleCheckout(tier.checkoutPlan!, tier.href)}
                    disabled={checkoutLoading === tier.checkoutPlan}
                    style={{ marginBottom: '12px', display: 'block', width: '100%', textAlign: 'center', borderRadius: '8px', padding: '12px 16px', fontSize: '14px', fontWeight: 700, border: 'none', cursor: checkoutLoading === tier.checkoutPlan ? 'not-allowed' : 'pointer', transition: 'all 0.15s', opacity: checkoutLoading === tier.checkoutPlan ? 0.7 : 1 }}
                    className={
                      tier.ctaStyle === 'gold'
                        ? 'bg-[#FFB800] text-[#000000] hover:bg-[#E6A600]'
                        : 'bg-[#F5B731] text-[#1a1a1a] hover:brightness-95'
                    }
                  >
                    {checkoutLoading === tier.checkoutPlan ? 'Redirecting…' : tier.cta}
                  </button>
                ) : isNavy ? (
                  <button
                    type="button"
                    onClick={() => setShowWaitlist(true)}
                    style={{ marginBottom: '12px', display: 'block', width: '100%', textAlign: 'center', borderRadius: '8px', padding: '12px 16px', fontSize: '14px', fontWeight: 700, border: '1px solid #FFB800', background: 'transparent', color: '#FFB800', cursor: 'pointer', transition: 'all 0.15s' }}
                  >
                    {tier.cta}
                  </button>
                ) : (
                  <Link
                    href={tier.href}
                    style={{ marginBottom: '12px', display: 'block', textAlign: 'center', borderRadius: '8px', padding: '12px 16px', fontSize: '14px', fontWeight: 700, textDecoration: 'none', transition: 'all 0.15s' }}
                    className="border border-[#FFB800] text-[#FFB800] hover:bg-[#FFB800]/10"
                  >
                    {tier.cta}
                  </Link>
                )}

                {/* Trust bullets (non-Enterprise) */}
                {tier.showTrustBullets && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '20px' }}>
                    {['No credit card required', 'Full access for 14 days', 'Cancel anytime'].map((bullet) => (
                      <div key={bullet} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: isDark ? 'rgba(255,255,255,0.6)' : '#6b7280' }}>
                        <span style={{ color: isDark ? '#4ade80' : '#F5B731', fontWeight: 600 }}>✓</span>
                        {bullet}
                      </div>
                    ))}
                  </div>
                )}

                {/* Enterprise note */}
                {tier.showEnterpriseNote && (
                  <div style={{ marginBottom: '20px' }}>
                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, marginBottom: '6px' }}>
                      Talk to our team before you commit. We'll walk you through everything.
                    </p>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>
                      Enterprise accounts are set up manually by our team.
                    </p>
                  </div>
                )}

                {/* Section header */}
                {tier.sectionHeader && (
                  <p className={`text-xs font-semibold uppercase tracking-wider mb-4 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                    {tier.sectionHeader}
                  </p>
                )}

                {/* Feature list */}
                <ul style={{ display: 'flex', flexDirection: 'column', gap: isNavy ? '5px' : '10px', flex: 1 }}>
                  {tier.features.map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <Check
                        style={{ width: '14px', height: '14px', flexShrink: 0, marginTop: '2px' }}
                        className={isDarkGreen ? 'text-[#4ade80]' : isNavy ? 'text-[#4ade80]' : 'text-[#F5B731]'}
                      />
                      <span style={{
                        fontSize: isNavy ? '13px' : '14px',
                        lineHeight: '1.4',
                        color: isDark ? 'rgba(255,255,255,0.8)' : '#4b5563',
                      }}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        <p className="text-center text-sm text-gray-400 mt-10">
          Owner Operator and Fleet plans include a 14-day free trial. No credit card required.
        </p>
      </div>

      {/* Waitlist modal */}
      {showWaitlist && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={() => setShowWaitlist(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: '16px', padding: '32px', maxWidth: '440px', width: '100%', position: 'relative' }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowWaitlist(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}
            >
              <X style={{ width: '20px', height: '20px' }} />
            </button>
            {waitlistSent ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎉</div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>You&apos;re on the list!</h3>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>We&apos;ll reach out to {waitlistEmail} when Enterprise launches.</p>
              </div>
            ) : (
              <>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>Join the Enterprise Waitlist</h3>
                <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
                  Enterprise is coming soon. Leave your email and we&apos;ll reach out first when it&apos;s ready.
                </p>
                <form onSubmit={handleWaitlist} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input
                    type="email"
                    required
                    value={waitlistEmail}
                    onChange={e => setWaitlistEmail(e.target.value)}
                    placeholder="you@company.com"
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none' }}
                  />
                  <button
                    type="submit"
                    disabled={waitlistLoading}
                    style={{ padding: '12px 20px', borderRadius: '8px', background: '#0f1923', color: '#FFB800', fontWeight: 700, fontSize: '14px', border: 'none', cursor: waitlistLoading ? 'not-allowed' : 'pointer', opacity: waitlistLoading ? 0.7 : 1 }}
                  >
                    {waitlistLoading ? 'Submitting…' : 'Join Waitlist →'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
