# Plan D2: Add background job processing for bulk AI operations

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6f7019f..HEAD -- backend/routes/reports.js backend/lib/cron.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: Plan 009 (bulk report parallelism)
- **Category**: direction
- **Planned at**: commit `6f7019f`, 2026-06-14

## Why this matters

Bulk AI operations (report generation, anomaly detection with AI analysis) currently run synchronously in HTTP handlers, blocking responses for 30+ seconds and likely timing out. The existing cron infrastructure could be extended to process these as background jobs.

## Current state

- `backend/routes/reports.js:257-285` — `bulkGenerate` blocks HTTP for entire duration
- `backend/lib/cron.js:32-38` — `generateAllDigests` processes teachers sequentially
- `backend/lib/cron.js:86-108` — `detectAllAnomalies` same pattern

## Scope

**In scope**:
- `backend/lib/jobQueue.js` (new file)
- `backend/routes/reports.js`
- `backend/lib/cron.js`

## Steps

### Step 1: Create simple in-memory job queue

Create `backend/lib/jobQueue.js`:

```js
const jobs = new Map();

function createJob(type, payload) {
  const id = crypto.randomUUID();
  jobs.set(id, { id, type, payload, status: 'pending', result: null, error: null });
  processJob(id); // fire and forget
  return id;
}

function getJob(id) {
  return jobs.get(id) || null;
}

async function processJob(id) {
  const job = jobs.get(id);
  if (!job) return;
  job.status = 'processing';
  try {
    // Route to handler based on job.type
    job.status = 'completed';
  } catch (err) {
    job.status = 'failed';
    job.error = err.message;
  }
}

module.exports = { createJob, getJob };
```

### Step 2: Add job status endpoint to reports router

```js
router.get('/jobs/:jobId', authenticateToken, (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
  res.json({ success: true, data: job });
});
```

### Step 3: Make bulkGenerate return job ID immediately

```js
const bulkGenerate = async (req, res) => {
  const jobId = createJob('bulk-report', { group_id, teacherId });
  res.json({ success: true, data: { job_id: jobId, status: 'pending' } });
};
```

### Step 4: Update frontend to poll for completion

In `ReportGenerator.tsx`, after calling bulkGenerate:
1. Store the `job_id`
2. Poll `GET /reports/jobs/:jobId` every 2 seconds
3. Show progress UI
4. When `status === 'completed'`, show results

## Done criteria

- [ ] `jobQueue.js` exists and exports `createJob`, `getJob`
- [ ] `bulkGenerate` returns immediately with job ID
- [ ] Frontend polls for job completion
- [ ] Job status is visible to the user
- [ ] `plans/README.md` status row updated

## STOP conditions

- In-memory queue is lost on server restart (acceptable for v1; document as known limitation)
- Job processing takes >5 minutes (indicates a deeper problem)
