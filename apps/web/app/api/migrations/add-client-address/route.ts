import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// One-time migration: adds address column to client_companies table.
// Call once: POST /api/migrations/add-client-address
// Requires SUPABASE_SERVICE_KEY in env.
export async function POST() {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_KEY not set' }, { status: 500 })
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await admin.rpc('exec_sql', {
    sql: 'ALTER TABLE client_companies ADD COLUMN IF NOT EXISTS address text;',
  }).maybeSingle()

  // exec_sql may not exist — fall back to a direct insert test
  if (error?.message?.includes('exec_sql')) {
    // The column will be added via the Supabase dashboard SQL editor instead
    return NextResponse.json({
      error: 'exec_sql RPC not available. Run this in your Supabase SQL editor:\nALTER TABLE client_companies ADD COLUMN IF NOT EXISTS address text;',
    }, { status: 422 })
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, message: 'address column added to client_companies' })
}
