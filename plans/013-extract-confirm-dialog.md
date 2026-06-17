# Plan 013: Extract ConfirmDialog component (TECH-01)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2e8fb57..HEAD -- frontend/src/app/[locale]/dashboard/students/page.tsx frontend/src/app/[locale]/dashboard/attendance/page.tsx frontend/src/app/[locale]/dashboard/grades/page.tsx frontend/src/app/[locale]/dashboard/courses/page.tsx frontend/src/app/[locale]/dashboard/whatsapp/page.tsx frontend/src/components/ui/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `2e8fb57`, 2026-06-16
- **Issue**:

## Why this matters

Five dashboard pages duplicate an identical AlertDialog state + JSX pattern: a 7-line `useState` block and a 15-line `AlertDialog` JSX block. This duplication means any UX change (adding keyboard shortcuts, changing button labels, adding animations) must be replicated in 5 places. Extracting a shared `ConfirmDialog` component eliminates this duplication and creates a single source of truth.

## Current state

- `src/app/[locale]/dashboard/students/page.tsx:97-103` — state definition, lines 924-943 — JSX.
- `src/app/[locale]/dashboard/attendance/page.tsx:81-87` — state definition, lines 682-696 — JSX.
- `src/app/[locale]/dashboard/grades/page.tsx:196-202` — state definition, lines 789-803 — JSX.
- `src/app/[locale]/dashboard/courses/page.tsx:56-61` — state definition, lines 310-322 — JSX.
- `src/app/[locale]/dashboard/whatsapp/page.tsx:43-49` — state definition, lines 502-519 — JSX.
- `src/components/ui/` — existing shared components: `button.tsx`, `card.tsx`, `badge.tsx`, `dialog.tsx`, `LoadingSpinner.tsx`, `StatCards.tsx`.

All 5 pages define this identical state shape:

```tsx
const [alertDialog, setAlertDialog] = useState<{
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  variant?: 'default' | 'destructive';
}>({ open: false, title: '', description: '', onConfirm: () => {} });
```

And render this identical JSX (from students/page.tsx:924-943):

```tsx
<AlertDialog open={alertDialog.open} onOpenChange={(open) => setAlertDialog(prev => ({ ...prev, open }))}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>{alertDialog.title}</AlertDialogTitle>
      <AlertDialogDescription>{alertDialog.description}</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
      <AlertDialogAction
        className={alertDialog.variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
        onClick={() => {
          alertDialog.onConfirm();
          setAlertDialog(prev => ({ ...prev, open: false }));
        }}
      >
        {t('common.confirm')}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

Note: whatsapp/page.tsx has a slight variation — `onConfirm` is optional and the description is conditionally rendered. The extracted component must handle this.

## Commands you will need

| Purpose   | Command                           | Expected on success |
|-----------|-----------------------------------|---------------------|
| Lint      | `npm run lint` in `frontend/`     | exit 0              |
| Tests     | `npm test` in `frontend/`         | all pass            |

## Scope

**In scope** (the only files you should modify):
- `src/components/ui/ConfirmDialog.tsx` (new)
- `src/app/[locale]/dashboard/students/page.tsx`
- `src/app/[locale]/dashboard/attendance/page.tsx`
- `src/app/[locale]/dashboard/grades/page.tsx`
- `src/app/[locale]/dashboard/courses/page.tsx`
- `src/app/[locale]/dashboard/whatsapp/page.tsx`

**Out of scope** (do NOT touch):
- Any file not listed above.
- Changes to the AlertDialog primitives (`src/components/ui/alert-dialog.tsx`).

## Git workflow

- Branch: `advisor/013-extract-confirm-dialog`
- Commit style: `refactor(ui): extract shared ConfirmDialog component`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create ConfirmDialog component

Create `src/components/ui/ConfirmDialog.tsx`:

```tsx
'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onConfirm: () => void;
  variant?: 'default' | 'destructive';
  cancelLabel?: string;
  confirmLabel?: string;
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  variant = 'default',
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            className={variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

Key design decisions:
- `description` is optional (whatsapp page sometimes omits it).
- `cancelLabel` and `confirmLabel` default to 'Cancel'/'Confirm' but allow override for i18n.
- `onOpenChange(false)` is called after `onConfirm()` to close the dialog.

**Verify**: `npm run lint` in `frontend/` → exit 0

### Step 2: Replace in students/page.tsx

Open `src/app/[locale]/dashboard/students/page.tsx`:

1. Add import: `import ConfirmDialog from '@/components/ui/ConfirmDialog';`
2. Remove the AlertDialog-related imports (`AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`) if they are no longer used elsewhere in the file.
3. Replace the state definition (lines 97-103) with:
   ```tsx
   const [confirmDialog, setConfirmDialog] = useState<{
     open: boolean;
     title: string;
     description: string;
     onConfirm: () => void;
     variant?: 'default' | 'destructive';
   }>({ open: false, title: '', description: '', onConfirm: () => {} });
   ```
4. Replace the `<AlertDialog ...>...</AlertDialog>` JSX block (lines 924-943) with:
   ```tsx
   <ConfirmDialog
     open={confirmDialog.open}
     onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
     title={confirmDialog.title}
     description={confirmDialog.description}
     onConfirm={() => {
       confirmDialog.onConfirm();
       setConfirmDialog(prev => ({ ...prev, open: false }));
     }}
     variant={confirmDialog.variant}
     cancelLabel={t('common.cancel')}
     confirmLabel={t('common.confirm')}
   />
   ```
5. Update all `setAlertDialog(...)` calls to `setConfirmDialog(...)`.

**Verify**: `npm run lint` in `frontend/` → exit 0

### Step 3: Replace in attendance/page.tsx

Same pattern as Step 2. Open `src/app/[locale]/dashboard/attendance/page.tsx`:

1. Import `ConfirmDialog`.
2. Remove unused AlertDialog imports.
3. Replace state (lines 81-87) and JSX (lines 682-696).
4. Update all `setAlertDialog` → `setConfirmDialog`.

**Verify**: `npm run lint` in `frontend/` → exit 0

### Step 4: Replace in grades/page.tsx

Same pattern. Open `src/app/[locale]/dashboard/grades/page.tsx`:

1. Import `ConfirmDialog`.
2. Remove unused AlertDialog imports.
3. Replace state (lines 196-202) and JSX (lines 789-803).
4. Update all `setAlertDialog` → `setConfirmDialog`.

**Verify**: `npm run lint` in `frontend/` → exit 0

### Step 5: Replace in courses/page.tsx

Same pattern. Open `src/app/[locale]/dashboard/courses/page.tsx`:

1. Import `ConfirmDialog`.
2. Remove unused AlertDialog imports.
3. Replace state (lines 56-61) and JSX (lines 310-322).
4. Update all `setAlertDialog` → `setConfirmDialog`.

Note: courses/page.tsx does not have a `variant` field in its state — it uses the default. The `ConfirmDialog` handles this with the default prop.

**Verify**: `npm run lint` in `frontend/` → exit 0

### Step 6: Replace in whatsapp/page.tsx

Same pattern. Open `src/app/[locale]/dashboard/whatsapp/page.tsx`:

1. Import `ConfirmDialog`.
2. Remove unused AlertDialog imports.
3. Replace state (lines 43-49) and JSX (lines 502-519).
4. Update all `setAlertDialog` → `setConfirmDialog`.

Note: whatsapp page has `onConfirm` as optional (`onConfirm?: () => void`). The `ConfirmDialog` `onConfirm` is required. If `onConfirm` is undefined, pass a no-op: `onConfirm: () => {}`.

**Verify**: `npm run lint` in `frontend/` → exit 0

### Step 7: Full verification

Run `npm test` in `frontend/` to confirm no regressions.

**Verify**: `npm test` in `frontend/` → all pass

## Test plan

- No new automated tests — this is a refactoring of existing behavior, not new functionality.
- Manual verification: on each of the 5 pages, trigger a confirm dialog (e.g., delete action). Expected: dialog opens, cancel closes it, confirm executes the action and closes it.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint` exits 0
- [ ] `npm test` exits 0
- [ ] `grep -rn "setAlertDialog" frontend/src/app/[locale]/dashboard/` returns no matches (all replaced with `setConfirmDialog`)
- [ ] `grep -rn "import ConfirmDialog" frontend/src/app/[locale]/dashboard/` returns 5 matches
- [ ] `src/components/ui/ConfirmDialog.tsx` exists
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- Any page has AlertDialog usage outside the confirm dialog pattern (check before removing imports).
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

- Future pages that need a confirm dialog should use `ConfirmDialog` instead of inlining AlertDialog.
- If i18n support needs to be deeper (e.g., translation keys for title/description), the `ConfirmDialog` can be extended to accept `titleKey`/`descriptionKey` props.
