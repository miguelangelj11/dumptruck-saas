'use client'

export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#1a1a1a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '32px',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/icon-192x192.png"
        alt="DumpTruckBoss"
        style={{ width: 96, height: 96, borderRadius: '24px', marginBottom: '24px', opacity: 0.85 }}
      />
      <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
        You&apos;re Offline
      </h1>
      <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.5)', maxWidth: '320px', lineHeight: 1.6, marginBottom: '28px' }}>
        No internet connection. Some features may be limited, but your recent data is still available.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '12px 28px',
          background: '#F5B731',
          color: '#1a1a1a',
          fontWeight: 700,
          fontSize: '15px',
          borderRadius: '12px',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Try Again
      </button>
    </div>
  )
}
