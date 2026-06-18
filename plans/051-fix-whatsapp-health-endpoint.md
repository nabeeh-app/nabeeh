# Plan 051: Fix broken /api/admin/whatsapp-health endpoint

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat HEAD -- backend/server.js`
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

The admin health endpoint always returns `{ status: 'disconnected' }` because it destructures `baileysClient` from a module that exports a class (`BaileysClient`), not an instance. The `TypeError` is caught silently, masking real connectivity issues from admins.

## Current state

- `backend/server.js:112-134`:
  ```js
  app.get('/api/admin/whatsapp-health', authenticateToken, requireRole('admin'), (req, res) => {
    try {
      const { baileysClient } = require('./lib/baileys');
      const status = baileysClient.getStatus();
      // ...
    } catch (error) {
      res.json({
        success: true,
        data: { status: 'disconnected', phone: null, lastCheck: new Date().toISOString() }
      });
    }
  });
  ```
- `backend/lib/baileys.js` exports `{ BaileysClient }` (a class), not `{ baileysClient }`.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 235 pass            |

## Scope

**In scope**:
- `backend/server.js` — fix the health endpoint to use sessionManager

**Out of scope**: No other files

## Steps

### Step 1: Replace the health endpoint to use sessionManager

Replace the entire `app.get('/api/admin/whatsapp-health', ...)` block (lines 112-134) with:

```js
app.get('/api/admin/whatsapp-health', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const sessionManager = require('./lib/sessionManager');
    const sessions = Array.from(sessionManager.sessions.entries()).map(([teacherId, session]) => ({
      teacherId,
      status: session.client.getStatus().status || 'disconnected',
      phone: session.client.getStatus().phone || null,
      lastActive: session.lastActive ? new Date(session.lastActive).toISOString() : null
    }));

    res.json({
      success: true,
      data: {
        totalSessions: sessions.length,
        activeSessions: sessions.filter(s => s.status === 'connected').length,
        sessions,
        lastCheck: new Date().toISOString()
      }
    });
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
});
```

**Verify**: `cd backend && npm test` → 235 pass

## Done criteria

- [ ] Health endpoint uses `sessionManager` instead of destructuring `baileysClient`
- [ ] Response includes aggregate session stats
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `sessionManager` no longer exports sessions Map
