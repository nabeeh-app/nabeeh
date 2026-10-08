-- Stage 3 (REVIEW ONLY, NOT APPLIED): RLS enforcement, not forced yet.
-- Uniform policy on every tenant table: TO authenticated,
-- USING plus WITH CHECK ((select current_tenant_id()) = tenant_id).
-- RLS enabled everywhere below. FORCE comes in stage 6.
--
-- Classification (verified against backend code 2026-10-08):
--   Uniform set (32): every table with tenant_id EXCEPT auth_audit_log.
--   Includes whatsapp_* and failed_messages: backend reaches them through
--   service_role today, but uniform policies keep them covered the day a
--   scoped client does. Harmless now, required later.
--   auth_audit_log: RLS enabled, NO policy. Write-only through service_role
--   (routes/auth.js logAuthEvent). Teachers never read it. Authenticated
--   role is denied by default; forensics stay service-role only.
--   Admin-only (untouched, existing policies stay): admin_users,
--   support_tickets, admin_audit_log. No teacher path, admin app only.
--   Tenant-billing tables (subscriptions, payments, ai_usage_log) DO get
--   the uniform policy: they carry tenant_id, no backend teacher route
--   reads them today, and the policy allows future own-reads while
--   denying cross-tenant reads. This is the documented exception to
--   "admin-only gets nothing": anything with tenant_id is uniform.
--   Global lookups (subjects, grade_levels) and revoked_tokens keep their
--   existing policies untouched.
--   teachers (tenant root, no tenant_id): gets its own policy below.
--   Predicate: own row by id or OAuth-linked auth_id, plus delegated read
--   for linked assistants. WITH CHECK stays owner-only so assistants can
--   never modify the owner profile.
--
-- Correction to the design doc: NO anonymous exception policy on
-- self_registration_tokens. Anonymous submitters never touch PostgREST;
-- the backend mediates every token read and write through service_role.
-- The earlier `for select using (true)` idea is dropped. No anon policy
-- exists on any table after this stage.
--
-- Anon safety: frontend supabase-js usage is auth-only (OAuth callback,
-- session handling; zero .from() table reads in frontend/src and
-- nabeeh-admin). REVOKE FROM anon therefore breaks no anonymous read.
-- GoTrue auth endpoints are unaffected by table grants.

-- ============================================================
-- 0. current_tenant_id(): STABLE, invoker, NULL when absent
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(auth.jwt() ->> 'tenant_id', '')::UUID
$$;
-- Deliberately no SECURITY DEFINER: must read the CALLER jwt claim.
-- Returns NULL when no JWT or no claim: policies deny, fail closed.

-- Actor id for tables without tenant_id (teachers root lookup).
CREATE OR REPLACE FUNCTION public.current_actor_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(auth.jwt() ->> 'sub', '')::UUID
$$;

-- ============================================================
-- 1. Drop every legacy policy on the uniform set.
-- Legacy policies compared teacher_id to auth.uid(), which is always
-- NULL under the custom JWT, so they only ever denied. Removal is safe.
-- Subjects/grade_levels/admin/service-role policies are NOT touched.
-- ============================================================
DO $$
DECLARE
  r RECORD;
  uniform TEXT[] := ARRAY['students','parents','offerings','groups','enrollments','sessions','attendance','attendance_locks','assessments','grades','conversations','messages','teacher_settings','teacher_subjects','faqs','password_reset_tokens','teacher_assistants','assistant_invites','action_audit_log','alert_rules','alerts','notifications','report_drafts','weekly_digests','subscriptions','payments','ai_usage_log','whatsapp_sessions','whatsapp_auth_creds','whatsapp_auth_keys','self_registration_tokens','failed_messages'];
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies
           WHERE schemaname = 'public' AND tablename = ANY (uniform)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ============================================================
-- 2. Enable RLS on the uniform set plus auth_audit_log
-- ============================================================
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_auth_creds ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_auth_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE self_registration_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE failed_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. Uniform policies TO authenticated (auth_audit_log excluded)
-- ============================================================
CREATE POLICY tenant_isolation ON students TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON parents TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON offerings TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON groups TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON enrollments TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON sessions TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON attendance TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON attendance_locks TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON assessments TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON grades TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON conversations TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON messages TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON teacher_settings TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON teacher_subjects TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON faqs TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON password_reset_tokens TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON teacher_assistants TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON assistant_invites TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON action_audit_log TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON alert_rules TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON alerts TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON notifications TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON report_drafts TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON weekly_digests TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON subscriptions TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON payments TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON ai_usage_log TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON whatsapp_sessions TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON whatsapp_auth_creds TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON whatsapp_auth_keys TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON self_registration_tokens TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON failed_messages TO authenticated
  USING ((SELECT current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT current_tenant_id()) = tenant_id);

-- ============================================================
-- 3b. teachers root policies (no tenant_id by design).
-- Legacy auth.uid() policies dropped. One policy per command so each
-- predicate reads plainly. Column restriction lives one layer up, in the
-- Zod updateProfileSchema: name, phone, business_name, bio, subjects,
-- address, city, country, timezone, whatsapp_number, telegram_username.
-- id, auth_id, and email are not API-writable by anyone.
-- ============================================================
DROP POLICY IF EXISTS "Teachers can view own profile" ON teachers;
DROP POLICY IF EXISTS "Teachers can update own profile" ON teachers;
DROP POLICY IF EXISTS teacher_self_select ON teachers;
DROP POLICY IF EXISTS teacher_self_insert ON teachers;
DROP POLICY IF EXISTS teacher_self_update ON teachers;
DROP POLICY IF EXISTS teacher_self_delete ON teachers;

-- SELECT: own row by id or OAuth-linked auth_id, plus delegated read for
-- linked assistants (needed for future scoped-client owner lookups).
CREATE POLICY teacher_self_select ON teachers FOR SELECT TO authenticated
  USING (
    id = (SELECT public.current_actor_id())
    OR auth_id = (SELECT public.current_actor_id())
    OR EXISTS (
      SELECT 1 FROM public.teacher_assistants ta
      WHERE ta.tenant_id = teachers.id
      AND ta.assistant_id = (SELECT public.current_actor_id())
    )
  );

-- INSERT: owner row only. Backend registration writes through service_role;
-- this governs scoped-client inserts only.
CREATE POLICY teacher_self_insert ON teachers FOR INSERT TO authenticated
  WITH CHECK (
    id = (SELECT public.current_actor_id())
    OR auth_id = (SELECT public.current_actor_id())
  );

-- UPDATE: owner row only. Which columns is decided by updateProfileSchema
-- (profile fields listed above); id, auth_id, email never writable.
CREATE POLICY teacher_self_update ON teachers FOR UPDATE TO authenticated
  USING (
    id = (SELECT public.current_actor_id())
    OR auth_id = (SELECT public.current_actor_id())
  )
  WITH CHECK (
    id = (SELECT public.current_actor_id())
    OR auth_id = (SELECT public.current_actor_id())
  );

-- DELETE: owner row only (account closure cascades the tenant by design).
-- Assistants can never delete the owner row.
CREATE POLICY teacher_self_delete ON teachers FOR DELETE TO authenticated
  USING (
    id = (SELECT public.current_actor_id())
    OR auth_id = (SELECT public.current_actor_id())
  );

-- ============================================================
-- 4. Revoke table grants from anon (present and future tables)
-- ============================================================
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
-- Default-deny for future tables regardless of which role creates them.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
-- No GRANTs to authenticated are added here, and none are needed:
-- authenticated already holds all 7 privileges on all 40 public tables
-- (measured on prod information_schema 2026-10-08), so policies become
-- the gate with no grant change. Sequences: public schema holds zero
-- sequences (all UUID PKs), so no sequence usage to grant.
-- service_role has BYPASSRLS and is never ALTERed anywhere in this
-- project: it keeps full access before, during, and after this stage.

-- ============================================================
-- 5. PROBES (run at apply time, all inside rolled-back txns).
-- Requires tenant JWTs minted with the legacy HS256 secret, which the
-- operator supplies at apply time via env (never stored). Mint with
-- python3 stdlib only: header HS256, claims sub/role=authenticated/
-- tenant_id/actor_id/actor_role/exp<=60s. Then:
--   a. anon (no token): GET /rest/v1/students -> expect 401 or [].
--   b. tenant A token: GET own students -> 200 own rows only;
--      POST student with tenant_id=B -> expect 403/400 (WITH CHECK).
--   c. tenant B token: GET students -> 200, zero A rows.
--   d. tenant B token: POST enrollment/update on A row id ->
--      expect 404/403, and the row unchanged afterwards.
--   e. service_role: reads/writes unaffected (bypasses RLS).
--   f. teachers predicate: owner token reads own row; assistant token
--      reads owner row, cannot update it; stranger token sees nothing.
-- The minting helper reads the legacy HS256 secret from env
-- (SUPABASE_JWT_SECRET) at runtime only. It is never printed, never
-- written to disk, never committed. Unset secret aborts the probe run.
-- Backend traffic is unaffected at this stage: it uses service_role
-- until the stage 5 route migration. Matrix plus suite rerun after apply.

-- ============================================================
-- 6. POST-APPLY CATALOG PROOF (run after apply, expect 1 row, n=32).
-- All 32 uniform policies must be textually identical modulo table name.
-- The tenant_id Var renders without table qualification, so identical
-- policies group into exactly one row.
-- ============================================================
-- SELECT pg_get_expr(polqual, polrelid) AS using_expr,
--        pg_get_expr(polwithcheck, polrelid) AS check_expr,
--        polroles::regrole::text AS to_role,
--        COUNT(*) AS n
-- FROM pg_policy WHERE polname = 'tenant_isolation'
-- GROUP BY 1, 2, 3;
-- Expected: one row, to_role = {authenticated}, n = 32.
-- Any second row is a divergent policy: stop, diff, fix, re-run.
-- ============================================================
