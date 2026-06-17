# Plan 014: Replace hardcoded colors with theme tokens (TECH-02)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2e8fb57..HEAD -- frontend/src/app/globals.css frontend/src/app/[locale]/dashboard/ frontend/src/components/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `2e8fb57`, 2026-06-16
- **Issue**:

## Why this matters

35+ hardcoded color values (`text-[#c53030]`, `bg-[#c53030]/10`, `text-red-500`, `text-green-500`, `text-yellow-500`, etc.) bypass the existing CSS theme variables defined in `globals.css`. This means dark mode, theme switching, and brand customization are broken for these elements. The theme system already defines `--color-error`, `--color-success`, `--color-warning`, and `--color-destructive` — the code just doesn't use them consistently.

## Current state

**Theme variables already defined in `src/app/globals.css:256-259`:**
```css
--color-success: #16a34a;
--color-warning: #ca8a04;
--color-error: #dc2626;
```

And `--color-destructive` at line 242:
```css
--color-destructive: var(--destructive);
```

**Files with hardcoded colors (from grep):**

| Pattern | Files |
|---------|-------|
| `text-[#c53030]` | register/page.tsx, SendMessageModal.tsx, attendance/page.tsx, courses/page.tsx, messages/page.tsx, whatsapp/page.tsx, StatCards.tsx, grades/page.tsx, error-boundary.tsx, students/page.tsx |
| `bg-[#c53030]/10` | register/page.tsx, attendance/page.tsx, courses/page.tsx, messages/page.tsx, whatsapp/page.tsx, StatCards.tsx, grades/page.tsx, error-boundary.tsx, students/page.tsx |
| `text-[#026370]` | attendance/page.tsx, StatCards.tsx, grades/page.tsx, whatsapp/page.tsx |
| `text-red-500` | register/student/page.tsx, invite/[token]/page.tsx, ImportPreviewTable.tsx, SelfRegistrationLink.tsx |
| `text-green-500` | register/student/page.tsx, invite/[token]/page.tsx, ImportPreviewTable.tsx, SelfRegistrationLink.tsx |
| `text-yellow-500` | AnomalyIndicator.tsx, ImportPreviewTable.tsx, WeeklyDigest.tsx |
| `text-green-600` | NotificationPreferences.tsx, WeeklyDigest.tsx, ReportSendDialog.tsx, ImportPreviewTable.tsx, InviteForm.tsx |
| `text-red-600` | StudentImportModal.tsx, ImportPreviewTable.tsx |

**Mapping to theme tokens:**
- `#c53030` → `destructive` (matches `--destructive: #c53030`)
- `text-[#026370]` → `primary` (matches `--primary: #026370`)
- `text-red-500`/`text-red-600` → `error` (maps to `--color-error: #dc2626`)
- `text-green-500`/`text-green-600` → `success` (maps to `--color-success: #16a34a`)
- `text-yellow-500`/`text-yellow-600` → `warning` (maps to `--color-warning: #ca8a04`)
- `bg-green-50`/`bg-red-50`/`bg-yellow-50` → `bg-success/10`, `bg-error/10`, `bg-warning/10`

## Commands you will need

| Purpose   | Command                           | Expected on success |
|-----------|-----------------------------------|---------------------|
| Lint      | `npm run lint` in `frontend/`     | exit 0              |
| Grep      | `grep -rn "\[#[0-9a-fA-F]" frontend/src/` | no matches  |
| Build     | `npm run build` in `frontend/`    | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `src/app/globals.css` — add semantic color aliases if needed
- `src/app/[locale]/dashboard/students/page.tsx`
- `src/app/[locale]/dashboard/attendance/page.tsx`
- `src/app/[locale]/dashboard/grades/page.tsx`
- `src/app/[locale]/dashboard/courses/page.tsx`
- `src/app/[locale]/dashboard/whatsapp/page.tsx`
- `src/app/[locale]/dashboard/messages/page.tsx`
- `src/app/[locale]/register/page.tsx`
- `src/components/ui/StatCards.tsx`
- `src/components/error-boundary.tsx`
- `src/components/SendMessageModal.tsx`
- `src/components/students/ImportPreviewTable.tsx`
- `src/lib/severityConfig.ts`
- `src/components/attendance/AnomalyIndicator.tsx`
- `src/components/dashboard/WeeklyDigest.tsx`
- `src/components/settings/NotificationPreferences.tsx`
- `src/components/reports/ReportSendDialog.tsx`
- `src/components/students/SelfRegistrationLink.tsx`
- `src/components/students/StudentImportModal.tsx`
- `src/components/assistants/InviteForm.tsx`
- `src/app/[locale]/register/student/page.tsx`
- `src/app/[locale]/invite/[token]/page.tsx`

**Out of scope** (do NOT touch):
- `src/components/ui/badge.tsx` — the `bg-[#026370]` there is a deliberate brand color choice; changing it risks breaking the badge design.
- Dark mode `.dark` overrides in `globals.css` — separate concern.

## Git workflow

- Branch: `advisor/014-replace-hardcoded-colors`
- Commit style: `refactor(ui): replace hardcoded colors with theme tokens`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Verify theme tokens exist in globals.css

Open `src/app/globals.css`. Confirm the `@theme inline` block (around line 213) contains:

```css
--color-success: #16a34a;
--color-warning: #ca8a04;
--color-error: #dc2626;
```

These already exist at lines 257-259. No CSS changes needed.

**Verify**: `grep -n "color-error" frontend/src/app/globals.css` → returns a match

### Step 2: Replace `text-[#c53030]` with `text-destructive`

In every in-scope file, replace `text-[#c53030]` with `text-destructive`. This is a direct mapping since `--destructive: #c53030`.

Files to change: register/page.tsx, SendMessageModal.tsx, attendance/page.tsx, courses/page.tsx, messages/page.tsx, whatsapp/page.tsx, StatCards.tsx, grades/page.tsx, error-boundary.tsx, students/page.tsx.

Use the Edit tool with `replaceAll: true` on each file.

**Verify**: `grep -rn "text-\[#c53030\]" frontend/src/` → no matches

### Step 3: Replace `bg-[#c53030]/10` with `bg-destructive/10`

Same files as Step 2. Replace `bg-[#c53030]/10` with `bg-destructive/10`. Also replace `bg-[#c53030]/5` with `bg-destructive/5`, `bg-[#c53030]/20` with `bg-destructive/20`, etc.

**Verify**: `grep -rn "bg-\[#c53030\]" frontend/src/` → no matches

### Step 4: Replace `text-[#026370]` with `text-primary`

In attendance/page.tsx, StatCards.tsx, grades/page.tsx, whatsapp/page.tsx. Replace `text-[#026370]` with `text-primary`.

Also replace `bg-[#026370]` with `bg-primary` where it appears (attendance/page.tsx:450).

**Verify**: `grep -rn "text-\[#026370\]" frontend/src/` → no matches

### Step 5: Replace Tailwind color classes with theme tokens

Replace across all in-scope files:
- `text-red-500` → `text-error`
- `text-red-600` → `text-error`
- `text-green-500` → `text-success`
- `text-green-600` → `text-success`
- `text-yellow-500` → `text-warning`
- `text-yellow-600` → `text-warning`
- `bg-red-50` → `bg-error/10`
- `bg-green-50` → `bg-success/10`
- `bg-yellow-50` → `bg-warning/10`

**Verify**: `grep -rn "text-red-\|text-green-\|text-yellow-\|bg-red-50\|bg-green-50\|bg-yellow-50" frontend/src/` → no matches

### Step 6: Update severityConfig.ts

Open `src/lib/severityConfig.ts`. Replace:
- `'text-blue-500'` → `'text-primary'`
- `'bg-blue-500/10'` → `'bg-primary/10'`
- `'text-yellow-500'` → `'text-warning'`
- `'bg-yellow-500/10'` → `'bg-warning/10'`

**Verify**: `grep -n "text-blue-500\|text-yellow-500" frontend/src/lib/severityConfig.ts` → no matches

### Step 7: Full verification

Run `grep -rn "\[#[0-9a-fA-F]" frontend/src/` to confirm no hardcoded hex colors remain (except the allowed badge.tsx and globals.css).

Run `npm run lint` and `npm run build`.

**Verify**: `npm run lint` → exit 0; `npm run build` → exit 0

## Test plan

- No new automated tests — this is a visual token replacement, not behavioral change.
- Manual verification: check dark mode (if enabled) to confirm tokens adapt correctly.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint` exits 0
- [ ] `npm run build` exits 0
- [ ] `grep -rn "\[#[0-9a-fA-F]" frontend/src/` returns no matches (except badge.tsx)
- [ ] `grep -rn "text-red-\|text-green-\|text-yellow-" frontend/src/` returns no matches
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- The `@theme inline` block in globals.css does not contain `--color-error`, `--color-success`, `--color-warning` (they need to be added first).
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file (like badge.tsx).

## Maintenance notes

- Future components should use `text-error`, `text-success`, `text-warning`, `text-destructive`, `text-primary` instead of hardcoded values.
- If the design system introduces new semantic colors, add them to the `@theme inline` block first.
