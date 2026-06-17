# Plan 005: Add CSRF protection for cookie-based auth

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b52b9d0..HEAD -- backend/server.js backend/middleware/auth.js backend/routes/auth.js frontend/src/lib/api.ts frontend/src/hooks/useAuth.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: 002-cookie-auth-flow.md (CSRF protection is needed because of cookie-based auth)
- **Category**: security
- **Planned at**: commit `b52b9d0`, 2026-06-17
- **Issue**: —

## Why this matters

AGENTS.md documents: "CSRF token required for state-changing requests" but zero CSRF implementation exists. Once plan 002 moves JWTs to httpOnly cookies, the browser automatically sends the auth cookie on every cross-origin request. An attacker can craft a malicious page that submits a form or XHR to the API, and the browser will attach the cookie — enabling unauthorized state changes (creating students, changing grades, etc.).

**This plan must be deployed together with or after plan 002 (cookie auth).**

## Current state

- `backend/server.js:57-62` — CORS config with `credentials: true`, specific origins from env
- `backend/middleware/auth.js` — no CSRF middleware exists
- `backend/middleware/security.js` — security headers via helmet, input sanitization, rate limiting — no CSRF
- `frontend/src/lib/api.ts` — will be updated by plan 002 to remove localStorage tokens

**Attack scenario (after plan 002):**
1. User is logged in (httpOnly cookie set)
2. User visits `evil.com`
3. `evil.com` contains: `<form action="https://nabeeh.app/api/students" method="POST"><input name="name" value="hacked"><input name="group_id" value="..."></form><script>document.forms[0].submit()</script>`
4. Browser sends the POST with the `nabeeh_token` cookie → student created

## Approach: Double-Submit Cookie Pattern

The simplest CSRF defense that works with SPAs and APIs:

1. **Backend generates a random CSRF token** and sets it as a **readable** cookie (`csrf_token`, NOT httpOnly)
2. **Frontend reads the CSRF cookie** and sends it as a header (`X-CSRF-Token`) on every state-changing request
3. **Backend compares** the cookie value to the header value — if they match, the request is legitimate (an attacker's page can force the browser to send cookies, but cannot read cross-origin cookies to set the header)

This avoids server-side session storage (the app is currently stateless with JWTs).

## Commands you will need

| Purpose    | Command                                          | Expected on success          |
|------------|--------------------------------------------------|------------------------------|
| Backend tests | `cd backend && npm test`                      | all pass                     |
| Frontend lint | `cd frontend && npm run lint`                 | exit 0                       |

## Scope

**In scope** (the only files you should modify):
- `backend/middleware/security.js` — add CSRF token generation and validation middleware
- `backend/server.js` — mount CSRF middleware, apply to state-changing routes
- `backend/routes/auth.js` — set CSRF cookie on login/register responses
- `frontend/src/lib/api.ts` — read CSRF cookie, add `X-CSRF-Token` header on POST/PUT/DELETE/PATCH

**Out of scope**:
- `frontend/src/hooks/useAuth.tsx` — no changes needed (CSRF is handled by the API client)
- `backend/routes/__tests__/` — write new tests separately
- WebSocket/WhatsApp real-time connections — they don't use cookies

## Git workflow

- Branch: `advisor/005-add-csrf-protection`
- Conventional commits:
  - `security(auth): add CSRF double-submit cookie protection`
  - `feat(frontend): send X-CSRF-Token header on state-changing requests`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add CSRF middleware to `backend/middleware/security.js`

Add to `backend/middleware/security.js`:

```js
const crypto = require('crypto');

// CSRF token generation — sets a readable cookie with a random token
const csrfGenerate = (req, res, next) => {
  // Only generate for requests that originate from the browser (have cookies)
  if (!req.cookies?.nabeeh_token) {
    return next();
  }

  // Don't regenerate if CSRF cookie already exists and is valid
  if (req.cookies?.csrf_token) {
    return next();
  }

  const csrfToken = crypto.randomBytes(32).toString('hex');
  res.cookie('csrf_token', csrfToken, {
    httpOnly: false,  // Must be readable by JavaScript
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/'
  });

  next();
};

// CSRF token validation — checks X-CSRF-Token header matches csrf_token cookie
const csrfValidate = (req, res, next) => {
  // Skip CSRF for non-state-changing methods
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Skip CSRF if no auth cookie (not logged in — auth middleware will reject anyway)
  if (!req.cookies?.nabeeh_token) {
    return next();
  }

  const cookieToken = req.cookies?.csrf_token;
  const headerToken = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({
      success: false,
      message: 'CSRF token validation failed',
      messageAr: 'فشل التحقق من رمز CSRF'
    });
  }

  next();
};
```

Export both: add `csrfGenerate` and `csrfValidate` to `module.exports`.

**Verify**: `grep -n "csrfGenerate\|csrfValidate" backend/middleware/security.js` → found

### Step 2: Mount CSRF middleware in `server.js`

Edit `backend/server.js`:

1. Import the new middleware:
   ```js
   const {
     apiLimiter, authLimiter, whatsappLimiter,
     securityHeaders, sanitizeInput, securityLogger,
     csrfGenerate, csrfValidate
   } = require('./middleware/security');
   ```

2. Add `csrfGenerate` after cookie-parser (if plan 002 is deployed) or after `express.json()`:
   ```js
   app.use(csrfGenerate);
   ```

3. Add `csrfValidate` before the API routes (after `csrfGenerate`, before `app.use('/api/auth', ...)`):
   ```js
   app.use(csrfValidate);
   ```

**Verify**: `grep -n "csrf" backend/server.js` → found 3+ matches (import, generate, validate)

### Step 3: Set CSRF cookie on login/register responses

Edit `backend/routes/auth.js`, in the `setAuthCookie` function (from plan 002), or add CSRF cookie setting alongside the auth cookie:

In the login handler (after setting the auth cookie):
```js
res.cookie('csrf_token', crypto.randomBytes(32).toString('hex'), {
  httpOnly: false,
  secure: isProd,
  sameSite: isProd ? 'strict' : 'lax',
  maxAge: 24 * 60 * 60 * 1000,
  path: '/'
});
```

Actually, the `csrfGenerate` middleware already handles this — it sets the cookie on the first request with an auth cookie. So no changes needed in auth routes if the middleware is mounted correctly.

**However**, for the initial login response, the auth cookie is set by `setAuthCookie` in the response, and `csrfGenerate` runs before the route handler. So the CSRF cookie won't exist on the login request itself (the auth cookie isn't set yet). To fix this, set the CSRF cookie explicitly in `setAuthCookie`:

```js
function setAuthCookie(res, token) {
  res.cookie('nabeeh_token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/'
  });
  // Also set CSRF cookie on login (needed for subsequent requests)
  const csrfToken = require('crypto').randomBytes(32).toString('hex');
  res.cookie('csrf_token', csrfToken, {
    httpOnly: false,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/'
  });
}
```

**Verify**: `grep -n "csrf_token" backend/routes/auth.js` → found

### Step 4: Update frontend API client to send CSRF header

Edit `frontend/src/lib/api.ts`:

1. Add a helper to read the CSRF cookie:
   ```ts
   private getCsrfToken(): string | null {
     if (typeof document === 'undefined') return null;
     const match = document.cookie.match(/csrf_token=([^;]+)/);
     return match ? decodeURIComponent(match[1]) : null;
   }
   ```

2. Update the request interceptor to add the CSRF header on state-changing requests:
   ```ts
   this.api.interceptors.request.use((config) => {
     const method = config.method?.toUpperCase();
     if (method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
       const csrfToken = this.getCsrfToken();
       if (csrfToken) {
         config.headers['X-CSRF-Token'] = csrfToken;
       }
     }
     return config;
   });
   ```

**Verify**: `grep -n "X-CSRF-Token\|getCsrfToken" frontend/src/lib/api.ts` → found

### Step 5: Run backend tests

```bash
cd backend && npm test
```

**Verify**: All tests pass

### Step 6: Run frontend lint

```bash
cd frontend && npm run lint
```

**Verify**: Lint passes

## Test plan

Create `backend/routes/__tests__/csrf.spec.js`:

- Test that GET requests without CSRF token succeed (safe method)
- Test that POST requests without CSRF token return 403
- Test that POST requests with matching cookie + header succeed
- Test that POST requests with mismatched cookie + header return 403
- Test that requests without auth cookie skip CSRF validation
- Test that `csrfGenerate` middleware sets the `csrf_token` cookie

Pattern: follow `backend/routes/__tests__/auth.spec.js` for mocking style.

**Verify**: `cd backend && npm test -- csrf` → all pass

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `cd backend && npm test` exits 0
- [ ] `cd frontend && npm run lint` exits 0
- [ ] `grep -n "csrfGenerate\|csrfValidate" backend/middleware/security.js` finds both functions
- [ ] `grep -n "csrf" backend/server.js` finds 3+ matches
- [ ] `grep -n "X-CSRF-Token" frontend/src/lib/api.ts` finds the header injection
- [ ] `grep -n "getCsrfToken" frontend/src/lib/api.ts` finds the cookie reader
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts
  (the codebase has drifted since this plan was written).
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.
- Plan 002 (cookie auth) has not been deployed yet — if so, STOP and note that CSRF protection is only meaningful after cookie auth is live.

## Maintenance notes

- **Deployment order**: Deploy plan 002 (cookie auth) first, then plan 005 (CSRF). Without cookies, CSRF isn't a risk (Bearer tokens aren't auto-sent by browsers).
- **SameSite cookie attribute**: `SameSite=Strict` provides additional CSRF protection on modern browsers. We set it in production. In development, `SameSite=Lax` allows the OAuth flow to work.
- **Double-submit vs synchronizer token**: Double-submit is chosen because the app is stateless (no server-side sessions). If the app later adds server-side sessions, consider switching to synchronizer token pattern.
- **WhatsApp webhook**: The WhatsApp webhook (`/api/whatsapp/webhook`) is a POST endpoint called by external services. It doesn't use cookies, so CSRF validation should skip it. The middleware already skips requests without `nabeeh_token` cookie, which covers this case.
- **API documentation clients**: Swagger UI and Postman don't send CSRF tokens. The middleware skips CSRF when there's no auth cookie, so unauthenticated API exploration works. For authenticated testing, users must include the CSRF cookie value in the `X-CSRF-Token` header.
