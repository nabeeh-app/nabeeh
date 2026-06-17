# Plan 010: Guard api.ts 401 interceptor for SSR (CORRECTNESS-18)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2e8fb57..HEAD -- frontend/src/lib/api.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `2e8fb57`, 2026-06-16
- **Issue**: (none)

## Why this matters

`api.ts` line 63 accesses `window.location.pathname` inside the 401 response interceptor. The `ApiClient` is instantiated at module load time (line 801: `export const apiClient = new ApiClient()`). During Next.js server-side rendering, `window` is `undefined`, causing a `ReferenceError: window is not defined` when the axios response interceptor tries to read `window.location.pathname` for any 401 error response. This can crash SSR or cause the page to fall back to client-only rendering.

## Current state

- `src/lib/api.ts` — the centralized API client (802 lines)
- Lines 54-65 — the 401 response interceptor:

```tsx
// Add response interceptor for error handling with retry
this.api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    
    // Only auto-logout on 401 (Unauthorized) errors, not on network timeouts or other errors
    if (error.response?.status === 401) {
      this.removeToken();
      const locale = window.location.pathname.split('/')[1] || 'en';
      window.location.href = `/${locale}/login`;
    }
    
    // Retry logic for 5xx errors and network errors
    ...
```

- Line 801 — module-level instantiation:

```tsx
export const apiClient = new ApiClient();
```

- `getToken()` (lines 102-107) already has an SSR guard: `if (typeof window !== 'undefined')`.

## Commands you will need

| Purpose   | Command                                          | Expected on success |
|-----------|--------------------------------------------------|---------------------|
| Lint      | `cd frontend && npm run lint`                    | exit 0              |
| Tests     | `cd frontend && npm test`                        | exit 0 (or N/A)     |
| Build     | `cd frontend && npm run build`                   | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `frontend/src/lib/api.ts`

**Out of scope** (do NOT touch, even though they look related):
- `src/hooks/useAuth.tsx` — auth provider
- `src/app/[locale]/auth/callback-client/page.tsx` — separate plan
- Other API consumers

## Git workflow

- Branch: `advisor/010-guard-api-ssr-interceptor`
- Single commit: `fix(api): guard window.location access in 401 interceptor for SSR`

## Steps

### Step 1: Wrap `window.location` access in SSR guard

In `src/lib/api.ts`, lines 61-64, change:

```tsx
if (error.response?.status === 401) {
  this.removeToken();
  const locale = window.location.pathname.split('/')[1] || 'en';
  window.location.href = `/${locale}/login`;
}
```

To:

```tsx
if (error.response?.status === 401) {
  this.removeToken();
  if (typeof window !== 'undefined') {
    const locale = window.location.pathname.split('/')[1] || 'en';
    window.location.href = `/${locale}/login`;
  }
}
```

This matches the existing pattern used in `getToken()` at line 103.

**Verify**: `grep -n "window.location" frontend/src/lib/api.ts` shows it inside the guard

### Step 2: Run lint

```bash
cd frontend && npm run lint
```

**Verify**: exits 0

### Step 3: Run build

```bash
cd frontend && npm run build
```

**Verify**: exits 0

## Test plan

- No automated test infrastructure exists for the api client. Verification is manual:
  - `npm run lint` and `npm run build` both pass.
  - The `window.location` access is inside the `typeof window !== 'undefined'` guard.
  - The guard pattern matches existing code in the same file (`getToken()`).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint` exits 0 in `frontend/`
- [ ] `npm run build` exits 0 in `frontend/`
- [ ] `grep -n "window.location" frontend/src/lib/api.ts` shows the access is inside a `typeof window !== 'undefined'` guard
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- The code at lines 61-64 doesn't match the "Current state" excerpts (codebase has drifted).
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.
- `ApiClient` is no longer instantiated at module load time (line 801 changed).

## Maintenance notes

- If Next.js App Router SSR behavior changes, this guard may need re-evaluation.
- The `removeToken()` call (line 62) is already SSR-safe because it has its own `typeof window` guard (line 117). Only the redirect lines need the guard.
- A future improvement could extract the 401 handler into a named method for testability.
