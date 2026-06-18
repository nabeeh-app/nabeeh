# Plan 041: Emit sessionCreated event in sessionManager

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6e6ee99..HEAD -- backend/lib/sessionManager.js backend/routes/whatsapp.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6e6ee99`, 2026-06-18

## Why this matters

When a new teacher pairs their phone via `getOrCreateSession()`, the session is created and `connect()` is called, but the `sessionCreated` event is never emitted. This means `whatsapp.js:58` which listens for `sessionManager.on('sessionCreated', ...)` never fires, so `setupSessionMessageHandler()` is never called for newly created sessions. Result: messages from parents are silently lost for newly paired teachers until server restart.

## Current state

- `backend/routes/whatsapp.js:58` — listens for event:
  ```js
  sessionManager.on('sessionCreated', ({ teacherId, client }) => {
    setupSessionMessageHandler(teacherId, client);
  });
  ```
- `backend/lib/sessionManager.js:121` — end of `getOrCreateSession()`, no emit:
  ```js
  logger.info('Session created', { teacherId, totalSessions: this.sessions.size });
  return client;
  ```
- The event is never emitted anywhere in `sessionManager.js`.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 226 pass            |

## Scope

**In scope**:
- `backend/lib/sessionManager.js` — add emit call

**Out of scope**:
- `backend/routes/whatsapp.js` — already correct, just needs the event to fire
- No other files

## Steps

### Step 1: Emit sessionCreated event after client setup

In `backend/lib/sessionManager.js`, after the `connection.update` listener is attached (line 119) and before the `logger.info` call (line 121), add:

```js
this.emit('sessionCreated', { teacherId, client });
```

The final block should read:

```js
    });

    // Notify listeners (e.g., whatsapp.js message handler setup)
    this.emit('sessionCreated', { teacherId, client });

    logger.info('Session created', { teacherId, totalSessions: this.sessions.size });
    return client;
  }
```

**Verify**: `cd backend && npm test` → 226 pass

## Test plan

- No new tests needed — this is a one-line fix. The existing test suite mocks sessionManager so it won't catch this directly, but the fix is trivially correct by inspection.

## Done criteria

- [ ] `this.emit('sessionCreated', { teacherId, client })` exists in `getOrCreateSession()`
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `getOrCreateSession()` no longer exists or has been renamed
- If `whatsapp.js` no longer listens for `sessionCreated`
