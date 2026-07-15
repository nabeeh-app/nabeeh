# Plan 100: Improve health check to reflect WhatsApp connectivity

> **Executor instructions**: Follow this plan step by step.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: reliability
- **Planned at**: commit `8ce4f6b`, 2026-06-18

## Why this matters

The `/health` endpoint always returns `200 OK` even if all WhatsApp sessions are disconnected. A load balancer pinging `/health` would route traffic to a node where WhatsApp is completely down. Enterprise deployments require liveness vs. readiness distinction.

## Current state

- `backend/server.js:74-90` — `/health` returns only process uptime/version
- `backend/server.js:109-134` — `/api/admin/whatsapp-health` exists but is admin-only
- No distinction between "process alive" and "WhatsApp connected"

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|-------------------------------------|
| Tests | `cd backend && npm test -- --testPathIgnorePatterns="real-db"` | all pass |

## Scope

**In scope**:
- `backend/server.js` — add `/ready` endpoint with WhatsApp status, enhance `/health`

**Out of scope**:
- Kubernetes liveness/readiness probe configuration (deployment concern)
- Frontend changes

## Steps

### Step 1: Add readiness endpoint

After the existing `/health` endpoint, add:

```js
app.get('/ready', (req, res) => {
  const sessions = sessionManager.getSessionsSnapshot();
  const connected = sessions.filter(s => s.status === 'connected').length;
  const isReady = connected > 0 || sessions.length === 0;

  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'READY' : 'NOT_READY',
    whatsappSessions: sessions.length,
    whatsappConnected: connected,
    timestamp: new Date().toISOString()
  });
});
```

**Verify**: `grep "'/ready'" backend/server.js` → 1 match

### Step 2: Enhance /health with WhatsApp summary

Add WhatsApp info to the existing health response:

```js
const whatsappSummary = sessionManager.getSessionsSnapshot();
// Add to the res.json:
whatsapp: {
  totalSessions: whatsappSummary.length,
  connectedSessions: whatsappSummary.filter(s => s.status === 'connected').length
}
```

**Verify**: `cd backend && npm test -- --testPathIgnorePatterns="real-db"` → all pass

## Done criteria

- [ ] `/ready` endpoint returns 503 when no WhatsApp sessions are connected
- [ ] `/ready` returns 200 when at least one session is connected or no sessions exist
- [ ] `/health` includes WhatsApp session summary
- [ ] `cd backend && npm test -- --testPathIgnorePatterns="real-db"` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- `sessionManager.getSessionsSnapshot()` is not available or returns unexpected format

## Maintenance notes

- `/health` = liveness (process alive). `/ready` = readiness (can serve WhatsApp). Use `/health` for K8s livenessProbe, `/ready` for readinessProbe.
- When no sessions exist (fresh server), `/ready` returns 200 — the server IS ready, it just has no paired sessions yet.
