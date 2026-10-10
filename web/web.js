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
