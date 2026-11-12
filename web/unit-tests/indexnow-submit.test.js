// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PUBLIC_DIR, buildPayload, findKey, sitemapUrls, submit } from "../../scripts/indexnow-submit.mjs";

const KEY = "abcd".repeat(8);

function publicDir({ files = { [`${KEY}.txt`]: KEY }, urls = ["https://diyaccounting.co.uk/"] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "indexnow-"));
  const xml = `<urlset>${urls.map((url) => `<url><loc>${url}</loc></url>`).join("")}</urlset>`;
  fs.writeFileSync(path.join(dir, "sitemap.xml"), xml);
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
  return dir;
}

describe("the gateway key file", () => {
  it("is the only key file and holds its own name", () => {
    const keyFiles = fs.readdirSync(PUBLIC_DIR).filter((name) => /^[0-9a-f]{32}\.txt$/.test(name));
    expect(keyFiles).toHaveLength(1);
    expect(fs.readFileSync(path.join(PUBLIC_DIR, keyFiles[0]), "utf-8")).toBe(keyFiles[0].replace(/\.txt$/, ""));
    expect(findKey()).toBe(keyFiles[0].replace(/\.txt$/, ""));
  });
});

describe("IndexNow URL list", () => {
  it("lists every sitemap URL", () => {
    const xml = fs.readFileSync(path.join(PUBLIC_DIR, "sitemap.xml"), "utf-8");
    expect(sitemapUrls(xml)).toHaveLength(4);
  });

  it("builds the payload with host, key, keyLocation and urlList", () => {
    expect(buildPayload(KEY, ["https://diyaccounting.co.uk/"])).toEqual({
      host: "diyaccounting.co.uk",
      key: KEY,
      keyLocation: `https://diyaccounting.co.uk/${KEY}.txt`,
      urlList: ["https://diyaccounting.co.uk/"],
    });
  });

  it("builds nothing for an empty list", () => {
    expect(buildPayload(KEY, [])).toBeNull();
  });

  it("finds no key when the content differs from the name or the files are two", () => {
    expect(findKey(publicDir({ files: { [`${KEY}.txt`]: "other" } }))).toBeNull();
    expect(findKey(publicDir({ files: { [`${KEY}.txt`]: KEY, [`${"dcba".repeat(8)}.txt`]: "x" } }))).toBeNull();
  });
});

describe("IndexNow submission", () => {
  it("posts the payload to the IndexNow endpoint", async () => {
    const send = vi.fn().mockResolvedValue({ status: 202 });
    await submit({ directory: publicDir(), send });
    expect(send).toHaveBeenCalledTimes(1);
    const [url, init] = send.mock.calls[0];
    expect(url).toBe("https://api.indexnow.org/indexnow");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body).urlList).toEqual(["https://diyaccounting.co.uk/"]);
  });

  it("warns and returns on a non-2xx answer", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await submit({ directory: publicDir(), send: vi.fn().mockResolvedValue({ status: 429 }) });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("::warning"));
    log.mockRestore();
  });

  it("sends nothing for an empty sitemap", async () => {
    const send = vi.fn();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await submit({ directory: publicDir({ urls: [] }), send });
    expect(send).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("sends nothing and warns when the key file is missing", async () => {
    const send = vi.fn();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await submit({ directory: publicDir({ files: {} }), send });
    expect(send).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("::warning"));
    log.mockRestore();
  });
});
