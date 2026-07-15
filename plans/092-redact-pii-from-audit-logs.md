# Plan 092: Redact PII from audit logs and debug logs in whatsapp.js

> **Executor instructions**: Follow this plan step by step.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `8ce4f6b`, 2026-06-18

## Why this matters

`whatsapp.js:51` logs raw JIDs (`201234567890@s.whatsapp.net`) at DEBUG level. `whatsapp.js:132,653` stores raw phone numbers in `action_audit_log.metadata` as unencrypted JSONB. These are PII that should be redacted. `baileys.js` already has `redactPhone()` — reuse it.

## Current state

- `backend/routes/whatsapp.js:51` — `logger.debug('Incoming WhatsApp message detail', { from, ... })` logs full JID
- `backend/routes/whatsapp.js:132` — `metadata: { phone, ... }` stores raw phone in audit log
- `backend/routes/whatsapp.js:653` — same pattern for outgoing audit
- `backend/lib/baileys.js:11-14` — `redactPhone()` already exists: keeps last 4 digits, replaces rest with `*`
- Convention from AGENTS.md: "No secrets logged (use Winston with redaction)"

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|-------------------------------------|
| Tests | `cd backend && npm test -- --testPathIgnorePatterns="real-db"` | all pass |

## Scope

**In scope**:
- `backend/routes/whatsapp.js` — redact phone numbers in debug log and audit metadata

**Out of scope**:
- `backend/lib/baileys.js` — already redacts
- `backend/lib/whatsappQuery.js` — no PII logging

## Steps

### Step 1: Import redactPhone from baileys.js

At the top of `backend/routes/whatsapp.js`, add:

```js
const { redactPhone } = require('../lib/baileys');
```

Note: `redactPhone` is not currently exported. First export it from `baileys.js` by adding it to `module.exports`:

```js
module.exports = { BaileysClient, redactPhone };
```

**Verify**: `cd backend && node -e "const {redactPhone}=require('./lib/baileys'); console.log(redactPhone('201234567890'))"` → `*******7890`

### Step 2: Redact in debug log

Line ~51: Change `{ from, bodyLength: body.length, teacherId }` to `{ from: redactPhone(from.split('@')[0]), bodyLength: body.length, teacherId }`

**Verify**: `grep "redactPhone" backend/routes/whatsapp.js` → 3+ matches

### Step 3: Redact in audit metadata

Lines ~132 and ~653: Change `phone` to `phone: redactPhone(phone)` and `phone: redactPhone(cleaned)` respectively.

**Verify**: `cd backend && npm test -- --testPathIgnorePatterns="real-db"` → all pass

## Done criteria

- [ ] `cd backend && npm test -- --testPathIgnorePatterns="real-db"` exits 0
- [ ] `grep -c "redactPhone" backend/routes/whatsapp.js` → 3+
- [ ] No raw phone numbers in log/audit calls within whatsapp.js
- [ ] `plans/README.md` status row updated

## STOP conditions

- `redactPhone` is not exported from `baileys.js` — add the export first
- Any test fails after the change

## Maintenance notes

- Audit logs now store redacted phones. This is a trade-off: less useful for debugging, but GDPR-compliant. If the raw phone is needed for operational queries, use the `conversations` table instead (which is already teacher-scoped).
