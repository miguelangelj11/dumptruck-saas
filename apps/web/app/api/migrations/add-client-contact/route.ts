import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('Authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { error } = await admin.rpc('exec_sql', {
    sql: `
      ALTER TABLE client_companies ADD COLUMN IF NOT EXISTS email text;
      ALTER TABLE client_companies ADD COLUMN IF NOT EXISTS phone text;
    `,
  })

  if (error) {
    return NextResponse.json({
      error: 'exec_sql RPC not available. Run this in your Supabase SQL editor:\nALTER TABLE client_companies ADD COLUMN IF NOT EXISTS email text;\nALTER TABLE client_companies ADD COLUMN IF NOT EXISTS phone text;',
    }, { status: 500 })
  }

  return NextResponse.json({ ok: true, message: 'email and phone columns added to client_companies' })
}
