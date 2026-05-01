'use client'

import { useState } from 'react'
import Link from 'next/link'
import Nav from '@/components/landing/nav'
import Footer from '@/components/landing/footer'

// ─── Data ────────────────────────────────────────────────────────────────────

type PlanKey = 'starter' | 'pro' | 'business' | 'enterprise'

const plans: {
  key: PlanKey
  name: string
  monthlyPrice: string
  annualPrice: string
  annualNote: string
  description: string
  cta: string
  ctaHref: string
  popular: boolean
  features: string[]
}[] = [
  {
    key: 'starter',
    name: 'Starter',
    monthlyPrice: '$0',
    annualPrice: '$0',
    annualNote: 'Free forever',
    description: 'Free forever to get started',
    cta: 'Get Started',
    ctaHref: '/signup',
    popular: false,
    features: [
      'Up to 2 drivers',
      'Basic ticket management',
      'PDF invoice generation',
      'Revenue dashboard',
      '1 team member seat',
      'Email support',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    monthlyPrice: '$29',
    annualPrice: '$24',
    annualNote: 'per month, billed annually',
    description: 'For growing owner-operators',
    cta: 'Start Free Trial',
    ctaHref: '/signup?plan=pro',
    popular: true,
    features: [
      'Up to 10 drivers',
      'Full dispatch board',
      'Driver app access',
      'Custom invoice branding',
      '3 team member seats',
      'Subcontractor management',
      'Priority support',
      'Send invoices by email',
    ],
  },
  {
    key: 'business',
    name: 'Business',
    monthlyPrice: '$79',
    annualPrice: '$65',
    annualNote: 'per month, billed annually',
    description: 'For established fleet operations',
    cta: 'Start Free Trial',
    ctaHref: '/signup?plan=business',
    popular: false,
    features: [
      'Unlimited drivers',
      'Everything in Pro',
      'Client portal',
      'Online payments (Stripe)',
      '10 team member seats',
      'Advanced reporting',
      'API access',
      'Weekly auto-invoicing',
    ],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 'Custom',
    annualPrice: 'Custom',
    annualNote: 'tailored to your operation',
    description: 'For large fleets & multi-location operators',
    cta: 'Contact Sales',
    ctaHref: '/schedule-demo',
    popular: false,
    features: [
      'Unlimited everything',
      'Everything in Business',
      'AI Assistant (chatbot)',
      'White labeling',
      'Custom integrations',
      'Dedicated account manager',
      'Custom onboarding',
      'Priority phone support',
    ],
  },
]

type FeatureValue = true | false | string

const comparisonSections: {
  title: string
  rows: { label: string; values: [FeatureValue, FeatureValue, FeatureValue, FeatureValue] }[]
}[] = [
  {
    title: 'Core Features',
    rows: [
      { label: 'Dispatching',       values: [false, true, true, true] },
      { label: 'Ticket Management', values: ['Basic', true, true, true] },
      { label: 'Invoice Generation', values: ['PDF only', true, true, true] },
      { label: 'Driver App Access', values: [false, true, true, true] },
      { label: 'Revenue Dashboard', values: [true, true, true, true] },
    ],
  },
  {
    title: 'Team & Fleet',
    rows: [
      { label: 'Number of drivers',     values: ['2', '10', 'Unlimited', 'Unlimited'] },
      { label: 'Truck management',       values: [true, true, true, true] },
      { label: 'Subcontractor management', values: [false, true, true, true] },
      { label: 'Team member seats',     values: ['1', '3', '10', 'Unlimited'] },
    ],
  },
  {
    title: 'Invoicing & Payments',
    rows: [
      { label: 'PDF invoice generation',   values: [true, true, true, true] },
      { label: 'Custom invoice branding',  values: [false, true, true, true] },
      { label: 'Client portal',            values: [false, false, true, true] },
      { label: 'Online payments (Stripe)', values: [false, false, true, true] },
    ],
  },
  {
    title: 'Advanced',
    rows: [
      { label: 'Priority support',        values: [false, true, true, true] },
      { label: 'API access',              values: [false, false, true, true] },
      { label: 'Custom integrations',     values: [false, false, false, true] },
      { label: 'AI Assistant',            values: [false, false, false, true] },
      { label: 'White labeling',          values: [false, false, false, true] },
      { label: 'Dedicated account manager', values: [false, false, false, true] },
    ],
  },
]

const faq = [
  { q: 'Is there a free trial?', a: 'Yes — the Pro and Business plans include a 14-day free trial, no credit card required. The Starter plan is free forever.' },
  { q: 'Can I change plans later?', a: 'Absolutely. Upgrade or downgrade any time. Changes take effect at the next billing cycle.' },
  { q: 'What happens to my data if I cancel?', a: 'Your data stays in the system for 30 days after cancellation. Export everything before then.' },
  { q: 'Is there a limit on load tickets?', a: 'Starter is limited to 100 tickets/month. Pro and above include unlimited load tickets.' },
  { q: 'How does annual billing work?', a: 'Pay for 12 months upfront and get roughly 20% off. You can switch from monthly to annual at any time.' },
]

// ─── Cell renderer ────────────────────────────────────────────────────────────

function Cell({ value, isHighlighted }: { value: FeatureValue; isHighlighted: boolean }) {
  const dim = isHighlighted ? 'rgba(255,255,255,0.35)' : '#9ca3af'
  const bright = isHighlighted ? '#4ade80' : '#2d7a4f'
  const text = isHighlighted ? 'rgba(255,255,255,0.9)' : '#374151'

  if (value === true)  return <span style={{ color: bright, fontSize: '16px', fontWeight: 700 }}>✓</span>
  if (value === false) return <span style={{ color: dim, fontSize: '16px' }}>—</span>
  return <span style={{ fontSize: '13px', fontWeight: 600, color: text }}>{value}</span>
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const [annual, setAnnual] = useState(false)

  return (
    <div style={{ background: '#0f1923', minHeight: '100vh' }}>
      <Nav />

      {/* ── Hero ── */}
      <div style={{ paddingTop: '96px', paddingBottom: '0', textAlign: 'center', padding: '96px 24px 0' }}>
        <p style={{ fontSize: '13px', fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>
          Pricing
        </p>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 800, color: '#fff', marginBottom: '12px', lineHeight: 1.2 }}>
          Choose a plan built for your hauling business.
        </h1>
        <p style={{ fontSize: '17px', color: 'rgba(255,255,255,0.5)', marginBottom: '40px' }}>
          Or start free, and upgrade at any time.
        </p>

        {/* Toggle */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '100px', padding: '6px 16px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: annual ? 'rgba(255,255,255,0.4)' : '#fff', transition: 'color 0.2s' }}>
            Monthly
          </span>
          <button
            onClick={() => setAnnual(a => !a)}
            aria-label="Toggle billing period"
            style={{
              position: 'relative',
              width: '44px',
              height: '24px',
              borderRadius: '100px',
              border: 'none',
              background: annual ? '#2d7a4f' : 'rgba(255,255,255,0.2)',
              cursor: 'pointer',
              transition: 'background 0.2s',
              flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute',
              top: '3px',
              left: annual ? '23px' : '3px',
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
          </button>
          <span style={{ fontSize: '13px', fontWeight: 600, color: annual ? '#fff' : 'rgba(255,255,255,0.4)', transition: 'color 0.2s' }}>
            Annual
          </span>
          <span style={{ fontSize: '11px', fontWeight: 700, background: '#2d7a4f', color: '#fff', padding: '2px 8px', borderRadius: '100px' }}>
            Save ~20%
          </span>
        </div>
      </div>

      {/* ── Pricing Cards ── */}
      <div style={{ maxWidth: '1200px', margin: '48px auto 0', padding: '0 24px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          alignItems: 'start',
        }}
          className="pricing-grid"
        >
          {plans.map((plan) => {
            const price = annual ? plan.annualPrice : plan.monthlyPrice
            const isEnterprise = plan.key === 'enterprise'
            const isHighlighted = plan.popular

            return (
              <div
                key={plan.key}
                style={{
                  position: 'relative',
                  borderRadius: '16px',
                  padding: '28px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  background: isHighlighted ? '#1e3a2a' : 'rgba(255,255,255,0.05)',
                  border: isHighlighted ? '2px solid #2d7a4f' : '1px solid rgba(255,255,255,0.1)',
                  boxShadow: isHighlighted ? '0 0 40px rgba(45,122,79,0.2)' : 'none',
                }}
              >
                {/* Popular badge */}
                {plan.popular && (
                  <div style={{
                    position: 'absolute',
                    top: '-13px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#2d7a4f',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 12px',
                    borderRadius: '100px',
                    whiteSpace: 'nowrap',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}>
                    Most Popular
                  </div>
                )}

                {/* Plan name */}
                <p style={{ fontSize: '13px', fontWeight: 700, color: isHighlighted ? '#4ade80' : 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                  {plan.name}
                </p>

                {/* Price */}
                <div style={{ marginBottom: '6px' }}>
                  {isEnterprise ? (
                    <span style={{ fontSize: '32px', fontWeight: 800, color: '#fff' }}>Custom</span>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span style={{ fontSize: '40px', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{price}</span>
                      {price !== '$0' && <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>/mo</span>}
                    </div>
                  )}
                </div>

                {/* Annual note */}
                <p style={{ fontSize: '12px', color: isHighlighted ? '#4ade80' : 'rgba(255,255,255,0.35)', marginBottom: '8px', minHeight: '16px' }}>
                  {annual && !isEnterprise && plan.key !== 'starter' ? plan.annualNote : isEnterprise ? plan.annualNote : ''}
                </p>

                {/* Description */}
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, marginBottom: '24px' }}>
                  {plan.description}
                </p>

                {/* CTA */}
                <Link
                  href={plan.ctaHref}
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '11px 16px',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    marginBottom: '24px',
                    transition: 'opacity 0.15s',
                    background: isHighlighted ? '#2d7a4f' : isEnterprise ? 'transparent' : 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    border: isEnterprise ? '1px solid rgba(255,255,255,0.25)' : 'none',
                  }}
                >
                  {plan.cta}
                </Link>

                {/* Feature list */}
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ color: isHighlighted ? '#4ade80' : '#2d7a4f', fontWeight: 700, fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>✓</span>
                      <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Comparison Table ── */}
      <div style={{ maxWidth: '1200px', margin: '80px auto 0', padding: '0 24px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#fff', marginBottom: '8px', textAlign: 'center' }}>
          Compare all features
        </h2>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: '40px' }}>
          See exactly what's included in each plan.
        </p>

        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', minWidth: '640px', borderCollapse: 'collapse' }}>
            {/* Column headers */}
            <thead>
              <tr>
                <th style={{ width: '36%', padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  Feature
                </th>
                {plans.map((plan) => (
                  <th key={plan.key} style={{
                    width: '16%',
                    padding: '12px 8px',
                    textAlign: 'center',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: plan.popular ? '#4ade80' : '#fff',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    background: plan.popular ? 'rgba(45,122,79,0.1)' : 'transparent',
                  }}>
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonSections.map((section, si) => (
                <>
                  {/* Section header row */}
                  <tr key={`section-${si}`}>
                    <td
                      colSpan={5}
                      style={{
                        padding: '20px 16px 8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'rgba(255,255,255,0.35)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      {section.title}
                    </td>
                  </tr>

                  {/* Feature rows */}
                  {section.rows.map((row, ri) => (
                    <tr
                      key={`${si}-${ri}`}
                      style={{ background: ri % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}
                    >
                      <td style={{ padding: '13px 16px', fontSize: '13px', color: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        {row.label}
                      </td>
                      {row.values.map((val, vi) => (
                        <td
                          key={vi}
                          style={{
                            padding: '13px 8px',
                            textAlign: 'center',
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            background: plans[vi]?.popular ? 'rgba(45,122,79,0.06)' : 'transparent',
                          }}
                        >
                          <Cell value={val} isHighlighted={!!plans[vi]?.popular} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── FAQ ── */}
      <div style={{ maxWidth: '720px', margin: '80px auto 0', padding: '0 24px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#fff', marginBottom: '32px', textAlign: 'center' }}>
          Frequently asked questions
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {faq.map((item) => (
            <div
              key={item.q}
              style={{ padding: '20px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
            >
              <p style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>{item.q}</p>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>{item.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom CTA ── */}
      <div style={{ maxWidth: '1200px', margin: '80px auto 0', padding: '0 24px 80px' }}>
        <div style={{
          background: '#1e3a2a',
          border: '1px solid rgba(45,122,79,0.4)',
          borderRadius: '20px',
          padding: '64px 32px',
          textAlign: 'center',
        }}>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, color: '#fff', marginBottom: '12px', lineHeight: 1.25 }}>
            Ready to run your business like a boss?
          </h2>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)', marginBottom: '32px' }}>
            14-day free trial. No credit card required. Cancel anytime.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/signup"
              style={{
                display: 'inline-block',
                padding: '14px 32px',
                borderRadius: '12px',
                background: '#2d7a4f',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Start Free Trial
            </Link>
            <Link
              href="/schedule-demo"
              style={{
                display: 'inline-block',
                padding: '14px 32px',
                borderRadius: '12px',
                background: 'transparent',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 600,
                textDecoration: 'none',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              Schedule a Demo
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile responsive styles */}
      <style>{`
        @media (max-width: 900px) {
          .pricing-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 560px) {
          .pricing-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <Footer />
    </div>
  )
}
