// POSTHOG SETUP INSTRUCTIONS:
// 1. Go to https://posthog.com → Sign up free
// 2. Create a new project: "DumpTruckBoss"
// 3. Copy your Project API Key (starts with phc_)
// 4. Add to Vercel env vars:
//    NEXT_PUBLIC_POSTHOG_KEY  = phc_yourkey
//    NEXT_PUBLIC_POSTHOG_HOST = https://app.posthog.com
// 5. Redeploy — events will appear at app.posthog.com/dashboard

import posthog from 'posthog-js'

export const initPosthog = () => {
  if (typeof window === 'undefined') return
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    console.warn('[analytics] PostHog key not set — analytics disabled')
    return
  }
  if (posthog.__loaded) return

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com',
    capture_pageview: false,  // handled manually for Next.js router
    capture_pageleave: true,
    autocapture: true,
    session_recording: {
      maskAllInputs: true,
      maskInputOptions: { password: true },
    },
  })
}

export const trackPageView = (url: string) => {
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return
  posthog.capture('$pageview', { $current_url: url })
}

export const track = (event: string, properties?: Record<string, unknown>) => {
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return
  posthog.capture(event, properties)
}

export const identifyUser = (userId: string, traits?: Record<string, unknown>) => {
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return
  posthog.identify(userId, traits)
}

export const identifyCompany = (companyId: string, traits?: Record<string, unknown>) => {
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return
  posthog.group('company', companyId, traits)
}

export default posthog
