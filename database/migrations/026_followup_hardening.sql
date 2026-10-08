-- 026 follow-up hardening (NOT a 023 re-apply).
-- Four independent closings, single transaction:
--   a. teachers SELECT loses assistant delegation (owner-only read).
--   b. action_audit_log loses UPDATE/DELETE for authenticated (append-only).
--   c. Function EXECUTE least privilege (see below).
--   d. Nothing else. No policy text touched, no grants widened.
--
-- Function grants (measured on prod 2026-10-08): every public function
-- carried PUBLIC EXECUTE. Backend RPCs all run as service_role, policies
-- run the 3 helpers as authenticated. Grants below preserve exactly the
-- working set and nothing more. Trigger-internal functions need no
-- EXECUTE grant (they fire with the statement, not the caller).
-- increment_token_usage is called by backend but does not exist in
-- public: pre-existing breakage, out of scope, no grant invented for it.
-- supabase_admin role defaults: platform denies FOR ROLE changes, the CI
-- gate covers future objects instead. One line, moving on.

BEGIN;

-- ============================================================
-- a. teachers SELECT: owner-only read, delegation removed.
-- Assistants reach owner data through service_role backend paths;
-- no scoped-client owner lookup exists to preserve.
-- ============================================================
DROP POLICY IF EXISTS teacher_self_select ON teachers;

CREATE POLICY teacher_self_select ON teachers FOR SELECT TO authenticated
  USING (
    id = (SELECT public.current_actor_id())
    OR auth_id = (SELECT public.current_actor_id())
  );

-- ============================================================
-- b. action_audit_log append-only for authenticated.
-- ============================================================
REVOKE UPDATE, DELETE ON action_audit_log FROM authenticated;

-- ============================================================
-- c. Function EXECUTE least privilege.
-- Order: revoke first (present objects), then default-privs revoke
-- (future objects), then explicit GRANTs (working set only).
-- ============================================================
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- Helpers: policies run these as authenticated; backend may call directly.
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_actor_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_actor_role() TO authenticated, service_role;

-- Backend RPCs, service_role only (all current callers use supabaseAdmin).
GRANT EXECUTE ON FUNCTION public.teacher_student_count(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_stats(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.message_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.attendance_summary(UUID, DATE, DATE) TO service_role;

-- exec_sql stays service_role only (025 owns the lockdown, recorded in
-- APPLIED.tsv; the duplicated line once in 023 is history, not policy).
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;

COMMIT;
