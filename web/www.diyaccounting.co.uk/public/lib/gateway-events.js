/* SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 */
/* Copyright (C) 2006-2026 DIY Accounting Limited */

// GA4: select_content events for gateway navigation buttons
(function () {
  if (typeof gtag !== "function") return;

  const itemIdByHost = {
    "submit.diyaccounting.co.uk": "submit",
    "spreadsheets.diyaccounting.co.uk": "spreadsheets",
    "diya-gl.co.uk": "diya-gl",
  };

  const buttons = document.querySelectorAll(".gateway-btn");
  for (let i = 0; i < buttons.length; i++) {
    (function (btn) {
      const href = btn.getAttribute("href") || "";
      let host = "";
      try {
        host = new URL(href, window.location.href).hostname;
      } catch {
        host = "";
      }
      const itemId = Object.prototype.hasOwnProperty.call(itemIdByHost, host) ? itemIdByHost[host] : null;
      if (itemId) {
        btn.addEventListener("click", function () {
          gtag("event", "select_content", {
            content_type: "product_link",
            item_id: itemId,
          });
        });
      }
    })(buttons[i]);
  }
})();
