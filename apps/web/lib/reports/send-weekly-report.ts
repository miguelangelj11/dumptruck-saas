import { Resend } from 'resend'
import type { WeeklyReportData } from './generate-weekly-report'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://dumptruckboss.com'

function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtMoney(n: number): string {
  if (n >= 1000) return `$${fmt(Math.round(n / 100) * 100 >= 1000 ? Math.round(n) : n)}`
  return `$${fmt(n)}`
}

function statRow(icon: string, label: string, value: string, color = '#111827', bg = '#ffffff'): string {
  return `
    <tr>
      <td style="padding:12px 20px;background:${bg};border-bottom:1px solid #f3f4f6">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="font-size:18px;width:28px">${icon}</td>
            <td style="font-size:14px;color:#6b7280;padding-left:8px">${label}</td>
            <td style="font-size:16px;font-weight:700;color:${color};text-align:right">${value}</td>
          </tr>
        </table>
      </td>
    </tr>
  `
}

export async function sendWeeklyReport(
  toEmail: string,
  toName: string,
  data: WeeklyReportData,
): Promise<{ sent: boolean; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.warn('[reports/weekly] RESEND_API_KEY not configured — skipping')
    return { sent: false, error: 'no_api_key' }
  }

  const subject = `📊 Your Week at DumpTruckBoss — ${data.weekStart}–${data.weekEnd}`
  const dashboardUrl = `${APP_URL}/dashboard`
  const invoicesUrl  = `${APP_URL}/dashboard/invoices?filter=overdue`
  const settingsUrl  = `${APP_URL}/dashboard/settings`

  const overdueBlock = data.overdueCount > 0 ? `
    <tr>
      <td style="padding:12px 20px;background:#fef2f2;border-bottom:1px solid #fee2e2">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="font-size:18px;width:28px">🔴</td>
            <td style="font-size:14px;color:#991b1b;padding-left:8px;font-weight:600">
              ${data.overdueCount} overdue invoice${data.overdueCount !== 1 ? 's' : ''} need attention
            </td>
            <td style="text-align:right">
              <a href="${invoicesUrl}" style="font-size:12px;color:#dc2626;font-weight:700;text-decoration:none">
                Review →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  ` : ''

  const missingBlock = data.missingTicketValue > 0 ? `
    <tr>
      <td style="padding:12px 20px;background:#fffbeb;border-bottom:1px solid #fef3c7">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="font-size:18px;width:28px">⚠️</td>
            <td style="font-size:14px;color:#92400e;padding-left:8px">
              ~${fmtMoney(data.missingTicketValue)} in missing tickets
            </td>
            <td style="text-align:right">
              <a href="${APP_URL}/dashboard/tickets?tab=missing" style="font-size:12px;color:#d97706;font-weight:700;text-decoration:none">
                View →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  ` : ''

  const topJobBlock = data.topJob ? `
    <tr>
      <td style="padding:12px 20px;background:#f0fdf4;border-bottom:1px solid #bbf7d0">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="font-size:18px;width:28px">🏆</td>
            <td style="font-size:14px;color:#166534;padding-left:8px;font-weight:600">
              Top Job: ${data.topJob.name}
            </td>
            <td style="font-size:16px;font-weight:700;color:#166534;text-align:right">
              ${fmtMoney(data.topJob.revenue)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  ` : ''

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#f9fafb;font-family:sans-serif">
      <div style="max-width:520px;margin:0 auto;padding:24px 16px">

        <!-- Header -->
        <div style="background:#1e3a2a;border-radius:14px;padding:28px 24px;margin-bottom:20px;text-align:center">
          <div style="font-size:36px;margin-bottom:8px">🚛</div>
          <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:800">Weekly Performance Report</h1>
          <p style="color:#86efac;margin:6px 0 0;font-size:14px">${data.weekStart} – ${data.weekEnd}</p>
          <p style="color:#6ee7b7;margin:2px 0 0;font-size:12px">${data.companyName}</p>
        </div>

        <!-- Stats table -->
        <div style="background:#ffffff;border-radius:14px;border:1px solid #e5e7eb;overflow:hidden;margin-bottom:16px">
          <table style="width:100%;border-collapse:collapse">
            ${statRow('💰', 'Revenue Collected', fmtMoney(data.totalRevenue), '#166534', '#f0fdf4')}
            ${statRow('📋', 'Loads Completed', String(data.totalLoads))}
            ${statRow('📬', 'Outstanding Invoices', fmtMoney(data.outstandingAmount), data.outstandingAmount > 0 ? '#92400e' : '#111827')}
            ${overdueBlock}
            ${missingBlock}
            ${topJobBlock}
          </table>
        </div>

        <!-- CTA -->
        <div style="text-align:center;margin-bottom:24px">
          <a
            href="${dashboardUrl}"
            style="display:inline-block;background:#2d6a4f;color:#ffffff;font-size:15px;font-weight:700;
                   padding:14px 36px;border-radius:10px;text-decoration:none"
          >
            Open Dashboard →
          </a>
        </div>

        <!-- Footer -->
        <p style="text-align:center;font-size:11px;color:#9ca3af;line-height:1.6;margin:0">
          You're receiving this because weekly reports are enabled for ${data.companyName}.<br>
          <a href="${settingsUrl}" style="color:#9ca3af;text-decoration:underline">Manage settings</a>
           · DumpTruckBoss
        </p>

      </div>
    </body>
    </html>
  `

  const resend = new Resend(resendKey)
  const { error } = await resend.emails.send({
    from:    'DumpTruckBoss Reports <reports@dumptruckboss.com>',
    to:      toEmail,
    subject,
    html,
  })

  if (error) {
    console.error('[reports/weekly] send error:', error)
    return { sent: false, error: error.message }
  }

  return { sent: true }
}
