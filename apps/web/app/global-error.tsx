'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { AlertTriangle, RefreshCw, MessageSquare } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 flex items-center justify-center p-6 font-sans">
        <div className="max-w-sm w-full text-center space-y-5">
          <div className="h-16 w-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold text-gray-900">DumpTruckBoss hit a snag</h1>
            <p className="text-gray-500 text-sm">
              Something unexpected happened at the application level. We&apos;ve logged this automatically.
            </p>
          </div>

          {error.digest && (
            <p className="text-xs text-gray-400 font-mono bg-gray-100 rounded-lg px-3 py-2 inline-block">
              Error ID: {error.digest}
            </p>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#1e3a2a] text-white rounded-xl text-sm font-semibold hover:bg-[#2d4a3a] transition-colors"
            >
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
            <a
              href="/"
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Go home
            </a>
          </div>

          <a
            href="mailto:support@dumptruckboss.app?subject=Bug+Report"
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" /> Report this bug
          </a>
        </div>
      </body>
    </html>
  )
}
