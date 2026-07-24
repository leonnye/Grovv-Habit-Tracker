/**
 * Runs in <head> before React. Clears stale service workers / caches and
 * recovers from dead chunk loads after a redeploy (the classic "sidebar +
 * blank page" hang on returning visitors).
 */
export const BOOT_SCRIPT = `(function(){
  try {
    var ALIVE = "__GROVV_ALIVE__";
    var RELOAD_KEY = "grovv.boot.reload";
    var SW_KEY = "grovv.sw.cleared";

    function recover(force) {
      try {
        if (!force && sessionStorage.getItem(RELOAD_KEY)) return;
        sessionStorage.setItem(RELOAD_KEY, "1");
      } catch (e) {}
      var url = new URL(location.href);
      url.searchParams.set("_r", String(Date.now()));
      location.replace(url.toString());
    }

    function isChunkError(msg) {
      msg = String(msg || "").toLowerCase();
      return (
        msg.indexOf("failed to fetch dynamically imported module") !== -1 ||
        msg.indexOf("error loading dynamically imported module") !== -1 ||
        msg.indexOf("importing a module script failed") !== -1 ||
        msg.indexOf("loading chunk") !== -1 ||
        msg.indexOf("chunkloaderror") !== -1 ||
        msg.indexOf("load failed") !== -1
      );
    }

    // Kill any leftover service worker from older builds, then reload once
    // so it stops controlling this tab.
    if ("serviceWorker" in navigator) {
      var hadController = Boolean(navigator.serviceWorker.controller);
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        return Promise.all(regs.map(function (r) { return r.unregister(); })).then(function () {
          if (hadController) {
            try {
              if (!sessionStorage.getItem(SW_KEY)) {
                sessionStorage.setItem(SW_KEY, "1");
                location.reload();
              }
            } catch (e) {
              location.reload();
            }
          }
        });
      }).catch(function () {});
    }
    if ("caches" in window) {
      caches.keys().then(function (keys) {
        keys.forEach(function (k) { caches.delete(k); });
      }).catch(function () {});
    }

    window.addEventListener("vite:preloadError", function (e) {
      try { e.preventDefault(); } catch (err) {}
      recover(false);
    });
    window.addEventListener("error", function (e) {
      var msg = e && e.message;
      var src = (e && (e.filename || (e.target && e.target.src))) || "";
      if (isChunkError(msg) || String(src).indexOf("/assets/") !== -1) recover(false);
    }, true);
    window.addEventListener("unhandledrejection", function (e) {
      var reason = e && e.reason;
      var msg = reason && (reason.message || String(reason));
      if (isChunkError(msg)) recover(false);
    });

    // If React never marks itself alive (stuck white page), offer a hard refresh.
    setTimeout(function () {
      if (window[ALIVE]) return;
      if (document.getElementById("grovv-boot-rescue")) return;
      var el = document.createElement("div");
      el.id = "grovv-boot-rescue";
      el.setAttribute("role", "alert");
      el.style.cssText = "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(12,16,14,.92);color:#f5f2eb;font-family:system-ui,sans-serif;text-align:center";
      el.innerHTML = '<div style="max-width:22rem"><p style="font-size:1.25rem;font-weight:700;margin:0 0 .5rem">Still waking up</p><p style="opacity:.8;font-size:.9rem;margin:0 0 1.25rem;line-height:1.45">An older cached copy of Grovv got stuck. A refresh usually fixes it.</p><button type="button" id="grovv-boot-refresh" style="border:0;border-radius:999px;background:#2d5a27;color:#fff;font-weight:600;padding:.75rem 1.25rem;cursor:pointer">Refresh Grovv</button></div>';
      document.body.appendChild(el);
      var btn = document.getElementById("grovv-boot-refresh");
      if (btn) btn.onclick = function () { recover(true); };
    }, 6000);
  } catch (e) {}
})();`;
