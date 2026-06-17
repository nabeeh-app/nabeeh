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
