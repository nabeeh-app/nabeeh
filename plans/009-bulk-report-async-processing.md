# Plan 009: Make bulk report generation non-blocking

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6f7019f..HEAD -- backend/routes/reports.js frontend/src/components/reports/ReportGenerator.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `6f7019f`, 2026-06-14

## Why this matters

`bulkGenerate` loops over all enrollments sequentially, calling the AI API per student with a 100ms throttle. A 30-student class takes 30+ seconds, likely timing out the HTTP request (30s client timeout). The feature is unusable for classes >25 students.

## Current state

- `backend/routes/reports.js:257-285` — sequential loop with `setTimeout` throttle
- `frontend/src/components/reports/ReportGenerator.tsx:82-83` — calls `apiClient.bulkGenerateReports`

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `cd backend && node -c routes/reports.js` | exit 0 |
| Typecheck | `cd frontend && npx tsc --noEmit` | exit 0 |

## Scope

**In scope**:
- `backend/routes/reports.js` (bulkGenerate handler)
- `frontend/src/components/reports/ReportGenerator.tsx`

**Out of scope**:
- Full job queue infrastructure — out of scope for this plan

## Steps

### Step 1: Add controlled parallelism to `bulkGenerate`

Replace the sequential loop with `Promise.all` limited to 3 concurrent AI calls:

```js
const CONCURRENCY = 3;
const results = [];
for (let i = 0; i < enrollments.length; i += CONCURRENCY) {
  const batch = enrollments.slice(i, i + CONCURRENCY);
  const batchResults = await Promise.all(batch.map(async (enrollment) => {
    // ... existing generation logic per student
  }));
  results.push(...batchResults);
}
```

Remove the `setTimeout` throttle (line 281).

**Verify**: `cd backend && node -c routes/reports.js` → exit 0

### Step 2: Return progress indicator in response

After processing all students, include a count in the response:

```js
res.json({
  success: true,
  data: {
    drafts: results.filter(Boolean),
    total: enrollments.length,
    generated: results.filter(Boolean).length,
  },
});
```

**Verify**: `cd backend && node -c routes/reports.js` → exit 0

### Step 3: Update frontend to handle the response shape

In `ReportGenerator.tsx`, update the response handling to match the new shape (if it differs from current).

**Verify**: `cd frontend && npx tsc --noEmit` → exit 0

## Test plan

- Bulk generate for a group with 5 students → should complete in <10 seconds
- Verify all drafts are created in the DB
- Verify the response includes `total` and `generated` counts

## Done criteria

- [ ] `cd backend && node -c routes/reports.js` exits 0
- [ ] `cd frontend && npx tsc --noEmit` exits 0
- [ ] Bulk generation for 30 students completes in <30 seconds
- [ ] Response includes progress counts
- [ ] `plans/README.md` status row updated

## STOP conditions

- AI service doesn't support concurrent calls (rate limiting)
- Supabase connection pool exhausts with parallelism >3
