import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.warn('[dispatches/notify] RESEND_API_KEY not configured — skipping email')
    return NextResponse.json({ sent: false, reason: 'no_api_key' })
  }

  const body = await request.json().catch(() => ({}))
  const { driverEmail, driverName, jobName, location, startTime, truckNumber, instructions } =
    body as {
      driverEmail?:  string
      driverName?:   string
      jobName?:      string
      location?:     string
      startTime?:    string
      truckNumber?:  string
      instructions?: string
    }

  if (!driverEmail) return NextResponse.json({ sent: false, reason: 'no_email' })

  const resend = new Resend(resendKey)

  const rows: { label: string; value: string }[] = [
    ...(jobName    ? [{ label: 'Job',           value: jobName    }] : []),
    ...(location   ? [{ label: 'Location',      value: location   }] : []),
    ...(startTime  ? [{ label: 'Start Time',    value: startTime  }] : []),
    ...(truckNumber? [{ label: 'Truck #',       value: truckNumber}] : []),
    ...(instructions?[{ label: 'Instructions', value: instructions}] : []),
  ]

  const tableRows = rows.map(r =>
    `<tr><td style="padding:8px 12px;font-weight:600;color:#374151;width:130px;vertical-align:top">${r.label}</td><td style="padding:8px 12px;color:#111827">${r.value}</td></tr>`
  ).join('')

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#f9fafb;padding:32px 16px">
      <div style="background:#1e3a2a;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">You've been dispatched</h1>
        <p style="color:#86efac;margin:8px 0 0;font-size:14px">DumpTruckBoss</p>
      </div>
      <div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;margin-bottom:24px">
        <div style="background:#f0fdf4;padding:16px 20px;border-bottom:1px solid #dcfce7">
          <p style="margin:0;font-size:15px;color:#166534">Hi ${driverName ?? 'Driver'},</p>
          <p style="margin:8px 0 0;font-size:14px;color:#15803d">You have a new dispatch assignment. Here are your details:</p>
        </div>
        <table style="width:100%;border-collapse:collapse">
          ${tableRows}
        </table>
      </div>
      <p style="text-align:center;font-size:12px;color:#9ca3af;margin:0">DumpTruckBoss · Powered by dumptruckboss.com</p>
    </div>
  `

  const { error } = await resend.emails.send({
    from:    'DumpTruckBoss <noreply@dumptruckboss.com>',
    to:      driverEmail,
    subject: `Dispatch: ${jobName ?? 'New Assignment'} — ${startTime ?? 'today'}`,
    html,
  })

  if (error) {
    console.error('[dispatches/notify] email error:', error)
    return NextResponse.json({ sent: false, error: error.message })
  }

  return NextResponse.json({ sent: true })
}
