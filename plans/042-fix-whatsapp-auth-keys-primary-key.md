# Plan 042: Fix whatsapp_auth_keys primary key for multi-teacher isolation

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6e6ee99..HEAD -- database/migrations/ backend/lib/baileysAuthState.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6e6ee99`, 2026-06-18

## Why this matters

The `whatsapp_auth_keys` table has `PRIMARY KEY (type, id)` (from migration 003). Migration 015 added `teacher_id` column but didn't alter the primary key. This means if two teachers have the same key type and ID (which Baileys can generate), the upsert at `baileysAuthState.js:119` with `onConflict: 'type,id'` will overwrite one teacher's keys with another's, breaking their WhatsApp session authentication.

## Current state

- `database/migrations/003_whatsapp_auth_state.sql:15`:
  ```sql
  PRIMARY KEY (type, id)
  ```
- `database/migrations/015_whatsapp_multi_session.sql` — adds `teacher_id` column but doesn't alter PK
- `backend/lib/baileysAuthState.js:119`:
  ```js
  .upsert(toUpsert, { onConflict: 'type,id' });
  ```

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 226 pass            |

## Scope

**In scope**:
- `database/migrations/016_fix_whatsapp_auth_keys_pk.sql` — new migration to alter PK
- `backend/lib/baileysAuthState.js` — update onConflict to include teacher_id

**Out of scope**:
- No changes to existing migrations (003, 015) — they're already applied

## Steps

### Step 1: Create migration to fix primary key

Create `database/migrations/016_fix_whatsapp_auth_keys_pk.sql`:

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

-- 3. Create new primary key including teacher_id
ALTER TABLE whatsapp_auth_keys ADD PRIMARY KEY (type, id, teacher_id);

-- 4. Drop the old teacher_id index (now covered by PK)
DROP INDEX IF EXISTS idx_whatsapp_auth_keys_teacher;
```

### Step 2: Update onConflict in baileysAuthState.js

In `backend/lib/baileysAuthState.js:119`, change:

```js
.upsert(toUpsert, { onConflict: 'type,id' });
```

To:

```js
.upsert(toUpsert, { onConflict: 'type,id,teacher_id' });
```

**Verify**: `cd backend && npm test` → 226 pass

## Test plan

- No new unit tests needed — this is a schema fix. Verify by:
  1. Running the migration against a test database
  2. Confirming two teachers can have different keys with the same type

## Done criteria

- [ ] `database/migrations/016_fix_whatsapp_auth_keys_pk.sql` exists
- [ ] `baileysAuthState.js:119` uses `onConflict: 'type,id,teacher_id'`
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `whatsapp_auth_keys` table no longer exists
- If the migration has already been applied (check `supabase_migrations` table)

## Maintenance notes

- After applying this migration, all existing auth keys will have `teacher_id = '00000000-0000-0000-0000-000000000000'` (the legacy default). This is intentional — those keys belong to the pre-multi-session default session.
- Teachers who re-pair after this migration will get proper teacher-scoped keys.
