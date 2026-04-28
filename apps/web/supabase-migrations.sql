-- ============================================================
-- HaulFlow DB Migrations — run these in Supabase SQL Editor
-- ============================================================

-- 1. Add new columns to loads table
ALTER TABLE loads
  ADD COLUMN IF NOT EXISTS load_type      text,
  ADD COLUMN IF NOT EXISTS origin         text,
  ADD COLUMN IF NOT EXISTS destination    text,
  ADD COLUMN IF NOT EXISTS time_in        text,
  ADD COLUMN IF NOT EXISTS time_out       text;

-- 2. Update loads status to include approved / disputed
-- (if using an enum, alter it; if text, no change needed)
-- ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'approved';
-- ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'disputed';

-- 3. Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_name    text NOT NULL,
  contractor  text,
  location    text,
  material    text,
  rate        numeric,
  rate_type   text,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','on_hold')),
  start_date  date,
  end_date    date,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS for jobs
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs: company owns rows"
  ON jobs
  USING  (company_id = auth.uid())
  WITH CHECK (company_id = auth.uid());

-- 4. Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id      uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount          numeric NOT NULL,
  payment_date    date NOT NULL,
  payment_method  text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- RLS for payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments: company owns rows"
  ON payments
  USING  (company_id = auth.uid())
  WITH CHECK (company_id = auth.uid());

-- 5. Add partially_paid to invoices status (if using enum)
-- ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'partially_paid';

-- 6. Add ticket_number to load_tickets (if not already present)
ALTER TABLE load_tickets
  ADD COLUMN IF NOT EXISTS ticket_number text;

-- 7. Add address and phone to companies table
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS phone   text;
