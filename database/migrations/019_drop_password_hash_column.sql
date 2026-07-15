-- Drop password_hash column from teachers table.
-- This column was never defined in any migration — it's dead schema
-- from an earlier design where passwords were stored locally.
-- All auth now uses Supabase Auth (auth.users).
ALTER TABLE teachers DROP COLUMN IF EXISTS password_hash;
