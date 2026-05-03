import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST() {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!serviceKey) return NextResponse.json({ error: 'SUPABASE_SERVICE_KEY not set' }, { status: 500 })

  const sql = `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name text;`

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
