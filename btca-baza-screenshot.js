(function (global) {
  var OUT_WIDTH_PX = 800;
  var ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

  var STYLE_PROPS = [
    "color",
    "background",
    "background-color",
    "font",
    "font-size",
    "font-weight",
    "font-family",
    "line-height",
    "text-align",
    "padding",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "margin",
    "border",
    "border-radius",
    "display",
    "flex",
    "flex-direction",
    "flex-wrap",
    "align-items",
    "align-self",
    "justify-content",
    "gap",
    "width",
    "height",
    "min-width",
    "min-height",
    "max-width",
    "max-height",
    "opacity",
    "box-sizing",
    "white-space",
    "overflow",
    "position",
    "top",
    "right",
    "bottom",
    "left",
    "grid",
    "grid-template-columns",
  ];

  function buildSystemFileIdentifier(userIdentifier, level) {
    var user = String(userIdentifier ?? "").trim();
    if (!user) return "";
    return user + String(level) + "8.1";
  }

  function systemIdToFilePrefix(systemId) {
    var id = String(systemId ?? "").trim() || "user18.1";
    return id.replace(/8\.1$/i, "81");
  }

  function formatIsoDateAsDdMmYyyyCompact(iso) {
    var m = ISO_RE.exec(String(iso ?? "").trim());
    if (!m) return null;
    return m[3] + m[2] + m[1];
  }

  function formatYmd(d) {
    var y = d.getFullYear();
    var mo = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + mo + "-" + day;
  }

  function maxIsoDate(fromIso, toIso) {
    var from = ISO_RE.test(String(fromIso ?? "").trim()) ? String(fromIso).trim() : "";
    var to = ISO_RE.test(String(toIso ?? "").trim()) ? String(toIso).trim() : "";
    if (from && to) return from > to ? from : to;
    if (to) return to;
    if (from) return from;
    return formatYmd(new Date());
  }

  /** `{id}{L}81_upr{N}_ddmmyyyy.png` — дата = максимум периода на графике. */
  function buildBazaScreenshotFileName(userIdentifier, exerciseVal, fromIso, toIso, level) {
    var levelNum = level === 2 ? 2 : 1;
    var systemId = buildSystemFileIdentifier(userIdentifier, levelNum) || "user" + levelNum + "8.1";
    var prefix = systemIdToFilePrefix(systemId);
    var n = String(exerciseVal ?? "x").replace(/[\\/:*?"<>|]+/g, "_");
    var date =
      formatIsoDateAsDdMmYyyyCompact(maxIsoDate(fromIso, toIso)) ||
      formatIsoDateAsDdMmYyyyCompact(formatYmd(new Date())) ||
      "--------";
    return prefix + "_upr" + n + "_" + date + ".png";
  }

  function copyComputedStyles(source, target) {
    if (!(source instanceof Element) || !(target instanceof Element)) return;
    var computed = global.getComputedStyle(source);
    for (var i = 0; i < STYLE_PROPS.length; i++) {
      var key = STYLE_PROPS[i];
      try {
        target.style.setProperty(key, computed.getPropertyValue(key));
      } catch (_) {
        /* ignore */
      }
    }
    var srcChildren = source.children;
    var tgtChildren = target.children;
    for (var j = 0; j < srcChildren.length && j < tgtChildren.length; j++) {
      copyComputedStyles(srcChildren[j], tgtChildren[j]);
    }
  }

  function elementBackground(el, fallback) {
    try {
      var bg = global.getComputedStyle(el).backgroundColor;
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return bg;
    } catch (_) {
      /* ignore */
    }
    return fallback;
  }

  function domToCanvas(el, fallbackBg) {
    return new Promise(function (resolve, reject) {
      if (!(el instanceof Element)) {
        reject(new Error("missing_capture"));
        return;
      }
      var rect = el.getBoundingClientRect();
      var w = Math.max(1, Math.round(rect.width));
      var h = Math.max(1, Math.round(rect.height));
      if (w < 2 || h < 2) {
        reject(new Error("missing_capture"));
        return;
      }

      var wrapper = document.createElement("div");
      wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
      wrapper.style.width = w + "px";
      wrapper.style.height = h + "px";
      wrapper.style.boxSizing = "border-box";
      wrapper.style.overflow = "hidden";

      var clone = el.cloneNode(true);
      clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
      copyComputedStyles(el, clone);
      wrapper.appendChild(clone);

      var serialized = new XMLSerializer().serializeToString(wrapper);
      var svgMarkup =
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="' +
        w +
        '" height="' +
        h +
        '">' +
        '<foreignObject width="100%" height="100%">' +
        serialized +
        "</foreignObject></svg>";

      var img = new Image();
      var url =
        "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgMarkup);
      img.onload = function () {
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("missing_capture"));
          return;
        }
        ctx.fillStyle = elementBackground(el, fallbackBg || "#0b1220");
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0);
        resolve(canvas);
      };
      img.onerror = function () {
        reject(new Error("missing_capture"));
      };
      img.src = url;
    });
  }

  function svgToCanvas(svgEl, fallbackBg) {
    return new Promise(function (resolve, reject) {
      if (!(svgEl instanceof SVGElement)) {
        reject(new Error("missing_capture"));
        return;
      }
      var svgData = new XMLSerializer().serializeToString(svgEl);
      var img = new Image();
      var url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgData);
      img.onload = function () {
        var w = Math.max(1, img.width || svgEl.clientWidth || 320);
        var h = Math.max(1, img.height || svgEl.clientHeight || 200);
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("missing_capture"));
          return;
        }
        ctx.fillStyle = fallbackBg || "#c5d9dc";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0);
        resolve(canvas);
      };
      img.onerror = function () {
        reject(new Error("missing_capture"));
      };
      img.src = url;
    });
  }

  function stitchCanvasesToWidth(canvases, targetW, gapPx) {
    var gap = gapPx || 0;
    var scaled = canvases.map(function (c) {
      var scale = targetW / Math.max(1, c.width);
      return {
        canvas: c,
        w: targetW,
        h: Math.max(1, Math.round(c.height * scale)),
        scale: scale,
      };
    });
    var totalH = scaled.reduce(function (sum, s, idx) {
      return sum + s.h + (idx ? gap : 0);
    }, 0);
    var out = document.createElement("canvas");
    out.width = targetW;
    out.height = Math.max(1, totalH);
    var ctx = out.getContext("2d");
    if (!ctx) throw new Error("missing_capture");
    var y = 0;
    scaled.forEach(function (s, idx) {
      if (idx) y += gap;
      ctx.drawImage(s.canvas, 0, 0, s.canvas.width, s.canvas.height, 0, y, s.w, s.h);
      y += s.h;
    });
    return out;
  }

  function nodeText(el, selector) {
    if (!(el instanceof Element)) return "";
    var node = selector ? el.querySelector(selector) : el;
    return node ? String(node.textContent || "").trim() : "";
  }

  function drawRoundedRect(ctx, x, y, w, h, r, fill, stroke) {
    var radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawHeadFallbackCanvas(head, targetW) {
    var pad = 16;
    var gap = 8;
    var labelH = 18;
    var rowH = 40;
    var titleH = 28;
    var h = pad + labelH + rowH + gap + labelH + rowH + gap + titleH + pad;
    var canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = h;
    var ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("missing_capture");

    ctx.fillStyle = "#c5d9dc";
    ctx.fillRect(0, 0, targetW, h);

    var fromLabel = nodeText(head, "[data-btca-baza-from]");
    var toLabel = nodeText(head, "[data-btca-baza-to]");
    var exerciseLabel = nodeText(head, "[data-btca-baza-exercise]");
    var taskLabel = nodeText(head, "[data-btca-baza-task]");
    var chartTitle = nodeText(head, ".btca-l1-baza-chart-title");

    var y = pad;
    var faceGap = 8;
    var faceW = (targetW - pad * 2 - faceGap) / 2;

    ctx.fillStyle = "#111111";
    ctx.font = "600 14px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Период", targetW / 2, y + labelH / 2);
    y += labelH;

    drawRoundedRect(ctx, pad, y, faceW, rowH, 12, "#ffffff", "rgba(17, 24, 39, 0.18)");
    drawRoundedRect(ctx, pad + faceW + faceGap, y, faceW, rowH, 12, "#ffffff", "rgba(17, 24, 39, 0.18)");
    ctx.font = "600 16px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText(fromLabel || "—", pad + faceW / 2, y + rowH / 2);
    ctx.fillText(toLabel || "—", pad + faceW + faceGap + faceW / 2, y + rowH / 2);
    y += rowH + gap;

    var taskW = Math.max(72, Math.round((targetW - pad * 2 - faceGap) * 0.28));
    var exW = targetW - pad * 2 - faceGap - taskW;
    ctx.font = "600 14px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText("Упражнение", pad + exW / 2, y + labelH / 2);
    ctx.fillText("Задача", pad + exW + faceGap + taskW / 2, y + labelH / 2);
    y += labelH;
    drawRoundedRect(ctx, pad, y, exW, rowH, 12, "#ffffff", "rgba(17, 24, 39, 0.18)");
    drawRoundedRect(ctx, pad + exW + faceGap, y, taskW, rowH, 12, "#ffffff", "rgba(17, 24, 39, 0.18)");
    ctx.font = "600 16px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText(exerciseLabel || "—", pad + exW / 2, y + rowH / 2);
    ctx.fillText(taskLabel || "—", pad + exW + faceGap + taskW / 2, y + rowH / 2);
    y += rowH + gap;

    ctx.font = "600 17px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText(chartTitle || "", targetW / 2, y + titleH / 2);
    return canvas;
  }

  function captureHeadPanel(head) {
    return domToCanvas(head, "#c5d9dc").catch(function () {
      return drawHeadFallbackCanvas(head, OUT_WIDTH_PX);
    });
  }

  function canvasToPngBlob(canvas) {
    return new Promise(function (resolve, reject) {
      if (!canvas) {
        reject(new Error("missing_capture"));
        return;
      }
      function fromDataUrl() {
        try {
          var dataUrl = canvas.toDataURL("image/png");
          var comma = dataUrl.indexOf(",");
          if (comma < 0) throw new Error("missing_capture");
          var bin = atob(dataUrl.slice(comma + 1));
          var arr = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          resolve(new Blob([arr], { type: "image/png" }));
        } catch (_) {
          reject(new Error("missing_capture"));
        }
      }
      if (typeof canvas.toBlob === "function") {
        canvas.toBlob(
          function (blob) {
            if (blob) resolve(blob);
            else fromDataUrl();
          },
          "image/png",
          1
        );
      } else {
        fromDataUrl();
      }
    });
  }

  function captureChartPanel(panel) {
    return domToCanvas(panel, "#c5d9dc").catch(function () {
      var svg = panel.querySelector(".btca-baza-diagram-plot-area svg");
      var legend = panel.querySelector("[data-btca-baza-diagram-legend]");
      var parts = [];
      if (svg) parts.push(svgToCanvas(svg, "#c5d9dc"));
      if (legend && legend.innerHTML) parts.push(domToCanvas(legend, "#c5d9dc"));
      if (!parts.length) return Promise.reject(new Error("missing_capture"));
      return Promise.all(parts).then(function (canvases) {
        var w = Math.max.apply(
          null,
          canvases.map(function (c) {
            return c.width;
          })
        );
        return stitchCanvasesToWidth(canvases, w, 4);
      });
    });
  }

  /** Фильтры + заголовок графика + диаграмма (как на Android). */
  function captureBazaScreenshotPng(tabRoot) {
    if (!(tabRoot instanceof Element)) return Promise.reject(new Error("missing_capture"));
    var head = tabRoot.querySelector(".btca-l1-baza-head");
    var chartPanel = tabRoot.querySelector(".btca-l1-chart-panel");
    if (!head || !chartPanel) return Promise.reject(new Error("missing_capture"));

    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(resolve);
      });
    })
      .then(function () {
        return Promise.all([captureHeadPanel(head), captureChartPanel(chartPanel)]);
      })
      .then(function (canvases) {
        return stitchCanvasesToWidth(canvases, OUT_WIDTH_PX, 0);
      })
      .then(canvasToPngBlob);
  }

  function isAppleMobile() {
    var nav = global.navigator;
    if (!nav) return false;
    var ua = String(nav.userAgent || "");
    var iPadDesktop = nav.platform === "MacIntel" && nav.maxTouchPoints > 1;
    return /iPhone|iPad|iPod/.test(ua) || iPadDesktop;
  }

  /** iPad/iPhone: «Поделиться» → «Сохранить в Файлы» (без blob:/iframe и без *.html). */
  function saveViaShare(fileName, pngBlob) {
    var FileCtor = global.File;
    if (!FileCtor || !global.navigator || typeof global.navigator.share !== "function") {
      return Promise.reject(new Error("download_failed"));
    }
    var file = new FileCtor([pngBlob], fileName, { type: "application/octet-stream" });
    if (typeof global.navigator.canShare === "function" && !global.navigator.canShare({ files: [file] })) {
      return Promise.reject(new Error("download_failed"));
    }
    return global.navigator.share({ files: [file], title: fileName }).catch(function (err) {
      if (err && err.name === "AbortError") throw new Error("cancelled");
      throw new Error("download_failed");
    });
  }

  function saveViaAnchorBlob(fileName, pngBlob) {
    return new Promise(function (resolve, reject) {
      var downloadBlob = new Blob([pngBlob], { type: "application/octet-stream" });
      var url = URL.createObjectURL(downloadBlob);
      var a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.rel = "noopener";
      a.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
      document.body.appendChild(a);
      try {
        a.click();
      } catch (err) {
        try {
          document.body.removeChild(a);
        } catch (_) {
          /* ignore */
        }
        URL.revokeObjectURL(url);
        reject(err);
        return;
      }
      window.setTimeout(function () {
        try {
          document.body.removeChild(a);
        } catch (_) {
          /* ignore */
        }
        URL.revokeObjectURL(url);
        resolve();
      }, 400);
    });
  }

  function saveBazaScreenshotBlob(fileName, pngBlob) {
    if (!pngBlob) return Promise.reject(new Error("missing_capture"));
    var name = String(fileName || "screenshot.png").replace(/[\\/:*?"<>|]+/g, "_");
    if (!/\.png$/i.test(name)) name += ".png";

    if (isAppleMobile()) {
      return saveViaShare(name, pngBlob);
    }

    if (typeof global.showSaveFilePicker === "function") {
      return global
        .showSaveFilePicker({
          suggestedName: name,
          types: [{ description: "PNG", accept: { "image/png": [".png"] } }],
        })
        .then(function (handle) {
          return handle.createWritable().then(function (writable) {
            return writable.write(pngBlob).then(function () {
              return writable.close();
            });
          });
        })
        .catch(function (err) {
          if (err && err.name === "AbortError") throw new Error("cancelled");
          throw err;
        });
    }

    return saveViaAnchorBlob(name, pngBlob);
  }

  global.BTCA_BAZA_SCREENSHOT = {
    buildBazaScreenshotFileName: buildBazaScreenshotFileName,
    captureBazaScreenshotPng: captureBazaScreenshotPng,
    saveBazaScreenshotBlob: saveBazaScreenshotBlob,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
