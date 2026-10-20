/* ===================== 68 · INSTALAR COMO APP (PC, Android, iPhone) ===================== */
// Caja Fácil ya es una app web instalable (manifest.json + sw.js). Aquí solo se ofrece el botón «Instalar».
// Chrome y Edge (Windows, Android) avisan con «beforeinstallprompt»; Safari en iPhone no, así que mostramos los pasos.
let installEvt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; if (ui.tab === "aj") render(); });
window.addEventListener("appinstalled", () => { installEvt = null; toast("Listo: Caja Fácil quedó instalada"); if (ui.tab === "aj") render(); });
const isApp = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true || /Electron|CajaFacilEscritorio/.test(navigator.userAgent);
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function installHtml() {
  if (isApp()) return "";
  return `<div class="card"><h2>Instala Caja Fácil</h2><p class="muted" style="margin-bottom:12px">Ábrela como una app: con su ícono en el escritorio o en tu celular, en su propia ventana y sin la barra del navegador. Sigue funcionando sin internet.</p>
    <button class="btn" data-a="install">Instalar Caja Fácil</button></div>`;
}
function installSteps() {
  const ios = isIOS();
  openModal(`<h2>Instalar Caja Fácil</h2>
    ${ios ? `<ol class="steps-ins"><li>Abre esta página en <b>Safari</b>.</li><li>Toca el botón <b>Compartir</b> (el cuadrado con la flecha hacia arriba).</li><li>Elige <b>Agregar a inicio</b> y toca <b>Agregar</b>.</li></ol>
      <p class="muted sm" style="margin-top:10px">Después abre Caja Fácil desde su ícono y, si te lo pide, actívala con Google ahí mismo.</p>`
    : `<ol class="steps-ins"><li>Abre esta página en <b>Google Chrome</b> o <b>Microsoft Edge</b>.</li><li>Toca el menú <b>⋮</b> (arriba a la derecha).</li><li>Elige <b>Instalar Caja Fácil</b> (en Android: <b>Agregar a la pantalla principal</b>).</li></ol>
      <p class="muted sm" style="margin-top:10px">Si ya la instalaste, búscala en tu escritorio, en el menú Inicio o entre tus apps.</p>`}
    <div class="btns"><button class="btn sec" data-a="close">Entendido</button></div>`);
}
act({
  install: async () => {
    if (!installEvt) return installSteps();
    const ev = installEvt; installEvt = null;
    ev.prompt();
    const r = await ev.userChoice.catch(() => ({ outcome: "dismissed" }));
    if (r.outcome !== "accepted") toast("No se instaló. Puedes hacerlo cuando quieras desde Ajustes.");
    if (ui.tab === "aj") render();
  }
});

/* ---------- Modo rápido: menos adornos para celulares y PC lentos ---------- */
// «cf-lite»: "1" siempre, "0" nunca, sin valor = automático (equipo de 2 núcleos o poca memoria, o la prueba de velocidad de abajo).
// Cada equipo decide por sí mismo: no viaja a la nube ni a otras cajas.
const liteGet = () => { try { return localStorage.getItem("cf-lite"); } catch (e) { return null; } };
function liteApply() {
  const f = liteGet(); let on;
  if (f === "1") on = true; else if (f === "0") on = false;
  else { let a = null; try { a = localStorage.getItem("cf-lite-auto"); } catch (e) {} const n = navigator; on = a === "1" || n.hardwareConcurrency <= 2 || n.deviceMemory <= 2; }
  document.documentElement.classList.toggle("lite", !!on);
}
// Mide cuánto tarda este equipo en una cuenta corta. Se hace una vez (y cada 30 días), con la caja ya lista y sin molestar.
function liteBench(force) {
  if (liteGet() !== null) return;
  try { const t = +localStorage.getItem("cf-lite-auto-t") || 0; if (!force && t && Date.now() - t < 30 * 864e5) return; } catch (e) {}
  const run = () => {
    const t0 = performance.now(); let s = 0;
    for (let i = 0; i < 2e6; i++) s += Math.sqrt(i) * ((i & 7) + 1) % 3;
    const a = []; for (let i = 0; i < 30000; i++) a.push((i * 7919) % 10007); a.sort((x, y) => x - y);
    return performance.now() - t0 + (s < 0 ? 1 : 0);
  };
  const go = () => {
    if (document.hidden) return setTimeout(go, 5000);
    const ms = Math.min(run(), run(), run());
    try { localStorage.setItem("cf-lite-auto", ms > 70 ? "1" : "0"); localStorage.setItem("cf-lite-auto-t", String(Date.now())); } catch (e) {}
    liteApply();
  };
  setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(go, { timeout: 4000 }) : go()), 3000);
}
function liteHtml() {
  const f = liteGet(), m = f === "1" ? "1" : f === "0" ? "0" : "auto", on = document.documentElement.classList.contains("lite");
  return `<div class="card"><h2>Modo rápido</h2><p class="muted" style="margin-bottom:12px">Quita sombras, transparencias y movimientos para que la caja vaya fluida en celulares y computadoras lentas. Ahora está <b>${on ? "encendido" : "apagado"}</b>${m === "auto" ? " (automático según tu equipo)" : ""}.</p>
    <div class="seg tabs2">${[["auto", "Automático"], ["1", "Encendido"], ["0", "Apagado"]].map(([v, l]) => `<button class="${m === v ? "on" : ""}" data-a="liteset" data-v="${v}">${l}</button>`).join("")}</div></div>`;
}
act({
  liteset: (el) => {
    const v = el.dataset.v;
    try { if (v === "auto") { localStorage.removeItem("cf-lite"); localStorage.removeItem("cf-lite-auto"); localStorage.removeItem("cf-lite-auto-t"); } else localStorage.setItem("cf-lite", v); } catch (e) {}
    liteApply(); if (v === "auto") liteBench(true);
    toast(v === "1" ? "Modo rápido encendido" : v === "0" ? "Modo rápido apagado" : "Modo rápido automático");
    if (ui.tab === "aj") render();
  }
});

// Versión nueva al abrir: el programa de Windows (y a veces el navegador) abre la copia guardada de la página
// hasta 10 minutos después de publicar. Al arrancar se pide la página a la red; si trae otra huella de script.js,
// se recarga una sola vez (cuando no hay una ventana abierta ni algo escrito). Las ventas y el ticket no se tocan.
function verNueva() {
  if (!location.protocol.startsWith("http")) return;
  const s = document.querySelector('script[src*="script.js?v="]'), cur = s && (s.getAttribute("src").match(/script\.js\?v=(\w+)/) || [])[1];
  if (!cur) return;
  fetch(location.href.split("#")[0], { cache: "reload" }).then((r) => (r.ok ? r.text() : "")).then((t) => {
    const n = (t.match(/script\.js\?v=(\w+)/) || [])[1];
    if (!n || n === cur) return;
    try { if (sessionStorage.getItem("cf-ver") === n) return; sessionStorage.setItem("cf-ver", n); } catch (e) { return; }
    const libre = () => !modalOpen() && !(document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName) && document.activeElement.value);
    let vueltas = 0;
    const intenta = () => { if (libre()) location.reload(); else if (++vueltas < 40) setTimeout(intenta, 15000); };
    intenta();
  }).catch(() => {});
}
