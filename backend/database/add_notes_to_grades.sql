-- Add notes column to grades table if it doesn't exist
ALTER TABLE grades ADD COLUMN IF NOT EXISTS notes TEXT;
