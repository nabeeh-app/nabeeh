# Plan 040: Clear nabeeh_token cookie on logout

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 57207f4..HEAD -- backend/routes/auth.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `57207f4`, 2026-06-17

## Why this matters

After logout, the backend revokes the JWT token server-side but never clears the `nabeeh_token` cookie from the browser. This means the browser continues sending a stale/revoked cookie on every request, causing a pointless 401 response + interceptor check on every page load. Clearing the cookie on logout ensures a clean session state.

## Current state

- `backend/routes/auth.js:14-22` — cookie is set on login:
  ```js
  function setAuthCookie(res, token) {
    res.cookie('nabeeh_token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'strict' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/'
    });
  }
  ```
- `backend/routes/auth.js:726-763` — logout route does NOT clear the cookie:
  ```js
  router.post('/logout', authenticateToken, async (req, res) => {
      try {
          // ... revokes token, logs event ...
          res.json({
              success: true,
              message: 'Logged out successfully',
              messageAr: 'تم تسجيل الخروج بنجاح'
          });
      } catch (error) { ... }
  });
  ```

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | all pass            |

## Scope

**In scope** (the only files you should modify):
- `backend/routes/auth.js`

**Out of scope** (do NOT touch):
- `frontend/` — frontend logout in `useAuth.tsx` already works correctly
- `backend/middleware/auth.js` — auth middleware is correct
- Any other route files

## Steps

### Step 1: Add res.clearCookie before the success response

In `backend/routes/auth.js`, in the `/logout` route handler (around line 750), add `res.clearCookie` BEFORE the `res.json` call.

Change:

```js
        res.json({
            success: true,
            message: 'Logged out successfully',
            messageAr: 'تم تسجيل الخروج بنجاح'
        });
```

to:

```js
        res.clearCookie('nabeeh_token', { path: '/' });
        res.json({
            success: true,
            message: 'Logged out successfully',
            messageAr: 'تم تسجيل الخروج بنجاح'
        });
```

The `path: '/'` must match the path used in `setAuthCookie` (line 20) — otherwise the browser won't clear the cookie.

**Verify**: `cd backend && npm test` → all tests pass (the logout test at `routes/__tests__/auth.spec.js:372` should still pass)

## Test plan

- No new tests needed — the existing logout test (`routes/__tests__/auth.spec.js:372`) covers this endpoint.
- The fix is a single `res.clearCookie` call with well-defined Express behavior.

## Done criteria

- [ ] `cd backend && npm test` exits 0
- [ ] The logout route at `auth.js:750` now has `res.clearCookie('nabeeh_token', { path: '/' })` before the response
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- The code at `auth.js:726-763` doesn't match the excerpts (codebase has drifted).
- Tests fail after the change.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

- If a refresh token cookie is added later, it should also be cleared on logout.
- The `path: '/'` in `clearCookie` MUST match the `path: '/'` in `setAuthCookie`. If the cookie path changes, both must be updated.
