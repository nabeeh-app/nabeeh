# Plan 075: Fix duplicate getStatus() call in admin health endpoint

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d760576..HEAD -- backend/server.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `d760576`, 2026-06-18

## Why this matters

The admin health endpoint calls `session.client.getStatus()` twice per session — once for `status` and once for `phone`. Minor but unnecessary.

## Current state

- `backend/server.js:117-118` (after plan 070):
  ```js
  status: session.client.getStatus().status || 'disconnected',
  phone: session.client.getStatus().phone || null,
  ```

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244 pass            |

## Scope

**In scope**:
- `backend/lib/sessionManager.js` — `getSessionsSnapshot()` (if used) or `backend/server.js`

**Out of scope**: No other files

## Steps

### Step 1: Call getStatus() once and destructure

In `getSessionsSnapshot()` or the server.js inline code:

```js
const s = session.client.getStatus();
return {
  teacherId,
  status: s.status || 'disconnected',
  phone: s.phone || null,
  lastActive: ...
};
```

**Verify**: `cd backend && npm test` → 244 pass

## Done criteria

- [ ] `getStatus()` called once per session
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If the health endpoint no longer exists
