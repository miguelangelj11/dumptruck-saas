import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  )
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rate limiting for API and auth routes
  let cfg
  if (pathname.startsWith('/auth/'))               cfg = LIMITS.authCallback
  else if (pathname.startsWith('/api/test-setup')) cfg = LIMITS.testSetup
  else if (pathname.startsWith('/api/'))           cfg = LIMITS.api

  if (cfg) {
    const ip     = getIp(request)
    const key    = `rl:${ip}:${pathname.split('/').slice(0, 3).join('/')}`
    const result = checkRateLimit(key, cfg)

    if (!result.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        {
          status: 429,
          headers: {
            'Retry-After':           String(result.retryAfter ?? 60),
            'X-RateLimit-Limit':     String(cfg.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset':     String(result.resetAt),
          },
        }
      )
    }
  }

  // Supabase session refresh (must run on every request)
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
