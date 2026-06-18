# Plan 065: Await _evictInactiveSession before creating new session

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d760576..HEAD -- backend/lib/sessionManager.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `d760576`, 2026-06-18

## Why this matters

`_evictInactiveSession` fires `destroySession` without awaiting. The caller proceeds to create a new session while the old one is still being torn down. Two BaileysClient instances could exist simultaneously with the evicted one still running.

## Current state

- `backend/lib/sessionManager.js:337-343`:
  ```js
  if (oldestTeacherId) {
    logger.warn('Evicting inactive session to make room', { teacherId: oldestTeacherId });
    this.destroySession(oldestTeacherId).catch(err =>
      logger.error('Error evicting session', { teacherId: oldestTeacherId, error: err.message })
    );
    return true;
  }
  ```

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244 pass            |

## Scope

**In scope**:
- `backend/lib/sessionManager.js` — await the destroySession call

**Out of scope**: No other files

## Steps

### Step 1: Await destroySession and handle errors

Replace the fire-and-forget with:

```js
if (oldestTeacherId) {
  logger.warn('Evicting inactive session to make room', { teacherId: oldestTeacherId });
  try {
    await this.destroySession(oldestTeacherId);
  } catch (err) {
    logger.error('Error evicting session', { teacherId: oldestTeacherId, error: err.message });
  }
  return true;
}
```

**Verify**: `cd backend && npm test` → 244 pass

## Done criteria

- [ ] `_evictInactiveSession` awaits `destroySession` before returning
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `_evictInactiveSession` no longer exists
