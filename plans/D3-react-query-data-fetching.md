# Plan D3: Migrate frontend data fetching to React Query / SWR

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6f7019f..HEAD -- frontend/package.json frontend/src/components/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding.

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `6f7019f`, 2026-06-14

## Why this matters

Multiple components fetch the same data independently (offerings, students). The manual `cancelled` flag pattern is used in 10+ useEffect hooks. A caching layer would eliminate redundant API calls, simplify the code, and fix stale closure bugs.

## Current state

- `GradeAnalysis.tsx:39` — fetches offerings on mount
- `ReportGenerator.tsx:35` — fetches offerings on mount
- 10+ useEffect hooks use `let cancelled = false` pattern
- No shared data fetching infrastructure

## Scope

**In scope**:
- `frontend/package.json` (add swr dependency)
- `frontend/src/lib/api.ts` (add SWR wrapper)
- New files in `frontend/src/hooks/`
- Migrate 2-3 components as proof of concept

**Out of scope**:
- Migrating all components (do in phases)
- Removing the apiClient class (keep as data layer)

## Steps

### Step 1: Install SWR

```bash
cd frontend && npm install swr
```

### Step 2: Create SWR hooks for shared data

Create `frontend/src/hooks/useOfferings.ts`:

```ts
import useSWR from 'swr';
import { apiClient } from '@/lib/api';

export function useOfferings() {
  return useSWR('offerings', () => apiClient.getOfferings(), {
    revalidateOnFocus: false,
    dedupingInterval: 60000, // 1 minute
  });
}
```

Create `frontend/src/hooks/useStudents.ts`:

```ts
import useSWR from 'swr';
import { apiClient } from '@/lib/api';

export function useStudents(groupId?: string) {
  return useSWR(
    groupId ? `students-${groupId}` : null,
    () => apiClient.getStudents({ group_id: groupId, limit: 200 }),
    { dedupingInterval: 30000 }
  );
}
```

### Step 3: Migrate GradeAnalysis.tsx

Replace manual fetch with `useOfferings()` hook. Remove `useEffect` and `cancelled` flag for offerings fetch.

### Step 4: Migrate ReportGenerator.tsx

Same approach for offerings. Add `useStudents(groupId)` for student fetching.

### Step 5: Verify

**Verify**: `cd frontend && npx tsc --noEmit` → exit 0

## Test plan

- Navigate between grades and reports pages → offerings should not be re-fetched (check Network tab)
- Rapid offering selection → should not cause stale data display
- Offline → should show cached data or proper error

## Done criteria

- [ ] SWR installed and configured
- [ ] At least 2 shared hooks exist (useOfferings, useStudents)
- [ ] GradeAnalysis and ReportGenerator use SWR hooks
- [ ] No redundant API calls for offerings
- [ ] `cd frontend && npx tsc --noEmit` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- SWR conflicts with existing auth/token refresh mechanism
- The apiClient's response format isn't compatible with SWR's fetcher pattern
