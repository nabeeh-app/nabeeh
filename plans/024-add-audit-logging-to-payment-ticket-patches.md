# Plan 024: Add audit logging and RBAC to payment/ticket PATCH endpoints

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
- **Depends on**: plans/022-add-auth-to-admin-api-routes.md
- **Category**: security
- **Planned at**: commit `2e8fb57`, 2026-06-16

## Why this matters

The payments PATCH and tickets PATCH endpoints modify state (verify/reject payments, change ticket status) but have no audit trail and no RBAC enforcement. Plan 022 adds `requireAdmin()`, but without `requireModify: true` and `logAdminAction()`, a `viewer` role admin can still modify payments and tickets, and there's no record of who did what.

This plan layers RBAC + audit logging on top of Plan 022's auth.

## Current state

- `admin/app/api/admin/payments/route.ts:17-31` — PATCH handler accepts `{ id, status }`, updates payment, returns success. No auth role check, no audit log.
- `admin/app/api/admin/tickets/route.ts:26-41` — PATCH handler accepts `{ id, status }`, updates ticket, returns success. No auth role check, no audit log.
- `admin/lib/admin-auth.ts:26-28` — `canModify(role)` returns `true` for `super_admin` and `support_agent`, `false` for `viewer`.
- `admin/lib/admin-auth.ts:34-49` — `logAdminAction(adminId, action, entityType, entityId, metadata, ipAddress)` inserts into `admin_audit_log`.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Lint      | `cd admin && npm run lint`           | exit 0              |
| Build     | `cd admin && npm run build`          | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `admin/app/api/admin/payments/route.ts`
- `admin/app/api/admin/tickets/route.ts`

**Out of scope** (do NOT touch):
- `admin/lib/admin-auth.ts` — already has `canModify()` and `logAdminAction()`.
- GET handlers in these files — already protected by Plan 022.
- Other API routes — they are read-only (GET) and don't need RBAC.

## Git workflow

- Branch: `advisor/024-add-audit-logging-to-payment-ticket-patches`
- Commit message: `security(admin): add RBAC and audit logging to payment and ticket mutations`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Update payments PATCH with RBAC + audit

Edit `admin/app/api/admin/payments/route.ts`. The current PATCH handler:

```typescript
export async function PATCH(request: Request) {
  const body = await request.json();
  const { id, status } = body;

  if (!id || !status) {
    return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('payments')
    .update({ status, verified_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

Replace with:

```typescript
import { requireAdmin, logAdminAction } from '@/lib/admin-auth';

export async function PATCH(request: Request) {
  let admin;
  try {
    admin = await requireAdmin(request, { requireModify: true });
  } catch (response) {
    return response;
  }

  const body = await request.json();
  const { id, status } = body;

  if (!id || !status) {
    return NextResponse.json(
      { success: false, message: 'Missing id or status', code: 'VALIDATION_ERROR' },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from('payments')
    .update({ status, verified_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message, code: 'DB_ERROR' },
      { status: 500 }
    );
  }

  await logAdminAction(
    admin.id,
    `payment_${status}`,
    'payment',
    id,
    { status }
  );

  return NextResponse.json({ success: true });
}
```

**Verify**: `grep -c "requireAdmin\|logAdminAction" admin/app/api/admin/payments/route.ts` → `2`

### Step 2: Update tickets PATCH with RBAC + audit

Edit `admin/app/api/admin/tickets/route.ts`. Apply the same pattern:

```typescript
import { requireAdmin, logAdminAction } from '@/lib/admin-auth';

export async function PATCH(request: Request) {
  let admin;
  try {
    admin = await requireAdmin(request, { requireModify: true });
  } catch (response) {
    return response;
  }

  const body = await request.json();
  const { id, status } = body;

  if (!id || !status) {
    return NextResponse.json(
      { success: false, message: 'Missing id or status', code: 'VALIDATION_ERROR' },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from('support_tickets')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message, code: 'DB_ERROR' },
      { status: 500 }
    );
  }

  await logAdminAction(
    admin.id,
    `ticket_${status}`,
    'support_ticket',
    id,
    { status }
  );

  return NextResponse.json({ success: true });
}
```

**Verify**: `grep -c "requireAdmin\|logAdminAction" admin/app/api/admin/tickets/route.ts` → `2`

### Step 3: Lint and build

**Verify**: `cd admin && npm run lint` → exits 0.
**Verify**: `cd admin && npm run build` → exits 0.

## Test plan

- As a `viewer` role: `PATCH /api/admin/payments` with `{ id, status: "verified" }` → 403 response.
- As a `super_admin`: same request → 200, and `admin_audit_log` has a new row with `action: "payment_verified"`.
- Same flow for tickets.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -c "requireAdmin.*requireModify" admin/app/api/admin/payments/route.ts` → `1`
- [ ] `grep -c "requireAdmin.*requireModify" admin/app/api/admin/tickets/route.ts` → `1`
- [ ] `grep -c "logAdminAction" admin/app/api/admin/payments/route.ts` → `1`
- [ ] `grep -c "logAdminAction" admin/app/api/admin/tickets/route.ts` → `1`
- [ ] `cd admin && npm run build` exits 0
- [ ] `cd admin && npm run lint` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `requireAdmin` throws a type error (check that the `Request` type is compatible with Next.js 16 route handlers).
- `logAdminAction` fails because the `admin_audit_log` table doesn't exist (report this — the table needs to be created first).
- The PATCH handler breaks for existing callers.

## Maintenance notes

- The `logAdminAction` call is fire-and-forget. If the audit log insert fails, the PATCH still succeeds. This is intentional — audit logging should never block user operations. But it means audit gaps are silent. Consider adding a try/catch with Winston logging in the future.
- The `status` values are not validated against an enum. Plan 026 (Zod validation) will add this.
