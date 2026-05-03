'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Camera, Loader2, CheckCircle, Truck } from 'lucide-react'
import { toast } from 'sonner'

const MATERIALS = ['Dirt', 'Gravel', 'Asphalt', 'Sand', 'Rock', 'Fill', 'Millings', 'Other']

const TIME_OPTIONS: string[] = (() => {
  const opts: string[] = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      const ampm = h < 12 ? 'AM' : 'PM'
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
      opts.push(`${h12}:${String(m).padStart(2, '0')} ${ampm}`)
    }
  }
  return opts
})()

type Driver = { id: string; name: string }
type CompanyInfo = { name: string }

function PortalContent() {
  const searchParams = useSearchParams()
  const companyId = searchParams.get('c')

  const [loading, setLoading] = useState(true)
  const [company, setCompany] = useState<CompanyInfo | null>(null)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [notFound, setNotFound] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const photoRef = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]!
  const [driverName, setDriverName] = useState('')
  const [date, setDate] = useState(today)
  const [jobName, setJobName] = useState('')
  const [truckNumber, setTruckNumber] = useState('')
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [material, setMaterial] = useState('')
  const [ticketNumber, setTicketNumber] = useState('')
  const [tons, setTons] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!companyId) { setLoading(false); return }
    fetch(`/api/public/drivers?company_id=${encodeURIComponent(companyId)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setNotFound(true); setLoading(false); return }
        setCompany(data.company)
        setDrivers(data.drivers ?? [])
        setLoading(false)
      })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [companyId])

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { toast.error('Photo must be under 10MB'); return }
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function resetForm() {
    setPhoto(null)
    setPhotoPreview(null)
    setJobName('')
    setTruckNumber('')
    setOrigin('')
    setDestination('')
    setStartTime('')
    setEndTime('')
    setMaterial('')
    setTicketNumber('')
    setTons('')
    setNotes('')
    setDate(today)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!driverName) { toast.error('Please select your name'); return }

    setSubmitting(true)
    const fd = new FormData()
    fd.append('company_id', companyId!)
    fd.append('driver_name', driverName)
    fd.append('date', date)
    fd.append('job_name', jobName)
    if (truckNumber) fd.append('truck_number', truckNumber)
    if (origin) fd.append('origin', origin)
    if (destination) fd.append('destination', destination)
    if (startTime) fd.append('start_time', startTime)
    if (endTime) fd.append('end_time', endTime)
    if (material) fd.append('material', material)
    if (ticketNumber) fd.append('ticket_number', ticketNumber)
    if (tons) fd.append('tons', tons)
    if (notes) fd.append('notes', notes)
    if (photo) fd.append('photo', photo)

    const res = await fetch('/api/public/submit-ticket', { method: 'POST', body: fd })
    const data = await res.json().catch(() => ({}))

    if (!res.ok || data.error) {
      toast.error(data.error ?? 'Submission failed. Please try again.')
      setSubmitting(false)
      return
    }

    setSubmitted(true)
    setSubmitting(false)
  }

  if (!companyId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <Truck className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Driver Portal</h1>
          <p className="text-gray-500 text-sm">Ask your dispatcher for your company&apos;s portal link to submit tickets.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[#1e3a2a]" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <Truck className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 text-sm">Invalid portal link. Please contact your dispatcher for a new link.</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Ticket Submitted!</h1>
          <p className="text-gray-500 text-sm mb-8">Your ticket has been sent for review.</p>
          <button
            onClick={() => { setSubmitted(false); resetForm() }}
            className="w-full rounded-2xl bg-[#1e3a2a] text-white py-4 text-base font-bold active:opacity-90"
          >
            Submit Another Ticket
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1e3a2a] px-6 py-5 text-white">
        <p className="text-xs text-green-300 font-semibold uppercase tracking-wider mb-1">Driver Portal</p>
        <h1 className="text-xl font-bold">{company?.name ?? 'Submit Ticket'}</h1>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Photo */}
          <button
            type="button"
            onClick={() => photoRef.current?.click()}
            className="w-full h-36 rounded-2xl border-2 border-dashed border-gray-300 bg-white flex flex-col items-center justify-center gap-2 active:bg-gray-50 transition-colors overflow-hidden"
          >
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview} alt="Ticket" className="h-full w-full object-contain" />
            ) : (
              <>
                <Camera className="h-8 w-8 text-gray-400" />
                <span className="text-sm text-gray-500 font-medium">Tap to take photo or upload</span>
              </>
            )}
          </button>
          <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />

          {/* Driver Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Your Name *</label>
            {drivers.length > 0 ? (
              <select
                required
                value={driverName}
                onChange={e => setDriverName(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-base focus:outline-none focus:border-[#1e3a2a]"
              >
                <option value="">— Select your name —</option>
                {drivers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            ) : (
              <input
                required
                value={driverName}
                onChange={e => setDriverName(e.target.value)}
                placeholder="Your full name"
                className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:border-[#1e3a2a]"
              />
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Date *</label>
            <input
              type="date"
              required
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:border-[#1e3a2a]"
            />
          </div>

          {/* Job / Location */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Job / Location *</label>
            <input
              required
              value={jobName}
              onChange={e => setJobName(e.target.value)}
              placeholder="e.g. Hwy 90 Grading Site"
              className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:border-[#1e3a2a]"
            />
          </div>

          {/* Truck # */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Truck #</label>
            <input
              value={truckNumber}
              onChange={e => setTruckNumber(e.target.value)}
              placeholder="e.g. T-101"
              className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:border-[#1e3a2a]"
            />
          </div>

          {/* Origin / Destination */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Origin</label>
              <input
                value={origin}
                onChange={e => setOrigin(e.target.value)}
                placeholder="Pit / plant"
                className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:border-[#1e3a2a]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Destination</label>
              <input
                value={destination}
                onChange={e => setDestination(e.target.value)}
                placeholder="Job site"
                className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:border-[#1e3a2a]"
              />
            </div>
          </div>

          {/* Time In / Out */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Time In</label>
              <select
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-base focus:outline-none focus:border-[#1e3a2a]"
              >
                <option value="">— Select —</option>
                {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Time Out</label>
              <select
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-base focus:outline-none focus:border-[#1e3a2a]"
              >
                <option value="">— Select —</option>
                {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Material */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Material</label>
            <select
              value={material}
              onChange={e => setMaterial(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-base focus:outline-none focus:border-[#1e3a2a]"
            >
              <option value="">Select material…</option>
              {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Ticket # + Tons */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Ticket #</label>
              <input
                value={ticketNumber}
                onChange={e => setTicketNumber(e.target.value)}
                placeholder="e.g. 4821"
                className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:border-[#1e3a2a]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tons / Qty</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={tons}
                onChange={e => setTons(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:border-[#1e3a2a]"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Any additional notes…"
              className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base resize-none focus:outline-none focus:border-[#1e3a2a]"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-[#1e3a2a] text-white py-4 text-base font-bold flex items-center justify-center gap-2 active:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {submitting && <Loader2 className="h-5 w-5 animate-spin" />}
            {submitting ? 'Submitting…' : 'Submit Ticket'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">Powered by DumpTruckBoss</p>
      </div>
    </div>
  )
}

export default function PortalPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[#1e3a2a]" />
      </div>
    }>
      <PortalContent />
    </Suspense>
  )
}
