(function () {
  "use strict";

  var DB_NAME = "btca_level1_web";
  var DB_VERSION = 1;
  var KV_UI_KEY = "level1_ui_state_v1";
  var DB_MAX_ROWS = 36512;

  var dbPromise = null;
  var dbInstance = null;

  function openDb() {
    if (dbInstance) return Promise.resolve(dbInstance);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains("results")) {
          var store = db.createObjectStore("results", { keyPath: ["date", "exercise", "task"] });
          store.createIndex("byDate", "date", { unique: false });
          store.createIndex("byExercise", "exercise", { unique: false });
        }
        if (!db.objectStoreNames.contains("kv")) {
          db.createObjectStore("kv", { keyPath: "key" });
        }
      };
      request.onsuccess = function () {
        dbInstance = request.result;
        dbInstance.onversionchange = function () { dbInstance.close(); };
        dbInstance.onclose = function () { dbInstance = null; dbPromise = null; };
        resolve(dbInstance);
      };
      request.onerror = function () { reject(request.error || new Error("IndexedDB open failed")); };
    });
    return dbPromise;
  }

  function warmDb() {
    return openDb();
  }

  function runTx(storeNames, mode, worker) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var transaction = db.transaction(storeNames, mode);
        var settled = false;
        function finish(value) {
          if (settled) return;
          settled = true;
          resolve(value);
        }
        function fail(err) {
          if (settled) return;
          settled = true;
          reject(err || new Error("transaction failed"));
        }
        transaction.onerror = function () { fail(transaction.error); };
        transaction.onabort = function () { fail(transaction.error); };
        try {
          worker(transaction, finish, fail);
        } catch (err) {
          fail(err);
        }
      });
    });
  }

  function readKv(key) {
    return runTx(["kv"], "readonly", function (transaction, finish, fail) {
      var req = transaction.objectStore("kv").get(key);
      req.onsuccess = function () { finish(req.result ? req.result.value : null); };
      req.onerror = function () { fail(req.error); };
    });
  }

  function writeKv(key, value) {
    return runTx(["kv"], "readwrite", function (transaction, finish, fail) {
      var req = transaction.objectStore("kv").put({ key: key, value: value });
      req.onsuccess = function () { finish(); };
      req.onerror = function () { fail(req.error); };
    });
  }

  function mergeClusterRowValues(oldRow, reqNew, okNew) {
    var okOld = oldRow && oldRow.ok != null ? Number(oldRow.ok) : null;
    var reqOld = oldRow && oldRow.req != null ? Number(oldRow.req) : null;
    var setsOld = oldRow && oldRow.sets != null ? Number(oldRow.sets) : null;
    var hasReq = reqOld != null || reqNew != null;
    var reqMerged = hasReq ? (reqOld || 0) + (reqNew || 0) : null;
    var okNewNum = okNew == null ? null : Number(okNew);
    var okSum = (okOld || 0) + (okNewNum || 0);
    var okMerged = okSum > 0 ? okSum : null;
    var setsMerged = setsOld;
    if (okNewNum != null && okNewNum > 0) setsMerged = (setsOld || 0) + 1;
    var pctMerged = reqMerged != null && Number.isFinite(reqMerged) && reqMerged > 0 && okMerged != null
      ? Math.round((okMerged / reqMerged) * 100)
      : null;
    return { req: reqMerged, ok: okMerged, pct: pctMerged, sets: setsMerged };
  }

  function defaultUiState() {
    var today = formatYmd(new Date());
    return {
      v: 1,
      tab: "forma",
      exerciseValue: "1",
      trainingDate: today,
      taskOk: {},
      baza: { periodFrom: today, periodTo: today, exercise: "all", task: "all", dataSource: "own" },
      nav: { exerciseFilterKey: "all" },
      polez: { catalogKey: "all" },
    };
  }

  function formatYmd(d) {
    var y = d.getFullYear();
    var mo = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + mo + "-" + day;
  }

  function sanitizeUiState(raw) {
    var base = defaultUiState();
    if (!raw || typeof raw !== "object") return base;
    var tab = raw.tab;
    if (tab !== "forma" && tab !== "baza" && tab !== "nav" && tab !== "polez") tab = base.tab;
    var iso = /^\d{4}-\d{2}-\d{2}$/;
    var trainingDate = typeof raw.trainingDate === "string" && iso.test(raw.trainingDate) ? raw.trainingDate : base.trainingDate;
    var exerciseValue = typeof raw.exerciseValue === "string" && raw.exerciseValue.trim() ? raw.exerciseValue : base.exerciseValue;
    var taskOk = {};
    if (raw.taskOk && typeof raw.taskOk === "object") {
      Object.keys(raw.taskOk).forEach(function (k) {
        var t = Number(k);
        if (Number.isInteger(t) && t >= 1 && t <= 12) taskOk[String(t)] = String(raw.taskOk[k] || "").replace(/[^\d]/g, "");
      });
    }
    var bazaRaw = raw.baza && typeof raw.baza === "object" ? raw.baza : {};
    var baza = {
      periodFrom: typeof bazaRaw.periodFrom === "string" && iso.test(bazaRaw.periodFrom) ? bazaRaw.periodFrom : base.baza.periodFrom,
      periodTo: typeof bazaRaw.periodTo === "string" && iso.test(bazaRaw.periodTo) ? bazaRaw.periodTo : base.baza.periodTo,
      exercise: typeof bazaRaw.exercise === "string" ? bazaRaw.exercise : base.baza.exercise,
      task: typeof bazaRaw.task === "string" ? bazaRaw.task : base.baza.task,
      dataSource: bazaRaw.dataSource === "foreign" ? "foreign" : "own",
    };
    var navRaw = raw.nav && typeof raw.nav === "object" ? raw.nav : {};
    var polezRaw = raw.polez && typeof raw.polez === "object" ? raw.polez : {};
    return {
      v: 1,
      tab: tab,
      exerciseValue: exerciseValue,
      trainingDate: trainingDate,
      taskOk: taskOk,
      baza: baza,
      nav: { exerciseFilterKey: typeof navRaw.exerciseFilterKey === "string" ? navRaw.exerciseFilterKey : base.nav.exerciseFilterKey },
      polez: { catalogKey: typeof polezRaw.catalogKey === "string" ? polezRaw.catalogKey : base.polez.catalogKey },
    };
  }

  var uiCache = null;
  var uiSaveTimer = null;

  function loadUiState() {
    if (uiCache) return Promise.resolve(uiCache);
    return readKv(KV_UI_KEY).then(function (raw) {
      uiCache = sanitizeUiState(raw ? JSON.parse(raw) : null);
      return uiCache;
    }).catch(function () {
      uiCache = defaultUiState();
      return uiCache;
    });
  }

  function patchUiState(patch) {
    if (!uiCache) return;
    uiCache = sanitizeUiState(Object.assign({}, uiCache, patch, {
      baza: Object.assign({}, uiCache.baza, patch.baza || {}),
      nav: Object.assign({}, uiCache.nav, patch.nav || {}),
      polez: Object.assign({}, uiCache.polez, patch.polez || {}),
      taskOk: patch.taskOk != null ? patch.taskOk : uiCache.taskOk,
    }));
    if (uiSaveTimer) window.clearTimeout(uiSaveTimer);
    uiSaveTimer = window.setTimeout(function () {
      uiSaveTimer = null;
      if (!uiCache) return;
      writeKv(KV_UI_KEY, JSON.stringify(uiCache)).catch(function () {});
    }, 400);
  }

  function flushUiState() {
    if (!uiCache) return Promise.resolve();
    if (uiSaveTimer) {
      window.clearTimeout(uiSaveTimer);
      uiSaveTimer = null;
    }
    return writeKv(KV_UI_KEY, JSON.stringify(uiCache));
  }

  function getResultRow(date, exercise, task) {
    return runTx(["results"], "readonly", function (transaction, finish, fail) {
      var req = transaction.objectStore("results").get([date, exercise, task]);
      req.onsuccess = function () { finish(req.result || null); };
      req.onerror = function () { fail(req.error); };
    });
  }

  function countResults() {
    return runTx(["results"], "readonly", function (transaction, finish, fail) {
      var req = transaction.objectStore("results").count();
      req.onsuccess = function () { finish(req.result || 0); };
      req.onerror = function () { fail(req.error); };
    });
  }

  function countCluster(date, exercise) {
    return runTx(["results"], "readonly", function (transaction, finish, fail) {
      var store = transaction.objectStore("results");
      var req = store.openCursor();
      var count = 0;
      req.onsuccess = function () {
        var cursor = req.result;
        if (!cursor) { finish(count); return; }
        var row = cursor.value;
        if (row.date === date && row.exercise === exercise) count += 1;
        cursor.continue();
      };
      req.onerror = function () { fail(req.error); };
    });
  }

  function dbCapacity(dateIso, exercise) {
    var date = String(dateIso || "").trim();
    var ex = String(exercise || "").trim();
    if (!date || !ex) return Promise.resolve({ freeRows: DB_MAX_ROWS, neededRows: 12, totalRows: 0 });
    return runTx(["results"], "readonly", function (transaction, finish, fail) {
      var store = transaction.objectStore("results");
      var countReq = store.count();
      countReq.onerror = function () { fail(countReq.error); };
      countReq.onsuccess = function () {
        var totalRows = countReq.result || 0;
        var cursorReq = store.openCursor();
        var existing = 0;
        cursorReq.onerror = function () { fail(cursorReq.error); };
        cursorReq.onsuccess = function () {
          var cursor = cursorReq.result;
          if (!cursor) {
            finish({
              freeRows: Math.max(0, DB_MAX_ROWS - totalRows),
              neededRows: Math.max(0, 12 - existing),
              totalRows: totalRows,
            });
            return;
          }
          var row = cursor.value;
          if (row.date === date && row.exercise === ex) existing += 1;
          cursor.continue();
        };
      };
    });
  }

  function saveCluster(payload) {
    var date = String(payload.date || "").trim();
    var exercise = String(payload.exercise || "").trim();
    var rows = Array.isArray(payload.rows) ? payload.rows : [];
    if (!date || !exercise || !rows.length) return Promise.resolve({ ok: false, error: "missing_fields" });

    function runSave(db) {
      return new Promise(function (resolve, reject) {
        try {
          var transaction = db.transaction(["results"], "readwrite");
          transaction.oncomplete = function () { resolve({ ok: true }); };
          transaction.onerror = function () { reject(transaction.error || new Error("transaction failed")); };
          transaction.onabort = function () { reject(transaction.error || new Error("transaction aborted")); };
          var store = transaction.objectStore("results");
          rows.forEach(function (r) {
            var task = Number(r.task || 0);
            if (!Number.isFinite(task) || task < 1 || task > 12) return;
            var reqNew = r.req == null ? null : Number(r.req);
            var okNew = r.ok == null ? null : Number(r.ok);
            var getReq = store.get([date, exercise, task]);
            getReq.onerror = function () { reject(getReq.error); };
            getReq.onsuccess = function () {
              var merged = mergeClusterRowValues(getReq.result || null, reqNew, okNew);
              var putReq = store.put({
                date: date,
                exercise: exercise,
                task: task,
                req: merged.req,
                ok: merged.ok,
                pct: merged.pct,
                sets: merged.sets,
              });
              putReq.onerror = function () { reject(putReq.error); };
            };
          });
        } catch (err) {
          reject(err);
        }
      });
    }

    if (dbInstance) {
      return runSave(dbInstance).catch(function () { return { ok: false, error: "db_error" }; });
    }
    return openDb().then(function (db) {
      return runSave(db);
    }).catch(function () {
      return { ok: false, error: "db_error" };
    });
  }

  function bazaQuery(query) {
    var from = String(query.from || "").trim();
    var to = String(query.to || "").trim();
    var exercise = String(query.exercise || "all").trim() || "all";
    var taskRaw = String(query.task || "all").trim() || "all";

    return countResults().then(function (total) {
      if (total <= 0) return { ok: true, isEmpty: true, exercises: [], tasks: [], rows: [] };
      return runTx(["results"], "readonly", function (transaction, finish, fail) {
        var store = transaction.objectStore("results");
        var req = store.openCursor();
        var rows = [];
        var exercises = {};
        var tasks = {};
        req.onsuccess = function () {
          var cursor = req.result;
          if (!cursor) {
            finish({
              ok: true,
              isEmpty: false,
              exercises: Object.keys(exercises).sort(),
              tasks: Object.keys(tasks).map(Number).filter(function (n) { return Number.isFinite(n); }).sort(function (a, b) { return a - b; }),
              rows: rows.sort(function (a, b) {
                if (a.date !== b.date) return a.date.localeCompare(b.date);
                if (a.exercise !== b.exercise) return a.exercise.localeCompare(b.exercise);
                return a.task - b.task;
              }),
            });
            return;
          }
          var row = cursor.value;
          var passDate = true;
          if (from && to) passDate = row.date >= from && row.date <= to;
          else if (from) passDate = row.date >= from;
          else if (to) passDate = row.date <= to;
          var passExercise = exercise === "all" || row.exercise === exercise;
          var passTask = taskRaw === "all" || String(row.task) === taskRaw;
          if (passDate && passExercise && passTask) {
            rows.push({
              n: rows.length + 1,
              date: row.date,
              exercise: row.exercise,
              task: row.task,
              req: row.req,
              ok: row.ok,
              pct: row.pct,
              sets: row.sets,
            });
            exercises[row.exercise] = true;
            tasks[row.task] = true;
          }
          cursor.continue();
        };
        req.onerror = function () { fail(req.error); };
      });
    });
  }

  function dbStats() {
    return countResults().then(function (totalRows) {
      return { maxRows: DB_MAX_ROWS, totalRows: totalRows, filledRows: totalRows, empty: totalRows <= 0 };
    });
  }

  function bazaFillStatusText(filledRows, maxRows) {
    if (!filledRows) return "пуста";
    var pct = Math.floor((filledRows / maxRows) * 100);
    return pct <= 0 ? "< 1 %" : pct + " %";
  }

  var KV_USER_FILE_ID = "baza_file_identifier_user_l1_v1";

  function loadUserFileIdentifier() {
    return readKv(KV_USER_FILE_ID).then(function (v) { return v || ""; });
  }

  function saveUserFileIdentifier(value) {
    var id = String(value || "").trim();
    if (!id) return Promise.resolve();
    return writeKv(KV_USER_FILE_ID, id);
  }

  function bazaDeleteCurrentByFilters(filters) {
    var from = String(filters.from || "").trim();
    var to = String(filters.to || "").trim();
    var exercise = String(filters.exercise || "all").trim() || "all";
    var taskRaw = String(filters.task || "all").trim() || "all";
    return runTx(["results"], "readwrite", function (transaction, finish, fail) {
      var store = transaction.objectStore("results");
      var req = store.openCursor();
      var toDelete = [];
      req.onsuccess = function () {
        var cursor = req.result;
        if (!cursor) {
          toDelete.forEach(function (key) { store.delete(key); });
          finish({ ok: true, deleted: toDelete.length });
          return;
        }
        var row = cursor.value;
        var passDate = true;
        if (from && to) passDate = row.date >= from && row.date <= to;
        else if (from) passDate = row.date >= from;
        else if (to) passDate = row.date <= to;
        var passExercise = exercise === "all" || row.exercise === exercise;
        var passTask = taskRaw === "all" || String(row.task) === taskRaw;
        if (passDate && passExercise && passTask) {
          toDelete.push([row.date, row.exercise, row.task]);
        }
        cursor.continue();
      };
      req.onerror = function () { fail(req.error); };
    }).catch(function () { return { ok: false }; });
  }

  window.BTCA_LEVEL1_DB = {
    DB_MAX_ROWS: DB_MAX_ROWS,
    loadUiState: loadUiState,
    patchUiState: patchUiState,
    flushUiState: flushUiState,
    getUiState: function () { return uiCache; },
    warmDb: warmDb,
    saveCluster: saveCluster,
    dbCapacity: dbCapacity,
    bazaQuery: bazaQuery,
    dbStats: dbStats,
    bazaFillStatusText: bazaFillStatusText,
    bazaDeleteCurrentByFilters: bazaDeleteCurrentByFilters,
    loadUserFileIdentifier: loadUserFileIdentifier,
    saveUserFileIdentifier: saveUserFileIdentifier,
    formatYmd: formatYmd,
  };
})();
