-- Dispatch status redesign: Dispatched → Accepted → Working → Completed
-- Run this in your Supabase SQL editor

ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS accepted_at   timestamptz;
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS first_ticket_at timestamptz;
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS completed_at  timestamptz;

-- Migrate existing status values to the new 4-step flow:
--   en_route  → accepted
--   on_site   → accepted
--   loading   → working
--   issue     → dispatched  (return to pending state)
UPDATE dispatches SET status = 'accepted' WHERE status IN ('en_route', 'on_site');
UPDATE dispatches SET status = 'working'  WHERE status = 'loading';
UPDATE dispatches SET status = 'dispatched' WHERE status = 'issue';
