# Plan 016: Add pre-commit hooks with Husky

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2e8fb57..HEAD -- frontend/package.json frontend/.husky/ frontend/.prettierrc frontend/.editorconfig`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `2e8fb57`, 2026-06-16
- **Issue**: none

## Why this matters

No pre-commit hooks exist. Contributors can freely commit unformatted code, lint violations, or `console.log` statements. This creates inconsistent code style and requires manual review for trivial issues. Adding Husky + lint-staged enforces formatting and linting on every commit, catching issues before they reach CI.

## Current state

- `frontend/package.json:5-13` — scripts section defines `lint` and `test` but no formatting or pre-commit setup:
  ```json
  "scripts": {
    "predev": "rm -rf .next",
    "dev": "next dev --turbopack",
    "build": "next build --turbopack",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest"
  }
  ```
- No `.husky/` directory exists
- No `.prettierrc` or `.editorconfig` files exist
- Project uses ESLint 9 (`frontend/package.json:53`) and Vitest (`frontend/package.json:58`)

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install husky | `npx husky init` (in frontend/) | Creates `.husky/` directory |
| Install lint-staged | `npm install --save-dev lint-staged` | exit 0 |
| Verify lint | `npm run lint` | exit 0 |
| Verify husky | `npx husky` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `frontend/package.json` — add lint-staged config and husky scripts
- `frontend/.husky/pre-commit` (create) — runs lint-staged
- `frontend/.prettierrc` (create) — basic Prettier config
- `frontend/.editorconfig` (create) — basic editor config

**Out of scope** (do NOT touch, even though they look related):
- Any changes to eslint config (`eslint.config.mjs`)
- Any changes to existing source code
- CI/CD pipeline changes

## Git workflow

- Branch: `advisor/016-precommit-hooks`
- Commit per step or per logical unit; message style: conventional commits (e.g., `chore(frontend): add husky and lint-staged pre-commit hooks`)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Initialize Husky

Run `npx husky init` in the `frontend/` directory. This creates the `.husky/` directory with a default pre-commit hook.

**Verify**: `ls frontend/.husky/` → shows `pre-commit` file

### Step 2: Configure pre-commit hook

Write the file `frontend/.husky/pre-commit` with contents:
```bash
npx lint-staged
```

**Verify**: `cat frontend/.husky/pre-commit` → shows the lint-staged command

### Step 3: Install lint-staged

Run `npm install --save-dev lint-staged` in `frontend/`.

**Verify**: `npm list lint-staged` → shows lint-staged version

### Step 4: Add lint-staged config to package.json

Add the following to `frontend/package.json` (after the `devDependencies` block):
```json
"lint-staged": {
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,css,md}": ["prettier --write"]
}
```

**Verify**: `cat frontend/package.json | grep -A 5 "lint-staged"` → shows the config

### Step 5: Create .prettierrc

Create `frontend/.prettierrc` with:
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "tabWidth": 2
}
```

**Verify**: `cat frontend/.prettierrc` → shows the config

### Step 6: Create .editorconfig

Create `frontend/.editorconfig` with:
```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

**Verify**: `cat frontend/.editorconfig` → shows the config

### Step 7: Run lint to verify no breakage

Run `npm run lint` in `frontend/`.

**Verify**: `npm run lint` → exit 0

## Test plan

No automated tests needed for this change. Verification is manual:
- Pre-commit hook triggers on staged files
- Lint and formatting run automatically

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint` exits 0 in `frontend/`
- [ ] `ls frontend/.husky/pre-commit` succeeds (file exists)
- [ ] `cat frontend/.husky/pre-commit` shows `npx lint-staged`
- [ ] `cat frontend/.prettierrc` shows valid JSON
- [ ] `cat frontend/.editorconfig` shows valid config
- [ ] `grep -n "lint-staged" frontend/package.json` returns matches
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts (the codebase has drifted since this plan was written).
- `npx husky init` fails or the `.husky/` directory is not created.
- `npm run lint` fails after adding the pre-commit hook.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- If Prettier config changes, update both `.prettierrc` and the lint-staged config in `package.json`.
- If new file types need formatting (e.g., `.yaml`), add them to the lint-staged glob patterns.
- The pre-commit hook runs only on staged files, not all files.
