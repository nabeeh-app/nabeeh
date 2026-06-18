# Plan 069: Redact PII (phone numbers, JIDs) from info-level logs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d760576..HEAD -- backend/lib/baileys.js backend/routes/whatsapp.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `d760576`, 2026-06-18

## Why this matters

Phone numbers and WhatsApp JIDs appear in info-level logs. If logs are shipped to external aggregators, this constitutes PII storage beyond debugging necessity.

## Current state

- `backend/lib/baileys.js:142` — logs `userId` (full JID) and `phone`
- `backend/lib/baileys.js:254` — logs `phoneNumber` in pairing code request
- `backend/lib/baileys.js:270` — logs `to` and full `jid` on every message send
- `backend/routes/whatsapp.js:49` — logs `from` (sender JID) for every incoming message

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244 pass            |

## Scope

**In scope**:
- `backend/lib/baileys.js` — redact phone in logs
- `backend/routes/whatsapp.js` — redact sender JID in logs

**Out of scope**: No other files

## Steps

### Step 1: Create a helper function (or use inline)

```js
function redactPhone(phone) {
  if (!phone || phone.length < 4) return '****';
  return '*'.repeat(phone.length - 4) + phone.slice(-4);
}
```

### Step 2: Apply to baileys.js log sites

- Line 142: `phone: redactPhone(this.connectedPhone)`
- Line 254: `phoneNumber: redactPhone(phoneNumber)` (already has `codeLength` from plan 048)
- Line 270: `to: redactPhone(cleaned)` — remove `jid` from log entirely

### Step 3: Apply to whatsapp.js log site

- Line 49: Remove `from` from info-level log, keep at debug level only

**Verify**: `cd backend && npm test` → 244 pass

## Done criteria

- [ ] Phone numbers are redacted (last 4 digits only) in info-level logs
- [ ] Full JIDs are not logged at info level
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If the log sites no longer exist
