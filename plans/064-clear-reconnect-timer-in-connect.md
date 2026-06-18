# Plan 064: Clear pending reconnect timer before reconnecting

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

If a reconnect timer is pending and `connect()` is called directly (e.g., `restartRequired` path in `handleConnectionUpdate`), both the scheduled timer and the new `connect()` call proceed. The timer fires later and calls `connect()` a third time.

## Current state

- `backend/lib/baileys.js:66-67`:
  ```js
  async connect() {
    if (this.isInitializing) return;
    this.isInitializing = true;
  ```
  No reconnect timer cleanup at the top of `connect()`.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244 pass            |

## Scope

**In scope**:
- `backend/lib/baileys.js` — add timer cleanup at top of `connect()`

**Out of scope**: No other files

## Steps

### Step 1: Clear reconnect timer at the top of connect()

In `backend/lib/baileys.js`, add this before the `if (this.isInitializing)` check:

```js
if (this.reconnectTimer) {
  clearTimeout(this.reconnectTimer);
  this.reconnectTimer = null;
}
```

**Verify**: `cd backend && npm test` → 244 pass

## Done criteria

- [ ] `connect()` clears any pending reconnect timer
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `connect()` no longer exists
