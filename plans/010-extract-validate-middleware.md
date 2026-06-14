# Plan 010: Extract duplicated validate() middleware to shared module

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6f7019f..HEAD -- backend/routes/alerts.js backend/routes/notifications.js backend/routes/reports.js backend/routes/gradeAnalysis.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `6f7019f`, 2026-06-14

## Why this matters

The `validate()` function is copy-pasted identically in 5 route files. Any improvement (e.g., adding request ID injection, changing error format) must be patched in 5 places. Drift is guaranteed.

## Current state

Identical `validate()` function at:
- `backend/routes/alerts.js:40-48`
- `backend/routes/notifications.js:23-31`
- `backend/routes/reports.js:32-40`
- `backend/routes/gradeAnalysis.js:36-44`
- `backend/routes/assistants.js:67` (if exists)

The function:
```js
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({ body: req.body, params: req.params, query: req.query });
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error.issues[0].message, code: 'VALIDATION_ERROR' });
    }
    req.validated = result.data;
    next();
  };
}
```

Note: `backend/middleware/validate.js` already exists but may have a different implementation.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `cd backend && node -c middleware/validate.js` | exit 0 |
| Test      | `cd backend && npm test` | passes |

## Scope

**In scope**:
- `backend/middleware/validate.js` (update or create)
- `backend/routes/alerts.js`
- `backend/routes/notifications.js`
- `backend/routes/reports.js`
- `backend/routes/gradeAnalysis.js`

## Steps

### Step 1: Check existing middleware/validate.js

Read `backend/middleware/validate.js` to see if it already exports a compatible `validate` function.

### Step 2: Update middleware/validate.js

If the existing file has a different signature, add the compatible version:

```js
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({ body: req.body, params: req.params, query: req.query });
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error.issues[0].message, code: 'VALIDATION_ERROR' });
    }
    req.validated = result.data;
    next();
  };
}

module.exports = { validate };
```

**Verify**: `cd backend && node -c middleware/validate.js` → exit 0

### Step 3: Update route files to import from shared module

In each of the 4 route files:
1. Add `const { validate } = require('../middleware/validate');`
2. Remove the local `function validate(schema) { ... }` definition

**Verify**: `cd backend && node -c routes/alerts.js && node -c routes/notifications.js && node -c routes/reports.js && node -c routes/gradeAnalysis.js` → all exit 0

### Step 4: Run tests

**Verify**: `cd backend && npm test` → all pass

## Test plan

- All existing Zod validation should still work (test with invalid input)
- No duplicate function definitions remain

## Done criteria

- [ ] `validate()` exists in exactly one place: `middleware/validate.js`
- [ ] All 4 route files import from the shared module
- [ ] No local `validate` function definitions remain in route files
- [ ] `cd backend && npm test` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- `middleware/validate.js` already has a conflicting implementation
- Import path doesn't resolve (check directory structure)
