# Handoff: Nabeeh Product & Architecture Decisions

## Context

Extended grilling session with Mustafa (project owner) covering: teacher-assistant model, concurrent access, Google login, AI/agentic features, deployment strategy, monetization/pricing, and onboarding UX. All decisions below were made interactively and are final.

---

## Files Created / Modified This Session

### Documentation (New)
| File | What |
|------|------|
| `docs/adr/0006-assistant-model-and-permissions.md` | ADR: assistant model, permissions, concurrent access, Google login |
| `docs/adr/0007-ai-agentic-automation-strategy.md` | ADR: AI tiering, Gemini over OpenAI, cron over streaming, template+AI hybrid |
| `docs/deployment-comparison.md` | 4 deployment options compared with cost tables, Egypt context |
| `docs/monetization-pricing.md` | 4 tiers (Free/Basic/Pro/Center), EGP pricing, revenue projections, payment gateway strategy |
| `docs/ai-agentic-automation.md` | Full AI feature spec: WhatsApp intelligence, reports, alerts, notifications, architecture, teacher/assistant workflows, grade analysis, report comments, weekly digest |
| `docs/onboarding-ux-flow.md` | Onboarding flow, demo data, progressive unlock, feature gating, empty states |
| `docs/admin-panel-telemetry.md` | Admin panel architecture, user management, subscription management, payment logging, telemetry, system health, support tools |
| `docs/student-data-import.md` | Student import methods (manual, Excel, paste, self-register), column auto-detection, validation, configurable required fields |
| `docs/llm-cost-optimization.md` | LLM comparison: Gemini vs self-hosted (Qwen 3 8B, SILMA Kashif 2B), hybrid strategy, pattern matching first, cost analysis |

### Documentation (Modified)
| File | What Changed |
|------|-------------|
| `CONTEXT.md` | Added 7 terms: Assistant, Permission Flag, Attendance Lock, Conversation Handoff, Invite Token, Google Login, Onboarding Tour |

### Existing Files Referenced (Not Modified)
| File | Relevance |
|------|-----------|
| `database/migrations/001_initial_schema.sql` | Current schema — teachers, students, offerings, groups, enrollments, etc. |
| `database/migrations/002_rls_policies.sql` | RLS policies — all auth.uid() = teacher_id |
| `docs/adr/0001-per-teacher-student-schema.md` | Per-teacher student ownership decision |
| `docs/adr/0002-auth-and-security-standards.md` | JWT, Supabase clients, rate limiting |
| `docs/adr/0003-whatsapp-bot-architecture.md` | Bot tiers, pattern matching + Gemini |
| `backend/routes/auth.js` | Current auth flow (register, login, profile) |
| `ARCH_REVIEW.md` | Previous architecture review (known issues) |

---

## Decisions Summary

### 1. Assistant Model
- **Schema**: `teacher_assistants` junction table (teacher_id, assistant_id, permissions JSONB, status)
- **Multi-teacher**: Assistants can work for multiple teachers with different permissions per teacher
- **UI**: Dropdown to switch between teachers in the header
- **RLS**: Backend bypass using `supabaseAdmin` + app-level permission checks. RLS stays teacher-only.

### 2. Permission System
8 boolean flags: `view_students`, `manage_attendance`, `manage_grades`, `manage_assessments`, `manage_offerings`, `send_whatsapp`, `view_reports`, `manage_students`

- Teacher defines a default template, customizes per assistant
- Defaults are teacher-defined (not hardcoded)

### 3. Invite Flow
1. Teacher enters assistant's email
2. System creates `assistant_invites` record with token (expires 48h)
3. Email sent with invite link
4. Assistant clicks link → signs up or logs in → auto-linked to teacher
5. Pending invite limit: configurable per subscription tier

### 4. Assistant Lifecycle
States: `pending` → `active` → `deactivated` | `removed`
- Deactivate: suspend without deleting (reactivable)
- Remove: soft delete, history preserved with author attribution
- Assistant can also choose to leave

### 5. Concurrent Attendance Locking
- Per student row (not per session)
- DB-persisted: `attendance_locks(session_id, student_id, locked_by, locked_at)`
- 5-minute auto-release (configurable in teacher settings)
- Two people can edit same session if working on different students

### 6. WhatsApp Bot Handoff
- Bot auto-pauses when human sends manual message (configurable timeout)
- Teacher/assistant can manually resume bot
- Parent sees teacher's identity — assistant operates under teacher's name
- Track `last_responder_id`, `last_responder_type`, `bot_paused_until`

### 7. Full Audit Log
`action_audit_log(actor_id, actor_type, teacher_id, action, entity_type, entity_id, metadata, ip_address, created_at)`

### 8. Notifications
- Teacher notified when assistant performs key actions
- Configurable per teacher (which actions trigger notifications)

### 9. Google Login
- **Provider**: Supabase built-in Google OAuth (not Passport.js)
- **Who**: Both teachers and assistants
- **Placement**: Google button on both login and register pages
- **Account linking**: Auto-links if same email exists (no duplicate accounts)
- **Assistant invite matching**: Strict — email must match invited email exactly
- **First-time onboarding**: Quick profile confirm + in-app product tour
- **Email/password still available**: Google is additive

### 10. Subscription-Based Limits
- Assistant count gated by tier: Free=0, Basic=2, Pro=5, Center=15
- Pending invite count also tier-gated

### 11. AI/Agentic Features
- **WhatsApp bot**: Pattern matching (Basic) → Gemini with tools (Pro) → AI insights (Center)
- **Reports**: On-demand via WhatsApp (Basic) → Scheduled auto-generation (Pro)
- **Alerts**: Teacher-defined thresholds (Basic) → AI trend detection (Pro)
- **Parent notifications**: Template-based (Basic) → AI-personalized (Pro)
- **Business intelligence**: Center tier only (enrollment optimization, revenue tracking)
- **Gemini over OpenAI**: Better Arabic support, cheaper at scale
- **Cron over streaming**: Simpler, predictable costs
- **AI analysis frequency**: Weekly only (Sundays), not daily or real-time
- **AI cost control**: Daily token budget per teacher (Free: 0, Basic: 5K, Pro: 20K, Center: 50K)

### 12. Teacher & Assistant AI Workflows
- **Attendance**: Real-time sync between teacher and assistant. Assistant marks, teacher sees live.
- **Grades**: AI does question-level analysis (if teacher provides notes) and cross-group comparison
- **Report comments**: AI sees data (grades, attendance, trends) NOT exam content. Tiered quality: Basic=data summary, Pro=trend analysis, Center=teacher notes + AI
- **Report approval**: AI generates, assistant/teacher reviews and approves before sending to parent
- **Parent queries**: Basic=auto-response, Pro=AI drafts sent to teacher for approval, Center=full auto + escalation
- **Weekly digest**: Highlights + action items (not just data). Sent Sundays at 8 AM.
- **Automation**: Auto-reminders before exams, auto-attendance warnings, auto-report generation
- **What AI CAN'T see**: Exam papers, question content, student answers, what was taught

### 14. Admin Panel, Payments & Telemetry
- **Admin app:** Separate Next.js project (admin.nabeeh.com), separate Vercel deployment
- **Admin access:** Small team (invite-based), 3 roles: super_admin, support_agent, viewer
- **User management:** Teacher list, detail view, bulk actions, export CSV
- **Subscription management:** Manual tier changes, trial extension, suspension, cancellation
- **Payments:** Manual logging (Vodafone Cash, InstaPay, Paymob, cash). Receipt upload to Supabase Storage. Admin verifies/rejects.
- **Payment flow:** Teacher pays → sends receipt → admin reviews → verifies → subscription activated
- **Telemetry:** Full analytics — MRR, user growth, feature adoption, AI usage, WhatsApp volume
- **Per-teacher metrics:** Students, attendance records, grades, WhatsApp messages, Gemini tokens, storage
- **System health:** WhatsApp connection, API response times, DB health, Gemini usage
- **Support tools:** Manual overrides, impersonate (read-only), send notifications, support tickets
- **AI usage log:** Track token consumption per teacher per feature per day
- **Security:** Service-role key in admin only, separate auth tokens, all admin actions audited
- **Cost:** ~$0-10/mo additional (shares infrastructure with main app)

### 15. Student Data Import
- **4 methods:** Manual entry, Excel/CSV import, copy-paste from Excel, student self-registration via WhatsApp
- **No OCR:** Photo extraction skipped (unreliable)
- **Excel import:** Auto-detect columns by header name (supports Arabic headers)
- **Validation:** Preview table before import. Shows ready/warning/error rows. Teacher confirms before importing.
- **Configurable required fields:** Teacher toggles which fields are required (name + code always required)
- **Self-registration:** Teacher generates link → student fills web form → auto-enrolled in group
- **Student code auto-generation:** Format `{group_prefix}-{sequence}` for self-registered students
- **Parent data:** Teacher choice — import with students or add later
- **Import history:** Track all imports with success/failure counts

### 16. Deployment
- **Start with**: Vercel (frontend) + Railway (backend) — $10-20/mo
- **Scale to**: VPS (Hetzner) when revenue justifies — $5-15/mo
- **Key constraint**: Baileys needs persistent Node.js process (eliminates serverless)
- **Full comparison**: `docs/deployment-comparison.md`

### 17. LLM Cost Optimization
- **Pattern matching first**: 60-70% of queries are simple lookups (attendance, grades, schedule) — no LLM needed
- **Hybrid strategy**: Small model (Qwen 3 8B / SILMA Kashif 2B) for simple analysis, Gemini for complex tasks
- **Self-hosted option**: Qwen 3 8B on CPU via Ollama — $0/mo, 10-30 sec response
- **Fallback chain**: pattern matching → small model → Gemini (if small model fails)
- **Phase 1**: Launch with Gemini only (~$10-30/mo for 100 teachers)
- **Phase 2**: Add self-hosted small model for simple queries (month 3-6)
- **Phase 3**: Scale GPU or stay with Gemini based on actual usage
- **Full analysis**: `docs/llm-cost-optimization.md`

### 13. Monetization
- **Tiers**: Free / Basic EGP 99/mo / Pro EGP 249/mo / Center EGP 599/mo
- **Break-even**: ~15 Basic or ~7 Pro users
- **Payment**: Vodafone Cash + Fawry first, credit cards later
- **Full analysis**: `docs/monetization-pricing.md`

### 14. Onboarding UX
- **Mandatory**: Only profile setup (name, subjects)
- **Semi-mandatory**: WhatsApp setup (persistent banner)
- **Demo data**: Pre-loaded on first login (15 students, 3 groups, attendance, grades)
- **Auto-remove**: Demo data clears when first real data is created
- **Progressive unlock**: Features unlock as teacher uses the platform
- **Progress bar**: Dismissable, reappears after 7 days, hides after 3 dismissals
- **Full spec**: `docs/onboarding-ux-flow.md`

---

## Edge Cases Identified

1. **Deactivation is per-teacher**: Assistant linked to A and B — deactivating from A doesn't affect B
2. **Subscription expiry**: All assistants auto-deactivated. Reactivate on renewal.
3. **Invite to existing user**: Assistant logs in with existing credentials, accepts invite
4. **Concurrent lock conflict**: Second person sees "Locked by [name]" and can't edit
5. **Teacher removes active assistant**: Next API call fails 403. Locks cleaned up.
6. **Bot pause conflict**: Both teacher and assistant can resume bot. Last action wins.
7. **Many teachers in dropdown**: Needs search/scroll for 5+ teachers
8. **Google email mismatch**: Strict — different email = invite doesn't link
9. **Existing account + Google login**: Auto-links if same email
10. **Demo data stale**: Auto-removes when teacher creates first real data
11. **Progress bar annoyance**: Hides after 3 dismissals, reappears after 7 days
12. **Gemini cost overrun**: Per-teacher daily token budget based on tier

---

## Schema Changes Required (New Migration)

```sql
-- 1. Teacher-Assistant junction
CREATE TABLE teacher_assistants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  assistant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permissions JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'deactivated')),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, assistant_id)
);

-- 2. Pending invites
CREATE TABLE assistant_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  permissions JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Attendance locks
CREATE TABLE attendance_locks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  locked_by UUID NOT NULL REFERENCES auth.users(id),
  locked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);

-- 4. Audit log
CREATE TABLE action_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('teacher', 'assistant')),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Add columns to conversations for bot handoff
ALTER TABLE conversations ADD COLUMN last_responder_id UUID;
ALTER TABLE conversations ADD COLUMN last_responder_type TEXT
  CHECK (last_responder_type IN ('teacher', 'assistant', 'bot'));
ALTER TABLE conversations ADD COLUMN bot_paused_until TIMESTAMPTZ;

-- 6. Add notification/lock settings to teacher_settings
ALTER TABLE teacher_settings ADD COLUMN notification_preferences JSONB
  DEFAULT '{"attendance_marked": true, "grade_entered": true, "whatsapp_sent": true}';
ALTER TABLE teacher_settings ADD COLUMN lock_timeout_minutes INT DEFAULT 5;
ALTER TABLE teacher_settings ADD COLUMN bot_pause_hours INT DEFAULT 4;

-- 7. Add is_demo flag for onboarding demo data
ALTER TABLE students ADD COLUMN is_demo BOOLEAN DEFAULT false;
ALTER TABLE offerings ADD COLUMN is_demo BOOLEAN DEFAULT false;
ALTER TABLE groups ADD COLUMN is_demo BOOLEAN DEFAULT false;
ALTER TABLE enrollments ADD COLUMN is_demo BOOLEAN DEFAULT false;
ALTER TABLE attendance ADD COLUMN is_demo BOOLEAN DEFAULT false;
ALTER TABLE assessments ADD COLUMN is_demo BOOLEAN DEFAULT false;
ALTER TABLE grades ADD COLUMN is_demo BOOLEAN DEFAULT false;
ALTER TABLE parents ADD COLUMN is_demo BOOLEAN DEFAULT false;
```

---

## What the Next Agent Should Do

### Database
1. Create migration `database/migrations/003_assistants_and_locks.sql` with all new tables + ALTERs

### Backend — Auth & Assistants
2. Update `backend/middleware/auth.js` to resolve assistant JWT → teacher_id + permissions
3. Create `backend/routes/assistants.js` (invite, accept, list, update permissions, deactivate, remove)
4. Add permission-checking middleware for assistant-restricted routes

### Backend — Attendance Locks
5. Create `backend/routes/attendance.js` lock endpoints (acquire, release, check)

### Backend — Audit Log
6. Add `action_audit_log` writes to existing routes (attendance, grades, students, WhatsApp)

### Backend — WhatsApp
7. Update WhatsApp bot to respect `bot_paused_until` on conversations
8. Implement auto-pause on human message send

### Backend — Google Auth
9. Configure Supabase Google OAuth provider (Google Client ID/Secret)
10. Implement account linking logic in `backend/routes/auth.js`

### Frontend — Auth
11. Add Google sign-in button to login and register pages
12. Handle OAuth callback and account linking

### Frontend — Onboarding
13. Build profile setup wizard (mandatory after first login)
14. Build guided tour component (4-step overlay)
15. Build progress bar (top of dashboard, dismissable)
16. Create demo data seed script
17. Implement demo data auto-removal on first real data

### Frontend — Assistants
18. Build AssistantManager, InviteForm, TeacherSwitcher components
19. Build AttendanceLockIndicator component

### Frontend — Feature Gating
20. Implement progressive unlock in sidebar (dim + lock icon)
21. Build empty state components for each page
22. Build WhatsApp setup banner (persistent, dismissable)

### Frontend — AI Features
23. Build report generation UI (on-demand + scheduled)
24. Build alert configuration UI (thresholds)
25. Build notification preferences UI
26. Build weekly digest display component
27. Build AI comment approval flow (teacher reviews AI draft before send)
28. Build grade analysis dashboard (cross-group comparison, at-risk students)
29. Build session anomaly indicator (unusual attendance pattern)

### Admin App (Separate Project)
30. Set up admin Next.js project with Supabase service-role client
31. Build admin auth (login, role check, middleware)
32. Build teacher list view (search, filter, sort, bulk actions)
33. Build teacher detail view (profile, subscription, usage, activity log)
34. Build subscription management (change tier, extend trial, suspend, cancel)
35. Build payment logging (create, verify, reject, receipt upload)
36. Build payment queue (pending payments view)
37. Build platform metrics dashboard (MRR, user growth, feature adoption)
38. Build per-teacher usage stats
39. Build AI usage tracking dashboard
40. Build system health dashboard (WhatsApp, API, DB, Gemini)
41. Build support tools (manual overrides, impersonate, send notification)
42. Build support ticket system
43. Create `admin_users`, `subscriptions`, `payments`, `ai_usage_log`, `support_tickets`, `admin_audit_log` tables

### Student Import System
44. Create CSV/Excel upload endpoint with column auto-detection
45. Implement validation pipeline (required fields, format, uniqueness)
46. Create self-registration link generation + web form endpoints
47. Build `StudentImportModal`, `FileUploadZone`, `ColumnMapper`, `ImportPreviewTable` components
48. Build `SelfRegistrationLink` and `SelfRegistrationForm` components
49. Build `RequiredFieldsConfig` settings component
50. Add import button and paste-from-Excel textarea to Students page

---

## Suggested Skills

- `supabase` — migration and RLS work
- `tdd` — testing lock mechanism and permission checks
- `improve-codebase-architecture` — integrating audit logging across routes
- `hallmark` — onboarding UX design and empty states
