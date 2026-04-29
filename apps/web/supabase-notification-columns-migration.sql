-- ================================================================
-- Notification Settings Columns
-- Run this in Supabase SQL Editor
--
-- Adds all notification preference columns to the companies table.
-- Safe to run multiple times — IF NOT EXISTS prevents duplicates.
-- ================================================================

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS notification_email        text,
  ADD COLUMN IF NOT EXISTS notify_new_ticket         boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_ticket_approved    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_invoice_sent       boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_payment_received   boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_invoice_overdue    boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_document_expiring  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_missing_tickets    boolean DEFAULT true;
