import { Resend } from 'resend'

export interface SendMissingTicketEmailParams {
  driverEmail: string
  driverName: string
  jobName: string
  dispatchDate: string
  submitLink: string
  isUrgent?: boolean
}

export async function sendMissingTicketEmail(params: SendMissingTicketEmailParams): Promise<{ sent: boolean; error?: string }> {
  const { driverEmail, driverName, jobName, dispatchDate, submitLink, isUrgent = false } = params

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.warn('[follow-up] RESEND_API_KEY not configured — skipping email')
    return { sent: false, error: 'no_api_key' }
  }

  const formattedDate = new Date(dispatchDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  const subject = isUrgent
    ? `URGENT: Missing ticket for ${jobName} on ${formattedDate}`
    : `Reminder: You have a missing ticket for ${jobName} on ${formattedDate}`

  const headerBg     = isUrgent ? '#7f1d1d' : '#1e3a2a'
  const headerAccent = isUrgent ? '#fca5a5' : '#86efac'
  const bannerBg     = isUrgent ? '#fef2f2' : '#f0fdf4'
  const bannerBorder = isUrgent ? '#fee2e2' : '#bbf7d0'
  const bannerText   = isUrgent ? '#991b1b' : '#166534'
  const btnBg        = isUrgent ? '#dc2626' : '#2d6a4f'
  const icon         = isUrgent ? '🚨' : '📋'
  const headline     = isUrgent ? 'Action Required' : 'Missing Ticket Reminder'

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#f9fafb;padding:32px 16px">
      <div style="background:${headerBg};border-radius:12px;padding:24px;margin-bottom:24px;text-align:center">
        <div style="font-size:36px;margin-bottom:8px">${icon}</div>
        <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">${headline}</h1>
        <p style="color:${headerAccent};margin:8px 0 0;font-size:13px">DumpTruckBoss</p>
      </div>

      <div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;margin-bottom:20px">
        <div style="background:${bannerBg};padding:16px 20px;border-bottom:1px solid ${bannerBorder}">
          <p style="margin:0;font-size:15px;font-weight:600;color:${bannerText}">Hi ${driverName},</p>
          <p style="margin:8px 0 0;font-size:14px;color:${bannerText}">
            You have an unsubmitted ticket for <strong>${jobName}</strong> on <strong>${formattedDate}</strong>.
          </p>
        </div>

        <div style="padding:20px">
          <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6">
            This ticket needs to be submitted to ensure you get paid correctly for your work.
            It only takes about 30 seconds — just tap the button below.
          </p>

          <div style="text-align:center;margin:24px 0">
            <a
              href="${submitLink}"
              style="display:inline-block;background:${btnBg};color:#fff;font-size:15px;font-weight:700;
                     padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.01em"
            >
              Submit Missing Ticket →
            </a>
          </div>

          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center">
            Or go to dumptruckboss.com/driver and tap "Submit Ticket"
          </p>
        </div>
      </div>

      <p style="text-align:center;font-size:12px;color:#9ca3af;margin:0">
        DumpTruckBoss · dumptruckboss.com<br>
        <span style="font-size:11px">This reminder was sent because a ticket is missing in our records.</span>
      </p>
    </div>
  `

  const resend = new Resend(resendKey)
  const { error } = await resend.emails.send({
    from:    'DumpTruckBoss <noreply@dumptruckboss.com>',
    to:      driverEmail,
    subject,
    html,
  })

  if (error) {
    console.error('[follow-up] email send error:', error)
    return { sent: false, error: error.message }
  }

  return { sent: true }
}
