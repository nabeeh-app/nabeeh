# Plan 086: Add logger.error to server.js health endpoint catch block

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 52e1011..HEAD -- backend/server.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `52e1011`, 2026-06-18

## Why this matters

The `/api/admin/whatsapp-health` catch block returns a default empty response without logging. If `getSessionsSnapshot()` throws, the admin sees `totalSessions: 0` which looks like no sessions, not an error.

## Current state

- `backend/server.js:122-132`:
  ```js
  } catch (error) {
    res.json({
      success: true,
      data: {
        totalSessions: 0,
        activeSessions: 0,
        sessions: [],
        lastCheck: new Date().toISOString()
      }
    });
  }
  ```

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244 pass            |

## Scope

**In scope**:
- `backend/server.js` — add logger.error in catch block

**Out of scope**: No other files

## Steps

### Step 1: Add error logging

In `backend/server.js`, add a logger call in the catch block. First, ensure the logger is imported at the top of the file (check if `winston` or a logger module is already imported — use the same pattern):

```js
} catch (error) {
  const logger = require('./lib/logger');
  logger.error('WhatsApp health endpoint error', { error: error.message });
  res.json({
    success: true,
    data: {
      totalSessions: 0,
      activeSessions: 0,
      sessions: [],
      lastCheck: new Date().toISOString()
    }
  });
}
```

If a logger import already exists at the top, use that instead of requiring inside the catch.

**Verify**: `cd backend && npm test` → 244 pass

## Done criteria

- [ ] Catch block logs the error before returning default response
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If the health endpoint no longer exists
