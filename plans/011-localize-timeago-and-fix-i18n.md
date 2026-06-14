# Plan 011: Localize timeAgo() and fix missing i18n keys

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6f7019f..HEAD -- frontend/src/components/alerts/AlertDisplay.tsx frontend/src/components/attendance/AttendanceLockIndicator.tsx frontend/src/messages/en.json frontend/src/messages/ar.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `6f7019f`, 2026-06-14

## Why this matters

`timeAgo()` hardcodes English strings ("just now", "m ago", "h ago", "d ago") visible in Arabic mode. Additionally, `common.loadMore` and `assistants.switchTeacher` i18n keys are missing, rendering as raw key strings.

## Current state

- `frontend/src/components/alerts/AlertDisplay.tsx:32-43` — `timeAgo()` with hardcoded English
- `frontend/src/components/attendance/AttendanceLockIndicator.tsx:15-24` — identical `timeAgo()`
- `frontend/src/components/attendance/AttendanceLockIndicator.tsx:34` — hardcoded English tooltip
- `frontend/src/messages/en.json` — missing `common.loadMore`
- `frontend/src/messages/ar.json` — missing `common.loadMore`
- `frontend/src/messages/en.json` — missing `assistants.switchTeacher`
- `frontend/src/messages/ar.json` — missing `assistants.switchTeacher`

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `cd frontend && npx tsc --noEmit` | exit 0 |

## Scope

**In scope**:
- `frontend/src/lib/utils.ts`
- `frontend/src/components/alerts/AlertDisplay.tsx`
- `frontend/src/components/attendance/AttendanceLockIndicator.tsx`
- `frontend/src/messages/en.json`
- `frontend/src/messages/ar.json`

## Steps

### Step 1: Add localized `timeAgo()` to lib/utils.ts

Add to `frontend/src/lib/utils.ts`:

```ts
export function timeAgo(dateStr: string, locale: string = 'en'): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (locale === 'ar') {
    if (mins < 1) return 'الآن';
    if (mins < 60) return `منذ ${mins} د`;
    if (hours < 24) return `منذ ${hours} س`;
    return `منذ ${days} ي`;
  }
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
```

**Verify**: `cd frontend && npx tsc --noEmit 2>&1 | grep utils` → no errors

### Step 2: Replace inline timeAgo in AlertDisplay.tsx

Remove the local `timeAgo` function and import from utils:

```tsx
import { timeAgo } from '@/lib/utils';
```

Pass locale: `timeAgo(alert.created_at, locale)`.

**Verify**: `cd frontend && npx tsc --noEmit 2>&1 | grep AlertDisplay` → no errors

### Step 3: Replace inline timeAgo in AttendanceLockIndicator.tsx

Same approach. Also fix the hardcoded tooltip at line 34 to use `useTranslations()`.

**Verify**: `cd frontend && npx tsc --noEmit 2>&1 | grep AttendanceLock` → no errors

### Step 4: Add missing i18n keys

In `en.json`, add to `common`:
```json
"loadMore": "Load More"
```

In `ar.json`, add to `common`:
```json
"loadMore": "تحميل المزيد"
```

In `en.json`, add to `assistants`:
```json
"switchTeacher": "Switch Teacher"
```

In `ar.json`, add to `assistants`:
```json
"switchTeacher": "تبديل المعلم"
```

**Verify**: `cd frontend && npx tsc --noEmit` → exit 0

## Test plan

- Switch to Arabic locale → time labels should show Arabic ("منذ 5 د")
- AlertDisplay "Load More" button should show translated text
- TeacherSwitcher dropdown should show translated label

## Done criteria

- [ ] `cd frontend && npx tsc --noEmit` exits 0
- [ ] No hardcoded English time strings in scope files
- [ ] No raw i18n key strings visible in UI
- [ ] `plans/README.md` status row updated

## STOP conditions

- `useLocale` is not available in AttendanceLockIndicator (check if it's a client component)
