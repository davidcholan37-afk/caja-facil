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

/* Fondo de «Tu caja, paso a paso»: una esfera 3D grande y brillante que se queda fija mientras bajas.
   Es una esfera de luz con puntos tipo LED que se encienden en un dibujo distinto por cada paso, un anillo que la rodea
   y un destello cuando cambia el paso. Canvas 2D sin librerías. Solo se dibuja mientras la sección se ve y sin escuchar
   el scroll. Con «menos movimiento» se dibuja una vez, quieta. */
(function () {
  var sec = document.querySelector(".story"), cv = sec && sec.querySelector(".story-bg");
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext("2d"); if (!ctx) return;
  var calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var steps = [].slice.call(sec.querySelectorAll(".step")), screen = sec.querySelector(".story-screen");
  var small = innerWidth < 700, L = small ? 15 : 30, TAU = Math.PI * 2, W = 0, H = 0, dpr = 1;
  var cur = 0, vis = false, raf = 0, t0 = performance.now(), lastStep = 0, pulse = -9999;
  function size() { dpr = Math.min(devicePixelRatio || 1, small ? 1.5 : 2); W = cv.clientWidth; H = cv.clientHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  function target() { // índice fraccionario del paso según dónde está el centro de la pantalla
    var vc = innerHeight / 2, cs = steps.map(function (s) { var r = s.getBoundingClientRect(); return r.top + r.height / 2; });
    if (vc <= cs[0]) return 0; if (vc >= cs[cs.length - 1]) return cs.length - 1;
    for (var i = 0; i < cs.length - 1; i++) if (vc < cs[i + 1]) return i + (vc - cs[i]) / (cs[i + 1] - cs[i]);
    return cs.length - 1;
  }
  function pat(k, x, y, z, t, i, j) { // cómo se encienden los puntos en cada paso
    switch (k % 7) {
      case 0: return .5 + .5 * Math.sin(y * 6 - t * 1.6);
      case 1: return .5 + .5 * Math.sin((x + y) * 5 - t * 1.8);
      case 2: return .5 + .5 * Math.sin(Math.sqrt(x * x + y * y) * 9 - t * 2.2);
      case 3: return .5 + .5 * Math.sin(t * 2 + (i + j) * 1.7);
      case 4: return .5 + .5 * Math.sin(x * 7 + t * 1.7);
      case 5: return .5 + .5 * Math.sin(Math.atan2(y, x) * 3 + Math.sqrt(x * x + y * y) * 6 - t * 2);
      default: return .5 + .5 * Math.sin(t * 1.2 + Math.atan2(z, x) * 2);
    }
  }
  function ring(R, cx, cy, ax, rz, t, front) { // anillo de puntos que rodea la esfera
    var n = small ? 90 : 170;
    for (var u = 0; u < n; u++) {
      var a = u / n * TAU + t * .25, x = 1.34 * Math.cos(a), y = 0, z = 1.34 * Math.sin(a);
      var x1 = x * Math.cos(rz) - y * Math.sin(rz), y1 = x * Math.sin(rz) + y * Math.cos(rz);
      var y2 = y1 * Math.cos(ax) - z * Math.sin(ax), z2 = y1 * Math.sin(ax) + z * Math.cos(ax);
      if ((z2 > 0) !== front) continue;
      var s = 3.4 / (3.4 - z2), px = cx + x1 * R * s, py = cy + y2 * R * s, sz = (1 + z2 * .6 + .7) * (small ? .9 : 1.15);
      ctx.globalAlpha = front ? .85 : .35; ctx.fillStyle = "#9CC4FF"; ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
  }
  var bk = { R: 0, d: 0, back: null, front: null };
  function bake(R) { // capas que no cambian: halo, suelo, cuerpo de la esfera, brillo y luz de borde
    var S = Math.ceil(R * 4 * dpr), c = 2 * R, a = document.createElement("canvas"), b = document.createElement("canvas"); a.width = a.height = b.width = b.height = S;
    var x = a.getContext("2d"), y = b.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); y.setTransform(dpr, 0, 0, dpr, 0, 0);
    var h = x.createRadialGradient(c, c, R * .5, c, c, R * 1.9); h.addColorStop(0, "rgba(30,110,255,.38)"); h.addColorStop(1, "rgba(30,110,255,0)"); x.fillStyle = h; x.fillRect(0, 0, 4 * R, 4 * R);
    x.save(); x.translate(c, c + R * 1.08); x.scale(1, .22); var fl = x.createRadialGradient(0, 0, 0, 0, 0, R * 1.5); fl.addColorStop(0, "rgba(60,140,255,.55)"); fl.addColorStop(1, "rgba(60,140,255,0)"); x.fillStyle = fl; x.beginPath(); x.arc(0, 0, R * 1.5, 0, TAU); x.fill(); x.restore();
    var g = x.createRadialGradient(c - R * .38, c - R * .42, R * .04, c, c, R);
    g.addColorStop(0, small ? "#6FA4FF" : "#A9CBFF"); g.addColorStop(.22, small ? "#2F72F0" : "#3C86FF"); g.addColorStop(.58, "#0E45C4"); g.addColorStop(.88, "#071C5E"); g.addColorStop(1, "#040B2B");
    x.fillStyle = g; x.beginPath(); x.arc(c, c, R, 0, TAU); x.fill();
    var sp = y.createRadialGradient(c - R * .36, c - R * .46, 0, c - R * .36, c - R * .46, R * .55); sp.addColorStop(0, "rgba(255,255,255,.55)"); sp.addColorStop(1, "rgba(255,255,255,0)");
    y.fillStyle = sp; y.beginPath(); y.arc(c, c, R, 0, TAU); y.fill();
    var rim = y.createRadialGradient(c, c, R * .82, c, c, R * 1.02); rim.addColorStop(0, "rgba(80,160,255,0)"); rim.addColorStop(.85, "rgba(110,180,255,.5)"); rim.addColorStop(1, "rgba(110,180,255,0)");
    y.fillStyle = rim; y.beginPath(); y.arc(c, c, R * 1.02, 0, TAU); y.fill();
    bk = { R: R, d: dpr, back: a, front: b };
  }
  function draw(now) {
    sec.classList.add("gl");
    var f = Math.max(0, Math.min(steps.length - 1, cur)), k0 = Math.floor(f), k1 = Math.min(k0 + 1, steps.length - 1), m = f - k0, mm = m * m * (3 - 2 * m);
    var idx = Math.round(f); if (idx !== lastStep) { lastStep = idx; pulse = now; }
    var wide = screen && getComputedStyle(screen).display !== "none";
    var cx = W / 2, cy = H * .4, R = Math.min(W * .5, H * .27);
    if (wide) { var r = screen.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; R = Math.min(H * .42, W * .25); }
    var t = (now - t0) / 1000, ay = t * .16 + f * .9, ax = .32 + Math.sin(t * .4) * .04, rz = -.3 + f * .12;
    var ca = Math.cos(ay), sa = Math.sin(ay), cb = Math.cos(ax), sb = Math.sin(ax);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    var Rr = Math.round(R); if (bk.R !== Rr || bk.d !== dpr) bake(Rr); R = Rr;
    ctx.drawImage(bk.back, cx - 2 * R, cy - 2 * R, 4 * R, 4 * R);
    ring(R, cx, cy, .5 + f * .05, rz, t, false);
    // puntos LED sobre la superficie (la cara de atrás se ve tenue: da profundidad)
    for (var i = 0; i < L; i++) {
      var phi = -Math.PI / 2 + Math.PI * (i + .5) / L, rr = Math.cos(phi), yy = Math.sin(phi), n = Math.max(6, Math.round(2 * L * rr));
      for (var j = 0; j < n; j++) {
        var th = TAU * j / n + ay + (i % 2) * Math.PI / n, x = rr * Math.cos(th), z = rr * Math.sin(th);
        var y1 = yy * cb - z * sb, z1 = yy * sb + z * cb;
        var lit = pat(k0, x, y1, z1, t, i, j) * (1 - mm) + pat(k1, x, y1, z1, t, i, j) * mm;
        var front = z1 > 0, edge = front ? Math.pow(z1, .55) : 1;
        var px = cx + x * R * .985, py = cy + y1 * R * .985;
        var sz = (front ? 1.5 + lit * 2.6 : 1) * (small ? .85 : 1) * (.55 + .45 * Math.max(0, z1));
        ctx.globalAlpha = front ? Math.min(1, (.18 + lit * .82) * edge) : .1 + lit * .08;
        ctx.fillStyle = front ? (lit > .72 ? "#FFFFFF" : "#BCD8FF") : "#5C95FF";
        ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
      }
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(bk.front, cx - 2 * R, cy - 2 * R, 4 * R, 4 * R);
    ring(R, cx, cy, .5 + f * .05, rz, t, true);
    // destello al cambiar de paso
    var e = (now - pulse) / 1100;
    if (e >= 0 && e < 1) { var q = 1 - Math.pow(1 - e, 3); ctx.globalAlpha = (1 - e) * .55; ctx.lineWidth = 2; ctx.strokeStyle = "#9CC4FF"; ctx.beginPath(); ctx.arc(cx, cy, R * (1.02 + q * .5), 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
  }
  function loop(now) { raf = 0; if (!vis || document.hidden) return; cur += (target() - cur) * .09; draw(now); raf = requestAnimationFrame(loop); }
  size(); cur = target();
  if (calm) { pulse = -9999; draw(t0 + 3000); addEventListener("resize", function () { size(); cur = target(); draw(t0 + 3000); }); return; }
  new IntersectionObserver(function (es) { vis = es[0].isIntersecting; if (vis && !raf) raf = requestAnimationFrame(loop); }, { rootMargin: "120px 0px" }).observe(sec);
  document.addEventListener("visibilitychange", function () { if (!document.hidden && vis && !raf) raf = requestAnimationFrame(loop); });
  if ("ResizeObserver" in window) new ResizeObserver(size).observe(cv); else addEventListener("resize", size);
})();
