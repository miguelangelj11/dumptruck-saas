'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, ChevronLeft, ChevronDown, ChevronUp, Loader2, Minus, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import * as Sentry from '@sentry/nextjs'
import { ticketSchema, fileUploadSchema, validate } from '@/lib/schemas'

const MATERIALS = ['Dirt', 'Gravel', 'Asphalt', 'Sand', 'Rock', 'Fill', 'Millings', 'Other']

function calcHours(start: string, end: string): string {
  if (!start || !end) return ''
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  if (sh === undefined || sm === undefined || eh === undefined || em === undefined) return ''
  const diff = (eh * 60 + em) - (sh * 60 + sm)
  if (diff <= 0) return ''
  return (diff / 60).toFixed(2)
}

function AutoFilledBadge() {
  return (
    <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-md px-1.5 py-0.5">
      ✓ Auto-filled
    </span>
  )
}

export default function DriverSubmitPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)

  const today = new Date().toISOString().split('T')[0]!
  const [driverId, setDriverId]     = useState('')
  const [companyId, setCompanyId]   = useState('')
  const [driverName, setDriverName] = useState('')
  const [dispatchId, setDispatchId] = useState<string | null>(null)

  const [photo, setPhoto]             = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [ocrLoading, setOcrLoading]   = useState(false)
  const [ocrFilledFields, setOcrFilledFields] = useState<Record<string, boolean>>({})

  const [jobs, setJobs] = useState<{ id: string; dispatchId: string; job_name: string; material: string | null }[]>([])
  const [selectedJob, setSelectedJob] = useState('')
  const [date, setDate]               = useState(today)
  const [startTime, setStartTime]     = useState('')
  const [endTime, setEndTime]         = useState('')
  const [hours, setHours]             = useState('')
  const [truckNumber, setTruckNumber] = useState('')
  const [loads, setLoads]             = useState(1)
  const [material, setMaterial]       = useState('')
  const [ticketNum, setTicketNum]     = useState('')
  const [notes, setNotes]             = useState('')

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: driver } = await supabase
        .from('drivers')
        .select('id, company_id, name, truck_number')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (!driver) { router.push('/login'); return }
      setDriverId(driver.id)
      setCompanyId(driver.company_id)
      setDriverName(driver.name)

      // Pre-fill truck from driver profile
      if (driver.truck_number) setTruckNumber(driver.truck_number)

      const todayStr = new Date().toISOString().split('T')[0]!
      const { data: dispatches } = await supabase
        .from('dispatches')
        .select('id, job_id, jobs(job_name, material)')
        .eq('company_id', driver.company_id)
        .eq('driver_id', driver.id)
        .eq('dispatch_date', todayStr)
        .neq('status', 'completed')

      const jobList = (dispatches ?? [])
        .filter((d: { id: string; job_id: string | null; jobs: unknown }) => d.job_id && d.jobs)
        .map((d: { id: string; job_id: string | null; jobs: unknown }) => {
          const j = d.jobs as { job_name: string; material: string | null }
          return { id: d.job_id as string, dispatchId: d.id, job_name: j.job_name, material: j.material ?? null }
        })
      setJobs(jobList)

      if (jobList[0]) {
        setSelectedJob(jobList[0].job_name)
        setDispatchId(jobList[0].dispatchId)
        // Pre-fill material from job when only one dispatch (no ambiguity)
        if (jobList.length === 1 && jobList[0].material) {
          setMaterial(jobList[0].material)
        }
      }

      setLoading(false)
    }
    init()
  }, [router])

  useEffect(() => {
    const calc = calcHours(startTime, endTime)
    if (calc) setHours(calc)
  }, [startTime, endTime])

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const fileCheck = validate(fileUploadSchema, { size: file.size, type: file.type })
    if (!fileCheck.ok) {
      toast.error(Object.values(fileCheck.errors)[0] ?? 'Invalid file')
      return
    }
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
    setOcrFilledFields({})

    setOcrLoading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await fetch('/api/ocr', { method: 'POST', body: fd })
      const data = await res.json() as {
        ok: boolean; mock?: boolean; confidence?: number;
        fields?: { ticket_number?: string | null; tonnage?: string | number | null; date?: string | null; material?: string | null; truck_number?: string | null }
      }
      if (data.ok && data.fields && (data.confidence ?? 0) >= 30) {
        const filled: Record<string, boolean> = {}
        if (data.fields.ticket_number)  { setTicketNum(data.fields.ticket_number);   filled.ticketNum   = true }
        if (data.fields.date)           { setDate(data.fields.date);                  filled.date        = true }
        if (data.fields.material)       { setMaterial(data.fields.material);          filled.material    = true }
        if (data.fields.truck_number)   { setTruckNumber(data.fields.truck_number);   filled.truckNumber = true }
        setOcrFilledFields(filled)
        toast.success('Fields auto-filled from ticket photo ✓')
      }
    } catch {
      // Non-fatal — skip auto-fill
    } finally {
      setOcrLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const validation = validate(ticketSchema, {
      job_name:          selectedJob,
      driver_name:       driverName,
      date,
      truck_number:      truckNumber || null,
      material:          material || null,
      notes:             notes || null,
      hours_worked:      hours || null,
      driver_start_time: startTime || null,
      driver_end_time:   endTime || null,
      rate:              0,
      source:            'driver',
    })

    if (!validation.ok) {
      const first = Object.values(validation.errors)[0]
      toast.error(first ?? 'Please check the form')
      return
    }

    setSubmitting(true)

    const supabase = createClient()
    let imageUrl: string | null = null

    if (photo) {
      const ext = photo.name.split('.').pop() ?? 'jpg'
      const path = `${companyId}/driver/${driverId}/${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('ticket-photos').upload(path, photo, { upsert: true })
      if (uploadErr) {
        toast.error('Photo upload failed')
        Sentry.captureException(uploadErr, { tags: { feature: 'driver-submit', company_id: companyId } })
        setSubmitting(false)
        return
      }
      imageUrl = supabase.storage.from('ticket-photos').getPublicUrl(path).data.publicUrl
    }

    const { error } = await supabase.from('loads').insert({
      company_id:          companyId,
      job_name:            validation.data.job_name,
      driver_name:         validation.data.driver_name,
      date:                validation.data.date,
      driver_start_time:   validation.data.driver_start_time,
      driver_end_time:     validation.data.driver_end_time,
      hours_worked:        validation.data.hours_worked,
      truck_number:        validation.data.truck_number,
      material:            validation.data.material,
      status:              'pending',
      notes:               validation.data.notes,
      image_url:           imageUrl,
      submitted_by_driver: true,
      source:              'driver',
      dispatch_id:         dispatchId || null,
      rate:                0,
    })

    if (error) {
      toast.error('Failed to submit: ' + error.message)
      Sentry.captureException(error, { tags: { feature: 'driver-submit', company_id: companyId } })
      setSubmitting(false)
      return
    }

    toast.success('Ticket submitted for approval!')
    router.push('/driver')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[#1e3a2a]" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/driver')} className="h-11 w-11 rounded-xl border border-gray-200 flex items-center justify-center active:bg-gray-100">
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Submit Ticket</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Camera */}
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => photoRef.current?.click()}
            className="w-full h-36 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center gap-2 active:bg-gray-100 transition-colors relative overflow-hidden"
          >
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview} alt="Ticket" className="h-full w-full object-contain rounded-xl" />
            ) : (
              <>
                <Camera className="h-8 w-8 text-gray-400" />
                <span className="text-sm text-gray-500 font-medium">Tap to take photo or upload</span>
              </>
            )}
            {ocrLoading && (
              <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-[#1e3a2a]" />
                <span className="text-xs font-semibold text-[#1e3a2a]">Reading ticket…</span>
              </div>
            )}
          </button>
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoChange}
          />
        </div>

        {/* Job — hidden when only 1 dispatch (auto-selected) */}
        {jobs.length !== 1 && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Job *</label>
            {jobs.length > 1 ? (
              <select
                required
                value={selectedJob}
                onChange={e => {
                  setSelectedJob(e.target.value)
                  const j = jobs.find(j => j.job_name === e.target.value)
                  setDispatchId(j?.dispatchId ?? null)
                  if (j?.material) setMaterial(j.material)
                }}
                className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:border-[#1e3a2a]"
              >
                {jobs.map(j => <option key={j.id} value={j.job_name}>{j.job_name}</option>)}
              </select>
            ) : (
              <input
                required
                value={selectedJob}
                onChange={e => setSelectedJob(e.target.value)}
                placeholder="Enter job name"
                className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:border-[#1e3a2a]"
              />
            )}
          </div>
        )}

        {/* Auto-selected job banner */}
        {jobs.length === 1 && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-0.5">Today's Job</p>
              <p className="text-base font-bold text-green-900">{selectedJob}</p>
            </div>
            <span className="text-xs font-semibold text-green-700 bg-white border border-green-200 rounded-lg px-2.5 py-1">✓ Auto</span>
          </div>
        )}

        {/* Date */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Date *
            {ocrFilledFields.date && <AutoFilledBadge />}
          </label>
          <input
            type="date"
            required
            value={date}
            onChange={e => { setDate(e.target.value); setOcrFilledFields(f => ({ ...f, date: false })) }}
            className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:border-[#1e3a2a]"
          />
        </div>

        {/* Ticket # */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Paper Ticket #
            {ocrFilledFields.ticketNum && <AutoFilledBadge />}
          </label>
          <input
            type="text"
            value={ticketNum}
            onChange={e => { setTicketNum(e.target.value); setOcrFilledFields(f => ({ ...f, ticketNum: false })) }}
            placeholder="e.g. 4821"
            className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:border-[#1e3a2a]"
          />
        </div>

        {/* Number of Loads */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Number of Loads</label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setLoads(l => Math.max(0, l - 1))}
              className="h-12 w-12 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 active:bg-gray-100"
            >
              <Minus className="h-5 w-5" />
            </button>
            <span className="text-3xl font-bold text-gray-900 min-w-[3ch] text-center">{loads}</span>
            <button
              type="button"
              onClick={() => setLoads(l => l + 1)}
              className="h-12 w-12 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 active:bg-gray-100"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Truck # */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Truck #
            {ocrFilledFields.truckNumber && <AutoFilledBadge />}
          </label>
          <input
            type="text"
            value={truckNumber}
            onChange={e => { setTruckNumber(e.target.value); setOcrFilledFields(f => ({ ...f, truckNumber: false })) }}
            placeholder="e.g. T-101"
            className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:border-[#1e3a2a]"
          />
        </div>

        {/* Material */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Material
            {ocrFilledFields.material && <AutoFilledBadge />}
          </label>
          <select
            value={material}
            onChange={e => { setMaterial(e.target.value); setOcrFilledFields(f => ({ ...f, material: false })) }}
            className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:border-[#1e3a2a]"
          >
            <option value="">Select material…</option>
            {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Advanced toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(v => !v)}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
        >
          {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {showAdvanced ? 'Hide details' : 'Add times & notes'}
        </button>

        {/* Advanced fields */}
        {showAdvanced && (
          <div className="space-y-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
            {/* Times */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:border-[#1e3a2a] bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:border-[#1e3a2a] bg-white"
                />
              </div>
            </div>

            {/* Hours worked */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Hours Worked</label>
              <input
                type="number"
                step="0.25"
                min="0"
                value={hours}
                onChange={e => setHours(e.target.value)}
                placeholder="Auto-calculated from times"
                className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:border-[#1e3a2a] bg-white"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Any additional notes…"
                className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base resize-none focus:outline-none focus:border-[#1e3a2a] bg-white"
              />
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-2xl bg-[#1e3a2a] text-white py-4 text-base font-bold flex items-center justify-center gap-2 active:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {submitting && <Loader2 className="h-5 w-5 animate-spin" />}
          {submitting ? 'Submitting…' : 'Submit for Approval'}
        </button>
      </form>
    </div>
  )
}
