-- Trucks table for fleet management
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS trucks (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id   uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  truck_number text        NOT NULL,
  notes        text,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trucks_company_id_idx ON trucks(company_id);

-- RLS
ALTER TABLE trucks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage trucks"
  ON trucks FOR ALL
  USING (
    company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  );
