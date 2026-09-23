// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/unit-tests/analytics.test.js

import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

const scriptContent = fs.readFileSync(path.join(process.cwd(), "web/www.diyaccounting.co.uk/public/lib/analytics.js"), "utf-8");

const FAKE_RUM_CONFIG = {
  appMonitorId: "app-1",
  identityPoolId: "us-east-1:pool-1",
  guestRoleArn: "arn:aws:iam::283165661847:role/ci-gateway-RumGuestRole",
  region: "us-east-1",
};

describe("web/www.diyaccounting.co.uk/public/lib/analytics.js", () => {
  let headScripts;

  beforeEach(() => {
    headScripts = [];

    global.localStorage = {
      getItem: vi.fn(() => null),
    };

    global.document = {
      head: {
        appendChild: vi.fn((el) => headScripts.push(el)),
      },
      createElement: vi.fn(() => ({ async: false, src: "" })),
    };

    // The script assigns to bare `dataLayer`/`window`, relying on `window === globalThis`, true
    // in a real browser; aliasing window to the Node global reproduces that for eval'd script scope.
    global.window = global;
    delete global.dataLayer;
    delete global.gtag;
    delete global.AwsRumClient;
    delete global.__RUM_CONFIG__;
    delete global.__RUM_INIT_DONE__;

    global.console = { ...console, warn: vi.fn() };
  });

  it("configures GA4 with the shared-property linker domains", () => {
    eval(scriptContent);

    const configCall = global.dataLayer.find((args) => args[0] === "config" && args[1] === "G-C76HK806F1");
    expect(configCall[2]).toEqual({
      linker: { domains: ["diyaccounting.co.uk", "spreadsheets.diyaccounting.co.uk", "submit.diyaccounting.co.uk"] },
    });
  });

  it("appends the gtag.js loader script", () => {
    eval(scriptContent);

    const gtagScript = headScripts.find((el) => el.src === "https://www.googletagmanager.com/gtag/js?id=G-C76HK806F1");
    expect(gtagScript).toBeDefined();
  });

  it("appends a rum-config.js loader whose onload starts RUM init", () => {
    eval(scriptContent);

    const rumConfigLoader = headScripts.find((el) => el.src === "/lib/rum-config.js");
    expect(rumConfigLoader).toBeDefined();
    expect(typeof rumConfigLoader.onload).toBe("function");
  });

  it("does not start the RUM client without consent, even once the config loads", () => {
    eval(scriptContent);
    const rumConfigLoader = headScripts.find((el) => el.src === "/lib/rum-config.js");

    global.window.__RUM_CONFIG__ = FAKE_RUM_CONFIG;
    rumConfigLoader.onload();

    expect(global.window.AwsRumClient).toBeUndefined();
  });

  it("does not start the RUM client when consent is granted but the config is missing", () => {
    global.localStorage.getItem = vi.fn((key) => (key === "consent.analytics" ? "granted" : null));
    eval(scriptContent);
    const rumConfigLoader = headScripts.find((el) => el.src === "/lib/rum-config.js");

    global.window.__RUM_CONFIG__ = null;
    rumConfigLoader.onload();

    expect(global.window.AwsRumClient).toBeUndefined();
  });

  it("starts the RUM client once consent is granted and the config is present", () => {
    global.localStorage.getItem = vi.fn((key) => (key === "consent.analytics" ? "granted" : null));
    eval(scriptContent);
    const rumConfigLoader = headScripts.find((el) => el.src === "/lib/rum-config.js");

    global.window.__RUM_CONFIG__ = FAKE_RUM_CONFIG;
    rumConfigLoader.onload();

    expect(global.window.AwsRumClient).toBeDefined();
    expect(global.window.AwsRumClient.i).toBe(FAKE_RUM_CONFIG.appMonitorId);

    const cwrScript = headScripts.find((el) => el.src === "https://client.rum.us-east-1.amazonaws.com/1.25.0/cwr.js");
    expect(cwrScript).toBeDefined();
  });
});
