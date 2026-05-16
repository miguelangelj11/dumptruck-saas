'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Nav from '@/components/landing/nav'
import Footer from '@/components/landing/footer'

// ─── Founding Member config — update this number as spots fill ───────────────
const FOUNDING_MEMBER_SPOTS_REMAINING = 23
const FOUNDING_MEMBER_TOTAL = 25

// ─── Plan data ───────────────────────────────────────────────────────────────

const plans = [
  {
    key: 'solo',
    name: 'Owner Operator Solo',
    tagline: 'One truck. Get organized and get paid.',
    monthlyPrice: '$15',
    popular: false,
    isEnterprise: false,
    ctaLabel: 'Start Free 30-Day Trial',
    features: [
      '1 truck & 1 driver',
      'Dashboard',
      'Unlimited ticket tracking',
      'Basic invoicing',
      'Document storage',
      '30-day free trial',
    ],
    locked: [
      'Dispatch board',
      'Revenue analytics',
      'Subcontractor management',
      'Team access',
      'AI document reader',
    ],
  },
  {
    key: 'pro',
    name: 'Owner Operator Pro',
    tagline: 'Growing your operation? This is your plan.',
    monthlyPrice: '$65',
    popular: false,
    isEnterprise: false,
    ctaLabel: 'Start Free 7-Day Trial',
    features: [
      'Up to 5 trucks & drivers',
      'Everything in Solo',
      'Full dispatch board',
      'Revenue analytics',
      'Driver management',
      'Client companies',
      '7-day free trial',
    ],
    locked: [
      'Subcontractor management',
      'Missing ticket detection',
      'Follow-up automation',
      'Team access',
      'AI document reader',
      'CRM Pipeline',
    ],
  },
  {
    key: 'fleet',
    name: 'Fleet',
    tagline: 'Run your entire operation from one dashboard.',
    monthlyPrice: '$125',
    popular: true,
    isEnterprise: false,
    ctaLabel: 'Start Free 7-Day Trial',
    features: [
      'Unlimited trucks & drivers',
      'Everything in Owner Operator Pro',
      'Subcontractor management',
      'Missing ticket detection',
      'Follow-up automation engine',
      'Auto invoice intelligence',
      'Real-time dispatch board',
      'Driver zero-friction portal',
      'Profit tracking',
      'AI dispatch recommendations',
      'Overdue invoice automation',
      'Weekly performance reports',
      'Team access (unlimited users)',
      'Client portal',
      'AI document reader (50/mo)',
      '7-day free trial',
    ],
    locked: [
      'CRM Growth Pipeline',
      'Quote builder',
      'Advanced job profitability',
      'Mobile ticket + signature',
    ],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    tagline: 'Built around your operation. Priced to match.',
    monthlyPrice: 'Custom',
    popular: false,
    isEnterprise: true,
    ctaLabel: 'Contact Us',
    features: [
      'Everything in Fleet',
      'Custom onboarding',
      'Dedicated account manager',
      'CRM Growth Pipeline',
      'Quote builder',
      'Advanced job profitability',
      'Revenue per driver & truck',
      'Customer insights dashboard',
      'Mobile ticket + signature capture',
      'AI document reader (unlimited)',
      'Documents hub',
      'Custom integrations',
      'Priority support',
      'Custom contract terms',
      'Multi-location support',
    ],
    locked: [],
  },
] as const

// ─── Comparison table ────────────────────────────────────────────────────────

type V = true | false | string

const table: { section: string; rows: { label: string; vals: [V, V, V, V] }[] }[] = [
  {
    section: 'Core Features',
    rows: [
      { label: 'Ticket management',      vals: ['Basic', 'Basic', 'Full', 'Full'] },
      { label: 'Ticket photo upload',    vals: [true, true, true, true] },
      { label: 'Full dispatch board',    vals: [false, true, true, true] },
      { label: 'AI document reader',     vals: [false, false, '50/mo', 'Unlimited'] },
      { label: 'Documents hub',          vals: [false, false, false, true] },
    ],
  },
  {
    section: 'Team & Fleet',
    rows: [
      { label: 'Trucks & drivers',       vals: ['1 each', 'Up to 5', 'Unlimited', 'Unlimited'] },
      { label: 'Team logins',            vals: ['1 (owner)', '1 (owner)', 'Unlimited', 'Unlimited'] },
      { label: 'Subcontractor mgmt',     vals: [false, false, true, true] },
      { label: 'Client portal',          vals: [false, false, true, true] },
    ],
  },
  {
    section: 'Invoicing & Automation',
    rows: [
      { label: 'Basic invoicing',            vals: [true, true, true, true] },
      { label: 'Send invoices by email',     vals: [false, false, true, true] },
      { label: 'Missing ticket detection',   vals: [false, false, true, true] },
      { label: 'Follow-up automation',       vals: [false, false, true, true] },
      { label: 'Overdue invoice automation', vals: [false, false, true, true] },
      { label: 'Weekly performance reports', vals: [false, false, true, true] },
    ],
  },
  {
    section: 'Growth & CRM',
    rows: [
      { label: 'CRM Growth Pipeline',        vals: [false, false, false, true] },
      { label: 'Quote builder',              vals: [false, false, false, true] },
      { label: 'Advanced job profitability', vals: [false, false, false, true] },
      { label: 'Mobile ticket + signature',  vals: [false, false, false, true] },
      { label: 'Revenue per driver & truck', vals: [false, false, false, true] },
    ],
  },
  {
    section: 'Support',
    rows: [
      { label: 'Support tier',   vals: ['Email', 'Email', 'Priority email', 'Dedicated manager'] },
      { label: 'Free trial',     vals: ['30 days', '7 days', '7 days', 'Custom'] },
    ],
  },
]

// ─── FAQ ─────────────────────────────────────────────────────────────────────

const faq = [
  { q: 'Is there a free trial?', a: 'Yes — Solo includes a 30-day free trial. Owner Operator Pro and Fleet include a 7-day free trial. No credit card required. Full access from day one.' },
  { q: 'Can I change plans later?', a: 'Absolutely. Upgrade or downgrade any time. Changes take effect at the next billing cycle.' },
  { q: 'What happens to my data if I cancel?', a: 'Your data stays in the system for 30 days after cancellation. You can export everything before then.' },
  { q: 'Is there a limit on load tickets?', a: 'No. All plans include unlimited ticket tracking.' },
  { q: 'What is the Enterprise plan?', a: 'Enterprise is a custom plan built around your specific operation — fleet size, integrations, onboarding, and pricing. Contact us and we\'ll put together something that fits.' },
  { q: 'Can I use DumpTruckBoss for subcontractors?', a: 'Yes. Fleet and Enterprise plans include full subcontractor management — track their loads, generate pay stubs, and settle up with one click.' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Check({ highlighted }: { highlighted: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="8" cy="8" r="8" fill={highlighted ? 'rgba(74,222,128,0.15)' : 'rgba(45,122,79,0.15)'} />
      <path d="M4.5 8l2.5 2.5 4.5-5" stroke={highlighted ? '#4ade80' : '#2d7a4f'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Cell({ v, highlighted }: { v: V; highlighted: boolean }) {
  if (v === true)  return <Check highlighted={highlighted} />
  if (v === false) return <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '18px', lineHeight: 1 }}>—</span>
  return <span style={{ fontSize: '12px', fontWeight: 600, color: highlighted ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)' }}>{v}</span>
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const router = useRouter()

  function handleStartTrial(planKey: string) {
    if (planKey === 'founding_member') {
      router.push('/founding-member')
      return
    }
    // Always go to signup for the free trial — Stripe only enters AFTER the trial ends
    setCheckoutLoading(planKey)
    router.push(`/signup?plan=${planKey}`)
  }

  const BG = '#0f1923'
  const CARD_BG = 'rgba(255,255,255,0.04)'
  const CARD_BORDER = '1px solid rgba(255,255,255,0.09)'
  const HIGHLIGHT_BG = '#1a1500'
  const HIGHLIGHT_BORDER = '2px solid #F5B731'
  const GREEN = '#F5B731'
  const GREEN_LIGHT = '#F5B731'

  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#fff' }}>
      <Nav />

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div style={{
        paddingTop: '80px',
        textAlign: 'center',
        padding: '80px 24px 0',
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}>
        <p style={{ fontSize: '12px', fontWeight: 700, color: GREEN_LIGHT, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>
          Pricing
        </p>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 52px)', fontWeight: 800, color: '#fff', marginBottom: '14px', lineHeight: 1.15, letterSpacing: '-0.02em' }}>
          Stop losing money on every load.<br />
          <span style={{ color: '#F5B731' }}>Run your dump truck business the right way.</span>
        </h1>
        <p style={{ fontSize: '17px', color: 'rgba(255,255,255,0.45)', marginBottom: '56px', lineHeight: 1.6 }}>
          Solo includes a 30-day trial. Pro &amp; Fleet include a 7-day trial. No credit card required.
        </p>
      </div>

      {/* ── Founding Member offer ─────────────────────────────────────────────── */}
      <div id="founding-member" style={{ maxWidth: '900px', margin: '0 auto 64px', padding: '0 20px' }}>
        <div style={{
          position: 'relative',
          background: 'linear-gradient(135deg, #1a0a00 0%, #0f1923 60%, #1a1000 100%)',
          border: '2px solid #F5B731',
          borderRadius: '24px',
          padding: '48px 40px',
          boxShadow: '0 0 80px rgba(245,183,49,0.18), inset 0 1px 0 rgba(255,255,255,0.05)',
          overflow: 'hidden',
        }}>
          {/* Glow effect */}
          <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(245,183,49,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

          {/* Top badges row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                background: '#F5B731',
                color: '#1a1a1a',
                fontSize: '11px',
                fontWeight: 900,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                padding: '5px 14px',
                borderRadius: '100px',
              }}>
                🔥 LIMITED — {FOUNDING_MEMBER_TOTAL} SPOTS
              </span>
            </div>
            {/* Spots remaining counter */}
            <div style={{
              background: 'rgba(245,183,49,0.12)',
              border: '1px solid rgba(245,183,49,0.35)',
              borderRadius: '100px',
              padding: '6px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80', display: 'inline-block', boxShadow: '0 0 6px #4ade80' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                {FOUNDING_MEMBER_SPOTS_REMAINING} of {FOUNDING_MEMBER_TOTAL} spots remaining
              </span>
            </div>
          </div>

          {/* Heading */}
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 900, color: '#fff', marginBottom: '8px', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            Founding Member
          </h2>

          {/* Price row */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '60px', fontWeight: 900, color: '#F5B731', lineHeight: 1 }}>$99</span>
            <span style={{ fontSize: '18px', color: 'rgba(255,255,255,0.4)' }}>/month</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '20px', color: 'rgba(255,255,255,0.3)', textDecoration: 'line-through' }}>$125</span>
              <span style={{ fontSize: '12px', fontWeight: 700, background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '6px', padding: '2px 8px' }}>
                SAVE $26/MO
              </span>
            </div>
          </div>

          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.6)', marginBottom: '36px', lineHeight: 1.5 }}>
            <strong style={{ color: '#F5B731' }}>Locked in for life.</strong> Fleet price returns to $125/mo after {FOUNDING_MEMBER_TOTAL} spots fill.
          </p>

          {/* Two-column content */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px', marginBottom: '36px' }}>
            {/* Features column */}
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>
                Everything in Fleet — nothing held back
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  'Unlimited trucks & drivers',
                  'Full dispatch board',
                  'Subcontractor management',
                  'Missing ticket detection',
                  'Follow-up automation engine',
                  'Auto invoice intelligence',
                  'AI dispatch recommendations',
                  'Driver portal',
                  'Client portal',
                  'Team access (unlimited users)',
                  'Profit tracking',
                  'AI document reader (50/mo)',
                  'Overdue invoice automation',
                  'Weekly performance reports',
                  '30-day free trial',
                ].map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
                    <span style={{ color: '#F5B731', fontWeight: 700, flexShrink: 0, marginTop: '1px' }}>✓</span>
                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)' }}>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* What we ask column */}
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>
                What we ask in return
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                {[
                  { icon: '📅', text: 'Use the software for 30 days' },
                  { icon: '✍️', text: 'Send a short written review (2–4 sentences)' },
                  { icon: '📸', text: 'Send a photo we can post next to your quote' },
                  { icon: '🏢', text: 'Let us use your company name and logo on our site' },
                ].map((item) => (
                  <li key={item.text} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '16px', flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{item.text}</span>
                  </li>
                ))}
              </ul>

              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, margin: 0 }}>
                  This is our way of building social proof with real operators. You get the software at cost, we get proof it works.
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => handleStartTrial('founding_member')}
              disabled={checkoutLoading === 'founding_member'}
              style={{
                background: '#F5B731',
                color: '#1a1a1a',
                fontSize: '17px',
                fontWeight: 900,
                padding: '16px 48px',
                borderRadius: '12px',
                border: 'none',
                cursor: checkoutLoading === 'founding_member' ? 'default' : 'pointer',
                opacity: checkoutLoading === 'founding_member' ? 0.7 : 1,
                transition: 'all 0.15s',
                letterSpacing: '-0.01em',
                boxShadow: '0 4px 24px rgba(245,183,49,0.35)',
              }}
            >
              {checkoutLoading === 'founding_member' ? 'Loading…' : 'Claim Your Founding Member Spot →'}
            </button>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', margin: 0 }}>
              30-day money-back guarantee &nbsp;·&nbsp; Cancel anytime
            </p>
          </div>
        </div>
      </div>

      {/* ── Pricing cards ─────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px 0' }}>
        <div className="plans-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', alignItems: 'stretch' }}>
          {plans.map((plan) => {
            const hl = plan.popular

            if (plan.isEnterprise) {
              return (
                <div
                  key={plan.key}
                  style={{
                    position: 'relative',
                    borderRadius: '18px',
                    padding: '32px 28px',
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'linear-gradient(135deg, #1a1a1a 0%, #111 100%)',
                    border: '2px solid rgba(255,255,255,0.12)',
                  }}
                >
                  <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>
                    Enterprise
                  </p>

                  <h3 style={{ fontSize: '22px', fontWeight: 900, color: '#fff', marginBottom: '12px' }}>Enterprise</h3>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '40px', fontWeight: 900, color: '#fff', lineHeight: 1 }}>Custom</span>
                    <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.35)' }}>pricing</span>
                  </div>

                  <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginBottom: '24px' }}>
                    {plan.tagline}
                  </p>

                  <Link
                    href="/enterprise"
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'center',
                      padding: '13px 16px',
                      borderRadius: '10px',
                      fontSize: '15px',
                      fontWeight: 700,
                      textDecoration: 'none',
                      border: '2px solid #F5B731',
                      color: '#F5B731',
                      background: 'transparent',
                      transition: 'all 0.15s',
                      marginBottom: '28px',
                    }}
                    onMouseEnter={e => { (e.target as HTMLAnchorElement).style.background = '#F5B731'; (e.target as HTMLAnchorElement).style.color = '#1a1a1a' }}
                    onMouseLeave={e => { (e.target as HTMLAnchorElement).style.background = 'transparent'; (e.target as HTMLAnchorElement).style.color = '#F5B731' }}
                  >
                    Contact Us →
                  </Link>

                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', marginBottom: '24px' }} />

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '11px' }}>
                    {plan.features.map((f) => (
                      <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <span style={{ color: '#4ade80', fontSize: '14px', fontWeight: 700, flexShrink: 0, marginTop: '1px', lineHeight: 1.4 }}>✓</span>
                        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                      Custom contract · Dedicated onboarding
                    </p>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={plan.key}
                style={{
                  position: 'relative',
                  borderRadius: '18px',
                  padding: '32px 28px',
                  display: 'flex',
                  flexDirection: 'column',
                  background: hl ? HIGHLIGHT_BG : CARD_BG,
                  border: hl ? HIGHLIGHT_BORDER : CARD_BORDER,
                  boxShadow: hl ? '0 0 48px rgba(245,183,49,0.12)' : 'none',
                  marginTop: hl ? '-8px' : '0',
                }}
              >
                {hl && (
                  <div style={{
                    position: 'absolute',
                    top: '-13px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#F5B731',
                    color: '#1a1a1a',
                    fontSize: '10px',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    padding: '4px 14px',
                    borderRadius: '100px',
                    whiteSpace: 'nowrap',
                  }}>
                    ⭐ Most Popular
                  </div>
                )}

                <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: hl ? GREEN_LIGHT : 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>
                  {plan.name}
                </p>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '44px', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{plan.monthlyPrice}</span>
                  <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.35)' }}>/mo</span>
                </div>

                <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginBottom: '24px' }}>
                  {plan.tagline}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '28px' }}>
                  <button
                    onClick={() => handleStartTrial(plan.key)}
                    disabled={checkoutLoading === plan.key}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'center',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: checkoutLoading === plan.key ? 'default' : 'pointer',
                      transition: 'opacity 0.15s',
                      border: 'none',
                      opacity: checkoutLoading === plan.key ? 0.7 : 1,
                      ...(hl
                        ? { background: '#F5B731', color: '#1a1a1a' }
                        : { background: '#1a1a1a', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' }
                      ),
                    }}
                  >
                    {checkoutLoading === plan.key ? 'Loading…' : `${plan.ctaLabel} →`}
                  </button>
                  <Link
                    href={`/signup?plan=${plan.key}&subscribe=true`}
                    style={{
                      display: 'block',
                      textAlign: 'center',
                      padding: '10px 16px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: 600,
                      textDecoration: 'none',
                      color: hl ? '#4ade80' : 'rgba(255,255,255,0.55)',
                      border: `1px solid ${hl ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.1)'}`,
                      background: 'transparent',
                      transition: 'opacity 0.15s',
                    }}
                  >
                    Subscribe Now — {plan.monthlyPrice}/mo →
                  </Link>
                </div>

                <div style={{ height: '1px', background: hl ? 'rgba(245,183,49,0.3)' : 'rgba(255,255,255,0.07)', marginBottom: '24px' }} />

                <ul style={{ listStyle: 'none', padding: 0, margin: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '11px' }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <span style={{ color: hl ? '#F5B731' : '#4ade80', fontSize: '14px', fontWeight: 700, flexShrink: 0, marginTop: '1px', lineHeight: 1.4 }}>✓</span>
                      <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{f}</span>
                    </li>
                  ))}
                  {'locked' in plan && plan.locked.map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <span style={{ fontSize: '13px', flexShrink: 0, marginTop: '1px', lineHeight: 1.4 }}>🔒</span>
                      <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.28)', lineHeight: 1.5 }}>{f}</span>
                    </li>
                  ))}
                </ul>

                <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: hl ? '1px solid rgba(245,183,49,0.3)' : '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[plan.key === 'solo' ? '30-day free trial' : '7-day free trial', 'No credit card required', 'Cancel anytime'].map((t) => (
                    <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                      <span style={{ color: hl ? GREEN_LIGHT : GREEN, fontWeight: 700 }}>✓</span>
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Comparison callout ────────────────────────────────────────────────── */}
      <div style={{ maxWidth: '800px', margin: '48px auto 0', padding: '0 20px' }}>
        <div style={{ background: 'rgba(245,183,49,0.08)', border: '1px solid rgba(245,183,49,0.25)', borderRadius: '16px', padding: '28px 32px', textAlign: 'center' }}>
          <p style={{ fontSize: '17px', fontWeight: 700, color: '#fff', marginBottom: '8px', lineHeight: 1.4 }}>
            🚛 Most Fleet operators recover $500–$2,000/month in untracked tickets.
          </p>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
            The Fleet plan pays for itself in the first week.
          </p>
        </div>
      </div>

      {/* ── Compare all features ──────────────────────────────────────────────── */}
      <div style={{ maxWidth: '1200px', margin: '88px auto 0', padding: '0 20px' }}>
        <h2 style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 800, color: '#fff', textAlign: 'center', marginBottom: '8px', letterSpacing: '-0.01em' }}>
          Compare all features
        </h2>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: '40px' }}>
          See exactly what&apos;s included in each plan.
        </p>

        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <table style={{ width: '100%', minWidth: '640px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', width: '35%', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  Feature
                </th>
                {plans.map((p) => (
                  <th key={p.key} style={{
                    padding: '14px 12px',
                    textAlign: 'center',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: p.popular ? GREEN_LIGHT : p.isEnterprise ? 'rgba(255,255,255,0.6)' : '#fff',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    background: p.popular ? 'rgba(245,183,49,0.08)' : 'transparent',
                    width: '16.25%',
                  }}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.map((section, si) => (
                <React.Fragment key={`s${si}`}>
                  <tr>
                    <td colSpan={5} style={{
                      padding: '18px 20px 8px',
                      fontSize: '10px',
                      fontWeight: 800,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.25)',
                      borderTop: si > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    }}>
                      {section.section}
                    </td>
                  </tr>
                  {section.rows.map((row, ri) => (
                    <tr key={`${si}-${ri}`} style={{ background: ri % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                      <td style={{ padding: '12px 20px', fontSize: '13px', color: 'rgba(255,255,255,0.65)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        {row.label}
                      </td>
                      {row.vals.map((v, vi) => (
                        <td key={vi} style={{
                          padding: '12px 12px',
                          textAlign: 'center',
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          background: plans[vi]?.popular ? 'rgba(245,183,49,0.05)' : 'transparent',
                        }}>
                          <Cell v={v} highlighted={!!plans[vi]?.popular} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: '720px', margin: '88px auto 0', padding: '0 20px' }}>
        <h2 style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 800, color: '#fff', textAlign: 'center', marginBottom: '40px', letterSpacing: '-0.01em' }}>
          Frequently asked questions
        </h2>
        {faq.map((item, i) => (
          <div key={i} style={{ padding: '22px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>{item.q}</p>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>{item.a}</p>
          </div>
        ))}
      </div>

      {/* ── Bottom CTA ───────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: '1200px', margin: '88px auto 0', padding: '0 20px 88px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #152a1e 0%, #0f1923 100%)',
          border: '1px solid rgba(45,122,79,0.35)',
          borderRadius: '20px',
          padding: 'clamp(48px, 8vw, 80px) 32px',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: '12px', fontWeight: 700, color: GREEN_LIGHT, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>
            Get started today
          </p>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800, color: '#fff', marginBottom: '14px', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            Ready to run your business like a boss?
          </h2>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.45)', marginBottom: '36px', maxWidth: '480px', margin: '0 auto 36px' }}>
            30-day free trial for Solo. 7-day trial for Pro &amp; Fleet. No credit card required.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/signup"
              style={{
                display: 'inline-block',
                padding: '14px 36px',
                borderRadius: '12px',
                background: GREEN,
                color: '#1a1a1a',
                fontSize: '15px',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Start Free Trial →
            </Link>
            <Link
              href="/enterprise"
              style={{
                display: 'inline-block',
                padding: '14px 36px',
                borderRadius: '12px',
                background: 'transparent',
                color: 'rgba(255,255,255,0.6)',
                fontSize: '15px',
                fontWeight: 600,
                textDecoration: 'none',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              Enterprise? Contact Us →
            </Link>
          </div>
        </div>
      </div>

      {/* Responsive grid */}
      <style>{`
        @media (max-width: 1100px) {
          .plans-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .plans-grid > div { margin-top: 0 !important; }
        }
        @media (max-width: 600px) {
          .plans-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <Footer />
    </div>
  )
}
