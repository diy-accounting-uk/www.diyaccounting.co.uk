// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

let handler;

beforeAll(() => {
  execFileSync("node", ["scripts/build-gateway-redirects.cjs"], { cwd: process.cwd(), stdio: "ignore" });
  const code = fs.readFileSync(path.join(process.cwd(), "web/www.diyaccounting.co.uk/redirect-function.js"), "utf8");
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  handler = sandbox.handler;
});

function run(host, uri, querystring = {}) {
  return handler({ request: { uri, querystring, headers: { host: { value: host } } } });
}

describe("www host redirect", () => {
  it("301s the root to the apex", () => {
    const res = run("www.diyaccounting.co.uk", "/");
    expect(res.statusCode).toBe(301);
    expect(res.headers.location.value).toBe("https://diyaccounting.co.uk/");
  });

  it("keeps the path", () => {
    const res = run("www.diyaccounting.co.uk", "/about.html");
    expect(res.headers.location.value).toBe("https://diyaccounting.co.uk/about.html");
  });

  it("keeps the query, including repeated and valueless keys", () => {
    const res = run("www.diyaccounting.co.uk", "/about.html", {
      a: { value: "1" },
      b: { value: "", multiValue: [{ value: "x" }, { value: "y" }] },
      c: { value: "" },
    });
    expect(res.headers.location.value).toBe("https://diyaccounting.co.uk/about.html?a=1&b=x&b=y&c");
  });

  it("sends a moved www path to its final target in one hop", () => {
    const res = run("www.diyaccounting.co.uk", "/products.html");
    expect(res.statusCode).toBe(301);
    expect(res.headers.location.value).toBe("https://spreadsheets.diyaccounting.co.uk/");
  });

  it("sends a www self-target path to the apex", () => {
    const res = run("www.diyaccounting.co.uk", "/home.html");
    expect(res.headers.location.value).toBe("https://diyaccounting.co.uk/");
  });

  it("keeps the 410 for www content paths", () => {
    expect(run("www.diyaccounting.co.uk", "/content/x.json").statusCode).toBe(410);
  });

  it("leaves the apex to the legacy path rules", () => {
    const res = run("diyaccounting.co.uk", "/products.html");
    expect(res.headers.location.value).toBe("https://spreadsheets.diyaccounting.co.uk/");
  });

  it("passes the apex pages through", () => {
    const res = run("diyaccounting.co.uk", "/about.html");
    expect(res.uri).toBe("/about.html");
  });
});

describe("old gateway paths that answered 403", () => {
  const apex = "diyaccounting.co.uk";

  it("sends an article id to its html page", () => {
    const res = run(apex, "/article.html", { article: { value: "EasyTaxiDriverAccountingArticle" } });
    expect(res.statusCode).toBe(301);
    expect(res.headers.location.value).toBe("https://spreadsheets.diyaccounting.co.uk/articles/easy-taxi-driver-accounting.html");
  });

  it("sends an article id on the www host to the same html page in one hop", () => {
    const res = run("www.diyaccounting.co.uk", "/article.html", { article: { value: "EasyTaxiDriverAccountingArticle" } });
    expect(res.headers.location.value).toBe("https://spreadsheets.diyaccounting.co.uk/articles/easy-taxi-driver-accounting.html");
  });

  it("sends an article path with no id to the knowledge base", () => {
    const res = run(apex, "/article.html");
    expect(res.headers.location.value).toBe("https://spreadsheets.diyaccounting.co.uk/knowledge-base.html");
  });

  it.each([
    ["BasicSoleTraderProduct", "basic-sole-trader"],
    ["SelfEmployedProduct", "self-employed"],
    ["CompanyAccountsProduct", "company"],
    ["TaxiDriverProduct", "taxi-driver"],
    ["PayslipProduct", "payslip-05"],
  ])("sends a feature path for %s to its product page", (oldId, slug) => {
    const res = run(apex, "/feature.html", { feature: { value: "TaxiReceiptsFeature" }, product: { value: oldId } });
    expect(res.statusCode).toBe(301);
    expect(res.headers.location.value).toBe(`https://spreadsheets.diyaccounting.co.uk/products/${slug}.html`);
  });

  it("sends a feature path with no product to the spreadsheets home page", () => {
    const res = run(apex, "/feature.html", { feature: { value: "TaxiReceiptsFeature" } });
    expect(res.headers.location.value).toBe("https://spreadsheets.diyaccounting.co.uk/");
  });

  it("sends a feature path with an unknown product to the spreadsheets home page", () => {
    const res = run(apex, "/feature.html", { feature: { value: "TaxiReceiptsFeature" }, product: { value: "RetiredProduct" } });
    expect(res.headers.location.value).toBe("https://spreadsheets.diyaccounting.co.uk/");
  });

  it("sends a known product id to its download page", () => {
    const res = run(apex, "/product.html", { product: { value: "CompanyAccountsProduct" } });
    expect(res.headers.location.value).toBe("https://spreadsheets.diyaccounting.co.uk/download.html?product=Company");
  });

  it("sends an unknown product id to the spreadsheets home page", () => {
    const res = run(apex, "/product.html", { product: { value: "RetiredProduct" } });
    expect(res.headers.location.value).toBe("https://spreadsheets.diyaccounting.co.uk/");
  });

  it("serves the Welsh index for /cy/ on the apex", () => {
    const res = run(apex, "/cy/");
    expect(res.uri).toBe("/cy/index.html");
  });

  it("sends /cy/ on the www host to the apex Welsh index", () => {
    const res = run("www.diyaccounting.co.uk", "/cy/");
    expect(res.headers.location.value).toBe("https://diyaccounting.co.uk/cy/index.html");
  });
});
