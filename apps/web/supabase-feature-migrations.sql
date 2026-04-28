-- =============================================================================
-- HaulFlow Feature Migration
-- Apply this in Supabase Dashboard > SQL Editor
-- =============================================================================

-- FEATURE 3: Color Theme

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS primary_color   text DEFAULT '#1e3a2a',
  ADD COLUMN IF NOT EXISTS accent_color    text DEFAULT '#2d7a4f';

-- FEATURE 1: Multi-language

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'en';

-- FEATURE 2: Driver Mobile Ticket App

-- Link drivers to Supabase auth accounts
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS drivers_auth_user_id_idx
  ON drivers(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- New columns on loads for driver-submitted tickets
ALTER TABLE loads
  ADD COLUMN IF NOT EXISTS submitted_by_driver  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS modification_reason  text,
  ADD COLUMN IF NOT EXISTS original_hours       text,
  ADD COLUMN IF NOT EXISTS original_loads       integer,
  ADD COLUMN IF NOT EXISTS driver_start_time    text,
  ADD COLUMN IF NOT EXISTS driver_end_time      text;

-- Driver notifications table
CREATE TABLE IF NOT EXISTS driver_notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL,
  load_id     uuid REFERENCES loads(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('approval', 'modification', 'rejection')),
  message     text NOT NULL,
  read        boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE driver_notifications ENABLE ROW LEVEL SECURITY;

-- Drivers can read their own notifications
CREATE POLICY IF NOT EXISTS "driver_notifications: driver reads own"
  ON driver_notifications FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM drivers WHERE auth_user_id = auth.uid()
    )
  );

-- Owners can insert notifications for their company's drivers
CREATE POLICY IF NOT EXISTS "driver_notifications: owner inserts"
  ON driver_notifications FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  );

-- RLS: allow drivers to read loads for their company
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'loads' AND policyname = 'loads: driver reads own'
  ) THEN
    CREATE POLICY "loads: driver reads own"
      ON loads FOR SELECT
      USING (
        company_id IN (
          SELECT company_id FROM drivers WHERE auth_user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- RLS: allow drivers to insert their own loads
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'loads' AND policyname = 'loads: driver inserts'
  ) THEN
    CREATE POLICY "loads: driver inserts"
      ON loads FOR INSERT
      WITH CHECK (
        submitted_by_driver = true
        AND company_id IN (
          SELECT company_id FROM drivers WHERE auth_user_id = auth.uid()
        )
        AND driver_name = (
          SELECT name FROM drivers WHERE auth_user_id = auth.uid() LIMIT 1
        )
      );
  END IF;
END $$;

-- RLS: allow drivers to read their dispatches
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dispatches' AND policyname = 'dispatches: driver reads own'
  ) THEN
    CREATE POLICY "dispatches: driver reads own"
      ON dispatches FOR SELECT
      USING (
        driver_id = (
          SELECT id FROM drivers WHERE auth_user_id = auth.uid() LIMIT 1
        )
      );
  END IF;
END $$;

-- FEATURE 5: Indexes

-- loads (tickets) - most queried table
CREATE INDEX IF NOT EXISTS idx_loads_company_date
  ON loads(company_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_loads_company_status
  ON loads(company_id, status);

CREATE INDEX IF NOT EXISTS idx_loads_company_driver
  ON loads(company_id, driver_name);

CREATE INDEX IF NOT EXISTS idx_loads_dispatch_id
  ON loads(dispatch_id) WHERE dispatch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_loads_driver_paid
  ON loads(company_id, driver_paid, status);

CREATE INDEX IF NOT EXISTS idx_loads_submitted_by_driver
  ON loads(company_id, submitted_by_driver, status)
  WHERE submitted_by_driver = true;

-- dispatches
CREATE INDEX IF NOT EXISTS idx_dispatches_company_date
  ON dispatches(company_id, dispatch_date DESC);

CREATE INDEX IF NOT EXISTS idx_dispatches_company_status
  ON dispatches(company_id, status);

CREATE INDEX IF NOT EXISTS idx_dispatches_driver
  ON dispatches(company_id, driver_id);

-- invoices
CREATE INDEX IF NOT EXISTS idx_invoices_company_status
  ON invoices(company_id, status);

CREATE INDEX IF NOT EXISTS idx_invoices_company_created
  ON invoices(company_id, created_at DESC);

-- load_tickets
CREATE INDEX IF NOT EXISTS idx_load_tickets_load_id
  ON load_tickets(load_id);

CREATE INDEX IF NOT EXISTS idx_load_tickets_company
  ON load_tickets(company_id);

-- drivers
CREATE INDEX IF NOT EXISTS idx_drivers_company
  ON drivers(company_id, status);

CREATE INDEX IF NOT EXISTS idx_drivers_auth_user_id
  ON drivers(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- driver_notifications
CREATE INDEX IF NOT EXISTS idx_driver_notifs_driver
  ON driver_notifications(driver_id, read, created_at DESC);

-- companies
CREATE INDEX IF NOT EXISTS idx_companies_owner_id
  ON companies(owner_id);

-- FEATURE 5: Revenue Aggregation RPC

CREATE OR REPLACE FUNCTION get_revenue_summary(
  p_company_id uuid,
  p_months     integer DEFAULT 6
)
RETURNS TABLE (month text, total numeric, load_count integer)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    to_char(date_trunc('month', date::date), 'YYYY-MM') AS month,
    COALESCE(SUM(rate), 0)                              AS total,
    COUNT(*)::integer                                    AS load_count
  FROM loads
  WHERE company_id = p_company_id
    AND date >= (CURRENT_DATE - (p_months || ' months')::interval)::text
  GROUP BY 1
  ORDER BY 1;
$$;
