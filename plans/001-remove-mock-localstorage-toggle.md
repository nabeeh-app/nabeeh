# Plan 001: Remove localStorage mock mode toggle (SEC-02)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2e8fb57..HEAD -- frontend/src/lib/client.ts`
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

A user can open DevTools on any production deployment, set `localStorage.setItem('nabeeh_use_mock', 'true')`, and reload the page. This bypasses every real API call, all server-side RLS policies, and all auth checks — giving the attacker a fully mocked frontend with no backend enforcement. Removing the localStorage toggle makes mock mode a build-time-only decision controlled by the deployer, not the end user.

## Current state

- `src/lib/client.ts` — the mock-aware API client entry point. Exports `apiClient` which is either a `MockApiClient` or a real `ApiClient` depending on `shouldUseMock()`.

Full file (`src/lib/client.ts:1-26`):

```ts
import { ApiClient } from './api';

function shouldUseMock(): boolean {
  // NEXT_PUBLIC_ vars are inlined at build time, so this works in dev mode
  if (process.env.NEXT_PUBLIC_USE_MOCK === 'true') return true;

  // For production (npm run start), check localStorage flag
  if (typeof window !== 'undefined') {
    return localStorage.getItem('nabeeh_use_mock') === 'true';
  }

  return false;
}

let apiClient: ApiClient;

if (shouldUseMock()) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { default: MockApiClient } = require('./mock-client') as { default: new () => ApiClient };
  apiClient = new MockApiClient();
} else {
  apiClient = new ApiClient();
}

export { apiClient };
export default apiClient;
```

Convention: mock mode is gated by `NEXT_PUBLIC_USE_MOCK` env var (inlined at build time). This is the intended mechanism; the localStorage check was added for convenience during development but creates a production security hole.

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`               | exit 0, no errors   |
| Lint      | `npm run lint`                   | exit 0              |
| Grep      | `grep -rn "nabeeh_use_mock" frontend/src/` | no matches |

## Scope

**In scope** (the only files you should modify):
- `src/lib/client.ts`

**Out of scope** (do NOT touch, even though they look related):
- `src/lib/mock-client.ts` — the mock client itself; not changing it.
- `src/lib/api.ts` — the real API client; not changing it.

## Git workflow

- Branch: `advisor/001-remove-mock-localstorage`
- Commit message: `fix(security): remove localStorage mock mode toggle`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Remove localStorage check from `shouldUseMock()`

In `src/lib/client.ts`, delete lines 7–10 (the `// For production...` comment and the `if (typeof window !== 'undefined')` block that reads `localStorage`).

The function should become:

```ts
function shouldUseMock(): boolean {
  // NEXT_PUBLIC_USE_MOCK is inlined at build time — mock mode is build-time only
  return process.env.NEXT_PUBLIC_USE_MOCK === 'true';
}
```

**Verify**: `grep -rn "nabeeh_use_mock" frontend/src/` → no matches

### Step 2: Verify lint and typecheck

**Verify**: `npm run lint` in `frontend/` → exit 0
**Verify**: `npx tsc --noEmit` in `frontend/` → exit 0, no errors

## Test plan

No automated tests exist for this module. Manual verification:

- With `NEXT_PUBLIC_USE_MOCK=true` set at build time, the mock client should load.
- With `NEXT_PUBLIC_USE_MOCK` unset or `false`, the real `ApiClient` should load.
- Setting `localStorage.setItem('nabeeh_use_mock', 'true')` in DevTools should have no effect.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint` in `frontend/` exits 0
- [ ] `npx tsc --noEmit` in `frontend/` exits 0
- [ ] `grep -rn "nabeeh_use_mock" frontend/src/` returns no matches
- [ ] No files outside `src/lib/client.ts` are modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- The code at `src/lib/client.ts` doesn't match the excerpts (the codebase has drifted since this plan was written).
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- If someone needs to toggle mock mode in a deployed environment, they must rebuild with `NEXT_PUBLIC_USE_MOCK=true` — there is no runtime toggle.
- A reviewer should verify that no other files read `localStorage` for the `nabeeh_use_mock` key.
