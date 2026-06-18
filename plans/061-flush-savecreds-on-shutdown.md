# Plan 061: Flush saveCreds debounce timer on shutdown

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d760576..HEAD -- backend/lib/baileysAuthState.js backend/lib/baileys.js`
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

`saveCreds` debounces with a 3-second `setTimeout`. If the process shuts down within that window, pending credentials are never persisted. On restart, the teacher's session loads stale creds and may require re-pairing.

## Current state

- `backend/lib/baileysAuthState.js:151-188` — `saveCreds` wraps DB upsert in `setTimeout(..., 3000)`
- `backend/lib/baileys.js:288-316` — `disconnect()` calls `sock.end()` but never flushes pending saves
- `backend/lib/sessionManager.js:45-57` — `stop()` disconnects all clients in parallel without flushing

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244 pass            |

## Scope

**In scope**:
- `backend/lib/baileysAuthState.js` — export a `flush` function
- `backend/lib/baileys.js` — call flush before socket teardown
- `backend/lib/sessionManager.js` — call flush in `stop()`

**Out of scope**: No other files

## Steps

### Step 1: Export flushPendingSave from useSupabaseAuthState

In `backend/lib/baileysAuthState.js`, after the `saveCreds` function definition, add a `flushPendingSave` function and return it:

```js
flushPendingSave: () => {
  if (saveCredsTimer) {
    clearTimeout(saveCredsTimer);
    saveCredsTimer = null;
    // Trigger save immediately
    // (copy the saveCreds body here, or extract to a shared _persistCreds function)
  }
}
```

Better approach: extract the DB upsert logic into a `_persistCreds` async function, call it from both `saveCreds` (inside the setTimeout) and `flushPendingSave`.

### Step 2: Expose flush on BaileysClient

In `backend/lib/baileys.js`, add a method that delegates to the auth state's flush. Store the `flushPendingSave` reference from `useSupabaseAuthState` on the client instance.

### Step 3: Call flush in disconnect() and logout()

Before `this.sock.end()` in both `disconnect()` and `logout()`, call `await this._flushPendingSave()`.

### Step 4: Call flush in sessionManager.stop()

In `backend/lib/sessionManager.js`, in the `stop()` method, await flush on each client before disconnecting.

**Verify**: `cd backend && npm test` → 244 pass

## Done criteria

- [ ] Pending `saveCreds` is flushed before socket teardown
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `saveCreds` no longer exists in the auth state
