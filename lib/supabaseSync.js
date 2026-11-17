/**
 * UNUmbral — lib/supabaseSync.js
 * Sincronización ligera con Supabase REST (sin dependencias externas)
 * Comparte la configuración `atelier_cloud_sync_v1` con Atelier Diario y OMNI ARENA.
 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    const mod = factory();
    root.UNUmbralCloudSync = mod;
    Object.assign(root, mod);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CONFIG_KEY = "atelier_cloud_sync_v1";
  const LAST_SYNC_KEY = "unumbral_last_cloud_sync_v1";

  function normalizeSupabaseUrl(input) {
    const raw = String(input || "").trim().replace(/\/+$/, "");
    const dash = raw.match(/supabase\.com\/dashboard\/project\/([a-z0-9]{15,})/i);
    if (dash) return `https://${dash[1].toLowerCase()}.supabase.co`;
    if (/^[a-z0-9]{15,}$/i.test(raw)) return `https://${raw.toLowerCase()}.supabase.co`;
    const api = raw.match(/^(https:\/\/[a-z0-9-]+\.supabase\.co)/i);
    if (api) return api[1].toLowerCase();
    return raw;
  }

  function getCloudConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          supabaseUrl: normalizeSupabaseUrl(parsed.supabaseUrl || ""),
          supabaseAnonKey: String(parsed.supabaseAnonKey || "").trim(),
          spaceCode: String(parsed.spaceCode || "mi-espacio").trim().toLowerCase() || "mi-espacio",
          autoSync: parsed.autoSync !== false
        };
      }
    } catch {
      // Ignore storage error
    }
    return {
      supabaseUrl: "",
      supabaseAnonKey: "",
      spaceCode: "mi-espacio",
      autoSync: true
    };
  }

  function isCloudConfigured(cfg) {
    const c = cfg || getCloudConfig();
    return Boolean(
      c.supabaseUrl &&
      c.supabaseUrl.startsWith("https://") &&
      c.supabaseAnonKey &&
      c.supabaseAnonKey.length > 20 &&
      c.spaceCode &&
      c.spaceCode.length >= 3
    );
  }

  function saveCloudConfig(next) {
    const clean = {
      supabaseUrl: normalizeSupabaseUrl(next && next.supabaseUrl),
      supabaseAnonKey: String((next && next.supabaseAnonKey) || "").trim(),
      spaceCode: String((next && next.spaceCode) || "mi-espacio").trim().toLowerCase() || "mi-espacio",
      autoSync: next && next.autoSync !== undefined ? Boolean(next.autoSync) : true
    };
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(clean));
    } catch {
      // Ignore storage error
    }
    return clean;
  }

  function importCloudToken(rawText) {
    try {
      const parsed = JSON.parse(String(rawText || "").trim());
      if (!parsed || !parsed.supabaseUrl || !parsed.supabaseAnonKey) return null;
      return saveCloudConfig(parsed);
    } catch {
      return null;
    }
  }

  function getLastCloudSyncAt() {
    try {
      return Number(localStorage.getItem(LAST_SYNC_KEY) || "0") || 0;
    } catch {
      return 0;
    }
  }

  function setLastCloudSyncAt(ts) {
    try {
      localStorage.setItem(LAST_SYNC_KEY, String(Number(ts) || Date.now()));
    } catch {
      // Ignore
    }
  }

  async function pushEcosystemScope(scope, payload, updatedAt) {
    const cfg = getCloudConfig();
    if (!isCloudConfigured(cfg) || typeof fetch !== "function") {
      return { ok: false, message: "Configura Supabase primero." };
    }
    const ts = Number(updatedAt) || Date.now();
    const url = `${cfg.supabaseUrl}/rest/v1/ecosystem_state?on_conflict=space_code,scope`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: cfg.supabaseAnonKey,
          Authorization: `Bearer ${cfg.supabaseAnonKey}`,
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        body: JSON.stringify({
          space_code: cfg.spaceCode,
          scope: scope,
          payload: payload,
          updated_at: ts
        })
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        return { ok: false, message: `Error Supabase (${res.status}): ${txt.slice(0, 120)}` };
      }
      setLastCloudSyncAt(ts);
      return { ok: true, updatedAt: ts, message: `Sincronizado en «${cfg.spaceCode}».` };
    } catch (err) {
      return { ok: false, message: `Sin conexión con Supabase: ${err && err.message ? err.message : "error de red"}` };
    }
  }

  async function pullEcosystemScope(scope) {
    const cfg = getCloudConfig();
    if (!isCloudConfigured(cfg) || typeof fetch !== "function") {
      return { ok: false, row: null, message: "Configura Supabase primero." };
    }
    const url = `${cfg.supabaseUrl}/rest/v1/ecosystem_state?space_code=eq.${encodeURIComponent(cfg.spaceCode)}&scope=eq.${encodeURIComponent(scope)}&select=payload,updated_at&limit=1`;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          apikey: cfg.supabaseAnonKey,
          Authorization: `Bearer ${cfg.supabaseAnonKey}`
        }
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        return { ok: false, row: null, message: `Error Supabase (${res.status}): ${txt.slice(0, 120)}` };
      }
      const rows = await res.json();
      const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      return { ok: true, row, message: row ? "Respaldo encontrado en nube." : "Sin datos previos en nube para este espacio." };
    } catch (err) {
      return { ok: false, row: null, message: `Error de red: ${err && err.message ? err.message : "sin conexión"}` };
    }
  }

  return {
    normalizeSupabaseUrl,
    getCloudConfig,
    isCloudConfigured,
    saveCloudConfig,
    importCloudToken,
    getLastCloudSyncAt,
    setLastCloudSyncAt,
    pushEcosystemScope,
    pullEcosystemScope
  };
});
