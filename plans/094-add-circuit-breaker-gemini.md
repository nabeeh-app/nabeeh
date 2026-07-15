# Plan 094: Add circuit breaker for Gemini AI and timeout for outgoing messages

> **Executor instructions**: Follow this plan step by step.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: reliability
- **Planned at**: commit `8ce4f6b`, 2026-06-18

## Why this matters

If Gemini API is down or slow, every incoming message that falls through to the "default" intent handler blocks waiting for Gemini with no timeout. This stalls all message processing for all teachers. Similarly, `sendMessage()` in BaileysClient has no timeout — a flaky WebSocket can block indefinitely. Enterprise systems require circuit breakers to prevent cascade failures.

## Current state

- `backend/lib/aiResponder.js:36-45` — bare `axios.post()` with no timeout, no retry, no circuit breaker
- `backend/lib/baileys.js:331-348` — `sendMessage()` calls `this.sock.sendMessage()` once, throws on failure, no timeout
- Convention: Winston logging, standard error handling

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|-------------------------------------|
| Tests | `cd backend && npm test -- --testPathIgnorePatterns="real-db"` | all pass |

## Scope

**In scope**:
- `backend/lib/aiResponder.js` — add timeout + circuit breaker
- `backend/lib/baileys.js` — add timeout to `sendMessage()`

**Out of scope**:
- Adding a full circuit breaker library (opossum, etc.) — use a lightweight in-process implementation
- Supabase circuit breaker (separate concern, defer)

## Steps

### Step 1: Add timeout to Gemini axios call

In `backend/lib/aiResponder.js`, add `timeout: 10000` to the axios config object (after `headers`):

```js
const response = await axios.post(GEMINI_URL, {
  contents: [{ parts: [{ text: prompt }] }]
}, {
  headers: { 'x-goog-api-key': GEMINI_API_KEY, 'Content-Type': 'application/json' },
  timeout: 10000
});
```

**Verify**: `grep "timeout: 10000" backend/lib/aiResponder.js` → 1 match

### Step 2: Add simple circuit breaker state for Gemini

Add at the top of aiResponder.js (after the `GEMINI_API_KEY` line):

```js
let geminiFailCount = 0;
let geminiCircuitOpen = false;
const GEMINI_MAX_FAILURES = 5;
const GEMINI_COOLDOWN_MS = 60 * 1000;
let geminiResetTimer = null;
```

In the `catch` block of `generateResponse`, add:

```js
geminiFailCount++;
if (geminiFailCount >= GEMINI_MAX_FAILURES && !geminiCircuitOpen) {
  geminiCircuitOpen = true;
  logger.error('Gemini circuit breaker OPEN', { failures: geminiFailCount });
  geminiResetTimer = setTimeout(() => {
    geminiCircuitOpen = false;
    geminiFailCount = 0;
    logger.info('Gemini circuit breaker CLOSED (cooldown expired)');
  }, GEMINI_COOLDOWN_MS);
  geminiResetTimer.unref();
}
```

At the top of `generateResponse` (after the key check), add:

```js
if (geminiCircuitOpen) {
  logger.warn('Gemini circuit breaker open, skipping AI call');
  return null;
}
```

On successful Gemini response, add: `geminiFailCount = 0;`

**Verify**: `grep -c "geminiCircuitOpen" backend/lib/aiResponder.js` → 3+

### Step 3: Add timeout to sendMessage in baileys.js

In `backend/lib/baileys.js`, wrap the `sendMessage` call with a timeout:

```js
const sendPromise = this.sock.sendMessage(jid, { text: content });
const result = await Promise.race([
  sendPromise,
  new Promise((_, reject) => setTimeout(() => reject(new Error('sendMessage timeout')), 15000))
]);
```

**Verify**: `grep "sendMessage timeout" backend/lib/baileys.js` → 1 match

### Step 4: Run full test suite

**Verify**: `cd backend && npm test -- --testPathIgnorePatterns="real-db"` → all pass

## Done criteria

- [ ] `cd backend && npm test -- --testPathIgnorePatterns="real-db"` exits 0
- [ ] Gemini axios call has `timeout: 10000`
- [ ] Circuit breaker logic present in aiResponder.js (open/close/reset)
- [ ] sendMessage has 15s timeout race
- [ ] `plans/README.md` status row updated

## STOP conditions

- Tests fail after adding timeout to sendMessage — the mock may need adjustment
- The circuit breaker state persists incorrectly between test runs — ensure module reset in `beforeEach`

## Maintenance notes

- This is a lightweight circuit breaker — not distributed. If running multiple server processes, each has its own breaker state. For distributed, use Redis.
- The 10s Gemini timeout and 60s cooldown are starting values. Tune based on P99 latency data.
- When Gemini returns `null` (circuit open or timeout), `handleBotMessage` returns the error response text — parent gets "sorry, error processing" instead of hanging.
