import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { error } = await admin.rpc('exec_sql', {
    sql: `
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS auto_send_reminders boolean DEFAULT false;
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS weekly_report_enabled boolean DEFAULT true;
    `,
  })

  if (error) {
    return NextResponse.json({
      error: 'Run this SQL in your Supabase editor:\nALTER TABLE companies ADD COLUMN IF NOT EXISTS auto_send_reminders boolean DEFAULT false;\nALTER TABLE companies ADD COLUMN IF NOT EXISTS weekly_report_enabled boolean DEFAULT true;',
    }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
