'use client'

import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, MessageSquare } from 'lucide-react'

interface Props {
  children:  ReactNode
  fallback?: ReactNode
}

interface State {
  error:   Error | null
  eventId: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, eventId: null }

  static getDerivedStateFromError(error: Error): State {
    return { error, eventId: null }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Forward to Sentry if loaded
    if (typeof window !== 'undefined' && 'Sentry' in window) {
      const id = (window as { Sentry?: { captureException: (e: unknown, o: unknown) => string } })
        .Sentry?.captureException(error, { extra: { componentStack: info.componentStack } }) ?? null
      this.setState({ eventId: id })
    }
    console.error('[ErrorBoundary]', error, info)
  }

  reset = () => this.setState({ error: null, eventId: null })

  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <ErrorCard
          error={this.state.error}
          eventId={this.state.eventId}
          onReset={this.reset}
        />
      )
    }
    return this.props.children
  }
}

export function ErrorCard({
  error,
  eventId,
  onReset,
}: {
  error:    Error & { digest?: string }
  eventId?: string | null
  onReset?: () => void
}) {
  const ref = eventId ?? error.digest ?? null

  return (
    <div className="min-h-[320px] flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
          <AlertTriangle className="h-7 w-7 text-red-500" />
        </div>

        <div className="space-y-1">
          <h2 className="text-lg font-bold text-gray-900">Something went wrong</h2>
          <p className="text-sm text-gray-500">
            An unexpected error occurred. We&apos;ve been notified and will look into it.
          </p>
        </div>

        {ref && (
          <p className="text-xs text-gray-400 font-mono bg-gray-50 rounded-lg px-3 py-2 inline-block">
            Error ID: {ref}
          </p>
        )}

        <div className="flex gap-2 justify-center pt-1">
          {onReset && (
            <button
              onClick={onReset}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#1e3a2a] text-white rounded-xl text-sm font-medium hover:bg-[#2d4a3a] transition-colors"
            >
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          )}
          <a
            href="mailto:support@dumptruckboss.app?subject=Bug+Report"
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <MessageSquare className="h-4 w-4" /> Report bug
          </a>
        </div>
      </div>
    </div>
  )
}
