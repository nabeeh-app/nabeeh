-- Stage 1: tenant_id columns + backfill + stamp triggers + NOT NULL.
-- P1 decision: per-tenant rows, uniform tenant predicate, no sharing.
-- auth_audit_log.tenant_id stays NULLABLE (pre-auth events unmappable).
-- Admin tables (admin_users, support_tickets, admin_audit_log) and global
-- tables (subjects, grade_levels, revoked_tokens) are out of scope.
-- teachers is the tenant root and gets no column.
-- Every table below is EMPTY in prod except: password_reset_tokens (5,
-- expired), auth_audit_log (153, 75 pre-auth NULL), assistant_invites (2),
-- action_audit_log (13), alert_rules (1), admin/subscription rows.

-- ============================================================
-- 0. Create tables missing in prod, WITH tenant_id from the start
-- ============================================================
CREATE TABLE IF NOT EXISTS failed_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  phone VARCHAR(30) NOT NULL,
  message_content TEXT NOT NULL,
  whatsapp_message_id TEXT,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  retried_at TIMESTAMPTZ,
  retry_count INT DEFAULT 0
);
ALTER TABLE failed_messages ENABLE ROW LEVEL SECURITY;

-- Matches the lazy DDL in backend/routes/selfRegistration.js plus tenant.
CREATE TABLE IF NOT EXISTS self_registration_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID,
  token UUID NOT NULL UNIQUE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  max_uses INT DEFAULT 100,
  use_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE self_registration_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 1. ADD COLUMN tenant_id (nullable until backfilled)
-- ============================================================
ALTER TABLE students ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE parents ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE offerings ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE attendance_locks ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE grades ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE teacher_settings ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE teacher_subjects ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE faqs ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE auth_audit_log ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE teacher_assistants ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE assistant_invites ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE action_audit_log ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE report_drafts ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE weekly_digests ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE ai_usage_log ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE whatsapp_auth_creds ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE whatsapp_auth_keys ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- ============================================================
-- 2. BACKFILL from teacher_id (direct-owned tables)
-- ============================================================
UPDATE students SET tenant_id = teacher_id WHERE tenant_id IS NULL;
UPDATE offerings SET tenant_id = teacher_id WHERE tenant_id IS NULL;
UPDATE conversations SET tenant_id = teacher_id WHERE tenant_id IS NULL;
UPDATE teacher_settings SET tenant_id = teacher_id WHERE tenant_id IS NULL;
UPDATE teacher_subjects SET tenant_id = teacher_id WHERE tenant_id IS NULL;
UPDATE faqs SET tenant_id = teacher_id WHERE tenant_id IS NULL;
UPDATE password_reset_tokens SET tenant_id = teacher_id WHERE tenant_id IS NULL;
UPDATE auth_audit_log SET tenant_id = teacher_id WHERE tenant_id IS NULL AND teacher_id IS NOT NULL;
UPDATE teacher_assistants SET tenant_id = teacher_id WHERE tenant_id IS NULL;
UPDATE assistant_invites SET tenant_id = teacher_id WHERE tenant_id IS NULL;
UPDATE action_audit_log SET tenant_id = teacher_id WHERE tenant_id IS NULL;
UPDATE alert_rules SET tenant_id = teacher_id WHERE tenant_id IS NULL;
UPDATE alerts SET tenant_id = teacher_id WHERE tenant_id IS NULL;
UPDATE notifications SET tenant_id = teacher_id WHERE tenant_id IS NULL;
UPDATE report_drafts SET tenant_id = teacher_id WHERE tenant_id IS NULL;
UPDATE weekly_digests SET tenant_id = teacher_id WHERE tenant_id IS NULL;
UPDATE subscriptions SET tenant_id = teacher_id WHERE tenant_id IS NULL;
UPDATE payments SET tenant_id = teacher_id WHERE tenant_id IS NULL;
UPDATE ai_usage_log SET tenant_id = teacher_id WHERE tenant_id IS NULL;
UPDATE whatsapp_sessions SET tenant_id = teacher_id WHERE tenant_id IS NULL;
UPDATE whatsapp_auth_creds SET tenant_id = teacher_id WHERE tenant_id IS NULL AND teacher_id IS NOT NULL;
UPDATE whatsapp_auth_keys SET tenant_id = teacher_id WHERE tenant_id IS NULL;
UPDATE self_registration_tokens SET tenant_id = teacher_id WHERE tenant_id IS NULL AND teacher_id IS NOT NULL;
UPDATE failed_messages SET tenant_id = teacher_id WHERE tenant_id IS NULL AND teacher_id IS NOT NULL;

-- ============================================================
-- 3. BACKFILL chain-owned tables (walk up to offerings/students)
-- ============================================================
UPDATE groups g SET tenant_id = o.teacher_id
FROM offerings o WHERE g.offering_id = o.id AND g.tenant_id IS NULL;

UPDATE enrollments e SET tenant_id = o.teacher_id
FROM groups g JOIN offerings o ON g.offering_id = o.id
WHERE e.group_id = g.id AND e.tenant_id IS NULL;

UPDATE sessions s SET tenant_id = o.teacher_id
FROM groups g JOIN offerings o ON g.offering_id = o.id
WHERE s.group_id = g.id AND s.tenant_id IS NULL;

UPDATE attendance a SET tenant_id = o.teacher_id
FROM enrollments e JOIN groups g ON e.group_id = g.id
JOIN offerings o ON g.offering_id = o.id
WHERE a.enrollment_id = e.id AND a.tenant_id IS NULL;

UPDATE attendance_locks l SET tenant_id = o.teacher_id
FROM sessions s JOIN groups g ON s.group_id = g.id
JOIN offerings o ON g.offering_id = o.id
WHERE l.session_id = s.id AND l.tenant_id IS NULL;

UPDATE assessments a SET tenant_id = o.teacher_id
FROM offerings o WHERE a.offering_id = o.id AND a.tenant_id IS NULL;

UPDATE grades gr SET tenant_id = o.teacher_id
FROM enrollments e JOIN groups g ON e.group_id = g.id
JOIN offerings o ON g.offering_id = o.id
WHERE gr.enrollment_id = e.id AND gr.tenant_id IS NULL;

UPDATE parents p SET tenant_id = s.teacher_id
FROM students s WHERE p.student_id = s.id AND p.tenant_id IS NULL;

UPDATE messages m SET tenant_id = c.teacher_id
FROM conversations c WHERE m.conversation_id = c.id AND m.tenant_id IS NULL;

-- ============================================================
-- 4. CONSISTENCY ASSERTS: fail the migration on cross-tenant orphans
-- ============================================================
DO $$
DECLARE
  bad_enroll INT; bad_lock INT; bad_grade INT; bad_att INT;
BEGIN
  -- enrollments.teacher_id (008 denormalized) must equal chain owner
  SELECT COUNT(*) INTO bad_enroll FROM enrollments e
  JOIN groups g ON e.group_id = g.id JOIN offerings o ON g.offering_id = o.id
  WHERE e.teacher_id IS DISTINCT FROM o.teacher_id;
  IF bad_enroll > 0 THEN RAISE EXCEPTION 'stage1: % enrollments with teacher_id != chain owner', bad_enroll; END IF;

  -- lock student must belong to the lock session tenant
  SELECT COUNT(*) INTO bad_lock FROM attendance_locks l
  JOIN sessions s ON l.session_id = s.id
  JOIN students st ON l.student_id = st.id
  WHERE s.tenant_id IS DISTINCT FROM st.teacher_id;
  IF bad_lock > 0 THEN RAISE EXCEPTION 'stage1: % attendance_locks cross-tenant', bad_lock; END IF;

  -- grade assessment offering must equal grade enrollment tenant
  SELECT COUNT(*) INTO bad_grade FROM grades gr
  JOIN enrollments e ON gr.enrollment_id = e.id
  JOIN assessments a ON gr.assessment_id = a.id
  JOIN offerings o ON a.offering_id = o.id
  WHERE e.tenant_id IS DISTINCT FROM o.teacher_id;
  IF bad_grade > 0 THEN RAISE EXCEPTION 'stage1: % grades cross-tenant', bad_grade; END IF;

  -- attendance session tenant must equal enrollment tenant
  SELECT COUNT(*) INTO bad_att FROM attendance a
  JOIN enrollments e ON a.enrollment_id = e.id
  JOIN sessions s ON a.session_id = s.id
  WHERE e.tenant_id IS DISTINCT FROM s.tenant_id;
  IF bad_att > 0 THEN RAISE EXCEPTION 'stage1: % attendance rows cross-tenant', bad_att; END IF;
END $$;

-- ============================================================
-- 5. STAMP TRIGGER: every new row lands stamped, tenant_id immutable.
-- Pre-stage-5 code keeps writing; nothing breaks. Fail loud on NULL.
-- ============================================================
CREATE OR REPLACE FUNCTION stamp_tenant_id()
RETURNS TRIGGER AS $$
DECLARE
  t UUID;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
      RAISE EXCEPTION 'tenant_id is immutable (%)', TG_TABLE_NAME;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.tenant_id IS NOT NULL THEN RETURN NEW; END IF;

  CASE TG_TABLE_NAME
    WHEN 'students' THEN t := NEW.teacher_id;
    WHEN 'offerings' THEN t := NEW.teacher_id;
    WHEN 'conversations' THEN t := NEW.teacher_id;
    WHEN 'teacher_settings' THEN t := NEW.teacher_id;
    WHEN 'teacher_subjects' THEN t := NEW.teacher_id;
    WHEN 'faqs' THEN t := NEW.teacher_id;
    WHEN 'password_reset_tokens' THEN t := NEW.teacher_id;
    WHEN 'teacher_assistants' THEN t := NEW.teacher_id;
    WHEN 'assistant_invites' THEN t := NEW.teacher_id;
    WHEN 'action_audit_log' THEN t := NEW.teacher_id;
    WHEN 'alert_rules' THEN t := NEW.teacher_id;
    WHEN 'alerts' THEN t := NEW.teacher_id;
    WHEN 'notifications' THEN t := NEW.teacher_id;
    WHEN 'report_drafts' THEN t := NEW.teacher_id;
    WHEN 'weekly_digests' THEN t := NEW.teacher_id;
    WHEN 'subscriptions' THEN t := NEW.teacher_id;
    WHEN 'payments' THEN t := NEW.teacher_id;
    WHEN 'ai_usage_log' THEN t := NEW.teacher_id;
    WHEN 'whatsapp_sessions' THEN t := NEW.teacher_id;
    WHEN 'whatsapp_auth_creds' THEN t := NEW.teacher_id;
    WHEN 'whatsapp_auth_keys' THEN t := NEW.teacher_id;
    WHEN 'self_registration_tokens' THEN t := NEW.teacher_id;
    WHEN 'failed_messages' THEN t := NEW.teacher_id;
    WHEN 'groups' THEN SELECT o.teacher_id INTO t FROM offerings o WHERE o.id = NEW.offering_id;
    WHEN 'enrollments' THEN SELECT o.teacher_id INTO t FROM groups g JOIN offerings o ON g.offering_id = o.id WHERE g.id = NEW.group_id;
    WHEN 'sessions' THEN SELECT o.teacher_id INTO t FROM groups g JOIN offerings o ON g.offering_id = o.id WHERE g.id = NEW.group_id;
    WHEN 'attendance' THEN SELECT e.tenant_id INTO t FROM enrollments e WHERE e.id = NEW.enrollment_id;
    WHEN 'attendance_locks' THEN SELECT s.tenant_id INTO t FROM sessions s WHERE s.id = NEW.session_id;
    WHEN 'assessments' THEN SELECT o.teacher_id INTO t FROM offerings o WHERE o.id = NEW.offering_id;
    WHEN 'grades' THEN SELECT e.tenant_id INTO t FROM enrollments e WHERE e.id = NEW.enrollment_id;
    WHEN 'parents' THEN SELECT s.tenant_id INTO t FROM students s WHERE s.id = NEW.student_id;
    WHEN 'messages' THEN SELECT c.tenant_id INTO t FROM conversations c WHERE c.id = NEW.conversation_id;
    WHEN 'auth_audit_log' THEN t := NEW.teacher_id; -- NULL allowed: pre-auth events
    ELSE RAISE EXCEPTION 'stamp_tenant_id: unmapped table %', TG_TABLE_NAME;
  END CASE;

  IF t IS NULL AND TG_TABLE_NAME <> 'auth_audit_log' THEN
    RAISE EXCEPTION 'tenant_id could not be derived (%)', TG_TABLE_NAME;
  END IF;
  NEW.tenant_id := t;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stamp_tenant ON students;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON students FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON parents;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON parents FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON offerings;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON offerings FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON groups;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON enrollments;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON enrollments FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON sessions;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON attendance;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON attendance FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON attendance_locks;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON attendance_locks FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON assessments;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON assessments FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON grades;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON grades FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON conversations;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON messages;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON teacher_settings;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON teacher_settings FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON teacher_subjects;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON teacher_subjects FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON faqs;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON faqs FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON password_reset_tokens;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON password_reset_tokens FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON auth_audit_log;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON auth_audit_log FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON teacher_assistants;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON teacher_assistants FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON assistant_invites;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON assistant_invites FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON action_audit_log;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON action_audit_log FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON alert_rules;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON alert_rules FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON alerts;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON notifications;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON report_drafts;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON report_drafts FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON weekly_digests;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON weekly_digests FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON subscriptions;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON payments;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON ai_usage_log;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON ai_usage_log FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON whatsapp_sessions;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON whatsapp_sessions FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON whatsapp_auth_creds;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON whatsapp_auth_creds FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON whatsapp_auth_keys;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON whatsapp_auth_keys FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON self_registration_tokens;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON self_registration_tokens FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();
DROP TRIGGER IF EXISTS trg_stamp_tenant ON failed_messages;
CREATE TRIGGER trg_stamp_tenant BEFORE INSERT OR UPDATE ON failed_messages FOR EACH ROW EXECUTE FUNCTION stamp_tenant_id();

-- ============================================================
-- 6. ZERO-NULL VERIFY then NOT NULL (auth_audit_log excepted)
-- ============================================================
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY['students','parents','offerings','groups','enrollments','sessions','attendance','attendance_locks','assessments','grades','conversations','messages','teacher_settings','teacher_subjects','faqs','password_reset_tokens','teacher_assistants','assistant_invites','action_audit_log','alert_rules','alerts','notifications','report_drafts','weekly_digests','subscriptions','payments','ai_usage_log','whatsapp_sessions','whatsapp_auth_creds','whatsapp_auth_keys','self_registration_tokens','failed_messages'];
  n INT;
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE tenant_id IS NULL', tbl) INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'stage1: % has % NULL tenant_id rows', tbl, n; END IF;
  END LOOP;
END $$;

ALTER TABLE students ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE parents ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE offerings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE groups ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE enrollments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE sessions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE attendance ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE attendance_locks ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE assessments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE grades ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE conversations ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE messages ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE teacher_settings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE teacher_subjects ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE faqs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE password_reset_tokens ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE teacher_assistants ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE assistant_invites ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE action_audit_log ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE alert_rules ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE alerts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE notifications ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE report_drafts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE weekly_digests ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE subscriptions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE payments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE ai_usage_log ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE whatsapp_sessions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE whatsapp_auth_creds ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE whatsapp_auth_keys ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE self_registration_tokens ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE failed_messages ALTER COLUMN tenant_id SET NOT NULL;

-- ============================================================
-- 7. INDEXES on tenant_id
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_students_tenant ON students(tenant_id);
CREATE INDEX IF NOT EXISTS idx_parents_tenant ON parents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_offerings_tenant ON offerings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_groups_tenant ON groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_tenant ON enrollments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_tenant ON attendance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_locks_tenant ON attendance_locks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assessments_tenant ON assessments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_grades_tenant ON grades(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_tenant ON messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_teacher_settings_tenant ON teacher_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_faqs_tenant ON faqs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_action_audit_log_tenant ON action_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_tenant ON auth_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alerts_tenant ON alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_tenant ON whatsapp_sessions(tenant_id);
