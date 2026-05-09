-- Payment tracking migration
-- Run this in the Supabase SQL editor

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_remaining numeric,
  ADD COLUMN IF NOT EXISTS overpaid_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_notes text;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'partial';

NOTIFY pgrst, 'reload schema';
