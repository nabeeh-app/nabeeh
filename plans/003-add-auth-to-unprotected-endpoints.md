# Plan 003: Add authentication to unprotected sensitive endpoints

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b52b9d0..HEAD -- backend/routes/auth.js backend/server.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `b52b9d0`, 2026-06-17
- **Issue**: —

## Why this matters

Two endpoints lack authentication entirely:

1. **`POST /api/auth/oauth/check-profile`** (`backend/routes/auth.js:1490`) — accepts `user_id` or `email` and reveals whether a teacher account exists. This enables account enumeration: an attacker can submit a list of emails/user_ids and learn which ones have accounts.

2. **`GET /api/admin/whatsapp-health`** (`backend/server.js:90`) — returns WhatsApp connection status (connected/disconnected, phone number). This is an information-disclosure endpoint under `/api/admin/` but has no auth check.

Both are quick fixes — add the existing `authenticateToken` middleware.

## Current state

**Endpoint 1 — OAuth check-profile:**
```js
// backend/routes/auth.js:1490
router.post('/oauth/check-profile', async (req, res) => {
  // No authenticateToken middleware —任何人都 can call this
  try {
    const { user_id, email } = req.body;
    // ... queries teachers table, returns hasProfile, isAssistant
  }
});
```

**Endpoint 2 — Admin WhatsApp health:**
```js
// backend/server.js:90-112
app.get('/api/admin/whatsapp-health', (req, res) => {
  // No auth middleware —任何人都 can call this
  try {
    const { baileysClient } = require('./lib/baileys');
    const status = baileysClient.getStatus();
    res.json({ success: true, data: { status: status.status || 'disconnected', phone: status.phone || null, ... } });
  } catch (error) {
    res.json({ success: true, data: { status: 'disconnected', phone: null, ... } });
  }
});
```

## Commands you will need

| Purpose    | Command                                          | Expected on success          |
|------------|--------------------------------------------------|------------------------------|
| Tests      | `cd backend && npm test`                         | all pass                     |

## Scope

**In scope** (the only files you should modify):
- `backend/routes/auth.js` — add `authenticateToken` + `requireRole('admin')` to `oauth/check-profile`
- `backend/server.js` — add `authenticateToken` + `requireRole('admin')` to `/api/admin/whatsapp-health`

**Out of scope**:
- `frontend/` — no changes
- Other routes — they already have proper auth middleware applied

## Git workflow

- Branch: `advisor/003-add-auth-to-unprotected-endpoints`
- Conventional commit: `fix(auth): add authentication to oauth/check-profile and admin/whatsapp-health`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add auth to `/api/auth/oauth/check-profile`

Edit `backend/routes/auth.js`:

1. Import `requireRole` — already imported at line 4:
   ```js
   const { authenticateToken, requireRole } = require('../middleware/auth');
   ```

2. Change the route definition from:
   ```js
   router.post('/oauth/check-profile', async (req, res) => {
   ```
   to:
   ```js
   router.post('/oauth/check-profile', authenticateToken, async (req, res) => {
   ```

   **Note**: We use `authenticateToken` only (not `requireRole`) because this endpoint is used during the OAuth flow when a user may be a teacher or assistant. The auth check ensures only logged-in users can probe for profiles. If you want stricter access (admin only), add `requireRole('admin')` — but that would break the OAuth flow for normal users.

**Verify**: `grep -n "oauth/check-profile" backend/routes/auth.js` → should show the route with `authenticateToken` in the middleware chain

### Step 2: Add auth to `/api/admin/whatsapp-health`

Edit `backend/server.js`:

1. Import the auth middleware at the top (after line 36):
   ```js
   const { authenticateToken, requireRole } = require('./middleware/auth');
   ```

2. Change the route from:
   ```js
   app.get('/api/admin/whatsapp-health', (req, res) => {
   ```
   to:
   ```js
   app.get('/api/admin/whatsapp-health', authenticateToken, requireRole('admin'), (req, res) => {
   ```

**Verify**: `grep -n "admin/whatsapp-health" backend/server.js` → should show the route with both middleware

### Step 3: Add OpenAPI annotations to the updated endpoints

For `/api/auth/oauth/check-profile`, update the `@openapi` block to add:
```yaml
*     security:
*       - bearerAuth: []
```

For `/api/admin/whatsapp-health`, add a new `@openapi` block before the route:
```js
/**
 * @openapi
 * /api/admin/whatsapp-health:
 *   get:
 *     tags: [WhatsApp]
 *     summary: Get WhatsApp connection status (admin only)
 *     description: Returns the current WhatsApp session status. Requires admin role.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status retrieved
 *       401:
 *         $ref: '#/components/schemas/ErrorEnvelope'
 *       403:
 *         $ref: '#/components/schemas/ErrorEnvelope'
 */
```

**Verify**: `grep -n "@openapi" backend/server.js` → finds the new block

### Step 4: Run tests

```bash
cd backend && npm test
```

**Verify**: All tests pass

## Test plan

Create `backend/routes/__tests__/unprotected-endpoints.spec.js`:

- Test that `POST /api/auth/oauth/check-profile` without a token returns 401
- Test that `POST /api/auth/oauth/check-profile` with a valid token returns 200
- Test that `GET /api/admin/whatsapp-health` without a token returns 401
- Test that `GET /api/admin/whatsapp-health` with a non-admin token returns 403
- Test that `GET /api/admin/whatsapp-health` with an admin token returns 200

Pattern: follow `backend/routes/__tests__/auth.spec.js` for mocking style.

**Verify**: `cd backend && npm test -- unprotected-endpoints` → all pass

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `cd backend && npm test` exits 0
- [ ] `grep -n "authenticateToken" backend/routes/auth.js` finds the middleware on `oauth/check-profile`
- [ ] `grep -n "authenticateToken.*requireRole" backend/server.js` finds the middleware on `admin/whatsapp-health`
- [ ] `grep -n "@openapi" backend/server.js` finds the new OpenAPI block
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts
  (the codebase has drifted since this plan was written).
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

- The OAuth `check-profile` endpoint is called during the OAuth flow before the user has a token. If the frontend calls this before login, you'll need to handle the 401 in the OAuth UI flow. Check `frontend/src/` for OAuth-related pages that call this endpoint — if they do, consider using `optionalAuth` instead of `authenticateToken`.
- The admin WhatsApp health endpoint is also called from the frontend WhatsApp settings page. Ensure the frontend only calls it when the user is an admin.
