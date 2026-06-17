# Plan 018: Remove unused @radix-ui/react-icons

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2e8fb57..HEAD -- frontend/package.json frontend/src/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `2e8fb57`, 2026-06-16
- **Issue**: none

## Why this matters

`@radix-ui/react-icons` is listed as a dependency (`frontend/package.json:20`) but grep finds zero imports in `src/`. All icons use `lucide-react` instead. This unused dependency adds ~200KB to `node_modules` and increases install time. Removing it eliminates dead weight.

## Current state

- `frontend/package.json:20` — dependency: `"@radix-ui/react-icons": "^1.3.2"`
- `frontend/src/` — no imports of `@radix-ui/react-icons` exist (verified via grep)
- All icon usage in `src/` imports from `lucide-react` (e.g., `src/config/navigation.ts:1-15`)

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Remove package | `npm uninstall @radix-ui/react-icons` (in frontend/) | exit 0 |
| Verify no imports | `grep -rn "@radix-ui/react-icons" frontend/src/` | no matches |
| Verify lint | `npm run lint` (in frontend/) | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `frontend/package.json` — remove `@radix-ui/react-icons` from dependencies
- `frontend/package-lock.json` — auto-updated by npm

**Out of scope** (do NOT touch, even though they look related):
- `frontend/src/` — no changes needed, no imports exist
- Other `@radix-ui/*` packages — they are actively used

## Git workflow

- Branch: `advisor/018-remove-radix-icons`
- Commit: `chore(frontend): remove unused @radix-ui/react-icons dependency`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Verify no imports exist

Run `grep -rn "@radix-ui/react-icons" frontend/src/` to confirm zero imports.

**Verify**: `grep -rn "@radix-ui/react-icons" frontend/src/` → no output (exit code 1)

### Step 2: Uninstall the package

Run `npm uninstall @radix-ui/react-icons` in `frontend/`.

**Verify**: `npm list @radix-ui/react-icons` → shows "empty" or error (package not found)

### Step 3: Verify package.json updated

Check `frontend/package.json` no longer contains `@radix-ui/react-icons`.

**Verify**: `grep -n "@radix-ui/react-icons" frontend/package.json` → no matches

### Step 4: Run lint

Run `npm run lint` in `frontend/` to verify no breakage.

**Verify**: `npm run lint` → exit 0

## Test plan

No automated tests needed. This is a dependency removal with no code changes.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint` exits 0 in `frontend/`
- [ ] `grep -rn "@radix-ui/react-icons" frontend/src/` returns no matches
- [ ] `grep -n "@radix-ui/react-icons" frontend/package.json` returns no matches
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- `grep -rn "@radix-ui/react-icons" frontend/src/` finds imports (the package is still used — do not remove).
- `npm uninstall` fails.
- `npm run lint` fails after removal.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- If someone later needs Radix icons, they should use `lucide-react` instead to stay consistent.
- If Radix icons are needed for a specific Radix component, add the dependency back and document why.
