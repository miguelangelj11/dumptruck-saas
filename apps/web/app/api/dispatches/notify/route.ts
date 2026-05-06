import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { generateDispatchToken } from '@/lib/dispatch-token'

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
  const { driverEmail, driverName, jobName, location, startTime, truckNumber, instructions, dispatchId, companyId } =
    body as {
      driverEmail?:  string
      driverName?:   string
      jobName?:      string
      location?:     string
      startTime?:    string
      truckNumber?:  string
      instructions?: string
      dispatchId?:   string
      companyId?:    string
    }

  if (!driverEmail) return NextResponse.json({ sent: false, reason: 'no_email' })

  const resend = new Resend(resendKey)

  const rows: { label: string; value: string }[] = [
    ...(jobName     ? [{ label: 'Job',          value: jobName      }] : []),
    ...(location    ? [{ label: 'Location',     value: location     }] : []),
    ...(startTime   ? [{ label: 'Start Time',   value: startTime    }] : []),
    ...(truckNumber ? [{ label: 'Truck #',      value: truckNumber  }] : []),
    ...(instructions? [{ label: 'Instructions', value: instructions }] : []),
  ]

  const tableRows = rows.map(r =>
    `<tr><td style="padding:8px 12px;font-weight:600;color:#374151;width:130px;vertical-align:top">${r.label}</td><td style="padding:8px 12px;color:#111827">${r.value}</td></tr>`
  ).join('')

  const token = dispatchId ? generateDispatchToken(dispatchId) : null
  const base  = dispatchId ? `https://dumptruckboss.com/api/dispatches/respond?id=${dispatchId}&token=${token}` : null

  const portalUrl = companyId ? `https://dumptruckboss.com/portal?c=${companyId}` : null

  const actionButtons = base ? `
    <div style="text-align:center;margin:24px 0">
      <a href="${base}&action=accepted"
         style="display:inline-block;background:#16a34a;color:#fff;font-size:15px;font-weight:700;
                padding:14px 28px;border-radius:10px;text-decoration:none;letter-spacing:0.01em;margin:0 6px 10px">
        ✅ Accept Dispatch
      </a>
      <a href="${base}&action=declined"
         style="display:inline-block;background:#dc2626;color:#fff;font-size:15px;font-weight:700;
                padding:14px 28px;border-radius:10px;text-decoration:none;letter-spacing:0.01em;margin:0 6px 10px">
        ❌ Decline Dispatch
      </a>
      <p style="font-size:11px;color:#9ca3af;margin:10px 0 0">
        Tap a button to respond to this dispatch
      </p>
      ${portalUrl ? `
      <div style="margin-top:20px;padding-top:20px;border-top:1px solid #e5e7eb">
        <a href="${portalUrl}"
           style="display:inline-block;background:#1e3a2a;color:#fff;font-size:14px;font-weight:600;
                  padding:12px 24px;border-radius:10px;text-decoration:none;margin:0 6px">
          📋 Submit Ticket
        </a>
        <p style="font-size:11px;color:#9ca3af;margin:8px 0 0">
          Use this link to submit your ticket after completing work
        </p>
      </div>` : ''}
    </div>
  ` : ''

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
        ${actionButtons}
      </div>
      <p style="text-align:center;font-size:12px;color:#9ca3af;margin:0">DumpTruckBoss · dumptruckboss.com</p>
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
