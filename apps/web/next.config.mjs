import { withSentryConfig } from '@sentry/nextjs'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@workspace/ui'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'sjllakzzfaajgpxamfem.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
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
