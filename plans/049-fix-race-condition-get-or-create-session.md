# Plan 049: Fix race condition in getOrCreateSession

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

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6e6ee99`, 2026-06-18

## Why this matters

Two concurrent requests for the same teacherId both pass the `has()` check, both create a new BaileysClient, and both call `connect()`. The second silently overwrites the first in the Map. The first client's socket is orphaned — listeners still fire, memory not freed, and the teacher receives duplicate messages during reconnection.

## Current state

- `backend/lib/sessionManager.js:67-89`:
  ```js
  async getOrCreateSession(teacherId, { autoConnect = true } = {}) {
    if (this.sessions.has(teacherId)) {
      const session = this.sessions.get(teacherId);
      session.lastActive = Date.now();
      return session.client;
    }
    // ... creates new client and sets in Map
  }
  ```

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 235 pass            |

## Scope

**In scope**:
- `backend/lib/sessionManager.js` — add pending-creation guard

**Out of scope**: No other files

## Steps

### Step 1: Add a pending set to track in-flight session creations

At the top of the class constructor (around line 20, after `this.maxSessions`), add:

```js
this.pending = new Set();
```

### Step 2: Guard getOrCreateSession with the pending set

Replace the `getOrCreateSession` method (lines 67-126) with:

```js
async getOrCreateSession(teacherId, { autoConnect = true } = {}) {
  if (this.sessions.has(teacherId)) {
    const session = this.sessions.get(teacherId);
    session.lastActive = Date.now();
    return session.client;
  }

  // Wait if another request is already creating this session
  if (this.pending.has(teacherId)) {
    // Poll until session appears or timeout
    const start = Date.now();
    while (!this.sessions.has(teacherId) && Date.now() - start < 10000) {
      await new Promise(r => setTimeout(r, 50));
    }
    if (this.sessions.has(teacherId)) {
      return this.sessions.get(teacherId).client;
    }
    // Timeout — fall through to create
  }

  this.pending.add(teacherId);
  try {
    // Check session limit
    if (this.sessions.size >= this.maxSessions) {
      const evicted = this._evictInactiveSession();
      if (!evicted) {
        throw new Error(`Maximum concurrent sessions reached (${this.maxSessions}). Disconnect a session first.`);
      }
    }

    const client = new BaileysClient(teacherId);
    this.sessions.set(teacherId, {
      client,
      status: 'disconnected',
      lastActive: Date.now(),
      createdAt: Date.now()
    });

    // Update database
    await supabaseAdmin.from('whatsapp_sessions').upsert({
      teacher_id: teacherId,
      status: 'disconnected'
    }, { onConflict: 'teacher_id' });

    if (autoConnect) {
      await client.connect().catch(err => {
        logger.error('Failed to auto-connect session', { teacherId, error: err.message });
      });
    }

    // Track connection events from client
    client.on('connection.update', (update) => {
      const session = this.sessions.get(teacherId);
      if (session) {
        session.status = update.status;
        session.lastActive = Date.now();

        supabaseAdmin.from('whatsapp_sessions').update({
          status: update.status,
          phone: update.phone || null,
          last_active: new Date().toISOString()
        }).eq('teacher_id', teacherId).catch(err =>
          logger.error('Failed to update session status', { teacherId, error: err.message })
        );
      }
    });

    // Notify listeners (e.g., whatsapp.js message handler setup)
    this.emit('sessionCreated', { teacherId, client });

    logger.info('Session created', { teacherId, totalSessions: this.sessions.size });
    return client;
  } finally {
    this.pending.delete(teacherId);
  }
}
```

**Verify**: `cd backend && npm test` → 235 pass

## Done criteria

- [ ] `this.pending` Set exists in constructor
- [ ] `getOrCreateSession` uses `this.pending` to prevent race conditions
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `getOrCreateSession` no longer exists or has been renamed
