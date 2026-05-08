'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    const ios = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())
    setIsIOS(ios)

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setTimeout(() => setShowPrompt(true), 30_000)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    if (ios && !localStorage.getItem('dtb_install_dismissed')) {
      setTimeout(() => setShowPrompt(true), 15_000)
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowPrompt(false)
      setIsInstalled(true)
    }
    setDeferredPrompt(null)
  }

  function handleDismiss() {
    setShowPrompt(false)
    localStorage.setItem('dtb_install_dismissed', Date.now().toString())
  }

  if (!showPrompt || isInstalled) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:hidden">
      <div
        style={{
          background: '#1a1a1a',
          border: '1px solid #F5B731',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
          animation: 'dtb-slide-up 0.3s ease-out',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <Image
            src="/icons/icon-72x72.png"
            alt="DumpTruckBoss"
            width={56}
            height={56}
            style={{ borderRadius: '14px', flexShrink: 0 }}
          />
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, color: '#fff', fontSize: '15px', marginBottom: '2px' }}>
              Install DumpTruckBoss
            </p>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '12px' }}>
              Add to your home screen for faster access
            </p>

            {isIOS ? (
              <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px 12px' }}>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                  Tap <span style={{ color: '#F5B731', fontWeight: 600 }}>Share ⬆</span> then{' '}
                  <span style={{ color: '#F5B731', fontWeight: 600 }}>&quot;Add to Home Screen&quot;</span>
                </p>
              </div>
            ) : (
              <button
                onClick={handleInstall}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: '#F5B731',
                  color: '#1a1a1a',
                  fontWeight: 700,
                  fontSize: '14px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Install App
              </button>
            )}
          </div>
          <button
            onClick={handleDismiss}
            style={{
              color: 'rgba(255,255,255,0.4)',
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '0 4px',
              minHeight: 'unset',
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}
