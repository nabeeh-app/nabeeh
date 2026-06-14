# Plan 006: Fix AtRiskStudents crash on null average_grade/attendance_rate

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6f7019f..HEAD -- frontend/src/components/grades/AtRiskStudents.tsx frontend/src/types/index.ts`
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

When an at-risk student has no grade records (e.g. newly enrolled) or no attendance records, the backend returns `null` for `average_grade` and `attendance_rate`. The frontend calls `.toFixed(1)` unconditionally on these values, throwing a TypeError that crashes the entire AtRiskStudents card.

## Current state

- `frontend/src/components/grades/AtRiskStudents.tsx:69` — `student.average_grade.toFixed(1)` — crashes on null
- `frontend/src/components/grades/AtRiskStudents.tsx:72` — `student.attendance_rate.toFixed(1)` — crashes on null
- `frontend/src/types/index.ts` — `AtRiskStudent` interface marks these as `number` (should be `number | null`)

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `cd frontend && npx tsc --noEmit` | exit 0 |

## Scope

**In scope**:
- `frontend/src/components/grades/AtRiskStudents.tsx`
- `frontend/src/types/index.ts`

## Steps

### Step 1: Update the TypeScript type

In `frontend/src/types/index.ts`, find the `AtRiskStudent` interface and make the nullable fields optional:

```ts
// Change:
average_grade: number;
attendance_rate: number;
// To:
average_grade: number | null;
attendance_rate: number | null;
```

**Verify**: `cd frontend && npx tsc --noEmit 2>&1 | grep AtRisk` → shows errors in AtRiskStudents.tsx (expected)

### Step 2: Add null guards in the component

In `AtRiskStudents.tsx:69`, change:

```tsx
// Change:
{t('avgGrade')}: {student.average_grade.toFixed(1)}%
// To:
{t('avgGrade')}: {student.average_grade != null ? `${student.average_grade.toFixed(1)}%` : 'N/A'}
```

In `AtRiskStudents.tsx:72`, change:

```tsx
// Change:
{t('attendance')}: {student.attendance_rate.toFixed(1)}%
// To:
{t('attendance')}: {student.attendance_rate != null ? `${student.attendance_rate.toFixed(1)}%` : 'N/A'}
```

**Verify**: `cd frontend && npx tsc --noEmit` → exit 0

## Test plan

- Open Grade Analysis with an offering that has at-risk students → card should render without crashing
- Students with no grades should show "N/A" instead of crashing

## Done criteria

- [ ] `cd frontend && npx tsc --noEmit` exits 0
- [ ] AtRiskStudents card renders without crashing for null values
- [ ] `plans/README.md` status row updated

## STOP conditions

- Backend returns `undefined` instead of `null` (check actual API response)
