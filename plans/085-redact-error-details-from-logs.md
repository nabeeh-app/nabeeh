# Plan 085: Redact Supabase error details from auth upsert logs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 52e1011..HEAD -- backend/lib/baileysAuthState.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `52e1011`, 2026-06-18

## Why this matters

The auth keys upsert error log includes `details: error.details`. Supabase PostgREST error details can contain the failing row data, constraint names, and column names. If logs are shipped to external aggregators, this constitutes a PII/credential exposure vector.

## Current state

- `backend/lib/baileysAuthState.js:161`:
  ```js
  logger.error('Auth keys batch upsert FAILED', { type, count: toUpsert.length, teacherId, error: error.message, code: error.code, details: error.details });
  ```

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244 pass            |

## Scope

**In scope**:
- `backend/lib/baileysAuthState.js` — remove `details` from log payload

**Out of scope**: No other files

## Steps

### Step 1: Remove details from log

In `backend/lib/baileysAuthState.js:161`, remove `details: error.details`:

```js
logger.error('Auth keys batch upsert FAILED', { type, count: toUpsert.length, teacherId, error: error.message, code: error.code });
```

**Verify**: `cd backend && npm test` → 244 pass

## Done criteria

- [ ] `error.details` is no longer logged
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If the log line no longer exists
