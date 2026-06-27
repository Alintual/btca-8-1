(function () {
  "use strict";

  var DB = window.BTCA_LEVEL2_DB;
  var BAZA = window.BTCA_LEVEL2_BAZA;
  var VERSION = "8.1.56";
  var BRANDING_UP = "branding/up.png";
  var BRANDING_BAZA = "branding/baza.png";
  var TRAILING_SLOT_W = 112;
    var NAV_FILTER_ALL = "all";
  var POLEZ_ALL = "all";
    var PICK_DELAY_MS = 1500;
  var PICKER_ROW_SIMPLE = 50;
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

  var state = {
    root: null,
    ui: null,
    data: { exercises: [], polezCatalog: [], polezLinks: [], polezDescriptions: {} },
    formaFlags: {},
    bazaStats: { empty: true, fillText: "пуста", hasOwn: false, hasForeign: false },
    bazaRows: [],
    bazaExpandedRows: [],
    bazaOwnKeys: [],
    bazaForeignKeys: [],
    bazaForeignAvailable: false,
    bazaImportLabelId: "",
    bazaOwnEmpty: true,
    bazaNoExercisesInPeriod: false,
    bazaRuleTasks: [],
    bazaMenuOpen: false,
    bazaDeleteConfirm: null,
    bazaIdentifierMode: null,
    bazaIdentifierDraft: "",
    bazaIdentifierError: "",
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


  var FORMA_LEVEL2_DEFAULT_EXERCISE = "10";
  var NAV_SECTION_FILTER_ALL = "all";
  var NAV_TRAINING_KIND_ORDER = [
    "Тренировка чужих прямых",
    "Тренировка чужих на резке",
    "Тренировка свояков",
    "Тренировка отыгрышей",
    "Тренировка выходов",
    "Тренировка одиночными",
    "Игровые тренировки",
    "Тренировочные тесты",
  ];

  function exerciseSectionNameL2(b5) {
    if (typeof b5 === "string" && b5.indexOf("Тест") === 0) return "Тренировочные тесты";
    var n = numericB5(b5);
    if (n === null || !Number.isFinite(n)) return "—";
    if (n >= 1 && n <= 5) return "Тренировка чужих прямых";
    if (n >= 6 && n <= 13) return "Тренировка чужих на резке";
    if (n >= 14 && n <= 22) return "Тренировка свояков";
    if (n === 23) return "Тренировка отыгрышей";
    if (n === 24) return "Тренировка выходов";
    if (n >= 25 && n <= 30) return "Тренировка одиночными";
    if (n >= 31 && n <= 32) return "Игровые тренировки";
    return "Тренировочные тесты";
  }

  function test5to8(b5) {
    return b5 === "Тест5" || b5 === "Тест6" || b5 === "Тест7" || b5 === "Тест8";
  }

  function tests1to7(b5) {
    return ["Тест1", "Тест2", "Тест3", "Тест4", "Тест5", "Тест6", "Тест7"].indexOf(String(b5)) >= 0;
  }

  function orC11to14(b5) {
    var n = numericB5(b5);
    if (n !== null) {
      if (n >= 12 && n <= 25) return true;
      if (n >= 26 && n <= 32) return true;
    }
    return b5 === "Тест1" || b5 === "Тест2" || b5 === "Тест3" || b5 === "Тест4" || test5to8(b5);
  }

  function orC15to16(b5) {
    var n = numericB5(b5);
    if (n === 6 || n === 7) return true;
    if (n !== null && n >= 12 && n <= 32) return true;
    return b5 === "Тест1" || b5 === "Тест2" || b5 === "Тест3" || b5 === "Тест4" || test5to8(b5);
  }

  function taskActiveFormL1(b5, task) {
    if (b5 === "" || b5 == null) return false;
    var n = numericB5(b5);
    if (n === 6 || n === 7) return task >= 1 && task <= 10;
    if (task === 1) return true;
    if (task === 2) return !(n === 25 || n === 32 || b5 === "Тест2" || b5 === "Тест8");
    if (task === 3 || task === 4) {
      return !(n === 22 || n === 23 || n === 25 || n === 28 || n === 32 || b5 === "Тест2" || b5 === "Тест8");
    }
    if (task === 5) {
      return !(
        n === 22 || n === 23 || n === 25 || n === 27 || n === 31 || n === 28 || n === 32 ||
        b5 === "Тест1" || b5 === "Тест2" || b5 === "Тест8"
      );
    }
    if (task === 6) {
      return !(
        n === 13 || n === 22 || n === 23 || n === 25 || n === 27 || n === 28 || n === 31 || n === 32 ||
        b5 === "Тест1" || b5 === "Тест2" || b5 === "Тест8"
      );
    }
    if (task === 7 || task === 8 || task === 9) return !orC11to14(b5);
    if (task === 10 || task === 11 || task === 12) return !orC15to16(b5);
    return false;
  }

  function requiredStrikesFormL1(b5, task) {
    if (!taskActiveFormL1(b5, task)) return null;
    var n = numericB5(b5);
    if (n === 6 || n === 7) return 15;
    if (task <= 2) {
      if (n === 26) return 15;
      if (n === 28) return 25;
      if (n === 32) return 40;
      if (b5 === "Тест8") return 80;
      if (tests1to7(b5)) return 30;
      return 15;
    }
    if (task >= 3 && task <= 9) {
      if (n === 26) return 15;
      if (n === 32) return 40;
      if (b5 === "Тест8") return 80;
      if (tests1to7(b5)) return 30;
      return 15;
    }
    if (task === 10) {
      if (n === 26) return 10;
      if (n === 32) return 40;
      if (b5 === "Тест8") return 80;
      if (tests1to7(b5)) return 30;
      return 15;
    }
    if (task === 11 || task === 12) {
      if (n === 26) return 15;
      if (n === 32) return 40;
      if (b5 === "Тест8") return 80;
      if (tests1to7(b5)) return 30;
      return 15;
    }
    return null;
  }

  function exerciseRulesL1(b5) {
    var requiredByTask = [];
    for (var task = 1; task <= 12; task += 1) requiredByTask.push(requiredStrikesFormL1(b5, task));
    return { requiredByTask: requiredByTask };
  }

  function activeTaskCountL2(b5) {
    var count = 0;
    for (var task = 1; task <= 12; task += 1) {
      if (taskActiveFormL1(b5, task)) count += 1;
    }
    return count;
  }

  function taskNumbersForExercise(exerciseKey) {
    var rules = exerciseRulesL1(b5FromSelectValue(exerciseKey));
    var out = [];
    for (var i = 0; i < rules.requiredByTask.length; i += 1) {
      if (rules.requiredByTask[i] != null) out.push(i + 1);
    }
    return out;
  }

  function sectionForDbKey(exerciseKey) {
    return exerciseSectionNameL2(b5FromSelectValue(exerciseKey));
  }

  function buildNavSectionOptions() {
    var opts = [{ value: NAV_SECTION_FILTER_ALL, label: "Все" }];
    var present = {};
    state.data.exercises.forEach(function (it) {
      if (it.section && it.section !== "—") present[it.section] = true;
    });
    NAV_TRAINING_KIND_ORDER.forEach(function (sec) {
      if (present[sec]) opts.push({ value: sec, label: sec });
    });
    Object.keys(present).forEach(function (sec) {
      if (NAV_TRAINING_KIND_ORDER.indexOf(sec) < 0) opts.push({ value: sec, label: sec });
    });
    return opts;
  }

  function buildNavExercisePickerOptions(sectionKey) {
    if (sectionKey !== NAV_SECTION_FILTER_ALL) {
      var scoped = [{ value: NAV_FILTER_ALL, label: "Все" }];
      state.data.exercises.forEach(function (it) {
        if (it.section === sectionKey) scoped.push({ value: it.value, label: it.label });
      });
      return scoped;
    }
    var bySection = {};
    state.data.exercises.forEach(function (it) {
      var sec = it.section || "—";
      if (!bySection[sec]) bySection[sec] = [];
      bySection[sec].push({ value: it.value, label: it.label });
    });
    var secOrder = NAV_TRAINING_KIND_ORDER.filter(function (s) { return bySection[s]; });
    var extraSections = Object.keys(bySection).filter(function (s) {
      return NAV_TRAINING_KIND_ORDER.indexOf(s) < 0;
    });
    extraSections.sort(function (a, b) { return a.localeCompare(b, "ru"); });
    extraSections.forEach(function (s) { secOrder.push(s); });
    var grouped = [{ value: NAV_FILTER_ALL, label: "Все" }];
    secOrder.forEach(function (sec) {
      grouped.push({ value: "__group:" + sec, label: sec, groupHeader: true });
      bySection[sec].forEach(function (row) { grouped.push(row); });
    });
    return grouped;
  }

  function filterNavCardItems(sectionKey, exerciseFilterKey) {
    if (exerciseFilterKey !== NAV_FILTER_ALL) {
      return state.data.exercises.filter(function (it) { return it.value === exerciseFilterKey; });
    }
    if (sectionKey !== NAV_SECTION_FILTER_ALL) {
      return state.data.exercises.filter(function (it) { return it.section === sectionKey; });
    }
    return state.data.exercises.slice();
  }

  function sectionKeyForExerciseValue(exerciseValue) {
    var sec = exerciseSectionNameL2(b5FromSelectValue(exerciseValue));
    return sec === "—" ? NAV_SECTION_FILTER_ALL : sec;
  }

  function labelForNavSection(sectionKey, options) {
    var row = options.filter(function (o) { return o.value === sectionKey; })[0];
    return row ? row.label : "Все";
  }

  function buildBazaExercisePickerOptions() {
    if (!BAZA) return [{ value: "all", label: "Все" }];
    var BAZA_ALL = BAZA.BAZA_EXERCISE_ALL;
    var GROUP_OWN = BAZA.BAZA_GROUP_OWN;
    var GROUP_FOREIGN = BAZA.BAZA_GROUP_FOREIGN;
    var ownKeys = state.bazaOwnKeys;
    var foreignKeys = state.bazaForeignKeys;
    var foreignAvailable = state.bazaForeignAvailable;
    var importId = state.bazaImportLabelId;
    var ownDbEmpty = state.bazaOwnEmpty;
    var out = [];

    function appendExerciseRows(source, keys) {
      var bySection = {};
      keys.forEach(function (key) {
        var section = sectionForDbKey(key);
        if (!section || section === "—") {
          out.push({ value: key, label: labelForExerciseValue(key), source: source });
          return;
        }
        if (!bySection[section]) bySection[section] = [];
        bySection[section].push(key);
      });
      Object.keys(bySection).forEach(function (section) {
        out.push({ value: "__section:" + source + ":" + section, label: section, groupHeader: true, sectionHeader: true });
        bySection[section].forEach(function (key) {
          out.push({ value: key, label: labelForExerciseValue(key), source: source });
        });
      });
    }

    if (ownDbEmpty) {
      out.push({ value: GROUP_OWN, label: "--- ТЕКУЩИЕ - НЕТ ДАННЫХ ---", groupHeader: true, disabledHeader: true });
    } else {
      out.push({ value: GROUP_OWN, label: "--- ТЕКУЩИЕ ---", groupHeader: true });
      out.push({ value: BAZA_ALL, label: "Все", source: "own" });
      appendExerciseRows("own", ownKeys);
    }

    if (foreignAvailable) {
      out.push({
        value: GROUP_FOREIGN,
        label: importId ? "--- ИМПОРТ ---\n" + importId : "--- ИМПОРТ ---",
        groupHeader: true,
        source: "foreign",
      });
      out.push({ value: BAZA_ALL, label: "Все", source: "foreign" });
      appendExerciseRows("foreign", foreignKeys);
    }
    return out;
  }

  function bazaExerciseFaceLabel(exercise, dataSource, disabled) {
    if (disabled) return "---";
    if (exercise === "all") return "Все";
    return labelForExerciseValue(exercise);
  }

  function isBazaExerciseSelectionValid(exercise, dataSource) {
    if (exercise === "all") return true;
    var keys = dataSource === "foreign" ? state.bazaForeignKeys : state.bazaOwnKeys;
    return keys.indexOf(exercise) >= 0;
  }

  function formaBannerText() {
    return exerciseSectionNameL2(b5FromSelectValue(state.ui.exerciseValue));
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
    saveBtn.disabled = !canSave;
    saveBtn.classList.toggle("btca-l1-save--disabled", !canSave);
    var icon = saveBtn.querySelector(".btca-l1-save__icon");
    var label = saveBtn.querySelector(".btca-l1-save__label");
    if (icon) icon.classList.toggle("btca-l1-save__icon--disabled", !canSave);
    if (label) label.classList.toggle("btca-l1-save__label--disabled", !canSave);
  }

  function syncFormaOkTableDom(content, forma) {
    forma.rows.forEach(function (row) {
      var input = content.querySelector('[data-btca-forma-ok="' + row.task + '"]');
      if (!input) return;
      if (input.value !== row.okRaw) input.value = row.okRaw;
      input.classList.toggle("btca-l1-ok-input--invalid", !!row.invalid);
      var rowEl = input.closest(".btca-l1-table-row");
      if (!rowEl) return;
      var okCell = rowEl.querySelector(".btca-l1-col--ok");
      if (okCell) okCell.classList.toggle("btca-l1-table-cell--invalid", !!row.invalid);
      var pctCell = rowEl.querySelector(".btca-l1-col--pct .btca-l1-td");
      if (pctCell) pctCell.textContent = row.pct;
    });
    syncFormaSaveButton(content, forma.canSave);
  }

  function scrollFormaOkRowIntoView(content, task) {
    var scroll = content.querySelector("[data-btca-forma-table-scroll]");
    var input = content.querySelector('[data-btca-forma-ok="' + task + '"]');
    if (!scroll || !input) return;
    var rowEl = input.closest(".btca-l1-table-row");
    if (!rowEl) return;
    scroll.scrollTop = Math.max(0, rowEl.offsetTop - 16);
  }

  function focusFormaOkInput(input) {
    if (!input) return;
    input.type = "tel";
    input.setAttribute("inputmode", "numeric");
    input.setAttribute("pattern", "[0-9]*");
    input.focus({ preventScroll: true });
    try {
      var len = input.value.length;
      input.setSelectionRange(len, len);
    } catch (e) {}
  }

  function finishOrAdvanceFormaOkTask(content, task) {
    var b5 = b5FromSelectValue(state.ui.exerciseValue);
    var req = requiredStrikesFormL1(b5, task);
    var digits = state.ui.taskOk[String(task)] || "";
    if (!isFormaOkValueValid(digits, req)) return;
    var next = neighborActiveOkTask(task, 1, b5);
    if (next !== null) {
      var nextInput = content.querySelector('[data-btca-forma-ok="' + next + '"]');
      if (nextInput) {
        focusFormaOkInput(nextInput);
        scrollFormaOkRowIntoView(content, next);
      }
      return;
    }
    content.querySelectorAll("[data-btca-forma-ok]").forEach(function (el) { el.blur(); });
    var scroll = content.querySelector("[data-btca-forma-table-scroll]");
    if (scroll) scroll.scrollTop = 0;
  }

  function wireFormaOkInputs(content) {
    content.querySelectorAll("[data-btca-forma-ok]").forEach(function (input) {
      input.addEventListener("input", function (event) {
        var task = Number(event.target.getAttribute("data-btca-forma-ok"));
        var digits = String(event.target.value || "").replace(/[^\d]/g, "");
        if (event.target.value !== digits) event.target.value = digits;
        state.ui.taskOk[String(task)] = digits;
        state.formaFlags.suppressExerciseActive = false;
        state.formaFlags.statusOverride = null;
        DB.patchUiState({ taskOk: state.ui.taskOk });
        var forma = computeFormaRows();
        state.formaFlags.invalidData = !forma.allActiveOkAreEmptyOrValid;
        syncFormaOkTableDom(content, forma);
        renderTitleBar();
        var b5 = b5FromSelectValue(state.ui.exerciseValue);
        var req = requiredStrikesFormL1(b5, task);
        if (req !== null && digits && isFormaOkValueValid(digits, req) && digits.length >= String(req).length) {
          requestAnimationFrame(function () {
            finishOrAdvanceFormaOkTask(content, task);
          });
        }
      });
      input.addEventListener("keydown", function (event) {
        if (event.key !== "Enter") return;
        event.preventDefault();
        finishOrAdvanceFormaOkTask(content, Number(event.target.getAttribute("data-btca-forma-ok")));
      });
      input.addEventListener("focus", function (event) {
        focusFormaOkInput(event.target);
        scrollFormaOkRowIntoView(content, Number(event.target.getAttribute("data-btca-forma-ok")));
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
    if (level === 2) {
      if (k.indexOf("Тест") === 0) {
        var tm = /^Тест(\d+)$/.exec(k);
        if (tm && Number(tm[1]) >= 1 && Number(tm[1]) <= 8) return "test_" + tm[1] + ".jpg";
        return null;
      }
      var n2 = Number(k);
      if (Number.isInteger(n2) && n2 >= 1 && n2 <= 32) return n2 + ".jpg";
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
    var file = exerciseImageFile(2, exerciseValue);
    return file ? mediaUrl("level2/exercises", file) : "";
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
      '" ' + dataAttr + (canSave ? "" : " disabled") + ">" +
      '<img class="btca-l1-save__icon' + (canSave ? "" : " btca-l1-save__icon--disabled") +
      '" src="' + escapeHtml(brandingUrl(BRANDING_BAZA)) + '" alt="" draggable="false">' +
      '<span class="btca-l1-save__label' + (canSave ? "" : " btca-l1-save__label--disabled") +
      '">Записать</span></button>';
  }

  function formaTableHeadHtml(b5) {
    var count = activeTaskCountL2(b5);
    return '<div class="btca-l1-table-head"><div class="btca-l1-table-row">' +
      '<div class="btca-l1-table-cell btca-l1-col--task"><span class="btca-l1-th">Задача (' + count + ")</span></div>" +
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

  function getBazaChartTitle(exercise, exerciseFilterDisabled) {
    var showChart = !exerciseFilterDisabled && exercise !== "all" && String(exercise || "").trim() !== "";
    return {
      text: showChart ? "Успешные удары по упражнению за период" : "Нет данных по упражнению",
      showChart: showChart,
      arrowDisabled: exerciseFilterDisabled || !showChart,
    };
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

  function pickerOptionRowHeight(opt, rowHeight) {
    if (opt && opt.groupHeader) return PICKER_ROW_GROUP;
    return rowHeight || PICKER_ROW_SIMPLE;
  }

  function indexInPickerOptions(options, currentValue) {
    var v = String(currentValue || "").trim();
    if (!v) return -1;
    var i;
    for (i = 0; i < options.length; i += 1) {
      if (!options[i].groupHeader && options[i].value === v) return i;
    }
    return -1;
  }

  function pickerScrollOffset(options, index, viewportHeight, rowHeight) {
    if (index < 0 || index >= options.length || viewportHeight <= 0) return 0;
    var offset = PICKER_LIST_PAD;
    var i;
    for (i = 0; i < index; i += 1) offset += pickerOptionRowHeight(options[i], rowHeight);
    var length = pickerOptionRowHeight(options[index], rowHeight);
    var contentHeight = PICKER_LIST_PAD * 2;
    for (i = 0; i < options.length; i += 1) contentHeight += pickerOptionRowHeight(options[i], rowHeight);
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
    return state.data.polezCatalog.slice();
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
    var titlebar = state.root && state.root.querySelector("[data-btca-level2-titlebar]");
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
    var layer = state.root && state.root.querySelector("[data-btca-level2-picker]");
    if (layer) layer.setAttribute("hidden", "hidden");
  }

  function openPicker(title, options, current, onSelect, anchorEl, pickerOpts) {
    pickerOpts = pickerOpts || {};
    var layer = state.root.querySelector("[data-btca-level2-picker]");
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
        return '<button type="button" class="btca-level1-picker__item' + itemExtraClass +
          (active ? " btca-level1-picker__item--active" : "") +
          '" data-btca-picker-value="' + escapeHtml(opt.value) + '">' + escapeHtml(opt.label) + "</button>";
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
      if (value.indexOf("__group_") === 0) return;
      closePicker();
      onSelect(value);
    };
  }

  function computeFormaRows() {
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
    var forma = computeFormaRows();
    state.formaFlags.invalidData = !forma.allActiveOkAreEmptyOrValid;
    var dateLabel = formatIsoDateAsDdMmYyyy(state.ui.trainingDate) || state.ui.trainingDate;
    var exerciseLabel = labelForExerciseValue(state.ui.exerciseValue);
    var exerciseOptions = buildNavExercisePickerOptions(NAV_SECTION_FILTER_ALL).filter(function (o) {
      return o.value !== NAV_FILTER_ALL;
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
      '<div class="btca-l1-banner">' + escapeHtml(formaBannerText()) + "</div></div>" +
      '<div class="btca-l1-tab-body btca-l1-forma-body">' +
      '<div class="btca-l1-table-area"><div class="btca-l1-table-wrap">' +
      formaTableHeadHtml(b5FromSelectValue(state.ui.exerciseValue)) +
      '<div class="btca-l1-table-scroll" data-btca-forma-table-scroll><div class="btca-l1-table-body">' +
      forma.rows.map(function (row, idx) {
        var rowClass = !row.active || row.required === null ? "btca-l1-table__row--unused" : (idx % 2 ? "btca-l1-table__row--odd" : "btca-l1-table__row--even");
        var nextOk = row.active && row.required !== null ? neighborActiveOkTask(row.task, 1, b5) : null;
        var input = row.active && row.required !== null
          ? '<input class="btca-l1-ok-input' + (row.invalid ? " btca-l1-ok-input--invalid" : "") +
            '" type="tel" inputmode="numeric" pattern="[0-9]*" autocomplete="off" autocorrect="off" spellcheck="false"' +
            ' enterkeyhint="' + (nextOk !== null ? "next" : "done") +
            '" data-btca-forma-ok="' + row.task +
            '" value="' + escapeHtml(row.okRaw) + '" aria-label="Успешные удары задача ' + row.task + '">'
          : "";
        return '<div class="btca-l1-table-row ' + rowClass + '">' +
          '<div class="btca-l1-table-cell btca-l1-col--task"><span class="btca-l1-td' +
          (!row.active ? " btca-l1-td--muted" : " btca-l1-td--task") + '">' +
          (row.active ? String(row.task) : "") + "</span></div>" +
          '<div class="btca-l1-table-cell btca-l1-col--req"><span class="btca-l1-td' +
          (!row.active ? " btca-l1-td--muted" : "") + '">' +
          (row.required == null ? "" : String(row.required)) + "</span></div>" +
          '<div class="btca-l1-table-cell btca-l1-col--ok' + (row.invalid ? " btca-l1-table-cell--invalid" : "") +
          (!row.active ? " btca-l1-table-cell--unused" : "") + '">' + input + "</div>" +
          '<div class="btca-l1-table-cell btca-l1-col--pct"><span class="btca-l1-td' +
          (!row.active ? " btca-l1-td--muted" : "") + '">' + escapeHtml(row.pct) + "</span></div></div>";
      }).join("") +
      "</div></div></div></div></div></div>";

    content.querySelector("[data-btca-forma-date]").addEventListener("click", function () {
      openDateInput(state.ui.trainingDate, function (iso) {
        state.formaFlags.suppressExerciseActive = false;
        state.formaFlags.statusOverride = null;
        state.ui.trainingDate = iso;
        DB.patchUiState({ trainingDate: iso });
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
        state.ui.nav.sectionKey = sectionKeyForExerciseValue(value);
        DB.patchUiState({ exerciseValue: value, taskOk: {}, nav: { exerciseFilterKey: value, sectionKey: state.ui.nav.sectionKey } });
        renderFormaTab(content);
        renderTitleBar();
      }, event.currentTarget);
    });
    content.querySelector("[data-btca-forma-desc]").addEventListener("click", function () {
      openExerciseImage({ exerciseValue: state.ui.exerciseValue, title: exerciseLabel });
    });
    var saveBtn = content.querySelector("[data-btca-forma-save]");
    if (saveBtn) saveBtn.addEventListener("click", function () { saveFormaCluster(forma); });
    wireFormaOkInputs(content);
  }

  function openDateInput(currentIso, onPick, title) {
    if (typeof window.__BTCA_OPEN_DATE_INPUT__ === "function") {
      window.__BTCA_OPEN_DATE_INPUT__(currentIso, onPick, title);
    }
  }

  function saveFormaCluster(forma) {
    if (!forma.canSave) return;
    DB.dbCapacity(state.ui.trainingDate, state.ui.exerciseValue).then(function (cap) {
      if (Number(cap.freeRows) < Number(cap.neededRows)) {
        state.formaFlags.statusOverride = { text: "БД будет переполнена", tone: "error" };
        renderTitleBar();
        return null;
      }
      var b5 = b5FromSelectValue(state.ui.exerciseValue);
      var rules = exerciseRulesL1(b5);
      var rows = [];
      for (var task = 1; task <= 12; task += 1) {
        var req = rules.requiredByTask[task - 1];
        var okRaw = state.ui.taskOk[String(task)] || "";
        var okParsed = parseNonNegativeInt(okRaw);
        var ok = okParsed === null || Number.isNaN(okParsed) ? null : Number(okParsed);
        rows.push({ task: task, req: req === null ? null : Number(req), ok: ok });
      }
      return DB.saveCluster({ date: state.ui.trainingDate, exercise: state.ui.exerciseValue, rows: rows });
    }).then(function (res) {
      if (!res) return;
      if (!res.ok) {
        state.formaFlags.statusOverride = { text: "Ошибка записи", tone: "error" };
        renderTitleBar();
        return;
      }
      state.ui.taskOk = {};
      state.ui.baza.periodFrom = state.ui.trainingDate;
      state.ui.baza.periodTo = state.ui.trainingDate;
      state.ui.baza.exercise = state.ui.exerciseValue;
      state.ui.baza.task = "all";
      DB.patchUiState({
        taskOk: {},
        baza: { periodFrom: state.ui.trainingDate, periodTo: state.ui.trainingDate, exercise: state.ui.exerciseValue, task: "all" },
      });
      state.formaFlags.suppressExerciseActive = true;
      state.formaFlags.statusOverride = { text: "Данные записаны!", tone: "active" };
      window.setTimeout(function () {
        state.formaFlags.statusOverride = null;
        renderTitleBar();
      }, 5000);
      refreshBazaContext().then(function () {
        renderActiveTab();
        renderTitleBar();
      });
    });
  }

  function refreshBazaStats() {
    return DB.combinedDbStats().then(function (stats) {
      state.bazaStats.empty = stats.empty;
      state.bazaStats.hasOwn = (stats.ownRows || 0) > 0;
      state.bazaStats.hasForeign = (stats.foreignRows || 0) > 0;
      state.bazaStats.fillText = stats.empty ? "пуста" : DB.bazaFillStatusText(stats.filledRows, stats.maxRows);
      state.bazaOwnEmpty = (stats.ownRows || 0) <= 0;
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
      DB.hasForeignDatabase(),
      DB.loadImportFileIdentifier(),
      DB.loadUserFileIdentifier(),
      DB.bazaQuery({ from: from, to: to, exercise: "all", task: "all" }),
    ]).then(function (parts) {
      var ownStats = parts[0];
      var foreignAvailable = parts[2];
      state.bazaForeignAvailable = foreignAvailable;
      state.bazaImportLabelId = parts[3] || "";
      state.bazaUserFileId = parts[4] || "";
      state.bazaOwnKeys = parts[5].exercises || [];
      state.bazaOwnEmpty = Number(ownStats.totalRows || 0) <= 0;

      return (foreignAvailable
        ? DB.foreignBazaQuery({ exercise: "all", task: "all" })
        : Promise.resolve({ exercises: [] })
      ).then(function (foreignRes) {
        state.bazaForeignKeys = foreignRes.exercises || [];
        var src = baza.dataSource === "foreign" ? "foreign" : "own";
        var ex = baza.exercise;
        var tk = baza.task;

        if (!foreignAvailable && src === "foreign") {
          src = "own";
          ex = "all";
        }
        if (state.bazaOwnEmpty && foreignAvailable && ex === "all" && src === "own") {
          src = "foreign";
        }
        if (ex !== "all" && !isBazaExerciseSelectionValid(ex, src)) {
          if (state.bazaOwnEmpty && foreignAvailable) {
            src = "foreign";
            ex = "all";
          } else {
            ex = "all";
          }
          tk = "all";
        }

        var hasAny = state.bazaOwnKeys.length > 0 || (foreignAvailable && state.bazaForeignKeys.length > 0);
        state.bazaNoExercisesInPeriod = !hasAny;
        if (src !== baza.dataSource || ex !== baza.exercise || tk !== baza.task) {
          state.ui.baza.dataSource = src;
          state.ui.baza.exercise = ex;
          state.ui.baza.task = tk;
          DB.patchUiState({ baza: { dataSource: src, exercise: ex, task: tk } });
        }

        if (!hasAny) {
          state.bazaRuleTasks = [];
          state.bazaRows = [];
          state.bazaExpandedRows = [];
          return;
        }

        if (ex !== "all") {
          state.bazaRuleTasks = taskNumbersForExercise(ex);
          if (tk !== "all" && state.bazaRuleTasks.indexOf(Number(tk)) < 0) {
            state.ui.baza.task = "all";
            DB.patchUiState({ baza: { task: "all" } });
            tk = "all";
          }
        } else {
          state.bazaRuleTasks = [];
          if (tk !== "all") {
            state.ui.baza.task = "all";
            DB.patchUiState({ baza: { task: "all" } });
          }
        }

        return refreshBazaRows();
      });
    });
  }

  function refreshBazaRows() {
    var baza = state.ui.baza;
    var queryEx = baza.exercise;
    var src = baza.dataSource === "foreign" ? "foreign" : "own";
    return DB.bazaQueryForSource(src, {
      from: baza.periodFrom,
      to: baza.periodTo,
      exercise: queryEx,
      task: baza.task === "all" ? "all" : baza.task,
    }).then(function (result) {
      state.bazaRows = result.rows || [];
      if (!BAZA || queryEx === "all") {
        state.bazaExpandedRows = [];
        return result;
      }
      state.bazaExpandedRows = BAZA.expandBazaRows(
        state.bazaRows,
        queryEx,
        exerciseRulesL1,
        b5FromSelectValue
      );
      return result;
    });
  }

  function renderBazaDiagramHtml() {
    if (!BAZA || !state.bazaExpandedRows.length) return '<p class="btca-l1-empty">Нет данных за выбранный период</p>';
    var baza = state.ui.baza;
    var panel = contentElForMeasure();
    var width = panel ? Math.max(280, panel.clientWidth - 16) : 320;
    var height = Math.max(220, Math.round(window.innerHeight * 0.38));
    var allowed = taskNumbersForExercise(baza.exercise);
    var render = BAZA.buildBazaDiagramRender(state.bazaExpandedRows, allowed, baza.task, width, height);
    return '<div class="btca-l2-diagram-wrap" data-btca-baza-diagram-capture>' + BAZA.renderBazaDiagramSvg(render) + "</div>";
  }

  function contentElForMeasure() {
    return state.root && state.root.querySelector("[data-btca-level2-content]");
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
    var host = state.root && state.root.querySelector("[data-btca-level2-baza-toast]");
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
    var chartMeta = getBazaChartTitle(state.ui.baza.exercise, bazaFiltersDisabled());
    return {
      canExport: !state.bazaStats.empty,
      canImport: !state.bazaStats.hasForeign && !state.bazaForeignAvailable,
      canDeleteOwn: state.bazaStats.hasOwn,
      canDeleteForeign: state.bazaStats.hasForeign,
      canScreenshot: chartMeta.showChart && state.bazaExpandedRows.length > 0,
    };
  }

  function bazaFiltersDisabled() {
    var baza = state.ui.baza;
    var src = baza.dataSource === "foreign" ? "foreign" : "own";
    return (src === "own" && state.bazaOwnEmpty) || (src === "foreign" && !state.bazaForeignAvailable);
  }

  function renderBazaMenuLayer() {
    var layer = state.root && state.root.querySelector("[data-btca-level2-baza-menu-layer]");
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
      '<button type="button" class="btca-l1-baza-sheet-menu__item' + (caps.canExport ? "" : " btca-l1-baza-sheet-menu__item--disabled") +
      '" data-btca-baza-action="export"><span class="btca-l2-baza-menu__icon btca-l2-baza-menu__icon--export" aria-hidden="true">↑</span><span>Экспорт</span></button>' +
      '<button type="button" class="btca-l1-baza-sheet-menu__item' + (caps.canImport ? "" : " btca-l1-baza-sheet-menu__item--disabled") +
      '" data-btca-baza-action="import"><span class="btca-l2-baza-menu__icon btca-l2-baza-menu__icon--import" aria-hidden="true">↓</span><span>Импорт</span></button>' +
      '<div class="btca-l2-baza-menu__delete-branch">' +
      '<button type="button" class="btca-l1-baza-sheet-menu__item' +
      ((caps.canDeleteOwn || caps.canDeleteForeign) ? "" : " btca-l1-baza-sheet-menu__item--disabled") +
      '" data-btca-baza-delete-toggle><span class="btca-l2-baza-menu__icon" aria-hidden="true">🔴</span><span>Удалить данные</span><span class="btca-l2-baza-menu__chevron" aria-hidden="true"></span></button>' +
      '<div class="btca-l2-baza-menu__sub" data-btca-baza-delete-sub hidden>' +
      '<button type="button" class="btca-l1-baza-sheet-menu__item btca-l2-baza-menu__sub-item' + (caps.canDeleteOwn ? "" : " btca-l1-baza-sheet-menu__item--disabled") +
      '" data-btca-baza-action="deleteOwn"><span class="btca-l2-baza-menu__dot btca-l2-baza-menu__dot--own"></span><span>Текущие</span></button>' +
      '<button type="button" class="btca-l1-baza-sheet-menu__item btca-l2-baza-menu__sub-item' + (caps.canDeleteForeign ? "" : " btca-l1-baza-sheet-menu__item--disabled") +
      '" data-btca-baza-action="deleteForeign"><span class="btca-l2-baza-menu__dot btca-l2-baza-menu__dot--import"></span><span>По импорту</span></button>' +
      "</div></div>" +
      '<button type="button" class="btca-l1-baza-sheet-menu__item' + (caps.canScreenshot ? "" : " btca-l1-baza-sheet-menu__item--disabled") +
      '" data-btca-baza-action="screenshot"><span class="btca-l2-baza-menu__icon btca-l2-baza-menu__icon--shot" aria-hidden="true">📷</span><span>Скриншот</span></button>' +
      "</nav>";
    layer.onclick = function (event) {
      if (event.target.closest("[data-btca-baza-menu-close]")) {
        state.bazaMenuOpen = false;
        renderBazaMenuLayer();
        return;
      }
      if (event.target.closest("[data-btca-baza-delete-toggle]")) {
        var sub = layer.querySelector("[data-btca-baza-delete-sub]");
        if (sub) sub.toggleAttribute("hidden");
        return;
      }
      var btn = event.target.closest("[data-btca-baza-action]");
      if (!btn || btn.classList.contains("btca-l1-baza-sheet-menu__item--disabled")) return;
      handleBazaMenuAction(btn.getAttribute("data-btca-baza-action"));
    };
  }

  function openBazaIdentifierDialog(mode) {
    state.bazaIdentifierMode = mode;
    state.bazaIdentifierDraft = state.bazaUserFileId || "";
    state.bazaIdentifierError = "";
    renderBazaIdentifierDialog();
  }

  function renderBazaIdentifierDialog() {
    var layer = state.root && state.root.querySelector("[data-btca-level2-baza-id-layer]");
    if (!layer) return;
    if (!state.bazaIdentifierMode) {
      layer.setAttribute("hidden", "hidden");
      layer.innerHTML = "";
      return;
    }
    var title = state.bazaIdentifierMode === "export" ? "Экспорт базы" :
      state.bazaIdentifierMode === "import" ? "Импорт базы" : "Скриншот диаграммы";
    layer.removeAttribute("hidden");
    layer.innerHTML =
      '<button class="btca-level1-menu-backdrop" type="button" data-btca-baza-id-close aria-label="Закрыть"></button>' +
      '<div class="btca-l2-baza-id-dialog" role="dialog">' +
      "<h3>" + escapeHtml(title) + "</h3>" +
      (state.bazaIdentifierMode === "import"
        ? '<p class="btca-l2-baza-id-hint">Выберите файл резервной копии BTCA (JSON).</p>'
        : '<label class="btca-l2-baza-id-label">Идентификатор<input class="btca-l2-baza-id-input" type="text" value="' +
          escapeHtml(state.bazaIdentifierDraft) + '" placeholder="Идентификатор анг..." maxlength="32"></label>') +
      (state.bazaIdentifierError
        ? '<p class="btca-l2-baza-id-error">' + escapeHtml(state.bazaIdentifierError) + "</p>" : "") +
      '<div class="btca-l2-baza-id-actions">' +
      '<button type="button" class="btca-l2-baza-id-btn" data-btca-baza-id-cancel>Отмена</button>' +
      '<button type="button" class="btca-l2-baza-id-btn btca-l2-baza-id-btn--primary" data-btca-baza-id-confirm>' +
      (state.bazaIdentifierMode === "import" ? "Выбрать файл" : "Продолжить") + "</button></div></div>";
    layer.onclick = function (event) {
      if (event.target.closest("[data-btca-baza-id-close]") || event.target.closest("[data-btca-baza-id-cancel]")) {
        state.bazaIdentifierMode = null;
        renderBazaIdentifierDialog();
        return;
      }
      if (!event.target.closest("[data-btca-baza-id-confirm]")) return;
      if (state.bazaIdentifierMode === "import") {
        state.bazaIdentifierMode = null;
        renderBazaIdentifierDialog();
        runBazaImportPick();
        return;
      }
      var input = layer.querySelector(".btca-l2-baza-id-input");
      var id = state.bazaUserFileId;
      if (!id && input) {
        var validation = validateBazaIdentifierInput(input.value);
        if (!validation.ok) {
          state.bazaIdentifierError = validation.error;
          renderBazaIdentifierDialog();
          return;
        }
        id = validation.value;
      }
      var mode = state.bazaIdentifierMode;
      state.bazaIdentifierMode = null;
      renderBazaIdentifierDialog();
      if (mode === "export") runBazaExport(id);
      else if (mode === "screenshot") runBazaScreenshot(id);
    };
  }

  function runBazaExport(userId) {
    DB.exportBazaBackup(userId).then(function (result) {
      if (!result.ok) {
        showBazaToast("Не удалось экспортировать.", "#E53935");
        return;
      }
      if (userId && !state.bazaUserFileId) {
        return DB.saveUserFileIdentifier(userId).then(function () {
          state.bazaUserFileId = userId;
          return result;
        });
      }
      return result;
    }).then(function (result) {
      if (!result || !result.ok) return;
      var blob = new Blob([JSON.stringify(result.payload, null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = result.fileName || "BTCA_L2_backup.json";
      a.click();
      URL.revokeObjectURL(url);
      state.bazaMenuOpen = false;
      renderBazaMenuLayer();
      showBazaToast("Успех!");
    }).catch(function () {
      showBazaToast("Не удалось экспортировать.", "#E53935");
    });
  }

  function runBazaImportPick() {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      document.body.removeChild(input);
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var payload = JSON.parse(String(reader.result || ""));
          DB.importBazaBackupObject(payload).then(function (res) {
            if (!res.ok) {
              showBazaToast("Неверный формат файла.", "#E53935");
              return;
            }
            state.bazaMenuOpen = false;
            renderBazaMenuLayer();
            return refreshBazaContext();
          }).then(function () {
            renderActiveTab();
            renderTitleBar();
            showBazaToast("Успех!");
          }).catch(function () {
            showBazaToast("Не удалось импортировать.", "#E53935");
          });
        } catch (_) {
          showBazaToast("Неверный формат файла.", "#E53935");
        }
      };
      reader.readAsText(file, "utf-8");
    });
    input.click();
  }

  function runBazaScreenshot(userId) {
    var svgWrap = state.root && state.root.querySelector("[data-btca-baza-diagram-capture] svg");
    if (!svgWrap) {
      showBazaToast("Нет диаграммы для сохранения.", "#E53935");
      return;
    }
    var saveId = function () {
      if (userId && !state.bazaUserFileId) {
        return DB.saveUserFileIdentifier(userId).then(function () {
          state.bazaUserFileId = userId;
        });
      }
      return Promise.resolve();
    };
    saveId().then(function () {
      var svgData = new XMLSerializer().serializeToString(svgWrap);
      var canvas = document.createElement("canvas");
      var ctx = canvas.getContext("2d");
      var img = new Image();
      var blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      img.onload = function () {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.fillStyle = "#c5d9dc";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(function (pngBlob) {
          URL.revokeObjectURL(url);
          if (!pngBlob) {
            showBazaToast("Не удалось сохранить скриншот.", "#E53935");
            return;
          }
          var id = userId || state.bazaUserFileId || "screenshot";
          var baza = state.ui.baza;
          var a = document.createElement("a");
          a.href = URL.createObjectURL(pngBlob);
          a.download = "BTCA_L2_" + id + "_" + baza.exercise + "_" + baza.periodFrom + ".png";
          a.click();
          state.bazaMenuOpen = false;
          renderBazaMenuLayer();
          showBazaToast("Успех!");
        }, "image/png");
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        showBazaToast("Не удалось сохранить скриншот.", "#E53935");
      };
      img.src = url;
    });
  }

  function openBazaDeleteConfirm(target) {
    state.bazaDeleteConfirm = target;
    renderBazaDeleteConfirm();
  }

  function renderBazaDeleteConfirm() {
    var layer = state.root && state.root.querySelector("[data-btca-level2-baza-delete-layer]");
    if (!layer) return;
    if (!state.bazaDeleteConfirm) {
      layer.setAttribute("hidden", "hidden");
      layer.innerHTML = "";
      return;
    }
    var own = state.bazaDeleteConfirm === "own";
    layer.removeAttribute("hidden");
    layer.innerHTML =
      '<button class="btca-level1-menu-backdrop" type="button" data-btca-baza-del-close aria-label="Закрыть"></button>' +
      '<div class="btca-l2-baza-id-dialog" role="dialog">' +
      "<h3>Удалить данные?</h3>" +
      "<p>" + (own ? "Будут удалены текущие записи по выбранным фильтрам." : "Будет удалена импортированная база целиком.") + "</p>" +
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
      var target = state.bazaDeleteConfirm;
      state.bazaDeleteConfirm = null;
      renderBazaDeleteConfirm();
      runBazaDelete(target);
    };
  }

  function runBazaDelete(target) {
    var baza = state.ui.baza;
    var promise = target === "foreign"
      ? DB.clearForeignDatabase().then(function () { return DB.clearImportFileIdentifier(); })
      : DB.bazaDeleteCurrentByFilters({
        from: baza.periodFrom,
        to: baza.periodTo,
        exercise: baza.exercise,
        task: baza.task,
      });
    promise.then(function () {
      state.bazaMenuOpen = false;
      renderBazaMenuLayer();
      if (target === "foreign" && baza.dataSource === "foreign") {
        state.ui.baza.dataSource = "own";
        state.ui.baza.exercise = "all";
        DB.patchUiState({ baza: { dataSource: "own", exercise: "all", task: "all" } });
      }
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
    if (action === "export" && caps.canExport) {
      openBazaIdentifierDialog("export");
      return;
    }
    if (action === "import" && caps.canImport) {
      openBazaIdentifierDialog("import");
      return;
    }
    if (action === "screenshot" && caps.canScreenshot) {
      openBazaIdentifierDialog("screenshot");
      return;
    }
    if (action === "deleteOwn" && caps.canDeleteOwn) {
      state.bazaMenuOpen = false;
      renderBazaMenuLayer();
      openBazaDeleteConfirm("own");
      return;
    }
    if (action === "deleteForeign" && caps.canDeleteForeign) {
      state.bazaMenuOpen = false;
      renderBazaMenuLayer();
      openBazaDeleteConfirm("foreign");
    }
  }

  function onPickBazaExercise(item) {
    if (!item || item.groupHeader || item.disabled || item.disabledHeader) return;
    if (BAZA && (item.value === BAZA.BAZA_GROUP_OWN || item.value === BAZA.BAZA_GROUP_FOREIGN)) return;
    if (item.value === "all") {
      state.ui.baza.dataSource = item.source === "foreign" ? "foreign" : "own";
      state.ui.baza.exercise = "all";
      state.ui.baza.task = "all";
      DB.patchUiState({ baza: { dataSource: state.ui.baza.dataSource, exercise: "all", task: "all" } });
      return refreshBazaContext().then(function () {
        renderActiveTab();
        renderTitleBar();
      });
    }
    var nextSource = item.source || (state.bazaForeignKeys.indexOf(item.value) >= 0 ? "foreign" : "own");
    state.ui.baza.dataSource = nextSource;
    state.ui.baza.exercise = item.value;
    state.ui.baza.task = "all";
    DB.patchUiState({ baza: { dataSource: nextSource, exercise: item.value, task: "all" } });
    return refreshBazaRows().then(function () {
      renderActiveTab();
      renderTitleBar();
    });
  }

  function renderBazaTab(content) {
    var baza = state.ui.baza;
    var periodDisabled = bazaFiltersDisabled();
    var exerciseDisabled = periodDisabled || state.bazaNoExercisesInPeriod;
    var taskFilterEmpty = exerciseDisabled;
    var fromLabel = periodDisabled ? "---" : (formatIsoDateAsDdMmYyyy(baza.periodFrom) || "—");
    var toLabel = periodDisabled ? "---" : (formatIsoDateAsDdMmYyyy(baza.periodTo) || "—");
    var exerciseLabel = bazaExerciseFaceLabel(baza.exercise, baza.dataSource, exerciseDisabled);
    var taskLabel = taskFilterEmpty || baza.exercise === "all" ? (taskFilterEmpty ? "---" : "Все") : (baza.task === "all" ? "Все" : baza.task);
    var taskDisabled = taskFilterEmpty || baza.exercise === "all";
    var chartMeta = getBazaChartTitle(baza.exercise, exerciseDisabled);
    var diagramHtml = chartMeta.showChart ? renderBazaDiagramHtml() : "";

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
        ? '<section class="btca-l1-chart-panel btca-l2-chart-panel" aria-label="Диаграмма">' + diagramHtml + "</section>"
        : "") +
      "</div></div>";

    if (!periodDisabled) {
      content.querySelector("[data-btca-baza-from]").addEventListener("click", function () {
        openDateInput(baza.periodFrom, function (iso) {
          state.ui.baza.periodFrom = iso;
          DB.patchUiState({ baza: { periodFrom: iso } });
          refreshBazaContext().then(function () { renderBazaTab(content); renderTitleBar(); });
        }, "Период с");
      });
      content.querySelector("[data-btca-baza-to]").addEventListener("click", function () {
        openDateInput(baza.periodTo, function (iso) {
          state.ui.baza.periodTo = iso;
          DB.patchUiState({ baza: { periodTo: iso } });
          refreshBazaContext().then(function () { renderBazaTab(content); renderTitleBar(); });
        }, "Период по");
      });
    }
    if (!exerciseDisabled) {
      var exerciseOptions = buildBazaExercisePickerOptions();
      var pickerValue = baza.exercise;
      content.querySelector("[data-btca-baza-exercise]").addEventListener("click", function (event) {
        openPicker("Упражнение", exerciseOptions, pickerValue, function (value) {
          var item = exerciseOptions.filter(function (o) { return o.value === value; })[0];
          onPickBazaExercise(item || { value: value, source: baza.dataSource });
        }, event.currentTarget, { rowHeight: PICKER_ROW_SIMPLE, itemClass: " btca-level1-picker__item--baza" });
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
          DB.patchUiState({ baza: { task: value } });
          refreshBazaRows().then(function () { renderBazaTab(content); });
        }, event.currentTarget);
      });
    }
    var tableBtn = content.querySelector("[data-btca-baza-table]");
    if (tableBtn && !chartMeta.arrowDisabled) tableBtn.addEventListener("click", function () { openBazaTable(); });
  }

  function openBazaTable() {
    var rows = state.bazaExpandedRows.length ? state.bazaExpandedRows : state.bazaRows;
    var overlay = document.createElement("div");
    overlay.className = "btca-l1-overlay btca-l1-overlay--baza-table";
    overlay.innerHTML =
      '<header class="btca-l1-overlay__header">' +
      '<button type="button" class="btca-back-button" data-btca-overlay-close aria-label="Назад">←</button>' +
      "<strong>База данных</strong><span></span></header>" +
      '<div class="btca-l1-baza-table-wrap">' +
      '<div class="btca-l1-baza-table-head"><div class="btca-l1-baza-table-row">' +
      '<div class="btca-l1-baza-col btca-l1-baza-col--date"><span>Дата</span></div>' +
      '<div class="btca-l1-baza-col btca-l1-baza-col--ex"><span>Упр.</span></div>' +
      '<div class="btca-l1-baza-col btca-l1-baza-col--task"><span>Задача</span></div>' +
      '<div class="btca-l1-baza-col btca-l1-baza-col--req"><span>Треб.</span></div>' +
      '<div class="btca-l1-baza-col btca-l1-baza-col--ok"><span>Успех</span></div>' +
      '<div class="btca-l1-baza-col btca-l1-baza-col--pct"><span>%</span></div>' +
      "</div></div>" +
      '<div class="btca-l1-baza-table-scroll"><div class="btca-l1-baza-table-body">' +
      rows.map(function (row) {
        var exKey = row.exerciseKey || row.exercise;
        var reqText = BAZA
          ? BAZA.formatBazaReqCell(exerciseRulesL1, b5FromSelectValue, exKey, row.task, row.ok, row.sets)
          : (row.req == null ? "—" : String(row.req));
        if (!reqText && row.req != null) reqText = String(row.req);
        if (!reqText) reqText = "—";
        return '<div class="btca-l1-baza-table-row' + (row.clusterFirst === false ? " btca-l1-baza-table-row--cluster" : "") + '">' +
          '<div class="btca-l1-baza-col btca-l1-baza-col--date"><span>' +
          escapeHtml(row.date ? formatIsoDateAsDdMmYyyy(row.date) : "") + "</span></div>" +
          '<div class="btca-l1-baza-col btca-l1-baza-col--ex"><span>' + escapeHtml(row.exercise || "") + "</span></div>" +
          '<div class="btca-l1-baza-col btca-l1-baza-col--task"><span>' + row.task + "</span></div>" +
          '<div class="btca-l1-baza-col btca-l1-baza-col--req"><span>' + escapeHtml(reqText) + "</span></div>" +
          '<div class="btca-l1-baza-col btca-l1-baza-col--ok"><span>' + (row.ok == null ? "—" : row.ok) + "</span></div>" +
          '<div class="btca-l1-baza-col btca-l1-baza-col--pct"><span>' + (row.pct == null ? "—" : row.pct + "%") + "</span></div></div>";
      }).join("") +
      "</div></div></div>";
    state.root.appendChild(overlay);
    overlay.querySelector("[data-btca-overlay-close]").addEventListener("click", function () {
      overlay.remove();
    });
  }

  function renderNavTab(content) {
    var sectionKey = state.ui.nav.sectionKey || NAV_SECTION_FILTER_ALL;
    var filterKey = state.ui.nav.exerciseFilterKey || NAV_FILTER_ALL;
    var sectionOptions = buildNavSectionOptions();
    var sectionLabel = labelForNavSection(sectionKey, sectionOptions);
    var filterIsAll = filterKey === NAV_FILTER_ALL;
    var displayExercise = filterIsAll ? "Все" : labelForExerciseValue(filterKey);
    var items = filterNavCardItems(sectionKey, filterKey);
    var exerciseOptions = buildNavExercisePickerOptions(sectionKey);

    content.innerHTML =
      '<div class="btca-l1-tab btca-l1-nav">' +
      '<div class="btca-l1-sticky-head">' +
      '<div class="btca-l1-toolbar btca-l1-toolbar-second">' +
      '<div class="btca-l1-nav-section">' +
      '<span class="btca-l1-field-label">Раздел</span>' +
      filterFaceHtml(sectionLabel, { wide: true, extraClass: "btca-l1-face--section", dataAttr: "data-btca-nav-section" }) +
      "</div></div>" +
      '<div class="btca-l1-toolbar btca-l1-toolbar-second">' +
      '<div class="btca-l1-exercise-row">' +
      '<div class="btca-l1-exercise-col">' +
      '<span class="btca-l1-field-label">Упражнение</span>' +
      filterFaceHtml(displayExercise, { wide: true, dataAttr: "data-btca-nav-filter" }) +
      "</div>" +
      '<div class="btca-l1-trailing-slot">' +
      greenArrowHtml({ disabled: filterIsAll, dataAttr: 'data-btca-nav-desc aria-label="Описание"' }) +
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

    content.querySelector("[data-btca-nav-section]").addEventListener("click", function (event) {
      openPicker("Раздел", sectionOptions, sectionKey, function (value) {
        state.ui.nav.sectionKey = value;
        state.ui.nav.exerciseFilterKey = NAV_FILTER_ALL;
        DB.patchUiState({ nav: { sectionKey: value, exerciseFilterKey: NAV_FILTER_ALL } });
        renderNavTab(content);
        renderTitleBar();
      }, event.currentTarget);
    });
    content.querySelector("[data-btca-nav-filter]").addEventListener("click", function (event) {
      openPicker("Упражнение", exerciseOptions, filterKey, function (value) {
        state.ui.nav.exerciseFilterKey = value;
        DB.patchUiState({ nav: { exerciseFilterKey: value } });
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
          var sec = sectionKeyForExerciseValue(value);
          state.ui.exerciseValue = value;
          state.ui.nav.sectionKey = sec;
          state.ui.nav.exerciseFilterKey = value;
          state.ui.tab = "forma";
          DB.patchUiState({ exerciseValue: value, nav: { sectionKey: sec, exerciseFilterKey: value }, tab: "forma" });
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
          state.ui.nav.sectionKey = sectionKeyForExerciseValue(value);
          DB.patchUiState({ nav: { exerciseFilterKey: value, sectionKey: state.ui.nav.sectionKey } });
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
        DB.patchUiState({ polez: { catalogKey: value } });
        renderPolezTab(content);
      }, event.currentTarget, {
        rowHeight: PICKER_ROW_GROUP,
        itemClass: " btca-level1-picker__item--catalog",
      });
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
          DB.patchUiState({ polez: { catalogKey: key } });
          renderPolezTab(content);
          return;
        }
        openPolezImage(key);
      });
    });
  }

  function openExerciseImage(payload) {
    var url = exerciseImageUrl(payload.exerciseValue);
    if (!url) return;
    var overlay = document.createElement("div");
    overlay.className = "btca-l1-overlay";
    overlay.innerHTML =
      '<header class="btca-l1-overlay__header">' +
      '<button type="button" class="btca-back-button" data-btca-overlay-close aria-label="Назад">←</button>' +
      "<strong>" + escapeHtml(payload.title) + "</strong>" +
      greenArrowHtml({ dataAttr: 'data-btca-toggle-landscape aria-label="Повернуть"' }) +
      "</header>" +
      '<div class="btca-l1-image-view"><img src="' + escapeHtml(url) + '" alt="' + escapeHtml(payload.title) + '"></div>';
    state.root.appendChild(overlay);
    function close() {
      document.body.classList.remove("btca-allow-landscape");
      overlay.remove();
    }
    overlay.querySelector("[data-btca-overlay-close]").addEventListener("click", close);
    overlay.querySelector("[data-btca-toggle-landscape]").addEventListener("click", function () {
      document.body.classList.add("btca-allow-landscape");
      overlay.classList.add("btca-l1-overlay--landscape");
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
    var content = state.root && state.root.querySelector("[data-btca-level2-content]");
    if (!content) return;
    if (state.ui.tab === "forma") renderFormaTab(content);
    else if (state.ui.tab === "baza") renderBazaTab(content);
    else if (state.ui.tab === "nav") renderNavTab(content);
    else renderPolezTab(content);
  }

  function renderSheetMenu(open) {
    var layer = state.root.querySelector("[data-btca-level2-menu-layer]");
    if (!layer) return;
    if (!open) { layer.setAttribute("hidden", "hidden"); return; }
    layer.removeAttribute("hidden");
    layer.innerHTML =
      '<button class="btca-level1-menu-backdrop" type="button" data-btca-level2-menu-close aria-label="Закрыть меню"></button>' +
      '<nav class="btca-level1-sheet-menu" aria-label="Меню листов">' +
      SHEETS.map(function (sheet) {
        var active = sheet.key === state.ui.tab;
        return '<button class="btca-level1-sheet-menu__item' + (active ? " btca-level1-sheet-menu__item--active" : "") +
          '" type="button" data-btca-level2-sheet="' + sheet.key + '">' + escapeHtml(sheet.label) + "</button>";
      }).join("") + "</nav>";
  }

  function setSheet(key) {
    state.ui.tab = key;
    DB.patchUiState({ tab: key });
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
      fetchJsonCached(assetPath("level2/data/forma_exercise_list.json")),
      fetchJsonCached(assetPath("level2/data/polezCatalog.json")),
      fetchJsonCached(assetPath("level2/data/polezLinks.json")),
      fetchJsonCached(assetPath("level2/data/polezDescriptions.json")),
    ]).then(function (parts) {
      var list = parts[0];
      state.data.exercises = list.map(function (r) {
        var v = String(r.value || "").trim();
        var b5 = v.indexOf("Тест") === 0 ? v : Number(v);
        return {
          value: optionValueForB5(b5),
          label: exerciseOptionLabel(b5),
          section: exerciseSectionNameL2(b5),
        };
      });
      if (!state.data.exercises.some(function (it) { return it.value === "Тест1"; })) {
        state.data.exercises.push({
          value: "Тест1",
          label: "Тест1",
          section: exerciseSectionNameL2("Тест1"),
        });
      }
      state.data.polezCatalog = parts[1];
      state.data.polezLinks = parts[2];
      state.data.polezDescriptions = parts[3];
    });
  }

  function boot() {
    if (booted) return Promise.resolve({ ui: state.ui, data: state.data });
    if (bootPromise) return bootPromise;
    DB = window.BTCA_LEVEL2_DB;
    if (!DB) {
      return Promise.reject(new Error("Модуль базы данных не загружен"));
    }
    bootPromise = loadData().then(function () {
      return DB.loadUiState();
    }).then(function (ui) {
      state.ui = ui;
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
      var menuBtn = rootEl.querySelector("[data-btca-level2-menu]");
      var menuLayer = rootEl.querySelector("[data-btca-level2-menu-layer]");
      if (menuBtn) menuBtn.addEventListener("click", function () { renderSheetMenu(true); });
      if (menuLayer) {
        menuLayer.addEventListener("click", function (event) {
          if (event.target.closest("[data-btca-level2-menu-close]")) { renderSheetMenu(false); return; }
          var item = event.target.closest("[data-btca-level2-sheet]");
          if (item) setSheet(item.getAttribute("data-btca-level2-sheet"));
        });
      }
      rootEl.addEventListener("click", function (event) {
        if (event.target.closest("[data-btca-baza-menu]")) {
          state.bazaMenuOpen = true;
          renderBazaMenuLayer();
        }
      });
      renderBazaToast();
      if (hooks && hooks.onReady) hooks.onReady();
    });
  }

  function unmount() {
    if (state.pickTimer) window.clearTimeout(state.pickTimer);
    state.mounted = false;
    state.root = null;
  }

  window.BTCA_LEVEL2 = {
    VERSION: VERSION,
    boot: boot,
    mount: mount,
    unmount: unmount,
    setSheet: setSheet,
  };
})();
