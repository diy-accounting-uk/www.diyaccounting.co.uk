# GITHUB_SETUP.md — what a fresh GitHub repo needs

This document captures the GitHub-side configuration this repo depends on. If you're setting it up in a new GitHub account or org, this is the checklist.

## What this repo deploys

The gateway static site for `www.diyaccounting.co.uk` and the apex `diyaccounting.co.uk`. CDK (Java) deploys an S3 bucket + CloudFront distribution with OAC and a CloudFront Function for URL redirects.

| Account | AWS Account ID | Profile |
|---|---|---|
| `gateway` | 283165661847 | `gateway` |

Live site: https://www.diyaccounting.co.uk

## AWS-side prerequisites

The gateway AWS account needs a GitHub OIDC provider and two IAM roles:

| Role | Trusted by | Purpose |
|---|---|---|
| `gateway-github-actions-role` | GitHub OIDC | Workflow entry — allowed `sub` claim `repo:<org>/www.diyaccounting.co.uk:*` |
| `gateway-deployment-role` | `gateway-github-actions-role` | CDK deploy role; assumed via STS chain |

(Both created by `submit.diyaccounting.co.uk/scripts/aws-accounts/bootstrap-account.sh` when the account was first set up.)

The OIDC `sub` claim format is `repo:<github-org-or-user>/www.diyaccounting.co.uk:*`. This CDK does not manage the trust policy — if the GitHub org changes, update the trust on `gateway-github-actions-role` directly with `aws iam update-assume-role-policy`.

DNS records for `www.diyaccounting.co.uk` and the apex are managed by `root.diyaccounting.co.uk` in the management account, not this repo.

## GitHub Environments

A `ci` environment is referenced by `deploy.yml`. Create it under **Settings → Environments**.

## GitHub Actions Variables

Repo-level (referenced by both workflows):

| Variable | Value source |
|---|---|
| `GATEWAY_ACTIONS_ROLE_ARN` | `aws --profile gateway iam get-role --role-name gateway-github-actions-role --query Role.Arn --output text` |
| `GATEWAY_DEPLOY_ROLE_ARN` | `aws --profile gateway iam get-role --role-name gateway-deployment-role --query Role.Arn --output text` |
| `GATEWAY_CERTIFICATE_ARN` | `aws --profile gateway acm list-certificates --region us-east-1 --query "CertificateSummaryList[].CertificateArn | [0]" --output text` (single wildcard cert covering ci+prod aliases) |

The `deploy.yml` job declares `environment: ci`, so these vars resolve from the env scope first if set there, falling back to repo-level.

## GitHub Actions Secrets

None required. All authentication is via OIDC; no third-party tokens are used during deploy.

## Workflows

| File | Trigger | What it does |
|---|---|---|
| `test.yml` | push (paths-filtered), workflow_dispatch, daily schedule | Lint + format + Maven verify + CDK synth |
| `deploy.yml` | push to main (paths-filtered), workflow_dispatch | Deploy `GatewayStack` to S3 + CloudFront |

## Sequence to bring a new repo online

1. Create the repo on GitHub. Push code.
2. Update OIDC trust on `gateway-github-actions-role` to include `repo:<new-org>/www.diyaccounting.co.uk:*`.
3. Create the `ci` GitHub Environment.
4. Set the three `GATEWAY_*` variables (env-level on `ci`, or repo-level).
5. Push a trivial commit on a feature branch — `test.yml` should pass (proves OIDC).
6. Open a PR, merge to `main` — `deploy.yml` runs and deploys to the gateway account.
7. Verify https://www.diyaccounting.co.uk responds correctly.

## Template repository note

This repo is also designed as a generic CDK static-site template (see `TEMPLATE.md`). `scripts/template-clean.sh` strips DIY Accounting-specific content and replaces it with placeholders. **NEVER run `template-clean.sh` without confirming first** — it destructively modifies files. It's only meant to be run on a fresh fork intended for template use.

## How to obtain values quickly

```bash
# Role ARNs
aws --profile gateway iam list-roles \
  --query "Roles[?contains(RoleName, 'github-actions') || contains(RoleName, 'deployment')].[RoleName,Arn]" \
  --output table

# Cert ARN (us-east-1, required for CloudFront)
aws --profile gateway acm list-certificates --region us-east-1 \
  --query "CertificateSummaryList[].[DomainName,CertificateArn]" --output table

# Verify OIDC trust on the role
aws --profile gateway iam get-role --role-name gateway-github-actions-role \
  --query 'Role.AssumeRolePolicyDocument'
```
