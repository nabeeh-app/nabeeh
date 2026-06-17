# Plan 001: Revoke JWT tokens on logout

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b52b9d0..HEAD -- backend/routes/auth.js backend/lib/auth.js backend/middleware/auth.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `b52b9d0`, 2026-06-17
- **Issue**: —

## Why this matters

When a user logs out, their JWT remains valid until it expires (default 24h per `JWT_EXPIRES_IN`). If a token is stolen (XSS, leaked from localStorage, social engineering), logging out does not revoke it. The current code has a TODO comment at `auth.js:729` acknowledging this gap. This plan implements a token blacklist using a database table so that logged-out tokens are immediately rejected.

## Current state

- `backend/routes/auth.js:710-751` — logout endpoint, has TODO at line 729:
  ```js
  // TODO: Add token to blacklist or invalidate session in user_sessions table
  ```
- `backend/lib/auth.js:8-58` — `TokenService` class with `generateToken`, `verifyToken`, `generateResetToken`
- `backend/middleware/auth.js:24-142` — `authenticateToken` middleware calls `tokenService.verifyToken(token)`
- `backend/config/database.js` — exports `{ supabase, supabaseAdmin }`
- JWT payload includes `user_id`, `email`, `role`, plus `exp` (expiry), `iss: 'nabeeh-auth'`, `aud: 'nabeeh-app'`

The approach: add a `revoked_tokens` table storing the JWT's `jti` claim (unique ID). On logout, insert the token's `jti` with its expiry. On every auth check, verify the `jti` hasn't been revoked. To avoid unbounded table growth, a cron job or migration deletes expired entries.

## Commands you will need

| Purpose    | Command                                          | Expected on success          |
|------------|--------------------------------------------------|------------------------------|
| Tests      | `cd backend && npm test`                         | all pass                     |
| Lint       | `cd backend && npx eslint routes/auth.js lib/auth.js middleware/auth.js` | no errors (or warnings only) |

## Scope

**In scope** (the only files you should modify):
- `backend/database/migrations/` — new migration for `revoked_tokens` table
- `backend/lib/auth.js` — add `revokeToken(token)` and `isTokenRevoked(jti)` methods to `TokenService`
- `backend/middleware/auth.js` — check revocation in `authenticateToken` and `optionalAuth`
- `backend/routes/auth.js` — update logout endpoint to call `revokeToken`

**Out of scope** (do NOT touch, even though they look related):
- `frontend/` — no frontend changes needed; the token is still sent as Bearer
- `backend/routes/__tests__/auth.spec.js` — tests exist but mock heavily; write new tests in a separate file
- Any cron job for cleanup — the table has TTL via `expires_at`; cleanup can be a follow-up

## Git workflow

- Branch: `advisor/001-revoke-tokens-on-logout`
- Conventional commits: `feat(auth): revoke JWT on logout via token blacklist`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create migration for `revoked_tokens` table

Create `backend/database/migrations/007_add_revoked_tokens.sql`:

```sql
CREATE TABLE IF NOT EXISTS revoked_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  jti TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_revoked_tokens_jti ON revoked_tokens(jti);
CREATE INDEX idx_revoked_tokens_expires_at ON revoked_tokens(expires_at);

ALTER TABLE revoked_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role can access (bypasses RLS)
CREATE POLICY "Service role only" ON revoked_tokens
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

**Verify**: File exists and contains the above SQL.

### Step 2: Add `jti` to JWT payload and revocation methods to `TokenService`

Edit `backend/lib/auth.js`:

1. In `generateToken`, add a random `jti` to the payload:
   ```js
   generateToken(user) {
     const payload = {
       user_id: user.id,
       email: user.email,
       role: user.role || 'teacher',
       jti: crypto.randomUUID()
     };
     return jwt.sign(payload, this.jwtSecret, {
       expiresIn: this.jwtExpiresIn,
       issuer: 'nabeeh-auth',
       audience: 'nabeeh-app'
     });
   }
   ```

2. Add two new methods to `TokenService`:
   ```js
   async revokeToken(token) {
     const decoded = this.verifyToken(token);
     const expiresAt = new Date(decoded.exp * 1000);
     const { error } = await require('../config/database').supabaseAdmin
       .from('revoked_tokens')
       .insert({ jti: decoded.jti, expires_at: expiresAt.toISOString() });
     if (error) throw error;
   }

   async isTokenRevoked(jti) {
     const { data, error } = await require('../config/database').supabaseAdmin
       .from('revoked_tokens')
       .select('id')
       .eq('jti', jti)
       .maybeSingle();
     if (error) throw error;
     return !!data;
   }
   ```

**Verify**: `node -e "const {TokenService}=require('./backend/lib/auth'); console.log('Module loads OK')"` → prints "Module loads OK"

### Step 3: Check revocation in `authenticateToken` middleware

Edit `backend/middleware/auth.js`:

After line 40 (`const decoded = tokenService.verifyToken(token);`), add:

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

Do the same in `optionalAuth` (after line 221, inside the try block, after `verifyToken`).

**Verify**: Grep for `isTokenRevoked` in `middleware/auth.js` → should find 2 matches (authenticateToken + optionalAuth)

### Step 4: Update logout endpoint to revoke token

Edit `backend/routes/auth.js`, replace the logout handler (lines 710-751):

```js
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    if (token) {
      try {
        // Revoke the token
        await authService.tokenService.revokeToken(token);

        const decoded = authService.tokenService.verifyToken(token);
        await logAuthEvent(
          decoded.user_id,
          'logout',
          true,
          ipAddress,
          userAgent
        );
      } catch (error) {
        logger.info('Token revocation failed during logout', { error: error.message });
      }
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
      messageAr: 'تم تسجيل الخروج بنجاح'
    });
  } catch (error) {
    logger.error('Logout error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      messageAr: 'خطأ في الخادم الداخلي'
    });
  }
});
```

**Verify**: `grep -n "revokeToken" backend/routes/auth.js` → should find the new call

### Step 5: Run the migration

```bash
cd backend && node database/run_migration.js
```

**Verify**: Migration applies without errors. Check `revoked_tokens` table exists in Supabase.

## Test plan

Create `backend/routes/__tests__/token-revocation.spec.js`:

- Test that `TokenService.generateToken()` now includes a `jti` field
- Test that `revokeToken()` inserts into `revoked_tokens` table (mock Supabase)
- Test that `isTokenRevoked()` returns `true` for revoked tokens and `false` for non-revoked
- Test that `authenticateToken` returns 401 for revoked tokens (mock the DB call)
- Test that logout endpoint calls `revokeToken` (integration-style with mocked DB)

Pattern: follow `backend/routes/__tests__/auth.spec.js` for mocking style.

**Verify**: `cd backend && npm test -- token-revocation` → all pass

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `cd backend && npm test` exits 0
- [ ] `grep -n "revokeToken\|isTokenRevoked" backend/lib/auth.js` finds both methods
- [ ] `grep -n "isTokenRevoked" backend/middleware/auth.js` finds 2 matches
- [ ] `grep -n "revokeToken" backend/routes/auth.js` finds the logout call
- [ ] `backend/database/migrations/007_add_revoked_tokens.sql` exists
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts
  (the codebase has drifted since this plan was written).
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.
- The Supabase `revoked_tokens` table cannot be created (e.g., permission denied).

## Maintenance notes

- Table growth: `revoked_tokens` accumulates one row per logout. Add a periodic cleanup (delete rows where `expires_at < NOW()`) in a future cron job or migration. With ~100 users logging out ~5 times/day, this is ~500 rows/day — safe for months before needing attention.
- The `jti` claim is new; any code that decodes JWTs without expecting `jti` will simply ignore it (JWT is extensible).
- If the project later moves to refresh-token architecture, this blacklist becomes the foundation.
