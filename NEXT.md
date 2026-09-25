<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
     Copyright (C) 2006-2026 DIY Accounting Limited -->
# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## Open items

- [ ] **G-1. DIYA-GL on the gateway home.** Operator, 2026-09-25: link the DIYA-GL home (https://diya-gl.co.uk/, live) from https://diyaccounting.co.uk/ the way Submit and Spreadsheets are linked. Add a third `gateway-btn` in `web/www.diyaccounting.co.uk/public/index.html`'s Products nav (lines 39 to 50: the Submit button at line 40, Spreadsheets at line 44), title "DIYA-GL", a one-line subtitle from the DIYA-GL home's own strip ("Your books, free in the browser"), with a style class if the other two carry one; cover it in `web/browser-tests/gateway-content.browser.test.js`; `seo-validation.test.js` and `smoke.test.js` pass. Spreadsheets' LP-27 and Submit's X-1 are the same change on the other sites. **Owner**: Claude Code. **Model**: Haiku. **Size**: ~2 files.

## Discipline

(none repo-specific yet — see `../NEXT.md`)
