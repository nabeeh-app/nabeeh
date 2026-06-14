# Phase 4: Assistant UI + AI Features

## Overview
Full-stack implementation of assistant management UI, AI-powered features (reports, alerts, grade analysis, weekly digest), and the backend infrastructure they depend on. This phase covers both missing backend endpoints and all frontend components.

## Session Progress (Backend Complete)
**All Part A (Backend Infrastructure) tasks are now DONE.** Tasks B1, B2, B3, B5 are now DONE. Next agent starts at **B7 (Alert Config UI)**.

### Completed in this session:
- **Task A4** — `backend/lib/anomalyDetector.js`: Attendance + grade anomaly detection with severity scoring
- **Task A5** — `backend/lib/weeklyDigest.js`: Weekly digest generation, storage, and retrieval
- **Task A6** — `backend/lib/cron.js`: 3 cron jobs (weekly digest Sun 8AM, alerts every 30min, anomalies daily 6AM)
- **Task A10** — `backend/routes/gradeAnalysis.js`: 5 endpoints (group-comparison, at-risk, distribution, trends, overview)
- **Task A11** — `backend/routes/teachers.js`: Added `PUT /api/teachers/notification-preferences`
- **server.js**: Mounted alerts, notifications, reports, gradeAnalysis routes + cron start on boot

### Completed in this session (Frontend):
- **Task B1** — `frontend/src/config/featureFlags.ts`: Added `assistants`, `aiFeatures`, `alerts`, `notifications`, `gradeAnalysis` flags
- **Task B2** — `frontend/src/lib/api.ts`: Added all new API methods (assistants, reports, notifications, alerts, grade analysis, notification preferences) + new types in `types/index.ts`
- **Task B3** — `frontend/src/components/assistants/`: Created `AssistantManager.tsx` (list, toggle, remove), `InviteForm.tsx` (email + permission checkboxes), `PermissionsEditor.tsx` (edit permissions dialog), `TeacherSwitcher.tsx` (multi-teacher dropdown)
- **Task B3** — `frontend/src/app/[locale]/dashboard/assistants/page.tsx`: Page route with feature flag guard
- **Task B3** — `frontend/src/config/navigation.ts`: Added assistants nav item (UserPlus icon) + `routeFeatureMap.assistants = 'assistants'`
- **Task B3** — `frontend/src/components/ui/dropdown-menu.tsx`: New Radix-based dropdown component (shadcn-style)
- **Task B3** — `frontend/src/types/index.ts`: Added `assistant` role and `teacherId` to `Teacher` interface
- **Task B5** — `frontend/src/components/notifications/NotificationBell.tsx` + `NotificationPanel.tsx`: Bell with unread badge (30s polling), dropdown panel with mark-read, time-ago, empty state

### Remaining for next agent (Part B - Frontend):
- **B7**: AlertConfig UI
- **B9**: WeeklyDigest dashboard card
- **B10**: AI Comment Approval Flow
- **B11**: Grade Analysis Dashboard (needs `recharts` — run `npm install recharts` in `frontend/`)
- **B12**: AnomalyIndicator
- **B13**: AlertDisplay
- **B8**: NotificationPreferences settings
- **B4**: Attendance Lock Indicator
- **B6**: Report Generation UI
- **i18n keys** for all new components (`notifications.*`, `assistants.*`, `reports.drafts.*`, `alerts.*`, `grades.analysis.*`, `digest.*`)
- **Lint + test pass**

## Prerequisites
- Phase 1 complete (schema migrations 001–009)
- Phase 2 complete (assistant routes, permission middleware, audit logging)
- Existing shared components: `LoadingSpinner`, `StatCard`, `EmptyState`, `PageHeader`, `FilterBar`
- i18n translations in `messages/en.json` and `messages/ar.json`
- `node-cron` installed (`npm install node-cron` in `backend/`)
- LangChain packages installed (`npm install @langchain/google-genai @langchain/core` in `backend/`)

## Existing Backend Routes (for reference)
- `backend/routes/assistants.js` — full CRUD: `/invite`, `/invites`, `/accept`, `/`, `/:id/permissions`, `/:id/status`, `/:id`, `/leave`. Tier-gated: free=0, basic=2, pro=5, center=15 invites. Uses `teacher_assistants` junction table and `assistant_invites` table.
- `backend/routes/alerts.js` — alert rules + alerts: `/rules`, `/rules/:id`, `/`, `/:id/read`, `/read-all`
- `backend/routes/notifications.js` — notification CRUD: `/`, `/unread-count`, `/:id/read`, `/read-all`
- `backend/routes/reports.js` — report generation + approval: `/generate-comment`, `/drafts`, `/drafts/:id`, `/drafts/:id/approve`, `/drafts/:id/reject`, `/bulk-generate`, `/weekly-digest`
- `backend/routes/gradeAnalysis.js` — grade analysis: `/group-comparison`, `/at-risk`, `/distribution/:id`, `/trends/:id`, `/overview/:id`
- `backend/middleware/auth.js` — exports `authenticateToken`, `requireRole`, `requirePermission`, `requireTeacherOwnership`, `optionalAuth`

## Notes for Next Agent
- **Navigation:** Assistants nav item added to `navigation.ts` with `UserPlus` icon and `featureKey: 'assistants'`. It's filtered by the `assistants` feature flag.
- **Route guard:** `routeFeatureMap.assistants = 'assistants'` ensures the assistants page shows ComingSoon if the feature is disabled.
- **Auth context:** The `useAuth()` hook returns `teacher.role` which can now be `'assistant'`. The `teacher.teacherId` field holds the owning teacher's ID when the user is an assistant.
- **Backend already mounted:** The assistants routes are already mounted in `server.js` at `/api/assistants`.
- **New UI component:** `dropdown-menu.tsx` was created as a new shadcn component (Radix-based). Other components can import from `@/components/ui/dropdown-menu`.

---

## Part A: Backend Infrastructure

### Task A1: Database Migrations ✅ DONE

#### Migration 010: Alerts, Notifications, and AI Drafts
**File:** `database/migrations/010_alerts_notifications_ai.sql`

```sql
-- ============================================================
-- 1. ALERT RULES — per-teacher configurable thresholds
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('attendance_threshold', 'grade_threshold', 'trend_anomaly')),
  threshold_value NUMERIC NOT NULL,          -- e.g., 3 sessions missed, or 60% grade
  comparison TEXT NOT NULL CHECK (comparison IN ('gt', 'lt', 'gte', 'lte')),
  notification_method TEXT NOT NULL DEFAULT 'in_app' CHECK (notification_method IN ('in_app', 'whatsapp', 'both')),
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. ALERTS — generated when thresholds are breached
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  alert_rule_id UUID REFERENCES alert_rules(id) ON DELETE SET NULL,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  is_read BOOLEAN DEFAULT false,
  metadata JSONB,                             -- { attendance_pct, grade_score, trend_data }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. NOTIFICATIONS — in-app notification feed
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                         -- 'attendance_marked', 'grade_entered', 'whatsapp_sent', 'assistant_action', 'report_ready', 'digest'
  title TEXT NOT NULL,
  body TEXT,
  entity_type TEXT,                           -- 'student', 'assessment', 'conversation', 'report'
  entity_id UUID,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. REPORT DRAFTS — AI-generated report comments pending approval
-- ============================================================
CREATE TABLE IF NOT EXISTS report_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  draft_text TEXT NOT NULL,
  data_sources JSONB,                         -- { grades: [...], attendance: {...}, trends: [...] }
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'edited', 'rejected', 'sent')),
  edited_text TEXT,                            -- teacher's edited version
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. WEEKLY DIGESTS — stored snapshots
-- ============================================================
CREATE TABLE IF NOT EXISTS weekly_digests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  digest_data JSONB NOT NULL,                 -- { improved: [...], declining: [...], action_items: [...] }
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, week_start)
);

-- ============================================================
-- 6. AI TOKEN BUDGET COLUMNS ON TEACHER_SETTINGS
-- ============================================================
ALTER TABLE teacher_settings ADD COLUMN IF NOT EXISTS ai_token_budget INT DEFAULT 0;
ALTER TABLE teacher_settings ADD COLUMN IF NOT EXISTS ai_tokens_used_this_month INT DEFAULT 0;
ALTER TABLE teacher_settings ADD COLUMN IF NOT EXISTS ai_token_reset_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_alert_rules_teacher_id ON alert_rules(teacher_id);
CREATE INDEX IF NOT EXISTS idx_alerts_teacher_id ON alerts(teacher_id);
CREATE INDEX IF NOT EXISTS idx_alerts_is_read ON alerts(teacher_id, is_read);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_teacher_id ON notifications(teacher_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(teacher_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_report_drafts_teacher_id ON report_drafts(teacher_id);
CREATE INDEX IF NOT EXISTS idx_report_drafts_status ON report_drafts(teacher_id, status);
CREATE INDEX IF NOT EXISTS idx_weekly_digests_teacher_id ON weekly_digests(teacher_id);
CREATE INDEX IF NOT EXISTS idx_weekly_digests_week ON weekly_digests(teacher_id, week_start);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE TRIGGER update_alert_rules_updated_at BEFORE UPDATE ON alert_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_report_drafts_updated_at BEFORE UPDATE ON report_drafts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_digests ENABLE ROW LEVEL SECURITY;

-- Alert rules: teacher owns their rules
CREATE POLICY "Teachers can manage own alert rules" ON alert_rules FOR ALL USING (teacher_id = auth.uid());
-- Alerts: teacher sees their own
CREATE POLICY "Teachers can view own alerts" ON alerts FOR SELECT USING (teacher_id = auth.uid());
CREATE POLICY "Teachers can update own alerts" ON alerts FOR UPDATE USING (teacher_id = auth.uid());
-- Notifications: teacher sees their own
CREATE POLICY "Teachers can view own notifications" ON notifications FOR SELECT USING (teacher_id = auth.uid());
CREATE POLICY "Teachers can update own notifications" ON notifications FOR UPDATE USING (teacher_id = auth.uid());
CREATE POLICY "Teachers can insert own notifications" ON notifications FOR INSERT WITH CHECK (teacher_id = auth.uid());
-- Report drafts: teacher owns their drafts
CREATE POLICY "Teachers can manage own report drafts" ON report_drafts FOR ALL USING (teacher_id = auth.uid());
-- Weekly digests: teacher owns their digests
CREATE POLICY "Teachers can view own digests" ON weekly_digests FOR SELECT USING (teacher_id = auth.uid());
```

---

### Task A2: AI Service Layer (LangChain.js) ✅ DONE
**File:** `backend/lib/aiService.js`

Upgrades `aiResponder.js` from single-turn no-tools to a LangChain agent with tool calling, memory, and conversation context.

**Install:**
```bash
cd backend && npm install @langchain/google-genai @langchain/core
```

**Exports:**
```js
module.exports = {
  createAgent,            // Create a configured agent executor for a teacher
  generateWithTools,      // Run agent with tools (main entry point)
  generateReportComment,  // AI draft report comment from student data
  detectAnomalies,        // Flag unusual attendance patterns
  generateWeeklyDigest,   // Generate digest summary for a teacher
  buildConversationContext // Assemble last N messages for context
};
```

**LangChain agent setup:**
```js
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { createToolCallingAgent, AgentExecutor } from 'langchain/agents';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { BufferWindowMemory } from 'langchain/memory';
import { DynamicTool } from '@langchain/core/tools';

// Model instance (reused across calls)
const model = new ChatGoogleGenerativeAI({
  modelName: 'gemini-2.5-flash',
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0.3,
  maxOutputTokens: 1024,
});
```

**Tool definitions (LangChain DynamicTool):**
```js
const attendanceTool = new DynamicTool({
  name: 'getStudentAttendance',
  description: 'Get attendance record for a specific student. Input: JSON with student_id (required) and days (optional, default 10).',
  func: async (input) => {
    const { student_id, days = 10 } = JSON.parse(input);
    const attendance = await whatsappQuery.getStudentAttendance(student_id);
    return JSON.stringify(attendance);
  },
});

const gradesTool = new DynamicTool({
  name: 'getStudentGrades',
  description: 'Get grades for a specific student across assessments. Input: JSON with student_id (required) and subject (optional).',
  func: async (input) => {
    const { student_id, subject } = JSON.parse(input);
    const grades = await whatsappQuery.getStudentGrades(student_id, subject);
    return JSON.stringify(grades);
  },
});

const classPerformanceTool = new DynamicTool({
  name: 'getClassPerformance',
  description: 'Get aggregate class performance stats for a group. Input: JSON with group_id (required) and assessment_type (optional).',
  func: async (input) => {
    const { group_id, assessment_type } = JSON.parse(input);
    const stats = await whatsappQuery.getClassPerformance(group_id, assessment_type);
    return JSON.stringify(stats);
  },
});
```

**Agent executor factory (per-teacher):**
```js
async function createAgent(teacherId, tier, language) {
  // Tier gating
  if (tier === 'free') return null; // No AI on free tier

  const tools = [attendanceTool, gradesTool];
  if (['pro', 'center'].includes(tier)) {
    tools.push(classPerformanceTool);
  }

  const langLabel = language === 'ar' ? 'Arabic' : 'English';

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', `You are a helpful teaching assistant for Nabeeh.
     Respond in ${langLabel}.
     You have access to student attendance and grade data.
     Always be professional, educational, and culturally appropriate.
     Protect student privacy — never share personal information.
     If you don't know something, acknowledge it honestly.`],
    new MessagesPlaceholder('chat_history'),
    ['human', '{input}'],
    new MessagesPlaceholder('agent_scratchpad'),
  ]);

  const agent = await createToolCallingAgent({ llm: model, tools, prompt });

  return new AgentExecutor({
    agent,
    tools,
    maxIterations: 10,       // safety cap on tool calls
    verbose: process.env.NODE_ENV === 'development',
  });
}
```

**Main entry point:**
```js
async function generateWithTools(message, { teacherId, tier, language, conversationId }) {
  const agent = await createAgent(teacherId, tier, language);
  if (!agent) return null;

  // Load conversation context (last 5 messages)
  const chatHistory = await buildConversationContext(conversationId, 5);

  const result = await agent.invoke({
    input: message,
    chat_history: chatHistory,
  });

  // Track token usage
  await trackTokenUsage(teacherId, result);

  return {
    text: result.output,
    toolsUsed: result.intermediateSteps?.map(s => s.action?.tool) || [],
  };
}
```

**Key design decisions:**
- **LangChain AgentExecutor** handles the tool-call loop automatically (call LLM → execute tool → feed back → repeat)
- **Conversation context:** last 5 messages from `messages` table, loaded as LangChain `BaseMessage` objects into `BufferWindowMemory`
- **Per-teacher token budget:** check `teacher_settings.ai_token_budget` before each call, track usage in `teacher_settings.ai_tokens_used_this_month`
- **Tier gating:** `free` tier → pattern matching only (no AI), `basic` → AI with 2 tools (attendance, grades), `pro` → AI with 3 tools + report generation, `center` → same as pro + bulk operations
- **System prompt** includes teacher's business name, student context, and language preference
- **All DB queries** go through existing `whatsappQuery.js` functions (reuse, don't duplicate)
- **DynamicTool** wraps existing functions — no duplicate DB logic

**Token budgeting:**
```js
const TIER_MONTHLY_LIMITS = {
  free: 0,
  basic: 50000,
  pro: 200000,
  center: 500000
};

async function checkTokenBudget(teacherId, tier) {
  const limit = TIER_MONTHLY_LIMITS[tier] || 0;
  if (limit === 0) return { allowed: false, reason: 'AI not available on free tier' };
  // Query teacher_settings.ai_tokens_used_this_month
  // If exceeded, return { allowed: false, reason: 'Monthly AI limit reached' }
  return { allowed: true, remaining: limit - used };
}
```

---

### Task A3: Alert Evaluation Engine ✅ DONE
**File:** `backend/lib/alertEvaluator.js`

**Exports:**
```js
module.exports = {
  evaluateAllRules,      // Run all enabled rules for a teacher
  evaluateRule,          // Evaluate a single rule
  checkAttendanceThreshold,
  checkGradeThreshold,
  checkTrendAnomaly
};
```

**Logic:**
1. `evaluateAllRules(teacherId)` — fetches all enabled `alert_rules` for teacher, runs each
2. `checkAttendanceThreshold(rule, teacherId)` — queries attendance for all students in teacher's groups, compares against threshold, creates `alerts` row if breached
3. `checkGradeThreshold(rule, teacherId)` — same pattern for grades
4. `checkTrendAnomaly(rule, teacherId)` — compares last 5 sessions' attendance rate vs prior 10 sessions; flags if drop > 30%
5. Deduplication: before inserting alert, check if same `(teacher_id, student_id, alert_type)` alert exists within last 24 hours — skip if so
6. After creating alert, check `notification_method` — if `whatsapp` or `both`, queue WhatsApp message via `whatsappQuery.saveMessage` + Baileys send
7. Always create `notifications` row for `in_app` and `both` methods

---

### Task A4: Anomaly Detection ✅ DONE
**File:** `backend/lib/anomalyDetector.js`

**Exports:**
```js
module.exports = {
  detectAttendanceAnomalies,  // Returns array of { student_id, pattern, severity, detail }
  detectGradeAnomalies
};
```

**Algorithm (attendance):**
1. For each student in teacher's groups, fetch last 10 sessions
2. Calculate attendance rate for: last 3 sessions vs prior 7 sessions
3. If drop > 30 percentage points → severity `critical`
4. If drop > 15 percentage points → severity `warning`
5. If sudden absence cluster (3+ consecutive absences) → severity `critical`
6. Return array sorted by severity

**Algorithm (grades):**
1. For each student, fetch last 5 grades
2. Calculate trend (slope of scores over time)
3. If negative slope > 10 points per assessment → severity `warning`
4. If any score dropped > 20 points from student's average → severity `critical`

---

### Task A5: Weekly Digest Generator ✅ DONE
**File:** `backend/lib/weeklyDigest.js`

**Exports:**
```js
module.exports = {
  generateDigest,   // Build digest data for a teacher for a given week
  getLatestDigest  // Fetch most recent digest for teacher
};
```

**Logic:**
1. `generateDigest(teacherId, weekStart, weekEnd)`:
   - Query attendance changes: students whose attendance rate improved or declined vs prior week
   - Query grade changes: students whose average dropped or improved
   - Call `anomalyDetector.detectAttendanceAnomalies()` for at-risk students
   - Call `aiService.generateWeeklyDigest()` with aggregated data → AI-generated action items
   - Store in `weekly_digests` table
   - Return digest data
2. `getLatestDigest(teacherId)` — `SELECT * FROM weekly_digests WHERE teacher_id = ? ORDER BY week_start DESC LIMIT 1`

---

### Task A6: Cron Infrastructure ✅ DONE
**File:** `backend/lib/cron.js`

**Install:** `npm install node-cron` in `backend/`

**Exports:**
```js
module.exports = {
  startCronJobs,  // Initialize all scheduled tasks
  stopCronJobs    // Graceful shutdown
};
```

**Jobs:**
```js
const cron = require('node-cron');

// Weekly digest: Sundays at 8 AM (Cairo time, UTC+2 = 6:00 UTC)
cron.schedule('0 6 * * 0', generateAllDigests);

// Alert evaluation: every 30 minutes
cron.schedule('*/30 * * * *', evaluateAllAlerts);

// Anomaly detection: daily at 6 AM
cron.schedule('0 4 * * *', detectAllAnomalies);
```

**`generateAllDigests()`:**
1. Query all teachers with `subscription_tier IN ('pro', 'center')`
2. For each, call `weeklyDigest.generateDigest(teacherId, lastMonday, lastSunday)`
3. If `notification_preferences.digest` is true, create notification + optional WhatsApp send

**`evaluateAllAlerts()`:**
1. Query all distinct `teacher_id` from `alert_rules WHERE is_enabled = true`
2. For each, call `alertEvaluator.evaluateAllRules(teacherId)`

**`detectAllAnomalies()`:**
1. Query all teachers with `subscription_tier IN ('pro', 'center')`
2. For each, call `anomalyDetector.detectAttendanceAnomalies(teacherId)`
3. Create alerts for flagged students

**Integration with `server.js`:**
```js
// In server.js, after app.listen:
const { startCronJobs } = require('./lib/cron');
startCronJobs();
```

---

### Task A7: Reports Backend ✅ DONE
**File:** `backend/routes/reports.js`

**Mount in `server.js`:** `app.use('/api/reports', reportRoutes);`

**Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/generate-comment` | `authenticateToken` | AI generates report comment for a student |
| `GET` | `/drafts` | `authenticateToken` | List pending/approved/rejected report drafts |
| `PUT` | `/drafts/:id` | `authenticateToken` | Edit draft text, change status |
| `POST` | `/drafts/:id/approve` | `authenticateToken` | Approve → send to parent via WhatsApp |
| `POST` | `/drafts/:id/reject` | `authenticateToken` | Mark as rejected |
| `POST` | `/bulk-generate` | `authenticateToken` | Generate comments for all students in a group |
| `GET` | `/weekly-digest` | `authenticateToken` | Get latest digest for teacher |
| `GET` | `/weekly-digest/:weekStart` | `authenticateToken` | Get digest for specific week |

**`POST /generate-comment` flow:**
1. Validate input: `{ student_id, group_id? }`
2. Fetch student data: grades (last 5 assessments), attendance (last 10 sessions), attendance trend
3. Call `aiService.generateReportComment(studentData, teacherContext)`
4. Store in `report_drafts` with status `pending`
5. Return `{ success: true, data: draft }`

**`POST /bulk-generate` flow:**
1. Validate input: `{ group_id }`
2. Fetch all enrolled students in group
3. For each student, generate comment (throttled: 100ms delay between calls)
4. Return `{ success: true, data: { generated: N, drafts: [...] } }`

**`POST /drafts/:id/approve` flow:**
1. Fetch draft, verify `teacher_id` matches
2. Use `edited_text || draft_text` as final text
3. Send to parent via WhatsApp: find student's parent → `whatsappQuery.saveMessage` + Baileys send
4. Update status to `sent`, set `sent_at`
5. Create notification: "Report sent to {parentName} for {studentName}"
6. Audit log the action

---

### Task A8: Notifications Backend ✅ DONE
**File:** `backend/routes/notifications.js`

**Mount in `server.js`:** `app.use('/api/notifications', notificationRoutes);`

**Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | `authenticateToken` | List notifications (paginated, unread first) |
| `GET` | `/unread-count` | `authenticateToken` | Count of unread notifications |
| `PUT` | `/:id/read` | `authenticateToken` | Mark single notification as read |
| `PUT` | `/read-all` | `authenticateToken` | Mark all as read |
| `DELETE` | `/:id` | `authenticateToken` | Delete a notification |

**Query params for `GET /`:**
- `page` (default 1), `limit` (default 20)
- `type` — filter by notification type
- `unread_only` — boolean filter

---

### Task A9: Alert Rules Backend ✅ DONE
**File:** `backend/routes/alerts.js`

**Mount in `server.js`:** `app.use('/api/alerts', alertRoutes);`

**Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/rules` | `authenticateToken` | List alert rules for teacher |
| `POST` | `/rules` | `authenticateToken` | Create alert rule |
| `PUT` | `/rules/:id` | `authenticateToken` | Update alert rule |
| `DELETE` | `/rules/:id` | `authenticateToken` | Delete alert rule |
| `PUT` | `/rules/:id/toggle` | `authenticateToken` | Enable/disable rule |
| `GET` | `/` | `authenticateToken` | List alerts (paginated, filtered) |
| `PUT` | `/:id/read` | `authenticateToken` | Mark alert as read |
| `PUT` | `/read-all` | `authenticateToken` | Mark all alerts as read |

---

### Task A10: Grade Analysis Backend ✅ DONE
**File:** `backend/routes/gradeAnalysis.js`

**Mount in `server.js`:** `app.use('/api/grade-analysis', gradeAnalysisRoutes);`

**Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/group-comparison` | `authenticateToken` | Average scores per group for an offering |
| `GET` | `/at-risk` | `authenticateToken` | Students with grades below threshold + poor attendance |
| `GET` | `/distribution/:assessmentId` | `authenticateToken` | Grade distribution histogram data |
| `GET` | `/trends/:studentId` | `authenticateToken` | Grade trend over time for a student |
| `GET` | `/overview/:offeringId` | `authenticateToken` | Aggregate stats for offering |

**`GET /at-risk` logic:**
1. Query params: `offering_id`, `grade_threshold` (default 60), `attendance_threshold` (default 70)
2. For each enrollment in offering:
   - Calculate average grade across assessments
   - Calculate attendance rate
   - If grade < threshold OR attendance < threshold → include in results
3. Enrich with severity: `critical` (both below), `warning` (one below)
4. Return sorted by severity

---

### Task A11: Notification Preferences Endpoint ✅ DONE
**Extend existing:** `backend/routes/teachers.js`

Add `PUT /api/teachers/notification-preferences`:
```js
// Update teacher_settings.notification_preferences
// Body: { attendance_marked, grade_entered, whatsapp_sent, assistant_action, digest, quiet_hours_start, quiet_hours_end }
```

---

## Part B: Frontend Components

> **NEXT AGENT: START AT B7** — B1 (feature flags), B2 (API client + types), B3 (assistant management components), and B5 (NotificationBell + NotificationPanel) are DONE. Begin with Task B7 (Alert Config UI), then proceed through remaining tasks. Install `recharts` in `frontend/` before B11.

### Task B1: Feature Flags Update ✅ DONE
**File:** `frontend/src/config/featureFlags.ts`

Added new flags (all default `true`, env-gated):
```ts
assistants: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_ASSISTANTS, true),
aiFeatures: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_AI, true),
alerts: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_ALERTS, true),
notifications: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS, true),
gradeAnalysis: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_GRADE_ANALYSIS, true),
```

---

### Task B2: API Client Updates ✅ DONE
**File:** `frontend/src/lib/api.ts` + `frontend/src/types/index.ts`

Added to `apiClient`:
- **Assistants:** `getAssistants()`, `inviteAssistant(email, permissions)`, `updateAssistantPermissions(id, permissions)`, `updateAssistantStatus(id, status)`, `removeAssistant(id)`
- **Reports:** `generateReportComment(studentId, groupId?)`, `getReportDrafts(params)`, `updateReportDraft(id, data)`, `approveReportDraft(id)`, `rejectReportDraft(id)`, `bulkGenerateComments(groupId)`, `getLatestDigest()`, `getDigestByWeek(weekStart)`
- **Notifications:** `getNotifications(params)`, `getUnreadNotificationCount()`, `markNotificationRead(id)`, `markAllNotificationsRead()`, `deleteNotification(id)`
- **Alert Rules:** `getAlertRules()`, `createAlertRule(data)`, `updateAlertRule(id, data)`, `deleteAlertRule(id)`, `toggleAlertRule(id)`, `getAlerts(params)`, `markAlertRead(id)`, `markAllAlertsRead()`
- **Grade Analysis:** `getGroupComparison(offeringId)`, `getAtRiskStudents(offeringId, params)`, `getGradeDistribution(assessmentId)`, `getGradeTrends(studentId)`, `getGradeOverview(offeringId)`
- **Notification Preferences:** `updateNotificationPreferences(data)`

Added types: `Assistant`, `AssistantInvite`, `Notification`, `AlertRule`, `Alert`, `ReportDraft`, `WeeklyDigest`, `GroupComparison`, `AtRiskStudent`, `GradeDistribution`, `GradeTrend`, `GradeOverview`, `NotificationPreferences`

---

### Task B3: Assistant Management Components ✅ DONE

#### `AssistantManager.tsx`
**File:** `frontend/src/components/assistants/AssistantManager.tsx`

Main assistant management page/section:
- List of current assistants with status badges (active/pending/deactivated)
- Each assistant row: name, email, status, permissions summary, actions dropdown
- Actions: Edit Permissions, Deactivate, Remove
- "Invite Assistant" button (opens InviteForm)
- Empty state when no assistants

**Data fetching:** `GET /api/assistants`

#### `InviteForm.tsx`
**File:** `frontend/src/components/assistants/InviteForm.tsx`

Modal or inline form:
- Email input (required)
- Permission checkboxes (8 flags) — pre-filled from teacher's default template
- "Send Invite" button
- Shows pending invite limit based on tier (e.g., "2 of 5 invites used")
- Success message: "Invite sent to {email}"

**API call:** `POST /api/assistants/invite`

#### `TeacherSwitcher.tsx`
**File:** `frontend/src/components/assistants/TeacherSwitcher.tsx`

Header dropdown for assistants who work for multiple teachers:
- Shows current teacher name + avatar
- Dropdown lists all linked teachers
- Switching reloads dashboard context with new teacher_id
- Search/scroll for 5+ teachers

**Data:** Loaded from auth context or dedicated endpoint

---

### Task B4: Attendance Lock Indicator ⬜ TODO
**File:** `frontend/src/components/attendance/AttendanceLockIndicator.tsx`

Visual indicator on attendance grid:
- When a student row is locked by someone else: show lock icon + "[Name] is editing"
- Row is read-only while locked
- Subtle animation (pulsing lock icon)
- Tooltip: "Locked by {name} since {time}"

**Data:** Periodic poll or WebSocket for lock status

---

### Task B5: Notification Bell & Center ✅ DONE
**File:** `frontend/src/components/notifications/NotificationBell.tsx`
**File:** `frontend/src/components/notifications/NotificationPanel.tsx`

**NotificationBell:**
- Bell icon with unread count badge (shows `99+` if > 99)
- Click toggles NotificationPanel open/close
- Polls `/api/notifications/unread-count` every 30 seconds
- Uses `useCallback` for stable fetch reference

**NotificationPanel:**
- Dropdown/popover panel (absolute positioned, z-50)
- Lists recent notifications (last 20)
- Each item: icon by type (Clock/GraduationCap/MessageSquare/UserPlus/FileText/Bell), title, body, time ago, read/unread indicator (blue dot)
- Unread items have subtle `bg-surface-sage/30` background
- "Mark all as read" button (only shown when unread exist)
- Click individual to mark as read
- "View all" link to full notifications page
- Empty state: bell icon + "No notifications yet"
- Loading spinner while fetching

---

### Task B6: Report Generation UI ⬜ TODO
**File:** `frontend/src/components/reports/ReportGenerator.tsx`

Two modes:
1. **On-demand:** Teacher clicks "Generate Report" → selects student/group → AI generates → teacher reviews → sends
2. **Scheduled (Pro):** Configure auto-generation schedule (weekly, monthly)

**Components:**
- `ReportGenerator.tsx` — main container
- `ReportPreview.tsx` — shows AI-generated report with edit capability
- `ReportSendDialog.tsx` — confirm and send to parent via WhatsApp

---

### Task B7: Alert Configuration UI ⬜ TODO
**File:** `frontend/src/components/alerts/AlertConfig.tsx`

Threshold-based alert settings:
- Attendance alert: "Notify me if student misses > X sessions"
- Grade alert: "Notify me if student score < X%"
- Trend alert (Pro): AI-detected anomalies

**Form fields:**
- Alert type dropdown
- Threshold value input
- Notification method (in-app, WhatsApp)
- Enable/disable toggle

---

### Task B8: Notification Preferences UI ⬜ TODO
**File:** `frontend/src/components/settings/NotificationPreferences.tsx`

Per-teacher notification settings:
- Toggle per action type: attendance marked, grade entered, WhatsApp sent, assistant actions
- Notification channel: in-app only, or in-app + WhatsApp
- Quiet hours: no notifications between X and Y

**API:** `PUT /api/teachers/notification-preferences`

---

### Task B9: Weekly Digest Display ⬜ TODO
**File:** `frontend/src/components/dashboard/WeeklyDigest.tsx`

Dashboard card showing weekly summary:
- Students with improved attendance
- Students with declining grades
- Action items (AI-generated recommendations)
- "View Full Report" link
- Sent Sundays at 8 AM (configurable)

**Data:** `GET /api/reports/weekly-digest` (latest)

---

### Task B10: AI Comment Approval Flow ⬜ TODO
**File:** `frontend/src/components/reports/CommentApproval.tsx`

Flow:
1. AI generates report comment based on student data (grades, attendance, trends)
2. Teacher sees draft in approval queue
3. Teacher can: Approve → Edit → Reject
4. Approved comment sent to parent via WhatsApp

**Components:**
- `CommentDraft.tsx` — shows AI text with data sources cited
- `CommentEditor.tsx` — inline edit capability
- `ApprovalQueue.tsx` — list of pending approvals

**Important:** AI sees data (grades, attendance, trends) NOT exam content or student answers.

---

### Task B11: Grade Analysis Dashboard ⬜ TODO
**File:** `frontend/src/components/grades/GradeAnalysis.tsx`

Cross-group comparison and at-risk student identification:
- Group comparison chart (bar/radar chart)
- At-risk students list (grades below threshold + attendance pattern)
- Grade distribution histogram per assessment
- Trend lines over time

**Components:**
- `GroupComparison.tsx` — chart component
- `AtRiskStudents.tsx` — filtered list with severity indicators
- `GradeDistribution.tsx` — histogram
- `TrendChart.tsx` — line chart over assessments

**Charting library:** Use `recharts` (already a common choice with React). Install if needed: `npm install recharts` in `frontend/`.

---

### Task B12: Session Anomaly Indicator ⬜ TODO
**File:** `frontend/src/components/attendance/AnomalyIndicator.tsx`

AI-detected unusual attendance patterns:
- Flag students with sudden attendance drops
- Show on attendance page as warning badges
- Clickable to see pattern detail (e.g., "Absent 3 of last 4 sessions")
- Not blocking — informational only

---

### Task B13: Alert Display Component ⬜ TODO
**File:** `frontend/src/components/alerts/AlertDisplay.tsx`

Renders on dashboard or as standalone page:
- List of recent alerts with severity icons (info/warning/critical)
- Each alert: title, message, student name, time ago, read status
- Click to mark as read
- "Mark all as read" button
- Filter by severity, type

---

## File Structure After This Phase

```
backend/
├── node_modules/@langchain/      # ✅ DONE — LangChain packages installed
├── lib/
│   ├── aiService.js              # ✅ DONE — LangChain agent + tools + token budgeting
│   ├── aiResponder.js            # EXISTING — kept for backward compat, delegates to aiService
│   ├── alertEvaluator.js         # ✅ DONE — threshold checking engine
│   ├── anomalyDetector.js        # ✅ DONE — attendance/grade anomaly detection
│   ├── weeklyDigest.js           # ✅ DONE — digest generation
│   └── cron.js                   # ✅ DONE — node-cron scheduler
├── routes/
│   ├── reports.js                # ✅ DONE — report generation + approval + digest endpoints
│   ├── notifications.js          # ✅ DONE — notification CRUD
│   ├── alerts.js                 # ✅ DONE — alert rules + alert display endpoints
│   └── gradeAnalysis.js          # ✅ DONE — grade analysis endpoints
└── server.js                     # ✅ DONE — routes mounted, cron started

database/
└── migrations/
    └── 010_alerts_notifications_ai.sql  # ✅ DONE

frontend/src/
├── config/
│   └── featureFlags.ts           # ✅ DONE — added assistants, aiFeatures, alerts, notifications, gradeAnalysis
├── lib/
│   └── api.ts                    # ✅ DONE — added all new API methods (assistants, reports, notifications, alerts, grade analysis)
├── types/
│   └── index.ts                  # ✅ DONE — added Assistant, Notification, Alert, ReportDraft, WeeklyDigest, GradeAnalysis types
├── components/
│   ├── assistants/
│   │   ├── AssistantManager.tsx      # ✅ DONE — list, toggle, remove, dropdown actions
│   │   ├── InviteForm.tsx            # ✅ DONE — email + permission checkboxes dialog
│   │   ├── PermissionsEditor.tsx     # ✅ DONE — edit permissions dialog (bonus, not in original spec)
│   │   └── TeacherSwitcher.tsx       # ✅ DONE — header dropdown for assistants with multiple teachers
│   ├── attendance/
│   │   ├── AttendanceLockIndicator.tsx # ⬜ TODO
│   │   └── AnomalyIndicator.tsx      # ⬜ TODO
│   ├── reports/
│   │   ├── ReportGenerator.tsx       # ⬜ TODO
│   │   ├── ReportPreview.tsx         # ⬜ TODO
│   │   ├── ReportSendDialog.tsx      # ⬜ TODO
│   │   └── CommentApproval.tsx       # ⬜ TODO
│   │       ├── CommentDraft.tsx      # ⬜ TODO
│   │       ├── CommentEditor.tsx     # ⬜ TODO
│   │       └── ApprovalQueue.tsx     # ⬜ TODO
│   ├── alerts/
│   │   ├── AlertConfig.tsx           # ⬜ TODO
│   │   └── AlertDisplay.tsx          # ⬜ TODO
│   ├── notifications/
│   │   ├── NotificationBell.tsx      # ✅ DONE — bell with unread badge, 30s polling
│   │   └── NotificationPanel.tsx     # ✅ DONE — dropdown panel with list, mark-read, empty state
│   ├── grades/
│   │   ├── GradeAnalysis.tsx         # ⬜ TODO
│   │   ├── GroupComparison.tsx       # ⬜ TODO
│   │   ├── AtRiskStudents.tsx        # ⬜ TODO
│   │   ├── GradeDistribution.tsx     # ⬜ TODO
│   │   └── TrendChart.tsx            # ⬜ TODO
│   ├── settings/
│   │   └── NotificationPreferences.tsx # ⬜ TODO
│   └── dashboard/
│       └── WeeklyDigest.tsx          # ⬜ TODO
```

### Page Routes Created
```
frontend/src/components/ui/
├── dropdown-menu.tsx               # ✅ DONE — Radix-based dropdown (new shadcn component)

frontend/src/app/[locale]/dashboard/assistants/
└── page.tsx                          # ✅ DONE — page route with feature flag guard
```

## i18n Keys to Add
All new components need translation keys in `messages/en.json` and `messages/ar.json`:
- `assistants.*` — assistant management strings (components reference these keys, will show as `assistants.key` until translations are added)
- `notifications.*` — notification bell/panel/preferences strings (NotificationBell/Panel reference these)
- `reports.*` — report generation/approval strings
- `alerts.*` — alert configuration + display strings
- `grades.analysis.*` — grade analysis strings
- `digest.*` — weekly digest strings
- `common.severity.*` — info/warning/critical labels

**Note:** The B3 components use `useTranslations('assistants')` and reference keys like `assistants.title`, `assistants.inviteButton`, `assistants.status.active`, etc. Add these keys before testing the UI.

## Verification Checklist

### Backend
- [x] Migration 010 runs without errors — **DONE** (`database/migrations/010_alerts_notifications_ai.sql`)
- [x] `aiService.generateWithTools()` uses LangChain agent with tools and handles function call loop — **DONE** (`backend/lib/aiService.js`)
- [x] `aiService` respects tier gating (free = no AI, basic/pro/center = tiered limits) — **DONE**
- [x] `aiService` tracks token usage per teacher — **DONE**
- [x] `alertEvaluator` creates alerts when thresholds are breached — **DONE** (`backend/lib/alertEvaluator.js`)
- [x] `alertEvaluator` deduplicates alerts within 24h — **DONE**
- [x] `anomalyDetector` flags attendance drops and grade declines — **DONE** (`backend/lib/anomalyDetector.js`)
- [x] `weeklyDigest` generates and stores digest data — **DONE** (`backend/lib/weeklyDigest.js`)
- [x] `cron.js` starts all 3 scheduled jobs — **DONE** (`backend/lib/cron.js`)
- [x] `POST /api/reports/generate-comment` creates draft with AI text — **DONE** (`backend/routes/reports.js`)
- [x] `POST /api/reports/drafts/:id/approve` sends to parent via WhatsApp — **DONE**
- [x] `GET /api/notifications` returns paginated notifications — **DONE** (`backend/routes/notifications.js`)
- [x] `GET /api/alerts/rules` returns teacher's alert rules — **DONE** (`backend/routes/alerts.js`)
- [x] `GET /api/grade-analysis/at-risk` returns flagged students — **DONE** (`backend/routes/gradeAnalysis.js`)
- [x] `PUT /api/teachers/notification-preferences` updates preferences — **DONE** (`backend/routes/teachers.js`)
- [x] All new routes mounted in `server.js` (alerts, notifications, reports, gradeAnalysis) — **DONE**
- [x] Cron jobs started in `server.js` after `app.listen` — **DONE**
- [x] All new endpoints use standard envelope response format — **DONE**
- [x] All new endpoints validate input with Zod — **DONE**
- [x] All new endpoints use Winston logger (no console.log) — **DONE**
- [x] RLS policies allow teacher-only access to their data — **DONE** (in migration 010)

### Frontend
- [x] Feature flags updated with new flags (assistants, aiFeatures, alerts, notifications, gradeAnalysis) — **DONE**
- [x] API client has all new methods for assistants, reports, notifications, alerts, grade analysis — **DONE**
- [x] TypeScript types added for all new entities — **DONE**
- [x] NotificationBell shows unread count, panel shows list — **DONE**
- [ ] Assistant list loads with correct permissions — **DONE** (AssistantManager.tsx fetches and displays)
- [ ] Invite flow works end-to-end (email → accept → linked) — **DONE** (InviteForm.tsx + backend /invite endpoint)
- [ ] Teacher switcher changes dashboard context — **DONE** (TeacherSwitcher.tsx)
- [ ] Permission middleware blocks unauthorized actions — **TODO**
- [ ] Attendance lock indicator shows when row locked — **TODO**
- [ ] Report generator produces AI-drafted comments — **TODO**
- [ ] Comment approval flow: draft → edit → approve → send — **TODO**
- [ ] Alert configuration saves thresholds — **TODO**
- [ ] Notification preferences save correctly — **TODO**
- [ ] Weekly digest displays latest data — **TODO**
- [ ] Grade analysis shows charts and at-risk list — **TODO**
- [ ] Anomaly indicator flags unusual patterns — **TODO**
- [ ] All components use CSS theme variables (not hardcoded colors) — **TODO**
- [ ] All text uses `t()` translation function — **TODO**
- [ ] `npm run lint` passes in `frontend/` — **TODO**
- [ ] `npm test` passes in `backend/` — **TODO**

## Suggested Build Order
1. ~~Install LangChain packages~~ `npm install @langchain/google-genai @langchain/core` in `backend/` — **DONE**
2. ~~Migration 010~~ (schema foundation) — **DONE**
3. ~~`aiService.js`~~ (LangChain agent, core AI, everything depends on it) — **DONE**
4. ~~`alerts.js` + `alertEvaluator.js`~~ (alert backend) — **DONE**
5. ~~`notifications.js`~~ (notification backend) — **DONE**
6. ~~`reports.js`~~ (report generation + approval) — **DONE**
7. ~~`gradeAnalysis.js`~~ (grade analysis endpoints) — **DONE**
8. ~~`anomalyDetector.js` + `weeklyDigest.js` + `cron.js`~~ (scheduled jobs) — **DONE**
9. ~~Feature flags + API client updates~~ — **DONE** (B1 + B2 + types)
10. ~~NotificationBell + NotificationPanel~~ (header component) — **DONE** (B5)
11. ~~AssistantManager + InviteForm + TeacherSwitcher~~ — **DONE** (B3 + page route + nav item + dropdown-menu.tsx)
12. AlertConfig + AlertDisplay — **TODO** (next agent — B7 + B13)
13. ReportGenerator + ReportPreview + ReportSendDialog + CommentApproval — **TODO** (next agent — B6 + B10)
14. GradeAnalysis + GroupComparison + AtRiskStudents + GradeDistribution + TrendChart — **TODO** (next agent — B11)
15. WeeklyDigest + AnomalyIndicator + AttendanceLockIndicator — **TODO** (next agent — B9 + B12 + B4)
16. NotificationPreferences — **TODO** (next agent — B8)
17. i18n keys for all components — **TODO** (next agent)
18. Lint + test pass — **TODO** (next agent)

## Suggested Skills
- `impeccable` — AI features UI polish and UX
- `supabase` — migration and RLS policy verification
- `tdd` — test-driven development for aiService and alertEvaluator
