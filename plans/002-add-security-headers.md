# Plan 002: Add security headers to Next.js config (SEC-03)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2e8fb57..HEAD -- frontend/next.config.ts`
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

The Next.js app has no security headers configured. Without CSP, X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy, the application is vulnerable to clickjacking, MIME sniffing, data leakage via referrer, and unnecessary feature exposure. These are standard hardening headers expected of any production web application.

## Current state

- `frontend/next.config.ts` — the Next.js configuration file, wrapped with `next-intl` plugin. Currently has an empty config object.

Full file (`frontend/next.config.ts:1-10`):

```ts
import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  /* config options here */
};

export default withNextIntl(nextConfig);
```

Convention: Next.js config uses `headers()` to set per-request headers. The `withNextIntl` wrapper must remain as the outermost export.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |
| Build     | `npm run build`          | exit 0              |
| Lint      | `npm run lint`           | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `frontend/next.config.ts`

**Out of scope** (do NOT touch, even though they look related):
- Any component or page files.
- Backend security headers (handled in `backend/middleware/security.js`).

## Git workflow

- Branch: `advisor/002-add-security-headers`
- Commit message: `fix(security): add CSP and security headers to Next.js config`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add `headers()` to `next.config.ts`

Replace the empty config object in `frontend/next.config.ts` with a config that returns security headers via the `headers()` async function.

The file should become:

```ts
import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'self'",
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
```

**Verify**: `npm run build` in `frontend/` → exit 0 (no config errors)

### Step 2: Verify lint and typecheck

**Verify**: `npm run lint` in `frontend/` → exit 0
**Verify**: `npx tsc --noEmit` in `frontend/` → exit 0, no errors

### Step 3: Verify headers appear in build output

Run `npm run build` and confirm no warnings about invalid header values. The build should succeed cleanly.

**Verify**: `npm run build` in `frontend/` → exit 0

## Test plan

No unit tests for config files. Manual verification:

- After `npm run build && npm start`, inspect response headers with `curl -I http://localhost:3000/` and confirm all 5 headers are present.
- Verify CSP does not break the app by loading the dashboard in a browser.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint` in `frontend/` exits 0
- [ ] `npx tsc --noEmit` in `frontend/` exits 0
- [ ] `npm run build` in `frontend/` exits 0
- [ ] No files outside `frontend/next.config.ts` are modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- The code at `frontend/next.config.ts` doesn't match the excerpts (the codebase has drifted since this plan was written).
- `npm run build` fails due to a CSP policy blocking a legitimate resource (indicates the CSP needs tuning — report the specific resource blocked).
- The `withNextIntl` wrapper is removed or broken.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- If external resources are added (analytics scripts, CDN fonts, third-party APIs), the CSP must be updated to allow them. The current policy is restrictive by design.
- `'unsafe-inline'` and `'unsafe-eval'` in `script-src` are permissive — consider nonce-based CSP in the future for stricter control.
- `X-Frame-Options: DENY` prevents all framing. If embedding in an iframe is needed later, change to `SAMEORIGIN` and update CSP `frame-ancestors`.
- A reviewer should verify the CSP value doesn't break dev mode (HMR needs `'unsafe-eval'`).
