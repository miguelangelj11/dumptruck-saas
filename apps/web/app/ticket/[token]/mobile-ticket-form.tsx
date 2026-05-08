'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

type Props = {
  dispatchId: string
  hmacToken: string
  driverName: string
  truckNumber: string | null
  jobName: string
  dispatchDate: string
  startTime: string | null
  instructions: string | null
  material: string | null
  rate: number | null
  rateType: string | null
  companyName: string | null
  companyLogo: string | null
  alreadyCompleted: boolean
}

export default function MobileTicketForm({
  dispatchId, hmacToken, driverName, truckNumber, jobName, dispatchDate,
  startTime, instructions, material, rate, rateType,
  companyName, companyLogo, alreadyCompleted,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing,      setDrawing]      = useState(false)
  const [hasSig,       setHasSig]       = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [ticketNum,    setTicketNum]    = useState('')
  const [tonnage,      setTonnage]      = useState('')
  const [notes,        setNotes]        = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [submitted,    setSubmitted]    = useState(alreadyCompleted)
  const [error,        setError]        = useState('')

  // ── Canvas setup ──────────────────────────────────────────────────────────

  function resizeCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement!
    const dpr = window.devicePixelRatio || 1
    const w = parent.clientWidth
    const h = 160
    canvas.style.width  = `${w}px`
    canvas.style.height = `${h}px`
    canvas.width  = w * dpr
    canvas.height = h * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.strokeStyle = '#1e3a2a'
    ctx.lineWidth   = 2.5
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
  }

  useEffect(() => {
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      const t = e.touches[0]!
      return { x: t.clientX - rect.left, y: t.clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const { x, y } = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setDrawing(true)
    setHasSig(true)
  }, [])

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!drawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const { x, y } = getPos(e, canvas)
    ctx.lineTo(x, y)
    ctx.stroke()
  }, [drawing])

  const endDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setDrawing(false)
  }, [])

  function clearSig() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSig(false)
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!customerName.trim()) { setError('Please enter customer name.'); return }
    if (!hasSig) { setError('Please provide a signature.'); return }

    const canvas = canvasRef.current!
    const signature = canvas.toDataURL('image/png')

    setSubmitting(true)
    try {
      const res = await fetch('/api/ticket/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dispatchId, token: hmacToken,
          customerName, signature,
          ticketNumber: ticketNum || undefined,
          tonnage: tonnage || undefined,
          notes: notes || undefined,
        }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { setError(data.error ?? 'Submission failed.'); return }
      setSubmitted(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div style={{ fontFamily: 'sans-serif', background: '#f0fdf4', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #bbf7d0', padding: '40px 28px', maxWidth: 400, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>✅</div>
          <h1 style={{ color: '#15803d', fontSize: 22, margin: '0 0 8px' }}>Ticket Submitted!</h1>
          <p style={{ color: '#374151', fontSize: 15 }}>Your ticket has been recorded. You can close this window.</p>
          {companyName && <p style={{ color: '#9ca3af', fontSize: 13, marginTop: 24 }}>— {companyName}</p>}
        </div>
      </div>
    )
  }

  const fmtDate = (d: string) => {
    try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) }
    catch { return d }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', background: '#f9fafb', minHeight: '100vh', padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{ background: '#1e3a2a', padding: '20px 20px 16px', color: '#fff' }}>
        {companyLogo
          ? <img src={companyLogo} alt="logo" style={{ height: 32, marginBottom: 8, borderRadius: 4 }} />
          : <p style={{ fontSize: 13, color: '#86efac', margin: '0 0 4px', fontWeight: 600 }}>{companyName ?? 'DumpTruckBoss'}</p>
        }
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Mobile Ticket</h1>
        <p style={{ fontSize: 13, color: '#86efac', margin: '4px 0 0' }}>{fmtDate(dispatchDate)}</p>
      </div>

      <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>

        {/* Dispatch summary */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '16px', marginBottom: 16 }}>
          <Row label="Driver"  value={driverName} />
          {truckNumber && <Row label="Truck"   value={`#${truckNumber}`} />}
          <Row label="Job"     value={jobName} />
          {material && <Row label="Material" value={material} />}
          {startTime && <Row label="Start"    value={startTime} />}
          {rate != null && <Row label="Rate" value={`$${rate}/${rateType ?? 'job'}`} />}
          {instructions && (
            <div style={{ marginTop: 8, padding: '8px 10px', background: '#f9fafb', borderRadius: 8, fontSize: 13, color: '#6b7280' }}>
              {instructions}
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          <Field label="Customer Name *">
            <input
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="Enter customer / site contact name"
              style={inputStyle}
            />
          </Field>

          <Field label="Ticket # (optional)">
            <input
              type="text"
              value={ticketNum}
              onChange={e => setTicketNum(e.target.value)}
              placeholder="e.g. 1042"
              style={inputStyle}
            />
          </Field>

          <Field label="Tonnage (optional)">
            <input
              type="number"
              value={tonnage}
              onChange={e => setTonnage(e.target.value)}
              placeholder="e.g. 22.5"
              step="0.01"
              min="0"
              style={inputStyle}
            />
          </Field>

          <Field label="Notes (optional)">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any notes about this job"
              rows={2}
              style={{ ...inputStyle, resize: 'none' }}
            />
          </Field>

          {/* Signature pad */}
          <Field label="Customer Signature *">
            <div style={{ border: '1px solid #d1d5db', borderRadius: 10, overflow: 'hidden', background: '#fff', position: 'relative' }}>
              <canvas
                ref={canvasRef}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
                style={{ display: 'block', cursor: 'crosshair', touchAction: 'none' }}
              />
              {!hasSig && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  pointerEvents: 'none', color: '#d1d5db', fontSize: 14,
                }}>
                  Sign here
                </div>
              )}
            </div>
            {hasSig && (
              <button type="button" onClick={clearSig} style={{ marginTop: 6, fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                Clear signature
              </button>
            )}
          </Field>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 14 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: '14px', borderRadius: 12, border: 'none', cursor: submitting ? 'default' : 'pointer',
              background: submitting ? '#9ca3af' : '#2d7a4f', color: '#fff',
              fontSize: 16, fontWeight: 700, marginTop: 4,
            }}
          >
            {submitting ? 'Submitting…' : 'Submit Ticket'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '3px 0', fontSize: 14 }}>
      <span style={{ color: '#9ca3af', minWidth: 80 }}>{label}</span>
      <span style={{ color: '#111827', fontWeight: 500, textAlign: 'right', flex: 1, marginLeft: 8 }}>{value}</span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db',
  fontSize: 15, color: '#111827', background: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box',
}
