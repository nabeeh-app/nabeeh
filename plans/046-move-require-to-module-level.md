# Plan 046: Move require() to module level in assistants.js

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6e6ee99..HEAD -- backend/routes/assistants.js`
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

`backend/routes/assistants.js:203` calls `require('../lib/sessionManager')` inside the route handler function body instead of at module top level. While Node.js caches `require()` calls so this works, it's inconsistent with every other file in the codebase which imports at module level. This inconsistency makes the code harder to scan and could mask circular dependency issues.

## Current state

- `backend/routes/assistants.js:203`:
  ```js
  const sessionManager = require('../lib/sessionManager');
  ```
  This is inside the `inviteAssistant` handler, not at module top.

- Other files (e.g., `whatsapp.js:4`) import at module level:
  ```js
  const sessionManager = require('../lib/sessionManager');
  ```

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 226 pass            |

## Scope

**In scope**:
- `backend/routes/assistants.js` — move require to top

**Out of scope**:
- No other files

## Steps

### Step 1: Add import at top of file

In `backend/routes/assistants.js`, after the existing imports (around line 10), add:

```js
const sessionManager = require('../lib/sessionManager');
```

### Step 2: Remove inline require

In `backend/routes/assistants.js:203`, remove:

```js
const sessionManager = require('../lib/sessionManager');
```

The line `const client = sessionManager.getSession(teacherId);` should now use the module-level import.

**Verify**: `cd backend && npm test` → 226 pass

## Test plan

- No new tests needed — this is a refactor with no behavior change.

## Done criteria

- [ ] `require('../lib/sessionManager')` appears only once, at module top level
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `assistants.js` no longer imports sessionManager
