import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const steps: string[] = []

  const migrations = [
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_remaining numeric`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS overpaid_amount numeric DEFAULT 0`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_notes text`,
    `ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'partial'`,
  ]

  for (const sql of migrations) {
    const { error } = await supabase.rpc('exec_sql', { sql })
    if (error) {
      return NextResponse.json({ error: error.message, steps }, { status: 500 })
    }
    steps.push(sql)
  }

  return NextResponse.json({ success: true, steps })
}
