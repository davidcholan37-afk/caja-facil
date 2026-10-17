/* ===================== 34 · VITRINA PROPIA (imagen o PDF del dueño) ===================== */
// DB.cfg.vit = { img (data:), fit "cover"|"contain", zoom 100-300, x 0-100, y 0-100, bg, ts }
const vitCfg = () => { const v = DB.cfg.vit; return v && v.img ? v : { img: "", fit: "cover", zoom: 100, x: 50, y: 50, bg: "#ffffff", ts: 0 }; };
const vitStyle = (v) => `object-fit:${v.fit === "contain" ? "contain" : "cover"};object-position:${v.x}% ${v.y}%;transform:scale(${(v.zoom || 100) / 100});transform-origin:${v.x}% ${v.y}%`;
function vitImgHtml(v) {
  return `<div class="vimgw" style="background:${esc(v.bg || "#fff")}"><img class="vimg" src="${bu("vit:" + (v.ts || 0), v.img)}" alt="" style="${vitStyle(v)}"></div>`;
}
// Parecido a lo que se ve en la venta de este equipo (para que la vista previa sea fiel).
function vitAspect() {
  const W = innerWidth, H = innerHeight, w = W >= 1100 ? W * 0.4 : W - 28, h = Math.max(300, H - 190);
  return Math.min(1.8, Math.max(0.6, w / h)).toFixed(2);
}
function vitEditor() {
  const v = vitCfg(), tiene = !!v.img;
  const sl = (id, lab, min, max, val, step) => `<label class="vtsl"><span>${lab}</span><input type="range" id="${id}" min="${min}" max="${max}" step="${step || 1}" value="${val}"></label>`;
  return `<div class="card vted" style="margin-top:14px"><h2>Vitrina</h2>
    <p class="muted" style="margin-bottom:10px">Pon una imagen (PNG, JPG) o un PDF: una oferta, un producto nuevo, tu logo. Sale en toda la pantalla de venta mientras no estés buscando. Si no pones nada, se ve el mosaico de fotos.</p>
    <div class="row wrap"><label class="btn">${tiene ? "Cambiar imagen o PDF" : "Subir imagen o PDF"}<input type="file" accept="image/*,application/pdf,.pdf" data-in="vitfile" hidden></label>${tiene ? `<button class="btn sec" data-a="vitquitar">Quitar</button>` : ""}</div>
    ${tiene ? `<div class="vtprev" style="aspect-ratio:${vitAspect()}">${vitImgHtml(v)}</div>
    <div class="seg vtfit" role="group" aria-label="Ajuste"><button class="${v.fit !== "contain" ? "on" : ""}" data-a="vitfit" data-v="cover">Llenar</button><button class="${v.fit === "contain" ? "on" : ""}" data-a="vitfit" data-v="contain">Entera</button></div>
    ${sl("vt-zoom", "Acercar", 100, 300, v.zoom, 5)}${sl("vt-x", "Izquierda ↔ derecha", 0, 100, v.x)}${sl("vt-y", "Arriba ↕ abajo", 0, 100, v.y)}
    <div class="row wrap" style="align-items:center;gap:12px"><label class="vtsl" style="flex:1"><span>Color del fondo (si la imagen no llena)</span><input type="color" id="vt-bg" value="${esc(v.bg || "#ffffff")}"></label><button class="link" data-a="vitcentrar">Centrar y restablecer</button></div>` : ""}</div>`;
}
function vitSet(patch, soft) {
  DB.cfg.vit = Object.assign({}, vitCfg(), patch);
  if (soft) return;
  save();
}
function vitLive() { // actualiza la vista previa sin volver a dibujar Ajustes
  const v = vitCfg(), im = $(".vtprev .vimg"), w = $(".vtprev .vimgw");
  if (im) im.style.cssText = vitStyle(v); if (w) w.style.background = v.bg || "#fff";
}
function vitFromCanvas(c) {
  let out = c.toDataURL("image/webp", 0.86); if (out.slice(0, 15) !== "data:image/webp") out = c.toDataURL("image/jpeg", 0.88);
  vitSet({ img: out, ts: Date.now(), fit: "cover", zoom: 100, x: 50, y: 50, bg: "#ffffff" });
  log("Vitrina", "Imagen cambiada"); toast("Imagen lista. Acomódala como quieras"); if (ui.tab === "aj") render();
}
function vitDraw(src, w, h) {
  const M = 1400, r = Math.min(1, M / Math.max(w, h)), c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * r)); c.height = Math.max(1, Math.round(h * r));
  const x = c.getContext("2d"); x.drawImage(src, 0, 0, c.width, c.height); return c;
}
async function vitPdf(file) {
  toast("Leyendo el PDF…");
  const lib = await import("./lib/pdf.min.mjs");
  lib.GlobalWorkerOptions.workerSrc = new URL("lib/pdf.worker.min.mjs", location.href).href;
  const doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise, page = await doc.getPage(1);
  const v0 = page.getViewport({ scale: 1 }), sc = Math.min(3, 1400 / Math.max(v0.width, v0.height)), vp = page.getViewport({ scale: sc });
  const c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: x, viewport: vp }).promise;
  if (doc.numPages > 1) toast("El PDF tiene " + doc.numPages + " páginas: se usó la primera");
  vitFromCanvas(c);
}
function vitLoad(file) {
  if (!file) return;
  if (file.size > 25 * 1048576) return toast("Ese archivo pesa demasiado (máximo 25 MB)");
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) { vitPdf(file).catch(() => toast("No se pudo leer ese PDF. Prueba guardándolo como imagen", true)); return; }
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => { URL.revokeObjectURL(url); vitFromCanvas(vitDraw(img, img.naturalWidth, img.naturalHeight)); };
  img.onerror = () => { URL.revokeObjectURL(url); toast("No se pudo leer esa imagen"); };
  img.src = url;
}
act({
  vitquitar: () => confirmBox("¿Quitar la imagen de la vitrina? Volverá el mosaico de fotos.", "Quitar", () => { delete DB.cfg.vit; save(); log("Vitrina", "Imagen quitada"); render(); }),
  vitfit: (el) => { vitSet({ fit: el.dataset.v }); render(); },
  vitcentrar: () => { vitSet({ fit: "cover", zoom: 100, x: 50, y: 50 }); render(); }
});
