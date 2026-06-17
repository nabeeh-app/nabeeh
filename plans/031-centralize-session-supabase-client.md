# Plan 031: Centralize Supabase client in session route and add Zod validation

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2e8fb57..HEAD -- admin/app/api/admin/session/route.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `2e8fb57`, 2026-06-16

## Why this matters

Plan 027 fixes the login page to stop creating its own Supabase client and import from `lib/supabase.ts`. The session API route (`admin/app/api/admin/session/route.ts`) has the exact same problem — it creates its own `createClient()` from `@supabase/supabase-js` instead of importing the centralized `supabaseBrowser` from `@/lib/supabase`. Additionally, the POST endpoint only does a manual `!accessToken` check instead of using Zod validation like every other mutating endpoint (per plan 026). This creates an inconsistency: the session endpoint is the only API route that accepts raw JSON without schema validation.

## Current state

- `admin/app/api/admin/session/route.ts:1-5` — imports `createClient` and reads env vars inline:
  ```ts
  import { createClient } from '@supabase/supabase-js';

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_ADMIN_SUPABASE_ANON_KEY!;
  ```
- `admin/app/api/admin/session/route.ts:8` — only manual check on body:
  ```ts
  const { accessToken } = await request.json();

  if (!accessToken) {
    return NextResponse.json(
      { success: false, message: 'Missing access token', code: 'MISSING_TOKEN' },
      { status: 400 }
    );
  }
  ```
- `admin/app/api/admin/session/route.ts:17` — creates inline client:
  ```ts
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  ```
- `admin/lib/supabase.ts:12` — already exports `supabaseBrowser` (anon client, safe for getUser):
  ```ts
  export const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey);
  ```

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Lint      | `cd admin && npm run lint`           | exit 0              |
| Build     | `cd admin && npm run build`          | exit 0              |

## Scope

**In scope**:
- `admin/app/api/admin/session/route.ts`

**Out of scope**:
- `admin/lib/supabase.ts` — no changes needed, already exports what we need
- `admin/app/login/page.tsx` — covered by plan 027
- All other API routes — already use `@/lib/supabase`

## Steps

### Step 1: Add Zod import and validation schema

At the top of `admin/app/api/admin/session/route.ts`, add the Zod import and define a schema:

Replace:
```ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
```

With:
```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseBrowser } from '@/lib/supabase';

const sessionSchema = z.object({
  accessToken: z.string().min(1, 'Missing access token'),
});
```

**Verify**: `grep -n "zod" admin/app/api/admin/session/route.ts` → matches
**Verify**: `grep -n "supabaseBrowser" admin/app/api/admin/session/route.ts` → matches

### Step 2: Remove env var reads and inline client creation

Delete these lines entirely (they are no longer needed since `supabaseBrowser` handles this internally):

```ts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_ADMIN_SUPABASE_ANON_KEY!;
```

**Verify**: `grep -n "process.env" admin/app/api/admin/session/route.ts` → no matches

### Step 3: Replace manual body parsing with Zod validation

Replace the current body parsing and manual check (lines 8-15):
```ts
  const { accessToken } = await request.json();

  if (!accessToken) {
    return NextResponse.json(
      { success: false, message: 'Missing access token', code: 'MISSING_TOKEN' },
      { status: 400 }
    );
  }
```

With:
```ts
  const body = await request.json();
  const parsed = sessionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' },
      { status: 400 }
    );
  }

  const { accessToken } = parsed.data;
```

**Verify**: `grep -n "safeParse" admin/app/api/admin/session/route.ts` → matches

### Step 4: Replace inline Supabase client with supabaseBrowser

Replace:
```ts
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
```

With:
```ts
  const { data: { user }, error } = await supabaseBrowser.auth.getUser(accessToken);
```

**Verify**: `grep -n "createClient" admin/app/api/admin/session/route.ts` → no matches
**Verify**: `grep -n "supabaseBrowser" admin/app/api/admin/session/route.ts` → matches

### Step 5: Verify build passes

```bash
cd admin && npm run build
```

Expected: build succeeds with no errors.

## Test plan

- Manual: POST to `/api/admin/session` with an empty body → should return `{ success: false, message: '...', code: 'VALIDATION_ERROR' }` with status 400
- Manual: POST to `/api/admin/session` with `{ "accessToken": "" }` → should return validation error
- Manual: POST to `/api/admin/session` with a valid token → should set the httpOnly cookie and return `{ success: true }`
- Verify login flow still works end-to-end

## Done criteria

- [ ] `npm run lint` exits 0 in `admin/`
- [ ] `npm run build` exits 0 in `admin/`
- [ ] `grep -n "createClient" admin/app/api/admin/session/route.ts` returns no matches
- [ ] `grep -n "process.env" admin/app/api/admin/session/route.ts` returns no matches
- [ ] `grep -n "safeParse" admin/app/api/admin/session/route.ts` returns a match
- [ ] `plans/README.md` status row updated

## STOP conditions

- The code at the locations in "Current state" doesn't match the excerpts
- A step's verification fails twice after a reasonable fix attempt
- The fix appears to require touching an out-of-scope file

## Maintenance notes

- This plan should be executed AFTER plan 027, since both touch the login flow and plan 027's changes to the login page should land first
- The `supabaseBrowser` client from `lib/supabase.ts` uses the anon key, which is safe for `getUser()` calls — it only validates tokens, it doesn't bypass RLS
- Future session-related endpoints (e.g., refresh, revoke) should also import from `@/lib/supabase` and use Zod
