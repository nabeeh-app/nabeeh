# Plan 015: Fix production logger no-op (DX-02)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2e8fb57..HEAD -- frontend/src/lib/logger.ts frontend/src/components/error-boundary.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `2e8fb57`, 2026-06-16
- **Issue**:

## Why this matters

`src/lib/logger.ts` gates ALL logging methods behind `if (isDev)`. In production, `logger.error()`, `logger.warn()`, `logger.info()`, and `logger.log()` are all silently discarded. This means `ErrorBoundary` at `src/components/error-boundary.tsx:31` calls `logger.error()` which does nothing in prod — errors are swallowed. Critical errors (auth failures, API errors, component crashes) should always be logged, even in production, for debugging and monitoring.

## Current state

- `src/lib/logger.ts:1-26` — full file:
  ```ts
  const isDev = process.env.NODE_ENV === 'development'

  const logger = {
    error: (...args: unknown[]) => {
      if (isDev) {
        console.error(...args)
      }
    },
    warn: (...args: unknown[]) => {
      if (isDev) {
        console.warn(...args)
      }
    },
    info: (...args: unknown[]) => {
      if (isDev) {
        console.info(...args)
      }
    },
    log: (...args: unknown[]) => {
      if (isDev) {
        console.log(...args)
      }
    },
  }

  export default logger
  ```

- `src/components/error-boundary.tsx:31` — `logger.error('ErrorBoundary caught an error:', error, errorInfo);`
- Backend uses Winston logger for production logging. Frontend logger is a thin console wrapper.

## Commands you will need

| Purpose   | Command                           | Expected on success |
|-----------|-----------------------------------|---------------------|
| Lint      | `npm run lint` in `frontend/`     | exit 0              |
| Grep      | `grep -rn "isDev" frontend/src/lib/logger.ts` | 2 remaining uses |

## Scope

**In scope** (the only files you should modify):
- `src/lib/logger.ts`

**Out of scope** (do NOT touch):
- `src/components/error-boundary.tsx` — its `logger.error()` call is correct; it's the logger that needs fixing.
- Backend Winston logger — separate concern.
- Any other file that imports logger.

## Git workflow

- Branch: `advisor/015-fix-production-logger`
- Commit style: `fix(logging): enable error and warn logging in production`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Remove `if (isDev)` guard from `error` and `warn`

Open `src/lib/logger.ts`. Remove the `if (isDev)` guards from `error` and `warn` so they always execute:

```ts
const isDev = process.env.NODE_ENV === 'development'

const logger = {
  error: (...args: unknown[]) => {
    console.error(...args)
  },
  warn: (...args: unknown[]) => {
    console.warn(...args)
  },
  info: (...args: unknown[]) => {
    if (isDev) {
      console.info(...args)
    }
  },
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log(...args)
    }
  },
}

export default logger
```

Key changes:
- `error`: removed `if (isDev)` wrapper — always logs.
- `warn`: removed `if (isDev)` wrapper — always logs.
- `info`: kept `if (isDev)` — verbose, dev-only.
- `log`: kept `if (isDev)` — verbose, dev-only.

**Verify**: `grep -n "isDev" frontend/src/lib/logger.ts` → returns 2 lines (the `info` and `log` guards only)

### Step 2: Verify lint

**Verify**: `npm run lint` in `frontend/` → exit 0

## Test plan

- No new automated tests — this is a logging behavior change.
- Manual verification: in production build, trigger an error boundary catch. Expected: `console.error` output visible in browser dev tools / server logs.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint` exits 0
- [ ] `grep -n "isDev" frontend/src/lib/logger.ts` returns exactly 2 lines (info, log)
- [ ] `grep -c "if (isDev)" frontend/src/lib/logger.ts` returns 2
- [ ] `src/lib/logger.ts` contains `console.error(...args)` without wrapping `if`
- [ ] `src/lib/logger.ts` contains `console.warn(...args)` without wrapping `if`
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- Line 1 no longer defines `const isDev = process.env.NODE_ENV === 'development'`.
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

- If a proper frontend error reporting service (Sentry, LogRocket, etc.) is added later, `logger.error` should pipe to it instead of just `console.error`.
- `console.info` and `console.log` remain dev-only to avoid noisy production output.
