-- Fix 1: Missing invoice display columns on companies
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS invoice_show_material      boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS invoice_show_time          boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS invoice_show_ticket_number boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS invoice_show_truck         boolean DEFAULT true;

-- Fix 2: Trucks table
CREATE TABLE IF NOT EXISTS trucks (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id   uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  truck_number text        NOT NULL,
  driver_name  text,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trucks_company_id_idx ON trucks(company_id);

ALTER TABLE trucks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner select trucks" ON trucks FOR SELECT
  USING (company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid()));

CREATE POLICY "Owner insert trucks" ON trucks FOR INSERT
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid()));

CREATE POLICY "Owner update trucks" ON trucks FOR UPDATE
  USING (company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid()));

CREATE POLICY "Owner delete trucks" ON trucks FOR DELETE
  USING (company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid()));
