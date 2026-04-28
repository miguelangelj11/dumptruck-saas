/**
 * IP-based rate limiter.
 *
 * In production with a single origin, the in-memory store works fine for low
 * to medium traffic.  To support multiple instances (e.g. Vercel Edge / multi-
 * replica), swap `MemoryStore` for the Upstash Redis adapter:
 *
 *   import { Ratelimit } from '@upstash/ratelimit'
 *   import { Redis }     from '@upstash/redis'
 *   const redis = Redis.fromEnv()           // UPSTASH_REDIS_REST_URL + TOKEN
 *   const ratelimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(N, 'Xs') })
 *   const { success } = await ratelimit.limit(ip)
 */

interface Entry { count: number; reset: number }
const store = new Map<string, Entry>()

// Clean up expired entries every 5 minutes so the map doesn't grow unbounded
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [k, v] of store) {
      if (now > v.reset) store.delete(k)
    }
  }, 5 * 60_000)
}

export interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number
  /** Window duration in milliseconds */
  windowMs: number
}

export interface RateLimitResult {
  allowed:     boolean
  remaining:   number
  resetAt:     number   // unix seconds
  retryAfter?: number   // seconds until reset (only when blocked)
}

export function checkRateLimit(key: string, cfg: RateLimitConfig): RateLimitResult {
  const now   = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.reset) {
    store.set(key, { count: 1, reset: now + cfg.windowMs })
    return { allowed: true, remaining: cfg.limit - 1, resetAt: Math.ceil((now + cfg.windowMs) / 1000) }
  }

  if (entry.count >= cfg.limit) {
    const retryAfter = Math.ceil((entry.reset - now) / 1000)
    return { allowed: false, remaining: 0, resetAt: Math.ceil(entry.reset / 1000), retryAfter }
  }

  entry.count++
  return { allowed: true, remaining: cfg.limit - entry.count, resetAt: Math.ceil(entry.reset / 1000) }
}

// ── Pre-configured limiters ──────────────────────────────────────────────────

export const LIMITS = {
  /** Auth callback / token exchange: 20 req / 10 min per IP */
  authCallback: { limit: 20, windowMs: 10 * 60_000 },
  /** Internal test-setup route: 10 req / min per IP */
  testSetup:    { limit: 10, windowMs: 60_000 },
  /** General API routes: 120 req / min per IP */
  api:          { limit: 120, windowMs: 60_000 },
} satisfies Record<string, RateLimitConfig>
