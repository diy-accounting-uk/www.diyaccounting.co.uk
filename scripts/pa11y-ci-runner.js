#!/usr/bin/env node
// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

/**
 * pa11y-ci replacement runner
 *
 * Replaces pa11y-ci to avoid vulnerable transitive dependency chain:
 *   pa11y-ci -> globby -> glob -> minimatch (ReDoS vulnerability)
 *
 * Reads .pa11yci config files and runs pa11y on each URL.
 * Output format matches pa11y-ci for compatibility with compliance report parser.
 *
 * Usage:
 *   node scripts/pa11y-ci-runner.js --config .pa11yci.ci.json
 */

import pa11y from "pa11y";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const configIndex = args.indexOf("--config");

if (configIndex === -1 || !args[configIndex + 1]) {
  console.error("Usage: node scripts/pa11y-ci-runner.js --config <config.json>");
  process.exit(1);
}

const configPath = resolve(args[configIndex + 1]);
const config = JSON.parse(readFileSync(configPath, "utf8"));
const { defaults = {}, urls = [] } = config;

let passed = 0;
let failed = 0;

console.log(`\nRunning pa11y on ${urls.length} URLs:\n`);

for (const url of urls) {
  try {
    const results = await pa11y(url, defaults);
    const errorCount = results.issues.length;

    console.log(` > ${url} - ${errorCount} error${errorCount !== 1 ? "s" : ""}`);

    if (errorCount === 0) {
      passed++;
    } else {
      failed++;
      for (const issue of results.issues) {
        console.log(`   - ${issue.message}`);
        if (issue.selector) {
          console.log(`     (${issue.selector})`);
        }
      }
    }
  } catch (error) {
    failed++;
    console.error(` > ${url} - Failed to run: ${error.message}`);
  }
}

const total = passed + failed;
console.log(`\n${passed} of ${total} URL${total !== 1 ? "s" : ""} passed`);

process.exit(failed > 0 ? 2 : 0);
