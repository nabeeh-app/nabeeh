# Nabeeh — Implementation Handoff Plan

> Generated from 5 grilling sessions + WAHA cleanup audit.
> Every task below was discussed and agreed upon. Execute in order.

---

## Phase 0: Immediate Cleanup (Day 1)

### 0.1 — WAHA Removal

- [ ] Delete `.env.waha` (orphaned Docker config, no Docker files exist)
- [ ] Remove all WAHA env vars from `backend/.env`: `WAHA_BASE_URL`, `WAHA_SESSION_NAME`, `WEBHOOK_URL`, `WEBHOOK_SECRET`, `WAHA_SESSION_TIMEOUT`, `WAHA_KEEP_ALIVE_INTERVAL`, `WAHA_MAX_RECONNECT_ATTEMPTS`, `DISABLE_MONITORING`, `WAHA_LOG_LEVEL`
- [ ] Remove same vars from `backend/.env.example`
- [ ] Remove `openWAHADashboard` translations from `frontend/src/messages/en.json` and `ar.json`
- [ ] Remove "Open WAHA Dashboard" button from `frontend/src/app/[locale]/dashboard/settings/page.tsx` (lines 486-497)
- [ ] Remove hardcoded `http://localhost:3000` reference in settings page

### 0.2 — Dead Code Deletion

- [ ] Delete `backend/lib/aiServices.js` (empty file)
- [ ] Delete `frontend/src/components/auth/LoginForm.tsx` (unused — pages implement own forms)
- [ ] Delete `frontend/src/contexts/` directory (empty)
- [ ] Delete `frontend/src/app/(auth)/login/page.tsx` and `(auth)/layout.tsx` (duplicate login, keeping `[locale]/login`)
- [ ] Remove 40-line abandoned query in `backend/routes/parents.js` (lines 16-38, dead code with explanatory comments)
- [ ] Remove duplicate `POST /send-test` route in `backend/routes/whatsapp.js` (line 554, same as `/send-to-number`)
- [ ] Remove duplicate `POST /status` in `backend/routes/whatsapp.js` (line 472, same as `GET /status`)
- [ ] Remove `test_auth.js` from backend root (manual debugging script, not a test)
- [ ] Remove `frontend/progress.txt` (dev notes, not code)
- [ ] Remove `frontend/ralph-prd.json`, `frontend/ralph-prompt.txt`, `ralph-loop.sh`, `ralph-once.sh`, `ralph-run.log` (automation scripts, not app code)

### 0.3 — Secrets & Security

- [ ] Rotate Supabase keys — the service-role key is in `.env.production`
- [ ] Rotate Gemini API key — it's in `.env.production`
- [ ] Generate cryptographically random JWT secret (replace `nabeeh_super_secret_jwt_key_2025_production_ready_enhanced_security`)
- [ ] Delete `backend/.env.production` entirely (contains live keys)
- [ ] Add `backend/.env.production` to `.gitignore`
- [ ] Rotate WhatsApp session credentials if repo was shared

---

## Phase 1: Schema & Data Model (Days 2-3)

### 1.1 — Fresh Schema

- [ ] Create `database/migrations/001_initial_schema.sql` with the redesigned normalized schema:
  - `teachers` (id→auth.users, name, email, business_name, created_at)
  - `students` (id, teacher_id→teachers, student_code, name, phone, created_at) — **per-teacher, NOT global**
  - `parents` (id, student_id→students, name, phone, relationship, is_primary)
  - `subjects` (id, code, name_en, name_ar)
  - `teacher_subjects` (teacher_id→teachers, subject_id→subjects) — **fixed subjects per teacher**
  - `offerings` (id, teacher_id→teachers, subject_id→subjects, grade_level_id→grade_levels, academic_year, is_active)
  - `groups` (id, offering_id→offerings, name, max_capacity, schedule_description)
  - `enrollments` (id, student_id→students, group_id→groups, status, enrolled_at)
  - `grade_levels` (id, name, order)
  - `sessions` (id, group_id→groups, date, topic, notes)
  - `attendance` (id, session_id→sessions, enrollment_id→enrollments, status: present/absent/late/excused, notes)
  - `assessments` (id, offering_id→offerings, name, type: quiz/midterm/homework/final, max_score, date)
  - `grades` (id, enrollment_id→enrollments, assessment_id→assessments, score, notes)
  - `conversations` (id, parent_id→parents, teacher_id→teachers, whatsapp_chat_id)
  - `messages` (id, conversation_id→conversations, direction: incoming/outgoing, content, intent, confidence, is_automated)
  - `teacher_settings` (id, teacher_id→teachers, notifications JSONB, theme, language)
  - `password_reset_tokens` (id, teacher_id→teachers, token, expires_at, used)
  - `auth_audit_log` (id, teacher_id→teachers, event_type, ip_address, user_agent)
  - `faqs` (id, teacher_id→teachers, question_en, question_ar, answer_en, answer_ar, question_patterns JSONB, language, is_active)
- [ ] Create `database/migrations/002_rls_policies.sql` with RLS policies scoped to teacher ownership
- [ ] Delete old schema files: `database/schema.sql`, `backend/database/schema_v2.sql`, `backend/database/schema_v2_full.sql`, `backend/database/add_notes_to_grades.sql`, `backend/database/enable_rls_security.sql`
- [ ] Delete old migration files: `database/migrations/001_authentication_enhancement.sql` through `004` (conflicting with new schema)
- [ ] Update `database/run_migration.js` to use the new migration file

### 1.2 — ADR 0001 Update

- [ ] Mark ADR 0001 as accepted, link to the final schema file

---

## Phase 2: Backend Auth & Security (Days 3-4)

### 2.1 — Supabase Client Consolidation

- [ ] Update `backend/config/database.js` to export `{ supabase, supabaseAdmin }`:
  - `supabase` = anon key (reads, RLS-enforced)
  - `supabaseAdmin` = service-role key (admin writes, bypasses RLS)
- [ ] Remove `createClient` calls from `backend/routes/auth.js` (lines 13-23)
- [ ] Remove `createClient` calls from `backend/middleware/auth.js` (lines 6-9)
- [ ] Remove `createClient` calls from `backend/routes/offerings.js` (lines 3, 6-9)
- [ ] Update all route files to import from `config/database.js`

### 2.2 — Winston Logger

- [ ] Create `backend/lib/logger.js` — singleton Winston logger (or update `middleware/logger.js` to export)
- [ ] Replace ALL 36 `console.log`/`console.error`/`console.warn` calls across backend with logger:
  - `server.js:106-110` (3 calls)
  - `middleware/security.js:128,133` (2 calls)
  - `middleware/errorHandler.js:6` (1 call)
  - `middleware/auth.js:62,168,175` (3 calls)
  - `config/database.js:18,22,25` (3 calls)
  - `lib/auth.js:197` (1 call)
  - `lib/baileys.js:57,73,118,163,177` (5 calls)
  - `routes/auth.js:18,21,22,325,632` (5 calls)
  - `routes/students.js` (check)
  - `routes/attendance.js` (check)
  - `routes/grades.js:515` (2 calls)
  - `routes/messages.js:38,92,177` (3 calls)
  - `routes/whatsapp.js:20,35,44,60,111,136,156,384,435,487,548,585` (12 calls)
  - `routes/teachers.js:49,164,200,243` (4 calls)
  - `routes/parents.js:109,185,284,343` (4 calls)
  - `routes/offerings.js` (check)
- [ ] **CRITICAL**: Remove `console.log('LOGIN PAYLOAD', req.body)` from `routes/auth.js:325` — logs passwords
- [ ] **CRITICAL**: Remove `console.log` of reset tokens from `routes/auth.js:632`

### 2.3 — Rate Limiting

- [ ] Update `backend/middleware/security.js` to make rate limiters env-gated:
  ```js
  const isProd = process.env.NODE_ENV === 'production';
  const apiLimiter = isProd ? rateLimit({ windowMs: 15*60*1000, max: 100 }) : (req, res, next) => next();
  ```
- [ ] Apply same pattern to `authLimiter` and `whatsappLimiter`

### 2.4 — CORS

- [ ] Update `backend/server.js:63` to read allowed origins from env:
  ```js
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];
  cors({ origin: allowedOrigins, credentials: true })
  ```

### 2.5 — JWT & Auth

- [ ] Update `backend/lib/auth.js:83` to throw on missing JWT_SECRET instead of fallback
- [ ] Add CSRF token middleware for state-changing routes (POST/PUT/DELETE)
- [ ] Update frontend `lib/api.ts` to store JWT in httpOnly cookies (not localStorage)
- [ ] Update `routes/auth.js:437` — change `POST /verify-token` to `GET /verify-token`
- [ ] Add `authenticateToken` middleware to `/logout` route (`routes/auth.js:384`)

### 2.6 — Error Handler

- [ ] Rewrite `middleware/errorHandler.js` to handle PostgreSQL/Supabase errors:
  - `23505` — Unique violation → "Resource already exists"
  - `23503` — Foreign key violation → "Referenced resource not found"
  - `22P02` — Invalid UUID → "Invalid ID format"
  - `PGRST116` — Row not found → "Resource not found"
  - `42501` — Insufficient privilege → "Access denied"
- [ ] Remove all Mongoose references (`CastError`, code `11000`, `ValidationError`)

---

## Phase 3: WhatsApp Service Split (Days 4-5)

### 3.1 — Split whatsapp.js per ADR 0003

Create three new files in `backend/lib/`:

- [ ] `backend/lib/whatsappQuery.js` — DB queries for attendance and grades:
  - `getStudentAttendance(studentId, dateRange)` → queries attendance via enrollment chain
  - `getStudentGrades(studentId, subject?)` → queries grades via enrollment chain
  - `getParentByPhone(phone)` → parent lookup with student/teacher joins
  - `findOrCreateConversation(parentId, teacherId, chatId)` → conversation management
  - `saveMessage(conversationId, direction, content, meta?)` → message persistence

- [ ] `backend/lib/messageParser.js` — Pattern matching bot:
  - `detectIntent(text, language)` → returns { intent, params, confidence }
  - Intent detection for: attendance, grades, help, FAQ
  - Keyword lists for AR and EN
  - FAQ pattern matching against DB patterns

- [ ] `backend/lib/aiResponder.js` — Gemini AI integration:
  - `generateResponse(prompt, context)` → calls Gemini API
  - Use `x-goog-api-key` header (NOT URL query param)
  - Context injection (teacher name, parent name, student name, subjects, language)
  - Error handling for API failures

### 3.2 — Slim Down whatsapp.js

- [ ] Rewrite `routes/whatsapp.js` to be a thin router:
  - Import services from `lib/whatsappQuery.js`, `lib/messageParser.js`, `lib/aiResponder.js`
  - Baileys event listener → delegate to service
  - REST routes → delegate to service
  - No business logic in routes

### 3.3 — Two Bot Modes (ADR 0003)

- [ ] Implement mode selection based on teacher's subscription tier:
  - **Free tier**: `messageParser` pattern matching → `whatsappQuery` DB lookup → formatted response
  - **Paid tier**: `aiResponder` Gemini with tool use → decides whether to call DB or respond conversationally
  - Both share `whatsappQuery.js` for DB operations

### 3.4 — Configurable Marketing Messages

- [ ] Make marketing message configurable via env vars:
  ```
  WHATSAPP_MARKETING_PHONE=+201098455410
  WHATSAPP_MARKETING_URL=https://nabeeh-ai.com
  WHATSAPP_MARKETING_MSG_AR=... 
  WHATSAPP_MARKETING_MSG_EN=...
  ```
- [ ] Remove hardcoded phone number and URL from `routes/whatsapp.js:65-105`

### 3.5 — Gemini API Key Fix

- [ ] Change `routes/whatsapp.js:415` from URL query param to header:
  ```js
  // Before: `${GEMINI_URL}?key=${GEMINI_API_KEY}`
  // After:
  fetch(GEMINI_URL, {
    headers: { 'x-goog-api-key': GEMINI_API_KEY, 'Content-Type': 'application/json' }
  })
  ```

---

## Phase 4: Frontend Cleanup (Days 5-8)

### 4.1 — Remove Duplicate Login

- [ ] Delete `frontend/src/app/(auth)/` directory entirely
- [ ] Keep only `frontend/src/app/[locale]/login/page.tsx`
- [ ] Remove demo credentials from login form (hardcoded `ahmed.hassan@example.com` / `test123`)
- [ ] Remove "Demo account" info card from login page
- [ ] Remove "Or access directly" links from login page

### 4.2 — Mock Data Gating

- [ ] Create `frontend/src/lib/mockData.ts` — all mock data in one file, clearly marked
- [ ] Gate mock data behind `NEXT_PUBLIC_USE_MOCK` env var:
  ```ts
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK === 'true';
  // In each page: if (useMock) { /* use mock data */ } else { /* call API */ }
  ```
- [ ] On API failure in production: show error state with retry button (no mock fallback)
- [ ] Remove `Math.random()` phone number generation from mock data
- [ ] Remove duplicated mock student records from 3 files → single source in `mockData.ts`

### 4.3 — Theme & Branding

- [ ] Replace ALL 40+ hardcoded `text-blue-600` with CSS theme variables (`text-primary`, `bg-primary`)
- [ ] Update `globals.css` to define proper brand colors in `:root` (not just shadcn defaults)
- [ ] Delete the chart color variables (`--chart-1` through `--chart-5`) — no charts exist
- [ ] Wire up theme selector in settings page (light/dark/system via CSS variables + localStorage)

### 4.4 — RTL Support

- [ ] Install `tailwindcss-rtl` plugin or use Tailwind v4 built-in RTL utilities
- [ ] Delete the 130-line brute-force RTL CSS override block from `globals.css:73-203`
- [ ] Replace with proper `rtl:` prefixed Tailwind classes throughout components

### 4.5 — Extract Shared Components

- [ ] Create `frontend/src/components/ui/LoadingSpinner.tsx` — the spinning loader used 5 times
- [ ] Create `frontend/src/components/ui/StatCard.tsx` — the stat card pattern used on 3 pages
- [ ] Create `frontend/src/components/ui/EmptyState.tsx` — the "no data" state
- [ ] Update all pages to import from shared components instead of inline definitions

### 4.6 — Icons

- [ ] Replace all emoji icons (👥 📊 📝 💬 🎓 👤 👨‍👩‍👧 ⚡) with Lucide React icons
- [ ] Use consistent icon mapping:
  - Students → `Users` icon
  - Attendance → `ClipboardCheck` icon
  - Grades → `GraduationCap` icon
  - Messages → `MessageSquare` icon

### 4.7 — Settings Page

- [ ] Wire up notification preferences — save to `teacher_settings` table via API
- [ ] Wire up theme switching — persist to localStorage + CSS variables
- [ ] Profile upload — defer to later phase (needs Supabase Storage setup)
- [ ] Remove `SimpleWhatsAppSetup` import (file doesn't exist, causes TS error)

### 4.8 — Error Boundaries

- [ ] Add per-page error boundaries to each dashboard page:
  ```tsx
  // In each page:
  <ErrorBoundary fallback={<ErrorFallback page="students" />}>
    <StudentsPage />
  </ErrorBoundary>
  ```
- [ ] Create reusable `ErrorFallback` component with retry button

### 4.9 — i18n Cleanup

- [ ] Remove inline translation objects from `dashboard/page.tsx` (lines 19-56)
- [ ] Use `useTranslations()` from next-intl instead
- [ ] Add missing keys to `en.json` and `ar.json`

---

## Phase 5: Backend API Consistency (Days 8-9)

### 5.1 — Zod Validation

- [ ] Install `zod` in backend
- [ ] Create `backend/lib/validation.js` with shared schemas:
  - `createStudentSchema` (name, phone, student_code)
  - `createParentSchema` (student_id, name, phone, relationship)
  - `markAttendanceSchema` (session_id, records: [{enrollment_id, status}])
  - `createGradeSchema` (assessment_id, enrollment_id, score)
  - `createAssessmentSchema` (offering_id, name, type, max_score, date)
  - `loginSchema` (email, password)
  - `registerSchema` (name, email, password, business_name)
- [ ] Add Zod validation to every route that accepts user input
- [ ] Return structured validation errors: `{ success: false, message: "...", code: 'VALIDATION_ERROR' }`

### 5.2 — Standard Response Envelope

- [ ] Create `backend/lib/response.js` with helpers:
  ```js
  const success = (res, data) => res.json({ success: true, data });
  const paginated = (res, data, page, limit, total) => res.json({ success: true, data, pagination: { page, limit, total } });
  const error = (res, status, message, code) => res.status(status).json({ success: false, message, code });
  ```
- [ ] Update ALL routes to use these helpers instead of raw `res.json()`
- [ ] Fix `routes/offerings.js:29,62` — currently returns raw array without envelope
- [ ] Fix `routes/offerings.js:31` — uses `{ error }` instead of `{ success, message }`

### 5.3 — Fix password_hash Leakage

- [ ] Fix `routes/teachers.js:42` — change `delete teacherProfile.password` to `delete teacherProfile.password_hash`
- [ ] Verify no other route leaks `password_hash`

### 5.4 — Fix Math.random ID

- [ ] Fix `routes/teachers.js:143` — `id: Math.random()` should use actual grade ID from query

---

## Phase 6: Frontend-Backend Contract (Day 9)

### 6.1 — TypeScript Types Alignment

- [ ] Update `frontend/src/types/index.ts` to match new schema:
  - Remove `teacher_id` from `Student` type (students are per-teacher via enrollment chain)
  - Add `enrollment_id` to attendance records
  - Add `assessment_id` to grade records
  - Align all types with actual API response shapes

### 6.2 — API Client Cleanup

- [ ] Update `frontend/src/lib/api.ts` to match new endpoint signatures
- [ ] Remove `sendWhatsAppMessage` that calls `/send-test` (deleted route)
- [ ] Ensure all API methods return typed responses matching the standard envelope

---

## Phase 7: Testing (Days 10-11)

### 7.1 — Backend Tests

- [ ] Create `backend/routes/__tests__/auth.spec.js` — login, register, password reset
- [ ] Create `backend/routes/__tests__/students.spec.js` — CRUD + enrollment chain queries
- [ ] Create `backend/routes/__tests__/attendance.spec.js` — mark + query
- [ ] Create `backend/routes/__tests__/grades.spec.js` — CRUD + bulk + stats
- [ ] Mock Supabase client in all tests
- [ ] Verify `npm test` passes

### 7.2 — Lint & Type Check

- [ ] Run `npm run lint` in frontend — fix all errors
- [ ] Verify no TypeScript errors with `npm run build`
- [ ] Ensure zero `console.log` in backend

---

## Phase 8: Documentation (Day 11)

### 8.1 — Update ADRs

- [ ] Mark ADR 0001 as accepted
- [ ] Mark ADR 0002 as accepted
- [ ] Mark ADR 0003 as accepted (update status: implemented)
- [ ] Mark ADR 0004 as accepted
- [ ] Mark ADR 0005 as accepted

### 8.2 — Update AGENTS.md

- [ ] Add WhatsApp section: Baileys-only, two modes, service architecture
- [ ] Verify all commands still work
- [ ] Update .env.example with new vars (CORS_ORIGINS, WHATSAPP_MARKETING_*)

### 8.3 — Update README.md

- [ ] Document local dev setup with Baileys
- [ ] Document env vars needed
- [ ] Remove any WAHA references

---

## Summary

| Phase | Scope | Est. Time |
|-------|-------|-----------|
| 0 | WAHA removal, dead code, secrets | Day 1 |
| 1 | Schema redesign + migrations | Days 2-3 |
| 2 | Auth & security (clients, Winston, rate limits, CORS, JWT, error handler) | Days 3-4 |
| 3 | WhatsApp service split + two bot modes | Days 4-5 |
| 4 | Frontend cleanup (login, mock data, theme, RTL, components, icons, settings, errors) | Days 5-8 |
| 5 | Backend API consistency (Zod, envelope, fix leaks) | Days 8-9 |
| 6 | Frontend-backend contract alignment | Day 9 |
| 7 | Testing | Days 10-11 |
| 8 | Documentation | Day 11 |

**Total estimate: ~11 working days**
