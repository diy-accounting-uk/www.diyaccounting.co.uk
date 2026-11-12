#!/usr/bin/env node
// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// scripts/indexnow-submit.mjs
//
// Tells IndexNow about every URL in the gateway sitemap. The key is the name and the content of the one
// <32 hex characters>.txt file in the public directory. A problem prints a warning annotation and exits 0,
// so a failed submission never fails a deploy.
//
// Usage: node scripts/indexnow-submit.mjs

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PUBLIC_DIR = join(ROOT, "web", "www.diyaccounting.co.uk", "public");
export const HOST = "diyaccounting.co.uk";
export const ENDPOINT = "https://api.indexnow.org/indexnow";
const KEY_FILE_NAME = /^[0-9a-f]{32}\.txt$/;

export function sitemapUrls(xml) {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1].trim());
}

export function findKey(directory = PUBLIC_DIR) {
  const files = readdirSync(directory).filter((name) => KEY_FILE_NAME.test(name));
  if (files.length !== 1) return null;
  const key = files[0].replace(/\.txt$/, "");
  return readFileSync(join(directory, files[0]), "utf-8").trim() === key ? key : null;
}

export function buildPayload(key, urls) {
  if (urls.length === 0) return null;
  return { host: HOST, key, keyLocation: `https://${HOST}/${key}.txt`, urlList: urls };
}

function warn(message) {
  console.log(`::warning title=IndexNow::${message}`);
}

export async function submit({ directory = PUBLIC_DIR, send = fetch } = {}) {
  const key = findKey(directory);
  if (!key) return warn("the public directory needs exactly one key file whose content is its name; nothing sent");
  const payload = buildPayload(key, sitemapUrls(readFileSync(join(directory, "sitemap.xml"), "utf-8")));
  if (!payload) return console.log("IndexNow: the sitemap lists no URLs; nothing sent");
  try {
    const response = await send(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });
    if (response.status < 200 || response.status > 299) return warn(`IndexNow answered ${response.status}`);
    console.log(`IndexNow: ${response.status} for ${payload.urlList.length} URLs`);
  } catch (error) {
    warn(`the request failed: ${error.message}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await submit();
}
