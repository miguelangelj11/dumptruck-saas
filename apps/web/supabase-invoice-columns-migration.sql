-- ================================================================
-- Invoice Settings Column Fix
-- Run this in Supabase SQL Editor
--
-- The original supabase-settings-migration.sql created columns with
-- different names than what the settings page code expects.
-- This migration adds the correctly-named columns and backfills
-- existing data from the old column names. Old columns are kept
-- so nothing else breaks.
--
-- Old name                      → New name (what the code uses)
-- invoice_number_prefix         → invoice_prefix
-- invoice_due_days              → default_due_days
-- invoice_notes                 → default_invoice_notes
-- invoice_payment_instructions  → default_payment_instructions
-- invoice_show_ticket_num       → invoice_show_ticket_number
-- ================================================================

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS invoice_prefix               text    DEFAULT 'INV-',
  ADD COLUMN IF NOT EXISTS default_due_days             integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS default_invoice_notes        text,
  ADD COLUMN IF NOT EXISTS default_payment_instructions text,
  ADD COLUMN IF NOT EXISTS invoice_show_ticket_number   boolean DEFAULT true;
