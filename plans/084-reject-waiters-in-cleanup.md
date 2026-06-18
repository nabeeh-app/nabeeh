# Plan 084: Reject pending waitForReady waiters in _cleanupSocket

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

After an explicit `disconnect()` or `logout()`, any `waitForReady()` call in flight gets a misleading "Timeout waiting for WhatsApp socket to be ready" error instead of a clear "session was disconnected" rejection.

## Current state

- `backend/lib/baileys.js:233-249` — `_cleanupSocket()` clears timers, watchdog, and socket, but does not touch `_readyWaiters`.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244 pass            |

## Scope

**In scope**:
- `backend/lib/baileys.js` — add _rejectWaiters call in _cleanupSocket

**Out of scope**: No other files

## Steps

### Step 1: Add _rejectWaiters call in _cleanupSocket

If plan 083 created `_rejectWaiters`, call it at the end of `_cleanupSocket()`:

```js
_cleanupSocket() {
  // ... existing cleanup ...
  this._rejectWaiters(new Error('Session disconnected'));
}
```

If `_rejectWaiters` doesn't exist yet, inline the logic:

```js
for (const waiter of this._readyWaiters) {
  clearTimeout(waiter.timer);
  waiter.reject(new Error('Session disconnected'));
}
this._readyWaiters = [];
```

**Verify**: `cd backend && npm test` → 244 pass

## Done criteria

- [ ] `_cleanupSocket()` rejects all pending waiters with "Session disconnected"
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `_cleanupSocket` no longer exists
