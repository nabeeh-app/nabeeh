# Plan 013: Wire up GradeDistribution and TrendChart data or gate behind feature flag

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6f7019f..HEAD -- frontend/src/components/grades/GradeAnalysis.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `6f7019f`, 2026-06-14

## Why this matters

Grade Distribution and Trend Charts are rendered but permanently show empty state ("No distribution data available" / "No trend data available"). The `distribution` state is never populated, and `selectedStudent` never changes in the UI. These are dead features.

## Current state

- `frontend/src/components/grades/GradeAnalysis.tsx:31` — `const [distribution, setDistribution] = useState<any[]>([]);`
- `GradeAnalysis.tsx:89` — `setDistribution([])` (cleared but never populated)
- `GradeAnalysis.tsx:94` — `getGradeTrends(selectedStudent)` called but `selectedStudent` is never set by user
- `GradeAnalysis.tsx:151-152` — renders `<GradeDistribution data={distribution} />` and `<TrendChart data={trends} />`

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `cd frontend && npx tsc --noEmit` | exit 0 |

## Scope

**In scope**:
- `frontend/src/components/grades/GradeAnalysis.tsx`
- `frontend/src/components/grades/GradeDistribution.tsx`
- `frontend/src/components/grades/TrendChart.tsx`

## Steps

### Step 1: Gate unfinished charts behind feature flag

Since the data fetching UI (student selector for trends, assessment selector for distribution) doesn't exist yet, gate these behind the existing `gradeAnalysis` feature flag or a sub-flag:

```tsx
import { featureFlags } from '@/config/featureFlags';

// In the JSX, wrap the charts:
{featureFlags.gradeAnalysis && (
  <>
    <GradeDistribution data={distribution} />
    <TrendChart data={trends} />
  </>
)}
```

**Verify**: `cd frontend && npx tsc --noEmit` → exit 0

### Step 2: Add a TODO comment for future implementation

Add a comment explaining what's needed:

```tsx
// TODO: Add assessment selector to populate distribution data
// TODO: Add student selector to populate trend data
```

**Verify**: `cd frontend && npx tsc --noEmit` → exit 0

## Done criteria

- [ ] Grade Distribution and Trend Charts are hidden when data is empty
- [ ] Feature flag controls visibility
- [ ] `cd frontend && npx tsc --noEmit` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- Feature flag system doesn't support sub-flags
