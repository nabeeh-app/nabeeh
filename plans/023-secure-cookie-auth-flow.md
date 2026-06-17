# Plan 023: Replace forgeable client-side cookie auth with httpOnly JWT

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2e8fb57..HEAD -- admin/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/022-add-auth-to-admin-api-routes.md
- **Category**: security
- **Planned at**: commit `2e8fb57`, 2026-06-16

## Why this matters

Currently, the login page (`app/login/page.tsx:50-51`) sets two cookies client-side via `document.cookie`:
- `admin-session` — the Supabase JWT access token
- `admin-user` — a JSON blob with `{ id, role, name }`

The dashboard layout (`app/dashboard/layout.tsx:31-41`) reads `admin-user` to determine the user's role and display name. Since this cookie is set client-side and readable by JavaScript, any attacker who can inject a cookie (e.g. via XSS on a subdomain) can forge `admin-user` with `role: super_admin` and gain full admin access client-side.

The fix: stop storing role/name in a client-readable cookie. Instead, use only the httpOnly `admin-session` JWT (which the server verifies in Plan 022). The client should fetch admin info from an API endpoint instead of trusting a cookie.

## Current state

- `admin/app/login/page.tsx:50-51`:
  ```typescript
  document.cookie = `admin-session=${authData.session.access_token}; path=/; Secure; SameSite=Lax`;
  document.cookie = `admin-user=${encodeURIComponent(JSON.stringify({ id: adminUser.id, role: adminUser.role, name: adminUser.name }))}; path=/; Secure; SameSite=Lax`;
  ```
- `admin/app/dashboard/layout.tsx:31-41`:
  ```typescript
  const cookie = document.cookie.split(';').find((c) => c.trim().startsWith('admin-user='));
  // ... parses JSON from cookie
  ```
- `admin/app/dashboard/layout.tsx:46-48` — logout clears both cookies.
- `admin/lib/admin-auth.ts` — has `getAdminUser()` which can fetch admin info from DB.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Lint      | `cd admin && npm run lint`           | exit 0              |
| Build     | `cd admin && npm run build`          | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `admin/app/api/admin/me/route.ts` (create — new endpoint to return current admin info)
- `admin/app/login/page.tsx` (remove `admin-user` cookie, make `admin-session` httpOnly)
- `admin/app/dashboard/layout.tsx` (fetch admin info from API instead of cookie)

**Out of scope** (do NOT touch):
- `admin/lib/admin-auth.ts` — already has `getAdminUser()`, no changes needed.
- `admin/middleware.ts` / `admin/proxy.ts` — auth middleware is fine.
- `admin/app/dashboard/page.tsx` and other pages — they don't use admin info.

## Git workflow

- Branch: `advisor/023-secure-cookie-auth-flow`
- Commit message: `security(admin): replace forgeable client cookies with httpOnly JWT + API`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create `/api/admin/me` endpoint

Create `admin/app/api/admin/me/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request);
    return NextResponse.json({
      id: admin.id,
      role: admin.role,
      name: admin.name,
    });
  } catch (response) {
    return response;
  }
}
```

This endpoint returns the current admin's info by verifying the httpOnly JWT. No client-forged data is trusted.

**Verify**: `cat admin/app/api/admin/me/route.ts | grep -c "requireAdmin"` → `1`

### Step 2: Update login to set httpOnly cookie only

Edit `admin/app/login/page.tsx`. Replace lines 50-51 (the two `document.cookie` lines) with:

```typescript
// Set httpOnly session cookie via a response header (cannot be done client-side)
// Instead, call a server-side login endpoint or set via Set-Cookie header.
// For now, use the existing cookie but add HttpOnly:
document.cookie = `admin-session=${authData.session.access_token}; path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=3600`;
// Remove the admin-user cookie entirely — role/name fetched from /api/admin/me
```

Note: `document.cookie` cannot set `HttpOnly` cookies (that's the point — it's a client-side API). The real fix requires either:
- A server-side API route that sets the cookie via `Set-Cookie` header, OR
- Using Next.js middleware to set the cookie after login.

**Simplest approach**: Create a `/api/admin/login` route that handles the Supabase auth and sets cookies server-side. However, to keep this plan scoped, use the following interim approach:

In `login/page.tsx`, after successful login, POST to a new `/api/admin/session` route that sets the httpOnly cookie.

### Step 3: Create `/api/admin/session` route for cookie setting

Create `admin/app/api/admin/session/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_ADMIN_SUPABASE_ANON_KEY!;

export async function POST(request: Request) {
  const { accessToken } = await request.json();

  if (!accessToken) {
    return NextResponse.json(
      { success: false, message: 'Missing access token', code: 'MISSING_TOKEN' },
      { status: 400 }
    );
  }

  // Verify the token is valid
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return NextResponse.json(
      { success: false, message: 'Invalid token', code: 'INVALID_TOKEN' },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('admin-session', accessToken, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 3600,
  });

  return response;
}
```

Then update `login/page.tsx` to call this after auth:

Replace the two `document.cookie` lines with:

```typescript
// Set httpOnly cookie via server endpoint
await fetch('/api/admin/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ accessToken: authData.session.access_token }),
});
```

**Verify**: `grep -c "admin/session" admin/app/login/page.tsx` → shows the fetch call.

### Step 4: Update dashboard layout to fetch admin info from API

Edit `admin/app/dashboard/layout.tsx`. Replace the `useEffect` that reads the `admin-user` cookie (lines 30-43) with:

```typescript
useEffect(() => {
  fetch('/api/admin/me')
    .then((res) => {
      if (!res.ok) throw new Error('Not authenticated');
      return res.json();
    })
    .then((data) => {
      setAdmin(data);
      setMounted(true);
    })
    .catch(() => {
      router.push('/login');
    });
}, [router]);
```

Also update the logout handler to only clear `admin-session`:

```typescript
const handleLogout = () => {
  document.cookie = 'admin-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  router.push('/login');
};
```

Remove the line that clears `admin-user` (it no longer exists).

**Verify**: `grep -c "admin-user" admin/app/dashboard/layout.tsx` → `0` (no more references).

### Step 5: Lint and build

**Verify**: `cd admin && npm run lint` → exits 0.
**Verify**: `cd admin && npm run build` → exits 0.

## Test plan

- Login flow: submit credentials → should redirect to dashboard → dashboard should display correct admin name/role.
- `curl -v http://localhost:3000/api/admin/me` without cookies → 401.
- `curl -v http://localhost:3000/api/admin/me` with valid `admin-session` cookie → 200 with admin info.
- Check that `admin-user` cookie is no longer set after login (browser dev tools).
- Check that `admin-session` cookie has `HttpOnly` flag.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `admin/app/api/admin/me/route.ts` exists
- [ ] `admin/app/api/admin/session/route.ts` exists
- [ ] `grep -c "admin-user" admin/app/login/page.tsx` → `0`
- [ ] `grep -c "admin-user" admin/app/dashboard/layout.tsx` → `0`
- [ ] `cd admin && npm run build` exits 0
- [ ] `cd admin && npm run lint` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `supabase.auth.getUser(token)` fails with the service-role key (it should work — Supabase allows verifying any valid JWT with any key).
- The `Set-Cookie` header in the session route doesn't work with Next.js 16 (check docs in `node_modules/next/dist/docs/`).
- Login flow breaks — user can't authenticate after changes.

## Maintenance notes

- The `admin-session` cookie is now httpOnly — JavaScript can no longer read it. This is the intended security improvement.
- The `/api/admin/me` endpoint uses the same `requireAdmin()` from Plan 022, which verifies the JWT server-side.
- The old `admin-user` cookie is fully eliminated. No client-side code trusts role/name from cookies.
- Future: consider adding CSRF protection (the `admin-session` cookie is SameSite=Lax, which provides basic CSRF protection for GET requests, but PATCH/DELETE should use a CSRF token or SameSite=Strict).
