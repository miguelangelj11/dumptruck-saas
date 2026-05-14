'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { track } from '@/lib/analytics/posthog'

type Plan = 'solo' | 'pro' | 'fleet'

const HEARD_FROM_OPTIONS = [
  { value: 'google',        label: 'Google Search' },
  { value: 'facebook',      label: 'Facebook / Instagram' },
  { value: 'youtube',       label: 'YouTube' },
  { value: 'friend',        label: 'Friend or colleague' },
  { value: 'industry_show', label: 'Trade show / event' },
  { value: 'other',         label: 'Other' },
]

const PLANS: { id: Plan; name: string; price: string; desc: string; color: string; badge?: string }[] = [
  { id: 'solo',  name: 'Owner Operator Solo', price: '$25/mo',  desc: '1 truck & 1 driver, basic tickets',   color: '#1a1a1a' },
  { id: 'pro',   name: 'Owner Operator Pro',  price: '$80/mo',  desc: 'Up to 5 trucks, dispatch & jobs',     color: '#1a1a1a' },
  { id: 'fleet', name: 'Fleet',               price: '$200/mo', desc: 'Unlimited trucks & drivers',          color: '#F5B731', badge: 'Most Popular' },
]

export default function SignupPage() {
  const router = useRouter()
  const [selectedPlan, setSelectedPlan]         = useState<Plan | null>(null)
  const [companyName, setCompanyName]           = useState('')
  const [email, setEmail]                       = useState('')
  const [password, setPassword]                 = useState('')
  const [confirmPassword, setConfirmPassword]   = useState('')
  const [agreedToTerms, setAgreedToTerms]       = useState(false)
  const [loading, setLoading]                   = useState(false)
  const [buyLoading, setBuyLoading]             = useState(false)
  const [subscribeMode, setSubscribeMode]       = useState(false)
  const [alreadyExistsError, setAlreadyExists]  = useState(false)
  const [paymentComplete, setPaymentComplete]   = useState(false)
  const [heardFrom, setHeardFrom]               = useState('')
  const [heardFromDetail, setHeardFromDetail]   = useState('')
  const [isFoundingMember, setIsFoundingMember] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const p = params.get('plan')
    if (p === 'solo') setSelectedPlan('solo')
    else if (p === 'fleet') setSelectedPlan('fleet')
    else if (p === 'pro' || p === 'owner_operator' || p === 'owner') setSelectedPlan('pro')
    else if (p === 'growth' || p === 'enterprise') { /* enterprise → redirect handled by link */ }
    if (params.get('subscribe') === 'true') setSubscribeMode(true)
    if (params.get('paid') === 'true') setPaymentComplete(true)
    if (params.get('founding_member') === 'true') {
      setIsFoundingMember(true)
      setSelectedPlan('fleet')
      const emailParam = params.get('email')
      const companyParam = params.get('company')
      if (emailParam) setEmail(emailParam)
      if (companyParam) setCompanyName(companyParam)
    }
    track('signup_started', { plan: p ?? undefined, source: params.get('utm_source') ?? undefined })
  }, [])

  // ── Free trial flow ──────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPlan)               { toast.error('Please select a plan'); return }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return }
    if (!agreedToTerms)              { toast.error('You must agree to the Terms of Service'); return }

    setLoading(true)
    setAlreadyExists(false)

    const timer = setTimeout(() => {
      toast.error('Something went wrong. Please try again.')
      setLoading(false)
    }, 15_000)

    try {
      const supabase = createClient()

      let user: import('@supabase/supabase-js').User | null = null

      const { data, error } = await supabase.auth.signUp({ email, password })

      if (error && /already registered|already exists/i.test(error.message)) {
        // Auth user exists — check if it's a ghost account (no company yet)
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError || !signInData.user) {
          // Wrong password or other sign-in issue — genuine duplicate
          clearTimeout(timer)
          setAlreadyExists(true)
          setPassword('')
          setConfirmPassword('')
          setLoading(false)
          return
        }
        const { data: existingCompany } = await supabase
          .from('companies').select('id').eq('id', signInData.user.id).maybeSingle()
        if (existingCompany) {
          // Fully registered already — send them to login
          clearTimeout(timer)
          setAlreadyExists(true)
          setPassword('')
          setConfirmPassword('')
          setLoading(false)
          return
        }
        // Ghost account — auth exists but no company. Continue with onboarding.
        user = signInData.user
      } else if (error) {
        clearTimeout(timer)
        toast.error(error.message)
        setLoading(false)
        return
      } else {
        user = data.user
      }

      if (!user) {
        clearTimeout(timer)
        toast.error('Failed to create account. Please try again.')
        setLoading(false)
        return
      }

      const now = new Date().toISOString()
      const trialDays = isFoundingMember ? 30 : 7
      const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString()
      await supabase.from('companies').insert({
        id:                       user.id,
        name:                     companyName,
        owner_id:                 user.id,
        plan:                     isFoundingMember ? 'fleet' : selectedPlan,
        trial_started_at:         now,
        trial_ends_at:            trialEndsAt,
        subscription_status:      'trial',
        terms_accepted_at:        now,
        terms_version:            '2026-05-07',
        privacy_accepted_at:      now,
        ...(isFoundingMember ? { founding_member: true, founding_member_agreement_at: now } : {}),
        ...(heardFrom ? { referral_source: heardFrom } : {}),
        ...(heardFromDetail ? { referral_source_detail: heardFromDetail } : {}),
      })

      await supabase.from('profiles').upsert({
        id:              user.id,
        organization_id: user.id,
      }, { onConflict: 'id' })

      // Log consent audit trail
      await supabase.from('user_consents').insert([
        { user_id: user.id, company_id: user.id, document_type: 'terms_of_service', document_version: '2026-05-07', accepted_at: now },
        { user_id: user.id, company_id: user.id, document_type: 'privacy_policy',   document_version: '2026-05-07', accepted_at: now },
      ])

      localStorage.setItem('dtb_selected_plan', selectedPlan)
      track('signup_completed', {
        plan: selectedPlan,
        heard_from: heardFrom || undefined,
        heard_from_detail: heardFromDetail || undefined,
      })
      track('trial_started', { plan: selectedPlan })
      clearTimeout(timer)
      router.push('/dashboard')
    } catch (err) {
      clearTimeout(timer)
      console.error('[signup] unexpected error', err)
      toast.error('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  // ── Subscribe Now flow — account created by webhook after payment ────────────

  async function handleBuyNow() {
    if (!selectedPlan)       { toast.error('Please select a plan'); return }
    if (!companyName.trim()) { toast.error('Company name is required'); return }
    if (!email.trim())       { toast.error('Email is required'); return }
    if (!agreedToTerms)      { toast.error('You must agree to the Terms of Service'); return }

    setBuyLoading(true)
    const timer = setTimeout(() => {
      toast.error('Something went wrong. Please try again.')
      setBuyLoading(false)
    }, 20_000)

    try {
      const planKey = selectedPlan === 'pro' ? 'pro' : selectedPlan
      let res: Response
      try {
        res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan:               planKey,
            skip_trial:         true,
            guest_email:        email.trim(),
            guest_company_name: companyName.trim(),
          }),
        })
      } catch {
        clearTimeout(timer)
        toast.error('Network error. Please check your connection and try again.')
        setBuyLoading(false)
        return
      }

      let checkoutData: { url?: string; error?: string }
      try {
        checkoutData = await res.json()
      } catch {
        clearTimeout(timer)
        toast.error('Checkout error. Please try again.')
        setBuyLoading(false)
        return
      }

      clearTimeout(timer)
      if (checkoutData.url) {
        window.location.href = checkoutData.url
      } else {
        toast.error(checkoutData.error ?? 'Failed to start checkout. Please try again.')
        setBuyLoading(false)
      }
    } catch (err) {
      clearTimeout(timer)
      console.error('[signup buy-now] unexpected error', err)
      toast.error('Something went wrong. Please try again.')
      setBuyLoading(false)
    }
  }

  // ── Payment-complete screen (redirected back from Stripe) ────────────────────

  if (paymentComplete) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f1923', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <main style={{ width: '100%', maxWidth: '480px', textAlign: 'center' }}>
          <div style={{ fontSize: '56px', marginBottom: '20px' }}>🎉</div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#fff', marginBottom: '12px' }}>Payment confirmed!</h1>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: '28px' }}>
            We&apos;re setting up your account now. Check your email — we&apos;ve sent you a link to set your password and access your dashboard.
          </p>
          <div style={{ background: 'rgba(45,122,79,0.15)', border: '1px solid rgba(45,122,79,0.4)', borderRadius: '12px', padding: '18px 24px', marginBottom: '28px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
              Didn&apos;t get an email? Check your spam folder, or{' '}
              <a href="mailto:miguelangel.j11@gmail.com" style={{ color: '#2d7a4f', textDecoration: 'none', fontWeight: 600 }}>contact support</a>.
            </p>
          </div>
          <Link href="/login" style={{ display: 'inline-block', padding: '12px 28px', background: '#2d7a4f', color: '#fff', borderRadius: '10px', textDecoration: 'none', fontSize: '14px', fontWeight: 700 }}>
            Go to Login →
          </Link>
        </main>
      </div>
    )
  }

  // ── Signup form ──────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#0f1923', backgroundImage: 'radial-gradient(#ffffff06 1px, transparent 1px)', backgroundSize: '24px 24px', padding: '40px 24px' }}>
      <main style={{ width: '100%', maxWidth: '520px', margin: '0 auto' }}>

        {/* Logo + heading */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" style={{ display: 'inline-flex', textDecoration: 'none', marginBottom: '20px' }}>
            <Image src="/dtb-logo.png" alt="DumpTruckBoss" width={160} height={54} className="object-contain" />
          </Link>
          {isFoundingMember && (
            <div style={{ display: 'inline-block', background: '#F5B731', color: '#1a1a1a', fontSize: '11px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: '100px', marginBottom: '12px' }}>
              🔥 Founding Member
            </div>
          )}
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
            {isFoundingMember ? 'Claim Your Founding Member Account' : subscribeMode ? 'Subscribe to DumpTruckBoss' : 'Start your free 7-day trial'}
          </h1>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)' }}>
            {isFoundingMember ? 'First 30 days free. Then just $99/mo locked in for life.' : subscribeMode ? 'Enter your info below and you\'ll be taken to checkout.' : 'No credit card required. Full access from day one.'}
          </p>
        </div>

        {/* Plan selector */}
        <div style={{ marginBottom: '24px', display: isFoundingMember ? 'none' : 'block' }}>
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '16px' }}>Which plan are you signing up for?</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-stretch">
            {PLANS.map((plan) => {
              const isSelected = selectedPlan === plan.id
              const isPopular = !!plan.badge
              return (
                <div key={plan.id} style={{ position: 'relative', paddingTop: '20px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isPopular && (
                      <span style={{ background: '#F5B731', color: '#1a1a1a', fontSize: '10px', fontWeight: 800, padding: '3px 10px', borderRadius: '100px', whiteSpace: 'nowrap' }}>
                        Most Popular
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPlan(plan.id)}
                    style={{
                      flex: 1, width: '100%', padding: '14px', borderRadius: '12px', textAlign: 'left', cursor: 'pointer', outline: 'none', transition: 'all 0.15s',
                      border: `2px solid ${isSelected ? '#F5B731' : isPopular ? '#3a3218' : '#1e2530'}`,
                      background: isSelected ? '#2b2c20' : isPopular ? '#1c2120' : '#19222c',
                    }}
                  >
                    <p style={{ fontWeight: 700, fontSize: '12px', color: '#fff', marginBottom: '4px', minHeight: '30px' }}>{plan.name}</p>
                    <p style={{ fontSize: '18px', fontWeight: 800, color: '#F5B731', marginBottom: '4px' }}>{plan.price}</p>
                    <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>{plan.desc}</p>
                  </button>
                </div>
              )
            })}
            {/* Enterprise — contact flow, not checkout */}
            <div style={{ paddingTop: '20px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: '20px' }} />
              <a
                href="/enterprise"
                style={{
                  flex: 1, width: '100%', padding: '14px', borderRadius: '12px', textAlign: 'left', cursor: 'pointer', outline: 'none', transition: 'all 0.15s',
                  border: '2px solid rgba(255,255,255,0.12)',
                  background: '#111',
                  textDecoration: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <p style={{ fontWeight: 700, fontSize: '12px', color: '#fff', marginBottom: '4px', minHeight: '30px' }}>Enterprise</p>
                <p style={{ fontSize: '18px', fontWeight: 800, color: '#F5B731', marginBottom: '4px' }}>Custom</p>
                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginBottom: '6px' }}>Large fleet?</p>
                <span style={{ fontSize: '10px', color: '#F5B731', textDecoration: 'underline' }}>Contact us →</span>
              </a>
            </div>
          </div>
        </div>

        {/* Form card */}
        <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            <Field label="Company name">
              <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
                required placeholder="Atlas Hauling Co." style={inputStyle} />
            </Field>

            <Field label="Email address">
              <input type="email" value={email} onChange={e => { setEmail(e.target.value); setAlreadyExists(false) }}
                required autoComplete="email" placeholder="you@company.com" style={inputStyle} />
              {alreadyExistsError && (
                <div style={{ marginTop: '8px', padding: '12px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#92400e', fontWeight: 500 }}>
                    An account with this email already exists.
                  </p>
                  <Link href="/login" style={{ display: 'block', marginTop: '4px', fontSize: '13px', fontWeight: 700, color: '#2d6a4f', textDecoration: 'underline' }}>
                    → Sign in to your existing account
                  </Link>
                </div>
              )}
            </Field>

            <Field label="Password">
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                required minLength={6} autoComplete="new-password" placeholder="Min. 6 characters" style={inputStyle} />
            </Field>

            <Field label="Confirm password">
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                required minLength={6} autoComplete="new-password" placeholder="Re-enter your password" style={inputStyle} />
            </Field>

            <Field label="How did you hear about us?">
              <select
                value={heardFrom}
                onChange={e => { setHeardFrom(e.target.value); setHeardFromDetail('') }}
                style={{ ...inputStyle, appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\' viewBox=\'0 0 12 8\'%3E%3Cpath d=\'M1 1l5 5 5-5\' stroke=\'%236b7280\' stroke-width=\'1.5\' fill=\'none\' stroke-linecap=\'round\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '36px', color: heardFrom ? '#111827' : '#9ca3af' }}
              >
                <option value="" disabled>Select an option…</option>
                {HEARD_FROM_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {heardFrom === 'other' && (
                <input
                  type="text"
                  value={heardFromDetail}
                  onChange={e => setHeardFromDetail(e.target.value)}
                  placeholder="Tell us more…"
                  style={{ ...inputStyle, marginTop: '8px' }}
                />
              )}
            </Field>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)}
                style={{ marginTop: '2px', width: '16px', height: '16px', flexShrink: 0, accentColor: '#2d7a4f', cursor: 'pointer' }} />
              <span style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>
                I agree to the{' '}
                <Link href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#2d7a4f', textDecoration: 'underline' }}>Terms of Service</Link>
                {', '}
                <Link href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#2d7a4f', textDecoration: 'underline' }}>Privacy Policy</Link>
                {', and '}
                <Link href="/legal/acceptable-use" target="_blank" rel="noopener noreferrer" style={{ color: '#2d7a4f', textDecoration: 'underline' }}>Acceptable Use Policy</Link>
                {'. I acknowledge that AI-extracted ticket data requires human review before use in invoices or payroll.'}
              </span>
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button type="submit" disabled={loading || buyLoading || !selectedPlan} style={{
                width: '100%', padding: '14px', borderRadius: '10px',
                background: !selectedPlan ? '#d1d5db' : subscribeMode ? 'rgba(45,122,79,0.08)' : '#2d7a4f',
                color: !selectedPlan ? '#9ca3af' : subscribeMode ? '#374151' : '#fff',
                fontSize: '15px', fontWeight: 700,
                border: subscribeMode ? '1px solid #e5e7eb' : 'none',
                cursor: !selectedPlan ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                opacity: (loading || buyLoading) ? 0.7 : 1,
              }}>
                {loading ? 'Creating account…' : isFoundingMember ? 'Create My Founding Member Account →' : 'Start My Free 7-Day Trial'}
              </button>

              {!isFoundingMember && (
                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={loading || buyLoading || !selectedPlan}
                  style={{
                    width: '100%', padding: '14px', borderRadius: '10px',
                    background: !selectedPlan ? '#f3f4f6' : '#1e3a2a',
                    color: !selectedPlan ? '#9ca3af' : '#fff',
                    fontSize: '15px', fontWeight: 700, border: 'none',
                    cursor: (!selectedPlan || loading || buyLoading) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s', opacity: (loading || buyLoading) ? 0.7 : 1,
                  }}
                >
                  {buyLoading
                    ? 'Redirecting to checkout…'
                    : selectedPlan
                    ? `Subscribe Now — ${PLANS.find(p => p.id === selectedPlan)?.price} →`
                    : 'Subscribe Now →'}
                </button>
              )}
            </div>
          </form>

          {!subscribeMode && (
            <div style={{ marginTop: '20px', padding: '14px 16px', background: isFoundingMember ? 'rgba(245,183,49,0.08)' : '#f9fafb', borderRadius: '10px', border: isFoundingMember ? '1px solid rgba(245,183,49,0.3)' : '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span>{isFoundingMember ? '🔥' : '🔒'}</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>No credit card required</span>
              </div>
              <p style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.5 }}>
                {isFoundingMember
                  ? 'Your 30-day free trial starts immediately. After 30 days you\'ll be billed $99/mo — your Founding Member rate locked in for life.'
                  : 'Your 7-day free trial starts immediately. After 7 days you\'ll be asked to subscribe to continue using DumpTruckBoss.'}
              </p>
            </div>
          )}

          <p style={{ textAlign: 'center', fontSize: '14px', color: '#6b7280', marginTop: '20px' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: '#2d7a4f', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
          </p>
        </div>

      </main>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', borderRadius: '8px', border: '1px solid #e5e7eb',
  padding: '10px 14px', fontSize: '14px', color: '#111827',
  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>{label}</label>
      {children}
    </div>
  )
}
