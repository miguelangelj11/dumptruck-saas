'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@workspace/ui/components/button'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [sessionReady, setSessionReady] = useState<boolean | null>(null) // null = checking
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)

  useEffect(() => {
    const supabase = createClient()

    // Check if a valid session exists (set by the /auth/callback route).
    // Also listen for the PASSWORD_RECOVERY event which Supabase fires when
    // the user arrives via a recovery link in some project configurations.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (event === 'PASSWORD_RECOVERY' || (session && sessionReady === null)) {
          setSessionReady(true)
        }
      }
    )

    // Fallback: check the current session directly in case the state-change
    // event already fired before we subscribed.
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      if (session) {
        setSessionReady(true)
      } else {
        // Only mark as not-ready if we haven't already seen a session
        setSessionReady(prev => (prev === true ? true : false))
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setDone(true)
    // Give the user a moment to read the success message, then redirect.
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  // ── Loading / session check ─────────────────────────────────────────────
  if (sessionReady === null) {
    return (
      <div className="flex min-h-svh items-center justify-center px-4">
        <p className="text-muted-foreground text-sm">Verifying reset link…</p>
      </div>
    )
  }

  // ── No valid session — link expired or already used ─────────────────────
  if (!sessionReady) {
    return (
      <div className="flex min-h-svh items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Link expired</h1>
          <p className="text-muted-foreground text-sm">
            This password reset link is invalid or has already been used.
            Please request a new one.
          </p>
          <Link
            href="/forgot-password"
            className="text-foreground text-sm underline underline-offset-4"
          >
            Request a new reset link
          </Link>
        </div>
      </div>
    )
  }

  // ── Success state ───────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="flex min-h-svh items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Password updated</h1>
          <p className="text-muted-foreground text-sm">
            Your password has been changed. Redirecting you to the dashboard…
          </p>
        </div>
      </div>
    )
  }

  // ── Password form ───────────────────────────────────────────────────────
  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Set new password</h1>
          <p className="text-muted-foreground text-sm">Choose a strong password for your account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              New password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-offset-2"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm" className="text-sm font-medium">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-offset-2"
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </div>
    </div>
  )
}
