# Plan 080: Ensure disconnect() cleanup runs even if flush throws

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

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `52e1011`, 2026-06-18

## Why this matters

`disconnect()` awaits `_flushPendingSave()` inside the same try block as `_cleanupSocket()`. If the flush throws (e.g., Supabase unreachable), the catch returns `false` without ever reaching `_cleanupSocket()`. The socket, its timers, and watchdog all remain active.

## Current state

- `backend/lib/baileys.js:319-335`:
  ```js
  async disconnect() {
    try {
      if (this._flushPendingSave) {
        await this._flushPendingSave();
      }
      this._cleanupSocket();
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

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244 pass            |

## Scope

**In scope**:
- `backend/lib/baileys.js` — restructure disconnect() so cleanup always runs

**Out of scope**: No other files

## Steps

### Step 1: Move _cleanupSocket to a finally block

Restructure `disconnect()` so `_cleanupSocket()` always runs:

```js
async disconnect() {
  try {
    if (this._flushPendingSave) {
      await this._flushPendingSave();
    }
    return true;
  } catch (error) {
    logger.error('Disconnect flush error', { teacherId: this.teacherId, error: error.message });
    return false;
  } finally {
    this._cleanupSocket();
    this.status = 'disconnected';
    this.reconnectAttempts = 0;
    this.emitStatus();
  }
}
```

**Verify**: `cd backend && npm test` → 244 pass

## Done criteria

- [ ] `_cleanupSocket()` runs in `finally` block — always executes
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `disconnect()` no longer exists
