/* ===================== 40 · PRODUCTOS E INVENTARIO ===================== */
const lowItems = () => DB.products.filter((p) => p.stock != null && p.stock <= (p.min || 0)).sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name, "es"));
const suggest = (p) => Math.max(1, Math.ceil(Math.max((p.min || 0) * 2 - p.stock, p.min || 1)));
VIEWS.prod = function viewProducts(v) {
  const low = lowItems(), val = r2(DB.products.reduce((a, p) => a + Math.max(0, p.stock || 0) * costOf(p), 0));
  const T = [["lista", "Inventario"], ["kx", "Movimientos (kardex)"], ["low", `Por reponer${low.length ? ` (${low.length})` : ""}`]];
  v.innerHTML = `<div class="ph"><h1>Productos</h1><div class="row wrap">
      ${can("precios") ? `<button class="btn sec sm" data-a="impopen">Importar</button>` : ""}<button class="btn sec sm" data-a="expprod">Exportar</button>
      ${can("stock") ? `<button class="btn sec sm" data-a="trfopen">Transferir</button>` : ""}${can("precios") ? `<button class="btn sm" data-a="pnew">+ Nuevo producto</button>` : ""}</div></div>
    <div class="seg tabs2">${T.map(([k, l]) => `<button class="${ui.ptab === k ? "on" : ""}" data-a="ptab" data-t="${k}">${l}</button>`).join("")}</div>
    <div id="pbody"></div>`;
  if (ui.ptab === "kx") return paintKardex();
  if (ui.ptab === "low") return paintLow();
  $("#pbody").innerHTML = `<div class="sumrow"><div class="sum"><b>${DB.products.length}</b><span>Productos</span></div><button class="sum lowbtn ${low.length ? "warn" : ""}" data-a="ptab" data-t="low"><b>${low.length}</b><span>Stock bajo · ver</span></button>${can("costos") ? `<div class="sum"><b class="num">${money(val)}</b><span>Inventario al costo</span></div>` : `<div class="sum"><b>${[...new Set(DB.products.map((p) => p.cat).filter(Boolean))].length}</b><span>Categorías</span></div>`}</div>
    <input class="inp" id="pq" type="search" placeholder="Buscar por nombre, categoría o código" style="margin-bottom:12px" value="${esc(ui.pq)}">
    <div class="list" id="plist"></div>`;
  paintPList();
};
function paintPList() {
  const el = $("#plist"); if (!el) return;
  if (!DB.products.length) { el.innerHTML = `<div class="empty"><h2>Inventario vacío</h2><p>Agrega tu primer producto, impórtalos desde Excel o carga ejemplos para probar.</p><button class="btn sec" data-a="sample">Cargar ejemplos</button></div>`; return; }
  const q = norm(ui.pq), raw = ui.pq || "";
  const list = DB.products.filter((p) => !q || norm(p.name).includes(q) || norm(p.cat).includes(q) || (p.code || "").includes(raw) || (p.pres || []).some((x) => (x.code || "").includes(raw)))
    .sort((a, b) => (a.stock != null && a.stock <= (a.min || 0) ? 0 : 1) - (b.stock != null && b.stock <= (b.min || 0) ? 0 : 1) || a.name.localeCompare(b.name, "es"));
  el.innerHTML = list.slice(0, 300).map((p) => {
    const kgp = p.unit === "kg", tag = p.stock == null ? "" : p.stock <= 0 ? `<span class="tag out">Agotado</span>` : p.stock <= (p.min || 0) ? `<span class="tag low">Stock bajo</span>` : "";
    const extra = [p.cat || "Sin categoría", p.code ? "Cód. " + p.code : "", kgp ? "Por kilo" : "", (p.pres || []).length ? `${p.pres.length} presentación${p.pres.length > 1 ? "es" : ""}` : "", (p.recipe || []).length ? "Con receta" : "", p.igv === false ? "Exonerado" : "", p.on === false ? "Oculto en venta" : ""].filter(Boolean).join(" · ");
    return `<button class="it" data-a="pedit" data-id="${p.id}"><span class="iti" style="--tint:${tintOf(p)}">${pimg(p, "lim")}</span><div class="t"><b>${esc(p.name)}${p.fav ? " ★" : ""}</b><small>${esc(extra)}</small> ${tag}</div><div class="v num">${money(p.price)}${kgp ? " /kg" : ""}<small>${p.stock == null ? "Sin control" : fmtQ(p.stock) + (kgp ? " kg" : " und.")}</small></div></button>`;
  }).join("") + (list.length > 300 ? `<p class="muted">Mostrando 300 de ${list.length}. Busca para encontrar el resto.</p>` : "") || `<div class="empty"><p>Nada coincide con tu búsqueda.</p></div>`;
}

/* ---------- ficha del producto ---------- */
function openProduct(id) {
  const p = id ? prod(id) : null;
  if (p && !can("precios")) return productInfo(p);
  const base = p ? JSON.parse(JSON.stringify(p)) : { id: "", name: "", price: "", cost: "", stock: "", min: 5, cat: ui.cat && !ui.cat.startsWith("__") ? ui.cat : "", code: "", unit: "u", pres: [], recipe: [], igv: true, img: "", fav: false, color: "", on: true };
  ui.pe = { id: id || "", d: base, stock0: p ? p.stock : null };
  paintPE();
}
function readPE() {
  const d = ui.pe && ui.pe.d; if (!d || !$("#pe")) return;
  $$("#pe [data-f]").forEach((el) => { const k = el.dataset.f; d[k] = el.type === "checkbox" ? el.checked : el.value; });
  d.pres = $$("#pe .prow").map((r) => ({ id: r.dataset.id, name: $("[data-pf=name]", r).value.trim(), f: num($("[data-pf=f]", r).value), price: num($("[data-pf=price]", r).value), code: $("[data-pf=code]", r).value.trim() }));
  d.recipe = $$("#pe .rrow").map((r) => ({ id: $("[data-rf=id]", r).value, qty: num($("[data-rf=qty]", r).value) }));
}
function paintPE() {
  const { id, d } = ui.pe, cats = [...new Set(DB.products.map((x) => x.cat).filter(Boolean))].sort();
  const kg = d.unit === "kg", others = DB.products.filter((x) => x.id !== id).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const imgMode = d.img && d.img.startsWith("data:") ? "Tu foto" : d.img && d.img.startsWith("foto:") ? "Foto elegida" : d.img && d.img.startsWith("lib:") ? "Ilustración elegida" : "Automática por nombre";
  openModal(`<div id="pe"><h2>${id ? "Editar producto" : "Nuevo producto"}</h2>
    <div class="pe-top">
      <div class="pe-img k-${imgKind(d)}" style="--cc:${tintOf(d)}">${pimg(d, "big")}<span class="prc num"><i>S/</i>${num(d.price || 0).toFixed(2)}</span><small>${imgMode}</small></div>
      <div class="pe-imgb"><button class="btn sec sm" data-a="imgpick">Elegir imagen</button><label class="btn sec sm">${svg("cam", "bi")}Tomar foto<input type="file" accept="image/*" capture="environment" data-in="pphoto" hidden></label>${d.img ? `<button class="link" data-a="imgauto">Usar automática</button>` : ""}
        <span class="cl-l">Color de la cartulina del precio</span>
        <div class="colors" role="group" aria-label="Color de la cartulina">${["", ...CARDS].map((c, i) => `<button class="sw ${(d.color || "").toUpperCase() === c ? "on" : ""}" data-a="pcolor" data-c="${c}" style="background:${c || "transparent"}" title="${c ? CARDNAME[i - 1] : "Automático según la categoría"}" aria-label="${c ? CARDNAME[i - 1] : "Automático"}">${c ? "" : "A"}</button>`).join("")}</div></div>
    </div>
    <label class="fld"><span>Nombre</span><input class="inp" data-f="name" value="${esc(d.name)}" ${id ? "" : "autofocus"} autocomplete="off" maxlength="60" placeholder="Ej: Tomate italiano"></label>
    <div class="two"><label class="fld"><span>Se vende</span><select class="inp" data-f="unit" data-a2="repaint"><option value="u" ${!kg ? "selected" : ""}>Por unidad</option><option value="kg" ${kg ? "selected" : ""}>Por kilo (se pesa)</option></select></label>
      <label class="fld"><span>Categoría</span><input class="inp" data-f="cat" list="catlist" value="${esc(d.cat)}" placeholder="Verduras, Bebidas..."><datalist id="catlist">${cats.map((c) => `<option value="${esc(c)}">`).join("")}</datalist></label></div>
    <div class="two"><label class="fld"><span>Precio de venta (S/${kg ? " por kilo" : ""})</span><input class="inp num" data-f="price" inputmode="decimal" value="${esc(d.price)}"></label>
      <label class="fld"><span>Costo (S/${kg ? " por kilo" : ""})</span><input class="inp num" data-f="cost" inputmode="decimal" value="${esc(d.cost)}" placeholder="${(d.recipe || []).length ? "Se calcula de la receta" : "Opcional"}"></label></div>
    <div class="two"><label class="fld"><span>Código rápido o de barras</span><span class="codein"><input class="inp" data-f="code" value="${esc(d.code)}" placeholder="Ej: ${nextCode()}" autocomplete="off"><button type="button" class="scanb" data-a="camcode" title="Leer el código con la cámara" aria-label="Leer el código con la cámara">${svg("scan")}</button></span></label>
      <label class="fld"><span>Stock actual${kg ? " (kg)" : ""}</span><input class="inp num" data-f="stock" inputmode="decimal" value="${d.stock == null ? "" : esc(d.stock)}" placeholder="Vacío = sin control"></label></div>
    <div class="two"><label class="fld"><span>Avisar si baja de</span><input class="inp num" data-f="min" inputmode="decimal" value="${esc(d.min)}"></label>
      <div class="checks"><label class="ck"><input type="checkbox" data-f="igv" ${d.igv !== false ? "checked" : ""}> Afecto a IGV</label><label class="ck"><input type="checkbox" data-f="fav" ${d.fav ? "checked" : ""}> Favorito (sale primero)</label><label class="ck"><input type="checkbox" data-f="on" ${d.on !== false ? "checked" : ""}> Mostrar en venta</label></div></div>
    <details class="box" ${(d.pres || []).length ? "open" : ""}><summary><b>Presentaciones</b><small>Ej: paquete x6, caja x12, jaba x30 — cada una con su precio y código</small></summary>
      <div class="prows">${(d.pres || []).map((x) => `<div class="prow" data-id="${x.id}"><input class="inp" data-pf="name" value="${esc(x.name)}" placeholder="Paquete x6"><input class="inp num" data-pf="f" inputmode="decimal" value="${esc(x.f || "")}" placeholder="${kg ? "kg" : "Unid."}" title="${kg ? "Kilos" : "Unidades"} que contiene"><input class="inp num" data-pf="price" inputmode="decimal" value="${esc(x.price || "")}" placeholder="Precio"><input class="inp" data-pf="code" value="${esc(x.code || "")}" placeholder="Código"><button class="x" data-a="presdel" data-id="${x.id}" aria-label="Quitar">✕</button></div>`).join("")}</div>
      <button class="btn sec sm" data-a="presadd">+ Agregar presentación</button></details>
    <details class="box" ${(d.recipe || []).length ? "open" : ""}><summary><b>Receta o insumos</b><small>Al vender este producto se descuentan sus insumos del stock</small></summary>
      <div class="prows">${(d.recipe || []).map((x, i) => `<div class="rrow"><select class="inp" data-rf="id">${others.map((o) => `<option value="${o.id}" ${o.id === x.id ? "selected" : ""}>${esc(o.name)}${o.unit === "kg" ? " (kg)" : ""}</option>`).join("")}</select><input class="inp num" data-rf="qty" inputmode="decimal" value="${esc(x.qty || "")}" placeholder="Cantidad"><button class="x" data-a="recdel" data-i="${i}" aria-label="Quitar">✕</button></div>`).join("")}</div>
      ${others.length ? `<button class="btn sec sm" data-a="recadd">+ Agregar insumo</button>` : `<p class="muted">Primero crea los insumos como productos.</p>`}</details>
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" data-enter data-a="psave">Guardar</button></div>
    ${id ? `<div class="btns three"><button class="btn sec sm" data-a="restock" data-id="${id}">Ingreso de mercadería</button><button class="btn sec sm" data-a="kxof" data-id="${id}">Ver movimientos</button><button class="btn red sec sm" data-a="pdel" data-id="${id}">Eliminar</button></div>` : ""}</div>`, "wide");
  ui.mk = "pe";
}
function productInfo(p) {
  openModal(`<div class="qhead">${pimg(p, "qimg")}<div><h2>${esc(p.name)}</h2><p class="muted">${esc(p.cat || "")} ${p.code ? "· Cód. " + esc(p.code) : ""}</p></div></div>
    <div class="kv"><span>Precio</span><b class="num">${money(p.price)}${p.unit === "kg" ? " /kg" : ""}</b></div>
    <div class="kv"><span>Stock</span><b class="num">${p.stock == null ? "Sin control" : fmtQ(p.stock)}</b></div>
    ${(p.pres || []).map((x) => `<div class="kv"><span>${esc(x.name)}</span><b class="num">${money(x.price)}</b></div>`).join("")}
    <div class="btns h"><button class="btn sec" data-a="close">Cerrar</button>${can("stock") ? `<button class="btn" data-a="restock" data-id="${p.id}">Ingreso de mercadería</button>` : ""}</div>`);
}
function saveProduct() {
  readPE();
  const { id, d } = ui.pe, name = String(d.name).trim(), price = r2(num(d.price));
  if (!name) return toast("Escribe el nombre del producto");
  if (!(price > 0)) return toast("Pon un precio mayor a 0");
  const code = String(d.code).trim();
  const codes = new Map(); DB.products.filter((x) => x.id !== id).forEach((x) => { if (x.code) codes.set(x.code, x.name); (x.pres || []).forEach((y) => { if (y.code) codes.set(y.code, x.name); }); });
  if (code && codes.has(code)) return toast(`El código ${code} ya lo usa «${codes.get(code)}»`);
  const pres = (d.pres || []).filter((x) => x.name || x.price || x.code);
  for (const x of pres) {
    if (!x.name || !(x.f > 0) || !(x.price > 0)) return toast("Cada presentación necesita nombre, cantidad y precio");
    if (x.code && (codes.has(x.code) || x.code === code || pres.filter((y) => y.code === x.code).length > 1)) return toast(`El código ${x.code} está repetido`);
    x.id = x.id || uid(); x.f = r3(x.f); x.price = r2(x.price);
  }
  const recipe = (d.recipe || []).filter((x) => x.id && x.qty > 0).map((x) => ({ id: x.id, qty: r3(x.qty) }));
  const stockStr = String(d.stock ?? "").trim(), stock = stockStr === "" ? null : r3(num(stockStr));
  const data = { name, price, cost: r2(num(d.cost)), min: Math.max(0, r3(num(d.min))), cat: String(d.cat || "").trim(), code, unit: d.unit === "kg" ? "kg" : "u", pres, recipe, igv: !!d.igv, fav: !!d.fav, on: !!d.on, img: d.img || "", color: d.color || "" };
  const apply = () => {
    let p = id ? prod(id) : null;
    if (p) {
      const old = p.stock;
      if (p.price !== data.price) log("Cambio de precio", `${p.name}: ${money(p.price)} → ${money(data.price)}`);
      Object.assign(p, data);
      if (stock === null) p.stock = null;
      else if (old == null) { p.stock = 0; stockAdd(p, stock, "inicial", "Ficha del producto"); if (!stock) p.stock = 0; }
      else if (stock !== old) { stockAdd(p, r3(stock - old), "ajuste", "Editado en la ficha"); }
    } else {
      p = Object.assign({ id: uid(), stock: null }, data); DB.products.push(p);
      if (stock !== null) { p.stock = 0; stockAdd(p, stock, "inicial", "Producto nuevo"); p.stock = stock; }
      log("Producto creado", p.name);
    }
    ui.pe = null; save(); closeModal(); toast("Producto guardado"); render();
  };
  const p0 = id ? prod(id) : null;
  if (p0 && stock !== p0.stock && !can("stock")) return need("stock", apply, "Cambiar el stock de " + name);
  apply();
}
function imgPicker() {
  readPE();
  const F = FOTO(), I = window.CF_IMG || {};
  const fk = Object.keys(F).filter((k) => k[0] !== "_"), ik = Object.keys(I);
  const ok = (q, k) => !q || norm(IMGNAME[k] || k).includes(norm(q));
  const cell = (pre, k, src) => `<button class="imgc ${pre}" data-a="imgset" data-k="${pre}:${k}"><img src="${src}" alt=""><span>${esc(IMGNAME[k] || k)}</span></button>`;
  const draw = (q) => { const a = fk.filter((k) => ok(q, k)), b = ik.filter((k) => ok(q, k)); return (a.length ? `<p class="igh">Fotos reales</p>` + a.map((k) => cell("foto", k, F[k])).join("") : "") + (b.length ? `<p class="igh">Ilustraciones</p>` + b.map((k) => cell("lib", k, I[k])).join("") : "") || `<p class="muted">No hay imágenes con ese nombre. Toma una foto de tu producto.</p>`; };
  openModal(`<h2>Elige una imagen</h2><input class="inp" id="imgq" type="search" placeholder="Buscar: tomate, gaseosa, pan…" autofocus style="margin-bottom:10px"><div class="imggrid" id="imggrid">${draw("")}</div>
    <div class="btns"><button class="btn sec" data-a="imgback">Volver</button></div>
    <p class="muted sm" style="margin-top:8px">Fotos: Grocery Store Dataset de Marcus Klasson (MIT). Ilustraciones: Fluent Emoji de Microsoft (MIT). Para tus productos envasados, lo mejor es una foto tuya.</p>`, "wide");
  ui.mk = "imgpick"; ui.imgdraw = draw;
}

/* ---------- ingreso de mercadería y ajustes ---------- */
function openRestock(id, back) {
  const p = prod(id); if (!p) return;
  const kg = p.unit === "kg";
  ui.rs = { id, back: !!back, kg };
  openModal(`<div class="qhead">${pimg(p, "qimg")}<div><h2>Ingreso de mercadería</h2><p class="muted"><b>${esc(p.name)}</b> · ahora ${p.stock == null ? "sin control de stock" : fmtQ(p.stock) + (kg ? " kg" : " und.")}</p></div></div>
    <div class="two"><label class="fld"><span>Llegaron (${kg ? "kg" : "unidades"})</span><input class="inp num big" id="rsq" inputmode="decimal" placeholder="${kg ? "Ej: 20" : "Ej: 24"}" autofocus></label>
    <label class="fld"><span>Costo por ${kg ? "kilo" : "unidad"} (S/)</span><input class="inp num" id="rsc" inputmode="decimal" placeholder="${p.cost || "0.00"}"></label></div>
    <label class="fld"><span>Proveedor o nota (opcional)</span><input class="inp" id="rsn" placeholder="Ej: Mercado mayorista" maxlength="40"></label>
    ${can("caja") ? `<label class="ck" style="margin-bottom:12px"><input type="checkbox" id="rspay"> Pagué al proveedor con dinero de la caja</label>` : ""}
    <div class="vuelto" id="rsprev"><span>Quedará en stock</span><b class="num">${fmtQ(p.stock || 0)}${kg ? " kg" : ""}</b></div>
    <div class="btns h"><button class="btn sec" data-a="${back ? "ptab" : "close"}" data-t="low">Volver</button><button class="btn" data-enter data-a="restockok">Guardar ingreso</button></div>
    <button class="link" data-a="adjust" data-id="${p.id}" style="width:100%">Corregir stock o registrar merma</button>`);
}
function updRestock() {
  const r = ui.rs, p = r && prod(r.id), el = $("#rsprev"); if (!p || !el) return;
  const q = r3(parseQty(($("#rsq") || { value: "" }).value)), c = num(($("#rsc") || { value: "" }).value) || p.cost || 0;
  el.innerHTML = `<span>Quedará en stock${q > 0 && c ? ` · costo total ${money(q * c)}` : ""}</span><b class="num">${fmtQ(r3((p.stock || 0) + (q > 0 ? q : 0)))}${r.kg ? " kg" : ""}</b>`;
}
function openAdjust(id) {
  const p = prod(id); if (!p) return;
  openModal(`<div class="qhead">${pimg(p, "qimg")}<div><h2>Corregir stock</h2><p class="muted"><b>${esc(p.name)}</b> · sistema dice ${p.stock == null ? "sin control" : fmtQ(p.stock)}</p></div></div>
    <div class="seg" style="margin-bottom:12px"><button class="on" id="adjk1" data-a="adjkind" data-k="conteo">Conté y hay</button><button id="adjk2" data-a="adjkind" data-k="merma">Merma / pérdida</button></div>
    <label class="fld"><span id="adjl">Cantidad real contada</span><input class="inp num big" id="adjq" inputmode="decimal" autofocus></label>
    <label class="fld"><span>Motivo</span><input class="inp" id="adjn" placeholder="Ej: inventario mensual, se malogró, vencido" maxlength="50"></label>
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" data-enter data-a="adjok" data-id="${p.id}">Guardar</button></div>`);
  ui.adj = "conteo";
}

/* ---------- kardex ---------- */
function paintKardex() {
  const el = $("#pbody"); const from = ui.kxfrom || addD(dkey(), -30), to = ui.kxto || dkey();
  const pid = ui.kxp, rows = DB.kx.filter((x) => x.d >= from && x.d <= to && (!pid || x.p === pid) && (!ui.kxt || x.ty.startsWith(ui.kxt))).sort((a, b) => b.t - a.t);
  const sorted = DB.products.slice().sort((a, b) => a.name.localeCompare(b.name, "es"));
  el.innerHTML = `<div class="filters"><label class="fld"><span>Producto</span><select class="inp" data-in="kxp"><option value="">Todos</option>${sorted.map((p) => `<option value="${p.id}" ${p.id === pid ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
    <label class="fld"><span>Tipo</span><select class="inp" data-in="kxt"><option value="">Todos</option>${["venta", "ingreso", "ajuste", "merma", "devolucion", "anulacion", "trf", "receta", "inicial", "import"].map((k) => `<option value="${k}" ${ui.kxt === k ? "selected" : ""}>${k === "trf" ? "Transferencias" : KXL[k]}</option>`).join("")}</select></label>
    <label class="fld"><span>Desde</span><input class="inp" type="date" data-in="kxfrom" value="${from}" max="${dkey()}"></label><label class="fld"><span>Hasta</span><input class="inp" type="date" data-in="kxto" value="${to}" max="${dkey()}"></label></div>
    ${rows.length ? `<div class="tablewrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Producto</th><th>Movimiento</th><th class="r">Cantidad</th><th class="r">Saldo</th><th>Referencia</th><th>Usuario</th></tr></thead><tbody>
    ${rows.slice(0, 500).map((x) => { const p = prod(x.p); return `<tr><td>${dmy(x.d)} ${hhmm(x.t)}</td><td>${esc(p ? p.name : "(eliminado)")}</td><td>${esc(KXL[x.ty] || x.ty)}</td><td class="r num ${x.q < 0 ? "loss" : "gain"}">${x.q > 0 ? "+" : ""}${fmtQ(x.q)}</td><td class="r num">${fmtQ(x.b)}</td><td>${esc(x.r)}</td><td>${esc(x.u)}</td></tr>`; }).join("")}</tbody></table></div>
    ${rows.length > 500 ? `<p class="muted">Mostrando 500 de ${rows.length}. Exporta para ver todo.</p>` : ""}<button class="btn sec sm" data-a="kxcsv" style="margin-top:10px">Exportar kardex (CSV)</button>`
    : `<div class="empty"><p>No hay movimientos con esos filtros.</p></div>`}`;
}
function paintLow() {
  const l = lowItems(), el = $("#pbody");
  el.innerHTML = l.length ? `<p class="muted" style="margin-bottom:10px">Productos que llegaron a su mínimo. «Pedir» es una sugerencia para cubrir el doble del mínimo.</p>
    <div class="list">${l.map((p) => `<div class="it"><span class="iti" style="--tint:${tintOf(p)}">${pimg(p, "lim")}</span><div class="t"><b>${esc(p.name)}</b><small>Quedan ${fmtQ(p.stock)}${p.unit === "kg" ? " kg" : ""} · mínimo ${fmtQ(p.min || 0)} · pedir ${suggest(p)}${p.unit === "kg" ? " kg" : ""}</small></div>${can("stock") ? `<button class="btn sm" data-a="restock" data-id="${p.id}" data-back="1">Ingreso</button>` : ""}</div>`).join("")}</div>
    <div class="row wrap" style="margin-top:12px"><button class="btn" data-a="lowwa">${svg("wa", "bi")}Enviar pedido por WhatsApp</button><button class="btn sec" data-a="lowprint">${svg("print", "bi")}Imprimir lista</button></div>`
    : `<div class="empty"><img class="eimg" src="${(window.CF_IMG || {}).canasta || ""}" alt=""><h2>Todo en orden</h2><p>Ningún producto está por debajo de su mínimo.</p></div>`;
}

/* ---------- importar / exportar ---------- */
function splitRow(line, d) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (c === d && !q) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur); return out.map((x) => x.trim());
}
function parseImport(text) {
  const lines = String(text).replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const res = { rows: [], errs: [], news: 0, upd: 0 };
  if (!lines.length) return res;
  const d = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
  const numv = (v) => { const n = parseFloat(String(v).replace(/[^\d.,-]/g, "").replace(",", ".")); return isFinite(n) ? n : NaN; };
  const f0 = splitRow(lines[0], d), start = f0.length > 1 && isNaN(numv(f0[1])) ? 1 : 0;
  const seen = new Set(); let rows = [];
  for (let i = start; i < lines.length; i++) {
    const c = splitRow(lines[i], d), ln = i + 1, name = c[0] || "", price = numv(c[1]);
    if (!name || !(price > 0)) { res.errs.push(ln); continue; }
    const cost = numv(c[2]), sr = (c[3] || "").trim(), st = sr === "" ? null : numv(sr), code = (c[5] || "").trim();
    if (code && seen.has(code)) { res.errs.push(ln); continue; }
    if (code) seen.add(code);
    rows.push({ name, price: r2(price), cost: isNaN(cost) ? null : r2(cost), stock: st == null || isNaN(st) ? null : r3(st), cat: (c[4] || "").trim(), code, unit: /^k/i.test((c[6] || "").trim()) ? "kg" : "u", ln });
  }
  rows.forEach((r) => { r.ex = DB.products.find((p) => (r.code && p.code === r.code) || norm(p.name) === norm(r.name)) || null; });
  rows = rows.filter((r) => { if (r.code && DB.products.some((p) => p.code === r.code && p !== r.ex)) { res.errs.push(r.ln); return false; } return true; });
  res.rows = rows; res.news = rows.filter((r) => !r.ex).length; res.upd = rows.filter((r) => r.ex).length;
  return res;
}
function openImport() {
  openModal(`<h2>Importar productos</h2>
    <p class="muted" style="margin-bottom:8px">Copia las filas desde Excel y pégalas aquí, o elige un archivo CSV. Columnas en este orden:</p>
    <p style="margin-bottom:10px"><b>Nombre · Precio · Costo · Stock · Categoría · Código · Unidad</b> <span class="muted">(Unidad: u o kg)</span></p>
    <textarea class="inp" id="imp" rows="7" placeholder="Tomate&#9;4.50&#9;3&#9;30&#9;Verduras&#9;1&#9;kg" autofocus></textarea>
    <div class="row wrap" style="margin:8px 0"><label class="btn sec sm">Elegir archivo CSV<input type="file" accept=".csv,.txt,text/csv,text/plain" data-in="impfile" hidden></label><button class="link" data-a="tpl">Descargar plantilla</button></div>
    <p class="muted" id="impsum" style="min-height:1.4em">Si un producto ya existe (mismo código o nombre) se actualizan su precio, costo y stock.</p>
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" id="impok" data-a="impok" disabled>Importar</button></div>`, "wide");
}
function updImport() {
  const el = $("#imp"); if (!el) return;
  const r = parseImport(el.value), sum = $("#impsum"), ok = $("#impok");
  if (!el.value.trim()) { sum.textContent = "Si un producto ya existe (mismo código o nombre) se actualizan su precio, costo y stock."; ok.disabled = true; return; }
  sum.innerHTML = `<b>${r.news}</b> nuevos · <b>${r.upd}</b> se actualizan${r.errs.length ? ` · <span style="color:var(--red)">${r.errs.length} con error (línea${r.errs.length > 1 ? "s" : ""} ${r.errs.slice(0, 6).join(", ")}${r.errs.length > 6 ? "…" : ""})</span>` : ""}`;
  ok.disabled = !r.rows.length;
}
function applyImport() {
  const r = parseImport(($("#imp") || { value: "" }).value); if (!r.rows.length) return;
  r.rows.forEach((x) => {
    if (x.ex) {
      Object.assign(x.ex, { name: x.name, price: x.price, unit: x.unit }); if (x.cost != null) x.ex.cost = x.cost; if (x.cat) x.ex.cat = x.cat; if (x.code) x.ex.code = x.code;
      if (x.stock != null) { if (x.ex.stock == null) x.ex.stock = 0; stockAdd(x.ex, r3(x.stock - x.ex.stock), "import", "Importación"); }
    } else {
      const p = { id: uid(), name: x.name, price: x.price, cost: x.cost || 0, stock: x.stock == null ? null : 0, min: x.stock == null ? 0 : x.unit === "kg" ? 3 : 5, cat: x.cat, code: x.code, unit: x.unit, pres: [], recipe: [], igv: true, img: "" };
      DB.products.push(p); if (x.stock) stockAdd(p, x.stock, "import", "Importación");
    }
  });
  log("Importación de productos", `${r.news} nuevos, ${r.upd} actualizados`);
  save(); closeModal(); toast(`Importados: ${r.news} nuevos, ${r.upd} actualizados`); render();
}
const exportProducts = () => csvOut([["nombre", "precio", "costo", "stock", "categoria", "codigo", "unidad"], ...DB.products.map((p) => [p.name, p.price, p.cost || 0, p.stock == null ? "" : p.stock, p.cat || "", p.code || "", p.unit === "kg" ? "kg" : "u"])], `productos-${dkey()}.csv`);

/* ---------- transferencias entre tiendas (por archivo) ---------- */
function openTransfer() {
  ui.trf = ui.trf || { to: "", items: [] };
  const t = ui.trf, q = norm(ui.trfq || "");
  const found = q ? DB.products.filter((p) => norm(p.name).includes(q) || (p.code || "") === ui.trfq).slice(0, 8) : [];
  openModal(`<h2>Transferir productos a otra tienda</h2>
    <p class="muted" style="margin-bottom:10px">Se descuentan de esta tienda y se descarga un archivo. En la otra tienda ábrelo en Ajustes › Tiendas › Recibir archivo.</p>
    <label class="fld"><span>Tienda que recibe</span><input class="inp" id="trfto" value="${esc(t.to)}" placeholder="Ej: Tienda Los Olivos" maxlength="40"></label>
    <label class="fld"><span>Agregar producto</span><input class="inp" id="trfq" type="search" value="${esc(ui.trfq || "")}" placeholder="Busca por nombre o código" autocomplete="off"></label>
    <div class="list" id="trffound">${found.map((p) => `<button class="it sm" data-a="trfadd" data-id="${p.id}"><span class="iti">${pimg(p, "lim")}</span><div class="t"><b>${esc(p.name)}</b><small>Stock ${p.stock == null ? "sin control" : fmtQ(p.stock)}</small></div><div class="v">+</div></button>`).join("")}</div>
    <div class="trfl">${t.items.length ? t.items.map((x, i) => { const p = prod(x.id); return p ? `<div class="part"><span>${esc(p.name)}</span><input class="inp num" data-trfq="${i}" inputmode="decimal" value="${x.qty}" aria-label="Cantidad"><button class="x" data-a="trfdel" data-i="${i}" aria-label="Quitar">✕</button></div>` : ""; }).join("") : `<p class="muted">Aún no agregas productos.</p>`}</div>
    <div class="btns h"><button class="btn sec" data-a="trfcancel">Cancelar</button><button class="btn" data-a="trfok" ${t.items.length ? "" : "disabled"}>Transferir y descargar</button></div>`, "wide");
  ui.mk = "trf";
}
function trfRead() { const t = ui.trf; if (!t) return; const to = $("#trfto"); if (to) t.to = to.value.trim(); $$("[data-trfq]").forEach((el) => { const x = t.items[+el.dataset.trfq]; if (x) x.qty = r3(parseQty(el.value)); }); }
function doTransfer() {
  trfRead(); const t = ui.trf;
  if (!t.to) return toast("Escribe a qué tienda envías");
  const items = t.items.filter((x) => x.qty > 0 && prod(x.id)); if (!items.length) return toast("Pon cantidades mayores a 0");
  for (const x of items) { const p = prod(x.id); if (p.stock != null && x.qty > p.stock && !DB.cfg.negStock) return toast(`No hay suficiente ${p.name} (quedan ${fmtQ(p.stock)})`); }
  const id = "TR-" + DB.biz.sid + "-" + uid().slice(-6).toUpperCase();
  const pack = { cf: "caja-facil", kind: "transfer", id, t: Date.now(), from: { sid: DB.biz.sid, name: DB.biz.store }, to: t.to, items: items.map((x) => { const p = prod(x.id); return { code: p.code, name: p.name, qty: x.qty, unit: p.unit, price: p.price, cost: p.cost || 0, cat: p.cat || "" }; }) };
  items.forEach((x) => stockAdd(prod(x.id), -x.qty, "trf_out", `A ${t.to} · ${id}`));
  log("Transferencia enviada", `${id} a ${t.to}: ${items.length} productos`);
  save(); download(`transferencia-${id}.json`, JSON.stringify(pack), "application/json");
  ui.trf = null; ui.trfq = ""; closeModal(); toast("Transferencia lista: envía el archivo a la otra tienda", true); render();
}

act({
  ptab: (el) => { if (modalOpen()) closeModal(); ui.ptab = el.dataset.t; if (ui.tab !== "prod") go("prod"); else render(); },
  pnew: () => need("precios", () => openProduct("")),
  pedit: (el) => openProduct(el.dataset.id),
  psave: saveProduct,
  pdel: (el) => { const id = el.dataset.id, p = prod(id); need("precios", () => confirmBox(`¿Eliminar «${p.name}»?`, "Eliminar", () => { DB.products = DB.products.filter((x) => x.id !== id); DB.tickets.forEach((t) => { t.items = t.items.filter((i) => i.id !== id); }); log("Producto eliminado", p.name); save(); toast("Producto eliminado"); render(); }, true, "Las ventas pasadas no cambian.")); },
  presadd: () => { readPE(); ui.pe.d.pres.push({ id: uid(), name: "", f: "", price: "", code: "" }); paintPE(); const r = $$("#pe .prow"); if (r.length) $("[data-pf=name]", r[r.length - 1]).focus(); },
  presdel: (el) => { readPE(); ui.pe.d.pres = ui.pe.d.pres.filter((x) => x.id !== el.dataset.id); paintPE(); },
  recadd: () => { readPE(); const o = DB.products.find((x) => x.id !== ui.pe.id); if (o) ui.pe.d.recipe.push({ id: o.id, qty: "" }); paintPE(); },
  recdel: (el) => { readPE(); ui.pe.d.recipe.splice(+el.dataset.i, 1); paintPE(); },
  pcolor: (el) => { readPE(); ui.pe.d.color = el.dataset.c; paintPE(); },
  imgpick: imgPicker,
  imgset: (el) => { const k = el.dataset.k; ui.pe.d.img = k.includes(":") ? k : "lib:" + k; paintPE(); },
  imgback: () => paintPE(),
  imgauto: () => { readPE(); ui.pe.d.img = ""; paintPE(); },
  restock: (el) => { if (!can("stock")) return need("stock", () => openRestock(el.dataset.id, el.dataset.back === "1"), "Ingreso de mercadería"); openRestock(el.dataset.id, el.dataset.back === "1"); },
  restockok: () => {
    const r = ui.rs, p = r && prod(r.id); if (!p) return;
    const q = r3(parseQty($("#rsq").value)); if (!(q > 0)) return toast("Escribe cuánto llegó");
    const c = num($("#rsc").value), note = $("#rsn").value.trim(), pay = $("#rspay") && $("#rspay").checked;
    if (c > 0) { if (p.stock > 0 && p.cost > 0) p.cost = r2((p.stock * p.cost + q * c) / (p.stock + q)); else p.cost = r2(c); }
    if (p.stock == null) p.stock = 0;
    stockAdd(p, q, "ingreso", note || "Ingreso");
    if (pay) { const amt = r2(q * (c || p.cost || 0)); if (amt > 0) addMove("proveedor", amt, `${note || "Proveedor"} · ${p.name}`); }
    save(); toast(`Stock de ${p.name}: ${fmtQ(p.stock)}${r.kg ? " kg" : ""}`);
    closeModal(); if (r.back) { ui.ptab = "low"; } render();
  },
  adjust: (el) => openAdjust(el.dataset.id),
  adjkind: (el) => { ui.adj = el.dataset.k; $("#adjk1").classList.toggle("on", ui.adj === "conteo"); $("#adjk2").classList.toggle("on", ui.adj === "merma"); $("#adjl").textContent = ui.adj === "conteo" ? "Cantidad real contada" : "Cantidad perdida"; $("#adjq").focus(); },
  adjok: (el) => {
    const p = prod(el.dataset.id); if (!p) return;
    const q = r3(parseQty($("#adjq").value)), why = $("#adjn").value.trim();
    if (ui.adj === "conteo") { if (!(q >= 0) || $("#adjq").value.trim() === "") return toast("Escribe cuánto contaste"); if (p.stock == null) p.stock = 0; const d = r3(q - p.stock); if (d) stockAdd(p, d, "ajuste", why || "Conteo físico"); }
    else { if (!(q > 0)) return toast("Escribe cuánto se perdió"); if (p.stock == null) return toast("Este producto no controla stock"); stockAdd(p, -q, "merma", why || "Merma"); }
    log(ui.adj === "conteo" ? "Ajuste de stock" : "Merma", `${p.name}: ${fmtQ(p.stock)}`); save(); closeModal(); toast("Stock actualizado"); render();
  },
  kxof: (el) => { ui.kxp = el.dataset.id; ui.ptab = "kx"; closeModal(); render(); },
  kxcsv: () => { const from = ui.kxfrom || addD(dkey(), -30), to = ui.kxto || dkey(); csvOut([["fecha", "hora", "producto", "movimiento", "cantidad", "saldo", "referencia", "usuario"], ...DB.kx.filter((x) => x.d >= from && x.d <= to && (!ui.kxp || x.p === ui.kxp)).sort((a, b) => a.t - b.t).map((x) => { const p = prod(x.p); return [x.d, hhmm(x.t), p ? p.name : "", KXL[x.ty] || x.ty, x.q, x.b, x.r, x.u]; })], `kardex-${dkey()}.csv`); },
  lowwa: () => { const l = lowItems(); window.open("https://wa.me/?text=" + encodeURIComponent(`*Pedido - ${DB.biz.name}*\n` + l.map((p) => `- ${p.name}: ${suggest(p)}${p.unit === "kg" ? " kg" : ""}`).join("\n")), "_blank", "noopener"); },
  lowprint: () => printHtml(`<h2>Lista de reposición · ${esc(DB.biz.name)}</h2><p>${fmtDT(Date.now())}</p><table class="tbl"><thead><tr><th>Producto</th><th class="r">Quedan</th><th class="r">Mínimo</th><th class="r">Pedir</th></tr></thead><tbody>${lowItems().map((p) => `<tr><td>${esc(p.name)}</td><td class="r">${fmtQ(p.stock)}</td><td class="r">${fmtQ(p.min || 0)}</td><td class="r"><b>${suggest(p)}</b></td></tr>`).join("")}</tbody></table>`, "rep"),
  impopen: () => need("precios", openImport),
  impok: applyImport,
  tpl: () => csvOut([["nombre", "precio", "costo", "stock", "categoria", "codigo", "unidad"], ["Tomate", "4.50", "3", "30", "Verduras", "1", "kg"], ["Lechuga", "2.50", "1.5", "20", "Verduras", "2", "u"], ["Gaseosa 500 ml", "3", "2.2", "24", "Bebidas", "7750001", "u"]], "plantilla-productos.csv"),
  expprod: () => { if (!DB.products.length) return toast("Aún no hay productos para exportar"); exportProducts(); },
  trfopen: () => need("stock", () => { ui.trf = null; ui.trfq = ""; openTransfer(); }, "Transferir stock"),
  trfadd: (el) => { trfRead(); const t = ui.trf; if (!t.items.some((x) => x.id === el.dataset.id)) t.items.push({ id: el.dataset.id, qty: 1 }); ui.trfq = ""; openTransfer(); },
  trfdel: (el) => { trfRead(); ui.trf.items.splice(+el.dataset.i, 1); openTransfer(); },
  trfok: doTransfer,
  trfcancel: () => { ui.trf = null; ui.trfq = ""; closeModal(); }
});
