# Plan 030: Extract shared LoadingSpinner and StatusBadge components

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2e8fb57..HEAD -- admin/app/dashboard/ admin/components/`
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

Every dashboard page (8 total) has an identical loading spinner block — 6-7 lines of JSX duplicated in each file. Status badge styling (the conditional className logic for tier/status/priority) is also copy-pasted across pages. This makes visual changes require touching 8+ files and increases the risk of inconsistency.

## Current state

Loading spinner appears in these files with identical markup:
- `admin/app/dashboard/page.tsx:43-52`
- `admin/app/dashboard/teachers/page.tsx:108-114`
- `admin/app/dashboard/teachers/[id]/page.tsx:38-46`
- `admin/app/dashboard/payments/page.tsx:69-75`
- `admin/app/dashboard/ai-usage/page.tsx:55-61`
- `admin/app/dashboard/health/page.tsx:29-37`
- `admin/app/dashboard/tickets/page.tsx:62-68`
- `admin/app/dashboard/tickets/[id]/page.tsx:50-58`

The spinner pattern is:
```tsx
<div className="flex items-center justify-center min-h-[400px]">
  <div className="text-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ink mx-auto motion-reduce:animate-none" />
    <p className="mt-4 text-ink/70 font-body">Loading...</p>
  </div>
</div>
```

Status badge patterns appear in:
- `admin/app/dashboard/teachers/page.tsx:135-148` (tier + status badges)
- `admin/app/dashboard/tickets/page.tsx:86-99` (status + priority badges)
- `admin/app/dashboard/teachers/[id]/page.tsx:131-135` (payment status)
- `admin/app/dashboard/tickets/[id]/page.tsx:78-88` (status + priority)
- `admin/app/dashboard/page.tsx:17-26` (stat card config — different pattern, skip)

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Lint      | `cd admin && npm run lint`           | exit 0              |
| Build     | `cd admin && npm run build`          | exit 0              |

## Scope

**In scope**:
- `admin/components/LoadingSpinner.tsx` (create)
- `admin/components/StatusBadge.tsx` (create)
- `admin/app/dashboard/page.tsx`
- `admin/app/dashboard/teachers/page.tsx`
- `admin/app/dashboard/teachers/[id]/page.tsx`
- `admin/app/dashboard/payments/page.tsx`
- `admin/app/dashboard/ai-usage/page.tsx`
- `admin/app/dashboard/health/page.tsx`
- `admin/app/dashboard/tickets/page.tsx`
- `admin/app/dashboard/tickets/[id]/page.tsx`

**Out of scope**:
- `admin/app/login/page.tsx` — has its own loading state, different context
- `admin/app/dashboard/layout.tsx` — loading is handled differently (auth check)
- Any changes to the API routes

## Steps

### Step 1: Create LoadingSpinner component

Create `admin/components/LoadingSpinner.tsx`:
```tsx
interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ink mx-auto motion-reduce:animate-none" />
        <p className="mt-4 text-ink/70 font-body">{message}</p>
      </div>
    </div>
  );
}
```

**Verify**: `cat admin/components/LoadingSpinner.tsx` → file exists with correct content

### Step 2: Create StatusBadge component

Create `admin/components/StatusBadge.tsx`:
```tsx
type BadgeVariant = 'default' | 'success' | 'warning' | 'destructive' | 'primary';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: 'bg-surface-cool text-ink/60',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  primary: 'bg-primary/10 text-primary',
};

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
}

export function StatusBadge({ label, variant = 'default' }: StatusBadgeProps) {
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-mono uppercase tracking-wider ${VARIANT_CLASSES[variant]}`}>
      {label}
    </span>
  );
}

// Helper functions for common badge patterns
export function getTierVariant(tier: string): BadgeVariant {
  switch (tier) {
    case 'pro': return 'primary';
    case 'basic': return 'default';
    case 'center': return 'warning';
    default: return 'default';
  }
}

export function getStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'active': return 'success';
    case 'trial': return 'warning';
    case 'suspended': return 'destructive';
    case 'verified': return 'success';
    case 'pending': return 'warning';
    case 'open': return 'warning';
    case 'in_progress': return 'primary';
    case 'resolved': return 'success';
    default: return 'default';
  }
}

export function getPriorityVariant(priority: string): BadgeVariant {
  switch (priority) {
    case 'urgent': return 'destructive';
    case 'high': return 'warning';
    default: return 'default';
  }
}
```

**Verify**: `cat admin/components/StatusBadge.tsx` → file exists with correct content

### Step 3: Update dashboard/page.tsx to use LoadingSpinner

Replace the loading block (lines 43-52):
```tsx
if (loading) {
  return <LoadingSpinner message="Loading metrics..." />;
}
```

Add import at top:
```tsx
import { LoadingSpinner } from '@/components/LoadingSpinner';
```

**Verify**: `grep -n "LoadingSpinner" admin/app/dashboard/page.tsx` → matches

### Step 4: Update teachers/page.tsx

Replace loading block with `<LoadingSpinner message="Loading teachers..." />`.

Replace tier badge at lines 135-140:
```tsx
<StatusBadge label={t.tier} variant={getTierVariant(t.tier)} />
```

Replace status badge at lines 142-148:
```tsx
<StatusBadge label={t.status} variant={getStatusVariant(t.status)} />
```

Add imports:
```tsx
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { StatusBadge, getTierVariant, getStatusVariant } from '@/components/StatusBadge';
```

**Verify**: `grep -n "LoadingSpinner\|StatusBadge" admin/app/dashboard/teachers/page.tsx` → matches

### Step 5: Update remaining pages

Apply the same pattern to each page:
- `teachers/[id]/page.tsx` — replace loading + payment status badges
- `payments/page.tsx` — replace loading block
- `ai-usage/page.tsx` — replace loading block
- `health/page.tsx` — replace loading block
- `tickets/page.tsx` — replace loading + status/priority badges
- `tickets/[id]/page.tsx` — replace loading + status/priority badges

For each file:
1. Add imports for `LoadingSpinner` and relevant badge helpers
2. Replace the loading spinner JSX with `<LoadingSpinner message="..." />`
3. Replace badge conditional classNames with `<StatusBadge>` component

**Verify**: `grep -rn "LoadingSpinner" admin/app/dashboard/` → matches in all pages
**Verify**: `grep -rn "StatusBadge" admin/app/dashboard/` → matches in pages with badges

### Step 6: Verify build passes

```bash
cd admin && npm run build
```

Expected: build succeeds with no errors.

## Test plan

- Visual inspection: all loading states should look identical
- All status badges should display correct colors
- No visual regressions

## Done criteria

- [ ] `npm run lint` exits 0 in `admin/`
- [ ] `npm run build` exits 0 in `admin/`
- [ ] `admin/components/LoadingSpinner.tsx` exists
- [ ] `admin/components/StatusBadge.tsx` exists
- [ ] `grep -rn "animate-spin" admin/app/dashboard/` returns no matches (all moved to component)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The code at the locations in "Current state" doesn't match the excerpts
- A step's verification fails twice after a reasonable fix attempt
- The visual appearance changes

## Maintenance notes

- Future dashboard pages should import these components instead of inlining spinner/badge markup
- Adding a new badge variant only requires editing `StatusBadge.tsx`
- The `components/` directory may need a `components/ui/` subdirectory if more shared components are added (follow main frontend convention)
