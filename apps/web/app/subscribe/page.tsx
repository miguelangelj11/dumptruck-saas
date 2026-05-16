'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const plans = [
  {
    key: 'solo',
    name: 'Owner Operator Solo',
    price: '$15',
    period: '/mo',
    description: 'One truck. Get organized and get paid.',
    features: [
      '1 truck & 1 driver',
      'Dashboard',
      'Unlimited ticket tracking',
      'Basic invoicing',
      'Document storage',
    ],
    highlight: false,
  },
  {
    key: 'pro',
    name: 'Owner Operator Pro',
    price: '$65',
    period: '/mo',
    description: 'Growing your operation? This is your plan.',
    features: [
      'Up to 5 trucks & drivers',
      'Full dispatch board',
      'Revenue analytics',
      'Driver management',
      'Client companies',
    ],
    highlight: false,
  },
  {
    key: 'fleet',
    name: 'Fleet',
    price: '$125',
    period: '/mo',
    description: 'Run your entire operation from one dashboard.',
    features: [
      'Unlimited trucks & drivers',
      'Subcontractor management',
      'Missing ticket detection',
      'Follow-up automation engine',
      'Team access (unlimited users)',
      'AI document reader (50/mo)',
    ],
    highlight: true,
  },
]

function SubscribePageInner() {
  const searchParams = useSearchParams()
  const isFoundingMember = searchParams.get('founding_member') === 'true'
  const reason = searchParams.get('reason') // 'canceled' | 'paused' | null (trial ended)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  async function handleCheckout(planKey: string) {
    if (loadingPlan) return
    setLoadingPlan(planKey)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey, skip_trial: true }),
      })
      const data = await res.json() as { url?: string }
      if (data.url) {
        window.location.href = data.url
        return
      }
    } catch {
      // fall through
    }
    setLoadingPlan(null)
  }

  if (isFoundingMember) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#f9fafb',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 16px',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: '#fef2f2', border: '1px solid #fca5a5',
            borderRadius: '24px', padding: '6px 16px', marginBottom: '20px',
          }}>
            <span style={{ fontSize: '14px' }}>⏰</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#991b1b' }}>Your free trial has ended</span>
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(245,183,49,0.12)', border: '1px solid rgba(245,183,49,0.4)',
            borderRadius: '24px', padding: '6px 16px', marginBottom: '20px', marginLeft: '10px',
          }}>
            <span style={{ fontSize: '14px' }}>🔥</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#92400e' }}>Founding Member Exclusive</span>
          </div>
          <h1 style={{ fontSize: '30px', fontWeight: 800, color: '#111827', marginBottom: '10px' }}>
            Lock in your founding rate
          </h1>
          <p style={{ fontSize: '16px', color: '#6b7280', maxWidth: '480px', margin: '0 auto' }}>
            As a founding member, you get full Fleet access at <strong>$99/mo — locked in for life.</strong> This rate is exclusive to early supporters and will never increase.
          </p>
        </div>

        {/* Single founding member card */}
        <div style={{ maxWidth: '420px', width: '100%' }}>
          <div style={{
            background: '#fff',
            border: '2px solid #F5B731',
            borderRadius: '20px',
            padding: '36px',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            boxShadow: '0 8px 32px rgba(245,183,49,0.15)',
          }}>
            <div style={{
              position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)',
              background: '#F5B731', color: '#1a1a1a',
              fontSize: '12px', fontWeight: 800, padding: '5px 16px', borderRadius: '12px',
              whiteSpace: 'nowrap', letterSpacing: '0.02em',
            }}>
              🔥 FOUNDING MEMBER RATE — LOCKED FOR LIFE
            </div>

            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', marginBottom: '6px' }}>
              Fleet Plan
            </h2>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
              <span style={{ fontSize: '44px', fontWeight: 800, color: '#111827' }}>$99</span>
              <span style={{ fontSize: '15px', color: '#9ca3af' }}>/mo</span>
              <span style={{
                marginLeft: '8px', background: '#f0fdf4', color: '#166534',
                fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
                border: '1px solid #86efac',
              }}>
                Save $26/mo vs regular Fleet price
              </span>
            </div>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>
              Everything in Fleet. Price never increases — ever.
            </p>

            <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
              {[
                'Unlimited trucks & drivers',
                'Subcontractor management',
                'Missing ticket detection',
                'Follow-up automation engine',
                'Team access (unlimited users)',
                'AI document reader (50/mo)',
                'Priority support',
                'Rate locked in for life',
              ].map((f) => (
                <li key={f} style={{ display: 'flex', gap: '10px', fontSize: '14px', color: '#374151' }}>
                  <Check style={{ width: '15px', height: '15px', color: '#2d7a4f', flexShrink: 0, marginTop: '2px' }} />
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleCheckout('founding_member')}
              disabled={!!loadingPlan}
              style={{
                padding: '15px 20px',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '16px',
                border: 'none',
                cursor: loadingPlan ? 'not-allowed' : 'pointer',
                background: loadingPlan ? '#d1d5db' : '#F5B731',
                color: '#1a1a1a',
                transition: 'opacity 0.15s',
                letterSpacing: '-0.01em',
              }}
            >
              {loadingPlan ? 'Redirecting…' : 'Claim My Founding Member Rate →'}
            </button>

            <p style={{ marginTop: '12px', fontSize: '12px', color: '#9ca3af', textAlign: 'center' }}>
              No setup fees. Cancel anytime.
            </p>
          </div>
        </div>

        <p style={{ marginTop: '32px', fontSize: '13px', color: '#9ca3af', textAlign: 'center' }}>
          Need help?{' '}
          <Link href="mailto:support@dumptruckboss.com" style={{ color: '#2d7a4f', textDecoration: 'none' }}>
            Contact support
          </Link>
          {' '}· Already subscribed?{' '}
          <Link href="/dashboard/settings" style={{ color: '#2d7a4f', textDecoration: 'none' }}>
            Go to settings
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f9fafb',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 16px',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: '#fef2f2', border: '1px solid #fca5a5',
          borderRadius: '24px', padding: '6px 16px', marginBottom: '20px',
        }}>
          <span style={{ fontSize: '14px' }}>{reason === 'canceled' ? '🔒' : '⏰'}</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#991b1b' }}>
            {reason === 'canceled'
              ? 'Your subscription was canceled'
              : reason === 'paused'
              ? 'Your subscription is paused'
              : 'Your free trial has ended'}
          </span>
        </div>
        <h1 style={{ fontSize: '30px', fontWeight: 800, color: '#111827', marginBottom: '10px' }}>
          {reason === 'canceled' || reason === 'paused' ? 'Reactivate your account' : 'Choose a plan to continue'}
        </h1>
        <p style={{ fontSize: '16px', color: '#6b7280', maxWidth: '440px', margin: '0 auto' }}>
          {reason === 'canceled'
            ? 'Your data is safe. Subscribe to any plan to get back in — no setup fees.'
            : 'All plans include full access to DumpTruckBoss. No setup fees.'}
        </p>
      </div>

      {/* Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '20px',
        maxWidth: '960px',
        width: '100%',
      }}>
        {plans.map((plan) => (
          <div
            key={plan.key}
            style={{
              background: '#fff',
              border: plan.highlight ? '2px solid #F5B731' : '1px solid #e5e7eb',
              borderRadius: '16px',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
            }}
          >
            {plan.highlight && (
              <div style={{
                position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                background: '#F5B731', color: '#1a1a1a',
                fontSize: '11px', fontWeight: 800, padding: '4px 12px', borderRadius: '12px',
                whiteSpace: 'nowrap',
              }}>
                Most Popular
              </div>
            )}

            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>
              {plan.name}
            </h2>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '6px' }}>
              <span style={{ fontSize: '34px', fontWeight: 800, color: '#111827' }}>{plan.price}</span>
              <span style={{ fontSize: '14px', color: '#9ca3af' }}>{plan.period}</span>
            </div>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>{plan.description}</p>

            <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px', flex: 1 }}>
              {plan.features.map((f) => (
                <li key={f} style={{ display: 'flex', gap: '8px', fontSize: '14px', color: '#374151' }}>
                  <Check style={{ width: '15px', height: '15px', color: '#2d7a4f', flexShrink: 0, marginTop: '2px' }} />
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleCheckout(plan.key)}
              disabled={!!loadingPlan}
              style={{
                padding: '13px 20px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '15px',
                border: 'none',
                cursor: loadingPlan ? 'not-allowed' : 'pointer',
                opacity: loadingPlan && loadingPlan !== plan.key ? 0.6 : 1,
                background: plan.highlight ? '#F5B731' : '#2d7a4f',
                color: plan.highlight ? '#1a1a1a' : '#fff',
                transition: 'opacity 0.15s',
              }}
            >
              {loadingPlan === plan.key ? 'Redirecting…' : `Subscribe — ${plan.name}`}
            </button>
          </div>
        ))}
      </div>

      <p style={{ marginTop: '32px', fontSize: '13px', color: '#9ca3af', textAlign: 'center' }}>
        Need help?{' '}
        <Link href="mailto:support@dumptruckboss.com" style={{ color: '#2d7a4f', textDecoration: 'none' }}>
          Contact support
        </Link>
        {' '}· Already subscribed?{' '}
        <Link href="/dashboard/settings" style={{ color: '#2d7a4f', textDecoration: 'none' }}>
          Go to settings
        </Link>
      </p>
    </div>
  )
}

export default function SubscribePage() {
  return (
    <Suspense>
      <SubscribePageInner />
    </Suspense>
  )
}
