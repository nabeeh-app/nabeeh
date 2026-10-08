#!/bin/bash
# Cross-tenant matrix: teacher B exercises teacher A resources over ALL routes.
# Prints METHOD PATH => CODE. Anything 200 with A data is a leak.
# Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment.
# Creates throwaway mx_* accounts and fixtures, deletes them at the end.
# Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ./scripts/cross-tenant-matrix.sh [cleanup-only]
set -u
: "${SUPABASE_URL:?set SUPABASE_URL}" 
: "${SUPABASE_SERVICE_ROLE_KEY:?set SUPABASE_SERVICE_ROLE_KEY}"
BASE=http://localhost:5000
TS=$(date +%s)
AE="mx_a_$TS@nabeeh.app"; BE="mx_b_$TS@nabeeh.app"; PW="Test1234!"
j() { python3 -c "import json,sys; d=json.load(sys.stdin); print(d$1)" 2>/dev/null; }
code() { curl -s -m 25 -o /tmp/opencode/mbody.txt -w "%{http_code}" "$@"; echo " <= $(head -c 110 /tmp/opencode/mbody.txt)"; }

curl -s -m 20 -X POST $BASE/api/auth/register -H 'Content-Type: application/json' -d "{\"name\":\"mxa\",\"email\":\"$AE\",\"password\":\"$PW\"}" -o /dev/null
curl -s -m 20 -X POST $BASE/api/auth/register -H 'Content-Type: application/json' -d "{\"name\":\"mxb\",\"email\":\"$BE\",\"password\":\"$PW\"}" -o /dev/null
curl -s -m 20 -c /tmp/opencode/mA.txt -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$AE\",\"password\":\"$PW\"}" -o /dev/null
curl -s -m 20 -c /tmp/opencode/mB.txt -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$BE\",\"password\":\"$PW\"}" -o /dev/null
CA="-b /tmp/opencode/mA.txt -H X-CSRF-Token:$(grep -oP 'csrf_token\s+\K\S+' /tmp/opencode/mA.txt)"
CB="-b /tmp/opencode/mB.txt -H X-CSRF-Token:$(grep -oP 'csrf_token\s+\K\S+' /tmp/opencode/mB.txt)"
AID=$(curl -s -m 20 -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$AE\",\"password\":\"$PW\"}" | j "['data']['teacher']['id']")
export SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY
H1="apikey: $SUPABASE_SERVICE_ROLE_KEY"; H2="Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
SROW=$(curl -s -H "$H1" -H "$H2" "$SUPABASE_URL/rest/v1/subjects?select=id,code&limit=1"); S=$(echo "$SROW" | j "[0]['id']"); SCODE=$(echo "$SROW" | j "[0]['code']")
G=$(curl -s -H "$H1" -H "$H2" "$SUPABASE_URL/rest/v1/grade_levels?select=id&limit=1" | j "[0]['id']")
[ -z "$S" ] && { S=$(curl -s -X POST -H "$H1" -H "$H2" -H 'Content-Type: application/json' -H 'Prefer: return=representation' "$SUPABASE_URL/rest/v1/subjects" -d '{"code":"MX","name_en":"mx","name_ar":"mx"}' | j "[0]['id']"); echo "seeded subject"; }
[ -z "$G" ] && { G=$(curl -s -X POST -H "$H1" -H "$H2" -H 'Content-Type: application/json' -H 'Prefer: return=representation' "$SUPABASE_URL/rest/v1/grade_levels" -d '{"name":"mx grade"}' | j "[0]['id']"); echo "seeded grade_level"; }
O=$(curl -s -m 20 $CA -X POST $BASE/api/offerings -H 'Content-Type: application/json' -d "{\"subject_id\":\"$S\",\"grade_level_id\":\"$G\",\"academic_year\":\"2026\"}" | j "['data']['id']")
GR=$(curl -s -m 20 $CA -X POST $BASE/api/offerings/$O/groups -H 'Content-Type: application/json' -d '{"name":"mx group"}' | j "['data']['id']")
ST=$(curl -s -m 20 $CA -X POST $BASE/api/students -H 'Content-Type: application/json' -d "{\"name\":\"mx student\",\"group_id\":\"$GR\"}" | j "['data']['id']")
[ -z "$ST" ] && ST=$(curl -s -m 20 $CA -X POST $BASE/api/students -H 'Content-Type: application/json' -d "{\"name\":\"mx student\",\"group_id\":\"$GR\"}" | j "['data']['student']['id']")
PA=$(curl -s -m 20 $CA -X POST $BASE/api/parents -H 'Content-Type: application/json' -d "{\"student_id\":\"$ST\",\"name\":\"mx parent\",\"phone\":\"+201000000001\",\"relationship\":\"father\"}" | j "['data']['id']")
GRD=$(curl -s -m 20 $CA -X POST $BASE/api/grades -H 'Content-Type: application/json' -d "{\"student_id\":\"$ST\",\"subject\":\"mx\",\"assessment_name\":\"mx quiz\",\"score\":80,\"max_score\":100}" | j "['data']['id']")
ASM=$(curl -s -H "$H1" -H "$H2" "$SUPABASE_URL/rest/v1/grades?select=assessment_id&id=eq.$GRD&limit=1" | j "[0]['assessment_id']")
SESS=$(curl -s -X POST -H "$H1" -H "$H2" -H 'Content-Type: application/json' -H 'Prefer: return=representation' "$SUPABASE_URL/rest/v1/sessions" -d "{\"group_id\":\"$GR\",\"date\":\"2026-10-08\"}" | j "[0]['id']")
AR=$(curl -s -m 20 $CA -X POST $BASE/api/alerts/rules -H 'Content-Type: application/json' -d '{"alert_type":"grade_threshold","threshold_value":50,"comparison":"lt"}' | j "['data']['id']")
echo "FIX: O=$O GR=$GR ST=$ST PA=$PA GRD=$GRD ASM=$ASM SESS=$SESS AR=$AR" | cut -c1-200
echo "$O $GR $ST $PA $GRD $ASM $SESS $AR $AID" > /tmp/opencode/mx.txt
echo "=== B attacks A resources (expect 404/empty/403, never 200+A-data) ==="
printf "GET students/:id => "; code $CB $BASE/api/students/$ST; echo
printf "PUT students/:id => "; code $CB -H 'Content-Type: application/json' -X PUT $BASE/api/students/$ST -d '{"name":"pwned"}'; echo
printf "DELETE students/:id => "; code $CB -X DELETE $BASE/api/students/$ST; echo
printf "GET parents/:id => "; code $CB $BASE/api/parents/$PA; echo
printf "PUT parents/:id => "; code $CB -H 'Content-Type: application/json' -X PUT $BASE/api/parents/$PA -d '{"name":"pwned"}'; echo
printf "DELETE parents/:id => "; code $CB -X DELETE $BASE/api/parents/$PA; echo
printf "GET offerings/:id => "; code $CB $BASE/api/offerings/$O; echo
printf "PUT offerings-group => "; code $CB -H 'Content-Type: application/json' -X PUT $BASE/api/offerings/$O/groups/$GR -d '{"name":"pwned"}'; echo
printf "POST grades => "; code $CB -H 'Content-Type: application/json' -X POST $BASE/api/grades -d "{\"student_id\":\"$ST\",\"subject\":\"mx\",\"assessment_name\":\"q\",\"score\":10,\"max_score\":100}"; echo
printf "PUT grades/:id => "; code $CB -H 'Content-Type: application/json' -X PUT $BASE/api/grades/$GRD -d '{"score":10}'; echo
printf "DELETE grades/:id => "; code $CB -X DELETE $BASE/api/grades/$GRD; echo
printf "POST attendance => "; code $CB -H 'Content-Type: application/json' -X POST $BASE/api/attendance -d "{\"date\":\"2026-10-08\",\"attendance_records\":[{\"student_id\":\"$ST\",\"group_id\":\"$GR\",\"status\":\"present\"}]}"; echo
printf "POST lock => "; code $CB -H 'Content-Type: application/json' -X POST $BASE/api/attendance/lock -d "{\"session_id\":\"$SESS\",\"student_id\":\"$ST\"}"; echo
printf "GET lock => "; code $CB $BASE/api/attendance/lock/$SESS/$ST; echo
printf "POST import/execute => "; code $CB -H 'Content-Type: application/json' -X POST $BASE/api/import/execute -d "{\"fieldMapping\":{\"name\":\"name\"},\"rows\":[{\"name\":\"x\"}],\"groupId\":\"$GR\"}"; echo
printf "GET gradeAnalysis/dist => "; code $CB $BASE/api/grade-analysis/distribution/$ASM; echo
printf "POST reports/comment => "; code $CB -H 'Content-Type: application/json' -X POST $BASE/api/reports/generate-comment -d "{\"student_id\":\"$ST\"}"; echo
BO=$(curl -s -m 20 $CB -X POST $BASE/api/offerings -H 'Content-Type: application/json' -d "{\"subject_id\":\"$S\",\"grade_level_id\":\"$G\",\"academic_year\":\"2026\"}" | j "['data']['id']")
BG=$(curl -s -m 20 $CB -X POST $BASE/api/offerings/$BO/groups -H 'Content-Type: application/json' -d '{"name":"mx b group"}' | j "['data']['id']")
BST=$(curl -s -m 20 $CB -X POST $BASE/api/students -H 'Content-Type: application/json' -d "{\"name\":\"mx b student\",\"group_id\":\"$BG\"}" | j "['data']['id']")
[ -z "$BST" ] && BST=$(curl -s -m 20 $CB -X POST $BASE/api/students -H 'Content-Type: application/json' -d "{\"name\":\"mx b student\",\"group_id\":\"$BG\"}" | j "['data']['student']['id']")
printf "POST reports/comment B-student A-group => "; code $CB -H 'Content-Type: application/json' -X POST $BASE/api/reports/generate-comment -d "{\"student_id\":\"$BST\",\"group_id\":\"$GR\"}"; echo
printf "PUT alerts-rule => "; code $CB -H 'Content-Type: application/json' -X PUT $BASE/api/alerts/rules/$AR -d '{"threshold_value":10}'; echo
printf "DELETE alerts-rule => "; code $CB -X DELETE $BASE/api/alerts/rules/$AR; echo
printf "GET conversations => "; code $CB $BASE/api/messages/conversations; echo
printf "GET whatsapp-status => "; code $CB $BASE/api/whatsapp/status; echo
printf "GET teachers/profile => "; code $CB $BASE/api/teachers/profile; echo
