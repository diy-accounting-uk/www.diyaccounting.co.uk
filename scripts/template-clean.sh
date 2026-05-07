#!/bin/bash
# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2025-2026 DIY Accounting Ltd
#
# template-clean.sh — Strip DIY Accounting-specific content, replace with placeholders
#
# This script prepares the repository for use as a generic template by replacing
# company-specific content with RFC 2606 placeholder values (site.example).
#
# WARNING: This destructively modifies files. Only run on a fresh clone intended
# for template use, never on the live DIY Accounting repository.
#
# Usage: ./scripts/template-clean.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================="
echo " Template Clean — DIY Accounting → Generic"
echo "=========================================="
echo ""
echo "This will replace DIY Accounting-specific content with placeholders."
echo "Project root: $PROJECT_ROOT"
echo ""

# Safety check
if [ -f "$PROJECT_ROOT/.template-cleaned" ]; then
  echo "ERROR: This repository has already been cleaned."
  echo "Run scripts/template-init.sh to apply your values."
  exit 1
fi

cd "$PROJECT_ROOT"

count=0

# Helper: portable sed in-place (macOS and Linux)
sedi() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
}

# Helper: replace in file and count
replace_in() {
  local file="$1" old="$2" new="$3"
  if [ -f "$file" ] && grep -qF "$old" "$file"; then
    sedi "s|${old}|${new}|g" "$file"
    count=$((count + 1))
  fi
}

echo "--- Replacing domains ---"
# Domain replacements across all text files
find "$PROJECT_ROOT" -type f \( \
  -name "*.html" -o -name "*.js" -o -name "*.css" -o -name "*.json" \
  -o -name "*.toml" -o -name "*.yml" -o -name "*.yaml" -o -name "*.txt" \
  -o -name "*.xml" -o -name "*.java" -o -name "*.sh" -o -name "*.cjs" \
  -o -name "*.md" -o -name ".prettierrc" -o -name ".editorconfig" \
  \) \
  -not -path "*/node_modules/*" \
  -not -path "*/target/*" \
  -not -path "*/.git/*" \
  -not -path "*/cdk-gateway.out/*" \
  -not -name "template-clean.sh" \
  -not -name "template-init.sh" \
  -print0 | while IFS= read -r -d '' file; do
    # Order matters: longest matches first
    sedi 's|spreadsheets\.diyaccounting\.co\.uk|feature-b.site.example|g' "$file"
    sedi 's|submit\.diyaccounting\.co\.uk|feature-a.site.example|g' "$file"
    sedi 's|www\.diyaccounting\.co\.uk|www.site.example|g' "$file"
    sedi 's|diyaccounting\.co\.uk|site.example|g' "$file"
    sedi 's|ci-submit\.|ci-feature-a.|g' "$file"
    sedi 's|ci-spreadsheets\.|ci-feature-b.|g' "$file"
    sedi 's|ci-gateway\.|ci-gateway.|g' "$file"
done
echo "  Domains replaced"

echo "--- Replacing company name ---"
for file in $(find "$PROJECT_ROOT" -type f \( \
  -name "*.html" -o -name "*.js" -o -name "*.json" \
  -o -name "*.md" -o -name "*.txt" \
  \) \
  -not -path "*/node_modules/*" \
  -not -path "*/target/*" \
  -not -path "*/.git/*" \
  -not -name "template-clean.sh" \
  -not -name "template-init.sh"); do
    sedi 's|DIY Accounting Limited|Example Company Ltd|g' "$file"
    sedi 's|DIY Accounting Ltd|Example Company Ltd|g' "$file"
    sedi 's|DIY Accounting Submit|Feature A|g' "$file"
    sedi 's|DIY Accounting Spreadsheets|Feature B|g' "$file"
    sedi 's|DIY Accounting|Example Company|g' "$file"
done
echo "  Company names replaced"

echo "--- Replacing GitHub scope ---"
for file in $(find "$PROJECT_ROOT" -type f \( \
  -name "*.json" -o -name "*.java" -o -name "*.yml" -o -name "*.yaml" \
  -o -name "*.md" -o -name "*.js" -o -name "*.cjs" \
  \) \
  -not -path "*/node_modules/*" \
  -not -path "*/target/*" \
  -not -path "*/.git/*" \
  -not -name "template-clean.sh" \
  -not -name "template-init.sh"); do
    sedi 's|@support-at-diyaccounting/www-diyaccounting-co-uk|@owner/www-site-example|g' "$file"
    sedi 's|@support-at-diyaccounting/www\.site\.example|@owner/www.site.example|g' "$file"
    sedi 's|support-at-diyaccounting/www\.site\.example|owner/www.site.example|g' "$file"
    sedi 's|support-at-diyaccounting|owner|g' "$file"
done
echo "  GitHub scope replaced"

echo "--- Replacing company-specific details ---"
# GA4 measurement ID
replace_in "$PROJECT_ROOT/web/www.site.example/public/lib/analytics.js" "G-C76HK806F1" "G-XXXXXXXXXX"
# Fallback if directory wasn't renamed yet
replace_in "$PROJECT_ROOT/web/www.diyaccounting.co.uk/public/lib/analytics.js" "G-C76HK806F1" "G-XXXXXXXXXX"

# Company number
for file in $(find "$PROJECT_ROOT/web" -name "*.html" 2>/dev/null); do
  sedi 's|06846849|00000000|g' "$file"
  sedi 's|find-and-update\.company-information\.service\.gov\.uk/company/00000000|example.com/company/00000000|g' "$file"
done

# AWS account ID placeholder (not the real one)
replace_in "$PROJECT_ROOT/cdk-gateway/cdk.json" "283165661847" "000000000000"

# Address and phone
for file in $(find "$PROJECT_ROOT/web" -name "*.html" 2>/dev/null); do
  sedi 's|37 Sutherland Avenue|1 Example Street|g' "$file"
  sedi 's|Leeds|Anytown|g' "$file"
  sedi 's|LS8 1BY|AB1 2CD|g' "$file"
  sedi 's|0845 0756015|0800 000 0000|g' "$file"
  sedi 's|+44 845 075 6015|+44 800 000 0000|g' "$file"
  sedi 's|+448450756015|+448000000000|g' "$file"
done

# Person names in about.html
for file in $(find "$PROJECT_ROOT/web" -name "about.html" 2>/dev/null); do
  sedi 's|Terry Cartwright|Jane Founder|g' "$file"
  sedi 's|Antony Cartwright|Director One|g' "$file"
  sedi 's|Jane Grundy|Director Two|g' "$file"
  sedi 's|Samantha Cartwright|Director Three|g' "$file"
  sedi 's|Antony, Jane, Samantha, Lindsey, and Daniel|the founding team|g' "$file"
done

# Person names in JSON-LD
for file in $(find "$PROJECT_ROOT/web" -name "*.html" 2>/dev/null); do
  sedi 's|Terry Cartwright|Jane Founder|g' "$file"
done

# security.txt
for file in $(find "$PROJECT_ROOT/web" -name "security.txt" 2>/dev/null); do
  sedi 's|https://site\.example/about\.html|https://site.example/about.html|g' "$file"
  sedi 's|2027-01-01|2099-01-01|g' "$file"
done

echo "  Company details replaced"

echo "--- Replacing redirects with generic examples ---"
REDIRECTS_FILE=$(find "$PROJECT_ROOT/web" -name "redirects.toml" 2>/dev/null | head -1)
if [ -n "$REDIRECTS_FILE" ]; then
  cat > "$REDIRECTS_FILE" << 'TOML'
# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2025-2026 Example Company Ltd
#
# redirects.toml - Redirect configuration
# Maps old URLs to new locations on feature sites
# Processed by scripts/build-gateway-redirects.cjs → redirect-function.js
#
# Targets:
#   "feature-b" → feature-b.site.example (ci: ci-feature-b.site.example)
#   "feature-a" → feature-a.site.example (ci: ci-feature-a.site.example)
#   "self"      → same host (internal redirect, no 301)

[[redirect]]
from = "/home.html"
to = "/"
target = "self"

[[redirect]]
from = "/old-page.html"
to = "/about.html"
target = "self"

[[redirect]]
from = "/legacy-feature.html"
to = "/"
target = "feature-a"

[[redirect]]
from = "/legacy-download.html"
to = "/download.html"
target = "feature-b"

[product_map]
LegacyProductA = "ProductA"
LegacyProductB = "ProductB"
TOML
  echo "  redirects.toml replaced with generic examples"
fi

echo "--- Replacing SPDX copyright in source files ---"
find "$PROJECT_ROOT" -type f \( \
  -name "*.js" -o -name "*.cjs" -o -name "*.java" -o -name "*.css" \
  -o -name "*.sh" -o -name "*.toml" \
  \) \
  -not -path "*/node_modules/*" \
  -not -path "*/target/*" \
  -not -path "*/.git/*" \
  -not -name "template-clean.sh" \
  -not -name "template-init.sh" \
  -print0 | while IFS= read -r -d '' file; do
    sedi 's|Copyright (C) 2025-2026 DIY Accounting Ltd|Copyright (C) YYYY Example Company Ltd|g' "$file"
    sedi 's|Copyright (C) 2025-2026 Example Company Ltd|Copyright (C) YYYY Example Company Ltd|g' "$file"
done
echo "  SPDX copyright placeholders applied"

# Mark as cleaned
touch "$PROJECT_ROOT/.template-cleaned"
echo "$PROJECT_ROOT/.template-cleaned" >> "$PROJECT_ROOT/.gitignore"

echo ""
echo "=========================================="
echo " Template clean complete"
echo "=========================================="
echo ""
echo "Next step: run ./scripts/template-init.sh to apply your values."
echo ""
