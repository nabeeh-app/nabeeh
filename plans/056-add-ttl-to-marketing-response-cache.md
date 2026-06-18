# Plan 056: Add TTL eviction to marketingResponseCache

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat HEAD -- backend/routes/whatsapp.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `6e6ee99`, 2026-06-18

## Why this matters

`marketingResponseCache` is a `Map` that grows without bound. Each unique unknown phone number adds an entry that is never evicted. Over weeks of production, this accumulates entries proportional to unique non-parent phone count.

## Current state

- `backend/routes/whatsapp.js:18-19`:
  ```js
  const marketingResponseCache = new Map();
  const MARKETING_COOLDOWN = 60 * 60 * 1000;
  ```
- Entries added at line 69: `marketingResponseCache.set(phone, Date.now());`
- Checked at line 67: `if (lastResponse && Date.now() - lastResponse < MARKETING_COOLDOWN) return;`
- Never cleaned up.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 235 pass            |

## Scope

**In scope**:
- `backend/routes/whatsapp.js` — add periodic cleanup for expired entries

**Out of scope**: No other files

## Steps

### Step 1: Add a cleanup function after the cache declaration

After line 19 (`const MARKETING_COOLDOWN = 60 * 60 * 1000;`), add:

```js
// Periodic cleanup of expired marketing cache entries (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [phone, timestamp] of marketingResponseCache) {
    if (now - timestamp > MARKETING_COOLDOWN) {
      marketingResponseCache.delete(phone);
    }
  }
}, 10 * 60 * 1000);
```

**Verify**: `cd backend && npm test` → 235 pass

## Done criteria

- [ ] Expired entries are cleaned up periodically
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `marketingResponseCache` no longer exists
