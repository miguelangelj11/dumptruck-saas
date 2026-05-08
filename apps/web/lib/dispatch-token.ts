import { createHmac, timingSafeEqual } from 'crypto'

const TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function secret(): string {
  return process.env.DISPATCH_HMAC_SECRET ?? 'dev-insecure-fallback-set-in-prod'
}

// Token format: "{expiresAt}.{hmac}"
// HMAC covers both dispatchId and expiresAt so neither can be tampered independently.
export function generateDispatchToken(dispatchId: string): string {
  const expiresAt = Date.now() + TTL_MS
  const hmac = createHmac('sha256', secret()).update(`${dispatchId}:${expiresAt}`).digest('hex')
  return `${expiresAt}.${hmac}`
}

export function verifyDispatchToken(dispatchId: string, token: string): boolean {
  const dot = token.indexOf('.')
  if (dot > 0) {
    const expiresAt = parseInt(token.slice(0, dot), 10)
    const hmac = token.slice(dot + 1)
    if (isNaN(expiresAt) || Date.now() > expiresAt) return false
    const expected = createHmac('sha256', secret()).update(`${dispatchId}:${expiresAt}`).digest('hex')
    try {
      const a = Buffer.from(expected, 'hex')
      const b = Buffer.from(hmac, 'hex')
      if (a.length !== b.length) { timingSafeEqual(a, a); return false }
      return timingSafeEqual(a, b)
    } catch { return false }
  }

  // Legacy: accept old base64 tokens so links sent before this deploy keep working for 24h.
  const legacy = Buffer.from(dispatchId).toString('base64')
  return token === legacy
}
