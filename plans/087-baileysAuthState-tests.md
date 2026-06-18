# Plan 087: Add unit tests for baileysAuthState module

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 52e1011..HEAD -- backend/lib/baileysAuthState.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `52e1011`, 2026-06-18

## Why this matters

`baileysAuthState.js` (211 lines) is the persistence layer for WhatsApp auth. It contains credential serialization/deserialization with BufferJSON, debounced persistence, scoped key get/set with batch upsert/delete, and teacher-scoped filtering. Zero test coverage — a regression in debounce logic, serialization, or teacher scoping would not be caught.

## Current state

- `backend/lib/__tests__/` contains `baileys.spec.js` and `sessionManager.spec.js` but no `baileysAuthState.spec.js`
- `baileys.spec.js` mocks the entire auth state (line 19-24), so it never exercises this code

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244+ pass           |

## Scope

**In scope**:
- `backend/lib/__tests__/baileysAuthState.spec.js` — new test file

**Out of scope**: No other files

## Steps

### Step 1: Create test file

Create `backend/lib/__tests__/baileysAuthState.spec.js` with tests for:

1. **keys.get** — returns decrypted key data for a given type+id
2. **keys.set** — batches upserts and groups by type
3. **keys.delete** — batches deletions by type
4. **saveCreds** — debounces and persists credentials
5. **flushPendingSave** — immediately persists and clears timer
6. **cancelPendingSave** — clears timer without persisting
7. **Teacher scoping** — queries filter by teacher_id
8. **'default' fallback** — uses `id='default'` when teacherId is missing

Mock Supabase client (use the same pattern from `sessionManager.spec.js`).

**Verify**: `cd backend && npm test` → all pass (244 + new tests)

## Done criteria

- [ ] `baileysAuthState.spec.js` exists with ≥8 test cases
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `baileysAuthState.js` no longer exists
