import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,

    // Capture 10% of sessions for performance tracing in production
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Capture 5% of replays in production, 100% of sessions with errors
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.replayIntegration({
        // Mask form inputs to avoid capturing passwords / PII
        maskAllInputs:  true,
        blockAllMedia:  false,
      }),
    ],

    // Filter out noise before sending to Sentry
    beforeSend(event, hint) {
      const err = hint.originalException
      // Drop network errors caused by user going offline
      if (err instanceof TypeError && typeof err.message === 'string') {
        if (err.message.includes('NetworkError') || err.message.includes('Failed to fetch')) {
          return null
        }
      }
      return event
    },

    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
    ],
  })
}
