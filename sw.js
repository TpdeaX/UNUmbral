// Service Worker para funcionamiento 100% offline con actualización en segundo plano
const CACHE_NAME = "unumbral-tpdeax-v2";
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
  "./lib/supabaseSync.js",
  "./lib/plataforma.js",
  "./lib/ajustes.js",
  "./lib/planificador.js",
  "./lib/notificaciones.js",
  "./lib/asistencia.js",
  "./lib/prioridad.js",
  "./lib/rendimiento.js",
  "./lib/huecos.js",
  "./lib/focusTimer.js",
  "./lib/qrcode.min.js",
  "./lib/jsqr.min.js",
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
