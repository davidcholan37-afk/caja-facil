/* ===================== 33 · CÁMARA: escanear códigos de barras con el celular o la webcam ===================== */
// Usa el lector del navegador si existe (Chrome en Android); si no (iPhone, PC), carga escaner.js solo la primera vez.
const cam = { on: false, stream: null, det: null, lib: null, timer: 0, last: "", lastT: 0, seen: [] };
const camOk = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
function loadScanLib() {
  return new Promise((res, rej) => {
    if (window.__Html5QrcodeLibrary__) return res(window.__Html5QrcodeLibrary__);
    const s = document.createElement("script"); s.src = "escaner.js"; s.async = true;
    s.onload = () => (window.__Html5QrcodeLibrary__ ? res(window.__Html5QrcodeLibrary__) : rej(new Error("lib")));
    s.onerror = () => rej(new Error("lib"));
    document.head.appendChild(s);
  });
}
// mode "venta": suma productos al ticket. mode "codigo": llena el código del producto que estás creando.
function openCam(mode = "venta") {
  if (!camOk()) return toast("Este navegador no deja usar la cámara. Abre Caja Fácil desde su enlace https en Safari o Chrome.", true);
  cam.seen = []; cam.last = ""; cam.mode = mode;
  if (mode === "codigo") {
    openModal(`<div class="camhead"><h2>Leer el código del producto</h2><button class="x" data-a="camback" aria-label="Volver">${svg("close")}</button></div>
      <div class="camv"><div id="camlib"></div><div class="camframe" aria-hidden="true"><i></i></div><p class="camst" id="camst">Abriendo la cámara…</p></div>
      <p class="camhint">Apunta al código de barras del empaque. Se copia solo en la ficha.</p>
      <div class="btns"><button class="btn sec lg" data-a="camback">Volver sin leer</button></div>`, "camm");
    ui.mk = "cam"; startCam(); return;
  }
  openModal(`<div class="camhead"><h2>Escanear con la cámara</h2><button class="x" data-a="close" aria-label="Cerrar cámara">${svg("close")}</button></div>
    <div class="camv"><div id="camlib"></div><div class="camframe" aria-hidden="true"><i></i></div><p class="camst" id="camst">Abriendo la cámara…</p></div>
    <p class="camhint">Apunta al código de barras: cada producto que lea se suma solo al ticket. Para otra unidad del mismo, retíralo y vuelve a apuntar.</p>
    <div class="camlog" id="camlog" aria-live="polite"></div>
    <div class="btns"><button class="btn lg" data-a="close" id="camdone">Listo</button></div>`, "camm");
  ui.mk = "cam"; startCam();
}
async function startCam() {
  const st = (t, err) => { const e = $("#camst"); if (e) { e.textContent = t; e.classList.toggle("err", !!err); e.hidden = !t; } };
  try {
    if ("BarcodeDetector" in window) {
      const have = await window.BarcodeDetector.getSupportedFormats();
      const want = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"].filter((f) => have.includes(f));
      if (want.length) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (ui.mk !== "cam") { stream.getTracks().forEach((t) => t.stop()); return; }
        cam.stream = stream;
        const v = document.createElement("video"); v.setAttribute("playsinline", ""); v.muted = true; v.srcObject = stream;
        $("#camlib").appendChild(v); await v.play();
        cam.det = new window.BarcodeDetector({ formats: want }); cam.on = true; st("");
        const loop = async () => { if (!cam.on) return; try { const r = await cam.det.detect(v); if (r.length) onCamCode(r[0].rawValue); } catch (e) {} cam.timer = setTimeout(loop, 150); };
        loop(); return;
      }
    }
    const L = await loadScanLib(); if (ui.mk !== "cam") return;
    const F = L.Html5QrcodeSupportedFormats;
    const lib = new L.Html5Qrcode("camlib", { verbose: false, formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.ITF, F.QR_CODE], experimentalFeatures: { useBarCodeDetectorIfSupported: true } });
    cam.lib = lib;
    await lib.start({ facingMode: "environment" }, { fps: 12, qrbox: (w, h) => ({ width: Math.round(Math.min(w * 0.84, 380)), height: Math.round(Math.min(h * 0.5, 190)) }), aspectRatio: 1.3333 }, (txt) => onCamCode(txt), () => {});
    if (ui.mk !== "cam" || cam.lib !== lib) { try { await lib.stop(); } catch (e) {} return; }
    cam.on = true; st("");
  } catch (e) {
    cam.on = false;
    const s = String((e && (e.name || e.message)) || e);
    st(/NotAllowed|Permission|denied/i.test(s) ? "La cámara está bloqueada. Permítela en los ajustes del navegador y vuelve a intentar."
      : /NotFound|Overconstrained|no camera/i.test(s) ? "No encontré una cámara en este equipo."
      : s === "lib" || (e && e.message === "lib") ? "No se pudo cargar el lector. La primera vez necesitas internet."
      : "No se pudo abrir la cámara.", true);
  }
}
function stopCam() {
  cam.on = false; clearTimeout(cam.timer);
  if (cam.stream) { cam.stream.getTracks().forEach((t) => t.stop()); cam.stream = null; }
  if (cam.lib) { const l = cam.lib; cam.lib = null; try { const p = l.stop(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
}
function camLog(html, bad) {
  const el = $("#camlog"); if (!el) return;
  cam.seen.unshift({ html, bad }); cam.seen = cam.seen.slice(0, 4);
  const T = cartTotals();
  el.innerHTML = cam.seen.map((x, i) => `<p class="${x.bad ? "bad" : ""} ${i ? "" : "new"}">${x.html}</p>`).join("") + (T.count ? `<p class="camtot">Ticket: ${nItems(T.count)} · <b class="num">${money(T.total)}</b></p>` : "");
}
// Cada código leído entra como si lo hubieran escrito en el buscador (productos, presentaciones y etiquetas de balanza).
function onCamCode(raw) {
  const code = String(raw || "").trim(); if (!code || ui.mk !== "cam") return;
  if (cam.mode === "codigo") {
    const dup = DB.products.find((x) => x.code === code && (!ui.pe || x.id !== ui.pe.id));
    stopCam(); beep(true); if (navigator.vibrate) navigator.vibrate(35);
    if (ui.pe) { ui.pe.d.code = code; paintPE(); }
    if (dup) toast(`Ojo: ese código ya lo tiene «${dup.name}»`, true);
    return;
  }
  // El mismo código no se vuelve a contar mientras siga frente a la cámara: para otra unidad, retíralo y vuelve a apuntar.
  const now = Date.now(); if (code === cam.last && now - cam.lastT < 1200) { cam.lastT = now; return; }
  cam.last = code; cam.lastT = now;
  const p = DB.products.find((x) => x.code && x.code === code);
  const ps = p ? null : DB.products.find((x) => (x.pres || []).some((y) => y.code && y.code === code));
  const lab = p || ps ? null : parseLabel(code);
  if (!p && !ps && !lab) { beep(false); camLog(`No encontré el código <b class="num">${esc(code)}</b>`, true); return; }
  if (p && p.unit === "kg") { stopCam(); closeModal(); submitCode(code); return; } // se pesa: abre la balanza
  const n0 = cartTotals().count, q0 = DB.cart.items.reduce((a, i) => a + i.qty, 0);
  submitCode(code);
  const ok = cartTotals().count !== n0 || DB.cart.items.reduce((a, i) => a + i.qty, 0) !== q0;
  const name = lab ? lab.p.name : p ? p.name : `${ps.name} (${ps.pres.find((y) => y.code === code).name})`;
  if (ok && navigator.vibrate) navigator.vibrate(35);
  camLog(ok ? `${svg("check")} ${esc(name)}` : `${esc(name)}: sin stock`, !ok);
}
act({
  camscan: () => openCam("venta"),
  camcode: () => { if (typeof readPE === "function") readPE(); openCam("codigo"); },
  camback: () => { stopCam(); if (ui.pe) paintPE(); else closeModal(); }
});
