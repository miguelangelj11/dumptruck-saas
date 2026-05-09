-- Received Dispatches inbox system
-- Run this in the Supabase SQL editor

-- 1. received_dispatches table
CREATE TABLE IF NOT EXISTS received_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  sender_company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  sender_company_name text,
  sender_contact_name text,
  sender_phone text,
  sender_email text,
  job_name text NOT NULL,
  job_location text,
  material text,
  trucks_needed integer DEFAULT 1,
  rate numeric,
  rate_type text DEFAULT 'load',
  start_date date,
  end_date date,
  shift text,
  notes text,
  share_token uuid DEFAULT gen_random_uuid() UNIQUE,
  status text DEFAULT 'pending',
  responded_at timestamptz,
  response_notes text,
  converted_job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  converted_at timestamptz,
  expires_at timestamptz DEFAULT NOW() + INTERVAL '7 days',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE received_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "received_dispatches_own" ON received_dispatches FOR ALL
  USING (company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid()));

-- Public read so share links work without auth
CREATE POLICY "received_dispatches_public_read" ON received_dispatches
  FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_received_dispatches_company ON received_dispatches(company_id);
CREATE INDEX IF NOT EXISTS idx_received_dispatches_token ON received_dispatches(share_token);

-- 2. Add share columns to jobs table so each job can be shared
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS share_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS is_shared boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_expires_at timestamptz;

-- Public SELECT on jobs when is_shared = true
CREATE POLICY "jobs_public_share" ON jobs
  FOR SELECT USING (is_shared = true);

-- Backfill share_token for existing jobs that don't have one
UPDATE jobs SET share_token = gen_random_uuid() WHERE share_token IS NULL;

NOTIFY pgrst, 'reload schema';
