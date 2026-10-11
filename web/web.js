/* Caja Fácil · página de ventas: revelado único de imágenes y del ticket cuando aparecen en pantalla.
   Sin escuchar el scroll: IntersectionObserver. Si el sistema pide menos movimiento, no se hace nada. */
(function () {
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.documentElement.classList.add("js");
  // Se observa al contenedor (no a la imagen), porque una imagen recortada del todo no cuenta como visible.
  var items = document.querySelectorAll(".reveal, .printer");
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target._rv.classList.add("in"); io.unobserve(e.target); }
    });
  }, { rootMargin: "0px 0px -12% 0px", threshold: 0.1 });
  items.forEach(function (el) { var box = el.classList.contains("printer") ? el : el.parentElement; box._rv = el; io.observe(box); });
})();

/* Vitrina de la portada: 3 formas de ver la venta (escáner, fichas, fichas grandes).
   Pestañas accesibles: clic o flechas. Si se cambia con el teclado, sin animación (Emil). */
(function () {
  var box = document.querySelector(".showcase"); if (!box) return;
  var tabs = [].slice.call(box.querySelectorAll('[role="tab"]')), cap = box.querySelector(".tabcap");
  function show(t, kbd) {
    box.classList.toggle("instant", !!kbd);
    tabs.forEach(function (b) {
      var on = b === t, f = document.getElementById(b.getAttribute("aria-controls"));
      b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1;
      f.classList.toggle("on", on);
      if (on) { f.removeAttribute("aria-hidden"); f.querySelectorAll("img").forEach(function (i) { i.loading = "eager"; }); }
      else f.setAttribute("aria-hidden", "true");
    });
    cap.textContent = t.dataset.cap;
  }
  tabs.forEach(function (b, i) {
    b.addEventListener("click", function (e) { show(b, e.detail === 0); });
    b.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (e.key === "Home") d = -i; if (e.key === "End") d = tabs.length - 1 - i;
      if (!d) return; e.preventDefault();
      var n = tabs[(i + d + tabs.length) % tabs.length]; n.focus(); show(n, true);
    });
  });
  // Precarga las otras dos vistas cuando el navegador está libre, para que el cambio sea instantáneo.
  setTimeout(function () { box.querySelectorAll(".frame img").forEach(function (i) { i.loading = "eager"; }); }, 1500);
})();

/* Historia «Un día en tu bodega»: en PC la pantalla queda fija y cambia según el paso que está al centro.
   IntersectionObserver con una franja al medio de la pantalla (sin escuchar el scroll). */
(function () {
  var steps = [].slice.call(document.querySelectorAll(".story .step"));
  var frames = [].slice.call(document.querySelectorAll(".story .sframe"));
  if (!steps.length || !("IntersectionObserver" in window)) return;
  function go(i) {
    steps.forEach(function (s) { s.classList.toggle("on", +s.dataset.i === i); });
    frames.forEach(function (f) {
      var on = +f.dataset.i === i; f.classList.toggle("on", on);
      if (on) f.querySelectorAll("img").forEach(function (im) { im.loading = "eager"; });
    });
  }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) go(+e.target.dataset.i); });
  }, { rootMargin: "-45% 0px -45% 0px" });
  steps.forEach(function (s) { io.observe(s); });
  // Precarga las 4 pantallas cuando la historia se acerca, para que el cambio sea instantáneo.
  var pre = new IntersectionObserver(function (es) {
    if (es.some(function (e) { return e.isIntersecting; })) { frames.forEach(function (f) { f.querySelectorAll("img").forEach(function (im) { im.loading = "eager"; }); }); pre.disconnect(); }
  }, { rootMargin: "600px 0px" });
  pre.observe(document.querySelector(".story"));
})();

/* Al entrar a la página siempre se empieza arriba (el navegador no debe devolverte a donde te quedaste antes).
   Si el enlace trae una sección (#precio, #preguntas...), sí se respeta. */
(function () {
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  if (!location.hash) {
    window.scrollTo(0, 0);
    window.addEventListener("load", function () { window.scrollTo(0, 0); });
    window.addEventListener("pageshow", function (e) { if (e.persisted) window.scrollTo(0, 0); });
    // iPhone (Safari) a veces devuelve la página abajo un instante después: se vuelve a subir un par de veces,
    // y también al salir, para que al recargar el navegador no tenga una posición que recordar.
    window.addEventListener("pagehide", function () { window.scrollTo(0, 0); });
    window.addEventListener("beforeunload", function () { window.scrollTo(0, 0); });
    window.addEventListener("load", function () { [60, 250, 700].forEach(function (t) { setTimeout(function () { if (!location.hash && window.scrollY > 0 && !window._tocó) window.scrollTo(0, 0); }, t); }); });
    ["wheel", "touchstart", "keydown", "mousedown"].forEach(function (ev) { window.addEventListener(ev, function () { window._tocó = true; }, { once: true, passive: true }); });
  }
})();

/* Escena 3D: el video corre solo mientras se ve (ahorra datos y batería). Con «menos movimiento» no se reproduce solo. */
(function () {
  var sc = document.querySelector(".hero"), v = document.getElementById("demo");
  if (!sc || !v || !("IntersectionObserver" in window)) return;
  var calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (calm) { v.controls = true; return; }
  new IntersectionObserver(function (es) {
    var on = es[0].isIntersecting;
    if (on) { sc.classList.add("in"); v.preload = "auto"; var p = v.play(); if (p && p.catch) p.catch(function () { v.controls = true; }); }
    else v.pause();
  }, { threshold: 0.35 }).observe(sc.querySelector(".hero-stage"));
})();

/* Fondo de la historia: una nube de puntos en 3D que cambia de forma (esfera, malla, anillo, cubo) a medida que pasas
   de un paso al siguiente. Canvas 2D sin librerías. Se dibuja solo mientras la sección se ve (IntersectionObserver),
   sin escuchar el scroll. Con «menos movimiento» se dibuja una vez, quieto. */
(function () {
  var sec = document.querySelector(".story"), cv = sec && sec.querySelector(".story-bg");
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext("2d"), calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var steps = [].slice.call(sec.querySelectorAll(".step")), screen = sec.querySelector(".story-screen");
  var N = innerWidth < 700 ? 520 : 1200, TAU = Math.PI * 2, W = 0, H = 0, dpr = 1;
  function sphere() { var a = [], g = Math.PI * (3 - Math.sqrt(5)); for (var i = 0; i < N; i++) { var y = 1 - 2 * (i + .5) / N, r = Math.sqrt(1 - y * y), t = g * i; a.push([Math.cos(t) * r, y, Math.sin(t) * r]); } return a; }
  function grid() { var c = Math.ceil(Math.sqrt(N * 1.5)), r = Math.ceil(N / c), a = []; for (var i = 0; i < N; i++) { var x = i % c, y = (i / c) | 0; a.push([(x / (c - 1) - .5) * 2.5, (y / (r - 1) - .5) * 1.6, Math.sin(x * .45) * .07 + Math.cos(y * .55) * .07]); } return a; }
  function torus() { var a = []; for (var i = 0; i < N; i++) { var u = ((i * .6180339887) % 1) * TAU, v = ((i * .7548776662) % 1) * TAU, R = .78, r = .3; a.push([(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v) * 1.1, (R + r * Math.cos(v)) * Math.sin(u)]); } return a; }
  function cube() { var s = Math.ceil(Math.cbrt(N)), a = []; for (var i = 0; i < N; i++) { var x = i % s, y = ((i / s) | 0) % s, z = (i / (s * s)) | 0; a.push([(x / (s - 1) - .5) * 1.5, (y / (s - 1) - .5) * 1.5, (z / (s - 1) - .5) * 1.5]); } return a; }
  var S = [sphere(), grid(), torus(), cube()], seq = [0, 1, 2, 3, 0, 2, 0];
  var rnd = []; for (var k = 0; k < N; k++) rnd.push(Math.random());
  var cur = 0, vis = false, raf = 0, t0 = performance.now();
  function size() { dpr = Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.5 : 2); W = cv.clientWidth; H = cv.clientHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  function ease(x) { return x * x * (3 - 2 * x); }
  function target() { // índice fraccionario del paso según dónde está el centro de la pantalla
    var vc = innerHeight / 2, cs = steps.map(function (s) { var r = s.getBoundingClientRect(); return r.top + r.height / 2; });
    if (vc <= cs[0]) return 0; if (vc >= cs[cs.length - 1]) return cs.length - 1;
    for (var i = 0; i < cs.length - 1; i++) if (vc < cs[i + 1]) return i + (vc - cs[i]) / (cs[i + 1] - cs[i]);
    return cs.length - 1;
  }
  function draw(now) {
    var f = Math.max(0, Math.min(steps.length - 1, cur)), i0 = Math.floor(f), i1 = Math.min(i0 + 1, steps.length - 1), m = f - i0;
    var A = S[seq[i0] || 0], B = S[seq[i1] || 0];
    var cx = W / 2, cy = H * .36, R = Math.min(W * .5, H * .3), wide = screen && getComputedStyle(screen).display !== "none";
    if (wide) { var r = screen.getBoundingClientRect(), sr = sec.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; R = Math.min(H * .4, W * .27); }
    var ay = (now - t0) * .00011 + f * .85, ax = .38 + Math.sin((now - t0) * .00035) * .05, ca = Math.cos(ay), sa = Math.sin(ay), cb = Math.cos(ax), sb = Math.sin(ax);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.save(); ctx.translate(cx, cy + R * .98); ctx.scale(1, .26);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 1.35); g.addColorStop(0, "rgba(10,102,255,.28)"); g.addColorStop(1, "rgba(10,102,255,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 1.35, 0, TAU); ctx.fill(); ctx.restore();
    for (var i = 0; i < N; i++) {
      var tt = Math.max(0, Math.min(1, ease(m) * 1.5 - rnd[i] * .5)), p = A[i], q = B[i];
      var x = p[0] + (q[0] - p[0]) * tt, y = p[1] + (q[1] - p[1]) * tt, z = p[2] + (q[2] - p[2]) * tt;
      var x1 = x * ca + z * sa, z1 = -x * sa + z * ca, y1 = y * cb - z1 * sb, z2 = y * sb + z1 * cb;
      var s = 3.4 / (3.4 - z2), px = cx + x1 * R * s, py = cy + y1 * R * s, d = (z2 + 1.2) / 2.4;
      ctx.globalAlpha = Math.max(.18, Math.min(1, .25 + d * .8));
      ctx.fillStyle = d > .55 ? "#0A66FF" : "#6EA6FF";
      var sz = (1.5 + d * 2.1) * s * (W < 700 ? .9 : 1); ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
  }
  function loop(now) { raf = 0; if (!vis || document.hidden) return; cur += (target() - cur) * .09; draw(now); raf = requestAnimationFrame(loop); }
  size(); cur = target();
  if (calm) { draw(t0); addEventListener("resize", function () { size(); cur = target(); draw(t0); }); return; }
  new IntersectionObserver(function (es) { vis = es[0].isIntersecting; if (vis && !raf) raf = requestAnimationFrame(loop); }, { rootMargin: "120px 0px" }).observe(sec);
  document.addEventListener("visibilitychange", function () { if (!document.hidden && vis && !raf) raf = requestAnimationFrame(loop); });
  if ("ResizeObserver" in window) new ResizeObserver(size).observe(cv); else addEventListener("resize", size);
})();
