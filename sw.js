// Service Worker para funcionamiento 100% offline con actualización en segundo plano y notificaciones PWA
const CACHE_NAME = "unumbral-tpdeax-v6";
const ASSETS = [
  "./",
  "./index.html",
  "./estilos.css",
  "./app.js",
  "./manifest.json",
  "./icon-64.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon.png",
  "./lib/dexie.min.js",
  "./lib/ecosistema.js",
  "./lib/supabaseSync.js",
  "./lib/plataforma.js",
  "./lib/ajustes.js",
  "./lib/planificador.js",
  "./lib/notificaciones.js",
  "./lib/miHorario2026II.js",
  "./lib/icsExport.js",
  "./lib/asistencia.js",
  "./lib/prioridad.js",
  "./lib/rendimiento.js",
  "./lib/huecos.js",
  "./lib/focusTimer.js",
  "./lib/qrcode.min.js",
  "./lib/jsqr.min.js",
  "./lib/pako.min.js",
  "./lib/qr.js",
  "./lib/deeplink.js",
  "./lib/services/tareasService.js",
  "./lib/services/cursosService.js",
  "./lib/services/asistenciaService.js",
  "./lib/views/hoyView.js",
  "./lib/views/horarioView.js",
  "./lib/views/cursosView.js",
  "./lib/views/tareasView.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const reqUrl = new URL(e.request.url);
  if (reqUrl.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(e.request).then((cached) => cached || caches.match("./index.html")))
  );
});

self.addEventListener("notificationclick", (e) => {
  const notif = e.notification;
  const extra = notif?.data || {};
  const action = e.action || "";
  notif.close();

  const targetHash = extra.tipo === "tarea" ? "#tareas" : "#hoy";

  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          if (action) {
            client.postMessage({
              type: "UNUMBRAL_NOTIF_ACTION",
              action,
              extra,
              title: notif.title,
              body: notif.body
            });
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(`./${targetHash}`);
      }
    })
  );
});
