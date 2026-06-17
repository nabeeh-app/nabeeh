-- Fix assistant status CHECK constraints and add phone support

-- 1. Fix teacher_assistants.status CHECK constraint
ALTER TABLE teacher_assistants DROP CONSTRAINT IF EXISTS teacher_assistants_status_check;
ALTER TABLE teacher_assistants ADD CONSTRAINT teacher_assistants_status_check
  CHECK (status IN ('pending', 'active', 'inactive', 'deactivated', 'removed'));

-- 2. Add status column to assistant_invites (needed to track pending/used/expired)
ALTER TABLE assistant_invites ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'
  CHECK (status IN ('pending', 'used', 'expired', 'revoked'));

-- 3. Add phone column to assistant_invites
ALTER TABLE assistant_invites ADD COLUMN IF NOT EXISTS phone TEXT;

-- 4. Make email nullable (phone-only invites)
ALTER TABLE assistant_invites ALTER COLUMN email DROP NOT NULL;

-- 5. Add a constraint: at least one of email or phone must be set
ALTER TABLE assistant_invites ADD CONSTRAINT assistant_invites_contact_check
  CHECK (email IS NOT NULL OR phone IS NOT NULL);
