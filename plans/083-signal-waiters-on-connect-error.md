# Plan 083: Signal waitForReady waiters on connect() error

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 52e1011..HEAD -- backend/lib/baileys.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: correctness
- **Planned at**: commit `52e1011`, 2026-06-18

## Why this matters

When `connect()` throws, the catch block sets status to `'error'` and calls `scheduleReconnect()`, but does not reject pending `waitForReady()` waiters. Any caller waiting for readiness hangs until the 20s timeout fires with a generic "Timeout" error.

## Current state

- `backend/lib/baileys.js:108-115`:
  ```js
  } catch (error) {
    logger.error('Baileys connect error', { teacherId: this.teacherId, error: error.message });
    this.status = 'error';
    this.emitStatus({ error: error.message });
    this.scheduleReconnect();
  }
  ```
- `_readyWaiters` array exists (from plan 062) but is not touched in the error path.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244 pass            |

## Scope

**In scope**:
- `backend/lib/baileys.js` — add _rejectWaiters method, call in connect() catch

**Out of scope**: No other files

## Steps

### Step 1: Add _rejectWaiters method

```js
_rejectWaiters(error) {
  for (const waiter of this._readyWaiters) {
    clearTimeout(waiter.timer);
    waiter.reject(error);
  }
  this._readyWaiters = [];
}
```

### Step 2: Call in connect() catch block

In the catch block of `connect()`, after `this.emitStatus(...)`, add:

```js
this._rejectWaiters(error);
```

**Verify**: `cd backend && npm test` → 244 pass

## Done criteria

- [ ] `connect()` catch block rejects pending waiters immediately
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `connect()` or `_readyWaiters` no longer exist
