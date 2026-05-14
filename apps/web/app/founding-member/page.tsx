'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

// Update this number as spots fill — mirrors the config in pricing/page.tsx
const FOUNDING_MEMBER_SPOTS_REMAINING = 23
const FOUNDING_MEMBER_TOTAL = 25

const FLEET_FEATURES = [
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
]

export default function FoundingMemberPage() {
  const [agreed, setAgreed]       = useState(false)
  const [loading, setLoading]     = useState(false)
  const [email, setEmail]         = useState('')
  const [company, setCompany]     = useState('')
  const [error, setError]         = useState('')

  function handleClaim() {
    if (!agreed) { setError('You must check the agreement box to continue.'); return }
    if (!email.trim()) { setError('Please enter your email address.'); return }
    setError('')
    setLoading(true)
    const params = new URLSearchParams({ founding_member: 'true', email: email.trim() })
    if (company.trim()) params.set('company', company.trim())
    window.location.href = `/signup?${params.toString()}`
  }

  const BG = '#0f1923'

  return (
    <div style={{ minHeight: '100vh', background: BG, backgroundImage: 'radial-gradient(#ffffff05 1px, transparent 1px)', backgroundSize: '24px 24px', padding: '40px 20px' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <Image src="/dtb-logo.png" alt="DumpTruckBoss" width={140} height={48} className="object-contain" />
          </Link>
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <span style={{ background: '#F5B731', color: '#1a1a1a', fontSize: '11px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '5px 14px', borderRadius: '100px', display: 'inline-block', marginBottom: '16px' }}>
            🔥 LIMITED — {FOUNDING_MEMBER_TOTAL} SPOTS
          </span>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 900, color: '#fff', marginBottom: '10px', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            Claim Your Founding Member Spot
          </h1>

          {/* Price */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '56px', fontWeight: 900, color: '#F5B731', lineHeight: 1 }}>$99</span>
            <span style={{ fontSize: '18px', color: 'rgba(255,255,255,0.4)' }}>/month</span>
            <span style={{ fontSize: '20px', color: 'rgba(255,255,255,0.25)', textDecoration: 'line-through' }}>$200</span>
          </div>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>
            <strong style={{ color: '#F5B731' }}>Locked in for life.</strong> Fleet price goes back to $200/mo after {FOUNDING_MEMBER_TOTAL} spots fill.
          </p>

          {/* Spots counter */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(245,183,49,0.1)', border: '1px solid rgba(245,183,49,0.3)', borderRadius: '100px', padding: '6px 16px', marginTop: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80', display: 'inline-block', boxShadow: '0 0 6px #4ade80' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
              {FOUNDING_MEMBER_SPOTS_REMAINING} of {FOUNDING_MEMBER_TOTAL} spots remaining
            </span>
          </div>
        </div>

        {/* Features + form card */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '20px', padding: '36px', marginBottom: '24px' }}>

          {/* Feature list */}
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>
            Everything in Fleet — nothing held back
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
            {FLEET_FEATURES.map((f) => (
              <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ color: '#F5B731', fontWeight: 700, flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{f}</span>
              </li>
            ))}
          </ul>

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', marginBottom: '28px' }} />

          {/* Email + company */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '28px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                Email address *
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '9px', padding: '11px 14px', fontSize: '14px', color: '#fff', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                Company name (optional)
              </label>
              <input
                type="text"
                value={company}
                onChange={e => setCompany(e.target.value)}
                placeholder="Atlas Hauling Co."
                style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '9px', padding: '11px 14px', fontSize: '14px', color: '#fff', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Agreement checkbox */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', marginBottom: '24px', padding: '16px', background: 'rgba(245,183,49,0.06)', border: '1px solid rgba(245,183,49,0.2)', borderRadius: '12px' }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => { setAgreed(e.target.checked); setError('') }}
              style={{ marginTop: '2px', width: '18px', height: '18px', flexShrink: 0, accentColor: '#F5B731', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>
              I agree to provide a short written review, a photo, and permission to use my company logo within 45 days of signup in exchange for Founding Member pricing of{' '}
              <strong style={{ color: '#F5B731' }}>$99/month locked in for life</strong>.
            </span>
          </label>

          {error && (
            <p style={{ fontSize: '13px', color: '#f87171', marginBottom: '16px', padding: '10px 14px', background: 'rgba(248,113,113,0.1)', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.25)' }}>
              {error}
            </p>
          )}

          {/* CTA */}
          <button
            onClick={handleClaim}
            disabled={loading}
            style={{
              width: '100%',
              background: agreed ? '#F5B731' : 'rgba(245,183,49,0.3)',
              color: agreed ? '#1a1a1a' : 'rgba(255,255,255,0.4)',
              fontSize: '16px',
              fontWeight: 900,
              padding: '15px 24px',
              borderRadius: '11px',
              border: 'none',
              cursor: agreed && !loading ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
              letterSpacing: '-0.01em',
              boxShadow: agreed ? '0 4px 20px rgba(245,183,49,0.3)' : 'none',
            }}
          >
            {loading ? 'Taking you to signup…' : 'Claim Your Founding Member Spot →'}
          </button>
          <p style={{ textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginTop: '10px' }}>
            30-day money-back guarantee &nbsp;·&nbsp; Cancel anytime
          </p>
        </div>

        {/* What we ask */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '28px', marginBottom: '24px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>
            What we ask in return
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { icon: '📅', text: 'Use the software for 30 days' },
              { icon: '✍️', text: 'Send a short written review (2–4 sentences)' },
              { icon: '📸', text: 'Send a photo we can post next to your quote' },
              { icon: '🏢', text: 'Let us use your company name and logo on our site' },
            ].map((item) => (
              <li key={item.text} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>{item.icon}</span>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p style={{ textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.25)', marginBottom: '8px' }}>
          Questions?{' '}
          <a href="mailto:contact@dumptruckboss.com" style={{ color: '#F5B731', textDecoration: 'none' }}>
            contact@dumptruckboss.com
          </a>
        </p>
        <p style={{ textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.25)' }}>
          <Link href="/pricing" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>
            ← Back to all plans
          </Link>
        </p>

      </div>
    </div>
  )
}
