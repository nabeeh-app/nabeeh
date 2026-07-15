# Plan 093: Add per-teacher rate limiting for WhatsApp endpoints

> **Executor instructions**: Follow this plan step by step.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `8ce4f6b`, 2026-06-18

## Why this matters

Current rate limiting is per-IP only. A teacher with multiple IPs can exceed limits. Multiple teachers behind a shared NAT (tutoring center) share a single rate bucket. The `/pair-code` endpoint has no per-teacher limit — an attacker could generate unlimited pairing codes. Enterprise tenants require per-tenant isolation.

## Current state

- `backend/middleware/security.js:9-20` — `createRateLimit()` uses `express-rate-limit` defaulting to per-IP
- `backend/middleware/security.js:33-34` — `whatsappLimiter`: 10 req/min per IP, production only
- `backend/routes/whatsapp.js` — all routes use `authenticateToken` which sets `req.user.id`
- No per-teacher key function exists

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|-------------------------------------|
| Tests | `cd backend && npm test -- --testPathIgnorePatterns="real-db"` | all pass |
| Lint | `cd backend && npx eslint middleware/security.js` | exit 0 |

## Scope

**In scope**:
- `backend/middleware/security.js` — add per-teacher rate limiters
- `backend/routes/whatsapp.js` — apply per-teacher limiter to pairing endpoints

**Out of scope**:
- Other route files (auth, students, etc.) — add later as needed
- Redis-backed rate limiting (use in-memory for now, note in maintenance)

## Steps

### Step 1: Add createTeacherRateLimit factory to security.js

After the existing `createRateLimit` function, add:

```js
function createTeacherRateLimit({ windowMs, max, message }) {
  const limiter = rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => req.user?.id || req.ip,
    handler: (req, res) => {
      res.status(429).json({ success: false, message: message || 'Too many requests', code: 'RATE_LIMIT' });
    },
    standardHeaders: true,
    legacyHeaders: false
  });
  return limiter;
}
```

Add two new limiters:

```js
const pairCodeLimiter = isProd ? createTeacherRateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  message: 'Too many pairing code requests. Try again in 5 minutes.'
}) : (req, res, next) => next();

const whatsappSendLimiter = isProd ? createTeacherRateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Message rate limit exceeded.'
}) : (req, res, next) => next();
```

Export both: add to `module.exports`.

**Verify**: `cd backend && node -e "const s = require('./middleware/security'); console.log(typeof s.pairCodeLimiter, typeof s.whatsappSendLimiter)"` → `function function`

### Step 2: Apply limiters to whatsapp.js routes

Import at top: `const { pairCodeLimiter, whatsappSendLimiter } = require('../middleware/security');`

Add `pairCodeLimiter` to `/pair-code` and `/pair` routes (after `authenticateToken`, before handler).
Add `whatsappSendLimiter` to `/send-to-number` route.

**Verify**: `cd backend && grep -c "pairCodeLimiter\|whatsappSendLimiter" routes/whatsapp.js` → 4+

### Step 3: Run full test suite

**Verify**: `cd backend && npm test -- --testPathIgnorePatterns="real-db"` → all pass

## Done criteria

- [ ] `cd backend && npm test -- --testPathIgnorePatterns="real-db"` exits 0
- [ ] `grep "pairCodeLimiter" backend/routes/whatsapp.js` returns 2 matches (pair + pair-code)
- [ ] `grep "whatsappSendLimiter" backend/routes/whatsapp.js` returns 1 match
- [ ] `plans/README.md` status row updated

## STOP conditions

- `req.user` is undefined in the key generator — authenticateToken middleware must run before the limiter
- Any test fails that isn't related to the rate limiter mock

## Maintenance notes

- In-memory rate limiting doesn't survive server restarts or share across processes. For horizontal scaling, migrate to Redis-backed (`rate-limit-redis`). The interface stays the same.
- Pairing code limit (3 per 5 min) is conservative — adjust based on real usage patterns.
