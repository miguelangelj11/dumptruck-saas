-- Add the missing notes column to the trucks table.
-- Safe to run whether or not the column already exists.
ALTER TABLE trucks
  ADD COLUMN IF NOT EXISTS notes text;
