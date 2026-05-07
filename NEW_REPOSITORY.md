# NEW_REPOSITORY.md — migration record

> This repository was migrated from `antonycc/www.diyaccounting.co.uk` to `support-at-diyaccounting/www.diyaccounting.co.uk` on **2026-05-06** after the suspension of `antonycc`.

## What happened

- The personal account `antonycc` was first org-flagged on 2026-05-03 and fully suspended on 2026-05-06.
- A new GitHub Pro account `support-at-diyaccounting` was created and authenticated.
- Cross-repo migration plan: see `PLAN_GITHUB_MIGRATION.md` and `PLAN_FLAGGED.md` in the parent workspace (`/Users/antony/projects/diy-accounting-limited/`).
- This repo manages the **gateway AWS account (283165661847)** — S3 + CloudFront for `www.diyaccounting.co.uk`.

## How this repo was created in the new home

```bash
gh repo create support-at-diyaccounting/www.diyaccounting.co.uk \
  --public \
  --description "Gateway static site for www.diyaccounting.co.uk (S3 + CloudFront)"

git -C www.diyaccounting.co.uk remote add newhome \
  git@github.com:support-at-diyaccounting/www.diyaccounting.co.uk.git
git -C www.diyaccounting.co.uk push newhome --all
git -C www.diyaccounting.co.uk push newhome --tags
```

## What was migrated

- **4 branches**: `main`, `gatewayascdk`, `pristine`, `scripterr`.
- **0 tags**.
- **All repository content** including CDK Java code, web assets, and the redirect engine.

## Code rewrites in this branch

This branch (`claude/migrate-to-support-at-diyaccounting`) updates stale `antonycc` references. Replacement rules applied:

| Old reference | New reference |
|---|---|
| `antonycc/www.diyaccounting.co.uk` | `support-at-diyaccounting/www.diyaccounting.co.uk` |
| `antonycc/root.diyaccounting.co.uk` | `support-at-diyaccounting/root.diyaccounting.co.uk` |
| `antonycc/submit.diyaccounting.co.uk` | `support-at-diyaccounting/submit.diyaccounting.co.uk` |
| `antonycc/diy-accounting` | `support-at-diyaccounting/spreadsheets.diyaccounting.co.uk` |
| `@antonycc/www-diyaccounting-co-uk` (npm scope) | `@support-at-diyaccounting/www-diyaccounting-co-uk` |
| Template-clean script: stripped `antonycc` placeholder source | now strips `support-at-diyaccounting` source |

Files affected:
- `README.md`, `TEMPLATE.md`
- `package.json`
- `infra/main/java/co/uk/diyaccounting/gateway/stacks/GatewayStack.java` — CDK stack tags
- `scripts/template-clean.sh` — placeholder-source patterns updated to match the new account scope

## What was deliberately NOT rewritten

- `cdk-gateway.out/*` — CDK synth output; will be regenerated on next `cdk synth`.
- `package-lock.json` — regenerated on next `npm install`.

## What still needs setup before deploys work

### 1. AWS OIDC trust policy (BLOCKING for first deploy)

The IAM roles in account **283165661847 (gateway)** that GitHub Actions assumes have `sub` claim trust pinned to `repo:antonycc/www.diyaccounting.co.uk:*`. They must be updated to `repo:support-at-diyaccounting/www.diyaccounting.co.uk:*` before any workflow in this new repo can `aws-actions/configure-aws-credentials@v4`.

Apply via CDK redeploy from local SSO:
```bash
aws sso login --sso-session diyaccounting
./mvnw clean verify
npm run cdk:deploy   # or equivalent — uses --profile gateway
```

If you can't deploy (chicken-and-egg), patch the trust policy directly:
```bash
aws --profile gateway iam get-role --role-name gateway-github-actions-role
# Edit the AssumeRolePolicyDocument to allow repo:support-at-diyaccounting/www.diyaccounting.co.uk:*
aws --profile gateway iam update-assume-role-policy \
  --role-name gateway-github-actions-role \
  --policy-document file://new-trust.json
```

### 2. GitHub Actions Variables

Set on this repo via `gh variable set`:

| Variable | Value source |
|---|---|
| `GATEWAY_ACTIONS_ROLE_ARN` | `aws --profile gateway iam get-role --role-name gateway-github-actions-role --query Role.Arn --output text` |
| `GATEWAY_DEPLOY_ROLE_ARN` | `aws --profile gateway iam get-role --role-name gateway-deployment-role --query Role.Arn --output text` |
| `GATEWAY_CERTIFICATE_ARN` | `aws --profile gateway acm list-certificates --region us-east-1 --query "CertificateSummaryList[?DomainName=='www.diyaccounting.co.uk'].CertificateArn" --output text` |

### 3. GitHub Actions Secrets

None required. All values are non-secret config.

### 4. GitHub Environments

CLAUDE.md mentions `ci` and `prod` environments. Workflows use OIDC and per-environment variables. Create both environments and re-set the three variables above scoped to each environment if you want different ARNs per env (otherwise repo-level variables work).

## Sequence to restore deploys

1. Merge this PR.
2. `aws sso login --sso-session diyaccounting`.
3. From local: deploy CDK to gateway account — applies the updated OIDC trust policy. (Verify the new policy with `aws --profile gateway iam get-role --role-name gateway-github-actions-role`.)
4. Set the three variables listed above (`gh variable set ...`).
5. Push a trivial commit; verify `test.yml` and `deploy.yml` succeed.
6. Verify https://www.diyaccounting.co.uk still serves correctly.

## How to obtain values

### Role ARNs
```bash
aws --profile gateway iam list-roles \
  --query "Roles[?contains(RoleName, 'github-actions') || contains(RoleName, 'deployment')].[RoleName,Arn]" \
  --output table
```

### Certificate ARNs
```bash
aws --profile gateway acm list-certificates --region us-east-1 \
  --query "CertificateSummaryList[].[DomainName,CertificateArn]" --output table
```
