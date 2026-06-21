(function () {
  "use strict";

  var BTCA_BASE = "/btca-8-1/";
  var INSTALL_CACHE = "btca-web-8.1.38:static-install";
  var MEDIA_CACHE = "btca-web-8.1.38:static-media";
  var MEDIA_STATE_KEY = "btca-web:static-media-state";
  var APP_READY_KEY = "btca-web:app-ready";
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
  var LEVEL1_MODULE_VERSION = "8.1.38";

  var CORE_REL_PATHS = [
    "",
    "icons/btca-apple-touch-icon.png",
    "icons/btca-icon-192.png",
    "icons/btca-icon-512.png",
    "offline/app-shell.json",
    "offline/media/manifest.json",
    "vendor/zip.min.js",
    "level1/level1-db.js?v=" + LEVEL1_MODULE_VERSION,
    "level1/level1-app.js?v=" + LEVEL1_MODULE_VERSION,
    "level1/data/forma_exercise_list.json",
    "level1/data/polezCatalog.json",
    "level1/data/polezLinks.json",
    "level1/data/polezDescriptions.json",
  ];

  window.__BTCA_BASE__ = BTCA_BASE;

  function assetPath(relativePath) {
    var rel = String(relativePath || "").replace(/^\//, "");
    if (!rel) return BTCA_BASE.replace(/\/?$/, "/");
    return BTCA_BASE.replace(/\/?$/, "/") + rel;
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
        preparedAt: new Date().toISOString(),
      }));
    } catch (_) {}
    window.__BTCA_APP_BOOT_READY__ = true;
  }

  function isAppPreparedSync() {
    if (window.__BTCA_APP_BOOT_READY__) return true;
    var appReady = readAppPreparedState();
    if (appReady && appReady.cacheGeneration === getCacheGeneration()) return true;
    return hasPreparedMediaState();
  }

  function hasPreparedMediaState() {
    try {
      var raw = localStorage.getItem(MEDIA_STATE_KEY);
      if (!raw) return false;
      var state = JSON.parse(raw);
      if (!state || !state.version || !state.files) return false;
      if (state.cacheGeneration && state.cacheGeneration !== getCacheGeneration()) return false;
      return true;
    } catch (_) {
      return false;
    }
  }

  function mediaProbeRequest() {
    return new Request(assetPath("offline-unpacked/level1/exercises/1.jpg"));
  }

  function verifyMediaCacheReady() {
    if (!("caches" in window)) return Promise.resolve(false);
    if (!hasPreparedMediaState() && !readAppPreparedState()) {
      return Promise.resolve(false);
    }
    var probe = mediaProbeRequest();
    return caches.open(MEDIA_CACHE).then(function (cache) {
      return cache.match(probe).then(function (hit) {
        if (hit) return true;
        return cache.match(probe.url);
      });
    }).then(function (hit) {
      return Boolean(hit);
    }).catch(function () {
      return false;
    });
  }

  function lockPortraitOrientation() {
    var orientation = screen && screen.orientation;
    if (!orientation || !orientation.lock) return;
    try {
      var result = orientation.lock("portrait-primary");
      if (result && result.catch) result.catch(function () {});
    } catch (_) {}
  }

  function updateForcedPortraitLayout() {
    var root = document.getElementById("root");
    var viewport = window.visualViewport;
    var width = Math.round((viewport && viewport.width) || window.innerWidth || document.documentElement.clientWidth || 0);
    var height = Math.round((viewport && viewport.height) || window.innerHeight || document.documentElement.clientHeight || 0);
    if (!root || !width || !height) return;

    document.documentElement.style.setProperty("--btca-viewport-width", width + "px");
    document.documentElement.style.setProperty("--btca-viewport-height", height + "px");
    var isLandscape = width > height;
    document.body.classList.toggle("btca-force-portrait", isLandscape);
    if (!isLandscape || document.body.classList.contains("btca-allow-landscape")) {
      root.style.top = "";
      root.style.left = "";
      root.style.transform = "";
      return;
    }

    var angle = 0;
    if (typeof window.orientation === "number") {
      angle = window.orientation;
    } else if (screen && screen.orientation && typeof screen.orientation.angle === "number") {
      angle = screen.orientation.angle;
    }
    var normalizedAngle = ((angle % 360) + 360) % 360;
    if (normalizedAngle === 270) {
      root.style.top = "0px";
      root.style.left = width + "px";
      root.style.transform = "rotate(90deg)";
    } else {
      root.style.top = height + "px";
      root.style.left = "0px";
      root.style.transform = "rotate(-90deg)";
    }
  }

  function syncPortraitMode() {
    lockPortraitOrientation();
    updateForcedPortraitLayout();
    window.setTimeout(updateForcedPortraitLayout, 80);
    window.setTimeout(updateForcedPortraitLayout, 260);
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

  function renderRichText(value) {
    return escapeHtml(value)
      .replace(/&lt;a href=&quot;([^&]+)&quot;&gt;([\s\S]*?)&lt;\/a&gt;/g, '<a href="$1" target="_blank" rel="noopener">$2</a>')
      .replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  }

  function renderProgress(title, percent, message) {
    var pct = Math.max(0, Math.min(100, Math.round(percent)));
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
    setPanel(
      '<div class="ios-panel__header"><strong>iOS/iPadOS</strong><span>100%</span></div>' +
      '<div class="progress" aria-label="Прогресс offline-подготовки"><div class="progress__bar" style="width:100%"></div></div>' +
      '<p class="prepare-status prepare-status--ready">Готово для offline.</p>' +
      '<p class="hint">' + escapeHtml(hint) + "</p>"
    );
    markAppPrepared();
    if (isStandalone()) {
      renderInstalledHome();
    }
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
    return Boolean(window.BTCA_LEVEL1_DB && window.BTCA_LEVEL1 && window.BTCA_LEVEL1.boot);
  }

  function loadLevel1Script(src) {
    return new Promise(function (resolve, reject) {
      var isDb = src.indexOf("level1-db") >= 0;
      var isApp = src.indexOf("level1-app") >= 0;

      if (isDb && window.BTCA_LEVEL1_DB) {
        resolve();
        return;
      }
      if (isApp && window.BTCA_LEVEL1 && window.BTCA_LEVEL1.boot) {
        resolve();
        return;
      }

      var existing = document.querySelector('script[src="' + src + '"]');
      if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }

      var script = document.createElement("script");
      script.src = src;
      script.onload = function () {
        if (isDb && !window.BTCA_LEVEL1_DB) {
          reject(new Error("level1-db.js выполнен, но BTCA_LEVEL1_DB не найден"));
          return;
        }
        if (isApp && (!window.BTCA_LEVEL1 || !window.BTCA_LEVEL1.boot)) {
          reject(new Error("level1-app.js выполнен, но BTCA_LEVEL1.boot не найден"));
          return;
        }
        resolve();
      };
      script.onerror = function () { reject(new Error("Не удалось загрузить " + src)); };
      document.head.appendChild(script);
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

  function renderLevel1Screen() {
    var root = document.getElementById("root");
    if (!root) return;

    function openLevel1Screen() {
      installedHomeSnapshot = installedHomeSnapshot || root.innerHTML;
      document.body.classList.add("btca-level1-mode");
      document.body.classList.remove("btca-installed-mode", "btca-screen-mode");
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
        "</main>";

      var back = document.querySelector("[data-btca-level1-back]");
      if (back) {
        back.addEventListener("click", function () {
          if (window.BTCA_LEVEL1 && window.BTCA_LEVEL1.unmount) window.BTCA_LEVEL1.unmount();
          root.innerHTML = installedHomeSnapshot;
          installedHomeSnapshot = "";
          document.body.classList.remove("btca-level1-mode", "btca-allow-landscape");
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
      if (!ready) {
        renderInfo(
          "iOS/iPadOS",
          "Приложение не подготовлено. Откройте " + OFFLINE_PREPARE_URL + " в Safari, нажмите iOS и дождитесь 100%."
        );
        return;
      }
      markAppPrepared();
      openLevel1Screen();
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
    if (route === "about") renderAboutScreen();
  }

  function renderInstalledHome() {
    var intro = document.querySelector(".home__intro");
    var menu = document.querySelector(".platform-menu");
    var panel = getEls().panel;
    var footer = document.querySelector(".footer");

    document.body.classList.add("btca-installed-mode");
    document.body.classList.remove("btca-screen-mode", "btca-level1-mode");

    if (intro) intro.setAttribute("hidden", "hidden");
    if (panel) {
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

  function cacheCoreAssets(onProgress, pctStart, pctEnd) {
    var start = pctStart == null ? 3 : pctStart;
    var end = pctEnd == null ? 15 : pctEnd;
    var report = onProgress || function (percent, message) {
      renderProgress("Подготовка iOS/iPadOS", percent, message);
    };
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
          report(pct, "Загрузка оболочки: " + asset);
          return cache.add(asset).catch(function () {});
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
    var report = onProgress || function (percent, message) {
      renderProgress("Подготовка iOS/iPadOS", percent, message);
    };
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
                report(
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
    var report = onProgress || function (percent, message) {
      renderProgress("Подготовка iOS/iPadOS", percent, message);
    };
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
                report(base, "Загрузка " + pack.id + "/media.btca.zip");
                return fetch(zipUrl, { cache: "no-store" }).then(function (response) {
                  if (!response.ok) throw new Error("Не удалось загрузить " + zipUrl + ": " + response.status);
                  return response.blob();
                }).then(function (blob) {
                  return cache.put(zipUrl, new Response(blob.slice(0, blob.size), {
                    headers: { "Content-Type": "application/zip" },
                  })).then(function () {
                    return unpackZipToCache(blob, pack, manifest.password, cache, base, packShare, report);
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

    setButtonState(true, "Подготовка offline...");

    var report = function (pct, msg) {
      renderProgress("Подготовка iOS/iPadOS", pct, msg);
    };

    report(1, "Регистрация offline-службы...");
    withTimeout(
      navigator.serviceWorker.register(assetPath("sw.js"), { scope: BTCA_BASE })
        .then(function () { return navigator.serviceWorker.ready; }),
      12000,
      "Safari не завершил регистрацию offline-службы. Обновите страницу и попробуйте ещё раз."
    )
      .then(function () {
        report(2, "Загрузка оболочки приложения...");
        return cacheCoreAssets(report, 2, 15);
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
        report(100, "Готово");
        renderReady();
        preloadLevel1ModuleSilently();
      })
      .catch(renderError)
      .then(function () {
        setButtonState(false, "Загрузить все данные для offline");
      });
  }

  function initStandaloneApp() {
    if (!window.isSecureContext || !("caches" in window)) {
      renderInfo("iOS/iPadOS", "Для offline-режима откройте приложение через HTTPS.");
      return;
    }

    function showHome() {
      renderInstalledHome();
      preloadLevel1ModuleSilently();
    }

    if (isAppPreparedSync()) {
      showHome();
      return;
    }

    verifyMediaCacheReady().then(function (ready) {
      if (!ready) {
        renderInfo(
          "iOS/iPadOS",
          "Данные не загружены. Откройте " + OFFLINE_PREPARE_URL + " в Safari, нажмите iOS и дождитесь 100%."
        );
        renderInstalledHome();
        return;
      }
      markAppPrepared();
      showHome();
    }).catch(function (error) {
      renderInfo("iOS/iPadOS", error && (error.message || error));
      renderInstalledHome();
    });
  }

  function init() {
    var els = getEls();
    window.__BTCA_IOS_INSTALLER_READY__ = true;
    syncPortraitMode();
    window.addEventListener("orientationchange", syncPortraitMode);
    window.addEventListener("resize", syncPortraitMode);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", syncPortraitMode);
      window.visualViewport.addEventListener("scroll", syncPortraitMode);
    }
    document.addEventListener("click", handleAppNavigation, true);
    if (els.button) {
      els.button.addEventListener("click", prepareOffline);
    }
    if (isStandalone()) {
      initStandaloneApp();
    } else if (!els.button) {
      return;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
