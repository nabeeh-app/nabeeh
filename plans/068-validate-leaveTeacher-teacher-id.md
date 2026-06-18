# Plan 068: Validate teacher_id in leaveTeacher route

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

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `d760576`, 2026-06-18

## Why this matters

`leaveTeacher` accepts `teacher_id` from `req.body` with no Zod validation. Any authenticated user who knows a valid teacher-assistant link UUID can dissolve that relationship.

## Current state

- `backend/routes/assistants.js:525-526`:
  ```js
  const { teacher_id } = req.body;
  ```
  No Zod schema, no ownership check against `req.user.id`.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244 pass            |

## Scope

**In scope**:
- `backend/routes/assistants.js` — add Zod schema and ownership check

**Out of scope**: No other files

## Steps

### Step 1: Add Zod schema

```js
const leaveTeacherSchema = z.object({
  teacher_id: z.string().uuid()
});
```

### Step 2: Validate and verify ownership

```js
const parsed = leaveTeacherSchema.safeParse(req.body);
if (!parsed.success) {
  return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
}
const { teacher_id } = parsed.data;

// Verify the authenticated user is the assistant in this link
if (req.user.id !== link.assistant_id) {
  return res.status(403).json({ success: false, message: 'Not authorized' });
}
```

**Verify**: `cd backend && npm test` → 244 pass

## Done criteria

- [ ] `leaveTeacher` validates `teacher_id` with Zod
- [ ] Ownership check verifies `req.user.id` matches the assistant
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `leaveTeacher` route no longer exists
