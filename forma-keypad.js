(function () {
  "use strict";

  var activeTask = null;

  function okCellHtml(row) {
    if (!row.active || row.required === null) return "";
    return '<button type="button" class="btca-l1-ok-cell' +
      (row.invalid ? " btca-l1-ok-input--invalid" : "") +
      '" data-btca-forma-ok-cell="' + row.task + '" aria-label="Успешные удары задача ' + row.task + '">' +
      '<span class="btca-l1-ok-cell__text" data-btca-forma-ok-display>' +
      String(row.okRaw || "") + "</span></button>";
  }

  function keypadMarkup() {
    return '<input type="tel" inputmode="numeric" pattern="[0-9]*" autocomplete="off" autocorrect="off"' +
      ' spellcheck="false" enterkeyhint="next" class="btca-l1-ok-input btca-l1-forma-keypad"' +
      ' data-btca-forma-keypad aria-hidden="true" tabindex="-1">';
  }

  function okCellEl(content, task) {
    return content.querySelector('[data-btca-forma-ok-cell="' + task + '"]');
  }

  function positionKeypad(content, task) {
    var cell = okCellEl(content, task);
    var keypad = content.querySelector("[data-btca-forma-keypad]");
    if (!cell || !keypad) return;
    var rect = cell.getBoundingClientRect();
    keypad.style.left = Math.round(rect.left) + "px";
    keypad.style.top = Math.round(rect.top) + "px";
    keypad.style.width = Math.round(rect.width) + "px";
    keypad.style.height = Math.round(rect.height) + "px";
    keypad.removeAttribute("aria-hidden");
  }

  function setActiveCell(content, task) {
    content.querySelectorAll("[data-btca-forma-ok-cell]").forEach(function (cell) {
      var cellTask = Number(cell.getAttribute("data-btca-forma-ok-cell"));
      cell.classList.toggle("btca-l1-ok-cell--active", cellTask === task);
    });
  }

  function syncRowDom(content, row) {
    var cell = okCellEl(content, row.task);
    if (!cell) return;
    var display = cell.querySelector("[data-btca-forma-ok-display]");
    if (display) display.textContent = row.okRaw || "";
    cell.classList.toggle("btca-l1-ok-input--invalid", !!row.invalid);
    var rowEl = cell.closest(".btca-l1-table-row");
    if (!rowEl) return;
    var okCol = rowEl.querySelector(".btca-l1-col--ok");
    if (okCol) okCol.classList.toggle("btca-l1-table-cell--invalid", !!row.invalid);
    var pctCell = rowEl.querySelector(".btca-l1-col--pct .btca-l1-td");
    if (pctCell) pctCell.textContent = row.pct || "";
  }

  function syncTableDom(content, forma, api) {
    forma.rows.forEach(function (row) { syncRowDom(content, row); });
    if (api && api.syncFormaSaveButton) api.syncFormaSaveButton(content, forma);
  }

  function deactivateKeypad(content) {
    activeTask = null;
    var keypad = content.querySelector("[data-btca-forma-keypad]");
    if (keypad) {
      keypad.blur();
      keypad.setAttribute("aria-hidden", "true");
    }
    if (content) setActiveCell(content, -1);
  }

  function focusKeypad(keypad) {
    if (!keypad) return;
    keypad.type = "tel";
    keypad.setAttribute("inputmode", "numeric");
    keypad.setAttribute("pattern", "[0-9]*");
    keypad.focus({ preventScroll: true });
    try {
      var len = keypad.value.length;
      keypad.setSelectionRange(len, len);
    } catch (e) {}
  }

  function activateKeypad(content, task, api) {
    var keypad = content.querySelector("[data-btca-forma-keypad]");
    if (!keypad) return;
    activeTask = task;
    keypad.value = api.getTaskOk()[String(task)] || "";
    var b5 = api.b5FromSelectValue(api.getExerciseValue());
    var next = api.neighborActiveOkTask(task, 1, b5);
    keypad.setAttribute("enterkeyhint", next !== null ? "next" : "done");
    api.scrollRowIntoView(content, task);
    positionKeypad(content, task);
    setActiveCell(content, task);
    focusKeypad(keypad);
  }

  function advanceKeypad(content, task, api) {
    var b5 = api.b5FromSelectValue(api.getExerciseValue());
    var req = api.requiredStrikes(b5, task);
    var digits = api.getTaskOk()[String(task)] || "";
    if (!api.isFormaOkValueValid(digits, req)) return;
    var next = api.neighborActiveOkTask(task, 1, b5);
    if (next !== null) {
      activateKeypad(content, next, api);
      return;
    }
    deactivateKeypad(content);
    var scroll = content.querySelector("[data-btca-forma-table-scroll]");
    if (scroll) scroll.scrollTop = 0;
  }

  function wire(content, api) {
    var keypad = content.querySelector("[data-btca-forma-keypad]");
    if (!keypad) return;

    deactivateKeypad(content);

    content.querySelectorAll("[data-btca-forma-ok-cell]").forEach(function (cell) {
      cell.addEventListener("click", function () {
        var task = Number(cell.getAttribute("data-btca-forma-ok-cell"));
        activateKeypad(content, task, api);
      });
    });

    keypad.addEventListener("input", function () {
      var task = activeTask;
      if (!task) return;
      var digits = String(keypad.value || "").replace(/[^\d]/g, "");
      if (keypad.value !== digits) keypad.value = digits;
      api.setTaskOk(task, digits);
      var forma = api.computeFormaRows();
      if (api.onFormaEdit) api.onFormaEdit(forma);
      syncTableDom(content, forma, api);
      api.renderTitleBar();
      positionKeypad(content, task);
      var b5 = api.b5FromSelectValue(api.getExerciseValue());
      var req = api.requiredStrikes(b5, task);
      if (req !== null && digits && api.isFormaOkValueValid(digits, req) && digits.length >= String(req).length) {
        advanceKeypad(content, task, api);
      }
    });

    keypad.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" || !activeTask) return;
      event.preventDefault();
      advanceKeypad(content, activeTask, api);
    });

    var scroll = content.querySelector("[data-btca-forma-table-scroll]");
    if (scroll) {
      scroll.addEventListener("scroll", function () {
        if (activeTask) positionKeypad(content, activeTask);
      });
    }

    if (!keypad._btcaFormaKeypadResize) {
      keypad._btcaFormaKeypadResize = true;
      window.addEventListener("resize", function () {
        if (!activeTask) return;
        var root = keypad.closest("[data-btca-level1-content], [data-btca-level2-content]");
        if (root) positionKeypad(root, activeTask);
      });
    }
  }

  window.BTCA_FORMA_KEYPAD = {
    okCellHtml: okCellHtml,
    keypadMarkup: keypadMarkup,
    wire: wire,
    syncTableDom: syncTableDom,
    deactivate: deactivateKeypad,
  };
})();
