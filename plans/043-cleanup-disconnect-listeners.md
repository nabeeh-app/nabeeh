# Plan 043: Remove event listeners on BaileysClient disconnect

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6e6ee99..HEAD -- backend/lib/baileys.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6e6ee99`, 2026-06-18

## Why this matters

When `disconnect()` is called, it stops the socket but doesn't remove event listeners. If the same `BaileysClient` instance reconnects (via `connect()`), the old listeners from the previous socket are still attached to the EventEmitter. This causes:
1. Duplicate `connection.update` events
2. Duplicate `message` events → duplicate message processing
3. Memory leak from accumulated listeners

Compare: `connect()` at line 74-76 correctly calls `this.sock.removeAllListeners()`, but `disconnect()` at line 288-313 does not.

## Current state

- `backend/lib/baileys.js:288-313` — `disconnect()` method:
  ```js
  async disconnect() {
    try {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.clearQrExpiryTimer();
      this.stopWatchdog();
      if (this.sock) {
        if (typeof this.sock.end === 'function') {
          this.sock.end();
        }
        this.sock = null;
      }
      this.status = 'disconnected';
      this.reconnectAttempts = 0;
      this.emitStatus();
      return true;
    } catch (error) {
      logger.error('Disconnect error', { teacherId: this.teacherId, error: error.message });
      return false;
    }
  }
  ```
- `backend/lib/baileys.js:74-76` — `connect()` correctly removes listeners:
  ```js
  if (this.sock && typeof this.sock.removeAllListeners === 'function') {
    this.sock.removeAllListeners();
  }
  ```

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 226 pass            |

## Scope

**In scope**:
- `backend/lib/baileys.js` — add `removeAllListeners()` in `disconnect()`

**Out of scope**:
- No other files

## Steps

### Step 1: Add removeAllListeners before sock.end in disconnect()

In `backend/lib/baileys.js`, in the `disconnect()` method, add `removeAllListeners()` before calling `sock.end()`:

```js
      if (this.sock) {
        if (typeof this.sock.removeAllListeners === 'function') {
          this.sock.removeAllListeners();
        }
        if (typeof this.sock.end === 'function') {
          this.sock.end();
        }
        this.sock = null;
      }
```

**Verify**: `cd backend && npm test` → 226 pass

## Test plan

- No new tests needed — the fix mirrors the existing pattern in `connect()`. Verify by inspection that `disconnect()` now mirrors `connect()`'s cleanup.

## Done criteria

- [ ] `disconnect()` calls `this.sock.removeAllListeners()` before `this.sock.end()`
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `disconnect()` no longer exists or has been renamed
