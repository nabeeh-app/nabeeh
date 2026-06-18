# Plan 054: Add dedup step to migration 016 before adding PK

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat HEAD -- database/migrations/016_fix_whatsapp_auth_keys_pk.sql`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6e6ee99`, 2026-06-18

## Why this matters

Migration 016 runs `ALTER TABLE whatsapp_auth_keys ADD PRIMARY KEY (type, id, teacher_id)` but doesn't check for duplicate rows first. If duplicate `(type, id, teacher_id)` tuples exist from the old single-teacher insert pattern, the migration fails and blocks deployment.

## Current state

- `database/migrations/016_fix_whatsapp_auth_keys_pk.sql:14`:
  ```sql
  ALTER TABLE whatsapp_auth_keys ADD PRIMARY KEY (type, id, teacher_id);
  ```
- No dedup step before this line.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 235 pass            |

## Scope

**In scope**:
- `database/migrations/016_fix_whatsapp_auth_keys_pk.sql` — add dedup CTE before PK constraint

**Out of scope**: No other files

## Steps

### Step 1: Add dedup step before the PK constraint

In `database/migrations/016_fix_whatsapp_auth_keys_pk.sql`, before line 14 (`ALTER TABLE whatsapp_auth_keys ADD PRIMARY KEY`), add:

```sql
-- 3. Deduplicate: keep only the newest row per (type, id, teacher_id)
DELETE FROM whatsapp_auth_keys
WHERE ctid NOT IN (
  SELECT MAX(ctid)
  FROM whatsapp_auth_keys
  GROUP BY type, id, teacher_id
);
```

The full file should become:

```sql
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
```

**Verify**: `cd backend && npm test` → 235 pass

## Done criteria

- [ ] Dedup step exists before PK constraint in migration 016
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If migration 016 has already been applied to production (check before running)
