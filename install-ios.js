(function () {
  "use strict";

  var INSTALL_CACHE = "btca-web-8.1.33:static-install";
  var MEDIA_CACHE = "btca-web-8.1.33:static-media";
  var MEDIA_STATE_KEY = "btca-web:static-media-state";
  var IMAGE_RE = /\.(jpe?g|png|gif|webp|bmp|avif)$/i;
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
  var level1ActiveSheet = "forma";
  var LEVEL1_SHEETS = [
    { key: "forma", label: "Форма", title: "Форма ввода", emoji: "📊", status: "Упр. 1 - активно!", statusTone: "active" },
    { key: "baza", label: "База", title: "База данных", emoji: "", status: "пуста", statusTone: "active" },
    { key: "nav", label: "Упражнения", title: "Упражнения", emoji: "🔎", status: "Упр. 1 - активно!", statusTone: "active" },
    { key: "polez", label: "Полезности", title: "Полезности", emoji: "📚", status: "Справочное пособие", statusTone: "muted" },
  ];

  var CORE_ASSETS = [
    "/",
    "/icons/btca-apple-touch-icon.png?v=8.1.22",
    "/icons/btca-icon-192.png?v=8.1.22",
    "/icons/btca-icon-512.png?v=8.1.22",
    "/offline/app-shell.json",
    "/offline/media/manifest.json",
    "/vendor/zip.min.js",
  ];

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

  function hasPreparedMediaState() {
    try {
      var raw = localStorage.getItem(MEDIA_STATE_KEY);
      if (!raw) return false;
      var state = JSON.parse(raw);
      return Boolean(state && state.version && state.files);
    } catch (_) {
      return false;
    }
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
    setPanel(
      '<div class="ios-panel__header"><strong>' + escapeHtml(title) + "</strong><span>" + Math.round(percent) + "%</span></div>" +
      '<div class="progress" aria-label="Прогресс offline-подготовки"><div class="progress__bar" style="width:' + Math.max(0, Math.min(100, percent)) + '%"></div></div>' +
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
    if (isStandalone()) {
      window.setTimeout(renderInstalledHome, 500);
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

  function level1SheetByKey(key) {
    return LEVEL1_SHEETS.filter(function (sheet) { return sheet.key === key; })[0] || LEVEL1_SHEETS[0];
  }

  function renderLevel1TitleBar() {
    var titlebar = document.querySelector("[data-btca-level1-titlebar]");
    if (!titlebar) return;
    var sheet = level1SheetByKey(level1ActiveSheet);
    titlebar.innerHTML =
      '<div class="btca-level1-titlebar__row">' +
      '<div class="btca-level1-titlebar__title-group">' +
      '<span class="btca-level1-titlebar__title">' + escapeHtml(sheet.title) + "</span>" +
      (sheet.emoji ? '<span class="btca-level1-titlebar__emoji" aria-hidden="true">' + sheet.emoji + "</span>" : "") +
      "</div>" +
      '<span class="btca-level1-titlebar__spacer"></span>' +
      '<span class="btca-level1-titlebar__status' + (sheet.statusTone === "muted" ? " btca-level1-titlebar__status--muted" : "") + '">' + escapeHtml(sheet.status) + "</span>" +
      "</div>";
  }

  function renderLevel1Content() {
    var content = document.querySelector("[data-btca-level1-content]");
    if (!content) return;
    if (level1ActiveSheet === "forma") {
      content.innerHTML =
        '<section class="btca-level1-card" aria-label="Форма ввода">' +
        '<div class="btca-level1-card__row"><span>Дата</span><span class="btca-level1-field">' + new Date().toLocaleDateString("ru-RU") + "</span></div>" +
        '<div class="btca-level1-card__row"><span>Упр.</span><span class="btca-level1-field">1</span></div>' +
        '<div class="btca-level1-card__row"><span>Задача</span><span class="btca-level1-field">—</span></div>' +
        "</section>";
      return;
    }
    if (level1ActiveSheet === "baza") {
      content.innerHTML =
        '<section class="btca-level1-card" aria-label="База данных">' +
        '<div class="btca-level1-card__row"><span>База</span><span class="btca-level1-field">пуста</span></div>' +
        "</section>";
      return;
    }
    if (level1ActiveSheet === "nav") {
      content.innerHTML =
        '<section class="btca-level1-card" aria-label="Упражнения">' +
        '<div class="btca-level1-card__row"><span>Раздел</span><span class="btca-level1-field">Упражнения</span></div>' +
        '<div class="btca-level1-card__row"><span>Упр.</span><span class="btca-level1-field">1</span></div>' +
        "</section>";
      return;
    }
    content.innerHTML =
      '<section class="btca-level1-card" aria-label="Полезности">' +
      '<div class="btca-level1-card__row"><span>Каталог</span><span class="btca-level1-field">Справочное пособие</span></div>' +
      "</section>";
  }

  function setLevel1Sheet(key) {
    level1ActiveSheet = key;
    renderLevel1TitleBar();
    renderLevel1Content();
    renderLevel1SheetMenu(false);
  }

  function renderLevel1SheetMenu(open) {
    var layer = document.querySelector("[data-btca-level1-menu-layer]");
    if (!layer) return;
    if (!open) {
      layer.setAttribute("hidden", "hidden");
      return;
    }
    layer.removeAttribute("hidden");
    layer.innerHTML =
      '<button class="btca-level1-menu-backdrop" type="button" data-btca-level1-menu-close aria-label="Закрыть меню"></button>' +
      '<nav class="btca-level1-sheet-menu" aria-label="Меню листов">' +
      LEVEL1_SHEETS.map(function (sheet) {
        var active = sheet.key === level1ActiveSheet;
        return '<button class="btca-level1-sheet-menu__item' + (active ? " btca-level1-sheet-menu__item--active" : "") + '" type="button" data-btca-level1-sheet="' + sheet.key + '">' + escapeHtml(sheet.label) + "</button>";
      }).join("") +
      "</nav>";
  }

  function renderLevel1Screen() {
    var root = document.getElementById("root");
    if (!root) return;
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
      "</main>";

    renderLevel1TitleBar();
    renderLevel1Content();

    var back = document.querySelector("[data-btca-level1-back]");
    var menuButton = document.querySelector("[data-btca-level1-menu]");
    var menuLayer = document.querySelector("[data-btca-level1-menu-layer]");
    if (back) {
      back.addEventListener("click", function () {
        root.innerHTML = installedHomeSnapshot;
        installedHomeSnapshot = "";
        document.body.classList.remove("btca-level1-mode");
        renderInstalledHome();
      });
    }
    if (menuButton) {
      menuButton.addEventListener("click", function () { renderLevel1SheetMenu(true); });
    }
    if (menuLayer) {
      menuLayer.addEventListener("click", function (event) {
        var close = event.target && event.target.closest ? event.target.closest("[data-btca-level1-menu-close]") : null;
        if (close) {
          renderLevel1SheetMenu(false);
          return;
        }
        var item = event.target && event.target.closest ? event.target.closest("[data-btca-level1-sheet]") : null;
        if (item) setLevel1Sheet(item.getAttribute("data-btca-level1-sheet"));
      });
    }
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
      menu.addEventListener("click", function (event) {
        var target = event.target && event.target.closest ? event.target.closest("[data-btca-route]") : null;
        if (!target) return;
        var route = target.getAttribute("data-btca-route");
        if (route === "level1") {
          renderLevel1Screen();
          return;
        }
        if (route === "about") renderAboutScreen();
      });
    }
    if (footer) {
      footer.innerHTML = "<span>BTCA-mobile v.8.1 © 2026 Alint&apos;s R.lab</span>";
    }
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
      script.src = "/vendor/zip.min.js";
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

  function cacheCoreAssets() {
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
      var allAssets = Array.from(new Set(CORE_ASSETS.concat(documentAssets)));

      return allAssets.reduce(function (promise, asset, index) {
        return promise.then(function () {
          renderProgress("Подготовка iOS/iPadOS", 8 + (index / allAssets.length) * 30, "Загрузка оболочки: " + asset);
          return cache.add(asset);
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

  function unpackZipToCache(blob, pack, password, cache, progressBase, progressShare) {
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
              "/offline-unpacked/" + pack.id + "/" + entryPath,
              new Response(output, { headers: { "Content-Type": contentTypeFor(entryPath) } })
            ).then(function () {
              if (IMAGE_RE.test(entryPath)) {
                imageCount += 1;
                renderProgress(
                  "Подготовка iOS/iPadOS",
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

  function prepareMediaArchives() {
    return fetch("/offline/media/manifest.json", { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("Не найден media manifest: " + response.status);
        return response.json();
      })
      .then(function (manifest) {
        if (!manifest.packs || !manifest.packs.length) return;

        return loadZipLibrary().then(function () {
          return caches.open(MEDIA_CACHE).then(function (cache) {
            var preparedFiles = {};
            var packShare = 58 / manifest.packs.length;

            return manifest.packs.reduce(function (promise, pack, index) {
              return promise.then(function () {
                var base = 38 + index * packShare;
                renderProgress("Подготовка iOS/iPadOS", base, "Загрузка " + pack.id + "/media.btca.zip");
                return fetch(pack.zipUrl, { cache: "no-store" }).then(function (response) {
                  if (!response.ok) throw new Error("Не удалось загрузить " + pack.zipUrl + ": " + response.status);
                  return response.blob();
                }).then(function (blob) {
                  return cache.put(pack.zipUrl, new Response(blob.slice(0, blob.size), {
                    headers: { "Content-Type": "application/zip" },
                  })).then(function () {
                    return unpackZipToCache(blob, pack, manifest.password, cache, base, packShare);
                  });
                }).then(function (result) {
                  preparedFiles[pack.id] = result.images;
                });
              });
            }, Promise.resolve()).then(function () {
              localStorage.setItem(MEDIA_STATE_KEY, JSON.stringify({
                version: manifest.version,
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

    renderProgress("Подготовка iOS/iPadOS", 1, "Регистрация offline-службы...");
    withTimeout(
      navigator.serviceWorker.register("/sw.js")
        .then(function () { return navigator.serviceWorker.ready; }),
      12000,
      "Safari не завершил регистрацию offline-службы. Обновите страницу и попробуйте ещё раз."
    )
      .then(cacheCoreAssets)
      .then(prepareMediaArchives)
      .then(renderReady)
      .catch(renderError)
      .then(function () {
        setButtonState(false, "Загрузить все данные для offline");
      });
  }

  function init() {
    var els = getEls();
    if (!els.button) return;
    window.__BTCA_IOS_INSTALLER_READY__ = true;
    syncPortraitMode();
    window.addEventListener("orientationchange", syncPortraitMode);
    window.addEventListener("resize", syncPortraitMode);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", syncPortraitMode);
      window.visualViewport.addEventListener("scroll", syncPortraitMode);
    }
    els.button.addEventListener("click", prepareOffline);
    if (isStandalone()) {
      renderInstalledHome();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
