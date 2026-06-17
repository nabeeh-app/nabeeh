# Plan 026: Add Zod validation to admin PATCH endpoints

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
- **Depends on**: plans/024-add-audit-logging-to-payment-ticket-patches.md
- **Category**: security
- **Planned at**: commit `2e8fb57`, 2026-06-16

## Why this matters

The payments PATCH and tickets PATCH endpoints accept arbitrary strings for `status` — there's no enum validation. An attacker (or a bug in the client) could set `status` to `"admin"` or `"super_admin"` on the payments table, or any arbitrary string on tickets. Zod is already a dependency (`package.json:21`) but unused — this plan puts it to work.

## Current state

- `admin/app/api/admin/payments/route.ts:19` — `const { id, status } = body;` — no validation on `status` value.
- `admin/app/api/admin/tickets/route.ts:28` — same pattern.
- `admin/package.json:21` — `"zod": "^4.4.3"` is installed but never imported.
- Domain types in `admin/types/index.ts:32,59-60`:
  ```typescript
  export type PaymentStatus = 'pending' | 'verified' | 'rejected' | 'refunded';
  export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
  ```

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
- `admin/types/index.ts` — types are already correct.
- GET handlers — they don't accept user input that needs validation.
- `admin/lib/admin-auth.ts` — no changes needed.

## Git workflow

- Branch: `advisor/026-add-zod-validation-to-admin-api-routes`
- Commit message: `security(admin): add Zod validation to payment and ticket PATCH endpoints`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add Zod validation to payments PATCH

Edit `admin/app/api/admin/payments/route.ts`. Add import at the top:

```typescript
import { z } from 'zod';
```

Add validation schema before the PATCH handler:

```typescript
const updatePaymentSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['verified', 'rejected', 'refunded']),
});
```

In the PATCH handler, replace the manual `if (!id || !status)` check with:

```typescript
const body = await request.json();
const parsed = updatePaymentSchema.safeParse(body);

if (!parsed.success) {
  return NextResponse.json(
    { success: false, message: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' },
    { status: 400 }
  );
}

const { id, status } = parsed.data;
```

**Verify**: `grep -c "z.enum\|safeParse" admin/app/api/admin/payments/route.ts` → `2`

### Step 2: Add Zod validation to tickets PATCH

Edit `admin/app/api/admin/tickets/route.ts`. Add import and schema:

```typescript
import { z } from 'zod';

const updateTicketSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['in_progress', 'resolved', 'closed']),
});
```

Replace the manual validation in PATCH with:

```typescript
const body = await request.json();
const parsed = updateTicketSchema.safeParse(body);

if (!parsed.success) {
  return NextResponse.json(
    { success: false, message: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' },
    { status: 400 }
  );
}

const { id, status } = parsed.data;
```

**Verify**: `grep -c "z.enum\|safeParse" admin/app/api/admin/tickets/route.ts` → `2`

### Step 3: Lint and build

**Verify**: `cd admin && npm run lint` → exits 0.
**Verify**: `cd admin && npm run build` → exits 0.

## Test plan

- `PATCH /api/admin/payments` with `{ id: "not-a-uuid", status: "banana" }` → 400 with validation error.
- `PATCH /api/admin/payments` with `{ id: "valid-uuid", status: "verified" }` → passes validation (may succeed or fail on DB, but not on validation).
- `PATCH /api/admin/tickets` with `{ id: "valid-uuid", status: "open" }` → 400 (status `open` is not in the PATCH enum — tickets go from `open` to `in_progress`, not `open` to `open`).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -c "zod" admin/app/api/admin/payments/route.ts` → `1` (import present)
- [ ] `grep -c "zod" admin/app/api/admin/tickets/route.ts` → `1` (import present)
- [ ] `cd admin && npm run build` exits 0
- [ ] `cd admin && npm run lint` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Zod v4 import path has changed (`zod` vs `zod/v4`) — check the installed version.
- The `z.string().uuid()` validator rejects valid UUIDs (check Supabase UUID format).
- The PATCH handler breaks for existing callers who send valid payloads.

## Maintenance notes

- The `status` enum for tickets PATCH excludes `open` — you can't "set" a ticket to open via PATCH because new tickets start as `open`. The valid transitions are `open → in_progress → resolved → closed`. This is intentional.
- The `status` enum for payments PATCH excludes `pending` — a payment starts as `pending` and can only be changed to `verified`, `rejected`, or `refunded`.
- Future: add Zod validation to GET query parameters (e.g. validate `period` in ai-usage, `status` in payments list).
