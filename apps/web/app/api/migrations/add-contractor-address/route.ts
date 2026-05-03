import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// One-time migration. Run in Supabase SQL editor if exec_sql RPC is unavailable:
//   ALTER TABLE contractors ADD COLUMN IF NOT EXISTS address text;
//   ALTER TABLE invoices   ADD COLUMN IF NOT EXISTS client_phone text;
//   ALTER TABLE invoices   ADD COLUMN IF NOT EXISTS client_email text;
export async function POST() {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_KEY not set' }, { status: 500 })
  }

  const sql = `
    ALTER TABLE contractors ADD COLUMN IF NOT EXISTS address text;
    ALTER TABLE invoices    ADD COLUMN IF NOT EXISTS client_phone text;
    ALTER TABLE invoices    ADD COLUMN IF NOT EXISTS client_email text;
  `

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await admin.rpc('exec_sql', { sql }).maybeSingle()

  if (error?.message?.includes('exec_sql')) {
    return NextResponse.json({
      error: 'exec_sql RPC not available. Run this in the Supabase SQL editor:\n' + sql,
    }, { status: 422 })
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
