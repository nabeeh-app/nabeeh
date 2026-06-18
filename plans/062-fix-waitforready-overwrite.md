# Plan 062: Fix waitForReady overwriting _readyResolve on concurrent calls

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d760576..HEAD -- backend/lib/baileys.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `d760576`, 2026-06-18

## Why this matters

Two concurrent `waitForReady()` calls both assign to `this._readyResolve` and `this._readyReject`. The second overwrites the first's references. The first caller gets a spurious timeout error.

## Current state

- `backend/lib/baileys.js:42-54`:
  ```js
  waitForReady(timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      this._readyResolve = resolve;
      this._readyReject = reject;
      this._readyTimer = setTimeout(() => {
        this._readyResolve = null;
        this._readyReject = null;
        reject(new Error('Timeout'));
      }, timeoutMs);
    });
  }
  ```

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244 pass            |

## Scope

**In scope**:
- `backend/lib/baileys.js` — change waitForReady to use a queue

**Out of scope**: No other files

## Steps

### Step 1: Replace single resolve/reject with a waiters array

In `backend/lib/baileys.js`:

1. In the constructor, replace `this._readyResolve = null; this._readyReject = null;` with `this._readyWaiters = [];`

2. Replace `waitForReady` with:
```js
waitForReady(timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const waiter = { resolve, reject };
    this._readyWaiters.push(waiter);
    const timer = setTimeout(() => {
      this._readyWaiters = this._readyWaiters.filter(w => w !== waiter);
      reject(new Error('Timeout'));
    }, timeoutMs);
    waiter.timer = timer;
  });
}
```

3. Replace `_signalReady` with:
```js
_signalReady() {
  for (const waiter of this._readyWaiters) {
    clearTimeout(waiter.timer);
    waiter.resolve(true);
  }
  this._readyWaiters = [];
}
```

**Verify**: `cd backend && npm test` → 244 pass

## Done criteria

- [ ] Concurrent `waitForReady` calls don't overwrite each other
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `waitForReady` no longer exists
