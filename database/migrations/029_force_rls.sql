-- Stage 6: FORCE RLS on every tenant table.
-- Preconditions (all verified before apply): stage 5 scoped clients on
-- all request paths, service_role allowlist for bot/background/audit
-- paths, auth/audit/admin paths unchanged. FORCE makes table owners
-- obey policies too; with owners already policy-clean this changes
-- nothing for legitimate traffic and closes the owner bypass.
-- Tables: the 34 RLS-enabled managed tables (33 tenant + teachers).
-- Admin/global/lookup tables keep their existing posture.

BEGIN;

ALTER TABLE students FORCE ROW LEVEL SECURITY;
ALTER TABLE parents FORCE ROW LEVEL SECURITY;
ALTER TABLE offerings FORCE ROW LEVEL SECURITY;
ALTER TABLE groups FORCE ROW LEVEL SECURITY;
ALTER TABLE enrollments FORCE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE attendance FORCE ROW LEVEL SECURITY;
ALTER TABLE attendance_locks FORCE ROW LEVEL SECURITY;
ALTER TABLE assessments FORCE ROW LEVEL SECURITY;
ALTER TABLE grades FORCE ROW LEVEL SECURITY;
ALTER TABLE conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;
ALTER TABLE teacher_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE teacher_subjects FORCE ROW LEVEL SECURITY;
ALTER TABLE faqs FORCE ROW LEVEL SECURITY;
ALTER TABLE teacher_assistants FORCE ROW LEVEL SECURITY;
ALTER TABLE assistant_invites FORCE ROW LEVEL SECURITY;
ALTER TABLE action_audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE alert_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE alerts FORCE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE report_drafts FORCE ROW LEVEL SECURITY;
ALTER TABLE weekly_digests FORCE ROW LEVEL SECURITY;
ALTER TABLE self_registration_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE failed_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_log FORCE ROW LEVEL SECURITY;
ALTER TABLE auth_audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_auth_creds FORCE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_auth_keys FORCE ROW LEVEL SECURITY;
ALTER TABLE teachers FORCE ROW LEVEL SECURITY;

COMMIT;
