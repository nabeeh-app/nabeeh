# Plan 015: Extract duplicated DataSourcesBadges to shared component

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6f7019f..HEAD -- frontend/src/components/reports/CommentDraft.tsx frontend/src/components/reports/ReportPreview.tsx`
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

The data-sources badge rendering logic is duplicated in CommentDraft and ReportPreview. Any new data source badge requires editing both files.

## Current state

- `frontend/src/components/reports/CommentDraft.tsx:44-60` — data sources badge rendering
- `frontend/src/components/reports/ReportPreview.tsx:59-81` — nearly identical rendering

## Steps

### Step 1: Create DataSourcesBadges component

Create `frontend/src/components/reports/DataSourcesBadges.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';

interface DataSources {
  grades?: boolean;
  attendance?: boolean;
  trends?: boolean;
}

export function DataSourcesBadges({ sources }: { sources: DataSources }) {
  const t = useTranslations('reports.generation');
  return (
    <div className="flex flex-wrap gap-1">
      {sources.grades && <Badge variant="secondary">{t('gradesData')}</Badge>}
      {sources.attendance && <Badge variant="secondary">{t('attendanceData')}</Badge>}
      {sources.trends && <Badge variant="secondary">{t('trendsData')}</Badge>}
    </div>
  );
}
```

**Verify**: `cd frontend && npx tsc --noEmit` → no errors

### Step 2: Replace inline rendering in CommentDraft.tsx

Import and use the shared component:

```tsx
import { DataSourcesBadges } from './DataSourcesBadges';
// Replace the inline badge rendering with:
<DataSourcesBadges sources={draft.data_sources} />
```

**Verify**: `cd frontend && npx tsc --noEmit 2>&1 | grep CommentDraft` → no errors

### Step 3: Replace inline rendering in ReportPreview.tsx

Same approach.

**Verify**: `cd frontend && npx tsc --noEmit` → exit 0

## Done criteria

- [ ] Data-sources badge logic exists in exactly one component
- [ ] Both CommentDraft and ReportPreview use the shared component
- [ ] `cd frontend && npx tsc --noEmit` exits 0
- [ ] `plans/README.md` status row updated
