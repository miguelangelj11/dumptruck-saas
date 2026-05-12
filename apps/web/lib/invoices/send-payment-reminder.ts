import { Resend } from 'resend'

export interface SendPaymentReminderParams {
  toEmail: string
  toName: string
  invoiceNumber: string
  amountDue: number
  dueDate: string
  daysOverdue: number
  paymentLink: string
  companyName: string
  paymentTerms?: string | null
  earlyPaymentDeadline?: string | null
}

function fmtDate(d: string): string {
  const [y, m, day] = d.slice(0, 10).split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m!) - 1]} ${parseInt(day!)}, ${y}`
}

function fmtMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export async function sendPaymentReminder(
  params: SendPaymentReminderParams,
): Promise<{ sent: boolean; error?: string }> {
  const { toEmail, toName, invoiceNumber, amountDue, dueDate, daysOverdue, paymentLink, companyName, paymentTerms, earlyPaymentDeadline } = params

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.warn('[invoices/reminder] RESEND_API_KEY not configured — skipping email')
    return { sent: false, error: 'no_api_key' }
  }

  const formattedDate = fmtDate(dueDate)
  const isDue         = daysOverdue === 0
  const isUrgent      = daysOverdue >= 7

  const subject = isDue
    ? `Payment Due: Invoice ${invoiceNumber} from ${companyName}`
    : `Reminder: Invoice ${invoiceNumber} is ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue`

  const headerBg   = isUrgent ? '#7f1d1d' : '#1e3a2a'
  const headerText = isUrgent ? '#fca5a5' : '#86efac'
  const bannerBg   = isUrgent ? '#fef2f2' : '#f0fdf4'
  const bannerBorder = isUrgent ? '#fee2e2' : '#bbf7d0'
  const bannerColor  = isUrgent ? '#991b1b' : '#166534'
  const btnBg      = isUrgent ? '#dc2626' : '#2d6a4f'
  const icon       = isUrgent ? '⚠️' : '📄'
  const headline   = isDue ? 'Payment Due' : `${daysOverdue} Day${daysOverdue !== 1 ? 's' : ''} Overdue`

  const overdueBlurb = isDue
    ? `Invoice <strong>${invoiceNumber}</strong> for <strong>$${fmtMoney(amountDue)}</strong> is due today.`
    : `Invoice <strong>${invoiceNumber}</strong> for <strong>$${fmtMoney(amountDue)}</strong> was due on <strong>${formattedDate}</strong> and is now overdue.`

  const html = `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto;background:#f9fafb;padding:32px 16px">
      <div style="background:${headerBg};border-radius:12px;padding:24px;margin-bottom:24px;text-align:center">
        <div style="font-size:36px;margin-bottom:8px">${icon}</div>
        <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">${headline}</h1>
        <p style="color:${headerText};margin:8px 0 0;font-size:13px">${companyName}</p>
      </div>

      <div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;margin-bottom:20px">
        <div style="background:${bannerBg};padding:16px 20px;border-bottom:1px solid ${bannerBorder}">
          <p style="margin:0;font-size:15px;font-weight:600;color:${bannerColor}">Hi ${toName},</p>
          <p style="margin:8px 0 0;font-size:14px;color:${bannerColor}">${overdueBlurb}</p>
        </div>

        <div style="padding:20px">
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
            <tr>
              <td style="padding:8px 0;font-size:13px;color:#6b7280">Invoice #</td>
              <td style="padding:8px 0;font-size:13px;font-weight:600;color:#111827;text-align:right">${invoiceNumber}</td>
            </tr>
            <tr style="border-top:1px solid #f3f4f6">
              <td style="padding:8px 0;font-size:13px;color:#6b7280">Amount Due</td>
              <td style="padding:8px 0;font-size:15px;font-weight:700;color:#111827;text-align:right">$${fmtMoney(amountDue)}</td>
            </tr>
            <tr style="border-top:1px solid #f3f4f6">
              <td style="padding:8px 0;font-size:13px;color:#6b7280">Due Date</td>
              <td style="padding:8px 0;font-size:13px;color:${daysOverdue > 0 ? '#dc2626' : '#111827'};font-weight:${daysOverdue > 0 ? '600' : '400'};text-align:right">${formattedDate}</td>
            </tr>
            ${paymentTerms ? `
            <tr style="border-top:1px solid #f3f4f6">
              <td style="padding:8px 0;font-size:13px;color:#6b7280">Payment Terms</td>
              <td style="padding:8px 0;font-size:13px;color:#111827;text-align:right">${paymentTerms.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace('2 10 Net 30', '2/10 Net 30')}</td>
            </tr>` : ''}
          </table>
          ${paymentTerms === '2_10_net_30' && earlyPaymentDeadline ? `
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin-bottom:20px">
            <p style="margin:0;font-size:13px;color:#92400e;font-weight:600">💡 Early Payment Discount Available</p>
            <p style="margin:4px 0 0;font-size:13px;color:#78350f">Pay before ${fmtDate(earlyPaymentDeadline)} to save 2% — that's $${fmtMoney(amountDue * 0.02)} off your balance.</p>
          </div>` : ''}

          <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6">
            Please arrange payment at your earliest convenience to avoid any service disruption.
          </p>

          <div style="text-align:center;margin-bottom:16px">
            <a
              href="${paymentLink}"
              style="display:inline-block;background:${btnBg};color:#fff;font-size:15px;font-weight:700;
                     padding:14px 36px;border-radius:10px;text-decoration:none"
            >
              Pay Now →
            </a>
          </div>

          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center">
            Or copy this link: ${paymentLink}
          </p>
        </div>
      </div>

      <p style="text-align:center;font-size:12px;color:#9ca3af;margin:0">
        ${companyName} · Powered by DumpTruckBoss<br>
        <span style="font-size:11px">Questions? Reply to this email or contact hello@dumptruckboss.com</span>
      </p>
    </div>
  `

  const resend = new Resend(resendKey)
  const { error } = await resend.emails.send({
    from:    `${companyName} <noreply@dumptruckboss.com>`,
    to:      toEmail,
    subject,
    html,
  })

  if (error) {
    console.error('[invoices/reminder] email send error:', error)
    return { sent: false, error: error.message }
  }

  return { sent: true }
}
