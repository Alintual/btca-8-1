(function (global) {
  var ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  var IDENTIFIER_RE = /^[A-Za-z0-9_-]+$/;
  var KV_KEY_L2 = "baza_file_identifier_user_l2_v1";
  var SCHEMA_SQL =
    "CREATE TABLE results (" +
    "date TEXT NOT NULL, exercise TEXT NOT NULL, task INTEGER NOT NULL, " +
    "req INTEGER, ok INTEGER, pct INTEGER, sets INTEGER, " +
    "PRIMARY KEY (date, exercise, task));" +
    "CREATE TABLE app_kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);";

  var sqlPromise = null;

  function assetBase() {
    var base = global.__BTCA_BASE__ || "/btca-8-1/";
    if (!/\/$/.test(base)) base += "/";
    return base;
  }

  function loadSqlWasmScript() {
    return new Promise(function (resolve, reject) {
      var src = assetBase() + "vendor/sql-wasm.js";
      if (typeof global.initSqlJs === "function" && document.querySelector('script[data-btca-sqlwasm-src="' + src + '"]')) {
        resolve();
        return;
      }
      var script = document.createElement("script");
      script.src = src;
      script.setAttribute("data-btca-sqlwasm-src", src);
      script.onload = function () {
        resolve();
      };
      script.onerror = function () {
        reject(new Error("sql_wasm_load"));
      };
      document.head.appendChild(script);
    });
  }

  function ensureSqlJs() {
    if (sqlPromise) return sqlPromise;
    sqlPromise = loadSqlWasmScript().then(function () {
      var initSqlJs = global.initSqlJs;
      if (typeof initSqlJs !== "function") throw new Error("sqljs_missing");
      return initSqlJs({
        locateFile: function (file) {
          return assetBase() + "vendor/" + file;
        },
      });
    });
    return sqlPromise;
  }

  function sanitizeBazaFileIdentifier(raw) {
    var trimmed = String(raw ?? "").trim();
    if (!trimmed || !IDENTIFIER_RE.test(trimmed)) return "";
    return trimmed;
  }

  function formatYmd(d) {
    var y = d.getFullYear();
    var mo = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + mo + "-" + day;
  }

  function formatIsoDateAsDdMmYyyyCompact(iso) {
    var m = ISO_RE.exec(String(iso ?? "").trim());
    if (!m) return null;
    return m[3] + m[2] + m[1];
  }

  function buildSystemFileIdentifier(userIdentifier, level) {
    var user = sanitizeBazaFileIdentifier(userIdentifier);
    if (!user) return "";
    return user + String(level) + "8.1";
  }

  /** У2: `{id}281_ddmmyyyy.sqlite` — как на Android. */
  function buildBazaBackupFileNameL2(userIdentifier, dateIso) {
    var id = sanitizeBazaFileIdentifier(userIdentifier) || "user";
    var date =
      formatIsoDateAsDdMmYyyyCompact(dateIso) ||
      formatIsoDateAsDdMmYyyyCompact(formatYmd(new Date())) ||
      "--------";
    return id + "281_" + date + ".sqlite";
  }

  function exportOwnResultsBackup(rows, userIdentifier, level) {
    var levelNum = level === 2 ? 2 : 1;
    var systemId = buildSystemFileIdentifier(userIdentifier, levelNum);
    if (!systemId) return Promise.reject(new Error("export_failed"));
    return ensureSqlJs().then(function (SQL) {
      var db = new SQL.Database();
      try {
        db.run(SCHEMA_SQL);
        var insertSql =
          "INSERT INTO results(date, exercise, task, req, ok, pct, sets) VALUES (?, ?, ?, ?, ?, ?, ?)";
        (rows || []).forEach(function (row) {
          if (!row || !row.date || !row.exercise || row.task == null) return;
          db.run(insertSql, [
            String(row.date),
            String(row.exercise),
            Number(row.task),
            row.req == null ? null : Number(row.req),
            row.ok == null ? null : Number(row.ok),
            row.pct == null ? null : Number(row.pct),
            row.sets == null ? null : Number(row.sets),
          ]);
        });
        db.run("INSERT OR REPLACE INTO app_kv (key, value) VALUES (?, ?)", [
          levelNum === 2 ? KV_KEY_L2 : "baza_file_identifier_v1",
          systemId,
        ]);
        try {
          db.run("VACUUM;");
        } catch (_) {
          /* optional */
        }
        return db.export();
      } finally {
        db.close();
      }
    });
  }

  function parseBackupSqlite(bytes, fileName, level) {
    var levelNum = level === 2 ? 2 : 1;
    return ensureSqlJs().then(function (SQL) {
      var db = new SQL.Database(new Uint8Array(bytes));
      try {
        var check = db.exec(
          "SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table' AND name='results';"
        );
        var hasResults =
          check && check[0] && check[0].values && check[0].values[0] && Number(check[0].values[0][0]) > 0;
        if (!hasResults) throw new Error("bad_format");

        var importId = "";
        var kvKey = levelNum === 2 ? KV_KEY_L2 : "baza_file_identifier_v1";
        var kvStmt = db.prepare("SELECT value FROM app_kv WHERE key = ? LIMIT 1");
        kvStmt.bind([kvKey]);
        if (kvStmt.step()) {
          importId = String(kvStmt.get()[0] || "").trim();
        }
        kvStmt.free();

        if (!importId) {
          var base = String(fileName || "")
            .replace(/\\/g, "/")
            .split("/")
            .pop();
          var compact = /^(.+?)281_\d{8}\.sqlite$/i.exec(base || "");
          if (compact) importId = String(compact[1] || "").trim();
        }

        var rows = [];
        var stmt = db.prepare("SELECT date, exercise, task, req, ok, pct, sets FROM results");
        while (stmt.step()) {
          var cells = stmt.get();
          rows.push({
            date: String(cells[0]),
            exercise: String(cells[1]),
            task: Number(cells[2]),
            req: cells[3] == null ? null : Number(cells[3]),
            ok: cells[4] == null ? null : Number(cells[4]),
            pct: cells[5] == null ? null : Number(cells[5]),
            sets: cells[6] == null ? null : Number(cells[6]),
          });
        }
        stmt.free();
        return { rows: rows, importId: importId };
      } finally {
        db.close();
      }
    });
  }

  global.BTCA_BAZA_SQLITE = {
    ensureSqlJs: ensureSqlJs,
    buildBazaBackupFileNameL2: buildBazaBackupFileNameL2,
    exportOwnResultsBackup: exportOwnResultsBackup,
    parseBackupSqlite: parseBackupSqlite,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
