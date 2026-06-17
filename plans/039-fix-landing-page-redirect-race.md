# Plan 039: Fix landing page redirect race condition

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 57207f4..HEAD -- frontend/src/lib/api.ts`
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

The landing page (`/ar` or `/en`) intermittently redirects to `/ar/login` and reloads. This happens because of a race condition: when a user visits `nabeeh.app` (root), `app/page.tsx` fires `router.replace('/ar')` in a `useEffect`. If the `AuthProvider`'s `getMe()` call returns 401 before `router.replace` updates the pathname, the 401 interceptor reads `/` as the current path. The regex `/^\/(ar|en)\/?$/` does NOT match `/`, so the interceptor treats it as an unprotected page and redirects to login. This is non-deterministic — it depends on network timing.

## Current state

- `frontend/src/lib/api.ts:54-61` — the 401 interceptor with the path check:
  ```js
  if (error.response?.status === 401) {
    const path = window.location.pathname;
    const isPublicPage = ['/login', '/register', '/forgot-password'].some(p => path.includes(p));
    const isLandingPage = /^\/(ar|en)\/?$/.test(path);
    if (!isPublicPage && !isLandingPage) {
      const locale = path.split('/')[1] || 'ar';
      window.location.href = `/${locale}/login`;
    }
  }
  ```
- `frontend/src/app/page.tsx:9-11` — root page redirects to `/ar` via `useEffect`:
  ```js
  useEffect(() => {
    router.replace('/ar');
  }, [router]);
  ```
- The regex `/^\/(ar|en)\/?$/` matches `/ar`, `/en`, `/ar/`, `/en/` but NOT `/`.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Lint      | `cd frontend && npm run lint`        | exit 0              |
| Build     | `cd frontend && npm run build`       | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `frontend/src/lib/api.ts`

**Out of scope** (do NOT touch):
- `backend/` — no backend changes needed
- `frontend/src/hooks/useAuth.tsx` — auth hook logic is correct
- `frontend/src/components/auth/ProtectedRoute.tsx` — unrelated

## Steps

### Step 1: Add root path `/` to the landing page check

In `frontend/src/lib/api.ts`, line 57, change:

```js
const isLandingPage = /^\/(ar|en)\/?$/.test(path);
```

to:

```js
const isLandingPage = /^\/(ar|en)\/?$/.test(path) || path === '/';
```

This ensures that when `getMe()` returns 401 while `pathname` is still `/` (during the race window), the interceptor does NOT redirect.

**Verify**: `cd frontend && npm run lint` → exit 0, no errors

## Test plan

- No new test file needed — this is a one-line fix in an existing interceptor.
- Manual verification: open `nabeeh.app` in a fresh incognito window. The landing page should load at `/ar` without redirecting to login.

## Done criteria

- [ ] `cd frontend && npm run lint` exits 0
- [ ] `cd frontend && npm run build` exits 0
- [ ] The line at `api.ts:57` now reads `const isLandingPage = /^\/(ar|en)\/?$/.test(path) || path === '/';`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- The code at `api.ts:54-61` doesn't match the excerpts (codebase has drifted).
- Lint or build fails after the change.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

- If new locale segments are added (e.g., `/fr`), the regex must be updated.
- The root cause is architectural: `AuthProvider` wraps all pages including public ones, causing a pointless `getMe()` call on the landing page. A future improvement could skip the auth check on public pages entirely.
