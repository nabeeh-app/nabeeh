# Plan 076: Parallelize inviteAssistant DB queries

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d760576..HEAD -- backend/routes/assistants.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `d760576`, 2026-06-18

## Why this matters

`inviteAssistant` runs 4+ sequential DB queries (getTeacherTier, countPendingInvites, check duplicate, check existing user) that are independent. Invite latency = sum of all queries.

## Current state

- `backend/routes/assistants.js:98-149` — sequential awaits for independent checks

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244 pass            |

## Scope

**In scope**:
- `backend/routes/assistants.js` — parallelize independent checks

**Out of scope**: No other files

## Steps

### Step 1: Identify independent queries

The following can run in parallel:
- `getTeacherTier(teacherId)`
- `countPendingInvites(teacherId)`
- Check duplicate invite (by email)
- Check existing user (by email)

The tier limit check depends on `getTeacherTier` result, so it runs after.

### Step 2: Use Promise.all for independent checks

```js
const [tier, pendingCount, existingInvite, existingUser] = await Promise.all([
  getTeacherTier(teacherId),
  countPendingInvites(teacherId),
  checkDuplicateInvite(teacherId, email),
  checkExistingUser(email)
]);
```

Then do the tier limit check with the resolved `tier` value.

**Verify**: `cd backend && npm test` → 244 pass

## Done criteria

- [ ] Independent DB queries run in parallel
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `inviteAssistant` no longer exists
