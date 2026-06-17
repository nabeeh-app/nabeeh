-- Nabeeh Phase 1: Assistants, Locks, Audit Log, and Demo Flags

-- ============================================================
-- 1. TEACHER-ASSISTANT JUNCTION
-- ============================================================
CREATE TABLE IF NOT EXISTS teacher_assistants (
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

-- ============================================================
-- 2. PENDING INVITES
-- ============================================================
CREATE TABLE IF NOT EXISTS assistant_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  permissions JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. ATTENDANCE LOCKS
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_locks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  locked_by UUID NOT NULL REFERENCES auth.users(id),
  locked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);

-- ============================================================
-- 4. ACTION AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS action_audit_log (
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

-- ============================================================
-- 5. BOT HANDOFF COLUMNS ON CONVERSATIONS
-- ============================================================
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_responder_id UUID;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_responder_type TEXT
  CHECK (last_responder_type IN ('teacher', 'assistant', 'bot'));
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS bot_paused_until TIMESTAMPTZ;

-- ============================================================
-- 6. TEACHER SETTINGS EXTENSIONS
-- ============================================================
ALTER TABLE teacher_settings ADD COLUMN IF NOT EXISTS notification_preferences JSONB
  DEFAULT '{"attendance_marked": true, "grade_entered": true, "whatsapp_sent": true}';
ALTER TABLE teacher_settings ADD COLUMN IF NOT EXISTS lock_timeout_minutes INT DEFAULT 5;
ALTER TABLE teacher_settings ADD COLUMN IF NOT EXISTS bot_pause_hours INT DEFAULT 4;

-- ============================================================
-- 7. DEMO DATA FLAGS FOR ONBOARDING
-- ============================================================
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;
ALTER TABLE offerings ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;
ALTER TABLE grades ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;
ALTER TABLE parents ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_teacher_assistants_teacher_id ON teacher_assistants(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assistants_assistant_id ON teacher_assistants(assistant_id);
CREATE INDEX IF NOT EXISTS idx_assistant_invites_teacher_id ON assistant_invites(teacher_id);
CREATE INDEX IF NOT EXISTS idx_assistant_invites_token ON assistant_invites(token);
CREATE INDEX IF NOT EXISTS idx_attendance_locks_session_id ON attendance_locks(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_locks_student_id ON attendance_locks(student_id);
CREATE INDEX IF NOT EXISTS idx_action_audit_log_teacher_id ON action_audit_log(teacher_id);
CREATE INDEX IF NOT EXISTS idx_action_audit_log_actor_id ON action_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_action_audit_log_created_at ON action_audit_log(created_at);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE TRIGGER update_teacher_assistants_updated_at BEFORE UPDATE ON teacher_assistants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Enable RLS on new tables
ALTER TABLE teacher_assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_audit_log ENABLE ROW LEVEL SECURITY;

-- TEACHER_ASSISTANTS: teacher can view/manage their assistants
CREATE POLICY "Teachers can view own assistants"
  ON teacher_assistants FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can insert own assistants"
  ON teacher_assistants FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update own assistants"
  ON teacher_assistants FOR UPDATE
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete own assistants"
  ON teacher_assistants FOR DELETE
  USING (teacher_id = auth.uid());

-- ASSISTANT_INVITES: teacher can manage their invites
CREATE POLICY "Teachers can view own invites"
  ON assistant_invites FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can insert own invites"
  ON assistant_invites FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update own invites"
  ON assistant_invites FOR UPDATE
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete own invites"
  ON assistant_invites FOR DELETE
  USING (teacher_id = auth.uid());

-- ATTENDANCE_LOCKS: teacher can manage locks on their sessions
CREATE POLICY "Teachers can view locks on own sessions"
  ON attendance_locks FOR SELECT
  USING (
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN groups g ON s.group_id = g.id
      JOIN offerings o ON g.offering_id = o.id
      WHERE o.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can insert locks on own sessions"
  ON attendance_locks FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN groups g ON s.group_id = g.id
      JOIN offerings o ON g.offering_id = o.id
      WHERE o.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can delete locks on own sessions"
  ON attendance_locks FOR DELETE
  USING (
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN groups g ON s.group_id = g.id
      JOIN offerings o ON g.offering_id = o.id
      WHERE o.teacher_id = auth.uid()
    )
  );

-- ACTION_AUDIT_LOG: teacher can view their own audit log
CREATE POLICY "Teachers can view own audit log"
  ON action_audit_log FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can insert own audit log"
  ON action_audit_log FOR INSERT
  WITH CHECK (teacher_id = auth.uid());
