# Plan 088: Add dedicated unit tests for lib/phone.js

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 52e1011..HEAD -- backend/lib/phone.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `52e1011`, 2026-06-18

## Why this matters

`normalizePhoneNumber` is imported by 3 modules (`baileys.js`, `sessionManager.js`, `whatsapp.js`). Phone normalization tests exist inside `whatsapp.spec.js` but not as standalone unit tests for `phone.js`. Edge cases (empty string, non-string input, `00` prefix, short numbers) are uncovered.

## Current state

- `backend/lib/phone.js` — created by plan 077, exports `normalizePhoneNumber`
- Tests in `routes/__tests__/whatsapp.spec.js` cover 8 cases but miss edge cases

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244+ pass           |

## Scope

**In scope**:
- `backend/lib/__tests__/phone.spec.js` — new test file

**Out of scope**: No other files

## Steps

### Step 1: Create test file

Create `backend/lib/__tests__/phone.spec.js` with tests for:

1. Egyptian mobile: `01012345678` → `201012345678`
2. Egyptian with +: `+201012345678` → `201012345678`
3. Saudi mobile: `0501234567` → `966501234567`
4. UAE mobile: `0501234567` → `971501234567`
5. Unknown country: `+12025551234` → `12025551234`
6. Empty string → `'%'`
7. Non-string input → `'%'`
8. `00` prefix stripping: `00201012345678` → `201012345678`
9. Short number: `0123` → `200123`

**Verify**: `cd backend && npm test` → all pass

## Done criteria

- [ ] `phone.spec.js` exists with ≥9 test cases
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `lib/phone.js` no longer exists
