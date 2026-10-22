/* ===================== 34 · VITRINA PROPIA (imagen o PDF del dueño) ===================== */
// Varias vitrinas que se turnan solas: DB.cfg.vits = [{ id, on, h (se muestra hasta AAAA-MM-DD), kind }]
//   kind "img" (imagen o PDF subido) e "ia" (dibujada por la IA): { img (data:), fit, zoom 100-400, tx/ty (% de la caja), bg, ts, txt:[{id,t,x,y,s,c,bg,f,k,h}] }
//   kind "tpl" (diseño con un producto, se arma en vivo con su foto y su precio): { tpl, tone, pid, title, sub, price }
// DB.cfg.vitRot = segundos entre una y otra. La vitrina única de antes (DB.cfg.vit) pasa sola a ser la primera.
const VIT_BLANK = { img: "", fit: "cover", zoom: 100, tx: 0, ty: 0, bg: "#ffffff", ts: 0, txt: [] };
const VIT_MAX = 12, VIT_MAX_IMG = 6;
const vitId = () => "v" + Date.now().toString(36) + Math.floor(Math.random() * 999);
function vitList() {
  if (!Array.isArray(DB.cfg.vits)) { const v = DB.cfg.vit; DB.cfg.vits = v && v.img ? [Object.assign({ id: vitId(), on: true, kind: "img" }, v)] : []; delete DB.cfg.vit; }
  return DB.cfg.vits;
}
const vitSel = () => vitList().find((x) => x.id === ui.vsl) || null;
const vitCfg = () => { const v = vitSel(); return v && v.kind !== "tpl" && v.img ? v : VIT_BLANK; };
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
function vitImgHtml(v, all) {
  return `<div class="vbox"><div class="vimgw" style="background:${esc(v.bg || "#fff")}"><img class="vimg" src="${bu("vit:" + (v.id || "") + ":" + (v.ts || 0), v.img)}" alt="" draggable="false" style="${vitStyle(v)}"></div><div class="vovl">${(v.txt || []).filter((t) => all || !t.h || dkey() <= t.h).map(vitTxHtml).join("")}</div></div>`;
}
// Parecido a lo que se ve en la venta de este equipo (para que la vista previa sea fiel).
function vitAspect() {
  const W = innerWidth, H = innerHeight, w = W >= 1100 ? W * 0.4 : W - 28, h = Math.max(300, H - 190);
  return Math.min(1.8, Math.max(0.6, w / h)).toFixed(2);
}
function vitTxRow(t) {
  return `<div class="vtrow" data-id="${t.id}"><input class="inp" data-vtx="t" data-id="${t.id}" value="${esc(t.t)}" maxlength="60" aria-label="Texto">
    <label class="vtmini"><span>Se muestra hasta</span><input class="inp" type="date" data-vtx="h" data-id="${t.id}" value="${esc(t.h || "")}"></label>
    <label class="vtmini"><span>Tipo de letra</span><select class="inp" data-vtx="f" data-id="${t.id}">${VIT_FONTS.map(([k, n]) => `<option value="${k}"${(t.f || "limpia") === k ? " selected" : ""}>${n}</option>`).join("")}</select></label>
    <label class="vtmini"><span>Estilo</span><select class="inp" data-vtx="k" data-id="${t.id}">${VIT_ESTILOS.map(([k, n]) => `<option value="${k}"${(t.k || "plano") === k ? " selected" : ""}>${n}</option>`).join("")}</select></label>
    <label class="vtmini"><span>Tamaño</span><input type="range" data-vtx="s" data-id="${t.id}" min="3" max="40" value="${t.s}"></label>
    <label class="vtmini"><span>Letra</span><input type="color" data-vtx="c" data-id="${t.id}" value="${esc(t.c)}"></label>
    <label class="vtmini"><span>Fondo</span><input type="color" data-vtx="bg" data-id="${t.id}" value="${esc(t.bg || "#E5322D")}"></label>
    <button class="btn sec sm" data-a="vtxfondo" data-id="${t.id}">${t.bg ? "Sin fondo" : "Con fondo"}</button>
    <button class="btn sec sm" data-a="vtxdel" data-id="${t.id}" aria-label="Borrar texto">Borrar</button></div>`;
}
function vitEditor() {
  const L = vitList(); if (ui.vsl && !vitSel()) ui.vsl = null;
  const v = vitSel(), rot = +DB.cfg.vitRot || 8;
  return `<div class="card vted" style="margin-top:14px"><h2>Vitrina</h2>
    <p class="muted" style="margin-bottom:10px">Pon varias imágenes o diseños con tus productos: se turnan solos en la pantalla de venta mientras no estés buscando. También puedes pedírselos a Luis: «haz una oferta de Inca Kola a 2.90».</p>
    ${L.length ? `<div class="vsths">${L.map((x, k) => vitThumb(x, k, L.length)).join("")}</div>` : `<p class="muted sm" style="margin-bottom:10px">Aún no hay vitrinas: se ve el mosaico de fotos.</p>`}
    <div class="row wrap vtnew"><label class="btn sm">+ Subir imagen o PDF<input type="file" accept="image/*,application/pdf,.pdf" data-in="vitfile" hidden></label><button class="btn sec sm" data-a="vtpnew">+ Diseño con un producto</button><button class="btn sec sm" data-a="vianew">+ Dibujar con IA</button>
      ${L.length > 1 ? `<label class="vtmini vtrot"><span>Cambiar cada</span><select class="inp" data-vrot="1">${[5, 8, 12, 20, 30].map((n) => `<option value="${n}"${n === rot ? " selected" : ""}>${n} segundos</option>`).join("")}</select></label>` : ""}</div>
    ${v ? (v.kind === "tpl" ? vitTplForm(v) : vitImgForm(v)) : L.length ? `<p class="muted sm" style="margin-top:12px">Toca una vitrina para editarla.</p>` : ""}</div>`;
}
function vitThumb(v, i, n) {
  const on = v.on !== false, venc = !!(v.h && v.h < dkey());
  return `<div class="vsth${v.id === ui.vsl ? " sel" : ""}${!on || venc ? " off" : ""}">
    <button class="vsth-p" data-a="vsel" data-id="${v.id}" aria-label="Editar vitrina ${i + 1}"><span class="vsth-box">${vitSlideHtml(v, true)}</span></button>
    <div class="vsth-b"><span class="vsth-n">${i + 1}. ${esc(vitName(v))}${venc ? " · ya venció" : !on ? " · oculta" : ""}</span>
      <span class="vsth-k"><button class="ib" data-a="vson" data-id="${v.id}">${on ? "Ocultar" : "Mostrar"}</button><button class="ib" data-a="vsmove" data-id="${v.id}" data-d="-1"${i ? "" : " disabled"} aria-label="Mover antes">↑</button><button class="ib" data-a="vsmove" data-id="${v.id}" data-d="1"${i < n - 1 ? "" : " disabled"} aria-label="Mover después">↓</button></span></div></div>`;
}
const vitName = (v) => v.kind === "tpl" ? (VIT_TPL_N[v.tpl] || "Diseño") + (v.pid && prod(v.pid) ? " · " + prod(v.pid).name : v.title ? " · " + v.title : "") : v.kind === "ia" ? "Dibujo con IA" : "Imagen";
const vitUntilFld = (v) => `<label class="vtmini"><span>Se muestra hasta (vacío = siempre)</span><input class="inp" type="date" data-vs="h" value="${esc(v.h || "")}"></label>`;
function vitImgForm(v) {
  return `<div class="vtform"><div class="row wrap" style="align-items:flex-end;gap:10px"><label class="btn sec sm">Cambiar imagen<input type="file" accept="image/*,application/pdf,.pdf" data-in="vitfile" data-repl="1" hidden></label>${vitUntilFld(v)}<button class="btn sec sm" data-a="vitquitar">Borrar esta vitrina</button></div>
    <p class="muted sm" style="margin-top:12px">Arrastra la imagen con el dedo o el mouse. Acerca con la rueda, con dos dedos o con el deslizador. Arrastra también los textos.</p>
    <div class="vtprev" style="aspect-ratio:${vitAspect()}">${vitImgHtml(v, true)}</div>
    <div class="row wrap" style="align-items:center;gap:12px;margin-bottom:6px"><div class="seg vtfit" role="group" aria-label="Ajuste"><button class="${v.fit !== "contain" ? "on" : ""}" data-a="vitfit" data-v="cover">Llenar</button><button class="${v.fit === "contain" ? "on" : ""}" data-a="vitfit" data-v="contain">Entera</button></div><button class="btn sec sm" data-a="vitcentrar">Centrar</button></div>
    <label class="vtsl"><span>Acercar</span><input type="range" id="vt-zoom" min="100" max="400" step="5" value="${v.zoom}"></label>
    <label class="vtsl" style="max-width:240px"><span>Color del fondo (si la imagen no llena)</span><input type="color" id="vt-bg" value="${esc(v.bg || "#ffffff")}"></label>
    <h3 style="margin:16px 0 8px;font-size:15px">Textos y etiquetas</h3>
    <div class="row wrap vtadd">${[["oferta", "Oferta"], ["nuevo", "Nuevo"], ["precio", "Precio"], ["texto", "Texto libre"]].map(([k, n]) => `<button class="btn sec sm" data-a="vtxadd" data-k="${k}">+ ${n}</button>`).join("")}</div>
    <div class="vtlist">${(v.txt || []).map(vitTxRow).join("") || `<p class="muted sm">Aún no hay textos. Agrega una etiqueta de arriba.</p>`}</div></div>`;
}
function vitTplForm(v) {
  const p = v.pid ? prod(v.pid) : null, names = DB.products.filter((x) => x.on !== false).slice(0, 600).map((x) => `<option value="${esc(x.name)}"></option>`).join("");
  return `<div class="vtform"><div class="vtpwrap"><div class="vtp-prev" style="aspect-ratio:${vitAspect()}">${vitTplHtml(v)}</div>
    <div class="vtpf"><div class="seg vtpk" role="group" aria-label="Plantilla">${VIT_TPLS.map(([k, n]) => `<button class="${v.tpl === k ? "on" : ""}" data-a="vtpset" data-k="tpl" data-v="${k}">${n}</button>`).join("")}</div>
      <button class="btn sec sm" data-a="vtpset" data-k="tone" data-v="${((v.tone || 0) + 1) % 3}">Otro estilo de color</button>
      ${v.tpl === "aviso" ? "" : `<label class="vtmini"><span>Producto</span><input class="inp" list="vtpprods" data-vtp="prod" value="${esc(p ? p.name : "")}" placeholder="Escribe y elige" autocomplete="off"><datalist id="vtpprods">${names}</datalist></label>`}
      <label class="vtmini"><span>${v.tpl === "aviso" ? "Aviso" : "Título (vacío = nombre del producto)"}</span><input class="inp" data-vtp="title" maxlength="70" value="${esc(v.title || "")}"></label>
      ${v.tpl === "aviso" ? "" : `<label class="vtmini"><span>Precio a mostrar (vacío = el de la caja)</span><input class="inp num" data-vtp="price" inputmode="decimal" value="${v.price ? (+v.price).toFixed(2) : ""}" placeholder="${p ? vitTplPrice(Object.assign({}, v, { price: 0 }), p).pr.toFixed(2) : "0.00"}"></label>`}
      <label class="vtmini"><span>Texto chico (opcional)</span><input class="inp" data-vtp="sub" maxlength="50" value="${esc(v.sub || "")}" placeholder="${v.tpl === "aviso" ? "Ej: Gracias por su preferencia" : "Ej: Solo este fin de semana"}"></label>
      ${vitUntilFld(v)}<button class="btn sec sm" data-a="vitquitar">Borrar esta vitrina</button></div></div></div>`;
}
function vitSet(patch, soft) {
  const L = vitList(), i = L.findIndex((x) => x.id === ui.vsl); if (i < 0) return;
  L[i] = Object.assign({}, L[i], patch);
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
const vitEncode = (c) => { let out = c.toDataURL("image/webp", 0.86); if (out.slice(0, 15) !== "data:image/webp") out = c.toDataURL("image/jpeg", 0.88); return out; };
// Imagen nueva: se agrega como otra vitrina (o reemplaza la elegida si tocaste «Cambiar imagen»).
function vitFromCanvas(c, kind) {
  const base = { img: vitEncode(c), ts: Date.now(), fit: "cover", zoom: 100, tx: 0, ty: 0, bg: "#ffffff" }, cur = vitSel();
  if (ui.vrepl && cur && cur.kind !== "tpl") { vitSet(base); log("Vitrina", "Imagen cambiada"); }
  else {
    const L = vitList(); if (L.length >= VIT_MAX) { ui.vrepl = false; return toast(`Máximo ${VIT_MAX} vitrinas. Borra una para agregar otra.`, true); }
    if (L.filter((x) => x.kind !== "tpl").length >= VIT_MAX_IMG) { ui.vrepl = false; return toast(`Máximo ${VIT_MAX_IMG} imágenes (pesan). Los diseños con productos no tienen límite de peso.`, true); }
    const n = Object.assign({ id: vitId(), on: true, kind: kind || "img", txt: [] }, base); L.push(n); ui.vsl = n.id; save(); log("Vitrina", "Imagen agregada");
  }
  ui.vrepl = false; toast("Imagen lista. Acomódala como quieras"); if (ui.tab === "aj") render();
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
  vitquitar: () => confirmBox("¿Borrar esta vitrina?", "Borrar", () => { const sel = vitSel(); DB.cfg.vits = vitList().filter((x) => x !== sel); ui.vsl = null; save(); log("Vitrina", "Vitrina borrada"); render(); }),
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

/* ---------- diseños con un producto: se arman en vivo con su foto, nombre y precio (gratis y sin internet) ---------- */
const VIT_TPLS = [["oferta", "Oferta"], ["nuevo", "Nuevo"], ["precio", "Precio especial"], ["destacado", "Destacado"], ["aviso", "Aviso"]];
const VIT_TPL_N = Object.fromEntries(VIT_TPLS);
const VIT_TAG = { oferta: "Oferta", nuevo: "¡Nuevo!", precio: "Precio especial", destacado: "Recomendado", aviso: "Aviso" };
// Precio que se muestra: el que pusiste; si no, el de la caja (con su oferta si está vigente, y el normal tachado).
function vitTplPrice(v, p) {
  const nor = p ? +p.price || 0 : 0, of = p ? ofertaOf(p) : null, mine = +v.price || 0;
  if (mine > 0) return { pr: mine, old: nor > mine + 0.004 ? nor : 0 };
  if (of && of < nor) return { pr: of, old: nor };
  return { pr: nor, old: 0 };
}
function vitTplHtml(v) {
  const p = v.tpl !== "aviso" && v.pid ? prod(v.pid) : null, d = vitTplPrice(v, p), kg = p && p.unit === "kg";
  const name = v.title || (p ? p.name : v.tpl === "aviso" ? "Escribe tu aviso" : "Elige un producto");
  const sub = v.sub || (v.h ? `Hasta el ${dmy(v.h).slice(0, 5)}` : "");
  const img = p ? `<div class="vtp-im k-${imgKind(p)}">${pimg(p, "vtp-pim")}</div>` : "";
  return `<div class="vtp t-${esc(v.tpl || "oferta")} tn-${(+v.tone || 0) % 3}${img ? "" : " noimg"}"><i class="vtp-dec" aria-hidden="true"></i><div class="vtp-in">${img}<div class="vtp-tx"><span class="vtp-tag">${VIT_TAG[v.tpl] || ""}</span><b class="vtp-nm">${esc(name)}</b>${d.old ? `<s class="vtp-old num">${money(d.old)}</s>` : ""}${d.pr > 0 && v.tpl !== "aviso" ? `<span class="vtp-pr num"><small>S/</small>${d.pr.toFixed(2)}${kg ? "<small>/kg</small>" : ""}</span>` : ""}${sub ? `<span class="vtp-sub">${esc(sub)}</span>` : ""}</div></div></div>`;
}
const vitSlideHtml = (v, all) => (v.kind === "tpl" ? vitTplHtml(v) : `<div class="vimgbox">${vitImgHtml(v, all)}</div>`);
// Las que salen en la venta: prendidas, sin vencer y con algo que mostrar.
const vitActive = () => { const hoy = dkey(); return vitList().filter((v) => v.on !== false && (!v.h || v.h >= hoy) && (v.kind === "tpl" ? (v.tpl === "aviso" ? !!v.title : !!(v.pid && prod(v.pid)) || !!v.title) : !!v.img)); };
function vitSlidesHtml() {
  const L = vitActive(); if (!L.length) return "";
  const cur = (ui.vsi || 0) % L.length;
  return `<div class="vit-home custom vslides">${L.map((v, i) => `<div class="vsl${i === cur ? " on" : ""}">${vitSlideHtml(v)}</div>`).join("")}${L.length > 1 ? `<div class="vdots" aria-hidden="true">${L.map((v, i) => `<i class="${i === cur ? "on" : ""}"></i>`).join("")}</div>` : ""}</div>`;
}
// Turno: cada N segundos pasa a la siguiente (solo cambia clases, no vuelve a dibujar la pantalla).
function vitTurn() {
  const box = document.querySelector("#grid .vslides");
  if (box && !document.hidden) {
    const sl = box.querySelectorAll(".vsl");
    if (sl.length > 1) { const n = ((ui.vsi || 0) + 1) % sl.length; ui.vsi = n; sl.forEach((e, i) => e.classList.toggle("on", i === n)); box.querySelectorAll(".vdots i").forEach((e, i) => e.classList.toggle("on", i === n)); }
  }
  setTimeout(vitTurn, Math.max(3, +DB.cfg.vitRot || 8) * 1000);
}
setTimeout(vitTurn, 8000);
function vitNewTpl(o) {
  const L = vitList(); if (L.length >= VIT_MAX) { toast(`Máximo ${VIT_MAX} vitrinas. Borra una para agregar otra.`, true); return null; }
  const n = Object.assign({ id: vitId(), on: true, kind: "tpl", tpl: "oferta", tone: 0, pid: "", title: "", sub: "", price: 0 }, o || {});
  L.push(n); save(); log("Vitrina", "Diseño agregado: " + vitName(n)); return n;
}
function vitTplLive() { const v = vitSel(), b = $(".vtp-prev"); if (v && b) b.innerHTML = vitTplHtml(v); }
act({
  vsel: (el) => { ui.vsl = ui.vsl === el.dataset.id ? null : el.dataset.id; render(); },
  vson: (el) => { const v = vitList().find((x) => x.id === el.dataset.id); if (!v) return; v.on = v.on === false; save(); render(); },
  vsmove: (el) => { const L = vitList(), i = L.findIndex((x) => x.id === el.dataset.id), j = i + (+el.dataset.d); if (i < 0 || j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; save(); render(); },
  vtpnew: () => { const top = topIds()[0], p = (top && prod(top)) || DB.products.find((x) => x.on !== false); const n = vitNewTpl({ pid: p ? p.id : "", tpl: p ? "oferta" : "aviso" }); if (n) { ui.vsl = n.id; render(); } },
  vianew: () => { helpOpen(); const i = $("#helpInput"); if (i) { i.value = "Dibuja "; i.focus(); try { i.setSelectionRange(7, 7); } catch (e) {} } },
  vtpset: (el) => { const k = el.dataset.k; vitSet({ [k]: k === "tone" ? +el.dataset.v : el.dataset.v }); render(); }
});
let vtpSaveT = 0;
document.addEventListener("input", (e) => {
  const t = e.target, d = t && t.dataset; if (!d) return;
  if (d.vrot) { DB.cfg.vitRot = +t.value || 8; save(); return; }
  if (d.vs === "h") { vitSet({ h: t.value || "" }); if (ui.tab === "aj") { const s = $(".vsths"); if (s) s.innerHTML = vitList().map((x, k, a) => vitThumb(x, k, a.length)).join(""); } vitTplLive(); return; }
  if (!d.vtp) return;
  let patch;
  if (d.vtp === "prod") { const n = norm(t.value), p = DB.products.find((x) => norm(x.name) === n); if (!p) return; patch = { pid: p.id }; }
  else if (d.vtp === "price") patch = { price: Math.max(0, r2(num(t.value) || 0)) };
  else patch = { [d.vtp]: t.value.slice(0, 70) };
  vitSet(patch, true); vitTplLive(); clearTimeout(vtpSaveT); vtpSaveT = setTimeout(save, 500);
});

/* ---------- Luis arma la vitrina: «haz una oferta de Inca Kola a 2.90 hasta el domingo», «aviso: hoy cerramos a las 9», «dibuja una canasta de frutas» ---------- */
const VIT_DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const VIT_MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"];
// «hasta …» en el texto (ya con norm): devuelve [fecha AAAA-MM-DD, texto chico, trozo a quitar]
function vitHasta(n) {
  const hoy = new Date();
  if (/\b(solo|nomas|nada mas) (por )?hoy\b|\bhasta hoy\b/.test(n)) return [dkey(), "Solo hoy", /\b(solo|nomas|nada mas) (por )?hoy\b|\bhasta hoy\b/];
  if (/\bfin de mes\b/.test(n)) return [dkey(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)), "", /\b(hasta )?(el )?fin de mes\b/];
  if (/\bfin de semana\b/.test(n)) { const d = new Date(hoy); d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); return [dkey(d), "Solo este fin de semana", /\b(solo )?(por )?(este )?fin de semana\b/]; }
  let m = n.match(/\bhasta (el )?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/);
  if (m) { const d = new Date(hoy); d.setDate(d.getDate() + ((VIT_DIAS.indexOf(m[2]) - d.getDay() + 7) % 7)); return [dkey(d), "", m[0]]; }
  m = n.match(/\bhasta (el )?(\d{1,2})(?:\s*(?:\/|-|de)\s*(\d{1,2}|[a-z]+))?\b/);
  if (m) {
    const dd = +m[2]; let mm = hoy.getMonth();
    if (m[3]) { const k = /^\d+$/.test(m[3]) ? +m[3] - 1 : VIT_MESES.findIndex((x) => x.startsWith(m[3].slice(0, 3))); if (k >= 0 && k < 12) mm = k; }
    let d = new Date(hoy.getFullYear(), mm, dd); if (dd < 1 || dd > 31) return null;
    if (dkey(d) < dkey()) d = new Date(hoy.getFullYear() + (m[3] ? 1 : 0), mm + (m[3] ? 0 : 1), dd);
    return [dkey(d), "", m[0]];
  }
  return null;
}
// El producto más parecido a lo que dijo (por palabras), o nada.
function vitFindProd(q) {
  const n = " " + norm(q).replace(/[^a-z0-9ñ ]/g, " ").replace(/\s+/g, " ").trim() + " "; if (n.length < 4) return null;
  let best = null, bs = 0;
  DB.products.forEach((p) => {
    if (p.on === false) return;
    const pn = norm(p.name).replace(/[^a-z0-9ñ ]/g, " ").replace(/\s+/g, " ").trim(); let sc = 0;
    if (n.includes(" " + pn + " ")) sc = 100 + pn.length;
    else { const ws = pn.split(" ").filter((w) => w.length > 2 && !/^\d+$/.test(w)), hit = ws.filter((w) => n.includes(" " + w + " ") || (w.length > 4 && n.includes(" " + w.slice(0, -1)))).length; if (hit) sc = hit * 10 + (hit === ws.length ? 15 : 0) - ws.length * 0.5 - pn.length * 0.01; }
    if (sc > bs) { bs = sc; best = p; }
  });
  return bs >= 10 ? best : null;
}
const VIT_RELLENO = new Set("haz hazme hace crea creame pon ponme ponle arma armame prepara preparame genera quiero una un uno la el lo los las de del para en con a al por que mi mis tu su vitrina afiche cartel letrero banner poster publicidad anuncio anuncia imagen diseno diseño oferta ofertita promo promocion descuento remate liquidacion nuevo nueva novedad llego llegaron recien destaca destacado destacada recomendado recomendada recomienda precio especial aviso avisa luis porfa favor soles sol s/ s/. esta este solo nomas hoy hasta y ya tenemos hay venta".split(" "));
function vitParseLuis(text) {
  const t = String(text || "").trim(), n = norm(t).replace(/\s+/g, " ");
  // 1) dibujo con IA
  const ia = n.match(/^(?:luis,?\s+)?(?:por favor\s+)?(?:dibuja|dibujame|dibujar|genera|generame|crea|creame|haz|hazme)\s+(?:una?\s+)?(?:imagen|foto|dibujo|fondo|ilustracion)\b(?:\s+con\s+ia)?[\s,:]*(?:de|con|para)?\s*/) || n.match(/^(?:luis,?\s+)?(?:dibuja|dibujame)\s+/);
  if (ia) { const idea = t.slice(ia[0].length).trim(); return { ia: idea || t }; }
  // 2) afiche con un producto o un aviso
  const ctx = /\b(vitrina|afiche|cartel|letrero|banner|poster|publicidad)\b/.test(n);
  const tpl = /\b(oferta|ofertita|promo|promocion|descuento|remate|liquidacion)\b/.test(n) ? "oferta"
    : /^(?:luis,?\s+)?(?:pon(?:me)?\s+(?:un\s+)?|haz(?:me)?\s+un\s+|crea\s+un\s+)?(aviso|anuncio|comunicado)\b|\b(avisa|anuncia) que\b|\bque diga\b/.test(n) ? "aviso"
    : /\b(destaca|destacado|destacada|recomendado|recomendada|recomienda)\b/.test(n) ? "destacado"
    : /\bprecio especial\b/.test(n) ? "precio"
    : /\b(nuevo|nueva|novedad|llego|recien llegad)/.test(n) && ctx ? "nuevo" : ctx ? "destacado" : null;
  if (!tpl) return null;
  const out = { tpl, tone: 0, pid: "", title: "", sub: "", price: 0, h: "" };
  let rest = n;
  const ha = vitHasta(n); if (ha) { out.h = ha[0]; out.sub = ha[1]; rest = rest.replace(ha[2], " "); }
  if (tpl === "aviso") {
    const m = t.match(/(?:aviso|anuncio|comunicado|avisa que|anuncia que|que diga)\s*[:,]?\s*/i);
    let tx = m ? t.slice(t.toLowerCase().indexOf(m[0].toLowerCase()) + m[0].length) : "";
    tx = tx.replace(/^["'«“]+|["'»”]+$/g, "").replace(/\s+en la vitrina\.?$/i, "").trim();
    out.title = tx ? tx.charAt(0).toUpperCase() + tx.slice(1, 70) : "";
    out.sub = ""; return out;
  }
  const pm = rest.match(/(?:\ba|\bpor|\ben|s\/\.?)\s*(\d+(?:[.,]\d{1,2})?)(?!\s*(?:pm|am|%|horas|hrs|de la|ml|gr?|kg|litros?|l)\b)|(\d+(?:[.,]\d{1,2})?)\s*(?:soles|sol|lucas)\b/);
  if (pm) { out.price = r2(num(pm[1] || pm[2])); rest = rest.replace(pm[0], " "); }
  const p = vitFindProd(rest);
  if (p) out.pid = p.id;
  else { const ws = t.split(/\s+/).filter((w) => { const k = norm(w).replace(/[^a-z0-9ñ]/g, ""); return k && !VIT_RELLENO.has(k) && !/^\d+([.,]\d+)?$/.test(k) && !VIT_DIAS.includes(k) && !VIT_MESES.includes(k); }); const tt = ws.join(" ").replace(/[.,;:!?]+$/, ""); out.title = tt ? tt.charAt(0).toUpperCase() + tt.slice(1, 60) : ""; }
  return out;
}
let vitCards = {}, vitCardN = 0;
function vitCardPrev(v) { return v.kind === "tpl" ? vitTplHtml(v) : `<img class="hl-vimg" src="${bu("ia:" + v.ts, v.img)}" alt="">`; }
function vitCard(v) {
  const id = ++vitCardN, w = document.createElement("div"); vitCards[id] = { v, el: w };
  w.className = "hl-card hl-vit";
  w.innerHTML = `<div class="hl-ch"><i aria-hidden="true"></i>Para tu vitrina</div><div class="hl-vprev">${vitCardPrev(v)}</div>
    <div class="hl-cb"><button type="button" class="hl-b sec" data-a="vlNo" data-id="${id}">Cancelar</button>${v.kind === "tpl" ? `<button type="button" class="hl-b sec" data-a="vlOtro" data-id="${id}">Otro estilo</button>` : ""}<button type="button" class="hl-b" data-a="vlSi" data-id="${id}">Poner en la vitrina</button></div>`;
  return w;
}
// Devuelve true si el texto era un pedido para la vitrina y ya se atendió.
function vitLuis(text) {
  let r; try { r = vitParseLuis(text); } catch (e) { return false; }
  if (!r) return false;
  if (r.ia !== undefined) { vitIA(r.ia); return true; }
  if (r.tpl !== "aviso" && !r.pid && !r.title) { helpSay("¿De qué producto hago el afiche? Por ejemplo: «haz una oferta de Inca Kola a 2.90 hasta el domingo»."); return true; }
  if (r.tpl === "aviso" && !r.title) { helpSay("¿Qué pongo en el aviso? Por ejemplo: «aviso: hoy cerramos a las 9 pm»."); return true; }
  const v = Object.assign({ kind: "tpl" }, r), p = v.pid ? prod(v.pid) : null;
  const nota = p && !v.price ? ` Usé el precio de tu caja (${money(vitTplPrice(v, p).pr)}).` : !p && v.tpl !== "aviso" ? " No encontré ese producto en tu caja, así que va sin foto." : "";
  helpSay("Así quedaría." + nota + " Puedes cambiarle el color o ponerlo en tu vitrina.", { node: vitCard(v), instant: true });
  return true;
}
const vitImgToCanvas = (src) => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(vitDraw(im, im.naturalWidth, im.naturalHeight)); im.onerror = no; im.src = src; });
async function vitIA(idea) {
  if (!idea || idea.length < 3) return void helpSay("¿Qué quieres que dibuje? Por ejemplo: «dibuja una canasta de frutas frescas con fondo verde».");
  if (!cloudOn() || navigator.onLine === false) return void helpSay("Para dibujar con IA necesito internet y que tu caja esté conectada a la nube (Ajustes › Nube). Mientras tanto puedo armarte un afiche con tus productos, por ejemplo: «haz una oferta de Inca Kola a 2.90».");
  if (helpBusy) return;
  helpBusy = true; const chat = $("#helpChat"); if (chat) chat.classList.add("busy");
  const wait = helpAppend("assistant", "Dibujando tu imagen… puede tardar hasta un minuto.", { temporary: true });
  try {
    const s = cloudLoad(), tk = await cloudToken();
    const r = await fetch(SB_URL + "/functions/v1/vitrina-ia", { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + tk, "Content-Type": "application/json" }, body: JSON.stringify({ neg: s.neg, idea: String(idea).slice(0, 400) }), signal: AbortSignal.timeout(100000) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.img) throw Object.assign(new Error("ia"), { status: r.status || 0 });
    const c = await vitImgToCanvas(d.img);
    const v = { kind: "ia", img: vitEncode(c), ts: Date.now(), fit: "cover", zoom: 100, tx: 0, ty: 0, bg: "#ffffff", txt: [] };
    if (wait) wait.remove();
    helpSay("Aquí está. Si te gusta, ponla en tu vitrina; después puedes agregarle textos y precios en Ajustes › Pantalla de venta.", { node: vitCard(v), instant: true });
  } catch (e) {
    if (wait) wait.remove();
    const st = e.status || 0;
    helpSay(st === 503 || st === 404 ? "La IA de dibujo todavía no está activada: falta poner la clave del servicio de imágenes. Mientras tanto puedo armarte afiches con tus productos, por ejemplo: «haz una oferta de Inca Kola a 2.90»."
      : st === 403 ? "La IA de dibujo es parte del extra de voz e IA, o ya usaste los pedidos de hoy. Pídele a tu proveedor que lo active."
      : st === 401 ? "Tu sesión de Google venció. Vuelve a entrar en Ajustes › Nube." : "No pude dibujar ahora. Inténtalo otra vez en un momento.");
  } finally { if (wait) wait.remove(); helpBusy = false; if (chat) chat.classList.remove("busy"); }
}
function vitCardDone(c, txt) { c.done = true; c.el.querySelectorAll("button").forEach((b) => { b.disabled = true; }); if (txt) helpSay(txt.t, txt.o); }
act({
  vlOtro: (el) => { const c = vitCards[el.dataset.id]; if (!c || c.done) return; c.v.tone = ((+c.v.tone || 0) + 1) % 3; const b = c.el.querySelector(".hl-vprev"); if (b) b.innerHTML = vitCardPrev(c.v); },
  vlNo: (el) => { const c = vitCards[el.dataset.id]; if (!c || c.done) return; vitCardDone(c, { t: "Listo, no la puse." }); },
  vlSi: (el) => {
    const c = vitCards[el.dataset.id]; if (!c || c.done) return;
    need("ajustes", () => {
      const L = vitList(), v = c.v;
      if (L.length >= VIT_MAX) return void helpSay(`Ya tienes ${VIT_MAX} vitrinas. Borra alguna en Ajustes › Pantalla de venta y vuelve a intentarlo.`, { go: ["aj.venta"] });
      if (v.kind === "ia" && L.filter((x) => x.kind !== "tpl").length >= VIT_MAX_IMG) return void helpSay(`Ya tienes ${VIT_MAX_IMG} imágenes (pesan). Borra alguna en Ajustes › Pantalla de venta.`, { go: ["aj.venta"] });
      const n = Object.assign({ id: vitId(), on: true }, v); L.push(n); ui.vsi = vitActive().findIndex((x) => x.id === n.id); save(); log("Vitrina", (v.kind === "ia" ? "Dibujo con IA" : vitName(n)) + " (Luis)");
      if (ui.tab === "venta") paintSale();
      const otra = DB.cfg.view !== "vit";
      vitCardDone(c, { t: otra ? "Listo, ya está guardada. Tu pantalla de venta no está en modo Vitrina; actívalo para verla." : `Listo, ya está en tu vitrina.${vitActive().length > 1 ? ` Se turna con las demás cada ${+DB.cfg.vitRot || 8} segundos.` : ""}`, o: otra ? { node: vitVerBtn() } : {} });
    }, "Cambiar la vitrina");
  },
  vlVer: () => { DB.cfg.view = "vit"; save(); helpClose(); go("venta"); }
});
function vitVerBtn() { const w = document.createElement("div"); w.className = "hl-go"; w.innerHTML = `<button type="button" class="hl-gob" data-a="vlVer">Activar la Vitrina y verla</button>`; return w; }
