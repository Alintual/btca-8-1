(function (global) {
  var OUT_WIDTH_PX = 800;
  var ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  var HEAD_BG = "#1f4f5c";
  var CHART_PANEL_BG = "#c5d9dc";
  var ARROW_GREEN_FILTER =
    "brightness(0) saturate(100%) invert(48%) sepia(79%) saturate(2000%) hue-rotate(86deg) brightness(84%) contrast(96%)";
  var ARROW_PURPLE_FILTER =
    "brightness(0) saturate(100%) invert(33%) sepia(85%) saturate(4000%) hue-rotate(272deg) brightness(84%) contrast(96%)";
  var ARROW_DISABLED_FILTER =
    "brightness(0) saturate(100%) invert(15%) sepia(5%) saturate(500%) hue-rotate(180deg) brightness(95%) contrast(90%)";

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
    "filter",
    "transform",
    "object-fit",
  ];

  function brandingUrl(file) {
    var base = global.__BTCA_BASE__ || "/btca-8-1/";
    if (!/\/$/.test(base)) base += "/";
    return base + "branding/" + file;
  }

  function loadImageUrl(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        reject(new Error("image_load"));
      };
      img.src = src;
    });
  }

  function inlineImagesInTree(root) {
    if (!(root instanceof Element)) return Promise.resolve();
    var imgs = root.querySelectorAll("img");
    var tasks = [];
    for (var i = 0; i < imgs.length; i++) {
      (function (img) {
        var src = img.getAttribute("src") || "";
        if (!src || src.indexOf("data:") === 0) return;
        tasks.push(
          fetch(src)
            .then(function (res) {
              if (!res.ok) throw new Error("image_fetch");
              return res.blob();
            })
            .then(function (blob) {
              return new Promise(function (resolve) {
                var reader = new FileReader();
                reader.onload = function () {
                  if (reader.result) img.setAttribute("src", String(reader.result));
                  resolve();
                };
                reader.onerror = function () {
                  resolve();
                };
                reader.readAsDataURL(blob);
              });
            })
            .catch(function () {
              /* keep original src */
            })
        );
      })(imgs[i]);
    }
    return Promise.all(tasks);
  }

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

  function resolveElementBackground(el, fallback) {
    var node = el;
    while (node instanceof Element) {
      var bg = elementBackground(node, null);
      if (bg) return bg;
      node = node.parentElement;
    }
    return fallback || HEAD_BG;
  }

  function domToCanvas(el, fallbackBg, opts) {
    opts = opts || {};
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

      var bg = resolveElementBackground(el, fallbackBg || HEAD_BG);

      var wrapper = document.createElement("div");
      wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
      wrapper.style.width = w + "px";
      wrapper.style.height = h + "px";
      wrapper.style.boxSizing = "border-box";
      wrapper.style.overflow = "hidden";
      wrapper.style.backgroundColor = bg;

      var clone = el.cloneNode(true);
      clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
      copyComputedStyles(el, clone);
      clone.style.backgroundColor = bg;
      if (opts.hideSelectors) {
        opts.hideSelectors.forEach(function (sel) {
          var hidden = clone.querySelectorAll(sel);
          for (var k = 0; k < hidden.length; k++) hidden[k].style.visibility = "hidden";
        });
      }
      wrapper.appendChild(clone);

      inlineImagesInTree(clone)
        .then(function () {
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
          var url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgMarkup);
          img.onload = function () {
            var canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext("2d");
            if (!ctx) {
              reject(new Error("missing_capture"));
              return;
            }
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0);
            resolve(canvas);
          };
          img.onerror = function () {
            reject(new Error("missing_capture"));
          };
          img.src = url;
        })
        .catch(function () {
          reject(new Error("missing_capture"));
        });
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
        ctx.fillStyle = fallbackBg || CHART_PANEL_BG;
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

  function stitchCanvasesToWidth(canvases, targetW, gapPx, bgColor) {
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
    ctx.fillStyle = bgColor || HEAD_BG;
    ctx.fillRect(0, 0, out.width, out.height);
    var y = 0;
    scaled.forEach(function (s, idx) {
      if (idx) y += gap;
      ctx.drawImage(s.canvas, 0, 0, s.canvas.width, s.canvas.height, 0, y, s.w, s.h);
      y += s.h;
    });
    return out;
  }

  function scaleCanvasToWidth(canvas, targetW, bgColor) {
    if (Math.abs(canvas.width - targetW) < 1) return canvas;
    var scale = targetW / Math.max(1, canvas.width);
    var h = Math.max(1, Math.round(canvas.height * scale));
    var out = document.createElement("canvas");
    out.width = targetW;
    out.height = h;
    var ctx = out.getContext("2d");
    if (!ctx) throw new Error("missing_capture");
    ctx.fillStyle = bgColor || HEAD_BG;
    ctx.fillRect(0, 0, targetW, h);
    ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, targetW, h);
    return out;
  }

  function rectRel(el, rootRect, scale) {
    var r = el.getBoundingClientRect();
    return {
      x: (r.left - rootRect.left) * scale,
      y: (r.top - rootRect.top) * scale,
      w: r.width * scale,
      h: r.height * scale,
    };
  }

  function parsePx(value, scale) {
    var m = /^([\d.]+)px$/.exec(String(value || "").trim());
    return m ? parseFloat(m[1]) * scale : 0;
  }

  function fontFromEl(el, scale) {
    var cs = global.getComputedStyle(el);
    var px = parseFloat(cs.fontSize) * scale;
    var weight = cs.fontWeight || "400";
    var family = cs.fontFamily || "system-ui, sans-serif";
    return weight + " " + px + "px " + family;
  }

  function drawCenteredTextInRect(ctx, text, rect, font, color) {
    ctx.save();
    ctx.font = font;
    ctx.fillStyle = color || "#111827";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.restore();
  }

  function wrapTextLines(ctx, text, maxWidth) {
    var words = String(text || "").split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    var lines = [];
    var line = words[0];
    for (var i = 1; i < words.length; i++) {
      var test = line + " " + words[i];
      if (ctx.measureText(test).width <= maxWidth) line = test;
      else {
        lines.push(line);
        line = words[i];
      }
    }
    lines.push(line);
    return lines;
  }

  function drawWrappedCenteredText(ctx, text, box, font, color, lineHeightPx) {
    ctx.save();
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var lines = wrapTextLines(ctx, text, Math.max(1, box.w - 4));
    var lh = lineHeightPx || parseFloat(font) || 20;
    var totalH = lines.length * lh;
    var startY = box.y + (box.h - totalH) / 2 + lh / 2;
    for (var i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], box.x + box.w / 2, startY + i * lh);
    }
    ctx.restore();
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

  function drawMeasuredFace(ctx, faceEl, rootRect, scale) {
    if (!(faceEl instanceof Element)) return;
    var rect = rectRel(faceEl, rootRect, scale);
    var cs = global.getComputedStyle(faceEl);
    var radius = parsePx(cs.borderTopLeftRadius, 1);
    var opacity = parseFloat(cs.opacity);
    if (faceEl.classList.contains("btca-l1-face--disabled")) opacity = Math.min(isFinite(opacity) ? opacity : 1, 0.55);
    ctx.save();
    ctx.globalAlpha = isFinite(opacity) ? opacity : 1;
    drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, radius, cs.backgroundColor || "#ffffff", "rgba(17, 24, 39, 0.18)");
    ctx.restore();

    var textEl = faceEl.querySelector(".btca-l1-face__text");
    if (textEl) {
      drawCenteredTextInRect(
        ctx,
        textEl.textContent.trim(),
        rectRel(textEl, rootRect, scale),
        fontFromEl(textEl, scale),
        cs.color
      );
    }
    var iconEl = faceEl.querySelector(".btca-l1-period-face__icon");
    if (iconEl) {
      drawCenteredTextInRect(
        ctx,
        iconEl.textContent.trim(),
        rectRel(iconEl, rootRect, scale),
        fontFromEl(iconEl, scale),
        cs.color
      );
    }
    var chevronEl = faceEl.querySelector(".btca-l1-face__chevron");
    if (chevronEl) {
      var chCs = global.getComputedStyle(chevronEl);
      drawCenteredTextInRect(
        ctx,
        chevronEl.textContent.trim(),
        rectRel(chevronEl, rootRect, scale),
        fontFromEl(chevronEl, scale),
        chCs.color
      );
    }
  }

  function drawMeasuredLabel(ctx, labelEl, rootRect, scale) {
    if (!(labelEl instanceof Element)) return;
    var cs = global.getComputedStyle(labelEl);
    drawCenteredTextInRect(
      ctx,
      labelEl.textContent.trim(),
      rectRel(labelEl, rootRect, scale),
      fontFromEl(labelEl, scale),
      cs.color
    );
  }

  function drawHeadMeasuredCanvas(head, targetW) {
    var headRect = head.getBoundingClientRect();
    var scale = targetW / Math.max(1, headRect.width);
    var h = Math.max(1, Math.round(headRect.height * scale));
    var canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = h;
    var ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("missing_capture");
    ctx.fillStyle = HEAD_BG;
    ctx.fillRect(0, 0, targetW, h);

    var labels = head.querySelectorAll(".btca-l1-field-label");
    for (var i = 0; i < labels.length; i++) drawMeasuredLabel(ctx, labels[i], headRect, scale);

    var faces = head.querySelectorAll(".btca-l1-face");
    for (var j = 0; j < faces.length; j++) drawMeasuredFace(ctx, faces[j], headRect, scale);

    var titleEl = head.querySelector(".btca-l1-baza-chart-title");
    if (titleEl) {
      var tcs = global.getComputedStyle(titleEl);
      var box = rectRel(titleEl, headRect, scale);
      var lh = parseFloat(tcs.lineHeight);
      if (!isFinite(lh) || lh <= 0) lh = parseFloat(tcs.fontSize) * 1.4;
      drawWrappedCenteredText(
        ctx,
        titleEl.textContent.trim(),
        box,
        fontFromEl(titleEl, scale),
        tcs.color,
        lh * scale
      );
    }
    return canvas;
  }

  function drawArrowOnHeadCanvasMeasured(head, canvas, targetW) {
    var ctx = canvas.getContext("2d");
    if (!ctx) return Promise.resolve(canvas);
    var arrowEl = head.querySelector(".btca-l1-green-arrow__img");
    if (!arrowEl) return Promise.resolve(canvas);
    var headRect = head.getBoundingClientRect();
    var scale = targetW / Math.max(1, headRect.width);
    var r = arrowEl.getBoundingClientRect();
    var cx = (r.left - headRect.left + r.width / 2) * scale;
    var cy = (r.top - headRect.top + r.height / 2) * scale;
    var size = Math.max(r.width, r.height) * scale;
    var src = arrowEl.getAttribute("src") || brandingUrl("up.png");
    var disabled = !!head.querySelector(".btca-l1-green-arrow--disabled");
    var isL2 = document.body && document.body.classList.contains("btca-level2-mode");
    return loadImageUrl(src)
      .then(function (img) {
        ctx.save();
        if (disabled) {
          ctx.globalAlpha = 0.35;
          ctx.filter = ARROW_DISABLED_FILTER;
        } else {
          ctx.filter = isL2 ? ARROW_PURPLE_FILTER : ARROW_GREEN_FILTER;
        }
        ctx.translate(cx, cy);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(img, -size / 2, -size / 2, size, size);
        ctx.restore();
        return canvas;
      })
      .catch(function () {
        return canvas;
      });
  }

  function drawHeadMeasuredCanvasAsync(head, targetW) {
    return drawArrowOnHeadCanvasMeasured(head, drawHeadMeasuredCanvas(head, targetW), targetW);
  }

  /** DOM-захват с масштабированием до 800px; стрелка up.png — поверх по измеренным координатам. */
  function captureHeadPanel(head) {
    return domToCanvas(head, HEAD_BG, { hideSelectors: [".btca-l1-green-arrow", ".btca-l1-green-arrow__img"] })
      .then(function (canvas) {
        return scaleCanvasToWidth(canvas, OUT_WIDTH_PX, HEAD_BG);
      })
      .then(function (canvas) {
        return drawArrowOnHeadCanvasMeasured(head, canvas, OUT_WIDTH_PX);
      })
      .catch(function () {
        return drawHeadMeasuredCanvasAsync(head, OUT_WIDTH_PX);
      });
  }

  function wrapChartPanelCanvas(contentCanvas, targetW) {
    var padX = 12;
    var padY = 10;
    var innerW = Math.max(1, targetW - padX * 2);
    var scaledH = Math.max(1, Math.round(contentCanvas.height * (innerW / Math.max(1, contentCanvas.width))));
    var totalH = padY * 2 + scaledH;
    var out = document.createElement("canvas");
    out.width = targetW;
    out.height = totalH;
    var ctx = out.getContext("2d");
    if (!ctx) throw new Error("missing_capture");
    drawRoundedRect(ctx, 0, 0, targetW, totalH, 16, CHART_PANEL_BG, null);
    ctx.drawImage(contentCanvas, padX, padY, innerW, scaledH);
    return out;
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
    return domToCanvas(panel, CHART_PANEL_BG).catch(function () {
      var svg = panel.querySelector(".btca-baza-diagram-plot-area svg");
      var legend = panel.querySelector("[data-btca-baza-diagram-legend]");
      var parts = [];
      if (svg) parts.push(svgToCanvas(svg, CHART_PANEL_BG));
      if (legend && legend.innerHTML) parts.push(domToCanvas(legend, CHART_PANEL_BG));
      if (!parts.length) return Promise.reject(new Error("missing_capture"));
      return Promise.all(parts).then(function (canvases) {
        var w = Math.max.apply(
          null,
          canvases.map(function (c) {
            return c.width;
          })
        );
        return stitchCanvasesToWidth(canvases, w, 4, CHART_PANEL_BG);
      }).then(function (canvas) {
        return wrapChartPanelCanvas(canvas, OUT_WIDTH_PX);
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
        return stitchCanvasesToWidth(canvases, OUT_WIDTH_PX, 0, HEAD_BG);
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
    var file = new FileCtor([pngBlob], fileName, { type: "image/png" });
    if (typeof global.navigator.canShare === "function" && !global.navigator.canShare({ files: [file] })) {
      return Promise.reject(new Error("download_failed"));
    }
    return global.navigator.share({ files: [file] }).catch(function (err) {
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
