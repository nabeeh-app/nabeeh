# Nabeeh — Agent & Developer Guide

## Project Overview

Nabeeh is a bilingual (AR/EN) smart teaching assistant for classroom management, student tracking, attendance, grade management, and parent communication via WhatsApp. Targets private tutors and tutoring centers in Egypt/MENA.

**Tech stack:** Express 5 (backend) · Next.js 16 + React 19 + Tailwind v4 (frontend) · Supabase/PostgreSQL (database) · Baileys (WhatsApp) · Gemini AI (bot responses)

---

## Domain Language (use these terms, not synonyms)

| Term | Definition | Avoid |
|------|-----------|-------|
| **Teacher** | Account holder who manages students, attendance, grades | instructor, tutor, educator |
| **Student** | Learner enrolled in a teacher's offering. Owned by one teacher — not global. | pupil, learner, user |
| **Parent** | Contact linked to one or more students. Communicates via WhatsApp. | guardian, contact |
| **Offering** | A course: (teacher + subject + grade_level + academic_year). Contains groups. | course, class, program |
| **Group** | Cohort of students within an offering. Has a schedule and capacity. | cohort, section |
| **Enrollment** | Link between a student and a group. | registration, signup |
| **Assessment** | Graded event (midterm, quiz, homework, final). Belongs to an offering. | test, exam |
| **Grade** | A student's score on a specific assessment. Stored as (enrollment, assessment, score). | mark, result, score |
| **Session** | A single class meeting where attendance is recorded. Belongs to a group. | class, lecture |
| **Attendance** | Student's presence status (present/absent/late/excused) for a session. | check-in, roll call |
| **WhatsApp Bot** | Automated system responding to parent queries. Uses pattern matching + Gemini AI. | chatbot, assistant |
| **Feature Flag** | Boolean toggle controlling UI feature visibility. In `featureFlags.ts`. | toggle, switch |

See `CONTEXT.md` for the full glossary.

---

## Architecture Decisions (read ADRs before changing architecture)

All architectural decisions are documented in `docs/adr/`:

- **0001** — Per-teacher student ownership and normalized schema
- **0002** — Auth and security standards
- **0003** — WhatsApp bot architecture and tiers
- **0004** — Frontend cleanup and theming
- **0005** — API consistency and validation

**If you're about to make a structural change, read the relevant ADR first. If the decision is already recorded, follow it. If you're proposing a reversal, update the ADR status.**

---

## Project Structure

```
nabeeh/
├── backend/                    # Express API
│   ├── server.js               # Entry point — middleware chain, route mounting
│   ├── config/
│   │   └── database.js         # Exports { supabase, supabaseAdmin } — THE ONLY Supabase clients
│   ├── middleware/
│   │   ├── auth.js             # JWT verification + role check
│   │   ├── security.js         # Rate limiting (env-gated), helmet, sanitization
│   │   ├── logger.js           # Request logging via Winston
│   │   └── errorHandler.js     # PostgreSQL error handling (NOT Mongoose)
│   ├── routes/                 # One file per domain entity
│   │   ├── auth.js             # Login, register, password reset
│   │   ├── teachers.js         # Profile, settings, dashboard stats
│   │   ├── students.js         # CRUD + stats (enrollment-based queries)
│   │   ├── attendance.js       # Mark + query (session-based)
│   │   ├── grades.js           # CRUD + bulk + stats (assessment-based)
│   │   ├── messages.js         # Conversations + stats
│   │   ├── whatsapp.js         # WhatsApp bot endpoints
│   │   ├── parents.js          # CRUD for parent contacts
│   │   └── offerings.js        # Course offerings + groups
│   ├── lib/
│   │   ├── auth.js             # PasswordService, TokenService, AuthService
│   │   ├── baileys.js          # WhatsApp socket client wrapper
│   │   ├── permissions.js      # RBAC definitions
│   │   └── emailTemplates.js   # Bilingual HTML email templates
│   ├── scripts/                # Seed, fix, test utilities
│   ├── database/               # Schema files (reference only — use migrations/)
│   ├── auth_info_baileys/      # WhatsApp session files (NEVER commit)
│   └── logs/                   # Runtime logs (NEVER commit)
├── frontend/                   # Next.js 16 + React 19
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx      # Root layout (Geist font, providers)
│   │   │   ├── globals.css     # Tailwind + theme CSS variables
│   │   │   ├── [locale]/       # Locale-segmented routes
│   │   │   │   ├── layout.tsx  # next-intl locale detection
│   │   │   │   ├── login/      # Login page (THE ONLY login)
│   │   │   │   ├── register/   # Registration
│   │   │   │   └── dashboard/  # Protected dashboard routes
│   │   │   │       ├── layout.tsx  # Dashboard shell (sidebar + auth guard)
│   │   │   │       ├── page.tsx    # Dashboard home
│   │   │   │       ├── students/
│   │   │   │       ├── attendance/
│   │   │   │       ├── grades/
│   │   │   │       ├── messages/
│   │   │   │       ├── whatsapp/
│   │   │   │       ├── courses/
│   │   │   │       ├── settings/
│   │   │   │       └── ... (other pages)
│   │   ├── components/
│   │   │   ├── sidebar.tsx         # Main navigation
│   │   │   ├── language-switcher.tsx
│   │   │   ├── ComingSoon.tsx      # Feature-flag placeholder
│   │   │   ├── error-boundary.tsx  # Root error boundary
│   │   │   ├── auth/
│   │   │   │   └── ProtectedRoute.tsx  # Auth guard
│   │   │   └── ui/                 # shadcn/ui components
│   │   ├── hooks/
│   │   │   ├── useAuth.tsx         # Auth context + provider
│   │   │   └── useWhatsAppStatus.ts
│   │   ├── lib/
│   │   │   ├── api.ts              # Centralized API client (singleton)
│   │   │   └── utils.ts            # cn(), status helpers, validators
│   │   ├── messages/               # i18n translation files
│   │   │   ├── en.json
│   │   │   └── ar.json
│   │   └── types/
│   │       └── index.ts            # TypeScript interfaces
│   └── public/                     # Static assets
├── database/
│   ├── migrations/                 # SQL migration files (run in order)
│   └── run_migration.js            # Migration runner
├── docs/
│   └── adr/                        # Architecture Decision Records
├── CONTEXT.md                      # Domain language glossary
├── ARCH_REVIEW.md                  # Previous architecture review
└── ARCH_DECISIONS_PLAN.md          # Action plan from review
```

---

## Critical Rules

### 1. Supabase Clients — ONE PLACE ONLY

```js
// backend/config/database.js
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);      // reads
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY); // admin writes
```

**NEVER create Supabase clients in route files or middleware.** Import from `config/database.js`. The anon client for reads, the admin client for operations that bypass RLS (creating auth users, etc.).

### 2. Data Access Chain

All student data is accessed through the enrollment chain:

```
teacher → offerings → groups → enrollments → students
                          ↓
                       sessions → attendance
                          ↓
                       assessments → grades
```

**Never query students directly with a `teacher_id` filter.** Always go through the chain. This enforces data isolation between teachers.

### 3. API Response Format

Every endpoint returns one of:

```js
// Success
res.json({ success: true, data: result });

// Success with pagination
res.json({ success: true, data: items, pagination: { page, limit, total } });

// Error
res.status(4xx/5xx).json({ success: false, message: 'Error description', code: 'ERROR_CODE' });
```

**Never return raw objects or `{ error: '...' }`.** Always use the envelope.

### 4. Input Validation — Zod

Every route that accepts user input must validate with Zod:

```js
const { z } = require('zod');

const createStudentSchema = z.object({
  name: z.string().min(1).max(255),
  phone: z.string().regex(/^\+?[1-9]\d{6,14}$/),
  student_code: z.string().min(1).max(50),
});

// In route handler:
const parsed = createStudentSchema.safeParse(req.body);
if (!parsed.success) {
  return res.status(400).json({ success: false, message: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' });
}
```

### 5. Error Handler — PostgreSQL, NOT Mongoose

The error handler in `middleware/errorHandler.js` must handle:

- `23505` — Unique violation (duplicate key)
- `23503` — Foreign key violation
- `22P02` — Invalid UUID format
- `PGRST116` — Row not found (Supabase PostgREST)
- `42501` — Insufficient privilege (RLS blocked)

**Never reference Mongoose errors** (CastError, code 11000, ValidationError). This is a Supabase project.

### 6. Logging — Winston Only

```js
const winston = require('winston');
const logger = winston.createLogger({ /* ... */ });

// Use this everywhere:
logger.info('Student created', { teacherId, studentId });
logger.error('Query failed', { error: error.message, route: req.path });
```

**Never use `console.log`, `console.error`, or `console.warn`.** There are 36 instances to replace. Import or access the Winston logger.

### 7. Authentication

- JWT tokens stored in **httpOnly cookies** (not localStorage)
- CSRF token required for state-changing requests
- Auth middleware queries `teachers` table on every request to verify user is active
- Rate limiting: login (20/5min), register (20/hr), reset (3/hr) — env-gated

### 8. WhatsApp Bot — Two Modes

The bot supports two response modes (may be tiered as paid features):

1. **Pattern matching + DB query** (free tier): keyword detection → direct DB lookup → formatted response
2. **AI-first with tools** (paid tier): Gemini decides whether to call DB tools or respond conversationally

Both modes share the same DB query layer in `lib/whatsappQuery.js`.

### 9. Frontend Patterns

- **Locale routing:** `[locale]/` segment handles AR/EN. Use `useTranslations()` from next-intl, NOT inline translation objects.
- **Theme:** Use CSS variables (`var(--primary)`, `var(--accent)`), NOT hardcoded `text-blue-600`.
- **RTL:** Use `tailwindcss-rtl` plugin (`rtl:mr-2`), NOT manual CSS overrides.
- **Mock data:** Gated behind `NEXT_PUBLIC_USE_MOCK=true`. Production shows error states.
- **Error boundaries:** Each dashboard page has its own error boundary. One page crash must not kill the dashboard.
- **Shared components:** Use `LoadingSpinner`, `StatCard`, `EmptyState` from `components/ui/`. Don't duplicate.
- **Icons:** Use Lucide React. Never use emoji as icons (👥 📊 📝 💬).

---

## Build, Test, and Development Commands

### Backend (`backend/`)
```bash
npm run dev          # Start with Nodemon (hot reload)
npm start            # Production server
npm test             # Jest test suites
node database/run_migration.js    # Apply migrations
node scripts/seed_test_users.js   # Seed demo data
```

### Frontend (`frontend/`)
```bash
npm run dev          # Turbopack dev server
npm run build        # Production build
npm start            # Production server
npm run lint         # ESLint (must pass before pushing)
```

### Pre-commit Checklist
1. `npm test` passes in `backend/`
2. `npm run lint` passes in `frontend/`
3. No `console.log` statements in backend (use Winston)
4. No hardcoded `text-blue-600` in frontend (use CSS vars)
5. No secrets in code (check `.env.example`, not `.env`)
6. Zod validation on all new endpoints
7. Standard envelope response format

---

## Testing Guidelines

- **Backend:** Jest + Supertest. Test files in `routes/__tests__/entity.spec.js`. Mock Supabase and WhatsApp clients.
- **Frontend:** Currently manual. When adding automated tests, use Vitest. colocate in `ComponentName.test.tsx`.
- **WhatsApp flows:** Include sample message payloads and response screenshots in PRs.
- **Mock data:** Use `NEXT_PUBLIC_USE_MOCK=true` for local dev. Never mock in production builds.

---

## Security Checklist (for every new route or feature)

- [ ] Rate limiter attached (auth, api, or whatsapp tier)
- [ ] Input validated with Zod
- [ ] Auth middleware applied (`authenticateToken`)
- [ ] Response uses standard envelope
- [ ] No secrets logged (use Winston with redaction)
- [ ] No `console.log` of sensitive data
- [ ] CORS origin checked (not `origin: true`)
- [ ] RBAC check if endpoint is admin-only

---

## Commit & PR Guidelines

Format: `type(scope): description`

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `security`

Examples:
- `feat(whatsapp): add pattern-matching service for attendance queries`
- `fix(api): prevent password_hash leakage in teacher profile response`
- `security(auth): rotate JWT secret and enable rate limiting`
- `refactor(frontend): extract LoadingSpinner and StatCard components`

Each PR must include:
- Summary of changes
- Migration notes (if `database/` changes)
- UI screenshots (if frontend changes)
- Environment variable updates (if `.env.example` changes)
- Confirmation that `npm test` and `npm run lint` pass

---

## File Management

### Never Commit
- `.env` files (only `.env.example` and `.env.local.example`)
- `backend/auth_info_baileys/` (WhatsApp session data)
- `backend/logs/` (runtime logs)
- `node_modules/`
- `.next/` build output

### Dead Code — Delete Immediately
- Empty files (e.g., `lib/aiServices.js`)
- Unused components (e.g., `components/auth/LoginForm.tsx`)
- Abandoned queries (e.g., old code blocks left in files)
- Duplicate routes (e.g., `/send-test` same as `/send-to-number`)

### Schema Files
- `database/schema.sql` — OLD flat schema, retired. Reference only.
- `backend/database/schema_v2.sql` — Previous normalized attempt. Reference only.
- `database/migrations/` — Active migrations. Apply in order.
- New schema changes go in `database/migrations/` with sequential numbering.

---

## Common Pitfalls

1. **Don't create Supabase clients in routes.** Import from `config/database.js`.
2. **Don't query students with `teacher_id`.** Use the enrollment chain.
3. **Don't use `console.log`.** Use the Winston logger.
4. **Don't hardcode `text-blue-600`.** Use CSS theme variables.
5. **Don't return raw objects from API.** Use `{ success, data/message }`.
6. **Don't reference Mongoose.** This is a Supabase/PostgreSQL project.
7. **Don't skip Zod validation.** Every endpoint that accepts input needs it.
8. **Don't add mock data to production code.** Gate behind `NEXT_PUBLIC_USE_MOCK`.
9. **Don't duplicate components.** Extract to `components/ui/` and import.
10. **Don't add emoji as icons.** Use Lucide React.
