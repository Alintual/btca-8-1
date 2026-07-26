const CACHE_VERSION = "btca-web-8.1.292";
const APP_CACHE = `${CACHE_VERSION}:app`;
const RUNTIME_CACHE = `${CACHE_VERSION}:runtime`;
const BASE_PATH = "/btca-8-1";
const SW_PATH = BASE_PATH + "/sw.js";
const SHELL_PATHS = new Set([
  BASE_PATH + "/",
  BASE_PATH + "/index.html",
  BASE_PATH + "/install-ios.js",
  SW_PATH,
]);

const CORE_ASSETS = [
  "/btca-8-1/",
  "/btca-8-1/icons/btca-apple-touch-icon.png",
  "/btca-8-1/icons/btca-icon-192.png",
  "/btca-8-1/icons/btca-icon-512.png",
  "/btca-8-1/offline/app-shell.json",
  "/btca-8-1/offline/media/manifest.json",
  "/btca-8-1/install-ios.js",
  "/btca-8-1/vendor/zip.min.js",
  "/btca-8-1/btca-data-guard.js",
  "/btca-8-1/btca-baza-diagram.js",
  "/btca-8-1/btca-baza-dialogs.js",
  "/btca-8-1/btca-baza-screenshot.js",
  "/btca-8-1/btca-baza-sqlite.js",
  "/btca-8-1/vendor/sql-wasm.js",
  "/btca-8-1/vendor/sql-wasm.wasm",
  "/btca-8-1/btca-slide-menu.js",
  "/btca-8-1/level1/level1-db.js",
  "/btca-8-1/level1/level1-app.js",
  "/btca-8-1/level1/data/forma_exercise_list.json",
  "/btca-8-1/level1/data/polezCatalog.json",
  "/btca-8-1/level1/data/polezLinks.json",
  "/btca-8-1/level1/data/polezDescriptions.json",
  "/btca-8-1/level2/level2-db.js",
  "/btca-8-1/level2/level2-baza.js",
  "/btca-8-1/level2/level2-app.js",
  "/btca-8-1/level2/data/forma_exercise_list.json",
  "/btca-8-1/level2/data/polezCatalog.json",
  "/btca-8-1/level2/data/polezLinks.json",
  "/btca-8-1/level2/data/polezDescriptions.json"
];

function offlineFallback(request) {
  const accept = (request.headers && request.headers.get("accept")) || "";
  if (request.mode === "navigate" || accept.indexOf("text/html") !== -1) {
    return caches.match(BASE_PATH + "/").then((shell) => {
      if (shell) return shell;
      return caches.match(BASE_PATH + "/index.html").then((page) => {
        if (page) return page;
        return new Response("<!doctype html><title>Offline</title><p>Offline</p>", {
          status: 503,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      });
    });
  }
  return Promise.resolve(
    new Response("", {
      status: 503,
      statusText: "Service Unavailable",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  );
}

function safeFetch(request) {
  try {
    return fetch(new Request(request, { cache: "no-store" }));
  } catch (_err) {
    return fetch(request);
  }
}

function putInCache(cacheName, request, response) {
  try {
    if (!response || response.status !== 200 || response.type === "opaque") return;
    const copy = response.clone();
    caches
      .open(cacheName)
      .then((cache) => cache.put(request, copy).catch(function () {}))
      .catch(function () {});
  } catch (_err) {}
}

function networkFirst(request, cacheName) {
  return safeFetch(request)
    .then((response) => {
      putInCache(cacheName, request, response);
      return response;
    })
    .catch(() =>
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return offlineFallback(request);
      })
    );
}

function cacheFirst(request, cacheName) {
  return caches
    .match(request)
    .then((cached) => {
      if (cached) return cached;
      return safeFetch(request)
        .then((response) => {
          putInCache(cacheName, request, response);
          return response;
        })
        .catch(() => offlineFallback(request));
    })
    .catch(() => offlineFallback(request));
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
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
  // Safari/iPad: Range и спец. режимы часто роняют respondWith.
  if (event.request.headers && event.request.headers.get("range")) return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  const isLevelModule =
    /\/level[12]\/.*\.js$/i.test(requestUrl.pathname) ||
    /\/level[12]\/data\/.*\.json$/i.test(requestUrl.pathname);
  const isBtcaModule = /\/btca-[^/]+\.js$/i.test(requestUrl.pathname);
  const isShellProbe = requestUrl.pathname.endsWith("/offline/app-shell.json");

  if (requestUrl.pathname === SW_PATH || event.request.mode === "navigate" || SHELL_PATHS.has(requestUrl.pathname) || isLevelModule || isBtcaModule || isShellProbe) {
    event.respondWith(networkFirst(event.request, RUNTIME_CACHE));
    return;
  }

  event.respondWith(cacheFirst(event.request, RUNTIME_CACHE));
});
