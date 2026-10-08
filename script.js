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
const r3 = (n) => Math.round((+n || 0) * 1000) / 1000;
const fmtQ = (n) => String(+(+n).toFixed(3));
const parseQty = (v) => {
  v = String(v).trim().toLowerCase().replace(",", ".");
  const grams = /\d\s*(g|gr)$/.test(v); // "250g" = 0.25 kg
  v = v.replace(/\s*(kg|gr|g)$/, "");
  let n;
  if (v.includes("/")) { const [a, b] = v.split("/").map(parseFloat); n = b ? a / b : 0; } else n = parseFloat(v);
  n = isFinite(n) ? n : 0;
  return grams ? n / 1000 : n;
};
const EMO = [["verdur", "🥬"], ["fruta", "🍎"], ["bebida", "🥤"], ["snack", "🍿"], ["panader", "🥖"], ["abarrote", "🛒"], ["limpieza", "🧴"], ["lacteo", "🥛"], ["carne", "🥩"], ["golosina", "🍬"]];
const emojiOf = (p) => { const c = String(p.cat || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); for (const [k, e] of EMO) if (c.includes(k)) return e; return "📦"; };
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
// Una venta puede pagarse con varios medios: s.pays = [{ m, amt }]. Las ventas antiguas solo tienen s.method.
const paysOf = (s) => (s.pays && s.pays.length ? s.pays : [{ m: s.method, amt: s.total }]);
const methodLabel = (s) => (paysOf(s).length > 1 ? paysOf(s).map((p) => `${METHODS[p.m]} ${money(p.amt)}`).join(" + ") : METHODS[paysOf(s)[0].m] || "Efectivo");
const fmtPhone = (v) => String(v || "").replace(/\D/g, "").replace(/(\d{3})(?=\d)/g, "$1 ").trim();

/* ---------- datos ---------- */
const KEY = "caja-facil-v1";
const blank = () => ({ biz: "Mi negocio", pin: "", mute: false, products: [], sales: [], moves: [], opening: {}, counts: {}, tickets: [{ n: 1, name: "", items: [], disc: 0 }], cur: 0, tseq: 1, seq: 0 });
// "DB.cart" siempre apunta al ticket que se está atendiendo (hay varios tickets en espera).
function wire(db) {
  const old = Object.prototype.hasOwnProperty.call(db, "cart") ? db.cart : null;
  if (!Array.isArray(db.tickets) || !db.tickets.length) { db.tickets = [{ n: 1, name: "", items: (old && old.items) || [], disc: (old && old.disc) || 0 }]; db.tseq = 1; db.cur = 0; }
  delete db.cart;
  if (!(db.cur >= 0 && db.cur < db.tickets.length)) db.cur = 0;
  Object.defineProperty(db, "cart", { get() { return db.tickets[db.cur]; }, set(v) { db.tickets[db.cur] = Object.assign({ n: db.tickets[db.cur].n, name: "" }, v); }, enumerable: false, configurable: true });
  return db;
}
function fromJSON(raw) {
  try { return wire(Object.assign(blank(), JSON.parse(raw) || {})); } catch (e) { return wire(blank()); }
}
let DB = wire(blank()); // se llena en boot()
// Guardado en IndexedDB (mucho más espacio que localStorage). Si el navegador no lo permite, usa localStorage.
let idb = null, saveT = 0, dirty = false, inflight = false, lastStr = "";
function idbOpen() {
  return new Promise((ok, no) => {
    if (!window.indexedDB) return no();
    try { const r = indexedDB.open("caja-facil", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); r.onblocked = () => no(); } catch (e) { no(e); }
  });
}
function idbGet(k) { return new Promise((ok, no) => { const q = idb.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error); }); }
function lsSave(str) { try { localStorage.setItem(KEY, str); return true; } catch (e) { toast("No se pudo guardar: el almacenamiento está lleno"); return false; } }
// Si la página se cierra con un guardado todavía en camino, se deja una copia en localStorage; al abrir se recupera sola.
function flush(hiding) {
  if (dirty) {
    dirty = false;
    const str = JSON.stringify(DB); lastStr = str;
    if (!idb) { lsSave(str); return; }
    try {
      inflight = true;
      const tx = idb.transaction("kv", "readwrite"); tx.objectStore("kv").put(str, "db");
      tx.oncomplete = () => { if (lastStr === str) { inflight = false; try { localStorage.removeItem(KEY); } catch (e) {} } };
      tx.onerror = () => { inflight = false; idb = null; lsSave(str); };
    } catch (e) { inflight = false; idb = null; lsSave(str); }
  }
  if (hiding === true && idb && inflight) { try { localStorage.setItem(KEY, lastStr); } catch (e) {} }
}
function save() { dirty = true; clearTimeout(saveT); saveT = setTimeout(flush, 30); }
window.addEventListener("pagehide", () => flush(true));
document.addEventListener("visibilitychange", () => { if (document.hidden) flush(true); });
const pinHash = (p) => { let h = 5381; for (const c of p + "|cf") h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return String(h); };

const SAMPLE = [
  ["Tomate", 4.5, 3, 30, "Verduras", "1", "kg"], ["Cebolla roja", 3.5, 2.4, 40, "Verduras", "2", "kg"],
  ["Papa blanca", 2.8, 1.9, 60, "Verduras", "3", "kg"], ["Zanahoria", 2.5, 1.6, 25, "Verduras", "4", "kg"],
  ["Limón", 6, 4.5, 15, "Verduras", "5", "kg"], ["Lechuga", 2.5, 1.5, 20, "Verduras", "6", "u"],
  ["Palta fuerte", 12, 9, 18, "Verduras", "7", "kg"], ["Plátano de seda", 3.5, 2.4, 22, "Verduras", "8", "kg"],
  ["Inca Kola 500 ml", 3, 2.2, 24, "Bebidas", "7750001"], ["Coca Cola 500 ml", 3, 2.2, 24, "Bebidas", "7750002"],
  ["Agua 625 ml", 1.5, 1, 36, "Bebidas", "7750003"], ["Galleta soda", 1, 0.7, 40, "Snacks", ""],
  ["Papas fritas clásicas", 2.5, 1.8, 18, "Snacks", ""], ["Chocolate", 1.5, 1, 30, "Snacks", ""],
  ["Pan francés (unidad)", 0.3, 0.2, 100, "Panadería", ""], ["Leche evaporada 400 g", 4.8, 4, 20, "Abarrotes", "7750008"],
  ["Arroz 1 kg", 4.5, 3.6, 15, "Abarrotes", ""], ["Aceite 1 L", 9.5, 8, 8, "Abarrotes", ""],
  ["Huevos (unidad)", 0.6, 0.45, 90, "Abarrotes", ""], ["Detergente 500 g", 6, 4.8, 6, "Limpieza", ""],
  ["Papel higiénico x4", 5, 3.8, 10, "Limpieza", ""], ["Cigarro suelto", 0.5, 0.35, null, "Otros", ""]
];
function loadSample() {
  SAMPLE.forEach(([name, price, cost, stock, cat, code, unit]) => {
    if (DB.products.some((p) => p.name === name)) return;
    DB.products.push({ id: uid(), name, price, cost, stock, min: stock == null ? 0 : 5, cat, code, unit: unit || "u" });
  });
  save();
}
const nextCode = () => { const used = new Set(DB.products.map((p) => p.code)); let i = 1; while (used.has(String(i))) i++; return String(i); };

/* ---------- estado de interfaz ---------- */
const ui = { tab: "venta", q: "", cat: "", date: dkey(), range: "hoy", pay: null, locked: false };
const prod = (id) => DB.products.find((p) => p.id === id);
const DESK = () => window.matchMedia("(min-width:960px)").matches;
const KEYS = { efectivo: "E", yape: "Y", plin: "P", tarjeta: "T" };
function focusQ() {
  if (!DESK() || ui.tab !== "venta" || ui.locked || !$("#modal").hidden) return;
  const q = $("#q"); if (q && document.activeElement !== q) q.focus();
}

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
function openModal(html) { const m = $("#modal"); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); $(".sheet", m).innerHTML = html; m.hidden = false; document.body.classList.add("noscroll"); const f = $("[autofocus]", m); if (f) setTimeout(() => f.focus(), 50); }
function closeModal() { $("#modal").hidden = true; $(".sheet", $("#modal")).innerHTML = ""; document.body.classList.remove("noscroll"); document.body.classList.remove("cart-open-lock"); focusQ(); }
function confirmBox(msg, label, cb, danger = true) {
  openModal(`<h2>${esc(msg)}</h2><div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn ${danger ? "red" : ""}" id="cfYes">${esc(label)}</button></div>`);
  $("#cfYes").onclick = () => { closeModal(); cb(); };
}

/* ---------- carrito ---------- */
function resolveLine(l) {
  if (l.quick) return { name: l.name, price: l.price, cost: 0, stock: null, quick: true, unit: "u", code: "" };
  const p = prod(l.id); return p ? { name: p.name, price: p.price, cost: p.cost || 0, stock: p.stock, quick: false, unit: p.unit || "u", code: p.code || "" } : null;
}
function cartLines() { return DB.cart.items.map((l) => ({ l, r: resolveLine(l) })).filter((x) => x.r); }
function cartTotals() {
  const sub = r2(cartLines().reduce((a, { l, r }) => a + r2(r.price * l.qty), 0));
  const disc = Math.min(Math.max(0, r2(DB.cart.disc)), sub);
  return { sub, disc, total: r2(sub - disc), count: cartLines().length };
}
const unitTxt = (r) => (r.unit === "kg" ? " kg" : "");
function applyQty(id, total) {
  const l = DB.cart.items.find((i) => i.id === id);
  const r = resolveLine(l || { id }); if (!r) return false;
  if (total <= 0) DB.cart.items = DB.cart.items.filter((i) => i.id !== id);
  else {
    if (r.stock != null && total > r.stock) { toast(r.stock <= 0 ? "Sin stock: " + r.name : `Solo quedan ${fmtQ(r.stock)}${unitTxt(r)} de ${r.name}`); beep(false); return false; }
    if (l) l.qty = total; else DB.cart.items.push({ id, qty: total });
  }
  if (total > 0) ui.sel = id;
  save(); beep(true); paintSale(); return true;
}
function addToCart(p, qty = 1) {
  const l = DB.cart.items.find((i) => i.id === p.id);
  return applyQty(p.id, r3((l ? l.qty : 0) + qty));
}
function changeQty(id, d) {
  const l = DB.cart.items.find((i) => i.id === id); if (!l) return;
  const r = resolveLine(l); if (!r) return;
  applyQty(id, r3(l.qty + d * (r.unit === "kg" ? 0.25 : 1)));
}
function dropCurrentTicket() {
  if (DB.tickets.length > 1) { DB.tickets.splice(DB.cur, 1); DB.cur = Math.max(0, DB.cur - 1); }
  else { DB.tickets = [{ n: 1, name: "", items: [], disc: 0 }]; DB.tseq = 1; DB.cur = 0; }
}
function ticketTotal(t) {
  const sub = r2(t.items.reduce((a, l) => { const r = resolveLine(l); return a + (r ? r2(r.price * l.qty) : 0); }, 0));
  return r2(sub - Math.min(Math.max(0, r2(t.disc)), sub));
}

/* ---------- ventas ---------- */
function finalizeSale(pays, cashGiven) {
  const lines = cartLines();
  const t = cartTotals();
  const items = lines.map(({ l, r }) => ({ id: l.id, name: r.name, price: r.price, cost: r.cost, qty: l.qty, quick: !!r.quick, unit: r.unit }));
  const cashApplied = r2(pays.filter((p) => p.m === "efectivo").reduce((a, p) => a + p.amt, 0));
  const hasCash = pays.some((p) => p.m === "efectivo");
  const s = { id: ++DB.seq, t: Date.now(), date: dkey(), items, sub: t.sub, disc: t.disc, total: t.total, method: pays.length === 1 ? pays[0].m : "mixto", pays, recv: hasCash ? cashGiven : t.total, change: hasCash ? r2(cashGiven - cashApplied) : 0 };
  lines.forEach(({ l, r }) => { if (!r.quick && r.stock != null) { const p = prod(l.id); p.stock = r3(p.stock - l.qty); } });
  DB.sales.push(s);
  dropCurrentTicket();
  save();
  return s;
}
function voidSale(id) {
  const s = DB.sales.find((x) => x.id === id); if (!s || s.void) return;
  s.items.forEach((it) => { if (!it.quick) { const p = prod(it.id); if (p && p.stock != null) p.stock = r3(p.stock + it.qty); } });
  s.void = true; save();
}
const salesOn = (k) => DB.sales.filter((s) => s.date === k && !s.void);
function dayTotals(k) {
  const t = { efectivo: 0, yape: 0, plin: 0, tarjeta: 0 };
  salesOn(k).forEach((s) => paysOf(s).forEach((p) => { t[p.m] = r2(t[p.m] + p.amt); }));
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
  return s.items.map((i) => `<div class="l"><span>${fmtQ(i.qty)}${i.unit === "kg" ? " kg" : ""} x ${esc(i.name)}</span><span>${money(i.price * i.qty)}</span></div>`).join("");
}
function payBlock(s) {
  const pays = paysOf(s), cash = pays.some((p) => p.m === "efectivo");
  return (pays.length > 1 ? pays.map((p) => `<div class="l"><span>${METHODS[p.m]}</span><span>${money(p.amt)}</span></div>`).join("") : `<div class="l"><span>Pago</span><span>${METHODS[pays[0].m]}</span></div>`) +
    (cash ? (pays.length > 1 ? (s.change > 0 ? `<div class="l"><span>Vuelto</span><span>${money(s.change)}</span></div>` : "") : `<div class="l"><span>Recibido</span><span>${money(s.recv)}</span></div><div class="l"><span>Vuelto</span><span>${money(s.change)}</span></div>`) : "");
}
function receiptHtml(s) {
  const d = new Date(s.t);
  return `<h3>${esc(DB.biz)}</h3><div class="c">${d.toLocaleDateString("es-PE")} ${hhmm(s.t)} · Ticket ${ticketNo(s)}</div><hr>${receiptLines(s)}<hr>` +
    (s.disc ? `<div class="l"><span>Subtotal</span><span>${money(s.sub)}</span></div><div class="l"><span>Descuento</span><span>- ${money(s.disc)}</span></div>` : "") +
    `<div class="l t"><span>TOTAL</span><span>${money(s.total)}</span></div>` +
    payBlock(s) +
    `<hr><div class="c">¡Gracias por su compra!</div>`;
}
function receiptText(s) {
  const d = new Date(s.t);
  let t = `*${DB.biz}*\n${d.toLocaleDateString("es-PE")} ${hhmm(s.t)} - Ticket ${ticketNo(s)}\n\n`;
  s.items.forEach((i) => { t += `${fmtQ(i.qty)}${i.unit === "kg" ? " kg" : ""} x ${i.name}  ${money(i.price * i.qty)}\n`; });
  if (s.disc) t += `\nDescuento: -${money(s.disc)}`;
  t += `\n*TOTAL: ${money(s.total)}* (${methodLabel(s)})\nGracias por su compra!`;
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
  document.body.dataset.tab = ui.tab;
  const v = $("#view");
  ({ venta: viewSale, prod: viewProducts, caja: viewCash, rep: viewReports, aj: viewSettings }[ui.tab])(v);
}

/* ---------- VENDER ---------- */
function viewSale(v) {
  v.innerHTML = `<div class="pos">
    <section>
      <div class="searchbar">
        <input class="inp" id="q" type="search" placeholder="${DESK() ? "Código o nombre del producto (Enter)" : "Código o nombre"}" autocomplete="off" value="${esc(ui.q)}" aria-label="Buscar producto o código">
        <button class="btn sec" data-a="quick" aria-label="Venta rápida por monto">+ Monto</button>
      </div>
      <p class="hint">Escribe el código y Enter. Con peso o cantidad: <b>0.25*1</b> o <b>1/4*1</b> = ¼ kg del código 1 · <b>3*6</b> = 3 del código 6.</p>
      <div class="chips" id="cats"></div>
      <div class="grid" id="grid"></div>
    </section>
    <aside class="cart" id="cart" aria-label="Ticket actual"></aside>
  </div>
  <div class="fbar" aria-label="Atajos de teclado">
    <button data-a="pay" data-m="efectivo"><kbd>F2</kbd>Efectivo</button>
    <button data-a="focusq"><kbd>F3</kbd>Buscar</button>
    <button data-a="tknew"><kbd>F4</kbd>Ticket nuevo</button>
    <button data-a="qeditsel"><kbd>F6</kbd>Cantidad</button>
    <button data-a="split"><kbd>F7</kbd>Dividir pago</button>
    <button data-a="pay" data-m="yape"><kbd>F8</kbd>Yape</button>
    <button data-a="pay" data-m="tarjeta"><kbd>F9</kbd>Tarjeta</button>
    <button data-a="pay" data-m="plin"><kbd>F10</kbd>Plin</button>
    <button data-a="rmsel"><kbd>Supr</kbd>Quitar línea</button>
  </div>
  <button class="cartbar" id="cartbar" data-a="opencart" hidden></button>`;
  paintSale();
  focusQ();
}
function paintSale() {
  if (ui.tab !== "venta") return;
  paintCats(); paintGrid(); paintCart();
}
function paintCats() {
  const cats = [...new Set(DB.products.map((p) => p.cat).filter(Boolean))].sort();
  const el = $("#cats"); if (!el) return;
  const chip = (c, label) => `<button class="chip ${ui.cat === c ? "on" : ""}" data-a="cat" data-c="${esc(c)}">${label}</button>`;
  el.innerHTML = cats.length ? chip("", "Todos") + chip("__top", "⭐ Más vendidos") + cats.map((c) => chip(c, `${emojiOf({ cat: c })} ${esc(c)}`)).join("") : "";
}
function paintGrid() {
  const el = $("#grid"); if (!el) return;
  if (!DB.products.length) {
    el.innerHTML = `<div class="empty" style="grid-column:1/-1"><h2>Aún no tienes productos</h2><p>Agrega tus productos para venderlos con un toque, o prueba con una lista de ejemplo.</p><div class="row" style="justify-content:center;gap:10px;flex-wrap:wrap"><button class="btn" data-a="pnew">Agregar producto</button><button class="btn sec" data-a="sample">Cargar ejemplos</button></div></div>`;
    return;
  }
  const raw = ui.q.trim(), mm = raw.match(/^[\d.,\/]+\s*(?:k?g|gr)?\s*[*xX]\s*(.*)$/i), key = mm ? mm[1].trim() : raw, q = norm(key);
  const topIds = (() => { const from = addD(dkey(), -30), m = {}; DB.sales.forEach((x) => { if (x.void || x.date < from) return; x.items.forEach((i) => { if (!i.quick) m[i.id] = (m[i.id] || 0) + i.qty; }); }); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 12).map((e) => e[0]); })();
  const catOk = (p) => !ui.cat || (ui.cat === "__top" ? topIds.includes(p.id) : p.cat === ui.cat);
  const list = DB.products.filter((p) => (q ? true : catOk(p)) && (!q || norm(p.name).includes(q) || (p.code || "") === key || (p.code || "").startsWith(key)))
    .sort((a, b) => ((b.code === key) - (a.code === key)) || a.name.localeCompare(b.name, "es"));
  if (!list.length) { el.innerHTML = ui.cat === "__top" ? `<div class="empty" style="grid-column:1/-1"><h2>Aún no hay más vendidos</h2><p>Aparecerán aquí cuando hagas tus primeras ventas.</p></div>` : `<div class="empty" style="grid-column:1/-1"><h2>Sin resultados</h2><p>Prueba con otro nombre o código, o usa «+ Monto» para cobrar un importe suelto.</p></div>`; return; }
  el.innerHTML = list.map((p) => {
    const inC = DB.cart.items.find((i) => i.id === p.id), kg = p.unit === "kg", u = kg ? " kg" : "";
    const stT = p.stock == null ? "" : p.stock <= 0 ? "Sin stock" : p.stock <= (p.min || 0) ? `Quedan ${fmtQ(p.stock)}${u}` : `Stock ${fmtQ(p.stock)}${u}`;
    const cls = p.stock != null && p.stock <= 0 ? "out" : p.stock != null && p.stock <= (p.min || 0) ? "low" : "";
    const meta = stT;
    return `<button class="pt ${inC ? "in" : ""}" data-a="add" data-id="${p.id}"><span class="top"><span class="em" aria-hidden="true">${emojiOf(p)}</span>${p.code && p.code.length <= 5 ? `<span class="cd" title="Código rápido">${esc(p.code)}</span>` : ""}</span><b>${esc(p.name)}</b><span><span class="pr num">${money(p.price)}${kg ? "<em> /kg</em>" : ""}</span>${meta ? `<small class="${cls}">${meta}</small>` : ""}</span>${inC ? `<span class="qty">${fmtQ(inC.qty)}${u}</span>` : ""}</button>`;
  }).join("");
}
function paintTickets() {
  const el = $("#tks"); if (!el) return;
  el.innerHTML = DB.tickets.map((t, i) => `<button class="tk ${i === DB.cur ? "on" : ""}" data-a="tk" data-i="${i}">${esc(t.name || "Ticket " + t.n)}<small class="num">${t.items.length ? money(ticketTotal(t)) + " · " + t.items.length + (t.items.length === 1 ? " ítem" : " ítems") : "vacío"}</small></button>`).join("") +
    `<button class="tk add" data-a="tknew">+ Nuevo<small>F4</small></button>`;
}
function paintCart() {
  const el = $("#cart"); if (!el) return;
  const lines = cartLines(), t = cartTotals();
  if (!lines.length) document.body.classList.remove("cart-open");
  if (!lines.some((x) => x.l.id === ui.sel)) ui.sel = lines.length ? lines[lines.length - 1].l.id : null;
  el.innerHTML = `<div class="cart-in">
    <div class="cart-h"><h2>${esc(DB.cart.name || "Ticket " + DB.cart.n)}</h2><div class="row"><button class="link" data-a="tkname">Nombre</button>${lines.length || DB.tickets.length > 1 ? `<button class="link" data-a="clear">${DB.tickets.length > 1 ? "Quitar" : "Vaciar"}</button>` : ""}<button class="cart-x" data-a="closecart" aria-label="Cerrar ticket">✕</button></div></div>
    <div class="tks" id="tks"></div>
    <div class="lines">${lines.length ? `<div class="lh" aria-hidden="true"><span>Cant.</span><span>Producto</span><span>P. unit.</span><span>Importe</span><span></span></div>` + lines.map(({ l, r }) => `<div class="ln ${ui.sel === l.id ? "sel" : ""}" data-a="sel" data-id="${l.id}">
        <span class="qc step"><button class="sb" data-a="dec" data-id="${l.id}" aria-label="Quitar uno">−</button><button class="qv num" data-a="qedit" data-id="${l.id}" aria-label="Cambiar cantidad">${fmtQ(l.qty)}${unitTxt(r)}</button><button class="sb" data-a="inc" data-id="${l.id}" aria-label="Agregar uno">+</button></span>
        <span class="nm"><b>${esc(r.name)}</b>${r.code ? `<small>Cód. ${esc(r.code)}</small>` : ""}</span>
        <span class="pu num">${money(r.price)}${r.unit === "kg" ? "<small>/kg</small>" : ""}</span>
        <span class="amt num">${money(r2(r.price * l.qty))}</span>
        <button class="rm" data-a="rmline" data-id="${l.id}" aria-label="Quitar ${esc(r.name)}">✕</button></div>`).join("") : `<div class="cart-empty">Escribe un código o toca un producto para agregarlo.</div>`}</div>
    <div class="tot">
      ${lines.length ? `<div class="disc"><label for="disc">Descuento (S/)</label><input class="inp num" id="disc" data-in="disc" inputmode="decimal" placeholder="0.00" value="${DB.cart.disc ? DB.cart.disc : ""}"></div>
      <div class="r"><span>Subtotal</span><span class="num">${money(t.sub)}</span></div>` : ""}
      <div class="bigtot"><span>${t.count} ${t.count === 1 ? "producto" : "productos"}${t.disc ? ` · descuento ${money(t.disc)}` : ""}</span><b class="num" id="cartTotal">${money(t.total)}</b></div>
      <div class="paygrid">${[["efectivo", "F2"], ["yape", "F8"], ["tarjeta", "F9"], ["plin", "F10"]].map(([m, k]) => `<button class="pay ${m}" data-a="pay" data-m="${m}" ${lines.length ? "" : "disabled"}>${METHODS[m]}<span class="kbd">${k}</span></button>`).join("")}<button class="pay split" data-a="split" ${lines.length ? "" : "disabled"}>Dividir pago<span class="kbd">F7</span></button></div>
    </div></div>`;
  paintTickets();
  const sel = $(".ln.sel"); if (sel) sel.scrollIntoView({ block: "nearest" });
  const bar = $("#cartbar");
  if (bar) { bar.hidden = !lines.length; bar.innerHTML = `<span>${t.count} ${t.count === 1 ? "producto" : "productos"}</span><span class="num">Ver ticket · ${money(t.total)}</span>`; }
}

/* cobro */
const FK = { efectivo: "F2", yape: "F8", tarjeta: "F9", plin: "F10" };
function openPay(method, split) {
  const t = cartTotals(); if (!cartLines().length) { toast("Agrega productos al ticket"); return; }
  ui.pay = { method: METHODS[method] ? method : "efectivo", recv: "", split: !!split, parts: [] };
  document.body.classList.remove("cart-open");
  paintPay(t.total);
}
// Cálculo del pago dividido: lo que entrega el cliente en efectivo puede pasar del total (hay vuelto); Yape, Plin y tarjeta no.
function splitCalc(total) {
  const parts = ui.pay.parts;
  const cashGiven = r2(parts.filter((x) => x.m === "efectivo").reduce((a, x) => a + x.amt, 0));
  const nonCash = r2(parts.filter((x) => x.m !== "efectivo").reduce((a, x) => a + x.amt, 0));
  const rem = r2(total - cashGiven - nonCash);
  const change = rem < 0 ? -rem : 0;
  const ok = parts.length > 0 && rem <= 0 && nonCash <= total && change <= cashGiven;
  const acc = {};
  parts.forEach((x) => { acc[x.m] = r2((acc[x.m] || 0) + x.amt); });
  if (acc.efectivo != null) acc.efectivo = r2(acc.efectivo - change);
  return { ok, rem, change, cashGiven, nonCash, pays: Object.entries(acc).map(([m, amt]) => ({ m, amt })) };
}
function payTo(method) {
  const n = method === "yape" ? DB.yapeNum : method === "plin" ? DB.plinNum : "";
  if (!n) return `<p class="muted" style="margin-bottom:14px">Confirma cuando veas el pago en tu ${esc(METHODS[method])}. <button class="link" data-a="gosettings" style="min-height:32px;padding:0 4px">Guardar mi número</button></p>`;
  return `<div class="payto ${method}"><span>Que el cliente ${method === "yape" ? "yapee" : "plinee"} al</span><b class="num">${fmtPhone(n)}</b>${DB.payName ? `<small>${esc(DB.payName)}</small>` : ""}</div>`;
}
function paintPay(total) {
  const p = ui.pay;
  if (p.split) return paintSplit(total);
  openModal(`<h2>Cobrar</h2><div class="paytot"><span class="muted">Total a pagar</span><b class="num">${money(total)}</b></div>
    <div class="methods">${Object.entries(METHODS).map(([k, n]) => `<button class="mth ${p.method === k ? "on" : ""}" data-a="method" data-m="${k}">${n}<span class="kbd">${KEYS[k]}</span></button>`).join("")}</div>
    ${p.method === "efectivo" ? `<label class="fld"><span>Cliente paga con</span><input class="inp num" id="recv" data-in="recv" inputmode="decimal" placeholder="${r2(total).toFixed(2)} (exacto)" value="${esc(p.recv)}" ${DESK() ? "autofocus" : ""}></label>
      <div class="quick">${[10, 20, 50, 100, 200].filter((n) => n >= total).slice(0, 4).map((n) => `<button class="chip" data-a="recv" data-v="${n}">${n}</button>`).join("")}<button class="chip" data-a="recv" data-v="${r2(total)}">Exacto</button></div>
      <div class="vuelto" id="vuelto"><span>Vuelto</span><b class="num">S/ 0.00</b></div>` : payTo(p.method)}
    <button class="link splitlink" data-a="split">Dividir el pago entre varios medios <span class="kbd">F7</span></button>
    <div class="btns h"><button class="btn sec" data-a="close">Volver</button><button class="btn" id="payok" data-a="payok">Confirmar cobro</button></div>`);
  updPay();
}
function paintSplit(total) {
  const p = ui.pay, r = splitCalc(total), falta = Math.max(0, r.rem);
  let st;
  if (r.rem > 0) st = `<span>Falta</span><b class="num">${money(r.rem)}</b>`;
  else if (r.nonCash > total) st = `<span>Yape, Plin y tarjeta no pueden pasar el total</span><b></b>`;
  else if (r.change > 0) st = `<span>Vuelto</span><b class="num">${money(r.change)}</b>`;
  else st = `<span>Pago completo</span><b>✓</b>`;
  const bad = r.rem > 0 || r.nonCash > total || (r.change > r.cashGiven);
  openModal(`<h2>Dividir pago</h2><div class="paytot"><span class="muted">Total a pagar</span><b class="num">${money(total)}</b></div>
    <div class="parts">${p.parts.length ? p.parts.map((x, i) => `<div class="part"><span>${METHODS[x.m]}</span><b class="num">${money(x.amt)}</b><button class="x" data-a="partdel" data-i="${i}" aria-label="Quitar este pago">✕</button></div>`).join("") : `<p class="muted">Agrega cuánto paga con cada medio. Ej: S/ 10 en efectivo y el resto con Yape.</p>`}</div>
    <div class="vuelto ${bad ? "bad" : ""}" id="splitst">${st}</div>
    <label class="fld"><span>Monto de esta parte (vacío = lo que falta)</span><input class="inp num" id="pamt" inputmode="decimal" placeholder="${falta > 0 ? r2(falta).toFixed(2) : "0.00"}" ${DESK() ? "autofocus" : ""}></label>
    <div class="methods">${["efectivo", "yape", "tarjeta", "plin"].map((m) => `<button class="mth" data-a="partadd" data-m="${m}">+ ${METHODS[m]}<span class="kbd">${FK[m]}</span></button>`).join("")}</div>
    ${p.parts.some((x) => x.m === "yape" || x.m === "plin") && (DB.yapeNum || DB.plinNum) ? `<p class="muted" style="margin-bottom:10px">${p.parts.some((x) => x.m === "yape") && DB.yapeNum ? "Yape: <b>" + fmtPhone(DB.yapeNum) + "</b>" : ""}${p.parts.some((x) => x.m === "plin") && DB.plinNum ? " Plin: <b>" + fmtPhone(DB.plinNum) + "</b>" : ""}</p>` : ""}
    <div class="btns h"><button class="btn sec" data-a="split">Pago único</button><button class="btn" id="payok" data-a="payok" ${r.ok ? "" : "disabled"}>Confirmar cobro</button></div>`);
}
function updPay() {
  const p = ui.pay, total = cartTotals().total;
  if (!p || p.split || p.method !== "efectivo") return;
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

/* cantidad / peso */
function openQty(id, mode) {
  const l = DB.cart.items.find((i) => i.id === id), r = resolveLine(l || { id }); if (!r) return;
  if (mode === "add" && r.stock != null && r.stock <= 0) { toast("Sin stock: " + r.name); beep(false); return; }
  const kg = r.unit === "kg";
  ui.qty = { id, mode, price: r.price, kg, name: r.name, have: l ? l.qty : 0 };
  openModal(`<h2>${esc(r.name)}</h2><p class="muted" style="margin-bottom:12px">${money(r.price)} ${kg ? "por kilo" : "por unidad"}${mode === "add" && l ? ` · ya lleva ${fmtQ(l.qty)}${kg ? " kg" : ""}` : ""}</p>
    ${kg ? `<div class="quick">${[[0.25, "¼ kg"], [0.5, "½ kg"], [0.75, "¾ kg"], [1, "1 kg"], [1.5, "1½ kg"], [2, "2 kg"]].map(([v, n]) => `<button class="chip" data-a="qset" data-v="${v}">${n}</button>`).join("")}</div>` : ""}
    <label class="fld"><span>${kg ? "Peso (kg)" : "Cantidad"}</span><input class="inp num" id="qv" inputmode="decimal" value="${mode === "set" && l ? fmtQ(l.qty) : ""}" placeholder="${kg ? "0.250 o 1/4" : "1"}" autofocus></label>
    ${kg ? `<label class="fld"><span>o por monto (S/)</span><input class="inp num" id="qm" inputmode="decimal" placeholder="Ej: 2.00"></label>` : ""}
    <div class="vuelto" id="qprev"></div>
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" data-a="qok">${mode === "add" ? "Agregar" : "Guardar"}</button></div>`);
  updQty();
}
const qtyVal = () => r3(parseQty(($("#qv") || { value: "" }).value));
function updQty() {
  const q = ui.qty, v = qtyVal(), el = $("#qprev"); if (!el || !q) return;
  el.innerHTML = `<span>${fmtQ(v)}${q.kg ? " kg" : ""} × ${money(q.price)}</span><b class="num">${money(r2(v * q.price))}</b>`;
}
function submitCode(raw) {
  raw = raw.trim(); if (!raw) return;
  let qty = null, code = raw;
  const m = raw.match(/^([\d.,\/]+\s*(?:k?g|gr)?)\s*[*xX]\s*(.+)$/i);
  if (m) { qty = r3(parseQty(m[1])); code = m[2].trim(); if (!(qty > 0)) { toast("Cantidad no válida"); beep(false); return; } }
  let p = DB.products.find((x) => x.code && x.code === code);
  if (!p) { const k = norm(code), list = DB.products.filter((x) => norm(x.name).includes(k)); if (list.length === 1) p = list[0]; else if (list.length > 1) { toast("Hay varios productos así: toca el que quieras"); return; } }
  if (!p) { toast("No encontré «" + code + "»"); beep(false); return; }
  ui.q = ""; const qi = $("#q"); if (qi) qi.value = "";
  if (qty == null) { if (p.unit === "kg") openQty(p.id, "add"); else addToCart(p, 1); }
  else addToCart(p, qty);
  paintGrid();
}

/* ---------- PRODUCTOS ---------- */
function viewProducts(v) {
  const low = DB.products.filter((p) => p.stock != null && p.stock <= (p.min || 0));
  const val = r2(DB.products.reduce((a, p) => a + (p.stock || 0) * (p.cost || 0), 0));
  v.innerHTML = `<div class="ph"><h1>Productos</h1><div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sec sm" data-a="impopen">Importar</button><button class="btn sec sm" data-a="expprod">Exportar</button><button class="btn" data-a="pnew">+ Nuevo</button></div></div>
    <div class="sumrow"><div class="sum"><b>${DB.products.length}</b><span>Productos</span></div><button class="sum lowbtn ${low.length ? "warn" : ""}" data-a="lowlist"><b>${low.length}</b><span>Stock bajo · ver lista</span></button><div class="sum"><b class="num">${money(val)}</b><span>Valor al costo</span></div></div>
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
    const kgp = p.unit === "kg"; const tag = p.stock == null ? "" : p.stock <= 0 ? `<span class="tag out">Sin stock</span>` : p.stock <= (p.min || 0) ? `<span class="tag low">Stock bajo</span>` : "";
    return `<button class="it" data-a="pedit" data-id="${p.id}"><div class="t"><b>${esc(p.name)}</b><small>${esc(p.cat || "Sin categoría")}${p.code ? " · Cód. " + esc(p.code) : ""}${kgp ? " · Por kilo" : ""}</small> ${tag}</div><div class="v num">${money(p.price)}${kgp ? " /kg" : ""}<small>${p.stock == null ? "Sin control" : fmtQ(p.stock) + (kgp ? " kg" : "") + " en stock"}</small></div></button>`;
  }).join("") || `<div class="empty"><p>Nada coincide con tu búsqueda.</p></div>`;
}
function openProduct(id) {
  const p = id ? prod(id) : { name: "", price: "", cost: "", stock: "", min: 5, cat: ui.cat || "", code: "", unit: "u" };
  const cats = [...new Set(DB.products.map((x) => x.cat).filter(Boolean))];
  openModal(`<h2>${id ? "Editar producto" : "Nuevo producto"}</h2>
    <label class="fld"><span>Nombre</span><input class="inp" data-f="name" value="${esc(p.name)}" ${id ? "" : "autofocus"} autocomplete="off"></label>
    <label class="fld"><span>Se vende</span><select class="inp" data-f="unit"><option value="u" ${p.unit !== "kg" ? "selected" : ""}>Por unidad</option><option value="kg" ${p.unit === "kg" ? "selected" : ""}>Por kilo (se pesa)</option></select></label>
    <div class="two"><label class="fld"><span>Precio (S/ por unidad o kilo)</span><input class="inp num" data-f="price" inputmode="decimal" value="${esc(p.price)}"></label>
    <label class="fld"><span>Costo (S/)</span><input class="inp num" data-f="cost" inputmode="decimal" value="${esc(p.cost)}" placeholder="Opcional"></label></div>
    <div class="two"><label class="fld"><span>Stock actual (unid. o kg)</span><input class="inp num" data-f="stock" inputmode="decimal" value="${p.stock == null ? "" : esc(p.stock)}" placeholder="Vacío = sin control"></label>
    <label class="fld"><span>Avisar si baja de</span><input class="inp num" data-f="min" inputmode="numeric" value="${esc(p.min)}"></label></div>
    <div class="two"><label class="fld"><span>Categoría</span><input class="inp" data-f="cat" list="catlist" value="${esc(p.cat)}" placeholder="Bebidas, Abarrotes..."><datalist id="catlist">${cats.map((c) => `<option value="${esc(c)}">`).join("")}</datalist></label>
    <label class="fld"><span>Código rápido o de barras</span><input class="inp" data-f="code" value="${esc(p.code)}" placeholder="Ej: ${nextCode()}" inputmode="numeric"></label></div>
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" data-enter data-a="psave" data-id="${id || ""}">Guardar</button></div>
    ${id ? `<div class="btns h"><button class="btn sec" data-a="restock" data-id="${id}">Ingreso de mercadería</button><button class="btn red sec" data-a="pdel" data-id="${id}">Eliminar</button></div>` : ""}`);
}
function saveProduct(id) {
  const f = (n) => $(`[data-f="${n}"]`).value.trim();
  const name = f("name"), price = num(f("price"));
  if (!name) return toast("Escribe el nombre del producto");
  if (!(price > 0)) return toast("Pon un precio mayor a 0");
  const code = f("code");
  if (code && DB.products.some((p) => p.code === code && p.id !== id)) return toast("Ese código ya lo usa otro producto");
  const data = { name, price: r2(price), cost: r2(num(f("cost"))), stock: f("stock") === "" ? null : r3(num(f("stock"))), min: Math.max(0, r3(num(f("min")))), cat: f("cat"), code, unit: f("unit") === "kg" ? "kg" : "u" };
  if (id) Object.assign(prod(id), data); else DB.products.push({ id: uid(), ...data });
  save(); closeModal(); toast("Producto guardado"); render();
}

/* ---------- importar, exportar e ingreso de mercadería ---------- */
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
  const lines = String(text).replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  const res = { rows: [], errs: [], news: 0, upd: 0 };
  if (!lines.length) return res;
  const d = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
  const numv = (v) => { const n = parseFloat(String(v).replace(/[^\d.,-]/g, "").replace(",", ".")); return isFinite(n) ? n : NaN; };
  const f0 = splitRow(lines[0], d);
  const start = f0.length > 1 && isNaN(numv(f0[1])) ? 1 : 0; // primera fila = encabezado
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
    <textarea class="inp" id="imp" rows="7" placeholder="Tomate&#9;4.50&#9;3&#9;30&#9;Verduras&#9;1&#9;kg&#10;Inca Kola 500 ml&#9;3&#9;2.2&#9;24&#9;Bebidas&#9;7750001&#9;u" autofocus></textarea>
    <div class="row" style="gap:10px;margin:8px 0;flex-wrap:wrap"><label class="btn sec sm" style="cursor:pointer">Elegir archivo CSV<input type="file" accept=".csv,.txt,text/csv,text/plain" data-in="impfile" hidden></label><button class="link" data-a="tpl">Descargar plantilla</button></div>
    <p class="muted" id="impsum" style="min-height:1.4em">Si un producto ya existe (mismo código o nombre) se actualizan su precio, costo y stock.</p>
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" id="impok" data-a="impok" disabled>Importar</button></div>`);
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
    if (x.ex) { Object.assign(x.ex, { name: x.name, price: x.price, unit: x.unit }); if (x.cost != null) x.ex.cost = x.cost; if (x.stock != null) x.ex.stock = x.stock; if (x.cat) x.ex.cat = x.cat; if (x.code) x.ex.code = x.code; }
    else DB.products.push({ id: uid(), name: x.name, price: x.price, cost: x.cost || 0, stock: x.stock, min: x.stock == null ? 0 : x.unit === "kg" ? 3 : 5, cat: x.cat, code: x.code, unit: x.unit });
  });
  save(); closeModal(); toast(`Importados: ${r.news} nuevos, ${r.upd} actualizados`); render();
}
function csvOut(rows, name) {
  download(name, "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n"), "text/csv;charset=utf-8");
}
function exportProducts() {
  csvOut([["nombre", "precio", "costo", "stock", "categoria", "codigo", "unidad"], ...DB.products.map((p) => [p.name, p.price, p.cost || 0, p.stock == null ? "" : p.stock, p.cat || "", p.code || "", p.unit === "kg" ? "kg" : "u"])], `inventario-${dkey()}.csv`);
}
function lowItems() { return DB.products.filter((p) => p.stock != null && p.stock <= (p.min || 0)).sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name, "es")); }
function suggest(p) { const n = Math.ceil(Math.max((p.min || 0) * 2 - p.stock, p.min || 1)); return n; }
function openLow() {
  const l = lowItems();
  openModal(`<h2>Lista de reposición</h2>${l.length ? `<p class="muted" style="margin-bottom:10px">Productos que llegaron a su mínimo. «Pedir» es una sugerencia.</p><div class="list">${l.map((p) => `<div class="it"><div class="t"><b>${esc(p.name)}</b><small>Quedan ${fmtQ(p.stock)}${p.unit === "kg" ? " kg" : ""} · mínimo ${fmtQ(p.min || 0)} · pedir ${suggest(p)}${p.unit === "kg" ? " kg" : ""}</small></div><button class="btn sm" data-a="restock" data-id="${p.id}" data-back="1">Ingreso</button></div>`).join("")}</div>` : `<p class="muted">Todo en orden: ningún producto está por debajo de su mínimo.</p>`}
    <div class="btns h"><button class="btn sec" data-a="close">Cerrar</button>${l.length ? `<button class="btn" data-a="lowwa">Enviar por WhatsApp</button>` : ""}</div>`);
}
function openRestock(id, back) {
  const p = prod(id); if (!p) return; const kg = p.unit === "kg";
  ui.rs = { id, back: !!back, kg };
  openModal(`<h2>Ingreso de mercadería</h2><p class="muted" style="margin-bottom:12px"><b>${esc(p.name)}</b> · ahora ${p.stock == null ? "sin control de stock" : fmtQ(p.stock) + (kg ? " kg" : "")}</p>
    <label class="fld"><span>Llegaron (${kg ? "kg" : "unidades"})</span><input class="inp num" id="rsq" inputmode="decimal" placeholder="${kg ? "Ej: 20 o 1/2" : "Ej: 24"}" autofocus></label>
    <label class="fld"><span>Nuevo costo (S/ por ${kg ? "kilo" : "unidad"}, opcional)</span><input class="inp num" id="rsc" inputmode="decimal" placeholder="${p.cost || "0.00"}"></label>
    <div class="vuelto" id="rsprev"><span>Quedará en stock</span><b class="num">${fmtQ(p.stock || 0)}${kg ? " kg" : ""}</b></div>
    <div class="btns h"><button class="btn sec" data-a="${back ? "lowlist" : "close"}">Volver</button><button class="btn" data-enter data-a="restockok">Guardar ingreso</button></div>`);
}
function updRestock() {
  const r = ui.rs, p = r && prod(r.id), el = $("#rsprev"); if (!p || !el) return;
  const q = r3(parseQty(($("#rsq") || { value: "" }).value));
  el.innerHTML = `<span>Quedará en stock</span><b class="num">${fmtQ(r3((p.stock || 0) + (q > 0 ? q : 0)))}${r.kg ? " kg" : ""}</b>`;
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
  const byM = { efectivo: 0, yape: man, plin: 0, tarjeta: 0 }; sales.forEach((s) => paysOf(s).forEach((p) => { byM[p.m] = r2(byM[p.m] + p.amt); }));
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
    <div class="card"><h2>Ventas</h2>${sales.length ? `<div class="list">${sales.slice(0, 60).map((s) => `<button class="it" data-a="sale" data-id="${s.id}"><div class="t"><b>Ticket ${ticketNo(s)}</b><small>${keys.length > 1 ? pk(s.date).toLocaleDateString("es-PE", { day: "numeric", month: "short" }) + " · " : ""}${hhmm(s.t)} · ${esc(methodLabel(s))} · ${s.items.length} ${s.items.length === 1 ? "ítem" : "ítems"}</small></div><div class="v num">${money(s.total)}</div></button>`).join("")}</div>${sales.length > 60 ? `<p class="muted" style="margin-top:8px">Mostrando las 60 más recientes. El CSV trae todas.</p>` : ""}` : `<p class="muted">No hay ventas en este periodo.</p>`}</div>
    </div>`;
}
function exportCsv() {
  const set = new Set(rangeKeys(ui.range));
  const rows = [["fecha", "hora", "ticket", "metodo", "producto", "cantidad", "precio", "subtotal", "total_ticket", "estado"]];
  DB.sales.filter((s) => set.has(s.date)).sort((a, b) => a.t - b.t).forEach((s) => s.items.forEach((i) => rows.push([s.date, hhmm(s.t), s.id, methodLabel(s), i.name, i.qty, i.price, r2(i.price * i.qty), s.total, s.void ? "anulada" : "ok"])));
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
    <div class="card"><h2>Cobros con Yape y Plin</h2><p class="muted" style="margin-bottom:10px">Tu número aparece en la pantalla de cobro para que el cliente yapee sin preguntar.</p>
      <div class="two"><label class="fld"><span>Número de Yape</span><input class="inp num" data-in="yapeNum" inputmode="tel" value="${esc(DB.yapeNum || "")}" placeholder="987 654 321"></label>
      <label class="fld"><span>Número de Plin</span><input class="inp num" data-in="plinNum" inputmode="tel" value="${esc(DB.plinNum || "")}" placeholder="Opcional"></label></div>
      <label class="fld"><span>Nombre que le aparece al cliente</span><input class="inp" data-in="payName" maxlength="40" value="${esc(DB.payName || "")}" placeholder="Ej: Minimarket Los Andes"></label></div>
    <div class="card"><h2>Seguridad</h2>
      <div class="set"><div><b>PIN de 4 dígitos</b><small>${DB.pin ? "Activado. Se pide al abrir la app." : "Desactivado."}</small></div><button class="btn sec sm" data-a="pin">${DB.pin ? "Cambiar" : "Activar"}</button></div>
      ${DB.pin ? `<div class="set"><div><b>Quitar PIN</b></div><button class="btn red sec sm" data-a="pinoff">Quitar</button></div>` : ""}
      <div class="set"><div><b>Sonidos</b><small>Pitido al agregar y cobrar</small></div><button class="switch" data-a="mute" aria-pressed="${!DB.mute}" aria-label="Sonidos"></button></div></div>
    <div class="card"><h2>Respaldo de datos</h2><p class="muted" style="margin-bottom:10px">Tus datos viven solo en este dispositivo. Guarda un respaldo seguido y úsalo para pasar la información a otra computadora o teléfono.<br><b>${DB.lastBackup ? "Último respaldo: " + new Date(DB.lastBackup).toLocaleDateString("es-PE") : "Aún no descargas ningún respaldo."}</b></p>
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
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (DB.pin && !ui.locked && hiddenAt && Date.now() - hiddenAt > 120000) lockApp();
});

/* ---------- acciones ---------- */
const A = {
  tab: (el) => go(el.dataset.t),
  add: (el) => { const p = prod(el.dataset.id); if (!p) return; if (p.unit === "kg") openQty(p.id, "add"); else addToCart(p); },
  inc: (el) => changeQty(el.dataset.id, 1),
  dec: (el) => changeQty(el.dataset.id, -1),
  clear: () => confirmBox(DB.tickets.length > 1 ? "¿Quitar este ticket?" : "¿Vaciar el ticket?", DB.tickets.length > 1 ? "Quitar" : "Vaciar", () => { dropCurrentTicket(); save(); paintSale(); focusQ(); }),
  qedit: (el) => openQty(el.dataset.id, "set"),
  qset: (el) => { const v = $("#qv"); if (!v) return; v.value = el.dataset.v; const m = $("#qm"); if (m) m.value = ""; updQty(); v.focus(); },
  qok: () => {
    const q = ui.qty; if (!q || !$("#qv")) return; const v = qtyVal();
    if (q.mode === "add" && !(v > 0)) return toast("Escribe el peso o la cantidad");
    if (applyQty(q.id, q.mode === "add" ? r3(q.have + v) : v)) closeModal();
  },
  tknew: () => {
    if (!DB.cart.items.length) { toast("Este ticket ya está vacío: úsalo"); return; }
    DB.tickets.push({ n: ++DB.tseq, name: "", items: [], disc: 0 }); DB.cur = DB.tickets.length - 1; save(); paintSale(); focusQ(); toast("Ticket nuevo. El anterior quedó en espera");
  },
  tk: (el) => { const i = +el.dataset.i; if (i === DB.cur) return; DB.cur = i; save(); paintSale(); focusQ(); },
  tkname: () => { openModal(`<h2>Nombre del ticket</h2><p class="muted" style="margin-bottom:12px">Ayuda a reconocerlo cuando hay varios en espera. Ej: señora de azul.</p><label class="fld"><span>Nombre</span><input class="inp" id="tkn" maxlength="24" value="${esc(DB.cart.name)}" autofocus></label><div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" data-a="tknameok">Guardar</button></div>`); },
  tknameok: () => { DB.cart.name = $("#tkn").value.trim(); save(); closeModal(); paintSale(); },
  cat: (el) => { ui.cat = el.dataset.c; paintCats(); paintGrid(); focusQ(); },
  opencart: () => document.body.classList.add("cart-open"),
  closecart: () => document.body.classList.remove("cart-open"),
  pay: (el) => openPay(el.dataset.m),
  method: (el) => { ui.pay.method = el.dataset.m; paintPay(cartTotals().total); },
  recv: (el) => { ui.pay.recv = el.dataset.v; const i = $("#recv"); if (i) { i.value = ui.pay.recv; i.focus(); } updPay(); },
  payok: () => {
    const t = cartTotals(); if (!cartLines().length) return closeModal();
    const p = ui.pay; if (!p) return;
    let pays, given;
    if (p.split) { const r = splitCalc(t.total); if (!r.ok) return; pays = r.pays; given = r.cashGiven; }
    else {
      const recv = p.method === "efectivo" ? (p.recv === "" ? t.total : num(p.recv)) : t.total;
      if (p.method === "efectivo" && recv < t.total) return;
      pays = [{ m: p.method, amt: t.total }]; given = recv;
    }
    const s = finalizeSale(pays, given); beep(true); document.body.classList.remove("cart-open"); showReceipt(s, true); paintSale();
  },
  split: () => {
    if (ui.pay && !$("#modal").hidden && $("#payok")) { ui.pay.split = !ui.pay.split; ui.pay.parts = []; paintPay(cartTotals().total); }
    else openPay("efectivo", true);
  },
  partadd: (el) => {
    const p = ui.pay; if (!p || !p.split) return;
    const total = cartTotals().total, r = splitCalc(total), m = el.dataset.m, falta = Math.max(0, r.rem);
    const raw = ($("#pamt") || { value: "" }).value.trim(), a = r2(raw === "" ? falta : num(raw));
    if (!(a > 0)) { toast(falta <= 0 ? "El total ya está cubierto" : "Escribe un monto"); return; }
    if (m !== "efectivo" && a > falta + 0.001) { toast(`${METHODS[m]} no puede pasar de lo que falta (${money(falta)})`); beep(false); return; }
    p.parts.push({ m, amt: a }); paintPay(total);
  },
  partdel: (el) => { ui.pay.parts.splice(+el.dataset.i, 1); paintPay(cartTotals().total); },
  gosettings: () => { closeModal(); go("aj"); },
  sel: (el) => { ui.sel = el.dataset.id; $$(".ln").forEach((x) => x.classList.toggle("sel", x.dataset.id === ui.sel)); },
  rmline: (el) => { DB.cart.items = DB.cart.items.filter((i) => i.id !== el.dataset.id); save(); beep(true); paintSale(); focusQ(); },
  rmsel: () => { if (ui.sel && DB.cart.items.some((i) => i.id === ui.sel)) A.rmline({ dataset: { id: ui.sel } }); else toast("Elige una línea del ticket"); },
  qeditsel: () => { if (ui.sel && DB.cart.items.some((i) => i.id === ui.sel)) openQty(ui.sel, "set"); else toast("Elige una línea del ticket"); },
  focusq: () => { const q = $("#q"); if (q) { q.focus(); q.select(); } },
  impopen: openImport,
  impok: applyImport,
  tpl: () => csvOut([["nombre", "precio", "costo", "stock", "categoria", "codigo", "unidad"], ["Tomate", "4.50", "3", "30", "Verduras", "1", "kg"], ["Lechuga", "2.50", "1.5", "20", "Verduras", "2", "u"], ["Inca Kola 500 ml", "3", "2.2", "24", "Bebidas", "7750001", "u"]], "plantilla-productos.csv"),
  expprod: () => { if (!DB.products.length) return toast("Aún no hay productos para exportar"); exportProducts(); },
  lowlist: openLow,
  lowwa: () => { const l = lowItems(); window.open("https://wa.me/?text=" + encodeURIComponent(`*Lista de pedido - ${DB.biz}*\n` + l.map((p) => `- ${p.name}: pedir ${suggest(p)}${p.unit === "kg" ? " kg" : ""} (quedan ${fmtQ(p.stock)})`).join("\n")), "_blank", "noopener"); },
  restock: (el) => openRestock(el.dataset.id, el.dataset.back === "1"),
  restockok: () => {
    const r = ui.rs, p = r && prod(r.id); if (!p) return;
    const q = r3(parseQty($("#rsq").value)); if (!(q > 0)) return toast("Escribe cuánto llegó");
    p.stock = r3((p.stock || 0) + q);
    const c = num($("#rsc").value); if (c > 0) p.cost = r2(c);
    save(); toast(`Stock de ${p.name}: ${fmtQ(p.stock)}${r.kg ? " kg" : ""}`); render();
    if (r.back) openLow(); else closeModal();
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
  backup: () => { DB.lastBackup = Date.now(); save(); download(`respaldo-caja-facil-${dkey()}.json`, JSON.stringify(DB), "application/json"); toast("Respaldo descargado"); render(); },
  reset: () => confirmBox("¿Borrar TODOS los datos? Esto no se puede deshacer.", "Borrar todo", () => { DB = wire(blank()); save(); toast("Datos borrados"); go("venta"); }),
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
  else if (t.id === "imp") updImport();
  else if (t.id === "rsq") updRestock();
  else if (t.id === "qv") { const m = $("#qm"); if (m) m.value = ""; updQty(); }
  else if (t.id === "qm") { const a = num(t.value); $("#qv").value = a > 0 && ui.qty.price > 0 ? fmtQ(r3(a / ui.qty.price)) : ""; updQty(); }
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
  else if (k === "yapeNum" || k === "plinNum" || k === "payName") { DB[k] = t.value.trim(); save(); toast("Guardado"); }
  else if (k === "impfile") {
    const f = t.files[0]; if (!f) return;
    const put = (txt) => { const el = $("#imp"); if (el) { el.value = txt; updImport(); } };
    const rd = new FileReader();
    rd.onload = () => { const txt = String(rd.result); if (txt.includes("\uFFFD")) { const r2d = new FileReader(); r2d.onload = () => put(String(r2d.result)); r2d.readAsText(f, "windows-1252"); } else put(txt); };
    rd.readAsText(f); t.value = "";
  }
  else if (k === "biz") { DB.biz = t.value.trim() || "Mi negocio"; save(); paintNav(); toast("Nombre guardado"); }
  else if (k === "restore") {
    const f = t.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const o = JSON.parse(rd.result);
        if (!o || !Array.isArray(o.products) || !Array.isArray(o.sales)) throw 0;
        confirmBox("¿Restaurar este respaldo? Reemplaza los datos actuales.", "Restaurar", () => { DB = wire(Object.assign(blank(), o)); save(); toast("Respaldo restaurado"); go("venta"); }, false);
      } catch (err) { toast("Ese archivo no es un respaldo válido"); }
    };
    rd.readAsText(f); t.value = "";
  }
}
// Teclado: lector de códigos (teclea el código y Enter) y atajos para PC.
function moveSel(d) {
  const ids = cartLines().map((x) => x.l.id); if (!ids.length) return;
  let i = ids.indexOf(ui.sel); i = i < 0 ? ids.length - 1 : Math.min(ids.length - 1, Math.max(0, i + d));
  ui.sel = ids[i]; $$(".ln").forEach((x) => x.classList.toggle("sel", x.dataset.id === ui.sel));
  const s = $(".ln.sel"); if (s) s.scrollIntoView({ block: "nearest" });
}
document.addEventListener("keydown", (e) => {
  if (ui.locked) { if (/^\d$/.test(e.key)) pinKey(e.key); else if (e.key === "Backspace") pinKey("del"); return; }
  const open = !$("#modal").hidden, field = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName), inQ = e.target.id === "q";
  if (e.key === "Escape" && open) return closeModal();
  const FM = { F2: "efectivo", F8: "yape", F9: "tarjeta", F10: "plin" };
  if (FM[e.key]) {
    e.preventDefault();
    if (open) {
      if (!$("#payok")) return;
      if (ui.pay && ui.pay.split) A.partadd({ dataset: { m: FM[e.key] } });
      else if (e.key === "F2") A.payok();
      else { ui.pay.method = FM[e.key]; paintPay(cartTotals().total); }
    } else if (ui.tab === "venta") openPay(FM[e.key]);
    return;
  }
  if (e.key === "F7") { e.preventDefault(); if (ui.tab === "venta" || $("#payok")) A.split(); return; }
  if (e.key === "F4") { e.preventDefault(); if (!open && ui.tab === "venta") A.tknew(); return; }
  if (e.key === "F6") { e.preventDefault(); if (!open && ui.tab === "venta") A.qeditsel(); return; }
  if ((e.key === "F3" || (e.key === "/" && !field)) && !open && ui.tab === "venta") { e.preventDefault(); A.focusq(); return; }
  if (!open && ui.tab === "venta") {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); moveSel(e.key === "ArrowDown" ? 1 : -1); return; }
    if (!field || (inQ && !e.target.value)) {
      if (e.key === "+") { e.preventDefault(); if (ui.sel) changeQty(ui.sel, 1); return; }
      if (e.key === "-") { e.preventDefault(); if (ui.sel) changeQty(ui.sel, -1); return; }
      if (e.key === "Delete") { e.preventDefault(); A.rmsel(); return; }
      if (e.key === "*") { e.preventDefault(); A.qeditsel(); return; }
    }
  }
  if (e.key === "Enter") {
    const id = e.target.id;
    if (id === "q" && !open) { e.preventDefault(); submitCode(e.target.value); }
    else if (id === "recv" && $("#payok")) { e.preventDefault(); A.payok(); }
    else if (id === "qv" || id === "qm") { e.preventDefault(); A.qok(); }
    else if (open && e.target.tagName !== "BUTTON" && e.target.tagName !== "TEXTAREA") {
      const b = $("#modal [data-enter]:not(:disabled), #modal #payok:not(:disabled)"); if (b) { e.preventDefault(); b.click(); }
    }
    return;
  }
  if (open && ui.pay && ui.pay.split === false && $("#payok") && !field) {
    const m = { e: "efectivo", y: "yape", p: "plin", t: "tarjeta" }[e.key.toLowerCase()];
    if (m) { ui.pay.method = m; paintPay(cartTotals().total); }
  }
});

/* ---------- inicio ---------- */
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
window.CF = { get DB() { return DB; }, dayTotals, expectedCash, cartTotals, parseAmounts, parseImport, splitCalc, ui, flush, save };
async function boot() {
  let raw = null, ls = null;
  try { ls = localStorage.getItem(KEY); } catch (e) {}
  try { idb = await idbOpen(); raw = await idbGet("db"); } catch (e) { idb = null; }
  let lsOk = false; try { lsOk = !!(ls && JSON.parse(ls)); } catch (e) {}
  const fromLs = lsOk && (!!idb || raw == null); // copia vieja (v1/v2) o guardado que quedó a medias
  if (fromLs) raw = ls;
  DB = fromJSON(raw);
  if (fromLs && idb) { dirty = true; flush(); }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  render();
  if (DB.pin) askPin("Ingresa tu PIN", (p) => { if (pinHash(p) === DB.pin) hideLock(); else pinBad(); });
  if (DB.sales.length && (!DB.lastBackup || Date.now() - DB.lastBackup > 7 * 864e5)) setTimeout(() => toast("Hace días que no descargas un respaldo. Hazlo en Ajustes."), 1800);
  document.body.classList.add("ready");
}
boot();
})();
