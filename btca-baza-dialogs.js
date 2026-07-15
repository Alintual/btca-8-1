(function (global) {
  var TOAST_SUCCESS = "#111111";
  var TOAST_ERROR = "#7C021C";
  var TOAST_MS = 3000;

  var TOAST_MSG_SUCCESS = "Успех!";
  var TOAST_MSG_EXPORT_ERROR = "Сбой экспорта. Повторите позже.";
  var TOAST_MSG_IMPORT_ERROR = "Ошибка импорта";
  var TOAST_MSG_SCREENSHOT_ERROR = "Не удалось сохранить скриншот.";

  var TEXT_SCREENSHOT_FIRST =
    "Придумайте свой персональный идентификатор для файлов. Подтвердите запись скриншота и далее выберите Поделиться или Сохранить в Файлах";
  var TEXT_SCREENSHOT_CONFIRM =
    "Подтвердите запись скриншота и далее выберите Поделиться или Сохранить в Файлах";
  var TEXT_EXPORT_FIRST =
    "Придумайте свой персональный идентификатор для файлов. Подтвердите экспорт копии Базы данных и далее выберите Поделиться или Сохранить в Файлах";
  var TEXT_EXPORT_CONFIRM =
    "Подтвердите экспорт копии Базы данных и далее выберите Поделиться или Сохранить в Файлах";
  var TEXT_IMPORT_CONFIRM =
    "Подтвердите импорт копии Базы данных и далее выберите файл в Файлах";
  var TEXT_OVERWRITE_CONFIRM =
    "Подтвердите загрузку резервной копии Вашей Базы данных. Все текущие данные будут удалены!";
  var TEXT_OVERWRITE_FIRST =
    "Введите свой персональный идентификатор для файлов. Подтвердите загрузку резервной копии Вашей Базы данных. Все текущие данные будут удалены!";

  var DELETE_OWN_MSG = "Удалить текущие данные по выбранным фильтрам?";
  var DELETE_FOREIGN_MSG = "Подтвердите удаление всех импортированных данных";

  function formatIsoDateAsDdMmYyyy(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").trim());
    return m ? m[3] + "-" + m[2] + "-" + m[1] : String(iso || "").trim();
  }

  function parseYmd(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "").trim());
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function formatYmd(d) {
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    return yyyy + "-" + mm + "-" + dd;
  }

  function countInclusivePeriodDays(fromIso, toIso) {
    var from = String(fromIso || "").trim();
    var to = String(toIso || "").trim();
    var today = formatYmd(new Date());
    if (!from && !to) return 1;
    if (!from) from = to || today;
    if (!to) to = from || today;
    if (from > to) {
      var tmp = from;
      from = to;
      to = tmp;
    }
    var d0 = parseYmd(from);
    var d1 = parseYmd(to);
    if (!d0 || !d1) return 1;
    return Math.max(1, Math.floor((d1.getTime() - d0.getTime()) / 86400000) + 1);
  }

  function buildBazaDeleteConfirmMessage(opts) {
    opts = opts || {};
    if (opts.target === "foreign") {
      return DELETE_FOREIGN_MSG;
    }
    var level = Number(opts.trainingLevel) === 2 ? 2 : 1;
    var from = String(opts.periodFrom || "").trim();
    var to = String(opts.periodTo || "").trim();
    var fromLabel = formatIsoDateAsDdMmYyyy(from) || from;
    var toLabel = formatIsoDateAsDdMmYyyy(to) || to;
    var days = countInclusivePeriodDays(from, to);
    var prefix =
      level === 2
        ? "Подтвердите удаление Текущих данных:"
        : "Подтвердите удаление данных:";
    var exRaw = String(opts.exercise || "").trim();
    var ex =
      exRaw === "__foreign_data__" || exRaw === "all" || !exRaw ? "all" : exRaw;
    var exercisePart;
    if (ex === "all") {
      exercisePart = "Все";
    } else {
      var label = String(opts.exerciseLabel || "").trim() || ex;
      var task = String(opts.task || "all").trim();
      if (level === 2 && task && task !== "all") {
        exercisePart = label + " [" + task + "]";
      } else {
        exercisePart = label;
      }
    }
    return (
      prefix +
      " Период - от " +
      fromLabel +
      " до " +
      toLabel +
      " [" +
      days +
      "], Упражнение - " +
      exercisePart
    );
  }

  var IDENTIFIER_MAX_LEN = 32;
  var IDENTIFIER_PLACEHOLDER = "Идентификатор анг...";
  var IDENTIFIER_ERROR_EMPTY = "Введите идентификатор.";
  var IDENTIFIER_ERROR_MAX_LEN = "Не более " + IDENTIFIER_MAX_LEN + " символов.";
  var IDENTIFIER_ERROR_ALLOWED =
    "Разрешены только латинские буквы A–Z, цифры 0–9, дефис (-) и подчёркивание (_).";
  var IDENTIFIER_ALLOWED_RE = /^[A-Za-z0-9_-]+$/;

  var DIALOG_ICON_FILES = {
    cross: "cross.png",
    gal: "gal.png",
    del: "del.png",
  };

  /** URL иконок: после preload — blob: (стабильно offline), иначе обычный путь branding/. */
  var dialogIconSrc = {
    cross: null,
    gal: null,
    del: null,
  };
  var dialogIconsPreloadPromise = null;

  function brandingPath(file) {
    var base = String(global.__BTCA_BASE__ || "/btca-8-1/").replace(/\/?$/, "/");
    return base + "branding/" + String(file || "").replace(/^\//, "");
  }

  function resolveDialogIconSrc(kind) {
    var key = kind === "del" ? "del" : kind === "cross" ? "cross" : "gal";
    return dialogIconSrc[key] || brandingPath(DIALOG_ICON_FILES[key]);
  }

  /**
   * Прогрев иконок в память (fetch → blob URL).
   * Так крест/галочка не мигают и не пропадают при offline / сбоях SW / повторном открытии диалога.
   */
  function ensureDialogIconsReady() {
    if (dialogIconsPreloadPromise) return dialogIconsPreloadPromise;
    var kinds = ["cross", "gal", "del"];
    dialogIconsPreloadPromise = Promise.all(
      kinds.map(function (kind) {
        var file = DIALOG_ICON_FILES[kind];
        var url = brandingPath(file);
        dialogIconSrc[kind] = url;
        return fetch(url, { cache: "force-cache", credentials: "same-origin" })
          .then(function (res) {
            if (!res || !res.ok) throw new Error("icon_fetch_failed");
            return res.blob();
          })
          .then(function (blob) {
            if (!blob || !blob.size) throw new Error("icon_empty");
            try {
              dialogIconSrc[kind] = URL.createObjectURL(blob);
            } catch (_) {
              dialogIconSrc[kind] = url;
            }
          })
          .catch(function () {
            return new Promise(function (resolve) {
              var img = new Image();
              img.onload = function () {
                dialogIconSrc[kind] = url;
                resolve();
              };
              img.onerror = function () {
                dialogIconSrc[kind] = url;
                resolve();
              };
              img.src = url;
            });
          });
      })
    ).then(function () {
      return dialogIconSrc;
    });
    return dialogIconsPreloadPromise;
  }

  function dialogIconImgHtml(kind) {
    var key = kind === "del" ? "del" : kind === "cross" ? "cross" : "gal";
    var cls =
      key === "cross"
        ? "btca-baza-dialog-icon btca-baza-dialog-icon--cross"
        : key === "del"
          ? "btca-baza-dialog-icon btca-baza-dialog-icon--del"
          : "btca-baza-dialog-icon btca-baza-dialog-icon--gal";
    return (
      '<img class="' +
      cls +
      '" src="' +
      escapeHtml(resolveDialogIconSrc(key)) +
      '" alt="" decoding="async" draggable="false">'
    );
  }

  function escapeHtml(v) {
    return String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function validateBazaIdentifierInput(raw) {
    var trimmed = String(raw ?? "").trim();
    if (!trimmed) return { ok: false, error: IDENTIFIER_ERROR_EMPTY };
    if (trimmed.length > IDENTIFIER_MAX_LEN) return { ok: false, error: IDENTIFIER_ERROR_MAX_LEN };
    if (!IDENTIFIER_ALLOWED_RE.test(trimmed)) return { ok: false, error: IDENTIFIER_ERROR_ALLOWED };
    return { ok: true, value: trimmed };
  }

  function identifierBodyText(mode, hasIdentifier) {
    if (mode === "export") return hasIdentifier ? TEXT_EXPORT_CONFIRM : TEXT_EXPORT_FIRST;
    if (mode === "import") return TEXT_IMPORT_CONFIRM;
    if (mode === "overwrite") return hasIdentifier ? TEXT_OVERWRITE_CONFIRM : TEXT_OVERWRITE_FIRST;
    return hasIdentifier ? TEXT_SCREENSHOT_CONFIRM : TEXT_SCREENSHOT_FIRST;
  }

  function buildPanel(opts) {
    opts = opts || {};
    var confirmDisabled = opts.canConfirm === false;
    var confirmIcon = opts.confirmIcon === "del" ? "del" : "gal";
    var confirmLabel = confirmIcon === "del" ? "Удалить данные" : "Подтвердить";

    var inputBlock = "";
    if (opts.showInput) {
      inputBlock =
        '<input class="btca-baza-dialog-input" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="' +
        IDENTIFIER_MAX_LEN +
        '" placeholder="' +
        escapeHtml(IDENTIFIER_PLACEHOLDER) +
        '" value="' +
        escapeHtml(opts.inputValue || "") +
        '">';
      if (opts.inputError) {
        inputBlock +=
          '<p class="btca-baza-dialog-error" role="alert">' + escapeHtml(opts.inputError) + "</p>";
      }
    }

    return (
      '<div class="btca-baza-dialog-panel" role="dialog">' +
      '<div class="btca-baza-dialog-scroll">' +
      '<p class="btca-baza-dialog-body">' +
      escapeHtml(opts.bodyText || "") +
      "</p>" +
      inputBlock +
      "</div>" +
      '<div class="btca-baza-dialog-actions">' +
      '<button type="button" class="btca-baza-dialog-icon-btn" ' +
      (opts.closeAttr || "") +
      ' aria-label="Закрыть">' +
      dialogIconImgHtml("cross") +
      "</button>" +
      '<button type="button" class="btca-baza-dialog-icon-btn' +
      (confirmDisabled ? " btca-baza-dialog-icon-btn--disabled" : "") +
      '" ' +
      (opts.confirmAttr || "") +
      (confirmDisabled ? " disabled" : "") +
      ' aria-label="' +
      confirmLabel +
      '">' +
      dialogIconImgHtml(confirmIcon) +
      "</button>" +
      "</div></div>"
    );
  }

  function buildLayerWithPanel(backdropCloseAttr, panelHtml) {
    return (
      '<button class="btca-level1-menu-backdrop" type="button" ' +
      backdropCloseAttr +
      ' aria-label="Закрыть"></button>' +
      '<div class="btca-baza-dialog-layer">' +
      panelHtml +
      "</div>"
    );
  }

  function syncBazaDialogKeyboardOffset(layer) {
    if (!(layer instanceof Element)) return;
    var shell = layer.querySelector(".btca-baza-dialog-layer");
    var input = layer.querySelector(".btca-baza-dialog-input");
    if (!shell) return;
    var vv = global.visualViewport;
    if (!input || global.document.activeElement !== input || !vv) {
      shell.classList.remove("btca-baza-dialog-layer--keyboard");
      shell.style.removeProperty("padding-bottom");
      return;
    }
    var overlap = Math.max(0, global.innerHeight - vv.height - vv.offsetTop);
    if (overlap > 40) {
      shell.classList.add("btca-baza-dialog-layer--keyboard");
      shell.style.paddingBottom = Math.ceil(overlap + 12) + "px";
    } else {
      shell.classList.remove("btca-baza-dialog-layer--keyboard");
      shell.style.removeProperty("padding-bottom");
    }
  }

  function attachBazaDialogKeyboardAvoidance(layer) {
    if (!(layer instanceof Element)) return;
    var input = layer.querySelector(".btca-baza-dialog-input");
    if (!input) return;
    var onSync = function () {
      syncBazaDialogKeyboardOffset(layer);
    };
    input.addEventListener("focus", function () {
      onSync();
      requestAnimationFrame(onSync);
    });
    input.addEventListener("blur", function () {
      window.setTimeout(onSync, 120);
    });
    if (global.visualViewport) {
      global.visualViewport.addEventListener("resize", onSync);
      global.visualViewport.addEventListener("scroll", onSync);
    }
  }

  function wireBazaIdentifierInput(layer, onDraftChange) {
    if (!(layer instanceof Element)) return;
    var input = layer.querySelector(".btca-baza-dialog-input");
    if (!input) return;
    attachBazaDialogKeyboardAvoidance(layer);
    input.addEventListener("input", function () {
      if (typeof onDraftChange === "function") onDraftChange(input.value, layer);
    });
    requestAnimationFrame(function () {
      try {
        input.focus({ preventScroll: true });
      } catch (_) {
        input.focus();
      }
    });
  }

  function buildToastHtml(message, color) {
    var isError = color === TOAST_ERROR;
    var kind = isError ? "error" : "success";
    return (
      '<div class="btca-baza-toast-layer" role="status" aria-live="polite">' +
      '<div class="btca-baza-toast-card btca-baza-toast-card--' +
      kind +
      '">' +
      escapeHtml(message) +
      "</div></div>"
    );
  }

  global.BTCA_BAZA_DIALOGS = {
    TOAST_SUCCESS: TOAST_SUCCESS,
    TOAST_ERROR: TOAST_ERROR,
    TOAST_MS: TOAST_MS,
    TOAST_MSG_SUCCESS: TOAST_MSG_SUCCESS,
    TOAST_MSG_EXPORT_ERROR: TOAST_MSG_EXPORT_ERROR,
    TOAST_MSG_IMPORT_ERROR: TOAST_MSG_IMPORT_ERROR,
    TOAST_MSG_SCREENSHOT_ERROR: TOAST_MSG_SCREENSHOT_ERROR,
    TEXT_OVERWRITE_CONFIRM: TEXT_OVERWRITE_CONFIRM,
    TEXT_OVERWRITE_FIRST: TEXT_OVERWRITE_FIRST,
    DELETE_OWN_MSG: DELETE_OWN_MSG,
    DELETE_FOREIGN_MSG: DELETE_FOREIGN_MSG,
    buildBazaDeleteConfirmMessage: buildBazaDeleteConfirmMessage,
    IDENTIFIER_MAX_LEN: IDENTIFIER_MAX_LEN,
    IDENTIFIER_PLACEHOLDER: IDENTIFIER_PLACEHOLDER,
    validateBazaIdentifierInput: validateBazaIdentifierInput,
    wireBazaIdentifierInput: wireBazaIdentifierInput,
    attachBazaDialogKeyboardAvoidance: attachBazaDialogKeyboardAvoidance,
    identifierBodyText: identifierBodyText,
    buildPanel: buildPanel,
    buildLayerWithPanel: buildLayerWithPanel,
    buildToastHtml: buildToastHtml,
    escapeHtml: escapeHtml,
    ensureDialogIconsReady: ensureDialogIconsReady,
  };

  try {
    ensureDialogIconsReady();
  } catch (_) {
    /* ignore */
  }
})(typeof window !== "undefined" ? window : globalThis);
