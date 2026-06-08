# Nabeeh Architecture Decisions & Action Plan

## Inputs
- Synthesized from the issues and evidence listed in `ARCH_REVIEW.md` (Executive Summary through Section 11).
- No new code changes were inspected; this is a planning document only.

## Decisions
1. **Schema v3 is the single source of truth.** Supabase will remain the persistence layer, but we will introduce a third schema version that adds the columns/tables referenced in code (`teachers.password_hash`, `teacher_settings`, `conversations/messages`, `auth_audit_log`, etc.) and reconciles the attendance/grades joins. Code will adapt to this schema instead of carrying incompatible queries. (Ref: `ARCH_REVIEW.md` §§0,2,4,7.)
2. **Security-first posture before feature work.** All committed secrets, Baileys session artifacts, and unauthenticated WhatsApp endpoints will be removed/locked before any new releases. No developer environment should rely on production keys baked into git. (Ref: `ARCH_REVIEW.md` §§0,5,7,8.)
3. **One API contract, one client.** Every network call (dashboard stats, WhatsApp status, settings) will flow through `frontend/src/lib/api.ts` and share typed DTOs published from the backend. Hard-coded `fetch('http://localhost:5000')` calls are no longer allowed. (Ref: `ARCH_REVIEW.md` §§1,2,5,7.)
4. **Feature gating + progressive activation.** Dashboard cards, messaging UI, courses, and admin pages stay hidden or explicitly marked “demo” until they read real data. Work concentrates on login, student management, attendance, grades, and WhatsApp before re-exposing aux screens. (Ref: `ARCH_REVIEW.md` §§2,3.)
5. **WhatsApp automation splits from the request thread.** Express exposes authenticated REST endpoints only; Baileys/Gemini runs as a worker consuming jobs from a queue (Supabase table or Redis) so outages do not block API throughput. (Ref: `ARCH_REVIEW.md` §§0,5,7,9.)
6. **Migration + CI governance.** Every DB change ships via scripted migrations (reviving the missing `database/run_migration.js`) and runs in CI alongside API contract tests so schema/API drift cannot recur. (Ref: `ARCH_REVIEW.md` §§0,4,5,9.)

## Action Plan
### Phase 0 — Contain Risk (Day 0–2)
- Rotate Supabase/Gemini keys, delete `backend/auth_info_baileys/*`, and add `.env.example` guidance. Gate `/api/whatsapp/*` behind `authenticateToken` and disable send/status endpoints until workers exist.
- Document a temporary “feature availability” matrix in the README so testers know which pages are demo-only.

### Phase 1 — Schema & Auth Foundation (Day 2–5)
- Author schema v3 migrations covering teacher credentials, teacher_settings, password reset tokens, audit log, conversations/messages, and FAQ/documents tables referenced in the code.
- Update Supabase policies + service-role usage so Express uses privileged keys for server-to-server flows while the frontend relies on JWT-authenticated requests only.
- Implement `/api/auth/register`, `/api/auth/profile`, `/api/teachers/settings`, and align `BulkAttendanceRequest`/`Grade` payloads to the new schema. Provide contract tests for these endpoints.

### Phase 2 — Feature Completion (Week 2)
- Replace dashboard/messaging/course/report mocks with live queries, using the unified `apiClient`. Hide admin-only navigation based on roles.
- Connect the WhatsApp status/monitor and messaging pages to the real `/whatsapp/conversations` + `/messages/...` endpoints, adding pagination and loading/error states.
- Add seeding + migration scripts to npm/yarn workflows and wire them into CI to guarantee new environments bootstrap cleanly.

### Phase 3 — Scale & Automation (Weeks 3–4)
- Introduce the dedicated WhatsApp worker (Baileys + Gemini) fed by a queue table/service; Express writes jobs and reads delivery state only.
- Extract shared TypeScript contracts into a `packages/contracts` folder consumed by both backend and frontend, ensuring response shapes stay synchronized.
- Layer observability (structured logging, metrics) and load/pagination controls on data-heavy endpoints (students, attendance, grades) to prepare for higher tenant counts.

## Traceability
- Each decision/action is mapped back to the risks called out in `ARCH_REVIEW.md`; future changes should reference both this plan and the original evidence before implementation.
