(function () {
  "use strict";

  var BAZA_TASK_COLORS = {
    1: "#368079", 2: "#EC0F3E", 3: "#2B77DD", 4: "#19CA19", 5: "#C88A76", 6: "#FD6C8B",
    7: "#918E8E", 8: "#ECD32B", 9: "#3D3D3D", 10: "#D545FF", 11: "#3BD5E3", 12: "#7A5A49",
  };

  var BAZA_DIAGRAM_MAX_FULL_DATE_LABELS = 8;
  var BAZA_DIAGRAM_AXIS_FONT_SIZE = 17;
  var FORMA_TEXT = "#111827";
  var POINT_R = 3.5;

  function bazaTaskColor(task) {
    return BAZA_TASK_COLORS[task] || FORMA_TEXT;
  }

  function clampBazaPct(v) {
    return Math.min(100, Math.max(0, v));
  }

  function formatIsoDateForDiagramAxis(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").trim());
    if (!m) return null;
    var mon3 = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
    var monthNum = Number(m[2]);
    if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) return null;
    return String(Number(m[3])) + " " + mon3[monthNum - 1];
  }

  function buildBazaDiagramRender(expanded, allowedTaskNums, activeTask, width, height) {
    if (width < 32 || height < 32) return null;

    var byDateTask = new Map();
    var curDate = "";
    expanded.forEach(function (r) {
      var dRaw = String(r.date || "");
      if (dRaw) curDate = dRaw;
      if (!curDate) return;
      var t = Number(r.task);
      if (!Number.isFinite(t)) return;
      if (!byDateTask.has(curDate)) byDateTask.set(curDate, new Map());
      var p = r.pct;
      byDateTask.get(curDate).set(t, p == null ? null : Number(p));
    });

    var dates = Array.from(byDateTask.keys()).sort();
    var chartTaskNums = allowedTaskNums.filter(function (n) {
      return Number.isInteger(n) && n >= 1 && n <= 12;
    }).sort(function (a, b) { return a - b; });
    var legendTasks = chartTaskNums.slice();
    if (activeTask !== "all") {
      var one = Number(activeTask);
      if (Number.isInteger(one) && one >= 1 && one <= 12) {
        chartTaskNums = [one];
        legendTasks = legendTasks.filter(function (n) { return n === one; });
        if (!legendTasks.length) legendTasks = [one];
      }
    }

    var padL = 52;
    var padR = 10;
    var padT = 20;
    var padB = dates.length > BAZA_DIAGRAM_MAX_FULL_DATE_LABELS
      ? 52
      : Math.max(52, 40 + Math.ceil(dates.length * 1.6));
    var plotW = Math.max(1, width - padL - padR);
    var plotH = Math.max(1, height - padT - padB);
    var axisY = padT + plotH;
    var yPx = function (pct) { return padT + plotH * (1 - clampBazaPct(pct) / 100); };
    var xPx = function (idx) {
      return padL + (dates.length <= 1 ? plotW / 2 : (plotW * idx) / (dates.length - 1));
    };

    var gridLines = [];
    for (var g = 0; g <= 100; g += 5) {
      var y = yPx(g);
      var major = g % 10 === 0;
      gridLines.push({
        y: y,
        major: major,
        label: major && g !== 0 ? (g === 100 ? "100%" : String(g)) : undefined,
      });
    }

    var xTickDown = 6;
    var xLabelGapBelowTick = 5;
    var labelY = axisY + xTickDown + xLabelGapBelowTick;
    var sparse = dates.length > BAZA_DIAGRAM_MAX_FULL_DATE_LABELS;
    var xTicks = [];
    var xLabels = [];
    for (var i = 0; i < dates.length; i += 1) {
      var xi = xPx(i);
      xTicks.push({ x: xi });
      if (!sparse || i === 0 || i === dates.length - 1) {
        xLabels.push({
          x: xi,
          y: labelY,
          label: formatIsoDateForDiagramAxis(dates[i]) || dates[i],
        });
      }
    }

    var series = [];
    chartTaskNums.forEach(function (task) {
      var points = [];
      for (var di = 0; di < dates.length; di += 1) {
        var raw = byDateTask.get(dates[di]).get(task);
        if (raw == null || !Number.isFinite(raw)) continue;
        points.push({ x: xPx(di), y: yPx(raw) });
      }
      series.push({ task: task, color: bazaTaskColor(task), points: points });
    });

    return {
      width: width,
      height: height,
      padL: padL,
      padT: padT,
      plotW: plotW,
      plotH: plotH,
      axisY: axisY,
      gridLines: gridLines,
      xTicks: xTicks,
      xLabels: xLabels,
      series: series,
      legendTasks: legendTasks,
    };
  }

  function renderBazaDiagramSvg(render) {
    if (!render) return "";
    var parts = [];
    parts.push(
      '<svg class="btca-baza-diagram" width="' + render.width + '" height="' + render.height + '" ' +
      'viewBox="0 0 ' + render.width + " " + render.height + '" role="img" aria-label="Диаграмма успешности">'
    );
    parts.push('<rect width="100%" height="100%" fill="#c5d9dc"/>');

    render.gridLines.forEach(function (gl, idx) {
      parts.push(
        '<line x1="' + render.padL + '" y1="' + gl.y + '" x2="' + (render.padL + render.plotW) + '" y2="' + gl.y + '" ' +
        'stroke="' + (gl.major ? "rgba(17,24,39,0.26)" : "rgba(17,24,39,0.12)") + '" ' +
        'stroke-width="' + (gl.major ? "1" : "0.75") + '"/>'
      );
      if (gl.label) {
        parts.push(
          '<text x="' + (render.padL - 8) + '" y="' + (gl.y + 5) + '" fill="' + FORMA_TEXT + '" ' +
          'font-size="' + BAZA_DIAGRAM_AXIS_FONT_SIZE + '" font-weight="400" text-anchor="end">' +
          gl.label + "</text>"
        );
      }
    });

    parts.push(
      '<line x1="' + render.padL + '" y1="' + render.padT + '" x2="' + render.padL + '" y2="' + render.axisY + '" ' +
      'stroke="rgba(17,24,39,0.35)" stroke-width="1"/>'
    );
    parts.push(
      '<line x1="' + render.padL + '" y1="' + render.axisY + '" x2="' + (render.padL + render.plotW) + '" y2="' + render.axisY + '" ' +
      'stroke="rgba(17,24,39,0.35)" stroke-width="1"/>'
    );

    render.xTicks.forEach(function (xt, idx) {
      parts.push(
        '<line x1="' + xt.x + '" y1="' + render.axisY + '" x2="' + xt.x + '" y2="' + (render.axisY + 6) + '" ' +
        'stroke="rgba(17,24,39,0.35)" stroke-width="1"/>'
      );
    });

    render.xLabels.forEach(function (xl, idx) {
      parts.push(
        '<text x="' + xl.x + '" y="' + xl.y + '" fill="' + FORMA_TEXT + '" ' +
        'font-size="' + BAZA_DIAGRAM_AXIS_FONT_SIZE + '" font-weight="400" text-anchor="end" ' +
        'transform="rotate(-45 ' + xl.x + " " + xl.y + ')">' +
        xl.label + "</text>"
      );
    });

    render.series.forEach(function (s) {
      if (s.points.length >= 2) {
        var d = "M" + s.points.map(function (p) { return p.x + " " + p.y; }).join(" L");
        parts.push(
          '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="2" ' +
          'stroke-linejoin="round" stroke-linecap="round"/>'
        );
      }
      s.points.forEach(function (p, pi) {
        parts.push(
          '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + POINT_R + '" fill="' + s.color + '" ' +
          'stroke="' + s.color + '" stroke-width="1"/>'
        );
      });
    });

    parts.push("</svg>");
    return parts.join("");
  }

  function renderBazaDiagramLegendHtml(render) {
    if (!render || !render.legendTasks.length) return "";
    return (
      '<div class="btca-baza-diagram-legend" aria-label="Легенда задач">' +
      render.legendTasks.map(function (n) {
        return (
          '<div class="btca-baza-diagram-legend__item">' +
          '<span class="btca-baza-diagram-legend__num">' + n + "</span>" +
          '<span class="btca-baza-diagram-legend__swatch" style="background-color:' + bazaTaskColor(n) + '"></span>' +
          "</div>"
        );
      }).join("") +
      "</div>"
    );
  }

  function renderBazaDiagramPanelHtml(hasRows) {
    if (!hasRows) {
      return '<p class="btca-l1-empty">Нет данных за выбранный период</p>';
    }
    return (
      '<section class="btca-l1-chart-panel btca-l2-chart-panel" aria-label="Диаграмма">' +
      '<div class="btca-baza-diagram-root" data-btca-baza-diagram-capture>' +
      '<div class="btca-baza-diagram-plot">' +
      '<div class="btca-baza-diagram-plot-area" data-btca-baza-diagram-measure></div>' +
      "</div>" +
      '<div class="btca-baza-diagram-legend-host" data-btca-baza-diagram-legend></div>' +
      "</div></section>"
    );
  }

  function measureDiagramSize(measureEl, fallbackWidth) {
    var width = measureEl ? measureEl.clientWidth : 0;
    var height = measureEl ? measureEl.clientHeight : 0;
    if (width < 32) width = Math.max(280, fallbackWidth || 320);
    if (height < 32) height = Math.max(220, Math.round(window.innerHeight * 0.38));
    return { width: width, height: height };
  }

  function mountBazaDiagram(rootEl, expanded, allowedTaskNums, activeTask, fallbackWidth) {
    if (!rootEl) return;
    var measureEl = rootEl.querySelector("[data-btca-baza-diagram-measure]");
    var legendEl = rootEl.querySelector("[data-btca-baza-diagram-legend]");
    if (!measureEl) return;
    var size = measureDiagramSize(measureEl, fallbackWidth);
    var render = buildBazaDiagramRender(expanded, allowedTaskNums, activeTask, size.width, size.height);
    measureEl.innerHTML = renderBazaDiagramSvg(render);
    if (legendEl) legendEl.innerHTML = renderBazaDiagramLegendHtml(render);
  }

  window.BTCA_BAZA_DIAGRAM = {
    buildBazaDiagramRender: buildBazaDiagramRender,
    renderBazaDiagramSvg: renderBazaDiagramSvg,
    renderBazaDiagramLegendHtml: renderBazaDiagramLegendHtml,
    renderBazaDiagramPanelHtml: renderBazaDiagramPanelHtml,
    mountBazaDiagram: mountBazaDiagram,
    bazaTaskColor: bazaTaskColor,
    BAZA_DIAGRAM_AXIS_FONT_SIZE: BAZA_DIAGRAM_AXIS_FONT_SIZE,
  };
})();
