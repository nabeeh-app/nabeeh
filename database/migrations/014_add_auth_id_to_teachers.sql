-- Migration: Add auth_id column to teachers for OAuth account linking
-- The teachers.id references auth.users(id) and is used as the primary key.
-- When a user signs in via Google, the Supabase auth user ID may differ from
-- the existing teacher's ID (if they registered via email/password first).
-- auth_id stores the Supabase auth user ID for OAuth-linked accounts,
-- while teachers.id remains the stable application-level identifier.

-- Add auth_id column (nullable — email/password users don't need it)
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS auth_id UUID;

-- Unique constraint: one auth_id per teacher
ALTER TABLE teachers ADD CONSTRAINT teachers_auth_id_unique UNIQUE (auth_id);

-- Index for fast lookup during OAuth callback
CREATE INDEX IF NOT EXISTS idx_teachers_auth_id ON teachers(auth_id) WHERE auth_id IS NOT NULL;

-- Backfill: set auth_id = id for existing teachers (they already have auth users)
UPDATE teachers SET auth_id = id WHERE auth_id IS NULL;

-- Comment for clarity
COMMENT ON COLUMN teachers.auth_id IS 'Supabase auth.users ID for OAuth-linked accounts. Used to resolve teacher from OAuth tokens without modifying the primary key.';
