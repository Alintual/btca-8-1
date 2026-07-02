(function () {
  "use strict";

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

  function diagramApi() {
    return window.BTCA_BAZA_DIAGRAM;
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
    buildBazaDiagramRender: function () {
      var api = diagramApi();
      return api ? api.buildBazaDiagramRender.apply(api, arguments) : null;
    },
    renderBazaDiagramSvg: function () {
      var api = diagramApi();
      return api ? api.renderBazaDiagramSvg.apply(api, arguments) : "";
    },
    formatBazaReqCell: formatBazaReqCell,
    bazaTaskColor: function (task) {
      var api = diagramApi();
      return api ? api.bazaTaskColor(task) : "#111827";
    },
    sanitizeBazaFileIdentifier: sanitizeBazaFileIdentifier,
    BAZA_EXERCISE_ALL: "all",
    BAZA_GROUP_OWN: "__group_own__",
    BAZA_GROUP_FOREIGN: "__group_foreign__",
  };
})();
