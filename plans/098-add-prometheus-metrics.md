# Plan 098: Add Prometheus-compatible metrics endpoint

> **Executor instructions**: Follow this plan step by step.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: observability
- **Planned at**: commit `8ce4f6b`, 2026-06-18

## Why this matters

No metrics endpoint exists. Enterprise operations require Prometheus-compatible metrics for monitoring message throughput, session health, error rates, and processing latency. Current observability is limited to unstructured log entries.

## Current state

- `backend/server.js:74-90` — health endpoint returns only uptime/version
- No `prom-client` or equivalent library installed
- No counters, histograms, or gauges anywhere in the codebase

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|-------------------------------------|
| Install | `cd backend && npm install prom-client` | exit 0 |
| Tests | `cd backend && npm test -- --testPathIgnorePatterns="real-db"` | all pass |

## Scope

**In scope**:
- `backend/lib/metrics.js` — new file: define Prometheus metrics
- `backend/server.js` — add `/metrics` endpoint
- `backend/routes/whatsapp.js` — instrument message processing
- `backend/lib/sessionManager.js` — instrument session count

**Out of scope**:
- Grafana dashboards (defer)
- Alert rules (defer)
- Frontend metrics

## Steps

### Step 1: Install prom-client

`cd backend && npm install prom-client`

**Verify**: `cd backend && node -e "require('prom-client')"` → no error

### Step 2: Create lib/metrics.js

Define these metrics:

```js
const promClient = require('prom-client');

const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const whatsappMessagesReceived = new promClient.Counter({
  name: 'whatsapp_messages_received_total',
  help: 'Total incoming WhatsApp messages',
  labelNames: ['teacher_id', 'intent']
});

const whatsappMessagesSent = new promClient.Counter({
  name: 'whatsapp_messages_sent_total',
  help: 'Total outgoing WhatsApp messages',
  labelNames: ['teacher_id', 'direction']
});

const whatsappProcessingDuration = new promClient.Histogram({
  name: 'whatsapp_message_processing_seconds',
  help: 'Time to process an incoming WhatsApp message',
  labelNames: ['teacher_id', 'intent']
});

const whatsappActiveSessions = new promClient.Gauge({
  name: 'whatsapp_active_sessions',
  help: 'Number of active WhatsApp sessions'
});

const whatsappSessionStatus = new promClient.Gauge({
  name: 'whatsapp_session_status',
  help: 'Session status (1=connected, 0=disconnected)',
  labelNames: ['teacher_id']
});

const geminiCalls = new promClient.Counter({
  name: 'gemini_calls_total',
  help: 'Total Gemini API calls',
  labelNames: ['result']
});

register.registerMetric(whatsappMessagesReceived);
register.registerMetric(whatsappMessagesSent);
register.registerMetric(whatsappProcessingDuration);
register.registerMetric(whatsappActiveSessions);
register.registerMetric(whatsappSessionStatus);
register.registerMetric(geminiCalls);

module.exports = {
  register,
  whatsappMessagesReceived,
  whatsappMessagesSent,
  whatsappProcessingDuration,
  whatsappActiveSessions,
  whatsappSessionStatus,
  geminiCalls
};
```

**Verify**: `cd backend && node -e "const m = require('./lib/metrics'); console.log(typeof m.register)"` → `object`

### Step 3: Add /metrics endpoint to server.js

Before the health check endpoint, add:

```js
const { register } = require('./lib/metrics');

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

**Verify**: `curl http://localhost:5000/metrics` (after server start) → Prometheus format output

### Step 4: Instrument whatsapp.js message processing

Import metrics at top of `whatsapp.js`. In `processIncomingMessage`:

```js
const endTimer = metrics.whatsappProcessingDuration.startTimer({ teacherId });
// ... existing processing ...
// After response is sent:
metrics.whatsappMessagesReceived.inc({ teacherId, intent: response?.intent || 'unknown' });
endTimer();
```

In the outgoing message path:
```js
metrics.whatsappMessagesSent.inc({ teacherId, direction: 'bot' });
```

**Verify**: `grep "whatsappMessagesReceived" backend/routes/whatsapp.js` → 1+ match

### Step 5: Instrument sessionManager

In sessionManager, update the gauge on session create/destroy:

```js
const metrics = require('./metrics');
// After this.sessions.set and this.sessions.delete:
metrics.whatsappActiveSessions.set(this.sessions.size);
```

**Verify**: `cd backend && npm test -- --testPathIgnorePatterns="real-db"` → all pass

## Done criteria

- [ ] `/metrics` endpoint returns Prometheus-format metrics
- [ ] `prom-client` in backend/package.json dependencies
- [ ] `cd backend && npm test -- --testPathIgnorePatterns="real-db"` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- `prom-client` fails to install (Node compatibility)
- Mock issues in tests — prom-client may need to be mocked in test files

## Maintenance notes

- The `/metrics` endpoint is unauthenticated. For production, either put it behind auth or use a separate internal port.
- Default metrics include Node.js process metrics (CPU, memory, event loop lag).
