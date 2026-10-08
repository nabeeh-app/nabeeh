#!/bin/bash
# Grep-grade guard: every supabaseAdmin query in routes/ and lib/ must carry
# an owner predicate, a token binding, or a vetted reason in the allowlist.
# Usage: ./scripts/check-tenant-scope.sh
# Exit 1 lists unknown sites. Add new sites to tenant-scope-allowlist.txt
# only after verifying the handler scoping. Phase 4 pgTAP tests are the
# real gate; this script catches regressions early.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend" || exit 1
ALLOW="$ROOT/scripts/tenant-scope-allowlist.txt"
TMP=$(mktemp)
TMPKEYS=$(mktemp)
trap 'rm -f "$TMP" "$TMPKEYS"' EXIT
python3 - "$TMP" <<'EOF'
import re, glob, sys
out = open(sys.argv[1], 'w')
SCOPED = re.compile(r"teacher_id|teacherId|verify\w*Access|getEffectiveTeacherId|getTeacherId")
TOKEN = re.compile(r"eq\(\s*['\"](token|jti|whatsapp_message_id)['\"]|is\(\s*['\"]accepted_at")
for f in sorted(glob.glob('routes/*.js') + glob.glob('lib/*.js')):
    if '__tests__' in f:
        continue
    src = open(f).read()
    for m in re.finditer(r"supabaseAdmin\s*\n?\s*\.from\(\s*['\"](\w+)['\"]\s*\)", src):
        table = m.group(1)
        i, depth = m.end(), 0
        stmt = ''
        while i < len(src):
            ch = src[i]
            stmt += ch
            if ch in '([{':
                depth += 1
            elif ch in ')]}':
                depth -= 1
            elif ch == ';' and depth <= 0:
                break
            i += 1
            if len(stmt) > 3000:
                break
        verbs = sorted(set(re.findall(r"\.(select|insert|update|delete|upsert)\b", stmt)))
        verb = verbs[0] if verbs else '?'
        has_insert_teacher = ('insert' in verbs) and ('teacher_id' in stmt)
        if SCOPED.search(stmt) or TOKEN.search(stmt) or has_insert_teacher:
            continue
        filts = sorted(set(re.findall(r"\.(?:eq|neq|in|or|is)\(\s*['\"]([^'\"]+)['\"]", stmt)))
        lineno = src[:m.start()].count('\n') + 1
        out.write(f"{f}:{lineno} | {table} | {verb} | {'+'.join(filts[:6])}\n")
out.close()
EOF
cut -d'|' -f2- "$TMP" | sed 's/^ *//;s/ *$//' | sort -u > "$TMPKEYS"
# allowlist stores the same key shape: "table | verb | filters"
FAIL=0
while IFS= read -r key; do
  [ -z "$key" ] && continue
  if ! grep -qxF "$key" "$ALLOW" 2>/dev/null; then
    echo "UNLISTED: $key"
    grep -F "$key" "$TMP" | head -n 3
    FAIL=1
  fi
done < "$TMPKEYS"
if [ "$FAIL" = "1" ]; then
  echo "FAIL: unlisted admin queries above. Verify handler scoping, then append keys to scripts/tenant-scope-allowlist.txt"
  exit 1
fi
echo "tenant-scope OK"
