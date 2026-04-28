'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, ChevronLeft, Loader2, Minus, Plus } from 'lucide-react'
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

export default function DriverSubmitPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)

  const today = new Date().toISOString().split('T')[0]!
  const [driverId, setDriverId]       = useState('')
  const [companyId, setCompanyId]     = useState('')
  const [driverName, setDriverName]   = useState('')
  const [dispatchId, setDispatchId]   = useState<string | null>(null)

  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [jobs, setJobs] = useState<{ id: string; dispatchId: string; job_name: string }[]>([])
  const [selectedJob, setSelectedJob] = useState('')
  const [date, setDate] = useState(today)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [hours, setHours] = useState('')
  const [truckNumber, setTruckNumber] = useState('')
  const [loads, setLoads] = useState(1)
  const [material, setMaterial] = useState('')
  const [ticketNum, setTicketNum] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: driver } = await supabase
        .from('drivers')
        .select('id, company_id, name')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (!driver) { router.push('/login'); return }
      setDriverId(driver.id)
      setCompanyId(driver.company_id)
      setDriverName(driver.name)

      // Fetch today's dispatched jobs for this driver
      const todayStr = new Date().toISOString().split('T')[0]!
      const { data: dispatches } = await supabase
        .from('dispatches')
        .select('id, job_id, jobs(job_name)')
        .eq('company_id', driver.company_id)
        .eq('driver_id', driver.id)
        .eq('dispatch_date', todayStr)
        .neq('status', 'completed')

      const jobList = (dispatches ?? [])
        .filter((d: { id: string; job_id: string | null; jobs: unknown }) => d.job_id && d.jobs)
        .map((d: { id: string; job_id: string | null; jobs: unknown }) => ({ id: d.job_id as string, dispatchId: d.id, job_name: (d.jobs as { job_name: string }).job_name }))
      setJobs(jobList)
      if (jobList[0]) {
        setSelectedJob(jobList[0].job_name)
        setDispatchId(jobList[0].dispatchId)
      }

      setLoading(false)
    }
    init()
  }, [router])

  useEffect(() => {
    const calc = calcHours(startTime, endTime)
    if (calc) setHours(calc)
  }, [startTime, endTime])

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const fileCheck = validate(fileUploadSchema, { size: file.size, type: file.type })
    if (!fileCheck.ok) {
      toast.error(Object.values(fileCheck.errors)[0] ?? 'Invalid file')
      return
    }
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Validate before touching the network
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
        <button onClick={() => router.push('/driver')} className="h-9 w-9 rounded-lg border border-gray-200 flex items-center justify-center">
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Submit Ticket</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Camera */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => photoRef.current?.click()}
            className="w-full h-36 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center gap-2 active:bg-gray-100 transition-colors"
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

        {/* Job */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Job *</label>
          {jobs.length > 0 ? (
            <select
              required
              value={selectedJob}
              onChange={e => {
                setSelectedJob(e.target.value)
                const j = jobs.find(j => j.job_name === e.target.value)
                setDispatchId(j?.dispatchId ?? null)
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

        {/* Times */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Start Time</label>
            <input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:border-[#1e3a2a]"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">End Time</label>
            <input
              type="time"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:border-[#1e3a2a]"
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
            className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:border-[#1e3a2a]"
          />
        </div>

        {/* Truck # */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Truck #</label>
          <input
            type="text"
            value={truckNumber}
            onChange={e => setTruckNumber(e.target.value)}
            placeholder="e.g. T-101"
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
              className="h-12 w-12 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 active:bg-gray-100 text-xl"
            >
              <Minus className="h-5 w-5" />
            </button>
            <span className="text-3xl font-bold text-gray-900 min-w-[3ch] text-center">{loads}</span>
            <button
              type="button"
              onClick={() => setLoads(l => l + 1)}
              className="h-12 w-12 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 active:bg-gray-100 text-xl"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Material */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Material</label>
          <select
            value={material}
            onChange={e => setMaterial(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:border-[#1e3a2a]"
          >
            <option value="">Select material…</option>
            {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Ticket # */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Paper Ticket #</label>
          <input
            type="text"
            value={ticketNum}
            onChange={e => setTicketNum(e.target.value)}
            placeholder="e.g. 4821"
            className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:border-[#1e3a2a]"
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
            className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base resize-none focus:outline-none focus:border-[#1e3a2a]"
          />
        </div>

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
