# Plan 082: Add maxReconnectAttempts to prevent infinite reconnect loop

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
- **Category**: security
- **Planned at**: commit `52e1011`, 2026-06-18

## Why this matters

`scheduleReconnect()` increments `reconnectAttempts` indefinitely. If the WhatsApp account is permanently banned or the server rejects the session, the client retries every 30s forever — ~2880 connection attempts per day, hitting WhatsApp's servers and Supabase.

## Current state

- `backend/lib/baileys.js:192-206`:
  ```js
  scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    const delay = Math.min(2000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    this.reconnectAttempts++;
    logger.info('Scheduling reconnect', { delay, attempt: this.reconnectAttempts, teacherId: this.teacherId });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((error) => logger.error('Reconnection error', { teacherId: this.teacherId, error: error.message }));
    }, delay);
  }
  ```
- No `maxReconnectAttempts` constant exists in the file.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244 pass            |

## Scope

**In scope**:
- `backend/lib/baileys.js` — add maxReconnectAttempts constant and guard

**Out of scope**: No other files

## Steps

### Step 1: Add constant and guard

In `backend/lib/baileys.js`, add a constant near the top of the file (after imports):

```js
const MAX_RECONNECT_ATTEMPTS = 50;
```

In `scheduleReconnect()`, add a guard at the top:

```js
scheduleReconnect() {
  if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    logger.error('Max reconnect attempts reached, giving up', { teacherId: this.teacherId, attempts: this.reconnectAttempts });
    this.status = 'failed';
    this.emitStatus({ error: 'Max reconnect attempts reached' });
    return;
  }
  // ... existing code
}
```

**Verify**: `cd backend && npm test` → 244 pass

## Done criteria

- [ ] `scheduleReconnect()` stops after `MAX_RECONNECT_ATTEMPTS` (50)
- [ ] Status is set to `'failed'` when limit is reached
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `scheduleReconnect` no longer exists
