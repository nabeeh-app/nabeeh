# Plan 097: Fix race condition in getOrCreateSession with proper mutex

> **Executor instructions**: Follow this plan step by step.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `8ce4f6b`, 2026-06-18

## Why this matters

`getOrCreateSession()` uses a polling-based dedup mechanism that busy-waits (50ms intervals for up to 10s). If the first creator takes > 10s, the second request falls through and creates a **second** session for the same teacher, leaking the first BaileysClient. Two concurrent requests can both pass the `pending.has()` check before either adds to `pending`. This can orphan WebSocket connections and auth state.

## Current state

- `backend/lib/sessionManager.js:87-105` — polling loop with 50ms intervals and 10s timeout
- `backend/lib/sessionManager.js:100` — `this.pending.add(teacherId)` AFTER the check, creating a TOCTOU window
- `backend/lib/sessionManager.js:163-165` — `this.pending.delete(teacherId)` in `finally`

The problematic flow:
1. Request A and B arrive simultaneously for same teacher
2. Both check `this.pending.has(teacherId)` → both false
3. Both add to `this.pending`
4. Both create BaileysClient instances
5. Second overwrites first in Map, first is orphaned

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|-------------------------------------|
| Tests | `cd backend && npm test -- --testPathIgnorePatterns="real-db"` | all pass |

## Scope

**In scope**:
- `backend/lib/sessionManager.js` — replace polling with Promise-based mutex

**Out of scope**:
- Database-level locking (single-server MVP, defer for horizontal scaling)
- Other concurrency issues in the codebase

## Steps

### Step 1: Replace pending Set with Promise-based mutex Map

At the top of the class, replace:

```js
this.pending = new Set();
```

With:

```js
this._pendingResolvers = new Map();
```

### Step 2: Rewrite the concurrency guard in getOrCreateSession

Replace the entire `if (this.pending.has(teacherId))` block and `this.pending.add(teacherId)` with:

```js
async getOrCreateSession(teacherId, { autoConnect = true } = {}) {
  if (this.sessions.has(teacherId)) {
    const session = this.sessions.get(teacherId);
    session.lastActive = Date.now();
    return session.client;
  }

  if (this._pendingResolvers.has(teacherId)) {
    return new Promise((resolve) => {
      const existing = this._pendingResolvers.get(teacherId);
      this._pendingResolvers.set(teacherId, [...existing, resolve]);
    });
  }

  this._pendingResolvers.set(teacherId, []);
  try {
    // Check session limit
    if (this.sessions.size >= this.maxSessions) {
      const evicted = await this._evictInactiveSession();
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
      // ... same as existing ...
    });

    this.emit('sessionCreated', { teacherId, client });
    logger.info('Session created', { teacherId, totalSessions: this.sessions.size });

    // Resolve all waiters
    const waiters = this._pendingResolvers.get(teacherId) || [];
    this._pendingResolvers.delete(teacherId);
    for (const resolve of waiters) {
      resolve(client);
    }

    return client;
  } catch (error) {
    // Reject all waiters on failure
    this._pendingResolvers.delete(teacherId);
    throw error;
  }
}
```

**Verify**: `grep -c "_pendingResolvers" backend/lib/sessionManager.js` → 5+

### Step 3: Run full test suite

**Verify**: `cd backend && npm test -- --testPathIgnorePatterns="real-db"` → all pass

## Done criteria

- [ ] `cd backend && npm test -- --testPathIgnorePatterns="real-db"` exits 0
- [ ] No `this.pending` references remain in sessionManager.js
- [ ] No `setTimeout(r, 50)` busy-wait pattern remains
- [ ] `plans/README.md` status row updated

## STOP conditions

- The concurrent-sessions test (`lib/__tests__/concurrent-sessions.spec.js`) fails — it tests `getOrCreateSession` for the same teacher concurrently
- The `pending` Set is referenced in any test that needs updating

## Maintenance notes

- This is a single-process mutex. For horizontal scaling, use DB advisory locks or Redis.
- The waiters pattern means if session creation fails, all concurrent waiters get the error propagated (they must catch it themselves).
