#!/bin/bash
# SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
# Copyright (C) 2006-2026 DIY Accounting Limited
#
# template-init.sh — Apply real values to a cleaned template repository
#
# Run this after template-clean.sh to replace placeholder values with your
# actual domain, company name, AWS account, and Java package details.
#
# Usage: ./scripts/template-init.sh
#        ./scripts/template-init.sh --non-interactive (uses env vars)
#
# Environment variables for non-interactive mode:
#   TEMPLATE_DOMAIN          — e.g. "spreadsheets.example.com"
#   TEMPLATE_COMPANY         — e.g. "Acme Corp Ltd"
#   TEMPLATE_GITHUB_OWNER    — e.g. "acmecorp"
#   TEMPLATE_AWS_ACCOUNT_ID  — e.g. "123456789012"
#   TEMPLATE_JAVA_PACKAGE    — e.g. "com.example.spreadsheets"
#   TEMPLATE_CDK_PREFIX      — e.g. "spreadsheets"
#   TEMPLATE_COPYRIGHT_YEAR  — e.g. "2026" (defaults to current year)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

NON_INTERACTIVE=false
if [[ "${1:-}" == "--non-interactive" ]]; then
  NON_INTERACTIVE=true
fi

echo "=========================================="
echo " Template Init — Apply Your Values"
echo "=========================================="
echo ""

# Check template-clean was run
if [ ! -f "$PROJECT_ROOT/.template-cleaned" ]; then
  echo "ERROR: Run scripts/template-clean.sh first."
  exit 1
fi

cd "$PROJECT_ROOT"

# Portable sed in-place
sedi() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
}

# Prompt helper
prompt() {
  local var_name="$1" prompt_text="$2" default="$3" env_var="${4:-}"
  if $NON_INTERACTIVE && [ -n "$env_var" ] && [ -n "${!env_var:-}" ]; then
    eval "$var_name=\"${!env_var}\""
    echo "  $prompt_text: ${!var_name}"
    return
  fi
  read -r -p "  $prompt_text [$default]: " value
  eval "$var_name=\"${value:-$default}\""
}

CURRENT_YEAR=$(date +%Y)

echo "Enter your values (press Enter for defaults):"
echo ""
prompt DOMAIN "Domain name" "mysite.example.com" "TEMPLATE_DOMAIN"
prompt COMPANY "Company name" "My Company Ltd" "TEMPLATE_COMPANY"
prompt GITHUB_OWNER "GitHub owner" "myorg" "TEMPLATE_GITHUB_OWNER"
prompt AWS_ACCOUNT "AWS account ID" "000000000000" "TEMPLATE_AWS_ACCOUNT_ID"
prompt JAVA_PKG "Java package" "com.example.mysite" "TEMPLATE_JAVA_PACKAGE"
prompt CDK_PREFIX "CDK prefix (short name)" "mysite" "TEMPLATE_CDK_PREFIX"
prompt COPYRIGHT_YEAR "Copyright start year" "$CURRENT_YEAR" "TEMPLATE_COPYRIGHT_YEAR"

# Derived values
NAKED_DOMAIN="${DOMAIN#www.}"
CDK_PREFIX_UPPER="$(echo "$CDK_PREFIX" | sed 's/.*/\u&/')"  # Capitalise first letter
CDK_PREFIX_UPPER="$(echo "$CDK_PREFIX" | awk '{print toupper(substr($0,1,1)) substr($0,2)}')"
JAVA_PKG_DIR="$(echo "$JAVA_PKG" | tr '.' '/')"
NPM_NAME="@${GITHUB_OWNER}/$(echo "$DOMAIN" | tr '.' '-')"
SHORT_COMPANY="${COMPANY% Ltd}"
SHORT_COMPANY="${SHORT_COMPANY% Limited}"

echo ""
echo "Derived values:"
echo "  Naked domain:  $NAKED_DOMAIN"
echo "  CDK class:     ${CDK_PREFIX_UPPER}Stack, ${CDK_PREFIX_UPPER}Environment"
echo "  Java package:  $JAVA_PKG (dir: $JAVA_PKG_DIR)"
echo "  npm name:      $NPM_NAME"
echo ""

if ! $NON_INTERACTIVE; then
  read -r -p "Proceed? [Y/n]: " confirm
  if [[ "${confirm:-Y}" =~ ^[Nn] ]]; then
    echo "Aborted."
    exit 0
  fi
fi

echo ""
echo "--- Applying domain replacements ---"
find "$PROJECT_ROOT" -type f \( \
  -name "*.html" -o -name "*.js" -o -name "*.cjs" -o -name "*.css" \
  -o -name "*.json" -o -name "*.toml" -o -name "*.yml" -o -name "*.yaml" \
  -o -name "*.txt" -o -name "*.xml" -o -name "*.java" -o -name "*.sh" \
  -o -name "*.md" -o -name ".prettierrc" \
  \) \
  -not -path "*/node_modules/*" \
  -not -path "*/target/*" \
  -not -path "*/.git/*" \
  -not -name "template-init.sh" \
  -not -name "template-clean.sh" \
  -print0 | while IFS= read -r -d '' file; do
    sedi "s|feature-b\.site\.example|feature-b.${NAKED_DOMAIN}|g" "$file"
    sedi "s|feature-a\.site\.example|feature-a.${NAKED_DOMAIN}|g" "$file"
    sedi "s|www\.site\.example|www.${NAKED_DOMAIN}|g" "$file"
    sedi "s|site\.example|${NAKED_DOMAIN}|g" "$file"
    sedi "s|ci-feature-a\.|ci-feature-a.|g" "$file"
    sedi "s|ci-feature-b\.|ci-feature-b.|g" "$file"
    sedi "s|Example Company Ltd|${COMPANY}|g" "$file"
    sedi "s|Example Company|${SHORT_COMPANY}|g" "$file"
    sedi "s|@owner/www-site-example|${NPM_NAME}|g" "$file"
    sedi "s|@owner|@${GITHUB_OWNER}|g" "$file"
    sedi "s|owner/www\.${NAKED_DOMAIN}|${GITHUB_OWNER}/www.${NAKED_DOMAIN}|g" "$file"
    sedi "s|owner|${GITHUB_OWNER}|g" "$file"
    sedi "s|000000000000|${AWS_ACCOUNT}|g" "$file"
    sedi "s|Copyright (C) YYYY|Copyright (C) ${COPYRIGHT_YEAR}|g" "$file"
done
echo "  Text replacements complete"

echo "--- Renaming Java packages ---"
OLD_JAVA_DIR="$PROJECT_ROOT/infra/main/java/co/uk/diyaccounting/gateway"
NEW_JAVA_DIR="$PROJECT_ROOT/infra/main/java/${JAVA_PKG_DIR}"

if [ -d "$OLD_JAVA_DIR" ]; then
  mkdir -p "$NEW_JAVA_DIR/stacks"
  mkdir -p "$NEW_JAVA_DIR/utils"

  # Rename and update class files
  for java_file in $(find "$OLD_JAVA_DIR" -name "*.java" -type f); do
    filename=$(basename "$java_file")
    # Replace Gateway prefix with CDK prefix
    new_filename=$(echo "$filename" | sed "s|Gateway|${CDK_PREFIX_UPPER}|g")
    # Determine target subdirectory
    rel_dir=$(dirname "$java_file" | sed "s|${OLD_JAVA_DIR}||")
    target_dir="${NEW_JAVA_DIR}${rel_dir}"
    mkdir -p "$target_dir"

    # Copy and update package/imports
    cp "$java_file" "$target_dir/$new_filename"
    sedi "s|co\.uk\.diyaccounting\.gateway|${JAVA_PKG}|g" "$target_dir/$new_filename"
    sedi "s|Gateway|${CDK_PREFIX_UPPER}|g" "$target_dir/$new_filename"
    sedi "s|gateway|${CDK_PREFIX}|g" "$target_dir/$new_filename"
  done

  # Remove old package directory (only if different)
  if [ "$OLD_JAVA_DIR" != "$NEW_JAVA_DIR" ]; then
    rm -rf "$OLD_JAVA_DIR"
    # Clean up empty parent directories up to infra/main/java/
    dir="$(dirname "$OLD_JAVA_DIR")"
    stop_dir="$PROJECT_ROOT/infra/main/java"
    while [ "$dir" != "$stop_dir" ] && [ "$dir" != "/" ]; do
      rmdir "$dir" 2>/dev/null || break
      dir="$(dirname "$dir")"
    done
  fi
  echo "  Java packages renamed"
else
  echo "  WARN: Old Java directory not found, skipping"
fi

echo "--- Renaming CDK directory ---"
OLD_CDK_DIR="$PROJECT_ROOT/cdk-gateway"
NEW_CDK_DIR="$PROJECT_ROOT/cdk-${CDK_PREFIX}"

if [ -d "$OLD_CDK_DIR" ] && [ "$OLD_CDK_DIR" != "$NEW_CDK_DIR" ]; then
  mv "$OLD_CDK_DIR" "$NEW_CDK_DIR"
  # Update references in cdk.json
  sedi "s|gateway\.jar|${CDK_PREFIX}.jar|g" "$NEW_CDK_DIR/cdk.json"
  echo "  cdk-gateway → cdk-${CDK_PREFIX}"
fi

echo "--- Updating pom.xml ---"
sedi "s|<groupId>co\.uk\.diyaccounting\.gateway</groupId>|<groupId>${JAVA_PKG}</groupId>|g" "$PROJECT_ROOT/pom.xml"
sedi "s|<artifactId>gateway</artifactId>|<artifactId>${CDK_PREFIX}</artifactId>|g" "$PROJECT_ROOT/pom.xml"
sedi "s|co\.uk\.diyaccounting\.gateway|${JAVA_PKG}|g" "$PROJECT_ROOT/pom.xml"
sedi "s|gateway\.jar|${CDK_PREFIX}.jar|g" "$PROJECT_ROOT/pom.xml"
sedi "s|GatewayEnvironment|${CDK_PREFIX_UPPER}Environment|g" "$PROJECT_ROOT/pom.xml"
echo "  pom.xml updated"

echo "--- Updating package.json ---"
sedi "s|cdk-gateway|cdk-${CDK_PREFIX}|g" "$PROJECT_ROOT/package.json"
sedi "s|gateway|${CDK_PREFIX}|g" "$PROJECT_ROOT/package.json"
echo "  package.json updated"

echo "--- Updating build/ignore references ---"
for file in .gitignore .prettierignore .retireignore.json eslint.security.config.js scripts/update-java.sh; do
  if [ -f "$PROJECT_ROOT/$file" ]; then
    sedi "s|cdk-gateway|cdk-${CDK_PREFIX}|g" "$PROJECT_ROOT/$file"
  fi
done
echo "  Build references updated"

echo "--- Updating workflow files ---"
for file in $(find "$PROJECT_ROOT/.github" -name "*.yml" -o -name "*.yaml" 2>/dev/null); do
  sedi "s|cdk-gateway|cdk-${CDK_PREFIX}|g" "$file"
  sedi "s|GATEWAY_|${CDK_PREFIX_UPPER}_|g" "$file"
  sedi "s|gateway|${CDK_PREFIX}|g" "$file"
done
echo "  Workflows updated"

# Clean up marker
rm -f "$PROJECT_ROOT/.template-cleaned"

echo ""
echo "=========================================="
echo " Template init complete!"
echo "=========================================="
echo ""
echo "Manual steps remaining:"
echo "  1. CDK bootstrap the AWS account (if not done):"
echo "     npx cdk bootstrap aws://${AWS_ACCOUNT}/us-east-1"
echo "  2. Set up OIDC provider and IAM roles in the AWS account"
echo "  3. Request ACM certificate for ${NAKED_DOMAIN} in us-east-1"
echo "  4. Set GitHub repository variables:"
echo "     ${CDK_PREFIX_UPPER}_ACTIONS_ROLE_ARN"
echo "     ${CDK_PREFIX_UPPER}_DEPLOY_ROLE_ARN"
echo "     ${CDK_PREFIX_UPPER}_CERTIFICATE_ARN"
echo "  5. Create GitHub environments: ci, prod"
echo "  6. Push to main to trigger deployment"
echo "  7. Copy CloudFrontDomainName to DNS"
echo ""
