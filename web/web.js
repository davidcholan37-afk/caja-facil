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

/* La barra de arriba se vuelve oscura mientras está sobre la portada oscura. */
(function () {
  var nav = document.querySelector(".nav"), hero = document.querySelector(".hero");
  if (!nav || !hero || !("IntersectionObserver" in window)) return;
  new IntersectionObserver(function (es) { nav.classList.toggle("on-dark", es[0].isIntersecting); }, { rootMargin: "-70px 0px -88% 0px" }).observe(hero);
})();
