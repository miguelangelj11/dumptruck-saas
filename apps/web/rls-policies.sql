-- ================================================================
-- DumpTruckBoss — Full RLS Audit & Fix
-- Run this entire script in Supabase SQL Editor
--
-- KEY: company_id columns store companies.id (a UUID), NOT auth.uid()
--      Always use my_company_id() helper, never raw auth.uid() for
--      tables that FK into companies.id
-- ================================================================

-- ----------------------------------------------------------------
-- HELPER FUNCTION
-- Returns companies.id for the current authenticated user.
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
-- owner_id = auth.uid()  (direct user reference — correct as-is)
-- ================================================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companies: owner can read"   ON companies;
DROP POLICY IF EXISTS "companies: owner can insert" ON companies;
DROP POLICY IF EXISTS "companies: owner can update" ON companies;
DROP POLICY IF EXISTS "companies: owner can delete" ON companies;
DROP POLICY IF EXISTS "companies: owner owns rows"  ON companies;
DROP POLICY IF EXISTS "companies: select"           ON companies;
DROP POLICY IF EXISTS "companies: insert"           ON companies;
DROP POLICY IF EXISTS "companies: update"           ON companies;
DROP POLICY IF EXISTS "companies: delete"           ON companies;

CREATE POLICY "companies: select" ON companies FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "companies: insert" ON companies FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "companies: update" ON companies FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "companies: delete" ON companies FOR DELETE USING (owner_id = auth.uid());


-- ================================================================
-- 2. PROFILES
-- id = auth.uid()  (one profile per auth user)
-- ================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles: select" ON profiles;
DROP POLICY IF EXISTS "profiles: insert" ON profiles;
DROP POLICY IF EXISTS "profiles: update" ON profiles;
DROP POLICY IF EXISTS "profiles: delete" ON profiles;

CREATE POLICY "profiles: select" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles: insert" ON profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles: update" ON profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles: delete" ON profiles FOR DELETE USING (id = auth.uid());


-- ================================================================
-- 3. DRIVERS
-- company_id FK → companies.id
-- ================================================================
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drivers: company owns rows" ON drivers;
DROP POLICY IF EXISTS "drivers: select"            ON drivers;
DROP POLICY IF EXISTS "drivers: insert"            ON drivers;
DROP POLICY IF EXISTS "drivers: update"            ON drivers;
DROP POLICY IF EXISTS "drivers: delete"            ON drivers;

CREATE POLICY "drivers: select" ON drivers FOR SELECT USING (company_id = my_company_id());
CREATE POLICY "drivers: insert" ON drivers FOR INSERT WITH CHECK (company_id = my_company_id());
CREATE POLICY "drivers: update" ON drivers FOR UPDATE USING (company_id = my_company_id()) WITH CHECK (company_id = my_company_id());
CREATE POLICY "drivers: delete" ON drivers FOR DELETE USING (company_id = my_company_id());


-- ================================================================
-- 4. TRUCKS
-- company_id FK → companies.id
-- ================================================================
ALTER TABLE trucks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trucks: select" ON trucks;
DROP POLICY IF EXISTS "trucks: insert" ON trucks;
DROP POLICY IF EXISTS "trucks: update" ON trucks;
DROP POLICY IF EXISTS "trucks: delete" ON trucks;

CREATE POLICY "trucks: select" ON trucks FOR SELECT USING (company_id = my_company_id());
CREATE POLICY "trucks: insert" ON trucks FOR INSERT WITH CHECK (company_id = my_company_id());
CREATE POLICY "trucks: update" ON trucks FOR UPDATE USING (company_id = my_company_id()) WITH CHECK (company_id = my_company_id());
CREATE POLICY "trucks: delete" ON trucks FOR DELETE USING (company_id = my_company_id());


-- ================================================================
-- 5. LOADS (tickets)
-- company_id FK → companies.id  (was wrongly using auth.uid())
-- ================================================================
ALTER TABLE loads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loads: company owns rows" ON loads;
DROP POLICY IF EXISTS "loads: select"            ON loads;
DROP POLICY IF EXISTS "loads: insert"            ON loads;
DROP POLICY IF EXISTS "loads: update"            ON loads;
DROP POLICY IF EXISTS "loads: delete"            ON loads;

CREATE POLICY "loads: select" ON loads FOR SELECT USING (company_id = my_company_id());
CREATE POLICY "loads: insert" ON loads FOR INSERT WITH CHECK (company_id = my_company_id());
CREATE POLICY "loads: update" ON loads FOR UPDATE USING (company_id = my_company_id()) WITH CHECK (company_id = my_company_id());
CREATE POLICY "loads: delete" ON loads FOR DELETE USING (company_id = my_company_id());


-- ================================================================
-- 6. LOAD_TICKETS (slip photos)
-- company_id FK → companies.id  (was wrongly using auth.uid())
-- ================================================================
ALTER TABLE load_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "load_tickets: company owns rows" ON load_tickets;
DROP POLICY IF EXISTS "load_tickets: select"            ON load_tickets;
DROP POLICY IF EXISTS "load_tickets: insert"            ON load_tickets;
DROP POLICY IF EXISTS "load_tickets: update"            ON load_tickets;
DROP POLICY IF EXISTS "load_tickets: delete"            ON load_tickets;

CREATE POLICY "load_tickets: select" ON load_tickets FOR SELECT USING (company_id = my_company_id());
CREATE POLICY "load_tickets: insert" ON load_tickets FOR INSERT WITH CHECK (company_id = my_company_id());
CREATE POLICY "load_tickets: update" ON load_tickets FOR UPDATE USING (company_id = my_company_id()) WITH CHECK (company_id = my_company_id());
CREATE POLICY "load_tickets: delete" ON load_tickets FOR DELETE USING (company_id = my_company_id());


-- ================================================================
-- 7. DISPATCHES
-- company_id FK → companies.id
-- ================================================================
ALTER TABLE dispatches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dispatches: select" ON dispatches;
DROP POLICY IF EXISTS "dispatches: insert" ON dispatches;
DROP POLICY IF EXISTS "dispatches: update" ON dispatches;
DROP POLICY IF EXISTS "dispatches: delete" ON dispatches;

CREATE POLICY "dispatches: select" ON dispatches FOR SELECT USING (company_id = my_company_id());
CREATE POLICY "dispatches: insert" ON dispatches FOR INSERT WITH CHECK (company_id = my_company_id());
CREATE POLICY "dispatches: update" ON dispatches FOR UPDATE USING (company_id = my_company_id()) WITH CHECK (company_id = my_company_id());
CREATE POLICY "dispatches: delete" ON dispatches FOR DELETE USING (company_id = my_company_id());


-- ================================================================
-- 8. CONTRACTORS
-- company_id FK → companies.id  (was wrongly using auth.uid())
-- ================================================================
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contractors: company owns rows" ON contractors;
DROP POLICY IF EXISTS "contractors: select"            ON contractors;
DROP POLICY IF EXISTS "contractors: insert"            ON contractors;
DROP POLICY IF EXISTS "contractors: update"            ON contractors;
DROP POLICY IF EXISTS "contractors: delete"            ON contractors;

CREATE POLICY "contractors: select" ON contractors FOR SELECT USING (company_id = my_company_id());
CREATE POLICY "contractors: insert" ON contractors FOR INSERT WITH CHECK (company_id = my_company_id());
CREATE POLICY "contractors: update" ON contractors FOR UPDATE USING (company_id = my_company_id()) WITH CHECK (company_id = my_company_id());
CREATE POLICY "contractors: delete" ON contractors FOR DELETE USING (company_id = my_company_id());


-- ================================================================
-- 9. CONTRACTOR_TICKETS
-- company_id FK → companies.id  (was wrongly using auth.uid())
-- ================================================================
ALTER TABLE contractor_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contractor_tickets: company owns rows" ON contractor_tickets;
DROP POLICY IF EXISTS "contractor_tickets: select"            ON contractor_tickets;
DROP POLICY IF EXISTS "contractor_tickets: insert"            ON contractor_tickets;
DROP POLICY IF EXISTS "contractor_tickets: update"            ON contractor_tickets;
DROP POLICY IF EXISTS "contractor_tickets: delete"            ON contractor_tickets;

CREATE POLICY "contractor_tickets: select" ON contractor_tickets FOR SELECT USING (company_id = my_company_id());
CREATE POLICY "contractor_tickets: insert" ON contractor_tickets FOR INSERT WITH CHECK (company_id = my_company_id());
CREATE POLICY "contractor_tickets: update" ON contractor_tickets FOR UPDATE USING (company_id = my_company_id()) WITH CHECK (company_id = my_company_id());
CREATE POLICY "contractor_tickets: delete" ON contractor_tickets FOR DELETE USING (company_id = my_company_id());


-- ================================================================
-- 10. CONTRACTOR_TICKET_SLIPS
-- company_id FK → companies.id  (was wrongly using auth.uid())
-- ================================================================
ALTER TABLE contractor_ticket_slips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contractor_ticket_slips: company owns rows" ON contractor_ticket_slips;
DROP POLICY IF EXISTS "contractor_ticket_slips: select"            ON contractor_ticket_slips;
DROP POLICY IF EXISTS "contractor_ticket_slips: insert"            ON contractor_ticket_slips;
DROP POLICY IF EXISTS "contractor_ticket_slips: update"            ON contractor_ticket_slips;
DROP POLICY IF EXISTS "contractor_ticket_slips: delete"            ON contractor_ticket_slips;

CREATE POLICY "contractor_ticket_slips: select" ON contractor_ticket_slips FOR SELECT USING (company_id = my_company_id());
CREATE POLICY "contractor_ticket_slips: insert" ON contractor_ticket_slips FOR INSERT WITH CHECK (company_id = my_company_id());
CREATE POLICY "contractor_ticket_slips: update" ON contractor_ticket_slips FOR UPDATE USING (company_id = my_company_id()) WITH CHECK (company_id = my_company_id());
CREATE POLICY "contractor_ticket_slips: delete" ON contractor_ticket_slips FOR DELETE USING (company_id = my_company_id());


-- ================================================================
-- 11. JOBS
-- company_id FK → companies.id  (was wrongly using auth.uid())
-- ================================================================
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jobs: company owns rows" ON jobs;
DROP POLICY IF EXISTS "jobs: select"            ON jobs;
DROP POLICY IF EXISTS "jobs: insert"            ON jobs;
DROP POLICY IF EXISTS "jobs: update"            ON jobs;
DROP POLICY IF EXISTS "jobs: delete"            ON jobs;

CREATE POLICY "jobs: select" ON jobs FOR SELECT USING (company_id = my_company_id());
CREATE POLICY "jobs: insert" ON jobs FOR INSERT WITH CHECK (company_id = my_company_id());
CREATE POLICY "jobs: update" ON jobs FOR UPDATE USING (company_id = my_company_id()) WITH CHECK (company_id = my_company_id());
CREATE POLICY "jobs: delete" ON jobs FOR DELETE USING (company_id = my_company_id());


-- ================================================================
-- 12. CLIENT_COMPANIES
-- company_id FK → companies.id
-- ================================================================
ALTER TABLE client_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_companies: select" ON client_companies;
DROP POLICY IF EXISTS "client_companies: insert" ON client_companies;
DROP POLICY IF EXISTS "client_companies: update" ON client_companies;
DROP POLICY IF EXISTS "client_companies: delete" ON client_companies;

CREATE POLICY "client_companies: select" ON client_companies FOR SELECT USING (company_id = my_company_id());
CREATE POLICY "client_companies: insert" ON client_companies FOR INSERT WITH CHECK (company_id = my_company_id());
CREATE POLICY "client_companies: update" ON client_companies FOR UPDATE USING (company_id = my_company_id()) WITH CHECK (company_id = my_company_id());
CREATE POLICY "client_companies: delete" ON client_companies FOR DELETE USING (company_id = my_company_id());


-- ================================================================
-- 13. INVOICES
-- company_id FK → companies.id  (was wrongly using auth.uid())
-- ================================================================
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices: company owns rows" ON invoices;
DROP POLICY IF EXISTS "invoices: select"            ON invoices;
DROP POLICY IF EXISTS "invoices: insert"            ON invoices;
DROP POLICY IF EXISTS "invoices: update"            ON invoices;
DROP POLICY IF EXISTS "invoices: delete"            ON invoices;

CREATE POLICY "invoices: select" ON invoices FOR SELECT USING (company_id = my_company_id());
CREATE POLICY "invoices: insert" ON invoices FOR INSERT WITH CHECK (company_id = my_company_id());
CREATE POLICY "invoices: update" ON invoices FOR UPDATE USING (company_id = my_company_id()) WITH CHECK (company_id = my_company_id());
CREATE POLICY "invoices: delete" ON invoices FOR DELETE USING (company_id = my_company_id());


-- ================================================================
-- 14. INVOICE_LINE_ITEMS
-- No company_id — access via parent invoice
-- (also fixes subquery to use my_company_id())
-- ================================================================
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_line_items: company owns rows" ON invoice_line_items;
DROP POLICY IF EXISTS "invoice_line_items: select"            ON invoice_line_items;
DROP POLICY IF EXISTS "invoice_line_items: insert"            ON invoice_line_items;
DROP POLICY IF EXISTS "invoice_line_items: update"            ON invoice_line_items;
DROP POLICY IF EXISTS "invoice_line_items: delete"            ON invoice_line_items;

CREATE POLICY "invoice_line_items: select" ON invoice_line_items FOR SELECT
  USING (invoice_id IN (SELECT id FROM invoices WHERE company_id = my_company_id()));

CREATE POLICY "invoice_line_items: insert" ON invoice_line_items FOR INSERT
  WITH CHECK (invoice_id IN (SELECT id FROM invoices WHERE company_id = my_company_id()));

CREATE POLICY "invoice_line_items: update" ON invoice_line_items FOR UPDATE
  USING (invoice_id IN (SELECT id FROM invoices WHERE company_id = my_company_id()));

CREATE POLICY "invoice_line_items: delete" ON invoice_line_items FOR DELETE
  USING (invoice_id IN (SELECT id FROM invoices WHERE company_id = my_company_id()));


-- ================================================================
-- 15. RECEIVED_INVOICES
-- company_id FK → companies.id
-- ================================================================
ALTER TABLE received_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "received_invoices: select" ON received_invoices;
DROP POLICY IF EXISTS "received_invoices: insert" ON received_invoices;
DROP POLICY IF EXISTS "received_invoices: update" ON received_invoices;
DROP POLICY IF EXISTS "received_invoices: delete" ON received_invoices;

CREATE POLICY "received_invoices: select" ON received_invoices FOR SELECT USING (company_id = my_company_id());
CREATE POLICY "received_invoices: insert" ON received_invoices FOR INSERT WITH CHECK (company_id = my_company_id());
CREATE POLICY "received_invoices: update" ON received_invoices FOR UPDATE USING (company_id = my_company_id()) WITH CHECK (company_id = my_company_id());
CREATE POLICY "received_invoices: delete" ON received_invoices FOR DELETE USING (company_id = my_company_id());


-- ================================================================
-- 16. PAYMENTS
-- company_id FK → companies.id  (was wrongly using auth.uid())
-- ================================================================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments: company owns rows" ON payments;
DROP POLICY IF EXISTS "payments: select"            ON payments;
DROP POLICY IF EXISTS "payments: insert"            ON payments;
DROP POLICY IF EXISTS "payments: update"            ON payments;
DROP POLICY IF EXISTS "payments: delete"            ON payments;

CREATE POLICY "payments: select" ON payments FOR SELECT USING (company_id = my_company_id());
CREATE POLICY "payments: insert" ON payments FOR INSERT WITH CHECK (company_id = my_company_id());
CREATE POLICY "payments: update" ON payments FOR UPDATE USING (company_id = my_company_id()) WITH CHECK (company_id = my_company_id());
CREATE POLICY "payments: delete" ON payments FOR DELETE USING (company_id = my_company_id());


-- ================================================================
-- 17. DRIVER_PAYMENTS
-- company_id FK → companies.id
-- ================================================================
ALTER TABLE driver_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "driver_payments: select" ON driver_payments;
DROP POLICY IF EXISTS "driver_payments: insert" ON driver_payments;
DROP POLICY IF EXISTS "driver_payments: update" ON driver_payments;
DROP POLICY IF EXISTS "driver_payments: delete" ON driver_payments;

CREATE POLICY "driver_payments: select" ON driver_payments FOR SELECT USING (company_id = my_company_id());
CREATE POLICY "driver_payments: insert" ON driver_payments FOR INSERT WITH CHECK (company_id = my_company_id());
CREATE POLICY "driver_payments: update" ON driver_payments FOR UPDATE USING (company_id = my_company_id()) WITH CHECK (company_id = my_company_id());
CREATE POLICY "driver_payments: delete" ON driver_payments FOR DELETE USING (company_id = my_company_id());


-- ================================================================
-- 18. EXPENSES
-- company_id FK → companies.id  (was wrongly using auth.uid())
-- ================================================================
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses: company owns rows" ON expenses;
DROP POLICY IF EXISTS "expenses: select"            ON expenses;
DROP POLICY IF EXISTS "expenses: insert"            ON expenses;
DROP POLICY IF EXISTS "expenses: update"            ON expenses;
DROP POLICY IF EXISTS "expenses: delete"            ON expenses;

CREATE POLICY "expenses: select" ON expenses FOR SELECT USING (company_id = my_company_id());
CREATE POLICY "expenses: insert" ON expenses FOR INSERT WITH CHECK (company_id = my_company_id());
CREATE POLICY "expenses: update" ON expenses FOR UPDATE USING (company_id = my_company_id()) WITH CHECK (company_id = my_company_id());
CREATE POLICY "expenses: delete" ON expenses FOR DELETE USING (company_id = my_company_id());


-- ================================================================
-- 19. ACTIVITY_FEED
-- company_id FK → companies.id
-- ================================================================
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_feed: select" ON activity_feed;
DROP POLICY IF EXISTS "activity_feed: insert" ON activity_feed;
DROP POLICY IF EXISTS "activity_feed: update" ON activity_feed;
DROP POLICY IF EXISTS "activity_feed: delete" ON activity_feed;

CREATE POLICY "activity_feed: select" ON activity_feed FOR SELECT USING (company_id = my_company_id());
CREATE POLICY "activity_feed: insert" ON activity_feed FOR INSERT WITH CHECK (company_id = my_company_id());
CREATE POLICY "activity_feed: update" ON activity_feed FOR UPDATE USING (company_id = my_company_id()) WITH CHECK (company_id = my_company_id());
CREATE POLICY "activity_feed: delete" ON activity_feed FOR DELETE USING (company_id = my_company_id());


-- ================================================================
-- 20. TEAM_MEMBERS
-- company_id FK → companies.id
-- Both the company owner AND the invited user can read their own row.
-- ================================================================
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_members: select" ON team_members;
DROP POLICY IF EXISTS "team_members: insert" ON team_members;
DROP POLICY IF EXISTS "team_members: update" ON team_members;
DROP POLICY IF EXISTS "team_members: delete" ON team_members;

-- Owner sees all members; member sees their own row
CREATE POLICY "team_members: select" ON team_members FOR SELECT
  USING (company_id = my_company_id() OR user_id = auth.uid());

-- Only the owner can add/remove/update members
CREATE POLICY "team_members: insert" ON team_members FOR INSERT
  WITH CHECK (company_id = my_company_id());

CREATE POLICY "team_members: update" ON team_members FOR UPDATE
  USING (company_id = my_company_id()) WITH CHECK (company_id = my_company_id());

CREATE POLICY "team_members: delete" ON team_members FOR DELETE
  USING (company_id = my_company_id());


-- ================================================================
-- 21. INVITATIONS
-- company_id FK → companies.id
-- Invited user (matched by email) can also read their pending invite.
-- ================================================================
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invitations: select" ON invitations;
DROP POLICY IF EXISTS "invitations: insert" ON invitations;
DROP POLICY IF EXISTS "invitations: update" ON invitations;
DROP POLICY IF EXISTS "invitations: delete" ON invitations;

-- Owner sees all invites; invitee can read by matching their auth email
CREATE POLICY "invitations: select" ON invitations FOR SELECT
  USING (
    company_id = my_company_id()
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "invitations: insert" ON invitations FOR INSERT
  WITH CHECK (company_id = my_company_id());

CREATE POLICY "invitations: update" ON invitations FOR UPDATE
  USING (company_id = my_company_id()) WITH CHECK (company_id = my_company_id());

CREATE POLICY "invitations: delete" ON invitations FOR DELETE
  USING (company_id = my_company_id());


-- ================================================================
-- CREATE TABLE: activity_feed (if not exists)
-- Columns inferred from application code in lib/workflows.ts
-- ================================================================
CREATE TABLE IF NOT EXISTS activity_feed (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type         text NOT NULL,
  message      text NOT NULL,
  related_id   text,
  related_type text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_feed_company_id_idx ON activity_feed (company_id);
CREATE INDEX IF NOT EXISTS activity_feed_created_at_idx ON activity_feed (created_at DESC);

ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_feed: select" ON activity_feed;
DROP POLICY IF EXISTS "activity_feed: insert" ON activity_feed;
DROP POLICY IF EXISTS "activity_feed: update" ON activity_feed;
DROP POLICY IF EXISTS "activity_feed: delete" ON activity_feed;

CREATE POLICY "activity_feed: select" ON activity_feed FOR SELECT USING (company_id = my_company_id());
CREATE POLICY "activity_feed: insert" ON activity_feed FOR INSERT WITH CHECK (company_id = my_company_id());
CREATE POLICY "activity_feed: update" ON activity_feed FOR UPDATE USING (company_id = my_company_id()) WITH CHECK (company_id = my_company_id());
CREATE POLICY "activity_feed: delete" ON activity_feed FOR DELETE USING (company_id = my_company_id());


-- ================================================================
-- AUDIT: tables with no RLS policies (run after applying above)
-- Any table that appears here still needs policies added.
-- ================================================================
SELECT t.tablename
FROM pg_tables t
WHERE t.schemaname = 'public'
AND NOT EXISTS (
  SELECT 1 FROM pg_policies p
  WHERE p.schemaname = 'public'
  AND p.tablename = t.tablename
);


-- ================================================================
-- ORPHAN CHECK
-- Returns any auth users who have no company row
-- ================================================================
SELECT u.id, u.email, u.created_at AS signed_up
FROM auth.users u
LEFT JOIN companies c ON c.owner_id = u.id
WHERE c.id IS NULL;
