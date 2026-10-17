/* ===================== 34 · VITRINA PROPIA (imagen o PDF del dueño) ===================== */
// DB.cfg.vit = { img (data:), fit "cover"|"contain", zoom 100-400, tx/ty (desplazamiento en % de la caja), bg, ts, txt:[{id,t,x,y,s,c,bg}] }
const vitCfg = () => { const v = DB.cfg.vit; return v && v.img ? v : { img: "", fit: "cover", zoom: 100, tx: 0, ty: 0, bg: "#ffffff", ts: 0, txt: [] }; };
const VIT_TXT = {
  oferta: { t: "Oferta", f: "fuerte", k: "cinta", s: 8, c: "#ffffff", bg: "#E5322D", x: 24, y: 10 },
  nuevo: { t: "Nuevo", f: "redonda", k: "globo", s: 8, c: "#ffffff", bg: "#16A34A", x: 24, y: 10 },
  precio: { t: "S/ 3.00", f: "fuerte", k: "sello", s: 15, c: "#111111", bg: "#FFD43B", x: 50, y: 82 },
  texto: { t: "Tu texto", s: 9, c: "#ffffff", bg: "", x: 50, y: 50 }
};
const vitStyle = (v) => `object-fit:${v.fit === "contain" ? "contain" : "cover"};transform:translate(${v.tx || 0}%,${v.ty || 0}%) scale(${(v.zoom || 100) / 100})`;
const VIT_FONTS = [["limpia", "Limpia"], ["fuerte", "Fuerte"], ["elegante", "Elegante"], ["redonda", "Redonda"], ["manuscrita", "A mano"], ["maquina", "Máquina"]];
const VIT_ESTILOS = [["plano", "Plano"], ["sombra", "Sombra"], ["cinta", "Cinta"], ["sello", "Sello"], ["globo", "Globo"], ["brillo", "Brillo"]];
const vitTxCls = (t) => `vtx f-${t.f || "limpia"} k-${t.k || "plano"}${t.bg ? " bgd" : ""}`;
const vitTxStyle = (t) => `left:${t.x}%;top:${t.y}%;font-size:${t.s}cqw;color:${esc(t.c)};${t.bg ? `background:${esc(t.bg)};` : "text-shadow:0 .08em .25em rgba(0,0,0,.5);"}`;
const vitTxHtml = (t) => `<div class="${vitTxCls(t)}" data-id="${t.id}" style="${vitTxStyle(t)}">${esc(t.t)}</div>`;
function vitImgHtml(v) {
  return `<div class="vbox"><div class="vimgw" style="background:${esc(v.bg || "#fff")}"><img class="vimg" src="${bu("vit:" + (v.ts || 0), v.img)}" alt="" draggable="false" style="${vitStyle(v)}"></div><div class="vovl">${(v.txt || []).map(vitTxHtml).join("")}</div></div>`;
}
// Parecido a lo que se ve en la venta de este equipo (para que la vista previa sea fiel).
function vitAspect() {
  const W = innerWidth, H = innerHeight, w = W >= 1100 ? W * 0.4 : W - 28, h = Math.max(300, H - 190);
  return Math.min(1.8, Math.max(0.6, w / h)).toFixed(2);
}
function vitTxRow(t) {
  return `<div class="vtrow" data-id="${t.id}"><input class="inp" data-vtx="t" data-id="${t.id}" value="${esc(t.t)}" maxlength="60" aria-label="Texto">
    <label class="vtmini"><span>Tipo de letra</span><select class="inp" data-vtx="f" data-id="${t.id}">${VIT_FONTS.map(([k, n]) => `<option value="${k}"${(t.f || "limpia") === k ? " selected" : ""}>${n}</option>`).join("")}</select></label>
    <label class="vtmini"><span>Estilo</span><select class="inp" data-vtx="k" data-id="${t.id}">${VIT_ESTILOS.map(([k, n]) => `<option value="${k}"${(t.k || "plano") === k ? " selected" : ""}>${n}</option>`).join("")}</select></label>
    <label class="vtmini"><span>Tamaño</span><input type="range" data-vtx="s" data-id="${t.id}" min="3" max="40" value="${t.s}"></label>
    <label class="vtmini"><span>Letra</span><input type="color" data-vtx="c" data-id="${t.id}" value="${esc(t.c)}"></label>
    <label class="vtmini"><span>Fondo</span><input type="color" data-vtx="bg" data-id="${t.id}" value="${esc(t.bg || "#E5322D")}"></label>
    <button class="btn sec sm" data-a="vtxfondo" data-id="${t.id}">${t.bg ? "Sin fondo" : "Con fondo"}</button>
    <button class="btn sec sm" data-a="vtxdel" data-id="${t.id}" aria-label="Borrar texto">Borrar</button></div>`;
}
function vitEditor() {
  const v = vitCfg(), tiene = !!v.img;
  return `<div class="card vted" style="margin-top:14px"><h2>Vitrina</h2>
    <p class="muted" style="margin-bottom:10px">Pon una imagen (PNG, JPG) o un PDF: una oferta, un producto nuevo, tu logo. Sale en toda la pantalla de venta mientras no estés buscando. Si no pones nada, se ve el mosaico de fotos.</p>
    <div class="row wrap"><label class="btn">${tiene ? "Cambiar imagen o PDF" : "Subir imagen o PDF"}<input type="file" accept="image/*,application/pdf,.pdf" data-in="vitfile" hidden></label>${tiene ? `<button class="btn sec" data-a="vitquitar">Quitar</button>` : ""}</div>
    ${tiene ? `<p class="muted sm" style="margin-top:12px">Arrastra la imagen con el dedo o el mouse. Acerca con la rueda, con dos dedos o con el deslizador. Arrastra también los textos.</p>
    <div class="vtprev" style="aspect-ratio:${vitAspect()}">${vitImgHtml(v)}</div>
    <div class="row wrap" style="align-items:center;gap:12px;margin-bottom:6px"><div class="seg vtfit" role="group" aria-label="Ajuste"><button class="${v.fit !== "contain" ? "on" : ""}" data-a="vitfit" data-v="cover">Llenar</button><button class="${v.fit === "contain" ? "on" : ""}" data-a="vitfit" data-v="contain">Entera</button></div><button class="link" data-a="vitcentrar">Centrar y restablecer</button></div>
    <label class="vtsl"><span>Acercar</span><input type="range" id="vt-zoom" min="100" max="400" step="5" value="${v.zoom}"></label>
    <label class="vtsl" style="max-width:240px"><span>Color del fondo (si la imagen no llena)</span><input type="color" id="vt-bg" value="${esc(v.bg || "#ffffff")}"></label>
    <h3 style="margin:16px 0 8px;font-size:15px">Textos y etiquetas</h3>
    <div class="row wrap vtadd">${[["oferta", "Oferta"], ["nuevo", "Nuevo"], ["precio", "Precio"], ["texto", "Texto libre"]].map(([k, n]) => `<button class="btn sec sm" data-a="vtxadd" data-k="${k}">+ ${n}</button>`).join("")}</div>
    <div class="vtlist">${(v.txt || []).map(vitTxRow).join("") || `<p class="muted sm">Aún no hay textos. Agrega una etiqueta de arriba.</p>`}</div>` : ""}</div>`;
}
function vitSet(patch, soft) {
  DB.cfg.vit = Object.assign({}, vitCfg(), patch);
  if (soft) return;
  save();
}
function vitTxSet(id, patch, soft) { vitSet({ txt: (vitCfg().txt || []).map((t) => (t.id === id ? Object.assign({}, t, patch) : t)) }, soft); }
function vitLive() { // actualiza la vista previa sin volver a dibujar Ajustes
  const v = vitCfg(), im = $(".vtprev .vimg"), w = $(".vtprev .vimgw");
  if (im) im.style.cssText = vitStyle(v); if (w) w.style.background = v.bg || "#fff";
  (v.txt || []).forEach((t) => { const el = $(`.vtprev .vtx[data-id="${t.id}"]`); if (el) { el.style.cssText = vitTxStyle(t); el.className = vitTxCls(t); if (el.textContent !== t.t) el.textContent = t.t; } });
  const z = $("#vt-zoom"); if (z && +z.value !== v.zoom) z.value = v.zoom;
}
function vitFromCanvas(c) {
  let out = c.toDataURL("image/webp", 0.86); if (out.slice(0, 15) !== "data:image/webp") out = c.toDataURL("image/jpeg", 0.88);
  vitSet({ img: out, ts: Date.now(), fit: "cover", zoom: 100, tx: 0, ty: 0, bg: "#ffffff" });
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
  vitcentrar: () => { vitSet({ fit: "cover", zoom: 100, tx: 0, ty: 0 }); render(); },
  vtxadd: (el) => { const v = vitCfg(); if ((v.txt || []).length >= 12) return toast("Máximo 12 textos"); const b = VIT_TXT[el.dataset.k]; if (!b) return; const off = (v.txt || []).length * 4 % 24; vitSet({ txt: (v.txt || []).concat([Object.assign({ id: "t" + Date.now().toString(36) + Math.floor(Math.random() * 99) }, b, { y: Math.min(95, b.y + off) })]) }); render(); },
  vtxdel: (el) => { vitSet({ txt: (vitCfg().txt || []).filter((t) => t.id !== el.dataset.id) }); render(); },
  vtxfondo: (el) => { const t = (vitCfg().txt || []).find((q) => q.id === el.dataset.id); if (!t) return; vitTxSet(t.id, { bg: t.bg ? "" : "#E5322D" }); render(); }
});
// Arrastrar la imagen o un texto sobre la vista previa; rueda y pellizco para acercar.
const vtPts = new Map(); let vtd = null, vtSaveT = 0;
const vtClampZ = (z) => Math.max(100, Math.min(400, Math.round(z)));
document.addEventListener("pointerdown", (e) => {
  const box = e.target.closest && e.target.closest(".vtprev"); if (!box) return;
  vtPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { box.setPointerCapture(e.pointerId); } catch (x) {}
  const v = vitCfg(), r = box.getBoundingClientRect();
  if (vtPts.size === 2) { const [a, b] = [...vtPts.values()]; vtd = { m: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: v.zoom }; return; }
  const tx = e.target.closest(".vtx"), t = tx && (v.txt || []).find((q) => q.id === tx.dataset.id);
  vtd = t ? { m: "txt", id: t.id, sx: e.clientX, sy: e.clientY, x0: t.x, y0: t.y, r } : { m: "pan", sx: e.clientX, sy: e.clientY, x0: v.tx || 0, y0: v.ty || 0, r };
  e.preventDefault();
});
document.addEventListener("pointermove", (e) => {
  if (!vtd || !vtPts.has(e.pointerId)) return;
  vtPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (vtd.m === "pinch") { if (vtPts.size < 2) return; const [a, b] = [...vtPts.values()]; vitSet({ zoom: vtClampZ(vtd.z0 * Math.hypot(a.x - b.x, a.y - b.y) / vtd.d0) }, true); vitLive(); return; }
  const dx = (e.clientX - vtd.sx) / vtd.r.width * 100, dy = (e.clientY - vtd.sy) / vtd.r.height * 100;
  if (vtd.m === "pan") vitSet({ tx: Math.round((vtd.x0 + dx) * 10) / 10, ty: Math.round((vtd.y0 + dy) * 10) / 10 }, true);
  else vitTxSet(vtd.id, { x: Math.max(0, Math.min(100, Math.round((vtd.x0 + dx) * 10) / 10)), y: Math.max(0, Math.min(100, Math.round((vtd.y0 + dy) * 10) / 10)) }, true);
  vitLive();
});
const vtEnd = (e) => { vtPts.delete(e.pointerId); if (vtd && !vtPts.size) { vtd = null; save(); } else if (vtd && vtd.m === "pinch" && vtPts.size < 2) { vtd = null; save(); } };
document.addEventListener("pointerup", vtEnd); document.addEventListener("pointercancel", vtEnd);
document.addEventListener("wheel", (e) => {
  const box = e.target.closest && e.target.closest(".vtprev"); if (!box) return;
  e.preventDefault(); const v = vitCfg(); vitSet({ zoom: vtClampZ(v.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)) }, true); vitLive();
  clearTimeout(vtSaveT); vtSaveT = setTimeout(save, 400);
}, { passive: false });
