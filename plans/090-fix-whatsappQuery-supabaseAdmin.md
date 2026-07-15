# Plan 090: Fix whatsappQuery.js to use supabaseAdmin client

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8ce4f6b..HEAD -- backend/lib/whatsappQuery.js backend/config/database.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `8ce4f6b`, 2026-06-18

## Why this matters

`whatsappQuery.js:1` imports the **anon** Supabase client (`supabase`) instead of `supabaseAdmin`. The WhatsApp bot runs as a system process with no authenticated user context — `auth.uid()` is `null` in all RLS policies. This means `getParentByPhone()` always returns `null`, and the bot sends marketing spam to every parent instead of answering their queries. Every other lib file (`baileysAuthState.js`, `sessionManager.js`, `auditLog.js`) correctly uses `supabaseAdmin`. This is a production-breaking bug.

## Current state

- `backend/lib/whatsappQuery.js` — line 1: `const { supabase } = require('../config/database');`
- `backend/config/database.js` — exports both `supabase` (anon, RLS-enforced) and `supabaseAdmin` (service_role, bypasses RLS)
- All queries in whatsappQuery.js use `supabase` (lines 8, 38, 69, 92, 118, 147, 187, 207)
- Convention: every other backend/lib file uses `supabaseAdmin` for system-level queries

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Tests     | `cd backend && npm test -- --testPathIgnorePatterns="real-db"` | 430+ pass, 0 fail |
| Lint      | `cd backend && npx eslint lib/whatsappQuery.js` | exit 0 |

## Scope

**In scope**:
- `backend/lib/whatsappQuery.js` — change import from `supabase` to `supabaseAdmin`, replace all usages
- `backend/routes/__tests__/whatsappQuery.spec.js` — update mock to match new import

**Out of scope**:
- `backend/config/database.js` — no changes needed
- Any other file that already uses `supabaseAdmin`

## Steps

### Step 1: Change import and all usages

In `backend/lib/whatsappQuery.js`:
- Line 1: Change `const { supabase } = require('../config/database');` to `const { supabaseAdmin } = require('../config/database');`
- Replace all occurrences of `supabase.` with `supabaseAdmin.` (lines 8, 38, 69, 92, 118, 147, 187, 207)

**Verify**: `cd backend && grep -n "supabase\." lib/whatsappQuery.js` → no matches (only `supabaseAdmin.`)

### Step 2: Update test mock

In `backend/routes/__tests__/whatsappQuery.spec.js`:
- Change the mock from `{ supabase: ... }` to `{ supabaseAdmin: ... }`
- Update all test references from `supabase.from` to `supabaseAdmin.from`

**Verify**: `cd backend && npx jest --testPathPatterns="whatsappQuery" --forceExit` → all pass

### Step 3: Run full test suite

**Verify**: `cd backend && npm test -- --testPathIgnorePatterns="real-db"` → all pass, 0 fail

## Done criteria

- [ ] `cd backend && npm test -- --testPathIgnorePatterns="real-db"` exits 0
- [ ] `grep -rn "{ supabase }" backend/lib/whatsappQuery.js` returns no matches
- [ ] `grep -rn "supabase\." backend/lib/whatsappQuery.js` returns no matches (only `supabaseAdmin.`)
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- The code at `whatsappQuery.js:1` doesn't match the excerpt (drift)
- A test fails after the import change that isn't related to the mock
- You discover any query in whatsappQuery.js that intentionally needs RLS enforcement (it shouldn't — the bot is a system process)

## Maintenance notes

- After this change, ALL backend lib files consistently use `supabaseAdmin`. If a future query needs user-scoped access, import `supabase` explicitly and document why.
- Reviewer should verify the test mock matches the real module's export shape.
