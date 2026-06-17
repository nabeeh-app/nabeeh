#!/usr/bin/env bash
# Competitor AEO/SEO audit script
# Usage: bash scripts/competitor-audit.sh
# Outputs JSON files per competitor in /tmp/competitor-audits/

set -uo pipefail

OUTDIR="/tmp/competitor-audits"
mkdir -p "$OUTDIR"

COMPETITORS=(
  "teachngo|https://www.teachngo.com|Teach n Go"
  "tutorbird|https://www.tutorbird.com|TutorBird"
  "wise|https://www.wise.live|Wise"
  "tutorbase|https://tutorbase.com|Tutorbase"
  "autowhat|https://www.autowhat.app|AutoWhat"
)

green() { printf "\033[32m✓ %s\033[0m\n" "$1"; }
red()   { printf "\033[31m✗ %s\033[0m\n" "$1"; }
header(){ printf "\n\033[1m=== %s ===\033[0m\n" "$1"; }

for entry in "${COMPETITORS[@]}"; do
  IFS='|' read -r slug url name <<< "$entry"
  header "Auditing: $name ($url)"

  HTML=$(curl -sfL --max-time 15 "$url" 2>/dev/null) || { red "Failed to fetch $url"; continue; }

  # Extract JSON-LD schemas
  SCHEMAS=$(echo "$HTML" | grep -oP '(?<=type="application/ld\+json">).*?(?=</script>)' 2>/dev/null || true)
  SCHEMA_COUNT=$(echo "$SCHEMAS" | grep -c '@type' 2>/dev/null || echo 0)

  # Extract schema types
  SCHEMA_TYPES=""
  if [ "$SCHEMA_COUNT" -gt 0 ]; then
    SCHEMA_TYPES=$(echo "$SCHEMAS" | grep -oP '"@type"\s*:\s*"[^"]*"' | sed 's/"@type"\s*:\s*"//' | sed 's/"$//' | tr '\n' ', ' | sed 's/,$//')
  fi

  # Extract OG tags
  OG_TITLE=$(echo "$HTML" | grep -oP 'property="og:title" content="[^"]*"' | head -1 | sed 's/property="og:title" content="//' | sed 's/"$//' || true)
  OG_DESC=$(echo "$HTML" | grep -oP 'property="og:description" content="[^"]*"' | head -1 | sed 's/property="og:description" content="//' | sed 's/"$//' || true)
  OG_IMAGE=$(echo "$HTML" | grep -oP 'property="og:image" content="[^"]*"' | head -1 | sed 's/property="og:image" content="//' | sed 's/"$//' || true)
  OG_TYPE=$(echo "$HTML" | grep -oP 'property="og:type" content="[^"]*"' | head -1 | sed 's/property="og:type" content="//' | sed 's/"$//' || true)

  # Twitter card
  TWITTER_CARD=$(echo "$HTML" | grep -oP 'name="twitter:card" content="[^"]*"' | head -1 | sed 's/name="twitter:card" content="//' | sed 's/"$//' || true)

  # Canonical
  CANONICAL=$(echo "$HTML" | grep -oP 'rel="canonical" href="[^"]*"' | head -1 | sed 's/rel="canonical" href="//' | sed 's/"$//' || true)

  # Hreflang
  HREFLANG_EN=$(echo "$HTML" | grep -ioP 'hreflang="en"' | head -1 || true)
  HREFLANG_AR=$(echo "$HTML" | grep -ioP 'hreflang="ar"' | head -1 || true)

  # Heading count
  H1_COUNT=$(echo "$HTML" | grep -coP '<h1[^>]*>' || echo 0)
  H2_COUNT=$(echo "$HTML" | grep -coP '<h2[^>]*>' || echo 0)

  # FAQ presence (text-based)
  FAQ_SECTIONS=$(echo "$HTML" | grep -ciP 'faq|frequently.asked' || echo 0)

  # Comparison tables
  TABLE_COUNT=$(echo "$HTML" | grep -coP '<table[^>]*>' || echo 0)

  # Content word count (approximate)
  TEXT_CONTENT=$(echo "$HTML" | sed 's/<[^>]*>//g' | tr -s '[:space:]' '\n' | wc -l)

  # Feature lists
  UL_COUNT=$(echo "$HTML" | grep -coP '<ul[^>]*>' || echo 0)
  OL_COUNT=$(echo "$HTML" | grep -coP '<ol[^>]*>' || echo 0)

  green "Schemas: $SCHEMA_COUNT ($SCHEMA_TYPES)"
  green "OG title: ${OG_TITLE:0:60}$([ ${#OG_TITLE} -gt 60 ] && echo '...')"
  green "OG image: $([ -n "$OG_IMAGE" ] && echo 'present' || echo 'MISSING')"
  green "Twitter card: $([ -n "$TWITTER_CARD" ] && echo "$TWITTER_CARD" || echo 'MISSING')"
  green "Canonical: $([ -n "$CANONICAL" ] && echo "$CANONICAL" || echo 'MISSING')"
  green "H1: $H1_COUNT, H2: $H2_COUNT"
  green "FAQ sections: $FAQ_SECTIONS, Tables: $TABLE_COUNT"
  green "Lists: UL=$UL_COUNT, OL=$OL_COUNT, ~words=$TEXT_CONTENT"

  # Write JSON report
  cat > "$OUTDIR/${slug}.json" << ENDJSON
{
  "name": "$name",
  "url": "$url",
  "schemas": {
    "count": $SCHEMA_COUNT,
    "types": "$SCHEMA_TYPES"
  },
  "og": {
    "title": "$(echo "$OG_TITLE" | sed 's/"/\\"/g')",
    "description": "$(echo "$OG_DESC" | sed 's/"/\\"/g' | head -c 200)",
    "image": "$OG_IMAGE",
    "type": "$OG_TYPE"
  },
  "twitter": {
    "card": "$TWITTER_CARD"
  },
  "canonical": "$CANONICAL",
  "hreflang": {
    "en": $([ -n "$HREFLANG_EN" ] && echo true || echo false),
    "ar": $([ -n "$HREFLANG_AR" ] && echo true || echo false)
  },
  "headings": {
    "h1": $H1_COUNT,
    "h2": $H2_COUNT
  },
  "content": {
    "faqSections": $FAQ_SECTIONS,
    "tables": $TABLE_COUNT,
    "unorderedLists": $UL_COUNT,
    "orderedLists": $OL_COUNT,
    "approxWords": $TEXT_CONTENT
  }
}
ENDJSON

  green "Report saved to $OUTDIR/${slug}.json"
done

header "All audits complete. Reports in $OUTDIR/"
