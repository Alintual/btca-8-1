(function (global) {
  var ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  var IDENTIFIER_RE = /^[A-Za-z0-9_-]+$/;
  var KV_KEY_L2 = "baza_file_identifier_user_l2_v1";
  var IDENTIFIER_KV_FALLBACK_L2 = ["baza_file_identifier_user_l2_v1", "baza_file_identifier_v1"];
  var BACKUP_NAME_COMPACT_L2_RE = /^(.+)([12])81_(\d{8})\.sqlite$/i;
  var SYSTEM_ID_RE = /^(.+)([12])8\.1$/i;
  var SQLITE_MAGIC = "SQLite format 3\u0000";
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

  function basename(fileName) {
    return String(fileName ?? "")
      .trim()
      .replace(/\\/g, "/")
      .split("/")
      .pop();
  }

  function levelMarker(level) {
    return String(level) + "8.1";
  }

  function containsLevelMarker(raw, level) {
    return String(raw ?? "")
      .toLowerCase()
      .indexOf(levelMarker(level).toLowerCase()) >= 0;
  }

  function parseSystemFileIdentifier(systemId) {
    var raw = String(systemId ?? "").trim();
    var m = SYSTEM_ID_RE.exec(raw);
    if (!m) return null;
    var userId = sanitizeBazaFileIdentifier(m[1] || "");
    if (!userId) return null;
    var levelNum = Number(m[2]);
    if (levelNum !== 1 && levelNum !== 2) return null;
    return { userId: userId, level: levelNum };
  }

  function userIdFromSystemOrRawIdentifier(raw) {
    var parsed = parseSystemFileIdentifier(raw);
    if (parsed) return parsed.userId;
    return sanitizeBazaFileIdentifier(raw);
  }

  /** Разбор имени резервной копии — как `bazaBackupFileName.ts` на Android. */
  function parseBazaBackupFileName(fileName) {
    var base = basename(fileName);
    if (!base) return null;

    var compactL2 = BACKUP_NAME_COMPACT_L2_RE.exec(base);
    if (compactL2) {
      var userId = sanitizeBazaFileIdentifier(compactL2[1] || "");
      var levelNum = Number(compactL2[2]);
      if (!userId || (levelNum !== 1 && levelNum !== 2)) return null;
      return {
        id: userId + levelNum + "8.1",
        userId: userId,
        level: levelNum,
      };
    }
    return null;
  }

  /** У2: имя должно содержать маркер `281` — `{id}281_ddmmyyyy.sqlite`. */
  function validateL2BackupFileName(fileName) {
    var parsed = parseBazaBackupFileName(fileName);
    if (!parsed) return { ok: false, error: "bad_format" };
    if (parsed.level !== 2) return { ok: false, error: "wrong_level" };
    if (!parsed.userId) return { ok: false, error: "bad_format" };
    if (!containsLevelMarker(parsed.id, 2)) return { ok: false, error: "wrong_level" };
    return { ok: true, userId: parsed.userId, systemId: parsed.id };
  }

  function isSqliteFileBytes(bytes) {
    if (!bytes || bytes.byteLength < 16) return false;
    var view = new Uint8Array(bytes);
    for (var i = 0; i < 16; i += 1) {
      if (view[i] !== SQLITE_MAGIC.charCodeAt(i)) return false;
    }
    return true;
  }

  function readIdentifierFromBackupDb(db, level) {
    var keys = level === 2 ? IDENTIFIER_KV_FALLBACK_L2 : ["baza_file_identifier_v1"];
    var kvValue = "";
    for (var i = 0; i < keys.length; i += 1) {
      var kvStmt = db.prepare("SELECT value FROM app_kv WHERE key = ? LIMIT 1");
      kvStmt.bind([keys[i]]);
      if (kvStmt.step()) {
        kvValue = String(kvStmt.get()[0] || "").trim();
      }
      kvStmt.free();
      if (kvValue) break;
    }
    if (kvValue) return kvValue;
    var marker = levelMarker(level);
    var anyStmt = db.prepare("SELECT value FROM app_kv WHERE value LIKE ? LIMIT 1");
    anyStmt.bind(["%" + marker + "%"]);
    if (anyStmt.step()) {
      kvValue = String(anyStmt.get()[0] || "").trim();
    }
    anyStmt.free();
    return kvValue;
  }

  function resolveSystemIdFromBackup(pickedName, kvValue, level) {
    var parsedName = parseBazaBackupFileName(pickedName);
    if (parsedName && parsedName.id && containsLevelMarker(parsedName.id, level)) {
      return parsedName.id.trim();
    }

    var kvTrim = String(kvValue || "").trim();
    if (kvTrim) {
      var parsedKv = parseSystemFileIdentifier(kvTrim);
      if (parsedKv && parsedKv.level === level) {
        return parsedKv.userId + level + "8.1";
      }
      if (containsLevelMarker(kvTrim, level)) {
        return kvTrim;
      }
      var built = buildSystemFileIdentifier(kvTrim, level);
      if (built && containsLevelMarker(built, level)) {
        return built;
      }
    }

    var base = basename(pickedName);
    if (base) {
      var stem = base.replace(/\.(sqlite|db)$/i, "");
      if (containsLevelMarker(stem, level)) {
        return stem;
      }
      var m = new RegExp("^(.+?)" + level + "8\\.1", "i").exec(stem);
      if (m && m[1]) {
        return m[1] + level + "8.1";
      }
    }
    return "";
  }

  function extractImportUserId(pickedName, kvValue, level) {
    var systemId = resolveSystemIdFromBackup(pickedName, kvValue, level);
    if (systemId) {
      var parsed = parseSystemFileIdentifier(systemId);
      if (parsed && parsed.userId) {
        return sanitizeBazaFileIdentifier(parsed.userId);
      }
      var raw = userIdFromSystemOrRawIdentifier(systemId);
      if (raw) {
        return sanitizeBazaFileIdentifier(raw);
      }
    }
    return "";
  }

  function readResultsRows(db) {
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
    return rows;
  }

  /**
   * Проверка резервной копии перед импортом — логика как `importBazaDatabase.ts` на Android.
   * У2: имя `*281_*.sqlite`, заголовок SQLite, таблица `results`, маркер уровня в идентификаторе.
   */
  function validateBackupForImport(bytes, fileName, level) {
    var levelNum = level === 2 ? 2 : 1;
    var base = basename(fileName);
    if (!base || !/\.sqlite$/i.test(base)) {
      return Promise.resolve({ ok: false, error: "bad_format" });
    }
    if (!isSqliteFileBytes(bytes)) {
      return Promise.resolve({ ok: false, error: "bad_format" });
    }
    if (levelNum === 2) {
      var nameCheck = validateL2BackupFileName(fileName);
      if (!nameCheck.ok) return Promise.resolve(nameCheck);
    }

    return ensureSqlJs()
      .then(function (SQL) {
        var db = new SQL.Database(new Uint8Array(bytes));
        try {
          var check = db.exec(
            "SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table' AND name='results';"
          );
          var hasResults =
            check &&
            check[0] &&
            check[0].values &&
            check[0].values[0] &&
            Number(check[0].values[0][0]) > 0;
          if (!hasResults) return { ok: false, error: "bad_format" };

          var kvValue = readIdentifierFromBackupDb(db, levelNum);
          var importUserId = extractImportUserId(fileName, kvValue, levelNum);
          if (!importUserId) return { ok: false, error: "wrong_level" };

          var systemId = resolveSystemIdFromBackup(fileName, kvValue, levelNum);
          if (systemId && !containsLevelMarker(systemId, levelNum)) {
            return { ok: false, error: "wrong_level" };
          }

          return {
            ok: true,
            rows: readResultsRows(db),
            importId: importUserId,
          };
        } finally {
          db.close();
        }
      })
      .catch(function () {
        return { ok: false, error: "import_failed" };
      });
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

  global.BTCA_BAZA_SQLITE = {
    ensureSqlJs: ensureSqlJs,
    buildBazaBackupFileNameL2: buildBazaBackupFileNameL2,
    parseBazaBackupFileName: parseBazaBackupFileName,
    validateL2BackupFileName: validateL2BackupFileName,
    exportOwnResultsBackup: exportOwnResultsBackup,
    validateBackupForImport: validateBackupForImport,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
