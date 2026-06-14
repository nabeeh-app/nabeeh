# Plan 003: Replace hardcoded attendance data with real data in report generation

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6f7019f..HEAD -- backend/routes/reports.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6f7019f`, 2026-06-14

## Why this matters

Every AI-generated report comment says the student attended 8 out of 10 sessions (80%) regardless of actual attendance. The real attendance data is fetched at line 56 but never used — a hardcoded object `{ total_sessions: 10, present: 8, rate: '80%' }` is passed to the AI instead. This makes every generated report factually wrong.

## Current state

- `backend/routes/reports.js:55-61` — fetches real attendance but passes hardcoded object
- `backend/routes/reports.js:259-263` — `bulkGenerate` also fetches real data but passes hardcoded object at line 263
- `backend/lib/whatsappQuery.js` — `getStudentAttendance(studentId)` returns attendance records

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `cd backend && node -c routes/reports.js` | exit 0 |
| Test      | `cd backend && npm test` | passes |

## Scope

**In scope**:
- `backend/routes/reports.js`

**Out of scope**:
- `backend/lib/whatsappQuery.js` — returns raw records, no changes needed

## Steps

### Step 1: Compute real attendance stats in `generateComment`

After line 56 (`const attendance = await ...`), compute stats from the real data:

```js
// After line 56, add:
const totalSessions = attendance?.length || 0;
const presentCount = attendance?.filter(a => a.status === 'present' || a.status === 'late').length || 0;
const attendanceRate = totalSessions > 0 ? `${Math.round((presentCount / totalSessions) * 100)}%` : 'N/A';
```

Then at line 61, replace the hardcoded object:

```js
// Change:
attendance: { total_sessions: 10, present: 8, rate: '80%' },
// To:
attendance: { total_sessions: totalSessions, present: presentCount, rate: attendanceRate },
```

**Verify**: `cd backend && node -c routes/reports.js` → exit 0

### Step 2: Fix `bulkGenerate` — compute real attendance per student

In the `bulkGenerate` loop (after line 259 where grades are fetched), add attendance fetching and computation:

```js
// After line 259, add:
const attendanceResult = await require('../lib/whatsappQuery').getStudentAttendance(enrollment.student_id);
const totalSessions = attendanceResult?.length || 0;
const presentCount = attendanceResult?.filter(a => a.status === 'present' || a.status === 'late').length || 0;
const attendanceRate = totalSessions > 0 ? `${Math.round((presentCount / totalSessions) * 100)}%` : 'N/A';
```

Then replace the hardcoded attendance object in `bulkGenerate` (around line 263):

```js
// Change:
attendance: { total_sessions: 10, present: 8, rate: '80%' },
// To:
attendance: { total_sessions: totalSessions, present: presentCount, rate: attendanceRate },
```

**Verify**: `cd backend && node -c routes/reports.js` → exit 0

### Step 3: Run tests

**Verify**: `cd backend && npm test` → all pass

## Test plan

- Generate a report comment for a student with known attendance → verify the AI output references the correct attendance rate
- Generate a report for a student with 0 sessions → verify it doesn't crash

## Done criteria

- [ ] `cd backend && node -c routes/reports.js` exits 0
- [ ] `cd backend && npm test` exits 0
- [ ] Generated report comments contain real attendance data, not hardcoded 80%
- [ ] `plans/README.md` status row updated

## STOP conditions

- `getStudentAttendance` return shape doesn't match expected `{ status: string }[]`
- A step's verification fails twice
