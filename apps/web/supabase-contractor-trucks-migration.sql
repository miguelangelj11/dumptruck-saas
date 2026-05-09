-- Create contractor_trucks table
-- Run this in the Supabase SQL editor

CREATE TABLE IF NOT EXISTS contractor_trucks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  truck_number text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS contractor_trucks_unique
  ON contractor_trucks (company_id, contractor_id, truck_number);

ALTER TABLE contractor_trucks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contractor_trucks_owner" ON contractor_trucks
  FOR ALL
  USING (company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid()));

NOTIFY pgrst, 'reload schema';
