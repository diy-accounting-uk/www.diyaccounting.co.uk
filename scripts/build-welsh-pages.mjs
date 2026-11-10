// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// Writes web/www.diyaccounting.co.uk/public/cy/<page> from each English page in WELSH_PAGES and i18n/cy.toml.
// Every element marked data-i18n (and every attribute marked data-i18n-<attr>) takes its Welsh text from the catalogue.
// Usage: node scripts/build-welsh-pages.mjs   (npm run build:welsh)
// A changed English string makes its catalogue entry stale: translate the new English, then put the hash this script prints in the entry.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import prettier from "prettier";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PUBLIC_DIR = join(ROOT, "web", "www.diyaccounting.co.uk", "public");
export const CATALOGUE_PATH = join(ROOT, "i18n", "cy.toml");
export const SITE_ORIGIN = "https://diyaccounting.co.uk";

export const WELSH_PAGES = [
  { id: "index", en: "index.html", cy: "cy/index.html", enUrl: `${SITE_ORIGIN}/` },
  { id: "about", en: "about.html", cy: "cy/about.html", enUrl: `${SITE_ORIGIN}/about.html` },
];

export function welshUrl(page) {
  return `${SITE_ORIGIN}/${page.cy}`;
}

export function expectedAlternates(page) {
  return [
    { hreflang: "en-GB", href: page.enUrl },
    { hreflang: "cy", href: welshUrl(page) },
    { hreflang: "x-default", href: page.enUrl },
  ];
}

export function sourceHash(html) {
  return createHash("sha256").update(normaliseSource(html)).digest("hex").slice(0, 12);
}

function normaliseSource(html) {
  return html.replace(/\s+/g, " ").trim();
}

// The catalogue's TOML subset: comments, [strings."<id>"] and [shared."<id>"] headers, key = "text" and key = '''text'''.
export function parseCatalogue(text) {
  const parsed = { strings: {}, shared: {} };
  const lines = text.split(/\r?\n/);
  let table = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line === "" || line.startsWith("#")) continue;
    const header = line.match(/^\[(strings|shared)\."([^"]+)"\]$/);
    if (header) {
      table = parsed[header[1]][header[2]] = {};
      continue;
    }
    const pair = line.match(/^([a-z]+) = (.*)$/);
    if (!pair || !table) throw new Error(`i18n/cy.toml line ${index + 1}: cannot read "${line}"`);
    const [, key, rest] = pair;
    const basic = rest.match(/^"([^"\\]*)"$/);
    if (basic) {
      table[key] = basic[1];
      continue;
    }
    if (!rest.startsWith("'''")) throw new Error(`i18n/cy.toml line ${index + 1}: a value is "text" or '''text'''`);
    let value = rest.slice(3);
    while (!value.includes("'''")) {
      index += 1;
      if (index >= lines.length) throw new Error(`i18n/cy.toml: ${key} has no closing '''`);
      value += `\n${lines[index]}`;
    }
    const end = value.indexOf("'''");
    if (value.slice(end + 3).trim() !== "") throw new Error(`i18n/cy.toml line ${index + 1}: text after the closing '''`);
    table[key] = value.slice(0, end).replace(/^\n/, "");
  }
  return parsed;
}

export function loadCatalogue(text = readFileSync(CATALOGUE_PATH, "utf-8")) {
  return parseCatalogue(text);
}

export function readEnglishPage(page) {
  return readFileSync(join(PUBLIC_DIR, page.en), "utf-8");
}

const TITLE_PATTERN = /<title>([\s\S]*?)<\/title>/;
const ELEMENT_PATTERN = /<([a-z][a-z0-9]*)\b([^>]*?)\sdata-i18n="([^"]+)"([^>]*)>([\s\S]*?)<\/\1\s*>/g;
const TAG_PATTERN = /<[a-z][a-z0-9]*\b[^>]*\sdata-i18n-[a-z-]+="[^"]*"[^>]*>/g;
const ATTRIBUTE_MARK_PATTERN = /\sdata-i18n-([a-z-]+)="([^"]+)"/g;

function attributeValue(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return match ? match[1] : null;
}

// Every marked string on an English page, as { id, source }. The <title> is "<page id>.title".
export function englishStrings(html, page) {
  const title = html.match(TITLE_PATTERN);
  if (!title) throw new Error(`${page.en}: no <title>`);
  const found = [{ id: `${page.id}.title`, source: title[1] }];
  for (const match of html.matchAll(ELEMENT_PATTERN)) {
    const [, tag, , id, , inner] = match;
    if (new RegExp(`<${tag}[\\s>]`).test(inner))
      throw new Error(`data-i18n="${id}" holds a nested <${tag}>; mark the inner element instead`);
    found.push({ id, source: inner });
  }
  for (const tagMatch of html.matchAll(TAG_PATTERN)) {
    const tag = tagMatch[0];
    for (const [, name, id] of tag.matchAll(ATTRIBUTE_MARK_PATTERN)) {
      const value = attributeValue(tag, name);
      if (value === null) throw new Error(`data-i18n-${name}="${id}" is on a tag with no ${name} attribute`);
      found.push({ id, source: value });
    }
  }
  return found;
}

// Missing, stale, untranslated and unused entries, one message each.
export function catalogueProblems(catalogue = loadCatalogue(), pages = WELSH_PAGES) {
  const problems = [];
  const sources = new Map();
  for (const page of pages) {
    for (const { id, source } of englishStrings(readEnglishPage(page), page)) {
      const hash = sourceHash(source);
      if (sources.has(id) && sources.get(id) !== hash) problems.push(`${id}: used twice with different English text`);
      sources.set(id, hash);
    }
  }
  for (const [id, hash] of sources) {
    const entry = catalogue.strings[id];
    if (!entry) problems.push(`${id}: missing from i18n/cy.toml (hash ${hash})`);
    else if (entry.hash !== hash) problems.push(`${id}: stale, the English changed (hash ${hash}, catalogue ${entry.hash})`);
    else if (!entry.cy || !entry.cy.trim()) problems.push(`${id}: no Welsh text`);
  }
  for (const id of Object.keys(catalogue.strings)) {
    if (!sources.has(id)) problems.push(`${id}: unused, no English page marks it`);
  }
  for (const [id, entry] of Object.entries(catalogue.shared)) {
    if (!entry.cy || !entry.cy.trim()) problems.push(`shared.${id}: no Welsh text`);
  }
  return problems;
}

function escapeAttribute(text) {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function welshText(catalogue, id) {
  const entry = catalogue.strings[id];
  if (!entry || !entry.cy) throw new Error(`${id}: no Welsh text in i18n/cy.toml`);
  return entry.cy.trim();
}

function replaceOnce(html, pattern, replacement, what) {
  const count = html.match(new RegExp(pattern.source, "g"))?.length ?? 0;
  if (count !== 1) throw new Error(`expected one ${what}, found ${count}`);
  return html.replace(pattern, replacement);
}

// A relative href or src on an English page, as seen from web/public/cy/.
function relocate(url, pages) {
  if (url === "" || /^(\/|#|\$\{|[a-z][a-z0-9+.-]*:)/i.test(url)) return url;
  const bare = url.replace(/^\.\//, "");
  const [, path, suffix] = bare.match(/^([^?#]*)(.*)$/);
  const target = path === "" ? "index.html" : path;
  const welsh = pages.find((page) => page.en === target);
  if (welsh) return welsh.cy.replace(/^cy\//, "") + suffix;
  return `../${bare}`;
}

const LANGUAGE_SWITCH_PATTERN = /<nav class="language-switch"[^>]*data-language-switch[^>]*>[\s\S]*?<\/nav>/;

// The English page carries the English switch; the Welsh page gets the same switch with Welsh current.
function welshLanguageSwitch(page) {
  return (
    '<nav class="language-switch" aria-label="Iaith" data-language-switch>' +
    `<a href="/${page.en === "index.html" ? "" : page.en}" lang="en-GB" hreflang="en-GB">English</a>` +
    '<span aria-current="true" lang="cy">Cymraeg</span>' +
    "</nav>"
  );
}

export async function renderWelshPage(page, catalogue = loadCatalogue(), pages = WELSH_PAGES) {
  const english = readEnglishPage(page);
  for (const { hreflang, href } of expectedAlternates(page)) {
    if (!english.includes(`<link rel="alternate" hreflang="${hreflang}" href="${href}" />`)) {
      throw new Error(`${page.en}: missing <link rel="alternate" hreflang="${hreflang}" href="${href}" />`);
    }
  }
  let html = english;
  html = replaceOnce(html, /<html lang="en">/, '<html lang="cy">', `<html lang="en"> in ${page.en}`);
  html = replaceOnce(html, LANGUAGE_SWITCH_PATTERN, welshLanguageSwitch(page), `language switch in ${page.en}`);
  html = html.replace(TITLE_PATTERN, () => `<title>${welshText(catalogue, `${page.id}.title`)}</title>`);
  html = html.replace(ELEMENT_PATTERN, (whole, tag, before, id, after) => {
    return `<${tag}${before} data-i18n="${id}"${after}>${welshText(catalogue, id)}</${tag}>`;
  });
  html = html.replace(TAG_PATTERN, (tag) => {
    let result = tag;
    for (const [, name, id] of tag.matchAll(ATTRIBUTE_MARK_PATTERN)) {
      result = result.replace(new RegExp(`(\\s${name}=")[^"]*(")`), `$1${escapeAttribute(welshText(catalogue, id))}$2`);
    }
    return result;
  });
  html = replaceOnce(html, /(<link rel="canonical" href=")[^"]*(")/, `$1${welshUrl(page)}$2`, `canonical link in ${page.en}`);
  html = html.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${welshUrl(page)}$2`);
  html = html.replace(/(\s(?:href|src)=")([^"]*)(")/g, (whole, start, url, end) => `${start}${relocate(url, pages)}${end}`);
  html = html.replace(
    /(Copyright \(C\) 2006-2026 DIY Accounting Limited -->)/,
    `$1\n<!-- Built by scripts/build-welsh-pages.mjs from ${page.en} and i18n/cy.toml: edit those and run npm run build:welsh. -->`,
  );
  const options = await prettier.resolveConfig(join(PUBLIC_DIR, page.cy));
  return prettier.format(html, { ...options, parser: "html" });
}

export async function buildWelshPages() {
  const problems = catalogueProblems();
  if (problems.length > 0) throw new Error(`i18n/cy.toml needs attention:\n${problems.join("\n")}`);
  const catalogue = loadCatalogue();
  for (const page of WELSH_PAGES) {
    const outputPath = join(PUBLIC_DIR, page.cy);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, await renderWelshPage(page, catalogue));
    console.log(`wrote ${page.cy}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  buildWelshPages().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
