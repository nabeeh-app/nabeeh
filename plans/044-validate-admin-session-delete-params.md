# Plan 044: Add UUID validation to admin session delete route

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6e6ee99..HEAD -- backend/routes/whatsapp.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `6e6ee99`, 2026-06-18

## Why this matters

The `DELETE /sessions/:teacherId` route uses `req.params.teacherId` directly without validating it's a valid UUID. While `requirePermission('manage_settings')` restricts access to admins, an invalid UUID could cause PostgreSQL errors that leak internal details in error messages.

## Current state

- `backend/routes/whatsapp.js:890`:
  ```js
  router.delete('/sessions/:teacherId', requirePermission('manage_settings'), async (req, res) => {
    try {
      const forceLogout = req.query.force === 'true';
      await sessionManager.destroySession(req.params.teacherId, { deleteCredentials: forceLogout });
      res.json({ success: true, message: forceLogout ? 'Session logged out' : 'Session disconnected' });
    } catch (error) {
      logger.error('Failed to disconnect session', { teacherId: req.params.teacherId, error: error.message });
      res.status(500).json({ success: false, message: 'Failed to disconnect session' });
    }
  });
  ```
- No Zod schema exists for this route's params.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 226 pass            |

## Scope

**In scope**:
- `backend/routes/whatsapp.js` — add Zod validation for teacherId param

**Out of scope**:
- No other files

## Steps

### Step 1: Add Zod schema for teacherId param

In `backend/routes/whatsapp.js`, near the other schema definitions (after `pairCodeSchema` around line 332), add:

```js
const sessionParamsSchema = z.object({
  teacherId: z.string().uuid('Invalid teacher ID format')
});
```

### Step 2: Validate in the route handler

Update the `DELETE /sessions/:teacherId` route to validate:

```js
router.delete('/sessions/:teacherId', requirePermission('manage_settings'), async (req, res) => {
  try {
    const parsed = sessionParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' });
    }

    const forceLogout = req.query.force === 'true';
    await sessionManager.destroySession(parsed.data.teacherId, { deleteCredentials: forceLogout });
    res.json({ success: true, message: forceLogout ? 'Session logged out' : 'Session disconnected' });
  } catch (error) {
    logger.error('Failed to disconnect session', { teacherId: req.params.teacherId, error: error.message });
    res.status(500).json({ success: false, message: 'Failed to disconnect session' });
  }
});
```

**Verify**: `cd backend && npm test` → 226 pass

## Test plan

Add a test case in `backend/routes/__tests__/whatsapp.spec.js`:

```js
it('should reject invalid teacherId UUID format', async () => {
  const res = await request(app)
    .delete('/api/whatsapp/sessions/not-a-uuid');

  expect(res.status).toBe(400);
  expect(res.body.success).toBe(false);
  expect(res.body.code).toBe('VALIDATION_ERROR');
});
```

## Done criteria

- [x] `sessionParamsSchema` exists with UUID validation
- [x] Route validates params before calling `destroySession`
- [x] Test for invalid UUID returns 400
- [x] `cd backend && npm test` exits 0

## STOP conditions

- If the route no longer exists or has been renamed
