# Plan 009: Fix OAuth callback duplicate Supabase client (SEC-09)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2e8fb57..HEAD -- frontend/src/app/[locale]/auth/callback-client/page.tsx frontend/src/lib/supabase.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `2e8fb57`, 2026-06-16
- **Issue**: (none)

## Why this matters

`callback-client/page.tsx` creates its own Supabase client via `createClient(supabaseUrl, supabaseAnonKey)` instead of importing the shared singleton from `@/lib/supabase`. This means two Supabase client instances exist in the browser — one from the shared module, one local to the callback page. Each maintains its own auth session cache, which can cause race conditions during OAuth token exchange. Additionally, lines 9-10 use non-null assertions (`!`) on `process.env` values — if the env vars are unset (e.g. misconfigured deployment), the page crashes with an unhelpful error.

## Current state

- `src/app/[locale]/auth/callback-client/page.tsx` — OAuth callback page (107 lines)
- Lines 5-10 — local Supabase client creation with `!` assertions:

```tsx
import { createClient } from '@supabase/supabase-js';
import { useLocale } from 'next-intl';
import { apiClient } from '@/lib/client';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
```

- Line 18 — local `createClient` call inside `CallbackHandler`:

```tsx
const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- `src/lib/supabase.ts` — the shared Supabase client (6 lines):

```tsx
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

## Commands you will need

| Purpose   | Command                                          | Expected on success |
|-----------|--------------------------------------------------|---------------------|
| Lint      | `cd frontend && npm run lint`                    | exit 0              |
| Tests     | `cd frontend && npm test`                        | exit 0 (or N/A)     |
| Build     | `cd frontend && npm run build`                   | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `frontend/src/app/[locale]/auth/callback-client/page.tsx`

**Out of scope** (do NOT touch, even though they look related):
- `src/lib/supabase.ts` — shared client, no change needed
- `src/app/[locale]/auth/callback/route.ts` — server-side callback, different code path
- Other auth pages — not in scope

## Git workflow

- Branch: `advisor/009-fix-oauth-callback-supabase`
- Single commit: `fix(auth): use shared Supabase client in OAuth callback page`

## Steps

### Step 1: Replace the local `createClient` import and env vars

In `src/app/[locale]/auth/callback-client/page.tsx`:

1. Remove the `createClient` import on line 5:
   ```tsx
   import { createClient } from '@supabase/supabase-js';
   ```

2. Add the shared supabase import (replacing the removed line):
   ```tsx
   import { supabase } from '@/lib/supabase';
   ```

3. Remove lines 9-10 (the local env var reads):
   ```tsx
   const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
   const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
   ```

**Verify**: `grep -n "createClient" frontend/src/app/[locale]/auth/callback-client/page.tsx` returns no matches
**Verify**: `grep -n "supabaseUrl\|supabaseAnonKey" frontend/src/app/[locale]/auth/callback-client/page.tsx` returns no matches

### Step 2: Remove the local `createClient` call

In the `CallbackHandler` function, line 18, remove:

```tsx
const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

The `supabase` variable is now imported from `@/lib/supabase`, so no local instantiation is needed.

**Verify**: `grep -n "createClient" frontend/src/app/[locale]/auth/callback-client/page.tsx` returns no matches (still 0 matches)

### Step 3: Verify the shared import is correct

Confirm the import statement is present and correct:

```tsx
import { supabase } from '@/lib/supabase';
```

**Verify**: `grep -n "from '@/lib/supabase'" frontend/src/app/[locale]/auth/callback-client/page.tsx` returns one match

### Step 4: Run lint

```bash
cd frontend && npm run lint
```

**Verify**: exits 0

### Step 5: Run build

```bash
cd frontend && npm run build
```

**Verify**: exits 0

## Test plan

- No automated test infrastructure exists for this page. Verification is manual:
  - `npm run lint` and `npm run build` both pass.
  - No `createClient` calls remain in the callback page.
  - The page imports from `@/lib/supabase`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint` exits 0 in `frontend/`
- [ ] `npm run build` exits 0 in `frontend/`
- [ ] `grep -rn "createClient" frontend/src/app/[locale]/auth/callback-client/page.tsx` returns no matches
- [ ] `grep -rn "supabaseUrl\|supabaseAnonKey" frontend/src/app/[locale]/auth/callback-client/page.tsx` returns no matches
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- The code at lines 5-10 and line 18 doesn't match the "Current state" excerpts (codebase has drifted).
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.
- `src/lib/supabase.ts` doesn't export a `supabase` named export (the shared client doesn't exist or has a different name).

## Maintenance notes

- The `supabase.ts` file still uses non-null assertions on env vars (`!`). A future improvement could add runtime validation with a descriptive error.
- This page uses `apiClient` from `@/lib/client` (not `@/lib/api`). These are two different modules — verify they are the same or intended to coexist before merging if either is renamed.
