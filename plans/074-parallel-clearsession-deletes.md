# Plan 074: Parallelize clearSession DB deletes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d760576..HEAD -- backend/lib/baileys.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it is a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 060
- **Category**: perf
- **Planned at**: commit `d760576`, 2026-06-18

## Why this matters

`clearSession` issues two sequential `await` DB deletes (keys then creds). They're independent — running them in parallel halves the DB round-trip latency on every logout/eviction.

## Current state

- `backend/lib/baileys.js` — `clearSession` after plan 060:
  ```js
  await supabaseAdmin.from('whatsapp_auth_keys').delete().eq('teacher_id', this.teacherId);
  await supabaseAdmin.from('whatsapp_auth_creds').delete().eq('teacher_id', this.teacherId);
  ```

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244 pass            |

## Scope

**In scope**:
- `backend/lib/baileys.js` — parallelize deletes with `Promise.all`

**Out of scope**: No other files

## Steps

### Step 1: Run deletes in parallel

```js
await Promise.all([
  supabaseAdmin.from('whatsapp_auth_keys').delete().eq('teacher_id', this.teacherId),
  supabaseAdmin.from('whatsapp_auth_creds').delete().eq('teacher_id', this.teacherId)
]);
```

**Verify**: `cd backend && npm test` → 244 pass

## Done criteria

- [ ] Both DB deletes run in parallel
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `clearSession` no longer exists
