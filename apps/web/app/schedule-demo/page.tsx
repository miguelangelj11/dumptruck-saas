'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function ScheduleDemoPage() {
  const [fullName, setFullName]               = useState('')
  const [companyName, setCompanyName]         = useState('')
  const [email, setEmail]                     = useState('')
  const [phone, setPhone]                     = useState('')
  const [truckCount, setTruckCount]           = useState('')
  const [currentSoftware, setCurrentSoftware] = useState('')
  const [preferredTime, setPreferredTime]     = useState('')
  const [notes, setNotes]                     = useState('')
  const [loading, setLoading]                 = useState(false)
  const [submitted, setSubmitted]             = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('demo_requests').insert({
      full_name:        fullName,
      company_name:     companyName,
      email,
      phone,
      truck_count:      truckCount,
      current_software: currentSoftware,
      preferred_time:   preferredTime,
      notes,
    })
    setLoading(false)
    if (error) {
      toast.error('Something went wrong. Please try again or email us directly.')
      return
    }
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div style={pageStyle}>
        <div style={{ width: '100%', maxWidth: '520px', textAlign: 'center' }}>
          <div style={{ fontSize: '56px', marginBottom: '20px' }}>🎉</div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#fff', marginBottom: '12px' }}>Demo Request Received!</h1>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: '32px' }}>
            Thanks, <strong style={{ color: '#fff' }}>{fullName}</strong>! We'll reach out within 24 hours to schedule your demo.
          </p>
          <div style={{ background: '#141f2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '24px', marginBottom: '28px', textAlign: 'left' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '16px' }}>
              In the meantime, explore what's included:
            </p>
            {[
              '🚛 Dispatch board for all drivers',
              '🎫 Digital ticket management',
              '📄 Automated invoice generation',
              '💰 Real-time revenue tracking',
              '📱 Driver mobile app',
              '🤖 AI ticket photo reader',
            ].map((f) => (
              <div key={f} style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>{f}</div>
            ))}
          </div>
          <Link href="/" style={{ fontSize: '14px', color: '#4ade80', textDecoration: 'none' }}>← Back to home</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <div style={{ width: '100%', maxWidth: '560px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none', marginBottom: '20px' }}>
            <Image src="/dtb-logo.png" alt="DumpTruckBoss" width={48} height={48} className="rounded-full object-contain" style={{ width: '48px', height: '48px' }} />
            <span style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>DumpTruckBoss</span>
          </Link>
          <div style={{ display: 'inline-block', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '99px', padding: '4px 14px', marginBottom: '16px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#f59e0b' }}>Enterprise Plan</span>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>Schedule a Demo</h1>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
            Tell us about your operation and we'll walk you through everything. No commitment required.
          </p>
        </div>

        {/* Form */}
        <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            <div style={rowStyle}>
              <Field label="Full name *">
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Jake Morrison" style={inputStyle} />
              </Field>
              <Field label="Company name *">
                <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required placeholder="Atlas Hauling Co." style={inputStyle} />
              </Field>
            </div>

            <div style={rowStyle}>
              <Field label="Email *">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" autoComplete="email" style={inputStyle} />
              </Field>
              <Field label="Phone number *">
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="(555) 000-0000" autoComplete="tel" style={inputStyle} />
              </Field>
            </div>

            <div style={rowStyle}>
              <Field label="Number of trucks">
                <select value={truckCount} onChange={(e) => setTruckCount(e.target.value)} style={inputStyle}>
                  <option value="">Select range</option>
                  <option value="15-25">15–25 trucks</option>
                  <option value="26-50">26–50 trucks</option>
                  <option value="51-100">51–100 trucks</option>
                  <option value="100+">100+ trucks</option>
                </select>
              </Field>
              <Field label="Best time to connect">
                <select value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} style={inputStyle}>
                  <option value="">Select time</option>
                  <option value="morning">Morning (8am–12pm)</option>
                  <option value="afternoon">Afternoon (12pm–5pm)</option>
                  <option value="evening">Evening (5pm–7pm)</option>
                </select>
              </Field>
            </div>

            <Field label="Current software or system you use">
              <input type="text" value={currentSoftware} onChange={(e) => setCurrentSoftware(e.target.value)} placeholder="e.g. Excel, QuickBooks, paper tickets" style={inputStyle} />
            </Field>

            <Field label="Any specific questions or notes">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Tell us about your operation, pain points, or anything you want to discuss..."
                rows={4}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              />
            </Field>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '10px',
                background: '#f59e0b',
                color: '#0f1923',
                fontSize: '15px',
                fontWeight: 700,
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {loading ? 'Sending…' : 'Request Demo →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: '12px', color: '#9ca3af', marginTop: '16px', lineHeight: 1.5 }}>
            We'll reach out within 24 hours to schedule your demo.
            Enterprise accounts are set up manually by our team after the call.
          </p>
        </div>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'rgba(255,255,255,0.3)' }}>
          Smaller operation?{' '}
          <Link href="/signup" style={{ color: '#4ade80', textDecoration: 'none' }}>Start a free trial instead</Link>
        </p>
      </div>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0f1923',
  backgroundImage: 'radial-gradient(#ffffff06 1px, transparent 1px)',
  backgroundSize: '24px 24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '40px 24px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  padding: '10px 14px',
  fontSize: '14px',
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
  background: '#fff',
}

const rowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '14px',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
