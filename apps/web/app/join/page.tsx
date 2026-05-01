'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface InviteDetails {
  email: string
  role: string
  company_name: string
  company_id: string
}

function JoinForm() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const token        = searchParams.get('token') ?? ''

  const [invite,   setInvite]   = useState<InviteDetails | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [joining,  setJoining]  = useState(false)

  useEffect(() => {
    if (!token) {
      setError('You need an invite link to access this page.')
      setLoading(false)
      return
    }

    fetch(`/api/team/accept-invite?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (!data.valid) {
          setError(data.reason ?? 'Invalid invite link.')
        } else {
          setInvite({
            email:        data.email,
            role:         data.role,
            company_name: data.company_name,
            company_id:   data.company_id,
          })
        }
      })
      .catch(() => setError('Failed to load invite details.'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!invite) return

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setError(null)
    setJoining(true)

    try {
      const res  = await fetch('/api/team/accept-invite', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, password }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Something went wrong.')
        setJoining(false)
        return
      }

      // Sign in with the newly created credentials
      const supabase = createClient()
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email:    invite.email,
        password,
      })

      if (signInErr) {
        setError('Account created but sign-in failed. Please go to the login page.')
        setJoining(false)
        return
      }

      window.location.href = '/dashboard'
    } catch {
      setError('Something went wrong. Please try again.')
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
        <p style={{ color: '#6b7280', fontSize: '15px' }}>Loading invite...</p>
      </div>
    )
  }

  if (error && !invite) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
        <div style={{ background: '#fff', borderRadius: '12px', padding: '40px', maxWidth: '400px', width: '100%', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <h2 style={{ color: '#1e3a2a', marginBottom: '12px', fontSize: '20px' }}>Invalid Invite Link</h2>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>{error}</p>
          <a href="/login" style={{ display: 'inline-block', marginTop: '20px', color: '#2d7a4f', fontWeight: 600, fontSize: '14px', textDecoration: 'none' }}>
            Go to Login →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
      <div style={{ background: '#fff', borderRadius: '12px', padding: '40px', maxWidth: '420px', width: '100%', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <h2 style={{ color: '#1e3a2a', marginBottom: '4px', fontSize: '22px', fontWeight: 700 }}>
          Join {invite?.company_name}
        </h2>
        <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '28px' }}>
          You've been invited as a <strong>{invite?.role}</strong>. Create a password to complete your account setup.
        </p>

        <div style={{ marginBottom: '20px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 16px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#166534' }}>
            <strong>Email:</strong> {invite?.email}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              Confirm Password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat your password"
              required
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          {error && (
            <div style={{ marginBottom: '16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 14px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#b91c1c' }}>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={joining}
            style={{
              width: '100%',
              padding: '12px',
              background: joining ? '#9ca3af' : '#2d7a4f',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 700,
              cursor: joining ? 'not-allowed' : 'pointer',
            }}
          >
            {joining ? 'Joining...' : `Join ${invite?.company_name ?? 'Team'}`}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
        <p style={{ color: '#6b7280', fontSize: '15px' }}>Loading...</p>
      </div>
    }>
      <JoinForm />
    </Suspense>
  )
}
