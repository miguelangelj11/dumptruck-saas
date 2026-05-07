'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

type Plan = 'owner_operator' | 'fleet' | 'growth'

const PLANS: { id: Plan; name: string; price: string; desc: string; color: string; badge?: string; subtext?: string }[] = [
  { id: 'owner_operator', name: 'Owner Operator', price: '$80/mo',  desc: 'Up to 5 trucks, solo operator',           color: '#1a1a1a' },
  { id: 'fleet',          name: 'Fleet',          price: '$200/mo', desc: 'Unlimited trucks & drivers',               color: '#F5B731', badge: 'Most Popular', subtext: 'Includes missing ticket detection + auto follow-ups' },
  { id: 'growth',         name: 'Growth',         price: '$350/mo', desc: 'CRM + quotes + advanced analytics',        color: '#8B5CF6' },
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const p = params.get('plan')
    if (p === 'fleet') setSelectedPlan('fleet')
    else if (p === 'growth') setSelectedPlan('growth')
    else if (p === 'owner_operator' || p === 'owner') setSelectedPlan('owner_operator')
    if (params.get('subscribe') === 'true') setSubscribeMode(true)
    if (params.get('paid') === 'true') setPaymentComplete(true)
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

      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        clearTimeout(timer)
        if (/already registered|already exists/i.test(error.message)) {
          setAlreadyExists(true)
          setPassword('')
          setConfirmPassword('')
        } else {
          toast.error(error.message)
        }
        setLoading(false)
        return
      }

      const user = data.user
      if (!user) {
        clearTimeout(timer)
        toast.error('Failed to create account. Please try again.')
        setLoading(false)
        return
      }

      const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      await supabase.from('companies').insert({
        id:                  user.id,
        name:                companyName,
        owner_id:            user.id,
        plan:                selectedPlan,
        trial_started_at:    new Date().toISOString(),
        trial_ends_at:       trialEndsAt,
        subscription_status: 'trial',
      })

      await supabase.from('profiles').upsert({
        id:              user.id,
        organization_id: user.id,
      }, { onConflict: 'id' })

      localStorage.setItem('dtb_selected_plan', selectedPlan)
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
      const planKey = selectedPlan === 'owner_operator' ? 'owner' : selectedPlan
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
        <div style={{ width: '100%', maxWidth: '480px', textAlign: 'center' }}>
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
        </div>
      </div>
    )
  }

  // ── Signup form ──────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#0f1923', backgroundImage: 'radial-gradient(#ffffff06 1px, transparent 1px)', backgroundSize: '24px 24px', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: '520px', margin: '0 auto' }}>

        {/* Logo + heading */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" style={{ display: 'inline-flex', textDecoration: 'none', marginBottom: '20px' }}>
            <Image src="/dtb-logo.png" alt="DumpTruckBoss" width={160} height={54} className="object-contain" />
          </Link>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
            {subscribeMode ? 'Subscribe to DumpTruckBoss' : 'Start your free 7-day trial'}
          </h1>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)' }}>
            {subscribeMode ? 'Enter your info below and you\'ll be taken to checkout.' : 'No credit card required. Full access from day one.'}
          </p>
        </div>

        {/* Plan selector */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '12px' }}>Which plan are you signing up for?</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            {PLANS.map((plan) => {
              const sel = selectedPlan === plan.id
              return (
                <button key={plan.id} type="button" onClick={() => setSelectedPlan(plan.id)} style={{
                  position: 'relative',
                  background: sel ? `${plan.color}18` : 'rgba(255,255,255,0.04)',
                  border: `2px solid ${sel ? plan.color : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '12px', padding: '16px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s', outline: 'none',
                }}>
                  {plan.badge && (
                    <span style={{ position: 'absolute', top: '-10px', left: '12px', background: '#F5B731', color: '#1a1a1a', fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '100px' }}>
                      {plan.badge}
                    </span>
                  )}
                  <div style={{ fontSize: '14px', fontWeight: 700, color: sel ? plan.color : '#fff', marginBottom: '4px' }}>{plan.name}</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: sel ? plan.color : 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>{plan.price}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{plan.desc}</div>
                  {plan.subtext && <div style={{ fontSize: '11px', color: sel ? plan.color : 'rgba(255,255,255,0.35)', marginTop: '4px' }}>{plan.subtext}</div>}
                </button>
              )
            })}
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

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)}
                style={{ marginTop: '2px', width: '16px', height: '16px', flexShrink: 0, accentColor: '#2d7a4f', cursor: 'pointer' }} />
              <span style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>
                I agree to the{' '}
                <Link href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#2d7a4f', textDecoration: 'underline' }}>Terms of Service</Link>
                {' '}and{' '}
                <Link href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#2d7a4f', textDecoration: 'underline' }}>Privacy Policy</Link>
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
                {loading ? 'Creating account…' : 'Start My Free 7-Day Trial'}
              </button>

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
            </div>
          </form>

          {!subscribeMode && (
            <div style={{ marginTop: '20px', padding: '14px 16px', background: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span>🔒</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>No credit card required</span>
              </div>
              <p style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.5 }}>
                Your 7-day free trial starts immediately. After 7 days you'll be asked to subscribe to continue using DumpTruckBoss.
              </p>
            </div>
          )}

          <p style={{ textAlign: 'center', fontSize: '14px', color: '#6b7280', marginTop: '20px' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: '#2d7a4f', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
          </p>
        </div>

        <p style={{ textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.3)', marginTop: '20px' }}>
          Need 15+ trucks?{' '}
          <Link href="/schedule-demo" style={{ color: '#f59e0b', textDecoration: 'none' }}>Schedule a demo</Link>
          {' '}for our Enterprise Plan.
        </p>
      </div>
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
