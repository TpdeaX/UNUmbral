/**
 * UNUmbral — lib/ecosistema.js
 * Resolutor único de URLs del ecosistema, sincronización de tema (`umbral-theme`)
 * y publicación de resumen de conteos (`unumbral_last_snapshot_v1`).
 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    const mod = factory();
    root.UNUmbralEcosistema = mod;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const THEME_KEY = "umbral-theme";
  const LEGACY_THEME_KEY = "uniflow-theme";
  const SNAPSHOT_KEY = "unumbral_last_snapshot_v1";
  const LEGACY_ATELIER_SNAPSHOT_KEY = "atelier_umbral_snapshot_v1";

  const ECO_APPS = {
    directorio: { port: 5178, route: "/directorio/", label: "Directorio", shortLabel: "Directorio" },
    atelier: { port: 5176, route: "/atelier-diario/", label: "Atelier Diario", shortLabel: "Atelier" },
    unumbral: { port: 5177, route: "/UNUmbral/", label: "UNUmbral", shortLabel: "UNUmbral" },
    arena: { port: 5175, route: "/omni-arena/", label: "OMNI ARENA", shortLabel: "Arena" },
  };

  function normalizeEcoTheme(raw) {
    if (!raw || typeof raw !== "string") return null;
    const v = raw.trim().toLowerCase();
    if (v === "dark" || v === "night") return "dark";
    if (v === "light" || v === "day") return "light";
    return null;
  }

  function isPrivateIp(host) {
    return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host || "");
  }

  function readStoredEcoTheme(storage) {
    const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    if (store) {
      try {
        const direct = normalizeEcoTheme(store.getItem(THEME_KEY));
        if (direct) return direct;
        const legacy = normalizeEcoTheme(store.getItem(LEGACY_THEME_KEY));
        if (legacy) return legacy;
      } catch {
        // Ignore storage error
      }
    }
    if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  }

  function resolveEcoUrl(app, opts) {
    const options = opts || {};
    let targetApp = app;
    let hash = options.hash || "";
    if (targetApp === "calm") {
      targetApp = "atelier";
      if (!hash) hash = "calm";
    }
    const meta = ECO_APPS[targetApp] || ECO_APPS.arena;
    const cleanHash = hash ? `#${String(hash).replace(/^#/, "")}` : "";
    const carryTheme = options.carryTheme !== false;
    const theme = normalizeEcoTheme(options.theme) || readStoredEcoTheme(options.storage);

    const loc = options.location || (typeof window !== "undefined" ? window.location : null);
    const host = (loc && loc.hostname) || "";
    const port = (loc && loc.port !== undefined && loc.port !== null) ? String(loc.port) : "";
    const protocol = (loc && loc.protocol) || "http:";
    const isCapacitor =
      options.isCapacitor !== undefined
        ? Boolean(options.isCapacitor)
        : typeof window !== "undefined" && Boolean(window.Capacitor);

    let base = "";
    let crossOrigin = false;

    if (isCapacitor || (host === "localhost" && port === "")) {
      base = `https://tpdeax.github.io${meta.route}`;
      crossOrigin = true;
    } else if (host.endsWith("github.io")) {
      base = `..${meta.route}`;
      crossOrigin = false;
    } else if (port !== "" && (host === "localhost" || host === "127.0.0.1" || isPrivateIp(host))) {
      base = `${protocol}//${host}:${meta.port}/`;
      crossOrigin = String(meta.port) !== port;
    } else {
      base = `https://tpdeax.github.io${meta.route}`;
      crossOrigin = true;
    }

    if (crossOrigin && carryTheme) {
      const sep = base.includes("?") ? "&" : "?";
      base = `${base}${sep}eco_theme=${theme}`;
    }

    return `${base}${cleanHash}`;
  }

  function applyIncomingEcoTheme(opts) {
    const options = opts || {};
    const store = options.storage || (typeof localStorage !== "undefined" ? localStorage : null);
    const win = options.window || (typeof window !== "undefined" ? window : null);
    const doc = options.document || (typeof document !== "undefined" ? document : null);

    if (win && win.location && win.location.href) {
      try {
        const url = new URL(win.location.href);
        const param = normalizeEcoTheme(url.searchParams.get("eco_theme"));
        if (param && store) {
          store.setItem(THEME_KEY, param);
          store.setItem(LEGACY_THEME_KEY, param);
          url.searchParams.delete("eco_theme");
          if (win.history && typeof win.history.replaceState === "function") {
            const cleanUrl = `${url.pathname}${url.search}${url.hash}`;
            win.history.replaceState(null, "", cleanUrl || "./");
          }
        }
      } catch {
        // Ignore URL errors
      }
    }

    const theme = readStoredEcoTheme(store);
    if (doc && doc.documentElement) {
      doc.documentElement.setAttribute("data-theme", theme);
    }
    return theme;
  }

  function writeUmbralSnapshot(data, storage) {
    const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    if (!store || !data) return null;
    const now = Number(data.updatedAt) || Date.now();
    const snapshot = {
      version: 1,
      updatedAt: now,
      coursesCount: Number(data.coursesCount) || 0,
      pendingTasks: Number(data.pendingTasks) || 0,
      todayClasses: Number(data.todayClasses) || 0,
      cyclesCount: Number(data.cyclesCount) || 0,
    };
    try {
      store.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
      const legacyRaw = store.getItem(LEGACY_ATELIER_SNAPSHOT_KEY);
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        if (parsed && typeof parsed === "object") {
          parsed._updatedAt = now;
          if (Array.isArray(data.cursos)) parsed.cursos = data.cursos;
          if (Array.isArray(data.tareas)) parsed.tareas = data.tareas;
          if (Array.isArray(data.clases)) parsed.clases = data.clases;
          store.setItem(LEGACY_ATELIER_SNAPSHOT_KEY, JSON.stringify(parsed));
        }
      }
    } catch {
      // Ignore storage errors
    }
    return snapshot;
  }

  function updateEcoSwitchLinks(rootDoc, currentApp, opts) {
    const doc = rootDoc || (typeof document !== "undefined" ? document : null);
    if (!doc || typeof doc.querySelectorAll !== "function") return;
    const options = opts || {};

    doc.querySelectorAll("[data-eco-app]").forEach((el) => {
      const app = el.getAttribute("data-eco-app");
      if (!app) return;
      const hash = el.getAttribute("data-eco-hash") || "";
      const href = resolveEcoUrl(app, { ...options, hash });
      el.setAttribute("href", href);
      if (currentApp && el.classList && el.classList.contains("eco-switch-link")) {
        const isCurrent = app === currentApp;
        el.classList.toggle("is-current", isCurrent);
        if (isCurrent) el.setAttribute("aria-current", "page");
        else el.removeAttribute("aria-current");
      }
    });

    const chipMap = [
      ["eco-link-atelier", "atelier", ""],
      ["eco-link-calm", "atelier", "calm"],
      ["eco-link-arena", "arena", ""],
    ];
    chipMap.forEach(([id, app, hash]) => {
      const el = typeof doc.getElementById === "function" ? doc.getElementById(id) : null;
      if (el) {
        el.setAttribute("href", resolveEcoUrl(app, { ...options, hash }));
      }
    });
  }

  return {
    ECO_APPS,
    normalizeEcoTheme,
    readStoredEcoTheme,
    resolveEcoUrl,
    applyIncomingEcoTheme,
    writeUmbralSnapshot,
    updateEcoSwitchLinks,
  };
});
