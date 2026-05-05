'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { X } from 'lucide-react'

export default function CheckoutSuccessBanner() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const pathname     = usePathname()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      setVisible(true)
      router.replace(pathname)
      const t = setTimeout(() => setVisible(false), 10_000)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!visible) return null

  return (
    <div style={{
      background: '#166534',
      borderBottom: '1px solid #15803d',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: '18px' }}>🎉</span>
      <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff', flex: 1 }}>
        Welcome to DumpTruckBoss! Your subscription is active — let&apos;s get you set up.
      </span>
      <button
        onClick={() => setVisible(false)}
        style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  )
}
