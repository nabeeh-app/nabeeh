# Plan 012: Extract duplicated SEVERITY_CONFIG to shared module

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6f7019f..HEAD -- frontend/src/components/alerts/AlertDisplay.tsx frontend/src/components/attendance/AnomalyIndicator.tsx frontend/src/components/grades/AtRiskStudents.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `6f7019f`, 2026-06-14

## Why this matters

`SEVERITY_CONFIG` is duplicated in 3 components with minor key differences. AlertDisplay adds `info` but the others don't — the divergence is already live. Adding a new severity level requires editing 3 files.

## Current state

- `frontend/src/components/alerts/AlertDisplay.tsx:26` — SEVERITY_CONFIG with info, warning, critical
- `frontend/src/components/attendance/AnomalyIndicator.tsx:22` — SEVERITY_CONFIG with warning, critical only
- `frontend/src/components/grades/AtRiskStudents.tsx:9` — SEVERITY_CONFIG with warning, critical only

## Steps

### Step 1: Create shared module

Create `frontend/src/lib/severityConfig.ts`:

```ts
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

export const SEVERITY_CONFIG = {
  info: {
    icon: Info,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    variant: 'secondary' as const,
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-500',
    bg: 'bg-yellow-50',
    variant: 'default' as const,
  },
  critical: {
    icon: AlertCircle,
    color: 'text-red-500',
    bg: 'bg-red-50',
    variant: 'destructive' as const,
  },
} as const;
```

**Verify**: `cd frontend && node -c lib/severityConfig.ts` or `npx tsc --noEmit` → no errors

### Step 2: Replace local definitions in all 3 components

Import from shared module:

```tsx
import { SEVERITY_CONFIG } from '@/lib/severityConfig';
```

Remove local `SEVERITY_CONFIG` definitions from AlertDisplay, AnomalyIndicator, AtRiskStudents.

**Verify**: `cd frontend && npx tsc --noEmit` → exit 0

## Done criteria

- [ ] `SEVERITY_CONFIG` defined in exactly one place
- [ ] All 3 components import from shared module
- [ ] `cd frontend && npx tsc --noEmit` exits 0
- [ ] `plans/README.md` status row updated
