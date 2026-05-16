'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'

const tiers = [
  {
    name: 'Owner Operator Solo',
    badge: 'Solo Operators',
    badgeStyle: 'gold' as const,
    price: '$15',
    period: '/mo',
    description: 'One truck. Get organized and get paid.',
    trialBanner: { icon: '🎉', line1: '30-Day Free Trial', line2: 'No credit card required' },
    sectionHeader: null,
    cta: 'Start Free Trial →',
    href: '/signup?plan=solo',
    checkoutPlan: 'solo' as string,
    ctaStyle: 'gold' as const,
    style: 'light' as const,
    features: [
      '1 truck & 1 driver',
      'Dashboard',
      'Unlimited ticket tracking',
      'Ticket photo upload',
      'Basic invoicing',
      'Download invoices as PDF',
      'Basic revenue dashboard',
      'Document storage',
    ],
  },
  {
    name: 'Fleet',
    badge: 'Most Popular',
    badgeStyle: 'green' as const,
    price: '$125',
    period: '/mo',
    description: 'Run your entire operation from one dashboard.',
    trialBanner: { icon: '🎉', line1: '7-Day Free Trial', line2: 'No credit card required' },
    sectionHeader: 'Everything in Owner Operator Pro, plus:',
    cta: 'Start Free Trial →',
    href: '/signup?plan=fleet',
    checkoutPlan: 'fleet' as string,
    ctaStyle: 'green' as const,
    style: 'dark-green' as const,
    features: [
      'Unlimited trucks & drivers',
      'Subcontractor management',
      'Missing ticket detection',
      'Follow-up automation engine',
      'Auto invoice intelligence',
      'Real-time dispatch board',
      'Driver zero-friction portal',
      'AI dispatch recommendations',
      'Overdue invoice automation',
      'Weekly performance reports',
      'Team access (unlimited users)',
      'Client portal',
      'AI document reader (50/mo)',
    ],
  },
  {
    name: 'Enterprise',
    badge: 'Large Fleets',
    badgeStyle: 'dark-gold' as const,
    price: 'Custom',
    period: ' pricing',
    description: 'Built around your operation. Priced to match.',
    trialBanner: { icon: '🚛', line1: 'Custom Onboarding', line2: 'Dedicated account manager' },
    sectionHeader: 'Everything in Fleet, plus:',
    cta: 'Contact Sales →',
    href: '/enterprise',
    checkoutPlan: 'enterprise' as string,
    ctaStyle: 'gold-outline' as const,
    style: 'navy' as const,
    features: [
      'CRM Growth Pipeline',
      'Quote builder',
      'Advanced job profitability',
      'Revenue per driver & truck',
      'Customer insights dashboard',
      'Mobile ticket + signature capture',
      'AI document reader (unlimited)',
      'Documents hub',
      'Priority support',
      'Custom integrations',
    ],
  },
]

export default function PricingSection() {
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  async function handleCheckout(planKey: string, fallbackHref: string) {
    if (checkoutLoading) return
    if (planKey === 'enterprise') { window.location.href = fallbackHref; return }
    setCheckoutLoading(planKey)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey }),
      })
      const data = await res.json() as { url?: string }
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
          <p className="text-gray-500 text-lg max-w-xl mx-auto">Solo plan includes a 30-day trial. All other plans include a 7-day trial. No credit card required.</p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-[1100px] mx-auto pt-5 overflow-visible items-start">
          {tiers.map((tier) => {
            const isDarkGreen = tier.style === 'dark-green'
            const isNavy = tier.style === 'navy'
            const isDark = isDarkGreen || isNavy
            const cardPadding = isNavy ? '20px' : '28px'

            const badgeColors: Record<string, { background: string; color: string }> = {
              gold:        { background: '#FFB800', color: '#000000' },
              green:       { background: '#F5B731', color: '#1a1a1a' },
              'dark-gold': { background: '#0f1923', color: '#FFB800' },
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

                {/* Trial banner */}
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
                <div style={{ marginBottom: '20px' }}>
                  <h3 className={`font-bold text-lg mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {tier.name}
                  </h3>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{tier.price}</span>
                    <span className={`text-sm ${isDark ? 'text-white/50' : 'text-gray-400'}`}>{tier.period}</span>
                  </div>
                  <p className={`text-sm leading-relaxed ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                    {tier.description}
                  </p>
                </div>

                {/* CTA button */}
                <button
                  type="button"
                  onClick={() => handleCheckout(tier.checkoutPlan, tier.href)}
                  disabled={checkoutLoading === tier.checkoutPlan}
                  style={{
                    marginBottom: '12px', display: 'block', width: '100%', textAlign: 'center',
                    borderRadius: '8px', padding: '12px 16px', fontSize: '14px', fontWeight: 700,
                    cursor: checkoutLoading === tier.checkoutPlan ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                    opacity: checkoutLoading === tier.checkoutPlan ? 0.7 : 1,
                    ...(tier.ctaStyle === 'gold'
                      ? { background: '#FFB800', color: '#000', border: 'none' }
                      : tier.ctaStyle === 'green'
                      ? { background: '#F5B731', color: '#1a1a1a', border: 'none' }
                      : { background: 'transparent', color: '#FFB800', border: '1px solid #FFB800' }
                    ),
                  }}
                >
                  {checkoutLoading === tier.checkoutPlan ? 'Redirecting…' : tier.cta}
                </button>

                {/* Trust bullets */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '20px' }}>
                  {[
                    'No credit card required',
                    tier.checkoutPlan === 'enterprise' ? 'Custom contract terms' : tier.checkoutPlan === 'solo' ? 'Full access for 30 days' : 'Full access for 7 days',
                    'Cancel anytime',
                  ].map((bullet) => (
                    <div key={bullet} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: isDark ? 'rgba(255,255,255,0.6)' : '#6b7280' }}>
                      <span style={{ color: isDark ? '#4ade80' : '#F5B731', fontWeight: 600 }}>✓</span>
                      {bullet}
                    </div>
                  ))}
                </div>

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
          Solo plan includes a 30-day free trial. Pro &amp; Fleet include a 7-day trial. No credit card required. Cancel anytime.
        </p>
      </div>
    </section>
  )
}
