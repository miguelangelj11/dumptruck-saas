-- ================================================================
-- DumpTruckBoss — Missing Column Migrations
-- Safe to re-run: all use ADD COLUMN IF NOT EXISTS
-- Run in Supabase SQL Editor, then run: NOTIFY pgrst, 'reload schema';
-- ================================================================


-- ----------------------------------------------------------------
-- contractors
-- Form sends: name, address, phone, email, status, notes
-- ----------------------------------------------------------------
ALTER TABLE contractors
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS phone   text,
  ADD COLUMN IF NOT EXISTS email   text,
  ADD COLUMN IF NOT EXISTS status  text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS notes   text;


-- ----------------------------------------------------------------
-- client_companies
-- Settings page sends: name, address, company_id
-- ----------------------------------------------------------------
ALTER TABLE client_companies
  ADD COLUMN IF NOT EXISTS address text;


-- ----------------------------------------------------------------
-- companies
-- Settings page sends: name, address, phone, logo_url
-- Signup sends: plan, subscription_status, trial_started_at, trial_ends_at
-- Onboarding sets: onboarding_completed
-- ----------------------------------------------------------------
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS address              text,
  ADD COLUMN IF NOT EXISTS phone               text,
  ADD COLUMN IF NOT EXISTS logo_url            text,
  ADD COLUMN IF NOT EXISTS plan                text,
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS trial_started_at    timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at       timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_customer_id  text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;


-- ----------------------------------------------------------------
-- loads
-- Various pages send: source, driver_paid, driver_paid_date,
--   driver_payment_id, dispatch_id, submitted_by_driver, load_type
-- ----------------------------------------------------------------
ALTER TABLE loads
  ADD COLUMN IF NOT EXISTS source             text,
  ADD COLUMN IF NOT EXISTS load_type          text,
  ADD COLUMN IF NOT EXISTS driver_paid        boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS driver_paid_date   date,
  ADD COLUMN IF NOT EXISTS driver_payment_id  uuid,
  ADD COLUMN IF NOT EXISTS dispatch_id        uuid,
  ADD COLUMN IF NOT EXISTS submitted_by_driver boolean    NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rate_type          text,
  ADD COLUMN IF NOT EXISTS status             text        NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS notes              text;


-- ----------------------------------------------------------------
-- dispatches
-- dispatch/page.tsx sends: driver_id, driver_name, truck_number,
--   start_time, instructions, job_id, dispatch_type, subcontractor_id,
--   dispatch_date, status, loads_completed, updated_at
-- ----------------------------------------------------------------
ALTER TABLE dispatches
  ADD COLUMN IF NOT EXISTS driver_id        uuid,
  ADD COLUMN IF NOT EXISTS driver_name      text,
  ADD COLUMN IF NOT EXISTS truck_number     text,
  ADD COLUMN IF NOT EXISTS start_time       text,
  ADD COLUMN IF NOT EXISTS instructions     text,
  ADD COLUMN IF NOT EXISTS job_id           uuid,
  ADD COLUMN IF NOT EXISTS dispatch_type    text,
  ADD COLUMN IF NOT EXISTS subcontractor_id uuid,
  ADD COLUMN IF NOT EXISTS dispatch_date    date,
  ADD COLUMN IF NOT EXISTS status           text NOT NULL DEFAULT 'dispatched',
  ADD COLUMN IF NOT EXISTS loads_completed  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at       timestamptz;


-- ----------------------------------------------------------------
-- jobs
-- dispatch/page.tsx sends: job_name, contractor, location, material,
--   rate, rate_type, status, start_date, end_date, notes
-- ----------------------------------------------------------------
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS job_name   text,
  ADD COLUMN IF NOT EXISTS contractor text,
  ADD COLUMN IF NOT EXISTS location   text,
  ADD COLUMN IF NOT EXISTS material   text,
  ADD COLUMN IF NOT EXISTS rate       numeric,
  ADD COLUMN IF NOT EXISTS rate_type  text,
  ADD COLUMN IF NOT EXISTS status     text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date   date,
  ADD COLUMN IF NOT EXISTS notes      text;


-- ----------------------------------------------------------------
-- driver_payments
-- drivers/page.tsx sends: driver_id, driver_name, amount,
--   payment_date, payment_method, check_number, period_start,
--   period_end, notes
-- ----------------------------------------------------------------
ALTER TABLE driver_payments
  ADD COLUMN IF NOT EXISTS driver_id      uuid,
  ADD COLUMN IF NOT EXISTS driver_name    text,
  ADD COLUMN IF NOT EXISTS amount         numeric,
  ADD COLUMN IF NOT EXISTS payment_date   date,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS check_number   text,
  ADD COLUMN IF NOT EXISTS period_start   date,
  ADD COLUMN IF NOT EXISTS period_end     date,
  ADD COLUMN IF NOT EXISTS notes          text;


-- ----------------------------------------------------------------
-- drivers
-- onboarding/page.tsx sends: name, email, phone, status
-- ----------------------------------------------------------------
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS email  text,
  ADD COLUMN IF NOT EXISTS phone  text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';


-- ----------------------------------------------------------------
-- profiles
-- settings/page.tsx upserts: id, full_name
-- signup/page.tsx upserts: id, organization_id
-- auth/callback sets: organization_id (team invite path)
-- ----------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS full_name       text,
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS role            text;


-- ----------------------------------------------------------------
-- contractor_tickets
-- contractors/page.tsx sends: job_name, client_company, date,
--   hours_worked, material, rate, rate_type, status, notes, company_id
-- ----------------------------------------------------------------
ALTER TABLE contractor_tickets
  ADD COLUMN IF NOT EXISTS job_name       text,
  ADD COLUMN IF NOT EXISTS client_company text,
  ADD COLUMN IF NOT EXISTS date           date,
  ADD COLUMN IF NOT EXISTS hours_worked   text,
  ADD COLUMN IF NOT EXISTS material       text,
  ADD COLUMN IF NOT EXISTS rate           numeric,
  ADD COLUMN IF NOT EXISTS rate_type      text,
  ADD COLUMN IF NOT EXISTS status         text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS notes          text;


-- ----------------------------------------------------------------
-- contractor_ticket_slips
-- contractors/page.tsx sends: ticket_id, company_id, tonnage, image_url
-- ----------------------------------------------------------------
ALTER TABLE contractor_ticket_slips
  ADD COLUMN IF NOT EXISTS ticket_id uuid,
  ADD COLUMN IF NOT EXISTS tonnage   numeric,
  ADD COLUMN IF NOT EXISTS image_url text;


-- ----------------------------------------------------------------
-- load_tickets
-- tickets/new/page.tsx sends: load_id, company_id, ticket_number,
--   tonnage, image_url
-- ----------------------------------------------------------------
ALTER TABLE load_tickets
  ADD COLUMN IF NOT EXISTS load_id       uuid,
  ADD COLUMN IF NOT EXISTS ticket_number text,
  ADD COLUMN IF NOT EXISTS tonnage       numeric,
  ADD COLUMN IF NOT EXISTS image_url     text;


-- ----------------------------------------------------------------
-- invoices
-- invoices/page.tsx sends: id, company_id, invoice_number, invoice_type,
--   client_name, client_address, client_phone, client_email, total,
--   status, due_date, date_from, date_to, notes
-- ----------------------------------------------------------------
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS invoice_type   text,
  ADD COLUMN IF NOT EXISTS client_name    text,
  ADD COLUMN IF NOT EXISTS client_address text,
  ADD COLUMN IF NOT EXISTS client_phone   text,
  ADD COLUMN IF NOT EXISTS client_email   text,
  ADD COLUMN IF NOT EXISTS total          numeric     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status         text        NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS due_date       date,
  ADD COLUMN IF NOT EXISTS date_from      date,
  ADD COLUMN IF NOT EXISTS date_to        date,
  ADD COLUMN IF NOT EXISTS notes          text;


-- ----------------------------------------------------------------
-- invoice_line_items
-- invoices/page.tsx spreads previewItems which include: invoice_id,
--   date, truck_number, driver_name, material, location, ticket_number,
--   time_range, quantity, rate, rate_type, amount, photo_url
-- ----------------------------------------------------------------
ALTER TABLE invoice_line_items
  ADD COLUMN IF NOT EXISTS date          date,
  ADD COLUMN IF NOT EXISTS truck_number  text,
  ADD COLUMN IF NOT EXISTS driver_name   text,
  ADD COLUMN IF NOT EXISTS material      text,
  ADD COLUMN IF NOT EXISTS location      text,
  ADD COLUMN IF NOT EXISTS ticket_number text,
  ADD COLUMN IF NOT EXISTS time_range    text,
  ADD COLUMN IF NOT EXISTS quantity      numeric,
  ADD COLUMN IF NOT EXISTS rate          numeric,
  ADD COLUMN IF NOT EXISTS rate_type     text,
  ADD COLUMN IF NOT EXISTS amount        numeric,
  ADD COLUMN IF NOT EXISTS photo_url     text;


-- ----------------------------------------------------------------
-- payments
-- invoices/page.tsx sends: company_id, invoice_id, amount,
--   payment_date, payment_method, notes
-- ----------------------------------------------------------------
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS invoice_id      uuid,
  ADD COLUMN IF NOT EXISTS amount          numeric,
  ADD COLUMN IF NOT EXISTS payment_date    date,
  ADD COLUMN IF NOT EXISTS payment_method  text,
  ADD COLUMN IF NOT EXISTS notes           text;


-- ----------------------------------------------------------------
-- received_invoices
-- invoices/page.tsx sends: company_id, subcontractor_name,
--   their_invoice_number, amount, date_received, work_start_date,
--   work_end_date, notes, status, file_url
-- ----------------------------------------------------------------
ALTER TABLE received_invoices
  ADD COLUMN IF NOT EXISTS subcontractor_name    text,
  ADD COLUMN IF NOT EXISTS their_invoice_number  text,
  ADD COLUMN IF NOT EXISTS amount                numeric,
  ADD COLUMN IF NOT EXISTS date_received         date,
  ADD COLUMN IF NOT EXISTS work_start_date       date,
  ADD COLUMN IF NOT EXISTS work_end_date         date,
  ADD COLUMN IF NOT EXISTS notes                 text,
  ADD COLUMN IF NOT EXISTS status                text NOT NULL DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS file_url              text;


-- ----------------------------------------------------------------
-- Reload PostgREST schema cache so new columns are immediately visible
-- ----------------------------------------------------------------
NOTIFY pgrst, 'reload schema';


-- ----------------------------------------------------------------
-- Verify contractors columns (should now include address, notes, etc.)
-- ----------------------------------------------------------------
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'contractors'
ORDER BY ordinal_position;
