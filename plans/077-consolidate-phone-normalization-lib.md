# Plan 077: Consolidate phone normalization into shared lib/phone.js

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d760576..HEAD -- backend/lib/baileys.js backend/lib/sessionManager.js backend/routes/whatsapp.js`
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

Phone normalization exists in 3+ places with divergent logic: `whatsapp.js:518-538` (full country-code aware), `sessionManager.js:240-253` (Egyptian-only), `baileys.js:268` (strip non-digits). Edge cases cause routing failures.

## Current state

- `backend/routes/whatsapp.js:518-538` — `normalizePhoneNumber` (12 MENA codes)
- `backend/lib/sessionManager.js:240-253` — inline Egyptian normalizer
- `backend/lib/baileys.js:268` — `phone.replace('+', '').replace(/[^0-9]/g, '')`

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244 pass            |

## Scope

**In scope**:
- `backend/lib/phone.js` — new file with shared `normalizePhoneNumber`
- `backend/routes/whatsapp.js` — import from lib/phone.js, remove local copy
- `backend/lib/sessionManager.js` — import from lib/phone.js, remove inline
- `backend/lib/baileys.js` — import from lib/phone.js, remove inline

**Out of scope**: No other files

## Steps

### Step 1: Create backend/lib/phone.js

Move the `normalizePhoneNumber` function from `whatsapp.js` to `lib/phone.js`:

```js
function normalizePhoneNumber(phone) {
  // ... (the full implementation from whatsapp.js:518-538)
}
module.exports = { normalizePhoneNumber };
```

### Step 2: Update whatsapp.js

Remove the local `normalizePhoneNumber` function. Add:

```js
const { normalizePhoneNumber } = require('../lib/phone');
```

Replace all inline `normalizePhoneNumber` calls to use the imported version.

### Step 3: Update sessionManager.js

Replace lines 240-253 (the inline normalizer) with:

```js
const { normalizePhoneNumber } = require('./phone');
```

Use `normalizePhoneNumber(phone)` instead of the inline logic.

### Step 4: Update baileys.js

In `sendMessage`, replace:

```js
const cleaned = to.replace('+', '').replace(/[^0-9]/g, '');
```

With:

```js
const { normalizePhoneNumber } = require('./phone');
const cleaned = normalizePhoneNumber(to);
```

Or import at the top of the file.

**Verify**: `cd backend && npm test` → 244 pass

## Done criteria

- [ ] `backend/lib/phone.js` exists with shared `normalizePhoneNumber`
- [ ] No inline phone normalization in baileys.js, sessionManager.js, or whatsapp.js
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `normalizePhoneNumber` no longer exists anywhere
