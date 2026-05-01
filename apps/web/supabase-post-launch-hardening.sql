-- ============================================================
-- Post-launch hardening migration
-- Run after go-live when you have a maintenance window.
-- Each section is independent — run in order; safe to re-run
-- (all statements use IF NOT EXISTS / OR REPLACE / idempotent).
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. updated_at auto-trigger
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['companies','drivers','loads','invoices','dispatches'] LOOP
    -- Add the column if it doesn't exist yet
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()',
      tbl
    );
    -- Attach the trigger (drop+create is idempotent)
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON %I', tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_set_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      tbl
    );
  END LOOP;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 2. Soft-delete columns
-- ────────────────────────────────────────────────────────────
ALTER TABLE loads       ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE invoices    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE dispatches  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Partial indexes so queries that filter deleted_at IS NULL stay fast
CREATE INDEX IF NOT EXISTS idx_loads_not_deleted
  ON loads (company_id, date) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_not_deleted
  ON invoices (company_id, status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_dispatches_not_deleted
  ON dispatches (company_id, dispatch_date) WHERE deleted_at IS NULL;


-- ────────────────────────────────────────────────────────────
-- 3. CHECK constraints
-- ────────────────────────────────────────────────────────────

-- Invoice total must be > 0
ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS chk_invoices_total_positive,
  ADD  CONSTRAINT chk_invoices_total_positive CHECK (total > 0);

-- Load rate must be >= 0
ALTER TABLE loads
  DROP CONSTRAINT IF EXISTS chk_loads_rate_nonneg,
  ADD  CONSTRAINT chk_loads_rate_nonneg CHECK (rate >= 0);

-- Valid invoice statuses
ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS chk_invoices_status,
  ADD  CONSTRAINT chk_invoices_status
    CHECK (status IN ('draft','sent','paid','overdue','partially_paid','void','disputed'));

-- Valid load/ticket statuses
ALTER TABLE loads
  DROP CONSTRAINT IF EXISTS chk_loads_status,
  ADD  CONSTRAINT chk_loads_status
    CHECK (status IN ('pending','approved','invoiced','paid','disputed'));

-- Valid dispatch statuses
ALTER TABLE dispatches
  DROP CONSTRAINT IF EXISTS chk_dispatches_status,
  ADD  CONSTRAINT chk_dispatches_status
    CHECK (status IN ('scheduled','in_progress','completed','cancelled'));

-- Valid subscription statuses
ALTER TABLE companies
  DROP CONSTRAINT IF EXISTS chk_companies_subscription_status,
  ADD  CONSTRAINT chk_companies_subscription_status
    CHECK (subscription_status IN (
      'trial','active','past_due','canceled','expired',
      'incomplete','incomplete_expired','paused'
    ));

-- Basic email format check on companies
ALTER TABLE companies
  DROP CONSTRAINT IF EXISTS chk_companies_email_format,
  ADD  CONSTRAINT chk_companies_email_format
    CHECK (email IS NULL OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');


-- ────────────────────────────────────────────────────────────
-- 4. Missing FK indexes (foreign key columns without indexes
--    cause sequential scans on child tables during deletes)
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_loads_company_id      ON loads      (company_id);
CREATE INDEX IF NOT EXISTS idx_loads_driver_id       ON loads      (driver_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id   ON invoices   (company_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_company_id ON dispatches (company_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_driver_id  ON dispatches (driver_id);
CREATE INDEX IF NOT EXISTS idx_drivers_company_id    ON drivers    (company_id);
CREATE INDEX IF NOT EXISTS idx_drivers_auth_user_id  ON drivers    (auth_user_id);

-- Activity feed — high-frequency insert; need fast lookup by company + time
CREATE INDEX IF NOT EXISTS idx_activity_feed_company_created
  ON activity_feed (company_id, created_at DESC);


-- ────────────────────────────────────────────────────────────
-- 5. stripe_subscription_id on companies
--    (used by account/delete to cancel without listing all subs)
-- ────────────────────────────────────────────────────────────
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- Backfill note: after running this migration, the Stripe webhook
-- handler already writes stripe_subscription_id on
-- checkout.session.completed and customer.subscription.updated.
-- Existing rows will be null until the next webhook fires; the
-- account/delete route already falls back to listing subs when null.
