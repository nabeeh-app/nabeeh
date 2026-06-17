# Plan 020: Rewrite frontend README

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2e8fb57..HEAD -- frontend/README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `2e8fb57`, 2026-06-16
- **Issue**: none

## Why this matters

`frontend/README.md` is the verbatim Next.js boilerplate. It references `app/page.tsx` (doesn't exist — routes use `[locale]/` segments), suggests `yarn dev` (project uses npm), and links to Vercel deployment docs. No project-specific documentation exists. New contributors get no guidance on environment setup, feature flags, or mock mode.

## Current state

- `frontend/README.md:1-36` — boilerplate content:
  ```markdown
  This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
  ...
  You can start editing the page by modifying `app/page.tsx`.
  ```
- `frontend/package.json:5-13` — actual scripts:
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
- `frontend/.env.example:1-12` — documented env vars:
  ```
  NEXT_PUBLIC_API_URL=http://localhost:5000/api
  NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
  NEXT_PUBLIC_USE_MOCK=false
  ```
- `AGENTS.md:1-7` — project overview: bilingual AR/EN smart teaching assistant, Next.js 16 + React 19 + Tailwind v4

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Verify README | `cat frontend/README.md` | shows project-specific content |
| Verify env vars | `grep "NEXT_PUBLIC_" frontend/.env.example` | shows 4 vars |

## Scope

**In scope** (the only files you should modify):
- `frontend/README.md` — complete rewrite

**Out of scope** (do NOT touch, even though they look related):
- `AGENTS.md` — root documentation, don't modify
- `frontend/.env.example` — already correct
- `frontend/package.json` — already correct

## Git workflow

- Branch: `advisor/020-frontend-readme`
- Commit: `docs(frontend): rewrite README with project-specific documentation`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Rewrite README.md

Replace the entire contents of `frontend/README.md` with:

```markdown
# Nabeeh Frontend

Bilingual (AR/EN) smart teaching assistant frontend. Built with Next.js 16, React 19, and Tailwind v4.

## Prerequisites

- Node.js 18+
- Backend server running (see `backend/` directory)
- Supabase project (for OAuth authentication)

## Environment Setup

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in the required variables:
   | Variable | Description | Required |
   |----------|-------------|----------|
   | `NEXT_PUBLIC_API_URL` | Backend API URL | Yes |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes (for OAuth) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes (for OAuth) |
   | `NEXT_PUBLIC_USE_MOCK` | Enable mock data mode (`true`/`false`) | No |

## Development

```bash
# Install dependencies
npm install

# Start dev server (Turbopack)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

The dev server runs at [http://localhost:3000](http://localhost:3000) with locale-based routing (`/en/...`, `/ar/...`).

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with Turbopack |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest tests |
| `npm run test:watch` | Run tests in watch mode |

## Mock Mode

For development without a running backend, enable mock mode:

```bash
NEXT_PUBLIC_USE_MOCK=true npm run dev
```

This uses mock data so you can work on UI without API dependencies.

## Feature Flags

Feature visibility is controlled by environment variables in `src/config/featureFlags.ts`. Each feature can be toggled via `NEXT_PUBLIC_FEATURE_*` env vars:

| Flag | Env Var | Default | Description |
|------|---------|---------|-------------|
| `grades` | `NEXT_PUBLIC_FEATURE_GRADES` | `true` | Grades CRUD page |
| `reports` | `NEXT_PUBLIC_FEATURE_REPORTS` | `true` | Reports dashboard |
| `messaging` | `NEXT_PUBLIC_FEATURE_MESSAGING` | `false` | WhatsApp messaging |
| `courses` | `NEXT_PUBLIC_FEATURE_COURSES` | `true` | Course management |
| `monitor` | `NEXT_PUBLIC_FEATURE_MONITOR` | `true` | System monitor |
| `assistants` | `NEXT_PUBLIC_FEATURE_ASSISTANTS` | `true` | Teacher management |
| `aiFeatures` | `NEXT_PUBLIC_FEATURE_AI` | `true` | AI-powered features |
| `alerts` | `NEXT_PUBLIC_FEATURE_ALERTS` | `true` | Alert configuration |
| `notifications` | `NEXT_PUBLIC_FEATURE_NOTIFICATIONS` | `false` | Notifications |
| `gradeAnalysis` | `NEXT_PUBLIC_FEATURE_GRADE_ANALYSIS` | `false` | Grade analysis |

## Project Structure

```
src/
├── app/[locale]/     # Locale-segmented routes (AR/EN)
├── components/       # React components
│   ├── ui/          # Shared UI components (shadcn/ui)
│   └── auth/        # Authentication components
├── config/          # Feature flags, navigation
├── hooks/           # React Query hooks
├── lib/             # API client, utilities
├── messages/        # i18n translation files (en.json, ar.json)
└── types/           # TypeScript interfaces
```

## Architecture

See `AGENTS.md` in the project root for full architecture documentation, domain language, and coding conventions.
```

**Verify**: `grep -c "Nabeeh" frontend/README.md` → shows 1 or more

### Step 2: Verify content

Check that the README no longer contains boilerplate references.

**Verify**: `grep -c "app/page.tsx" frontend/README.md` → shows 0

**Verify**: `grep -c "yarn dev" frontend/README.md` → shows 0

## Test plan

No automated tests needed. This is a documentation change.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `cat frontend/README.md` shows project-specific content (mentions "Nabeeh", "bilingual", "Next.js 16")
- [ ] `grep -c "app/page.tsx" frontend/README.md` returns 0 (no boilerplate references)
- [ ] `grep -c "yarn dev" frontend/README.md` returns 0
- [ ] `grep "NEXT_PUBLIC_USE_MOCK" frontend/README.md` returns matches (mock mode documented)
- [ ] `grep "featureFlags" frontend/README.md` returns matches (feature flags documented)
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts (the codebase has drifted since this plan was written).
- The `.env.example` file contains variables not listed in the plan (check and add them).

## Maintenance notes

For the human/agent who owns this code after the change lands:

- When adding new env vars to `.env.example`, update the README table.
- When adding new feature flags, update the README feature flags table.
- When restructuring `src/`, update the project structure section.
