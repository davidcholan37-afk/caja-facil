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
