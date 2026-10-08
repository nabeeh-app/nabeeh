#!/bin/bash
# Static RLS coverage guard. No DB, no secrets.
# Every table that gained tenant_id in 021 must, in 023:
#   - have RLS enabled
#   - have at least one CREATE POLICY (auth_audit_log excepted: RLS, no policy)
# Plus: anon grants revoked (present + default privileges, both roles).
set -u
M21="${1:-database/migrations/021_stage1_tenant_id_columns.sql}"
M23="${2:-database/migrations/023_stage3_rls_policies.sql}"
fail=0

tables=$(grep -oE "^ALTER TABLE [a-z_]+ ADD COLUMN IF NOT EXISTS tenant_id" "$M21" | awk '{print $3}')
# failed_messages + self_registration_tokens are created with the column, not altered
tables="$tables
failed_messages
self_registration_tokens"
[ -z "$tables" ] && { echo "FAIL: no tenant tables parsed from 021"; exit 1; }

for t in $tables; do
  grep -q "ALTER TABLE $t ENABLE ROW LEVEL SECURITY" "$M23" \
    || { echo "FAIL: $t missing ENABLE ROW LEVEL SECURITY in 023"; fail=1; }
  if [ "$t" = "auth_audit_log" ]; then
    grep -qE "CREATE POLICY .* ON $t[ ;]" "$M23" \
      && { echo "FAIL: auth_audit_log must have no policy in 023"; fail=1; }
  else
    grep -qE "CREATE POLICY .* ON $t[ ;]" "$M23" \
      || { echo "FAIL: $t missing CREATE POLICY in 023"; fail=1; }
  fi
done

grep -q "REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon" "$M23" \
  || { echo "FAIL: anon revoke missing in 023"; fail=1; }
for r in postgres supabase_admin; do
  grep -q "ALTER DEFAULT PRIVILEGES FOR ROLE $r IN SCHEMA public REVOKE ALL ON TABLES FROM anon" "$M23" \
    || { echo "FAIL: default-privs revoke for $r missing in 023"; fail=1; }
done

# teachers root must carry its own predicates, never the uniform one
grep -qE "CREATE POLICY teacher_self_(select|insert|update|delete) ON teachers FOR (SELECT|INSERT|UPDATE|DELETE) TO authenticated" "$M23" \
  || { echo "FAIL: teachers per-command policies missing in 023"; fail=1; }
grep -qE "CREATE POLICY tenant_isolation ON teachers" "$M23" \
  && { echo "FAIL: teachers must not use the uniform policy"; fail=1; }

[ "$fail" -eq 0 ] && echo "RLS coverage OK: $(echo "$tables" | wc -l) tenant tables checked"
exit "$fail"
