import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE env vars')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const id     = searchParams.get('id')
  const action = searchParams.get('action')
  const token  = searchParams.get('token')

  if (!id || !token || !action) {
    return html(errorPage('Missing parameters.'), 400)
  }

  if (action !== 'accepted' && action !== 'declined') {
    return html(errorPage('Invalid action.'), 400)
  }

  const expected = Buffer.from(id).toString('base64')
  if (token !== expected) {
    return html(errorPage('Invalid or expired link.'), 403)
  }

  const admin = getAdmin()

  const { data: dispatch, error: fetchError } = await admin
    .from('dispatches')
    .select('id, status')
    .eq('id', id)
    .maybeSingle()

  if (fetchError || !dispatch) {
    return html(errorPage('Dispatch not found.'), 404)
  }

  if (dispatch.status === action) {
    return html(action === 'accepted' ? alreadyAcceptedPage() : alreadyDeclinedPage(), 200)
  }

  if (dispatch.status === 'working' || dispatch.status === 'completed') {
    return html(alreadyAcceptedPage(), 200)
  }

  const { error: updateError } = await admin
    .from('dispatches')
    .update({ status: action, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (updateError) {
    console.error('[dispatches/respond] update error:', updateError)
    return html(errorPage('Could not record your response. Please contact your dispatcher.'), 500)
  }

  return html(action === 'accepted' ? acceptedPage() : declinedPage(), 200)
}

function html(body: string, status: number) {
  return new NextResponse(body, { status, headers: { 'Content-Type': 'text/html' } })
}

function acceptedPage() {
  return page('✅', '#f0fdf4', '#dcfce7', '#15803d', 'Dispatch Accepted', "You're confirmed for this job. Your dispatcher has been notified.", 'See you on the job — DumpTruckBoss', '#6b7280')
}

function declinedPage() {
  return page('❌', '#fef2f2', '#fecaca', '#dc2626', 'Dispatch Declined', "You've declined this dispatch. Your dispatcher has been notified.", 'DumpTruckBoss', '#9ca3af')
}

function alreadyAcceptedPage() {
  return page('👍', '#f0fdf4', '#dcfce7', '#15803d', 'Already Confirmed', "This dispatch has already been accepted. You're all set!", 'DumpTruckBoss', '#9ca3af')
}

function alreadyDeclinedPage() {
  return page('👎', '#f9fafb', '#e5e7eb', '#374151', 'Already Declined', 'This dispatch has already been declined.', 'DumpTruckBoss', '#9ca3af')
}

function errorPage(message: string) {
  return page('⚠️', '#fef2f2', '#fecaca', '#dc2626', 'Something went wrong', message, 'DumpTruckBoss', '#9ca3af')
}

function page(
  icon: string,
  bg: string,
  border: string,
  titleColor: string,
  title: string,
  body: string,
  footer: string,
  footerColor: string,
) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:sans-serif;background:${bg};min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0">
  <div style="background:#fff;border-radius:16px;border:1px solid ${border};padding:40px 32px;max-width:400px;width:100%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.07)">
    <div style="font-size:56px;margin-bottom:16px">${icon}</div>
    <h1 style="color:${titleColor};font-size:22px;margin:0 0 8px">${title}</h1>
    <p style="color:#374151;font-size:15px;margin:0 0 24px">${body}</p>
    <p style="color:${footerColor};font-size:13px;margin:0">${footer}</p>
  </div>
</body>
</html>`
}
