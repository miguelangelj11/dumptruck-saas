'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Suspense } from 'react'

function JoinForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [invite, setInvite] = useState(null)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    async function loadInvite() {
      console.log('Token from URL:', token)
      if (!token) {
        setError('no_token')
        setLoading(false)
        return
      }
      const supabase = createClient()
      const { data, error } = await supabase
        .from('invitations')
        .select('*, companies(name)')
        .eq('token', token)
        .is('accepted_at', null)
        .single()
      console.log('Invite data:', data, 'Error:', error)
      if (error || !data) {
        setError('invalid')
        setLoading(false)
        return
      }
      setInvite(data)
      setLoading(false)
    }
    loadInvite()
  }, [token])

  async function handleJoin() {
    setJoining(true)
    const res = await fetch('/api/team/accept-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password })
    })
    const data = await res.json()
    if (data.error) {
      setError(data.error)
      setJoining(false)
      return
    }
    window.location.href = '/dashboard'
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p>Loading...</p></div>

  if (error === 'no_token') return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950">
      <div className="bg-white rounded-xl p-8 max-w-md text-center">
        <p className="text-xl font-semibold mb-2">You need an invite link</p>
        <p className="text-gray-500 mb-4">Click the link in your invite email.</p>
        <a href="/login" className="text-green-600">Back to sign in</a>
      </div>
    </div>
  )

  if (error === 'invalid') return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950">
      <div className="bg-white rounded-xl p-8 max-w-md text-center">
        <p className="text-xl font-semibold mb-2">Invalid invite link</p>
        <p className="text-gray-500 mb-4">Ask your admin to send a new invite.</p>
        <a href="/login" className="text-green-600">Back to sign in</a>
      </div>
    </div>
  )

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950">
      <div className="bg-white rounded-xl p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold mb-1">Join {invite?.companies?.name}</h1>
        <p className="text-gray-500 mb-6">You've been invited as {invite?.role}</p>
        <p className="text-sm text-gray-600 mb-4">{invite?.email}</p>
        <input
          type="password"
          placeholder="Create a password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border rounded-lg px-4 py-3 mb-4"
        />
        <button
          onClick={handleJoin}
          disabled={joining || password.length < 6}
          className="w-full bg-green-600 text-white rounded-lg py-3 font-semibold disabled:opacity-50"
        >
          {joining ? 'Joining...' : `Join ${invite?.companies?.name}`}
        </button>
      </div>
    </div>
  )
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p>Loading...</p></div>}>
      <JoinForm />
    </Suspense>
  )
}
