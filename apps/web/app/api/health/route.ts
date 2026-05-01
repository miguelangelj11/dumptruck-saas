import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Public endpoint — Vercel can ping this with a synthetic monitor.
// Returns 200 when all services are reachable, 503 when any are down.
export async function GET() {
  const t0 = Date.now()

  const checks: Record<string, { ok: boolean; latencyMs: number; note?: string }> = {}

  // ── Supabase ─────────────────────────────────────────────────────────────
  try {
    const t = Date.now()
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    // SELECT 1 equivalent — tiny, no RLS needed
    const { error } = await admin.rpc('version')
    checks.supabase = {
      ok:        !error,
      latencyMs: Date.now() - t,
      note:      error?.message,
    }
  } catch (e) {
    checks.supabase = { ok: false, latencyMs: 0, note: String(e) }
  }

  // ── Stripe (verify key is present and well-formed — no network call) ──────
  const stripeKey = process.env.STRIPE_SECRET_KEY ?? ''
  checks.stripe = {
    ok:        stripeKey.startsWith('sk_live_') || stripeKey.startsWith('sk_test_'),
    latencyMs: 0,
    note:      stripeKey ? undefined : 'STRIPE_SECRET_KEY not set',
  }

  // ── Anthropic (verify key present — no network call) ─────────────────────
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? ''
  checks.anthropic = {
    ok:        anthropicKey.startsWith('sk-ant-'),
    latencyMs: 0,
    note:      anthropicKey ? undefined : 'ANTHROPIC_API_KEY not set',
  }

  const allOk    = Object.values(checks).every(c => c.ok)
  const totalMs  = Date.now() - t0

  return NextResponse.json(
    {
      status:  allOk ? 'ok' : 'degraded',
      checks,
      totalMs,
      ts:      new Date().toISOString(),
    },
    {
      status: allOk ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}
