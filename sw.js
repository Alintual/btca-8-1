const CACHE_VERSION = "btca-web-8.1.37";
const APP_CACHE = `${CACHE_VERSION}:app`;
const RUNTIME_CACHE = `${CACHE_VERSION}:runtime`;
const BASE_PATH = "/btca-8-1";
const SW_PATH = BASE_PATH + "/sw.js";

const CORE_ASSETS = [
  "/btca-8-1/",
  "/btca-8-1/icons/btca-apple-touch-icon.png",
  "/btca-8-1/icons/btca-icon-192.png",
  "/btca-8-1/icons/btca-icon-512.png",
  "/btca-8-1/offline/app-shell.json",
  "/btca-8-1/offline/media/manifest.json",
  "/btca-8-1/install-ios.js",
  "/btca-8-1/vendor/zip.min.js",
  "/btca-8-1/branding/splash.gif",
  "/btca-8-1/level1/level1-db.js",
  "/btca-8-1/level1/level1-app.js",
  "/btca-8-1/level1/data/forma_exercise_list.json",
  "/btca-8-1/level1/data/polezCatalog.json",
  "/btca-8-1/level1/data/polezLinks.json",
  "/btca-8-1/level1/data/polezDescriptions.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (requestUrl.pathname === SW_PATH || event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(event.request, copy);
          });
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200) return response;
        const copy = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => {
          cache.put(event.request, copy);
        });
        return response;
      });
    })
  );
});
