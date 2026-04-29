-- ================================================================
-- Storage Bucket RLS Policies — Company Logos
-- Run this entire script in Supabase SQL Editor
--
-- Fixes: "new row violates row-level security policy" on logo upload
--
-- Two buckets are used:
--   company-logos  → settings page  (apps/web/app/dashboard/settings/page.tsx)
--   company-assets → onboarding page (apps/web/app/onboarding/page.tsx)
--
-- File path format: {companyId}/logo.{ext}
-- The first path segment is always the companies.id UUID.
-- ================================================================


-- ----------------------------------------------------------------
-- 0. Ensure logo_url column exists on companies
-- ----------------------------------------------------------------
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url text;


-- ----------------------------------------------------------------
-- 1. Create buckets (idempotent — safe to re-run)
--    Buckets must be public so logo URLs work without signed URLs
--    in the sidebar, invoices, and PDF exports.
-- ----------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;


-- ================================================================
-- 2. Policies for: company-logos
--    Used by: settings page logo upload
-- ================================================================

DROP POLICY IF EXISTS "company-logos: public read"  ON storage.objects;
DROP POLICY IF EXISTS "company-logos: owner insert" ON storage.objects;
DROP POLICY IF EXISTS "company-logos: owner update" ON storage.objects;
DROP POLICY IF EXISTS "company-logos: owner delete" ON storage.objects;

-- Anyone can view logos (needed for invoices, sidebar, PDFs)
CREATE POLICY "company-logos: public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-logos');

-- Authenticated owner can upload their company's logo
CREATE POLICY "company-logos: owner insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'company-logos'
  AND split_part(name, '/', 1) = (
    SELECT id::text FROM companies WHERE owner_id = auth.uid() LIMIT 1
  )
);

-- Authenticated owner can overwrite their company's logo
CREATE POLICY "company-logos: owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'company-logos'
  AND split_part(name, '/', 1) = (
    SELECT id::text FROM companies WHERE owner_id = auth.uid() LIMIT 1
  )
);

-- Authenticated owner can delete their company's logo
CREATE POLICY "company-logos: owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'company-logos'
  AND split_part(name, '/', 1) = (
    SELECT id::text FROM companies WHERE owner_id = auth.uid() LIMIT 1
  )
);


-- ================================================================
-- 3. Policies for: company-assets
--    Used by: onboarding step 2 logo upload
-- ================================================================

DROP POLICY IF EXISTS "company-assets: public read"  ON storage.objects;
DROP POLICY IF EXISTS "company-assets: owner insert" ON storage.objects;
DROP POLICY IF EXISTS "company-assets: owner update" ON storage.objects;
DROP POLICY IF EXISTS "company-assets: owner delete" ON storage.objects;

-- Anyone can view assets (same reason as above)
CREATE POLICY "company-assets: public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-assets');

-- Authenticated owner can upload to their company folder
CREATE POLICY "company-assets: owner insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'company-assets'
  AND split_part(name, '/', 1) = (
    SELECT id::text FROM companies WHERE owner_id = auth.uid() LIMIT 1
  )
);

-- Authenticated owner can overwrite files in their company folder
CREATE POLICY "company-assets: owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'company-assets'
  AND split_part(name, '/', 1) = (
    SELECT id::text FROM companies WHERE owner_id = auth.uid() LIMIT 1
  )
);

-- Authenticated owner can delete files in their company folder
CREATE POLICY "company-assets: owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'company-assets'
  AND split_part(name, '/', 1) = (
    SELECT id::text FROM companies WHERE owner_id = auth.uid() LIMIT 1
  )
);
