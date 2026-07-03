(function (global) {
  var TRANSITION_MS = 260;

  function hostHtml(modifierClass, panelClass, panelAttrs, innerHtml) {
    var mod = modifierClass ? " " + modifierClass : "";
    return (
      '<div class="btca-level1-slide-menu-host' + mod + '">' +
      '<div class="btca-level1-slide-menu-panel ' + panelClass + '"' + (panelAttrs || "") + ">" +
      innerHtml +
      "</div></div>"
    );
  }

  function openHost(layer) {
    var host = layer && layer.querySelector(".btca-level1-slide-menu-host");
    if (!host) return;
    host.classList.remove("btca-level1-slide-menu-host--open");
    void host.offsetWidth;
    requestAnimationFrame(function () {
      host.classList.add("btca-level1-slide-menu-host--open");
    });
  }

  function closeLayer(layer, done) {
    if (!layer) {
      if (done) done();
      return;
    }
    var host = layer.querySelector(".btca-level1-slide-menu-host");
    if (!host || !host.classList.contains("btca-level1-slide-menu-host--open")) {
      layer.setAttribute("hidden", "hidden");
      layer.innerHTML = "";
      if (done) done();
      return;
    }
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      layer.setAttribute("hidden", "hidden");
      layer.innerHTML = "";
      if (done) done();
    }
    host.classList.remove("btca-level1-slide-menu-host--open");
    var panel = host.querySelector(".btca-level1-slide-menu-panel");
    if (panel) {
      panel.addEventListener("transitionend", function onEnd(e) {
        if (e.propertyName !== "transform") return;
        panel.removeEventListener("transitionend", onEnd);
        finish();
      });
    }
    global.setTimeout(finish, TRANSITION_MS + 50);
  }

  function positionHostBelow(root, triggerSelector, layer) {
    var btn = root && root.querySelector(triggerSelector);
    var host = layer && layer.querySelector(".btca-level1-slide-menu-host");
    if (!btn || !host) return;
    var gap = 6;
    host.style.top = Math.round(btn.getBoundingClientRect().bottom + gap) + "px";
  }

  global.BTCA_SLIDE_MENU = {
    hostHtml: hostHtml,
    openLayer: function (layer) {
      openHost(layer);
    },
    closeLayer: closeLayer,
    positionHostBelow: positionHostBelow,
  };
})(typeof window !== "undefined" ? window : globalThis);
