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

  const publicPaths = ['/', '/login', '/signup', '/forgot-password', '/reset-password', '/auth', '/api/test-setup']
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

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  return supabaseResponse
}
