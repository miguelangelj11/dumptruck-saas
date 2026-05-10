-- Migration: Tier-aware onboarding step tracking
-- Run in Supabase SQL Editor before deploying the updated OnboardingChecklist

-- Per-step state: {"welcome":"completed","mobile_app":"skipped", ...}
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS onboarding_steps jsonb DEFAULT '{}';

-- Which tier's flow was loaded (for detecting plan upgrades mid-flow)
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS onboarding_tier text;
