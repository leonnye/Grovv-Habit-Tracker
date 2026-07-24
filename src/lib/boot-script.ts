/**
 * Runs in <head> before React.
 * Recovers from dead chunk loads after a redeploy — but only once per tab,
 * and only for real module/chunk failures (never an endless refresh loop).
 */
export const BOOT_SCRIPT = `(function(){
  try {
    var ALIVE = "__GROVV_ALIVE__";
    var RELOAD_KEY = "grovv.boot.reload";

    // Strip the cache-bust query param after a recovery reload so the URL
    // stays clean and nothing keeps re-triggering on that flag.
    try {
      var clean = new URL(location.href);
      if (clean.searchParams.has("_r")) {
        clean.searchParams.delete("_r");
        history.replaceState(null, "", clean.pathname + clean.search + clean.hash);
      }
    } catch (e) {}

    function recover() {
      try {
        if (sessionStorage.getItem(RELOAD_KEY)) return;
        sessionStorage.setItem(RELOAD_KEY, "1");
      } catch (e) {
        return;
      }
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
        msg.indexOf("chunkloaderror") !== -1
      );
    }

    // Quietly drop leftover workers/caches. Do NOT auto-reload here —
    // that caused refresh loops when paired with React cleanup.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (r) {
          // Keep our own installable worker; remove anything else.
          var script = (r.active && r.active.scriptURL) || (r.installing && r.installing.scriptURL) || (r.waiting && r.waiting.scriptURL) || "";
          if (script.indexOf("/sw.js") === -1) r.unregister();
        });
      }).catch(function () {});
    }

    window.addEventListener("vite:preloadError", function (e) {
      try { e.preventDefault(); } catch (err) {}
      recover();
    });
    window.addEventListener("error", function (e) {
      if (isChunkError(e && e.message)) recover();
    }, true);
    window.addEventListener("unhandledrejection", function (e) {
      var reason = e && e.reason;
      var msg = reason && (reason.message || String(reason));
      if (isChunkError(msg)) recover();
    });

    // Stuck white page: show a manual button only (never auto-refresh).
    setTimeout(function () {
      if (window[ALIVE]) return;
      if (document.getElementById("grovv-boot-rescue")) return;
      var el = document.createElement("div");
      el.id = "grovv-boot-rescue";
      el.setAttribute("role", "alert");
      el.style.cssText = "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(12,16,14,.92);color:#f5f2eb;font-family:system-ui,sans-serif;text-align:center";
      el.innerHTML = '<div style="max-width:22rem"><p style="font-size:1.25rem;font-weight:700;margin:0 0 .5rem">Still waking up</p><p style="opacity:.8;font-size:.9rem;margin:0 0 1.25rem;line-height:1.45">An older cached copy of Grovv got stuck. Tap once to reload a fresh copy.</p><button type="button" id="grovv-boot-refresh" style="border:0;border-radius:999px;background:#2d5a27;color:#fff;font-weight:600;padding:.75rem 1.25rem;cursor:pointer">Refresh once</button></div>';
      document.body.appendChild(el);
      var btn = document.getElementById("grovv-boot-refresh");
      if (btn) btn.onclick = function () {
        try { sessionStorage.removeItem(RELOAD_KEY); } catch (e) {}
        recover();
      };
    }, 8000);
  } catch (e) {}
})();`;
