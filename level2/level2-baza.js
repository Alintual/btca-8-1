(function () {
  "use strict";

  var BAZA_TASK_COLORS = {
    1: "#368079", 2: "#EC0F3E", 3: "#2B77DD", 4: "#19CA19", 5: "#C88A76", 6: "#FD6C8B",
    7: "#918E8E", 8: "#ECD32B", 9: "#3D3D3D", 10: "#D545FF", 11: "#3BD5E3", 12: "#7A5A49",
  };

  var BAZA_DIAGRAM_MAX_FULL_DATE_LABELS = 8;

  function bazaTaskColor(task) {
    return BAZA_TASK_COLORS[task] || "#111827";
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

  function expandBazaRows(rawRows, exerciseFilter, exerciseRulesFn, b5FromValueFn) {
    function exerciseRulesForKey(exerciseKey) {
      return exerciseRulesFn(b5FromValueFn(exerciseKey));
    }

    function allowedTaskNumbers(exerciseKey) {
      var rules = exerciseRulesForKey(exerciseKey);
      var out = [];
      for (var i = 0; i < rules.requiredByTask.length; i += 1) {
        if (rules.requiredByTask[i] != null) out.push(i + 1);
      }
      return out;
    }

    function pushClusterRows(out, dateIso, exerciseKey, byTask, allowedTasks, rules) {
      var first = true;
      allowedTasks.forEach(function (t) {
        var r = byTask.get(t);
        var reqFromRule = rules.requiredByTask[t - 1];
        out.push({
          date: first ? dateIso : "",
          exercise: first ? exerciseKey : "",
          exerciseKey: exerciseKey,
          task: t,
          req: r && r.req != null ? r.req : (reqFromRule == null ? null : Number(reqFromRule)),
          ok: r && r.ok != null ? r.ok : null,
          pct: r && r.pct != null ? r.pct : null,
          sets: r && r.sets != null ? r.sets : null,
          clusterFirst: first,
        });
        first = false;
      });
    }

    if (exerciseFilter === "all") {
      var byDateExercise = new Map();
      rawRows.forEach(function (r) {
        var d = String(r.date || "");
        var ex = String(r.exercise || "");
        var t = Number(r.task || 0);
        if (!d || !ex || !Number.isFinite(t)) return;
        if (!byDateExercise.has(d)) byDateExercise.set(d, new Map());
        var byEx = byDateExercise.get(d);
        if (!byEx.has(ex)) byEx.set(ex, new Map());
        byEx.get(ex).set(t, r);
      });
      var outAll = [];
      Array.from(byDateExercise.keys()).sort().forEach(function (d) {
        var byEx = byDateExercise.get(d) || new Map();
        Array.from(byEx.keys()).sort().forEach(function (ex) {
          var byTask = byEx.get(ex) || new Map();
          var rules = exerciseRulesForKey(ex);
          pushClusterRows(outAll, d, ex, byTask, allowedTaskNumbers(ex), rules);
        });
      });
      return outAll;
    }

    var rules = exerciseRulesForKey(exerciseFilter);
    var allowed = allowedTaskNumbers(exerciseFilter);
    var byDate = new Map();
    rawRows.forEach(function (r) {
      var d = String(r.date || "");
      var t = Number(r.task || 0);
      if (!d || !Number.isFinite(t)) return;
      if (!byDate.has(d)) byDate.set(d, new Map());
      byDate.get(d).set(t, r);
    });
    var out = [];
    Array.from(byDate.keys()).sort().forEach(function (d) {
      pushClusterRows(out, d, exerciseFilter, byDate.get(d) || new Map(), allowed, rules);
    });
    return out;
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
    var padB = dates.length > BAZA_DIAGRAM_MAX_FULL_DATE_LABELS ? 52 : Math.max(52, 40 + Math.ceil(dates.length * 1.6));
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
      gridLines.push({ y: y, major: major, label: major && g !== 0 ? (g === 100 ? "100%" : String(g)) : undefined });
    }

    var xTicks = [];
    var xLabels = [];
    var sparse = dates.length > BAZA_DIAGRAM_MAX_FULL_DATE_LABELS;
    for (var i = 0; i < dates.length; i += 1) {
      var xi = xPx(i);
      xTicks.push({ x: xi });
      if (!sparse || i === 0 || i === dates.length - 1) {
        xLabels.push({ x: xi, y: axisY + 11, label: formatIsoDateForDiagramAxis(dates[i]) || dates[i] });
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

    return { width: width, height: height, padL: padL, padT: padT, plotW: plotW, plotH: plotH, axisY: axisY, gridLines: gridLines, xTicks: xTicks, xLabels: xLabels, series: series, legendTasks: legendTasks };
  }

  function renderBazaDiagramSvg(render) {
    if (!render) return "";
    var parts = [];
    parts.push('<svg class="btca-l2-diagram" viewBox="0 0 ' + render.width + " " + render.height + '" role="img" aria-label="Диаграмма успешности">');
    parts.push('<rect width="100%" height="100%" fill="#c5d9dc"/>');
    render.gridLines.forEach(function (line) {
      parts.push('<line x1="' + render.padL + '" y1="' + line.y + '" x2="' + (render.padL + render.plotW) + '" y2="' + line.y + '" stroke="' + (line.major ? "rgba(17,24,39,0.35)" : "rgba(17,24,39,0.12)") + '" stroke-width="1"/>');
      if (line.label) {
        parts.push('<text x="' + (render.padL - 6) + '" y="' + (line.y + 4) + '" text-anchor="end" font-size="11" fill="#111827">' + line.label + "</text>");
      }
    });
    parts.push('<line x1="' + render.padL + '" y1="' + render.axisY + '" x2="' + (render.padL + render.plotW) + '" y2="' + render.axisY + '" stroke="#111827" stroke-width="1.5"/>');
    render.xTicks.forEach(function (tick) {
      parts.push('<line x1="' + tick.x + '" y1="' + render.axisY + '" x2="' + tick.x + '" y2="' + (render.axisY + 6) + '" stroke="#111827" stroke-width="1"/>');
    });
    render.xLabels.forEach(function (lab) {
      parts.push('<text x="' + lab.x + '" y="' + lab.y + '" text-anchor="middle" font-size="11" fill="#111827">' + lab.label + "</text>");
    });
    render.series.forEach(function (s) {
      if (s.points.length < 2) {
        if (s.points.length === 1) {
          parts.push('<circle cx="' + s.points[0].x + '" cy="' + s.points[0].y + '" r="3" fill="' + s.color + '"/>');
        }
        return;
      }
      var d = "M" + s.points.map(function (p) { return p.x + " " + p.y; }).join(" L");
      parts.push('<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>');
      s.points.forEach(function (p) {
        parts.push('<circle cx="' + p.x + '" cy="' + p.y + '" r="2.5" fill="' + s.color + '"/>');
      });
    });
    var legendX = render.padL + render.plotW - 8;
    render.legendTasks.forEach(function (task, idx) {
      var y = render.padT + 12 + idx * 14;
      parts.push('<circle cx="' + (legendX - 52) + '" cy="' + y + '" r="4" fill="' + bazaTaskColor(task) + '"/>');
      parts.push('<text x="' + (legendX - 42) + '" y="' + (y + 4) + '" font-size="11" fill="#111827">З' + task + "</text>");
    });
    parts.push("</svg>");
    return parts.join("");
  }

  function formatBazaReqCell(exerciseRulesFn, b5FromValueFn, exerciseKey, task, okMerged, setsCount) {
    var ex = String(exerciseKey || "").trim();
    var t = Number(task || 0);
    if (!ex || !Number.isFinite(t) || t < 1 || t > 12) return "";
    var rules = exerciseRulesFn(b5FromValueFn(ex));
    var baseN = rules.requiredByTask[t - 1];
    if (baseN == null) return "";
    if (okMerged == null) return String(baseN);
    var k = setsCount != null && setsCount > 0 ? setsCount : 1;
    return baseN + " x " + k;
  }

  function sanitizeBazaFileIdentifier(raw) {
    return String(raw || "").trim().replace(/[^\w\u0400-\u04FF.-]/g, "").slice(0, 32);
  }

  window.BTCA_LEVEL2_BAZA = {
    expandBazaRows: expandBazaRows,
    buildBazaDiagramRender: buildBazaDiagramRender,
    renderBazaDiagramSvg: renderBazaDiagramSvg,
    formatBazaReqCell: formatBazaReqCell,
    bazaTaskColor: bazaTaskColor,
    sanitizeBazaFileIdentifier: sanitizeBazaFileIdentifier,
    BAZA_EXERCISE_ALL: "all",
    BAZA_GROUP_OWN: "__group_own__",
    BAZA_GROUP_FOREIGN: "__group_foreign__",
  };
})();
