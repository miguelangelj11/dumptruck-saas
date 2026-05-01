import { withSentryConfig } from '@sentry/nextjs'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const SUPABASE_HOST = 'sjllakzzfaajgpxamfem.supabase.co'

const csp = [
  "default-src 'self'",
  // Next.js requires unsafe-inline without nonce-based CSP; unsafe-eval for HMR in dev
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://${SUPABASE_HOST}`,
  "font-src 'self' data:",
  `connect-src 'self' https://${SUPABASE_HOST} wss://${SUPABASE_HOST} https://api.stripe.com https://*.sentry.io`,
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "worker-src blob: 'self'",
].join('; ')

const securityHeaders = [
  { key: 'X-Frame-Options',           value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy',   value: csp },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@workspace/ui'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: SUPABASE_HOST,
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}

export default withSentryConfig(withNextIntl(nextConfig), {
  org:       process.env.SENTRY_ORG,
  project:   process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Don't spam the terminal when SENTRY_AUTH_TOKEN isn't set locally
  silent: !process.env.CI,

  webpack: {
    // Tree-shake Sentry debug code in production bundles
    treeshake: { removeDebugLogging: true },
    // Automatically instrument Vercel Cron routes
    automaticVercelMonitors: true,
  },
})
