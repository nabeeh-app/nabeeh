# Plan 089: Deduplicate sessionManager require in server.js

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 52e1011..HEAD -- backend/server.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `52e1011`, 2026-06-18

## Why this matters

`require('./lib/sessionManager')` appears 3 times in `server.js` (lines 110, 206, 217). Node caches modules so no functional issue, but it deviates from the file's import convention where all other modules are imported once at the top.

## Current state

- `backend/server.js:110` — inside health endpoint handler
- `backend/server.js:206` — inside listen callback
- `backend/server.js:217` — inside shutdown handler

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244 pass            |

## Scope

**In scope**:
- `backend/server.js` — move require to top-level import, use variable everywhere

**Out of scope**: No other files

## Steps

### Step 1: Add top-level import

At the top of `server.js` (with the other imports), add:

```js
const sessionManager = require('./lib/sessionManager');
```

### Step 2: Remove inline requires

Remove the 3 `const sessionManager = require('./lib/sessionManager');` lines inside the route handler, listen callback, and shutdown handler. Use the top-level variable instead.

**Verify**: `grep -n "require.*sessionManager" backend/server.js` → only 1 match (top-level)

**Verify**: `cd backend && npm test` → 244 pass

## Done criteria

- [ ] `sessionManager` is required once at the top of server.js
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If sessionManager is no longer used in server.js
