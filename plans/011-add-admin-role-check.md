# Plan 011: Add admin role check to ProtectedRoute (SEC-04)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2e8fb57..HEAD -- frontend/src/components/auth/ProtectedRoute.tsx frontend/src/app/[locale]/dashboard/admin/teachers/page.tsx frontend/src/app/[locale]/dashboard/layout.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `2e8fb57`, 2026-06-16
- **Issue**:

## Why this matters

`ProtectedRoute` only checks `isAuthenticated` — any logged-in user (teacher, assistant, parent) can navigate to `/dashboard/admin/teachers` and see the admin form. The page component does check `teacher.role !== 'admin'` client-side (line 27), but the guard is bypassable: route-level protection is absent. This creates an authorization gap where non-admin authenticated users can access admin-only pages.

## Current state

- `src/components/auth/ProtectedRoute.tsx:14-36` — wraps children, only checks `isAuthenticated` and `loading`. Props: `children`, `redirectTo`, `fallback`.
- `src/app/[locale]/dashboard/admin/teachers/page.tsx:27` — checks `teacher.role !== 'admin'` inline and renders "Access denied" card.
- `src/app/[locale]/dashboard/layout.tsx:45` — wraps all dashboard children with `<ProtectedRoute>`. No role check.
- `src/config/navigation.ts:141` — `roles: ['admin']` defined on the admin nav item.
- `src/types/index.ts:25` — `role: 'teacher' | 'admin' | 'parent' | 'assistant'`.
- `src/hooks/useAuth.tsx:15` — `teacher` object is available from `useAuth()`.

## Commands you will need

| Purpose   | Command                           | Expected on success |
|-----------|-----------------------------------|---------------------|
| Lint      | `npm run lint` in `frontend/`     | exit 0              |
| Build     | `npm run build` in `frontend/`    | exit 0, no errors   |

## Scope

**In scope** (the only files you should modify):
- `src/components/auth/ProtectedRoute.tsx`
- `src/components/auth/AdminRoute.tsx` (new)
- `src/app/[locale]/dashboard/admin/teachers/page.tsx`
- `src/app/[locale]/dashboard/layout.tsx`

**Out of scope** (do NOT touch):
- `src/components/auth/ProtectedRoute.tsx` — do not change the existing default behavior for non-role-protected routes.
- `src/config/navigation.ts` — nav filtering already works correctly.
- Backend auth — this is a frontend-only defense-in-depth fix.

## Git workflow

- Branch: `advisor/011-admin-role-check`
- Commit style: `feat(auth): add role-based route protection`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add `requiredRole` prop to ProtectedRoute

Open `src/components/auth/ProtectedRoute.tsx`. Add an optional `requiredRole` prop:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
  fallback?: React.ReactNode;
  requiredRole?: 'teacher' | 'admin' | 'assistant';
}

export default function ProtectedRoute({
  children,
  redirectTo = '/login',
  fallback,
  requiredRole,
}: ProtectedRouteProps) {
  const { isAuthenticated, loading, teacher } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, loading, redirectTo, router]);

  if (loading) {
    return fallback ?? <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (requiredRole && teacher && teacher.role !== requiredRole) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p>You do not have permission to access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
```

Key changes:
- Import `Card`, `CardHeader`, `CardTitle`, `CardContent` (already used elsewhere in the project).
- Import `teacher` from `useAuth()`.
- Add `requiredRole` optional prop.
- After auth check, if `requiredRole` is provided and `teacher.role !== requiredRole`, render an "Access Denied" card.

**Verify**: `npm run lint` in `frontend/` → exit 0

### Step 2: Update admin/teachers page to remove redundant role check

Open `src/app/[locale]/dashboard/admin/teachers/page.tsx`. Remove lines 27-40 (the `if (!teacher || teacher.role !== 'admin')` block) since `ProtectedRoute` with `requiredRole="admin"` will now handle this. The page should only have the form content.

**Verify**: `npm run lint` in `frontend/` → exit 0

### Step 3: Wrap the admin route group in dashboard layout

Open `src/app/[locale]/dashboard/layout.tsx`. The dashboard layout wraps all children with `ProtectedRoute`. Since this is a shared layout, adding `requiredRole` here would break non-admin pages. Instead, this plan relies on individual admin pages using the new `requiredRole` prop.

No change needed to layout.tsx — the protection is applied at the page level (Step 2 changes the admin/teachers page to use `<ProtectedRoute requiredRole="admin">`). If other admin pages exist in the future, they should also wrap their content with `requiredRole="admin"`.

**Verify**: `npm run lint` in `frontend/` → exit 0

### Step 4: Full verification

Run `npm run build` in `frontend/` to confirm no type errors.

**Verify**: `npm run build` → exit 0

## Test plan

- No new automated tests — this is a component-level prop addition with clear branching.
- Manual verification: navigate to `/dashboard/admin/teachers` while logged in as a non-admin user. Expected: "Access Denied" card shown.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint` exits 0
- [ ] `npm run build` exits 0
- [ ] `grep -n "teacher.role !== requiredRole" frontend/src/components/auth/ProtectedRoute.tsx` returns a match
- [ ] `src/app/[locale]/dashboard/admin/teachers/page.tsx` no longer contains `teacher.role !== 'admin'` check
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- The `teacher` object from `useAuth()` does not have a `role` property (check `src/types/index.ts:25`).
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

- Future admin pages under `/dashboard/admin/` must also wrap content with `<ProtectedRoute requiredRole="admin">`.
- This is defense-in-depth. Backend authorization should also enforce role checks (separate concern).
