# Plan D1: Build batch data-fetching layer for anomaly detection and digest

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6f7019f..HEAD -- backend/lib/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: Plan 007 (batch queries in anomalyDetector and weeklyDigest)
- **Category**: direction
- **Planned at**: commit `6f7019f`, 2026-06-14

## Why this matters

The N+1 query patterns in `anomalyDetector.js` and `weeklyDigest.js` are the root cause of performance issues and DoS amplification. A shared `fetchEnrollmentData(teacherId, dateRange)` function would eliminate 90% of redundant queries and serve as the foundation for all data-intensive backend operations.

## Current state

- `backend/lib/anomalyDetector.js` — 2 queries per enrollment for attendance, 1 per enrollment for grades
- `backend/lib/weeklyDigest.js` — 4 queries per enrollment (2 attendance + 2 grades)
- `backend/lib/alertEvaluator.js` — similar N+1 patterns (separate plan)
- All three modules independently query the same data (sessions, attendance, grades)

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `cd backend && node -c lib/batchQuery.js` | exit 0 |

## Scope

**In scope**:
- `backend/lib/batchQuery.js` (new file)
- `backend/lib/anomalyDetector.js`
- `backend/lib/weeklyDigest.js`

**Out of scope**:
- `backend/lib/alertEvaluator.js` — separate follow-up
- `backend/routes/gradeAnalysis.js` — separate follow-up

## Steps

### Step 1: Create batch data-fetching module

Create `backend/lib/batchQuery.js`:

```js
const { supabaseAdmin } = require('../config/database');

/**
 * Fetch all enrollment data (sessions, attendance, grades) for a teacher's students
 * in bulk queries instead of per-enrollment.
 */
async function fetchEnrollmentData(teacherId, dateRange = null) {
  // 1. Get all enrollments via the enrollment chain
  const { data: enrollments } = await supabaseAdmin
    .from('enrollments')
    .select('id, group_id, student_id, students(name)')
    .in('group_id', 
      // subquery: get group IDs from teacher's offerings
      // This may need to be split into two queries depending on Supabase limitations
    );

  // 2. Fetch all sessions for those groups
  // 3. Fetch all attendance for those sessions
  // 4. Fetch all grades for those enrollments
  
  // Group by enrollment_id and return a Map
  return { enrollments, sessions, attendance, grades };
}

module.exports = { fetchEnrollmentData };
```

**Verify**: `cd backend && node -c lib/batchQuery.js` → exit 0

### Step 2: Refactor anomalyDetector.js to use batchQuery

Replace the per-enrollment loops with calls to `fetchEnrollmentData` and process results in memory.

**Verify**: `cd backend && node -c lib/anomalyDetector.js` → exit 0

### Step 3: Refactor weeklyDigest.js to use batchQuery

Same approach.

**Verify**: `cd backend && node -c lib/weeklyDigest.js` → exit 0

### Step 4: Verify output consistency

Run both functions on the same data before and after refactoring. Output should match.

## Test plan

- Compare anomaly detection output before/after on same teacher data
- Compare weekly digest output before/after
- Benchmark: 100 students should complete in <5 seconds

## Done criteria

- [ ] `batchQuery.js` exists and exports `fetchEnrollmentData`
- [ ] Both anomalyDetector and weeklyDigest use the shared module
- [ ] Query count reduced from O(N) to O(1) per function
- [ ] Output matches pre-refactor results
- [ ] `plans/README.md` status row updated

## STOP conditions

- Supabase subquery limitations prevent the batch approach
- Data grouping in JS produces different results than per-enrollment queries
