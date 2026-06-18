# Plan 063: Schedule reconnect when connect() throws

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d760576..HEAD -- backend/lib/baileys.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `d760576`, 2026-06-18

## Why this matters

If `connect()` throws (e.g., Supabase auth state fetch fails), the session is stuck in `'error'` state permanently with no automatic recovery path. Teachers must wait for server restart or manual intervention.

## Current state

- `backend/lib/baileys.js:95-102`:
  ```js
  } catch (error) {
    logger.error('Baileys connect error', { teacherId: this.teacherId, error: error.message });
    this.status = 'error';
    this.emitStatus({ error: error.message });
    throw error;
  }
  ```

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244 pass            |

## Scope

**In scope**:
- `backend/lib/baileys.js` — add `scheduleReconnect()` in catch block

**Out of scope**: No other files

## Steps

### Step 1: Add scheduleReconnect after error status

In `backend/lib/baileys.js`, in the `catch` block of `connect()`, after `this.emitStatus({ error: error.message })`, add:

```js
this.scheduleReconnect();
```

Remove the `throw error;` line — the reconnect loop handles recovery. If the error is fatal (e.g., invalid credentials), the reconnect will fail again and back off exponentially until the teacher re-pairs.

**Verify**: `cd backend && npm test` → 244 pass

## Done criteria

- [ ] `connect()` catch block schedules reconnect instead of leaving session stuck
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `connect()` or `scheduleReconnect` no longer exist
