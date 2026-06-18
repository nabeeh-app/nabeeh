# Plan 045: Add unit tests for sessionManager

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6e6ee99..HEAD -- backend/lib/sessionManager.js backend/lib/__tests__/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 041 (sessionCreated emit must exist for handler tests)
- **Category**: tests
- **Planned at**: commit `6e6ee99`, 2026-06-18

## Why this matters

The `sessionManager` is the core orchestrator for multi-session WhatsApp. It handles session creation, eviction, phone-to-teacher lookup, and lifecycle management. Currently it has zero unit tests — all test coverage comes from mocking it in `whatsapp.spec.js`. This means bugs in eviction logic, phone lookup, or session lifecycle would only be caught in production.

## Current state

- `backend/lib/sessionManager.js` — 312 lines, zero test coverage
- `backend/lib/__tests__/` — exists (has `auth.spec.js`)
- Test pattern: `backend/routes/__tests__/whatsapp.spec.js` mocks sessionManager entirely

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 226 pass (will increase) |

## Scope

**In scope**:
- `backend/lib/__tests__/sessionManager.spec.js` — new test file

**Out of scope**:
- `backend/lib/sessionManager.js` — no changes needed
- `backend/routes/__tests__/whatsapp.spec.js` — existing mocks stay

## Steps

### Step 1: Create test file with mocked dependencies

Create `backend/lib/__tests__/sessionManager.spec.js`:

```js
jest.mock('../../config/database', () => ({
  supabaseAdmin: {
    from: jest.fn()
  }
}));

jest.mock('../../lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

jest.mock('../../lib/baileys', () => ({
  BaileysClient: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
    logout: jest.fn().mockResolvedValue(true),
    getStatus: jest.fn().mockReturnValue({ status: 'disconnected', qr: null })
  }))
}));

const { supabaseAdmin } = require('../../config/database');
```

### Step 2: Test getOrCreateSession

```js
describe('getOrCreateSession', () => {
  it('should create a new session and emit sessionCreated', async () => {
    // Mock upsert
    supabaseAdmin.from.mockReturnValue({
      upsert: jest.fn().mockResolvedValue({ error: null })
    });

    // Get fresh instance
    const sessionManager = require('../../lib/sessionManager');
    const client = await sessionManager.getOrCreateSession('teacher-1', { autoConnect: false });

    expect(client).toBeDefined();
    expect(sessionManager.sessions.has('teacher-1')).toBe(true);
  });

  it('should return existing session if already exists', async () => {
    const sessionManager = require('../../lib/sessionManager');
    const client1 = await sessionManager.getOrCreateSession('teacher-2', { autoConnect: false });
    const client2 = await sessionManager.getOrCreateSession('teacher-2', { autoConnect: false });

    expect(client1).toBe(client2);
  });
});
```

### Step 3: Test getSession

```js
describe('getSession', () => {
  it('should return null for non-existent session', () => {
    const sessionManager = require('../../lib/sessionManager');
    const result = sessionManager.getSession('nonexistent');
    expect(result).toBeNull();
  });
});
```

### Step 4: Test destroySession

```js
describe('destroySession', () => {
  it('should remove session from map', async () => {
    const sessionManager = require('../../lib/sessionManager');
    await sessionManager.getOrCreateSession('teacher-destroy', { autoConnect: false });
    expect(sessionManager.sessions.has('teacher-destroy')).toBe(true);

    await sessionManager.destroySession('teacher-destroy');
    expect(sessionManager.sessions.has('teacher-destroy')).toBe(false);
  });

  it('should handle non-existent session gracefully', async () => {
    const sessionManager = require('../../lib/sessionManager');
    await expect(sessionManager.destroySession('nonexistent')).resolves.not.toThrow();
  });
});
```

### Step 5: Test eviction

```js
describe('_evictInactiveSession', () => {
  it('should evict least recently active session', async () => {
    const sessionManager = require('../../lib/sessionManager');
    // Create two sessions
    await sessionManager.getOrCreateSession('teacher-old', { autoConnect: false });
    await sessionManager.getOrCreateSession('teacher-new', { autoConnect: false });

    // Make teacher-old older
    sessionManager.sessions.get('teacher-old').lastActive = Date.now() - 100000;

    const evicted = sessionManager._evictInactiveSession();
    expect(evicted).toBe(true);
  });
});
```

### Step 6: Test getTeacherForPhone

```js
describe('getTeacherForPhone', () => {
  it('should return teacher ID for valid parent phone', async () => {
    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              students: [{
                enrollments: [{
                  group: {
                    offering: { teacher_id: 'teacher-from-phone' }
                  }
                }]
              }]
            },
            error: null
          })
        })
      })
    });

    const sessionManager = require('../../lib/sessionManager');
    const teacherId = await sessionManager.getTeacherForPhone('+201234567890');
    expect(teacherId).toBe('teacher-from-phone');
  });

  it('should return null for unknown phone', async () => {
    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null })
        })
      })
    });

    const sessionManager = require('../../lib/sessionManager');
    const teacherId = await sessionManager.getTeacherForPhone('+0000000000');
    expect(teacherId).toBeNull();
  });
});
```

### Step 7: Run tests

**Verify**: `cd backend && npm test` → all pass including new tests

## Test plan

New file: `backend/lib/__tests__/sessionManager.spec.js`
- Tests: getOrCreateSession (2), getSession (1), destroySession (2), _evictInactiveSession (1), getTeacherForPhone (2)
- Pattern: follow `backend/lib/__tests__/auth.spec.js` for structure

## Done criteria

- [ ] `backend/lib/__tests__/sessionManager.spec.js` exists with 8+ tests
- [ ] `cd backend && npm test` exits 0 with all tests passing

## STOP conditions

- If `sessionManager.js` no longer exports the expected API
- If mock patterns don't match existing test conventions

## Maintenance notes

- Tests mock `supabaseAdmin.from()` — if the query shape changes, tests need updating
- The eviction test depends on session ordering which is Map-iteration-order (insertion order in modern Node)
