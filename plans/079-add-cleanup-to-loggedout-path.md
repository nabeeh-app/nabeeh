# Plan 079: Add _cleanupSocket to loggedOut disconnect path

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

When WhatsApp reports a `loggedOut` disconnect, `handleConnectionUpdate` calls `clearSession()` but never calls `_cleanupSocket()`. The dead socket remains referenced, its event listeners stay registered, and `this.sock` stays non-null. A late `creds.update` event on the stale socket could trigger stale callbacks.

## Current state

- `backend/lib/baileys.js:171-172`:
  ```js
  if (loggedOut) {
    await this.clearSession();
  }
  ```
  No `_cleanupSocket()` call. Compare to `disconnect()` (line 325) and `logout()` (line 355) which both call `_cleanupSocket()`.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244 pass            |

## Scope

**In scope**:
- `backend/lib/baileys.js` — add `_cleanupSocket()` call after `clearSession()` in loggedOut branch

**Out of scope**: No other files

## Steps

### Step 1: Add cleanup after clearSession

In `backend/lib/baileys.js`, in the `loggedOut` branch of `handleConnectionUpdate`, add `this._cleanupSocket()` after `this.clearSession()`:

```js
if (loggedOut) {
  await this.clearSession();
  this._cleanupSocket();
}
```

**Verify**: `cd backend && npm test` → 244 pass

## Done criteria

- [ ] `loggedOut` path calls `_cleanupSocket()` after `clearSession()`
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `_cleanupSocket` or `handleConnectionUpdate` no longer exist
