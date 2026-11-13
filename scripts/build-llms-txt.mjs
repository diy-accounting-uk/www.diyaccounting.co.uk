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
import * as cheerio from "cheerio";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PUBLIC_DIR = join(ROOT, "web", "www.diyaccounting.co.uk", "public");
export const SITE_ORIGIN = "https://diyaccounting.co.uk";
export const SUBMIT_ORIGIN = "https://submit.diyaccounting.co.uk";
export const SPREADSHEETS_ORIGIN = "https://spreadsheets.diyaccounting.co.uk";

const BLOCK_TAGS = new Set([
  "p",
  "div",
  "address",
  "details",
  "summary",
  "nav",
  "ul",
  "ol",
  "section",
  "aside",
  "article",
  "header",
  "footer",
  "main",
]);
const LINE_BREAK = "\u2028";
const SKIPPED_TAGS = new Set(["script", "style"]);

function squash(text) {
  return text.replace(/\s+/g, " ").trim();
}

export function sitemapUrls(xml) {
  const $ = cheerio.load(xml, { xml: true });
  return $("url > loc")
    .map((index, element) => $(element).text().trim())
    .get();
}

export function pageFile(url) {
  const path = url.slice(SITE_ORIGIN.length + 1);
  return path === "" ? "index.html" : path;
}

export function pageTitle(html) {
  return squash(cheerio.load(html)("title").first().text());
}

export function pageDescription(html) {
  return squash(cheerio.load(html)('meta[name="description"]').first().attr("content"));
}

function linkLabel($, anchor) {
  const spans = $(anchor).children("span");
  return spans.length > 0
    ? spans
        .map((index, span) => squash($(span).text()))
        .get()
        .join(": ")
    : squash($(anchor).text());
}

function inlineMarkdown($, node, pageUrl) {
  if (node.type === "text") return node.data;
  if (node.type !== "tag" || SKIPPED_TAGS.has(node.name)) return "";
  if (node.name === "br") return LINE_BREAK;
  if (node.name === "a") return `[${linkLabel($, node)}](${new URL($(node).attr("href"), pageUrl).href})`;
  const inner = node.children.map((child) => inlineMarkdown($, child, pageUrl)).join("");
  return node.name === "strong" ? `**${inner}**` : inner;
}

function tidyLines(text) {
  return text
    .split(LINE_BREAK)
    .map(squash)
    .filter((line) => line !== "")
    .join("\n");
}

export function pageMarkdown(html, pageUrl) {
  const $ = cheerio.load(html);
  const blocks = [];
  let inline = "";
  const flush = () => {
    const text = tidyLines(inline);
    if (text !== "") blocks.push(text);
    inline = "";
  };
  const push = (text) => {
    flush();
    blocks.push(text);
  };
  const walk = (node) => {
    if (node.type === "text") {
      inline += node.data;
      return;
    }
    if (node.type !== "tag" || SKIPPED_TAGS.has(node.name)) return;
    const heading = node.name.match(/^h([1-6])$/);
    if (heading) {
      push(`${"#".repeat(Number(heading[1]))} ${squash(inlineMarkdown($, node, pageUrl))}`);
    } else if (node.name === "li" || (node.name === "a" && $(node).hasClass("gateway-btn"))) {
      push(`- ${squash(inlineMarkdown($, node, pageUrl))}`);
    } else if (BLOCK_TAGS.has(node.name)) {
      flush();
      node.children.forEach(walk);
      flush();
    } else {
      inline += inlineMarkdown($, node, pageUrl);
    }
  };
  $("main").first().children().toArray().forEach(walk);
  flush();
  return blocks
    .map((block, index) => (index > 0 && block.startsWith("- ") && blocks[index - 1].startsWith("- ") ? `\n${block}` : `\n\n${block}`))
    .join("")
    .trim();
}

function productLink(indexHtml, origin) {
  const $ = cheerio.load(indexHtml);
  const anchor = $("a[href]")
    .toArray()
    .find((element) => new URL($(element).attr("href"), `${SITE_ORIGIN}/`).origin === origin);
  if (!anchor) throw new Error(`index.html has no link to ${origin}`);
  const [title, subtitle] = $(anchor)
    .children("span")
    .map((index, span) => squash($(span).text()))
    .get();
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
  const siteName = cheerio.load(index.html)('meta[property="og:site_name"]').attr("content");
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
