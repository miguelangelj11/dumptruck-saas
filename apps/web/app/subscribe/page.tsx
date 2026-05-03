'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import Link from 'next/link'

const plans = [
  {
    key: 'owner',
    name: 'Owner Operator',
    price: '$80',
    period: '/mo',
    description: 'Perfect for owner-operators with 1–3 trucks',
    features: [
      'Up to 3 drivers',
      'Up to 200 tickets/month',
      'Client invoices',
      'Basic revenue dashboard',
      'Single user login',
    ],
    ctaStyle: 'gold' as const,
  },
  {
    key: 'fleet',
    name: 'Fleet Plan',
    price: '$150',
    period: '/mo',
    description: 'For growing companies with 4–15 trucks',
    features: [
      'Up to 15 drivers',
      'Unlimited tickets',
      'All invoice types (Client, Driver Pay, Subcontractor)',
      'Subcontractor management',
      'Up to 3 team logins',
    ],
    ctaStyle: 'green' as const,
  },
  {
    key: null,
    name: 'Enterprise',
    price: '$300+',
    period: '/mo',
    description: 'For large operations with 15+ trucks',
    features: [
      'Unlimited drivers & team logins',
      'Driver mobile app',
      'AI ticket photo reader',
      'Advanced reporting',
      'Dedicated account manager',
    ],
    ctaStyle: 'disabled' as const,
  },
]

export default function SubscribePage() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  async function handleCheckout(planKey: string) {
    if (loadingPlan) return
    setLoadingPlan(planKey)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
        return
      }
    } catch {
      // fall through
    }
    setLoadingPlan(null)
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
          <span style={{ fontSize: '14px' }}>⏰</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#991b1b' }}>Your free trial has ended</span>
        </div>
        <h1 style={{ fontSize: '30px', fontWeight: 800, color: '#111827', marginBottom: '10px' }}>
          Choose a plan to continue
        </h1>
        <p style={{ fontSize: '16px', color: '#6b7280', maxWidth: '440px', margin: '0 auto' }}>
          All plans include full access to DumpTruckBoss. No setup fees.
        </p>
      </div>

      {/* Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
        maxWidth: '960px',
        width: '100%',
      }}>
        {plans.map((plan) => (
          <div
            key={plan.name}
            style={{
              background: '#fff',
              border: plan.key === 'fleet' ? '2px solid #2d7a4f' : '1px solid #e5e7eb',
              borderRadius: '16px',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
            }}
          >
            {plan.key === 'fleet' && (
              <div style={{
                position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                background: '#2d7a4f', color: '#fff',
                fontSize: '11px', fontWeight: 700, padding: '4px 12px', borderRadius: '12px',
                whiteSpace: 'nowrap',
              }}>
                Best for Growing Fleets
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

            {plan.key ? (
              <button
                onClick={() => handleCheckout(plan.key!)}
                disabled={!!loadingPlan}
                style={{
                  padding: '13px 20px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '15px',
                  border: 'none',
                  cursor: loadingPlan ? 'not-allowed' : 'pointer',
                  opacity: loadingPlan && loadingPlan !== plan.key ? 0.6 : 1,
                  background: plan.ctaStyle === 'gold' ? '#FFB800' : '#2d7a4f',
                  color: plan.ctaStyle === 'gold' ? '#000' : '#fff',
                  transition: 'opacity 0.15s',
                }}
              >
                {loadingPlan === plan.key ? 'Redirecting…' : `Subscribe — ${plan.name}`}
              </button>
            ) : (
              <div style={{
                padding: '13px 20px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '15px',
                textAlign: 'center',
                background: '#f3f4f6',
                color: '#9ca3af',
              }}>
                Coming Soon
              </div>
            )}
          </div>
        ))}
      </div>

      <p style={{ marginTop: '32px', fontSize: '13px', color: '#9ca3af', textAlign: 'center' }}>
        Need help?{' '}
        <Link href="mailto:support@dumpruckboss.com" style={{ color: '#2d7a4f', textDecoration: 'none' }}>
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
