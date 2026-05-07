/**
 * Rate limiter with Upstash Redis (distributed) or in-memory fallback.
 *
 * Production setup (Vercel):
 *   1. Create a free Redis database at console.upstash.com
 *   2. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to Vercel env vars
 *   3. Redeploy — the distributed limiter activates automatically
 *
 * Without those env vars, falls back to in-memory (works for single-instance
 * dev/staging but won't share state across Vercel serverless instances).
 *
 * TODO: Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in Vercel for production.
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis }     from '@upstash/redis'

// ── In-memory fallback store ─────────────────────────────────────────────────

interface Entry { count: number; reset: number }
const memStore = new Map<string, Entry>()

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [k, v] of memStore) {
      if (now > v.reset) memStore.delete(k)
    }
  }, 5 * 60_000)
}

// ── Upstash limiter cache (one instance per window+limit combo) ───────────────

const upstashLimiters = new Map<string, Ratelimit>()

function msToUpstashWindow(ms: number): `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}` {
  if (ms < 1_000)      return `${ms} ms`
  if (ms < 60_000)     return `${Math.round(ms / 1_000)} s`
  if (ms < 3_600_000)  return `${Math.round(ms / 60_000)} m`
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)} h`
  return `${Math.round(ms / 86_400_000)} d`
}

function getUpstashLimiter(cfg: RateLimitConfig): Ratelimit | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  const k = `${cfg.limit}:${cfg.windowMs}`
  if (upstashLimiters.has(k)) return upstashLimiters.get(k)!

  try {
    const redis   = new Redis({ url, token })
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(cfg.limit, msToUpstashWindow(cfg.windowMs)),
      prefix:  'dtb',
    })
    upstashLimiters.set(k, limiter)
    return limiter
  } catch {
    return null
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  limit:    number
  windowMs: number
}

export interface RateLimitResult {
  allowed:      boolean
  remaining:    number
  resetAt:      number
  retryAfter?:  number
}

// ── Main export (async — awaits Upstash when available) ───────────────────────

export async function checkRateLimit(key: string, cfg: RateLimitConfig): Promise<RateLimitResult> {
  const limiter = getUpstashLimiter(cfg)

  if (limiter) {
    try {
      const { success, remaining, reset } = await limiter.limit(key)
      const resetAt = Math.ceil(Number(reset) / 1000)
      return {
        allowed:     success,
        remaining:   Math.max(0, remaining),
        resetAt,
        retryAfter:  success ? undefined : Math.max(0, resetAt - Math.ceil(Date.now() / 1000)),
      }
    } catch {
      // Redis unavailable — fall through to in-memory
    }
  }

  // In-memory fallback
  const now   = Date.now()
  const entry = memStore.get(key)

  if (!entry || now > entry.reset) {
    memStore.set(key, { count: 1, reset: now + cfg.windowMs })
    return { allowed: true, remaining: cfg.limit - 1, resetAt: Math.ceil((now + cfg.windowMs) / 1000) }
  }

  if (entry.count >= cfg.limit) {
    const retryAfter = Math.ceil((entry.reset - now) / 1000)
    return { allowed: false, remaining: 0, resetAt: Math.ceil(entry.reset / 1000), retryAfter }
  }

  entry.count++
  return { allowed: true, remaining: cfg.limit - entry.count, resetAt: Math.ceil(entry.reset / 1000) }
}

// ── Pre-configured limits ────────────────────────────────────────────────────

export const LIMITS = {
  /** Auth callback: 20 req / 10 min per IP */
  authCallback: { limit: 20, windowMs: 10 * 60_000 },
  /** Internal test-setup: 10 req / min per IP */
  testSetup:    { limit: 10, windowMs: 60_000 },
  /** General API: 120 req / min per IP */
  api:          { limit: 120, windowMs: 60_000 },
  /** AI chat: 20 req / hr per user (Claude API cost control) */
  chat:         { limit: 20, windowMs: 60 * 60_000 },
  /** OCR: 30 scans / hr per user (Anthropic API cost control) */
  ocr:          { limit: 30, windowMs: 60 * 60_000 },
  /** AI document extraction: 20 per hr per user */
  docExtract:   { limit: 20, windowMs: 60 * 60_000 },
} satisfies Record<string, RateLimitConfig>
