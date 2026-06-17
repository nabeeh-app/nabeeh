# Plan 032: Add error handling and loading states to payment/ticket mutations

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2e8fb57..HEAD -- admin/app/dashboard/payments/page.tsx admin/app/dashboard/tickets/[id]/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `2e8fb57`, 2026-06-16

## Why this matters

The payment verification (`payments/page.tsx`) and ticket status update (`tickets/[id]/page.tsx`) operations are fire-and-forget: the frontend sends a PATCH request and immediately reloads data without checking whether the operation succeeded. If the PATCH fails (network error, validation error, RLS block), the user sees stale data with no indication anything went wrong. There is also no loading feedback — the user can click "Verify" or "Resolve" multiple times before the first request completes.

## Current state

- `admin/app/dashboard/payments/page.tsx:39-46` — `updatePayment` has no error handling:
  ```ts
  async function updatePayment(id: string, status: string) {
    await fetch('/api/admin/payments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    loadPayments();
  }
  ```
- `admin/app/dashboard/tickets/[id]/page.tsx:41-48` — `updateStatus` has no error handling:
  ```ts
  async function updateStatus(status: string) {
    await fetch('/api/admin/tickets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ticketId, status }),
    });
    loadTicket();
  }
  ```

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Lint      | `cd admin && npm run lint`           | exit 0              |
| Build     | `cd admin && npm run build`          | exit 0              |

## Scope

**In scope**:
- `admin/app/dashboard/payments/page.tsx`
- `admin/app/dashboard/tickets/[id]/page.tsx`

**Out of scope**:
- `admin/app/api/admin/payments/route.ts` — server-side is already correct (returns `{ success: true }` or error envelope)
- `admin/app/api/admin/tickets/route.ts` — server-side is already correct
- Other dashboard pages — they don't have mutation operations

## Steps

### Step 1: Add loading state and error handling to payments page

In `admin/app/dashboard/payments/page.tsx`:

1. Add `actionLoading` state alongside existing state (after line 26):
   ```ts
   const [actionLoading, setActionLoading] = useState<string | null>(null);
   ```

2. Replace the `updatePayment` function (lines 39-46):
   ```ts
   async function updatePayment(id: string, status: string) {
     setActionLoading(id);
     try {
       const res = await fetch('/api/admin/payments', {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ id, status }),
       });
       const json = await res.json();
       if (!json.success) {
         alert(json.message || 'Failed to update payment');
       }
       await loadPayments();
     } catch {
       alert('Network error — please try again');
     } finally {
       setActionLoading(null);
     }
   }
   ```

3. Update the Verify and Reject buttons (lines 98-111) to disable during loading and show a spinner:

   For the Verify button, replace:
   ```tsx
   <button
     onClick={() => updatePayment(p.id, 'verified')}
     className="flex items-center gap-1 text-success hover:text-success/80 text-xs font-mono uppercase tracking-wider font-medium transition-colors"
   >
     <CheckCircle className="w-3.5 h-3.5" />
     Verify
   </button>
   ```
   with:
   ```tsx
   <button
     onClick={() => updatePayment(p.id, 'verified')}
     disabled={actionLoading === p.id}
     className="flex items-center gap-1 text-success hover:text-success/80 text-xs font-mono uppercase tracking-wider font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
   >
     <CheckCircle className="w-3.5 h-3.5" />
     {actionLoading === p.id ? 'Saving...' : 'Verify'}
   </button>
   ```

   For the Reject button, apply the same pattern (replace "Reject" text with conditional).

**Verify**: `grep -n "actionLoading" admin/app/dashboard/payments/page.tsx` → matches at least 3 times
**Verify**: `grep -n "disabled=" admin/app/dashboard/payments/page.tsx` → matches

### Step 2: Add loading state and error handling to ticket detail page

In `admin/app/dashboard/tickets/[id]/page.tsx`:

1. Add `actionLoading` state (after line 28):
   ```ts
   const [actionLoading, setActionLoading] = useState(false);
   ```

2. Replace the `updateStatus` function (lines 41-48):
   ```ts
   async function updateStatus(status: string) {
     setActionLoading(true);
     try {
       const res = await fetch('/api/admin/tickets', {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ id: ticketId, status }),
       });
       const json = await res.json();
       if (!json.success) {
         alert(json.message || 'Failed to update ticket');
       }
       await loadTicket();
     } catch {
       alert('Network error — please try again');
     } finally {
       setActionLoading(false);
     }
   }
   ```

3. Update all three action buttons (lines 107-128) to disable during loading:

   For each button, add `disabled={actionLoading}` and change text to show "Saving..." when loading.

   Example for "Start Working":
   ```tsx
   <button
     onClick={() => updateStatus('in_progress')}
     disabled={actionLoading}
     className="px-4 py-2 bg-accent text-ink font-body font-medium uppercase tracking-wider hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
   >
     {actionLoading ? 'Saving...' : 'Start Working'}
   </button>
   ```

   Apply the same pattern to "Resolve" and "Close" buttons.

**Verify**: `grep -n "actionLoading" admin/app/dashboard/tickets/[id]/page.tsx` → matches at least 4 times
**Verify**: `grep -n "disabled=" admin/app/dashboard/tickets/[id]/page.tsx` → matches

### Step 3: Verify build passes

```bash
cd admin && npm run build
```

Expected: build succeeds with no errors.

## Test plan

- Payments page: click "Verify" on a pending payment → button should show "Saving..." and be disabled during the request, then page should reload with updated data
- Payments page: disconnect network, click "Reject" → should show "Network error" alert
- Ticket detail: click "Start Working" → button should show "Saving..." during request, then ticket status should update
- Ticket detail: disconnect network, click "Resolve" → should show "Network error" alert
- Verify that rapid double-clicks don't fire multiple PATCH requests (button is disabled)

## Done criteria

- [ ] `npm run lint` exits 0 in `admin/`
- [ ] `npm run build` exits 0 in `admin/`
- [ ] `grep -n "actionLoading" admin/app/dashboard/payments/page.tsx` → at least 3 matches
- [ ] `grep -n "actionLoading" admin/app/dashboard/tickets/[id]/page.tsx` → at least 4 matches
- [ ] No fire-and-forget `fetch` calls remain in either file (every `fetch('/api/admin/payments'` and `fetch('/api/admin/tickets'` must have `await` + error handling)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The code at the locations in "Current state" doesn't match the excerpts
- A step's verification fails twice after a reasonable fix attempt
- The fix appears to require touching an out-of-scope file

## Maintenance notes

- The `alert()` calls are intentionally simple — the admin panel is internal tooling, not a consumer-facing product. If a toast/snackbar system is added later, replace `alert()` with it.
- The API routes already return `{ success: false, message: '...' }` on errors (per plan 028), so the frontend check `if (!json.success)` will work once 028 lands. If 028 hasn't landed yet, the `json.message` may be undefined — the fallback string handles this.
- Future mutation operations (e.g., inviting teachers, assigning tickets) should follow this same pattern: `actionLoading` state, try/catch with error feedback, disabled button during request.
