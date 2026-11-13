#!/usr/bin/env node
// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// Writes llms.txt and llms-full.txt into web/www.diyaccounting.co.uk/public/ from the pages in sitemap.xml.
// llms.txt is the site name, one paragraph and one linked line per page (https://llmstxt.org).
// llms-full.txt is the text of each page as Markdown.
// Usage: node scripts/build-llms-txt.mjs   (npm run build:llms)

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PUBLIC_DIR = join(ROOT, "web", "www.diyaccounting.co.uk", "public");
export const SITE_ORIGIN = "https://diyaccounting.co.uk";
export const SUBMIT_ORIGIN = "https://submit.diyaccounting.co.uk";
export const SPREADSHEETS_ORIGIN = "https://spreadsheets.diyaccounting.co.uk";

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "—", ndash: "–", pound: "£", copy: "©" };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
    if (name.startsWith("#x")) return String.fromCodePoint(parseInt(name.slice(2), 16));
    if (name.startsWith("#")) return String.fromCodePoint(parseInt(name.slice(1), 10));
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

function oneLine(text) {
  return decodeEntities(text.replace(/<[^>]+>/g, " "))
    .replace(/ +([:,.;)])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function sitemapUrls(xml) {
  return [...xml.matchAll(/<url><loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

export function pageFile(url) {
  const path = url.slice(SITE_ORIGIN.length + 1);
  return path === "" ? "index.html" : path;
}

export function pageTitle(html) {
  return oneLine(html.match(/<title>([\s\S]*?)<\/title>/)[1]);
}

export function pageDescription(html) {
  return decodeEntities(html.match(/<meta\s+name="description"\s+content="([^"]*)"/)[1])
    .replace(/\s+/g, " ")
    .trim();
}

function mainHtml(html) {
  return html.match(/<main[^>]*>([\s\S]*?)<\/main>/)[1];
}

export function pageMarkdown(html, url) {
  const absolute = (href) => new URL(href, url).href;
  const text = mainHtml(html)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, "")
    .replace(/<a\s([^>]*?)href="([^"]*)"([^>]*)>([\s\S]*?)<\/a\s*>/g, (whole, before, href, after, inner) => {
      const label = oneLine(inner.replace(/<\/span\s*>\s*<span/g, "</span>: <span"));
      const bullet = /class="gateway-btn/.test(before + after) ? "\n- " : "";
      return `${bullet}[${label}](${absolute(href)})`;
    })
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1\s*>/g, (whole, level, inner) => `\n\n${"#".repeat(Number(level))} ${oneLine(inner)}\n\n`)
    .replace(/<li[^>]*>([\s\S]*?)<\/li\s*>/g, (whole, inner) => `\n- ${oneLine(inner.replace(/<strong>([\s\S]*?)<\/strong>/g, "**$1**"))}`)
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<\/?(p|div|address|details|summary|nav|ul|section)[^>]*>/g, "\n\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(text)
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/(?<=\n- [^\n]*)\n\n(?=- )/g, "\n")
    .trim();
}

function productLink(indexHtml, origin) {
  const anchor = indexHtml.match(new RegExp(`<a\\s[^>]*?href="${origin.replaceAll(".", "\\.")}[^"]*"[^>]*>([\\s\\S]*?)</a>`));
  if (!anchor) throw new Error(`index.html has no link to ${origin}`);
  const [title, subtitle] = [...anchor[1].matchAll(/<span[^>]*>([\s\S]*?)<\/span\s*>/g)].map((match) => oneLine(match[1]));
  return { title, subtitle };
}

export function loadPages(publicDir = PUBLIC_DIR) {
  const urls = sitemapUrls(readFileSync(join(publicDir, "sitemap.xml"), "utf-8"));
  return urls.map((url) => {
    const html = readFileSync(join(publicDir, pageFile(url)), "utf-8");
    return { url, html, title: pageTitle(html), description: pageDescription(html), markdown: pageMarkdown(html, url) };
  });
}

export function renderLlmsTxt(pages) {
  const index = pages.find((page) => page.url === `${SITE_ORIGIN}/`);
  const siteName = index.html.match(/<meta property="og:site_name" content="([^"]*)"/)[1];
  const submit = productLink(index.html, SUBMIT_ORIGIN);
  const spreadsheets = productLink(index.html, SPREADSHEETS_ORIGIN);
  const summary =
    `${index.description} This site leads to ${submit.title} (${SUBMIT_ORIGIN}): ${submit.subtitle}. ` +
    `It also leads to ${spreadsheets.title} (${SPREADSHEETS_ORIGIN}): ${spreadsheets.subtitle}.`;
  const lines = pages.map((page) => `- [${page.title}](${page.url}): ${page.description}`);
  return [`# ${siteName}`, "", `> ${summary}`, "", "## Pages", "", ...lines, ""].join("\n");
}

export function renderLlmsFullTxt(pages) {
  const sections = pages.map((page) => `# ${page.title}\n\nSource: ${page.url}\n\n${page.markdown}\n`);
  return `${sections.join("\n")}`;
}

export function writeLlmsFiles(publicDir = PUBLIC_DIR) {
  const pages = loadPages(publicDir);
  writeFileSync(join(publicDir, "llms.txt"), renderLlmsTxt(pages));
  writeFileSync(join(publicDir, "llms-full.txt"), renderLlmsFullTxt(pages));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeLlmsFiles();
  console.log("Wrote llms.txt and llms-full.txt");
}
