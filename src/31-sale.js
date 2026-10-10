/* ===================== 31 · VENDER: pantalla de caja, cobro y comprobantes ===================== */
function focusQ() {
  if (!DESK() || ui.tab !== "venta" || ui.locked || modalOpen()) return;
  const q = $("#q"); if (q && document.activeElement !== q) q.focus();
}
VIEWS.venta = function viewSale(v) {
  const cobra = can("cobrar"), tables = +DB.cfg.tables;
  v.innerHTML = `<div class="pos">
    <section class="left">
      <div class="searchbar">
        <label class="sbox">${svg("search")}<input id="q" type="search" enterkeyhint="go" placeholder="${DESK() ? "Escanea o escribe un producto" : "Busca o escanea"}" autocomplete="off" value="${esc(ui.q)}" aria-label="Buscar producto o código"></label>
        <button class="tool cam" data-a="camscan" title="Escanear códigos con la cámara">${svg("scan")}<span>Cámara</span></button>
        <button class="tool xtra ${scaleState.on ? "live" : ""}" data-a="scaletool" id="scaleTool" title="Balanza">${svg("scale")}<span>${scaleState.on ? "Balanza lista" : "Balanza"}</span></button>
        ${tables ? `<button class="tool xtra" data-a="mesas" title="Mesas">${svg("mesa")}<span>Mesas</span></button>` : ""}
        ${cobra ? `<button class="tool xtra" data-a="prevload" title="Cobrar una preventa">${svg("prev")}<span>Preventa</span></button>` : ""}
        <button class="tool xtra" data-a="quick" title="Cobrar un monto suelto">${svg("plus")}<span>Monto</span></button>
        <button class="tool more" data-a="tools" title="Más herramientas" aria-label="Más herramientas">${svg("mas")}</button>
      </div>
      <div class="chips cats" id="cats"></div>
      <div class="grid t-${DB.cfg.tile}" id="grid"></div>
      <div class="brandrow"><b>${esc(DB.biz.name || "Caja Fácil")}</b>${curShift() ? `<i class="cstat">Caja abierta</i>` : ""}<span>Caja Fácil · ${esc((me() || {}).name || "")}</span></div>
      <div class="fkeys" aria-label="Teclas rápidas">
    ${cobra ? `<button class="fk c-azul" data-a="pickcli"><kbd>F1</kbd>${svg("cli")}<span>Clientes</span></button>
    <button class="fk c-verde" data-a="pay" data-m="efectivo"><kbd>F2</kbd>${svg("money")}<span>Cobrar</span></button>` : `<button class="fk c-azul" data-a="pickcli"><kbd>F1</kbd>${svg("cli")}<span>Clientes</span></button>
    <button class="fk c-verde" data-a="prevsave"><kbd>F2</kbd>${svg("prev")}<span>Guardar preventa</span></button>`}
    <button class="fk c-azul" data-a="focusq"><kbd>F3</kbd>${svg("search")}<span>Buscar</span></button>
    <button class="fk c-ambar" data-a="tknew"><kbd>F4</kbd>${svg("hold")}<span>En espera</span></button>
    <button class="fk c-azul" data-a="qeditsel"><kbd>F6</kbd>${svg("edit")}<span>Cantidad</span></button>
    ${cobra ? `<button class="fk c-azul" data-a="split"><kbd>F7</kbd>${svg("ventas")}<span>Dividir pago</span></button>
    <button class="fk c-lila" data-a="pay" data-m="yape"><kbd>F8</kbd>${svg("money")}<span>Yape</span></button>
    <button class="fk c-azul" data-a="pay" data-m="tarjeta"><kbd>F9</kbd>${svg("caja")}<span>Tarjeta</span></button>
    <button class="fk c-celeste" data-a="pay" data-m="plin"><kbd>F10</kbd>${svg("money")}<span>Plin</span></button>` : ""}
    <button class="fk c-rojo" data-a="rmsel"><kbd>Supr</kbd>${svg("trash")}<span>Quitar</span></button>
    ${cobra ? `<button class="fk c-ambar" data-a="pay" data-m="credito">${svg("cli")}<span>Crédito</span></button>` : ""}
    <button class="fk c-azul" data-a="showdisc">${svg("plus")}<span>Descuento</span></button>
    </div>
    </section>
    <aside class="cart" id="cart" aria-label="Ticket actual"></aside>
  </div>
  <div class="cartbar" id="cartbar" hidden></div>`;
  paintSale(); focusQ();
};
function paintSale() { if (ui.tab !== "venta" || !$("#grid")) return; paintCats(); paintGrid(); paintCart(); }
function topIds() {
  const from = addD(dkey(), -30), m = {};
  DB.sales.forEach((x) => { if (x.void || x.date < from) return; x.items.forEach((i) => { if (!i.quick) m[i.id] = (m[i.id] || 0) + i.qty * (i.f || 1); }); });
  return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 18).map((e) => e[0]);
}
function paintCats() {
  const el = $("#cats"); if (!el) return;
  const cats = [...new Set(DB.products.map((p) => p.cat).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  if (!cats.length && !DB.products.length) { el.innerHTML = ""; return; }
  const im = (c) => { const s = catImg(c); return s ? `<img src="${s}" alt="">` : ""; };
  const chip = (c, label, img = true) => `<button class="chip ${ui.cat === c ? "on" : ""}" data-a="cat" data-c="${esc(c)}">${img ? im(c) : ""}${label}</button>`;
  el.innerHTML = chip("", "Todo", false) + (DB.products.some((p) => p.fav) ? chip("__fav", "★ Favoritos", false) : "") + chip("__top", "Más vendidos", false) + cats.map((c) => chip(c, esc(c))).join("");
}
// Ficha de producto: foto real (o ilustración) con su precio en cartulina, como en el mercado.
function tileHtml(p, qn) {
  const kg = p.unit === "kg", u = kg ? " kg" : "";
  const low = p.stock != null && p.stock <= (p.min || 0), out = p.stock != null && p.stock <= 0;
  const st = p.stock == null || out ? "" : `${low ? "Quedan" : "Stock"} ${fmtQ(p.stock)}${u}`;
  const tilt = ([...String(p.id)].reduce((a, c) => a + c.charCodeAt(0), 0) % 5) - 2;
  return `<button class="pt k-${imgKind(p)} ${qn ? "in" : ""} ${out ? "out" : low ? "low" : ""}" data-a="add" data-id="${p.id}" style="--cc:${tintOf(p)};--tilt:${tilt * 0.9 - 1.5}deg">
    <span class="pbox">${pimg(p)}<span class="badges">${p.code && p.code.length <= 5 ? `<span class="cd" title="Código">${esc(p.code)}</span>` : ""}${kg ? `<span class="kgb" title="Se vende por peso">${svg("scale")}kg</span>` : ""}${(p.pres || []).length ? `<span class="presb" title="Tiene presentaciones">+${p.pres.length}</span>` : ""}</span>${out ? `<span class="tape">Agotado</span>` : ""}${qn ? `<span class="qty num ${ui.bump === p.id ? "bump" : ""}">${fmtQ(qn)}${u}</span>` : ""}</span>
    <span class="prc num"><i>S/</i>${p.price.toFixed(2)}${kg ? "<em>kilo</em>" : ""}</span>
    <b class="nm">${esc(p.name)}</b>
    <small class="st">${st || (out ? "Sin stock" : "&nbsp;")}</small></button>`;
}
// Modo escáner (minimarket): sin fotos; lo último que pasaste en grande, accesos para lo que no tiene código y búsqueda en lista.
const scanMode = () => DB.cfg.view !== "tiles";
function rowHtml(p, qn) {
  const kg = p.unit === "kg", out = p.stock != null && p.stock <= 0;
  return `<button class="prow ${qn ? "in" : ""} ${out ? "out" : ""}" data-a="add" data-id="${p.id}"><span class="pn"><b>${esc(p.name)}</b><small>${p.code ? "Cód. " + esc(p.code) : "Sin código"}${p.stock != null ? ` · ${out ? "sin stock" : "stock " + fmtQ(p.stock) + (kg ? " kg" : "")}` : ""}</small></span>${qn ? `<span class="pq num">${fmtQ(qn)}${kg ? " kg" : ""}</span>` : ""}<span class="pp num">${money(p.price)}${kg ? "<small>/kg</small>" : ""}</span></button>`;
}
function scanHome() {
  const lines = cartLines(), cur = lines.find(({ l }) => lineKey(l.id, l.pres) === ui.sel) || lines[lines.length - 1];
  const tops = topIds();
  const quick = DB.products.filter((p) => p.on !== false && (!p.code || p.code.length <= 5))
    .sort((a, b) => ((b.fav ? 1 : 0) - (a.fav ? 1 : 0)) || ((tops.indexOf(a.id) + 1 || 999) - (tops.indexOf(b.id) + 1 || 999)) || a.name.localeCompare(b.name, "es")).slice(0, 18);
  const last = cur ? `<div class="lastp ${ui.bump ? "fresh" : ""}"><small>Lo último que pasaste</small><b class="ln1">${esc(cur.r.name)}</b><span class="ln2 num">${fmtQ(cur.l.qty)}${unitTxt(cur.r)} × ${money(cur.r.price)}</span><b class="ln3 num">${money(r2(cur.r.price * cur.l.qty))}</b></div>`
    : `<div class="lastp idle">${svg("scan")}<b class="ln1">Pasa el primer producto</b><small>Escanea el código o escribe el nombre para buscar.</small></div>`;
  return `${last}${quick.length ? `<div class="quick"><h3>Sin código de barras</h3><div class="qgrid">${quick.map((p) => `<button class="qk" data-a="add" data-id="${p.id}">${p.code ? `<i class="num">${esc(p.code)}</i>` : ""}<b>${esc(p.name)}</b><span class="num">${money(p.price)}${p.unit === "kg" ? "/kg" : ""}</span></button>`).join("")}</div></div>` : ""}`;
}
function paintGrid() {
  const el = $("#grid"); if (!el) return;
  if (!DB.products.length) {
    el.innerHTML = `<div class="empty hero" style="grid-column:1/-1"><h2>Empecemos por tus productos</h2><p>Agrégalos uno por uno, súbelos desde Excel o prueba primero con una lista de ejemplo.</p><div class="row" style="justify-content:center;gap:10px;flex-wrap:wrap">${can("precios") ? `<button class="btn" data-a="pnew">Agregar producto</button>` : ""}<button class="btn sec" data-a="sample">Cargar ejemplos</button></div></div>`;
    return;
  }
  const sm = scanMode(); document.body.classList.toggle("scanmode", sm); el.classList.toggle("scanlist", sm);
  if (sm && !ui.q.trim()) { el.innerHTML = scanHome(); ui.bump = null; return; }
  const raw = ui.q.trim(), mm = raw.match(/^[\d.,\/]+\s*(?:k?g|gr)?\s*[*xX]\s*(.*)$/i), key = mm ? mm[1].trim() : raw, q = norm(key);
  const tops = ui.cat === "__top" ? topIds() : [];
  const catOk = (p) => !ui.cat || (ui.cat === "__top" ? tops.includes(p.id) : ui.cat === "__fav" ? p.fav : p.cat === ui.cat);
  let list = DB.products.filter((p) => p.on !== false && (q ? true : catOk(p)) && (!q || norm(p.name).includes(q) || (p.code || "") === key || (p.code || "").startsWith(key) || (p.pres || []).some((x) => x.code === key)));
  list.sort(ui.cat === "__top" && !q ? (a, b) => tops.indexOf(a.id) - tops.indexOf(b.id) : (a, b) => ((b.code === key) - (a.code === key)) || ((b.fav ? 1 : 0) - (a.fav ? 1 : 0)) * (ui.cat ? 0 : 1) || a.name.localeCompare(b.name, "es"));
  if (!list.length) { el.innerHTML = ui.cat === "__top" && !q ? `<div class="empty" style="grid-column:1/-1"><h2>Aún no hay más vendidos</h2><p>Aparecerán aquí con tus primeras ventas.</p></div>` : `<div class="empty" style="grid-column:1/-1"><h2>No encontré «${esc(raw)}»</h2><p>Prueba con otro nombre o código, o usa «Monto» para cobrar un importe suelto.</p></div>`; return; }
  const inCart = {}; DB.cart.items.forEach((i) => { const r = resolveLine(i); if (r && !i.quick) inCart[i.id] = r3((inCart[i.id] || 0) + i.qty * r.f); });
  el.innerHTML = list.map((p) => (sm ? rowHtml : tileHtml)(p, inCart[p.id])).join("");
  ui.bump = null;
}
function paintTickets() {
  const el = $("#tks"); if (!el) return;
  el.innerHTML = DB.tickets.map((t, i) => `<button class="tk ${i === DB.cur ? "on" : ""} ${t.mesa ? "mesa" : ""}" data-a="tk" data-i="${i}">${esc(ticketLabel(t))}<small class="num">${t.items.length ? money(ticketTotal(t)) : "vacío"}</small></button>`).join("");
}
const nItems = (n) => `${n} ${n === 1 ? "producto" : "productos"}`;
function paintCart() {
  const el = $("#cart"); if (!el) return;
  const t = DB.cart, T = cartTotals(), lines = T.lines, cobra = can("cobrar"), c = cli(t.client), doc = t.doc || DB.cfg.docDef || "NV";
  if (lines.length) ui.done = null;
  const bar = $("#cartbar");
  if (!lines.length && ui.done && saleById(ui.done)) { el.innerHTML = doneHtml(saleById(ui.done)); if (bar) bar.hidden = true; return; }
  ui.done = null;
  if (!lines.length) document.body.classList.remove("cart-open");
  if (!lines.some((x) => lineKey(x.l.id, x.l.pres) === ui.sel)) ui.sel = lines.length ? lineKey(lines[lines.length - 1].l.id, lines[lines.length - 1].l.pres) : null;
  const debt = c ? balanceOf(c) : 0, pts = c && DB.cfg.pts.on ? pointsOf(c) : 0, dis = lines.length ? "" : "disabled";
  const fresh = ui.fresh; ui.fresh = null;
  el.innerHTML = `<div class="cart-in">
    <div class="paper">
      <div class="rhead">
        <div class="rtop"><span class="bizl">${esc(DB.biz.name || "Caja Fácil")}</span><span class="rtime num">${hhmm(Date.now())}</span><button class="cart-x" data-a="closecart" aria-label="Cerrar ticket">${svg("close")}</button></div>
        <div class="rmeta">${t.mesa || t.prev ? `<b class="tkn">${esc(ticketLabel(t))}</b>` : `<button class="tkn" data-a="tkname" title="Ponerle un nombre a este ticket">${esc(ticketLabel(t))}${svg("edit")}</button>`}
          <span class="racts"><button class="ib" data-a="tknew" title="Poner en espera y atender a otro cliente (F4)">${svg("hold")}<span>En espera</span></button>${lines.length || DB.tickets.length > 1 ? `<button class="ib" data-a="clear" title="${DB.tickets.length > 1 ? "Quitar este ticket" : "Vaciar el ticket"}">${svg("trash")}<span>${DB.tickets.length > 1 ? "Quitar" : "Vaciar"}</span></button>` : ""}</span></div>
        ${DB.tickets.length > 1 ? `<div class="tks" id="tks"></div>` : ""}
        <div class="who">
          <button class="cl ${c ? "set" : ""}" data-a="pickcli">${c ? `<span class="av" style="--h:${avHue(c)}">${esc(initials(c.name))}</span>` : `<span class="av none">${svg("user")}</span>`}<span><b>${c ? esc(c.name) : "Público general"}</b><small>${c ? `${c.doc ? esc(c.dt) + " " + esc(c.doc) : "Sin documento"}${debt > 0 ? " · debe " + money(debt) : ""}${pts ? ` · ${pts} pts` : ""}` : "Elegir cliente (F1)"}</small></span></button>
          <div class="seg" role="group" aria-label="Comprobante">${Object.keys(DOCS).map((d) => `<button class="${doc === d ? "on" : ""}" data-a="doc" data-d="${d}" title="${DOCS[d]}">${d === "NV" ? "Nota" : DOCS[d]}</button>`).join("")}</div>
        </div>
      </div>
      <div class="lines">${lines.length ? `<div class="lh" aria-hidden="true"><span>Cant.</span><span>Producto</span><span>P. unit.</span><span>Importe</span><span></span></div>` + lines.map(({ l, r }) => { const k = lineKey(l.id, l.pres); return `<div class="ln ${ui.sel === k ? "sel" : ""} ${fresh === k ? "fresh" : ""}" data-a="sel" data-k="${k}">
        <span class="qc step"><button class="sb" data-a="dec" data-k="${k}" aria-label="Quitar uno">−</button><button class="qv num" data-a="qedit" data-k="${k}" aria-label="Cambiar cantidad">${fmtQ(l.qty)}${unitTxt(r)}</button><button class="sb" data-a="inc" data-k="${k}" aria-label="Agregar uno">+</button></span>
        <span class="nm">${r.p ? pimg(r.p, "lim") : ""}<span><b>${esc(r.name)}</b>${r.code ? `<small>Cód. ${esc(r.code)}</small>` : ""}</span></span>
        <button class="pu num ${l.pr != null ? "chg" : ""}" data-a="lprice" data-k="${k}" title="Cambiar precio">${money(r.price)}${r.unit === "kg" ? "<small>/kg</small>" : ""}</button>
        <span class="amt num">${money(r2(r.price * l.qty))}</span>
        <button class="rm" data-a="rmline" data-k="${k}" aria-label="Quitar ${esc(r.name)}">${svg("close")}</button></div>`; }).join("") : `<div class="cart-empty">${svg("scan")}<p><b>Todo listo para vender</b>Escanea, busca o toca un producto para empezar.</p></div>`}</div>
      <div class="tot">
        ${lines.length ? `<div class="trow">${ui.showDisc || t.disc ? `<label class="disc"><span>Descuento S/</span><input class="inp num" id="disc" data-in="disc" inputmode="decimal" placeholder="0.00" value="${t.disc ? t.disc : ""}"></label>` : `<button class="link xs" data-a="showdisc">+ Descuento</button>`}
          <div class="sumx"><span>Subtotal <b class="num">${money(T.sub)}</b></span>${DB.cfg.igvOn ? `<span>IGV ${DB.cfg.igv}% <b class="num">${money(T.igv)}</b></span>` : ""}</div></div>` : ""}
        <div class="bigtot"><span>Total<small>${nItems(T.count)}${T.disc ? ` · descuento ${money(T.disc)}` : ""}</small></span><b class="num" id="cartTotal">${money(T.total)}</b></div>
      </div>
    </div>
    <div class="paybox">
      ${cobra ? `<button class="cobrar" data-a="pay" data-m="efectivo" ${dis}><span>Cobrar</span><b class="num">${money(T.total)}</b><span class="kbd">F2</span></button>
      <div class="paymini">${["yape", "plin", "tarjeta"].map((m) => `<button class="pm ${m}" data-a="pay" data-m="${m}" ${dis}>${METHODS[m]}<span class="kbd">${FK[m]}</span></button>`).join("")}<button class="pm" data-a="pay" data-m="credito" ${dis}>Crédito</button><button class="pm" data-a="split" ${dis}>Dividir<span class="kbd">F7</span></button><button class="pm" data-a="prevsave" ${dis}>Preventa</button></div>`
      : `<button class="cobrar" data-a="prevsave" ${dis}><span>Guardar preventa</span><span class="kbd">F2</span></button><p class="phint">El cliente paga en caja con el número de preventa.</p>`}
    </div></div>`;
  paintTickets();
  const sel = $(".ln.sel"); if (sel && sel.scrollIntoViewIfNeeded) sel.scrollIntoViewIfNeeded(false); else if (sel) sel.scrollIntoView({ block: "nearest" });
  if (bar) {
    bar.hidden = !lines.length;
    bar.innerHTML = `<button class="cb-open ${fresh ? "bump" : ""}" data-a="opencart"><span class="cbn num">${T.count}</span><span class="cbt">Ver ticket<b class="num">${money(T.total)}</b></span></button>${cobra ? `<button class="cb-pay" data-a="pay" data-m="efectivo">Cobrar</button>` : `<button class="cb-pay" data-a="prevsave">Guardar</button>`}`;
  }
}
// Después de cobrar: el ticket muestra el vuelto bien grande hasta que empiece la siguiente venta.
function doneHtml(s) {
  const pays = paysOf(s), cash = s.recv > 0 && pays.some((p) => p.m === "efectivo"), c = cli(s.client);
  return `<div class="cart-in"><div class="paper done" role="status">
    <div class="rtop"><span class="bizl">${esc(DB.biz.name || "Caja Fácil")}</span><span class="rtime num">${hhmm(s.t)}</span><button class="cart-x" data-a="newsale" aria-label="Cerrar">${svg("close")}</button></div>
    <div class="stamp">${svg("check")}<span>¡Vendido!</span></div>
    <p class="dno">${DOCS[s.doc ? s.doc.type : "NV"]} ${docNo(s)}${s.cname ? ` · ${esc(s.cname)}` : ""}</p>
    ${cash ? `<div class="vu"><span>Vuelto</span><b class="num" id="doneChange">${money(s.change)}</b><small>Pagó con ${money(s.recv)} · total ${money(s.total)}</small></div>`
      : `<div class="vu paid"><span>${esc(methodLabel(s))}</span><b class="num">${money(s.total)}</b><small>${s.ref ? "Operación " + esc(s.ref) : pays.some((p) => p.m === "credito") ? "Anotado en la cuenta del cliente" : "Pago completo"}</small></div>`}
    ${s.ptsEarn ? `<p class="dpts">${esc(s.cname.split(" ")[0])} ganó ${s.ptsEarn} puntos</p>` : ""}
    <div class="dacts"><button class="btn sec" data-a="print" data-id="${s.id}">${svg("print", "bi")}Imprimir</button><button class="btn sec" data-a="wa" data-id="${s.id}">${svg("wa", "bi")}WhatsApp${c && c.phone ? "" : ""}</button></div>
    <button class="link" data-a="seercpt" data-id="${s.id}">Ver comprobante</button>
  </div>
  <div class="paybox"><button class="cobrar next" data-a="newsale">Nueva venta<span class="kbd">Enter</span></button><p class="phint">O escanea el siguiente producto y seguimos.</p></div></div>`;
}

/* ---------- cliente y comprobante del ticket ---------- */
function pickClient(cb) {
  const list = () => {
    const q = norm(ui.pcq || ""), cs = DB.clients.filter((c) => !q || norm(c.name).includes(q) || (c.doc || "").includes(ui.pcq || "") || (c.phone || "").includes(ui.pcq || "")).sort((a, b) => a.name.localeCompare(b.name, "es")).slice(0, 60);
    return cs.map((c) => { const d = balanceOf(c); return `<button class="it" data-a="clipick" data-id="${c.id}"><span class="av" style="--h:${avHue(c)}">${esc(initials(c.name))}</span><div class="t"><b>${esc(c.name)}</b><small>${c.doc ? esc(c.dt + " " + c.doc) : "Sin documento"}${c.phone ? " · " + esc(fmtPhone(c.phone)) : ""}</small></div>${d > 0 ? `<div class="v num warn">Debe ${money(d)}</div>` : ""}</button>`; }).join("") || `<p class="muted" style="padding:10px 2px">No encontré clientes con ese dato.</p>`;
  };
  ui.clicb = cb || null;
  openModal(`<h2>Cliente de esta venta</h2>
    <input class="inp" id="pcq" type="search" placeholder="Nombre, DNI, RUC o celular" value="${esc(ui.pcq || "")}" autofocus autocomplete="off" style="margin-bottom:10px">
    <div class="list scroll" id="pclist">${list()}</div>
    <div class="btns h"><button class="btn sec" data-a="clinone">Público general</button><button class="btn" data-a="clinew">+ Cliente nuevo</button></div>`, "wide");
  ui.mk = "pickcli"; ui.pclist = list;
}
function setClient(id) {
  DB.cart.client = id || ""; const c = cli(id);
  if (c && c.dt === "RUC" && rucOk(c.doc) && (DB.cart.doc || DB.cfg.docDef) === "NV") DB.cart.doc = "F";
  if (c && c.dt === "DNI" && (DB.cart.doc || DB.cfg.docDef) === "F") DB.cart.doc = "B";
  save(); const cb = ui.clicb; ui.clicb = null; closeModal(); paintSale(); if (cb) cb();
}
function docCheck() {
  const t = DB.cart, doc = t.doc || DB.cfg.docDef || "NV", c = cli(t.client), T = cartTotals();
  if (doc === "F" && (!c || c.dt !== "RUC" || !rucOk(c.doc))) return "Para factura elige un cliente con RUC válido (F1)";
  if (doc === "B" && T.total >= 700 && (!c || !c.doc)) return "Boletas desde S/ 700 necesitan DNI del cliente (F1)";
  return "";
}

/* ---------- cobro ---------- */
function startPay(method, split) {
  if (!cartLines().length) return toast("Primero agrega algo al ticket");
  if (!can("cobrar")) return need("cobrar", () => openPay(method, split), "Cobrar esta venta");
  const chk = docCheck(); if (chk) { toast(chk, true); beep(false); return; }
  if (can("caja") && !curShift()) { if (DB.cfg.needShift) return openShift(() => openPay(method, split)); autoShift(); }
  openPay(method, split);
}
function openPay(method, split) {
  ui.pay = { method: METHODS[method] && method !== "puntos" ? method : "efectivo", recv: "", split: !!split, parts: [], ref: "", pts: 0 };
  document.body.classList.remove("cart-open");
  paintPay();
}
const payDue = () => r2(cartTotals().total - ((ui.pay && ui.pay.pts) || 0));
function payTo(method) {
  const n = method === "yape" ? DB.cfg.yapeNum : method === "plin" ? DB.cfg.plinNum : "";
  if (!n) return `<p class="muted" style="margin-bottom:14px">Confirma cuando veas el pago en tu ${esc(METHODS[method])}. ${can("ajustes") ? `<button class="link" data-a="gosettings" style="min-height:32px;padding:0 4px">Guardar mi número</button>` : ""}</p>`;
  return `<div class="payto ${method}"><span>Que el cliente ${method === "yape" ? "yapee" : "plinee"} al</span><b class="num">${fmtPhone(n)}</b>${DB.cfg.payName ? `<small>${esc(DB.cfg.payName)}</small>` : ""}</div>`;
}
function ptsBlock() {
  const c = cli(DB.cart.client); if (!c || !DB.cfg.pts.on) return "";
  const have = pointsOf(c), val = DB.cfg.pts.val, min = DB.cfg.pts.min || 0;
  if (have < min || have <= 0) return c ? `<p class="muted pts">${esc(c.name.split(" ")[0])} tiene ${have} puntos${min ? ` (canjea desde ${min})` : ""}.</p>` : "";
  const amt = Math.min(r2(have * val), cartTotals().total);
  return `<button class="ptsbtn ${ui.pay.pts ? "on" : ""}" data-a="usepts"><span>${ui.pay.pts ? "Usando" : "Usar"} ${Math.round(amt / val)} puntos</span><b class="num">− ${money(amt)}</b></button>`;
}
function creditBlock() {
  const c = cli(DB.cart.client);
  if (!c) return `<div class="credit none"><p>Para vender al crédito elige a quién.</p><button class="btn sec" data-a="pickcli" data-back="pay">Elegir cliente</button></div>`;
  const debt = balanceOf(c), due = payDue(), after = r2(debt + due), over = c.limit > 0 && after > c.limit;
  return `<div class="credit ${over ? "over" : ""}"><div class="kv"><span>Cliente</span><b>${esc(c.name)}</b></div><div class="kv"><span>Debe ahora</span><b class="num">${money(debt)}</b></div><div class="kv"><span>Debería después</span><b class="num">${money(after)}</b></div>${c.limit > 0 ? `<div class="kv"><span>Límite de crédito</span><b class="num">${money(c.limit)}</b></div>` : ""}${over ? `<p class="warn">Pasa su límite: necesita autorización.</p>` : ""}${c.days ? `<p class="muted">Plazo para pagar: ${c.days} días.</p>` : ""}</div>`;
}
// Billetes y monedas sugeridos: el monto exacto y los que la gente suele dar (redondeos, 10, 20, 50, 100, 200).
function cashOpts(due) {
  const c = [Math.ceil(due - 0.001), Math.ceil(due / 5) * 5, Math.ceil(due / 10) * 10, 20, 50, 100, 200].filter((n) => n > due + 0.001);
  return [...new Set(c)].sort((a, b) => a - b).slice(0, 4);
}
const BILLS = [10, 20, 50, 100, 200];
const billCls = (v) => (BILLS.includes(v) ? "b" + v : "coin");
function paintPay() {
  const p = ui.pay, total = cartTotals().total, due = payDue(), t = DB.cart, doc = t.doc || DB.cfg.docDef || "NV", c = cli(t.client);
  if (p.split) return paintSplit();
  const M = ["efectivo", "yape", "plin", "tarjeta", "transferencia", "credito"].filter((m) => m !== "credito" || DB.clients.length || can("clientes"));
  const KEYL = { efectivo: "E", yape: "Y", plin: "P", tarjeta: "T", transferencia: "R", credito: "C" };
  let body;
  if (p.method === "efectivo" && due <= 0) body = `<button class="btn lg" id="payok" data-a="payok" data-enter>Cobrar ${money(due)}</button>`;
  else if (p.method === "efectivo") body = `<div class="bills"><button class="bill exact" data-a="cashgo" data-v="${due}" data-enter><small>Exacto</small><b class="num">${money(due)}</b><em>Sin vuelto</em></button>${cashOpts(due).map((v) => `<button class="bill ${billCls(v)}" data-a="cashgo" data-v="${v}"><small>${BILLS.includes(v) ? "Billete" : "Paga con"}</small><b class="num">S/ ${v}</b><em class="num">Vuelto ${money(r2(v - due))}</em></button>`).join("")}</div>
      ${p.other ? `<div class="other"><label class="fld"><span>Otro monto</span><input class="inp num big" id="recv" data-in="recv" inputmode="decimal" enterkeyhint="done" placeholder="${due.toFixed(2)}" value="${esc(p.recv)}" ${p.recv === "" ? "autofocus" : ""}></label><div class="vuelto" id="vuelto"></div></div>
      <button class="btn lg" id="payok" data-a="payok">Cobrar en efectivo</button>` : `<button class="link" data-a="payother" style="margin:0 0 6px">Paga con otro monto</button>`}`;
  else if (p.method === "yape" || p.method === "plin") body = `${payTo(p.method)}<button class="btn lg go ${p.method}" id="payok" data-a="payok">Ya llegó el ${METHODS[p.method]}: cobrar ${money(due)}</button>`;
  else if (p.method === "credito") body = `${creditBlock()}<button class="btn lg" id="payok" data-a="payok" ${c ? "" : "disabled"}>Anotar ${money(due)} al crédito</button>`;
  else body = `<label class="fld"><span>${p.method === "tarjeta" ? "Pasa la tarjeta en tu POS. N° de operación (opcional)" : "N° de operación de la transferencia (opcional)"}</span><input class="inp" id="pref" value="${esc(p.ref)}" placeholder="Ej: 004512" autocomplete="off" autofocus></label>
      <button class="btn lg" id="payok" data-a="payok">Cobrar ${money(due)} con ${METHODS[p.method].toLowerCase()}</button>`;
  openModal(`<div class="payhead"><div class="paytot"><span>A cobrar</span><b class="num">${money(due)}</b>${p.pts ? `<small>Total ${money(total)} − puntos ${money(p.pts)}</small>` : ""}</div><span class="tag">${DOCS[doc]}${c ? " · " + esc(c.name) : ""}</span></div>
    ${ptsBlock()}
    <div class="methods" role="tablist" aria-label="Medio de pago">${M.map((k) => `<button class="mth ${k} ${p.method === k ? "on" : ""}" role="tab" aria-selected="${p.method === k}" data-a="method" data-m="${k}">${METHODS[k]}</button>`).join("")}</div>
    <div class="paybody">${body}</div>
    <div class="payfoot"><button class="link" data-a="close">Volver</button><button class="link" data-a="split">Dividir pago <span class="kbd">F7</span></button></div>`, "paym");
  ui.mk = "pay"; updPay();
}
function splitCalc() {
  const total = payDue(), parts = ui.pay.parts;
  const cashGiven = r2(parts.filter((x) => x.m === "efectivo").reduce((a, x) => a + x.amt, 0));
  const nonCash = r2(parts.filter((x) => x.m !== "efectivo").reduce((a, x) => a + x.amt, 0));
  const rem = r2(total - cashGiven - nonCash), change = rem < 0 ? -rem : 0;
  const ok = parts.length > 0 && rem <= 0 && nonCash <= total && change <= cashGiven;
  const acc = {}; parts.forEach((x) => { acc[x.m] = r2((acc[x.m] || 0) + x.amt); });
  if (acc.efectivo != null) acc.efectivo = r2(acc.efectivo - change);
  return { ok, rem, change, cashGiven, nonCash, pays: Object.entries(acc).filter(([, a]) => a > 0).map(([m, amt]) => ({ m, amt })) };
}
function paintSplit() {
  const p = ui.pay, r = splitCalc(), falta = Math.max(0, r.rem), c = cli(DB.cart.client);
  let st;
  if (r.rem > 0) st = `<span>Falta</span><b class="num">${money(r.rem)}</b>`;
  else if (r.nonCash > payDue()) st = `<span>Yape, Plin, tarjeta o crédito no pueden pasar el total</span><b></b>`;
  else if (r.change > 0) st = `<span>Vuelto</span><b class="num">${money(r.change)}</b>`;
  else st = `<span>Pago completo</span><b>✓</b>`;
  const bad = r.rem > 0 || r.nonCash > payDue() || r.change > r.cashGiven;
  const M = ["efectivo", "yape", "tarjeta", "plin", "transferencia"].concat(c ? ["credito"] : []);
  openModal(`<div class="payhead"><h2>Dividir pago</h2></div><div class="paytot"><span class="muted">Total a pagar</span><b class="num">${money(payDue())}</b></div>
    ${ptsBlock()}
    <div class="parts">${p.parts.length ? p.parts.map((x, i) => `<div class="part"><span>${METHODS[x.m]}</span><b class="num">${money(x.amt)}</b><button class="x" data-a="partdel" data-i="${i}" aria-label="Quitar este pago">✕</button></div>`).join("") : `<p class="muted">Escribe cuánto paga con cada medio y toca el medio. Ej: S/ 10 en efectivo y el resto con Yape.</p>`}</div>
    <div class="vuelto ${bad ? "bad" : ""}" id="splitst">${st}</div>
    <label class="fld"><span>Monto de esta parte (vacío = lo que falta)</span><input class="inp num" id="pamt" inputmode="decimal" placeholder="${falta > 0 ? falta.toFixed(2) : "0.00"}" autofocus></label>
    <div class="methods m6">${M.map((m) => `<button class="mth ${m}" data-a="partadd" data-m="${m}">+ ${METHODS[m]}${FK[m] ? `<span class="kbd">${FK[m]}</span>` : ""}</button>`).join("")}</div>
    ${p.parts.some((x) => x.m === "yape") && DB.cfg.yapeNum ? `<p class="muted" style="margin-bottom:10px">Yape: <b>${fmtPhone(DB.cfg.yapeNum)}</b></p>` : ""}
    <div class="btns h"><button class="btn sec" data-a="split">Pago único</button><button class="btn" id="payok" data-a="payok" ${r.ok ? "" : "disabled"}>Confirmar cobro</button></div>`, "paym");
  ui.mk = "pay";
}
function updPay() {
  const p = ui.pay; if (!p || p.split || p.method !== "efectivo") return;
  const due = payDue(), empty = p.recv.trim() === "", recv = empty ? due : num(p.recv), ch = r2(recv - due), bad = ch < 0;
  const vu = $("#vuelto"); if (!vu) return;
  vu.className = "vuelto" + (bad ? " bad" : empty ? " idle" : "");
  vu.innerHTML = empty ? `<span>Si lo dejas vacío</span><b>Paga exacto</b>` : bad ? `<span>Falta</span><b class="num">${money(-ch)}</b>` : `<span>Vuelto</span><b class="num">${money(ch)}</b>`;
  const ok = $("#payok"); ok.disabled = bad; ok.textContent = empty ? `Cobrar ${money(due)} exacto` : bad ? "Falta dinero" : `Cobrar y dar ${money(ch)} de vuelto`;
}
function confirmPay() {
  const T = cartTotals(); if (!T.lines.length) return closeModal();
  const p = ui.pay; if (!p) return;
  const due = payDue(), ptsPart = p.pts ? [{ m: "puntos", amt: p.pts }] : [];
  let pays, given = 0;
  if (p.split) { const r = splitCalc(); if (!r.ok) return; pays = ptsPart.concat(r.pays); given = r.cashGiven; }
  else {
    if (p.method === "efectivo") { given = p.recv === "" ? due : r2(num(p.recv)); if (given < due) return; }
    if (p.method === "credito" && !cli(DB.cart.client)) return toast("Elige el cliente para el crédito");
    pays = ptsPart.concat(due > 0 ? [{ m: p.method, amt: due }] : []);
  }
  const ref = p.ref || "";
  const go2 = () => {
    const s = finalizeSale(pays, given, { ref });
    beep(true); closeModal(); ui.done = s.id; ui.q = ""; const qi = $("#q"); if (qi) qi.value = "";
    if (!DESK()) document.body.classList.add("cart-open");
    paintSale(); paintNav();
    if (DB.cfg.autoPrint) printHtml(receiptHtml(s));
  };
  const credit = pays.filter((x) => x.m === "credito").reduce((a, x) => a + x.amt, 0);
  if (credit > 0) {
    const c = cli(DB.cart.client);
    const run = () => (c.limit > 0 && r2(balanceOf(c) + credit) > c.limit ? need("limite", go2, `Pasar el límite de crédito de ${c.name}`) : go2());
    return can("credito") ? run() : need("credito", run, "Venta al crédito");
  }
  go2();
}
function finalizeSale(pays, cashGiven, extra = {}) {
  const t = DB.cart, T = cartTotals(), c = cli(t.client), u = me(), sh = curShift();
  const type = t.doc || DB.cfg.docDef || "NV", ser = DB.cfg.series[type] || DB.cfg.series.NV; ser.n++;
  const items = T.lines.map(({ l, r }) => ({ id: l.id, pres: l.pres || "", name: r.name, price: r.price, cost: r.cost, qty: l.qty, unit: r.unit, f: r.f, quick: !!r.quick, igv: r.igv }));
  const cashApplied = r2(pays.filter((p) => p.m === "efectivo").reduce((a, p) => a + p.amt, 0));
  const hasCash = cashApplied > 0;
  const s = {
    id: ++DB.seq, doc: { type, s: ser.s, n: ser.n }, t: Date.now(), date: dkey(), user: u ? u.id : "", uname: u ? u.name : "", shift: sh ? sh.id : "",
    client: c ? c.id : "", cname: c ? c.name : "", cdt: c ? c.dt : "", cdoc: c ? c.doc : "", caddr: c ? c.addr || "" : "",
    items, sub: T.sub, disc: T.disc, total: T.total, gravada: T.gravada, igv: T.igv, exo: T.exo, pays,
    recv: hasCash ? cashGiven : 0, change: hasCash ? r2(cashGiven - cashApplied) : 0, ref: extra.ref || "", mesa: t.mesa || 0, prev: t.prev || 0, returns: []
  };
  if (DB.cfg.pts.on && c) {
    const used = pays.filter((p) => p.m === "puntos").reduce((a, p) => a + p.amt, 0);
    s.ptsUsed = used ? Math.round(used / DB.cfg.pts.val) : 0;
    s.ptsEarn = Math.floor(r2(T.total - used) * (+DB.cfg.pts.per || 0));
  }
  T.lines.forEach(({ l, r }) => { if (!r.quick) consume(r.p, r3(l.qty * r.f), "venta", docShort(s)); });
  if (t.prev) { const pv = DB.prev.find((x) => x.no === t.prev); if (pv) { pv.status = "cobrada"; pv.sale = s.id; save(pv.date); } }
  DB.sales.push(s);
  dropCurrentTicket(); save();
  return s;
}

/* ---------- comprobante ---------- */
const DOCTITLE = { NV: "NOTA DE VENTA", B: "BOLETA DE VENTA", F: "FACTURA" };
function payBlock(s) {
  const pays = paysOf(s), cash = pays.some((p) => p.m === "efectivo");
  let h = pays.map((p) => `<div class="l"><span>${METHODS[p.m] || p.m}${p.m === "puntos" && s.ptsUsed ? ` (${s.ptsUsed} pts)` : ""}</span><span>${money(p.amt)}</span></div>`).join("");
  if (cash && s.recv) h += `<div class="l"><span>Recibido</span><span>${money(s.recv)}</span></div><div class="l"><span>Vuelto</span><span>${money(s.change)}</span></div>`;
  if (s.ref) h += `<div class="l"><span>N° operación</span><span>${esc(s.ref)}</span></div>`;
  return h;
}
function receiptHtml(s) {
  const b = DB.biz, ret = (s.returns || []).reduce((a, r) => a + r.amount, 0);
  return `<h3>${esc(b.name)}</h3>${b.ruc ? `<div class="c">RUC ${esc(b.ruc)}</div>` : ""}${b.addr ? `<div class="c">${esc(b.addr)}</div>` : ""}${b.phone ? `<div class="c">Tel. ${esc(b.phone)}</div>` : ""}
    <div class="c doc"><b>${DOCTITLE[s.doc ? s.doc.type : "NV"]}</b><br><b>${docNo(s)}</b></div>
    <div class="l"><span>Fecha</span><span>${fmtDT(s.t)}</span></div><div class="l"><span>Cajero</span><span>${esc(s.uname || "")}</span></div>
    ${s.cname ? `<div class="l"><span>Cliente</span><span>${esc(s.cname)}</span></div>${s.cdoc ? `<div class="l"><span>${esc(s.cdt || "Doc.")}</span><span>${esc(s.cdoc)}</span></div>` : ""}${s.caddr && s.doc && s.doc.type === "F" ? `<div class="l"><span>Dirección</span><span>${esc(s.caddr)}</span></div>` : ""}` : ""}
    ${s.mesa ? `<div class="l"><span>Mesa</span><span>${s.mesa}</span></div>` : ""}<hr>
    ${s.items.map((i) => `<div class="it2"><span>${fmtQ(i.qty)}${i.unit === "kg" ? " kg" : ""} × ${esc(i.name)}</span><span>${money(i.price * i.qty)}</span>${i.qty !== 1 ? `<small>${money(i.price)}${i.unit === "kg" ? " /kg" : " c/u"}</small>` : ""}</div>`).join("")}<hr>
    ${s.disc ? `<div class="l"><span>Subtotal</span><span>${money(s.sub)}</span></div><div class="l"><span>Descuento</span><span>- ${money(s.disc)}</span></div>` : ""}
    ${s.doc && s.doc.type !== "NV" && s.igv ? `<div class="l"><span>Op. gravada</span><span>${money(s.gravada)}</span></div>${s.exo ? `<div class="l"><span>Op. exonerada</span><span>${money(s.exo)}</span></div>` : ""}<div class="l"><span>IGV ${DB.cfg.igv}%</span><span>${money(s.igv)}</span></div>` : ""}
    <div class="l t"><span>TOTAL</span><span>${money(s.total)}</span></div><div class="c sm">SON: ${letras(s.total)}</div><hr>
    ${payBlock(s)}
    ${s.ptsEarn ? `<div class="l"><span>Puntos ganados</span><span>${s.ptsEarn}</span></div>` : ""}
    ${ret ? `<div class="l"><span>Devuelto</span><span>- ${money(ret)}</span></div>` : ""}
    ${s.void ? `<div class="c big">ANULADA</div>` : ""}
    <hr><div class="c">${esc(b.foot || "")}</div>
    <div class="c sm">${s.doc && s.doc.type === "NV" ? "Canjee por boleta o factura." : "Documento de control interno. El comprobante electrónico se emite en SUNAT."}</div>`;
}
function receiptText(s) {
  let t = `*${DB.biz.name}*\n${DOCS[s.doc ? s.doc.type : "NV"]} ${docNo(s)}\n${fmtDT(s.t)}\n\n`;
  s.items.forEach((i) => { t += `${fmtQ(i.qty)}${i.unit === "kg" ? " kg" : ""} x ${i.name}  ${money(i.price * i.qty)}\n`; });
  if (s.disc) t += `\nDescuento: -${money(s.disc)}`;
  t += `\n*TOTAL: ${money(s.total)}* (${methodLabel(s)})`;
  if (s.ptsEarn) t += `\nPuntos ganados: ${s.ptsEarn}`;
  return t + `\n\n${DB.biz.foot || "Gracias por su compra"}`;
}
function showReceipt(s, fromSale = false) {
  const c = cli(s.client), ret = (s.returns || []).length;
  openModal(`<div class="rcpt">${receiptHtml(s)}</div>
    ${s.void ? `<p class="tag void" style="margin-top:8px">Venta anulada${s.void.why ? ": " + esc(s.void.why) : ""}</p>` : ""}
    <div class="btns h"><button class="btn sec" data-a="print" data-id="${s.id}">${svg("print", "bi")}Imprimir</button><button class="btn sec" data-a="wa" data-id="${s.id}">${svg("wa", "bi")}WhatsApp${c && c.phone ? "" : ""}</button></div>
    ${!fromSale && !s.void ? `<div class="btns h"><button class="btn sec" data-a="ret" data-id="${s.id}">Devolución${ret ? ` (${ret})` : ""}</button><button class="btn red sec" data-a="void" data-id="${s.id}">Anular</button></div>` : ""}
    ${!fromSale && s.prev && !s.void ? `<div class="btns"><button class="btn sec" data-a="dispatch" data-id="${s.id}" ${s.disp ? "disabled" : ""}>${s.disp ? "Despachado " + hhmm(s.disp.t) : "Marcar como despachado"}</button></div>` : ""}
    <div class="btns"><button class="btn lg" data-a="${fromSale ? "newsale" : "close"}" data-enter>${fromSale ? "Nueva venta" : "Cerrar"}</button></div>`, "rc");
  ui.mk = fromSale ? "receipt" : "";
}

/* ---------- ventas rápidas, cantidades y precios ---------- */
function openQuick() {
  openModal(`<h2>Venta por monto</h2><p class="muted" style="margin-bottom:12px">Cobra un importe que no está en tu lista de productos.</p>
    <label class="fld"><span>Monto (S/)</span><input class="inp num big" id="qa" inputmode="decimal" placeholder="0.00" autofocus></label>
    <label class="fld"><span>Detalle (opcional)</span><input class="inp" id="qn" placeholder="Varios" maxlength="40"></label>
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" data-a="quickok" data-enter>Agregar al ticket</button></div>`);
}
function openQtyUnits(k, mode) {
  const l = DB.cart.items.find((i) => lineKey(i.id, i.pres) === k), r = l && resolveLine(l); if (!r) return;
  ui.qty = { k, id: l.id, pres: l.pres, price: r.price };
  openModal(`<div class="qhead">${r.p ? pimg(r.p, "qimg") : ""}<div><h2>${esc(r.name)}</h2><p class="muted">${money(r.price)} por unidad</p></div></div>
    <label class="fld"><span>Cantidad</span><input class="inp num big" id="qv" inputmode="decimal" value="${fmtQ(l.qty)}" autofocus></label>
    <div class="vuelto" id="qprev"></div>
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" data-a="qok" data-enter>Guardar</button></div>`);
  ui.mk = "qty"; updQty();
}
function updQty() { const q = ui.qty, el = $("#qprev"); if (!q || !el) return; const v = r3(parseQty($("#qv").value)); el.innerHTML = `<span>${fmtQ(v)} × ${money(q.price)}</span><b class="num">${money(r2(v * q.price))}</b>`; }
function editLine(k) {
  const l = DB.cart.items.find((i) => lineKey(i.id, i.pres) === k); if (!l) return toast("Elige una línea del ticket");
  const r = resolveLine(l); if (!r) return;
  if (r.unit === "kg") openWeigh(l.id, "set"); else openQtyUnits(k);
}
function presPicker(p) {
  openModal(`<div class="qhead">${pimg(p, "qimg")}<div><h2>${esc(p.name)}</h2><p class="muted">¿Qué presentación lleva?</p></div></div>
    <div class="presl"><button class="pres" data-a="addpres" data-id="${p.id}" data-p=""><b>${p.unit === "kg" ? "Por kilo" : "Unidad"}</b><span class="num">${money(p.price)}</span></button>
    ${p.pres.map((x) => `<button class="pres" data-a="addpres" data-id="${p.id}" data-p="${x.id}"><b>${esc(x.name)}</b><small>${fmtQ(x.f)} ${p.unit === "kg" ? "kg" : "unidades"}</small><span class="num">${money(x.price)}</span></button>`).join("")}</div>
    <div class="btns"><button class="btn sec" data-a="close">Cancelar</button></div>`);
}
// Código escrito o escaneado: "6", "3*6", "P15" (preventa), etiqueta de balanza (2xxxxx...), código de presentación.
function submitCode(raw) {
  raw = raw.trim(); if (!raw) return;
  const clear = () => { ui.q = ""; const qi = $("#q"); if (qi) qi.value = ""; };
  const pv = raw.match(/^p\s*-?\s*(\d+)$/i);
  if (pv && can("cobrar")) { clear(); loadPrev(+pv[1]); paintGrid(); return; }
  let qty = null, code = raw;
  const m = raw.match(/^([\d.,\/]+\s*(?:k?g|gr)?)\s*[*xX]\s*(.+)$/i);
  if (m) { qty = r3(parseQty(m[1])); code = m[2].trim(); if (!(qty > 0)) { toast("Cantidad no válida"); beep(false); return; } }
  let p = DB.products.find((x) => x.code && x.code === code), pres = "";
  const lab = !p && qty == null ? parseLabel(code) : null;
  if (lab) { clear(); addToCart(lab.p, lab.qty); paintGrid(); return; }
  if (!p) { for (const x of DB.products) { const ps = (x.pres || []).find((y) => y.code && y.code === code); if (ps) { p = x; pres = ps.id; break; } } }
  const exact = !!p;
  if (!p) { const k = norm(code), list = DB.products.filter((x) => norm(x.name).includes(k)); if (list.length === 1) p = list[0]; else if (list.length > 1) { toast("Hay varios productos así: toca el que quieras"); return; } }
  if (!p) { toast("No encontramos «" + code + "»"); beep(false); return; }
  clear();
  if (pres) addToCart(p, qty || 1, pres);
  else if (qty != null) addToCart(p, qty);
  else if (!exact && (p.pres || []).length) presPicker(p);
  else if (p.unit === "kg") openWeigh(p.id, "add");
  else addToCart(p, 1);
  paintGrid();
}

/* ---------- acciones de la pantalla de venta ---------- */
act({
  add: (el) => { const p = prod(el.dataset.id); if (!p) return; if ((p.pres || []).length) presPicker(p); else if (p.unit === "kg") openWeigh(p.id, "add"); else addToCart(p); },
  addpres: (el) => { const p = prod(el.dataset.id); if (!p) return; const pres = el.dataset.p; closeModal(); if (!pres && p.unit === "kg") openWeigh(p.id, "add"); else addToCart(p, 1, pres); },
  inc: (el) => changeQty(el.dataset.k, 1),
  dec: (el) => changeQty(el.dataset.k, -1),
  sel: (el) => { ui.sel = el.dataset.k; $$(".ln").forEach((x) => x.classList.toggle("sel", x.dataset.k === ui.sel)); },
  qedit: (el) => editLine(el.dataset.k),
  qeditsel: () => editLine(ui.sel),
  qok: () => { const q = ui.qty; if (!q || !$("#qv")) return; const v = r3(parseQty($("#qv").value)); if (setLine(q.id, q.pres, v)) closeModal(); },
  rmline: (el) => { const k = el.dataset.k; DB.cart.items = DB.cart.items.filter((i) => lineKey(i.id, i.pres) !== k); save(); beep(true); paintSale(); focusQ(); },
  rmsel: () => { if (ui.sel && DB.cart.items.some((i) => lineKey(i.id, i.pres) === ui.sel)) A.rmline({ dataset: { k: ui.sel } }); else toast("Elige una línea del ticket"); },
  lprice: (el) => {
    const k = el.dataset.k, l = DB.cart.items.find((i) => lineKey(i.id, i.pres) === k); if (!l || l.quick) return;
    const r = resolveLine(l);
    need("precios", () => promptBox({ title: "Precio en esta venta", text: `${esc(r.name)} · precio normal ${money(r.base)}${r.unit === "kg" ? " /kg" : ""}. Solo cambia en este ticket.`, label: "Nuevo precio (S/)", num: true, value: r.price, ok: "Cambiar precio" }, (v) => {
      const n = r2(num(v)); if (!(n > 0)) return toast("Precio no válido");
      l.pr = n === r.base ? null : n; if (l.pr == null) delete l.pr; save(); paintSale(); log("Cambio de precio en venta", `${r.name}: ${money(r.base)} → ${money(n)}`);
    }), "Cambiar precio en la venta");
  },
  clear: () => confirmBox(DB.tickets.length > 1 ? "¿Quitar este ticket?" : "¿Vaciar el ticket?", DB.tickets.length > 1 ? "Quitar" : "Vaciar", () => {
    const t = DB.cart; if (t.prev) { const pv = DB.prev.find((x) => x.no === t.prev); if (pv) toast(`La preventa N° ${pv.no} sigue pendiente`); }
    dropCurrentTicket(); save(); paintSale(); focusQ();
  }),
  tknew: () => { if (!DB.cart.items.length) { toast("Este ticket ya está vacío: úsalo"); return; } newTicketNow(); paintSale(); focusQ(); toast("Ticket nuevo. El anterior quedó en espera"); },
  tk: (el) => { const i = +el.dataset.i; if (i === DB.cur) return; DB.cur = i; ui.sel = null; save(); paintSale(); focusQ(); },
  tkname: () => promptBox({ title: "Nombre del ticket", text: "Ayuda a reconocerlo cuando hay varios en espera. Ej: señora de azul.", label: "Nombre", value: DB.cart.name, max: 24 }, (v) => { DB.cart.name = v; save(); paintSale(); }),
  cat: (el) => { ui.cat = el.dataset.c; paintCats(); paintGrid(); focusQ(); },
  opencart: () => document.body.classList.add("cart-open"),
  closecart: () => document.body.classList.remove("cart-open"),
  pickcli: (el) => { const back = el && el.dataset && el.dataset.back === "pay" && ui.pay ? Object.assign({}, ui.pay) : null; pickClient(back ? () => { ui.pay = back; paintPay(); } : null); },
  clipick: (el) => setClient(el.dataset.id),
  clinone: () => { DB.cart.client = ""; if (DB.cart.doc === "F") DB.cart.doc = ""; setClient(""); },
  clinew: () => { const cb = ui.clicb; openClient("", (c) => { ui.clicb = cb; setClient(c.id); }); },
  doc: (el) => { DB.cart.doc = el.dataset.d; save(); paintCart(); const m = docCheck(); if (m) toast(m, true); },
  pay: (el) => { const m = el.dataset.m; if (modalOpen() && ui.pay) { ui.pay.method = m; ui.pay.split = false; paintPay(); } else startPay(m); },
  method: (el) => { ui.pay.method = el.dataset.m; ui.pay.ref = ""; paintPay(); },
  recv: (el) => { ui.pay.recv = String(el.dataset.v); const i = $("#recv"); if (i) { i.value = ui.pay.recv; i.focus(); } updPay(); },
  usepts: () => { const c = cli(DB.cart.client); if (!c) return; ui.pay.pts = ui.pay.pts ? 0 : Math.min(r2(Math.floor(pointsOf(c)) * DB.cfg.pts.val), cartTotals().total); ui.pay.parts = []; paintPay(); },
  payok: confirmPay,
  split: () => { if (ui.pay && modalOpen() && $("#payok")) { ui.pay.split = !ui.pay.split; ui.pay.parts = []; paintPay(); } else startPay("efectivo", true); },
  partadd: (el) => {
    const p = ui.pay; if (!p || !p.split) return;
    const r = splitCalc(), m = el.dataset.m, falta = Math.max(0, r.rem);
    const raw = ($("#pamt") || { value: "" }).value.trim(), a = r2(raw === "" ? falta : num(raw));
    if (!(a > 0)) { toast(falta <= 0 ? "El total ya está cubierto" : "Escribe un monto"); return; }
    if (m !== "efectivo" && a > falta + 0.001) { toast(`${METHODS[m]} no puede pasar de lo que falta (${money(falta)})`); beep(false); return; }
    p.parts.push({ m, amt: a }); paintPay();
  },
  partdel: (el) => { ui.pay.parts.splice(+el.dataset.i, 1); paintPay(); },
  gosettings: () => { closeModal(); ui.atab = "cobros"; go("aj"); },
  focusq: () => { const q = $("#q"); if (q) { q.focus(); q.select(); } },
  newsale: () => { if (modalOpen()) closeModal(); ui.done = null; ui.q = ""; document.body.classList.remove("cart-open"); render(); },
  payother: () => { if (ui.pay) { ui.pay.other = true; paintPay(); } },
  cashgo: (el) => { if (!ui.pay) return; ui.pay.recv = String(el.dataset.v); confirmPay(); },
  showdisc: () => { if (!can("descuento")) return need("descuento", () => { ui.showDisc = true; paintCart(); const d = $("#disc"); if (d) d.focus(); }, "Descuento"); ui.showDisc = true; paintCart(); const d = $("#disc"); if (d) d.focus(); },
  seercpt: (el) => { const s = saleById(el.dataset.id); if (s) showReceipt(s, true); },
  tools: () => {
    const cobra = can("cobrar");
    openModal(`<h2>Herramientas de venta</h2><div class="menu">
      <button class="mi" data-a="scaletool"><span class="ic">${svg("scale")}</span>Balanza</button>
      <button class="mi" data-a="quick"><span class="ic">${svg("plus")}</span>Cobrar un monto suelto</button>
      ${cobra ? `<button class="mi" data-a="prevload"><span class="ic">${svg("prev")}</span>Cobrar una preventa</button>` : ""}
      ${+DB.cfg.tables ? `<button class="mi" data-a="mesas"><span class="ic">${svg("mesa")}</span>Mesas</button>` : ""}
      <button class="mi" data-a="tknew"><span class="ic">${svg("hold")}</span>Poner el ticket en espera</button></div>`);
  },
  quick: openQuick,
  quickok: () => {
    const a = num($("#qa").value); if (!(a > 0)) return toast("Escribe un monto mayor a 0");
    DB.cart.items.push({ id: "q" + uid(), pres: "", quick: true, name: $("#qn").value.trim() || "Varios", price: r2(a), qty: 1 });
    save(); closeModal(); beep(true); paintSale();
  },
  print: (el) => { const s = saleById(el.dataset.id); if (s) printHtml(receiptHtml(s)); },
  wa: (el) => { const s = saleById(el.dataset.id); if (!s) return; const c = cli(s.client), ph = c && c.phone ? "51" + c.phone.replace(/\D/g, "").slice(-9) : ""; window.open(`https://wa.me/${ph}?text=` + encodeURIComponent(receiptText(s)), "_blank", "noopener"); },
  sample: () => { loadSample(); toast("Listo: cargamos productos de prueba"); render(); }
});
