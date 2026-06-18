# Plan 050: Remove dead setupAllSessionHandlers function

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat HEAD -- backend/routes/whatsapp.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `6e6ee99`, 2026-06-18

## Why this matters

`setupAllSessionHandlers()` is defined but never called. Sessions restored from DB via `connectAll()` → `getOrCreateSession()` already emit `sessionCreated` which triggers handler setup. The dead function confuses future readers into thinking there's a gap in handler coverage.

## Current state

- `backend/routes/whatsapp.js:49-55`:
  ```js
  // Setup message handlers for existing sessions on module load
  // New sessions will be set up when created via session manager
  function setupAllSessionHandlers() {
    for (const [teacherId, session] of sessionManager.sessions) {
      setupSessionMessageHandler(teacherId, session.client);
    }
  }
  ```
- The function is never called anywhere.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 235 pass            |

## Scope

**In scope**:
- `backend/routes/whatsapp.js` — remove dead function and its comment

**Out of scope**: No other files

## Steps

### Step 1: Remove the dead function

In `backend/routes/whatsapp.js`, delete lines 49-55 (the comment and the function):

```js
// Setup message handlers for existing sessions on module load
// New sessions will be set up when created via session manager
function setupAllSessionHandlers() {
  for (const [teacherId, session] of sessionManager.sessions) {
    setupSessionMessageHandler(teacherId, session.client);
  }
}
```

**Verify**: `cd backend && npm test` → 235 pass

## Done criteria

- [ ] `setupAllSessionHandlers` does not exist in `whatsapp.js`
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `setupAllSessionHandlers` is called somewhere (check with grep before deleting)
