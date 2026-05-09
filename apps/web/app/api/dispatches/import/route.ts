import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { Resend } from 'resend'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_KEY ?? ''
  return createAdmin(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { share_token } = await request.json() as { share_token: string }
  if (!share_token) return NextResponse.json({ error: 'share_token required' }, { status: 400 })

  const admin = getAdmin()

  // Fetch the shared job (public read via is_shared=true policy)
  const { data: job, error: jobErr } = await admin
    .from('jobs')
    .select('*, companies(id, name, phone, email, logo_url)')
    .eq('share_token', share_token)
    .eq('is_shared', true)
    .single()

  if (jobErr || !job) {
    return NextResponse.json({ error: 'Dispatch not found or link expired' }, { status: 404 })
  }

  if (job.share_expires_at && new Date(job.share_expires_at) < new Date()) {
    return NextResponse.json({ error: 'This share link has expired' }, { status: 410 })
  }

  // Get receiving company
  const { data: myProfile } = await admin
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()

  const { data: myCompany } = await admin
    .from('companies')
    .select('id, name, email')
    .eq(myProfile?.organization_id ? 'id' : 'owner_id', myProfile?.organization_id ?? user.id)
    .single()

  if (!myCompany) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  // Prevent importing your own job
  const senderCompany = job.companies as { id: string; name: string; phone?: string; email?: string } | null
  if (senderCompany?.id === myCompany.id) {
    return NextResponse.json({ error: 'You cannot import your own dispatch' }, { status: 400 })
  }

  // Check for duplicate import
  const { data: existing } = await admin
    .from('received_dispatches')
    .select('id')
    .eq('company_id', myCompany.id)
    .eq('share_token', share_token)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'You have already imported this dispatch', duplicate: true }, { status: 409 })
  }

  // Create received_dispatch record
  const { data: received, error: insErr } = await admin
    .from('received_dispatches')
    .insert({
      company_id: myCompany.id,
      sender_company_id: senderCompany?.id ?? null,
      sender_company_name: senderCompany?.name ?? 'Unknown',
      sender_phone: (senderCompany as { phone?: string | null } | null)?.phone ?? null,
      sender_email: (senderCompany as { email?: string | null } | null)?.email ?? null,
      job_name: job.job_name,
      job_location: job.location,
      material: job.material,
      rate: job.rate,
      rate_type: job.rate_type,
      start_date: job.start_date,
      end_date: job.end_date,
      notes: job.notes,
      share_token,
      status: 'pending',
      expires_at: job.share_expires_at,
    })
    .select()
    .single()

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  // Email sender that their dispatch was accepted
  try {
    const senderEmail = (senderCompany as { email?: string | null } | null)?.email
    if (senderEmail && process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'DumpTruckBoss <noreply@dumptruckboss.com>',
        to: senderEmail,
        subject: `✅ ${myCompany.name} accepted your dispatch for ${job.job_name}`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
            <h2 style="color:#2d6a4f">Dispatch Accepted!</h2>
            <p><strong>${myCompany.name}</strong> has accepted your dispatch request for <strong>${job.job_name}</strong>.</p>
            <p>They will be in touch to coordinate details.</p>
            <a href="https://dumptruckboss.com/dashboard/dispatch"
               style="display:inline-block;padding:12px 24px;background:#2d6a4f;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:12px">
              View in Dashboard →
            </a>
            <p style="margin-top:24px;font-size:12px;color:#9ca3af">DumpTruckBoss · dumptruckboss.com</p>
          </div>
        `,
      })
    }
  } catch {
    // Email failure should not block the import
  }

  return NextResponse.json({
    success: true,
    received_dispatch_id: received.id,
  })
}
