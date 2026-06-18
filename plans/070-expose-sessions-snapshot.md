# Plan 070: Expose getSessionsSnapshot instead of raw .sessions Map

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d760576..HEAD -- backend/lib/sessionManager.js backend/server.js`
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

`server.js:115` reaches into `sessionManager.sessions.entries()` directly — a layering violation. Any change to session data structure breaks the admin endpoint.

## Current state

- `backend/server.js:115-121`:
  ```js
  const sessions = Array.from(sessionManager.sessions.entries()).map(([teacherId, session]) => ({
    teacherId,
    status: session.client.getStatus().status || 'disconnected',
    phone: session.client.getStatus().phone || null,
    lastActive: session.lastActive ? new Date(session.lastActive).toISOString() : null
  }));
  ```
- `backend/lib/sessionManager.js:254-266` — `getStatus()` already exists but returns different shape

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244 pass            |

## Scope

**In scope**:
- `backend/lib/sessionManager.js` — add `getSessionsSnapshot()` method
- `backend/server.js` — use the new method

**Out of scope**: No other files

## Steps

### Step 1: Add getSessionsSnapshot to sessionManager

```js
getSessionsSnapshot() {
  return Array.from(this.sessions.entries()).map(([teacherId, session]) => ({
    teacherId,
    status: session.client.getStatus().status || 'disconnected',
    phone: session.client.getStatus().phone || null,
    lastActive: session.lastActive ? new Date(session.lastActive).toISOString() : null
  }));
}
```

### Step 2: Update server.js to use it

Replace the inline iteration with:

```js
const sessions = sessionManager.getSessionsSnapshot();
```

**Verify**: `cd backend && npm test` → 244 pass

## Done criteria

- [ ] `server.js` no longer accesses `sessionManager.sessions` directly
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `sessionManager` no longer exists
