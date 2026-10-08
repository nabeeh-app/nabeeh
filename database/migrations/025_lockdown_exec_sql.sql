-- Hotfix (NOT APPLIED): close unauthenticated arbitrary SQL execution.
-- exec_sql is SECURITY DEFINER as postgres with EXECUTE open to anon,
-- which returns live Postgres errors to anonymous callers. Backend
-- reaches it through service_role only; everyone else loses EXECUTE.
-- Isolated on purpose: lands before 023 and changes nothing else.
BEGIN;
REVOKE ALL ON FUNCTION public.exec_sql(text) FROM PUBLIC, anon, authenticated;
COMMIT;
