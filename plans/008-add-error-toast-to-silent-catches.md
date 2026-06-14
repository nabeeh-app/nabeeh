# Plan 008: Add error feedback to silent catch blocks in frontend

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6f7019f..HEAD -- frontend/src/components/alerts/AlertConfig.tsx frontend/src/components/alerts/AlertDisplay.tsx frontend/src/components/reports/ReportGenerator.tsx frontend/src/components/reports/CommentApproval.tsx frontend/src/components/reports/CommentEditor.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6f7019f`, 2026-06-14

## Why this matters

When API calls fail (network error, 500, timeout), delete/toggle/approve/reject/save operations silently fail — the user receives zero feedback and doesn't know if their action succeeded.

## Current state

Silent catch blocks in:
- `AlertConfig.tsx:210,221-223,234-236` — delete, toggle, save failures
- `AlertDisplay.tsx:82-84,91-93` — mark-read failures
- `ReportGenerator.tsx:82-83,97-98` — offering/student fetch failures
- `CommentApproval.tsx:29-30,42-43` — approve/reject failures
- `CommentEditor.tsx:29-30` — save failures

All use `catch { // silent }` or `catch {}`.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `cd frontend && npx tsc --noEmit` | exit 0 |

## Scope

**In scope**:
- `frontend/src/components/alerts/AlertConfig.tsx`
- `frontend/src/components/alerts/AlertDisplay.tsx`
- `frontend/src/components/reports/ReportGenerator.tsx`
- `frontend/src/components/reports/CommentApproval.tsx`
- `frontend/src/components/reports/CommentEditor.tsx`

**Out of scope**:
- Other components with silent catches (assistants, settings) — separate cleanup

## Steps

### Step 1: Add `error` state and display to AlertConfig.tsx

The component already has `error` state and displays it. Fix the silent catches:

- `catch { // silent }` at toggle → `catch { setError(t('saveFailed')); }`
- `catch { // silent }` at delete → `catch { setError(t('saveFailed')); }`

**Verify**: `cd frontend && npx tsc --noEmit 2>&1 | grep AlertConfig` → no errors

### Step 2: Add error state to AlertDisplay.tsx

Add `const [error, setError] = useState('');` and display it. Replace silent catches with `setError(t('saveFailed'))` calls.

**Verify**: `cd frontend && npx tsc --noEmit 2>&1 | grep AlertDisplay` → no errors

### Step 3: Add error state to CommentApproval.tsx

Add error state. Replace silent catches at approve/reject with error feedback.

**Verify**: `cd frontend && npx tsc --noEmit 2>&1 | grep CommentApproval` → no errors

### Step 4: Add error state to CommentEditor.tsx

Add error state. Replace silent catch at save with error feedback.

**Verify**: `cd frontend && npx tsc --noEmit 2>&1 | grep CommentEditor` → no errors

### Step 5: Full typecheck

**Verify**: `cd frontend && npx tsc --noEmit` → exit 0

## Test plan

- Disconnect network → try to toggle an alert rule → should see error message
- Try to delete a rule with network error → should see error message

## Done criteria

- [ ] `cd frontend && npx tsc --noEmit` exits 0
- [ ] All 5 components show error messages on API failure
- [ ] No `catch { // silent }` blocks remain in scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

- A component doesn't have an existing error display pattern to follow
