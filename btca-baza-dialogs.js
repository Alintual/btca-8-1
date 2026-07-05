(function (global) {
  var TOAST_SUCCESS = "#111111";
  var TOAST_ERROR = "#7C021C";
  var TOAST_MS = 3000;

  var TOAST_MSG_SUCCESS = "Успех!";
  var TOAST_MSG_EXPORT_ERROR = "Сбой экспорта. Повторите позже.";
  var TOAST_MSG_IMPORT_ERROR = "Ошибка импорта";
  var TOAST_MSG_SCREENSHOT_ERROR = "Не удалось сохранить скриншот.";

  var TEXT_SCREENSHOT_FIRST =
    "Придумайте свой персональный идентификатор для файлов и далее Подтвердите запись скриншота и далее выберите Поделиться или Сохранить в Файлах";
  var TEXT_SCREENSHOT_CONFIRM =
    "Подтвердите запись скриншота и далее выберите Поделиться или Сохранить в Файлах";
  var TEXT_EXPORT_FIRST =
    "Придумайте свой персональный идентификатор для файлов и далее Подтвердите экспорт копии Базы данных и далее выберите Поделиться или Сохранить в Файлах";
  var TEXT_EXPORT_CONFIRM =
    "Подтвердите экспорт копии Базы данных и далее выберите Поделиться или Сохранить в Файлах";
  var TEXT_IMPORT_CONFIRM =
    "Подтвердите импорт копии Базы данных и далее выберите файл в Файлах";
  var TEXT_OVERWRITE_CONFIRM =
    "Подтвердите загрузку резервной копии Вашей Базы данных. Все текущие данные будут удалены!\nДалее, выберите файл в Файлах";

  var DELETE_OWN_MSG = "Удалить текущие данные по выбранным фильтрам?";
  var DELETE_FOREIGN_MSG = "Удалить все импортированные данные?";

  var IDENTIFIER_MAX_LEN = 32;
  var IDENTIFIER_PLACEHOLDER = "Идентификатор анг...";
  var IDENTIFIER_ERROR_EMPTY = "Введите идентификатор.";
  var IDENTIFIER_ERROR_MAX_LEN = "Не более " + IDENTIFIER_MAX_LEN + " символов.";
  var IDENTIFIER_ERROR_ALLOWED =
    "Разрешены только латинские буквы A–Z, цифры 0–9, дефис (-) и подчёркивание (_).";
  var IDENTIFIER_ALLOWED_RE = /^[A-Za-z0-9_-]+$/;

  function assetUrl(file) {
    var base = global.__BTCA_BASE__ || "/btca-8-1/";
    if (!/\/$/.test(base)) base += "/";
    return base + "branding/" + file;
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
    return hasIdentifier ? TEXT_SCREENSHOT_CONFIRM : TEXT_SCREENSHOT_FIRST;
  }

  function buildPanel(opts) {
    opts = opts || {};
    var confirmDisabled = opts.canConfirm === false;
    var confirmIcon = opts.confirmIcon === "del" ? "del" : "gal";
    var iconFile = confirmIcon === "del" ? "del.png" : "gal.png";
    var iconClass =
      confirmIcon === "del" ? "btca-baza-dialog-icon--del" : "btca-baza-dialog-icon--gal";
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
      '<p class="btca-baza-dialog-body">' +
      escapeHtml(opts.bodyText || "") +
      "</p>" +
      inputBlock +
      '<div class="btca-baza-dialog-actions">' +
      '<button type="button" class="btca-baza-dialog-icon-btn" ' +
      (opts.closeAttr || "") +
      ' aria-label="Закрыть">' +
      '<img class="btca-baza-dialog-icon btca-baza-dialog-icon--cross" src="' +
      assetUrl("cross.png") +
      '" alt="" draggable="false"></button>' +
      '<button type="button" class="btca-baza-dialog-icon-btn' +
      (confirmDisabled ? " btca-baza-dialog-icon-btn--disabled" : "") +
      '" ' +
      (opts.confirmAttr || "") +
      (confirmDisabled ? " disabled" : "") +
      ' aria-label="' +
      confirmLabel +
      '">' +
      '<img class="btca-baza-dialog-icon ' +
      iconClass +
      '" src="' +
      assetUrl(iconFile) +
      '" alt="" draggable="false"></button>' +
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
    DELETE_OWN_MSG: DELETE_OWN_MSG,
    DELETE_FOREIGN_MSG: DELETE_FOREIGN_MSG,
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
  };
})(typeof window !== "undefined" ? window : globalThis);
