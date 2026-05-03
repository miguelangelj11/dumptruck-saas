import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function timeToMinutes(t: string): number {
  const match = t.match(/^(\d+):(\d+)\s*(AM|PM)$/i)
  if (!match) return -1
  let h = parseInt(match[1]!)
  const m = parseInt(match[2]!)
  const ap = match[3]!.toUpperCase()
  if (ap === 'PM' && h !== 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  return h * 60 + m
}

export async function POST(request: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!serviceKey) return NextResponse.json({ error: 'Server error' }, { status: 500 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const formData = await request.formData()

  const companyId   = formData.get('company_id') as string | null
  const driverName  = formData.get('driver_name') as string | null
  const date        = formData.get('date') as string | null
  const jobName     = formData.get('job_name') as string | null
  const truckNumber = formData.get('truck_number') as string | null
  const origin      = formData.get('origin') as string | null
  const destination = formData.get('destination') as string | null
  const startTime   = formData.get('start_time') as string | null
  const endTime     = formData.get('end_time') as string | null
  const material    = formData.get('material') as string | null
  const ticketNum   = formData.get('ticket_number') as string | null
  const tonsStr     = formData.get('tons') as string | null
  const notes       = formData.get('notes') as string | null
  const photo       = formData.get('photo') as File | null

  if (!companyId || !driverName || !date || !jobName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Verify company exists
  const { data: company } = await admin.from('companies').select('id').eq('id', companyId).maybeSingle()
  if (!company) return NextResponse.json({ error: 'Invalid company link' }, { status: 400 })

  // Upload photo via service key if provided
  let imageUrl: string | null = null
  if (photo && photo.size > 0) {
    const ext = photo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${companyId}/portal/${Date.now()}.${ext}`
    const buf = Buffer.from(await photo.arrayBuffer())
    const { error: uploadErr } = await admin.storage.from('ticket-photos').upload(path, buf, {
      contentType: photo.type || 'image/jpeg',
      upsert: true,
    })
    if (!uploadErr) {
      imageUrl = admin.storage.from('ticket-photos').getPublicUrl(path).data.publicUrl
    }
  }

  // Calculate hours from time strings like "7:00 AM" / "3:30 PM"
  let hoursWorked: string | null = null
  if (startTime && endTime) {
    const startMin = timeToMinutes(startTime)
    const endMin   = timeToMinutes(endTime)
    if (startMin >= 0 && endMin > startMin) {
      hoursWorked = ((endMin - startMin) / 60).toFixed(2)
    }
  }

  const loadId = crypto.randomUUID()

  const { error: loadErr } = await admin.from('loads').insert({
    id:                  loadId,
    company_id:          companyId,
    job_name:            jobName,
    driver_name:         driverName,
    date,
    truck_number:        truckNumber || null,
    origin:              origin || null,
    destination:         destination || null,
    time_in:             startTime || null,
    time_out:            endTime || null,
    hours_worked:        hoursWorked,
    material:            material || null,
    notes:               notes || null,
    image_url:           imageUrl,
    submitted_by_driver: true,
    source:              'driver',
    status:              'pending',
    rate:                0,
  })

  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 })

  // Insert load_ticket if ticket # or tonnage provided
  const tonnage = tonsStr ? parseFloat(tonsStr) : null
  if (ticketNum || (tonnage && tonnage > 0)) {
    await admin.from('load_tickets').insert({
      load_id:       loadId,
      company_id:    companyId,
      ticket_number: ticketNum || null,
      tonnage:       (tonnage && tonnage > 0) ? tonnage : null,
      image_url:     imageUrl,
    })
  }

  return NextResponse.json({ ok: true })
}
