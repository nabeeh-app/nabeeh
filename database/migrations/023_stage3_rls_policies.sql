-- Stage 3 (REVIEW ONLY, NOT APPLIED): RLS enforcement, not forced yet.
-- Single transaction: any failure rolls everything back.
-- Policy sets (counts verified by the catalog queries in section 6):
--   26 uniform tenant_isolation (permissive, all commands)
--   3 select-only tenant_readonly (subscriptions, payments, ai_usage_log)
--   4 RESTRICTIVE owner_only (teacher_assistants, assistant_invites,
--     self_registration_tokens, whatsapp_sessions): teacher role only.
--     Consequence: assistants are denied on these 4 tables until stage 5
--     introduces delegation-aware policies. Recorded, not accidental.
--   4 no-policy, RLS enabled, service_role only: auth_audit_log,
--     password_reset_tokens, whatsapp_auth_creds, whatsapp_auth_keys.
--     Backend reaches all four through service_role; teachers never read
--     auth_audit_log (routes/auth.js logAuthEvent is write-only).
--   teachers: SELECT plus UPDATE policies below, column grants below.
--   Untouched: admin_users, support_tickets, admin_audit_log (admin app),
--   subjects, grade_levels (lookup), revoked_tokens (service only).
-- FORCE RLS comes in stage 6.

BEGIN;

-- ============================================================
-- 0. Claim readers: STABLE, invoker, NULL when absent, locked path
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SET search_path = ''
AS $$
  SELECT NULLIF(auth.jwt() ->> 'tenant_id', '')::UUID
$$;
-- Deliberately no SECURITY DEFINER: must read the CALLER jwt claim.
-- Returns NULL when no JWT or no claim: policies deny, fail closed.
-- search_path is locked so an unqualified name can never resolve to an
-- attacker-owned object; auth.jwt() stays schema-qualified.

CREATE OR REPLACE FUNCTION public.current_actor_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SET search_path = ''
AS $$
  SELECT NULLIF(auth.jwt() ->> 'sub', '')::UUID
$$;

CREATE OR REPLACE FUNCTION public.current_actor_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SET search_path = ''
AS $$
  SELECT NULLIF(auth.jwt() ->> 'actor_role', '')
$$;

-- ============================================================
-- 1. Drop every legacy policy on managed tables, printing each drop.
-- Legacy policies compared teacher_id to auth.uid(), which is always
-- NULL under the custom JWT, so they only ever denied. The "Service
-- role only" policies on whatsapp_*/failed_messages are redundant for
-- bypass roles and go too. Subjects/grade_levels/admin/revoked_tokens
-- policies are NOT in these lists and stay untouched.
-- ============================================================
DO $$
DECLARE
  r RECORD;
  managed TEXT[] := ARRAY['students','parents','offerings','groups','enrollments','sessions','attendance','attendance_locks','assessments','grades','conversations','messages','teacher_settings','teacher_subjects','faqs','password_reset_tokens','teacher_assistants','assistant_invites','action_audit_log','alert_rules','alerts','notifications','report_drafts','weekly_digests','subscriptions','payments','ai_usage_log','whatsapp_sessions','whatsapp_auth_creds','whatsapp_auth_keys','self_registration_tokens','failed_messages','auth_audit_log'];
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies
           WHERE schemaname = 'public' AND tablename = ANY (managed)
  LOOP
    RAISE NOTICE 'dropping policy % on %', r.policyname, r.tablename;
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ============================================================
-- 2. Enable RLS on the uniform set, the select-only set, the
-- no-policy set, and teachers (34 tables total)
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
ALTER TABLE teacher_assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE self_registration_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE failed_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_auth_creds ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_auth_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. Uniform policies TO authenticated (26 tables)
-- ============================================================
CREATE POLICY tenant_isolation ON students TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON parents TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON offerings TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON groups TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON enrollments TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON sessions TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON attendance TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON attendance_locks TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON assessments TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON grades TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON conversations TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON messages TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON teacher_settings TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON teacher_subjects TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON faqs TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON teacher_assistants TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON assistant_invites TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON action_audit_log TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON alert_rules TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON alerts TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON notifications TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON report_drafts TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON weekly_digests TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON self_registration_tokens TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON failed_messages TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.current_tenant_id()) = tenant_id);
CREATE POLICY tenant_isolation ON whatsapp_sessions TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id)
  WITH CHECK ((SELECT public.current_tenant_id()) = tenant_id);

-- ============================================================
-- 3b. SELECT-only policies (billing/usage: readable, never writable
-- through the authenticated role; writes stay service_role)
-- ============================================================
CREATE POLICY tenant_readonly ON subscriptions FOR SELECT TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id);
CREATE POLICY tenant_readonly ON payments FOR SELECT TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id);
CREATE POLICY tenant_readonly ON ai_usage_log FOR SELECT TO authenticated
  USING ((SELECT public.current_tenant_id()) = tenant_id);

-- ============================================================
-- 3c. RESTRICTIVE teacher-only policies (ANDed with the uniform ones).
-- Assistants are denied on these 4 tables until stage 5 introduces
-- delegation-aware policies. See file header.
-- ============================================================
CREATE POLICY owner_only ON teacher_assistants
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.current_actor_role()) = 'teacher')
  WITH CHECK ((SELECT public.current_actor_role()) = 'teacher');
CREATE POLICY owner_only ON assistant_invites
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.current_actor_role()) = 'teacher')
  WITH CHECK ((SELECT public.current_actor_role()) = 'teacher');
CREATE POLICY owner_only ON self_registration_tokens
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.current_actor_role()) = 'teacher')
  WITH CHECK ((SELECT public.current_actor_role()) = 'teacher');
CREATE POLICY owner_only ON whatsapp_sessions
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.current_actor_role()) = 'teacher')
  WITH CHECK ((SELECT public.current_actor_role()) = 'teacher');

-- ============================================================
-- 3d. teachers root policies (no tenant_id by design).
-- Column restriction lives one layer up, in updateProfileSchema: name,
-- phone, business_name, bio, subjects, address, city, country, timezone,
-- whatsapp_number, telegram_username. id, auth_id, email: not writable.
-- No INSERT and no DELETE policy: those commands are denied for the
-- authenticated role. Registration and closure stay service_role paths.
-- ============================================================
DROP POLICY IF EXISTS "Teachers can view own profile" ON teachers;
DROP POLICY IF EXISTS "Teachers can update own profile" ON teachers;
DROP POLICY IF EXISTS teacher_self_select ON teachers;
DROP POLICY IF EXISTS teacher_self_update ON teachers;

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

-- UPDATE: owner row only. Column scope comes from the GRANT below
-- (11 profile columns) plus the Zod schema; the policy gates the row.
CREATE POLICY teacher_self_update ON teachers FOR UPDATE TO authenticated
  USING (
    id = (SELECT public.current_actor_id())
    OR auth_id = (SELECT public.current_actor_id())
  )
  WITH CHECK (
    id = (SELECT public.current_actor_id())
    OR auth_id = (SELECT public.current_actor_id())
  );

-- ============================================================
-- 4. Grants: least privilege per role and table class
-- ============================================================
-- anon loses everything, present and future, whoever creates the table.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
-- authenticated keeps SELECT/INSERT/UPDATE/DELETE (already held on all 40
-- public tables, measured 2026-10-08; policies become the gate) but loses
-- the exotic privileges it never needs, present and future.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM authenticated;
-- teachers: no INSERT/UPDATE/DELETE for authenticated at all, then UPDATE
-- back on exactly the 11 API-writable profile columns. SELECT stays.
REVOKE INSERT, UPDATE, DELETE ON teachers FROM authenticated;
GRANT UPDATE (name, phone, business_name, bio, subjects, address, city, country, timezone, whatsapp_number, telegram_username) ON teachers TO authenticated;
-- Billing/usage: readable, never writable through authenticated.
REVOKE INSERT, UPDATE, DELETE ON subscriptions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON payments FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON ai_usage_log FROM authenticated;
-- exec_sql lockdown (P0 found 2026-10-08): SECURITY DEFINER as postgres
-- with EXECUTE open to anon meant unauthenticated arbitrary SQL. Backend
-- reaches it through service_role only; everyone else loses EXECUTE.
REVOKE ALL ON FUNCTION public.exec_sql(text) FROM PUBLIC, anon, authenticated;
-- No GRANTs to authenticated are added beyond the teachers column list:
-- authenticated already holds the 4 needed privileges on all 40 public
-- tables, so policies become the gate with no grant change. Sequences:
-- public holds zero sequences (all UUID PKs), nothing to grant.
-- service_role has BYPASSRLS and is never ALTERed anywhere in this
-- project: full access before, during, and after this stage.

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
--   g. assistant token on the 4 owner_only tables -> denied (405/403/empty).
-- The minting helper reads the legacy HS256 secret from env
-- (SUPABASE_JWT_SECRET) at runtime only. It is never printed, never
-- written to disk, never committed. Unset secret aborts the probe run.
-- Backend traffic is unaffected at this stage: it uses service_role
-- until the stage 5 route migration. Matrix plus suite rerun after apply.

-- ============================================================
-- 6. POST-APPLY CATALOG PROOF (run after apply).
-- ============================================================
-- 6a. Uniform set: exactly one row, n = 26, permissive, all commands.
-- SELECT pg_get_expr(polqual, polrelid) AS using_expr,
--        pg_get_expr(polwithcheck, polrelid) AS check_expr,
--        polroles::regrole[]::text AS to_role,
--        polpermissive, polcmd,
--        COUNT(*) AS n
-- FROM pg_policy WHERE polname = 'tenant_isolation'
-- GROUP BY 1, 2, 3, 4, 5;
-- Expected: one row, n = 26, to_role = {authenticated}, polpermissive =
-- true, polcmd = *. A second row is a divergent policy: stop and fix.
-- 6b. Select-only set: n = 3, cmd = r.
-- SELECT COUNT(*) AS n FROM pg_policy
-- WHERE polname = 'tenant_readonly' AND polcmd = 'r' AND polpermissive;
-- Expected: n = 3.
-- 6c. Restrictive set: n = 4, not permissive.
-- SELECT COUNT(*) AS n FROM pg_policy
-- WHERE polname = 'owner_only' AND NOT polpermissive;
-- Expected: n = 4.
-- 6d. No-policy tables: zero policies each.
-- SELECT t.tablename, COUNT(p.policyname) AS n FROM pg_tables t
-- LEFT JOIN pg_policies p ON p.schemaname = 'public'
--   AND p.tablename = t.tablename
-- WHERE t.schemaname = 'public'
--   AND t.tablename IN ('auth_audit_log','password_reset_tokens',
--     'whatsapp_auth_creds','whatsapp_auth_keys')
-- GROUP BY 1;
-- Expected: four rows, n = 0 each.

COMMIT;
