# Plan 059: Add unit tests for BaileysClient class

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat HEAD -- backend/lib/baileys.js backend/lib/__tests__/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `6e6ee99`, 2026-06-18

## Why this matters

The core WhatsApp connection layer (`BaileysClient`) has zero test coverage. Reconnect loops, watchdog false-positive disconnects, credential cleanup on logout, and QR expiry timer logic are all unverified.

## Current state

- `backend/lib/baileys.js` — 357 lines, zero test coverage
- `backend/lib/__tests__/` — exists (has `auth.spec.js`, `sessionManager.spec.js`)

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 235+ pass           |

## Scope

**In scope**:
- `backend/lib/__tests__/baileys.spec.js` — new test file

**Out of scope**:
- `backend/lib/baileys.js` — no changes needed

## Steps

### Step 1: Create test file with mocked Baileys dependencies

Create `backend/lib/__tests__/baileys.spec.js`:

```js
jest.mock('baileys', () => ({
  default: jest.fn(),
  useMultiFileAuthState: jest.fn(),
  makeCacheableSignalKeyStore: jest.fn(),
  DisconnectReason: {
    loggedOut: 401,
    connectionClosed: 408,
    connectionReplaced: 440,
    timedOut: 408
  }
}));

jest.mock('../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const { BaileysClient } = require('../baileys');

describe('BaileysClient', () => {
  let client;

  beforeEach(() => {
    client = new BaileysClient('teacher-test');
  });

  describe('constructor', () => {
    it('should initialize with teacherId and disconnected status', () => {
      expect(client.teacherId).toBe('teacher-test');
      expect(client.status).toBe('disconnected');
      expect(client.qr).toBeNull();
    });
  });

  describe('getStatus', () => {
    it('should return current status', () => {
      const status = client.getStatus();
      expect(status).toHaveProperty('status', 'disconnected');
      expect(status).toHaveProperty('qr', null);
    });
  });

  describe('emitStatus', () => {
    it('should emit status event', () => {
      const listener = jest.fn();
      client.on('status', listener);
      client.emitStatus();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'disconnected' })
      );
    });
  });

  describe('disconnect', () => {
    it('should set status to disconnected', async () => {
      const result = await client.disconnect();
      expect(result).toBe(true);
      expect(client.status).toBe('disconnected');
    });

    it('should clear reconnect timer', async () => {
      client.reconnectTimer = setTimeout(() => {}, 10000);
      await client.disconnect();
      expect(client.reconnectTimer).toBeNull();
    });

    it('should clear QR expiry timer', async () => {
      client.qrExpiryTimer = setTimeout(() => {}, 10000);
      await client.disconnect();
      expect(client.qrExpiryTimer).toBeNull();
    });
  });

  describe('logout', () => {
    it('should call disconnect', async () => {
      const spy = jest.spyOn(client, 'disconnect');
      await client.logout();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('waitForReady', () => {
    it('should resolve when status becomes connected', async () => {
      const promise = client.waitForReady(1000);
      client.status = 'connected';
      client.emitStatus();
      const result = await promise;
      expect(result).toBe(true);
    });

    it('should reject on timeout', async () => {
      await expect(client.waitForReady(100)).rejects.toThrow('Timeout');
    });
  });
});
```

**Verify**: `cd backend && npm test` → all pass including new tests

## Test plan

New file: `backend/lib/__tests__/baileys.spec.js`
- Tests: constructor (1), getStatus (1), emitStatus (1), disconnect (3), logout (1), waitForReady (2)
- Total: 9 new tests

## Done criteria

- [ ] `backend/lib/__tests__/baileys.spec.js` exists with 9+ tests
- [ ] `cd backend && npm test` exits 0 with all tests passing

## STOP conditions

- If `BaileysClient` class no longer exists or has been renamed
