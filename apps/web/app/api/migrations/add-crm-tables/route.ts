import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST() {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!serviceKey) return NextResponse.json({ error: 'SUPABASE_SERVICE_KEY not set' }, { status: 500 })

  const sql = `
    CREATE TABLE IF NOT EXISTS leads (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      name         text NOT NULL,
      company_name text,
      phone        text,
      email        text,
      source       text,
      value        numeric,
      status       text NOT NULL DEFAULT 'new',
      notes        text,
      created_at   timestamptz NOT NULL DEFAULT now(),
      updated_at   timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      lead_id      uuid REFERENCES leads(id) ON DELETE SET NULL,
      job_name     text NOT NULL,
      material     text,
      location     text,
      rate         numeric,
      rate_type    text DEFAULT 'load',
      est_loads    integer,
      notes        text,
      status       text NOT NULL DEFAULT 'draft',
      created_at   timestamptz NOT NULL DEFAULT now(),
      updated_at   timestamptz NOT NULL DEFAULT now()
    );

    ALTER TABLE leads  ENABLE ROW LEVEL SECURITY;
    ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leads' AND policyname = 'leads_company') THEN
        CREATE POLICY leads_company ON leads
          USING (company_id IN (
            SELECT id FROM companies WHERE owner_id = auth.uid()
            UNION
            SELECT organization_id FROM profiles WHERE id = auth.uid()
          ));
      END IF;
    END $$;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quotes' AND policyname = 'quotes_company') THEN
        CREATE POLICY quotes_company ON quotes
          USING (company_id IN (
            SELECT id FROM companies WHERE owner_id = auth.uid()
            UNION
            SELECT organization_id FROM profiles WHERE id = auth.uid()
          ));
      END IF;
    END $$;
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
