# Plan 047: Filter connectAll by status to skip explicitly disconnected sessions

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6e6ee99..HEAD -- backend/lib/sessionManager.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6e6ee99`, 2026-06-18

## Why this matters

`connectAll()` queries `whatsapp_sessions` and tries to reconnect ALL rows, including sessions that were explicitly disconnected by admin (status = 'disconnected'). This means if an admin disconnects a teacher's session (e.g., for policy violation), the session auto-reconnects on next server restart.

## Current state

- `backend/lib/sessionManager.js:177-208`:
  ```js
  async connectAll() {
    const { data: dbSessions, error } = await supabaseAdmin
      .from('whatsapp_sessions')
      .select('teacher_id, status');
    // ... tries to connect all
  }
  ```
  No filter on `status` — reconnects everything.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 226 pass            |

## Scope

**In scope**:
- `backend/lib/sessionManager.js` — add status filter to query

**Out of scope**:
- No other files

## Steps

### Step 1: Filter query to only reconnect sessions that were connected

In `backend/lib/sessionManager.js`, change the query in `connectAll()`:

```js
const { data: dbSessions, error } = await supabaseAdmin
  .from('whatsapp_sessions')
  .select('teacher_id, status')
  .in('status', ['connected', 'error']);
```

This skips sessions with status `disconnected` (explicitly disconnected) and `qr_pending`/`pairing` (incomplete pairing). Sessions with status `error` are included because they may have failed due to transient issues and should retry.

**Verify**: `cd backend && npm test` → 226 pass

## Test plan

- No new tests needed — the query change is straightforward. Verify by reading the code that only `connected` and `error` sessions are restored.

## Done criteria

- [ ] `connectAll()` queries with `.in('status', ['connected', 'error'])`
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `connectAll()` no longer exists or has been renamed
