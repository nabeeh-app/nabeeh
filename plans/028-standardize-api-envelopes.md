# Plan 028: Standardize API response envelopes across all admin routes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2e8fb57..HEAD -- admin/app/api/admin/ admin/app/dashboard/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `2e8fb57`, 2026-06-16

## Why this matters

The admin API routes return inconsistent response shapes. Some use the standard `{ success: true, data: ... }` envelope, while others return raw arrays/objects. This makes frontend error handling unreliable — the dashboard pages can't distinguish success from failure by checking `data.success`. The main Nabeeh backend mandates the standard envelope (see AGENTS.md §3).

## Current state

Routes that **already** use the envelope:
- `admin/app/api/admin/me/route.ts:7` — returns `{ id, role, name }` (no `success` wrapper)
- `admin/app/api/admin/payments/route.ts:48` — PATCH returns `{ success: true }`
- `admin/app/api/admin/tickets/route.ts:57` — PATCH returns `{ success: true }`

Routes that **don't** use the envelope:
- `admin/app/api/admin/teachers/route.ts:21` — returns `{ error: 'Not found' }` (wrong shape)
- `admin/app/api/admin/teachers/route.ts:63` — returns raw array `rows`
- `admin/app/api/admin/payments/route.ts:22` — returns raw array `data || []`
- `admin/app/api/admin/tickets/route.ts:23` — returns raw single object `data`
- `admin/app/api/admin/tickets/route.ts:31` — returns raw array `data || []`
- `admin/app/api/admin/metrics/route.ts:29` — returns raw object
- `admin/app/api/admin/health/route.ts:14` — returns raw object
- `admin/app/api/admin/ai-usage/route.ts:42` — returns raw array

Frontend pages that consume these (must be updated to read `data.success` / `data.data`):
- `admin/app/dashboard/layout.tsx:31-38` — fetches `/api/admin/me`
- `admin/app/dashboard/page.tsx:32-36` — fetches `/api/admin/metrics`
- `admin/app/dashboard/teachers/page.tsx:27-31` — fetches `/api/admin/teachers`
- `admin/app/dashboard/teachers/[id]/page.tsx:27-31` — fetches `/api/admin/teachers?id=`
- `admin/app/dashboard/payments/page.tsx:28-32` — fetches `/api/admin/payments`
- `admin/app/dashboard/ai-usage/page.tsx:23-27` — fetches `/api/admin/ai-usage`
- `admin/app/dashboard/health/page.tsx:16-20` — fetches `/api/admin/health`
- `admin/app/dashboard/tickets/page.tsx:30-34` — fetches `/api/admin/tickets`
- `admin/app/dashboard/tickets/[id]/page.tsx:30-34` — fetches `/api/admin/tickets?id=`

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Lint      | `cd admin && npm run lint`           | exit 0              |
| Build     | `cd admin && npm run build`          | exit 0              |

## Scope

**In scope**:
- `admin/app/api/admin/teachers/route.ts`
- `admin/app/api/admin/payments/route.ts`
- `admin/app/api/admin/tickets/route.ts`
- `admin/app/api/admin/metrics/route.ts`
- `admin/app/api/admin/health/route.ts`
- `admin/app/api/admin/ai-usage/route.ts`
- `admin/app/api/admin/me/route.ts`
- `admin/app/dashboard/layout.tsx`
- `admin/app/dashboard/page.tsx`
- `admin/app/dashboard/teachers/page.tsx`
- `admin/app/dashboard/teachers/[id]/page.tsx`
- `admin/app/dashboard/payments/page.tsx`
- `admin/app/dashboard/ai-usage/page.tsx`
- `admin/app/dashboard/health/page.tsx`
- `admin/app/dashboard/tickets/page.tsx`
- `admin/app/dashboard/tickets/[id]/page.tsx`

**Out of scope**:
- `admin/app/api/admin/session/route.ts` — already returns `{ success: true }`
- Backend routes — separate codebase

## Steps

### Step 1: Fix teachers route to use envelope

In `admin/app/api/admin/teachers/route.ts`:

1. Line 21 — replace:
   ```ts
   if (!teacherData.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
   ```
   with:
   ```ts
   if (!teacherData.data) {
     return NextResponse.json(
       { success: false, message: 'Teacher not found', code: 'NOT_FOUND' },
       { status: 404 }
     );
   }
   ```

2. Line 23-30 — wrap the detail response:
   ```ts
   return NextResponse.json({
     success: true,
     data: {
       ...teacherData.data,
       subscription: subData.data,
       students_count: studentsData.count || 0,
       groups_count: groupsData.count || 0,
       offerings_count: offeringsData.count || 0,
       payments: paymentsData.data || [],
     },
   });
   ```

3. Line 63 — wrap the list response:
   ```ts
   return NextResponse.json({ success: true, data: rows });
   ```

**Verify**: `grep -n "success:" admin/app/api/admin/teachers/route.ts` → matches on lines for both responses

### Step 2: Fix payments GET to use envelope

In `admin/app/api/admin/payments/route.ts`, line 22 — replace:
```ts
return NextResponse.json(data || []);
```
with:
```ts
return NextResponse.json({ success: true, data: data || [] });
```

**Verify**: `grep -n "success:" admin/app/api/admin/payments/route.ts` → matches

### Step 3: Fix tickets route to use envelope

In `admin/app/api/admin/tickets/route.ts`:

1. Line 23 — replace:
   ```ts
   return NextResponse.json(data);
   ```
   with:
   ```ts
   return NextResponse.json({ success: true, data });
   ```

2. Line 31 — replace:
   ```ts
   return NextResponse.json(data || []);
   ```
   with:
   ```ts
   return NextResponse.json({ success: true, data: data || [] });
   ```

**Verify**: `grep -n "success:" admin/app/api/admin/tickets/route.ts` → matches

### Step 4: Fix metrics, health, and ai-usage routes to use envelope

In `admin/app/api/admin/metrics/route.ts`, wrap the return at line 29:
```ts
return NextResponse.json({ success: true, data: { ... } });
```

In `admin/app/api/admin/health/route.ts`, wrap the return at line 14:
```ts
return NextResponse.json({ success: true, data: { ... } });
```

In `admin/app/api/admin/ai-usage/route.ts`, wrap the return at line 42:
```ts
return NextResponse.json({ success: true, data: Array.from(grouped.values()).sort(...) });
```

**Verify**: `grep -rn "NextResponse.json" admin/app/api/admin/metrics/route.ts admin/app/api/admin/health/route.ts admin/app/api/admin/ai-usage/route.ts` → all contain `success: true`

### Step 5: Fix /api/admin/me to use envelope

In `admin/app/api/admin/me/route.ts`, wrap the return at line 7:
```ts
return NextResponse.json({
  success: true,
  data: { id: admin.id, role: admin.role, name: admin.name },
});
```

**Verify**: `grep -n "success:" admin/app/api/admin/me/route.ts` → match

### Step 6: Update dashboard layout to read envelope

In `admin/app/dashboard/layout.tsx`, update the fetch handler (lines 31-38):
```ts
fetch('/api/admin/me')
  .then((res) => {
    if (!res.ok) throw new Error('Not authenticated');
    return res.json();
  })
  .then((data) => {
    if (!data.success) throw new Error(data.message || 'Not authenticated');
    setAdmin(data.data);
    setMounted(true);
  })
  .catch(() => {
    router.push('/login');
  });
```

**Verify**: `grep -n "data.data" admin/app/dashboard/layout.tsx` → match

### Step 7: Update dashboard page to read envelope

In `admin/app/dashboard/page.tsx`, update the loadMetrics function (lines 32-36):
```ts
const loadMetrics = useCallback(async () => {
  const res = await fetch('/api/admin/metrics');
  const json = await res.json();
  setMetrics(json.success ? json.data : null);
  setLoading(false);
}, []);
```

**Verify**: `grep -n "json.success" admin/app/dashboard/page.tsx` → match

### Step 8: Update all remaining dashboard pages to read envelope

Apply the same pattern to each page — wrap the data extraction with `json.success ? json.data : <fallback>`:

- `admin/app/dashboard/teachers/page.tsx` line 30: `setTeachers(json.success && Array.isArray(json.data) ? json.data : []);`
- `admin/app/dashboard/teachers/[id]/page.tsx` line 29: `setTeacher(json.success ? json.data : null);`
- `admin/app/dashboard/payments/page.tsx` line 30: `setPayments(json.success ? json.data : []);`
- `admin/app/dashboard/ai-usage/page.tsx` line 25: `setUsage(json.success ? json.data : []);`
- `admin/app/dashboard/health/page.tsx` line 18: `setHealth(json.success ? json.data : null);`
- `admin/app/dashboard/tickets/page.tsx` line 32: `setTickets(json.success ? json.data : []);`
- `admin/app/dashboard/tickets/[id]/page.tsx` line 31: `setTicket(json.success ? json.data : null);`

**Verify**: `grep -rn "json.success" admin/app/dashboard/` → matches in all updated pages

### Step 9: Verify build passes

```bash
cd admin && npm run build
```

Expected: build succeeds with no errors.

## Test plan

- Navigate to each dashboard page and verify data loads correctly
- Check browser Network tab: all API responses should have `{ success: true, data: ... }` shape
- Test error case: log out, try to access `/api/admin/me` → should get `{ success: false, ... }` with 401

## Done criteria

- [ ] `npm run lint` exits 0 in `admin/`
- [ ] `npm run build` exits 0 in `admin/`
- [ ] Every `admin/app/api/admin/*/route.ts` returns `{ success: true, data: ... }` on success
- [ ] Every error response returns `{ success: false, message: '...', code: '...' }`
- [ ] Every dashboard page reads `json.success` and `json.data`
- [ ] `plans/README.md` status row updated

## STOP conditions

- The code at the locations in "Current state" doesn't match the excerpts
- A step's verification fails twice after a reasonable fix attempt
- The fix appears to require touching an out-of-scope file

## Maintenance notes

- Any new API routes must use the standard envelope format
- The frontend pattern `json.success ? json.data : <fallback>` should be the standard for all fetch calls
- Consider extracting a `fetchApi()` helper that handles the envelope unwrapping and error states (future plan)
