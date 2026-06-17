# Plan 022: Add server-side auth to admin API routes

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
- **Risk**: LOW
- **Depends on**: plans/021-wire-up-admin-middleware.md
- **Category**: security
- **Planned at**: commit `2e8fb57`, 2026-06-16

## Why this matters

Plan 021 protects page routes via middleware, but API routes (`/api/admin/*`) are excluded from the middleware matcher (`proxy.ts:25`). This means any HTTP client can call `/api/admin/teachers`, `/api/admin/payments`, etc. without authentication. The API routes also lack RBAC — a `viewer` can PATCH payments and tickets.

## Current state

- `admin/lib/admin-auth.ts` — exports `getAdminUser(userId)`, `canModify(role)`, `canManageAdmins(role)`, `logAdminAction(...)`. These are the auth utilities but **no API route calls them**.
- `admin/lib/supabase.ts` — exports `supabaseAdmin` (service role client) and `supabaseBrowser` (anon client). The `supabaseAdmin` client bypasses RLS — it cannot verify caller identity on its own.
- Auth flow: login sets `admin-session` cookie (JWT access token) and `admin-user` cookie (JSON with `id`, `role`, `name`). The middleware verifies `admin-session` exists but doesn't validate the JWT.
- API routes: `app/api/admin/*/route.ts` — 6 files, all use `supabaseAdmin` directly with no auth check.

The fix has two parts:
1. Create a shared `requireAdmin()` helper that extracts and verifies the user from the `admin-session` cookie.
2. Add `requireAdmin()` to every API route handler.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Lint      | `cd admin && npm run lint`           | exit 0              |
| Build     | `cd admin && npm run build`          | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `admin/lib/admin-auth.ts` (add `requireAdmin()` helper)
- `admin/app/api/admin/metrics/route.ts`
- `admin/app/api/admin/teachers/route.ts`
- `admin/app/api/admin/payments/route.ts`
- `admin/app/api/admin/ai-usage/route.ts`
- `admin/app/api/admin/health/route.ts`
- `admin/app/api/admin/tickets/route.ts`

**Out of scope** (do NOT touch):
- `admin/proxy.ts` — middleware logic is fine.
- `admin/app/login/page.tsx` — cookie-setting is fine.
- `admin/app/dashboard/layout.tsx` — client-side code, not our concern here.

## Git workflow

- Branch: `advisor/022-add-auth-to-admin-api-routes`
- Commit message: `fix(admin): add server-side auth verification to all API routes`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add `requireAdmin()` to `admin/lib/admin-auth.ts`

Append the following function to the end of `admin/lib/admin-auth.ts`. This function:
1. Reads the `admin-session` cookie from the request.
2. Verifies the JWT using `supabaseAdmin.auth.getUser(token)`.
3. Looks up the admin record in `admin_users`.
4. Returns the `AdminUser` or throws a `Response` (401/403).

```typescript
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function requireAdmin(
  request: Request,
  options?: { requireModify?: boolean }
): Promise<AdminUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin-session')?.value;

  if (!token) {
    throw NextResponse.json(
      { success: false, message: 'Authentication required', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    throw NextResponse.json(
      { success: false, message: 'Invalid or expired session', code: 'INVALID_SESSION' },
      { status: 401 }
    );
  }

  const adminUser = await getAdminUser(user.id);

  if (!adminUser) {
    throw NextResponse.json(
      { success: false, message: 'Not an admin user', code: 'NOT_ADMIN' },
      { status: 403 }
    );
  }

  if (options?.requireModify && !canModify(adminUser.role)) {
    throw NextResponse.json(
      { success: false, message: 'Insufficient permissions', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  return adminUser;
}
```

**Verify**: `cat admin/lib/admin-auth.ts | grep -c "requireAdmin"` → `1`

### Step 2: Add auth to GET-only routes (metrics, teachers, ai-usage, health, tickets list)

For each of these 5 route files, add the `requireAdmin` import and call it at the top of the GET handler. The pattern is:

At the top of the file, add to imports:
```typescript
import { requireAdmin } from '@/lib/admin-auth';
```

At the start of the GET handler, add:
```typescript
await requireAdmin(request);
```

Apply this to:
- `app/api/admin/metrics/route.ts` — the GET handler takes no `request` arg. Change the signature to `GET(request: Request)` and add the call.
- `app/api/admin/teachers/route.ts` — already has `request: Request`, just add the call.
- `app/api/admin/ai-usage/route.ts` — already has `request: Request`, just add the call.
- `app/api/admin/health/route.ts` — the GET handler takes no `request` arg. Change to `GET(request: Request)` and add the call.
- `app/api/admin/tickets/route.ts` — already has `request: Request`, just add the call to GET.

**Verify**: `grep -rn "requireAdmin" admin/app/api/` → shows 5 files with the import.

### Step 3: Add auth + RBAC to PATCH routes (payments, tickets)

For the PATCH handlers, add both `requireAdmin` (with `requireModify: true` for payments) and `logAdminAction`:

At the top of the file, add to imports:
```typescript
import { requireAdmin, logAdminAction } from '@/lib/admin-auth';
```

At the start of the PATCH handler:
```typescript
const admin = await requireAdmin(request, { requireModify: true });
```

After the successful update, add:
```typescript
await logAdminAction(
  admin.id,
  'update_payment',  // or 'update_ticket'
  'payment',         // or 'support_ticket'
  id,
  { status },
);
```

Apply to:
- `app/api/admin/payments/route.ts` — PATCH handler
- `app/api/admin/tickets/route.ts` — PATCH handler

**Verify**: `grep -rn "requireAdmin\|logAdminAction" admin/app/api/` → shows both files with both functions.

### Step 4: Lint and build

**Verify**: `cd admin && npm run lint` → exits 0.
**Verify**: `cd admin && npm run build` → exits 0.

## Test plan

- Manual: `curl http://localhost:3000/api/admin/metrics` without cookies → 401 response.
- Manual: `curl` with a valid `admin-session` cookie → 200 response.
- Manual: login as a `viewer` role user, try to PATCH a payment → 403 response.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rn "requireAdmin" admin/app/api/` shows all 6 route files
- [ ] `grep -rn "logAdminAction" admin/app/api/admin/payments/route.ts admin/app/api/admin/tickets/route.ts` shows both files
- [ ] `cd admin && npm run build` exits 0
- [ ] `cd admin && npm run lint` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `requireAdmin` import from `next/headers` fails (check Next.js 16 docs — `cookies()` may have changed).
- The build fails with type errors on the `request` parameter.
- Any existing API route breaks after adding the auth check.

## Maintenance notes

- The `admin-session` cookie contains a Supabase access token. The `supabaseAdmin.auth.getUser(token)` call validates it server-side. If Supabase access tokens have a short TTL, the middleware (Plan 021) will catch expired sessions on page loads, but API calls from the page will fail with 401. The client should handle this (redirect to login on 401).
- The `logAdminAction` call inserts into `admin_audit_log`. If that table doesn't exist yet, the insert will fail silently (the `await` has no error handling). Consider adding try/catch around the audit log call.
- Future: add rate limiting to PATCH endpoints (currently none).
