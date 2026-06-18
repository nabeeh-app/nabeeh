# Plan 072: Remove dead whatsappRouter wrapper in server.js

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

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `d760576`, 2026-06-18

## Why this matters

`server.js:33-34` creates a `whatsappRouter` wrapper that is never used — `whatsappRoutes` is mounted directly at line 191. Dead code that could confuse developers.

## Current state

- `backend/server.js:33-34`:
  ```js
  const whatsappRouter = express.Router();
  whatsappRouter.use(whatsappRoutes);
  ```
- `backend/server.js:191`: `app.use('/api/whatsapp', whatsappLimiter, whatsappRoutes)` — uses `whatsappRoutes`, not `whatsappRouter`

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244 pass            |

## Scope

**In scope**:
- `backend/server.js` — delete lines 33-34

**Out of scope**: No other files

## Steps

### Step 1: Delete the unused wrapper

Remove:
```js
const whatsappRouter = express.Router();
whatsappRouter.use(whatsappRoutes);
```

**Verify**: `cd backend && npm test` → 244 pass

## Done criteria

- [ ] `whatsappRouter` variable no longer exists in server.js
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `whatsappRouter` is used somewhere (grep first)
