(function () {
  "use strict";

  var DB = window.BTCA_LEVEL1_DB;
  var VERSION = "8.1.35";
  var FORMA_BANNER = "Цель - результативность не менее 70 %";
  var NAV_FILTER_ALL = "all";
  var POLEZ_ALL = "all";
  var POLEZ_HIDDEN = { fig8: 1, fig9: 1, fig10: 1, fig11: 1, fig20: 1, fig21: 1 };
  var PICK_DELAY_MS = 1500;

  var SHEETS = [
    { key: "forma", label: "Форма", title: "Форма ввода", emoji: "📊" },
    { key: "baza", label: "База", title: "База данных", emoji: "" },
    { key: "nav", label: "Упражнения", title: "Упражнения", emoji: "🔎" },
    { key: "polez", label: "Полезности", title: "Полезности", emoji: "📚" },
  ];

  var state = {
    root: null,
    ui: null,
    data: { exercises: [], polezCatalog: [], polezLinks: [], polezDescriptions: {} },
    formaFlags: {},
    bazaStats: { empty: true, fillText: "пуста" },
    bazaRows: [],
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

  function mediaUrl(packId, fileName) {
    if (!fileName) return "";
    return "/offline-unpacked/" + packId + "/" + fileName;
  }

  function exerciseImageUrl(exerciseValue) {
    var file = exerciseImageFile(1, exerciseValue);
    return file ? mediaUrl("level1/exercises", file) : "";
  }

  function polezImageUrl(file) {
    return file ? mediaUrl("level2/polez", file) : "";
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
    titlebar.innerHTML =
      '<div class="btca-level1-titlebar__row">' +
      '<div class="btca-level1-titlebar__title-group">' +
      '<span class="btca-level1-titlebar__title">' + escapeHtml(sheet.title) + "</span>" +
      (sheet.emoji ? '<span class="btca-level1-titlebar__emoji" aria-hidden="true">' + sheet.emoji + "</span>" : "") +
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

  function openPicker(title, options, current, onSelect) {
    var layer = state.root.querySelector("[data-btca-level1-picker]");
    if (!layer) return;
    layer.removeAttribute("hidden");
    layer.innerHTML =
      '<button class="btca-level1-menu-backdrop" type="button" data-btca-picker-close aria-label="Закрыть"></button>' +
      '<div class="btca-level1-picker" role="dialog" aria-label="' + escapeHtml(title) + '">' +
      '<div class="btca-level1-picker__title">' + escapeHtml(title) + "</div>" +
      '<div class="btca-level1-picker__list">' +
      options.map(function (opt) {
        var active = opt.value === current;
        return '<button type="button" class="btca-level1-picker__item' + (active ? " btca-level1-picker__item--active" : "") +
          '" data-btca-picker-value="' + escapeHtml(opt.value) + '">' + escapeHtml(opt.label) + "</button>";
      }).join("") +
      "</div></div>";
    layer.onclick = function (event) {
      if (event.target.closest("[data-btca-picker-close]")) { closePicker(); return; }
      var btn = event.target.closest("[data-btca-picker-value]");
      if (!btn) return;
      closePicker();
      onSelect(btn.getAttribute("data-btca-picker-value"));
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
    var exerciseOptions = state.data.exercises.map(function (it) {
      return { value: it.value, label: it.label };
    });

    content.innerHTML =
      '<div class="btca-l1-forma">' +
      '<div class="btca-l1-toolbar">' +
      '<div class="btca-l1-toolbar__col">' +
      '<span class="btca-l1-field-label">Дата</span>' +
      '<button type="button" class="btca-l1-face" data-btca-forma-date aria-label="Дата тренировки">' +
      '<span class="btca-l1-face__icon" aria-hidden="true">📅</span>' +
      '<span>' + escapeHtml(dateLabel) + "</span></button></div>" +
      '<button type="button" class="btca-l1-save' + (forma.canSave ? "" : " btca-l1-save--disabled") +
      '" data-btca-forma-save ' + (forma.canSave ? "" : 'disabled') + ">Записать</button></div>" +
      '<div class="btca-l1-toolbar">' +
      '<div class="btca-l1-toolbar__grow">' +
      '<span class="btca-l1-field-label">Упражнение</span>' +
      '<div class="btca-l1-exercise-row">' +
      '<button type="button" class="btca-l1-face btca-l1-face--wide" data-btca-forma-exercise>' + escapeHtml(exerciseLabel) + "</button>" +
      '<button type="button" class="btca-l1-desc-arrow" data-btca-forma-desc aria-label="Описание упражнения">›</button>' +
      "</div></div></div>" +
      '<div class="btca-l1-banner">' + escapeHtml(FORMA_BANNER) + "</div>" +
      '<div class="btca-l1-table-wrap"><table class="btca-l1-table">' +
      "<thead><tr><th>Задача</th><th>Требуемое число ударов</th><th>Число успешных ударов</th><th>%</th></tr></thead>" +
      "<tbody>" +
      forma.rows.map(function (row, idx) {
        var rowClass = !row.active || row.required === null ? "btca-l1-table__row--unused" : (idx % 2 ? "btca-l1-table__row--odd" : "btca-l1-table__row--even");
        var input = row.active && row.required !== null
          ? '<input class="btca-l1-ok-input' + (row.invalid ? " btca-l1-ok-input--invalid" : "") +
            '" type="text" inputmode="numeric" pattern="[0-9]*" data-btca-forma-ok="' + row.task +
            '" value="' + escapeHtml(row.okRaw) + '" aria-label="Успешные удары задача ' + row.task + '">'
          : '<span class="btca-l1-ok-placeholder">—</span>';
        return '<tr class="' + rowClass + '"><td>' + row.task + "</td><td>" + (row.required == null ? "—" : row.required) +
          "</td><td>" + input + "</td><td>" + escapeHtml(row.pct) + "</td></tr>";
      }).join("") +
      "</tbody></table></div></div>";

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
    content.querySelector("[data-btca-forma-exercise]").addEventListener("click", function () {
      openPicker("Упражнение", exerciseOptions, state.ui.exerciseValue, function (value) {
        state.formaFlags.suppressExerciseActive = false;
        state.formaFlags.statusOverride = null;
        state.ui.exerciseValue = value;
        state.ui.taskOk = {};
        state.ui.nav.exerciseFilterKey = value;
        DB.patchUiState({ exerciseValue: value, taskOk: {}, nav: { exerciseFilterKey: value } });
        renderFormaTab(content);
        renderTitleBar();
      });
    });
    content.querySelector("[data-btca-forma-desc]").addEventListener("click", function () {
      openExerciseImage({ exerciseValue: state.ui.exerciseValue, title: exerciseLabel, landscape: false });
    });
    var saveBtn = content.querySelector("[data-btca-forma-save]");
    if (saveBtn) saveBtn.addEventListener("click", function () { saveFormaCluster(forma); });
    content.querySelectorAll("[data-btca-forma-ok]").forEach(function (input) {
      input.addEventListener("input", function (event) {
        var task = Number(event.target.getAttribute("data-btca-forma-ok"));
        var digits = String(event.target.value || "").replace(/[^\d]/g, "");
        state.ui.taskOk[String(task)] = digits;
        state.formaFlags.suppressExerciseActive = false;
        state.formaFlags.statusOverride = null;
        DB.patchUiState({ taskOk: state.ui.taskOk });
        renderFormaTab(content);
        renderTitleBar();
        var b5 = b5FromSelectValue(state.ui.exerciseValue);
        var req = requiredStrikesFormL1(b5, task);
        if (req !== null && digits && isFormaOkValueValid(digits, req) && digits.length >= String(req).length) {
          var next = neighborActiveOkTask(task, 1, b5);
          if (next !== null) {
            var nextInput = content.querySelector('[data-btca-forma-ok="' + next + '"]');
            if (nextInput) nextInput.focus();
          }
        }
      });
    });
  }

  function openDateInput(currentIso, onPick) {
    var layer = state.root.querySelector("[data-btca-level1-picker]");
    layer.removeAttribute("hidden");
    layer.innerHTML =
      '<button class="btca-level1-menu-backdrop" type="button" data-btca-picker-close aria-label="Закрыть"></button>' +
      '<div class="btca-level1-picker btca-level1-picker--date" role="dialog" aria-label="Дата">' +
      '<div class="btca-level1-picker__title">Дата тренировки</div>' +
      '<input class="btca-l1-date-native" type="date" value="' + escapeHtml(currentIso) + '">' +
      '<button type="button" class="btca-l1-picker-done" data-btca-date-apply>Готово</button></div>';
    layer.onclick = function (event) {
      if (event.target.closest("[data-btca-picker-close]")) { closePicker(); return; }
      if (event.target.closest("[data-btca-date-apply]")) {
        var input = layer.querySelector(".btca-l1-date-native");
        if (input && input.value) onPick(input.value);
        closePicker();
      }
    };
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
      refreshBazaStats().then(function () {
        renderActiveTab();
        renderTitleBar();
      });
    });
  }

  function refreshBazaStats() {
    return DB.dbStats().then(function (stats) {
      state.bazaStats.empty = stats.empty;
      state.bazaStats.fillText = DB.bazaFillStatusText(stats.filledRows, stats.maxRows);
    });
  }

  function refreshBazaRows() {
    return DB.bazaQuery({
      from: state.ui.baza.periodFrom,
      to: state.ui.baza.periodTo,
      exercise: state.ui.baza.exercise,
      task: state.ui.baza.task,
    }).then(function (result) {
      state.bazaRows = result.rows || [];
      return result;
    });
  }

  function renderBazaTab(content) {
    var baza = state.ui.baza;
    var fromLabel = formatIsoDateAsDdMmYyyy(baza.periodFrom) || "—";
    var toLabel = formatIsoDateAsDdMmYyyy(baza.periodTo) || "—";
    var exerciseLabel = baza.exercise === "all" ? "Все" : labelForExerciseValue(baza.exercise);
    var taskLabel = baza.task === "all" ? "Все" : baza.task;
    var showChart = baza.exercise !== "all";
    var chartRows = showChart ? state.bazaRows.filter(function (r) { return r.exercise === baza.exercise; }) : [];

    content.innerHTML =
      '<div class="btca-l1-baza">' +
      '<div class="btca-l1-toolbar btca-l1-toolbar--baza">' +
      '<div class="btca-l1-toolbar__col"><span class="btca-l1-field-label">Период с</span>' +
      '<button type="button" class="btca-l1-face" data-btca-baza-from>' + escapeHtml(fromLabel) + "</button></div>" +
      '<div class="btca-l1-toolbar__col"><span class="btca-l1-field-label">по</span>' +
      '<button type="button" class="btca-l1-face" data-btca-baza-to>' + escapeHtml(toLabel) + "</button></div></div>" +
      '<div class="btca-l1-toolbar btca-l1-toolbar--baza">' +
      '<div class="btca-l1-toolbar__col"><span class="btca-l1-field-label">Упражнение</span>' +
      '<button type="button" class="btca-l1-face btca-l1-face--wide" data-btca-baza-exercise>' + escapeHtml(exerciseLabel) + "</button></div>" +
      (showChart ? '<button type="button" class="btca-l1-green-arrow" data-btca-baza-table aria-label="Таблица">›</button>' : "") +
      "</div>" +
      '<div class="btca-l1-toolbar btca-l1-toolbar--baza">' +
      '<div class="btca-l1-toolbar__col"><span class="btca-l1-field-label">Задача</span>' +
      '<button type="button" class="btca-l1-face' + (baza.exercise === "all" ? " btca-l1-face--disabled" : "") +
      '" data-btca-baza-task ' + (baza.exercise === "all" ? "disabled" : "") + ">" + escapeHtml(taskLabel) + "</button></div></div>" +
      (showChart
        ? '<section class="btca-l1-chart-panel" aria-label="Диаграмма">' +
          '<div class="btca-l1-chart-title">Упр. ' + escapeHtml(exerciseLabel) + "</div>" +
          '<div class="btca-l1-chart-bars">' +
          chartRows.map(function (row) {
            var pct = row.pct == null ? 0 : Math.max(0, Math.min(100, Number(row.pct)));
            return '<div class="btca-l1-chart-row"><span>З' + row.task + "</span>" +
              '<div class="btca-l1-chart-bar"><div style="width:' + pct + '%"></div></div>' +
              "<span>" + (row.pct == null ? "—" : row.pct + "%") + "</span></div>";
          }).join("") +
          (chartRows.length ? "" : '<p class="btca-l1-empty">Нет данных за выбранный период</p>') +
          "</div></section>"
        : '<p class="btca-l1-hint">Выберите упражнение для просмотра диаграммы.</p>') +
      "</div>";

    content.querySelector("[data-btca-baza-from]").addEventListener("click", function () {
      openDateInput(baza.periodFrom, function (iso) {
        state.ui.baza.periodFrom = iso;
        DB.patchUiState({ baza: { periodFrom: iso } });
        refreshBazaRows().then(function () { renderBazaTab(content); });
      });
    });
    content.querySelector("[data-btca-baza-to]").addEventListener("click", function () {
      openDateInput(baza.periodTo, function (iso) {
        state.ui.baza.periodTo = iso;
        DB.patchUiState({ baza: { periodTo: iso } });
        refreshBazaRows().then(function () { renderBazaTab(content); });
      });
    });
    var exerciseOptions = [{ value: "all", label: "Все" }].concat(state.data.exercises.map(function (it) {
      return { value: it.value, label: it.label };
    }));
    content.querySelector("[data-btca-baza-exercise]").addEventListener("click", function () {
      openPicker("Упражнение", exerciseOptions, baza.exercise, function (value) {
        state.ui.baza.exercise = value;
        state.ui.baza.task = "all";
        DB.patchUiState({ baza: { exercise: value, task: "all" } });
        refreshBazaRows().then(function () { renderBazaTab(content); renderTitleBar(); });
      });
    });
    var taskBtn = content.querySelector("[data-btca-baza-task]");
    if (taskBtn) taskBtn.addEventListener("click", function () {
      if (baza.exercise === "all") return;
      var tasks = [];
      var seen = {};
      state.bazaRows.forEach(function (r) {
        if (r.exercise === baza.exercise && !seen[r.task]) { seen[r.task] = true; tasks.push(r.task); }
      });
      tasks.sort(function (a, b) { return a - b; });
      var options = [{ value: "all", label: "Все" }].concat(tasks.map(function (t) { return { value: String(t), label: String(t) }; }));
      openPicker("Задача", options, baza.task, function (value) {
        state.ui.baza.task = value;
        DB.patchUiState({ baza: { task: value } });
        refreshBazaRows().then(function () { renderBazaTab(content); });
      });
    });
    var tableBtn = content.querySelector("[data-btca-baza-table]");
    if (tableBtn) tableBtn.addEventListener("click", function () { openBazaTable(); });
  }

  function openBazaTable() {
    document.body.classList.add("btca-allow-landscape");
    var overlay = document.createElement("div");
    overlay.className = "btca-l1-overlay btca-l1-overlay--landscape";
    overlay.innerHTML =
      '<header class="btca-l1-overlay__header">' +
      '<button type="button" class="btca-back-button" data-btca-overlay-close aria-label="Назад">←</button>' +
      "<strong>База данных</strong><span></span></header>" +
      '<div class="btca-l1-table-scroll"><table class="btca-l1-data-table"><thead><tr>' +
      "<th>Дата</th><th>Упр.</th><th>Задача</th><th>Треб.</th><th>Успех</th><th>%</th><th>Подх.</th></tr></thead><tbody>" +
      state.bazaRows.map(function (row) {
        return "<tr><td>" + escapeHtml(formatIsoDateAsDdMmYyyy(row.date)) + "</td><td>" + escapeHtml(row.exercise) +
          "</td><td>" + row.task + "</td><td>" + (row.req == null ? "—" : row.req) + "</td><td>" +
          (row.ok == null ? "—" : row.ok) + "</td><td>" + (row.pct == null ? "—" : row.pct + "%") +
          "</td><td>" + (row.sets == null ? "—" : row.sets) + "</td></tr>";
      }).join("") +
      "</tbody></table></div>";
    state.root.appendChild(overlay);
    overlay.querySelector("[data-btca-overlay-close]").addEventListener("click", function () {
      document.body.classList.remove("btca-allow-landscape");
      overlay.remove();
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
      '<div class="btca-l1-nav">' +
      '<div class="btca-l1-toolbar"><div class="btca-l1-toolbar__col">' +
      '<span class="btca-l1-field-label">Раздел</span>' +
      '<div class="btca-l1-face btca-l1-face--disabled">' + escapeHtml(sectionLabel) + "</div></div></div>" +
      '<div class="btca-l1-toolbar"><div class="btca-l1-toolbar__grow">' +
      '<span class="btca-l1-field-label">Упражнение</span>' +
      '<div class="btca-l1-exercise-row">' +
      '<button type="button" class="btca-l1-face btca-l1-face--wide" data-btca-nav-filter>' + escapeHtml(displayExercise) + "</button>" +
      '<button type="button" class="btca-l1-desc-arrow' + (filterIsAll ? " btca-l1-desc-arrow--disabled" : "") +
      '" data-btca-nav-desc ' + (filterIsAll ? "disabled" : "") + ' aria-label="Описание">›</button>' +
      "</div></div></div>" +
      '<div class="btca-l1-nav-cards">' +
      items.map(function (item) {
        var img = exerciseImageUrl(item.value);
        var consumed = state.ui.exerciseValue === item.value;
        return '<article class="btca-l1-nav-card">' +
          '<button type="button" class="btca-l1-pick' + (consumed ? " btca-l1-pick--consumed" : "") +
          '" data-btca-nav-pick="' + escapeHtml(item.value) + '"' + (consumed ? " disabled" : "") +
          '>🎯 Выбрать</button>' +
          (img
            ? '<button type="button" class="btca-l1-card-image-btn" data-btca-nav-image="' + escapeHtml(item.value) +
              '"><img src="' + escapeHtml(img) + '" alt="' + escapeHtml(item.label) + '" loading="lazy"></button>'
            : '<div class="btca-l1-card-placeholder">' + escapeHtml(item.label) + "</div>") +
          "</article>";
      }).join("") +
      "</div></div>";

    content.querySelector("[data-btca-nav-filter]").addEventListener("click", function () {
      openPicker("Упражнение", exerciseOptions, filterKey, function (value) {
        state.ui.nav.exerciseFilterKey = value;
        DB.patchUiState({ nav: { exerciseFilterKey: value } });
        renderNavTab(content);
        renderTitleBar();
      });
    });
    var descBtn = content.querySelector("[data-btca-nav-desc]");
    if (descBtn) descBtn.addEventListener("click", function () {
      openExerciseImage({ exerciseValue: filterKey, title: labelForExerciseValue(filterKey), landscape: true });
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
          DB.patchUiState({ exerciseValue: value, nav: { exerciseFilterKey: value }, tab: "forma" });
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
          DB.patchUiState({ nav: { exerciseFilterKey: value } });
          renderNavTab(content);
          return;
        }
        openExerciseImage({ exerciseValue: value, title: labelForExerciseValue(value), landscape: true });
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
      '<div class="btca-l1-polez">' +
      '<div class="btca-l1-toolbar"><div class="btca-l1-toolbar__grow">' +
      '<span class="btca-l1-field-label">Каталог</span>' +
      '<button type="button" class="btca-l1-face btca-l1-face--wide" data-btca-polez-catalog>' + escapeHtml(catalogLabel) + "</button>" +
      "</div></div>" +
      '<div class="btca-l1-polez-cards">' +
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
          (single && hasDesc
            ? '<button type="button" class="btca-l1-desc-tab" data-btca-polez-desc="' + escapeHtml(row.key) + '">Описание</button>'
            : "") +
          (img
            ? '<button type="button" class="btca-l1-card-image-btn" data-btca-polez-image="' + escapeHtml(row.key) + '">' +
              '<img src="' + escapeHtml(img) + '" alt="' + escapeHtml(row.label) + '" loading="lazy"></button>'
            : '<div class="btca-l1-card-placeholder">' + escapeHtml(row.label) + "</div>") +
          "</article>";
      }).join("") +
      "</div></div>";

    content.querySelector("[data-btca-polez-catalog]").addEventListener("click", function () {
      openPicker("Каталог", catalogOptions, catalogKey, function (value) {
        state.ui.polez.catalogKey = value;
        DB.patchUiState({ polez: { catalogKey: value } });
        renderPolezTab(content);
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
    var landscape = Boolean(payload.landscape);
    if (landscape) document.body.classList.add("btca-allow-landscape");
    var overlay = document.createElement("div");
    overlay.className = "btca-l1-overlay" + (landscape ? " btca-l1-overlay--landscape" : "");
    overlay.innerHTML =
      '<header class="btca-l1-overlay__header">' +
      '<button type="button" class="btca-back-button" data-btca-overlay-close aria-label="Назад">←</button>' +
      "<strong>" + escapeHtml(payload.title) + '</strong><button type="button" class="btca-l1-green-arrow" data-btca-toggle-landscape aria-label="Повернуть">›</button></header>' +
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
      "<strong>Описание</strong><button type="button" class="btca-l1-green-arrow" data-btca-polez-open-image aria-label="Рисунок">›</button></header>" +
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
    document.body.classList.add("btca-allow-landscape");
    var url = polezImageUrl(row.file);
    var overlay = document.createElement("div");
    overlay.className = "btca-l1-overlay btca-l1-overlay--landscape";
    overlay.innerHTML =
      '<header class="btca-l1-overlay__header">' +
      '<button type="button" class="btca-back-button" data-btca-overlay-close aria-label="Назад">←</button>' +
      "<strong>" + escapeHtml(row.label) + '</strong><span></span></header>' +
      '<div class="btca-l1-image-view"><img src="' + escapeHtml(url) + '" alt="' + escapeHtml(row.label) + '"></div>';
    state.root.appendChild(overlay);
    overlay.querySelector("[data-btca-overlay-close]").addEventListener("click", function () {
      document.body.classList.remove("btca-allow-landscape");
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
    DB.patchUiState({ tab: key });
    renderSheetMenu(false);
    if (key === "baza") {
      refreshBazaStats().then(function () {
        return refreshBazaRows();
      }).then(function () {
        renderActiveTab();
        renderTitleBar();
      });
    } else {
      renderActiveTab();
      renderTitleBar();
    }
  }

  function loadData() {
    return Promise.all([
      fetch("/level1/data/forma_exercise_list.json").then(function (r) { return r.json(); }),
      fetch("/level1/data/polezCatalog.json").then(function (r) { return r.json(); }),
      fetch("/level1/data/polezLinks.json").then(function (r) { return r.json(); }),
      fetch("/level1/data/polezDescriptions.json").then(function (r) { return r.json(); }),
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

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("Script load failed: " + src)); };
      document.head.appendChild(s);
    });
  }

  function ensureReady() {
    return loadScript("/level1/level1-db.js?v=" + VERSION).then(function () {
      DB = window.BTCA_LEVEL1_DB;
      return loadData();
    }).then(function () {
      return DB.loadUiState();
    });
  }

  function mount(rootEl, hooks) {
    state.root = rootEl;
    state.mounted = true;
    return ensureReady().then(function (ui) {
      state.ui = ui;
      state.formaFlags = {};
      return refreshBazaStats().then(function () {
        return refreshBazaRows();
      }).then(function () {
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
        if (hooks && hooks.onReady) hooks.onReady();
      });
    });
  }

  function unmount() {
    if (state.pickTimer) window.clearTimeout(state.pickTimer);
    state.mounted = false;
    state.root = null;
  }

  window.BTCA_LEVEL1 = {
    VERSION: VERSION,
    mount: mount,
    unmount: unmount,
    setSheet: setSheet,
  };
})();
