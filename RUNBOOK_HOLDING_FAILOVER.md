# Holding Failover Runbook

This repo has no holding stack and no failover workflow of its own.

The gateway CloudFront distribution serves the apex, `www.diyaccounting.co.uk` and
`prod-gateway.diyaccounting.co.uk` from one distribution, and the apex holding page in the
management account already covers the same brand front door. Failing this site over means moving
its live aliases onto that apex holding distribution, which the root repo already owns end to
end.

Dispatch `deploy-holding.yml` in `root.diyaccounting.co.uk` to fail this site over or back. See
that repo's `RUNBOOK_HOLDING_FAILOVER.md` for the full procedure, including which domains it
covers, expected time to take effect, how to verify, and how to fail back.

## Deploying while failed over

This repo's own `deploy.yml` deploys `GatewayStack`, and `GatewayStack` declares its live domain
names (`diyaccounting.co.uk`, `www.diyaccounting.co.uk`, `prod-gateway.diyaccounting.co.uk` for
prod) as a fixed property of its CloudFront distribution. There is no guard against deploying this
repo while a failover is live.

If you do, the deploy does not silently undo the failover — it fails. CloudFront rejects the
attempt to put those aliases back on the gateway distribution while the apex holding distribution
still holds them, and the CDK deploy step for `GatewayStack` errors with a CNAME-already-exists
failure. Restore the failover first (`deploy-holding.yml` with `target: restore` in
`root.diyaccounting.co.uk`), confirm the live aliases are back on the gateway distribution, then
redeploy this repo.
