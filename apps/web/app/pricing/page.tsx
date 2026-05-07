'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Nav from '@/components/landing/nav'
import Footer from '@/components/landing/footer'

// ─── Plan data ───────────────────────────────────────────────────────────────

const plans = [
  {
    key: 'solo',
    name: 'Solo',
    tagline: 'For the one-man operation — 1 truck, 1 driver',
    monthlyPrice: '$25',
    popular: false,
    ctaLabel: 'Start Free 7-Day Trial',
    features: [
      '1 truck & 1 driver',
      'Ticket tracking (unlimited)',
      'Basic invoicing',
      'Basic dashboard',
      '7-day free trial',
    ],
    locked: [
      'Dispatching & job management',
      'Subcontractor management',
      'Revenue & profit tracking',
      'CRM Pipeline',
      'Team access',
    ],
  },
  {
    key: 'owner_operator',
    name: 'Owner Operator',
    tagline: 'Perfect for solo operators with up to 5 trucks',
    monthlyPrice: '$80',
    popular: false,
    ctaLabel: 'Start Free 7-Day Trial',
    features: [
      'Up to 5 trucks & 5 drivers',
      'Dispatching & job management',
      'Ticket tracking (unlimited)',
      'Basic invoicing',
      'Basic dashboard',
      'Driver management',
      'Client companies',
      '7-day free trial',
    ],
    locked: [
      'Subcontractor management',
      'Missing ticket detection',
      'Follow-up automation',
      'Auto invoice intelligence',
      'Profit tracking',
      'AI dispatch recommendations',
      'CRM Pipeline',
      'AI document reader',
      'Team access',
    ],
  },
  {
    key: 'fleet',
    name: 'Fleet',
    tagline: 'For growing companies that need full control',
    monthlyPrice: '$200',
    popular: true,
    ctaLabel: 'Start Free 7-Day Trial',
    features: [
      'Unlimited trucks & drivers',
      'Everything in Owner Operator',
      'Subcontractor management',
      'Missing ticket detection',
      'Follow-up automation engine',
      'Auto invoice intelligence',
      'Real-time dispatch board',
      'Driver zero-friction portal',
      'Basic profit tracking',
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
      'Customer insights',
      'Mobile ticket + signature',
    ],
  },
  {
    key: 'growth',
    name: 'Growth',
    tagline: 'For operators ready to grow their business',
    monthlyPrice: '$350',
    popular: false,
    ctaLabel: 'Start Free 7-Day Trial',
    features: [
      'Everything in Fleet',
      'CRM Growth Pipeline',
      'Lead & job tracking',
      'Quote builder',
      'Convert quotes → jobs → invoices',
      'Advanced job profitability',
      'Revenue per driver & truck',
      'Customer insights dashboard',
      'Top clients & slow payer tracking',
      'Mobile ticket with signature capture',
      'AI document reader (400/mo)',
      'Documents hub',
      'Priority support',
      '7-day free trial',
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
      { label: 'AI document reader',     vals: [false, false, '50/mo', '400/mo'] },
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
      { label: 'Support tier',   vals: ['Email', 'Email', 'Priority email', 'Priority phone'] },
      { label: 'Free trial',     vals: ['7 days', '7 days', '7 days', '7 days'] },
    ],
  },
]

// ─── FAQ ─────────────────────────────────────────────────────────────────────

const faq = [
  { q: 'Is there a free trial?', a: 'Yes — all plans include a 7-day free trial. No credit card required. Full access from day one.' },
  { q: 'Can I change plans later?', a: 'Absolutely. Upgrade or downgrade any time. Changes take effect at the next billing cycle.' },
  { q: 'What happens to my data if I cancel?', a: 'Your data stays in the system for 30 days after cancellation. You can export everything before then.' },
  { q: 'Is there a limit on load tickets?', a: 'No. All plans include unlimited ticket tracking.' },
  { q: 'What is the Growth plan?', a: 'Growth adds the full CRM Pipeline, quote builder, advanced profitability reports, mobile ticket capture with signature, and 400 AI document reads per month — everything you need to win more jobs and scale revenue.' },
  { q: 'Can I use DumpTruckBoss for subcontractors?', a: 'Yes. Fleet and Growth plans include full subcontractor management — track their loads, generate pay stubs, and settle up with one click.' },
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

  async function handleStartTrial(planKey: string) {
    setCheckoutLoading(planKey)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey }),
      })
      const data = await res.json() as { url?: string; redirect?: string }
      if (res.status === 401 || data.redirect) {
        router.push(data.redirect ?? `/signup?plan=${planKey}`)
        return
      }
      if (res.status === 302) {
        router.push(data.redirect ?? '/onboarding')
        return
      }
      if (data.url) {
        window.location.href = data.url
        return
      }
    } catch {
      // fall through to signup
    }
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
          All plans include a free 7-day trial. No credit card required.
        </p>
      </div>

      {/* ── Pricing cards ─────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px 0' }}>
        <div className="plans-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', alignItems: 'stretch' }}>
          {plans.map((plan) => {
            const hl = plan.popular

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
                  boxShadow: hl ? '0 0 48px rgba(45,122,79,0.18)' : 'none',
                  marginTop: hl ? '-8px' : '0',
                }}
              >
                {/* Popular badge */}
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

                {/* Plan name */}
                <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: hl ? GREEN_LIGHT : 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>
                  {plan.name}
                </p>

                {/* Price block */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '44px', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{plan.monthlyPrice}</span>
                  <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.35)' }}>/mo</span>
                </div>

                {/* Tagline */}
                <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginBottom: '24px' }}>
                  {plan.tagline}
                </p>

                {/* CTA */}
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

                {/* Divider */}
                <div style={{ height: '1px', background: hl ? 'rgba(45,122,79,0.3)' : 'rgba(255,255,255,0.07)', marginBottom: '24px' }} />

                {/* Feature list */}
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

                {/* Trust bullets */}
                <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: hl ? '1px solid rgba(45,122,79,0.3)' : '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {['7-day free trial', 'No credit card required', 'Cancel anytime'].map((t) => (
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
                    color: p.popular ? GREEN_LIGHT : '#fff',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    background: p.popular ? 'rgba(45,122,79,0.08)' : 'transparent',
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
                          background: plans[vi]?.popular ? 'rgba(45,122,79,0.05)' : 'transparent',
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
            7-day free trial. No credit card required. Set up in 10 minutes.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/signup"
              style={{
                display: 'inline-block',
                padding: '14px 36px',
                borderRadius: '12px',
                background: GREEN,
                color: '#fff',
                fontSize: '15px',
                fontWeight: 700,
                textDecoration: 'none',
                transition: 'opacity 0.15s',
              }}
            >
              Start Free Trial →
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
