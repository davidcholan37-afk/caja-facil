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
