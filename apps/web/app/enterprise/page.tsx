'use client'

import { useState } from 'react'
import Link from 'next/link'
import Nav from '@/components/landing/nav'
import Footer from '@/components/landing/footer'

const FEATURES = [
  '✅ Everything in Fleet',
  '✅ Custom onboarding',
  '✅ Dedicated account manager',
  '✅ CRM + Quote Builder',
  '✅ Advanced profitability',
  '✅ Mobile ticket + signatures',
  '✅ Custom integrations',
  '✅ Priority support',
]

export default function EnterprisePage() {
  const [form, setForm] = useState({
    name: '', company: '', email: '', phone: '', truck_count: '', needs: '',
  })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/enterprise/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setStatus('success')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex flex-col">
        <Nav />
        <div className="flex-1 flex items-center justify-center px-6 py-20">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-6">🚛</div>
            <h1 className="text-3xl font-black text-white mb-4">Got it — we'll be in touch.</h1>
            <p className="text-gray-400 text-lg mb-8">
              Expect a reply within 1 business day. We'll put together something that fits your operation.
            </p>
            <Link href="/" className="inline-block px-8 py-3 bg-[#F5B731] text-black font-bold rounded-xl">
              Back to Home
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  const inputClass = "w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-600 focus:border-[#F5B731] outline-none transition-colors"
  const labelClass = "text-sm text-gray-400 block mb-1.5"

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex flex-col">
      <Nav />

      <div className="flex-1 py-20 px-6">
        <div className="max-w-2xl mx-auto">

          {/* Header */}
          <div className="text-center mb-12">
            <span className="text-[#F5B731] text-sm font-bold uppercase tracking-widest block mb-4">
              Enterprise Plan
            </span>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
              Let&apos;s build the right plan for your operation.
            </h1>
            <p className="text-xl text-gray-400">
              Every large hauling operation runs differently.
              Tell us about yours and we&apos;ll put together a custom package that fits.
            </p>
          </div>

          {/* Feature teasers */}
          <div className="grid grid-cols-2 gap-3 mb-10">
            {FEATURES.map(item => (
              <div key={item} className="text-sm text-gray-300">
                {item}
              </div>
            ))}
          </div>

          {/* Contact form */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-xl font-bold text-white mb-6">Tell us about your operation</h2>

            <form onSubmit={handleSubmit} className="space-y-4">

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Your Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="John Smith"
                    className={inputClass}
                    value={form.name}
                    onChange={e => update('name', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Company Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Atlas Hauling LLC"
                    className={inputClass}
                    value={form.company}
                    onChange={e => update('company', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="you@company.com"
                    className={inputClass}
                    value={form.email}
                    onChange={e => update('email', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Phone</label>
                  <input
                    type="tel"
                    placeholder="(555) 000-0000"
                    className={inputClass}
                    value={form.phone}
                    onChange={e => update('phone', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>How many trucks do you run? *</label>
                <select
                  required
                  className={inputClass + ' bg-[#1a1a1a]'}
                  value={form.truck_count}
                  onChange={e => update('truck_count', e.target.value)}
                >
                  <option value="">Select range</option>
                  <option value="6-10">6–10 trucks</option>
                  <option value="11-20">11–20 trucks</option>
                  <option value="21-50">21–50 trucks</option>
                  <option value="50+">50+ trucks</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>What does your operation need most?</label>
                <textarea
                  rows={4}
                  placeholder="Tell us about your current setup, what's not working, and what you need most from the platform..."
                  className={inputClass + ' resize-none'}
                  value={form.needs}
                  onChange={e => update('needs', e.target.value)}
                />
              </div>

              {status === 'error' && (
                <p className="text-red-400 text-sm">Something went wrong. Email us directly at <a href="mailto:hello@dumptruckboss.com" className="underline">hello@dumptruckboss.com</a></p>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full py-4 bg-[#F5B731] text-black font-black text-lg rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-60"
              >
                {status === 'loading' ? 'Sending…' : 'Send Message →'}
              </button>

              <p className="text-center text-gray-600 text-xs">
                Or email us directly at{' '}
                <a href="mailto:hello@dumptruckboss.com" className="text-[#F5B731] hover:underline">
                  hello@dumptruckboss.com
                </a>
              </p>
            </form>
          </div>

        </div>
      </div>

      <Footer />
    </div>
  )
}
