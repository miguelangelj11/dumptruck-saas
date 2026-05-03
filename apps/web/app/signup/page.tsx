'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

type Plan = 'owner_operator' | 'fleet'

const PLANS: { id: Plan; name: string; price: string; desc: string; color: string }[] = [
  { id: 'owner_operator', name: 'Owner Operator Plan', price: '$80/mo', desc: '1–3 trucks, solo operator', color: '#f59e0b' },
  { id: 'fleet',          name: 'Fleet Plan',          price: '$150/mo', desc: '4–15 trucks, growing fleet', color: '#2d7a4f' },
]

export default function SignupPage() {
  const router = useRouter()
  const [selectedPlan, setSelectedPlan]       = useState<Plan | null>(null)
  const [companyName, setCompanyName]         = useState('')
  const [email, setEmail]                     = useState('')
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreedToTerms, setAgreedToTerms]     = useState(false)
  const [loading, setLoading]                 = useState(false)

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('plan')
    if (p === 'fleet') setSelectedPlan('fleet')
    else if (p === 'owner_operator' || p === 'owner') setSelectedPlan('owner_operator')
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPlan)             { toast.error('Please select a plan'); return }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return }
    if (!agreedToTerms)            { toast.error('You must agree to the Terms of Service'); return }

    setLoading(true)

    // 15-second hard timeout
    const timer = setTimeout(() => {
      toast.error('Something went wrong. Please try again.')
      setLoading(false)
    }, 15_000)

    try {
      const supabase = createClient()

      // Step 1: create auth user
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        clearTimeout(timer)
        toast.error(error.message)
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

      // Step 2: create company row
      const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      await supabase.from('companies').insert({
        name:                companyName,
        owner_id:            user.id,
        plan:                selectedPlan,
        trial_started_at:    new Date().toISOString(),
        trial_ends_at:       trialEndsAt,
        subscription_status: 'trial',
      })

      // Save plan to localStorage so Settings page can read it later
      localStorage.setItem('dtb_selected_plan', selectedPlan)

      clearTimeout(timer)

      // Step 3: go to dashboard
      router.push('/dashboard')
    } catch (err) {
      clearTimeout(timer)
      console.error('[signup] unexpected error', err)
      toast.error('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f1923', backgroundImage: 'radial-gradient(#ffffff06 1px, transparent 1px)', backgroundSize: '24px 24px', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: '520px', margin: '0 auto' }}>

        {/* Logo + heading */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none', marginBottom: '20px' }}>
            <Image src="/dtb-logo.png" alt="DumpTruckBoss" width={48} height={48} className="rounded-full object-contain" style={{ width: '48px', height: '48px' }} />
            <span style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>DumpTruckBoss</span>
          </Link>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>Start your free 14-day trial</h1>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)' }}>No credit card required. Full access from day one.</p>
        </div>

        {/* Plan selector */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '12px' }}>Which plan are you signing up for?</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {PLANS.map((plan) => {
              const sel = selectedPlan === plan.id
              return (
                <button key={plan.id} type="button" onClick={() => setSelectedPlan(plan.id)} style={{
                  background: sel ? `${plan.color}18` : 'rgba(255,255,255,0.04)',
                  border: `2px solid ${sel ? plan.color : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '12px', padding: '16px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s', outline: 'none',
                }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: sel ? plan.color : '#fff', marginBottom: '4px' }}>{plan.name}</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: sel ? plan.color : 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>{plan.price}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{plan.desc}</div>
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
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email" placeholder="you@company.com" style={inputStyle} />
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

            <button type="submit" disabled={loading || !selectedPlan} style={{
              width: '100%', padding: '14px', borderRadius: '10px',
              background: !selectedPlan ? '#d1d5db' : '#2d7a4f',
              color: '#fff', fontSize: '15px', fontWeight: 700, border: 'none',
              cursor: !selectedPlan ? 'not-allowed' : 'pointer', transition: 'background 0.15s', opacity: loading ? 0.7 : 1,
            }}>
              {loading ? 'Creating account…' : 'Start My Free 14-Day Trial'}
            </button>
          </form>

          <div style={{ marginTop: '20px', padding: '14px 16px', background: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <span>🔒</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>No credit card required</span>
            </div>
            <p style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.5 }}>
              Your 14-day free trial starts immediately. After 14 days you'll be asked to subscribe to continue using DumpTruckBoss.
            </p>
          </div>

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
