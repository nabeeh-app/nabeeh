# Plan 012: Align login password minimum with registration (SEC-10)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2e8fb57..HEAD -- frontend/src/app/[locale]/login/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `2e8fb57`, 2026-06-16
- **Issue**:

## Why this matters

The login form accepts passwords as short as 3 characters (`password.length < 3`), while registration requires 6 (`formData.password.length < 6`). This mismatch means a user who registered with a 6-char password could theoretically have their login form accept shorter strings, creating a confusing UX inconsistency. The login validation should match the registration minimum.

## Current state

- `src/app/[locale]/login/page.tsx:48` — `password.length < 3` validation check.
- `src/app/[locale]/register/page.tsx:77` — `formData.password.length < 6` validation check.

## Commands you will need

| Purpose   | Command                           | Expected on success |
|-----------|-----------------------------------|---------------------|
| Lint      | `npm run lint` in `frontend/`     | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `src/app/[locale]/login/page.tsx`

**Out of scope** (do NOT touch):
- `src/app/[locale]/register/page.tsx` — already correct.
- Backend validation — may enforce its own minimum.

## Git workflow

- Branch: `advisor/012-align-login-password-min`
- Commit style: `fix(auth): align login password minimum with registration`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Change password minimum from 3 to 6

Open `src/app/[locale]/login/page.tsx`. On line 48, change:

```ts
} else if (password.length < 3) {
```

to:

```ts
} else if (password.length < 6) {
```

**Verify**: `npm run lint` in `frontend/` → exit 0

### Step 2: Verify the change

Read the file back and confirm line 48 shows `password.length < 6`.

**Verify**: `grep -n "password.length < 6" frontend/src/app/[locale]/login/page.tsx` → returns a match

## Test plan

- No new automated tests needed — single-line validation change.
- Manual verification: try submitting the login form with a 4-character password. Expected: error message shown.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint` exits 0
- [ ] `grep -n "password.length < 6" frontend/src/app/[locale]/login/page.tsx` returns a match
- [ ] `grep -n "password.length < 3" frontend/src/app/[locale]/login/page.tsx` returns no matches
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- Line 48 no longer contains a `password.length` check (the codebase has drifted).
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- If the backend enforces a different minimum, align both frontend forms to match it.
