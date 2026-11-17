// lib/notificaciones.js
// Sistema híbrido de notificaciones: Capacitor LocalNotifications (Android) + Web/PWA (Service Worker & Notification API)

let reprogramarTimer = null;
let webTimers = [];
let webWatchdogInterval = null;
let webListenersRegistrados = false;
let ultimaPlaneacionResumen = {
  modo: "inactivo",
  permiso: "default",
  programadas: 0,
  proxima: null
};

const WEB_FIRED_STORAGE_KEY = "unumbral_fired_web_notifs_v1";
const WEB_WINDOW_MS = 24 * 3600 * 1000;
const WEB_CATCHUP_MS = 5 * 60 * 1000;

function obtenerPlanificadorFn() {
  return window.UNUPlanificador?.planificarNotificaciones ||
    (typeof planificarNotificaciones === "function" ? planificarNotificaciones : null);
}

function leerNotifsWebDisparadas() {
  try {
    const raw = localStorage.getItem(WEB_FIRED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const cutoff = Date.now() - 48 * 3600 * 1000;
    const clean = {};
    for (const [k, ts] of Object.entries(parsed || {})) {
      if (Number(ts) > cutoff) clean[k] = Number(ts);
    }
    return clean;
  } catch {
    return {};
  }
}

function marcarNotifWebDisparada(key) {
  try {
    const map = leerNotifsWebDisparadas();
    map[key] = Date.now();
    localStorage.setItem(WEB_FIRED_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota
  }
}

function claveNotifWeb(n) {
  const ts = new Date(n.cuando).getTime();
  const ref = n.extra?.ref_id || n.canal || "gen";
  return `${ref}_${ts}_${n.titulo}`;
}

function limpiarTimersWeb() {
  for (const tid of webTimers) clearTimeout(tid);
  webTimers = [];
}

async function crearCanalesNotificacion() {
  const LocalNotifications = window.Capacitor?.Plugins?.LocalNotifications;
  if (!LocalNotifications) return;

  try {
    await LocalNotifications.createChannel({
      id: "clases",
      name: "Avisos de Clases",
      description: "Notificaciones antes de cada clase programada",
      importance: 4,
      visibility: 1,
      vibration: true
    });

    await LocalNotifications.createChannel({
      id: "tareas",
      name: "Recordatorios de Tareas",
      description: "Alertas para entregas académicas nivel 1 a 3",
      importance: 3,
      visibility: 1,
      vibration: true
    });

    await LocalNotifications.createChannel({
      id: "resumen",
      name: "Resumen Matutino",
      description: "Resumen diario matutino con las actividades del día",
      importance: 3,
      visibility: 1,
      vibration: false
    });

    await LocalNotifications.createChannel({
      id: "urgente",
      name: "Alertas Urgentes (Nivel 4 y 5)",
      description: "Alertas insistentes de máxima prioridad para exámenes y entregas críticas",
      importance: 5,
      visibility: 1,
      vibration: true
    });
  } catch (err) {
    console.warn("Error creando canales de notificación:", err);
  }
}

async function registrarAccionesNotificacion() {
  const LocalNotifications = window.Capacitor?.Plugins?.LocalNotifications;
  if (!LocalNotifications) return;

  try {
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: "TAREA_ACTIONS",
          actions: [
            { id: "completar", title: "Completada" },
            { id: "posponer", title: "Recordar en 1 h" }
          ]
        }
      ]
    });

    LocalNotifications.addListener("localNotificationActionPerformed", async (action) => {
      const extra = action.notification?.extra || {};
      const actionId = action.actionId;

      if (actionId === "completar" && extra.ref_id) {
        if (typeof db !== "undefined") {
          await db.tareas.update(extra.ref_id, { completada: true });
          if (typeof showToast === "function") showToast("Tarea marcada como completada.");
          reprogramarTodo();
          if (typeof refrescarVistaActual === "function") refrescarVistaActual();
        }
      } else if (actionId === "posponer" && extra.ref_id) {
        const postergada = new Date(Date.now() + 60 * 60000);
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Math.floor(Math.random() * 8000) + 1000,
              title: action.notification.title,
              body: action.notification.body,
              schedule: { at: postergada, allowWhileIdle: true },
              smallIcon: "ic_stat_icon",
              largeIcon: "ic_stat_logo",
              iconColor: "#4F7256",
              channelId: action.notification.channelId || "tareas",
              extra: action.notification.extra
            }
          ]
        });
        if (typeof showToast === "function") showToast("Alerta pospuesta por 1 hora.");
      } else {
        if (extra.tipo === "tarea" && typeof switchTab === "function") {
          switchTab("view-tareas");
        } else if (typeof switchTab === "function") {
          switchTab("view-hoy");
        }
      }
    });
  } catch (err) {
    console.warn("Error registrando listeners de notificación:", err);
  }
}

async function despacharNotificacionWeb(n) {
  if (typeof window === "undefined" || typeof Notification === "undefined") return false;
  if (Notification.permission !== "granted") return false;

  const key = claveNotifWeb(n);
  const fired = leerNotifsWebDisparadas();
  if (fired[key]) return false;
  marcarNotifWebDisparada(key);

  const esTarea = n.extra?.tipo === "tarea" && n.extra?.ref_id;
  const options = {
    body: n.cuerpo || "",
    icon: "./icon-192.png",
    badge: "./icon-64.png",
    tag: n.extra?.ref_id ? `unumbral-${n.extra.tipo}-${n.extra.ref_id}` : `unumbral-${n.canal || "aviso"}`,
    renotify: true,
    requireInteraction: Boolean(n.persistente),
    data: n.extra || {}
  };

  if (esTarea) {
    options.actions = [
      { action: "completar", title: "Completada" },
      { action: "posponer", title: "Posponer 1 h" }
    ];
  }

  let shown = false;
  try {
    if ("serviceWorker" in navigator) {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve) => setTimeout(() => resolve(null), 1200))
      ]);
      if (reg && typeof reg.showNotification === "function") {
        await reg.showNotification(n.titulo, options);
        shown = true;
      }
    }
  } catch {
    // Fallback to Notification constructor
  }

  if (!shown) {
    try {
      const { actions, ...plainOpts } = options;
      const notif = new Notification(n.titulo, plainOpts);
      notif.onclick = () => {
        try { window.focus(); } catch {}
        if (n.extra?.tipo === "tarea" && typeof switchTab === "function") {
          switchTab("view-tareas");
        } else if (typeof switchTab === "function") {
          switchTab("view-hoy");
        }
        notif.close();
      };
      shown = true;
    } catch (err) {
      console.warn("No se pudo mostrar notificación web:", err);
    }
  }

  if (typeof document !== "undefined" && document.visibilityState === "visible" && typeof showToast === "function") {
    showToast(`${n.titulo} · ${n.cuerpo || ""}`.slice(0, 100));
  }

  return shown;
}

function programarTimersWeb(notifsPlaneadas, ahora = new Date()) {
  limpiarTimersWeb();
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;

  const nowMs = ahora.getTime();
  const fired = leerNotifsWebDisparadas();

  for (const n of notifsPlaneadas) {
    const targetMs = new Date(n.cuando).getTime();
    const diff = targetMs - nowMs;
    const key = claveNotifWeb(n);

    if (diff <= 0 && diff >= -WEB_CATCHUP_MS && !fired[key]) {
      void despacharNotificacionWeb(n);
      continue;
    }

    if (diff > 0 && diff <= WEB_WINDOW_MS && !fired[key]) {
      const tid = setTimeout(() => {
        void despacharNotificacionWeb(n);
      }, diff);
      webTimers.push(tid);
    }
  }
}

async function recopilarPlanNotificaciones() {
  if (typeof db === "undefined" || !db.isOpen()) return [];

  const [cursos, clases, tareas, eventos, excepciones, ajustesList] = await Promise.all([
    db.cursos.toArray(),
    db.clases.toArray(),
    db.tareas.toArray(),
    db.eventos ? db.eventos.toArray() : [],
    db.excepciones ? db.excepciones.toArray() : [],
    db.ajustes.toArray()
  ]);

  const defaults = typeof getAjustesDefaults === "function" ? getAjustesDefaults() : {};
  const ajustesMap = { ...defaults };
  ajustesList.forEach(a => { ajustesMap[a.clave] = a.valor; });

  const planificarFn = obtenerPlanificadorFn();
  if (!planificarFn) return [];

  return planificarFn({
    ahora: new Date(),
    cursos,
    clases,
    tareas,
    eventos,
    excepciones,
    ajustes: ajustesMap,
    dias: 14
  });
}

function emitirEventoActualizacionNotifs(resumen) {
  ultimaPlaneacionResumen = resumen;
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    try {
      window.dispatchEvent(new CustomEvent("unumbral-notifs-updated", { detail: resumen }));
    } catch {
      // Ignore in non-DOM test contexts
    }
  }
}

async function obtenerEstadoNotificaciones() {
  const nativo = typeof esNativo === "function" && esNativo();
  if (nativo) {
    const LocalNotifications = window.Capacitor?.Plugins?.LocalNotifications;
    if (!LocalNotifications) {
      return { soportado: false, permiso: "unsupported", modo: "capacitor", ...ultimaPlaneacionResumen };
    }
    try {
      const perm = await LocalNotifications.checkPermissions();
      return {
        soportado: true,
        permiso: perm?.display || "prompt",
        modo: "capacitor",
        programadas: ultimaPlaneacionResumen.programadas || 0,
        proxima: ultimaPlaneacionResumen.proxima || null
      };
    } catch {
      return { soportado: true, permiso: "default", modo: "capacitor", ...ultimaPlaneacionResumen };
    }
  }

  const soportado = typeof window !== "undefined" && "Notification" in window;
  return {
    soportado,
    permiso: soportado ? Notification.permission : "unsupported",
    modo: "web",
    programadas: ultimaPlaneacionResumen.programadas || 0,
    proxima: ultimaPlaneacionResumen.proxima || null
  };
}

async function solicitarPermisoNotificaciones() {
  const nativo = typeof esNativo === "function" && esNativo();
  if (nativo) {
    const LocalNotifications = window.Capacitor?.Plugins?.LocalNotifications;
    if (!LocalNotifications) return { granted: false, state: "unsupported" };
    try {
      let perm = await LocalNotifications.checkPermissions();
      if (perm?.display !== "granted") {
        perm = await LocalNotifications.requestPermissions();
      }
      const granted = perm?.display === "granted";
      if (granted) reprogramarTodo();
      return { granted, state: perm?.display || "denied" };
    } catch {
      return { granted: false, state: "denied" };
    }
  }

  if (typeof window === "undefined" || !("Notification" in window)) {
    return { granted: false, state: "unsupported" };
  }

  let perm = Notification.permission;
  if (perm === "default") {
    perm = await Notification.requestPermission();
  }
  const granted = perm === "granted";
  if (granted) reprogramarTodo();
  else {
    emitirEventoActualizacionNotifs({ ...ultimaPlaneacionResumen, modo: "web", permiso: perm });
  }
  return { granted, state: perm };
}

/**
 * Reconstruye y programa las notificaciones locales (Capacitor o Web/PWA) con debounce.
 */
function reprogramarTodo() {
  if (reprogramarTimer) clearTimeout(reprogramarTimer);

  reprogramarTimer = setTimeout(async () => {
    try {
      if (typeof db === "undefined" || !db.isOpen()) return;
      const notifsPlaneadas = await recopilarPlanNotificaciones();
      const proxima = notifsPlaneadas.length > 0 ? notifsPlaneadas[0] : null;
      const nativo = typeof esNativo === "function" && esNativo();

      if (nativo) {
        const LocalNotifications = window.Capacitor?.Plugins?.LocalNotifications;
        if (!LocalNotifications) return;

        const perm = await LocalNotifications.checkPermissions().catch(() => ({ display: "prompt" }));
        if (perm?.display !== "granted") {
          emitirEventoActualizacionNotifs({
            modo: "capacitor",
            permiso: perm?.display || "prompt",
            programadas: 0,
            proxima
          });
          return;
        }

        const pending = await LocalNotifications.getPending();
        if (pending && Array.isArray(pending.notifications) && pending.notifications.length > 0) {
          await LocalNotifications.cancel({ notifications: pending.notifications });
        }

        if (notifsPlaneadas.length > 0) {
          const payload = notifsPlaneadas.map(n => ({
            id: n.id,
            title: n.titulo,
            body: n.cuerpo,
            channelId: n.canal,
            ongoing: n.persistente,
            autoCancel: !n.persistente,
            smallIcon: "ic_stat_icon",
            largeIcon: "ic_stat_logo",
            iconColor: "#4F7256",
            actionTypeId: n.extra?.tipo === "tarea" ? "TAREA_ACTIONS" : undefined,
            schedule: { at: n.cuando, allowWhileIdle: true },
            extra: n.extra
          }));

          await LocalNotifications.schedule({ notifications: payload });
          console.log(`[notificaciones] ${payload.length} alertas locales programadas (Capacitor).`);
        }

        emitirEventoActualizacionNotifs({
          modo: "capacitor",
          permiso: "granted",
          programadas: notifsPlaneadas.length,
          proxima
        });
        return;
      }

      // Modo Web / PWA
      const soportado = typeof window !== "undefined" && "Notification" in window;
      const permiso = soportado ? Notification.permission : "unsupported";
      if (permiso === "granted") {
        programarTimersWeb(notifsPlaneadas, new Date());
        console.log(`[notificaciones] ${notifsPlaneadas.length} alertas planeadas (Web/PWA).`);
      } else {
        limpiarTimersWeb();
      }

      emitirEventoActualizacionNotifs({
        modo: "web",
        permiso,
        programadas: permiso === "granted" ? notifsPlaneadas.length : 0,
        proxima
      });
    } catch (err) {
      console.warn("Error en reprogramarTodo:", err);
    }
  }, 400);
}

async function dispararNotificacionInmediata(titulo, cuerpo, canal = "urgente") {
  const nativo = typeof esNativo === "function" && esNativo();
  if (nativo) {
    const LocalNotifications = window.Capacitor?.Plugins?.LocalNotifications;
    if (!LocalNotifications) return false;
    try {
      const hasPerm = await LocalNotifications.checkPermissions();
      if (hasPerm.display !== "granted") {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== "granted") return false;
      }
      const notifId = Math.floor(Date.now() % 2147483647);
      await LocalNotifications.schedule({
        notifications: [{
          id: notifId,
          title: titulo,
          body: cuerpo,
          channelId: canal,
          smallIcon: "ic_stat_icon",
          largeIcon: "ic_stat_logo",
          iconColor: "#4F7256",
          schedule: { at: new Date(Date.now() + 500) }
        }]
      });
      return true;
    } catch (err) {
      console.warn("Error enviando notificación inmediata Capacitor:", err);
      return false;
    }
  }

  // Modo Web / PWA
  const { granted } = await solicitarPermisoNotificaciones();
  if (!granted) return false;
  return despacharNotificacionWeb({
    cuando: new Date(),
    canal,
    titulo,
    cuerpo,
    persistente: false,
    extra: { tipo: "prueba", ref_id: `test_${Date.now()}` }
  });
}

function registrarListenersWebNotificaciones() {
  if (webListenersRegistrados || typeof window === "undefined") return;
  webListenersRegistrados = true;

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        reprogramarTodo();
      }
    });
  }

  window.addEventListener("focus", () => {
    reprogramarTodo();
  });

  if ("serviceWorker" in navigator && navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener("message", async (event) => {
      const msg = event?.data;
      if (!msg || msg.type !== "UNUMBRAL_NOTIF_ACTION") return;
      const { action, extra } = msg;
      if (action === "completar" && extra?.ref_id && typeof db !== "undefined") {
        await db.tareas.update(extra.ref_id, { completada: true });
        if (typeof showToast === "function") showToast("Tarea marcada como completada.");
        reprogramarTodo();
        if (typeof refrescarVistaActual === "function") refrescarVistaActual();
      } else if (action === "posponer" && extra?.ref_id) {
        setTimeout(() => {
          void despacharNotificacionWeb({
            cuando: new Date(),
            canal: "tareas",
            titulo: msg.title || "Recordatorio de tarea",
            cuerpo: msg.body || "Entrega pendiente",
            persistente: false,
            extra
          });
        }, 60 * 60000);
        if (typeof showToast === "function") showToast("Recordatorio pospuesto 1 hora.");
      }
    });
  }

  if (!webWatchdogInterval) {
    webWatchdogInterval = setInterval(() => {
      reprogramarTodo();
    }, 15 * 60 * 1000);
  }
}

async function inicializarSistemaNotificaciones() {
  if (typeof esNativo === "function" && esNativo()) {
    await crearCanalesNotificacion();
    await registrarAccionesNotificacion();
    await solicitarPermisoNotificaciones();
    reprogramarTodo();
    return;
  }

  registrarListenersWebNotificaciones();
  reprogramarTodo();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    reprogramarTodo,
    crearCanalesNotificacion,
    registrarAccionesNotificacion,
    inicializarSistemaNotificaciones,
    dispararNotificacionInmediata,
    solicitarPermisoNotificaciones,
    obtenerEstadoNotificaciones,
    programarTimersWeb,
    despacharNotificacionWeb
  };
} else if (typeof window !== "undefined") {
  window.reprogramarTodo = reprogramarTodo;
  window.inicializarSistemaNotificaciones = inicializarSistemaNotificaciones;
  window.dispararNotificacionInmediata = dispararNotificacionInmediata;
  window.solicitarPermisoNotificaciones = solicitarPermisoNotificaciones;
  window.obtenerEstadoNotificaciones = obtenerEstadoNotificaciones;
}
