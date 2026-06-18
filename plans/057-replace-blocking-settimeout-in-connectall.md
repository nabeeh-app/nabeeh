# Plan 057: Replace blocking setTimeout in connectAll with non-blocking approach

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat HEAD -- backend/lib/sessionManager.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `6e6ee99`, 2026-06-18

## Why this matters

`connectAll()` uses `await new Promise(resolve => setTimeout(resolve, 500))` inside a for-loop. For 50 sessions, this blocks the event loop for 25 seconds during startup. Other connections and requests are delayed.

## Current state

- `backend/lib/sessionManager.js:198-211`:
  ```js
  for (let i = 0; i < dbSessions.length; i++) {
    const { teacher_id } = dbSessions[i];
    try {
      await this.getOrCreateSession(teacher_id, { autoConnect: true });
    } catch (err) {
      logger.error('Failed to restore session', { teacherId: teacher_id, error: err.message });
    }
    if (i < dbSessions.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  ```

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 235 pass            |

## Scope

**In scope**:
- `backend/lib/sessionManager.js` — replace blocking loop with staggered parallel connects

**Out of scope**: No other files

## Steps

### Step 1: Replace the sequential loop with staggered parallel connects

Replace lines 198-211 with:

```js
// Stagger connections: connect in batches of 5 with 500ms between batches
const BATCH_SIZE = 5;
for (let i = 0; i < dbSessions.length; i += BATCH_SIZE) {
  const batch = dbSessions.slice(i, i + BATCH_SIZE);
  await Promise.allSettled(
    batch.map(({ teacher_id }) =>
      this.getOrCreateSession(teacher_id, { autoConnect: true }).catch(err => {
        logger.error('Failed to restore session', { teacherId: teacher_id, error: err.message });
      })
    )
  );
  // Wait between batches (not after the last batch)
  if (i + BATCH_SIZE < dbSessions.length) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}
```

**Verify**: `cd backend && npm test` → 235 pass

## Done criteria

- [ ] `connectAll` uses batched parallel connects instead of sequential blocking
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `connectAll` no longer exists
