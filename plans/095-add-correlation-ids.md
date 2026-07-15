# Plan 095: Add correlation IDs for end-to-end message tracing

> **Executor instructions**: Follow this plan step by step.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: observability
- **Planned at**: commit `8ce4f6b`, 2026-06-18

## Why this matters

There is no way to trace a WhatsApp message from receipt → processing → response. No `traceId` or `requestId` exists anywhere in the logging. Enterprise operations require correlation IDs to debug message flow issues across multiple log entries.

## Current state

- `backend/lib/logger.js` — Winston JSON logger with `defaultMeta: { service: 'nabeeh-backend' }`, no request ID
- `backend/middleware/logger.js` — logs request duration but no ID
- `backend/routes/whatsapp.js:50` — logs incoming message with no correlation
- Convention: Winston structured logging, JSON format

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|-------------------------------------|
| Tests | `cd backend && npm test -- --testPathIgnorePatterns="real-db"` | all pass |

## Scope

**In scope**:
- `backend/lib/logger.js` — add correlation ID support
- `backend/middleware/logger.js` — generate request ID per HTTP request
- `backend/routes/whatsapp.js` — generate message ID for incoming WhatsApp messages
- `backend/lib/whatsappQuery.js` — accept and log correlation ID

**Out of scope**:
- Frontend correlation ID propagation
- Distributed tracing (Jaeger/Zipkin) — defer
- Prometheus metrics (separate plan)

## Steps

### Step 1: Add requestId generation to HTTP middleware

In `backend/middleware/logger.js`, generate a unique ID per request:

```js
const crypto = require('crypto');

// At the start of the middleware function, before logging:
const requestId = req.headers['x-request-id'] || crypto.randomUUID();
req.requestId = requestId;
res.set('X-Request-Id', requestId);
```

Add `requestId` to the Winston log metadata.

**Verify**: `grep "requestId" backend/middleware/logger.js` → 2+ matches

### Step 2: Add messageId for WhatsApp message processing

In `backend/routes/whatsapp.js`, in `processIncomingMessage`, generate a correlation ID:

```js
const crypto = require('crypto');
// At the top of processIncomingMessage:
const messageId = crypto.randomUUID();
const logContext = { messageId, teacherId, phone: redactPhone(phone) };
```

Replace bare `logger.info/error` calls in `processIncomingMessage` and `handleBotMessage` with ones that include `logContext`.

**Verify**: `grep "logContext" backend/routes/whatsapp.js` → 3+ matches

### Step 3: Run full test suite

**Verify**: `cd backend && npm test -- --testPathIgnorePatterns="real-db"` → all pass

## Done criteria

- [ ] `cd backend && npm test -- --testPathIgnorePatterns="real-db"` exits 0
- [ ] HTTP requests get `X-Request-Id` header in response
- [ ] WhatsApp message processing logs include `messageId`
- [ ] `plans/README.md` status row updated

## STOP conditions

- `crypto.randomUUID()` not available in Node version (requires Node 15.7+)
- Test mocks break due to new log fields

## Maintenance notes

- `requestId` is generated server-side. If the frontend sends `X-Request-Id`, it's reused (enables frontend→backend tracing).
- `messageId` is separate from WhatsApp's `messageId` — it's a server-side UUID for internal correlation.
