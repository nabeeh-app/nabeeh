# Plan 021: Wire up admin auth middleware

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
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `2e8fb57`, 2026-06-16

## Why this matters

The `proxy.ts` file at `admin/proxy.ts` exports a `proxy()` function and a `config` matcher — the standard Next.js middleware pattern. But there is no `middleware.ts` at the admin root, so Next.js never loads it. Every dashboard route is publicly accessible without login. This is the single highest-leverage security fix in the admin app.

## Current state

- `admin/proxy.ts` — contains the middleware logic: checks for `admin-session` cookie, redirects to `/login` if missing, skips public paths (`/login`). Already correct.
- `admin/middleware.ts` — **does not exist**. This is the file Next.js expects at the project root to intercept requests.
- `admin/app/login/page.tsx:50` — sets `admin-session` cookie on successful login (already works).
- `admin/app/dashboard/layout.tsx:31-41` — client-side cookie check (redundant once middleware is live, but harmless to keep as a fallback).

The fix is to create `admin/middleware.ts` that re-exports the logic from `admin/proxy.ts`. Next.js middleware must live at the project root (`admin/middleware.ts`), not inside `app/`.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Lint      | `cd admin && npm run lint`           | exit 0              |
| Build     | `cd admin && npm run build`          | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `admin/middleware.ts` (create)

**Out of scope** (do NOT touch, even though they look related):
- `admin/proxy.ts` — the logic is correct; do not modify it.
- `admin/app/dashboard/layout.tsx` — the client-side check is a harmless fallback; leave it.
- `admin/app/login/page.tsx` — cookie-setting logic is correct; leave it.

## Git workflow

- Branch: `advisor/021-wire-up-admin-middleware`
- Commit message: `fix(admin): wire up auth middleware to protect dashboard routes`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create `admin/middleware.ts`

Create the file `admin/middleware.ts` with this exact content:

```typescript
export { proxy as middleware, config } from './proxy';
```

This re-exports the existing `proxy` function as the Next.js middleware and the `config` matcher. Next.js will intercept all requests matching the matcher and run the auth check.

**Verify**: `cat admin/middleware.ts` → shows the re-export line.

### Step 2: Verify middleware is recognized

Run the build to confirm Next.js picks up the middleware:

**Verify**: `cd admin && npm run build` → exits 0 with no errors. Check that the build output mentions middleware (it may show a middleware route in the output).

### Step 3: Lint check

**Verify**: `cd admin && npm run lint` → exits 0.

## Test plan

- Manual verification: start the dev server (`cd admin && npm run dev`), navigate to `http://localhost:3000/dashboard` without being logged in — should redirect to `/login`.
- Verify `/login` still loads without redirect loop.
- Verify that after login, the dashboard loads normally.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `admin/middleware.ts` exists and exports `middleware` and `config`
- [ ] `cd admin && npm run build` exits 0
- [ ] `cd admin && npm run lint` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The build fails with "middleware" related errors.
- `proxy.ts` has been modified since this plan was written (drift check).
- Creating `middleware.ts` causes a redirect loop on `/login`.

## Maintenance notes

- Once middleware is live, the client-side cookie check in `dashboard/layout.tsx:31-41` becomes a redundant fallback. It's harmless but could be removed in a future cleanup.
- The `config.matcher` in `proxy.ts:24-26` already excludes `_next/static`, `_next/image`, `favicon.ico`, and `api/` paths — API routes remain unprotected (addressed in Plan 022).
