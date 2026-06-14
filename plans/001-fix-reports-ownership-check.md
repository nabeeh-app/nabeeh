# Plan 001: Add ownership checks to report generation endpoints

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
- **Effort**: S
- **Risk**: HIGH
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `6f7019f`, 2026-06-14

## Why this matters

The `generateComment` and `bulkGenerate` endpoints fetch student and group data by UUID without verifying the student/group belongs to the authenticated teacher. Any teacher can supply an arbitrary UUID to generate AI report comments for another teacher's students, exfiltrating grades and attendance data through AI output. This is a cross-tenant data access vulnerability.

## Current state

- `backend/routes/reports.js:46-50` — `generateComment` looks up student by UUID with no teacher_id filter
- `backend/routes/reports.js:247-250` — `bulkGenerate` queries enrollments by group_id with no ownership check
- The project uses an enrollment chain for data access: `teacher → offerings → groups → enrollments → students`
- The `authenticateToken` middleware sets `req.user.teacherId`

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `cd backend && node -c routes/reports.js` | exit 0 |
| Test      | `cd backend && npm test` | passes |

## Scope

**In scope**:
- `backend/routes/reports.js`

**Out of scope**:
- `backend/routes/students.js`, `backend/routes/grades.js` — different endpoints, separate plan

## Steps

### Step 1: Add ownership check to `generateComment`

At `reports.js:48-50`, after finding the student, verify ownership by checking the student is enrolled in a group belonging to the teacher:

```js
// After line 50 (if (!student) return ...), add:
const { data: enrollment } = await supabaseAdmin
  .from('enrollments')
  .select('id, groups!inner(id, offerings!inner(teacher_id))')
  .eq('student_id', student_id)
  .eq('groups.offerings.teacher_id', teacherId)
  .limit(1)
  .maybeSingle();
if (!enrollment) {
  return res.status(404).json({ success: false, message: 'Student not found' });
}
```

**Verify**: `cd backend && node -c routes/reports.js` → exit 0

### Step 2: Add ownership check to `bulkGenerate`

At `reports.js:247-250`, before fetching enrollments, verify the group belongs to the teacher:

```js
// After line 245 (const { group_id } = req.body), add:
const { data: group } = await supabaseAdmin
  .from('groups')
  .select('id, offerings!inner(teacher_id)')
  .eq('id', group_id)
  .eq('offerings.teacher_id', teacherId)
  .maybeSingle();
if (!group) {
  return res.status(404).json({ success: false, message: 'Group not found' });
}
```

**Verify**: `cd backend && node -c routes/reports.js` → exit 0

### Step 3: Run tests

**Verify**: `cd backend && npm test` → all pass

## Test plan

- Existing auth tests should still pass
- Manual test: try to generate a report for a student not belonging to the teacher → expect 404
- Manual test: try bulk-generate for another teacher's group → expect 404

## Done criteria

- [ ] `cd backend && node -c routes/reports.js` exits 0
- [ ] `cd backend && npm test` exits 0
- [ ] `generateComment` returns 404 for students not owned by the teacher
- [ ] `bulkGenerate` returns 404 for groups not owned by the teacher
- [ ] `plans/README.md` status row updated

## STOP conditions

- The enrollment/group/offering join structure doesn't match the actual schema
- A step's verification fails twice after a reasonable fix attempt
