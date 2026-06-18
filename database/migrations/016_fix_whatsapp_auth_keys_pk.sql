-- Migration 016: Fix whatsapp_auth_keys primary key for multi-teacher isolation
-- The original PK was (type, id) which doesn't account for teacher_id
-- We need to drop the old PK and create a new unique constraint

-- 1. Drop existing primary key constraint
ALTER TABLE whatsapp_auth_keys DROP CONSTRAINT IF EXISTS whatsapp_auth_keys_pkey;

-- 2. Add NOT NULL constraint to teacher_id (was nullable from migration 015)
-- Use a default for existing rows before adding NOT NULL
UPDATE whatsapp_auth_keys SET teacher_id = '00000000-0000-0000-0000-000000000000' WHERE teacher_id IS NULL;
ALTER TABLE whatsapp_auth_keys ALTER COLUMN teacher_id SET NOT NULL;

-- 3. Deduplicate: keep only the newest row per (type, id, teacher_id)
DELETE FROM whatsapp_auth_keys
WHERE ctid NOT IN (
  SELECT MAX(ctid)
  FROM whatsapp_auth_keys
  GROUP BY type, id, teacher_id
);

-- 4. Create new primary key including teacher_id
ALTER TABLE whatsapp_auth_keys ADD PRIMARY KEY (type, id, teacher_id);

-- 5. Drop the old teacher_id index (now covered by PK)
DROP INDEX IF EXISTS idx_whatsapp_auth_keys_teacher;
