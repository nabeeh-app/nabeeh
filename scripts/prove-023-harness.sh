#!/bin/bash
# Harness proof for 023: scratch Postgres, single-transaction apply,
# role/claim probes, catalog counts. No prod, no secrets.
set -u
PG=/usr/lib/postgresql/18/bin
DIR=/tmp/pg023
export PATH=$PG:$PATH
rm -rf $DIR && mkdir -p $DIR
initdb -D $DIR/data -U postgres --auth=trust >/dev/null 2>&1
pg_ctl -D $DIR/data -l $DIR/log -o "-k $DIR -p 55436" start >/dev/null 2>&1
P="psql -h $DIR -p 55436 -U postgres -v ON_ERROR_STOP=1"

$P -c "CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE ROLE supabase_admin NOLOGIN; GRANT USAGE ON SCHEMA public TO anon, authenticated;" >/dev/null
$P -c "CREATE SCHEMA auth; CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS \$\$ SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb \$\$; GRANT USAGE ON SCHEMA auth TO anon, authenticated;" >/dev/null

TABLES="students parents offerings groups enrollments sessions attendance attendance_locks assessments grades conversations messages teacher_settings teacher_subjects faqs password_reset_tokens teacher_assistants assistant_invites action_audit_log alert_rules alerts notifications report_drafts weekly_digests subscriptions payments ai_usage_log whatsapp_sessions whatsapp_auth_creds whatsapp_auth_keys self_registration_tokens failed_messages"
for t in $TABLES auth_audit_log; do
  NULLABLE=""
  [ "$t" = "auth_audit_log" ] && NULLABLE="" || NULLABLE="NOT NULL"
  $P -c "CREATE TABLE $t (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID $NULLABLE);" >/dev/null
done
$P -c "CREATE TABLE teachers (id UUID PRIMARY KEY, auth_id UUID, name TEXT, phone TEXT, business_name TEXT, bio TEXT, subjects TEXT, address TEXT, city TEXT, country TEXT, timezone TEXT, whatsapp_number TEXT, telegram_username TEXT);" >/dev/null
$P -c "ALTER TABLE teacher_assistants ADD COLUMN assistant_id UUID;" >/dev/null
$P -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;" >/dev/null
$P -c "CREATE OR REPLACE FUNCTION public.exec_sql(sql text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS \$\$ BEGIN EXECUTE sql; END; \$\$;" >/dev/null

echo "=== apply (single transaction) ==="
$P --single-transaction -v ON_ERROR_STOP=1 -f database/migrations/023_stage3_rls_policies.sql > $DIR/apply.log 2>&1
apply_exit=$?
echo "apply_exit=$apply_exit errors=$(grep -ciE 'error|exception|fatal' $DIR/apply.log) drop_notices=$(grep -c 'NOTICE.*dropping policy' $DIR/apply.log)"
if [ "$apply_exit" -ne 0 ]; then grep -iE "error|exception|fatal" $DIR/apply.log | head -n 5; pg_ctl -D $DIR/data stop >/dev/null 2>&1; rm -rf $DIR; exit 1; fi

echo "=== probes ==="
$P -t <<'EOF'
SET ROLE authenticated;
SELECT 'setup-teachers' AS step;
RESET ROLE;
INSERT INTO teachers (id, name) VALUES ('11111111-1111-1111-1111-111111111111', 'A'), ('22222222-2222-2222-2222-222222222222', 'B');
INSERT INTO teacher_assistants (tenant_id, assistant_id) VALUES ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
-- A writes own row
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","tenant_id":"11111111-1111-1111-1111-111111111111","actor_id":"11111111-1111-1111-1111-111111111111","actor_role":"teacher"}';
INSERT INTO students (tenant_id) VALUES ('11111111-1111-1111-1111-111111111111') RETURNING tenant_id = '11111111-1111-1111-1111-111111111111' AS a_write_ok;
SELECT count(*) AS a_sees FROM students;
EOF
echo "--- anon sees nothing ---"
$P -t -c "SET ROLE anon; SELECT count(*) AS anon_sees FROM students;"
echo "--- B sees zero A rows, cannot write A ---"
$P -t <<'EOF'
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","tenant_id":"22222222-2222-2222-2222-222222222222","actor_id":"22222222-2222-2222-2222-222222222222","actor_role":"teacher"}';
SELECT count(*) AS b_sees_a FROM students;
INSERT INTO students (tenant_id) VALUES ('11111111-1111-1111-1111-111111111111');
EOF
echo "--- assistant denied on owner_only, allowed on uniform ---"
$P -t <<'EOF'
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","tenant_id":"11111111-1111-1111-1111-111111111111","actor_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","actor_role":"assistant"}';
SELECT count(*) AS asst_sees_junction FROM teacher_assistants;
SELECT count(*) AS asst_sees_students FROM students;
EOF
echo "--- owner on teachers: read own, update name ok, update id denied, stranger sees nothing ---"
$P -t <<'EOF'
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","tenant_id":"11111111-1111-1111-1111-111111111111","actor_id":"11111111-1111-1111-1111-111111111111","actor_role":"teacher"}';
SELECT count(*) AS owner_reads_own FROM teachers;
UPDATE teachers SET name = 'A2' WHERE id = '11111111-1111-1111-1111-111111111111' RETURNING name AS renamed_ok;
UPDATE teachers SET id = '33333333-3333-3333-3333-333333333333' WHERE id = '11111111-1111-1111-1111-111111111111';
EOF
$P -t <<'EOF'
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","tenant_id":"22222222-2222-2222-2222-222222222222","actor_id":"22222222-2222-2222-2222-222222222222","actor_role":"teacher"}';
SELECT count(*) AS stranger_sees_a FROM teachers WHERE id = '11111111-1111-1111-1111-111111111111';
EOF
echo "=== catalog proof ==="
$P -t -c "SELECT COUNT(*) AS n FROM pg_policy WHERE polname = 'tenant_isolation' AND polpermissive AND polcmd = '*';"
$P -t -c "SELECT COUNT(*) AS n FROM pg_policy WHERE polname = 'tenant_readonly' AND polcmd = 'r' AND polpermissive;"
$P -t -c "SELECT COUNT(*) AS n FROM pg_policy WHERE polname = 'owner_only' AND NOT polpermissive;"
$P -t -c "SELECT t.tablename, COUNT(p.policyname) AS n FROM pg_tables t LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = t.tablename WHERE t.schemaname = 'public' AND t.tablename IN ('auth_audit_log','password_reset_tokens','whatsapp_auth_creds','whatsapp_auth_keys') GROUP BY 1 ORDER BY 1;"
pg_ctl -D $DIR/data stop >/dev/null 2>&1
rm -rf $DIR
echo "=== harness done ==="
