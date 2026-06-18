# Plan 067: Add Zod validation to POST /bot/resume

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d760576..HEAD -- backend/routes/whatsapp.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `d760576`, 2026-06-18

## Why this matters

Every other mutating endpoint in whatsapp.js uses Zod validation. `/bot/resume` reads raw `req.body` with only a manual `if (!conversation_id)` check. This is a regression from the codebase standard.

## Current state

- `backend/routes/whatsapp.js:731` — raw `req.body` read
- Other routes use patterns like `sendMessageSchema`, `pairCodeSchema`, `sessionParamsSchema`

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244 pass            |

## Scope

**In scope**:
- `backend/routes/whatsapp.js` — add Zod schema and validate

**Out of scope**: No other files

## Steps

### Step 1: Add a Zod schema near the other schemas

```js
const resumeSchema = z.object({
  conversation_id: z.string().uuid()
});
```

### Step 2: Validate in the route handler

At the start of the `/bot/resume` handler:

```js
const parsed = resumeSchema.safeParse(req.body);
if (!parsed.success) {
  return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
}
const { conversation_id } = parsed.data;
```

Remove the manual `if (!conversation_id)` check.

**Verify**: `cd backend && npm test` → 244 pass

## Done criteria

- [ ] `/bot/resume` validates input with Zod
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `/bot/resume` route no longer exists
