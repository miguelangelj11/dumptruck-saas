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

  const steps: string[] = []

  const migrations = [
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_remaining numeric`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS overpaid_amount numeric DEFAULT 0`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_notes text`,
    `ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'partial'`,
  ]

  for (const sql of migrations) {
    const { error } = await admin.rpc('exec_sql', { sql })
    if (error) {
      return NextResponse.json({ error: error.message, steps }, { status: 500 })
    }
    steps.push(sql)
  }

  return NextResponse.json({ success: true, steps })
}
