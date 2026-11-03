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
