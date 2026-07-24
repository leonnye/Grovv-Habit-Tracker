/* Grovv installable service worker.
 * Network-first for navigations (avoids stale HTML after redeploys).
 * Cache-first only for hashed build assets.
 */
const CACHE = "grovv-assets-v1";
const ASSET_RE = /\/assets\//;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
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
      fetch(req)
        .then((res) => res)
        .catch(() => caches.match("/") || Response.error()),
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
