# Plan 006: Fix grades page fake Student object (CORRECTNESS-04)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2e8fb57..HEAD -- frontend/src/app/[locale]/dashboard/grades/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `2e8fb57`, 2026-06-16
- **Issue**: (none)

## Why this matters

`grades/page.tsx` creates a fake `Student` object via `{} as Student` when a grade's `student_id` doesn't match any loaded student. The `GradeWithStudent` interface declares `student: Student` (non-optional). Later, `filteredGrades` accesses `grade.student.name?.toLowerCase()`. Although `name` is optional-chained, the real danger is that the `as Student` cast produces an object with no prototype chain for `name`, meaning TypeScript won't catch the runtime crash. In practice, a student-deletion race or stale cache entry triggers this path and a TypeError surfaces to the user. Filtering out unmatched grades is the correct fix.

## Current state

- `src/app/[locale]/dashboard/grades/page.tsx` — the grades page component (811 lines)
- Lines 55-57: `GradeWithStudent` interface with non-optional `student: Student`
- Lines 169-178: the `grades` memo that builds `GradeWithStudent[]`:

```tsx
// line 169-178
const grades: GradeWithStudent[] = useMemo(() => {
  const rawGrades = gradesResponse?.data ?? [];
  const studentIds = new Set(students.map(s => s.id));
  return rawGrades
    .filter((g: Grade) => studentIds.has(g.student_id))
    .map((grade: Grade) => ({
      ...grade,
      student: students.find(s => s.id === grade.student_id) || {} as Student
    }));
}, [gradesResponse, students]);
```

- Lines 364-373: `filteredGrades` accesses `grade.student.name?.toLowerCase()`:

```tsx
// line 364-373
const filteredGrades = useMemo(() => {
  return grades.filter(grade => {
    const matchesSearch = grade.student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      grade.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      grade.assessment_name.toLowerCase().includes(searchTerm.toLowerCase());
    ...
  });
}, [grades, searchTerm, selectedAssessmentType, gradeFilter]);
```

- Convention: the page uses `useStudents()` from `@/hooks/useStudents` and `useGrades()` from `@/hooks/useGrades`.

## Commands you will need

| Purpose   | Command                                          | Expected on success |
|-----------|--------------------------------------------------|---------------------|
| Lint      | `cd frontend && npm run lint`                    | exit 0              |
| Tests     | `cd frontend && npm test`                        | exit 0 (or N/A)     |
| Build     | `cd frontend && npm run build`                   | exit 0              |

## Scope

**In scope** (the only file you should modify):
- `frontend/src/app/[locale]/dashboard/grades/page.tsx`

**Out of scope** (do NOT touch, even though they look related):
- `src/hooks/useGrades.ts` — hook file, no change needed
- `src/types/index.ts` — `GradeWithStudent` interface stays as-is
- `src/app/[locale]/dashboard/courses/page.tsx` — separate plan

## Git workflow

- Branch: `advisor/006-fix-grades-fake-student`
- Single commit: `fix(grades): filter unmatched grades instead of casting empty object`

## Steps

### Step 1: Fix the grades memo to never produce `{} as Student`

In `src/app/[locale]/dashboard/grades/page.tsx`, the `grades` memo already filters by `studentIds.has(g.student_id)` on line 173. The `|| {} as Student` fallback on line 176 should never fire, but the cast is unsafe. Replace it with a guard that skips the grade if the student lookup fails:

Change lines 172-177 from:

```tsx
return rawGrades
  .filter((g: Grade) => studentIds.has(g.student_id))
  .map((grade: Grade) => ({
    ...grade,
    student: students.find(s => s.id === grade.student_id) || {} as Student
  }));
```

To:

```tsx
return rawGrades
  .filter((g: Grade) => studentIds.has(g.student_id))
  .map((grade: Grade) => ({
    ...grade,
    student: students.find(s => s.id === grade.student_id)!
  }))
  .filter((g): g is GradeWithStudent => g.student !== undefined);
```

The non-null assertion `!` is safe here because the preceding filter guarantees `studentIds.has(g.student_id)`, meaning every mapped grade has a matching student. The final filter is a type-narrowing safety net.

**Verify**: `grep -rn "as Student" frontend/src/app/[locale]/dashboard/grades/page.tsx` returns no matches

### Step 2: Add optional chaining in filteredGrades as defense-in-depth

In the same file, line 366, change:

```tsx
const matchesSearch = grade.student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
```

To:

```tsx
const matchesSearch = (grade.student?.name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
```

This ensures that even if a future change reintroduces a fake student, the filter won't crash.

**Verify**: `grep -n "grade.student" frontend/src/app/[locale]/dashboard/grades/page.tsx` shows the updated line

### Step 3: Run lint

```bash
cd frontend && npm run lint
```

**Verify**: exits 0

### Step 4: Run build

```bash
cd frontend && npm run build
```

**Verify**: exits 0

## Test plan

- No automated test infrastructure exists for this page yet. Verification is manual:
  - After the change, `npm run lint` and `npm run build` both pass.
  - The `as Student` cast is gone (grep confirms).
  - The `filteredGrades` memo uses nullish coalescing for `grade.student?.name`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint` exits 0 in `frontend/`
- [ ] `npm run build` exits 0 in `frontend/`
- [ ] `grep -rn "as Student" frontend/src/app/[locale]/dashboard/grades/page.tsx` returns no matches
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- The code at lines 169-178 doesn't match the "Current state" excerpts (codebase has drifted).
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.
- `GradeWithStudent` interface in `src/types/index.ts` has changed to make `student` optional (which would also fix this, but is a different approach).

## Maintenance notes

- If the backend ever returns grades for students not yet loaded by `useStudents`, this filtering will silently drop those grades. A better long-term fix would be to have the grades API return the student object inline, eliminating the client-side join.
- The `GradeWithStudent` interface could be updated to `student?: Student` to be honest about the possibility, but that would require changing all downstream consumers.
