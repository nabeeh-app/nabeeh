# Plan 004: Fix 19 apiClient import paths (CORRECTNESS-03/PERF-03)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2e8fb57..HEAD -- frontend/src/hooks/useJobPolling.ts frontend/src/components/settings/NotificationPreferences.tsx frontend/src/components/alerts/AlertDisplay.tsx frontend/src/components/alerts/AlertConfig.tsx frontend/src/components/reports/ReportSendDialog.tsx frontend/src/components/reports/ReportGenerator.tsx frontend/src/components/reports/ApprovalQueue.tsx frontend/src/components/reports/CommentEditor.tsx frontend/src/components/reports/CommentApproval.tsx frontend/src/components/dashboard/WeeklyDigest.tsx frontend/src/components/grades/GradeAnalysis.tsx frontend/src/components/attendance/AnomalyIndicator.tsx frontend/src/components/notifications/NotificationPanel.tsx frontend/src/components/notifications/NotificationBell.tsx frontend/src/components/students/StudentImportModal.tsx frontend/src/components/students/SelfRegistrationLink.tsx frontend/src/components/settings/RequiredFieldsConfig.tsx frontend/src/app/[locale]/register/student/page.tsx frontend/src/app/[locale]/invite/[token]/page.tsx`
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
- **Issue**: N/A

## Why this matters

19 files import `apiClient` from `@/lib/api` instead of `@/lib/client`. The `@/lib/api` module always exports a real `ApiClient` instance — it never checks `NEXT_PUBLIC_USE_MOCK`. When mock mode is enabled at build time, these 19 files bypass the mock client entirely and hit the real API. This defeats the purpose of mock mode for development/testing and can cause confusing behavior where some components use mock data and others hit the real backend.

## Current state

- `src/lib/client.ts:25` — `export { apiClient }` — the mock-aware instance. This file checks `NEXT_PUBLIC_USE_MOCK` and conditionally loads `MockApiClient` or `ApiClient`.
- `src/lib/api.ts:801` — `export const apiClient = new ApiClient()` — always real. No mock check.

The 19 files and their exact import lines:

1. `src/hooks/useJobPolling.ts:4` — `import { apiClient } from '@/lib/api';`
2. `src/components/settings/NotificationPreferences.tsx:16` — `import { apiClient } from '@/lib/api';`
3. `src/components/alerts/AlertDisplay.tsx:20` — `import { apiClient } from '@/lib/api';`
4. `src/components/alerts/AlertConfig.tsx:37` — `import { apiClient } from '@/lib/api';`
5. `src/components/reports/ReportSendDialog.tsx:15` — `import { apiClient } from '@/lib/api';`
6. `src/components/reports/ReportGenerator.tsx:16` — `import { apiClient } from '@/lib/api';`
7. `src/components/reports/ApprovalQueue.tsx:9` — `import { apiClient } from '@/lib/api';`
8. `src/components/reports/CommentEditor.tsx:8` — `import { apiClient } from '@/lib/api';`
9. `src/components/reports/CommentApproval.tsx:8` — `import { apiClient } from '@/lib/api';`
10. `src/components/dashboard/WeeklyDigest.tsx:15` — `import { apiClient } from '@/lib/api';`
11. `src/components/grades/GradeAnalysis.tsx:14` — `import { apiClient } from '@/lib/api';`
12. `src/components/attendance/AnomalyIndicator.tsx:8` — `import { apiClient } from '@/lib/api';`
13. `src/components/notifications/NotificationPanel.tsx:19` — `import { apiClient } from '@/lib/api';`
14. `src/components/notifications/NotificationBell.tsx:9` — `import { apiClient } from '@/lib/api';`
15. `src/components/students/StudentImportModal.tsx:11` — `import apiClient from '@/lib/api';` (default import)
16. `src/components/students/SelfRegistrationLink.tsx:6` — `import apiClient from '@/lib/api';` (default import)
17. `src/components/settings/RequiredFieldsConfig.tsx:6` — `import apiClient from '@/lib/api';` (default import)
18. `src/app/[locale]/register/student/page.tsx:7` — `import apiClient from '@/lib/api';` (default import)
19. `src/app/[locale]/invite/[token]/page.tsx:10` — `import { apiClient } from '@/lib/api';`

Convention: All consumer code should import from `@/lib/client` to get the mock-aware instance. The `@/lib/api` module is an internal implementation detail of `@/lib/client`.

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`               | exit 0, no errors   |
| Lint      | `npm run lint`                   | exit 0              |
| Grep      | `grep -rn "from '@/lib/api'" frontend/src/hooks/ frontend/src/components/ frontend/src/app/` | no matches |

## Scope

**In scope** (the only files you should modify):
- The 19 listed files (import path changes only)

**Out of scope** (do NOT touch, even though they look related):
- `src/lib/api.ts` — still exports `apiClient` for `@/lib/client` to use internally.
- `src/lib/client.ts` — not changing the mock logic.

## Git workflow

- Branch: `advisor/004-fix-apiclient-imports`
- Commit message: `fix: redirect 19 apiClient imports from @/lib/api to @/lib/client`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fix named imports (15 files)

For each of these 15 files, change `import { apiClient } from '@/lib/api'` to `import { apiClient } from '@/lib/client'`:

1. `src/hooks/useJobPolling.ts:4`
2. `src/components/settings/NotificationPreferences.tsx:16`
3. `src/components/alerts/AlertDisplay.tsx:20`
4. `src/components/alerts/AlertConfig.tsx:37`
5. `src/components/reports/ReportSendDialog.tsx:15`
6. `src/components/reports/ReportGenerator.tsx:16`
7. `src/components/reports/ApprovalQueue.tsx:9`
8. `src/components/reports/CommentEditor.tsx:8`
9. `src/components/reports/CommentApproval.tsx:8`
10. `src/components/dashboard/WeeklyDigest.tsx:15`
11. `src/components/grades/GradeAnalysis.tsx:14`
12. `src/components/attendance/AnomalyIndicator.tsx:8`
13. `src/components/notifications/NotificationPanel.tsx:19`
14. `src/components/notifications/NotificationBell.tsx:9`
15. `src/app/[locale]/invite/[token]/page.tsx:10`

**Verify**: `grep -rn "from '@/lib/api'" frontend/src/hooks/ frontend/src/components/ frontend/src/app/` → returns only the 4 default-import files (items 16–19 below)

### Step 2: Fix default imports (4 files)

For each of these 4 files, change `import apiClient from '@/lib/api'` to `import apiClient from '@/lib/client'`:

16. `src/components/students/StudentImportModal.tsx:11`
17. `src/components/students/SelfRegistrationLink.tsx:6`
18. `src/components/settings/RequiredFieldsConfig.tsx:6`
19. `src/app/[locale]/register/student/page.tsx:7`

**Verify**: `grep -rn "from '@/lib/api'" frontend/src/hooks/ frontend/src/components/ frontend/src/app/` → no matches

### Step 3: Verify no remaining wrong imports

**Verify**: `grep -rn "from '@/lib/api'" frontend/src/` → returns only `src/lib/client.ts` (which legitimately imports from `./api`)

### Step 4: Verify lint and typecheck

**Verify**: `npm run lint` in `frontend/` → exit 0
**Verify**: `npx tsc --noEmit` in `frontend/` → exit 0, no errors

## Test plan

No automated tests for import paths. Manual verification:

- With `NEXT_PUBLIC_USE_MOCK=true` at build time, all 19 components should use the mock client.
- Grep confirms no consumer code imports directly from `@/lib/api`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint` in `frontend/` exits 0
- [ ] `npx tsc --noEmit` in `frontend/` exits 0
- [ ] `grep -rn "from '@/lib/api'" frontend/src/hooks/ frontend/src/components/ frontend/src/app/` returns no matches
- [ ] No files outside the 19 listed files are modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- Any of the 19 files has an import line that doesn't match the excerpt (the codebase has drifted since this plan was written).
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.
- A type error appears after the change (indicates a missing re-export or circular dependency).

## Maintenance notes

For the human/agent who owns this code after the change lands:

- If new files are created that need `apiClient`, they should import from `@/lib/client`, not `@/lib/api`. Consider adding a lint rule to enforce this.
- The `@/lib/api` module should only be imported by `@/lib/client.ts`. All other consumers should go through `@/lib/client`.
- A reviewer should verify that no new `@/lib/api` imports have been introduced.
