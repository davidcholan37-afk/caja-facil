/* ===================== 00 · MODO PRUEBA (solo en localhost) ===================== */
// Para probar la voz en tu propia PC sin entrar con Google: abre http://localhost:8765/#voz-prueba
// Solo funciona en localhost / 127.0.0.1. En la página publicada NO hace nada.
(function () {
  if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
  try {
    if (location.hash === "#voz-prueba") { localStorage.setItem("cf-voz-prueba", "1"); history.replaceState(null, "", location.pathname); }
    if (localStorage.getItem("cf-voz-prueba") !== "1") return;
    localStorage.setItem("cf-cloud", JSON.stringify({ ses: { at: "x", rt: "r", exp: Date.now() + 9e9, user: { id: "prueba", email: "prueba@local" } }, neg: "11111111-1111-1111-1111-111111111111", negName: "Prueba de voz", chk: Date.now(), last: Date.now(), voz: true }));
    const f = window.fetch; // la nube se queda quieta: nada sale a internet
    window.fetch = (u, ...a) => (String((u && u.url) || u).indexOf("supabase.co") >= 0 ? Promise.reject(new TypeError("modo prueba")) : f.call(window, u, ...a));
  } catch (e) {}
})();
