#!/usr/bin/env bash
# SEO & AEO validation script for nabeeh.app
# Usage: bash scripts/seo-test.sh [base_url]
# Default base_url: https://nabeeh.app

set -uo pipefail

BASE_URL="${1:-https://nabeeh.app}"
EN_URL="${BASE_URL}/en"
ERRORS=0
WARNINGS=0

green() { printf "\033[32m✓ %s\033[0m\n" "$1"; }
red()   { printf "\033[31m✗ %s\033[0m\n" "$1"; ((ERRORS++)); }
yellow(){ printf "\033[33m⚠ %s\033[0m\n" "$1"; ((WARNINGS++)); }
header(){ printf "\n\033[1m=== %s ===\033[0m\n" "$1"; }

# Fetch the landing page HTML
HTML=$(curl -sfL "$EN_URL" 2>/dev/null) || { red "Failed to fetch $EN_URL"; exit 1; }

# ─── 1. JSON-LD Schema Validation ────────────────────────────────────────────

header "JSON-LD Schema Validation"

# Extract JSON-LD blocks (handles both single-line and multi-line)
# Strategy: extract everything between <script type="application/ld+json"> and </script>
TMPFILE=$(mktemp)
echo "$HTML" | grep -oP '(?<=type="application/ld\+json">).*?(?=</script>)' > "$TMPFILE" 2>/dev/null || true

# Also try multi-line extraction if single-line found nothing
if [ ! -s "$TMPFILE" ]; then
  echo "$HTML" | sed -n '/<script type="application\/ld+json">/,/<\/script>/p' \
    | sed 's/<script type="application\/ld+json">//' | sed 's/<\/script>//' \
    | sed '/^$/d' > "$TMPFILE"
fi

BLOCK_COUNT=$(wc -l < "$TMPFILE" | tr -d ' ')

if [ "$BLOCK_COUNT" -eq 0 ]; then
  red "No JSON-LD blocks found"
  rm -f "$TMPFILE"
else
  BLOCK_INDEX=0
  while IFS= read -r block; do
    [ -z "$block" ] && continue
    BLOCK_INDEX=$((BLOCK_INDEX + 1))

    # Validate JSON
    if ! echo "$block" | jq empty 2>/dev/null; then
      red "JSON-LD block #${BLOCK_INDEX}: Invalid JSON"
      continue
    fi

    TYPE=$(echo "$block" | jq -r '."@type" // "MISSING"')
    if [ "$TYPE" = "MISSING" ]; then
      red "JSON-LD block #${BLOCK_INDEX}: Missing @type"
      continue
    fi

    # Check required fields per type
    case "$TYPE" in
      Organization)
        HAS_NAME=$(echo "$block" | jq -r '.name // empty')
        HAS_URL=$(echo "$block" | jq -r '.url // empty')
        [ -z "$HAS_NAME" ] && red "Organization #${BLOCK_INDEX}: missing .name"
        [ -z "$HAS_URL" ] && red "Organization #${BLOCK_INDEX}: missing .url"
        [ -n "$HAS_NAME" ] && [ -n "$HAS_URL" ] && green "Organization: valid (name, url)"
        ;;
      SoftwareApplication)
        HAS_NAME=$(echo "$block" | jq -r '.name // empty')
        HAS_URL=$(echo "$block" | jq -r '.url // empty')
        HAS_CAT=$(echo "$block" | jq -r '.applicationCategory // empty')
        [ -z "$HAS_NAME" ] && red "SoftwareApplication #${BLOCK_INDEX}: missing .name"
        [ -z "$HAS_URL" ] && red "SoftwareApplication #${BLOCK_INDEX}: missing .url"
        [ -z "$HAS_CAT" ] && yellow "SoftwareApplication #${BLOCK_INDEX}: missing .applicationCategory"
        [ -n "$HAS_NAME" ] && [ -n "$HAS_URL" ] && green "SoftwareApplication: valid (name, url, category=$HAS_CAT)"
        ;;
      FAQPage)
        ENTITY_COUNT=$(echo "$block" | jq '.mainEntity | length // 0')
        if [ "$ENTITY_COUNT" -eq 0 ]; then
          red "FAQPage #${BLOCK_INDEX}: missing or empty .mainEntity"
        else
          MISSING_ANSWERS=0
          for i in $(seq 0 $((ENTITY_COUNT - 1))); do
            Q_NAME=$(echo "$block" | jq -r ".mainEntity[$i].name // empty")
            A_TEXT=$(echo "$block" | jq -r ".mainEntity[$i].acceptedAnswer.text // empty")
            [ -z "$Q_NAME" ] && red "FAQPage #${BLOCK_INDEX}[$i]: missing question .name"
            [ -z "$A_TEXT" ] && red "FAQPage #${BLOCK_INDEX}[$i]: missing answer .text"
            [ -n "$Q_NAME" ] && [ -n "$A_TEXT" ] && MISSING_ANSWERS=$((MISSING_ANSWERS + 1))
          done
          green "FAQPage: valid ($ENTITY_COUNT questions, $MISSING_ANSWERS with answers)"
        fi
        ;;
      WebSite)
        HAS_NAME=$(echo "$block" | jq -r '.name // empty')
        HAS_URL=$(echo "$block" | jq -r '.url // empty')
        [ -z "$HAS_NAME" ] && red "WebSite #${BLOCK_INDEX}: missing .name"
        [ -z "$HAS_URL" ] && red "WebSite #${BLOCK_INDEX}: missing .url"
        [ -n "$HAS_NAME" ] && [ -n "$HAS_URL" ] && green "WebSite: valid"
        ;;
      WebPage)
        HAS_NAME=$(echo "$block" | jq -r '.name // empty')
        HAS_SPEAKABLE=$(echo "$block" | jq -r '.speakable // empty')
        [ -z "$HAS_NAME" ] && red "WebPage #${BLOCK_INDEX}: missing .name"
        [ -z "$HAS_SPEAKABLE" ] && yellow "WebPage #${BLOCK_INDEX}: missing .speakable"
        [ -n "$HAS_NAME" ] && green "WebPage: valid (name, speakable=$([ -n "$HAS_SPEAKABLE" ] && echo yes || echo no))"
        ;;
      HowTo)
        HAS_NAME=$(echo "$block" | jq -r '.name // empty')
        STEP_COUNT=$(echo "$block" | jq '.step | length // 0')
        [ -z "$HAS_NAME" ] && red "HowTo #${BLOCK_INDEX}: missing .name"
        [ "$STEP_COUNT" -eq 0 ] && red "HowTo #${BLOCK_INDEX}: missing or empty .step"
        [ -n "$HAS_NAME" ] && [ "$STEP_COUNT" -gt 0 ] && green "HowTo: valid ($STEP_COUNT steps)"
        ;;
      ItemList)
        ITEM_COUNT=$(echo "$block" | jq '.itemListElement | length // 0')
        [ "$ITEM_COUNT" -eq 0 ] && red "ItemList #${BLOCK_INDEX}: missing or empty .itemListElement"
        [ "$ITEM_COUNT" -gt 0 ] && green "ItemList: valid ($ITEM_COUNT items)"
        ;;
      BreadcrumbList)
        ITEM_COUNT=$(echo "$block" | jq '.itemListElement | length // 0')
        [ "$ITEM_COUNT" -eq 0 ] && red "BreadcrumbList #${BLOCK_INDEX}: missing or empty .itemListElement"
        [ "$ITEM_COUNT" -gt 0 ] && green "BreadcrumbList: valid ($ITEM_COUNT items)"
        ;;
      *)
        yellow "Unknown schema type: $TYPE"
        ;;
    esac
  done < "$TMPFILE"
  green "Found $BLOCK_INDEX JSON-LD blocks total"
  rm -f "$TMPFILE"
fi

# ─── 2. OpenGraph Meta Tags ─────────────────────────────────────────────────

header "OpenGraph Meta Tags"

for prop in "og:title" "og:description" "og:image" "og:url" "og:type"; do
  VALUE=$(echo "$HTML" | grep -oP "property=\"${prop}\" content=\"[^\"]*\"" | head -1 | sed "s/property=\"${prop}\" content=\"//" | sed 's/"$//' || true)
  if [ -z "$VALUE" ]; then
    yellow "Missing <meta $prop> (may be rendered client-side by Next.js)"
  else
    if [ "$prop" = "og:image" ] || [ "$prop" = "og:url" ]; then
      if [[ "$VALUE" != http* ]]; then
        red "$prop is relative: '$VALUE' (should be absolute URL)"
      else
        green "$prop: $VALUE"
      fi
    else
      green "$prop: ${VALUE:0:60}$([ ${#VALUE} -gt 60 ] && echo '...')"
    fi
  fi
done

# ─── 3. Twitter Card ────────────────────────────────────────────────────────

header "Twitter Card"

for name in "twitter:card" "twitter:title" "twitter:description" "twitter:image"; do
  VALUE=$(echo "$HTML" | grep -oP "name=\"${name}\" content=\"[^\"]*\"" | head -1 | sed "s/name=\"${name}\" content=\"//" | sed 's/"$//' || true)
  if [ -z "$VALUE" ]; then
    yellow "Missing <meta $name>"
  else
    if [ "$name" = "twitter:image" ] && [[ "$VALUE" != http* ]]; then
      red "$name is relative: '$VALUE'"
    else
      green "$name: $VALUE"
    fi
  fi
done

# ─── 4. Canonical & Hreflang ────────────────────────────────────────────────

header "Canonical & Hreflang"

CANONICAL=$(echo "$HTML" | grep -oP 'rel="canonical" href="[^"]*"' | sed 's/rel="canonical" href="//' | sed 's/"$//' || true)
if [ -z "$CANONICAL" ]; then
  red "Missing canonical link"
else
  green "Canonical: $CANONICAL"
fi

for lang in "en" "ar"; do
  HREF=$(echo "$HTML" | grep -ioP "hrefLang=\"${lang}\" href=\"[^\"]*\"" | head -1 | sed "s/.*href=\"//" | sed 's/"$//' || true)
  if [ -z "$HREF" ]; then
    red "Missing hreflang=$lang"
  else
    green "hreflang=$lang: $HREF"
  fi
done

# ─── 5. Robots.txt ──────────────────────────────────────────────────────────

header "Robots.txt"

ROBOTS_STATUS=$(curl -so /dev/null -w "%{http_code}" "${BASE_URL}/robots.txt" 2>/dev/null)
if [ "$ROBOTS_STATUS" = "200" ]; then
  green "robots.txt returns 200"
  ROBOTS_CONTENT=$(curl -sfL "${BASE_URL}/robots.txt" 2>/dev/null)
  ALLOW_COUNT=$(echo "$ROBOTS_CONTENT" | grep -c "^Allow:" || true)
  DISALLOW_COUNT=$(echo "$ROBOTS_CONTENT" | grep -c "^Disallow:" || true)
  green "  Allow: $ALLOW_COUNT, Disallow: $DISALLOW_COUNT rules"
else
  red "robots.txt returns $ROBOTS_STATUS (expected 200)"
fi

# ─── 6. Sitemap ─────────────────────────────────────────────────────────────

header "Sitemap.xml"

SITEMAP_STATUS=$(curl -so /dev/null -w "%{http_code}" "${BASE_URL}/sitemap.xml" 2>/dev/null)
if [ "$SITEMAP_STATUS" = "200" ]; then
  green "sitemap.xml returns 200"
  SITEMAP_CONTENT=$(curl -sfL "${BASE_URL}/sitemap.xml" 2>/dev/null)
  URL_COUNT=$(echo "$SITEMAP_CONTENT" | grep -c "<loc>" || true)
  green "  Contains $URL_COUNT URLs"
else
  red "sitemap.xml returns $SITEMAP_STATUS (expected 200)"
fi

# ─── Summary ────────────────────────────────────────────────────────────────

header "Summary"
printf "Errors:   \033[31m%d\033[0m\n" "$ERRORS"
printf "Warnings: \033[33m%d\033[0m\n" "$WARNINGS"

if [ "$ERRORS" -eq 0 ]; then
  green "All checks passed!"
  exit 0
else
  red "Failed with $ERRORS error(s)"
  exit 1
fi
