'use client'

import { useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

export default function SoloUpgradeNudge() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <div className="mx-6 mt-4 rounded-xl border border-[#F5B731]/40 bg-[#1a1500] px-5 py-3.5 flex items-center gap-4">
      <span className="text-xl shrink-0">🚀</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white">You&apos;re on the Solo plan — 1 truck, 1 driver</p>
        <p className="text-xs text-white/50 mt-0.5">Upgrade to Owner Operator Pro ($65/mo) to unlock dispatch, 5 trucks, and more.</p>
      </div>
      <Link
        href="/dashboard/settings#billing"
        className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors"
        style={{ background: '#F5B731', color: '#1a1a1a' }}
      >
        Upgrade →
      </Link>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-white/30 hover:text-white/60 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
