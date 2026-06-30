(function () {
  "use strict";

  var MARKER_KEYS = {
    installSession: "btca-web:install-session",
    homeShortcut: "btca-web:home-shortcut",
    appReady: "btca-web:app-ready",
    mediaState: "btca-web:static-media-state",
  };

  function safeGet(storage, key) {
    try {
      return storage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function parseJson(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function isAppleMobileUa() {
    var ua = navigator.userAgent || "";
    var iPadDesktopMode = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    return /iPhone|iPad|iPod/.test(ua) || iPadDesktopMode;
  }

  function probeContext() {
    var standaloneMedia = false;
    try {
      standaloneMedia = window.matchMedia("(display-mode: standalone)").matches;
    } catch (_) {}

    return {
      ua: navigator.userAgent || "",
      platform: navigator.platform || "",
      isAppleMobile: isAppleMobileUa(),
      isStandalone: standaloneMedia || Boolean(navigator.standalone),
      displayModeStandalone: standaloneMedia,
      navigatorStandalone: typeof navigator.standalone === "boolean" ? navigator.standalone : null,
      isSecureContext: Boolean(window.isSecureContext),
      hasRelatedAppsApi: typeof navigator.getInstalledRelatedApps === "function",
      hasServiceWorker: "serviceWorker" in navigator,
      hasCaches: "caches" in window,
      localStorageAvailable: (function () {
        try {
          localStorage.setItem("__btca_probe__", "1");
          localStorage.removeItem("__btca_probe__");
          return true;
        } catch (_) {
          return false;
        }
      })(),
      sessionStorageAvailable: (function () {
        try {
          sessionStorage.setItem("__btca_probe__", "1");
          sessionStorage.removeItem("__btca_probe__");
          return true;
        } catch (_) {
          return false;
        }
      })(),
    };
  }

  function probeLocalMarkers() {
    var installSession = safeGet(localStorage, MARKER_KEYS.installSession);
    var homeShortcut = safeGet(localStorage, MARKER_KEYS.homeShortcut);
    var appReadyRaw = safeGet(localStorage, MARKER_KEYS.appReady);
    var mediaRaw = safeGet(localStorage, MARKER_KEYS.mediaState);
    var appReady = parseJson(appReadyRaw);
    var media = parseJson(mediaRaw);
    var mediaFiles = media && media.files ? Object.keys(media.files).length : 0;

    return {
      installSession: installSession || "",
      homeShortcut: homeShortcut || "",
      appReady: appReady,
      mediaState: media,
      flags: {
        hasInstallSession: Boolean(String(installSession || "").trim()),
        hasHomeShortcut: homeShortcut === "1",
        hasAppReady: Boolean(appReady && appReady.preparedAt),
        hasMediaState: mediaFiles > 0,
      },
    };
  }

  function probeManifestLink() {
    var link = document.querySelector('link[rel="manifest"]');
    if (!link || !link.href) return { href: "", absolute: "" };
    return {
      href: link.getAttribute("href") || "",
      absolute: new URL(link.href, window.location.href).href,
    };
  }

  function probeRelatedApps() {
    if (!navigator.getInstalledRelatedApps) {
      return Promise.resolve({
        supported: false,
        apps: [],
        matched: false,
        raw: null,
        error: null,
      });
    }

    var manifest = probeManifestLink();
    return navigator.getInstalledRelatedApps().then(function (apps) {
      var list = Array.isArray(apps) ? apps : [];
      var matched = false;
      var i;
      for (i = 0; i < list.length; i += 1) {
        var app = list[i];
        if (app.platform === "webapp") {
          matched = true;
          break;
        }
        if (manifest.absolute && app.id === manifest.absolute) {
          matched = true;
          break;
        }
      }
      return {
        supported: true,
        apps: list,
        matched: matched,
        raw: list,
        error: null,
      };
    }).catch(function (error) {
      return {
        supported: true,
        apps: [],
        matched: false,
        raw: null,
        error: String(error && (error.message || error)),
      };
    });
  }

  function probeServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return Promise.resolve({ supported: false, scope: "", state: "", scriptURL: "" });
    }
    return navigator.serviceWorker.getRegistration().then(function (registration) {
      if (!registration) {
        return { supported: true, scope: "", state: "none", scriptURL: "" };
      }
      var worker = registration.active || registration.waiting || registration.installing;
      return {
        supported: true,
        scope: registration.scope || "",
        state: worker ? worker.state : "unknown",
        scriptURL: worker && worker.scriptURL ? worker.scriptURL : "",
      };
    }).catch(function (error) {
      return {
        supported: true,
        scope: "",
        state: "error",
        scriptURL: "",
        error: String(error && (error.message || error)),
      };
    });
  }

  function probeCacheNames() {
    if (!("caches" in window)) {
      return Promise.resolve({ supported: false, names: [], btcaNames: [] });
    }
    return caches.keys().then(function (names) {
      return {
        supported: true,
        names: names,
        btcaNames: names.filter(function (name) {
          return name.indexOf("btca-web-") === 0;
        }),
      };
    }).catch(function () {
      return { supported: false, names: [], btcaNames: [] };
    });
  }

  function evaluateShortcutPresence(report) {
    var reasons = [];
    var blockers = [];
    var context = report.context;
    var markers = report.markers.flags;
    var related = report.relatedApps;

    if (context.isStandalone) {
      return {
        verdict: "opened_from_home_screen",
        label: "Открыто с экрана Домой (standalone)",
        shouldWarnOnDownloadPage: false,
        confidence: "high",
        reasons: ["Страница уже в режиме standalone — это не вкладка Safari для загрузки."],
        blockers: [],
      };
    }

    if (related.supported && related.matched) {
      blockers.push("getInstalledRelatedApps");
      reasons.push("API getInstalledRelatedApps сообщает, что webapp установлен.");
    } else if (related.supported) {
      reasons.push("getInstalledRelatedApps доступен, но BTCA в списке нет (apps=" + related.apps.length + ").");
    } else {
      reasons.push("getInstalledRelatedApps недоступен в этом браузере.");
    }

    if (markers.hasInstallSession) {
      blockers.push("installSession");
      reasons.push("localStorage: btca-web:install-session присутствует.");
    }
    if (markers.hasHomeShortcut) {
      blockers.push("homeShortcut");
      reasons.push("localStorage: btca-web:home-shortcut = 1.");
    }
    if (markers.hasAppReady) {
      blockers.push("appReady");
      reasons.push("localStorage: btca-web:app-ready (offline-подготовка завершалась).");
    }
    if (markers.hasMediaState) {
      blockers.push("mediaState");
      reasons.push("localStorage: btca-web:static-media-state (медиа распакованы).");
    }

    if (report.serviceWorker.scope) {
      reasons.push("Service Worker зарегистрирован: " + report.serviceWorker.scope);
    }
    if (report.caches.btcaNames.length) {
      reasons.push("Cache Storage BTCA: " + report.caches.btcaNames.join(", "));
    }

    var shortcutSpecific = markers.hasInstallSession || markers.hasHomeShortcut;
    var pwaDataOnly = markers.hasAppReady || markers.hasMediaState;

    if (blockers.indexOf("getInstalledRelatedApps") >= 0 || shortcutSpecific) {
      return {
        verdict: "shortcut_likely",
        label: "Вероятно есть ярлык / установленное PWA",
        shouldWarnOnDownloadPage: true,
        confidence: blockers.indexOf("getInstalledRelatedApps") >= 0 ? "high" : "medium",
        reasons: reasons,
        blockers: blockers,
      };
    }

    if (pwaDataOnly) {
      return {
        verdict: "pwa_data_only",
        label: "На устройстве есть данные PWA (SW/кэш/localStorage), ярлык не подтверждён",
        shouldWarnOnDownloadPage: false,
        confidence: "low",
        reasons: reasons.concat([
          "Это НЕ доказательство ярлыка на экране Домой — только следы прошлой загрузки в Safari.",
          "На iOS из вкладки Safari нельзя надёжно увидеть иконку на Домой программно.",
        ]),
        blockers: blockers,
      };
    }

    return {
      verdict: "clean_browser",
      label: "Чистая вкладка Safari (нет следов установки)",
      shouldWarnOnDownloadPage: false,
      confidence: "high",
      reasons: reasons,
      blockers: blockers,
    };
  }

  function runFullProbe() {
    var report = {
      at: new Date().toISOString(),
      location: window.location.href,
      context: probeContext(),
      markers: probeLocalMarkers(),
      manifest: probeManifestLink(),
      relatedApps: null,
      serviceWorker: null,
      caches: null,
      evaluation: null,
    };

    return Promise.all([
      probeRelatedApps(),
      probeServiceWorker(),
      probeCacheNames(),
    ]).then(function (parts) {
      report.relatedApps = parts[0];
      report.serviceWorker = parts[1];
      report.caches = parts[2];
      report.evaluation = evaluateShortcutPresence(report);
      return report;
    });
  }

  var api = {
    MARKER_KEYS: MARKER_KEYS,
    probeContext: probeContext,
    probeLocalMarkers: probeLocalMarkers,
    probeRelatedApps: probeRelatedApps,
    probeServiceWorker: probeServiceWorker,
    probeCacheNames: probeCacheNames,
    evaluateShortcutPresence: evaluateShortcutPresence,
    runFullProbe: runFullProbe,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.BTCA_SHORTCUT_PROBE = api;
  }
})();
