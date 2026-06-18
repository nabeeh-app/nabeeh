# Plan 058: Consolidate duplicate phone normalization logic

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat HEAD -- backend/lib/sessionManager.js backend/routes/whatsapp.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `6e6ee99`, 2026-06-18

## Why this matters

Two different phone normalization strategies exist: `whatsapp.js:516-537` does full country-code-aware normalization, while `sessionManager.js:220` does simple `phone.replace('+', '').replace(/[^0-9]/g, '')`. Edge cases like `0020...` would diverge, causing message routing failures.

## Current state

- `backend/lib/sessionManager.js:220`:
  ```js
  const cleanPhone = phone.replace('+', '').replace(/[^0-9]/g, '');
  ```
- `backend/routes/whatsapp.js:516-537` — full normalization with country codes.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 235 pass            |

## Scope

**In scope**:
- `backend/lib/sessionManager.js` — use the same normalization as whatsapp.js

**Out of scope**:
- `backend/routes/whatsapp.js` — already has the correct implementation
- No new shared utility file (keep changes minimal)

## Steps

### Step 1: Replace simple normalization with the full normalization from whatsapp.js

In `backend/lib/sessionManager.js`, replace line 220:

```js
const cleanPhone = phone.replace('+', '').replace(/[^0-9]/g, '');
```

With the normalization logic from `whatsapp.js` (adapted for this context):

```js
// Normalize phone: strip +, spaces, dashes, parentheses
let cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');

// Handle Egyptian numbers: 0020 → 20, 0 → 20 (local to international)
if (cleanPhone.startsWith('0020')) {
  cleanPhone = '20' + cleanPhone.slice(4);
} else if (cleanPhone.startsWith('0') && cleanPhone.length === 11) {
  cleanPhone = '20' + cleanPhone.slice(1);
}

// Ensure it starts with country code (no leading zeros after country code)
if (!cleanPhone.match(/^[1-9]\d+$/)) {
  // Invalid phone format
  return null;
}
```

**Verify**: `cd backend && npm test` → 235 pass

## Done criteria

- [ ] `getTeacherForPhone` uses country-code-aware normalization
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `getTeacherForPhone` no longer exists
