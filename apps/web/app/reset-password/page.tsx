'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

function getStrength(pw: string): { score: 0 | 1 | 2 | 3; label: string; color: string } {
  if (pw.length < 8) return { score: 0, label: '', color: '' }
  let score = 1
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/[0-9]/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++
  if (score === 1) return { score: 1, label: 'Weak',   color: '#ef4444' }
  if (score === 2) return { score: 2, label: 'Fair',   color: '#f59e0b' }
  return               { score: 3, label: 'Strong', color: '#4ade80' }
}

function ResetPasswordInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [sessionReady, setSessionReady] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)

  const strength = getStrength(password)

  useEffect(() => {
    const supabase   = createClient()
    const tokenHash  = searchParams.get('token_hash')
    const type       = searchParams.get('type')

    async function init() {
      // Case 1: Supabase redirected here with token_hash — verify client-side
      if (tokenHash && type === 'recovery') {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
        setSessionReady(!error)
        return
      }

      // Case 2: Supabase used implicit flow — token is in URL hash fragment
      // onAuthStateChange fires PASSWORD_RECOVERY in this case
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
        if (event === 'PASSWORD_RECOVERY') {
          setSessionReady(true)
        }
      })

      // Case 3: Session was already established (e.g. via server-side callback)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setSessionReady(true)
        subscription.unsubscribe()
        return
      }

      // No token and no session — mark as invalid
      setTimeout(() => {
        setSessionReady(prev => (prev === true ? true : false))
        subscription.unsubscribe()
      }, 1500)
    }

    init()
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setDone(true)
    setTimeout(() => router.push('/login'), 2000)
  }

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#0f1923',
    backgroundImage: 'radial-gradient(#ffffff06 1px, transparent 1px)',
    backgroundSize: '24px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
  }

  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '420px',
  }

  if (sessionReady === null) {
    return (
      <div style={containerStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>Verifying reset link…</p>
        </div>
      </div>
    )
  }

  if (!sessionReady) {
    return (
      <div style={containerStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '24px' }}>
            🔒
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '10px' }}>Link expired</h1>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: '24px' }}>
            This password reset link is invalid or has already been used. Reset links expire after 1 hour.
          </p>
          <Link
            href="/forgot-password"
            style={{ display: 'inline-block', padding: '11px 24px', borderRadius: '10px', background: '#2d7a4f', color: '#fff', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}
          >
            Request a new link
          </Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div style={containerStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: '#2d7a4f', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '24px' }}>
            ✓
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '10px' }}>Password updated!</h1>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
            Your password has been changed. Redirecting to sign in…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none', marginBottom: '20px' }}>
            <Image src="/logo.png" alt="DumpTruckBoss" width={96} height={48} />
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>DumpTruckBoss</span>
          </Link>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>Set a new password</h1>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)' }}>Choose a strong password for your account.</p>
        </div>

        <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                New password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                style={{ width: '100%', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '10px 14px', fontSize: '14px', color: '#111827', outline: 'none', boxSizing: 'border-box' }}
              />
              {password.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                    {([1, 2, 3] as const).map((n) => (
                      <div key={n} style={{ flex: 1, height: '4px', borderRadius: '2px', background: strength.score >= n ? strength.color : '#e5e7eb', transition: 'background 0.2s' }} />
                    ))}
                  </div>
                  {strength.label && <p style={{ fontSize: '12px', color: strength.color, fontWeight: 500 }}>{strength.label}</p>}
                  {password.length < 8 && <p style={{ fontSize: '12px', color: '#9ca3af' }}>{8 - password.length} more character{8 - password.length !== 1 ? 's' : ''} required</p>}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                Confirm new password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Re-enter your password"
                style={{ width: '100%', borderRadius: '8px', border: `1px solid ${confirm.length > 0 && confirm !== password ? '#fca5a5' : '#e5e7eb'}`, padding: '10px 14px', fontSize: '14px', color: '#111827', outline: 'none', boxSizing: 'border-box' }}
              />
              {confirm.length > 0 && confirm !== password && <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>Passwords do not match</p>}
              {confirm.length > 0 && confirm === password && password.length >= 8 && <p style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px' }}>✓ Passwords match</p>}
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px' }}>
                <p style={{ fontSize: '13px', color: '#dc2626', margin: 0 }}>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || password.length < 8 || password !== confirm}
              style={{ width: '100%', padding: '13px', borderRadius: '10px', background: (loading || password.length < 8 || password !== confirm) ? '#d1d5db' : '#2d7a4f', color: '#fff', fontSize: '15px', fontWeight: 700, border: 'none', cursor: (loading || password.length < 8 || password !== confirm) ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}
            >
              {loading ? 'Updating password…' : 'Update Password'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.3)', marginTop: '20px' }}>
          <Link href="/login" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0f1923', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>Loading…</p>
      </div>
    }>
      <ResetPasswordInner />
    </Suspense>
  )
}
