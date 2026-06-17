# Plan 027: Fix login cookie security and centralize Supabase client

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2e8fb57..HEAD -- admin/app/login/page.tsx admin/app/api/admin/session/route.ts admin/lib/supabase.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `2e8fb57`, 2026-06-16

## Why this matters

The login page sets the session cookie twice: once via `document.cookie` (line 50, not httpOnly) and once via a server endpoint (line 52-56, httpOnly). The client-side cookie set is redundant and creates a window where a non-httpOnly cookie exists. Additionally, the login page creates its own Supabase client instead of reusing `lib/supabase.ts`, duplicating client creation logic.

## Current state

- `admin/app/login/page.tsx:23` — creates Supabase client directly:
  ```ts
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  ```
- `admin/app/login/page.tsx:50` — sets cookie via document.cookie:
  ```ts
  document.cookie = `admin-session=${authData.session.access_token}; path=/; Secure; SameSite=Lax`;
  ```
- `admin/app/login/page.tsx:52-56` — also sets httpOnly cookie via server endpoint:
  ```ts
  await fetch('/api/admin/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: authData.session.access_token }),
  });
  ```
- `admin/lib/supabase.ts` — centralized Supabase client module (exists but unused by login)

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Lint      | `cd admin && npm run lint`           | exit 0              |
| Build     | `cd admin && npm run build`          | exit 0              |

## Scope

**In scope**:
- `admin/app/login/page.tsx`
- `admin/lib/supabase.ts`

**Out of scope**:
- `admin/app/api/admin/session/route.ts` — the server endpoint already handles httpOnly cookie correctly
- `admin/proxy.ts` — no changes needed

## Steps

### Step 1: Remove the client-side cookie set from login page

In `admin/app/login/page.tsx`, delete line 50:
```ts
document.cookie = `admin-session=${authData.session.access_token}; path=/; Secure; SameSite=Lax`;
```

The server endpoint at `/api/admin/session` already sets the httpOnly cookie correctly. The client-side set is redundant and less secure.

**Verify**: `grep -n "document.cookie" admin/app/login/page.tsx` → no matches

### Step 2: Replace inline Supabase client creation with import from lib

In `admin/app/login/page.tsx`:

1. Remove the environment variable reads (lines 7-8):
   ```ts
   const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
   const supabaseAnonKey = process.env.NEXT_PUBLIC_ADMIN_SUPABASE_ANON_KEY!;
   ```

2. Remove the `createClient` import from `@supabase/supabase-js` (line 5):
   ```ts
   import { createClient } from '@supabase/supabase-js';
   ```

3. Add import from the centralized module:
   ```ts
   import { supabaseBrowser } from '@/lib/supabase';
   ```

4. In the `handleSubmit` function, replace:
   ```ts
   const supabase = createClient(supabaseUrl, supabaseAnonKey);
   ```
   with:
   ```ts
   const supabase = supabaseBrowser;
   ```

**Verify**: `grep -n "createClient" admin/app/login/page.tsx` → no matches
**Verify**: `grep -n "supabaseBrowser" admin/app/login/page.tsx` → at least one match

### Step 3: Verify build passes

```bash
cd admin && npm run build
```

Expected: build succeeds with no errors.

## Test plan

- Manual: navigate to `/login`, enter credentials, verify login works
- Verify that after login, `document.cookie` does NOT contain `admin-session` (it's httpOnly, so JS can't read it — this is the correct behavior)
- Verify the httpOnly cookie is set by checking Network tab in DevTools: the `/api/admin/session` response should have `Set-Cookie: admin-session=...; HttpOnly; Secure; SameSite=Lax`

## Done criteria

- [ ] `npm run lint` exits 0 in `admin/`
- [ ] `npm run build` exits 0 in `admin/`
- [ ] `grep -n "document.cookie" admin/app/login/page.tsx` returns no matches
- [ ] `grep -n "createClient" admin/app/login/page.tsx` returns no matches
- [ ] `plans/README.md` status row updated

## STOP conditions

- The code at the locations in "Current state" doesn't match the excerpts
- A step's verification fails twice after a reasonable fix attempt
- The fix appears to require touching an out-of-scope file

## Maintenance notes

- The `supabaseBrowser` client in `lib/supabase.ts` uses the anon key, which is safe for client-side use
- Future login pages (e.g., password reset) should also import from `lib/supabase.ts` instead of creating clients inline
