# Plan 066: Cancel pending saveCreds before clearSession deletes rows

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

- **Priority**: P2
- **Effort**: S
- **Risk**: MED
- **Depends on**: 061
- **Category**: tech-debt
- **Planned at**: commit `d760576`, 2026-06-18

## Why this matters

If `clearSession()` fires while a debounced `saveCreds` is pending, the timer writes credentials back to the DB after they were deleted. After logout, stale credentials could reappear, allowing a zombie session to reconnect on next server start.

## Current state

- `backend/lib/baileysAuthState.js:152` — debounce timer with 3s delay
- `backend/lib/baileys.js:227-238` — `clearSession` deletes rows from DB

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244 pass            |

## Scope

**In scope**:
- `backend/lib/baileysAuthState.js` — export `cancelPendingSave`
- `backend/lib/baileys.js` — call cancel before clearSession

**Out of scope**: No other files

## Steps

### Step 1: Export cancelPendingSave from useSupabaseAuthState

In `backend/lib/baileysAuthState.js`, add to the return object:

```js
cancelPendingSave: () => {
  if (saveCredsTimer) {
    clearTimeout(saveCredsTimer);
    saveCredsTimer = null;
  }
}
```

### Step 2: Store and call cancelPendingSave in clearSession

In `backend/lib/baileys.js`, in the `connect()` method where `useSupabaseAuthState` is destructured, also capture `cancelPendingSave`. Store it as `this._cancelPendingSave`.

In `clearSession()`, call `this._cancelPendingSave?.()` before the DB deletes.

**Verify**: `cd backend && npm test` → 244 pass

## Done criteria

- [ ] Pending `saveCreds` is cancelled before `clearSession` deletes rows
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `clearSession` or `useSupabaseAuthState` no longer exist
