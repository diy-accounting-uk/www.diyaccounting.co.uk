# Claude Code Memory - DIY Accounting Gateway

> **Shared conventions** (git workflow, AWS accounts, code quality, confirm behavior, security): See `../CLAUDE.md`

## Context Survival (CRITICAL — read this first after every compaction)

**After compaction or at session start:**

1. Read all `PLAN_*.md` files in the project root — these are the active goals
2. Run `TaskList` to see tracked tasks with status
3. Do NOT start new work without checking these first

**During work:**

- When the user gives a new requirement, add it to the relevant `PLAN_*.md` or create a new one
- Track all user goals as Tasks with status (pending -> in_progress -> completed)
- Update `PLAN_*.md` with progress before context gets large

**PLAN file pattern:**

- Active plans live at project root: `PLAN_<DESCRIPTION>.md`
- Each plan has user assertions verbatim at the top (non-negotiable requirements)
- Plans track problems, fixes applied, and verification criteria
- If no plan file exists for the current work, create one before starting
- Never nest plans in subdirectories — always project root

## Quick Reference

This repository manages the **gateway AWS account** (283165661847) for www.diyaccounting.co.uk:

- **S3 + CloudFront static site** for `www.diyaccounting.co.uk` and `diyaccounting.co.uk`
- **GatewayStack**: S3 bucket, CloudFront distribution with OAC, CloudFront Function for URL redirects
- **CloudWatch Logs**: Access logging for CloudFront distribution
- **Redirect engine**: CloudFront Function generated from `web/www.diyaccounting.co.uk/redirects.toml`

**What this repo does NOT have**: Lambda, DynamoDB, Cognito, API Gateway, Docker, ngrok, HMRC, Stripe, Route53, or any application code. DNS records are managed by the root repo.

## Git Workflow

See `../CLAUDE.md` for full rules. Branch naming: `claude/<short-description>`.

## Build Commands

```bash
npm install                    # Install CDK CLI and dev dependencies
node scripts/build-gateway-redirects.cjs  # Generate redirect-function.js from redirects.toml
./mvnw clean verify            # Build CDK JARs (includes Spotless formatting check)
npm run cdk:synth              # Synthesize CloudFormation templates
npm run cdk:diff               # Show pending changes against deployed stack
```

## Development Tools

```bash
npm run formatting             # Check formatting (Prettier + Spotless)
npm run formatting-fix         # Auto-fix formatting
npm run lint:workflows         # Validate GitHub Actions workflow syntax (uses actionlint)
npm run update-to-minor        # Update npm dependencies (minor versions)
npm run update-to-latest       # Update npm dependencies (latest non-alpha)
npm run update:java            # Update Maven dependencies to latest versions
npm run update:node            # Update npm dependencies to latest non-alpha versions
npm run diagram:gateway        # Generate draw.io architecture diagram from CDK synth output
npm run resources:gateway      # Generate AWS_RESOURCES.md from live AWS data (requires SSO auth)
```

## Testing

```bash
npm test                       # Unit tests (vitest) — SEO validation + smoke tests
npm run test:browser           # Browser tests (Playwright) — HTML content validation
npm run test:gatewayBehaviour-local  # Behaviour tests against local server (localhost:3000)
npm run test:gatewayBehaviour-ci     # Behaviour tests against CI environment
npm run test:gatewayBehaviour-prod   # Behaviour tests against production
```

Behaviour tests use the `GATEWAY_BASE_URL` environment variable to target different environments. When running locally, redirect tests auto-skip (CloudFront Functions not available).

## Compliance

```bash
npm run compliance:ci-report-md    # Run all compliance checks and generate report (CI)
npm run compliance:prod-report-md  # Run all compliance checks and generate report (prod)
```

The compliance report (`REPORT_ACCESSIBILITY_PENETRATION.md`) combines accessibility checks (pa11y, axe-core, Lighthouse, WCAG text spacing) with security checks (ESLint security, npm audit, retire.js). Generated files are gitignored.

## CDK Architecture

**Single CDK application** (`cdk-gateway/`):

- Entry point: `GatewayEnvironment.java` -> `gateway.jar`
- Stack: `{env}-gateway-GatewayStack` (S3 + CloudFront + OAC + redirects)

**Java packages** (`co.uk.diyaccounting.gateway`):

- `gateway` — `GatewayEnvironment.java` (CDK app entry point)
- `gateway.stacks` — `GatewayStack.java` (S3 + CloudFront + OAC + CloudFront Function)
- `gateway.utils` — `Kind.java` (logging), `KindCdk.java` (CDK utilities)

## Web Content

Static site files live in `web/www.diyaccounting.co.uk/public/`. This is the document root deployed to S3.

Redirects are configured in `web/www.diyaccounting.co.uk/redirects.toml` and compiled to a CloudFront Function by `scripts/build-gateway-redirects.cjs`. The generated `redirect-function.js` is gitignored.

## Formatting

- Spotless with Palantir Java Format (100-column width)
- Prettier for JS/YAML/JSON/TOML
- Runs during Maven `install` phase (Spotless) and CI (both)
- Fix: `./mvnw spotless:apply` and `npx prettier --write .` (only when asked)

## Deployment

Deployments are triggered via GitHub Actions workflows:

| Workflow     | Purpose                                     | Trigger                    |
| ------------ | ------------------------------------------- | -------------------------- |
| `test.yml`   | Lint, format check, Maven verify, CDK synth | Push, PRs, daily schedule  |
| `deploy.yml` | Deploy GatewayStack (S3 + CloudFront)       | Push to main, manual dispatch |

Both workflows use OIDC authentication with these GitHub repository variables:

| Variable                   | Purpose                            |
| -------------------------- | ---------------------------------- |
| `GATEWAY_ACTIONS_ROLE_ARN` | OIDC auth for gateway account      |
| `GATEWAY_DEPLOY_ROLE_ARN`  | CDK deploy in gateway account      |
| `GATEWAY_CERTIFICATE_ARN`  | ACM certificate for CloudFront     |

**GitHub Environments**: `ci` and `prod` must exist in Settings > Environments, each with the above variables scoped to the correct account.

**After deploying**: Copy the `CloudFrontDomainName` output and use it as input to `root.diyaccounting.co.uk` deploy workflow to update DNS alias records.

## AWS CLI Access

Use SSO profiles:

```bash
aws sso login --sso-session diyaccounting
aws --profile gateway cloudformation describe-stacks --region us-east-1
aws --profile gateway cloudfront list-distributions
```

**Read-only AWS operations are always permitted.** Ask before any write operations.

## AWS Write Operations

See `../CLAUDE.md` — always ask before any mutating AWS operation.

## Confirm Means Stop and Wait

See `../CLAUDE.md` — present the command, STOP, wait for explicit approval before executing.

## Code Quality Rules

See `../CLAUDE.md` for shared rules. Gateway-specific: only run `./mvnw spotless:apply` when specifically asked.

## Template Repository

This repo is designed as the **simplest CDK static site template**. See `TEMPLATE.md` for full instructions. Key scripts:

- `scripts/template-clean.sh` — strips DIY-specific content, replaces with placeholders
- `scripts/template-init.sh` — interactive, applies your domain/company/account values

**NEVER run `template-clean.sh` without asking the user first.** It destructively replaces site-specific content.

## Security Checklist

See `../CLAUDE.md` for shared rules. Gateway-specific: OIDC trust policies scoped to this specific repository.
