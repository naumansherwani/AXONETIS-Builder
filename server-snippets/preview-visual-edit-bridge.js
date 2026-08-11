// ============================================================
// AXONETIS™ Preview Visual Edit Bridge
// Paste into each preview app before </body> OR import once in its root.
// Required by Builder Phase 3.9.5:
//   listens: visual:edit:toggle
//   emits:   visual:edit:pick
// Sources emitted by hostname:
//   hostflow-preview | anexvotaipay-preview | axonetis-preview
// ============================================================
(function axonetisPreviewVisualBridge() {
  if (window.__AXONETIS_VISUAL_EDIT_BRIDGE__) return;
  window.__AXONETIS_VISUAL_EDIT_BRIDGE__ = true;

  var enabled = false;
  var parentOrigin = "*";
  var overlay = null;
  var lastTarget = null;

  function sourceName() {
    var host = location.hostname.toLowerCase();
    if (host.includes("anexvot") || host.includes("rapidpay")) return "anexvotaipay-preview";
    if (host.includes("builder") || host.includes("axon") || host.includes("aiaxonetis")) return "axonetis-preview";
    return "hostflow-preview";
  }

  function cssPath(el) {
    if (!el || el.nodeType !== 1) return "";
    if (el.id) return "#" + CSS.escape(el.id);
    var parts = [];
    while (el && el.nodeType === 1 && el !== document.body && parts.length < 6) {
      var name = el.nodeName.toLowerCase();
      var cls = String(el.className || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
      if (cls.length) name += "." + cls.map(function (c) { return CSS.escape(c); }).join(".");
      var parent = el.parentElement;
      if (parent) {
        var same = Array.prototype.filter.call(parent.children, function (x) { return x.nodeName === el.nodeName; });
        if (same.length > 1) name += ":nth-of-type(" + (same.indexOf(el) + 1) + ")";
      }
      parts.unshift(name);
      el = parent;
    }
    return parts.join(" > ");
  }

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.cssText = [
      "position:fixed",
      "z-index:2147483647",
      "pointer-events:none",
      "border:2px solid #E50914",
      "box-shadow:0 0 0 9999px rgba(229,9,20,.08),0 0 24px rgba(229,9,20,.55)",
      "border-radius:6px",
      "display:none",
      "transition:all 80ms ease"
    ].join(";");
    document.documentElement.appendChild(overlay);
    return overlay;
  }

  function highlight(el) {
    if (!enabled || !el || el === document.documentElement || el === document.body) return;
    lastTarget = el;
    var r = el.getBoundingClientRect();
    var o = ensureOverlay();
    o.style.display = "block";
    o.style.left = r.left + "px";
    o.style.top = r.top + "px";
    o.style.width = r.width + "px";
    o.style.height = r.height + "px";
  }

  function disable() {
    enabled = false;
    document.documentElement.style.cursor = "";
    if (overlay) overlay.style.display = "none";
  }

  function pick(el) {
    if (!enabled || !el) return;
    var rect = el.getBoundingClientRect();
    var payload = {
      selector: cssPath(el),
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || el.textContent || "").trim().slice(0, 240),
      path: location.pathname + location.search,
      href: el.getAttribute("href") || null,
      ariaLabel: el.getAttribute("aria-label") || null,
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
    };
    window.parent && window.parent.postMessage({
      source: sourceName(),
      type: "visual:edit:pick",
      payload: payload,
      url: location.href,
      sentAt: Date.now()
    }, parentOrigin);
    disable();
  }

  window.addEventListener("message", function (event) {
    var data = event.data || {};
    if (data.source !== "axonetis-builder" || data.type !== "visual:edit:toggle") return;
    parentOrigin = event.origin || "*";
    enabled = !!data.enabled;
    document.documentElement.style.cursor = enabled ? "crosshair" : "";
    if (!enabled && overlay) overlay.style.display = "none";
    window.parent && window.parent.postMessage({
      source: sourceName(),
      type: enabled ? "visual:edit:ready" : "visual:edit:off",
      url: location.href,
      sentAt: Date.now()
    }, parentOrigin);
  });

  document.addEventListener("mousemove", function (e) {
    if (!enabled) return;
    highlight(e.target);
  }, true);

  document.addEventListener("click", function (e) {
    if (!enabled) return;
    e.preventDefault();
    e.stopPropagation();
    pick(e.target || lastTarget);
  }, true);

  document.addEventListener("keydown", function (e) {
    if (enabled && e.key === "Escape") disable();
  }, true);
})();

// ============================================================
// AXONETIS™ Preview LIVE BRIDGE (handshake + route sync + errors)
// Builder expects (src/lib/preview-bridge.ts):
//   in : bridge:handshake | bridge:ping | hmr:reload
//   out: bridge:ready | bridge:pong | route:change | dom:click | runtime:error
// Ye block wahi file mein rehta hai jo preview app load karti hai.
// ============================================================
(function axonetisPreviewLiveBridge() {
  if (window.__AXONETIS_LIVE_BRIDGE__) return;
  window.__AXONETIS_LIVE_BRIDGE__ = true;

  var parentOrigin = "*";
  var projectId = null;

  function sourceName() {
    var host = location.hostname.toLowerCase();
    if (host.includes("anexvot") || host.includes("rapidpay")) return "anexvotaipay-preview";
    if (host.includes("builder") || host.includes("axon") || host.includes("aiaxonetis")) return "axonetis-preview";
    return "hostflow-preview";
  }

  function emit(type, extra) {
    if (!window.parent || window.parent === window) return;
    var msg = {
      source: sourceName(),
      type: type,
      projectId: projectId,
      url: location.href,
      sentAt: Date.now(),
    };
    if (extra) for (var k in extra) msg[k] = extra[k];
    try {
      window.parent.postMessage(msg, parentOrigin);
      if (parentOrigin !== "*") window.parent.postMessage(msg, "*");
    } catch (e) {
      /* ignore */
    }
  }

  window.addEventListener("message", function (event) {
    var data = event.data || {};
    if (data.source !== "axonetis-builder") return;
    if (event.origin) parentOrigin = event.origin;
    if (data.projectId) projectId = data.projectId;

    if (data.type === "bridge:handshake") {
      emit("bridge:ready", {
        payload: {
          capabilities: ["route:change", "dom:click", "runtime:error", "hmr:reload", "visual:edit"],
          userAgent: navigator.userAgent,
        },
      });
    } else if (data.type === "bridge:ping") {
      emit("bridge:pong");
    } else if (data.type === "hmr:reload") {
      emit("hmr:reload");
      location.reload();
    }
  });

  // Builder ke handshake se pehle bhi ready bhejna — race khatam.
  function announce() {
    emit("bridge:ready", { payload: { capabilities: ["route:change", "runtime:error"] } });
  }
  if (document.readyState === "complete" || document.readyState === "interactive") announce();
  else document.addEventListener("DOMContentLoaded", announce);
  var beats = 0;
  var beat = setInterval(function () {
    beats += 1;
    emit("bridge:pong");
    if (beats > 8) clearInterval(beat);
  }, 900);

  // ── Route sync (SPA + history API) ─────────────────────────
  var lastPath = location.pathname + location.search + location.hash;
  function routeChanged() {
    var next = location.pathname + location.search + location.hash;
    if (next === lastPath) return;
    lastPath = next;
    emit("route:change", { url: next });
  }
  ["pushState", "replaceState"].forEach(function (fn) {
    var orig = history[fn];
    history[fn] = function () {
      var out = orig.apply(this, arguments);
      setTimeout(routeChanged, 0);
      return out;
    };
  });
  window.addEventListener("popstate", routeChanged);
  window.addEventListener("hashchange", routeChanged);

  // ── Click telemetry (link/button only, no PII) ─────────────
  document.addEventListener(
    "click",
    function (e) {
      var el = e.target && e.target.closest ? e.target.closest("a,button,[role=button]") : null;
      if (!el) return;
      emit("dom:click", {
        url: (el.getAttribute("href") || el.getAttribute("aria-label") || el.tagName).toString().slice(0, 120),
      });
    },
    true,
  );

  // ── Runtime errors → Builder logs/chat ─────────────────────
  window.addEventListener("error", function (e) {
    emit("runtime:error", {
      message: String((e && e.message) || "error"),
      payload: { file: e.filename || null, line: e.lineno || null, col: e.colno || null },
    });
  });
  window.addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason;
    emit("runtime:error", {
      message: String((r && (r.message || r)) || "unhandled rejection"),
    });
  });
})();
