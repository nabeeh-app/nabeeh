# Plan 081: Fix _evictInactiveSession returning true on failure

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 52e1011..HEAD -- backend/lib/sessionManager.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `52e1011`, 2026-06-18

## Why this matters

`_evictInactiveSession` returns `true` even when `destroySession` throws. The caller at line 104 thinks eviction succeeded and proceeds to create a new session despite still being at the session limit.

## Current state

- `backend/lib/sessionManager.js:360-367`:
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

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244 pass            |

## Scope

**In scope**:
- `backend/lib/sessionManager.js` — return `false` in catch block

**Out of scope**: No other files

## Steps

### Step 1: Return false on eviction failure

In `backend/lib/sessionManager.js`, add `return false` inside the catch block:

```js
if (oldestTeacherId) {
  logger.warn('Evicting inactive session to make room', { teacherId: oldestTeacherId });
  try {
    await this.destroySession(oldestTeacherId);
  } catch (err) {
    logger.error('Error evicting session', { teacherId: oldestTeacherId, error: err.message });
    return false;
  }
  return true;
}
```

**Verify**: `cd backend && npm test` → 244 pass

## Done criteria

- [ ] `_evictInactiveSession` returns `false` when `destroySession` throws
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `_evictInactiveSession` no longer exists
