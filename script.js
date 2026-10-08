/* Caja Fácil — punto de venta para minimarkets y negocios.
   Todo se guarda en el navegador (localStorage). Sin servidor. */
(() => {
"use strict";

/* ---------- utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const pk = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const addD = (k, n) => { const d = pk(k); d.setDate(d.getDate() + n); return dkey(d); };
const r2 = (n) => Math.round((+n || 0) * 100) / 100;
const money = (n) => "S/ " + r2(n).toFixed(2);
const num = (v) => { const n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : 0; };
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fmtDate = (k) => {
  const t = dkey();
  if (k === t) return "Hoy";
  if (k === addD(t, -1)) return "Ayer";
  return pk(k).toLocaleDateString("es-PE", { weekday: "short", day: "numeric", month: "short" });
};
const hhmm = (ts) => new Date(ts).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
const METHODS = { efectivo: "Efectivo", yape: "Yape", plin: "Plin", tarjeta: "Tarjeta" };
const DENOMS = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1];

/* ---------- datos ---------- */
const KEY = "caja-facil-v1";
const blank = () => ({ biz: "Mi negocio", pin: "", mute: false, products: [], sales: [], moves: [], opening: {}, counts: {}, cart: { items: [], disc: 0 }, seq: 0 });
function load() {
  try { return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { return blank(); }
}
let DB = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { toast("No se pudo guardar: el almacenamiento está lleno"); }
}
const pinHash = (p) => { let h = 5381; for (const c of p + "|cf") h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return String(h); };

const SAMPLE = [
  ["Inca Kola 500 ml", 3, 2.2, 24, "Bebidas", "7750001"], ["Coca Cola 500 ml", 3, 2.2, 24, "Bebidas", "7750002"],
  ["Agua 625 ml", 1.5, 1, 36, "Bebidas", "7750003"], ["Galleta soda", 1, 0.7, 40, "Snacks", ""],
  ["Papas fritas clásicas", 2.5, 1.8, 18, "Snacks", ""], ["Chocolate", 1.5, 1, 30, "Snacks", ""],
  ["Pan francés (unidad)", 0.3, 0.2, 100, "Panadería", ""], ["Leche evaporada 400 g", 4.8, 4, 20, "Abarrotes", "7750008"],
  ["Arroz 1 kg", 4.5, 3.6, 15, "Abarrotes", ""], ["Aceite 1 L", 9.5, 8, 8, "Abarrotes", ""],
  ["Huevos (unidad)", 0.6, 0.45, 90, "Abarrotes", ""], ["Detergente 500 g", 6, 4.8, 6, "Limpieza", ""],
  ["Papel higiénico x4", 5, 3.8, 10, "Limpieza", ""], ["Cigarro suelto", 0.5, 0.35, null, "Otros", ""]
];
function loadSample() {
  SAMPLE.forEach(([name, price, cost, stock, cat, code]) => DB.products.push({ id: uid(), name, price, cost, stock, min: stock == null ? 0 : 5, cat, code }));
  save();
}

/* ---------- estado de interfaz ---------- */
const ui = { tab: "venta", q: "", cat: "", date: dkey(), range: "hoy", pay: null, locked: false };
const prod = (id) => DB.products.find((p) => p.id === id);

/* ---------- sonido / aviso ---------- */
let ac;
function beep(ok = true) {
  if (DB.mute) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = "sine"; o.frequency.value = ok ? 880 : 200;
    g.gain.setValueAtTime(0.08, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12);
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.13);
  } catch (e) {}
  if (!ok && navigator.vibrate) navigator.vibrate(60);
}
let toastT;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ---------- modal ---------- */
function openModal(html) { const m = $("#modal"); $(".sheet", m).innerHTML = html; m.hidden = false; document.body.classList.add("noscroll"); const f = $("[autofocus]", m); if (f) setTimeout(() => f.focus(), 50); }
function closeModal() { $("#modal").hidden = true; $(".sheet", $("#modal")).innerHTML = ""; document.body.classList.remove("noscroll"); document.body.classList.remove("cart-open-lock"); }
function confirmBox(msg, label, cb, danger = true) {
  openModal(`<h2>${esc(msg)}</h2><div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn ${danger ? "red" : ""}" id="cfYes">${esc(label)}</button></div>`);
  $("#cfYes").onclick = () => { closeModal(); cb(); };
}

/* ---------- carrito ---------- */
function resolveLine(l) {
  if (l.quick) return { name: l.name, price: l.price, cost: 0, stock: null, quick: true };
  const p = prod(l.id); return p ? { name: p.name, price: p.price, cost: p.cost || 0, stock: p.stock, quick: false } : null;
}
function cartLines() { return DB.cart.items.map((l) => ({ l, r: resolveLine(l) })).filter((x) => x.r); }
function cartTotals() {
  const sub = r2(cartLines().reduce((a, { l, r }) => a + r.price * l.qty, 0));
  const disc = Math.min(Math.max(0, r2(DB.cart.disc)), sub);
  return { sub, disc, total: r2(sub - disc), count: cartLines().reduce((a, { l }) => a + l.qty, 0) };
}
function addToCart(p) {
  const l = DB.cart.items.find((i) => i.id === p.id);
  const q = (l ? l.qty : 0) + 1;
  if (p.stock != null && q > p.stock) { toast(p.stock <= 0 ? "Sin stock: " + p.name : `Solo quedan ${p.stock} de ${p.name}`); beep(false); return; }
  if (l) l.qty = q; else DB.cart.items.push({ id: p.id, qty: 1 });
  save(); beep(true); paintSale();
}
function changeQty(id, d) {
  const l = DB.cart.items.find((i) => i.id === id); if (!l) return;
  const p = l.quick ? null : prod(id);
  const q = l.qty + d;
  if (q <= 0) DB.cart.items = DB.cart.items.filter((i) => i.id !== id);
  else if (p && p.stock != null && q > p.stock) { toast(`Solo quedan ${p.stock}`); beep(false); return; }
  else l.qty = q;
  save(); paintSale();
}

/* ---------- ventas ---------- */
function finalizeSale(method, recv) {
  const lines = cartLines();
  const t = cartTotals();
  const items = lines.map(({ l, r }) => ({ id: l.id, name: r.name, price: r.price, cost: r.cost, qty: l.qty, quick: !!r.quick }));
  const s = { id: ++DB.seq, t: Date.now(), date: dkey(), items, sub: t.sub, disc: t.disc, total: t.total, method, recv: method === "efectivo" ? recv : t.total, change: method === "efectivo" ? r2(recv - t.total) : 0 };
  lines.forEach(({ l, r }) => { if (!r.quick && r.stock != null) { const p = prod(l.id); p.stock = r2(p.stock - l.qty); } });
  DB.sales.push(s);
  DB.cart = { items: [], disc: 0 };
  save();
  return s;
}
function voidSale(id) {
  const s = DB.sales.find((x) => x.id === id); if (!s || s.void) return;
  s.items.forEach((it) => { if (!it.quick) { const p = prod(it.id); if (p && p.stock != null) p.stock = r2(p.stock + it.qty); } });
  s.void = true; save();
}
const salesOn = (k) => DB.sales.filter((s) => s.date === k && !s.void);
function dayTotals(k) {
  const t = { efectivo: 0, yape: 0, plin: 0, tarjeta: 0 };
  salesOn(k).forEach((s) => { t[s.method] = r2(t[s.method] + s.total); });
  const mv = (type) => r2(DB.moves.filter((m) => m.date === k && m.type === type).reduce((a, m) => a + m.amount, 0));
  const yapeMan = mv("yape"), prov = mv("proveedor"), gasto = mv("gasto");
  return { ...t, yapeMan, prov, gasto, yapeAll: r2(t.yape + yapeMan), sales: r2(t.efectivo + t.yape + t.plin + t.tarjeta + yapeMan) };
}
function openingOf(k) {
  if (DB.opening[k] != null) return DB.opening[k];
  const prev = DB.counts[addD(k, -1)];
  return prev ? prev.total : 0;
}
function expectedCash(k) { const t = dayTotals(k); return r2(openingOf(k) + t.efectivo - t.prov - t.gasto); }
function countOf(k) {
  const c = DB.counts[k] || { q: {} };
  const total = r2(DENOMS.reduce((a, d) => a + d * (c.q[d] || 0), 0));
  return { q: c.q, total };
}

/* ---------- recibo ---------- */
const ticketNo = (s) => "#" + String(s.id).padStart(4, "0");
function receiptLines(s) {
  return s.items.map((i) => `<div class="l"><span>${esc(i.qty)} x ${esc(i.name)}</span><span>${money(i.price * i.qty)}</span></div>`).join("");
}
function receiptHtml(s) {
  const d = new Date(s.t);
  return `<h3>${esc(DB.biz)}</h3><div class="c">${d.toLocaleDateString("es-PE")} ${hhmm(s.t)} · Ticket ${ticketNo(s)}</div><hr>${receiptLines(s)}<hr>` +
    (s.disc ? `<div class="l"><span>Subtotal</span><span>${money(s.sub)}</span></div><div class="l"><span>Descuento</span><span>- ${money(s.disc)}</span></div>` : "") +
    `<div class="l t"><span>TOTAL</span><span>${money(s.total)}</span></div>` +
    `<div class="l"><span>Pago</span><span>${METHODS[s.method]}</span></div>` +
    (s.method === "efectivo" ? `<div class="l"><span>Recibido</span><span>${money(s.recv)}</span></div><div class="l"><span>Vuelto</span><span>${money(s.change)}</span></div>` : "") +
    `<hr><div class="c">¡Gracias por su compra!</div>`;
}
function receiptText(s) {
  const d = new Date(s.t);
  let t = `*${DB.biz}*\n${d.toLocaleDateString("es-PE")} ${hhmm(s.t)} - Ticket ${ticketNo(s)}\n\n`;
  s.items.forEach((i) => { t += `${i.qty} x ${i.name}  ${money(i.price * i.qty)}\n`; });
  if (s.disc) t += `\nDescuento: -${money(s.disc)}`;
  t += `\n*TOTAL: ${money(s.total)}* (${METHODS[s.method]})\nGracias por su compra!`;
  return t;
}
function showReceipt(s, fromSale = true) {
  openModal(`<div class="rcpt">${receiptHtml(s)}</div>
    ${s.void ? `<p class="tag void" style="margin-top:8px">Venta anulada</p>` : ""}
    <div class="btns h"><button class="btn sec" data-a="print" data-id="${s.id}">Imprimir</button><button class="btn sec" data-a="wa" data-id="${s.id}">WhatsApp</button></div>
    ${!fromSale && !s.void ? `<div class="btns"><button class="btn red sec" data-a="void" data-id="${s.id}">Anular esta venta</button></div>` : ""}
    <div class="btns"><button class="btn lg" data-a="${fromSale ? "newsale" : "close"}">${fromSale ? "Nueva venta" : "Cerrar"}</button></div>`);
}

/* ---------- íconos y navegación ---------- */
const TABS = [
  ["venta", "Vender", '<path d="M6 7h13l-1.5 8H8zM6 7 5 3H2"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>'],
  ["prod", "Productos", '<path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10"/>'],
  ["caja", "Caja", '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v.01M18 15v.01"/>'],
  ["rep", "Reportes", '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>'],
  ["aj", "Ajustes", '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.2-.8.2-1.2z"/>']
];
function paintNav() {
  const h = TABS.map(([id, label, ic]) => `<button class="tab ${ui.tab === id ? "on" : ""}" data-a="tab" data-t="${id}" ${ui.tab === id ? 'aria-current="page"' : ""}><span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true">${ic}</svg></span><span>${label}</span></button>`).join("");
  $("#tabNav").innerHTML = h; $("#sideNav").innerHTML = h;
  $("#bizName").textContent = DB.biz || "Caja Fácil";
  $("#lockBtn").hidden = !DB.pin;
  document.title = (DB.biz ? DB.biz + " · " : "") + "Caja Fácil";
}
function go(tab) {
  ui.tab = tab; document.body.classList.remove("cart-open"); render(); window.scrollTo(0, 0);
}
function render() {
  paintNav();
  const v = $("#view");
  ({ venta: viewSale, prod: viewProducts, caja: viewCash, rep: viewReports, aj: viewSettings }[ui.tab])(v);
}

/* ---------- VENDER ---------- */
function viewSale(v) {
  v.innerHTML = `<div class="pos">
    <section>
      <div class="searchbar">
        <input class="inp" id="q" type="search" placeholder="Buscar producto o código" autocomplete="off" value="${esc(ui.q)}" aria-label="Buscar producto o código">
        <button class="btn sec" data-a="quick" aria-label="Venta rápida por monto">+ Monto</button>
      </div>
      <div class="chips" id="cats"></div>
      <div class="grid" id="grid"></div>
    </section>
    <aside class="cart" id="cart" aria-label="Ticket actual"></aside>
  </div>
  <button class="cartbar" id="cartbar" data-a="opencart" hidden></button>`;
  paintSale();
}
function paintSale() {
  if (ui.tab !== "venta") return;
  paintCats(); paintGrid(); paintCart();
}
function paintCats() {
  const cats = [...new Set(DB.products.map((p) => p.cat).filter(Boolean))].sort();
  const el = $("#cats"); if (!el) return;
  el.innerHTML = cats.length ? `<button class="chip ${ui.cat ? "" : "on"}" data-a="cat" data-c="">Todos</button>` + cats.map((c) => `<button class="chip ${ui.cat === c ? "on" : ""}" data-a="cat" data-c="${esc(c)}">${esc(c)}</button>`).join("") : "";
}
function paintGrid() {
  const el = $("#grid"); if (!el) return;
  if (!DB.products.length) {
    el.innerHTML = `<div class="empty" style="grid-column:1/-1"><h2>Aún no tienes productos</h2><p>Agrega tus productos para venderlos con un toque, o prueba con una lista de ejemplo.</p><div class="row" style="justify-content:center;gap:10px;flex-wrap:wrap"><button class="btn" data-a="pnew">Agregar producto</button><button class="btn sec" data-a="sample">Cargar ejemplos</button></div></div>`;
    return;
  }
  const q = norm(ui.q);
  const list = DB.products.filter((p) => (!ui.cat || p.cat === ui.cat) && (!q || norm(p.name).includes(q) || (p.code || "").includes(ui.q.trim()))).sort((a, b) => a.name.localeCompare(b.name, "es"));
  if (!list.length) { el.innerHTML = `<div class="empty" style="grid-column:1/-1"><h2>Sin resultados</h2><p>Prueba con otro nombre o usa «+ Monto» para cobrar un importe suelto.</p></div>`; return; }
  el.innerHTML = list.map((p) => {
    const inC = DB.cart.items.find((i) => i.id === p.id);
    const st = p.stock == null ? "" : p.stock <= 0 ? `<small class="out">Sin stock</small>` : p.stock <= (p.min || 0) ? `<small class="low">Quedan ${p.stock}</small>` : `<small>Stock ${p.stock}</small>`;
    return `<button class="pt ${inC ? "in" : ""}" data-a="add" data-id="${p.id}"><b>${esc(p.name)}</b><span><span class="pr num">${money(p.price)}</span>${st}</span>${inC ? `<span class="qty">${inC.qty}</span>` : ""}</button>`;
  }).join("");
}
function paintCart() {
  const el = $("#cart"); if (!el) return;
  const lines = cartLines(), t = cartTotals();
  if (!lines.length) document.body.classList.remove("cart-open");
  el.innerHTML = `<div class="cart-in">
    <div class="cart-h"><h2>Ticket actual</h2><div class="row">${lines.length ? `<button class="link" data-a="clear">Vaciar</button>` : ""}<button class="cart-x" data-a="closecart" aria-label="Cerrar ticket">✕</button></div></div>
    <div class="lines">${lines.length ? lines.map(({ l, r }) => `<div class="ln"><b>${esc(r.name)}</b><span class="amt num">${money(r.price * l.qty)}</span>
        <span class="sub num">${money(r.price)} c/u</span>
        <span class="step"><button data-a="dec" data-id="${l.id}" aria-label="Quitar uno">−</button><span class="num">${l.qty}</span><button data-a="inc" data-id="${l.id}" aria-label="Agregar uno">+</button></span></div>`).join("") : `<div class="cart-empty">Toca un producto para agregarlo al ticket.</div>`}</div>
    <div class="tot">
      ${lines.length ? `<div class="disc"><label for="disc">Descuento (S/)</label><input class="inp num" id="disc" data-in="disc" inputmode="decimal" placeholder="0.00" value="${DB.cart.disc ? DB.cart.disc : ""}"></div>
      <div class="r"><span>Subtotal</span><span class="num">${money(t.sub)}</span></div>` : ""}
      <div class="big"><span>Total</span><span class="num" id="cartTotal">${money(t.total)}</span></div>
      <div class="acts"><button class="btn sec" data-a="closecart">Seguir</button><button class="btn lg" data-a="pay" ${lines.length ? "" : "disabled"}>Cobrar</button></div>
    </div></div>`;
  const bar = $("#cartbar");
  if (bar) { bar.hidden = !lines.length; bar.innerHTML = `<span>${t.count} ${t.count === 1 ? "producto" : "productos"}</span><span class="num">Ver ticket · ${money(t.total)}</span>`; }
}

/* cobro */
function openPay() {
  const t = cartTotals(); if (!cartLines().length) return;
  ui.pay = { method: "efectivo", recv: "" };
  document.body.classList.remove("cart-open");
  paintPay(t.total);
}
function paintPay(total) {
  const p = ui.pay;
  openModal(`<h2>Cobrar</h2><div class="paytot"><span class="muted">Total a pagar</span><b class="num">${money(total)}</b></div>
    <div class="methods">${Object.entries(METHODS).map(([k, n]) => `<button class="mth ${p.method === k ? "on" : ""}" data-a="method" data-m="${k}">${n}</button>`).join("")}</div>
    ${p.method === "efectivo" ? `<label class="fld"><span>Cliente paga con</span><input class="inp num" id="recv" data-in="recv" inputmode="decimal" placeholder="${r2(total).toFixed(2)} (exacto)" value="${esc(p.recv)}"></label>
      <div class="quick">${[10, 20, 50, 100, 200].filter((n) => n >= total).slice(0, 4).map((n) => `<button class="chip" data-a="recv" data-v="${n}">${n}</button>`).join("")}<button class="chip" data-a="recv" data-v="${r2(total)}">Exacto</button></div>
      <div class="vuelto" id="vuelto"><span>Vuelto</span><b class="num">S/ 0.00</b></div>` : `<p class="muted" style="margin-bottom:14px">Confirma cuando veas el pago en tu ${esc(METHODS[p.method])}.</p>`}
    <div class="btns h"><button class="btn sec" data-a="close">Volver</button><button class="btn" id="payok" data-a="payok">Confirmar cobro</button></div>`);
  updPay();
}
function updPay() {
  const p = ui.pay, total = cartTotals().total;
  if (p.method !== "efectivo") return;
  const recv = p.recv === "" ? total : num(p.recv);
  const ch = r2(recv - total), bad = ch < 0;
  const vu = $("#vuelto"); if (!vu) return;
  vu.className = "vuelto" + (bad ? " bad" : "");
  vu.innerHTML = bad ? `<span>Falta</span><b class="num">${money(-ch)}</b>` : `<span>Vuelto</span><b class="num">${money(ch)}</b>`;
  $("#payok").disabled = bad;
}

/* venta rápida por monto */
function openQuick() {
  openModal(`<h2>Venta rápida</h2><p class="muted" style="margin-bottom:12px">Cobra un importe que no está en tu lista de productos.</p>
    <label class="fld"><span>Monto (S/)</span><input class="inp num" id="qa" inputmode="decimal" placeholder="0.00" autofocus></label>
    <label class="fld"><span>Detalle (opcional)</span><input class="inp" id="qn" placeholder="Varios"></label>
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" data-a="quickok">Agregar al ticket</button></div>`);
}

/* ---------- PRODUCTOS ---------- */
function viewProducts(v) {
  const low = DB.products.filter((p) => p.stock != null && p.stock <= (p.min || 0));
  const val = r2(DB.products.reduce((a, p) => a + (p.stock || 0) * (p.cost || 0), 0));
  v.innerHTML = `<div class="ph"><h1>Productos</h1><button class="btn" data-a="pnew">+ Nuevo</button></div>
    <div class="sumrow"><div class="sum"><b>${DB.products.length}</b><span>Productos</span></div><div class="sum ${low.length ? "warn" : ""}"><b>${low.length}</b><span>Stock bajo</span></div><div class="sum"><b class="num">${money(val)}</b><span>Valor al costo</span></div></div>
    <input class="inp" id="pq" type="search" placeholder="Buscar en inventario" style="margin-bottom:12px" value="${esc(ui.pq || "")}">
    <div class="list" id="plist"></div>`;
  paintPList();
}
function paintPList() {
  const el = $("#plist"); if (!el) return;
  if (!DB.products.length) { el.innerHTML = `<div class="empty"><h2>Inventario vacío</h2><p>Agrega tu primer producto o carga ejemplos para probar.</p><button class="btn sec" data-a="sample">Cargar ejemplos</button></div>`; return; }
  const q = norm(ui.pq);
  const list = DB.products.filter((p) => !q || norm(p.name).includes(q) || norm(p.cat).includes(q) || (p.code || "").includes(ui.pq || "")).sort((a, b) => (a.stock != null && a.stock <= (a.min || 0) ? 0 : 1) - (b.stock != null && b.stock <= (b.min || 0) ? 0 : 1) || a.name.localeCompare(b.name, "es"));
  el.innerHTML = list.map((p) => {
    const tag = p.stock == null ? "" : p.stock <= 0 ? `<span class="tag out">Sin stock</span>` : p.stock <= (p.min || 0) ? `<span class="tag low">Stock bajo</span>` : "";
    return `<button class="it" data-a="pedit" data-id="${p.id}"><div class="t"><b>${esc(p.name)}</b><small>${esc(p.cat || "Sin categoría")}${p.code ? " · " + esc(p.code) : ""}</small> ${tag}</div><div class="v num">${money(p.price)}<small>${p.stock == null ? "Sin control" : p.stock + " en stock"}</small></div></button>`;
  }).join("") || `<div class="empty"><p>Nada coincide con tu búsqueda.</p></div>`;
}
function openProduct(id) {
  const p = id ? prod(id) : { name: "", price: "", cost: "", stock: "", min: 5, cat: ui.cat || "", code: "" };
  const cats = [...new Set(DB.products.map((x) => x.cat).filter(Boolean))];
  openModal(`<h2>${id ? "Editar producto" : "Nuevo producto"}</h2>
    <label class="fld"><span>Nombre</span><input class="inp" data-f="name" value="${esc(p.name)}" ${id ? "" : "autofocus"} autocomplete="off"></label>
    <div class="two"><label class="fld"><span>Precio de venta (S/)</span><input class="inp num" data-f="price" inputmode="decimal" value="${esc(p.price)}"></label>
    <label class="fld"><span>Costo (S/)</span><input class="inp num" data-f="cost" inputmode="decimal" value="${esc(p.cost)}" placeholder="Opcional"></label></div>
    <div class="two"><label class="fld"><span>Stock actual</span><input class="inp num" data-f="stock" inputmode="decimal" value="${p.stock == null ? "" : esc(p.stock)}" placeholder="Vacío = sin control"></label>
    <label class="fld"><span>Avisar si baja de</span><input class="inp num" data-f="min" inputmode="numeric" value="${esc(p.min)}"></label></div>
    <div class="two"><label class="fld"><span>Categoría</span><input class="inp" data-f="cat" list="catlist" value="${esc(p.cat)}" placeholder="Bebidas, Abarrotes..."><datalist id="catlist">${cats.map((c) => `<option value="${esc(c)}">`).join("")}</datalist></label>
    <label class="fld"><span>Código de barras</span><input class="inp" data-f="code" value="${esc(p.code)}" placeholder="Opcional" inputmode="numeric"></label></div>
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" data-a="psave" data-id="${id || ""}">Guardar</button></div>
    ${id ? `<div class="btns"><button class="btn red sec" data-a="pdel" data-id="${id}">Eliminar producto</button></div>` : ""}`);
}
function saveProduct(id) {
  const f = (n) => $(`[data-f="${n}"]`).value.trim();
  const name = f("name"), price = num(f("price"));
  if (!name) return toast("Escribe el nombre del producto");
  if (!(price > 0)) return toast("Pon un precio mayor a 0");
  const code = f("code");
  if (code && DB.products.some((p) => p.code === code && p.id !== id)) return toast("Ese código ya lo usa otro producto");
  const data = { name, price: r2(price), cost: r2(num(f("cost"))), stock: f("stock") === "" ? null : r2(num(f("stock"))), min: Math.max(0, Math.round(num(f("min")))), cat: f("cat"), code };
  if (id) Object.assign(prod(id), data); else DB.products.push({ id: uid(), ...data });
  save(); closeModal(); toast("Producto guardado"); render();
}

/* ---------- CAJA / ARQUEO ---------- */
function viewCash(v) {
  const k = ui.date, t = dayTotals(k), open = openingOf(k), exp = expectedCash(k), c = countOf(k);
  const moves = DB.moves.filter((m) => m.date === k).sort((a, b) => b.t - a.t);
  const diff = r2(c.total - exp), counted = Object.values(c.q).some((n) => n > 0);
  const verdict = !counted ? "" : diff === 0 ? `<div class="verdict ok"><span>La caja cuadra</span><b class="num">S/ 0.00</b></div>` : diff < 0 ? `<div class="verdict short"><span>Falta dinero</span><b class="num">${money(-diff)}</b></div>` : `<div class="verdict over"><span>Sobra dinero</span><b class="num">${money(diff)}</b></div>`;
  v.innerHTML = `<div class="ph"><h1>Caja del día</h1></div>
    <div class="datebar"><button data-a="dstep" data-d="-1" aria-label="Día anterior">‹</button><label><span>${esc(fmtDate(k))}${k !== dkey() ? ` · ${k.split("-").reverse().join("/")}` : ""}</span><input type="date" value="${k}" max="${dkey()}" data-in="date" aria-label="Elegir fecha"></label><button data-a="dstep" data-d="1" aria-label="Día siguiente" ${k >= dkey() ? "disabled" : ""}>›</button></div>
    <div class="acts3" style="margin-bottom:14px"><button class="btn sec" data-a="mv" data-t="yape">Anotar<br>Yapes</button><button class="btn sec" data-a="mv" data-t="proveedor">Pago a<br>proveedor</button><button class="btn sec" data-a="mv" data-t="gasto">Otro<br>gasto</button></div>
    <div class="cols stack">
    <div class="stack">
      <div class="card"><h2>Ventas del día</h2>
        <div class="kv"><span>Efectivo</span><span class="num">${money(t.efectivo)}</span></div>
        <div class="kv"><span>Yape (ventas + anotados)</span><span class="num">${money(t.yapeAll)}</span></div>
        <div class="kv"><span>Plin</span><span class="num">${money(t.plin)}</span></div>
        <div class="kv"><span>Tarjeta</span><span class="num">${money(t.tarjeta)}</span></div>
        <div class="kv strong"><span>Total vendido</span><span class="num">${money(t.sales)}</span></div></div>
      <div class="card"><h2>Efectivo esperado en caja</h2>
        <div class="kv"><span>Caja inicial</span><span><input class="inp num" data-in="open" inputmode="decimal" value="${open || ""}" placeholder="0.00" aria-label="Caja inicial"></span></div>
        <div class="kv"><span>+ Ventas en efectivo</span><span class="num">${money(t.efectivo)}</span></div>
        <div class="kv"><span>− Pagos a proveedores</span><span class="num">${money(t.prov)}</span></div>
        <div class="kv"><span>− Otros gastos</span><span class="num">${money(t.gasto)}</span></div>
        <div class="kv strong"><span>Debería haber</span><span class="num">${money(exp)}</span></div></div>
      <div class="card"><h2>Movimientos anotados</h2>${moves.length ? moves.map((m) => `<div class="kv"><span>${hhmm(m.t)} · ${m.type === "yape" ? "Yape" : m.type === "proveedor" ? "Proveedor" : "Gasto"}${m.note ? " · " + esc(m.note) : ""}</span><span class="num">${m.type === "yape" ? "+" : "−"} ${money(m.amount)} <button class="link" style="min-height:32px;padding:0 0 0 8px" data-a="mvdel" data-id="${m.id}" aria-label="Borrar movimiento">✕</button></span></div>`).join("") : `<p class="muted">Aún no anotas Yapes, pagos ni gastos en este día.</p>`}</div>
    </div>
    <div class="card"><h2>Contar el efectivo</h2><p class="muted" style="margin-bottom:6px">Toca + por cada billete o moneda que tengas.</p>
      ${DENOMS.map((d) => `<div class="den"><b class="num">${d >= 10 ? "S/ " + d : d >= 1 ? "S/ " + d : "S/ " + d.toFixed(2)}</b><span class="step"><button data-a="den" data-d="${d}" data-v="-1" aria-label="Quitar ${d}">−</button><span class="num">${c.q[d] || 0}</span><button data-a="den" data-d="${d}" data-v="1" aria-label="Agregar ${d}">+</button></span><span class="s num">${money(d * (c.q[d] || 0))}</span></div>`).join("")}
      <div class="kv strong" style="margin-top:6px"><span>Contado</span><span class="num">${money(c.total)}</span></div>
      ${verdict}${counted ? `<button class="link" data-a="denclear">Reiniciar conteo</button>` : ""}</div>
    </div>`;
}
function openMove(type) {
  const T = { yape: ["Anotar Yapes", "Escribe los montos separados por espacio. Ej: 5 10 7.50"], proveedor: ["Pago a proveedor", "Sale del efectivo de la caja."], gasto: ["Otro gasto", "Sale del efectivo de la caja."] }[type];
  openModal(`<h2>${T[0]}</h2><p class="muted" style="margin-bottom:12px">${T[1]}</p>
    ${type === "yape" ? `<label class="fld"><span>Montos recibidos (S/)</span><input class="inp num" id="mva" inputmode="decimal" placeholder="5 10 7.50" autofocus autocomplete="off"></label><p class="muted" id="mvsum" style="margin-bottom:6px"></p>`
      : `<label class="fld"><span>${type === "proveedor" ? "Proveedor" : "Detalle"}</span><input class="inp" id="mvn" placeholder="${type === "proveedor" ? "Ej: Distribuidora Lima" : "Ej: Pasaje, bolsas, luz"}" autofocus></label><label class="fld"><span>Monto (S/)</span><input class="inp num" id="mva" inputmode="decimal" placeholder="0.00"></label>`}
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" data-a="mvsave" data-t="${type}">Guardar</button></div>`);
}
const parseAmounts = (s) => String(s).replace(/(\d),(\d{1,2})(?!\d)/g, "$1.$2").split(/[\s;,]+/).map((x) => parseFloat(x)).filter((n) => isFinite(n) && n > 0).map(r2);

/* ---------- REPORTES ---------- */
function rangeKeys(r) {
  const t = dkey();
  if (r === "hoy") return [t];
  if (r === "ayer") return [addD(t, -1)];
  if (r === "7d") return Array.from({ length: 7 }, (_, i) => addD(t, i - 6));
  const first = t.slice(0, 8) + "01", out = []; for (let k = first; k <= t; k = addD(k, 1)) out.push(k); return out;
}
function viewReports(v) {
  const keys = rangeKeys(ui.range), set = new Set(keys);
  const sales = DB.sales.filter((s) => set.has(s.date) && !s.void).sort((a, b) => b.t - a.t);
  const posTotal = r2(sales.reduce((a, s) => a + s.total, 0));
  const man = r2(DB.moves.filter((m) => set.has(m.date) && m.type === "yape").reduce((a, m) => a + m.amount, 0));
  const cost = r2(sales.reduce((a, s) => a + s.items.reduce((b, i) => b + (i.cost || 0) * i.qty, 0), 0));
  const profit = r2(posTotal - cost);
  const exp = r2(DB.moves.filter((m) => set.has(m.date) && (m.type === "proveedor" || m.type === "gasto")).reduce((a, m) => a + m.amount, 0));
  const byM = { efectivo: 0, yape: man, plin: 0, tarjeta: 0 }; sales.forEach((s) => { byM[s.method] = r2(byM[s.method] + s.total); });
  const tot = r2(posTotal + man);
  const items = {}; sales.forEach((s) => s.items.forEach((i) => { const o = items[i.name] || (items[i.name] = { q: 0, m: 0 }); o.q += i.qty; o.m = r2(o.m + i.price * i.qty); }));
  const top = Object.entries(items).sort((a, b) => b[1].m - a[1].m).slice(0, 6);
  const maxTop = top.length ? top[0][1].m : 1;
  const daily = keys.map((k) => ({ k, v: dayTotals(k).sales })), maxD = Math.max(1, ...daily.map((d) => d.v));
  const R = [["hoy", "Hoy"], ["ayer", "Ayer"], ["7d", "7 días"], ["mes", "Este mes"]];
  v.innerHTML = `<div class="ph"><h1>Reportes</h1><button class="btn sec sm" data-a="csv">Exportar CSV</button></div>
    <div class="chips">${R.map(([k, n]) => `<button class="chip ${ui.range === k ? "on" : ""}" data-a="range" data-r="${k}">${n}</button>`).join("")}</div>
    <div class="kpis" style="margin-bottom:14px">
      <div class="kpi main"><span>Vendido</span><b class="num">${money(tot)}</b></div>
      <div class="kpi"><span>Tickets</span><b class="num">${sales.length}</b></div>
      <div class="kpi"><span>Ganancia estimada</span><b class="num">${money(profit)}</b></div>
      <div class="kpi"><span>Gastos y proveedores</span><b class="num">${money(exp)}</b></div></div>
    <div class="cols stack">
    <div class="stack">
      ${keys.length > 1 ? `<div class="card"><h2>Ventas por día</h2><div class="bars">${daily.map((d) => `<div class="bar ${d.k === dkey() ? "t" : ""}"><i style="height:${Math.max(3, d.v / maxD * 100)}%" title="${money(d.v)}"></i><span>${keys.length > 8 ? pk(d.k).getDate() : ["D", "L", "M", "M", "J", "V", "S"][pk(d.k).getDay()]}</span></div>`).join("")}</div></div>` : ""}
      <div class="card"><h2>Por método de pago</h2>${Object.entries(byM).map(([k, n]) => `<div style="margin-bottom:10px"><div class="row sp"><b>${METHODS[k]}</b><span class="num">${money(n)}</span></div><div class="hbar"><i style="width:${tot ? n / tot * 100 : 0}%"></i></div></div>`).join("")}</div>
      <div class="card"><h2>Más vendidos</h2>${top.length ? top.map(([n, o]) => `<div style="margin-bottom:10px"><div class="row sp"><span>${esc(n)} <span class="muted">× ${r2(o.q)}</span></span><b class="num">${money(o.m)}</b></div><div class="hbar"><i style="width:${o.m / maxTop * 100}%"></i></div></div>`).join("") : `<p class="muted">Todavía no hay ventas en este periodo.</p>`}</div>
    </div>
    <div class="card"><h2>Ventas</h2>${sales.length ? `<div class="list">${sales.slice(0, 60).map((s) => `<button class="it" data-a="sale" data-id="${s.id}"><div class="t"><b>Ticket ${ticketNo(s)}</b><small>${keys.length > 1 ? pk(s.date).toLocaleDateString("es-PE", { day: "numeric", month: "short" }) + " · " : ""}${hhmm(s.t)} · ${METHODS[s.method]} · ${s.items.reduce((a, i) => a + i.qty, 0)} prod.</small></div><div class="v num">${money(s.total)}</div></button>`).join("")}</div>${sales.length > 60 ? `<p class="muted" style="margin-top:8px">Mostrando las 60 más recientes. El CSV trae todas.</p>` : ""}` : `<p class="muted">No hay ventas en este periodo.</p>`}</div>
    </div>`;
}
function exportCsv() {
  const set = new Set(rangeKeys(ui.range));
  const rows = [["fecha", "hora", "ticket", "metodo", "producto", "cantidad", "precio", "subtotal", "total_ticket", "estado"]];
  DB.sales.filter((s) => set.has(s.date)).sort((a, b) => a.t - b.t).forEach((s) => s.items.forEach((i) => rows.push([s.date, hhmm(s.t), s.id, s.method, i.name, i.qty, i.price, r2(i.price * i.qty), s.total, s.void ? "anulada" : "ok"])));
  const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  download(`ventas-${dkey()}.csv`, csv, "text/csv;charset=utf-8");
}
function download(name, text, type) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- AJUSTES ---------- */
function viewSettings(v) {
  v.innerHTML = `<div class="ph"><h1>Ajustes</h1></div><div class="stack">
    <div class="card"><h2>Mi negocio</h2><label class="fld"><span>Nombre (sale en el ticket)</span><input class="inp" data-in="biz" value="${esc(DB.biz)}" maxlength="40"></label></div>
    <div class="card"><h2>Seguridad</h2>
      <div class="set"><div><b>PIN de 4 dígitos</b><small>${DB.pin ? "Activado. Se pide al abrir la app." : "Desactivado."}</small></div><button class="btn sec sm" data-a="pin">${DB.pin ? "Cambiar" : "Activar"}</button></div>
      ${DB.pin ? `<div class="set"><div><b>Quitar PIN</b></div><button class="btn red sec sm" data-a="pinoff">Quitar</button></div>` : ""}
      <div class="set"><div><b>Sonidos</b><small>Pitido al agregar y cobrar</small></div><button class="switch" data-a="mute" aria-pressed="${!DB.mute}" aria-label="Sonidos"></button></div></div>
    <div class="card"><h2>Respaldo de datos</h2><p class="muted" style="margin-bottom:10px">Tus datos viven solo en este dispositivo. Guarda un respaldo seguido y úsalo para pasar la información a otro teléfono.</p>
      <div class="two"><button class="btn sec" data-a="backup">Descargar respaldo</button><label class="btn sec" style="cursor:pointer">Restaurar<input type="file" accept="application/json,.json" data-in="restore" hidden></label></div></div>
    <div class="card"><h2>Zona de cuidado</h2><div class="two"><button class="btn sec" data-a="sample">Cargar ejemplos</button><button class="btn red sec" data-a="reset">Borrar todo</button></div></div>
    </div>`;
}

/* ---------- PIN ---------- */
let pinBuf = "", pinCb = null;
function askPin(title, cb, cancelable = false) {
  pinBuf = ""; pinCb = cb; ui.locked = true;
  $("#lockTitle").textContent = title; $("#lockCancel").hidden = !cancelable;
  $("#lock").hidden = false; paintDots();
}
function hideLock() { $("#lock").hidden = true; ui.locked = false; pinCb = null; pinBuf = ""; }
function paintDots(err) {
  $$("#lockDots i").forEach((d, i) => d.classList.toggle("on", i < pinBuf.length));
  const dots = $("#lockDots"); dots.classList.remove("err"); if (err) { void dots.offsetWidth; dots.classList.add("err"); }
}
function pinKey(k) {
  if (k === "del") pinBuf = pinBuf.slice(0, -1);
  else if (pinBuf.length < 4) pinBuf += k;
  paintDots();
  if (pinBuf.length === 4 && pinCb) { const p = pinBuf, cb = pinCb; setTimeout(() => cb(p), 90); }
}
function pinBad() { pinBuf = ""; beep(false); paintDots(true); }
function lockApp() { if (!DB.pin) return; closeModal(); document.body.classList.remove("cart-open"); askPin("Ingresa tu PIN", (p) => { if (pinHash(p) === DB.pin) hideLock(); else pinBad(); }); }
function setupPin() {
  askPin("Crea un PIN de 4 dígitos", (a) => {
    askPin("Repite el PIN", (b) => {
      if (a === b) { DB.pin = pinHash(a); save(); hideLock(); toast("PIN activado"); render(); }
      else { pinBad(); toast("No coinciden. Intenta de nuevo"); setupPin(); }
    }, true);
  }, true);
}
$("#lockPad").innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-a="lockkey" data-k="${n}">${n}</button>`).join("") + `<button class="ghost" tabindex="-1" aria-hidden="true"></button><button data-a="lockkey" data-k="0">0</button><button data-a="lockkey" data-k="del" aria-label="Borrar">⌫</button>`;
document.addEventListener("keydown", (e) => {
  if (!ui.locked) { if (e.key === "Escape" && !$("#modal").hidden) closeModal(); return; }
  if (/^\d$/.test(e.key)) pinKey(e.key); else if (e.key === "Backspace") pinKey("del");
});
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (DB.pin && !ui.locked && hiddenAt && Date.now() - hiddenAt > 120000) lockApp();
});

/* ---------- acciones ---------- */
const A = {
  tab: (el) => go(el.dataset.t),
  add: (el) => { const p = prod(el.dataset.id); if (p) addToCart(p); },
  inc: (el) => changeQty(el.dataset.id, 1),
  dec: (el) => changeQty(el.dataset.id, -1),
  clear: () => confirmBox("¿Vaciar el ticket?", "Vaciar", () => { DB.cart = { items: [], disc: 0 }; save(); paintSale(); }),
  cat: (el) => { ui.cat = el.dataset.c; paintCats(); paintGrid(); },
  opencart: () => document.body.classList.add("cart-open"),
  closecart: () => document.body.classList.remove("cart-open"),
  pay: openPay,
  method: (el) => { ui.pay.method = el.dataset.m; paintPay(cartTotals().total); },
  recv: (el) => { ui.pay.recv = el.dataset.v; const i = $("#recv"); if (i) i.value = ui.pay.recv; updPay(); },
  payok: () => {
    const t = cartTotals(); if (!cartLines().length) return closeModal();
    const m = ui.pay.method, recv = ui.pay.recv === "" ? t.total : num(ui.pay.recv);
    if (m === "efectivo" && recv < t.total) return;
    const s = finalizeSale(m, recv); beep(true); document.body.classList.remove("cart-open"); showReceipt(s, true); paintSale();
  },
  newsale: () => { closeModal(); ui.q = ""; render(); },
  quick: openQuick,
  quickok: () => {
    const a = num($("#qa").value); if (!(a > 0)) return toast("Escribe un monto mayor a 0");
    DB.cart.items.push({ id: "q" + uid(), quick: true, name: $("#qn").value.trim() || "Varios", price: r2(a), qty: 1 });
    save(); closeModal(); beep(true); paintSale();
  },
  print: (el) => { const s = DB.sales.find((x) => x.id === +el.dataset.id); if (!s) return; $("#ticket").innerHTML = receiptHtml(s); window.print(); },
  wa: (el) => { const s = DB.sales.find((x) => x.id === +el.dataset.id); if (s) window.open("https://wa.me/?text=" + encodeURIComponent(receiptText(s)), "_blank", "noopener"); },
  sale: (el) => { const s = DB.sales.find((x) => x.id === +el.dataset.id); if (s) showReceipt(s, false); },
  void: (el) => { const id = +el.dataset.id; confirmBox("¿Anular esta venta? El stock vuelve al inventario.", "Anular venta", () => { voidSale(id); toast("Venta anulada"); render(); }); },
  pnew: () => openProduct(""),
  pedit: (el) => openProduct(el.dataset.id),
  psave: (el) => saveProduct(el.dataset.id),
  pdel: (el) => { const id = el.dataset.id; confirmBox("¿Eliminar este producto?", "Eliminar", () => { DB.products = DB.products.filter((p) => p.id !== id); DB.cart.items = DB.cart.items.filter((i) => i.id !== id); save(); toast("Producto eliminado"); render(); }); },
  sample: () => { loadSample(); toast("Productos de ejemplo cargados"); render(); },
  dstep: (el) => { const k = addD(ui.date, +el.dataset.d); if (k <= dkey()) { ui.date = k; render(); } },
  den: (el) => { const k = ui.date, d = el.dataset.d, c = DB.counts[k] || (DB.counts[k] = { q: {} }); c.q[d] = Math.max(0, (c.q[d] || 0) + +el.dataset.v); c.total = countOf(k).total; save(); render(); },
  denclear: () => { delete DB.counts[ui.date]; save(); render(); },
  mv: (el) => openMove(el.dataset.t),
  mvsave: (el) => {
    const type = el.dataset.t, k = ui.date, now = Date.now();
    if (type === "yape") {
      const list = parseAmounts($("#mva").value); if (!list.length) return toast("Escribe al menos un monto");
      list.forEach((a, i) => DB.moves.push({ id: uid(), date: k, t: now + i, type, amount: a, note: "" }));
      toast(`${list.length} ${list.length === 1 ? "Yape anotado" : "Yapes anotados"}: ${money(list.reduce((a, b) => a + b, 0))}`);
    } else {
      const a = num($("#mva").value); if (!(a > 0)) return toast("Escribe un monto mayor a 0");
      DB.moves.push({ id: uid(), date: k, t: now, type, amount: r2(a), note: $("#mvn").value.trim() }); toast("Guardado");
    }
    save(); closeModal(); render();
  },
  mvdel: (el) => { DB.moves = DB.moves.filter((m) => m.id !== el.dataset.id); save(); render(); },
  range: (el) => { ui.range = el.dataset.r; render(); },
  csv: exportCsv,
  pin: setupPin,
  pinoff: () => confirmBox("¿Quitar el PIN?", "Quitar PIN", () => { DB.pin = ""; save(); toast("PIN desactivado"); render(); }),
  mute: () => { DB.mute = !DB.mute; save(); render(); },
  backup: () => { download(`respaldo-caja-facil-${dkey()}.json`, JSON.stringify(DB), "application/json"); toast("Respaldo descargado"); },
  reset: () => confirmBox("¿Borrar TODOS los datos? Esto no se puede deshacer.", "Borrar todo", () => { DB = blank(); save(); toast("Datos borrados"); go("venta"); }),
  lock: lockApp,
  lockkey: (el) => pinKey(el.dataset.k),
  lockcancel: () => hideLock(),
  close: closeModal
};
document.addEventListener("click", (e) => {
  const m = $("#modal");
  if (e.target === m) return closeModal();
  const el = e.target.closest("[data-a]");
  if (el && A[el.dataset.a]) { e.preventDefault(); A[el.dataset.a](el); }
});
document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.id === "q") { ui.q = t.value; paintGrid(); }
  else if (t.id === "pq") { ui.pq = t.value; paintPList(); }
  else if (t.dataset.in === "recv") { ui.pay.recv = t.value; updPay(); }
  else if (t.id === "mva" && $("#mvsum")) { const l = parseAmounts(t.value); $("#mvsum").textContent = l.length ? `${l.length} ${l.length === 1 ? "monto" : "montos"} · Total ${money(l.reduce((a, b) => a + b, 0))}` : ""; }
});
document.addEventListener("change", (e) => {
  // Se difiere un instante: si el cambio ocurre durante un "blur", volver a dibujar la pantalla al instante da error.
  const t = e.target;
  setTimeout(() => onChange(t), 0);
});
function onChange(t) {
  const k = t.dataset.in;
  if (k === "disc") { DB.cart.disc = Math.max(0, r2(num(t.value))); save(); paintCart(); }
  else if (k === "open") { DB.opening[ui.date] = Math.max(0, r2(num(t.value))); save(); render(); }
  else if (k === "date") { if (t.value && t.value <= dkey()) { ui.date = t.value; render(); } }
  else if (k === "biz") { DB.biz = t.value.trim() || "Mi negocio"; save(); paintNav(); toast("Nombre guardado"); }
  else if (k === "restore") {
    const f = t.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const o = JSON.parse(rd.result);
        if (!o || !Array.isArray(o.products) || !Array.isArray(o.sales)) throw 0;
        confirmBox("¿Restaurar este respaldo? Reemplaza los datos actuales.", "Restaurar", () => { DB = Object.assign(blank(), o); save(); toast("Respaldo restaurado"); go("venta"); }, false);
      } catch (err) { toast("Ese archivo no es un respaldo válido"); }
    };
    rd.readAsText(f); t.value = "";
  }
}
// Escáner de código de barras: la mayoría "teclean" el código y presionan Enter.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.target.id !== "q") return;
  const c = e.target.value.trim(); if (!c) return;
  const p = DB.products.find((x) => x.code && x.code === c);
  if (p) { e.preventDefault(); addToCart(p); ui.q = ""; e.target.value = ""; paintGrid(); }
  else { const first = $("#grid .pt"); if (first) first.click(); }
});

/* ---------- inicio ---------- */
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
window.CF = { get DB() { return DB; }, dayTotals, expectedCash, cartTotals, parseAmounts, ui };
render();
if (DB.pin) askPin("Ingresa tu PIN", (p) => { if (pinHash(p) === DB.pin) hideLock(); else pinBad(); });
})();
