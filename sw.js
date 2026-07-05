const CACHE_VERSION = "btca-web-8.1.219";
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

const pendingDownloads = new Map();
const BAZA_DOWNLOAD_PREFIX = BASE_PATH + "/baza-download/";

function safeDownloadFileName(name) {
  return String(name || "screenshot.png").replace(/[\\/"'\r\n]+/g, "_");
}

function networkFirst(request, cacheName) {
  const liveRequest = new Request(request, { cache: "no-store" });
  return fetch(liveRequest)
    .then((response) => {
      if (response && response.status === 200) {
        const copy = response.clone();
        caches.open(cacheName).then((cache) => {
          cache.put(request, copy);
        });
      }
      return response;
    })
    .catch(() => caches.match(request));
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  const data = event.data;
  if (data && data.type === "BAZA_STORE_DOWNLOAD" && data.id && data.buffer) {
    pendingDownloads.set(String(data.id), {
      buffer: data.buffer,
      name: safeDownloadFileName(data.name),
      mime: data.mime || "application/octet-stream",
    });
    setTimeout(() => pendingDownloads.delete(String(data.id)), 120000);
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ ok: true });
    }
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
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (requestUrl.pathname.startsWith(BAZA_DOWNLOAD_PREFIX)) {
    const id = decodeURIComponent(requestUrl.pathname.slice(BAZA_DOWNLOAD_PREFIX.length));
    event.respondWith(
      Promise.resolve().then(() => {
        const entry = pendingDownloads.get(id);
        if (!entry) return new Response("Not found", { status: 404 });
        pendingDownloads.delete(id);
        const headers = new Headers();
        headers.set("Content-Type", entry.mime);
        headers.set("Content-Disposition", 'attachment; filename="' + entry.name + '"');
        headers.set("Content-Length", String(entry.buffer.byteLength || 0));
        headers.set("Cache-Control", "no-store");
        return new Response(entry.buffer, { headers });
      })
    );
    return;
  }

  const isLevelModule =
    /\/level[12]\/.*\.js$/i.test(requestUrl.pathname) ||
    /\/level[12]\/data\/.*\.json$/i.test(requestUrl.pathname);
  const isBtcaModule = /\/btca-[^/]+\.js$/i.test(requestUrl.pathname);
  const isShellProbe = requestUrl.pathname.endsWith("/offline/app-shell.json");

  if (requestUrl.pathname === SW_PATH || event.request.mode === "navigate" || SHELL_PATHS.has(requestUrl.pathname) || isLevelModule || isBtcaModule || isShellProbe) {
    event.respondWith(networkFirst(event.request, RUNTIME_CACHE));
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
