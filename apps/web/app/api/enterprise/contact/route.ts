import { Resend } from 'resend'

export async function POST(request: Request) {
  const body = await request.json()
  const { name, company, email, phone, truck_count, needs } = body

  if (!name || !company || !email || !truck_count) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('[enterprise/contact] RESEND_API_KEY not configured')
    return Response.json({ error: 'Email not configured' }, { status: 500 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  await Promise.allSettled([
    // Notification to owner
    resend.emails.send({
      from: 'DumpTruckBoss <noreply@dumptruckboss.com>',
      to:   'miguelangel.j11@gmail.com',
      subject: `🚛 Enterprise Inquiry: ${company} (${truck_count} trucks)`,
      html: `
        <h2 style="font-family:sans-serif">New Enterprise Inquiry</h2>
        <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse">
          <tr><td style="padding:6px 12px 6px 0;color:#666;font-weight:600">Name:</td><td>${name}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#666;font-weight:600">Company:</td><td>${company}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#666;font-weight:600">Email:</td><td><a href="mailto:${email}">${email}</a></td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#666;font-weight:600">Phone:</td><td>${phone || 'Not provided'}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#666;font-weight:600">Trucks:</td><td>${truck_count}</td></tr>
        </table>
        <p style="font-family:sans-serif;font-size:14px;color:#333;margin-top:16px"><strong>Needs:</strong></p>
        <p style="font-family:sans-serif;font-size:14px;color:#555;white-space:pre-wrap">${needs || 'Not provided'}</p>
      `,
    }),

    // Confirmation to prospect
    resend.emails.send({
      from: 'Miguel @ DumpTruckBoss <hello@dumptruckboss.com>',
      to:   email,
      subject: 'Got your message — DumpTruckBoss Enterprise',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <p style="font-size:16px;color:#111">Hey ${name},</p>
          <p style="font-size:15px;color:#444;line-height:1.6">
            Got your message. I'll reach out within 1 business day to talk through
            what makes sense for ${company}.
          </p>
          <p style="font-size:15px;color:#444;line-height:1.6">
            In the meantime, feel free to reply to this email with any questions.
          </p>
          <p style="font-size:15px;color:#444">— Miguel</p>
          <p style="font-size:13px;color:#888">Founder, DumpTruckBoss</p>
        </div>
      `,
    }),
  ])

  return Response.json({ success: true })
}
