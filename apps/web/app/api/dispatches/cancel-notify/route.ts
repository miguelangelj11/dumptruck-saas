import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.warn('[dispatches/cancel-notify] RESEND_API_KEY not configured — skipping email')
    return NextResponse.json({ sent: false, reason: 'no_api_key' })
  }

  const body = await request.json().catch(() => ({}))
  const { driverEmail, driverName, jobName, reason, type } =
    body as {
      driverEmail?: string
      driverName?:  string
      jobName?:     string
      reason?:      string
      type?:        'cancelled' | 'changed'
    }

  if (!driverEmail) return NextResponse.json({ sent: false, reason: 'no_email' })

  const isCancelled = type !== 'changed'

  const headerBg    = isCancelled ? '#450a0a' : '#1e3a5f'
  const headerAccent= isCancelled ? '#fca5a5' : '#93c5fd'
  const bannerBg    = isCancelled ? '#fef2f2' : '#eff6ff'
  const bannerBorder= isCancelled ? '#fee2e2' : '#dbeafe'
  const bannerText  = isCancelled ? '#991b1b' : '#1d4ed8'
  const subText     = isCancelled ? '#b91c1c' : '#1e40af'
  const icon        = isCancelled ? '🚫' : '📋'
  const headline    = isCancelled ? 'Dispatch Cancelled' : 'Dispatch Updated'
  const message     = isCancelled
    ? `Your dispatch${jobName ? ` for <strong>${jobName}</strong>` : ''} has been cancelled.`
    : `Your dispatch${jobName ? ` for <strong>${jobName}</strong>` : ''} has been updated.`

  const reasonBlock = reason ? `
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin:16px 20px">
      <p style="margin:0;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Note from dispatcher</p>
      <p style="margin:6px 0 0;font-size:14px;color:#111827">${reason}</p>
    </div>
  ` : ''

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#f9fafb;padding:32px 16px">
      <div style="background:${headerBg};border-radius:12px;padding:24px;margin-bottom:24px;text-align:center">
        <div style="font-size:32px;margin-bottom:8px">${icon}</div>
        <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">${headline}</h1>
        <p style="color:${headerAccent};margin:8px 0 0;font-size:14px">DumpTruckBoss</p>
      </div>
      <div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;margin-bottom:24px">
        <div style="background:${bannerBg};padding:16px 20px;border-bottom:1px solid ${bannerBorder}">
          <p style="margin:0;font-size:15px;color:${bannerText}">Hi ${driverName ?? 'Driver'},</p>
          <p style="margin:8px 0 0;font-size:14px;color:${subText}">${message}</p>
        </div>
        ${reasonBlock}
        <div style="padding:16px 20px">
          <p style="margin:0;font-size:13px;color:#6b7280">
            ${isCancelled
              ? 'Please contact your dispatcher if you have any questions.'
              : 'Please check with your dispatcher for the latest details.'}
          </p>
        </div>
      </div>
      <p style="text-align:center;font-size:12px;color:#9ca3af;margin:0">DumpTruckBoss · dumptruckboss.com</p>
    </div>
  `

  const resend = new Resend(resendKey)
  const subject = isCancelled
    ? `Dispatch Cancelled${jobName ? `: ${jobName}` : ''}`
    : `Dispatch Update${jobName ? `: ${jobName}` : ''}`

  const { error } = await resend.emails.send({
    from:    'DumpTruckBoss <noreply@dumptruckboss.com>',
    to:      driverEmail,
    subject,
    html,
  })

  if (error) {
    console.error('[dispatches/cancel-notify] email error:', error)
    return NextResponse.json({ sent: false, error: error.message })
  }

  return NextResponse.json({ sent: true })
}
