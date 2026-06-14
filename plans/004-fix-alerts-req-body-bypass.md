# Plan 004: Fix alerts.js to use req.validated.body instead of req.body

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6f7019f..HEAD -- backend/routes/alerts.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6f7019f`, 2026-06-14

## Why this matters

`createRule` reads `req.body` instead of `req.validated.body`, bypassing Zod defaults. When `notification_method` is omitted, the DB inserts `undefined` instead of the intended `'in_app'` default. Similarly, Zod's `z.number()` coercion on `threshold_value` is bypassed — a string `"5"` from JSON would be inserted as-is.

## Current state

- `backend/routes/alerts.js:70` — `const { ... } = req.body;` in createRule
- `backend/routes/alerts.js:88-89` — `req.body[key]` in updateRule loop
- Zod schema at lines 9-16 applies `.default('in_app')` and `z.number()` coercion

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `cd backend && node -c routes/alerts.js` | exit 0 |
| Test      | `cd backend && npm test` | passes |

## Scope

**In scope**:
- `backend/routes/alerts.js`

## Steps

### Step 1: Fix `createRule` to use validated body

At `alerts.js:70`, change:

```js
// Change:
const { alert_type, threshold_value, comparison, notification_method } = req.body;
// To:
const { alert_type, threshold_value, comparison, notification_method } = req.validated.body;
```

**Verify**: `cd backend && node -c routes/alerts.js` → exit 0

### Step 2: Fix `updateRule` to use validated body

At `alerts.js:88-89`, change:

```js
// Change:
for (const key of ['alert_type', 'threshold_value', 'comparison', 'notification_method']) {
  if (req.body[key] !== undefined) updates[key] = req.body[key];
}
// To:
for (const key of ['alert_type', 'threshold_value', 'comparison', 'notification_method']) {
  if (req.validated.body[key] !== undefined) updates[key] = req.validated.body[key];
}
```

**Verify**: `cd backend && node -c routes/alerts.js` → exit 0

### Step 3: Run tests

**Verify**: `cd backend && npm test` → all pass

## Test plan

- Create an alert rule without `notification_method` → verify it defaults to `in_app` in the DB
- Create an alert rule with `threshold_value: "5"` (string) → verify it's stored as number

## Done criteria

- [ ] `cd backend && node -c routes/alerts.js` exits 0
- [ ] `cd backend && npm test` exits 0
- [ ] Omitted `notification_method` defaults to `in_app`
- [ ] `plans/README.md` status row updated

## STOP conditions

- `req.validated` is undefined (middleware not applied to this route)
