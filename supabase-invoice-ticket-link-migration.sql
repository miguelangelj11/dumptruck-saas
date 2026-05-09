-- Migration: Link tickets to invoices for auto-paid cascade
-- Run this in the Supabase SQL editor before deploying the code changes.

ALTER TABLE loads
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL;

ALTER TABLE contractor_tickets
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_loads_invoice_id ON loads(invoice_id);
CREATE INDEX IF NOT EXISTS idx_contractor_tickets_invoice_id ON contractor_tickets(invoice_id);
