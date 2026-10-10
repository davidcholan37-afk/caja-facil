/* Caja Fácil · página de ventas: el ticket del precio "sale de la impresora" una sola vez al aparecer. */
(function () {
  var root = document.documentElement, pr = document.querySelector(".printer");
  if (!pr) return;
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  root.classList.add("js");
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { pr.classList.add("on"); io.disconnect(); } });
  }, { threshold: 0.35 });
  io.observe(pr);
})();
