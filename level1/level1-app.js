(function () {
  "use strict";

  var DB = window.BTCA_LEVEL1_DB;
  var VERSION = "8.1.79";
  var BRANDING_UP = "branding/up.png";
  var BRANDING_BAZA = "branding/baza.png";
  var TRAILING_SLOT_W = 112;
  var FORMA_BANNER = "Цель - результативность не менее 70 %";
  var NAV_FILTER_ALL = "all";
  var POLEZ_ALL = "all";
  var POLEZ_HIDDEN = { fig8: 1, fig9: 1, fig10: 1, fig11: 1, fig20: 1, fig21: 1 };
  var PICK_DELAY_MS = 1500;
  var PICKER_ROW_SIMPLE = 40;
  var PICKER_ROW_GROUP = 40;
  var PICKER_LIST_PAD = 4;
  var SCREEN_EDGE_GUTTER = 4;

  var SHEETS = [
    { key: "forma", label: "Форма", title: "Форма ввода", emoji: "📊" },
    { key: "baza", label: "База", title: "База данных", emoji: "" },
    { key: "nav", label: "Упражнения", title: "Упражнения", emoji: "🔎" },
    { key: "polez", label: "Полезности", title: "Полезности", emoji: "📚" },
  ];

  var bootPromise = null;
  var booted = false;

  function syncUiFromDb() {
    if (DB && DB.getUiState) state.ui = DB.getUiState();
  }

  function applyUiPatch(patch) {
    if (!DB || !DB.patchUiState) return;
    DB.patchUiState(patch);
    syncUiFromDb();
  }

  var state = {
    root: null,
    ui: null,
    data: { exercises: [], polezCatalog: [], polezLinks: [], polezDescriptions: {} },
    formaFlags: {},
    bazaStats: { empty: true, fillText: "пуста" },
    bazaRows: [],
    bazaExpandedRows: [],
    bazaOwnKeys: [],
    bazaRuleTasks: [],
    bazaNoExercisesInPeriod: false,
    bazaOwnEmpty: true,
    bazaMenuOpen: false,
    bazaDeleteConfirm: null,
    bazaIdentifierMode: null,
    bazaUserFileId: "",
    bazaToast: null,
    pickTimer: null,
    mounted: false,
  };

  function escapeHtml(v) {
    return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function formatIsoDateAsDdMmYyyy(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").trim());
    return m ? m[3] + "-" + m[2] + "-" + m[1] : iso;
  }

  function numericB5(b5) {
    if (typeof b5 === "number" && Number.isFinite(b5)) return b5;
    if (typeof b5 === "string") {
      if (b5.indexOf("Тест") === 0) return null;
      var n = Number(b5);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }

  function b5FromSelectValue(selValue) {
    var s = String(selValue || "").trim();
    if (s.indexOf("Тест") === 0) return s;
    var n = Number(s);
    return Number.isFinite(n) ? n : s;
  }

  function taskActiveFormL1(b5, task) {
    if (b5 === "" || b5 == null) return false;
    var n = numericB5(b5);
    if (task >= 7 && task <= 12) return false;
    if (task === 1) return true;
    if (task === 2 || task === 3) return !(n === 9 || n === 10 || n === 11 || n === 14 || b5 === "Тест1");
    if (task === 4) return !(n === 9 || n === 10 || n === 11 || n === 12 || n === 14 || b5 === "Тест1");
    if (task === 5) return !(n === 1 || n === 2 || n === 9 || n === 10 || n === 11 || n === 12 || n === 14 || b5 === "Тест1");
    if (task === 6) return n === 3 || n === 4 || n === 6 || n === 7 || n === 8 || n === 13;
    return false;
  }

  function requiredStrikesFormL1(b5, task) {
    if (!taskActiveFormL1(b5, task)) return null;
    var n = numericB5(b5);
    if (task === 1) {
      if (n === 9 || n === 10 || b5 === "Тест1") return 30;
      if (n === 14) return 16;
      return 15;
    }
    if (task >= 2 && task <= 6) return n === 14 ? 16 : 15;
    return null;
  }

  function exerciseRulesL1(b5) {
    var requiredByTask = [];
    for (var task = 1; task <= 12; task += 1) requiredByTask.push(requiredStrikesFormL1(b5, task));
    return { requiredByTask: requiredByTask };
  }

  function parseNonNegativeInt(raw) {
    var s = String(raw || "").trim();
    if (!s) return null;
    if (!/^\d+$/.test(s)) return NaN;
    return Number(s);
  }

  function exerciseOptionLabel(b5) {
    return typeof b5 === "string" && b5.indexOf("Тест") === 0 ? b5 : String(b5);
  }

  function optionValueForB5(b5) {
    return typeof b5 === "number" ? String(b5) : b5;
  }

  function neighborActiveOkTask(fromTask, dir, b5) {
    for (var t = fromTask + dir; t >= 1 && t <= 12; t += dir) {
      if (!taskActiveFormL1(b5, t)) continue;
      if (requiredStrikesFormL1(b5, t) === null) continue;
      return t;
    }
    return null;
  }

  function isFormaOkValueValid(okRaw, req) {
    if (req === null) return false;
    var ok = parseNonNegativeInt(okRaw);
    if (ok === null || Number.isNaN(ok)) return false;
    return ok >= 1 && ok <= req;
  }

  function syncFormaSaveButton(content, canSave) {
    var saveBtn = content.querySelector("[data-btca-forma-save]");
    if (!saveBtn) return;
    saveBtn.setAttribute("data-btca-forma-can-save", canSave ? "1" : "0");
    saveBtn.classList.toggle("btca-l1-save--disabled", !canSave);
    var icon = saveBtn.querySelector(".btca-l1-save__icon");
    var label = saveBtn.querySelector(".btca-l1-save__label");
    if (icon) icon.classList.toggle("btca-l1-save__icon--disabled", !canSave);
    if (label) label.classList.toggle("btca-l1-save__label--disabled", !canSave);
  }

  var formaOkFocusState = { task: null, blockDismissUntil: 0 };
  var formaSaveInFlight = false;
  var formaSaveWatchdog = null;

  function readTaskOkFromDom(content) {
    var taskOk = {};
    if (!content) return taskOk;
    if (useFormaCustomNumpad()) {
      content.querySelectorAll("[data-btca-forma-ok-cell]").forEach(function (cell) {
        var task = cell.getAttribute("data-btca-forma-ok-cell");
        var valueEl = cell.querySelector("[data-btca-forma-ok-value]");
        var raw = valueEl ? String(valueEl.textContent || "").trim() : "";
        if (task) taskOk[String(task)] = raw.replace(/[^\d]/g, "");
      });
    } else {
      content.querySelectorAll("[data-btca-forma-ok-input]").forEach(function (input) {
        var task = input.getAttribute("data-btca-forma-ok-input");
        if (task) taskOk[String(task)] = String(input.value || "").replace(/[^\d]/g, "");
      });
    }
    return taskOk;
  }

  function mergeDomTaskOkIntoState(content) {
    if (!content) return;
    if (!content.querySelector("[data-btca-forma-ok-cell], [data-btca-forma-ok-input]")) return;
    var domTaskOk = readTaskOkFromDom(content);
    applyUiPatch({ taskOk: Object.assign({}, state.ui.taskOk || {}, domTaskOk) });
  }

  function clearFormaSaveWatchdog() {
    if (formaSaveWatchdog) {
      window.clearTimeout(formaSaveWatchdog);
      formaSaveWatchdog = null;
    }
  }

  function armFormaSaveWatchdog() {
    clearFormaSaveWatchdog();
    formaSaveWatchdog = window.setTimeout(function () {
      formaSaveWatchdog = null;
      if (!formaSaveInFlight) return;
      formaSaveInFlight = false;
      state.formaFlags.statusOverride = { text: "Ошибка записи", tone: "error" };
      renderTitleBar();
    }, 8000);
  }

  function markFormaNumpadInteraction() {
    formaOkFocusState.blockDismissUntil = Date.now() + 450;
  }

  function shouldBlockFormaNumpadDismiss() {
    return Date.now() < formaOkFocusState.blockDismissUntil;
  }

  function isAppleTouchDevice() {
    var ua = navigator.userAgent || "";
    return /iPhone|iPad|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function useFormaCustomNumpad() {
    return isAppleTouchDevice();
  }

  function reinforceFormaOkInputKeyboard(input) {
    if (!input) return;
    input.type = "text";
    input.inputMode = "numeric";
    input.setAttribute("inputmode", "numeric");
    input.setAttribute("pattern", "[0-9]*");
    input.setAttribute("autocomplete", "off");
    input.removeAttribute("name");
    input.removeAttribute("lang");
  }

  function blurActiveField() {
    var active = document.activeElement;
    if (active && active !== document.body && typeof active.blur === "function") active.blur();
  }

  function createFormaOkInput(task, row) {
    var input = document.createElement("input");
    input.className = "btca-l1-ok-input" + (row.invalid ? " btca-l1-ok-input--invalid" : "");
    input.setAttribute("data-btca-forma-ok-input", String(task));
    input.setAttribute("autocorrect", "off");
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("spellcheck", "false");
    input.setAttribute("enterkeyhint", "done");
    input.setAttribute("aria-label", "Успешные удары задача " + task);
    reinforceFormaOkInputKeyboard(input);
    input.value = row.okRaw || "";
    return input;
  }

  function mountFormaOkCellButton(slot, task, row) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btca-l1-ok-cell" + (row.invalid ? " btca-l1-ok-cell--invalid" : "");
    btn.setAttribute("data-btca-forma-ok-cell", String(task));
    btn.setAttribute("aria-label", "Успешные удары задача " + task);
    var display = document.createElement("span");
    display.className = "btca-l1-ok-display";
    display.setAttribute("data-btca-forma-ok-display", "");
    var value = document.createElement("span");
    value.className = "btca-l1-ok-value";
    value.setAttribute("data-btca-forma-ok-value", "");
    value.textContent = row.okRaw || "";
    var caret = document.createElement("span");
    caret.className = "btca-l1-ok-caret";
    caret.setAttribute("data-btca-forma-ok-caret", "");
    caret.setAttribute("aria-hidden", "true");
    caret.hidden = true;
    display.appendChild(value);
    display.appendChild(caret);
    btn.appendChild(display);
    slot.textContent = "";
    slot.appendChild(btn);
  }

  function getFormaOkInput(content, task) {
    return content.querySelector('[data-btca-forma-ok-input="' + task + '"]');
  }

  function getFormaOkCell(content, task) {
    return content.querySelector('[data-btca-forma-ok-cell="' + task + '"]');
  }

  function getFormaOkAnchor(content, task) {
    return useFormaCustomNumpad() ? getFormaOkCell(content, task) : getFormaOkInput(content, task);
  }

  function getFormaNumpad(content) {
    return content.querySelector("[data-btca-forma-numpad]");
  }

  function createFormaNumpadKey(label, value, opts) {
    opts = opts || {};
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btca-l1-forma-numpad-key";
    if (opts.action) btn.className += " btca-l1-forma-numpad-key--action";
    if (opts.enter) btn.className += " btca-l1-forma-numpad-key--enter";
    btn.setAttribute("data-btca-forma-numpad-key", value);
    if (value === "backspace") btn.setAttribute("aria-label", "Стереть");
    else if (value === "enter") btn.setAttribute("aria-label", "Ввод");
    else btn.setAttribute("aria-label", "Цифра " + label);
    if (opts.enter) {
      btn.innerHTML = '<span class="btca-l1-forma-numpad-enter-glyph" aria-hidden="true">' +
        '<span class="btca-l1-forma-numpad-enter-arrow">→</span>' +
        '<span class="btca-l1-forma-numpad-enter-bar">|</span></span>';
    } else {
      btn.textContent = label;
    }
    return btn;
  }

  function ensureFormaNumpad(content) {
    var existing = getFormaNumpad(content);
    if (existing) return existing;
    var host = content.querySelector(".btca-l1-forma");
    if (!host) return null;
    var dock = document.createElement("div");
    dock.className = "btca-l1-forma-numpad-dock";
    dock.setAttribute("data-btca-forma-numpad", "");

    var grid = document.createElement("div");
    grid.className = "btca-l1-forma-numpad-grid";
    ["1", "2", "3", "4", "5", "6", "7", "8", "9"].forEach(function (digit) {
      grid.appendChild(createFormaNumpadKey(digit, digit));
    });
    grid.appendChild(createFormaNumpadKey("⌫", "backspace", { action: true }));
    grid.appendChild(createFormaNumpadKey("0", "0"));
    grid.appendChild(createFormaNumpadKey("", "enter", { action: true, enter: true }));
    dock.appendChild(grid);

    host.appendChild(dock);
    wireFormaNumpad(content, dock);
    return dock;
  }

  function setFormaNumpadOpen(content, open) {
    var forma = content.querySelector(".btca-l1-forma");
    var dock = ensureFormaNumpad(content);
    if (!forma || !dock) return;
    forma.classList.toggle("btca-l1-forma--numpad-open", !!open);
    if (open) blurActiveField();
  }

  function closeFormaOkCell(content) {
    setFormaNumpadOpen(content, false);
    setActiveFormaOkCell(content, null);
  }

  function setActiveFormaOkCell(content, task) {
    formaOkFocusState.task = task;
    if (useFormaCustomNumpad()) {
      content.querySelectorAll("[data-btca-forma-ok-cell]").forEach(function (cell) {
        var cellTask = Number(cell.getAttribute("data-btca-forma-ok-cell"));
        cell.classList.toggle("btca-l1-ok-cell--active", cellTask === task);
      });
      syncFormaOkCaret(content);
      return;
    }
    content.querySelectorAll("[data-btca-forma-ok-input]").forEach(function (input) {
      var cellTask = Number(input.getAttribute("data-btca-forma-ok-input"));
      input.classList.toggle("btca-l1-ok-input--active", cellTask === task);
    });
  }

  function mountFormaOkCells(content, forma) {
    forma.rows.forEach(function (row) {
      if (!row.active || row.required === null) return;
      var slot = content.querySelector('[data-btca-forma-ok-slot="' + row.task + '"]');
      if (!slot) return;
      if (useFormaCustomNumpad()) {
        mountFormaOkCellButton(slot, row.task, row);
      } else {
        slot.textContent = "";
        slot.appendChild(createFormaOkInput(row.task, row));
      }
    });
    if (useFormaCustomNumpad()) ensureFormaNumpad(content);
  }

  function openFormaOkCell(content, task, opts) {
    opts = opts || {};
    markFormaNumpadInteraction();
    setActiveFormaOkCell(content, task);
    if (useFormaCustomNumpad()) {
      setFormaNumpadOpen(content, true);
      syncFormaOkCaret(content);
      scrollFormaOkRowIntoView(content, task);
      return;
    }
    if (opts.scroll) scrollFormaOkRowIntoView(content, task);
    var input = getFormaOkInput(content, task);
    if (!input) return;
    var digits = state.ui.taskOk[String(task)] || "";
    var b5 = b5FromSelectValue(state.ui.exerciseValue);
    var nextOk = neighborActiveOkTask(task, 1, b5);
    input.setAttribute("enterkeyhint", nextOk !== null ? "next" : "done");
    input.value = digits;
    reinforceFormaOkInputKeyboard(input);
    input.focus({ preventScroll: true });
  }

  function syncFormaOkCaret(content) {
    if (!useFormaCustomNumpad()) return;
    var activeTask = formaOkFocusState.task;
    content.querySelectorAll("[data-btca-forma-ok-caret]").forEach(function (caret) {
      var cell = caret.closest("[data-btca-forma-ok-cell]");
      if (!cell) return;
      var cellTask = Number(cell.getAttribute("data-btca-forma-ok-cell"));
      caret.hidden = cellTask !== activeTask;
    });
  }

  function syncFormaOkTableDom(content, forma) {
    forma.rows.forEach(function (row) {
      if (useFormaCustomNumpad()) {
        var cell = getFormaOkCell(content, row.task);
        if (!cell) return;
        var valueEl = cell.querySelector("[data-btca-forma-ok-value]");
        if (valueEl) valueEl.textContent = row.okRaw || "";
        cell.classList.toggle("btca-l1-ok-cell--invalid", !!row.invalid);
        cell.classList.toggle("btca-l1-ok-cell--active", formaOkFocusState.task === row.task);
      } else {
        var input = getFormaOkInput(content, row.task);
        if (!input) return;
        if (document.activeElement !== input && input.value !== (row.okRaw || "")) {
          input.value = row.okRaw || "";
        }
        input.classList.toggle("btca-l1-ok-input--invalid", !!row.invalid);
        input.classList.toggle("btca-l1-ok-input--active", formaOkFocusState.task === row.task);
      }
      var anchor = getFormaOkAnchor(content, row.task);
      if (!anchor) return;
      var rowEl = anchor.closest(".btca-l1-table-row");
      if (!rowEl) return;
      var okCell = rowEl.querySelector(".btca-l1-col--ok");
      if (okCell) okCell.classList.toggle("btca-l1-table-cell--invalid", !!row.invalid);
      var pctCell = rowEl.querySelector(".btca-l1-col--pct .btca-l1-td");
      if (pctCell) pctCell.textContent = row.pct;
    });
    syncFormaOkCaret(content);
    syncFormaSaveButton(content, forma.canSave);
  }

  function getFormaNumpadObstruction(content) {
    if (!useFormaCustomNumpad()) return 16;
    var forma = content.querySelector(".btca-l1-forma");
    if (!forma || !forma.classList.contains("btca-l1-forma--numpad-open")) return 16;
    var dock = getFormaNumpad(content);
    if (!dock) return 220;
    var h = dock.getBoundingClientRect().height;
    return h > 0 ? h + 8 : 220;
  }

  function scrollFormaTableToTop(content) {
    var scroll = content && content.querySelector("[data-btca-forma-table-scroll]");
    if (scroll) scroll.scrollTop = 0;
  }

  function scrollFormaOkRowIntoView(content, task) {
    var scroll = content.querySelector("[data-btca-forma-table-scroll]");
    var anchor = getFormaOkAnchor(content, task);
    if (!scroll || !anchor) return;
    var rowEl = anchor.closest(".btca-l1-table-row");
    if (!rowEl) return;

    function apply() {
      var scrollRect = scroll.getBoundingClientRect();
      var rowRect = rowEl.getBoundingClientRect();
      var margin = 8;
      var obstruction = getFormaNumpadObstruction(content);
      var visibleBottom = Math.min(scrollRect.bottom, window.innerHeight - obstruction) - margin;
      var visibleTop = scrollRect.top + margin;
      if (rowRect.bottom > visibleBottom) {
        scroll.scrollTop += rowRect.bottom - visibleBottom;
      } else if (rowRect.top < visibleTop) {
        scroll.scrollTop -= visibleTop - rowRect.top;
      }
    }

    requestAnimationFrame(function () {
      requestAnimationFrame(apply);
    });
    window.setTimeout(apply, 80);
  }

  function finishOrAdvanceFormaOkTask(content, task) {
    var b5 = b5FromSelectValue(state.ui.exerciseValue);
    var req = requiredStrikesFormL1(b5, task);
    var digits = state.ui.taskOk[String(task)] || "";
    if (!isFormaOkValueValid(digits, req)) return;
    var next = neighborActiveOkTask(task, 1, b5);
    if (next !== null) {
      openFormaOkCell(content, next, { scroll: true });
      return;
    }
    if (!useFormaCustomNumpad()) {
      var input = getFormaOkInput(content, task);
      if (input) input.blur();
    }
    closeFormaOkCell(content);
    var scroll = content.querySelector("[data-btca-forma-table-scroll]");
    if (scroll) scroll.scrollTop = 0;
  }

  function handleFormaOkDigits(content, task, digits) {
    var nextTaskOk = Object.assign({}, (state.ui && state.ui.taskOk) || {});
    nextTaskOk[String(task)] = digits;
    applyUiPatch({ taskOk: nextTaskOk });
    state.formaFlags.suppressExerciseActive = false;
    state.formaFlags.statusOverride = null;
    var forma = computeFormaRows();
    state.formaFlags.invalidData = !forma.allActiveOkAreEmptyOrValid;
    syncFormaOkTableDom(content, forma);
    renderTitleBar();
    var b5 = b5FromSelectValue(state.ui.exerciseValue);
    var req = requiredStrikesFormL1(b5, task);
    if (req !== null && digits && isFormaOkValueValid(digits, req) && digits.length >= String(req).length) {
      finishOrAdvanceFormaOkTask(content, task);
    }
  }

  function appendFormaOkDigit(content, task, digit) {
    var digits = String(state.ui.taskOk[String(task)] || "") + String(digit);
    handleFormaOkDigits(content, task, digits);
  }

  function backspaceFormaOkDigit(content, task) {
    var digits = String(state.ui.taskOk[String(task)] || "");
    if (!digits) return;
    handleFormaOkDigits(content, task, digits.slice(0, -1));
  }

  function handleFormaNumpadKey(content, key) {
    var task = formaOkFocusState.task;
    if (task === null) return;
    if (key === "backspace") backspaceFormaOkDigit(content, task);
    else if (key === "enter") {
      var b5 = b5FromSelectValue(state.ui.exerciseValue);
      var req = requiredStrikesFormL1(b5, task);
      var digits = state.ui.taskOk[String(task)] || "";
      if (isFormaOkValueValid(digits, req)) finishOrAdvanceFormaOkTask(content, task);
      else closeFormaOkCell(content);
    } else appendFormaOkDigit(content, task, key);
  }

  function wireFormaNumpad(content, dock) {
    if (!dock || dock.getAttribute("data-btca-forma-numpad-wired") === "1") return;
    dock.setAttribute("data-btca-forma-numpad-wired", "1");
    dock.querySelectorAll("[data-btca-forma-numpad-key]").forEach(function (keyBtn) {
      function onNumpadPress(event) {
        event.preventDefault();
        event.stopPropagation();
        markFormaNumpadInteraction();
        handleFormaNumpadKey(content, keyBtn.getAttribute("data-btca-forma-numpad-key"));
      }
      keyBtn.addEventListener("pointerdown", onNumpadPress);
      keyBtn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
      });
    });
    dock.addEventListener("pointerdown", function (event) {
      event.stopPropagation();
      markFormaNumpadInteraction();
    });
    if (!content._formaNumpadDismissWired) {
      content._formaNumpadDismissWired = true;
      document.addEventListener("click", function (event) {
        if (shouldBlockFormaNumpadDismiss()) return;
        var forma = content.querySelector(".btca-l1-forma");
        if (!forma || !forma.classList.contains("btca-l1-forma--numpad-open")) return;
        if (event.target.closest("[data-btca-forma-numpad]")) return;
        if (event.target.closest("[data-btca-forma-ok-cell]")) return;
        if (event.target.closest("[data-btca-forma-save]")) return;
        closeFormaOkCell(content);
      });
    }
  }

  function wireFormaOkInputs(content) {
    if (useFormaCustomNumpad()) {
      content.querySelectorAll("[data-btca-forma-ok-cell]").forEach(function (cell) {
        cell.addEventListener("click", function (event) {
          event.stopPropagation();
          openFormaOkCell(content, Number(cell.getAttribute("data-btca-forma-ok-cell")));
        });
      });
      return;
    }
    content.querySelectorAll("[data-btca-forma-ok-input]").forEach(function (input) {
      var task = Number(input.getAttribute("data-btca-forma-ok-input"));
      input.addEventListener("pointerdown", function () {
        reinforceFormaOkInputKeyboard(input);
      });
      input.addEventListener("focus", function () {
        setActiveFormaOkCell(content, task);
        reinforceFormaOkInputKeyboard(input);
      });
      input.addEventListener("blur", function () {
        if (formaOkFocusState.task === task) setActiveFormaOkCell(content, null);
      });
      input.addEventListener("input", function () {
        var digits = String(input.value || "").replace(/[^\d]/g, "");
        if (input.value !== digits) input.value = digits;
        handleFormaOkDigits(content, task, digits);
      });
      input.addEventListener("keydown", function (event) {
        if (event.key !== "Enter") return;
        event.preventDefault();
        finishOrAdvanceFormaOkTask(content, task);
      });
    });
  }

  function exerciseImageFile(level, exerciseValue) {
    var k = String(exerciseValue || "").trim();
    if (level === 1) {
      if (k === "Тест1") return "test_1.jpg";
      var n = Number(k);
      if (Number.isInteger(n) && n >= 1 && n <= 14) return n + ".jpg";
      return null;
    }
    return null;
  }

  function assetPath(relativePath) {
    var base = window.__BTCA_BASE__ || "/btca-8-1/";
    var rel = String(relativePath || "").replace(/^\//, "");
    return base.replace(/\/?$/, "/") + rel;
  }

  function mediaUrl(packId, fileName) {
    if (!fileName) return "";
    return assetPath("offline-unpacked/" + packId + "/" + fileName);
  }

  function exerciseImageUrl(exerciseValue) {
    var file = exerciseImageFile(1, exerciseValue);
    return file ? mediaUrl("level1/exercises", file) : "";
  }

  function polezImageUrl(file) {
    return file ? mediaUrl("level2/polez", file) : "";
  }

  function brandingUrl(name) {
    return assetPath(name);
  }

  function dateFaceHtml(label, dataAttr) {
    return '<button type="button" class="btca-l1-face btca-l1-date-face" ' + dataAttr + ">" +
      '<span class="btca-l1-date-face__icon" aria-hidden="true">📅</span>' +
      '<span class="btca-l1-face__text">' + escapeHtml(label) + "</span></button>";
  }

  function filterFaceHtml(label, opts) {
    opts = opts || {};
    var cls = "btca-l1-face btca-l1-face--filter";
    if (opts.wide) cls += " btca-l1-face--wide";
    if (opts.disabled) cls += " btca-l1-face--disabled";
    if (opts.extraClass) cls += " " + opts.extraClass;
    var attrs = opts.dataAttr || "";
    if (opts.disabled) attrs += " disabled";
    return '<button type="button" class="' + cls + '" ' + attrs + ">" +
      '<span class="btca-l1-face__text">' + escapeHtml(label) + "</span>" +
      '<span class="btca-l1-face__chevron" aria-hidden="true">▼</span></button>';
  }

  function sectionFaceHtml(label) {
    return '<div class="btca-l1-face btca-l1-face--filter btca-l1-face--section btca-l1-face--disabled">' +
      '<span class="btca-l1-face__text">' + escapeHtml(label) + "</span>" +
      '<span class="btca-l1-face__chevron" aria-hidden="true">▼</span></div>';
  }

  function greenArrowHtml(opts) {
    opts = opts || {};
    var cls = "btca-l1-green-arrow";
    if (opts.disabled) cls += " btca-l1-green-arrow--disabled";
    if (opts.extraClass) cls += " " + opts.extraClass;
    var attrs = opts.dataAttr || "";
    if (opts.disabled) attrs += " disabled";
    return '<button type="button" class="' + cls + '" ' + attrs + ">" +
      '<img class="btca-l1-green-arrow__img" src="' + escapeHtml(brandingUrl(BRANDING_UP)) +
      '" alt="" draggable="false"></button>';
  }

  function saveButtonHtml(canSave, dataAttr) {
    return '<button type="button" class="btca-l1-save' + (canSave ? "" : " btca-l1-save--disabled") +
      '" ' + dataAttr + ' data-btca-forma-can-save="' + (canSave ? "1" : "0") + '">' +
      '<img class="btca-l1-save__icon' + (canSave ? "" : " btca-l1-save__icon--disabled") +
      '" src="' + escapeHtml(brandingUrl(BRANDING_BAZA)) + '" alt="" draggable="false">' +
      '<span class="btca-l1-save__label' + (canSave ? "" : " btca-l1-save__label--disabled") +
      '">Записать</span></button>';
  }

  function formaTableHeadHtml() {
    return '<div class="btca-l1-table-head"><div class="btca-l1-table-row">' +
      '<div class="btca-l1-table-cell btca-l1-col--task"><span class="btca-l1-th">Задача</span></div>' +
      '<div class="btca-l1-table-cell btca-l1-col--req"><span class="btca-l1-th">Требуемое<br>число ударов</span></div>' +
      '<div class="btca-l1-table-cell btca-l1-col--ok"><span class="btca-l1-th">Число успешных<br>ударов</span></div>' +
      '<div class="btca-l1-table-cell btca-l1-col--pct"><span class="btca-l1-th">%</span></div>' +
      "</div></div>";
  }

  function periodDateFaceHtml(label, dataAttr, disabled) {
    return '<button type="button" class="btca-l1-face btca-l1-period-face' + (disabled ? " btca-l1-face--disabled" : "") +
      '" ' + dataAttr + (disabled ? " disabled" : "") + ">" +
      '<span class="btca-l1-period-face__icon" aria-hidden="true">📅</span>' +
      '<span class="btca-l1-face__text">' + escapeHtml(label) + "</span></button>";
  }

  function getBazaChartMeta(baza, exerciseFilterDisabled) {
    var exercise = baza.exercise;
    var showChart = !exerciseFilterDisabled && exercise !== "all" && String(exercise || "").trim() !== "";
    return {
      text: buildBazaTableTitle(baza),
      showChart: showChart,
      arrowDisabled: exerciseFilterDisabled,
    };
  }

  function buildBazaTableTitle(baza) {
    var from = String(baza.periodFrom || "").trim();
    var to = String(baza.periodTo || "").trim();
    var fromLabel = formatIsoDateAsDdMmYyyy(from) || from;
    var toLabel = formatIsoDateAsDdMmYyyy(to) || to;
    var exercisePart = baza.exercise === "all"
      ? "по всем упражнениям"
      : "по Упражнению " + labelForExerciseValue(baza.exercise);
    var periodPart = from && to && from === to
      ? "на " + fromLabel
      : "за период с " + fromLabel + " по " + toLabel;
    return "БД " + exercisePart + " " + periodPart;
  }

  function setBazaTableLandscape(on) {
    document.body.classList.toggle("btca-force-landscape-table", !!on);
    if (on && screen.orientation && typeof screen.orientation.lock === "function") {
      screen.orientation.lock("landscape").catch(function () {});
    } else if (!on && screen.orientation && typeof screen.orientation.unlock === "function") {
      screen.orientation.unlock().catch(function () {});
    }
  }

  function expandBazaRowsAllL1(rawRows) {
    var byDateExercise = {};
    rawRows.forEach(function (r) {
      var d = String(r.date || "");
      var ex = String(r.exercise || "");
      var t = Number(r.task || 0);
      if (!d || !ex || !Number.isFinite(t)) return;
      if (!byDateExercise[d]) byDateExercise[d] = {};
      if (!byDateExercise[d][ex]) byDateExercise[d][ex] = {};
      byDateExercise[d][ex][t] = r;
    });
    var out = [];
    Object.keys(byDateExercise).sort().forEach(function (d) {
      Object.keys(byDateExercise[d]).sort().forEach(function (ex) {
        var byTask = byDateExercise[d][ex];
        var rules = exerciseRulesL1(b5FromSelectValue(ex));
        var allowed = taskNumbersForExercise(ex);
        var first = true;
        allowed.forEach(function (t) {
          var r = byTask[t];
          var reqFromRule = rules.requiredByTask[t - 1];
          out.push({
            date: first ? d : "",
            exercise: first ? labelForExerciseValue(ex) : "",
            exerciseKey: ex,
            task: t,
            req: r && r.req != null ? r.req : (reqFromRule == null ? null : Number(reqFromRule)),
            ok: r && r.ok != null ? r.ok : null,
            pct: r && r.pct != null ? r.pct : null,
            sets: r && r.sets != null ? r.sets : null,
            clusterFirst: first,
          });
          first = false;
        });
      });
    });
    return out;
  }

  function loadBazaTableRows(baza) {
    var queryEx = baza.exercise;
    var task = baza.task === "all" ? "all" : baza.task;
    return DB.bazaQuery({
      from: baza.periodFrom,
      to: baza.periodTo,
      exercise: queryEx,
      task: task,
    }).then(function (result) {
      var raw = result.rows || [];
      if (queryEx === "all") return expandBazaRowsAllL1(raw);
      return expandBazaRowsL1(raw, queryEx).map(function (row) {
        if (row.exercise) row.exercise = labelForExerciseValue(row.exerciseKey || row.exercise);
        return row;
      });
    });
  }

  function renderBazaTableBodyHtml(rows) {
    return rows.map(function (row) {
      var exKey = row.exerciseKey || row.exercise;
      var exLabel = row.exercise || labelForExerciseValue(exKey);
      return '<div class="btca-l1-baza-table-row' + (row.clusterFirst === false ? " btca-l1-baza-table-row--cluster" : "") + '">' +
        '<div class="btca-l1-baza-col btca-l1-baza-col--date"><span>' +
        escapeHtml(row.date ? formatIsoDateAsDdMmYyyy(row.date) : "") + "</span></div>" +
        '<div class="btca-l1-baza-col btca-l1-baza-col--ex"><span>' + escapeHtml(exLabel) + "</span></div>" +
        '<div class="btca-l1-baza-col btca-l1-baza-col--task"><span>' + row.task + "</span></div>" +
        '<div class="btca-l1-baza-col btca-l1-baza-col--req"><span>' + (row.req == null ? "—" : row.req) + "</span></div>" +
        '<div class="btca-l1-baza-col btca-l1-baza-col--ok"><span>' + (row.ok == null ? "—" : row.ok) + "</span></div>" +
        '<div class="btca-l1-baza-col btca-l1-baza-col--pct"><span>' + (row.pct == null ? "—" : row.pct + "%") + "</span></div></div>";
    }).join("");
  }

  function taskNumbersForExercise(exerciseKey) {
    var rules = exerciseRulesL1(b5FromSelectValue(exerciseKey));
    var out = [];
    for (var i = 0; i < rules.requiredByTask.length; i += 1) {
      if (rules.requiredByTask[i] != null) out.push(i + 1);
    }
    return out;
  }

  function expandBazaRowsL1(rawRows, exerciseFilter) {
    if (exerciseFilter === "all") return [];
    var rules = exerciseRulesL1(b5FromSelectValue(exerciseFilter));
    var allowed = taskNumbersForExercise(exerciseFilter);
    var byDate = {};
    rawRows.forEach(function (r) {
      var d = String(r.date || "");
      var t = Number(r.task || 0);
      if (!d || !Number.isFinite(t)) return;
      if (!byDate[d]) byDate[d] = {};
      byDate[d][t] = r;
    });
    var out = [];
    Object.keys(byDate).sort().forEach(function (d) {
      var byTask = byDate[d];
      var first = true;
      allowed.forEach(function (t) {
        var r = byTask[t];
        var reqFromRule = rules.requiredByTask[t - 1];
        out.push({
          date: first ? d : "",
          exercise: first ? labelForExerciseValue(exerciseFilter) : "",
          exerciseKey: exerciseFilter,
          task: t,
          req: r && r.req != null ? r.req : (reqFromRule == null ? null : Number(reqFromRule)),
          ok: r && r.ok != null ? r.ok : null,
          pct: r && r.pct != null ? r.pct : null,
          sets: r && r.sets != null ? r.sets : null,
          clusterFirst: first,
        });
        first = false;
      });
    });
    return out;
  }

  function bazaFiltersDisabled() {
    return state.bazaStats.empty || state.bazaOwnEmpty;
  }

  function buildBazaExercisePickerOptions() {
    if (state.bazaOwnEmpty) return [];
    var out = [{ value: "all", label: "Все" }];
    state.bazaOwnKeys.forEach(function (key) {
      out.push({ value: key, label: labelForExerciseValue(key) });
    });
    return out;
  }

  function bazaExerciseFaceLabel(exercise, disabled) {
    if (disabled) return "---";
    if (exercise === "all") return "Все";
    return labelForExerciseValue(exercise);
  }

  function isBazaExerciseSelectionValid(exercise) {
    if (exercise === "all") return true;
    return state.bazaOwnKeys.indexOf(exercise) >= 0;
  }

  function bazaChartDisplayRows(baza) {
    var rows = state.bazaExpandedRows;
    if (baza.task !== "all") {
      var t = Number(baza.task);
      rows = rows.filter(function (r) { return r.task === t; });
    }
    return rows;
  }

  function bazaTableDisplayRows(baza) {
    if (baza.exercise === "all") return state.bazaRows;
    var rows = state.bazaExpandedRows;
    if (baza.task !== "all") {
      var t = Number(baza.task);
      rows = rows.filter(function (r) { return r.task === t; });
    }
    return rows;
  }

  function onPickBazaExercise(item) {
    if (!item || item.groupHeader) return;
    if (item.value === "all") {
      state.ui.baza.exercise = "all";
      state.ui.baza.task = "all";
      applyUiPatch({ baza: { exercise: "all", task: "all" } });
      return refreshBazaContext().then(function () {
        renderActiveTab();
        renderTitleBar();
      });
    }
    state.ui.baza.exercise = item.value;
    state.ui.baza.task = "all";
    applyUiPatch({ baza: { exercise: item.value, task: "all" } });
    return refreshBazaContext().then(function () {
      renderActiveTab();
      renderTitleBar();
    });
  }

  function safeGutter() {
    return SCREEN_EDGE_GUTTER;
  }

  function computeAnchoredPickerLayout(anchorEl) {
    var rect = anchorEl.getBoundingClientRect();
    var gap = 6;
    var panelW = Math.max(96, Math.round(rect.width));
    var gutterL = safeGutter();
    var gutterR = safeGutter();
    var left = Math.max(gutterL, Math.min(Math.round(rect.left), window.innerWidth - gutterR - panelW));
    var top = Math.round(rect.bottom + gap);
    var bottomReserve = safeGutter() + 12;
    var availableH = Math.max(0, window.innerHeight - top - bottomReserve);
    var maxCap = Math.round(window.innerHeight * 0.52);
    var panelH = Math.min(maxCap, Math.max(120, availableH));
    return { top: top, left: left, width: panelW, height: panelH };
  }

  function computeCenteredDateSheetLayout() {
    var gutterL = safeGutter();
    var gutterR = safeGutter();
    return {
      top: Math.round(window.innerHeight * 0.2),
      left: gutterL,
      width: Math.max(280, window.innerWidth - gutterL - gutterR),
    };
  }

  function scrollPickerListActiveToCenter(listEl) {
    if (!listEl) return;
    function run() {
      var viewportH = listEl.clientHeight;
      if (viewportH <= 0) return;
      var active = listEl.querySelector(".btca-level1-picker__item--active");
      if (!active) return;
      var itemTop = active.offsetTop;
      var itemH = active.offsetHeight;
      var maxScroll = Math.max(0, listEl.scrollHeight - viewportH);
      var centered = itemTop - (viewportH - itemH) / 2;
      listEl.scrollTop = Math.min(maxScroll, Math.max(0, centered));
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(run);
    });
    window.setTimeout(run, 50);
    window.setTimeout(run, 150);
  }

  function pickerScrollOffset(options, index, viewportHeight, rowHeight) {
    if (index < 0 || index >= options.length || viewportHeight <= 0) return 0;
    var offset = PICKER_LIST_PAD;
    var i;
    for (i = 0; i < index; i += 1) offset += rowHeight;
    var length = rowHeight;
    var contentHeight = PICKER_LIST_PAD * 2 + options.length * rowHeight;
    var maxScroll = Math.max(0, contentHeight - viewportHeight);
    var centered = offset - (viewportHeight - length) / 2;
    return Math.min(maxScroll, Math.max(0, centered));
  }

  function scrollPickerToActive(listEl, options, currentValue, rowHeight) {
    scrollPickerListActiveToCenter(listEl);
  }

  function deriveNavSectionLabel(exerciseFilterKey) {
    if (exerciseFilterKey === NAV_FILTER_ALL) return "Все";
    if (exerciseFilterKey === "Тест1") return "Тренировочные тесты";
    return "Тренировка одиночными";
  }

  function labelForExerciseValue(value) {
    var item = state.data.exercises.filter(function (it) { return it.value === value; })[0];
    return item ? item.label : value;
  }

  function polezRowsForLevel1() {
    return state.data.polezCatalog.filter(function (row) { return !POLEZ_HIDDEN[row.key]; });
  }

  function sheetByKey(key) {
    return SHEETS.filter(function (s) { return s.key === key; })[0] || SHEETS[0];
  }

  function getTitleStatus() {
    var tab = state.ui.tab;
    var label = labelForExerciseValue(state.ui.exerciseValue);
    if (tab === "forma") {
      if (state.formaFlags.statusOverride) {
        return { text: state.formaFlags.statusOverride.text, tone: state.formaFlags.statusOverride.tone || "active" };
      }
      if (state.formaFlags.invalidData) return { text: "Некорректные данные", tone: "error" };
      if (state.formaFlags.suppressExerciseActive) return { text: "", tone: "base" };
      return label && label !== "—" ? { text: "Упр. " + label + " - активно! ", tone: "active" } : { text: "", tone: "base" };
    }
    if (tab === "baza") {
      return state.bazaStats.empty
        ? { text: "пуста", tone: "active" }
        : { text: state.bazaStats.fillText, tone: "active" };
    }
    if (tab === "nav") {
      return label && label !== "—" ? { text: "Упр. " + label + " - активно! ", tone: "active" } : { text: "", tone: "base" };
    }
    return { text: "Справочное пособие", tone: "muted" };
  }

  function renderTitleBar() {
    var titlebar = state.root && state.root.querySelector("[data-btca-level1-titlebar]");
    if (!titlebar) return;
    var sheet = sheetByKey(state.ui.tab);
    var status = getTitleStatus();

    if (state.ui.tab === "baza") {
      var fillText = state.bazaStats.fillText || (state.bazaStats.empty ? "пуста" : "");
      titlebar.innerHTML =
        (fillText
          ? '<div class="btca-level1-titlebar__baza-fill" aria-live="polite">' + escapeHtml(fillText) + "</div>"
          : "") +
        '<div class="btca-level1-titlebar__row btca-level1-titlebar__row--baza">' +
        '<div class="btca-level1-titlebar__title-group btca-level1-titlebar__title-group--baza">' +
        '<span class="btca-level1-titlebar__title">' + escapeHtml(sheet.title) + "</span>" +
        '<img class="btca-level1-titlebar__baza-icon" src="' + escapeHtml(brandingUrl(BRANDING_BAZA)) +
        '" alt="" draggable="false"></div>' +
        '<button type="button" class="btca-level1-baza-menu" data-btca-baza-menu aria-label="Меню базы">' +
        "<span></span><span></span><span></span></button></div>";
      return;
    }

    titlebar.innerHTML =
      '<div class="btca-level1-titlebar__row">' +
      '<div class="btca-level1-titlebar__title-group">' +
      '<span class="btca-level1-titlebar__title">' + escapeHtml(sheet.title) + "</span>" +
      (sheet.emoji ? '<span class="btca-level1-titlebar__emoji' +
        (state.ui.tab === "forma" ? " btca-level1-titlebar__emoji--forma" :
          state.ui.tab === "nav" ? " btca-level1-titlebar__emoji--nav" :
          state.ui.tab === "polez" ? " btca-level1-titlebar__emoji--polez" : "") +
        '" aria-hidden="true">' + sheet.emoji + "</span>" : "") +
      "</div>" +
      '<span class="btca-level1-titlebar__spacer"></span>' +
      '<span class="btca-level1-titlebar__status' +
      (status.tone === "muted" ? " btca-level1-titlebar__status--muted" : "") +
      (status.tone === "error" ? " btca-level1-titlebar__status--error" : "") +
      '">' + escapeHtml(status.text) + "</span></div>";
  }

  function closePicker() {
    var layer = state.root && state.root.querySelector("[data-btca-level1-picker]");
    if (layer) layer.setAttribute("hidden", "hidden");
  }

  function openPicker(title, options, current, onSelect, anchorEl, pickerOpts) {
    pickerOpts = pickerOpts || {};
    var layer = state.root.querySelector("[data-btca-level1-picker]");
    if (!layer) return;
    layer.removeAttribute("hidden");
    var rowHeight = pickerOpts.rowHeight || PICKER_ROW_SIMPLE;
    var itemExtraClass = pickerOpts.itemClass || "";
    var pickerClass = "btca-level1-picker btca-level1-picker--anchored";
    var pickerStyle = "";
    var layout = anchorEl && anchorEl.getBoundingClientRect
      ? computeAnchoredPickerLayout(anchorEl)
      : null;
    if (layout) {
      pickerStyle =
        ' style="position:fixed;top:' + layout.top + "px;left:" + layout.left + "px;width:" + layout.width +
        "px;height:" + layout.height + 'px;right:auto;"';
    }
    layer.innerHTML =
      '<button class="btca-level1-menu-backdrop" type="button" data-btca-picker-close aria-label="Закрыть"></button>' +
      '<div class="' + pickerClass + '" role="dialog" aria-label="' + escapeHtml(title) + '"' + pickerStyle + ">" +
      '<div class="btca-level1-picker__list" data-btca-picker-list>' +
      options.map(function (opt) {
        if (opt.groupHeader) {
          var groupClass = "btca-level1-picker__group";
          if (opt.sectionHeader) groupClass += " btca-level1-picker__group--section";
          if (opt.disabledHeader) groupClass += " btca-level1-picker__group--disabled";
          return '<div class="' + groupClass + '">' + escapeHtml(opt.label) + "</div>";
        }
        var active = opt.value === current;
        return '<button type="button" class="btca-level1-picker__item btca-level1-picker__item--catalog' + itemExtraClass +
          (active ? " btca-level1-picker__item--active" : "") +
          '" data-btca-picker-value="' + escapeHtml(opt.value) + '"><span class="btca-level1-picker__text">' +
          escapeHtml(opt.label) + "</span></button>";
      }).join("") +
      "</div></div>";
    var listEl = layer.querySelector("[data-btca-picker-list]");
    scrollPickerToActive(listEl, options, current, rowHeight);
    layer.onclick = function (event) {
      if (event.target.closest("[data-btca-picker-close]")) { closePicker(); return; }
      var btn = event.target.closest("[data-btca-picker-value]");
      if (!btn) return;
      var value = btn.getAttribute("data-btca-picker-value");
      if (!value || value.indexOf("__group:") === 0 || value.indexOf("__section:") === 0) return;
      closePicker();
      onSelect(value);
    };
  }

  function computeFormaRows() {
    syncUiFromDb();
    var b5 = b5FromSelectValue(state.ui.exerciseValue);
    var rules = exerciseRulesL1(b5);
    var okByTask = state.ui.taskOk || {};
    var hasAnyValidOk = false;
    var allActiveOkAreEmptyOrValid = true;
    var rows = [];
    for (var task = 1; task <= 12; task += 1) {
      var active = taskActiveFormL1(b5, task);
      var req = rules.requiredByTask[task - 1];
      var okRaw = okByTask[String(task)] || "";
      var pct = "";
      var invalid = false;
      if (!active || req === null) {
        rows.push({ task: task, active: active, required: req, okRaw: okRaw, pct: pct, invalid: invalid });
        continue;
      }
      var ok = parseNonNegativeInt(okRaw);
      if (!okRaw.trim()) {
        rows.push({ task: task, active: active, required: req, okRaw: okRaw, pct: "", invalid: false });
        continue;
      }
      if (ok === null || Number.isNaN(ok)) {
        allActiveOkAreEmptyOrValid = false;
        rows.push({ task: task, active: active, required: req, okRaw: okRaw, pct: "", invalid: true });
        continue;
      }
      if (ok === 0) {
        rows.push({ task: task, active: active, required: req, okRaw: "", pct: "", invalid: false });
        continue;
      }
      if (!Number.isFinite(ok) || ok < 0 || ok > req) {
        allActiveOkAreEmptyOrValid = false;
        rows.push({ task: task, active: active, required: req, okRaw: okRaw, pct: "", invalid: true });
        continue;
      }
      hasAnyValidOk = true;
      pct = Math.round((ok / req) * 100) + " %";
      rows.push({ task: task, active: active, required: req, okRaw: okRaw, pct: pct, invalid: false });
    }
    return { rows: rows, canSave: hasAnyValidOk && allActiveOkAreEmptyOrValid, allActiveOkAreEmptyOrValid: allActiveOkAreEmptyOrValid };
  }

  function renderFormaTab(content) {
    formaOkFocusState.task = null;
    var forma = computeFormaRows();
    state.formaFlags.invalidData = !forma.allActiveOkAreEmptyOrValid;
    var dateLabel = formatIsoDateAsDdMmYyyy(state.ui.trainingDate) || state.ui.trainingDate;
    var exerciseLabel = labelForExerciseValue(state.ui.exerciseValue);
    var exerciseOptions = state.data.exercises.map(function (it) {
      return { value: it.value, label: it.label };
    });
    var b5 = b5FromSelectValue(state.ui.exerciseValue);

    content.innerHTML =
      '<div class="btca-l1-tab btca-l1-forma">' +
      '<div class="btca-l1-sticky-head">' +
      '<div class="btca-l1-toolbar btca-l1-toolbar-top">' +
      '<div class="btca-l1-forma-date-col">' +
      '<span class="btca-l1-field-label">Дата</span>' +
      dateFaceHtml(dateLabel, 'data-btca-forma-date aria-label="Дата тренировки"') +
      "</div>" +
      '<div class="btca-l1-trailing-wrap" data-btca-forma-trailing>' +
      saveButtonHtml(forma.canSave, "data-btca-forma-save") +
      "</div></div>" +
      '<div class="btca-l1-toolbar btca-l1-toolbar-second">' +
      '<div class="btca-l1-exercise-row">' +
      '<div class="btca-l1-exercise-col">' +
      '<span class="btca-l1-field-label">Упражнение</span>' +
      filterFaceHtml(exerciseLabel, { wide: true, dataAttr: "data-btca-forma-exercise" }) +
      "</div>" +
      '<div class="btca-l1-trailing-slot">' +
      greenArrowHtml({ dataAttr: 'data-btca-forma-desc aria-label="Описание упражнения"' }) +
      "</div></div></div>" +
      '<div class="btca-l1-banner">' + escapeHtml(FORMA_BANNER) + "</div></div>" +
      '<div class="btca-l1-tab-body btca-l1-forma-body">' +
      '<div class="btca-l1-table-area"><div class="btca-l1-table-wrap">' +
      formaTableHeadHtml() +
      '<div class="btca-l1-table-scroll" data-btca-forma-table-scroll><div class="btca-l1-table-body">' +
      forma.rows.map(function (row, idx) {
        var rowClass = !row.active || row.required === null ? "btca-l1-table__row--unused" : (idx % 2 ? "btca-l1-table__row--odd" : "btca-l1-table__row--even");
        var okCell = row.active && row.required !== null
          ? '<div class="btca-l1-table-cell btca-l1-col--ok' + (row.invalid ? " btca-l1-table-cell--invalid" : "") +
            '" data-btca-forma-ok-slot="' + row.task + '"></div>'
          : '<div class="btca-l1-table-cell btca-l1-col--ok btca-l1-table-cell--unused"></div>';
        return '<div class="btca-l1-table-row ' + rowClass + '">' +
          '<div class="btca-l1-table-cell btca-l1-col--task"><span class="btca-l1-td' +
          (!row.active ? " btca-l1-td--muted" : " btca-l1-td--task") + '">' +
          (row.active ? String(row.task) : "") + "</span></div>" +
          '<div class="btca-l1-table-cell btca-l1-col--req"><span class="btca-l1-td' +
          (!row.active ? " btca-l1-td--muted" : "") + '">' +
          (row.required == null ? "" : String(row.required)) + "</span></div>" +
          okCell +
          '<div class="btca-l1-table-cell btca-l1-col--pct"><span class="btca-l1-td' +
          (!row.active ? " btca-l1-td--muted" : "") + '">' + escapeHtml(row.pct) + "</span></div></div>";
      }).join("") +
      "</div></div></div></div></div></div>";

    content.querySelector("[data-btca-forma-date]").addEventListener("click", function () {
      openDateInput(state.ui.trainingDate, function (iso) {
        state.formaFlags.suppressExerciseActive = false;
        state.formaFlags.statusOverride = null;
        state.ui.trainingDate = iso;
        applyUiPatch({ trainingDate: iso });
        renderFormaTab(content);
        renderTitleBar();
      });
    });
    content.querySelector("[data-btca-forma-exercise]").addEventListener("click", function (event) {
      openPicker("Упражнение", exerciseOptions, state.ui.exerciseValue, function (value) {
        state.formaFlags.suppressExerciseActive = false;
        state.formaFlags.statusOverride = null;
        state.ui.exerciseValue = value;
        state.ui.taskOk = {};
        state.ui.nav.exerciseFilterKey = value;
        applyUiPatch({ exerciseValue: value, taskOk: {}, nav: { exerciseFilterKey: value } });
        renderFormaTab(content);
        renderTitleBar();
        scrollFormaTableToTop(content);
      }, event.currentTarget);
    });
    content.querySelector("[data-btca-forma-desc]").addEventListener("click", function () {
      openExerciseImage({
        exerciseValue: state.ui.exerciseValue,
        title: exerciseLabel,
        fromForma: true,
      });
    });
    mountFormaOkCells(content, forma);
    wireFormaOkInputs(content);
    syncFormaSaveButton(content, forma.canSave);
    wireFormaSaveOnContent(content);
  }

  function wireFormaSaveOnContent(content) {
    if (!content || content._formaSaveTouchWired) return;
    content._formaSaveTouchWired = true;
    content.addEventListener("touchstart", function (event) {
      if (!state.mounted || !state.ui || state.ui.tab !== "forma") return;
      var btn = event.target.closest("[data-btca-forma-save]");
      if (!btn) return;
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
      markFormaNumpadInteraction();
      saveFormaCluster(content);
    }, { capture: true, passive: false });
    content.addEventListener("click", function (event) {
      if (!state.mounted || !state.ui || state.ui.tab !== "forma") return;
      if (useFormaCustomNumpad()) return;
      var btn = event.target.closest("[data-btca-forma-save]");
      if (!btn) return;
      event.preventDefault();
      event.stopPropagation();
      saveFormaCluster(content);
    }, true);
  }

  function openDateInput(currentIso, onPick, title) {
    if (typeof window.__BTCA_OPEN_DATE_INPUT__ === "function") {
      window.__BTCA_OPEN_DATE_INPUT__(currentIso, onPick, title);
    }
  }

  function buildFormaSaveRows() {
    syncUiFromDb();
    var b5 = b5FromSelectValue(state.ui.exerciseValue);
    var rules = exerciseRulesL1(b5);
    var okByTask = state.ui.taskOk || {};
    var rows = [];
    for (var task = 1; task <= 12; task += 1) {
      var req = rules.requiredByTask[task - 1];
      var okRaw = okByTask[String(task)] || "";
      var okParsed = parseNonNegativeInt(okRaw);
      var ok = okParsed === null || Number.isNaN(okParsed) ? null : Number(okParsed);
      rows.push({ task: task, req: req === null ? null : Number(req), ok: ok });
    }
    return rows;
  }

  function saveFormaCluster(contentFromCaller) {
    if (formaSaveInFlight) return;
    var content = contentFromCaller || (state.root && state.root.querySelector("[data-btca-level1-content]"));
    if (content) {
      closeFormaOkCell(content);
      mergeDomTaskOkIntoState(content);
    } else {
      syncUiFromDb();
    }
    blurActiveField();
    var forma = computeFormaRows();
    if (!forma.canSave) {
      state.formaFlags.statusOverride = {
        text: forma.allActiveOkAreEmptyOrValid ? "Введите данные" : "Некорректные данные",
        tone: "error",
      };
      renderTitleBar();
      return;
    }
    formaSaveInFlight = true;
    armFormaSaveWatchdog();
    state.formaFlags.statusOverride = { text: "Сохранение…", tone: "active" };
    renderTitleBar();
    var rows = buildFormaSaveRows();
    var savePromise = DB.flushUiState ? DB.flushUiState() : Promise.resolve();
    savePromise.then(function () {
      return DB.saveCluster({
        date: state.ui.trainingDate,
        exercise: state.ui.exerciseValue,
        rows: rows,
      });
    }).then(function (res) {
      if (!res || !res.ok) {
        state.formaFlags.statusOverride = { text: "Ошибка записи", tone: "error" };
        renderTitleBar();
        return;
      }
      state.ui.taskOk = {};
      state.ui.baza.periodFrom = state.ui.trainingDate;
      state.ui.baza.periodTo = state.ui.trainingDate;
      state.ui.baza.exercise = state.ui.exerciseValue;
      state.ui.baza.task = "all";
      applyUiPatch({
        taskOk: {},
        baza: { periodFrom: state.ui.trainingDate, periodTo: state.ui.trainingDate, exercise: state.ui.exerciseValue, task: "all" },
      });
      state.formaFlags.suppressExerciseActive = true;
      state.formaFlags.statusOverride = { text: "Данные записаны!", tone: "active" };
      window.setTimeout(function () {
        state.formaFlags.statusOverride = null;
        state.formaFlags.suppressExerciseActive = false;
        renderTitleBar();
      }, 5000);
      refreshBazaContext().then(function () {
        renderActiveTab();
        renderTitleBar();
      });
    }).catch(function () {
      state.formaFlags.statusOverride = { text: "Ошибка записи", tone: "error" };
      renderTitleBar();
    }).then(function () {
      clearFormaSaveWatchdog();
      formaSaveInFlight = false;
    });
  }

  function refreshBazaStats() {
    return DB.dbStats().then(function (stats) {
      state.bazaStats.empty = stats.empty;
      state.bazaStats.fillText = DB.bazaFillStatusText(stats.filledRows, stats.maxRows);
    });
  }

  function refreshBazaContext() {
    var baza = state.ui.baza;
    var today = DB.formatYmd(new Date());
    var from = baza.periodFrom || today;
    var to = baza.periodTo || today;
    return Promise.all([
      DB.dbStats(),
      refreshBazaStats(),
      DB.bazaQuery({ from: from, to: to, exercise: "all", task: "all" }),
    ]).then(function (parts) {
      var ownStats = parts[0];
      var periodQuery = parts[2];
      state.bazaOwnKeys = periodQuery.exercises || [];
      state.bazaOwnEmpty = Number(ownStats.totalRows || 0) <= 0;
      state.bazaNoExercisesInPeriod = state.bazaOwnKeys.length <= 0;
      var ex = baza.exercise;

      if (!state.bazaOwnKeys.length && ex === "all") {
        state.bazaRuleTasks = [];
        state.bazaRows = [];
        state.bazaExpandedRows = [];
        return;
      }

      if (ex !== "all") {
        state.bazaRuleTasks = taskNumbersForExercise(ex);
      } else {
        state.bazaRuleTasks = [];
      }

      return refreshBazaRows();
    });
  }

  function refreshBazaRows() {
    var baza = state.ui.baza;
    if (baza.exercise === "all") {
      state.bazaRows = [];
      state.bazaExpandedRows = [];
      return Promise.resolve({ rows: [] });
    }
    return DB.bazaQuery({
      from: baza.periodFrom,
      to: baza.periodTo,
      exercise: baza.exercise,
      task: "all",
    }).then(function (result) {
      var rawRows = result.rows || [];
      state.bazaExpandedRows = expandBazaRowsL1(rawRows, baza.exercise);
      if (baza.task === "all") {
        state.bazaRows = rawRows;
        return result;
      }
      return DB.bazaQuery({
        from: baza.periodFrom,
        to: baza.periodTo,
        exercise: baza.exercise,
        task: baza.task,
      }).then(function (filtered) {
        state.bazaRows = filtered.rows || [];
        return filtered;
      });
    });
  }

  function showBazaToast(message, color) {
    state.bazaToast = { message: message, color: color || "#15A60E" };
    renderBazaToast();
    window.setTimeout(function () {
      state.bazaToast = null;
      renderBazaToast();
    }, 2800);
  }

  function renderBazaToast() {
    var host = state.root && state.root.querySelector("[data-btca-level1-baza-toast]");
    if (!host) return;
    if (!state.bazaToast) {
      host.setAttribute("hidden", "hidden");
      host.innerHTML = "";
      return;
    }
    host.removeAttribute("hidden");
    host.innerHTML = '<div class="btca-l2-baza-toast" style="background:' + escapeHtml(state.bazaToast.color) + '">' +
      escapeHtml(state.bazaToast.message) + "</div>";
  }

  function validateBazaIdentifierInput(raw) {
    var trimmed = String(raw || "").trim();
    if (!trimmed) return { ok: false, error: "Введите идентификатор." };
    if (trimmed.length > 32) return { ok: false, error: "Не более 32 символов." };
    if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
      return { ok: false, error: "Разрешены только латинские буквы A–Z, цифры 0–9, дефис (-) и подчёркивание (_)." };
    }
    return { ok: true, value: trimmed };
  }

  function bazaMenuCapabilities() {
    var baza = state.ui.baza;
    var exerciseDisabled = bazaFiltersDisabled() || state.bazaNoExercisesInPeriod;
    var chartMeta = getBazaChartMeta(baza, exerciseDisabled);
    var chartRows = chartMeta.showChart ? bazaChartDisplayRows(baza) : [];
    return {
      canDeleteOwn: !state.bazaStats.empty,
      canScreenshot: chartMeta.showChart && chartRows.length > 0,
    };
  }

  function renderBazaMenuLayer() {
    var layer = state.root && state.root.querySelector("[data-btca-level1-baza-menu-layer]");
    if (!layer) return;
    if (!state.bazaMenuOpen) {
      layer.setAttribute("hidden", "hidden");
      layer.innerHTML = "";
      return;
    }
    var caps = bazaMenuCapabilities();
    layer.removeAttribute("hidden");
    layer.innerHTML =
      '<button class="btca-level1-menu-backdrop" type="button" data-btca-baza-menu-close aria-label="Закрыть меню"></button>' +
      '<nav class="btca-l1-baza-sheet-menu" aria-label="Меню базы">' +
      '<button type="button" class="btca-l1-baza-sheet-menu__item' + (caps.canDeleteOwn ? "" : " btca-l1-baza-sheet-menu__item--disabled") +
      '" data-btca-baza-action="deleteOwn"><span class="btca-l2-baza-menu__icon" aria-hidden="true">🔴</span><span>Удалить данные</span></button>' +
      '<button type="button" class="btca-l1-baza-sheet-menu__item' + (caps.canScreenshot ? "" : " btca-l1-baza-sheet-menu__item--disabled") +
      '" data-btca-baza-action="screenshot"><span class="btca-l2-baza-menu__icon btca-l2-baza-menu__icon--shot" aria-hidden="true">📷</span><span>Скриншот</span></button>' +
      "</nav>";
    layer.onclick = function (event) {
      if (event.target.closest("[data-btca-baza-menu-close]")) {
        state.bazaMenuOpen = false;
        renderBazaMenuLayer();
        return;
      }
      var btn = event.target.closest("[data-btca-baza-action]");
      if (!btn || btn.classList.contains("btca-l1-baza-sheet-menu__item--disabled")) return;
      handleBazaMenuAction(btn.getAttribute("data-btca-baza-action"));
    };
  }

  function openBazaIdentifierDialog() {
    state.bazaIdentifierMode = "screenshot";
    renderBazaIdentifierDialog();
  }

  function renderBazaIdentifierDialog() {
    var layer = state.root && state.root.querySelector("[data-btca-level1-baza-id-layer]");
    if (!layer) return;
    if (!state.bazaIdentifierMode) {
      layer.setAttribute("hidden", "hidden");
      layer.innerHTML = "";
      return;
    }
    layer.removeAttribute("hidden");
    layer.innerHTML =
      '<button class="btca-level1-menu-backdrop" type="button" data-btca-baza-id-close aria-label="Закрыть"></button>' +
      '<div class="btca-l2-baza-id-dialog" role="dialog">' +
      "<h3>Скриншот диаграммы</h3>" +
      '<label class="btca-l2-baza-id-label">Идентификатор<input class="btca-l2-baza-id-input" type="text" value="' +
      escapeHtml(state.bazaUserFileId || "") + '" placeholder="Идентификатор анг..." maxlength="32"></label>' +
      '<div class="btca-l2-baza-id-actions">' +
      '<button type="button" class="btca-l2-baza-id-btn" data-btca-baza-id-cancel>Отмена</button>' +
      '<button type="button" class="btca-l2-baza-id-btn btca-l2-baza-id-btn--primary" data-btca-baza-id-confirm>Продолжить</button></div></div>';
    layer.onclick = function (event) {
      if (event.target.closest("[data-btca-baza-id-close]") || event.target.closest("[data-btca-baza-id-cancel]")) {
        state.bazaIdentifierMode = null;
        renderBazaIdentifierDialog();
        return;
      }
      if (!event.target.closest("[data-btca-baza-id-confirm]")) return;
      var input = layer.querySelector(".btca-l2-baza-id-input");
      var id = state.bazaUserFileId;
      if (!id && input) {
        var validation = validateBazaIdentifierInput(input.value);
        if (!validation.ok) {
          showBazaToast(validation.error, "#E53935");
          return;
        }
        id = validation.value;
      }
      state.bazaIdentifierMode = null;
      renderBazaIdentifierDialog();
      runBazaScreenshot(id);
    };
  }

  function runBazaScreenshot(userId) {
    var baza = state.ui.baza;
    var chartRows = bazaChartDisplayRows(baza);
    if (!chartRows.length) {
      showBazaToast("Нет диаграммы для сохранения.", "#E53935");
      return;
    }
    var saveId = function () {
      if (userId && !state.bazaUserFileId && DB.saveUserFileIdentifier) {
        return DB.saveUserFileIdentifier(userId).then(function () { state.bazaUserFileId = userId; });
      }
      return Promise.resolve();
    };
    saveId().then(function () {
      var width = 640;
      var height = 360;
      var canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#c5d9dc";
      ctx.fillRect(0, 0, width, height);
      var rowH = Math.max(28, Math.floor((height - 40) / chartRows.length));
      chartRows.forEach(function (row, idx) {
        var y = 20 + idx * rowH;
        var pct = row.pct == null ? 0 : Math.max(0, Math.min(100, Number(row.pct)));
        ctx.fillStyle = "#111827";
        ctx.font = "14px sans-serif";
        ctx.fillText("З" + row.task, 16, y + 18);
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillRect(56, y + 4, width - 120, 18);
        ctx.fillStyle = "#0ab10a";
        ctx.fillRect(56, y + 4, Math.round((width - 120) * pct / 100), 18);
        ctx.fillStyle = "#111827";
        ctx.fillText(row.pct == null ? "—" : row.pct + "%", width - 52, y + 18);
      });
      canvas.toBlob(function (pngBlob) {
        if (!pngBlob) {
          showBazaToast("Не удалось сохранить скриншот.", "#E53935");
          return;
        }
        var id = userId || state.bazaUserFileId || "screenshot";
        var a = document.createElement("a");
        a.href = URL.createObjectURL(pngBlob);
        a.download = "BTCA_L1_" + id + "_" + baza.exercise + "_" + baza.periodFrom + ".png";
        a.click();
        state.bazaMenuOpen = false;
        renderBazaMenuLayer();
        showBazaToast("Успех!");
      }, "image/png");
    });
  }

  function openBazaDeleteConfirm() {
    state.bazaDeleteConfirm = true;
    renderBazaDeleteConfirm();
  }

  function renderBazaDeleteConfirm() {
    var layer = state.root && state.root.querySelector("[data-btca-level1-baza-delete-layer]");
    if (!layer) return;
    if (!state.bazaDeleteConfirm) {
      layer.setAttribute("hidden", "hidden");
      layer.innerHTML = "";
      return;
    }
    layer.removeAttribute("hidden");
    layer.innerHTML =
      '<button class="btca-level1-menu-backdrop" type="button" data-btca-baza-del-close aria-label="Закрыть"></button>' +
      '<div class="btca-l2-baza-id-dialog" role="dialog">' +
      "<h3>Удалить данные?</h3>" +
      "<p>Будут удалены текущие записи по выбранным фильтрам.</p>" +
      '<div class="btca-l2-baza-id-actions">' +
      '<button type="button" class="btca-l2-baza-id-btn" data-btca-baza-del-cancel>Отмена</button>' +
      '<button type="button" class="btca-l2-baza-id-btn btca-l2-baza-id-btn--danger" data-btca-baza-del-confirm>Удалить</button></div></div>';
    layer.onclick = function (event) {
      if (event.target.closest("[data-btca-baza-del-close]") || event.target.closest("[data-btca-baza-del-cancel]")) {
        state.bazaDeleteConfirm = null;
        renderBazaDeleteConfirm();
        return;
      }
      if (!event.target.closest("[data-btca-baza-del-confirm]")) return;
      state.bazaDeleteConfirm = null;
      renderBazaDeleteConfirm();
      runBazaDelete();
    };
  }

  function runBazaDelete() {
    var baza = state.ui.baza;
    DB.bazaDeleteCurrentByFilters({
      from: baza.periodFrom,
      to: baza.periodTo,
      exercise: baza.exercise === "all" ? "all" : baza.exercise,
      task: "all",
    }).then(function () {
      state.bazaMenuOpen = false;
      renderBazaMenuLayer();
      return refreshBazaContext();
    }).then(function () {
      renderActiveTab();
      renderTitleBar();
      showBazaToast("Успех!");
    }).catch(function () {
      showBazaToast("Не удалось удалить данные.", "#E53935");
    });
  }

  function handleBazaMenuAction(action) {
    var caps = bazaMenuCapabilities();
    if (action === "deleteOwn" && caps.canDeleteOwn) {
      state.bazaMenuOpen = false;
      renderBazaMenuLayer();
      openBazaDeleteConfirm();
      return;
    }
    if (action === "screenshot" && caps.canScreenshot) {
      if (state.bazaUserFileId) runBazaScreenshot(state.bazaUserFileId);
      else openBazaIdentifierDialog();
    }
  }

  function renderBazaTab(content) {
    var baza = state.ui.baza;
    var periodDisabled = bazaFiltersDisabled();
    var exerciseDisabled = periodDisabled || state.bazaNoExercisesInPeriod;
    var taskFilterEmpty = exerciseDisabled;
    var fromLabel = periodDisabled ? "---" : (formatIsoDateAsDdMmYyyy(baza.periodFrom) || "—");
    var toLabel = periodDisabled ? "---" : (formatIsoDateAsDdMmYyyy(baza.periodTo) || "—");
    var exerciseLabel = bazaExerciseFaceLabel(baza.exercise, exerciseDisabled);
    var taskLabel = taskFilterEmpty || baza.exercise === "all" ? (taskFilterEmpty ? "---" : "Все") : (baza.task === "all" ? "Все" : baza.task);
    var taskDisabled = taskFilterEmpty || baza.exercise === "all";
    var chartMeta = getBazaChartMeta(baza, exerciseDisabled);
    var chartRows = chartMeta.showChart ? bazaChartDisplayRows(baza) : [];

    content.innerHTML =
      '<div class="btca-l1-tab btca-l1-baza">' +
      '<div class="btca-l1-sticky-head btca-l1-baza-head">' +
      '<div class="btca-l1-baza-filter-row">' +
      '<span class="btca-l1-field-label btca-l1-field-label--center">Период</span>' +
      '<div class="btca-l1-period-faces">' +
      periodDateFaceHtml(fromLabel, "data-btca-baza-from", periodDisabled) +
      periodDateFaceHtml(toLabel, "data-btca-baza-to", periodDisabled) +
      "</div></div>" +
      '<div class="btca-l1-baza-filter-row">' +
      '<div class="btca-l1-baza-labels-row">' +
      '<span class="btca-l1-field-label btca-l1-field-label--center">Упражнение</span>' +
      '<span class="btca-l1-field-label btca-l1-field-label--center btca-l1-task-label-col">Задача</span>' +
      "</div>" +
      '<div class="btca-l1-baza-fields-row">' +
      '<div class="btca-l1-exercise-col">' +
      filterFaceHtml(exerciseLabel, { wide: true, disabled: exerciseDisabled, dataAttr: "data-btca-baza-exercise" }) +
      "</div>" +
      '<div class="btca-l1-trailing-slot btca-l1-task-field-col">' +
      filterFaceHtml(taskLabel, { wide: true, disabled: taskDisabled, dataAttr: "data-btca-baza-task" }) +
      "</div></div></div>" +
      '<div class="btca-l1-baza-chart-header">' +
      '<span class="btca-l1-baza-chart-title">' + escapeHtml(chartMeta.text) + "</span>" +
      '<div class="btca-l1-trailing-slot btca-l1-chart-arrow-slot">' +
      greenArrowHtml({
        disabled: chartMeta.arrowDisabled,
        dataAttr: 'data-btca-baza-table aria-label="Таблица"',
      }) +
      "</div></div></div>" +
      '<div class="btca-l1-tab-body btca-l1-baza-body">' +
      (chartMeta.showChart
        ? '<section class="btca-l1-chart-panel" aria-label="Диаграмма">' +
          '<div class="btca-l1-chart-bars">' +
          chartRows.map(function (row) {
            var pct = row.pct == null ? 0 : Math.max(0, Math.min(100, Number(row.pct)));
            return '<div class="btca-l1-chart-row"><span>З' + row.task + "</span>" +
              '<div class="btca-l1-chart-bar"><div style="width:' + pct + '%"></div></div>' +
              "<span>" + (row.pct == null ? "—" : row.pct + "%") + "</span></div>";
          }).join("") +
          (chartRows.length ? "" : '<p class="btca-l1-empty">Нет данных за выбранный период</p>') +
          "</div></section>"
        : "") +
      "</div></div>";

    if (!periodDisabled) {
      content.querySelector("[data-btca-baza-from]").addEventListener("click", function () {
        openDateInput(baza.periodFrom, function (iso) {
          state.ui.baza.periodFrom = iso;
          applyUiPatch({ baza: { periodFrom: iso } });
          refreshBazaContext().then(function () { renderBazaTab(content); renderTitleBar(); });
        }, "Период с");
      });
      content.querySelector("[data-btca-baza-to]").addEventListener("click", function () {
        openDateInput(baza.periodTo, function (iso) {
          state.ui.baza.periodTo = iso;
          applyUiPatch({ baza: { periodTo: iso } });
          refreshBazaContext().then(function () { renderBazaTab(content); renderTitleBar(); });
        }, "Период по");
      });
    }
    if (!exerciseDisabled) {
      var exerciseOptions = buildBazaExercisePickerOptions();
      content.querySelector("[data-btca-baza-exercise]").addEventListener("click", function (event) {
        openPicker("Упражнение", exerciseOptions, baza.exercise, function (value) {
          var item = exerciseOptions.filter(function (o) { return o.value === value; })[0];
          onPickBazaExercise(item || { value: value });
        }, event.currentTarget);
      });
    }
    var taskBtn = content.querySelector("[data-btca-baza-task]");
    if (taskBtn && !taskDisabled) {
      taskBtn.addEventListener("click", function (event) {
        var options = [{ value: "all", label: "Все" }].concat(
          state.bazaRuleTasks.map(function (t) { return { value: String(t), label: String(t) }; })
        );
        openPicker("Задача", options, baza.task, function (value) {
          state.ui.baza.task = value;
          applyUiPatch({ baza: { task: value } });
          refreshBazaRows().then(function () { renderBazaTab(content); });
        }, event.currentTarget);
      });
    }
    var tableBtn = content.querySelector("[data-btca-baza-table]");
    if (tableBtn && !chartMeta.arrowDisabled) tableBtn.addEventListener("click", function () { openBazaTable(); });
  }

  function openBazaTable() {
    var baza = state.ui.baza;
    var title = buildBazaTableTitle(baza);
    setBazaTableLandscape(true);
    var overlay = document.createElement("div");
    overlay.className = "btca-l1-overlay btca-l1-overlay--baza-table";
    overlay.innerHTML =
      '<header class="btca-l1-overlay__header btca-l1-overlay__header--baza-table">' +
      '<button type="button" class="btca-back-button" data-btca-overlay-close aria-label="Назад">←</button>' +
      "<strong>" + escapeHtml(title) + "</strong></header>" +
      '<div class="btca-l1-baza-table-wrap">' +
      '<div class="btca-l1-baza-table-head"><div class="btca-l1-baza-table-row">' +
      '<div class="btca-l1-baza-col btca-l1-baza-col--date"><span>Дата</span></div>' +
      '<div class="btca-l1-baza-col btca-l1-baza-col--ex"><span>Упр.</span></div>' +
      '<div class="btca-l1-baza-col btca-l1-baza-col--task"><span>Задача</span></div>' +
      '<div class="btca-l1-baza-col btca-l1-baza-col--req"><span>Треб.</span></div>' +
      '<div class="btca-l1-baza-col btca-l1-baza-col--ok"><span>Успех</span></div>' +
      '<div class="btca-l1-baza-col btca-l1-baza-col--pct"><span>%</span></div>' +
      "</div></div>" +
      '<div class="btca-l1-baza-table-scroll"><div class="btca-l1-baza-table-body"></div></div></div>';
    state.root.appendChild(overlay);
    var bodyEl = overlay.querySelector(".btca-l1-baza-table-body");
    function closeTable() {
      setBazaTableLandscape(false);
      overlay.remove();
    }
    overlay.querySelector("[data-btca-overlay-close]").addEventListener("click", closeTable);
    loadBazaTableRows(baza).then(function (rows) {
      if (!bodyEl || !overlay.isConnected) return;
      bodyEl.innerHTML = rows.length ? renderBazaTableBodyHtml(rows) : "";
    });
  }

  function renderNavTab(content) {
    var filterKey = state.ui.nav.exerciseFilterKey;
    var sectionLabel = deriveNavSectionLabel(filterKey);
    var filterIsAll = filterKey === NAV_FILTER_ALL;
    var displayExercise = filterIsAll ? "Все" : labelForExerciseValue(filterKey);
    var items = filterIsAll
      ? state.data.exercises
      : state.data.exercises.filter(function (it) { return it.value === filterKey; });
    var exerciseOptions = [{ value: NAV_FILTER_ALL, label: "Все" }].concat(state.data.exercises.map(function (it) {
      return { value: it.value, label: it.label };
    }));

    content.innerHTML =
      '<div class="btca-l1-tab btca-l1-nav">' +
      '<div class="btca-l1-sticky-head">' +
      '<div class="btca-l1-toolbar btca-l1-toolbar-second">' +
      '<div class="btca-l1-nav-section">' +
      '<span class="btca-l1-field-label">Раздел</span>' +
      sectionFaceHtml(sectionLabel) +
      "</div></div>" +
      '<div class="btca-l1-toolbar btca-l1-toolbar-second">' +
      '<div class="btca-l1-exercise-row">' +
      '<div class="btca-l1-exercise-col">' +
      '<span class="btca-l1-field-label">Упражнение</span>' +
      filterFaceHtml(displayExercise, { wide: true, dataAttr: "data-btca-nav-filter" }) +
      "</div>" +
      '<div class="btca-l1-trailing-slot">' +
      greenArrowHtml({
        disabled: filterIsAll,
        dataAttr: 'data-btca-nav-desc aria-label="Описание"',
      }) +
      "</div></div></div></div>" +
      '<div class="btca-l1-tab-body btca-l1-nav-cards">' +
      items.map(function (item) {
        var img = exerciseImageUrl(item.value);
        var consumed = state.ui.exerciseValue === item.value;
        return '<article class="btca-l1-nav-card">' +
          '<div class="btca-l1-nav-card-inner">' +
          '<div class="btca-l1-nav-card-top">' +
          '<button type="button" class="btca-l1-pick' + (consumed ? " btca-l1-pick--consumed" : "") +
          '" data-btca-nav-pick="' + escapeHtml(item.value) + '"' + (consumed ? " disabled" : "") +
          '><span class="btca-l1-pick__icon" aria-hidden="true">🎯</span><span class="btca-l1-pick__text">Выбрать</span></button>' +
          "</div>" +
          '<div class="btca-l1-nav-card-frame">' +
          (img
            ? '<button type="button" class="btca-l1-card-image-btn" data-btca-nav-image="' + escapeHtml(item.value) +
              '"><img src="' + escapeHtml(img) + '" alt="' + escapeHtml(item.label) + '" loading="lazy"></button>'
            : '<div class="btca-l1-card-placeholder">' + escapeHtml(item.label) + "</div>") +
          "</div></div></article>";
      }).join("") +
      "</div></div></div>";

    content.querySelector("[data-btca-nav-filter]").addEventListener("click", function (event) {
      openPicker("Упражнение", exerciseOptions, filterKey, function (value) {
        state.ui.nav.exerciseFilterKey = value;
        applyUiPatch({ nav: { exerciseFilterKey: value } });
        renderNavTab(content);
        renderTitleBar();
      }, event.currentTarget);
    });
    var descBtn = content.querySelector("[data-btca-nav-desc]");
    if (descBtn) descBtn.addEventListener("click", function () {
      openExerciseImage({ exerciseValue: filterKey, title: labelForExerciseValue(filterKey) });
    });
    content.querySelectorAll("[data-btca-nav-pick]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var value = btn.getAttribute("data-btca-nav-pick");
        btn.classList.add("btca-l1-pick--consumed");
        btn.disabled = true;
        if (state.pickTimer) window.clearTimeout(state.pickTimer);
        state.pickTimer = window.setTimeout(function () {
          state.ui.exerciseValue = value;
          state.ui.nav.exerciseFilterKey = value;
          state.ui.tab = "forma";
          applyUiPatch({ exerciseValue: value, nav: { exerciseFilterKey: value }, tab: "forma" });
          renderActiveTab();
          renderTitleBar();
        }, PICK_DELAY_MS);
      });
    });
    content.querySelectorAll("[data-btca-nav-image]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var value = btn.getAttribute("data-btca-nav-image");
        if (filterIsAll) {
          state.ui.nav.exerciseFilterKey = value;
          applyUiPatch({ nav: { exerciseFilterKey: value } });
          renderNavTab(content);
          return;
        }
        openExerciseImage({ exerciseValue: value, title: labelForExerciseValue(value) });
      });
    });
  }

  function renderPolezTab(content) {
    var catalogKey = state.ui.polez.catalogKey;
    var rows = polezRowsForLevel1();
    var visible = catalogKey === POLEZ_ALL ? rows : rows.filter(function (r) { return r.key === catalogKey; });
    var catalogOptions = [{ value: POLEZ_ALL, label: "Весь список" }].concat(rows.map(function (r) {
      return { value: r.key, label: r.label };
    }));
    var catalogLabel = catalogKey === POLEZ_ALL ? "Весь список" : (rows.filter(function (r) { return r.key === catalogKey; })[0] || {}).label || "Весь список";

    content.innerHTML =
      '<div class="btca-l1-tab btca-l1-polez">' +
      '<div class="btca-l1-sticky-head">' +
      '<div class="btca-l1-toolbar btca-l1-toolbar-second">' +
      '<div class="btca-l1-polez-catalog-col">' +
      '<span class="btca-l1-field-label btca-l1-field-label--center">Каталог</span>' +
      filterFaceHtml(catalogLabel, { wide: true, dataAttr: "data-btca-polez-catalog" }) +
      "</div></div></div>" +
      '<div class="btca-l1-tab-body btca-l1-polez-cards">' +
      visible.map(function (row) {
        if (row.key === "links") {
          return '<section class="btca-l1-links-panel"><h3>Ссылки, документы, литература, видео</h3>' +
            state.data.polezLinks.map(function (line) {
              return '<a class="btca-l1-link" href="' + escapeHtml(line.href) + '" target="_blank" rel="noopener">' +
                escapeHtml(line.num + " " + line.title) + "</a>";
            }).join("") + "</section>";
        }
        var img = polezImageUrl(row.file);
        var hasDesc = row.key !== POLEZ_ALL && row.key !== "links";
        var single = catalogKey !== POLEZ_ALL;
        return '<article class="btca-l1-polez-card">' +
          '<div class="btca-l1-polez-card-inner">' +
          (single && hasDesc
            ? '<div class="btca-l1-nav-card-top">' +
              '<button type="button" class="btca-l1-pick" data-btca-polez-desc="' + escapeHtml(row.key) + '">' +
              '<span class="btca-l1-pick__icon" aria-hidden="true">📖</span>' +
              '<span class="btca-l1-pick__text">Описание</span></button></div>'
            : "") +
          '<div class="btca-l1-polez-card-frame">' +
          (img
            ? '<button type="button" class="btca-l1-card-image-btn" data-btca-polez-image="' + escapeHtml(row.key) + '">' +
              '<img src="' + escapeHtml(img) + '" alt="' + escapeHtml(row.label) + '" loading="lazy"></button>'
            : '<div class="btca-l1-card-placeholder">' + escapeHtml(row.label) + "</div>") +
          "</div></div></article>";
      }).join("") +
      "</div></div>";

    content.querySelector("[data-btca-polez-catalog]").addEventListener("click", function (event) {
      openPicker("Каталог", catalogOptions, catalogKey, function (value) {
        state.ui.polez.catalogKey = value;
        applyUiPatch({ polez: { catalogKey: value } });
        renderPolezTab(content);
      }, event.currentTarget);
    });
    content.querySelectorAll("[data-btca-polez-desc]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openPolezDescription(btn.getAttribute("data-btca-polez-desc"));
      });
    });
    content.querySelectorAll("[data-btca-polez-image]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-btca-polez-image");
        if (catalogKey === POLEZ_ALL) {
          state.ui.polez.catalogKey = key;
          applyUiPatch({ polez: { catalogKey: key } });
          renderPolezTab(content);
          return;
        }
        openPolezImage(key);
      });
    });
  }

  function exerciseImageHeaderHtml(opts) {
    opts = opts || {};
    if (opts.fromForma) {
      return '<header class="btca-l1-overlay__header btca-l1-overlay__header--forma-image btca-l1-overlay__header--compact">' +
        '<button type="button" class="btca-back-button" data-btca-overlay-close aria-label="Назад">←</button>' +
        "</header>";
    }
    return '<header class="btca-l1-overlay__header">' +
      '<button type="button" class="btca-back-button" data-btca-overlay-close aria-label="Назад">←</button>' +
      "<strong>" + escapeHtml(opts.title) + "</strong>" +
      "<span></span></header>";
  }

  function openExerciseImage(payload) {
    var url = exerciseImageUrl(payload.exerciseValue);
    if (!url) return;
    var fromForma = !!payload.fromForma;
    var overlay = document.createElement("div");
    overlay.className = "btca-l1-overlay" + (fromForma ? " btca-l1-overlay--forma-image" : "");
    overlay.innerHTML =
      exerciseImageHeaderHtml({ fromForma: fromForma, title: payload.title }) +
      '<div class="btca-l1-image-view"><img src="' + escapeHtml(url) + '" alt="' +
      escapeHtml(payload.title || "Упражнение") + '"></div>';
    state.root.appendChild(overlay);
    overlay.querySelector("[data-btca-overlay-close]").addEventListener("click", function () {
      overlay.remove();
    });
  }

  function openPolezDescription(catalogKey) {
    var desc = state.data.polezDescriptions[catalogKey];
    if (!desc) return;
    var overlay = document.createElement("div");
    overlay.className = "btca-l1-overlay btca-l1-overlay--about";
    overlay.innerHTML =
      '<header class="btca-l1-overlay__header btca-l1-overlay__header--about">' +
      '<button type="button" class="btca-back-button" data-btca-overlay-close aria-label="Назад">←</button>' +
      '<strong>Описание</strong>' +
      greenArrowHtml({ dataAttr: 'data-btca-polez-open-image aria-label="Рисунок"' }) +
      "</header>" +
      '<article class="btca-l1-about-body"><h1>' + escapeHtml(desc.title || "") + "</h1>" +
      '<div class="btca-l1-about-text">' + formatPolezBody(desc.body || "") + "</div></article>";
    state.root.appendChild(overlay);
    overlay.querySelector("[data-btca-overlay-close]").addEventListener("click", function () { overlay.remove(); });
    overlay.querySelector("[data-btca-polez-open-image]").addEventListener("click", function () {
      overlay.remove();
      openPolezImage(catalogKey);
    });
  }

  function openPolezImage(catalogKey) {
    var row = polezRowsForLevel1().filter(function (r) { return r.key === catalogKey; })[0];
    if (!row || !row.file) return;
    var url = polezImageUrl(row.file);
    var overlay = document.createElement("div");
    overlay.className = "btca-l1-overlay";
    overlay.innerHTML =
      '<header class="btca-l1-overlay__header">' +
      '<button type="button" class="btca-back-button" data-btca-overlay-close aria-label="Назад">←</button>' +
      "<strong>" + escapeHtml(row.label) + '</strong><span></span></header>' +
      '<div class="btca-l1-image-view"><img src="' + escapeHtml(url) + '" alt="' + escapeHtml(row.label) + '"></div>';
    state.root.appendChild(overlay);
    overlay.querySelector("[data-btca-overlay-close]").addEventListener("click", function () {
      overlay.remove();
    });
  }

  function formatPolezBody(body) {
    return escapeHtml(body)
      .replace(/&lt;b&gt;([\s\S]*?)&lt;\/b&gt;/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  }

  function renderActiveTab() {
    var content = state.root && state.root.querySelector("[data-btca-level1-content]");
    if (!content) return;
    if (state.ui.tab === "forma") renderFormaTab(content);
    else if (state.ui.tab === "baza") renderBazaTab(content);
    else if (state.ui.tab === "nav") renderNavTab(content);
    else renderPolezTab(content);
  }

  function renderSheetMenu(open) {
    var layer = state.root.querySelector("[data-btca-level1-menu-layer]");
    if (!layer) return;
    if (!open) { layer.setAttribute("hidden", "hidden"); return; }
    layer.removeAttribute("hidden");
    layer.innerHTML =
      '<button class="btca-level1-menu-backdrop" type="button" data-btca-level1-menu-close aria-label="Закрыть меню"></button>' +
      '<nav class="btca-level1-sheet-menu" aria-label="Меню листов">' +
      SHEETS.map(function (sheet) {
        var active = sheet.key === state.ui.tab;
        return '<button class="btca-level1-sheet-menu__item' + (active ? " btca-level1-sheet-menu__item--active" : "") +
          '" type="button" data-btca-level1-sheet="' + sheet.key + '">' + escapeHtml(sheet.label) + "</button>";
      }).join("") + "</nav>";
  }

  function setSheet(key) {
    state.ui.tab = key;
    applyUiPatch({ tab: key });
    renderSheetMenu(false);
    if (key === "baza") {
      refreshBazaContext().then(function () {
        renderActiveTab();
        renderTitleBar();
      });
    } else {
      renderActiveTab();
      renderTitleBar();
    }
  }

  function fetchJsonCached(url) {
    if ("caches" in window) {
      return caches.match(url).then(function (cached) {
        if (cached) return cached.json();
        return fetch(url).then(function (response) {
          if (!response.ok) throw new Error("Не удалось загрузить " + url);
          return response.json();
        });
      });
    }
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error("Не удалось загрузить " + url);
      return response.json();
    });
  }

  function loadData() {
    return Promise.all([
      fetchJsonCached(assetPath("level1/data/forma_exercise_list.json")),
      fetchJsonCached(assetPath("level1/data/polezCatalog.json")),
      fetchJsonCached(assetPath("level1/data/polezLinks.json")),
      fetchJsonCached(assetPath("level1/data/polezDescriptions.json")),
    ]).then(function (parts) {
      var list = parts[0];
      state.data.exercises = list.map(function (r) {
        var v = String(r.value || "").trim();
        var b5 = v.indexOf("Тест") === 0 ? v : Number(v);
        return { value: optionValueForB5(b5), label: exerciseOptionLabel(b5) };
      });
      if (!state.data.exercises.some(function (it) { return it.value === "Тест1"; })) {
        state.data.exercises.push({ value: "Тест1", label: "Тест1" });
      }
      state.data.polezCatalog = parts[1];
      state.data.polezLinks = parts[2];
      state.data.polezDescriptions = parts[3];
    });
  }

  function boot() {
    if (booted) {
      return Promise.resolve({ ui: state.ui, data: state.data });
    }
    if (bootPromise) return bootPromise;
    DB = window.BTCA_LEVEL1_DB;
    if (!DB) {
      return Promise.reject(new Error("Модуль базы данных не загружен"));
    }
    bootPromise = loadData().then(function () {
      return DB.loadUiState();
    }).then(function (ui) {
      state.ui = ui;
      return DB.warmDb ? DB.warmDb() : Promise.resolve();
    }).then(function () {
      booted = true;
      return { ui: state.ui, data: state.data };
    });
    return bootPromise;
  }

  function mount(rootEl, hooks) {
    state.root = rootEl;
    state.mounted = true;
    state.formaFlags = {};
    if (!booted) {
      return Promise.reject(new Error("Приложение ещё не завершило загрузку. Перезапустите."));
    }
    return refreshBazaContext().then(function () {
      renderTitleBar();
      renderActiveTab();
      var menuBtn = rootEl.querySelector("[data-btca-level1-menu]");
      var menuLayer = rootEl.querySelector("[data-btca-level1-menu-layer]");
      if (menuBtn) menuBtn.addEventListener("click", function () { renderSheetMenu(true); });
      if (menuLayer) {
        menuLayer.addEventListener("click", function (event) {
          if (event.target.closest("[data-btca-level1-menu-close]")) { renderSheetMenu(false); return; }
          var item = event.target.closest("[data-btca-level1-sheet]");
          if (item) setSheet(item.getAttribute("data-btca-level1-sheet"));
        });
      }
      rootEl.addEventListener("click", function (event) {
        if (event.target.closest("[data-btca-baza-menu]")) {
          state.bazaMenuOpen = true;
          renderBazaMenuLayer();
        }
      });
      if (DB.loadUserFileIdentifier) {
        DB.loadUserFileIdentifier().then(function (id) { state.bazaUserFileId = id || ""; });
      }
      renderBazaToast();
      if (hooks && hooks.onReady) hooks.onReady();
    });
  }

  function unmount() {
    if (state.pickTimer) window.clearTimeout(state.pickTimer);
    clearFormaSaveWatchdog();
    formaSaveInFlight = false;
    state.mounted = false;
    state.root = null;
  }

  window.BTCA_LEVEL1 = {
    VERSION: VERSION,
    boot: boot,
    mount: mount,
    unmount: unmount,
    setSheet: setSheet,
  };
})();
