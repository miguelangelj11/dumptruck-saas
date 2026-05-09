'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle, LogIn } from 'lucide-react'

export default function ImportDispatchButton({ shareToken, jobName }: { shareToken: string; jobName: string }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const [err, setErr]         = useState<string | null>(null)
  const router = useRouter()

  async function handleImport() {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch('/api/dispatches/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ share_token: shareToken }),
      })
      const data = await res.json() as { error?: string; duplicate?: boolean; received_dispatch_id?: string }
      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/login?redirect=/dispatch/${shareToken}`)
          return
        }
        setErr(data.error ?? 'Something went wrong')
        return
      }
      setDone(true)
      setTimeout(() => router.push('/dashboard/dispatch'), 2000)
    } catch {
      setErr('Network error – please try again')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="flex items-center justify-center gap-2 py-3 text-green-700 font-semibold">
        <CheckCircle className="h-5 w-5" />
        Imported! Redirecting to your dashboard…
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {err && (
        <p className="text-sm text-red-600 text-center font-medium">{err}</p>
      )}
      <button
        onClick={handleImport}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-[#1e3a2a] hover:bg-[#2d5a3d] text-white font-bold rounded-xl text-base transition-colors disabled:opacity-60"
      >
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</>
        ) : (
          <><LogIn className="h-4 w-4" /> Import This Dispatch</>
        )}
      </button>
      <p className="text-[11px] text-gray-400 text-center">
        You&apos;ll be redirected to your dashboard after import. Must be logged in.
      </p>
    </div>
  )
}
