/* Grovv installable service worker.
 * Network-first for navigations (avoids stale HTML after redeploys).
 * Cache-first only for hashed build assets.
 *
 * Healing: when this worker replaces an older one (legacy caches present),
 * it reloads open tabs once — otherwise pages that were running the old
 * build are left frozen with their caches deleted out from under them.
 */
const CACHE = "grovv-v2";
const SHELL_KEY = "/__shell";
const ASSET_RE = /\/assets\//;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      try {
        const res = await fetch("/", { cache: "no-store" });
        if (res.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(SHELL_KEY, res);
        }
      } catch (e) {
        /* offline install — fine */
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const legacyKeys = keys.filter((k) => k !== CACHE);
      const takingOver = legacyKeys.length > 0;
      await Promise.all(legacyKeys.map((k) => caches.delete(k)));
      await self.clients.claim();

      // Old build was live in some tab — reload those tabs once so they pick
      // up the fresh app instead of sitting on a dead page.
      if (takingOver) {
        try {
          const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
          for (const client of clients) {
            if ("navigate" in client) client.navigate(client.url).catch(() => {});
          }
        } catch (e) {
          /* best effort */
        }
      }
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Always go to network for HTML / app shell so redeploys aren't masked.
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          // Keep a fresh copy of the shell for offline launches.
          if (res.ok) {
            const cache = await caches.open(CACHE);
            cache.put(SHELL_KEY, res.clone());
          }
          return res;
        } catch (e) {
          const cached = await caches.match(SHELL_KEY);
          if (cached) return cached;
          return new Response(
            "<!doctype html><meta charset=utf-8><title>Grovv</title><body style=\"font-family:system-ui;display:grid;place-items:center;min-height:100vh;background:#f5f2eb;color:#1a1f1a\"><div style=\"text-align:center;max-width:20rem\"><h1 style=\"font-size:1.3rem\">You're offline</h1><p style=\"opacity:.7\">Grovv couldn't reach the network. Check your connection and try again.</p><button onclick=\"location.reload()\" style=\"border:0;border-radius:999px;background:#2d5a27;color:#fff;font-weight:600;padding:.7rem 1.2rem;cursor:pointer\">Retry</button></div>",
            { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        }
      })(),
    );
    return;
  }

  // Hashed Vite assets can be cached safely.
  if (ASSET_RE.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
  }
});
