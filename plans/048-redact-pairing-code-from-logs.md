# Plan 048: Redact pairing code from logs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat HEAD -- backend/lib/baileys.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `6e6ee99`, 2026-06-18

## Why this matters

The pairing code is a transient credential that grants full WhatsApp account access. Logging it in plaintext means anyone with access to log files (ops, monitoring, log aggregation) can extract pairing codes and hijack WhatsApp sessions.

## Current state

- `backend/lib/baileys.js:254`:
  ```js
  logger.info('Pairing code requested', { phoneNumber, code, teacherId: this.teacherId });
  ```

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 235 pass            |

## Scope

**In scope**:
- `backend/lib/baileys.js` — redact `code` from log

**Out of scope**: No other files

## Steps

### Step 1: Remove code from log fields

In `backend/lib/baileys.js:254`, change:

```js
logger.info('Pairing code requested', { phoneNumber, code, teacherId: this.teacherId });
```

To:

```js
logger.info('Pairing code requested', { phoneNumber, codeLength: code.length, teacherId: this.teacherId });
```

**Verify**: `cd backend && npm test` → 235 pass

## Done criteria

- [ ] `code` is not logged anywhere in `baileys.js`
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `requestPairingCode` no longer exists
