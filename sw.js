// Service worker: instalar la app y usarla sin internet (red primero, copia como respaldo).
const CACHE = "cajafacil-v15";
const ASSETS = ["./", "index.html", "style.css", "script.js", "img.js", "fotos.js", "escaner.js", "fonts/geist.woff2", "fonts/geistmono.woff2", "manifest.json", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "privacidad.html", "terminos.html", "legal.css", "img/pagos/yape.png", "img/pagos/plin.png", "img/pagos/culqi.png"];

// Dentro del programa de Windows (Electron) el almacén de copias hace que Chromium cierre la ventana
// («bad Mojo message … CacheStorageCache», código 3). Allí no se guardan ni se leen copias: todo va por red.
// En el navegador (Chrome, Edge, celular) nada cambia.
const EN_ESCRITORIO = /Electron\/|CajaFacilEscritorio/.test(self.navigator.userAgent) || /[?&]escritorio=1/.test(self.location.search);

self.addEventListener("install", (e) => {
  if (EN_ESCRITORIO) { e.waitUntil(self.skipWaiting()); return; }
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(ASSETS.map((a) => c.add(a).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  if (EN_ESCRITORIO) { e.waitUntil(self.clients.claim()); return; }
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("cajafacil-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (EN_ESCRITORIO) return;
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.includes("/voz/")) return; // la voz sin internet (40 MB) la guarda la propia caja; aquí no se duplica
  // Librerías de datos y fuentes: casi nunca cambian (el nombre lleva ?v=huella). Se sirven desde la copia del equipo
  // sin preguntar a la red ni volver a guardarlas: en equipos lentos esa escritura de 1 MB en cada apertura pesaba.
  if (/\/(img|fotos|escaner)\.js$|\/fonts\//.test(url.pathname)) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))));
    return;
  }
  e.respondWith(
    fetch(e.request, { cache: "no-cache" }) // siempre pregunta si hay versión nueva (GitHub guarda 10 min)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
  );
});
