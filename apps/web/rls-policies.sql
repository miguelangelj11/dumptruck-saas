-- ================================================================
-- HaulFlow — Full RLS Audit & Fix
-- Run this entire script in Supabase SQL Editor
-- ================================================================

-- ----------------------------------------------------------------
-- HELPER FUNCTION
-- Returns the companies.id for the current auth user.
-- Used for tables where company_id FK → companies.id (e.g. drivers)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM companies WHERE owner_id = auth.uid() LIMIT 1;
$$;


-- ================================================================
-- 1. COMPANIES
-- owner_id = auth.uid()
-- ================================================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companies: owner can read"   ON companies;
DROP POLICY IF EXISTS "companies: owner can insert" ON companies;
DROP POLICY IF EXISTS "companies: owner can update" ON companies;
DROP POLICY IF EXISTS "companies: owner can delete" ON companies;
DROP POLICY IF EXISTS "companies: owner owns rows"  ON companies;

CREATE POLICY "companies: select" ON companies FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "companies: insert" ON companies FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "companies: update" ON companies FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "companies: delete" ON companies FOR DELETE USING (owner_id = auth.uid());


-- ================================================================
-- 2. DRIVERS
-- company_id FK → companies.id  (uses helper function)
-- ================================================================
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drivers: company owns rows"  ON drivers;
DROP POLICY IF EXISTS "drivers: select"             ON drivers;
DROP POLICY IF EXISTS "drivers: insert"             ON drivers;
DROP POLICY IF EXISTS "drivers: update"             ON drivers;
DROP POLICY IF EXISTS "drivers: delete"             ON drivers;

CREATE POLICY "drivers: select" ON drivers FOR SELECT USING (company_id = my_company_id());
CREATE POLICY "drivers: insert" ON drivers FOR INSERT WITH CHECK (company_id = my_company_id());
CREATE POLICY "drivers: update" ON drivers FOR UPDATE USING (company_id = my_company_id()) WITH CHECK (company_id = my_company_id());
CREATE POLICY "drivers: delete" ON drivers FOR DELETE USING (company_id = my_company_id());


-- ================================================================
-- 3. LOADS (tickets)
-- company_id = auth.uid() directly
-- ================================================================
ALTER TABLE loads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loads: company owns rows" ON loads;
DROP POLICY IF EXISTS "loads: select"            ON loads;
DROP POLICY IF EXISTS "loads: insert"            ON loads;
DROP POLICY IF EXISTS "loads: update"            ON loads;
DROP POLICY IF EXISTS "loads: delete"            ON loads;

CREATE POLICY "loads: select" ON loads FOR SELECT USING (company_id = auth.uid());
CREATE POLICY "loads: insert" ON loads FOR INSERT WITH CHECK (company_id = auth.uid());
CREATE POLICY "loads: update" ON loads FOR UPDATE USING (company_id = auth.uid()) WITH CHECK (company_id = auth.uid());
CREATE POLICY "loads: delete" ON loads FOR DELETE USING (company_id = auth.uid());


-- ================================================================
-- 4. LOAD_TICKETS (slip photos)
-- company_id = auth.uid() directly
-- ================================================================
ALTER TABLE load_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "load_tickets: company owns rows" ON load_tickets;
DROP POLICY IF EXISTS "load_tickets: select"            ON load_tickets;
DROP POLICY IF EXISTS "load_tickets: insert"            ON load_tickets;
DROP POLICY IF EXISTS "load_tickets: update"            ON load_tickets;
DROP POLICY IF EXISTS "load_tickets: delete"            ON load_tickets;

CREATE POLICY "load_tickets: select" ON load_tickets FOR SELECT USING (company_id = auth.uid());
CREATE POLICY "load_tickets: insert" ON load_tickets FOR INSERT WITH CHECK (company_id = auth.uid());
CREATE POLICY "load_tickets: update" ON load_tickets FOR UPDATE USING (company_id = auth.uid()) WITH CHECK (company_id = auth.uid());
CREATE POLICY "load_tickets: delete" ON load_tickets FOR DELETE USING (company_id = auth.uid());


-- ================================================================
-- 5. CONTRACTORS
-- ================================================================
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contractors: company owns rows" ON contractors;
DROP POLICY IF EXISTS "contractors: select"            ON contractors;
DROP POLICY IF EXISTS "contractors: insert"            ON contractors;
DROP POLICY IF EXISTS "contractors: update"            ON contractors;
DROP POLICY IF EXISTS "contractors: delete"            ON contractors;

CREATE POLICY "contractors: select" ON contractors FOR SELECT USING (company_id = auth.uid());
CREATE POLICY "contractors: insert" ON contractors FOR INSERT WITH CHECK (company_id = auth.uid());
CREATE POLICY "contractors: update" ON contractors FOR UPDATE USING (company_id = auth.uid()) WITH CHECK (company_id = auth.uid());
CREATE POLICY "contractors: delete" ON contractors FOR DELETE USING (company_id = auth.uid());


-- ================================================================
-- 6. CONTRACTOR_TICKETS
-- ================================================================
ALTER TABLE contractor_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contractor_tickets: company owns rows" ON contractor_tickets;
DROP POLICY IF EXISTS "contractor_tickets: select"            ON contractor_tickets;
DROP POLICY IF EXISTS "contractor_tickets: insert"            ON contractor_tickets;
DROP POLICY IF EXISTS "contractor_tickets: update"            ON contractor_tickets;
DROP POLICY IF EXISTS "contractor_tickets: delete"            ON contractor_tickets;

CREATE POLICY "contractor_tickets: select" ON contractor_tickets FOR SELECT USING (company_id = auth.uid());
CREATE POLICY "contractor_tickets: insert" ON contractor_tickets FOR INSERT WITH CHECK (company_id = auth.uid());
CREATE POLICY "contractor_tickets: update" ON contractor_tickets FOR UPDATE USING (company_id = auth.uid()) WITH CHECK (company_id = auth.uid());
CREATE POLICY "contractor_tickets: delete" ON contractor_tickets FOR DELETE USING (company_id = auth.uid());


-- ================================================================
-- 7. CONTRACTOR_TICKET_SLIPS
-- ================================================================
ALTER TABLE contractor_ticket_slips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contractor_ticket_slips: company owns rows" ON contractor_ticket_slips;
DROP POLICY IF EXISTS "contractor_ticket_slips: select"            ON contractor_ticket_slips;
DROP POLICY IF EXISTS "contractor_ticket_slips: insert"            ON contractor_ticket_slips;
DROP POLICY IF EXISTS "contractor_ticket_slips: update"            ON contractor_ticket_slips;
DROP POLICY IF EXISTS "contractor_ticket_slips: delete"            ON contractor_ticket_slips;

CREATE POLICY "contractor_ticket_slips: select" ON contractor_ticket_slips FOR SELECT USING (company_id = auth.uid());
CREATE POLICY "contractor_ticket_slips: insert" ON contractor_ticket_slips FOR INSERT WITH CHECK (company_id = auth.uid());
CREATE POLICY "contractor_ticket_slips: update" ON contractor_ticket_slips FOR UPDATE USING (company_id = auth.uid()) WITH CHECK (company_id = auth.uid());
CREATE POLICY "contractor_ticket_slips: delete" ON contractor_ticket_slips FOR DELETE USING (company_id = auth.uid());


-- ================================================================
-- 8. INVOICES
-- ================================================================
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices: company owns rows" ON invoices;
DROP POLICY IF EXISTS "invoices: select"            ON invoices;
DROP POLICY IF EXISTS "invoices: insert"            ON invoices;
DROP POLICY IF EXISTS "invoices: update"            ON invoices;
DROP POLICY IF EXISTS "invoices: delete"            ON invoices;

CREATE POLICY "invoices: select" ON invoices FOR SELECT USING (company_id = auth.uid());
CREATE POLICY "invoices: insert" ON invoices FOR INSERT WITH CHECK (company_id = auth.uid());
CREATE POLICY "invoices: update" ON invoices FOR UPDATE USING (company_id = auth.uid()) WITH CHECK (company_id = auth.uid());
CREATE POLICY "invoices: delete" ON invoices FOR DELETE USING (company_id = auth.uid());


-- ================================================================
-- 9. INVOICE_LINE_ITEMS
-- No company_id — access controlled via parent invoice
-- ================================================================
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_line_items: company owns rows" ON invoice_line_items;
DROP POLICY IF EXISTS "invoice_line_items: select"            ON invoice_line_items;
DROP POLICY IF EXISTS "invoice_line_items: insert"            ON invoice_line_items;
DROP POLICY IF EXISTS "invoice_line_items: update"            ON invoice_line_items;
DROP POLICY IF EXISTS "invoice_line_items: delete"            ON invoice_line_items;

CREATE POLICY "invoice_line_items: select" ON invoice_line_items FOR SELECT
  USING (invoice_id IN (SELECT id FROM invoices WHERE company_id = auth.uid()));

CREATE POLICY "invoice_line_items: insert" ON invoice_line_items FOR INSERT
  WITH CHECK (invoice_id IN (SELECT id FROM invoices WHERE company_id = auth.uid()));

CREATE POLICY "invoice_line_items: update" ON invoice_line_items FOR UPDATE
  USING (invoice_id IN (SELECT id FROM invoices WHERE company_id = auth.uid()));

CREATE POLICY "invoice_line_items: delete" ON invoice_line_items FOR DELETE
  USING (invoice_id IN (SELECT id FROM invoices WHERE company_id = auth.uid()));


-- ================================================================
-- 10. PAYMENTS
-- ================================================================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments: company owns rows" ON payments;
DROP POLICY IF EXISTS "payments: select"            ON payments;
DROP POLICY IF EXISTS "payments: insert"            ON payments;
DROP POLICY IF EXISTS "payments: update"            ON payments;
DROP POLICY IF EXISTS "payments: delete"            ON payments;

CREATE POLICY "payments: select" ON payments FOR SELECT USING (company_id = auth.uid());
CREATE POLICY "payments: insert" ON payments FOR INSERT WITH CHECK (company_id = auth.uid());
CREATE POLICY "payments: update" ON payments FOR UPDATE USING (company_id = auth.uid()) WITH CHECK (company_id = auth.uid());
CREATE POLICY "payments: delete" ON payments FOR DELETE USING (company_id = auth.uid());


-- ================================================================
-- 11. EXPENSES
-- ================================================================
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses: company owns rows" ON expenses;
DROP POLICY IF EXISTS "expenses: select"            ON expenses;
DROP POLICY IF EXISTS "expenses: insert"            ON expenses;
DROP POLICY IF EXISTS "expenses: update"            ON expenses;
DROP POLICY IF EXISTS "expenses: delete"            ON expenses;

CREATE POLICY "expenses: select" ON expenses FOR SELECT USING (company_id = auth.uid());
CREATE POLICY "expenses: insert" ON expenses FOR INSERT WITH CHECK (company_id = auth.uid());
CREATE POLICY "expenses: update" ON expenses FOR UPDATE USING (company_id = auth.uid()) WITH CHECK (company_id = auth.uid());
CREATE POLICY "expenses: delete" ON expenses FOR DELETE USING (company_id = auth.uid());


-- ================================================================
-- 12. JOBS
-- ================================================================
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jobs: company owns rows" ON jobs;
DROP POLICY IF EXISTS "jobs: select"            ON jobs;
DROP POLICY IF EXISTS "jobs: insert"            ON jobs;
DROP POLICY IF EXISTS "jobs: update"            ON jobs;
DROP POLICY IF EXISTS "jobs: delete"            ON jobs;

CREATE POLICY "jobs: select" ON jobs FOR SELECT USING (company_id = auth.uid());
CREATE POLICY "jobs: insert" ON jobs FOR INSERT WITH CHECK (company_id = auth.uid());
CREATE POLICY "jobs: update" ON jobs FOR UPDATE USING (company_id = auth.uid()) WITH CHECK (company_id = auth.uid());
CREATE POLICY "jobs: delete" ON jobs FOR DELETE USING (company_id = auth.uid());


-- ================================================================
-- ORPHAN CHECK
-- Returns any auth users who have no company row
-- ================================================================
SELECT u.id, u.email, u.created_at AS signed_up
FROM auth.users u
LEFT JOIN companies c ON c.owner_id = u.id
WHERE c.id IS NULL;
