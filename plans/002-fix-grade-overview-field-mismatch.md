# Plan 002: Fix GradeOverview backend/frontend field name mismatch

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6f7019f..HEAD -- backend/routes/gradeAnalysis.js frontend/src/components/grades/GradeAnalysis.tsx frontend/src/types/index.ts`
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

The Grade Analysis page crashes for any offering that has grades because the frontend reads `overview.average_score.toFixed(1)` but the backend returns `average` (not `average_score`). The `.toFixed(1)` on `undefined` throws a TypeError. Similarly `total_assessments` is read but `total_grades` is returned.

## Current state

- `backend/routes/gradeAnalysis.js:366-372` — returns `total_grades`, `average`, `median`, `pass_rate`, `highest`, `lowest`
- `frontend/src/types/index.ts:459-465` — `GradeOverview` interface has `total_assessments`, `average_score`
- `frontend/src/components/grades/GradeAnalysis.tsx:119-120` — reads `overview.total_assessments` and `overview.average_score.toFixed(1)`

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `cd frontend && npx tsc --noEmit` | exit 0, no errors |

## Scope

**In scope**:
- `frontend/src/types/index.ts`
- `frontend/src/components/grades/GradeAnalysis.tsx`

**Out of scope**:
- `backend/routes/gradeAnalysis.js` — keep the backend response shape as-is (it's more descriptive)

## Steps

### Step 1: Update the TypeScript interface

In `frontend/src/types/index.ts`, find the `GradeOverview` interface and rename fields to match the backend:

```ts
// Change:
total_assessments: number;
average_score: number;
// To:
total_grades: number;
average: number;
```

**Verify**: `cd frontend && npx tsc --noEmit 2>&1 | grep GradeOverview` → shows errors in GradeAnalysis.tsx (expected)

### Step 2: Update GradeAnalysis.tsx references

In `frontend/src/components/grades/GradeAnalysis.tsx:119-120`:

```tsx
// Change:
{ icon: BookOpen, value: overview.total_assessments, label: tAnalysis('totalAssessments'), color: 'accent' as const },
{ icon: TrendingUp, value: `${overview.average_score.toFixed(1)}%`, label: tAnalysis('averageScore'), color: 'success' as const },
// To:
{ icon: BookOpen, value: overview.total_grades, label: tAnalysis('totalGrades'), color: 'accent' as const },
{ icon: TrendingUp, value: `${overview.average.toFixed(1)}%`, label: tAnalysis('averageScore'), color: 'success' as const },
```

Also update the `apiClient.getGradeOverview` return type if it references `GradeOverview`.

**Verify**: `cd frontend && npx tsc --noEmit` → exit 0

## Test plan

- Open Grade Analysis page → stat cards should show real numbers, not "undefined"

## Done criteria

- [ ] `cd frontend && npx tsc --noEmit` exits 0
- [ ] Grade Analysis page renders stat cards with real values
- [ ] `plans/README.md` status row updated

## STOP conditions

- Backend response shape doesn't match the excerpts (codebase has drifted)
