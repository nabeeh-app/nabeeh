# Plan 002: Migrate JWT from localStorage to httpOnly cookies

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b52b9d0..HEAD -- backend/routes/auth.js backend/lib/auth.js backend/server.js frontend/src/lib/api.ts frontend/src/hooks/useAuth.tsx frontend/src/lib/client.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: 001-revoke-tokens-on-logout.md (token revocation should land first so the cookie-based flow also benefits from revocation)
- **Category**: security
- **Planned at**: commit `b52b9d0`, 2026-06-17
- **Issue**: —

## Why this matters

JWT tokens are stored in `localStorage` (`frontend/src/lib/api.ts:104`), which is accessible to any JavaScript running on the page. An XSS attack can exfiltrate the token. The AGENTS.md documents that tokens should use httpOnly cookies, but the code contradicts this. httpOnly cookies are inaccessible to JavaScript and automatically sent by the browser, making them immune to XSS exfiltration.

This is a **coordinated backend + frontend change** — both sides must deploy together.

## Current state

**Backend:**
- `backend/routes/auth.js:599-671` — login endpoint, returns `{ data: { teacher, token } }`
- `backend/routes/auth.js:309-425` — register endpoint, returns `{ data: { teacher, token } }`
- `backend/routes/auth.js:1647-1936` — OAuth callback, returns `{ data: { teacher, token } }`
- `backend/middleware/auth.js:24-29` — reads token from `Authorization: Bearer <token>` header
- `backend/server.js:57-62` — CORS configured with `credentials: true`

**Frontend:**
- `frontend/src/lib/api.ts:102-121` — `getToken()`, `setToken()`, `removeToken()` use `localStorage.getItem('nabeeh_token')`
- `frontend/src/lib/api.ts:46-51` — request interceptor adds `Authorization: Bearer <token>` header
- `frontend/src/lib/api.ts:55-95` — response interceptor handles 401 by calling `removeToken()` and redirecting
- `frontend/src/hooks/useAuth.tsx:33-85` — `checkAuthStatus()` calls `apiClient.getToken()` then `apiClient.getMe()`
- `frontend/src/hooks/useAuth.tsx:142-152` — `logout()` calls `apiClient.removeToken()`

**Excerpt — current token storage:**
```ts
// frontend/src/lib/api.ts:102-121
getToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('nabeeh_token');
  }
  return null;
}
setToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('nabeeh_token', token);
    window.dispatchEvent(new CustomEvent('auth:token-changed', { detail: { token, action: 'set' } }));
  }
}
removeToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('nabeeh_token');
    window.dispatchEvent(new CustomEvent('auth:token-changed', { detail: { token: null, action: 'remove' } }));
  }
}
```

**Excerpt — current auth header injection:**
```ts
// frontend/src/lib/api.ts:46-51
this.api.interceptors.request.use((config) => {
  const token = this.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

## Commands you will need

| Purpose    | Command                                          | Expected on success          |
|------------|--------------------------------------------------|------------------------------|
| Backend tests | `cd backend && npm test`                      | all pass                     |
| Frontend lint | `cd frontend && npm run lint`                 | exit 0                       |
| Frontend build | `cd frontend && npm run build`              | exit 0                       |

## Scope

**In scope** (the only files you should modify):
- `backend/routes/auth.js` — set httpOnly cookie on login, register, OAuth callback, reset-password responses
- `backend/server.js` — add cookie-parser middleware
- `backend/middleware/auth.js` — read token from cookie OR Authorization header (dual support for transition)
- `frontend/src/lib/api.ts` — remove localStorage token methods, remove Authorization header injection
- `frontend/src/hooks/useAuth.tsx` — update `checkAuthStatus` to not call `getToken()` (cookie is automatic)
- `frontend/src/lib/client.ts` — no changes expected, but verify

**Out of scope** (do NOT touch):
- `frontend/src/components/auth/ProtectedRoute.tsx` — no changes needed
- `backend/routes/__tests__/auth.spec.js` — existing tests mock heavily; write new tests separately
- Any refresh-token flow — that's a future enhancement

## Git workflow

- Branch: `advisor/002-cookie-auth-flow`
- Conventional commits:
  - `feat(auth): set JWT as httpOnly cookie on login/register`
  - `refactor(frontend): remove localStorage token management`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add `cookie-parser` dependency to backend

```bash
cd backend && npm install cookie-parser
```

**Verify**: `grep "cookie-parser" backend/package.json` → found

### Step 2: Add cookie-parser middleware to server.js

Edit `backend/server.js`:

1. Add require at top: `const cookieParser = require('cookie-parser');`
2. Add `app.use(cookieParser());` after `app.use(express.json(...))` (after line 63)

**Verify**: `grep -n "cookieParser" backend/server.js` → found twice (require + use)

### Step 3: Create helper to set auth cookie

Edit `backend/routes/auth.js`, add near the top (after line 10):

```js
const isProd = process.env.NODE_ENV === 'production';

function setAuthCookie(res, token) {
  res.cookie('nabeeh_token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours, matches JWT_EXPIRES_IN default
    path: '/'
  });
}
```

**Verify**: `grep -n "setAuthCookie" backend/routes/auth.js` → found

### Step 4: Call `setAuthCookie` in login, register, and OAuth callback

In `backend/routes/auth.js`:

1. **Login** (line ~637, inside `if (result.success)`): add `setAuthCookie(res, result.token);` before `res.json({...})`
2. **Register** (line ~324): add `setAuthCookie(res, token);` before `res.status(201).json({...})`
3. **OAuth callback** (all 5 return paths that return a token): add `setAuthCookie(res, token);` before each `res.json`/`res.status(201).json`
4. **Admin create-teacher** (line ~515): add `setAuthCookie(res, token);` — but wait, this route doesn't return a token. Skip it.
5. **Reset-password** (line ~1410): after successful reset, set a new cookie: `setAuthCookie(res, authService.tokenService.generateToken({ id: resetToken.teacher_id, email: '', role: 'teacher' }));` — actually, this is complex. For now, skip cookie on reset-password; the user must re-login. Add a TODO comment.

**Verify**: `grep -n "setAuthCookie" backend/routes/auth.js` → should find at least 3 calls (login, register, oauth callback)

### Step 5: Update auth middleware to read from cookie OR header

Edit `backend/middleware/auth.js`, update `authenticateToken` (line 26-29):

```js
const authHeader = req.headers.authorization;
const token = authHeader && authHeader.startsWith('Bearer ')
  ? authHeader.substring(7)
  : req.cookies?.nabeeh_token || null;
```

Do the same in `optionalAuth` (line 214-217).

**Verify**: `grep -n "req.cookies" backend/middleware/auth.js` → found 2 matches

### Step 6: Update frontend `ApiClient` to remove localStorage token management

Edit `frontend/src/lib/api.ts`:

1. **Remove** the `getToken()`, `setToken()`, `removeToken()` methods entirely (lines 102-121).

2. **Remove** the request interceptor that adds `Authorization` header (lines 46-51). The browser sends cookies automatically.

3. **Update** the response interceptor 401 handler (lines 61-64): remove `this.removeToken()` call. Just redirect:
   ```ts
   if (error.response?.status === 401) {
     const locale = window.location.pathname.split('/')[1] || 'en';
     window.location.href = `/${locale}/login`;
   }
   ```

4. **Update** `login()` (lines 124-130): remove `this.setToken(response.data.data.token)`. The cookie is set by the backend. Just return the teacher data.

5. **Update** `register()` (lines 132-138): same — remove `this.setToken(...)`.

**Verify**: `grep -n "localStorage" frontend/src/lib/api.ts` → no matches

### Step 7: Update `useAuth` hook to not rely on localStorage

Edit `frontend/src/hooks/useAuth.tsx`:

1. **Update** `checkAuthStatus` (line 47): remove the `const token = apiClient.getToken()` check. Instead, always call `getMe()` — if the cookie exists, the request succeeds; if not, the 401 interceptor redirects.

   Replace lines 47-52:
   ```ts
   // Cookie-based auth: always try getMe(). The httpOnly cookie is sent
   // automatically. If absent, the 401 interceptor handles redirect.
   const teacherData = await apiClient.getMe();
   if (!controller.signal.aborted) {
     setTeacher(teacherData);
   }
   ```

2. **Remove** the `storage` event listener (lines 105-111) — localStorage changes no longer drive auth state.

3. **Remove** the `auth:token-changed` custom event listener (lines 92-101) — no longer dispatched from the API client.

4. **Update** `logout()` (lines 142-152): call `apiClient.logout()` (POST /api/auth/logout) which clears the cookie server-side, then redirect:
   ```ts
   const logout = async () => {
     try {
       await apiClient.api.post('/auth/logout');
     } catch {
       // Ignore errors — cookie may already be expired
     }
     setTeacher(null);
     setError(null);
     if (typeof window !== 'undefined') {
       const currentLocale = window.location.pathname.split('/')[1] || 'en';
       window.location.href = `/${currentLocale}/login`;
     }
   };
   ```

**Verify**: `grep -n "localStorage\|nabeeh_token\|auth:token-changed" frontend/src/hooks/useAuth.tsx` → no matches

### Step 8: Update the ApiClient 401 interceptor to not call removeToken

Already done in Step 6. Verify the interceptor no longer references `removeToken`:

**Verify**: `grep -n "removeToken" frontend/src/lib/api.ts` → no matches

### Step 9: Run frontend build to verify no type errors

```bash
cd frontend && npm run build
```

**Verify**: Build succeeds with exit 0

### Step 10: Run backend tests

```bash
cd backend && npm test
```

**Verify**: All tests pass

## Test plan

Create `backend/routes/__tests__/cookie-auth.spec.js`:

- Test that login response sets `Set-Cookie` header with `nabeeh_token` containing `HttpOnly`
- Test that register response sets the cookie
- Test that `authenticateToken` reads from cookie when no `Authorization` header is present
- Test that `authenticateToken` prefers `Authorization` header over cookie when both present
- Test that logout clears the cookie (sets `Max-Age: 0` or similar)

Pattern: follow `backend/routes/__tests__/auth.spec.js` for mocking style.

**Verify**: `cd backend && npm test -- cookie-auth` → all pass

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `cd backend && npm test` exits 0
- [ ] `cd frontend && npm run lint` exits 0
- [ ] `cd frontend && npm run build` exits 0
- [ ] `grep -rn "localStorage" frontend/src/lib/api.ts` returns no matches
- [ ] `grep -rn "nabeeh_token" frontend/src/lib/api.ts` returns no matches
- [ ] `grep -n "req.cookies" backend/middleware/auth.js` finds 2 matches
- [ ] `grep -n "setAuthCookie" backend/routes/auth.js` finds ≥3 calls
- [ ] `grep -n "cookie-parser" backend/package.json` finds the dependency
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts
  (the codebase has drifted since this plan was written).
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.
- The frontend build fails with errors that can't be resolved by adjusting types.

## Maintenance notes

- **Dual support period**: The middleware reads from cookie OR Authorization header. This allows a graceful rollout — old mobile clients using Bearer tokens still work. Remove the header fallback after confirming all clients are updated.
- **CORS**: `credentials: true` is already set in `server.js:61`. The `Access-Control-Allow-Origin` must NOT be `*` when using credentials — it's already configured to use specific origins from env.
- **CSRF**: Moving to cookies introduces CSRF risk. Plan 005 addresses this. Deploy 002 and 005 together, or keep the Authorization header fallback until CSRF is in place.
- **Token in responses**: The login/register responses still return the token in the JSON body. This is fine — the cookie is the primary auth mechanism, and the body token is a fallback for API clients that need it.
