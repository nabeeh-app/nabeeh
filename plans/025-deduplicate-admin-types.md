# Plan 025: Deduplicate AdminRole and AdminUser types

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

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `2e8fb57`, 2026-06-16

## Why this matters

`AdminRole` and `AdminUser` are defined in two places with divergent fields:

- `admin/lib/admin-auth.ts:3-13` — missing `invited_by` and `updated_at`
- `admin/types/index.ts:1-13` — has all fields including `invited_by` and `updated_at`

This creates a type drift risk: code using `lib/admin-auth.ts` types won't know about `invited_by`/`updated_at`, and the two definitions could silently diverge further. The canonical types should live in `types/index.ts` (the dedicated types file), and `lib/admin-auth.ts` should import from there.

## Current state

- `admin/lib/admin-auth.ts:3-13`:
  ```typescript
  export type AdminRole = 'super_admin' | 'support_agent' | 'viewer';

  export interface AdminUser {
    id: string;
    user_id: string;
    email: string;
    role: AdminRole;
    name: string;
    created_at: string;
    last_login: string | null;
  }
  ```
- `admin/types/index.ts:1-13`:
  ```typescript
  export type AdminRole = 'super_admin' | 'support_agent' | 'viewer';

  export interface AdminUser {
    id: string;
    user_id: string;
    email: string;
    role: AdminRole;
    name: string;
    invited_by: string | null;
    created_at: string;
    updated_at: string;
    last_login: string | null;
  }
  ```

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Lint      | `cd admin && npm run lint`           | exit 0              |
| Build     | `cd admin && npm run build`          | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `admin/lib/admin-auth.ts` — remove local type definitions, import from `types/index.ts`

**Out of scope** (do NOT touch):
- `admin/types/index.ts` — already canonical, leave as-is.
- Any other files that import from `lib/admin-auth.ts` — they use the functions, not the types directly.

## Git workflow

- Branch: `advisor/025-deduplicate-admin-types`
- Commit message: `refactor(admin): deduplicate AdminRole/AdminUser types to single source`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Update `admin/lib/admin-auth.ts` to import types

Remove lines 3-13 (the local `AdminRole` and `AdminUser` definitions) and replace with:

```typescript
import type { AdminRole, AdminUser } from '@/types';
```

The `@/types` path alias resolves to `admin/types/` per `tsconfig.json:22`.

The rest of the file (functions `getAdminUser`, `canModify`, `canManageAdmins`, `logAdminAction`) should remain unchanged — they already use `AdminRole` as a parameter type, and the import will satisfy those references.

**Verify**: `grep -c "export type AdminRole\|export interface AdminUser" admin/lib/admin-auth.ts` → `0` (no local definitions)
**Verify**: `grep -c "import type.*AdminRole.*AdminUser.*@/types" admin/lib/admin-auth.ts` → `1`

### Step 2: Verify no other files import the old local types

Check if any file imports `AdminRole` or `AdminUser` from `lib/admin-auth`:

**Verify**: `grep -rn "from.*lib/admin-auth" admin/ | grep -v "node_modules"` → only shows files importing functions, not types. (If any file imports types from `lib/admin-auth`, update it to import from `@/types` instead.)

### Step 3: Lint and build

**Verify**: `cd admin && npm run lint` → exits 0.
**Verify**: `cd admin && npm run build` → exits 0.

## Test plan

- The build succeeding is the primary test — TypeScript will catch any type mismatches.
- Manual: grep for `AdminUser` usage in `lib/admin-auth.ts` to confirm the imported type is used correctly.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -c "export type AdminRole\|export interface AdminUser" admin/lib/admin-auth.ts` → `0`
- [ ] `grep -c "import type.*@/types" admin/lib/admin-auth.ts` → `1`
- [ ] `cd admin && npm run build` exits 0
- [ ] `cd admin && npm run lint` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The build fails with "Cannot find module '@/types'" — check `tsconfig.json` paths.
- Any file that imported `AdminUser` from `lib/admin-auth` breaks (unlikely — most import the functions, not the types).

## Maintenance notes

- `types/index.ts` is now the single source of truth for all admin domain types. Any future type changes (e.g. adding fields to `AdminUser`) should only be made there.
- The `getAdminUser` function in `lib/admin-auth.ts` returns `Promise<AdminUser | null>` — the return type annotation uses the imported `AdminUser`, so it stays in sync automatically.
