# Plan 014: Merge duplicate onboarding keys in i18n files

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6f7019f..HEAD -- frontend/src/messages/en.json frontend/src/messages/ar.json`
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

`en.json` has 3 duplicate `onboarding` top-level keys. In JSON, the last one wins, so keys from the first two blocks are silently dropped. The onboarding steps, progress, and profile keys are lost.

## Current state

- `frontend/src/messages/en.json:1101` — first `onboarding` block (welcome, steps, profile, subjects, whatsapp, done)
- `frontend/src/messages/en.json:1240` — second `onboarding` block (progress sub-keys)
- `frontend/src/messages/en.json:1258` — third `onboarding` block (skip, next, prev, done, tooltip_step)
- Same pattern in `ar.json`

## Steps

### Step 1: Read all three onboarding blocks in en.json

Read lines 1101-1143, 1240-1251, and 1258-1270 to understand all keys.

### Step 2: Merge into single block

Combine all keys into one `onboarding` block. Check for key collisions (same key in multiple blocks — keep the last definition as it's the one that was actually active).

Place the merged block at the location of the first occurrence (around line 1101).

### Step 3: Remove the duplicate blocks

Delete the second and third `onboarding` blocks.

### Step 4: Repeat for ar.json

Same merge process for the Arabic file.

**Verify**: `cd frontend && npx tsc --noEmit` → exit 0

## Test plan

- Search for `"onboarding"` in both JSON files → should appear exactly once as a top-level key
- Onboarding flow in the app should still work (no missing keys)

## Done criteria

- [ ] `"onboarding"` appears exactly once as a top-level key in en.json
- [ ] `"onboarding"` appears exactly once as a top-level key in ar.json
- [ ] No key collisions (all keys preserved)
- [ ] `cd frontend && npx tsc --noEmit` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- Key collision between blocks that can't be resolved automatically
