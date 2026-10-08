-- ROLLBACK for 021_stage1_tenant_id_columns.sql (tested pattern, run manually).
-- Stage 1 only ADDS columns/triggers/indexes: rollback loses no data.
-- Tables created by stage 1 (failed_messages, self_registration_tokens)
-- are dropped only when empty; otherwise the migration stops for review.

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM failed_messages) > 0 THEN
    RAISE EXCEPTION 'rollback: failed_messages non-empty, manual review required';
  END IF;
  IF (SELECT COUNT(*) FROM self_registration_tokens) > 0 THEN
    RAISE EXCEPTION 'rollback: self_registration_tokens non-empty, manual review required';
  END IF;
END $$;

DROP TABLE IF EXISTS failed_messages;
DROP TABLE IF EXISTS self_registration_tokens;

-- Indexes first: dropping the column auto-drops its indexes.
DROP INDEX IF EXISTS idx_students_tenant;
DROP INDEX IF EXISTS idx_parents_tenant;
DROP INDEX IF EXISTS idx_offerings_tenant;
DROP INDEX IF EXISTS idx_groups_tenant;
DROP INDEX IF EXISTS idx_enrollments_tenant;
DROP INDEX IF EXISTS idx_sessions_tenant;
DROP INDEX IF EXISTS idx_attendance_tenant;
DROP INDEX IF EXISTS idx_attendance_locks_tenant;
DROP INDEX IF EXISTS idx_assessments_tenant;
DROP INDEX IF EXISTS idx_grades_tenant;
DROP INDEX IF EXISTS idx_conversations_tenant;
DROP INDEX IF EXISTS idx_messages_tenant;
DROP INDEX IF EXISTS idx_teacher_settings_tenant;
DROP INDEX IF EXISTS idx_faqs_tenant;
DROP INDEX IF EXISTS idx_action_audit_log_tenant;
DROP INDEX IF EXISTS idx_auth_audit_log_tenant;
DROP INDEX IF EXISTS idx_alerts_tenant;
DROP INDEX IF EXISTS idx_notifications_tenant;
DROP INDEX IF EXISTS idx_subscriptions_tenant;
DROP INDEX IF EXISTS idx_payments_tenant;
DROP INDEX IF EXISTS idx_whatsapp_sessions_tenant;

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY['students','parents','offerings','groups','enrollments','sessions','attendance','attendance_locks','assessments','grades','conversations','messages','teacher_settings','teacher_subjects','faqs','password_reset_tokens','auth_audit_log','teacher_assistants','assistant_invites','action_audit_log','alert_rules','alerts','notifications','report_drafts','weekly_digests','subscriptions','payments','ai_usage_log','whatsapp_sessions','whatsapp_auth_creds','whatsapp_auth_keys'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_stamp_tenant ON %I', tbl);
    EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS tenant_id', tbl);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS stamp_tenant_id();
