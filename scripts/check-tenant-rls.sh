#!/bin/bash
# Static RLS coverage guard. No DB, no secrets.
# Policy sets in 023 (see file header for the classification):
#   uniform tenant_isolation (USING + WITH CHECK): 26 tables
#   select-only tenant_readonly: subscriptions, payments, ai_usage_log
#   no-policy (RLS enabled, service_role only): auth_audit_log,
#     password_reset_tokens, whatsapp_auth_creds, whatsapp_auth_keys
#   teachers: teacher_self_select + teacher_self_update only
set -u
M21="${1:-database/migrations/021_stage1_tenant_id_columns.sql}"
M23="${2:-database/migrations/023_stage3_rls_policies.sql}"
fail=0

NO_POLICY="auth_audit_log password_reset_tokens whatsapp_auth_creds whatsapp_auth_keys"
SELECT_ONLY="subscriptions payments ai_usage_log"

tables=$(grep -oE "^ALTER TABLE [a-z_]+ ADD COLUMN IF NOT EXISTS tenant_id" "$M21" | awk '{print $3}')
# failed_messages + self_registration_tokens are created with the column, not altered
tables="$tables
failed_messages
self_registration_tokens"
[ -z "$tables" ] && { echo "FAIL: no tenant tables parsed from 021"; exit 1; }

is_no_policy() { case " $NO_POLICY " in *" $1 "*) return 0;; *) return 1;; esac; }
is_select_only() { case " $SELECT_ONLY " in *" $1 "*) return 0;; *) return 1;; esac; }

n_uniform=0
for t in $tables; do
  grep -q "ALTER TABLE $t ENABLE ROW LEVEL SECURITY" "$M23" \
    || { echo "FAIL: $t missing ENABLE ROW LEVEL SECURITY in 023"; fail=1; }
  if is_no_policy "$t"; then
    grep -qE "CREATE( RESTRICTIVE)? POLICY .* ON $t[ ;]" "$M23" \
      && { echo "FAIL: $t must have no policy in 023"; fail=1; }
  elif is_select_only "$t"; then
    grep -qE "CREATE POLICY tenant_readonly ON $t FOR SELECT TO authenticated" "$M23" \
      || { echo "FAIL: $t missing select-only policy in 023"; fail=1; }
    grep -qE "REVOKE INSERT, UPDATE, DELETE ON $t FROM authenticated" "$M23" \
      || { echo "FAIL: $t missing write revoke in 023"; fail=1; }
  else
    grep -qE "CREATE POLICY tenant_isolation ON $t TO authenticated" "$M23" \
      || { echo "FAIL: $t missing uniform policy in 023"; fail=1; }
    n_uniform=$((n_uniform + 1));
  fi
done
[ "$n_uniform" -eq 26 ] || { echo "FAIL: expected 26 uniform policies, found $n_uniform"; fail=1; }

for t in teacher_assistants assistant_invites self_registration_tokens whatsapp_sessions; do
  grep -qE "CREATE POLICY owner_only ON $t" "$M23" \
    || { echo "FAIL: $t missing RESTRICTIVE owner_only in 023"; fail=1; }
done

grep -q "REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon" "$M23" \
  || { echo "FAIL: anon revoke missing in 023"; fail=1; }
for r in postgres supabase_admin; do
  grep -q "ALTER DEFAULT PRIVILEGES FOR ROLE $r IN SCHEMA public REVOKE ALL ON TABLES FROM anon" "$M23" \
    || { echo "FAIL: default-privs anon revoke for $r missing in 023"; fail=1; }
  grep -q "ALTER DEFAULT PRIVILEGES FOR ROLE $r IN SCHEMA public REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM authenticated" "$M23" \
    || { echo "FAIL: default-privs exotic revoke for $r missing in 023"; fail=1; }
done
grep -q "REVOKE ALL ON FUNCTION public.exec_sql(text) FROM PUBLIC, anon, authenticated" "$M23" \
  || { echo "FAIL: exec_sql lockdown missing in 023"; fail=1; }

# teachers root: select + update only, never uniform, no insert/delete
for p in "teacher_self_select ON teachers FOR SELECT" "teacher_self_update ON teachers FOR UPDATE"; do
  grep -qE "CREATE POLICY $p TO authenticated" "$M23" \
    || { echo "FAIL: teachers $p missing in 023"; fail=1; }
done
grep -qE "CREATE POLICY tenant_isolation ON teachers" "$M23" \
  && { echo "FAIL: teachers must not use the uniform policy"; fail=1; }
grep -qE "CREATE POLICY teacher_self_(insert|delete) ON teachers" "$M23" \
  && { echo "FAIL: teachers must have no insert/delete policy"; fail=1; }
grep -q "GRANT UPDATE (name, phone, business_name, bio, subjects, address, city, country, timezone, whatsapp_number, telegram_username) ON teachers TO authenticated" "$M23" \
  || { echo "FAIL: teachers column grant missing in 023"; fail=1; }

[ "$fail" -eq 0 ] && echo "RLS coverage OK: 26 uniform, 3 select-only, 4 no-policy, teachers separate"
exit "$fail"
