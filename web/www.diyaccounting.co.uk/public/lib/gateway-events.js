/* SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 */
/* Copyright (C) 2006-2026 DIY Accounting Limited */

// GA4: select_content events for gateway navigation buttons
(function () {
  if (typeof gtag !== "function") return;

  const buttons = document.querySelectorAll(".gateway-btn");
  for (let i = 0; i < buttons.length; i++) {
    (function (btn) {
      const href = btn.getAttribute("href") || "";
      let itemId = null;
      if (href.indexOf("submit.diyaccounting.co.uk") !== -1) {
        itemId = "submit";
      } else if (href.indexOf("spreadsheets.diyaccounting.co.uk") !== -1) {
        itemId = "spreadsheets";
      }
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
