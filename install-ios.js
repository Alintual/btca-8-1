(function () {
  "use strict";

  var BTCA_BASE = "/btca-8-1/";
  var INSTALL_CACHE = "btca-web-8.1.166:static-install";
  var MEDIA_CACHE = "btca-web-8.1.166:static-media";
  var MEDIA_PROBE_RE = /offline-unpacked\/level1\/exercises\/[^/]+\.(jpe?g|png|webp|gif)$/i;
  var MEDIA_STATE_KEY = "btca-web:static-media-state";
  var APP_READY_KEY = "btca-web:app-ready";
  var INSTALL_SESSION_KEY = "btca-web:install-session";
  var HOME_SHORTCUT_KEY = "btca-web:home-shortcut";
  var IOS_TYPO_BASE_PX = 17;
  var IOS_TYPO_PHONE_BODY_PX = 17;
  var IOS_TYPO_IPHONE_MIN = 390;
  // Reference tablet short side (744 CSS px = 1488 design grid @2x).
  var IOS_TYPO_TABLET_REF = 744;
  var IOS_TYPO_TABLET_BODY_PX = 21;
  var IMAGE_RE = /\.(jpe?g|png|gif|webp|bmp|avif)$/i;
  var OFFLINE_PREPARE_URL = "https://alintual.github.io/btca-8-1/";
  var ABOUT_HEADING = "ПРОЕКТ BTCA-mobile v.8.1";
  var ABOUT_MAIN_TEXT = "Настоящее Приложение разработано для локальной установки (развёртывания) на смартфоне или планшете с операционными системами Android или iOS и рассчитано для обучения и тренировки учеников с уровнями подготовки «Уровень 1 — Начальный» и «Уровень 2 — Базовый» (Комплект 1).";
  var ABOUT_POST_TEXT =
    "*****\n" +
    "БТКА, это — учебно-тренировочный программный комплекс, предназначенный для комплексного обучения игре на русском бильярде, выработки и закрепления практических навыков ведения бильярдной игры в Пирамиду, как самостоятельно, так и с тренером, с применением современных методик и технологий.\n" +
    "Тренировочный комплекс БТКА в сочетании с уникальной Методологией обучения составляют общую Систему тренировок БТКА школы русского бильярда «Абриколь» г. Красноярск.\n" +
    '<a href="https://cloud.mail.ru/public/sujN/mpE8mr6aW">Методика обучения</a>\n\n' +
    "На сегодняшний день комплекс БТКА включает в себя два комплекта Приложений (программ), каждый из которых адаптирован к определённому уровню подготовки учеников:\n" +
    "Комплект 1 – для «Уровень 1 — Начальный» и «Уровень 2 — Базовый»;\n" +
    "Комплект 2 – для «Уровень 3 — Продвинутый».\n" +
    "Все Приложения функционируют без использования сети Интернет.\n" +
    "Каждое Приложение:\n" +
    "•  Содержит специфический (соответствующий уровню подготовки) набор упражнений, задач и тестов (в графическом виде), ранжированных по принципу - \"от простого к сложному\", и сгруппированных в тематические разделы по видам тренировок;\n" +
    "•  Включает необходимые инструкции, методическую и справочную информацию;\n" +
    "•  Обеспечивает возможность ввода, хранения и обработки результатов прогресса выполнения учеником практических заданий для последующего статистического анализа с использованием локальной Базы данных (БД);\n" +
    "•  Имеет весь необходимый функционал и автоматизацию, а также интуитивно-понятный интерфейс, что способствует осуществлению полноценного, эффективного тренировочного процесса в комфортных условиях.\n" +
    "Основные характеристики:\n" +
    "•  *Уровень 1 — Начальный* Упражнений – 15, Задач – 59, Полезностей – 9.\n" +
    "•  *Уровень 2 — Базовый* Упражнений – 40, Задач – 263, Полезностей – 15.\n" +
    "•  *Уровень 3 — Продвинутый* Упражнений – более 150, Задач – более 700,\n" +
    "Полезности – интеллектуальная поисковая система по Базе знаний: 18 основополагающих документов, 114 рисунков и видео и более 370 тематических материалов.\n\n" +
    "ОТ АВТОРА. Система тренировок БТКА разработана по результатам систематизации методик обучения русскому бильярду на основе: секретов ведущих тренеров и игроков (в т.ч. В. Симонича, В. Лазарева, С. Баурова, Е. Сталева и др.), опыта «старой школы», а также современных научных и экспериментальных исследований и IT-технологий.\n\n" +
    "Copyright © Юрий Алинт (Андрей Юрьев) 2026";
  var installedHomeSnapshot = "";
  var LEVEL1_MODULE_VERSION = "8.1.79";
  var LEVEL2_MODULE_VERSION = "8.1.79";

  var CORE_REL_PATHS = [
    "",
    "icons/btca-apple-touch-icon.png",
    "icons/btca-icon-192.png",
    "icons/btca-icon-512.png",
    "branding/up.png",
    "branding/baza.png",
    "branding/splash.gif",
    "offline/app-shell.json",
    "offline/media/manifest.json",
    "vendor/zip.min.js",
    "level1/level1-db.js?v=" + LEVEL1_MODULE_VERSION,
    "level1/level1-app.js?v=" + LEVEL1_MODULE_VERSION,
    "level1/data/forma_exercise_list.json",
    "level1/data/polezCatalog.json",
    "level1/data/polezLinks.json",
    "level1/data/polezDescriptions.json",
    "level2/level2-db.js?v=" + LEVEL2_MODULE_VERSION,
    "level2/level2-baza.js?v=" + LEVEL2_MODULE_VERSION,
    "level2/level2-app.js?v=" + LEVEL2_MODULE_VERSION,
    "level2/data/forma_exercise_list.json",
    "level2/data/polezCatalog.json",
    "level2/data/polezLinks.json",
    "level2/data/polezDescriptions.json",
  ];

  window.__BTCA_BASE__ = BTCA_BASE;

  function assetPath(relativePath) {
    var rel = String(relativePath || "").replace(/^\//, "");
    if (!rel) return BTCA_BASE.replace(/\/?$/, "/");
    return BTCA_BASE.replace(/\/?$/, "/") + rel;
  }

  function splashDisplayPct(percent) {
    return Math.max(0, Math.min(100, Math.round(percent)));
  }

  function buildSplashIndicatorHtml(percent) {
    var disp = splashDisplayPct(percent);
    var gifSrc = assetPath("branding/splash.gif");
    return '<div class="btca-boot-splash__gif-wrap">' +
      '<img class="btca-boot-splash__gif" src="' + escapeHtml(gifSrc) + '" alt="" decoding="async">' +
      '<div class="btca-boot-splash__pct" aria-live="polite">' +
      '<span class="btca-boot-splash__pct-num" data-btca-splash-pct-num>' + disp + "</span>" +
      '<span class="btca-boot-splash__pct-sym">%</span></div></div>';
  }

  function renderHomeSplashIndicator(percent) {
    var panel = getEls().panel;
    if (!panel) return;
    var disp = splashDisplayPct(percent);
    var num = panel.querySelector("[data-btca-splash-pct-num]");
    if (num && panel.classList.contains("btca-home-splash-panel")) {
      num.textContent = String(disp);
      var wrap = panel.querySelector(".btca-ios-splash-panel");
      if (wrap) wrap.setAttribute("aria-label", "Прогресс " + disp + "%");
      return;
    }
    panel.className = "ios-panel ios-panel--open btca-home-splash-panel";
    panel.innerHTML =
      '<div class="btca-ios-splash-panel" aria-label="Прогресс ' + disp + '%">' +
      buildSplashIndicatorHtml(disp) +
      "</div>";
  }

  function hideHomeSplashIndicator() {
    var panel = getEls().panel;
    if (!panel) return;
    panel.className = "ios-panel";
    panel.innerHTML = "";
  }

  function mapBootProgress(localPct, startPct, endPct) {
    var span = endPct - startPct;
    if (span <= 0) return splashDisplayPct(endPct);
    return splashDisplayPct(startPct + (localPct / 100) * span);
  }

  function preloadAppModulesForHome(options) {
    options = options || {};
    var startPct = options.startPct != null ? options.startPct : 0;
    var endPct = options.endPct != null ? options.endPct : 100;

    if (!isStandalone()) {
      preloadLevel1ModuleSilently();
      preloadLevel2ModuleSilently();
      return Promise.resolve();
    }
    if (level1ModuleReady() && level2ModuleReady()) {
      hideHomeSplashIndicator();
      return Promise.resolve();
    }

    var v1 = LEVEL1_MODULE_VERSION;
    var v2 = LEVEL2_MODULE_VERSION;
    var steps = [];

    if (!level1ModuleReady()) {
      steps.push(
        { run: function () { return loadLevel1Script(assetPath("level1/level1-db.js?v=" + v1)); } },
        { run: function () { return loadLevel1Script(assetPath("level1/level1-app.js?v=" + v1)); } },
        { run: function () {
          if (!level1ModuleReady()) throw new Error("Модуль Уровня 1 не инициализирован");
          return window.BTCA_LEVEL1.boot();
        } }
      );
    }
    if (!level2ModuleReady()) {
      steps.push(
        { run: function () { return loadLevel2Script(assetPath("level2/level2-db.js?v=" + v2)); } },
        { run: function () { return loadLevel2Script(assetPath("level2/level2-baza.js?v=" + v2)); } },
        { run: function () { return loadLevel2Script(assetPath("level2/level2-app.js?v=" + v2)); } },
        { run: function () {
          if (!level2ModuleReady()) throw new Error("Модуль Уровня 2 не инициализирован");
          return window.BTCA_LEVEL2.boot();
        } }
      );
    }

    if (!steps.length) {
      hideHomeSplashIndicator();
      return Promise.resolve();
    }

    function report(localPct) {
      renderHomeSplashIndicator(mapBootProgress(localPct, startPct, endPct));
    }

    report(0);
    var total = steps.length;
    return steps.reduce(function (chain, step, index) {
      return chain.then(function () {
        report((index / total) * 100);
        return withTimeout(
          step.run(),
          45000,
          "Таймаут загрузки модулей БТКА"
        );
      });
    }, Promise.resolve()).then(function () {
      report(100);
    }).catch(function (error) {
      console.warn("BTCA module preload failed", error);
    }).then(function () {
      hideHomeSplashIndicator();
    });
  }

  function resolvePackZipUrl(pack) {
    if (!pack || !pack.zipUrl) return "";
    if (/^https?:\/\//i.test(pack.zipUrl)) return pack.zipUrl;
    return assetPath(pack.zipUrl.replace(/^\//, ""));
  }

  function getEls() {
    return {
      button: document.getElementById("btca-static-ios"),
      panel: document.getElementById("btca-static-ios-panel"),
    };
  }

  function isAppleMobile() {
    var ua = navigator.userAgent || "";
    var iPadDesktopMode = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    return /iPhone|iPad|iPod/.test(ua) || iPadDesktopMode;
  }

  function isDebugAppleMode() {
    return new URLSearchParams(window.location.search).get("debugApple") === "1";
  }

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || Boolean(navigator.standalone);
  }

  function getCacheGeneration() {
    return MEDIA_CACHE.split(":")[0];
  }

  function readMetaCacheVersion() {
    var meta = document.querySelector('meta[name="btca-cache-version"]');
    return meta ? String(meta.getAttribute("content") || "").trim() : "";
  }

  function readPreparedModuleVersions(state) {
    if (!state) return { level1: "", level2: "" };
    return {
      level1: String(state.level1ModuleVersion || ""),
      level2: String(state.level2ModuleVersion || ""),
    };
  }

  function isPreparedStateCurrent(state) {
    return Boolean(state && state.preparedAt);
  }

  function migratePreparedClientMarkers() {
    var generation = getCacheGeneration();
    try {
      var readyState = readAppPreparedState();
      if (readyState && readyState.preparedAt) {
        readyState.cacheGeneration = generation;
        readyState.level1ModuleVersion = LEVEL1_MODULE_VERSION;
        readyState.level2ModuleVersion = LEVEL2_MODULE_VERSION;
        localStorage.setItem(APP_READY_KEY, JSON.stringify(readyState));
      }
      var mediaRaw = localStorage.getItem(MEDIA_STATE_KEY);
      if (mediaRaw) {
        var mediaState = JSON.parse(mediaRaw);
        if (mediaState && mediaState.files) {
          mediaState.cacheGeneration = generation;
          localStorage.setItem(MEDIA_STATE_KEY, JSON.stringify(mediaState));
        }
      }
    } catch (_) {}
  }

  function invalidatePreparedClientState() {
    try {
      localStorage.removeItem(APP_READY_KEY);
      localStorage.removeItem(MEDIA_STATE_KEY);
    } catch (_) {}
    window.__BTCA_APP_BOOT_READY__ = false;
  }

  function purgeGenerationRuntimeCache() {
    if (!("caches" in window)) return Promise.resolve();
    return caches.delete(getCacheGeneration() + ":runtime").catch(function () {});
  }

  function readInstallSession() {
    try {
      return String(localStorage.getItem(INSTALL_SESSION_KEY) || "").trim();
    } catch (_) {
      return "";
    }
  }

  function isPwaReinstall() {
    return isStandalone() && !readInstallSession();
  }

  function recordInstallSession() {
    if (!isStandalone() || readInstallSession()) return;
    try {
      localStorage.setItem(
        INSTALL_SESSION_KEY,
        String(Date.now()) + "-" + Math.random().toString(36).slice(2, 10)
      );
    } catch (_) {}
    markHomeShortcutPresent();
  }

  function resolvePwaShortcutName() {
    var meta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (meta) {
      var title = String(meta.getAttribute("content") || "").trim();
      if (title) return title;
    }
    var manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink && manifestLink.href) {
      var manifestName = String(manifestLink.getAttribute("data-short-name") || "").trim();
      if (manifestName) return manifestName;
    }
    return "БТКА 8.1";
  }

  function hasActiveShortcutMarkers() {
    return Boolean(readInstallSession() || hasHomeShortcutMarker());
  }

  function hasHomeShortcutMarker() {
    try {
      return localStorage.getItem(HOME_SHORTCUT_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function markHomeShortcutPresent() {
    try {
      localStorage.setItem(HOME_SHORTCUT_KEY, "1");
    } catch (_) {}
  }

  function clearShortcutPresenceMarkers() {
    clearInstallSessionMarker();
    try {
      localStorage.removeItem(HOME_SHORTCUT_KEY);
    } catch (_) {}
  }

  function probeInstalledRelatedApps() {
    if (!navigator.getInstalledRelatedApps) return Promise.resolve(null);
    return navigator.getInstalledRelatedApps().then(function (apps) {
      if (!apps || !apps.length) {
        return isAppleMobile() || isDebugAppleMode() ? null : false;
      }
      var manifestLink = document.querySelector('link[rel="manifest"]');
      var manifestHref = manifestLink
        ? new URL(manifestLink.href, window.location.href).href
        : "";
      for (var i = 0; i < apps.length; i += 1) {
        var app = apps[i];
        if (app.platform === "webapp") return true;
        if (manifestHref && app.id === manifestHref) return true;
      }
      return isAppleMobile() || isDebugAppleMode() ? null : false;
    }).catch(function () {
      return null;
    });
  }

  function clearInstallSessionMarker() {
    try {
      localStorage.removeItem(INSTALL_SESSION_KEY);
    } catch (_) {}
  }

  function syncInstallSessionWithShortcutPresence() {
    if (isStandalone()) return Promise.resolve();
    return probeInstalledRelatedApps().then(function (apiResult) {
      if (apiResult === true) {
        markHomeShortcutPresent();
        return;
      }
      if (apiResult === false) {
        clearShortcutPresenceMarkers();
      }
    });
  }

  function reconcileIosShortcutMarkers() {
    if (isStandalone() || (!isAppleMobile() && !isDebugAppleMode())) {
      return Promise.resolve();
    }
    return probeInstalledRelatedApps().then(function (apiResult) {
      if (apiResult === true) {
        markHomeShortcutPresent();
        return;
      }
      if (apiResult === false) {
        clearShortcutPresenceMarkers();
        return;
      }
      if (!readInstallSession() && hasHomeShortcutMarker()) {
        try {
          localStorage.removeItem(HOME_SHORTCUT_KEY);
        } catch (_) {}
      }
    });
  }

  function detectHomeScreenShortcut() {
    if (isStandalone()) return Promise.resolve(false);
    return probeInstalledRelatedApps().then(function (apiResult) {
      if (apiResult === true) return true;
      if (apiResult === false) {
        clearShortcutPresenceMarkers();
        return false;
      }
      return hasActiveShortcutMarkers();
    });
  }

  function renderShortcutRemovalWarning(shortcutName) {
    var name = String(shortcutName || resolvePwaShortcutName() || "приложения").trim();
    var message =
      "ВНИМАНИЕ. Для корректной загрузки сначала следует удалить ярлык приложения " +
      name +
      ", а затем перезагрузить страницу и повторить загрузку.";
    setPanel(
      '<div class="ios-panel__header"><strong>iOS/iPadOS</strong></div>' +
      '<p class="prepare-status prepare-status--warning">' + escapeHtml(message) + "</p>"
    );
    setButtonState(false, "Загрузить все данные для offline");
  }

  function wipeTrainingDatabasesOnReinstall() {
    if (!isPwaReinstall()) {
      recordInstallSession();
      return Promise.resolve();
    }
    return ensureLevel1Module().then(function () {
      var tasks = [];
      if (window.BTCA_LEVEL1_DB && window.BTCA_LEVEL1_DB.wipeTrainingDatabase) {
        tasks.push(window.BTCA_LEVEL1_DB.wipeTrainingDatabase());
      }
      return ensureLevel2Module().then(function () {
        if (window.BTCA_LEVEL2_DB && window.BTCA_LEVEL2_DB.wipeTrainingDatabase) {
          tasks.push(window.BTCA_LEVEL2_DB.wipeTrainingDatabase());
        }
        return Promise.all(tasks);
      });
    }).catch(function (error) {
      console.warn("BTCA reinstall training DB wipe failed", error);
    }).then(function () {
      recordInstallSession();
    });
  }

  function readAppPreparedState() {
    try {
      var raw = localStorage.getItem(APP_READY_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function markAppPrepared() {
    try {
      localStorage.setItem(APP_READY_KEY, JSON.stringify({
        cacheGeneration: getCacheGeneration(),
        level1ModuleVersion: LEVEL1_MODULE_VERSION,
        level2ModuleVersion: LEVEL2_MODULE_VERSION,
        preparedAt: new Date().toISOString(),
      }));
    } catch (_) {}
    window.__BTCA_APP_BOOT_READY__ = true;
  }

  function isAppPreparedSync() {
    if (!isPreparedStateCurrent(readAppPreparedState())) return false;
    if (!hasPreparedMediaState()) return false;
    return true;
  }

  function hasPreparedMediaState() {
    try {
      var raw = localStorage.getItem(MEDIA_STATE_KEY);
      if (!raw) return false;
      var state = JSON.parse(raw);
      if (!state || !state.files) return false;
      return Object.keys(state.files).some(function (key) {
        return (state.files[key] || 0) > 0;
      });
    } catch (_) {
      return false;
    }
  }

  function migrateMediaCacheFromPreviousGeneration() {
    if (!("caches" in window)) return Promise.resolve(false);
    return caches.keys().then(function (names) {
      var candidates = names.filter(function (name) {
        return name.indexOf("btca-web-") === 0 && name.endsWith(":static-media") && name !== MEDIA_CACHE;
      });
      if (!candidates.length) return false;
      candidates.sort();
      var sourceName = candidates[candidates.length - 1];
      return caches.open(sourceName).then(function (src) {
        return caches.open(MEDIA_CACHE).then(function (dst) {
          return src.keys().then(function (keys) {
            if (!keys.length) return false;
            return Promise.all(keys.map(function (req) {
              return src.match(req).then(function (res) {
                if (res) return dst.put(req, res);
              });
            })).then(function () { return true; });
          });
        });
      });
    }).catch(function () {
      return false;
    });
  }

  function ensureMediaCacheReady() {
    return verifyMediaCacheReady().then(function (ready) {
      if (ready) return true;
      return migrateMediaCacheFromPreviousGeneration().then(function (migrated) {
        if (!migrated) return false;
        return verifyMediaCacheReady();
      });
    });
  }

  function purgeObsoleteMediaCaches() {
    if (!("caches" in window)) return Promise.resolve();
    var generation = getCacheGeneration();
    return caches.keys().then(function (names) {
      return Promise.all(names.filter(function (name) {
        return name.indexOf("btca-web-") === 0 &&
          name.endsWith(":static-media") &&
          name.indexOf(generation) !== 0;
      }).map(function (name) {
        return caches.delete(name);
      }));
    }).catch(function () {});
  }

  function flushClientDataBeforeReload() {
    var tasks = [];
    try {
      if (window.BTCA_LEVEL1_DB && window.BTCA_LEVEL1_DB.flushUiState) {
        tasks.push(window.BTCA_LEVEL1_DB.flushUiState());
      }
      if (window.BTCA_LEVEL2_DB && window.BTCA_LEVEL2_DB.flushUiState) {
        tasks.push(window.BTCA_LEVEL2_DB.flushUiState());
      }
    } catch (_) {}
    return Promise.all(tasks).catch(function () {});
  }

  function refreshShellCacheQuietly() {
    if (!("caches" in window)) return Promise.resolve();
    return cacheCoreAssets(null, 0, 0).catch(function () {});
  }

  function clearStaleClientState() {
    var generation = getCacheGeneration();
    var metaGen = readMetaCacheVersion();
    if (metaGen && metaGen !== generation && !window.__BTCA_META_RELOAD__) {
      window.__BTCA_META_RELOAD__ = true;
      window.location.reload();
      return false;
    }

    try {
      migratePreparedClientMarkers();
    } catch (_) {
      invalidatePreparedClientState();
    }
    return true;
  }

  function purgeObsoleteInstallCaches() {
    if (!("caches" in window)) return Promise.resolve();
    var generation = getCacheGeneration();
    return caches.keys().then(function (names) {
      return Promise.all(names.filter(function (name) {
        if (name.indexOf("btca-web-") !== 0) return false;
        if (name.indexOf(generation) === 0) return false;
        if (name.endsWith(":static-media")) return false;
        return true;
      }).map(function (name) {
        return caches.delete(name);
      }));
    }).catch(function () {});
  }

  function purgeShellInstallCache() {
    if (!("caches" in window)) return Promise.resolve();
    return caches.delete(INSTALL_CACHE).catch(function () {});
  }

  function cachePutAsset(cache, assetUrl) {
    return fetch(assetUrl, { cache: "no-store" })
      .then(function (response) {
        if (!response || !response.ok) return;
        return cache.put(assetUrl, response);
      })
      .catch(function () {});
  }

  function ensureFreshShellAfterDeploy() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistration(BTCA_BASE).then(function (registration) {
      if (!registration) return;
      registration.update().catch(function () {});
      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }
      navigator.serviceWorker.addEventListener("controllerchange", function () {
        if (window.__BTCA_SHELL_RELOADED__) return;
        window.__BTCA_SHELL_RELOADED__ = true;
        flushClientDataBeforeReload().then(function () {
          window.location.reload();
        });
      });
    }).catch(function () {});
  }

  function cacheHasUnpackedLevel1Media(cache) {
    return cache.keys().then(function (keys) {
      for (var i = 0; i < keys.length; i += 1) {
        if (MEDIA_PROBE_RE.test(keys[i].url || "")) return true;
      }
      return false;
    });
  }

  function verifyMediaCacheReady() {
    if (!("caches" in window)) return Promise.resolve(false);
    return caches.open(MEDIA_CACHE).then(cacheHasUnpackedLevel1Media).catch(function () {
      return false;
    });
  }

  function isDesktopBrowser() {
    return !isStandalone() && !isAppleMobile();
  }

  function shouldForcePortraitLayout() {
    return isStandalone() || isAppleMobile();
  }

  function applyBrowserLayoutMode() {
    document.body.classList.toggle("btca-desktop-browser", isDesktopBrowser());
  }

  function clearLandscapeWindowLayout() {
    document.body.classList.remove("btca-landscape-mode", "btca-force-portrait");
    var root = document.getElementById("root");
    if (!root) return;
    root.style.top = "";
    root.style.left = "";
    root.style.transform = "";
  }

  function updateLandscapeWindowLayout() {
    if (!shouldForcePortraitLayout()) {
      clearLandscapeWindowLayout();
      return;
    }

    var viewport = window.visualViewport;
    var width = Math.round((viewport && viewport.width) || window.innerWidth || document.documentElement.clientWidth || 0);
    var height = Math.round((viewport && viewport.height) || window.innerHeight || document.documentElement.clientHeight || 0);
    if (!width || !height) return;

    document.documentElement.style.setProperty("--btca-viewport-width", width + "px");
    document.documentElement.style.setProperty("--btca-viewport-height", height + "px");
    document.body.classList.toggle("btca-landscape-mode", width > height);
    document.body.classList.remove("btca-force-portrait");

    var root = document.getElementById("root");
    if (!root) return;
    root.style.top = "";
    root.style.left = "";
    root.style.transform = "";
  }

  function getTypographyLayoutWidth() {
    var viewport = window.visualViewport;
    var width = Math.round((viewport && viewport.width) || window.innerWidth || document.documentElement.clientWidth || 0);
    var height = Math.round((viewport && viewport.height) || window.innerHeight || document.documentElement.clientHeight || 0);
    if (!width || !height) return IOS_TYPO_IPHONE_MIN;
    return Math.min(width, height);
  }

  function getEffectiveTypographyWidth() {
    return getTypographyLayoutWidth();
  }

  function isBrowserLoadingHomePage() {
    return !document.body.classList.contains("btca-installed-mode") &&
      !document.body.classList.contains("btca-level1-mode") &&
      !document.body.classList.contains("btca-level2-mode") &&
      !document.body.classList.contains("btca-screen-mode");
  }

  function layoutScaleForWidth(layoutWidth) {
    if (!layoutWidth || layoutWidth >= IOS_TYPO_TABLET_REF) return 1;
    return layoutWidth / IOS_TYPO_TABLET_REF;
  }

  function comfortBodyFont(layoutWidth) {
    var proportional = IOS_TYPO_TABLET_BODY_PX * layoutScaleForWidth(layoutWidth);
    return Math.max(IOS_TYPO_PHONE_BODY_PX, proportional);
  }

  function resetHomePhraseInlineLayout() {
    document.querySelectorAll(".home__phrase--one, .home__phrase--two").forEach(function (el) {
      el.style.top = "";
      el.style.left = "";
      el.style.right = "";
      el.style.transform = "";
      el.style.width = "";
    });
  }

  function resetLoadingHomePhraseLayout() {
    if (!isBrowserLoadingHomePage()) return;
    resetHomePhraseInlineLayout();
  }

  function updateHomePhrasesTabletClass() {
    if (!document.body.classList.contains("btca-installed-mode")) {
      document.body.classList.remove("btca-home-phrases-tablet");
      return;
    }
    var layoutWidth = getTypographyLayoutWidth();
    var useTabletPhrases = layoutWidth >= IOS_TYPO_TABLET_REF;
    document.body.classList.toggle("btca-home-phrases-tablet", useTabletPhrases);
  }

  function syncHomeTaglineLayout() {
    if (!document.body.classList.contains("btca-installed-mode")) {
      resetLoadingHomePhraseLayout();
      return;
    }
    resetHomePhraseInlineLayout();
  }

  function clearComfortTypography() {
    document.body.classList.remove("btca-apple-comfort");
    document.body.classList.remove("btca-home-phrases-tablet");
    document.documentElement.style.fontSize = "";
    document.documentElement.style.removeProperty("--btca-comfort-scale");
    document.documentElement.style.removeProperty("--btca-layout-scale");
    document.documentElement.style.removeProperty("--btca-layout-min");
    document.documentElement.style.removeProperty("--btca-layout-actual");
    document.documentElement.style.removeProperty("--btca-body-font");
    resetLoadingHomePhraseLayout();
  }

  function updateComfortTypography() {
    if (!shouldForcePortraitLayout()) {
      clearComfortTypography();
      return;
    }
    var layoutWidth = getEffectiveTypographyWidth();
    var actualWidth = getTypographyLayoutWidth();
    if (isBrowserLoadingHomePage()) {
      document.body.classList.add("btca-apple-comfort");
      document.documentElement.style.fontSize = "";
      document.documentElement.style.setProperty("--btca-comfort-scale", "1");
      document.documentElement.style.setProperty("--btca-layout-scale", "1");
      document.documentElement.style.setProperty("--btca-layout-min", layoutWidth + "px");
      document.documentElement.style.setProperty("--btca-layout-actual", actualWidth + "px");
      document.documentElement.style.setProperty("--btca-body-font", IOS_TYPO_BASE_PX + "px");
      resetLoadingHomePhraseLayout();
      updateHomePhrasesTabletClass();
      return;
    }
    var layoutScale = layoutScaleForWidth(layoutWidth);
    var bodyFont = Math.round(comfortBodyFont(layoutWidth) * 10) / 10;
    var scale = bodyFont / IOS_TYPO_BASE_PX;
    document.body.classList.add("btca-apple-comfort");
    document.documentElement.style.fontSize = bodyFont + "px";
    document.documentElement.style.setProperty("--btca-comfort-scale", String(scale));
    document.documentElement.style.setProperty("--btca-layout-scale", String(Math.round(layoutScale * 1000) / 1000));
    document.documentElement.style.setProperty("--btca-layout-min", layoutWidth + "px");
    document.documentElement.style.setProperty("--btca-layout-actual", actualWidth + "px");
    document.documentElement.style.setProperty("--btca-body-font", bodyFont + "px");
    updateHomePhrasesTabletClass();
    window.requestAnimationFrame(syncHomeTaglineLayout);
  }

  function syncPortraitMode() {
    applyBrowserLayoutMode();
    updateComfortTypography();
    updateLandscapeWindowLayout();
    window.setTimeout(function () {
      updateComfortTypography();
      updateLandscapeWindowLayout();
      syncHomeTaglineLayout();
    }, 80);
    window.setTimeout(function () {
      updateComfortTypography();
      updateLandscapeWindowLayout();
      syncHomeTaglineLayout();
    }, 260);
  }

  function setPanel(html) {
    var panel = getEls().panel;
    if (!panel) return;
    panel.className = "ios-panel ios-panel--open";
    panel.innerHTML = html;
    if (panel.scrollIntoView) {
      panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var DATE_PICKER_MONTHS = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
  ];
  var DATE_PICKER_WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  function dateIsoParts(iso) {
    var match = String(iso || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
  }

  function dateIsoFromParts(y, m, d) {
    return String(y) + "-" + (m < 10 ? "0" : "") + m + "-" + (d < 10 ? "0" : "") + d;
  }

  function openCenteredDatePicker(currentIso, onPick, title) {
    var existing = document.getElementById("btca-date-picker-layer");
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    var today = new Date();
    var todayIso = dateIsoFromParts(today.getFullYear(), today.getMonth() + 1, today.getDate());
    var selected = dateIsoParts(currentIso) || dateIsoParts(todayIso);
    var viewYear = selected.y;
    var viewMonth = selected.m;
    var selectedIso = dateIsoFromParts(selected.y, selected.m, selected.d);

    var layer = document.createElement("div");
    layer.id = "btca-date-picker-layer";
    layer.className = "btca-date-picker-layer";
    layer.setAttribute("role", "dialog");
    layer.setAttribute("aria-modal", "true");
    layer.setAttribute("aria-label", title || "Выбор даты");
    layer.innerHTML =
      '<button type="button" class="btca-date-picker-layer__backdrop" data-btca-date-close aria-label="Закрыть"></button>' +
      '<div class="btca-date-picker-panel">' +
      '<div class="btca-date-picker-panel__title">' + escapeHtml(title || "Дата") + "</div>" +
      '<div class="btca-date-picker-panel__nav">' +
      '<button type="button" class="btca-date-picker-panel__nav-btn" data-btca-date-prev aria-label="Предыдущий месяц">‹</button>' +
      '<div class="btca-date-picker-panel__month" data-btca-date-month></div>' +
      '<button type="button" class="btca-date-picker-panel__nav-btn" data-btca-date-next aria-label="Следующий месяц">›</button>' +
      "</div>" +
      '<div class="btca-date-picker-panel__week" aria-hidden="true">' +
      DATE_PICKER_WEEKDAYS.map(function (day) { return "<span>" + day + "</span>"; }).join("") +
      "</div>" +
      '<div class="btca-date-picker-panel__grid" data-btca-date-grid></div>' +
      '<button type="button" class="btca-l1-picker-done btca-date-picker-panel__done" data-btca-date-done>Готово</button>' +
      "</div>";
    document.body.appendChild(layer);

    var monthEl = layer.querySelector("[data-btca-date-month]");
    var gridEl = layer.querySelector("[data-btca-date-grid]");
    var closed = false;

    function close() {
      if (closed) return;
      closed = true;
      if (layer.parentNode) layer.parentNode.removeChild(layer);
    }

    function confirm() {
      close();
      if (selectedIso) onPick(selectedIso);
    }

    function renderMonth() {
      monthEl.textContent = DATE_PICKER_MONTHS[viewMonth - 1] + " " + viewYear;
      var first = new Date(viewYear, viewMonth - 1, 1);
      var offset = (first.getDay() + 6) % 7;
      var daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
      var cells = [];
      var i;
      for (i = 0; i < offset; i += 1) {
        cells.push('<span class="btca-date-picker-day btca-date-picker-day--empty"></span>');
      }
      for (i = 1; i <= daysInMonth; i += 1) {
        var iso = dateIsoFromParts(viewYear, viewMonth, i);
        var cls = "btca-date-picker-day";
        if (iso === selectedIso) cls += " btca-date-picker-day--selected";
        if (iso === todayIso) cls += " btca-date-picker-day--today";
        cells.push('<button type="button" class="' + cls + '" data-btca-date-day="' + iso + '">' + i + "</button>");
      }
      gridEl.innerHTML = cells.join("");
      gridEl.querySelectorAll("[data-btca-date-day]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          selectedIso = btn.getAttribute("data-btca-date-day");
          renderMonth();
        });
      });
    }

    layer.querySelector("[data-btca-date-prev]").addEventListener("click", function () {
      viewMonth -= 1;
      if (viewMonth < 1) {
        viewMonth = 12;
        viewYear -= 1;
      }
      renderMonth();
    });
    layer.querySelector("[data-btca-date-next]").addEventListener("click", function () {
      viewMonth += 1;
      if (viewMonth > 12) {
        viewMonth = 1;
        viewYear += 1;
      }
      renderMonth();
    });
    layer.querySelector("[data-btca-date-close]").addEventListener("click", close);
    layer.querySelector("[data-btca-date-done]").addEventListener("click", confirm);
    renderMonth();
  }

  function renderRichText(value) {
    return escapeHtml(value)
      .replace(/&lt;a href=&quot;([^&]+)&quot;&gt;([\s\S]*?)&lt;\/a&gt;/g, '<a href="$1" target="_blank" rel="noopener">$2</a>')
      .replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  }

  function renderProgress(title, percent, message) {
    var pct = Math.max(0, Math.min(100, Math.round(percent)));
    if (isStandalone()) {
      renderHomeSplashIndicator(pct);
      return;
    }
    setPanel(
      '<div class="ios-panel__header"><strong>' + escapeHtml(title) + "</strong><span>" + pct + "%</span></div>" +
      '<div class="progress" aria-label="Прогресс offline-подготовки"><div class="progress__bar" style="width:' + pct + '%"></div></div>' +
      '<p class="prepare-status prepare-status--running">' + escapeHtml(message) + "</p>"
    );
  }

  function renderInfo(title, message) {
    setPanel(
      '<div class="ios-panel__header"><strong>' + escapeHtml(title) + "</strong></div>" +
      '<p class="hint">' + escapeHtml(message) + "</p>"
    );
  }

  function renderReady() {
    var hint = isStandalone()
      ? "Offline-пакет подготовлен. Приложение уже открыто с экрана Домой."
      : "Offline-пакет подготовлен. В Safari нажмите «Поделиться» и выберите «На экран Домой».";
    markAppPrepared();
    if (isStandalone()) {
      renderInstalledHome();
      return;
    }
    setPanel(
      '<div class="ios-panel__header"><strong>iOS/iPadOS</strong><span>100%</span></div>' +
      '<div class="progress" aria-label="Прогресс offline-подготовки"><div class="progress__bar" style="width:100%"></div></div>' +
      '<p class="prepare-status prepare-status--ready">Готово для offline.</p>' +
      '<p class="hint">' + escapeHtml(hint) + "</p>"
    );
  }

  function renderAboutScreen() {
    var root = document.getElementById("root");
    if (!root) return;
    installedHomeSnapshot = installedHomeSnapshot || root.innerHTML;
    document.body.classList.add("btca-screen-mode");
    document.body.classList.remove("btca-installed-mode");
    root.innerHTML =
      '<main class="btca-about-screen">' +
      '<header class="btca-screen-header">' +
      '<button class="btca-back-button" type="button" data-btca-back aria-label="Назад">←</button>' +
      '<strong>О проекте</strong>' +
      '<span aria-hidden="true"></span>' +
      "</header>" +
      '<section class="btca-about-content">' +
      '<h1>' + escapeHtml(ABOUT_HEADING) + "</h1>" +
      '<p>' + renderRichText(ABOUT_MAIN_TEXT.trim()) + "</p>" +
      '<div class="btca-about-spacer"></div>' +
      '<p>' + renderRichText(ABOUT_POST_TEXT.trim()) + "</p>" +
      "</section>" +
      "</main>";
    var back = document.querySelector("[data-btca-back]");
    if (back) {
      back.addEventListener("click", function () {
        root.innerHTML = installedHomeSnapshot;
        installedHomeSnapshot = "";
        renderInstalledHome();
      });
    }
  }

  function level1ModuleReady() {
    return Boolean(
      window.BTCA_LEVEL1_DB &&
      window.BTCA_LEVEL1 &&
      window.BTCA_LEVEL1.boot &&
      window.BTCA_LEVEL1.VERSION === LEVEL1_MODULE_VERSION
    );
  }

  function removeInjectedScript(attr, src) {
    var old = document.querySelector('script[' + attr + '="' + src + '"]');
    if (old && old.parentNode) old.parentNode.removeChild(old);
  }

  function loadLevel1Script(src) {
    return new Promise(function (resolve, reject) {
      var isDb = src.indexOf("level1-db") >= 0;
      var isApp = src.indexOf("level1-app") >= 0;

      if (isDb && window.BTCA_LEVEL1_DB && document.querySelector('script[data-btca-level1-src="' + src + '"]')) {
        resolve();
        return;
      }
      if (isApp && window.BTCA_LEVEL1 && window.BTCA_LEVEL1.boot &&
          window.BTCA_LEVEL1.VERSION === LEVEL1_MODULE_VERSION) {
        resolve();
        return;
      }

      if (isDb) delete window.BTCA_LEVEL1_DB;
      if (isApp) delete window.BTCA_LEVEL1;

      fetch(src, { cache: "no-store" })
        .then(function (response) {
          if (!response.ok) throw new Error("Не удалось загрузить " + src + ": " + response.status);
          return response.text();
        })
        .then(function (code) {
          if (!/\(function\s*\(\)/.test(code)) {
            throw new Error("Неверный ответ для " + src);
          }
          removeInjectedScript("data-btca-level1-src", src);
          var script = document.createElement("script");
          script.setAttribute("data-btca-level1-src", src);
          script.textContent = code;
          document.head.appendChild(script);
          if (isDb && !window.BTCA_LEVEL1_DB) {
            throw new Error("level1-db.js выполнен, но BTCA_LEVEL1_DB не найден");
          }
          if (isApp && (!window.BTCA_LEVEL1 || !window.BTCA_LEVEL1.boot)) {
            throw new Error("level1-app.js выполнен, но BTCA_LEVEL1.boot не найден");
          }
          resolve();
        })
        .catch(reject);
    });
  }

  function ensureLevel1Module() {
    if (level1ModuleReady()) return Promise.resolve();
    var v = LEVEL1_MODULE_VERSION;
    return loadLevel1Script(assetPath("level1/level1-db.js?v=" + v)).then(function () {
      return loadLevel1Script(assetPath("level1/level1-app.js?v=" + v));
    }).then(function () {
      if (!level1ModuleReady()) {
        throw new Error("Модуль Уровня 1 не инициализирован");
      }
    });
  }

  function bootLevel1Module() {
    return ensureLevel1Module().then(function () {
      return window.BTCA_LEVEL1.boot();
    });
  }

  function preloadLevel1ModuleSilently() {
    return ensureLevel1Module().then(function () {
      return window.BTCA_LEVEL1.boot();
    }).catch(function (error) {
      console.warn("BTCA Level 1 preload failed", error);
    });
  }

  function level2ModuleReady() {
    return Boolean(
      window.BTCA_LEVEL2_DB &&
      window.BTCA_LEVEL2_BAZA &&
      window.BTCA_LEVEL2 &&
      window.BTCA_LEVEL2.boot &&
      window.BTCA_LEVEL2.VERSION === LEVEL2_MODULE_VERSION
    );
  }

  function loadLevel2Script(src) {
    return new Promise(function (resolve, reject) {
      var isDb = src.indexOf("level2-db") >= 0;
      var isBaza = src.indexOf("level2-baza") >= 0;
      var isApp = src.indexOf("level2-app") >= 0;

      if (isDb && window.BTCA_LEVEL2_DB && document.querySelector('script[data-btca-level2-src="' + src + '"]')) {
        resolve();
        return;
      }
      if (isBaza && window.BTCA_LEVEL2_BAZA && document.querySelector('script[data-btca-level2-src="' + src + '"]')) {
        resolve();
        return;
      }
      if (isApp && window.BTCA_LEVEL2 && window.BTCA_LEVEL2.boot &&
          window.BTCA_LEVEL2.VERSION === LEVEL2_MODULE_VERSION) {
        resolve();
        return;
      }

      if (isDb) delete window.BTCA_LEVEL2_DB;
      if (isBaza) delete window.BTCA_LEVEL2_BAZA;
      if (isApp) delete window.BTCA_LEVEL2;

      fetch(src, { cache: "no-store" })
        .then(function (response) {
          if (!response.ok) throw new Error("Не удалось загрузить " + src + ": " + response.status);
          return response.text();
        })
        .then(function (code) {
          if (!/\(function\s*\(\)/.test(code)) {
            throw new Error("Неверный ответ для " + src);
          }
          removeInjectedScript("data-btca-level2-src", src);
          var script = document.createElement("script");
          script.setAttribute("data-btca-level2-src", src);
          script.textContent = code;
          document.head.appendChild(script);
          if (isDb && !window.BTCA_LEVEL2_DB) {
            throw new Error("level2-db.js выполнен, но BTCA_LEVEL2_DB не найден");
          }
          if (isBaza && !window.BTCA_LEVEL2_BAZA) {
            throw new Error("level2-baza.js выполнен, но BTCA_LEVEL2_BAZA не найден");
          }
          if (isApp && (!window.BTCA_LEVEL2 || !window.BTCA_LEVEL2.boot)) {
            throw new Error("level2-app.js выполнен, но BTCA_LEVEL2.boot не найден");
          }
          resolve();
        })
        .catch(reject);
    });
  }

  function ensureLevel2Module() {
    if (level2ModuleReady()) return Promise.resolve();
    var v = LEVEL2_MODULE_VERSION;
    return loadLevel2Script(assetPath("level2/level2-db.js?v=" + v)).then(function () {
      return loadLevel2Script(assetPath("level2/level2-baza.js?v=" + v));
    }).then(function () {
      return loadLevel2Script(assetPath("level2/level2-app.js?v=" + v));
    }).then(function () {
      if (!level2ModuleReady()) {
        throw new Error("Модуль Уровня 2 не инициализирован");
      }
    });
  }

  function bootLevel2Module() {
    return ensureLevel2Module().then(function () {
      return window.BTCA_LEVEL2.boot();
    });
  }

  function preloadLevel2ModuleSilently() {
    return ensureLevel2Module().then(function () {
      return window.BTCA_LEVEL2.boot();
    }).catch(function (error) {
      console.warn("BTCA Level 2 preload failed", error);
    });
  }

  function renderLevel1Screen() {
    var root = document.getElementById("root");
    if (!root) return;

    function openLevel1Screen() {
      installedHomeSnapshot = installedHomeSnapshot || root.innerHTML;
      document.body.classList.add("btca-level1-mode");
      document.body.classList.remove("btca-installed-mode", "btca-screen-mode", "btca-level2-mode");
      root.innerHTML =
        '<main class="btca-level1-screen">' +
        '<header class="btca-level1-nav">' +
        '<button class="btca-back-button" type="button" data-btca-level1-back aria-label="Назад">←</button>' +
        '<strong class="btca-level1-nav__title">Уровень 1 — Начальный</strong>' +
        '<button class="btca-level1-menu-button" type="button" data-btca-level1-menu aria-label="Меню листов"><span></span><span></span><span></span></button>' +
        "</header>" +
        '<section class="btca-level1-titlebar" data-btca-level1-titlebar></section>' +
        '<section class="btca-level1-content" data-btca-level1-content></section>' +
        '<div class="btca-level1-menu-layer" data-btca-level1-menu-layer hidden></div>' +
        '<div class="btca-level1-menu-layer" data-btca-level1-picker hidden></div>' +
        '<div class="btca-level1-menu-layer" data-btca-level1-baza-menu-layer hidden></div>' +
        '<div class="btca-level1-menu-layer" data-btca-level1-baza-id-layer hidden></div>' +
        '<div class="btca-level1-menu-layer" data-btca-level1-baza-delete-layer hidden></div>' +
        '<div class="btca-l2-baza-toast-host" data-btca-level1-baza-toast hidden></div>' +
        "</main>";

      var back = document.querySelector("[data-btca-level1-back]");
      if (back) {
        back.addEventListener("click", function () {
          if (window.BTCA_LEVEL1 && window.BTCA_LEVEL1.unmount) window.BTCA_LEVEL1.unmount();
          root.innerHTML = installedHomeSnapshot;
          installedHomeSnapshot = "";
          document.body.classList.remove("btca-level1-mode", "btca-level2-mode", "btca-allow-landscape");
          renderInstalledHome();
        });
      }

      var main = root.querySelector(".btca-level1-screen");
      if (!main) return;

      var content = root.querySelector("[data-btca-level1-content]");
      if (content) {
        content.innerHTML = '<p class="prepare-status prepare-status--running">Загрузка Уровня 1…</p>';
      }

      bootLevel1Module().then(function () {
        return window.BTCA_LEVEL1.mount(main);
      }).catch(function (error) {
        if (content) {
          content.innerHTML = '<p class="btca-l1-error">' + escapeHtml(error && (error.message || error)) + "</p>";
        }
      }).then(function () {
        syncPortraitMode();
      });
    }

    if (isAppPreparedSync()) {
      openLevel1Screen();
      return;
    }

    verifyMediaCacheReady().then(function (ready) {
      if (ready && isPreparedStateCurrent(readAppPreparedState())) markAppPrepared();
      openLevel1Screen();
    }).catch(function () {
      openLevel1Screen();
    });
  }

  function renderLevel2Screen() {
    var root = document.getElementById("root");
    if (!root) return;

    function openLevel2Screen() {
      installedHomeSnapshot = installedHomeSnapshot || root.innerHTML;
      document.body.classList.add("btca-level1-mode", "btca-level2-mode");
      document.body.classList.remove("btca-installed-mode", "btca-screen-mode");
      root.innerHTML =
        '<main class="btca-level1-screen">' +
        '<header class="btca-level1-nav">' +
        '<button class="btca-back-button" type="button" data-btca-level2-back aria-label="Назад">←</button>' +
        '<strong class="btca-level1-nav__title">Уровень 2 — Базовый</strong>' +
        '<button class="btca-level1-menu-button" type="button" data-btca-level2-menu aria-label="Меню листов"><span></span><span></span><span></span></button>' +
        "</header>" +
        '<section class="btca-level1-titlebar" data-btca-level2-titlebar></section>' +
        '<section class="btca-level1-content" data-btca-level2-content></section>' +
        '<div class="btca-level1-menu-layer" data-btca-level2-menu-layer hidden></div>' +
        '<div class="btca-level1-menu-layer" data-btca-level2-picker hidden></div>' +
        '<div class="btca-level1-menu-layer" data-btca-level2-baza-menu-layer hidden></div>' +
        '<div class="btca-level1-menu-layer" data-btca-level2-baza-id-layer hidden></div>' +
        '<div class="btca-level1-menu-layer" data-btca-level2-baza-delete-layer hidden></div>' +
        '<div class="btca-l2-baza-toast-host" data-btca-level2-baza-toast hidden></div>' +
        "</main>";

      var back = document.querySelector("[data-btca-level2-back]");
      if (back) {
        back.addEventListener("click", function () {
          if (window.BTCA_LEVEL2 && window.BTCA_LEVEL2.unmount) window.BTCA_LEVEL2.unmount();
          root.innerHTML = installedHomeSnapshot;
          installedHomeSnapshot = "";
          document.body.classList.remove("btca-level1-mode", "btca-level2-mode", "btca-allow-landscape");
          renderInstalledHome();
        });
      }

      var main = root.querySelector(".btca-level1-screen");
      if (!main) return;

      var content = root.querySelector("[data-btca-level2-content]");
      if (content) {
        content.innerHTML = '<p class="prepare-status prepare-status--running">Загрузка Уровня 2…</p>';
      }

      bootLevel2Module().then(function () {
        return window.BTCA_LEVEL2.mount(main);
      }).catch(function (error) {
        if (content) {
          content.innerHTML = '<p class="btca-l1-error">' + escapeHtml(error && (error.message || error)) + "</p>";
        }
      }).then(function () {
        syncPortraitMode();
      });
    }

    if (isAppPreparedSync()) {
      openLevel2Screen();
      return;
    }

    verifyMediaCacheReady().then(function (ready) {
      if (ready && isPreparedStateCurrent(readAppPreparedState())) markAppPrepared();
      openLevel2Screen();
    }).catch(function () {
      openLevel2Screen();
    });
  }

  function handleAppNavigation(event) {
    var target = event.target && event.target.closest ? event.target.closest("[data-btca-route]") : null;
    if (!target || !document.body.classList.contains("btca-installed-mode")) return;
    event.preventDefault();
    var route = target.getAttribute("data-btca-route");
    if (route === "level1") {
      try {
        renderLevel1Screen();
      } catch (error) {
        console.error("BTCA Level 1 open failed", error);
      }
      return;
    }
    if (route === "level2") {
      try {
        renderLevel2Screen();
      } catch (error) {
        console.error("BTCA Level 2 open failed", error);
      }
      return;
    }
    if (route === "about") renderAboutScreen();
  }

  var PHRASE_ONE_TABLET_HTML =
    '<span class="home__phrase1-line1">  Бильярдный</span>' +
    '<span class="home__phrase1-line2"> Тренировочный</span>';
  var PHRASE_TWO_LINE2_BASE = "            Абриколь";
  var PHRASE_TWO_LINE2_TABLET = "              Абриколь";
  var PHRASE_TWO_TABLET_HTML =
    '<span class="home__phrase2-line1">Комплекс</span>' +
    '<span class="home__phrase2-line2">' + PHRASE_TWO_LINE2_TABLET + '</span>';

  function cleanupOrphanHomePhraseMarkup() {
    if (document.body.classList.contains("btca-installed-mode")) return;
    var slot = document.querySelector(".home__tagline-slot");
    if (!slot) return;

    var phraseTwoAll = slot.querySelectorAll(".home__phrase--two");
    if (phraseTwoAll.length > 1) {
      var keeper = slot.querySelector(".home__phrase--two:not(.home__phrase--two-tablet)") || phraseTwoAll[0];
      phraseTwoAll.forEach(function (el) {
        if (el !== keeper && el.parentNode) el.parentNode.removeChild(el);
      });
    }

    var phraseTwo = slot.querySelector(".home__phrase--two:not(.home__phrase--two-tablet)");
    if (phraseTwo) {
      phraseTwo.classList.remove("home__phrase--two-default", "home__phrase--two-tablet");
      if (!document.body.classList.contains("btca-installed-mode")) {
        var line2 = phraseTwo.querySelector(".home__phrase2-line2");
        if (line2) line2.textContent = PHRASE_TWO_LINE2_BASE;
      }
    }

    slot.querySelectorAll(".home__phrase--two-tablet").forEach(function (el) {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
  }

  function ensurePhraseTwoTabletMarkup() {
    if (!document.body.classList.contains("btca-installed-mode")) return;
    var slot = document.querySelector(".home__tagline-slot");
    if (!slot) return;
    var defaultPhrase = slot.querySelector(".home__phrase--two:not(.home__phrase--two-tablet)");
    var tablet = slot.querySelector(".home__phrase--two-tablet");
    if (!tablet) {
      tablet = document.createElement("div");
      tablet.className = "home__phrase home__phrase--two home__phrase--two-tablet";
      tablet.innerHTML = PHRASE_TWO_TABLET_HTML;
      if (defaultPhrase && defaultPhrase.parentNode) {
        defaultPhrase.parentNode.insertBefore(tablet, defaultPhrase.nextSibling);
      } else {
        slot.appendChild(tablet);
      }
      return;
    }
    var line2 = tablet.querySelector(".home__phrase2-line2");
    if (!line2 || line2.textContent !== PHRASE_TWO_LINE2_TABLET) {
      tablet.innerHTML = PHRASE_TWO_TABLET_HTML;
    }
  }

  function ensurePhraseOneTabletMarkup() {
    var slot = document.querySelector(".home__tagline-slot");
    if (!slot) return;
    var defaultPhrase = slot.querySelector(".home__phrase--one-default");
    if (!defaultPhrase) {
      var legacy = slot.querySelector(".home__phrase--one:not(.home__phrase--one-tablet)");
      if (legacy) {
        legacy.classList.add("home__phrase--one-default");
        defaultPhrase = legacy;
      }
    }
    var tablet = slot.querySelector(".home__phrase--one-tablet");
    if (!tablet) {
      tablet = document.createElement("p");
      tablet.className = "home__phrase home__phrase--one home__phrase--one-tablet";
      tablet.innerHTML = PHRASE_ONE_TABLET_HTML;
      if (defaultPhrase && defaultPhrase.parentNode) {
        defaultPhrase.parentNode.insertBefore(tablet, defaultPhrase.nextSibling);
      } else {
        slot.appendChild(tablet);
      }
      return;
    }
    if (!tablet.querySelector(".home__phrase1-line1")) {
      tablet.innerHTML = PHRASE_ONE_TABLET_HTML;
    }
  }

  function renderInstalledHome(options) {
    options = options || {};
    var preserveSplash = Boolean(options.preserveSplash);
    var intro = document.querySelector(".home__intro");
    var menu = document.querySelector(".platform-menu");
    var panel = getEls().panel;
    var footer = document.querySelector(".footer");

    document.body.classList.add("btca-installed-mode");
    document.body.classList.remove("btca-screen-mode", "btca-level1-mode", "btca-level2-mode");

    if (intro) intro.setAttribute("hidden", "hidden");
    if (panel && !preserveSplash) {
      panel.className = "ios-panel";
      panel.innerHTML = "";
    }
    if (menu) {
      menu.className = "platform-menu btca-work-menu";
      menu.setAttribute("aria-label", "Главное меню БТКА");
      menu.innerHTML =
        '<button class="platform-button btca-work-menu__item btca-work-menu__item--level1" type="button" data-btca-route="level1"><span>Уровень 1 — Начальный</span></button>' +
        '<button class="platform-button btca-work-menu__item btca-work-menu__item--level2" type="button" data-btca-route="level2"><span>Уровень 2 — Базовый</span></button>' +
        '<button class="platform-button btca-work-menu__item btca-work-menu__item--about" type="button" data-btca-route="about"><span>О проекте</span></button>';
    }
    if (footer) {
      footer.innerHTML = "<span>BTCA-mobile v.8.1 © 2026 Alint&apos;s R.lab</span>";
    }
    ensurePhraseOneTabletMarkup();
    ensurePhraseTwoTabletMarkup();
    cleanupOrphanHomePhraseMarkup();
    installedHomeSnapshot = "";
    syncPortraitMode();
  }

  function renderError(error) {
    setPanel(
      '<div class="ios-panel__header"><strong>Ошибка iOS/iPadOS</strong></div>' +
      '<p class="prepare-status prepare-status--error">' + escapeHtml(error && (error.message || error)) + "</p>"
    );
  }

  function setButtonState(isRunning, label) {
    var button = getEls().button;
    if (!button) return;
    button.disabled = isRunning;
    button.className = isRunning
      ? "platform-button platform-button--ios platform-button--pending"
      : "platform-button platform-button--ios";

    var small = button.querySelector("small");
    if (small) small.textContent = label;
  }

  function withTimeout(promise, ms, message) {
    var timeoutId;
    var timeout = new Promise(function (_, reject) {
      timeoutId = window.setTimeout(function () {
        reject(new Error(message));
      }, ms);
    });

    return Promise.race([promise, timeout]).then(function (result) {
      window.clearTimeout(timeoutId);
      return result;
    }, function (error) {
      window.clearTimeout(timeoutId);
      throw error;
    });
  }

  function loadZipLibrary() {
    if (window.zip && window.zip.ZipReader) return Promise.resolve();

    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = assetPath("vendor/zip.min.js");
      script.onload = function () {
        if (window.zip && window.zip.ZipReader) {
          if (window.zip.configure) window.zip.configure({ useWebWorkers: false });
          resolve();
        }
        else reject(new Error("zip.js загрузился, но API недоступен"));
      };
      script.onerror = function () {
        reject(new Error("Не удалось загрузить zip.js"));
      };
      document.head.appendChild(script);
    });
  }

  function resolveProgressCallback(onProgress) {
    if (typeof onProgress === "function") return onProgress;
    return function (percent, message) {
      renderProgress("Подготовка iOS/iPadOS", percent, message);
    };
  }

  function registerOfflineServiceWorker() {
    return withTimeout(
      navigator.serviceWorker.register(assetPath("sw.js"), { scope: BTCA_BASE })
        .then(function () { return navigator.serviceWorker.ready; }),
      12000,
      "Safari не завершил регистрацию offline-службы. Обновите страницу и попробуйте ещё раз."
    ).then(function () {
      return undefined;
    });
  }

  function cacheCoreAssets(onProgress, pctStart, pctEnd) {
    var start = pctStart == null ? 3 : pctStart;
    var end = pctEnd == null ? 15 : pctEnd;
    var emitProgress = resolveProgressCallback(onProgress);
    return caches.open(INSTALL_CACHE).then(function (cache) {
      var documentAssets = Array.prototype.slice
        .call(document.querySelectorAll("script[src], link[rel='stylesheet'][href], link[rel='modulepreload'][href]"))
        .map(function (element) {
          return element.src || element.href;
        })
        .filter(Boolean)
        .map(function (assetUrl) {
          var url = new URL(assetUrl, window.location.origin);
          return url.origin === window.location.origin ? url.pathname + url.search : null;
        })
        .filter(Boolean);
      var coreAssets = CORE_REL_PATHS.map(assetPath);
      var allAssets = Array.from(new Set(coreAssets.concat(documentAssets)));

      return allAssets.reduce(function (promise, asset, index) {
        return promise.then(function () {
          var pct = start + ((index + 1) / allAssets.length) * (end - start);
          emitProgress(pct, "Загрузка оболочки: " + asset);
          return cachePutAsset(cache, asset);
        });
      }, Promise.resolve());
    });
  }

  function contentTypeFor(path) {
    var lower = path.toLowerCase();
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".gif")) return "image/gif";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".avif")) return "image/avif";
    if (lower.endsWith(".json")) return "application/json; charset=utf-8";
    return "application/octet-stream";
  }

  function safeEntryPath(filename) {
    var entryPath = String(filename || "").replace(/\\/g, "/");
    if (!entryPath || entryPath.indexOf("..") >= 0 || entryPath.charAt(0) === "/") return null;
    return entryPath.split("/").filter(Boolean).join("/");
  }

  function unpackZipToCache(blob, pack, password, cache, progressBase, progressShare, onProgress) {
    var emitProgress = resolveProgressCallback(onProgress);
    var reader = new window.zip.ZipReader(new window.zip.BlobReader(blob), password ? { password: password } : {});
    return reader.getEntries().then(function (entries) {
      var files = entries.filter(function (entry) { return !entry.directory; });
      var images = files.filter(function (entry) { return IMAGE_RE.test(safeEntryPath(entry.filename) || ""); });
      var imageCount = 0;

      return files.reduce(function (promise, entry) {
        return promise.then(function () {
          var entryPath = safeEntryPath(entry.filename);
          if (!entryPath) return;

          return entry.getData(new window.zip.BlobWriter(contentTypeFor(entryPath)), password ? { password: password } : {}).then(function (output) {
            return cache.put(
              assetPath("offline-unpacked/" + pack.id + "/" + entryPath),
              new Response(output, { headers: { "Content-Type": contentTypeFor(entryPath) } })
            ).then(function () {
              if (IMAGE_RE.test(entryPath)) {
                imageCount += 1;
                emitProgress(
                  progressBase + Math.min(0.95, imageCount / Math.max(1, images.length)) * progressShare,
                  "Распаковка " + pack.id + ": " + imageCount + "/" + images.length
                );
              }
            });
          });
        });
      }, Promise.resolve()).then(function () {
        return reader.close().then(function () {
          return { files: files.length, images: imageCount };
        });
      });
    }).catch(function (error) {
      return reader.close().catch(function () {}).then(function () {
        throw error;
      });
    });
  }

  function prepareMediaArchives(onProgress, pctStart, pctEnd) {
    var start = pctStart == null ? 15 : pctStart;
    var end = pctEnd == null ? 92 : pctEnd;
    var emitProgress = resolveProgressCallback(onProgress);
    return fetch(assetPath("offline/media/manifest.json"), { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("Не найден media manifest: " + response.status);
        return response.json();
      })
      .then(function (manifest) {
        if (!manifest.packs || !manifest.packs.length) return;

        return loadZipLibrary().then(function () {
          return caches.open(MEDIA_CACHE).then(function (cache) {
            var preparedFiles = {};
            var packShare = (end - start) / manifest.packs.length;

            return manifest.packs.reduce(function (promise, pack, index) {
              return promise.then(function () {
                var zipUrl = resolvePackZipUrl(pack);
                var base = start + index * packShare;
                emitProgress(base, "Загрузка " + pack.id + "/media.btca.zip");
                return fetch(zipUrl, { cache: "no-store" }).then(function (response) {
                  if (!response.ok) throw new Error("Не удалось загрузить " + zipUrl + ": " + response.status);
                  return response.blob();
                }).then(function (blob) {
                  return cache.put(zipUrl, new Response(blob.slice(0, blob.size), {
                    headers: { "Content-Type": "application/zip" },
                  })).then(function () {
                    return unpackZipToCache(blob, pack, manifest.password, cache, base, packShare, emitProgress);
                  });
                }).then(function (result) {
                  preparedFiles[pack.id] = result.images;
                });
              });
            }, Promise.resolve()).then(function () {
              localStorage.setItem(MEDIA_STATE_KEY, JSON.stringify({
                version: manifest.version,
                cacheGeneration: getCacheGeneration(),
                preparedAt: new Date().toISOString(),
                files: preparedFiles,
              }));
            });
          });
        });
      });
  }

  function prepareOffline() {
    if (!isAppleMobile() && !isDebugAppleMode()) {
      renderInfo("iOS/iPadOS", "Вы открыли страницу не на устройстве Apple. Для iOS/iPadOS откройте эту ссылку в Safari на iPhone или iPad.");
      return;
    }

    if (!window.isSecureContext) {
      renderInfo("iOS/iPadOS", "Для подготовки offline-пакета откройте страницу через HTTPS.");
      return;
    }

    if (!("serviceWorker" in navigator) || !("caches" in window)) {
      renderInfo("iOS/iPadOS", "Этот браузер не поддерживает PWA offline-кэш.");
      return;
    }

    reconcileIosShortcutMarkers()
      .then(function () {
        return detectHomeScreenShortcut();
      })
      .then(function (hasShortcut) {
      if (hasShortcut) {
        renderShortcutRemovalWarning(resolvePwaShortcutName());
        setButtonState(false, "Загрузить все данные для offline");
        return;
      }
      clearShortcutPresenceMarkers();
      beginOfflinePreparation();
    });
  }

  function beginOfflinePreparation() {
    setButtonState(true, "Подготовка offline...");

    var report = function (pct, msg) {
      renderProgress("Подготовка iOS/iPadOS", pct, msg);
    };

    report(1, "Регистрация offline-службы...");
    registerOfflineServiceWorker()
      .then(function () {
        report(2, "Очистка устаревшей оболочки...");
        return purgeShellInstallCache().then(function () {
          return purgeGenerationRuntimeCache();
        });
      })
      .then(function () {
        report(3, "Загрузка оболочки приложения...");
        return cacheCoreAssets(report, 3, 15);
      })
      .then(function () {
        return verifyMediaCacheReady();
      })
      .then(function (mediaReady) {
        if (mediaReady) {
          report(95, "Материалы уже распакованы");
          return;
        }
        report(15, "Загрузка и распаковка ZIP-архивов...");
        return prepareMediaArchives(report, 15, 95);
      })
      .then(function () {
        if (isStandalone()) {
          markAppPrepared();
          renderInstalledHome({ preserveSplash: true });
          return preloadAppModulesForHome({ startPct: 100, endPct: 100 });
        }
        report(100, "Готово");
        renderReady();
        preloadLevel1ModuleSilently();
        preloadLevel2ModuleSilently();
      })
      .catch(renderError)
      .then(function () {
        setButtonState(false, "Загрузить все данные для offline");
      });
  }

  function bootstrapStandaloneShell(mediaReady) {
    function showHome() {
      renderInstalledHome();
      return preloadAppModulesForHome();
    }

    if (!mediaReady) {
      renderInstalledHome();
      prepareOffline();
      return;
    }

    if (!readAppPreparedState()) {
      markAppPrepared();
    }

    showHome();
    refreshShellCacheQuietly();
  }

  function init() {
    var els = getEls();
    window.__BTCA_IOS_INSTALLER_READY__ = true;
    window.__BTCA_OPEN_DATE_INPUT__ = openCenteredDatePicker;
    if (!clearStaleClientState()) return;

    ensureMediaCacheReady()
      .then(function (mediaReady) {
        return purgeObsoleteInstallCaches().then(function () {
          if (!mediaReady) return false;
          return purgeObsoleteMediaCaches().then(function () { return true; });
        });
      })
      .then(function (mediaReady) {
        ensureFreshShellAfterDeploy();
        cleanupOrphanHomePhraseMarkup();
        syncPortraitMode();
        window.addEventListener("orientationchange", syncPortraitMode);
        window.addEventListener("resize", syncPortraitMode);
        if (window.visualViewport) {
          window.visualViewport.addEventListener("resize", syncPortraitMode);
        }
        document.addEventListener("click", handleAppNavigation, true);
        if (els.button) {
          els.button.addEventListener("click", prepareOffline);
        }
        if (!isStandalone()) {
          syncInstallSessionWithShortcutPresence().then(reconcileIosShortcutMarkers);
        }
        if (isStandalone()) {
          return wipeTrainingDatabasesOnReinstall().then(function () {
            bootstrapStandaloneShell(mediaReady);
          });
        }
      })
      .catch(function (error) {
        console.warn("BTCA bootstrap failed", error);
        ensureFreshShellAfterDeploy();
        cleanupOrphanHomePhraseMarkup();
        syncPortraitMode();
        document.addEventListener("click", handleAppNavigation, true);
        if (els.button) {
          els.button.addEventListener("click", prepareOffline);
        }
        if (!isStandalone()) {
          syncInstallSessionWithShortcutPresence().then(reconcileIosShortcutMarkers);
        }
        if (isStandalone()) {
          return wipeTrainingDatabasesOnReinstall().then(function () {
            renderInstalledHome();
            prepareOffline();
          });
        }
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
