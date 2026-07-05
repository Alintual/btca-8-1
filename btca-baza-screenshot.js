(function (global) {
  var OUT_WIDTH_PX = 800;
  var ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

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
      var url = URL.createObjectURL(new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" }));
      img.onload = function () {
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error("missing_capture"));
          return;
        }
        ctx.fillStyle = elementBackground(el, fallbackBg || "#0b1220");
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve(canvas);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
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
      var blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      img.onload = function () {
        var w = Math.max(1, img.width || svgEl.clientWidth || 320);
        var h = Math.max(1, img.height || svgEl.clientHeight || 200);
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error("missing_capture"));
          return;
        }
        ctx.fillStyle = fallbackBg || "#c5d9dc";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve(canvas);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
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
        return Promise.all([domToCanvas(head, "#0b1220"), captureChartPanel(chartPanel)]);
      })
      .then(function (canvases) {
        return stitchCanvasesToWidth(canvases, OUT_WIDTH_PX, 0);
      })
      .then(function (canvas) {
        return new Promise(function (resolve, reject) {
          canvas.toBlob(
            function (blob) {
              if (!blob) reject(new Error("missing_capture"));
              else resolve(blob);
            },
            "image/png",
            1
          );
        });
      });
  }

  global.BTCA_BAZA_SCREENSHOT = {
    buildBazaScreenshotFileName: buildBazaScreenshotFileName,
    captureBazaScreenshotPng: captureBazaScreenshotPng,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
