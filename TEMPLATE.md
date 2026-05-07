# Using This Repository as a Template

This repository is a GitHub template for deploying static sites to AWS using CDK (Java), S3, and CloudFront.

It provides a complete, production-ready setup: CI/CD pipelines, accessibility and security compliance testing, OIDC-based deployment (no stored credentials), and a CloudFront Function redirect engine.

## Prerequisites

Before you begin, you need:

- An **AWS account** in your organization (or standalone)
- An **ACM certificate** for your domain in `us-east-1` (CloudFront requirement)
- A **GitHub repository** (created from this template)
- **CDK bootstrapped** in the target account (`us-east-1` and optionally your primary region)
- **OIDC provider** and **IAM roles** for GitHub Actions in the target account

## Quick Start (5-25 minutes)

### Step 1: Create from Template

Click "Use this template" in GitHub, or:

```bash
gh repo create myorg/www.mysite.example --template support-at-diyaccounting/www.diyaccounting.co.uk --private
git clone git@github.com:myorg/www.mysite.example.git
cd www.mysite.example
```

### Step 2: Strip DIY Accounting-specific Content

```bash
./scripts/template-clean.sh
```

This replaces all company-specific content (domain, company name, addresses, analytics IDs, redirects) with RFC 2606 placeholder values (`site.example`, `Example Company`).

### Step 3: Apply Your Values

```bash
./scripts/template-init.sh
```

Interactive prompts for:

| Prompt | Example | What it changes |
|--------|---------|-----------------|
| Domain name | `spreadsheets.example.com` | HTML, CDK context, workflows, sitemap |
| Company name | `Acme Corp Ltd` | HTML, JSON-LD, SPDX headers |
| GitHub owner | `acmecorp` | package.json scope, workflow repo references |
| AWS account ID | `064390746177` | CDK context, tags |
| Java package | `com.example.spreadsheets` | Directory structure, imports, pom.xml |
| CDK prefix | `spreadsheets` | Stack names, resource prefixes, directory names |
| Copyright year | `2026` | SPDX headers |

For CI/CD automation, use `--non-interactive` mode with environment variables:

```bash
TEMPLATE_DOMAIN=spreadsheets.example.com \
TEMPLATE_COMPANY="Acme Corp Ltd" \
TEMPLATE_GITHUB_OWNER=acmecorp \
TEMPLATE_AWS_ACCOUNT_ID=064390746177 \
TEMPLATE_JAVA_PACKAGE=com.example.spreadsheets \
TEMPLATE_CDK_PREFIX=spreadsheets \
./scripts/template-init.sh --non-interactive
```

### Step 4: Set GitHub Repository Variables

In Settings > Secrets and variables > Actions > Variables:

| Variable | Value |
|----------|-------|
| `{PREFIX}_ACTIONS_ROLE_ARN` | ARN of the GitHub Actions OIDC role |
| `{PREFIX}_DEPLOY_ROLE_ARN` | ARN of the CDK deployment role |
| `{PREFIX}_CERTIFICATE_ARN` | ARN of the ACM certificate |

Create two **environments** in Settings > Environments: `ci` and `prod`.

### Step 5: Replace Web Content

Edit the files in `web/www.{yourdomain}/public/`:

- `index.html` — your landing page
- `about.html` — company information
- `gateway.css` — site styling
- `sitemap.xml` — update URLs
- `robots.txt` — update sitemap references
- `.well-known/security.txt` — update contact and expiry
- `lib/analytics.js` — your GA4 measurement ID (or remove)

### Step 6: Build and Deploy

```bash
npm install
./mvnw clean verify
npm run cdk:synth           # Verify CDK synthesis
git add -A && git commit -m "Initialise from template"
git push -u origin main     # Triggers deploy.yml
```

### Step 7: Configure DNS

After the first deployment, copy the `CloudFrontDomainName` output from the deploy workflow and create a DNS alias (CNAME or Route53 alias) pointing your domain to it.

## What You Get

| Feature | Details |
|---------|---------|
| **Infrastructure** | S3 origin bucket, CloudFront distribution with OAC, CloudFront Function redirects |
| **Security** | CSP headers, HSTS, X-Frame-Options: DENY, COEP/COOP/CORP, OAC (no public S3) |
| **CI/CD** | GitHub Actions with OIDC auth, test on push/PR, deploy on main |
| **Testing** | Unit tests (vitest), browser tests (Playwright), behaviour tests, smoke tests |
| **Compliance** | Pa11y, axe-core, Lighthouse, text spacing (WCAG), ESLint security, npm audit, retire.js |
| **Reporting** | `npm run compliance:ci-report-md` generates full compliance report |
| **Architecture** | `npm run diagram:gateway` generates draw.io diagram from CDK |
| **Formatting** | Spotless (Java) + Prettier (JS/YAML/JSON), enforced in CI |

## Appendix: Bootstrapping a New AWS Account

If you're starting with a fresh AWS account:

### 1. CDK Bootstrap

```bash
npx cdk bootstrap aws://ACCOUNT_ID/us-east-1
npx cdk bootstrap aws://ACCOUNT_ID/eu-west-2  # optional: your primary region
```

### 2. OIDC Provider for GitHub Actions

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### 3. GitHub Actions Role

Create an IAM role with a trust policy allowing your repository:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
      "StringLike": { "token.actions.githubusercontent.com:sub": "repo:OWNER/REPO:*" }
    }
  }]
}
```

Attach the `sts:AssumeRole` permission for the deployment role.

### 4. Deployment Role

Create a role trusted by the actions role, with permissions for:
- CloudFormation (full)
- S3 (create/manage buckets)
- CloudFront (create/manage distributions)
- IAM (create roles for CDK custom resources)
- Lambda (CDK BucketDeployment uses Lambda)
- CloudWatch Logs (access logging)
- SSM (CDK bootstrap version check)

### 5. ACM Certificate

```bash
aws acm request-certificate \
  --domain-name yourdomain.com \
  --subject-alternative-names "*.yourdomain.com" \
  --validation-method DNS \
  --region us-east-1
```

Validate via DNS (add the CNAME record ACM provides).
