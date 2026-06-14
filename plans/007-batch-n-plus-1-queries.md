# Plan 007: Batch N+1 queries in anomaly detector and weekly digest

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6f7019f..HEAD -- backend/lib/anomalyDetector.js backend/lib/weeklyDigest.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `6f7019f`, 2026-06-14

## Why this matters

The anomaly detector issues 2 DB queries per enrollment (sessions + attendance), and the weekly digest issues 4 per enrollment. With 100 students, this produces 200-400+ sequential DB queries per cron execution. This causes database connection pool exhaustion and slow execution under production load.

## Current state

- `backend/lib/anomalyDetector.js:21-40` — `detectAttendanceAnomalies` loops over enrollments, 2 queries each
- `backend/lib/anomalyDetector.js:122-135` — `detectGradeAnomalies` loops over enrollments, 1 query each
- `backend/lib/weeklyDigest.js:26-68` — `generateDigest` loops over enrollments, 4 queries each
- Both use `supabaseAdmin` client from `config/database.js`

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `cd backend && node -c lib/anomalyDetector.js && node -c lib/weeklyDigest.js` | exit 0 |

## Scope

**In scope**:
- `backend/lib/anomalyDetector.js`
- `backend/lib/weeklyDigest.js`

**Out of scope**:
- `backend/lib/alertEvaluator.js` — separate plan (PERF-04/05)
- `backend/routes/gradeAnalysis.js` — separate plan (PERF-15)

## Steps

### Step 1: Batch `detectAttendanceAnomalies` in anomalyDetector.js

Replace the per-enrollment loop with two bulk queries:

1. Fetch all sessions for the teacher's groups in one query
2. Fetch all attendance records for those sessions in one query
3. Group by enrollment_id in JS
4. Compute anomalies per enrollment

```js
// Replace the enrollment loop with:
const groupIds = enrollments.map(e => e.group_id);
const { data: allSessions } = await supabaseAdmin
  .from('sessions').select('id, date, group_id')
  .in('group_id', [...new Set(groupIds)]);

const sessionIds = allSessions?.map(s => s.id) || [];
const { data: allAttendance } = await supabaseAdmin
  .from('attendance').select('*, session_id')
  .in('session_id', sessionIds);

// Group by enrollment_id
const attendanceByEnrollment = new Map();
for (const att of allAttendance || []) {
  const session = allSessions.find(s => s.id === att.session_id);
  // ... group logic
}
```

**Verify**: `cd backend && node -c lib/anomalyDetector.js` → exit 0

### Step 2: Batch `detectGradeAnomalies` in anomalyDetector.js

Replace per-enrollment grade queries with one bulk query:

```js
const enrollmentIds = enrollments.map(e => e.id);
const { data: allGrades } = await supabaseAdmin
  .from('grades').select('*, assessment:assessments(max_score)')
  .in('enrollment_id', enrollmentIds)
  .order('created_at', { ascending: false });

// Group by enrollment_id and take last 5 per group
```

**Verify**: `cd backend && node -c lib/anomalyDetector.js` → exit 0

### Step 3: Batch `generateDigest` in weeklyDigest.js

Replace 4 per-enrollment queries with 2 bulk queries (attendance + grades for 2-week window):

```js
const enrollmentIds = enrollments.map(e => e.id);
const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

const { data: allAttendance } = await supabaseAdmin
  .from('attendance').select('*, session:sessions(date)')
  .in('enrollment_id', enrollmentIds)
  .gte('session.date', twoWeeksAgo);

const { data: allGrades } = await supabaseAdmin
  .from('grades').select('*, assessment:assessments(max_score, name)')
  .in('enrollment_id', enrollmentIds)
  .gte('created_at', twoWeeksAgo);

// Group by enrollment_id and compute per-student stats
```

**Verify**: `cd backend && node -c lib/weeklyDigest.js` → exit 0

### Step 4: Verify both files

**Verify**: `cd backend && node -c lib/anomalyDetector.js && node -c lib/weeklyDigest.js` → exit 0

## Test plan

- Run anomaly detection for a teacher with 10+ students → should complete in <5 seconds (was 30+)
- Verify anomalies are still correctly detected (compare output before/after on same data)

## Done criteria

- [ ] Both files pass `node -c` syntax check
- [ ] Query count reduced from O(N) to O(1) per function
- [ ] Anomaly detection output matches pre-refactor output
- [ ] `plans/README.md` status row updated

## STOP conditions

- Supabase doesn't support `in()` with more than ~100 values (use chunking if needed)
- The session/attendance join structure doesn't match expected schema
