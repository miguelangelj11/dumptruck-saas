import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST() {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!serviceKey) return NextResponse.json({ error: 'SUPABASE_SERVICE_KEY not set' }, { status: 500 })

  const sql = `
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_customer_id     text;
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_price_id        text;
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS plan                   text;
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_status    text;
    CREATE UNIQUE INDEX IF NOT EXISTS companies_stripe_customer_id_idx ON companies (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
  `.trim()

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await admin.rpc('exec_sql', { sql }).maybeSingle()

  if (error?.message?.includes('exec_sql')) {
    return NextResponse.json({
      error: 'exec_sql RPC not available. Run this in the Supabase SQL editor:\n\n' + sql,
    }, { status: 422 })
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
