-- ================================================================
-- DumpTruckBoss — Roadmap Migrations (Steps 2–8)
-- Safe to re-run: all use IF NOT EXISTS / IF NOT EXISTS logic
-- Run in Supabase SQL Editor
-- ================================================================

-- ----------------------------------------------------------------
-- STEP 2: Driver Portal — link drivers to auth accounts
-- ----------------------------------------------------------------
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'driver';

CREATE UNIQUE INDEX IF NOT EXISTS drivers_auth_user_id_idx ON drivers(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- RLS: drivers can read their own dispatches
DROP POLICY IF EXISTS "drivers_read_own_dispatches" ON dispatches;
CREATE POLICY "drivers_read_own_dispatches"
  ON dispatches FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM drivers WHERE auth_user_id = auth.uid()
    )
  );

-- RLS: drivers can read their own loads
DROP POLICY IF EXISTS "drivers_read_own_loads" ON loads;
CREATE POLICY "drivers_read_own_loads"
  ON loads FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM drivers WHERE auth_user_id = auth.uid())
    AND driver_name IN (SELECT name FROM drivers WHERE auth_user_id = auth.uid())
  );

-- RLS: drivers can insert loads (submit tickets)
DROP POLICY IF EXISTS "drivers_insert_own_loads" ON loads;
CREATE POLICY "drivers_insert_own_loads"
  ON loads FOR INSERT
  WITH CHECK (
    company_id IN (SELECT company_id FROM drivers WHERE auth_user_id = auth.uid())
  );


-- ----------------------------------------------------------------
-- STEP 3: OCR fields on loads
-- ----------------------------------------------------------------
ALTER TABLE loads
  ADD COLUMN IF NOT EXISTS ocr_raw jsonb,
  ADD COLUMN IF NOT EXISTS ocr_processed boolean NOT NULL DEFAULT false;


-- ----------------------------------------------------------------
-- STEP 5: Job Profit fields
-- ----------------------------------------------------------------
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS driver_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fuel_cost   numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_costs numeric NOT NULL DEFAULT 0;


-- ----------------------------------------------------------------
-- STEP 7: Client Portal token
-- ----------------------------------------------------------------
ALTER TABLE client_companies
  ADD COLUMN IF NOT EXISTS portal_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS client_companies_portal_token_idx ON client_companies(portal_token);


-- ----------------------------------------------------------------
-- Reload PostgREST schema cache
-- ----------------------------------------------------------------
NOTIFY pgrst, 'reload schema';


-- ----------------------------------------------------------------
-- Verify
-- ----------------------------------------------------------------
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('drivers', 'loads', 'jobs', 'client_companies')
  AND column_name IN ('auth_user_id', 'role', 'ocr_raw', 'ocr_processed',
                      'driver_cost', 'fuel_cost', 'other_costs', 'portal_token')
ORDER BY table_name, column_name;
