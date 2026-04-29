-- ================================================================
-- Stripe Integration Columns
-- Run this in Supabase SQL Editor
--
-- Adds Stripe customer and subscription tracking to companies.
-- Both columns are nullable — rows without a Stripe customer
-- simply have NULL here and the deletion route skips Stripe cleanup.
-- ================================================================

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS stripe_customer_id      text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  text,
  ADD COLUMN IF NOT EXISTS stripe_price_id         text,
  ADD COLUMN IF NOT EXISTS subscription_status     text;
