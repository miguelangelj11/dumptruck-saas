'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCompanyId } from '@/lib/get-company-id'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera, X, Plus, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import Image from 'next/image'
import * as Sentry from '@sentry/nextjs'
import { ticketSchema, fileUploadSchema, validate } from '@/lib/schemas'

const LOAD_TYPES = ['Asphalt', 'Dirt', 'Fill', 'Gravel', 'Millings', 'Mix', 'Rock', 'Sand', 'Other']

type SlipRow = {
  id: string
  ticket_number: string
  tonnage: string
  imageFile: File | null
  imagePreview: string | null
}

function makeSlip(): SlipRow {
  return { id: crypto.randomUUID(), ticket_number: '', tonnage: '', imageFile: null, imagePreview: null }
}

export default function QuickTicketPage() {
  const router = useRouter()
  const supabase = createClient()
  const [userId, setUserId] = useState('')
  const [orgId, setOrgId]   = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  // Recent jobs/trucks for autofill
  const [recentJobs, setRecentJobs] = useState<string[]>([])
  const [recentTrucks, setRecentTrucks] = useState<string[]>([])
  const [recentDrivers, setRecentDrivers] = useState<string[]>([])

  const [job, setJob] = useState('')
  const [loadType, setLoadType] = useState('')
  const [truck, setTruck] = useState('')
  const [driver, setDriver] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [rate, setRate] = useState('')
  const [rateType, setRateType] = useState('load')
  const [quantity, setQuantity] = useState('')
  const [totalPay, setTotalPay] = useState('')
  const [timeIn, setTimeIn] = useState('')
  const [timeOut, setTimeOut] = useState('')

  const [slips, setSlips] = useState<SlipRow[]>([makeSlip()])
  const fileRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const fetchedOrgId = await getCompanyId()
      if (!fetchedOrgId) return
      setOrgId(fetchedOrgId)
      const orgId = fetchedOrgId
      const { data } = await supabase
        .from('loads')
        .select('job_name, truck_number, driver_name')
        .eq('company_id', orgId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (data) {
        type LoadRow = { job_name: string; truck_number: string | null; driver_name: string | null }
        setRecentJobs(Array.from(new Set((data as LoadRow[]).map(d => d.job_name))).slice(0, 10))
        setRecentTrucks(Array.from(new Set((data as LoadRow[]).map(d => d.truck_number).filter((x): x is string => !!x))))
        setRecentDrivers(Array.from(new Set((data as LoadRow[]).map(d => d.driver_name).filter((x): x is string => !!x))))
        if (data[0]) {
          setTruck(data[0].truck_number ?? '')
          setDriver(data[0].driver_name ?? '')
        }
      }
    }
    load()
  }, [])

  // Auto-fill hours when rate type is hourly and both times are set
  useEffect(() => {
    if (rateType !== 'hour' || !timeIn || !timeOut) return
    const [sh, sm] = timeIn.split(':').map(Number)
    const [eh, em] = timeOut.split(':').map(Number)
    if (sh === undefined || sm === undefined || eh === undefined || em === undefined) return
    let diff = (eh * 60 + em) - (sh * 60 + sm)
    if (diff < 0) diff += 24 * 60
    if (diff > 0) setQuantity((diff / 60).toFixed(2))
  }, [rateType, timeIn, timeOut])

  // Auto-calculate total pay whenever rate or quantity changes
  useEffect(() => {
    const r = parseFloat(rate) || 0
    const q = parseFloat(quantity) || 0
    setTotalPay(r > 0 && q > 0 ? (r * q).toFixed(2) : '')
  }, [rate, quantity, rateType])

  function updateSlip(id: string, updates: Partial<SlipRow>) {
    setSlips(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
  }

  function handlePhoto(slipId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const check = validate(fileUploadSchema, { size: file.size, type: file.type })
    if (!check.ok) { toast.error(Object.values(check.errors)[0] ?? 'Invalid file'); return }
    updateSlip(slipId, { imageFile: file, imagePreview: URL.createObjectURL(file) })
  }

  async function uploadPhoto(loadId: string, slipId: string, file: File): Promise<string | null> {
    const ext = file.name.split('.').pop()
    const path = `${userId}/${loadId}/${slipId}.${ext}`
    const { error } = await supabase.storage.from('ticket-photos').upload(path, file, { upsert: true })
    if (error) { toast.error('Photo upload failed'); return null }
    return supabase.storage.from('ticket-photos').getPublicUrl(path).data.publicUrl
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const validation = validate(ticketSchema, {
      job_name:    job.trim(),
      driver_name: driver.trim() || 'Unknown',
      date:        date ?? new Date().toISOString().split('T')[0],
      rate:        parseFloat(rate) || 0,
      rate_type:   rateType,
      truck_number: truck.trim() || null,
      material:     loadType || null,
      source:       'office',
    })

    if (!validation.ok) {
      const first = Object.values(validation.errors)[0]
      toast.error(first ?? 'Please check the form')
      return
    }

    setSaving(true)

    if (!orgId) { toast.error('Company not found'); setSaving(false); return }

    const loadId = crypto.randomUUID()
    const { error: loadErr } = await supabase.from('loads').insert({
      id:          loadId,
      company_id:  orgId,
      job_name:    validation.data.job_name,
      load_type:   validation.data.material,
      driver_name: validation.data.driver_name,
      truck_number: validation.data.truck_number,
      date:        validation.data.date,
      rate:         validation.data.rate ?? 0,
      rate_type:    rateType,
      rate_quantity: parseFloat(quantity) || null,
      total_pay:    parseFloat(totalPay) || null,
      status:       'pending',
      source:       'office',
    })
    if (loadErr) {
      toast.error('Failed to save ticket')
      Sentry.captureException(loadErr, { tags: { feature: 'quick-ticket', company_id: orgId } })
      setSaving(false)
      return
    }

    const filledSlips = slips.filter(s => s.ticket_number || s.tonnage || s.imageFile)
    for (const slip of filledSlips) {
      let imageUrl: string | null = null
      if (slip.imageFile) imageUrl = await uploadPhoto(loadId, slip.id, slip.imageFile)
      await supabase.from('load_tickets').insert({
        id: slip.id,
        load_id: loadId,
        company_id: orgId,
        ticket_number: slip.ticket_number || null,
        tonnage: parseFloat(slip.tonnage) || null,
        image_url: imageUrl,
      })
    }

    setDone(true)
    setSaving(false)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 gap-6">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Ticket Saved!</h2>
          <p className="text-gray-500 mt-1">Load recorded successfully.</p>
        </div>
        <div className="flex gap-3 w-full max-w-xs">
          <button
            onClick={() => { setDone(false); setJob(''); setLoadType(''); setSlips([makeSlip()]) }}
            className="flex-1 py-4 rounded-2xl bg-[var(--brand-dark)] text-white font-semibold text-base"
          >
            Add Another
          </button>
          <Link href="/dashboard/tickets" className="flex-1 py-4 rounded-2xl border-2 border-gray-200 text-gray-700 font-semibold text-base text-center">
            View All
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[var(--brand-dark)] text-white px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/dashboard/tickets" className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-bold text-lg leading-tight">Quick Ticket</h1>
          <p className="text-white/60 text-xs">Fast mobile entry</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4 max-w-lg mx-auto pb-8">

        {/* Job Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Job Name *</label>
          <input
            value={job}
            onChange={e => setJob(e.target.value)}
            placeholder="Enter job name…"
            list="job-list"
            required
            className="w-full h-14 px-4 rounded-2xl border-2 border-gray-200 bg-white text-base font-medium focus:outline-none focus:border-[var(--brand-primary)]"
          />
          <datalist id="job-list">
            {recentJobs.map(j => <option key={j} value={j} />)}
          </datalist>
        </div>

        {/* Load Type */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Load Type</label>
          <div className="grid grid-cols-4 gap-2">
            {LOAD_TYPES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setLoadType(t === loadType ? '' : t)}
                className={`h-12 rounded-xl text-sm font-medium border-2 transition-all ${
                  loadType === t
                    ? 'bg-[var(--brand-dark)] border-[#1e3a2a] text-white'
                    : 'bg-white border-gray-200 text-gray-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Truck + Driver */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Truck #</label>
            <input
              value={truck}
              onChange={e => setTruck(e.target.value)}
              placeholder="Truck #"
              list="truck-list"
              className="w-full h-14 px-4 rounded-2xl border-2 border-gray-200 bg-white text-base font-medium focus:outline-none focus:border-[var(--brand-primary)]"
            />
            <datalist id="truck-list">
              {recentTrucks.map(t => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Driver</label>
            <input
              value={driver}
              onChange={e => setDriver(e.target.value)}
              placeholder="Driver name"
              list="driver-list"
              className="w-full h-14 px-4 rounded-2xl border-2 border-gray-200 bg-white text-base font-medium focus:outline-none focus:border-[var(--brand-primary)]"
            />
            <datalist id="driver-list">
              {recentDrivers.map(d => <option key={d} value={d} />)}
            </datalist>
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full h-14 px-4 rounded-2xl border-2 border-gray-200 bg-white text-base font-medium focus:outline-none focus:border-[var(--brand-primary)]"
          />
        </div>

        {/* Rate Type */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Rate Type</label>
          <div className="flex gap-2">
            {(['load', 'hour', 'ton'] as const).map(type => (
              <button
                key={type}
                type="button"
                onClick={() => { setRateType(type); setQuantity(''); setTotalPay(''); setTimeIn(''); setTimeOut('') }}
                className={`flex-1 rounded-2xl border-2 text-base font-semibold transition-all ${
                  rateType === type
                    ? 'bg-[var(--brand-dark)] border-[var(--brand-dark)] text-white'
                    : 'bg-white border-gray-200 text-gray-700'
                }`}
                style={{ minHeight: 52 }}
              >
                {type === 'load' ? '/job' : type === 'hour' ? '/hr' : '/ton'}
              </button>
            ))}
          </div>
        </div>

        {/* Job Rate */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            {rateType === 'hour' ? 'Hourly Rate' : rateType === 'ton' ? 'Rate per Ton' : 'Job Rate'}
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={rate}
            onChange={e => setRate(e.target.value)}
            placeholder="0.00"
            className="w-full h-14 px-4 rounded-2xl border-2 border-gray-200 bg-white text-base font-medium focus:outline-none focus:border-[var(--brand-primary)]"
          />
        </div>

        {/* Time In / Out — only shown for hourly */}
        {rateType === 'hour' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Time In</label>
              <input
                type="time"
                value={timeIn}
                onChange={e => setTimeIn(e.target.value)}
                className="w-full h-14 px-4 rounded-2xl border-2 border-gray-200 bg-white text-base font-medium focus:outline-none focus:border-[var(--brand-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Time Out</label>
              <input
                type="time"
                value={timeOut}
                onChange={e => setTimeOut(e.target.value)}
                className="w-full h-14 px-4 rounded-2xl border-2 border-gray-200 bg-white text-base font-medium focus:outline-none focus:border-[var(--brand-primary)]"
              />
            </div>
          </div>
        )}

        {/* Quantity */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            {rateType === 'hour' ? 'Hours Worked' : rateType === 'ton' ? 'Tons / Qty' : '# of Jobs'}
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={quantity}
            readOnly={rateType === 'hour' && !!(timeIn && timeOut)}
            onChange={e => setQuantity(e.target.value)}
            placeholder={rateType === 'hour' ? (timeIn && timeOut ? 'Auto from times' : '0.0') : rateType === 'ton' ? '0.00' : '0'}
            className={`w-full h-14 px-4 rounded-2xl border-2 border-gray-200 bg-white text-base font-medium focus:outline-none focus:border-[var(--brand-primary)] ${rateType === 'hour' && timeIn && timeOut ? 'bg-gray-50 text-gray-500' : ''}`}
          />
          {rateType === 'hour' && timeIn && timeOut && (
            <p className="text-xs text-green-600 mt-1 font-medium">✓ Auto-calculated from times</p>
          )}
        </div>

        {/* Total Pay */}
        {totalPay ? (
          <div className="rounded-2xl bg-green-50 border-2 border-green-200 px-4 py-4">
            <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">Total Pay</p>
            <p className="text-3xl font-black text-green-800">${totalPay}</p>
            <p className="text-xs text-green-600 mt-1">
              {rateType === 'hour'
                ? `$${rate}/hr × ${quantity} hrs`
                : rateType === 'ton'
                ? `$${rate}/ton × ${quantity} tons`
                : `$${rate}/job × ${quantity} jobs`}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 px-4 py-4 text-center">
            <p className="text-xs text-gray-400">Total Pay — enter rate &amp; quantity to calculate</p>
          </div>
        )}

        {/* Slips */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-gray-700">Ticket Slips</label>
            <span className="text-xs text-gray-400">{slips.length} slip{slips.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="space-y-3">
            {slips.map((slip, idx) => (
              <div key={slip.id} className="bg-white rounded-2xl border-2 border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Slip {idx + 1}</span>
                  {slips.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSlips(prev => prev.filter(s => s.id !== slip.id))}
                      className="h-7 w-7 rounded-full bg-red-50 flex items-center justify-center"
                    >
                      <X className="h-3.5 w-3.5 text-red-500" />
                    </button>
                  )}
                </div>

                {/* Photo button — prominent */}
                <div className="mb-3">
                  {slip.imagePreview ? (
                    <div className="relative rounded-xl overflow-hidden">
                      <Image src={slip.imagePreview} alt="slip" width={400} height={200} className="w-full h-40 object-cover" />
                      <button
                        type="button"
                        onClick={() => updateSlip(slip.id, { imageFile: null, imagePreview: null })}
                        className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/50 flex items-center justify-center"
                      >
                        <X className="h-4 w-4 text-white" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRefs.current.get(slip.id)?.click()}
                      className="w-full h-24 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center gap-1.5 active:bg-gray-100"
                    >
                      <Camera className="h-7 w-7 text-gray-400" />
                      <span className="text-sm text-gray-500 font-medium">Tap to add photo</span>
                    </button>
                  )}
                  <input
                    ref={el => { if (el) fileRefs.current.set(slip.id, el) }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={e => handlePhoto(slip.id, e)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Ticket #</label>
                    <input
                      value={slip.ticket_number}
                      onChange={e => updateSlip(slip.id, { ticket_number: e.target.value })}
                      placeholder="e.g. 1042"
                      className="w-full h-12 px-3 rounded-xl border-2 border-gray-200 bg-white text-sm font-medium focus:outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Tons</label>
                    <input
                      type="number"
                      step="0.01"
                      value={slip.tonnage}
                      onChange={e => updateSlip(slip.id, { tonnage: e.target.value })}
                      placeholder="0.00"
                      className="w-full h-12 px-3 rounded-xl border-2 border-gray-200 bg-white text-sm font-medium focus:outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setSlips(prev => [...prev, makeSlip()])}
            className="mt-2 w-full h-12 rounded-2xl border-2 border-dashed border-[var(--brand-primary)] text-[var(--brand-primary)] font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Another Slip
          </button>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          className="w-full h-16 rounded-2xl bg-[var(--brand-dark)] text-white font-bold text-lg flex items-center justify-center gap-2 active:opacity-90 disabled:opacity-60 mt-2"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          {saving ? 'Saving…' : 'Save Ticket'}
        </button>
      </form>
    </div>
  )
}
