(function () {
  "use strict";

  var DB_NAME = "btca_level2_web";
  var DB_VERSION = 2;
  var KV_UI_KEY = "level2_ui_state_v1";
  var KV_USER_FILE_ID = "baza_file_identifier_user_l2_v1";
  var KV_IMPORT_FILE_ID = "baza_import_file_identifier_l2_v1";
  var DB_MAX_ROWS = 36512;
  var BACKUP_LEVEL_MARKER = "28.1";

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
        if (!db.objectStoreNames.contains("foreign_results")) {
          var fstore = db.createObjectStore("foreign_results", { keyPath: ["date", "exercise", "task"] });
          fstore.createIndex("byDate", "date", { unique: false });
          fstore.createIndex("byExercise", "exercise", { unique: false });
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
      exerciseValue: "10",
      trainingDate: today,
      taskOk: {},
      baza: { periodFrom: today, periodTo: today, exercise: "all", task: "all", dataSource: "own" },
      nav: { sectionKey: "all", exerciseFilterKey: "all" },
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
      nav: {
        sectionKey: typeof navRaw.sectionKey === "string" ? navRaw.sectionKey : base.nav.sectionKey,
        exerciseFilterKey: typeof navRaw.exerciseFilterKey === "string" ? navRaw.exerciseFilterKey : base.nav.exerciseFilterKey,
      },
      polez: { catalogKey: typeof polezRaw.catalogKey === "string" ? polezRaw.catalogKey : base.polez.catalogKey },
    };
  }

  var uiCache = null;
  var uiSaveTimer = null;

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

  function getResultRow(date, exercise, task) {
    return runTx(["results"], "readonly", function (transaction, finish, fail) {
      var req = transaction.objectStore("results").get([date, exercise, task]);
      req.onsuccess = function () { finish(req.result || null); };
      req.onerror = function () { fail(req.error); };
    });
  }

  function countStore(storeName) {
    return runTx([storeName], "readonly", function (transaction, finish, fail) {
      var req = transaction.objectStore(storeName).count();
      req.onsuccess = function () { finish(req.result || 0); };
      req.onerror = function () { fail(req.error); };
    });
  }

  function countResults() {
    return countStore("results");
  }

  function countForeignResults() {
    return countStore("foreign_results");
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

  function queryStore(storeName, query) {
    var from = String(query.from || "").trim();
    var to = String(query.to || "").trim();
    var exercise = String(query.exercise || "all").trim() || "all";
    var taskRaw = String(query.task || "all").trim() || "all";

    return countStore(storeName).then(function (total) {
      if (total <= 0) return { ok: true, isEmpty: true, exercises: [], tasks: [], rows: [] };
      return runTx([storeName], "readonly", function (transaction, finish, fail) {
        var store = transaction.objectStore(storeName);
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

  function bazaQuery(query) {
    return queryStore("results", query);
  }

  function foreignBazaQuery(query) {
    return queryStore("foreign_results", query);
  }

  function bazaQueryForSource(source, query) {
    return source === "foreign" ? foreignBazaQuery(query) : bazaQuery(query);
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

  function listExerciseKeys(storeName) {
    return runTx([storeName], "readonly", function (transaction, finish, fail) {
      var store = transaction.objectStore(storeName);
      var req = store.openCursor();
      var keys = {};
      req.onsuccess = function () {
        var cursor = req.result;
        if (!cursor) {
          finish(Object.keys(keys).sort());
          return;
        }
        keys[cursor.value.exercise] = true;
        cursor.continue();
      };
      req.onerror = function () { fail(req.error); };
    });
  }

  function dbStats() {
    return countResults().then(function (totalRows) {
      return { maxRows: DB_MAX_ROWS, totalRows: totalRows, filledRows: totalRows, empty: totalRows <= 0 };
    });
  }

  function foreignDbStats() {
    return countForeignResults().then(function (totalRows) {
      return { totalRows: totalRows, filledRows: totalRows, empty: totalRows <= 0 };
    });
  }

  function hasForeignDatabase() {
    return countForeignResults().then(function (n) { return n > 0; });
  }

  function combinedDbStats() {
    return countResults().then(function (ownRows) {
      return countForeignResults().then(function (foreignRows) {
        var filledRows = ownRows + foreignRows;
        return {
          maxRows: DB_MAX_ROWS,
          totalRows: filledRows,
          filledRows: filledRows,
          empty: filledRows <= 0,
          ownRows: ownRows,
          foreignRows: foreignRows,
        };
      });
    });
  }

  function loadUserFileIdentifier() {
    return readKv(KV_USER_FILE_ID).then(function (v) { return v || ""; });
  }

  function saveUserFileIdentifier(value) {
    var id = String(value || "").trim();
    if (!id) return Promise.resolve();
    return writeKv(KV_USER_FILE_ID, id);
  }

  function loadImportFileIdentifier() {
    return readKv(KV_IMPORT_FILE_ID).then(function (v) { return v || ""; });
  }

  function saveImportFileIdentifier(value) {
    var id = String(value || "").trim();
    if (!id) return Promise.resolve();
    return writeKv(KV_IMPORT_FILE_ID, id);
  }

  function clearImportFileIdentifier() {
    return writeKv(KV_IMPORT_FILE_ID, "");
  }

  function clearForeignDatabase() {
    return runTx(["foreign_results"], "readwrite", function (transaction, finish, fail) {
      var req = transaction.objectStore("foreign_results").clear();
      req.onsuccess = function () { finish({ ok: true }); };
      req.onerror = function () { fail(req.error); };
    });
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

  function readAllRows(storeName) {
    return runTx([storeName], "readonly", function (transaction, finish, fail) {
      var store = transaction.objectStore(storeName);
      var req = store.openCursor();
      var rows = [];
      req.onsuccess = function () {
        var cursor = req.result;
        if (!cursor) { finish(rows); return; }
        rows.push(cursor.value);
        cursor.continue();
      };
      req.onerror = function () { fail(req.error); };
    });
  }

  function exportBazaBackup(userId) {
    return Promise.all([readAllRows("results"), loadUserFileIdentifier()]).then(function (parts) {
      var rows = parts[0];
      var id = String(userId || parts[1] || "").trim();
      var payload = {
        version: 1,
        level: 2,
        levelMarker: BACKUP_LEVEL_MARKER,
        userId: id,
        exportedAt: new Date().toISOString(),
        rows: rows,
      };
      return { ok: true, payload: payload, fileName: "BTCA_L2_" + (id || "backup") + "_" + BACKUP_LEVEL_MARKER + ".json" };
    });
  }

  function importBazaBackupObject(payload) {
    if (!payload || payload.level !== 2) return Promise.resolve({ ok: false, error: "wrong_level" });
    if (String(payload.levelMarker || "") !== BACKUP_LEVEL_MARKER) return Promise.resolve({ ok: false, error: "bad_format" });
    var rows = Array.isArray(payload.rows) ? payload.rows : [];
    return clearForeignDatabase().then(function () {
      return runTx(["foreign_results"], "readwrite", function (transaction, finish, fail) {
        transaction.oncomplete = function () { finish({ ok: true }); };
        var store = transaction.objectStore("foreign_results");
        rows.forEach(function (row) {
          if (!row || !row.date || !row.exercise || row.task == null) return;
          store.put({
            date: String(row.date),
            exercise: String(row.exercise),
            task: Number(row.task),
            req: row.req == null ? null : Number(row.req),
            ok: row.ok == null ? null : Number(row.ok),
            pct: row.pct == null ? null : Number(row.pct),
            sets: row.sets == null ? null : Number(row.sets),
          });
        });
      });
    }).then(function () {
      var importId = String(payload.userId || payload.importId || "import").trim();
      return saveImportFileIdentifier(importId).then(function () {
        return { ok: true, importId: importId };
      });
    }).catch(function () { return { ok: false, error: "import_failed" }; });
  }

  function foreignDbDateRange() {
    return runTx(["foreign_results"], "readonly", function (transaction, finish, fail) {
      var store = transaction.objectStore("foreign_results");
      var req = store.openCursor();
      var minDate = "";
      var maxDate = "";
      req.onsuccess = function () {
        var cursor = req.result;
        if (!cursor) {
          if (!minDate || !maxDate) finish(null);
          else finish({ from: minDate, to: maxDate });
          return;
        }
        var d = String(cursor.value.date || "");
        if (d) {
          if (!minDate || d < minDate) minDate = d;
          if (!maxDate || d > maxDate) maxDate = d;
        }
        cursor.continue();
      };
      req.onerror = function () { fail(req.error); };
    });
  }

  function flushUiState() {
    if (!uiCache) return Promise.resolve();
    if (uiSaveTimer) {
      window.clearTimeout(uiSaveTimer);
      uiSaveTimer = null;
    }
    return writeKv(KV_UI_KEY, JSON.stringify(uiCache));
  }

  function bazaFillStatusText(filledRows, maxRows) {
    if (!filledRows) return "пуста";
    var pct = Math.floor((filledRows / maxRows) * 100);
    return pct <= 0 ? "< 1 %" : pct + " %";
  }

  function wipeTrainingDatabase() {
    uiCache = null;
    return runTx(["results"], "readwrite", function (transaction, finish, fail) {
      var req = transaction.objectStore("results").clear();
      req.onsuccess = function () { finish(); };
      req.onerror = function () { fail(req.error); };
    }).then(function () {
      return runTx(["foreign_results"], "readwrite", function (transaction, finish, fail) {
        var req = transaction.objectStore("foreign_results").clear();
        req.onsuccess = function () { finish(); };
        req.onerror = function () { fail(req.error); };
      });
    }).then(function () {
      return clearImportFileIdentifier();
    });
  }

  window.BTCA_LEVEL2_DB = {
    DB_MAX_ROWS: DB_MAX_ROWS,
    BACKUP_LEVEL_MARKER: BACKUP_LEVEL_MARKER,
    loadUiState: loadUiState,
    patchUiState: patchUiState,
    flushUiState: flushUiState,
    wipeTrainingDatabase: wipeTrainingDatabase,
    getUiState: function () { return uiCache; },
    warmDb: warmDb,
    saveCluster: saveCluster,
    dbCapacity: dbCapacity,
    bazaQuery: bazaQuery,
    foreignBazaQuery: foreignBazaQuery,
    bazaQueryForSource: bazaQueryForSource,
    listExerciseKeys: listExerciseKeys,
    dbStats: dbStats,
    foreignDbStats: foreignDbStats,
    combinedDbStats: combinedDbStats,
    hasForeignDatabase: hasForeignDatabase,
    loadUserFileIdentifier: loadUserFileIdentifier,
    saveUserFileIdentifier: saveUserFileIdentifier,
    loadImportFileIdentifier: loadImportFileIdentifier,
    saveImportFileIdentifier: saveImportFileIdentifier,
    clearImportFileIdentifier: clearImportFileIdentifier,
    clearForeignDatabase: clearForeignDatabase,
    bazaDeleteCurrentByFilters: bazaDeleteCurrentByFilters,
    exportBazaBackup: exportBazaBackup,
    importBazaBackupObject: importBazaBackupObject,
    foreignDbDateRange: foreignDbDateRange,
    bazaFillStatusText: bazaFillStatusText,
    formatYmd: formatYmd,
  };

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", function () {
      flushUiState();
    });
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") flushUiState();
    });
  }
})();
