# Plan 078: Fix supabaseAdminAdmin typo in send-to-number

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 52e1011..HEAD -- backend/routes/whatsapp.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `52e1011`, 2026-06-18

## Why this matters

Plan 071 renamed `supabase` to `supabaseAdmin` but introduced a typo `supabaseAdminAdmin` at 3 call sites in the `/send-to-number` handler. Every call to POST `/api/whatsapp/send-to-number` that finds a parent throws `ReferenceError: supabaseAdminAdmin is not defined`. The auto-pause-bot logic never executes.

## Current state

- `backend/routes/whatsapp.js:613` — `supabaseAdminAdmin.from('parents')`
- `backend/routes/whatsapp.js:615` — `supabaseAdminAdmin.from('conversations')`
- `backend/routes/whatsapp.js:619` — `supabaseAdminAdmin.from('conversations').update(...)`

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244 pass            |

## Scope

**In scope**:
- `backend/routes/whatsapp.js` — rename 3 occurrences

**Out of scope**: No other files

## Steps

### Step 1: Fix the typo

In `backend/routes/whatsapp.js`, replace all 3 occurrences of `supabaseAdminAdmin` with `supabaseAdmin`:

```
:%s/supabaseAdminAdmin/supabaseAdmin/g
```

**Verify**: `grep -n "supabaseAdminAdmin" backend/routes/whatsapp.js` → no matches

**Verify**: `cd backend && npm test` → 244 pass

## Done criteria

- [ ] `supabaseAdminAdmin` no longer exists in whatsapp.js
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `supabaseAdmin` import no longer exists at the top of whatsapp.js
