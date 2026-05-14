'use client'

import { useState } from 'react'

export function FoundingMemberButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleClick() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'founding_member', skip_trial: true }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error ?? 'Something went wrong. Please try again.')
        setLoading(false)
      }
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        style={{
          display: 'block',
          width: '100%',
          padding: '16px',
          borderRadius: '12px',
          background: '#F5B731',
          color: '#1a1a1a',
          fontSize: '15px',
          fontWeight: 800,
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
          marginBottom: '8px',
        }}
      >
        {loading ? 'Redirecting to checkout…' : '🔥 Subscribe as Founding Member — $99/mo →'}
      </button>
      {error && (
        <p style={{ fontSize: '12px', color: '#f87171', textAlign: 'center' }}>{error}</p>
      )}
      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: '6px' }}>
        Your Founding Member rate — locked in for life
      </p>
    </div>
  )
}
