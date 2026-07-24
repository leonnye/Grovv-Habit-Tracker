/* Self-destructing service worker.
 * Older Grovv builds registered a SW that could keep serving stale pages
 * ("white screen" after redeploys). Browsers periodically re-fetch sw.js;
 * this version clears caches, unregisters itself, and reloads open tabs.
 */
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch (e) {}
      try {
        await self.registration.unregister();
      } catch (e) {}
      try {
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of clients) {
          if ("navigate" in client) client.navigate(client.url);
        }
      } catch (e) {}
    })(),
  );
});
