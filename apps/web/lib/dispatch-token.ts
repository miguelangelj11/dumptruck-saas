import { createHmac, timingSafeEqual } from 'crypto'

function secret(): string {
  // DISPATCH_HMAC_SECRET must be set in production via Vercel env vars
  return process.env.DISPATCH_HMAC_SECRET ?? 'dev-insecure-fallback-set-in-prod'
}

export function generateDispatchToken(dispatchId: string): string {
  return createHmac('sha256', secret()).update(dispatchId).digest('hex')
}

export function verifyDispatchToken(dispatchId: string, token: string): boolean {
  const expected = generateDispatchToken(dispatchId)

  // Constant-time comparison to prevent timing attacks
  try {
    const a = Buffer.from(expected, 'hex')
    const b = Buffer.from(token.padEnd(expected.length, '\0'), 'hex')
    if (a.length !== b.length) {
      // Lengths differ — still do the compare to avoid timing leak, then reject
      timingSafeEqual(a, a)
      return false
    }
    if (timingSafeEqual(a, b)) return true
  } catch {
    // fall through to legacy check
  }

  // Grace period: also accept old base64 tokens so existing email links keep working.
  // Remove this block after all outstanding dispatch emails have expired (48h).
  const legacy = Buffer.from(dispatchId).toString('base64')
  return token === legacy
}
