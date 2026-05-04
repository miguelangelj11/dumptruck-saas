-- ================================================================
-- DumpTruckBoss — Performance Indexes + Profile Backfill
-- Run in Supabase SQL Editor.
-- Safe to re-run: all use CREATE INDEX IF NOT EXISTS.
-- ================================================================


-- ----------------------------------------------------------------
-- profiles — critical path: every authenticated request resolves
-- company via profiles.organization_id (PK lookup on id is free,
-- but we add organization_id index for reverse/admin queries)
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS profiles_organization_id_idx
  ON profiles (organization_id)
  WHERE organization_id IS NOT NULL;


-- ----------------------------------------------------------------
-- companies — owner lookup fallback
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS companies_owner_id_idx
  ON companies (owner_id);

CREATE INDEX IF NOT EXISTS companies_stripe_customer_id_idx
  ON companies (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;


-- ----------------------------------------------------------------
-- team_members — team member lookup fallback
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS team_members_user_id_idx
  ON team_members (user_id);

CREATE INDEX IF NOT EXISTS team_members_company_id_idx
  ON team_members (company_id);


-- ----------------------------------------------------------------
-- drivers — most-queried table per company
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS drivers_company_status_idx
  ON drivers (company_id, status);

CREATE INDEX IF NOT EXISTS drivers_auth_user_id_idx
  ON drivers (auth_user_id)
  WHERE auth_user_id IS NOT NULL;


-- ----------------------------------------------------------------
-- loads — high-volume table (tickets), filtered by date + status
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS loads_company_date_idx
  ON loads (company_id, date DESC);

CREATE INDEX IF NOT EXISTS loads_company_status_idx
  ON loads (company_id, status);

CREATE INDEX IF NOT EXISTS loads_dispatch_id_idx
  ON loads (dispatch_id)
  WHERE dispatch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS loads_driver_paid_idx
  ON loads (company_id, driver_paid)
  WHERE driver_paid = false;


-- ----------------------------------------------------------------
-- dispatches — queried by company + date
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS dispatches_company_date_idx
  ON dispatches (company_id, dispatch_date DESC);

CREATE INDEX IF NOT EXISTS dispatches_company_status_idx
  ON dispatches (company_id, status);


-- ----------------------------------------------------------------
-- invoices
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS invoices_company_status_idx
  ON invoices (company_id, status);

CREATE INDEX IF NOT EXISTS invoices_company_created_idx
  ON invoices (company_id, created_at DESC);


-- ----------------------------------------------------------------
-- invoice_line_items
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS invoice_line_items_invoice_id_idx
  ON invoice_line_items (invoice_id);


-- ----------------------------------------------------------------
-- load_tickets
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS load_tickets_load_id_idx
  ON load_tickets (load_id);

CREATE INDEX IF NOT EXISTS load_tickets_company_id_idx
  ON load_tickets (company_id);


-- ----------------------------------------------------------------
-- contractor_tickets
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS contractor_tickets_company_id_idx
  ON contractor_tickets (company_id);

CREATE INDEX IF NOT EXISTS contractor_tickets_contractor_id_idx
  ON contractor_tickets (contractor_id)
  WHERE contractor_id IS NOT NULL;


-- ----------------------------------------------------------------
-- activity_feed — already has compound index from table creation,
-- adding a partial index for recent-feed queries (limit 6)
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS activity_feed_company_created_idx
  ON activity_feed (company_id, created_at DESC);


-- ----------------------------------------------------------------
-- invitations
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS invitations_token_idx
  ON invitations (token);

CREATE INDEX IF NOT EXISTS invitations_email_idx
  ON invitations (email);

CREATE INDEX IF NOT EXISTS invitations_company_id_idx
  ON invitations (company_id);


-- ----------------------------------------------------------------
-- driver_payments
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS driver_payments_company_id_idx
  ON driver_payments (company_id);

CREATE INDEX IF NOT EXISTS driver_payments_driver_id_idx
  ON driver_payments (driver_id)
  WHERE driver_id IS NOT NULL;


-- ================================================================
-- BACKFILL profiles.organization_id for all existing company owners
-- Idempotent: ON CONFLICT DO UPDATE only sets if currently null
-- ================================================================
INSERT INTO profiles (id, organization_id)
SELECT owner_id, id
FROM companies
ON CONFLICT (id) DO UPDATE
  SET organization_id = EXCLUDED.organization_id
  WHERE profiles.organization_id IS NULL;


-- ================================================================
-- VERIFY: confirm every owner now has organization_id set
-- Should return 0 rows
-- ================================================================
SELECT c.owner_id, c.id AS company_id
FROM companies c
LEFT JOIN profiles p ON p.id = c.owner_id
WHERE p.organization_id IS NULL
   OR p.id IS NULL;
