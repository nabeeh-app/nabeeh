# Plan 003: Remove HTTP fallback API URL (SEC-07)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2e8fb57..HEAD -- frontend/src/lib/api.ts frontend/src/app/[locale]/auth/callback-client/page.tsx`
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
- **Issue**: N/A

## Why this matters

Two files default to `http://localhost:5000/api` when `NEXT_PUBLIC_API_URL` is unset. In a production deployment where this env var is accidentally missing, the frontend will make requests to `http://localhost:5000/api` — a URL that doesn't exist on the user's machine, causing silent failures. Worse, if someone deploys without the env var and the app runs on HTTP, credentials could be transmitted in plaintext. Changing the fallback to `/api` makes the app use same-origin proxying, which inherits the page's protocol (HTTPS in production) and works with a reverse proxy.

## Current state

- `src/lib/api.ts` — the real `ApiClient` class. Line 38 sets the Axios `baseURL`:
  ```ts
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  ```

- `src/app/[locale]/auth/callback-client/page.tsx` — OAuth callback handler. Line 55 sets the backend URL for token exchange:
  ```ts
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  ```

Convention: The backend runs on port 5000 in dev. In production, a reverse proxy (nginx/Caddy) serves both frontend and backend on the same origin. The `/api` prefix routes to the backend.

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`               | exit 0, no errors   |
| Lint      | `npm run lint`                   | exit 0              |
| Grep      | `grep -rn "localhost:5000" frontend/src/` | no matches |

## Scope

**In scope** (the only files you should modify):
- `src/lib/api.ts`
- `src/app/[locale]/auth/callback-client/page.tsx`

**Out of scope** (do NOT touch, even though they look related):
- Backend configuration or port settings.
- Any other frontend files that might reference API URLs.

## Git workflow

- Branch: `advisor/003-remove-http-api-fallback`
- Commit message: `fix(security): replace hardcoded http://localhost fallback with same-origin /api`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fix the fallback in `src/lib/api.ts:38`

Change the `baseURL` value from:
```ts
baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
```
to:
```ts
baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
```

**Verify**: `grep -rn "localhost:5000" frontend/src/lib/api.ts` → no matches

### Step 2: Fix the fallback in `src/app/[locale]/auth/callback-client/page.tsx:55`

Change the `backendUrl` value from:
```ts
const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
```
to:
```ts
const backendUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
```

**Verify**: `grep -rn "localhost:5000" frontend/src/app/` → no matches

### Step 3: Verify no remaining localhost references

**Verify**: `grep -rn "localhost:5000" frontend/src/` → no matches

### Step 4: Verify lint and typecheck

**Verify**: `npm run lint` in `frontend/` → exit 0
**Verify**: `npx tsc --noEmit` in `frontend/` → exit 0, no errors

## Test plan

No automated tests for URL configuration. Manual verification:

- With `NEXT_PUBLIC_API_URL` unset, the Axios instance should use `/api` as its base URL.
- In dev mode with a reverse proxy, requests should route correctly.
- In production with HTTPS, no HTTP fallback should occur.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint` in `frontend/` exits 0
- [ ] `npx tsc --noEmit` in `frontend/` exits 0
- [ ] `grep -rn "localhost:5000" frontend/src/` returns no matches
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts (the codebase has drifted since this plan was written).
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- If the app is ever deployed without a reverse proxy (e.g., static export), `NEXT_PUBLIC_API_URL` must be set explicitly — the `/api` fallback won't work in that case.
- A reviewer should verify that the Next.js rewrite/proxy config (if any) correctly routes `/api` to the backend.
