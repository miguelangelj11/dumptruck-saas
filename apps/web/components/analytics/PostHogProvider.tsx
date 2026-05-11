'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { initPosthog, trackPageView } from '@/lib/analytics/posthog'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    initPosthog()
  }, [])

  useEffect(() => {
    if (!pathname) return
    const qs = searchParams.toString()
    trackPageView(pathname + (qs ? `?${qs}` : ''))
  }, [pathname, searchParams])

  return <>{children}</>
}
