# Plan 073: Extract shared _cleanupSocket helper from disconnect/logout

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

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `d760576`, 2026-06-18

## Why this matters

`disconnect()` and `logout()` share ~80% of their logic (clear timers, stop watchdog, remove listeners, end socket, null sock, reset status). Any fix to cleanup must be applied in two places.

## Current state

- `backend/lib/baileys.js:288-316` (disconnect) vs `backend/lib/baileys.js:322-354` (logout)
- Both do: clear reconnect timer, clear QR timer, stop watchdog, removeAllListeners, sock.end, null sock, reset status, emitStatus

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244 pass            |

## Scope

**In scope**:
- `backend/lib/baileys.js` — extract `_cleanupSocket()`, refactor both methods

**Out of scope**: No other files

## Steps

### Step 1: Create _cleanupSocket method

```js
_cleanupSocket() {
  if (this.reconnectTimer) {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }
  this.clearQrExpiryTimer();
  this.stopWatchdog();
  if (this.sock) {
    if (typeof this.sock.removeAllListeners === 'function') {
      this.sock.removeAllListeners();
    }
    if (typeof this.sock.end === 'function') {
      this.sock.end();
    }
    this.sock = null;
  }
}
```

### Step 2: Refactor disconnect() and logout()

`disconnect()` becomes: call `_cleanupSocket()`, set status, reset attempts, emit.

`logout()` becomes: call `sock.logout()` (try/catch), then `_cleanupSocket()`, then `clearSession()`, set status, emit.

**Verify**: `cd backend && npm test` → 244 pass

## Done criteria

- [ ] `_cleanupSocket` exists and is called from both `disconnect()` and `logout()`
- [ ] No duplicated cleanup logic between the two methods
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `disconnect()` or `logout()` no longer exist
