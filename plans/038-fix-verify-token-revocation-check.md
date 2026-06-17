# Plan 038: Add revocation check to verify-token endpoint

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3804c3e..HEAD -- backend/routes/auth.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 001-revoke-tokens-on-logout.md (revocation infrastructure must exist)
- **Category**: security
- **Planned at**: commit `3804c3e`, 2026-06-17
- **Issue**: —

## Why this matters

The `GET /api/auth/verify-token` endpoint (`backend/routes/auth.js:807-851`) verifies a JWT's signature and checks that the user exists, but it **never calls `isTokenRevoked()`**. This means a token that was revoked on logout is still reported as valid by this endpoint. Any client or flow that relies on verify-token to check token validity (e.g., the frontend's `checkAuthStatus`, or external integrations) will accept revoked tokens.

Additionally, line 809 falls back to `req.body.token` on a GET request — GET requests have no body, so this is dead code that should be removed for clarity.

## Current state

**File:** `backend/routes/auth.js:807-851`
```js
router.get('/verify-token', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token is required',
                messageAr: 'الرمز المميز مطلوب'
            });
        }

        const decoded = authService.tokenService.verifyToken(token);

        // Get fresh user data to ensure user still exists
        const user = await getUserByEmail(decoded.email);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found',
                messageAr: 'المستخدم غير موجود'
            });
        }

        res.json({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: 'teacher'
            },
            message: 'Token is valid',
            messageAr: 'الرمز المميز صالح'
        });

    } catch (error) {
        logger.error('Token verification error', { error: error.message });
        res.status(401).json({
            success: false,
            message: 'Invalid or expired token',
            messageAr: 'رمز مميز غير صالح أو منتهي الصلاحية'
        });
    }
});
```

**Key observation:** The `authenticateToken` middleware in `backend/middleware/auth.js:42-49` already checks revocation:
```js
// Check if token has been revoked
if (decoded.jti && await tokenService.isTokenRevoked(decoded.jti)) {
    return res.status(401).json({
        success: false,
        message: 'Token has been revoked',
        messageAr: 'تم إلغاء الرمز'
    });
}
```

The verify-token endpoint should do the same.

## Commands you will need

| Purpose    | Command                                          | Expected on success          |
|------------|--------------------------------------------------|------------------------------|
| Tests      | `cd backend && npm test`                         | all pass                     |

## Scope

**In scope** (the only files you should modify):
- `backend/routes/auth.js` — add revocation check to verify-token endpoint, remove dead `req.body.token` fallback

**Out of scope** (do NOT touch):
- `backend/middleware/auth.js` — already checks revocation correctly
- `backend/lib/auth.js` — `isTokenRevoked` already exists
- `frontend/` — no changes

## Git workflow

- Branch: `advisor/038-fix-verify-token-revocation-check`
- Conventional commit: `fix(auth): add revocation check to verify-token endpoint`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add revocation check and remove dead code in verify-token

Edit `backend/routes/auth.js`, replace the verify-token handler (lines 807-851) with:

```js
router.get('/verify-token', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token is required',
                messageAr: 'الرمز المميز مطلوب'
            });
        }

        const decoded = authService.tokenService.verifyToken(token);

        // Check if token has been revoked
        if (decoded.jti && await authService.tokenService.isTokenRevoked(decoded.jti)) {
            return res.status(401).json({
                success: false,
                message: 'Token has been revoked',
                messageAr: 'تم إلغاء الرمز'
            });
        }

        // Get fresh user data to ensure user still exists
        const user = await getUserByEmail(decoded.email);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found',
                messageAr: 'المستخدم غير موجود'
            });
        }

        res.json({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: 'teacher'
            },
            message: 'Token is valid',
            messageAr: 'الرمز المميز صالح'
        });

    } catch (error) {
        logger.error('Token verification error', { error: error.message });
        res.status(401).json({
            success: false,
            message: 'Invalid or expired token',
            messageAr: 'رمز مميز غير صالح أو منتهي الصلاحية'
        });
    }
});
```

Changes:
1. Removed `|| req.body.token` fallback (dead code — GET has no body)
2. Added `isTokenRevoked()` check after `verifyToken()`, matching the pattern in `authenticateToken` middleware

**Verify**: `grep -n "isTokenRevoked" backend/routes/auth.js` → finds the new call in verify-token
**Verify**: `grep -n "req.body.token" backend/routes/auth.js` → no matches (dead code removed)

### Step 2: Run tests

```bash
cd backend && npm test
```

**Verify**: All tests pass

## Test plan

Create or update `backend/routes/__tests__/auth.spec.js` (or a new file `backend/routes/__tests__/verify-token.spec.js`):

- Test that `GET /api/auth/verify-token` without a token returns 401
- Test that `GET /api/auth/verify-token` with a valid, non-revoked token returns 200 with user data
- Test that `GET /api/auth/verify-token` with a revoked token returns 401 with "Token has been revoked"
- Test that `GET /api/auth/verify-token` with an expired token returns 401 with "Invalid or expired token"

Pattern: follow `backend/routes/__tests__/auth.spec.js` for mocking style (mock `supabaseAdmin` and `TokenService`).

**Verify**: `cd backend && npm test` → all pass

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `cd backend && npm test` exits 0
- [ ] `grep -n "isTokenRevoked" backend/routes/auth.js` finds at least 1 match (in verify-token)
- [ ] `grep -n "req.body.token" backend/routes/auth.js` returns no matches
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts (codebase has drifted).
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.
- `authService.tokenService.isTokenRevoked` is not a function (the revocation infrastructure from plan 001-RL may not be deployed).

## Maintenance notes

- The `isTokenRevoked` call adds one DB query per verify-token call. This is acceptable since verify-token is not on the hot path (it's called on page load, not per-request).
- If verify-token becomes high-traffic, consider caching revocation checks with a short TTL.
- The `req.body.token` fallback was likely intended for POST requests but was placed on a GET endpoint. Removing it eliminates confusion.
