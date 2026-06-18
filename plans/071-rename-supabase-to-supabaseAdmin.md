# Plan 071: Rename misleading `supabase` variable to `supabaseAdmin` in whatsapp.js

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d760576..HEAD -- backend/routes/whatsapp.js`
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

`whatsapp.js:5` names the admin client `supabase`, which is misleading — readers assume it's the anon/read-only client. New developers will confuse which client does what.

## Current state

- `backend/routes/whatsapp.js:5`:
  ```js
  const supabase = require('../config/database').supabaseAdmin;
  ```
  Used as `supabase.from(...)` throughout the file (~6+ usages).

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244 pass            |

## Scope

**In scope**:
- `backend/routes/whatsapp.js` — rename variable and all usages

**Out of scope**: No other files

## Steps

### Step 1: Change the import

```js
const { supabaseAdmin } = require('../config/database');
```

### Step 2: Replace all usages

Use find-and-replace: `supabase.from(` → `supabaseAdmin.from(`, `supabase.rpc(` → `supabaseAdmin.rpc(`, etc.

**Verify**: `cd backend && npm test` → 244 pass

## Done criteria

- [ ] `supabase` variable no longer exists in whatsapp.js
- [ ] All usages renamed to `supabaseAdmin`
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If the import line no longer exists
