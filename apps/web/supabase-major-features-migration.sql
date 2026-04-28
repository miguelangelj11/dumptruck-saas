-- Major features migration
-- Run this in your Supabase SQL editor

-- 1. Driver-submitted ticket source tracking
ALTER TABLE loads ADD COLUMN IF NOT EXISTS source text DEFAULT 'office';
-- Existing driver-submitted tickets get the 'driver' source
UPDATE loads SET source = 'driver' WHERE submitted_by_driver = true AND source IS NULL;

-- 2. Driver profile additions
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS phone                   text;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS emergency_contact_name  text;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS emergency_contact_phone text;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS license_expiry          date;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS medical_card_expiry     date;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS profile_photo_url       text;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS id_photo_url            text;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS truck_number            text;

-- 3. Company onboarding tracking
ALTER TABLE companies ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS onboarding_step      integer DEFAULT 1;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sidebar_items jsonb  DEFAULT '["dispatch","tickets","subcontractors","drivers","invoices","revenue","documents","payments"]';

-- Mark ALL existing companies as onboarded (they already have data).
-- Only brand-new signups will start with onboarding_completed = false.
UPDATE companies SET onboarding_completed = true;

-- 4. Subcontractor dispatching
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS subcontractor_id  uuid;
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS dispatch_type     text DEFAULT 'driver';
-- values: 'driver' | 'subcontractor'
