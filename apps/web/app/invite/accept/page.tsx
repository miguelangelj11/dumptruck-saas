'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

type InviteDetails =
  | { valid: true;  email: string; role: string; companyName: string }
  | { valid: false; reason: 'expired' | 'accepted' | 'invalid' }

const ROLE_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  admin:      { label: 'Admin',      color: '#7c3aed', bg: '#f5f3ff' },
  dispatcher: { label: 'Dispatcher', color: '#2563eb', bg: '#eff6ff' },
  driver:     { label: 'Driver',     color: '#16a34a', bg: '#f0fdf4' },
  accountant: { label: 'Accountant', color: '#d97706', bg: '#fffbeb' },
}

function getStrength(pw: string): { score: 0 | 1 | 2 | 3; label: string; color: string } {
  if (pw.length < 8) return { score: 0, label: '', color: '' }
  let s = 1
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/[0-9]/.test(pw) || /[^A-Za-z0-9]/.test(pw)) s++
  if (s === 1) return { score: 1, label: 'Weak',   color: '#ef4444' }
  if (s === 2) return { score: 2, label: 'Fair',   color: '#f59e0b' }
  return             { score: 3, label: 'Strong',  color: '#4ade80' }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh', background: '#0f1923',
      backgroundImage: 'radial-gradient(#ffffff06 1px, transparent 1px)',
      backgroundSize: '24px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <Image src="/logo.png" alt="DumpTruckBoss" width={96} height={48}   />
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>DumpTruckBoss</span>
          </Link>
        </div>
        {children}
      </div>
    </div>
  )
}

function AcceptForm() {
  const params  = useSearchParams()
  const router  = useRouter()
  const token   = params.get('t') ?? ''

  const [details,  setDetails]  = useState<InviteDetails | null>(null)
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState(false)

  useEffect(() => {
    if (!token) { setDetails({ valid: false, reason: 'invalid' }); return }
    fetch(`/api/invite/details?t=${token}`)
      .then(r => r.json())
      .then(setDetails)
      .catch(() => setDetails({ valid: false, reason: 'invalid' }))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm)  { setError('Passwords do not match'); return }
    if (password.length < 8)   { setError('Password must be at least 8 characters'); return }
    setError('')
    setLoading(true)

    const supabase = createClient()

    // User is already authenticated via magic link session — just set the password
    const { error: updateErr } = await supabase.auth.updateUser({
      password,
      data: { full_name: fullName.trim() },
    })
    if (updateErr) { setError(updateErr.message); setLoading(false); return }

    // Finalize: creates team_members row, links driver record if applicable
    const res  = await fetch('/api/invite/complete', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Failed to complete invite'); setLoading(false); return }

    setSuccess(true)
    setTimeout(() => router.push(json.role === 'driver' ? '/driver' : '/dashboard'), 1800)
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (!details) return (
    <Shell>
      <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
        Verifying your invitation…
      </div>
    </Shell>
  )

  // ── Error states ─────────────────────────────────────────────────────────────
  if (!details.valid) {
    const msgs = {
      expired:  { title: 'Invite link expired',  body: 'This invitation has expired. Ask your admin to send a new one.' },
      accepted: { title: 'Already accepted',      body: 'This invite has already been used. Sign in to your account.' },
      invalid:  { title: 'Invalid invite link',   body: 'This link is not valid or may have already been used.' },
    } as const
    const m = msgs[details.reason]
    return (
      <Shell>
        <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔗</div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>{m.title}</h2>
          <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.6, marginBottom: '24px' }}>{m.body}</p>
          {details.reason === 'accepted' && (
            <Link href="/login" style={{
              display: 'inline-block', background: '#2d7a4f', color: '#fff',
              fontWeight: 700, padding: '10px 24px', borderRadius: '8px',
              textDecoration: 'none', fontSize: '14px',
            }}>
              Sign In →
            </Link>
          )}
        </div>
      </Shell>
    )
  }

  // ── Success ──────────────────────────────────────────────────────────────────
  if (success) return (
    <Shell>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', textAlign: 'center' }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '50%', background: '#dcfce7',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: '24px', color: '#16a34a',
        }}>✓</div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
          Welcome to {details.companyName}!
        </h2>
        <p style={{ fontSize: '14px', color: '#6b7280' }}>Taking you to your dashboard…</p>
      </div>
    </Shell>
  )

  // ── Form ─────────────────────────────────────────────────────────────────────
  const roleInfo  = ROLE_STYLE[details.role] ?? { label: details.role, color: '#374151', bg: '#f9fafb' }
  const strength  = getStrength(password)
  const canSubmit = fullName.trim().length > 0 && password.length >= 8 && password === confirm && !loading

  return (
    <Shell>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>
            Join {details.companyName}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: '#6b7280' }}>You've been invited as</span>
            <span style={{
              fontSize: '12px', fontWeight: 700, padding: '2px 10px', borderRadius: '999px',
              color: roleInfo.color, background: roleInfo.bg,
            }}>
              {roleInfo.label}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Email — pre-filled, locked */}
          <div>
            <label style={labelStyle}>Email address</label>
            <input
              type="email"
              value={details.email}
              readOnly
              style={{ ...inputStyle, background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }}
            />
          </div>

          {/* Full name */}
          <div>
            <label style={labelStyle}>Your full name</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              placeholder="Jake Morrison"
              autoComplete="name"
              style={inputStyle}
            />
          </div>

          {/* Password */}
          <div>
            <label style={labelStyle}>Create a password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              style={inputStyle}
            />
            {password.length >= 8 && (
              <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: '#e5e7eb', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${(strength.score / 3) * 100}%`,
                    background: strength.color, borderRadius: '2px', transition: 'width 0.2s',
                  }} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: strength.color }}>{strength.label}</span>
              </div>
            )}
          </div>

          {/* Confirm */}
          <div>
            <label style={labelStyle}>Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              placeholder="Re-enter your password"
              autoComplete="new-password"
              style={{
                ...inputStyle,
                borderColor: confirm.length > 0
                  ? (confirm === password ? '#4ade80' : '#ef4444')
                  : '#e5e7eb',
              }}
            />
            {confirm.length > 0 && (
              <p style={{ fontSize: '12px', marginTop: '4px', color: confirm === password ? '#16a34a' : '#ef4444' }}>
                {confirm === password ? '✓ Passwords match' : 'Passwords do not match'}
              </p>
            )}
          </div>

          {error && (
            <p style={{
              fontSize: '13px', color: '#dc2626', background: '#fef2f2',
              padding: '10px 12px', borderRadius: '8px', margin: 0,
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              width: '100%', padding: '13px', borderRadius: '10px',
              background: canSubmit ? '#2d7a4f' : '#d1d5db',
              color: '#fff', fontSize: '15px', fontWeight: 700, border: 'none',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              opacity: loading ? 0.75 : 1,
            }}
          >
            {loading ? 'Setting up your account…' : `Create Account & Join ${details.companyName}`}
          </button>
        </form>
      </div>
    </Shell>
  )
}

// useSearchParams requires Suspense in Next.js App Router
export default function InviteAcceptPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0f1923', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Loading…</span>
      </div>
    }>
      <AcceptForm />
    </Suspense>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', borderRadius: '8px', border: '1px solid #e5e7eb',
  padding: '10px 14px', fontSize: '14px', color: '#111827',
  outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px',
}
