# Plan 019: Audit and fix feature flag defaults

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2e8fb57..HEAD -- frontend/src/config/featureFlags.ts frontend/src/app/[locale]/dashboard/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `2e8fb57`, 2026-06-16
- **Issue**: none

## Why this matters

`src/config/featureFlags.ts:18-28` defaults 9/10 features to `true`. Only `messaging` is gated to `false`. The flag infrastructure adds complexity but gates almost nothing — incomplete features are visible to users. The `monitor` page is fully implemented (308 lines, real API calls). The `reports` page is fully implemented (349 lines, real API calls). The `alerts` page is implemented with components. However, `gradeAnalysis` has no page directory at all and should be gated. The `assistants` page exists but its implementation status needs verification.

## Current state

- `frontend/src/config/featureFlags.ts:17-28` — all flags default to `true` except `messaging`:
  ```typescript
  export const featureFlags = {
    grades: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_GRADES, true),
    reports: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_REPORTS, true),
    messaging: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_MESSAGING),
    courses: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_COURSES, true),
    monitor: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_MONITOR, true),
    assistants: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_ASSISTANTS, true),
    aiFeatures: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_AI, true),
    alerts: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_ALERTS, true),
    notifications: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS, true),
    gradeAnalysis: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_GRADE_ANALYSIS, true),
  } as const;
  ```
- `frontend/src/app/[locale]/dashboard/monitor/page.tsx` — fully implemented (308 lines), real API health checks
- `frontend/src/app/[locale]/dashboard/reports/page.tsx` — fully implemented (349 lines), real stats
- `frontend/src/app/[locale]/dashboard/alerts/page.tsx` — implemented (32 lines), uses `AlertConfig` and `AlertDisplay` components
- No `frontend/src/app/[locale]/dashboard/gradeAnalysis/` directory exists
- `frontend/src/config/navigation.ts:163-171` — route-feature mapping shows `gradeAnalysis` is NOT in the map (no route)

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Verify lint | `npm run lint` (in frontend/) | exit 0 |
| Check for gradeAnalysis page | `ls frontend/src/app/[locale]/dashboard/gradeAnalysis/` | error (directory does not exist) |

## Scope

**In scope** (the only files you should modify):
- `frontend/src/config/featureFlags.ts` — adjust defaults, add comments

**Out of scope** (do NOT touch, even though they look related):
- `frontend/src/config/navigation.ts` — route mapping, don't change
- `frontend/src/app/[locale]/dashboard/` — page implementations, don't change
- Environment variable files

## Git workflow

- Branch: `advisor/019-feature-flags`
- Commit: `fix(frontend): gate incomplete features behind feature flags`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Verify which features are incomplete

Check that `gradeAnalysis` has no page directory:

**Verify**: `ls frontend/src/app/[locale]/dashboard/gradeAnalysis/` → error (no such directory)

Check that `assistants` has a page:

**Verify**: `ls frontend/src/app/[locale]/dashboard/assistants/` → shows page file(s)

### Step 2: Update featureFlags.ts

Edit `frontend/src/config/featureFlags.ts` to:
1. Set `gradeAnalysis` default to `false` (no page exists)
2. Set `notifications` default to `false` (not verified as implemented)
3. Add comments next to each flag explaining what it gates

Target code:
```typescript
export const featureFlags = {
  /** Gates the grades CRUD page. Fully implemented. */
  grades: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_GRADES, true),
  /** Gates the reports dashboard. Fully implemented. */
  reports: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_REPORTS, true),
  /** Gates the messaging/WhatsApp broadcast page. Not yet implemented. */
  messaging: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_MESSAGING),
  /** Gates the courses/offering management page. Fully implemented. */
  courses: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_COURSES, true),
  /** Gates the system monitor page. Fully implemented. */
  monitor: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_MONITOR, true),
  /** Gates the assistants/teachers management page. Implemented. */
  assistants: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_ASSISTANTS, true),
  /** Gates AI-powered features (Gemini bot, smart responses). */
  aiFeatures: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_AI, true),
  /** Gates the alerts configuration page. Implemented. */
  alerts: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_ALERTS, true),
  /** Gates the notifications page. Not yet implemented. */
  notifications: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS, false),
  /** Gates the grade analysis page. No page exists yet. */
  gradeAnalysis: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_GRADE_ANALYSIS, false),
} as const;
```

**Verify**: `grep -n "gradeAnalysis" frontend/src/config/featureFlags.ts` → shows `false` default

### Step 3: Run lint

Run `npm run lint` in `frontend/`.

**Verify**: `npm run lint` → exit 0

## Test plan

No automated tests needed. This is a configuration change.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint` exits 0 in `frontend/`
- [ ] `grep -n "false" frontend/src/config/featureFlags.ts` shows `messaging`, `notifications`, and `gradeAnalysis` defaulting to `false`
- [ ] Each flag in `featureFlags.ts` has a comment explaining what it gates
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts (the codebase has drifted since this plan was written).
- `npm run lint` fails after the change.
- You discover a feature that is marked `false` but is actually fully implemented and in production use.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- When a new feature page is fully implemented, flip its flag to `true` and remove the `ComingSoon` gate in `dashboard/layout.tsx`.
- When adding a new feature, add it to both `featureFlags.ts` and `navigation.ts` (routeFeatureMap).
- The `routeFeatureMap` in `navigation.ts:163-171` must stay in sync with `featureFlags.ts`.
