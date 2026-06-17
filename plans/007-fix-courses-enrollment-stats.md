# Plan 007: Fix courses page enrollment stats (CORRECTNESS-06)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2e8fb57..HEAD -- frontend/src/app/[locale]/dashboard/courses/page.tsx frontend/src/types/index.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `2e8fb57`, 2026-06-16
- **Issue**: (none)

## Why this matters

The courses page computes `totalEnrolled` identically to `totalGroups` — both sum `o.groups.length`. The stat card labeled "Total Enrolled" shows the group count, not the student count. Additionally, the per-group enrollment column in the expanded table hardcodes `<Badge variant="outline">0</Badge>`, which is misleading. The `OfferingGroup` type has no student count field, so the real metric cannot be computed client-side from the existing API response. The correct fix is to remove the fake stat card and replace the hardcoded `0` with a placeholder.

## Current state

- `src/app/[locale]/dashboard/courses/page.tsx` — courses page (332 lines)
- Lines 73-74 — the duplicate stat computation:

```tsx
const totalGroups = offerings.reduce((sum, o) => sum + o.groups.length, 0);
const totalEnrolled = offerings.reduce((sum, o) => sum + o.groups.length, 0);
```

- Lines 126-130 — the stats array using both:

```tsx
const stats = [
  { icon: BookOpen, value: offerings.length, label: t('courses.totalOfferings'), color: 'primary' as const },
  { icon: GraduationCap, value: totalGroups, label: t('courses.totalGroups'), color: 'accent' as const },
  { icon: Users, value: totalEnrolled, label: t('courses.totalEnrolled'), color: 'success' as const },
];
```

- Lines 243-247 — hardcoded enrollment per group:

```tsx
<TableCell>
  <Badge variant="outline">
    <Users className="h-3 w-3 mr-1" />
    0
  </Badge>
</TableCell>
```

- `src/types/index.ts` lines 260-264 — `OfferingGroup` has no student count:

```tsx
export interface OfferingGroup {
  id: string;
  name: string;
  schedule_description: string | null;
}
```

## Commands you will need

| Purpose   | Command                                          | Expected on success |
|-----------|--------------------------------------------------|---------------------|
| Lint      | `cd frontend && npm run lint`                    | exit 0              |
| Tests     | `cd frontend && npm test`                        | exit 0 (or N/A)     |
| Build     | `cd frontend && npm run build`                   | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `frontend/src/app/[locale]/dashboard/courses/page.tsx`

**Out of scope** (do NOT touch, even though they look related):
- `src/types/index.ts` — `OfferingGroup` type, no change needed
- `src/hooks/useOfferings.ts` — hook file
- Backend API — the enrollment count should come from the backend in a future plan

## Git workflow

- Branch: `advisor/007-fix-courses-enrollment-stats`
- Single commit: `fix(courses): remove fake enrollment stat and hardcoded zero badge`

## Steps

### Step 1: Remove the `totalEnrolled` stat card

In `src/app/[locale]/dashboard/courses/page.tsx`, delete line 74:

```tsx
const totalEnrolled = offerings.reduce((sum, o) => sum + o.groups.length, 0);
```

Then remove the third entry from the `stats` array (lines 129):

```tsx
{ icon: Users, value: totalEnrolled, label: t('courses.totalEnrolled'), color: 'success' as const },
```

After this change the `stats` array should have only 2 entries (total offerings + total groups). The `Users` import on line 25 can also be removed if no longer used elsewhere in the file — check first.

**Verify**: `grep -n "totalEnrolled" frontend/src/app/[locale]/dashboard/courses/page.tsx` returns no matches

### Step 2: Replace the hardcoded `0` enrollment badge

In the same file, lines 243-247, change:

```tsx
<TableCell>
  <Badge variant="outline">
    <Users className="h-3 w-3 mr-1" />
    0
  </Badge>
</TableCell>
```

To:

```tsx
<TableCell>
  <span className="text-sm text-ink/50">—</span>
</TableCell>
```

This replaces the misleading `0` with a neutral placeholder until the backend provides real enrollment counts per group.

**Verify**: `grep -n "h-3 w-3 mr-1" frontend/src/app/[locale]/dashboard/courses/page.tsx` returns no matches (the Users icon in that cell is gone)

### Step 3: Clean up unused imports

Check if `Users` from `lucide-react` is still used anywhere in the file. If not, remove it from the import on line 25.

**Verify**: `grep -n "Users" frontend/src/app/[locale]/dashboard/courses/page.tsx` — if it appears, it's only in the import or other usages; the hardcoded badge is gone.

### Step 4: Run lint

```bash
cd frontend && npm run lint
```

**Verify**: exits 0

### Step 5: Run build

```bash
cd frontend && npm run build
```

**Verify**: exits 0

## Test plan

- No automated test infrastructure exists for this page yet. Verification is manual:
  - `npm run lint` and `npm run build` both pass.
  - `totalEnrolled` is gone from the file.
  - No hardcoded `0` in the enrollment column.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint` exits 0 in `frontend/`
- [ ] `npm run build` exits 0 in `frontend/`
- [ ] `grep -rn "totalEnrolled" frontend/src/app/[locale]/dashboard/courses/page.tsx` returns no matches
- [ ] `grep -rn "0" frontend/src/app/[locale]/dashboard/courses/page.tsx` does not show the hardcoded enrollment `0` in the badge
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- The code at lines 73-74 doesn't match the "Current state" excerpts (codebase has drifted).
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.
- `OfferingGroup` already has a `student_count` field (the plan assumption is wrong).

## Maintenance notes

- When the backend adds a `student_count` field to the `OfferingGroup` response, this page should be updated to display real enrollment numbers and the stat card can be reintroduced.
- The `Courses` i18n keys `courses.totalEnrolled` become unused after this change. They can be cleaned up in a future i18n cleanup pass.
