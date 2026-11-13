// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  PUBLIC_DIR,
  SPREADSHEETS_ORIGIN,
  SUBMIT_ORIGIN,
  loadPages,
  pageMarkdown,
  renderLlmsFullTxt,
  renderLlmsTxt,
  sitemapUrls,
} from "../../scripts/build-llms-txt.mjs";

const read = (relativePath) => fs.readFileSync(path.join(PUBLIC_DIR, relativePath), "utf-8");
const pages = loadPages();
const sitemap = sitemapUrls(read("sitemap.xml"));

describe("llms.txt", () => {
  it("is the current build of the pages", () => {
    expect(read("llms.txt")).toBe(renderLlmsTxt(pages));
  });

  it("lists every sitemap URL", () => {
    expect(sitemap.length).toBeGreaterThan(0);
    for (const url of sitemap) {
      expect(read("llms.txt"), url).toContain(`](${url})`);
    }
  });

  it("starts with the site name and a blockquote", () => {
    expect(read("llms.txt")).toMatch(/^# DIY Accounting\n\n> .+\n\n## Pages\n/);
  });

  it("says the gateway leads to Submit and to the spreadsheets, with their URLs", () => {
    const text = read("llms.txt");
    expect(text).toContain(`DIY Accounting Submit (${SUBMIT_ORIGIN})`);
    expect(text).toContain(`DIY Accounting Spreadsheets (${SPREADSHEETS_ORIGIN})`);
  });
});

describe("llms-full.txt", () => {
  it("is the current build of the pages", () => {
    expect(read("llms-full.txt")).toBe(renderLlmsFullTxt(pages));
  });

  it("holds a section for every sitemap URL", () => {
    for (const url of sitemap) {
      expect(read("llms-full.txt"), url).toContain(`Source: ${url}\n`);
    }
  });
});

describe.each(["llms.txt", "llms-full.txt"])("%s", (file) => {
  it("holds no HTML tag, script or comment", () => {
    const text = read(file);
    expect(text).not.toContain("<script");
    expect(text).not.toContain("<!--");
    expect(text).not.toMatch(/<\/?[a-z][^>]*>/i);
  });
});

describe("pageMarkdown", () => {
  it("turns headings, links, list items and entities into Markdown", () => {
    const html =
      '<main><h2>One</h2><p>A &pound;1 <a href="/x.html">link</a></p><ul><li><strong>Name</strong> &mdash; Role</li></ul></main>';
    expect(pageMarkdown(html, "https://diyaccounting.co.uk/")).toBe(
      "## One\n\nA £1 [link](https://diyaccounting.co.uk/x.html)\n\n- **Name** — Role",
    );
  });
});
