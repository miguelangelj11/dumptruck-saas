'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Nav from '@/components/landing/nav'
import Footer from '@/components/landing/footer'

// ─── Plan data (original 3-plan structure) ───────────────────────────────────

const plans = [
  {
    key: 'owner',
    name: 'Owner Operator',
    tagline: '1–3 trucks, solo operator',
    monthlyPrice: '$80',
    annualPrice: '$64',
    annualSavings: 'Save $192/year',
    popular: false,
    ctaLabel: 'Start Free Trial',
    ctaHref: '/signup?plan=owner_operator',
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
    key: 'fleet',
    name: 'Fleet',
    tagline: '4–15 trucks, growing fleet',
    monthlyPrice: '$150',
    annualPrice: '$120',
    annualSavings: 'Save $360/year',
    popular: true,
    ctaLabel: 'Start Free Trial',
    ctaHref: '/signup?plan=fleet',
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
      'Priority email support',
    ],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    tagline: '15+ trucks or multiple locations',
    monthlyPrice: '$300+',
    annualPrice: null,
    annualSavings: null,
    popular: false,
    ctaLabel: 'Schedule a Demo',
    ctaHref: '/schedule-demo',
    features: [
      'Unlimited drivers and trucks',
      'Unlimited team logins with role-based access',
      'Driver mobile app (submit tickets from phone)',
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
] as const

// ─── Comparison table ────────────────────────────────────────────────────────

type V = true | false | string

const table: { section: string; rows: { label: string; vals: [V, V, V] }[] }[] = [
  {
    section: 'Core Features',
    rows: [
      { label: 'Ticket management',      vals: ['Basic', 'Full', 'Full'] },
      { label: 'Ticket photo upload',    vals: [true, true, true] },
      { label: 'Load tracking',          vals: ['Basic', 'Full', 'Full'] },
      { label: 'Full dispatch board',    vals: [false, true, true] },
      { label: 'Driver mobile app',      vals: [false, false, true] },
      { label: 'AI ticket photo reader', vals: [false, false, true] },
    ],
  },
  {
    section: 'Team & Fleet',
    rows: [
      { label: 'Drivers',            vals: ['Up to 3', 'Up to 15', 'Unlimited'] },
      { label: 'Team logins',        vals: ['1 (owner)', '3', 'Unlimited'] },
      { label: 'Role-based access',  vals: [false, false, true] },
      { label: 'Subcontractor mgmt', vals: [false, true, true] },
    ],
  },
  {
    section: 'Invoicing',
    rows: [
      { label: 'Invoice types',           vals: ['Client only', 'All 3 types', 'All 3 types'] },
      { label: 'PDF download',            vals: [true, true, true] },
      { label: 'Send by email',           vals: [false, true, true] },
      { label: 'Send by SMS',             vals: [false, false, true] },
      { label: 'Weekly auto-invoice',     vals: [false, true, true] },
      { label: 'QuickBooks export (CSV)', vals: [false, false, true] },
    ],
  },
  {
    section: 'Reporting',
    rows: [
      { label: 'Basic revenue dashboard',    vals: [true, true, true] },
      { label: 'Revenue by driver / job',    vals: [false, true, true] },
      { label: 'Advanced aging reports',     vals: [false, false, true] },
      { label: 'Charts & contractor reports', vals: [false, false, true] },
    ],
  },
  {
    section: 'Support',
    rows: [
      { label: 'Support tier',             vals: ['Email', 'Priority email', 'Priority phone'] },
      { label: 'Dedicated account manager', vals: [false, false, true] },
      { label: 'Custom onboarding',         vals: [false, false, true] },
    ],
  },
]

// ─── FAQ ─────────────────────────────────────────────────────────────────────

const faq = [
  { q: 'Is there a free trial?', a: 'Yes — Owner Operator and Fleet plans include a 14-day free trial. No credit card required. Full access from day one.' },
  { q: 'Can I change plans later?', a: 'Absolutely. Upgrade or downgrade any time. Changes take effect at the next billing cycle.' },
  { q: 'What happens to my data if I cancel?', a: 'Your data stays in the system for 30 days after cancellation. You can export everything before then.' },
  { q: 'Is there a limit on load tickets?', a: 'Owner Operator is capped at 200 tickets/month. Fleet and Enterprise include unlimited tickets.' },
  { q: 'How does annual billing work?', a: 'Pay for 12 months upfront and save around 20%. You can switch from monthly to annual at any time from your account settings.' },
  { q: 'Do you offer custom pricing for large fleets?', a: 'Yes. Enterprise pricing is custom and based on your fleet size, locations, and needs. Schedule a demo to get a quote.' },
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
  const [annual, setAnnual] = useState(false)
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
  const HIGHLIGHT_BG = '#152a1e'
  const HIGHLIGHT_BORDER = '2px solid #2d7a4f'
  const GREEN = '#2d7a4f'
  const GREEN_LIGHT = '#4ade80'

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
          Choose a plan built for<br className="hidden-xs" /> your hauling business.
        </h1>
        <p style={{ fontSize: '17px', color: 'rgba(255,255,255,0.45)', marginBottom: '36px', lineHeight: 1.6 }}>
          Owner Operator and Fleet plans include a free 14-day trial. No credit card required.
        </p>

        {/* Billing toggle */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '100px',
          padding: '8px 18px',
          marginBottom: '56px',
        }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: annual ? 'rgba(255,255,255,0.35)' : '#fff', transition: 'color 0.2s' }}>
            Monthly
          </span>
          <button
            onClick={() => setAnnual(a => !a)}
            aria-label="Toggle annual billing"
            style={{
              position: 'relative',
              width: '44px',
              height: '24px',
              borderRadius: '100px',
              border: 'none',
              background: annual ? GREEN : 'rgba(255,255,255,0.2)',
              cursor: 'pointer',
              transition: 'background 0.2s',
              outline: 'none',
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
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              display: 'block',
            }} />
          </button>
          <span style={{ fontSize: '13px', fontWeight: 600, color: annual ? '#fff' : 'rgba(255,255,255,0.35)', transition: 'color 0.2s' }}>
            Annual
          </span>
          <span style={{ fontSize: '11px', fontWeight: 700, background: GREEN, color: '#fff', padding: '3px 9px', borderRadius: '100px', lineHeight: 1.4 }}>
            Save ~20%
          </span>
        </div>
      </div>

      {/* ── Pricing cards ─────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 20px 0' }}>
        <div className="plans-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', alignItems: 'stretch' }}>
          {plans.map((plan) => {
            const isEnterprise = plan.key === 'enterprise'
            const hl = plan.popular
            const price = annual
              ? (plan.annualPrice ?? 'Contact us')
              : plan.monthlyPrice

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
                    background: GREEN,
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    padding: '4px 14px',
                    borderRadius: '100px',
                    whiteSpace: 'nowrap',
                  }}>
                    Most Popular
                  </div>
                )}

                {/* Plan name */}
                <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: hl ? GREEN_LIGHT : 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>
                  {plan.name}
                </p>

                {/* Price block */}
                {isEnterprise && annual ? (
                  <div style={{ marginBottom: '6px' }}>
                    <span style={{ fontSize: '34px', fontWeight: 800, color: '#fff', lineHeight: 1 }}>Contact us</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '44px', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{price}</span>
                    {!isEnterprise && <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.35)' }}>/mo</span>}
                    {isEnterprise && <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.35)' }}>/mo</span>}
                  </div>
                )}

                {/* Annual savings note */}
                <p style={{ fontSize: '12px', color: hl ? GREEN_LIGHT : 'rgba(255,255,255,0.35)', marginBottom: '6px', minHeight: '18px' }}>
                  {annual && plan.annualSavings ? `${plan.annualSavings} · billed annually` : ''}
                </p>

                {/* Tagline */}
                <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginBottom: '24px' }}>
                  {plan.tagline}
                </p>

                {/* CTA */}
                {isEnterprise ? (
                  <Link
                    href={plan.ctaHref}
                    style={{
                      display: 'block',
                      textAlign: 'center',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      fontSize: '14px',
                      fontWeight: 700,
                      textDecoration: 'none',
                      marginBottom: '28px',
                      background: 'transparent',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.2)',
                    }}
                  >
                    {plan.ctaLabel} →
                  </Link>
                ) : (
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
                          ? { background: GREEN, color: '#fff' }
                          : { background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' }
                        ),
                      }}
                    >
                      {checkoutLoading === plan.key ? 'Loading…' : `${plan.ctaLabel} →`}
                    </button>
                    <Link
                      href={`/signup?plan=${plan.key === 'owner' ? 'owner_operator' : plan.key}&subscribe=true`}
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
                )}

                {/* Divider */}
                <div style={{ height: '1px', background: hl ? 'rgba(45,122,79,0.3)' : 'rgba(255,255,255,0.07)', marginBottom: '24px' }} />

                {/* Feature list */}
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '11px' }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <span style={{ color: hl ? GREEN_LIGHT : GREEN, fontSize: '14px', fontWeight: 700, flexShrink: 0, marginTop: '1px', lineHeight: 1.4 }}>✓</span>
                      <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{f}</span>
                    </li>
                  ))}
                </ul>

                {/* Trust bullets (trial plans) */}
                {!isEnterprise && (
                  <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: hl ? '1px solid rgba(45,122,79,0.3)' : '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {['14-day free trial', 'No credit card required', 'Cancel anytime'].map((t) => (
                      <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                        <span style={{ color: hl ? GREEN_LIGHT : GREEN, fontWeight: 700 }}>✓</span>
                        {t}
                      </div>
                    ))}
                  </div>
                )}

                {isEnterprise && (
                  <p style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.07)', fontSize: '12px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
                    Custom pricing based on fleet size. Talk to us before you commit — we'll walk you through everything.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Compare all features ──────────────────────────────────────────────── */}
      <div style={{ maxWidth: '1100px', margin: '88px auto 0', padding: '0 20px' }}>
        <h2 style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 800, color: '#fff', textAlign: 'center', marginBottom: '8px', letterSpacing: '-0.01em' }}>
          Compare all features
        </h2>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: '40px' }}>
          See exactly what's included in each plan.
        </p>

        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <table style={{ width: '100%', minWidth: '580px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', width: '40%', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
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
                    width: '20%',
                  }}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.map((section, si) => (
                <>
                  <tr key={`s${si}`}>
                    <td colSpan={4} style={{
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
                </>
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
      <div style={{ maxWidth: '1100px', margin: '88px auto 0', padding: '0 20px 88px' }}>
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
            14-day free trial. No credit card required. Set up in 10 minutes.
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
            <Link
              href="/schedule-demo"
              style={{
                display: 'inline-block',
                padding: '14px 36px',
                borderRadius: '12px',
                background: 'transparent',
                color: 'rgba(255,255,255,0.8)',
                fontSize: '15px',
                fontWeight: 600,
                textDecoration: 'none',
                border: '1px solid rgba(255,255,255,0.18)',
                transition: 'border-color 0.15s',
              }}
            >
              Schedule a Demo
            </Link>
          </div>
        </div>
      </div>

      {/* Responsive grid */}
      <style>{`
        @media (max-width: 860px) {
          .plans-grid { grid-template-columns: 1fr !important; }
          .plans-grid > div { margin-top: 0 !important; }
        }
      `}</style>

      <Footer />
    </div>
  )
}
