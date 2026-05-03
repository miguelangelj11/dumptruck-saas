import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  const { data } = await supabase.auth.getClaims()

  const user = data?.claims
  const pathname = request.nextUrl.pathname

  const publicPaths = [
    '/', '/login', '/signup', '/forgot-password', '/reset-password', '/auth', '/api/test-setup',
    '/about', '/blog', '/careers', '/privacy', '/terms', '/security', '/changelog',
    '/pricing', '/features', '/schedule-demo', '/trial-expired', '/subscribe',
    '/api/webhooks', '/api/stripe/webhook', '/api/health', '/api/invite', '/api/team/accept-invite', '/api/dispatches/respond',
    '/api/public',
    '/invite', '/join', '/portal',
  ]
  const isPublic = publicPaths.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && (pathname.startsWith('/dashboard') || pathname.startsWith('/driver'))) {
    const { data: driverRow } = await supabase
      .from('drivers')
      .select('id')
      .eq('auth_user_id', user.sub)
      .maybeSingle()

    if (pathname.startsWith('/dashboard') && driverRow) {
      const url = request.nextUrl.clone()
      url.pathname = '/driver'
      return NextResponse.redirect(url)
    }

    if (pathname.startsWith('/driver') && !driverRow) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // ── Trial / subscription enforcement for API routes ───────────────────────
  // Blocks expired-trial users from calling data-mutation endpoints directly,
  // even if they bypass the UI.  Excluded: webhooks (must always pass through),
  // account deletion (so expired users can still delete their data), test-setup.
  const isProtectedApiCall =
    user &&
    pathname.startsWith('/api/') &&
    !pathname.startsWith('/api/webhooks/') &&
    !pathname.startsWith('/api/account/delete') &&
    !pathname.startsWith('/api/billing/') &&   // expired users need billing access to pay
    !pathname.startsWith('/api/me/') &&        // identity resolution must always pass through
    !pathname.startsWith('/api/health') &&
    !pathname.startsWith('/api/test-setup')

  if (isProtectedApiCall) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.sub)
      .maybeSingle()
    const { data: company } = prof?.organization_id
      ? await supabase.from('companies').select('subscription_status, trial_ends_at, is_internal').eq('id', prof.organization_id).maybeSingle()
      : { data: null }

    const co          = company as Record<string, unknown> | null
    const status      = co?.subscription_status as string | null
    const trialEndsAt = co?.trial_ends_at as string | null
    const isInternal  = !!(co?.is_internal)

    const isExpired =
      !isInternal && (
        status === 'expired' ||
        status === 'canceled' ||
        (status === 'trial' && trialEndsAt != null && new Date(trialEndsAt) < new Date())
      )

    if (isExpired) {
      return NextResponse.json(
        { error: 'Your trial or subscription has expired. Please subscribe to continue.' },
        { status: 402 }
      )
    }
  }

  supabaseResponse.headers.set('x-pathname', pathname)

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  return supabaseResponse
}
