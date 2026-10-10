/* Caja Fácil — punto de venta para bodegas, minimarkets y fruterías. Versión 5.
   Todo se guarda en este navegador (IndexedDB). Archivo generado desde src/. */
(() => {
"use strict";
/* ===================== 00 · NÚCLEO: utilidades, datos y guardado ===================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n, l = 2) => String(n).padStart(l, "0");
const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const pk = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d || 1); };
const addD = (k, n) => { const d = pk(k); d.setDate(d.getDate() + n); return dkey(d); };
const r2 = (n) => Math.round((+n || 0) * 100 + Number.EPSILON * 100) / 100;
const r3 = (n) => Math.round((+n || 0) * 1000) / 1000;
const fmtQ = (n) => String(+(+n || 0).toFixed(3));
const money = (n) => "S/ " + r2(n).toFixed(2);
const num = (v) => { const n = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", ".")); return isFinite(n) ? n : 0; };
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const hhmm = (ts) => new Date(ts).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
const dmy = (k) => k.split("-").reverse().join("/");
const fmtDT = (ts) => new Date(ts).toLocaleDateString("es-PE") + " " + hhmm(ts);
const fmtDate = (k) => {
  const t = dkey();
  if (k === t) return "Hoy";
  if (k === addD(t, -1)) return "Ayer";
  return pk(k).toLocaleDateString("es-PE", { weekday: "short", day: "numeric", month: "short" });
};
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const monthName = (m) => { const [y, mm] = m.split("-"); return MONTHS[+mm - 1] + " " + y; };
const parseQty = (v) => {
  v = String(v).trim().toLowerCase().replace(",", ".");
  const grams = /\d\s*(g|gr)$/.test(v);
  v = v.replace(/\s*(kg|gr|g)$/, "");
  let n;
  if (v.includes("/")) { const [a, b] = v.split("/").map(parseFloat); n = b ? a / b : 0; } else n = parseFloat(v);
  n = isFinite(n) ? n : 0;
  return grams ? n / 1000 : n;
};
const fmtPhone = (v) => String(v || "").replace(/\D/g, "").replace(/(\d{3})(?=\d)/g, "$1 ").trim();
const parseAmounts = (s) => String(s).replace(/(\d),(\d{1,2})(?!\d)/g, "$1.$2").split(/[\s;,]+/).map((x) => parseFloat(x)).filter((n) => isFinite(n) && n > 0).map(r2);

const METHODS = { efectivo: "Efectivo", yape: "Yape", plin: "Plin", tarjeta: "Tarjeta", transferencia: "Transferencia", credito: "Crédito", puntos: "Puntos" };
const FK = { efectivo: "F2", yape: "F8", tarjeta: "F9", plin: "F10" };
const DOCS = { NV: "Nota de venta", B: "Boleta", F: "Factura" };
const DENOMS = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1];
const paysOf = (s) => (s.pays && s.pays.length ? s.pays : [{ m: s.method || "efectivo", amt: s.total }]);
const methodLabel = (s) => { const p = paysOf(s); return p.length > 1 ? p.map((x) => `${METHODS[x.m] || x.m} ${money(x.amt)}`).join(" + ") : METHODS[p[0].m] || p[0].m; };
const docNo = (s) => (s.doc ? `${s.doc.s}-${pad(s.doc.n, 8)}` : "#" + pad(s.id, 4));
const docShort = (s) => (s.doc ? `${s.doc.s}-${s.doc.n}` : "#" + s.id);

// Importe en letras para el comprobante: "SON: DIEZ CON 50/100 SOLES"
function letras(n) {
  const U = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE", "VEINTIUNO", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"];
  const D = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
  const C = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];
  const h = (x) => {
    if (!x) return ""; if (x === 100) return "CIEN";
    const c = Math.floor(x / 100), r = x % 100;
    let s = C[c];
    if (r) s += (s ? " " : "") + (r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? " Y " + U[r % 10] : ""));
    return s;
  };
  n = r2(Math.abs(n));
  const ent = Math.floor(n + 1e-9), cent = Math.round((n - ent) * 100);
  const mill = Math.floor(ent / 1e6), mil = Math.floor((ent % 1e6) / 1000), rest = ent % 1000;
  let s = "";
  if (mill) s += mill === 1 ? "UN MILLÓN" : h(mill) + " MILLONES";
  if (mil) s += (s ? " " : "") + (mil === 1 ? "MIL" : h(mil) + " MIL");
  if (rest) s += (s ? " " : "") + h(rest);
  if (!s) s = "CERO";
  s = s.replace(/VEINTIUNO (MIL|MILLONES)/g, "VEINTIÚN $1").replace(/(^| )UNO (MIL|MILLONES)/g, "$1UN $2");
  return `${s} CON ${pad(cent)}/100 SOLES`;
}

// RUC peruano: 11 dígitos con dígito verificador. DNI: 8 dígitos.
function rucOk(r) {
  r = String(r || "").trim();
  if (!/^(10|15|16|17|20)\d{9}$/.test(r)) return false;
  const w = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const s = w.reduce((a, x, i) => a + x * +r[i], 0);
  let d = 11 - (s % 11); if (d === 10) d = 0; else if (d === 11) d = 1;
  return d === +r[10];
}
const dniOk = (d) => /^\d{8}$/.test(String(d || "").trim());

/* ---------- permisos ---------- */
const PERMS = [
  ["cobrar", "Cobrar ventas"], ["descuento", "Hacer descuentos"], ["credito", "Vender al crédito (fiado)"],
  ["anular", "Anular ventas"], ["devolver", "Hacer devoluciones"], ["precios", "Crear y editar productos y precios"],
  ["stock", "Ingresos, ajustes y transferencias de stock"], ["clientes", "Crear y editar clientes"], ["abonos", "Cobrar deudas de clientes"],
  ["caja", "Abrir y cerrar su caja, anotar gastos"], ["cierre", "Cierre del día y de períodos"], ["reportes", "Ver reportes y liquidaciones"],
  ["costos", "Ver costos y ganancias"], ["limite", "Vender pasando el límite de crédito"], ["ajustes", "Ajustes, usuarios y respaldos"]
];
const ROLE_LABEL = { admin: "Administrador", cajero: "Cajero", vendedor: "Vendedor (preventa)" };
const DEF_ROLES = () => ({
  admin: PERMS.map((p) => p[0]),
  cajero: ["cobrar", "descuento", "credito", "clientes", "abonos", "caja"],
  vendedor: ["clientes"]
});
const SENSITIVE = { limite: "Pasar el límite de crédito", anular: "Anular venta", devolver: "Devolución", descuento: "Descuento", cierre: "Cierre", credito: "Venta al crédito", precios: "Editar productos", stock: "Cambiar stock", ajustes: "Ajustes", reportes: "Reportes", caja: "Caja", abonos: "Cobrar deuda", clientes: "Clientes", costos: "Costos", cobrar: "Cobrar" };

/* ---------- modelo de datos ---------- */
const newTicket = (n) => ({ n, name: "", items: [], disc: 0, client: "", doc: "", mesa: 0, prev: 0 });
const defCfg = () => ({
  mute: false, yapeNum: "", plinNum: "", payName: "", igv: 18, igvOn: true, paper: 80, autoPrint: false, tables: 0,
  pts: { on: false, per: 1, val: 0.02, min: 100 }, lock: 3, tile: "m", view: "scan", showImg: true, needShift: false, negStock: false,
  scale: { baud: 9600, cmd: "", unit: "auto", fmt: "8N1" }, labels: { on: true, pre: 2, len: 5, kind: "peso" },
  series: { NV: { s: "NV01", n: 0 }, B: { s: "B001", n: 0 }, F: { s: "F001", n: 0 } }, docDef: "NV", lastBackup: 0
});
const blank = () => ({
  v: 5,
  biz: { name: "Mi negocio", ruc: "", addr: "", phone: "", foot: "¡Gracias por su compra!", store: "Tienda principal", sid: "T" + uid().slice(-5).toUpperCase() },
  cfg: defCfg(), roles: DEF_ROLES(),
  users: [{ id: "u1", name: "Administrador", role: "admin", pin: "", on: true }],
  products: [], clients: [], sales: [], moves: [], kx: [], log: [], shifts: [], closes: [], periods: [], prev: [], stores: {}, recv: [], supp: [], sm: [],
  tickets: [newTicket(1)], cur: 0, tseq: 1, seq: 0, pseq: 0, zseq: 0, opening: {}, counts: {}
});
const pinHash = (p) => { let h = 5381; for (const c of p + "|cf") h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return String(h); };

// Convierte datos de versiones anteriores (v1-v3) y completa campos nuevos sin perder nada.
function normalize(o) {
  const d = blank();
  if (!o || typeof o !== "object") return wire(d);
  const old = !o.v || o.v < 4;
  const db = Object.assign(d, o);
  if (old) {
    db.biz = Object.assign(blank().biz, { name: typeof o.biz === "string" ? o.biz : "Mi negocio" });
    db.cfg = Object.assign(defCfg(), { mute: !!o.mute, yapeNum: o.yapeNum || "", plinNum: o.plinNum || "", payName: o.payName || "", lastBackup: o.lastBackup || 0 });
    db.users = [{ id: "u1", name: "Administrador", role: "admin", pin: o.pin || "", on: true }];
    ["pin", "mute", "yapeNum", "plinNum", "payName", "lastBackup"].forEach((k) => delete db[k]);
    let maxId = 0;
    (db.sales || []).forEach((s) => {
      maxId = Math.max(maxId, s.id || 0);
      if (!s.doc) s.doc = { type: "NV", s: "NV01", n: s.id };
      if (!s.pays) s.pays = [{ m: s.method || "efectivo", amt: s.total }];
      s.user = s.user || "u1"; s.uname = s.uname || "Administrador";
      if (s.void === true) s.void = { t: s.t, u: "Administrador", why: "" };
    });
    db.cfg.series.NV.n = Math.max(db.cfg.series.NV.n, maxId);
    (db.moves || []).forEach((m) => { m.u = m.u || "Administrador"; });
    db.v = 4;
  }
  db.biz = Object.assign(blank().biz, db.biz);
  const oc = db.cfg || {};
  db.cfg = Object.assign(defCfg(), oc);
  ["pts", "scale", "labels"].forEach((k) => { db.cfg[k] = Object.assign(defCfg()[k], oc[k] || {}); });
  db.cfg.series = Object.assign(defCfg().series, oc.series || {});
  if ((db.v || 0) < 5) { db.cfg.needShift = false; db.v = 5; } // v5: la caja se abre sola al primer cobro
  db.roles = Object.assign(DEF_ROLES(), db.roles || {});
  db.roles.admin = PERMS.map((p) => p[0]);
  if (!Array.isArray(db.users) || !db.users.length) db.users = blank().users;
  ["products", "clients", "sales", "moves", "kx", "log", "shifts", "closes", "periods", "prev", "recv", "supp", "sm"].forEach((k) => { if (!Array.isArray(db[k])) db[k] = []; });
  if (!db.stores || typeof db.stores !== "object") db.stores = {};
  db.products.forEach((p) => {
    if (!p.id) p.id = uid();
    if (p.unit !== "kg") p.unit = "u";
    if (!Array.isArray(p.pres)) p.pres = [];
    if (!Array.isArray(p.recipe)) p.recipe = [];
    if (p.igv === undefined) p.igv = true;
    if (p.img === undefined) p.img = "";
    if (p.min === undefined) p.min = 0;
  });
  if (!Array.isArray(db.tickets) || !db.tickets.length) db.tickets = [newTicket(1)];
  db.tickets = db.tickets.map((t, i) => Object.assign(newTicket(t.n || i + 1), t));
  ["seq", "tseq", "pseq", "zseq"].forEach((k) => { db[k] = +db[k] || 0; });
  if (!db.tseq) db.tseq = db.tickets.length;
  return wire(db);
}
// "DB.cart" siempre apunta al ticket que se está atendiendo.
function wire(db) {
  delete db.cart;
  if (!(db.cur >= 0 && db.cur < db.tickets.length)) db.cur = 0;
  Object.defineProperty(db, "cart", { get() { return db.tickets[db.cur]; }, enumerable: false, configurable: true });
  return db;
}
let DB = normalize(null);

/* ---------- guardado: IndexedDB por meses (rápido aunque haya miles de ventas) ---------- */
const LSKEY = "caja-facil-v1";
const BIG = { sales: (x) => x.date, moves: (x) => x.date, kx: (x) => x.d, log: (x) => x.d };
let idb = null, saveT = 0, dirtyCore = false, dirtyM = new Set(), inflight = 0, knownMonths = [];
const mOf = (date) => String(date || dkey()).slice(0, 7);
function idbOpen() {
  return new Promise((ok, no) => {
    if (!window.indexedDB) return no();
    try { const r = indexedDB.open("caja-facil", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); r.onblocked = () => no(); } catch (e) { no(e); }
  });
}
const idbGet = (k) => new Promise((ok, no) => { const q = idb.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error); });
function coreJSON() { const o = {}; Object.keys(DB).forEach((k) => { if (!BIG[k]) o[k] = DB[k]; }); return JSON.stringify(o); }
function monthJSON(m) { const o = {}; Object.keys(BIG).forEach((k) => { o[k] = DB[k].filter((x) => mOf(BIG[k](x)) === m); }); return JSON.stringify(o); }
function allMonths() { const s = new Set(); Object.keys(BIG).forEach((k) => DB[k].forEach((x) => s.add(mOf(BIG[k](x))))); s.add(mOf()); return [...s].sort(); }
function lsSave(str) { try { localStorage.setItem(LSKEY, str); return true; } catch (e) { toast("No se pudo guardar: el almacenamiento está lleno. Descarga un respaldo."); return false; } }
function flush(hiding) {
  if (dirtyCore || dirtyM.size) {
    if (!idb) { dirtyCore = false; dirtyM.clear(); lsSave(JSON.stringify(DB)); return; }
    const months = allMonths(), puts = [["core", coreJSON()], ["months", JSON.stringify(months)]];
    dirtyM.forEach((m) => puts.push(["m:" + m, monthJSON(m)]));
    const gone = knownMonths.filter((m) => !months.includes(m));
    dirtyCore = false; dirtyM.clear(); knownMonths = months;
    try {
      const tx = idb.transaction("kv", "readwrite"), st = tx.objectStore("kv");
      puts.forEach(([k, v]) => st.put(v, k)); gone.forEach((m) => st.delete("m:" + m));
      inflight++;
      tx.oncomplete = () => { inflight--; if (!inflight) { try { localStorage.removeItem(LSKEY); } catch (e) {} } };
      tx.onerror = () => { inflight--; idb = null; lsSave(JSON.stringify(DB)); };
    } catch (e) { idb = null; lsSave(JSON.stringify(DB)); }
  }
  if (hiding === true && idb && inflight) { try { localStorage.setItem(LSKEY, JSON.stringify(DB)); } catch (e) {} }
}
// save() guarda lo general y el mes actual; si se cambia algo de otro mes, se pasa su fecha.
function save(...dates) { dirtyCore = true; dirtyM.add(mOf()); dates.forEach((d) => d && dirtyM.add(mOf(d))); clearTimeout(saveT); saveT = setTimeout(flush, 30); }
function saveAll() { allMonths().forEach((m) => dirtyM.add(m)); save(); }
window.addEventListener("pagehide", () => flush(true));
document.addEventListener("visibilitychange", () => { if (document.hidden) flush(true); });
async function loadDB() {
  let ls = null, obj = null, fresh = false;
  try { ls = localStorage.getItem(LSKEY); } catch (e) {}
  try { idb = await idbOpen(); } catch (e) { idb = null; }
  if (idb) {
    try {
      const core = await idbGet("core");
      if (core) {
        obj = JSON.parse(core);
        const months = JSON.parse((await idbGet("months")) || "[]"); knownMonths = months;
        Object.keys(BIG).forEach((k) => { obj[k] = []; });
        for (const m of months) { const ch = JSON.parse((await idbGet("m:" + m)) || "null"); if (ch) Object.keys(BIG).forEach((k) => { obj[k] = obj[k].concat(ch[k] || []); }); }
      } else {
        const old = await idbGet("db"); // versión 3
        if (old) { obj = JSON.parse(old); fresh = true; }
      }
    } catch (e) { obj = null; }
  }
  if (ls) { try { const o = JSON.parse(ls); if (o && typeof o === "object") { obj = o; fresh = true; } } catch (e) {} }
  DB = normalize(obj);
  if (fresh && idb) {
    saveAll(); flush();
    try { const tx = idb.transaction("kv", "readwrite"); tx.objectStore("kv").delete("db"); } catch (e) {}
  }
}

/* ---------- ayudas de datos ---------- */
const prod = (id) => DB.products.find((p) => p.id === id);
const cli = (id) => DB.clients.find((c) => c.id === id);
const usr = (id) => DB.users.find((u) => u.id === id);
const saleById = (id) => DB.sales.find((s) => s.id === +id);
const nextCode = () => { const used = new Set(DB.products.map((p) => p.code)); let i = 1; while (used.has(String(i))) i++; return String(i); };
function log(a, d) {
  const u = me();
  DB.log.push({ t: Date.now(), d: dkey(), u: u ? u.name : "", a, x: d || "" });
  if (DB.log.length > 4000) DB.log.splice(0, DB.log.length - 4000);
}
// Movimiento de inventario (kardex). Los productos sin control de stock no generan movimiento.
function stockAdd(p, delta, ty, ref) {
  if (!p || p.stock == null || !delta) return;
  p.stock = r3(p.stock + delta);
  DB.kx.push({ t: Date.now(), d: dkey(), p: p.id, ty, q: r3(delta), b: p.stock, r: ref || "", u: (me() || {}).name || "" });
}
// Descuenta un producto vendido (y sus insumos si tiene receta). qty en unidades base (ya multiplicado por la presentación).
function consume(p, qty, ty, ref) {
  if (!p) return;
  (p.recipe || []).forEach((rc) => { const ing = prod(rc.id); if (ing && ing !== p) stockAdd(ing, -r3(rc.qty * qty), ty === "venta" ? "receta" : ty + "-receta", ref); });
  stockAdd(p, -qty, ty, ref);
}
const KXL = { venta: "Venta", receta: "Usado en receta", anulacion: "Anulación", "anulacion-receta": "Anulación (receta)", devolucion: "Devolución", "devolucion-receta": "Devolución (receta)", ingreso: "Ingreso de mercadería", ajuste: "Ajuste de inventario", merma: "Merma / pérdida", trf_out: "Transferencia enviada", trf_in: "Transferencia recibida", inicial: "Stock inicial", import: "Importación" };
const isLocked = (date) => DB.periods.some((p) => date >= p.from && date <= p.to);

/* ---------- productos de ejemplo ---------- */
const SAMPLE = [
  ["Tomate", 4.5, 3, 30, "Verduras", "1", "kg"], ["Cebolla", 3.5, 2.4, 40, "Verduras", "2", "kg"],
  ["Papa blanca", 2.8, 1.9, 60, "Verduras", "3", "kg"], ["Zanahoria", 2.5, 1.6, 25, "Verduras", "4", "kg"],
  ["Limón", 6, 4.5, 15, "Verduras", "5", "kg"], ["Lechuga", 2.5, 1.5, 20, "Verduras", "6", "u"],
  ["Palta fuerte", 12, 9, 18, "Verduras", "7", "kg"], ["Plátano de seda", 3.5, 2.4, 22, "Frutas", "8", "kg"],
  ["Manzana roja", 6.5, 4.8, 20, "Frutas", "9", "kg"], ["Mandarina", 4, 2.8, 25, "Frutas", "10", "kg"],
  ["Inca Kola 500 ml", 3, 2.2, 48, "Bebidas", "7750001"], ["Coca Cola 500 ml", 3, 2.2, 48, "Bebidas", "7750002"],
  ["Agua mineral 625 ml", 1.5, 1, 36, "Bebidas", "7750003"], ["Cerveza 620 ml", 7, 5.4, 24, "Bebidas", "7750004"],
  ["Galleta soda", 1, 0.7, 40, "Snacks", "7750005"], ["Papas fritas clásicas", 2.5, 1.8, 18, "Snacks", "7750006"],
  ["Chocolate", 1.5, 1, 30, "Snacks", "7750007"], ["Pan francés", 0.3, 0.2, 100, "Panadería", "11"],
  ["Leche evaporada 400 g", 4.8, 4, 20, "Abarrotes", "7750008"], ["Arroz 1 kg", 4.5, 3.6, 15, "Abarrotes", "7750009"],
  ["Aceite 1 L", 9.5, 8, 8, "Abarrotes", "7750010"], ["Huevos", 0.6, 0.45, 90, "Abarrotes", "12"],
  ["Fideos 500 g", 3.2, 2.5, 30, "Abarrotes", "7750011"], ["Atún en lata", 6.5, 5.2, 24, "Abarrotes", "7750012"],
  ["Queso fresco", 22, 17, 6, "Lácteos", "13", "kg"], ["Pollo entero", 10.5, 8.6, 20, "Carnes", "14", "kg"],
  ["Detergente 500 g", 6, 4.8, 6, "Limpieza", "7750013"], ["Papel higiénico x4", 5, 3.8, 10, "Limpieza", "7750014"],
  ["Jabón de tocador", 2.5, 1.7, 15, "Limpieza", "7750015"], ["Cigarro", 0.5, 0.35, 200, "Otros", "15"],
  ["Naranja", 3.5, 2.3, 30, "Frutas", "17", "kg"], ["Papaya", 4, 2.8, 15, "Frutas", "18", "kg"], ["Mango", 5.5, 3.8, 20, "Frutas", "20", "kg"],
  ["Maracuyá", 5, 3.4, 14, "Frutas", "25", "kg"], ["Piña", 5, 3.5, 12, "Frutas", "19"], ["Sandía", 2.2, 1.4, 40, "Frutas", "26", "kg"],
  ["Pimiento", 6, 4.2, 10, "Verduras", "21", "kg"], ["Camote", 2.5, 1.6, 25, "Verduras", "22", "kg"], ["Ajo", 12, 8.5, 5, "Verduras", "23", "kg"], ["Kion", 9, 6, 4, "Verduras", "24", "kg"],
  ["Arroz Costeño suelto", 4.2, 3.4, 50, "Abarrotes", "27", "kg"], ["Arroz Paisana suelto", 4.6, 3.8, 40, "Abarrotes", "28", "kg"]
];
function loadSample() {
  SAMPLE.forEach(([name, price, cost, stock, cat, code, unit]) => {
    if (DB.products.some((p) => p.name === name)) return;
    const p = { id: uid(), name, price, cost, stock, min: unit === "kg" ? 3 : 5, cat, code, unit: unit || "u", pres: [], recipe: [], igv: true, img: "" };
    if (name === "Huevos") p.pres = [{ id: uid(), name: "Jaba x30", f: 30, price: 16.5, code: "1230" }];
    if (name === "Cigarro") p.pres = [{ id: uid(), name: "Cajetilla x20", f: 20, price: 9, code: "1520" }];
    if (name === "Inca Kola 500 ml") p.pres = [{ id: uid(), name: "Paquete x12", f: 12, price: 33, code: "7750001012" }];
    if (["Inca Kola 500 ml", "Pan francés", "Tomate", "Huevos", "Cigarro"].includes(name)) p.fav = true;
    DB.products.push(p);
  });
  if (!DB.products.some((p) => p.name === "Sándwich de pollo")) {
    const pan = DB.products.find((p) => p.name === "Pan francés"), pollo = DB.products.find((p) => p.name === "Pollo entero");
    DB.products.push({ id: uid(), name: "Sándwich de pollo", price: 4, cost: 1.4, stock: null, min: 0, cat: "Panadería", code: "16", unit: "u", pres: [], igv: true, img: "", recipe: [pan && { id: pan.id, qty: 1 }, pollo && { id: pollo.id, qty: 0.08 }].filter(Boolean) });
  }
  if (!DB.clients.length) {
    DB.clients.push({ id: uid(), name: "Rosa Quispe", dt: "DNI", doc: "45678912", phone: "987111222", addr: "Jr. Las Flores 120", limit: 150, days: 15, note: "Paga los sábados", t: Date.now() });
    DB.clients.push({ id: uid(), name: "Comercial Los Andes S.A.C.", dt: "RUC", doc: "20100070970", phone: "", addr: "Av. Perú 456, Lima", limit: 0, days: 0, note: "", t: Date.now() });
  }
  save();
}

/* ===================== 10 · INTERFAZ: estado, imágenes, avisos, ventanas, navegación ===================== */
const ui = { tab: "venta", q: "", cat: "", user: null, date: dkey(), range: "hoy", from: dkey(), to: dkey(), pay: null, locked: false, sel: null, pq: "", ptab: "lista", cq: "", vq: "", vtab: "ventas", rscope: "local", atab: "negocio", kxp: "" };
const DESK = () => window.matchMedia("(min-width:960px)").matches;
const A = {}; // acciones: data-a="nombre" en cualquier botón
const act = (o) => Object.assign(A, o);

/* ---------- imágenes de productos ---------- */
const IMGMAP = [
  [/papas? (fritas|lays)|papitas|\bchips|pringles|doritos|chizito|cuates|piqueo/, "papas_fritas"],
  [/sandwich|sanguche|butifarra|\btriple\b/, "sandwich"], [/hamburguesa/, "hamburguesa"], [/pizza/, "pizza"],
  [/\bsopa|\bcaldo|ramen|aji-no-men|maruchan|calducho/, "sopa"], [/\btamal|humita/, "tamal"],
  [/manzana verde/, "manzana_verde"], [/manzana/, "manzana"], [/panqueque|pancake/, "panqueque"], [/\bpanal|biberon|mamadera/, "biberon"],
  [/papaya/, "papaya"], [/\bmelon/, "melon"], [/pan frances|baguette|ciabatta/, "pan_frances"], [/croissant|cachito/, "croissant"],
  [/paneton|\bkeke|queque|cupcake|muffin|pionono/, "keke"], [/\btorta|pastel/, "torta"],
  [/\bpan\b|\bpanes\b|tostada|\bmolde\b|bizcocho/, "pan"],
  [/tomate/, "tomate"], [/\bcol\b|repollo/, "col"], [/lechuga|espinaca|acelga|\bapio/, "lechuga"], [/cebolla/, "cebolla"],
  [/\bpapas?\b|olluco|\byuca/, "papa"], [/camote/, "camote"], [/beterraga|betarraga|remolacha/, "beterraga"], [/zanahoria|\bnabo/, "zanahoria"], [/\bajos?\b/, "ajo"],
  [/pimiento (rojo|morron)|pimenton/, "pimiento_rojo"], [/pimiento amarillo/, "pimiento_amarillo"], [/pimiento/, "pimiento"], [/\baji\b|rocoto|\bchile\b/, "aji"], [/zapallito|calabac|zucchini/, "zapallito"], [/pepino/, "pepino"],
  [/brocoli|coliflor/, "brocoli"], [/choclo|\bmaiz|\bcancha\b/, "choclo"], [/berenjena/, "berenjena"], [/palta|aguacate/, "palta"],
  [/limon amarillo/, "limon_amarillo"], [/limon|\blima\b/, "limon"], [/champi|\bhongo/, "champinon"], [/\bkion|jengibre/, "kion"], [/arveja|vainita|\bhaba/, "arveja"],
  [/maracuy|granadilla/, "maracuya"], [/\bgranadas?\b/, "granada"], [/ciruela/, "ciruela"], [/esparrago/, "esparrago"], [/\bporo\b|puerro/, "poro"],
  [/frejol|frijol|lenteja|pallar|garbanzo|menestra/, "menestra"], [/aceituna/, "aceituna"],
  [/culantro|perejil|hierbabuena|huacatay|albahaca|\bmenta\b|oregano|romero/, "hierbas"],
  [/platano|banana|guineo/, "platano"], [/mandarina|tangelo|clementina/, "mandarina"], [/toronja|pomelo/, "toronja"], [/naranja/, "naranja"], [/\bmango/, "mango"], [/\bpinas?\b/, "pina"],
  [/\buvas?\b/, "uva"], [/fresa|frutilla/, "fresa"], [/\bperas?\b/, "pera"], [/durazno|melocoton|nectarin/, "durazno"], [/sandia/, "sandia"],
  [/cereza|guinda/, "cereza"], [/\bkiwi/, "kiwi"], [/\bcoco\b/, "coco"],
  [/\barroz/, "arroz"], [/avena|quinua|\btrigo|cereal|kiwicha|harina|semola/, "cereal"],
  [/huevo/, "huevo"], [/leche|yogur/, "leche"], [/queso/, "queso"], [/mantequilla|margarina/, "mantequilla"],
  [/\bsal\b/, "sal"], [/\bmiel\b/, "miel"], [/mermelada|mayonesa|ketchup|mostaza|\bsalsa|manjar|frasco/, "frasco"],
  [/\batun|sardina|conserva|\blata\b|filete de/, "conserva"], [/fideo|tallarin|spaghetti|macarron|canuto|tornillo|\bpasta\b|codito/, "fideos"],
  [/aceite/, "aceite"], [/vinagre|sillao|\bsoya\b|botella/, "botella"],
  [/chocolate|sublime|cua cua|beso de moza|princesa|wafer/, "chocolate"], [/caramelo|gomita|chicle|marshmallow|golosina/, "caramelo"], [/chupetin|chupete|\bpaleta\b/, "chupetin"],
  [/galleta|\bsoda\b|vainilla|\boreo|casino|morocha|chomp/, "galleta"], [/canchita|popcorn|palomita/, "canchita"], [/\bmani\b|pecana|\bnuez|almendra/, "mani"],
  [/\bdonas?\b|picaron/, "dona"], [/helado|frio rico/, "helado"],
  [/\bagua\b|san luis|\bcielo\b/, "agua"], [/cerveza|pilsen|cusquena|\bcristal\b/, "cerveza"], [/\bvino|pisco|\bron\b|whisky|vodka|coctel/, "vino"],
  [/espumante|champan|sidra/, "espumante"], [/\bjugo|nectar|frugos|\bpulp|cifrut|chicha/, "jugo"], [/\bcafe\b|nescafe|kirma|altomayo/, "cafe"],
  [/\bte\b|infusion|manzanilla|\banis\b|hierba luisa|mate de/, "te"], [/\bmate\b/, "mate"],
  [/gaseosa|\bcola\b|\bkola\b|\bcoca\b|sprite|fanta|pepsi|guarana|seven up|7 ?up|bebida|refresco|energizante|\bvolt\b|gatorade|sporade/, "gaseosa"],
  [/pollo|gallina|pechuga|\balitas?\b/, "pollo"], [/chancho|cerdo|costilla|chuleta/, "cerdo"], [/tocino|jamon|chorizo/, "tocino"],
  [/salchicha|hot ?dog/, "salchicha"], [/carne|\bres\b|bistec|\blomo\b|molida|guiso/, "carne"],
  [/pescado|jurel|bonito|tilapia|trucha|caballa|merluza/, "pescado"], [/langostino|camaron|marisco/, "langostino"],
  [/detergente|\bace\b|bolivar|\bopal\b|ariel|suavizante|lejia|clorox|limpiador|poett/, "detergente"],
  [/papel bond|cuaderno|\bblock\b/, "cuaderno"], [/jabon/, "jabon"], [/esponja|lavavajilla|sapolio/, "esponja"],
  [/papel|servilleta/, "papel"], [/cepillo|pasta dental|dental|colgate|kolynos/, "cepillo"],
  [/shampoo|champu|acondicionador|crema|locion|desodorante|\bgel\b/, "shampoo"], [/escoba|recogedor|trapeador/, "escoba"], [/\bbalde|\btina\b|batea/, "balde"],
  [/cigarr|hamilton|marlboro|lucky/, "cigarro"], [/\bbolsas?\b/, "bolsa"], [/taper|descartable|tecnopor/, "taper"],
  [/hielo|cubito/, "hielo"], [/\bvelas?\b/, "vela"], [/pastilla|paracetamol|panadol|ibuprofeno|medicina|jarabe|aspirina/, "medicina"],
  [/\bpilas?\b|bateria|duracell/, "pilas"], [/\bfoco|lampara/, "foco"], [/perro|ricocan|mimaskot|canbo/, "perro"], [/\bgato|whiskas|michi/, "gato"],
  [/lapiz|lapicero|plumon|borrador|colores/, "lapiz"], [/juguete|peluche|pelota/, "peluche"], [/labial|maquillaje|esmalte|rimel/, "labial"], [/recarga|servicio/, "billete"]
];
const CATMAP = [[/verdur|hortaliza/, "brocoli"], [/fruta/, "manzana"], [/licor|cerveza|vino/, "cerveza"], [/bebida|gaseosa|refresco/, "gaseosa"], [/lacteo|leche/, "leche"], [/panader|\bpan/, "pan"], [/carne|pollo|embutido/, "carne"], [/pescad|marisco/, "pescado"], [/limpieza/, "detergente"], [/higiene|cuidado|perfum|tocador/, "shampoo"], [/golosina|dulce|confite/, "caramelo"], [/snack|piqueo/, "canchita"], [/abarrote/, "canasta"], [/farmacia|botica|medic/, "medicina"], [/mascota/, "perro"], [/libreria|util|escolar/, "lapiz"], [/bazar|plastico/, "bolsa"], [/comida|menu|plato|cocina/, "sopa"], [/helado/, "helado"]];
const IMGNAME = { tomate: "Tomate", lechuga: "Lechuga", cebolla: "Cebolla", papa: "Papa", zanahoria: "Zanahoria", ajo: "Ajo", pimiento: "Pimiento", aji: "Ají", pepino: "Pepino", brocoli: "Brócoli", choclo: "Choclo", berenjena: "Berenjena", palta: "Palta", limon: "Limón", limon_amarillo: "Limón amarillo", papaya: "Papaya", col: "Col", mandarina: "Mandarina", toronja: "Toronja", maracuya: "Maracuyá", granada: "Granada", ciruela: "Ciruela", esparrago: "Espárrago", poro: "Poro", beterraga: "Beterraga", zapallito: "Zapallito", pimiento_rojo: "Pimiento rojo", pimiento_amarillo: "Pimiento amarillo", champinon: "Champiñón", kion: "Kion", arveja: "Arveja", menestra: "Menestras", camote: "Camote", aceituna: "Aceituna", hierbas: "Hierbas", platano: "Plátano", manzana: "Manzana", manzana_verde: "Manzana verde", naranja: "Naranja", mango: "Mango", pina: "Piña", uva: "Uva", fresa: "Fresa", pera: "Pera", durazno: "Durazno", sandia: "Sandía", melon: "Melón", cereza: "Cereza", kiwi: "Kiwi", coco: "Coco", arroz: "Arroz", cereal: "Cereales", pan: "Pan", pan_frances: "Pan francés", croissant: "Cachito", huevo: "Huevo", huevos: "Huevos", leche: "Leche", queso: "Queso", mantequilla: "Mantequilla", sal: "Sal", miel: "Miel", frasco: "Frasco", conserva: "Conserva", fideos: "Fideos", aceite: "Aceite", botella: "Botella", chocolate: "Chocolate", caramelo: "Caramelo", chupetin: "Chupetín", galleta: "Galleta", canchita: "Canchita", mani: "Maní", dona: "Dona", keke: "Keke", torta: "Torta", pastel: "Pastel", helado: "Helado", helado_cono: "Helado de cono", gaseosa: "Gaseosa", agua: "Agua", cerveza: "Cerveza", brindis: "Cervezas", vino: "Vino", espumante: "Espumante", jugo: "Jugo", cafe: "Café", te: "Té", mate: "Mate", vaso: "Vaso", biberon: "Biberón", carne: "Carne", pollo: "Pollo", cerdo: "Cerdo", tocino: "Tocino", pescado: "Pescado", langostino: "Langostino", salchicha: "Hot dog", jabon: "Jabón", detergente: "Detergente", esponja: "Esponja", papel: "Papel", cepillo: "Cepillo", shampoo: "Shampoo", escoba: "Escoba", balde: "Balde", cigarro: "Cigarro", caja: "Caja", carrito: "Carrito", bolsa: "Bolsa", canasta: "Canasta", taper: "Táper", sandwich: "Sándwich", hamburguesa: "Hamburguesa", papas_fritas: "Papitas", pizza: "Pizza", sopa: "Sopa", tamal: "Tamal", pretzel: "Pretzel", panqueque: "Panqueque", hielo: "Hielo", dinero: "Dinero", billete: "Billete", vela: "Vela", galleta_arroz: "Galleta de arroz", medicina: "Medicina", pilas: "Pilas", foco: "Foco", perro: "Perro", gato: "Gato", cuaderno: "Cuaderno", lapiz: "Lápiz", peluche: "Peluche", labial: "Labial" };
function imgKey(p) {
  if (p.img && /^(lib|foto):/.test(p.img)) return p.img.slice(p.img.indexOf(":") + 1);
  const n = norm(p.name);
  for (const [re, k] of IMGMAP) if (re.test(n)) return k;
  const c = norm(p.cat);
  for (const [re, k] of CATMAP) if (re.test(c)) return k;
  return "caja";
}
const FOTO = () => window.CF_FOTO || {};
// "foto": fotografía real (de la tienda o del celular); "art": ilustración 3D sobre fondo de color.
function imgKind(p) {
  if (!p) return "art";
  if (p.img && p.img.startsWith("data:")) return "foto";
  if (p.img && p.img.startsWith("lib:")) return "art";
  return FOTO()[imgKey(p)] ? "foto" : "art";
}
function imgSrc(p) {
  if (p && p.img && p.img.startsWith("data:")) return p.img;
  const I = window.CF_IMG || {}, k = imgKey(p);
  if (imgKind(p) === "foto") return FOTO()[k];
  return I[k] || I.caja || "";
}
const catImg = (c) => {
  const I = window.CF_IMG || {}, F = FOTO();
  if (c === "__top") return I.carrito; if (c === "__fav") return I.canasta;
  const p = DB.products.find((x) => x.cat === c && imgKind(x) === "foto") || DB.products.find((x) => x.cat === c);
  if (p) return imgSrc(p);
  const n = norm(c); for (const [re, k] of CATMAP) if (re.test(n)) return F[k] || I[k];
  return I.caja;
};
// Cartulinas fosforescentes de mercado: el color del precio de cada producto.
const CARDS = ["#FFE53D", "#9BEA5A", "#FF9A3D", "#6FD3FF", "#FF6FB0", "#FFFFFF"];
const CARDNAME = ["Amarillo", "Verde", "Naranja", "Celeste", "Rosado", "Blanco"];
const OLDTINT = { "#E8F5E9": 1, "#FFF3E0": 2, "#E3F2FD": 3, "#FCE4EC": 4, "#F3E5F5": 4, "#E0F7FA": 3, "#FFFDE7": 0, "#EFEBE9": 5 };
const CATCARD = [[/verdur|hortaliza/, 1], [/fruta/, 2], [/bebida|gaseosa|refresco|licor|cerveza|\bagua/, 3], [/snack|golosina|dulce|confite|piqueo/, 4], [/abarrote/, 0], [/lacteo|leche|queso/, 5], [/panader|\bpan/, 2], [/limpieza|higiene|tocador|aseo/, 3], [/carne|pollo|embutido|pescad/, 4]];
const TINTS = CARDS;
function tintOf(p) {
  const c = String(p.color || "").toUpperCase();
  if (c) return CARDS.includes(c) ? c : OLDTINT[c] != null ? CARDS[OLDTINT[c]] : c;
  const n = norm(p.cat || "");
  for (const [re, i] of CATCARD) if (re.test(n)) return CARDS[i];
  return CARDS[[...norm(p.cat || p.name)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 5];
}
const pimg = (p, cls = "pim") => { const s = imgSrc(p); return s ? `<img class="${cls} k-${imgKind(p)}" src="${s}" alt="" loading="lazy" decoding="async">` : `<span class="${cls} noimg" aria-hidden="true">${esc((p.name || "?").slice(0, 1).toUpperCase())}</span>`; };
// Foto tomada con el celular o elegida de la PC: se recorta cuadrada y se achica para que ocupe poco.
function readPhoto(file, cb) {
  if (!file) return;
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => {
    const S = 320, c = document.createElement("canvas"); c.width = c.height = S;
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, S, S);
    const r = Math.max(S / img.width, S / img.height), w = img.width * r, h = img.height * r;
    x.drawImage(img, (S - w) / 2, (S - h) / 2, w, h); URL.revokeObjectURL(url);
    cb(c.toDataURL("image/jpeg", 0.82));
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast("No se pudo leer esa imagen"); };
  img.src = url;
}

/* ---------- sonido y avisos ---------- */
let ac;
function beep(ok = true) {
  if (DB.cfg.mute) return;
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
function toast(msg, long) {
  const t = $("#toast"); if (!t) return;
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), long ? 4200 : 2400);
}

/* ---------- ventanas ---------- */
let modalBack = null;
function openModal(html, cls = "") {
  const m = $("#modal"); if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  ui.mk = "";
  const sh = $(".sheet", m); sh.className = "sheet " + cls; sh.innerHTML = html; m.hidden = false; sh.scrollTop = 0;
  document.body.classList.add("noscroll");
  const f = $("[autofocus]", m); if (f && (DESK() || f.dataset.mfocus !== undefined)) setTimeout(() => { f.focus(); if (f.select && f.value) f.select(); }, 60);
}
function closeModal() {
  const m = $("#modal"); m.hidden = true; $(".sheet", m).innerHTML = ""; document.body.classList.remove("noscroll");
  ui.pay = null; ui.mk = ""; stopScaleRead(); stopCam();
  const b = modalBack; modalBack = null; if (b) return b();
  focusQ();
}
const modalOpen = () => !$("#modal").hidden;
function confirmBox(msg, label, cb, danger = true, detail = "") {
  openModal(`<h2>${esc(msg)}</h2>${detail ? `<p class="muted" style="margin-bottom:6px">${detail}</p>` : ""}<div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn ${danger ? "red" : ""}" id="cfYes" data-enter>${esc(label)}</button></div>`);
  $("#cfYes").onclick = (e) => { e.stopPropagation(); closeModal(); cb(); };
}
// Pide un dato (motivo, nombre, monto...) en una ventana pequeña.
function promptBox(o, cb) {
  openModal(`<h2>${esc(o.title)}</h2>${o.text ? `<p class="muted" style="margin-bottom:12px">${o.text}</p>` : ""}
    <label class="fld"><span>${esc(o.label)}</span>${o.area ? `<textarea class="inp" id="pbv" rows="3" placeholder="${esc(o.ph || "")}" autofocus>${esc(o.value || "")}</textarea>` : `<input class="inp ${o.num ? "num" : ""}" id="pbv" ${o.num ? 'inputmode="decimal"' : ""} value="${esc(o.value || "")}" placeholder="${esc(o.ph || "")}" maxlength="${o.max || 80}" autofocus autocomplete="off">`}</label>
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn ${o.danger ? "red" : ""}" id="pbok" data-enter>${esc(o.ok || "Guardar")}</button></div>`);
  $("#pbok").onclick = (e) => { e.stopPropagation(); const v = $("#pbv").value.trim(); if (o.required && !v) { toast(o.required); return; } closeModal(); cb(v); };
}
function download(name, text, type) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(text instanceof Blob ? text : new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
function csvOut(rows, name) { download(name, "﻿" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n"), "text/csv;charset=utf-8"); }
function readText(file, cb) {
  const rd = new FileReader();
  rd.onload = () => { const txt = String(rd.result); if (txt.includes("�")) { const r2d = new FileReader(); r2d.onload = () => cb(String(r2d.result)); r2d.readAsText(file, "windows-1252"); } else cb(txt); };
  rd.readAsText(file);
}
// Imprime en la ticketera (58 u 80 mm) o en hoja A4 para informes.
function printHtml(html, kind = "ticket") {
  const p = $("#print"); p.className = kind === "ticket" ? "pt" + DB.cfg.paper : "rep"; p.innerHTML = html;
  setTimeout(() => window.print(), 30);
}

/* ---------- íconos ---------- */
const IC = {
  venta: '<path d="M6 7h13l-1.5 8H8zM6 7 5 3H2"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
  ventas: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/>',
  prod: '<path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10"/>',
  cli: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  prov: '<path d="M2.5 6.5h11v10h-11zM13.5 10h4l3 3v3.5h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  caja: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v.01M18 15v.01"/>',
  rep: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  aj: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.2-.8.2-1.2z"/>',
  mas: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  scale: '<path d="M4 20h16l-2-9H6zM12 11V6M8 6h8"/><circle cx="12" cy="15.5" r="2"/>',
  mesa: '<path d="M3 9h18M5 9v11M19 9v11M8 9V5h8v4"/>',
  prev: '<path d="M7 3h10v18l-5-3-5 3z"/>',
  cam: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>',
  wa: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/>',
  scan: '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M7.5 9v6M10.5 9v6M14 9v6M16.5 9v6" stroke-width="1.6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  hold: '<path d="M6 4h12v16l-6-4-6 4z"/><path d="M12 8v4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  torch: '<path d="M9 3h6v4l-1.5 3v10h-3V10L9 7z"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  money: '<rect x="2.5" y="6" width="19" height="12" rx="1.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v.01M18 14.5v.01"/>'
};
const svg = (k, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${IC[k] || ""}</svg>`;

/* ---------- navegación ---------- */
const TABS = [["venta", "Vender", null], ["ventas", "Ventas", null], ["prod", "Productos", null], ["cli", "Clientes", null], ["caja", "Caja", "caja"], ["prov", "Proveedores", "caja"], ["rep", "Reportes", "reportes"], ["aj", "Ajustes", "ajustes"]];
const tabOk = (t) => { const x = TABS.find((y) => y[0] === t); return x && (!x[2] || can(x[2])); };
function paintNav() {
  const u = me(), tabs = TABS.filter((t) => !t[2] || can(t[2]));
  const btn = ([id, label]) => `<button class="tab ${ui.tab === id ? "on" : ""}" data-a="tab" data-t="${id}" ${ui.tab === id ? 'aria-current="page"' : ""}><span class="ic">${svg(id)}</span><span>${label}</span></button>`;
  $("#sideNav").innerHTML = tabs.map(btn).join("");
  const mob = ["venta", "ventas", "caja", "prod"].filter((t) => tabs.some((x) => x[0] === t)).map((t) => tabs.find((x) => x[0] === t));
  const moreOn = !mob.some((x) => x[0] === ui.tab);
  $("#tabNav").innerHTML = mob.map(btn).join("") + `<button class="tab ${moreOn ? "on" : ""}" data-a="more"><span class="ic">${svg("mas")}</span><span>Más</span></button>`;
  $("#bizName").textContent = DB.biz.name || "Caja Fácil";
  $("#storeName").textContent = DB.biz.store || "Punto de venta";
  $("#userChip").innerHTML = u ? `<span class="av" style="--h:${avHue(u)}">${esc(initials(u.name))}</span><span class="un"><b>${esc(u.name)}</b><small>${esc(ROLE_LABEL[u.role] || u.role)}${curShift() ? " · caja abierta" : ""}</small></span>` : "";
  document.title = (DB.biz.name ? DB.biz.name + " · " : "") + "Caja Fácil";
}
function go(tab) {
  if (!tabOk(tab)) { toast("Tu usuario no tiene acceso a esa sección"); tab = "venta"; }
  ui.tab = tab; document.body.classList.remove("cart-open"); render(); window.scrollTo(0, 0);
}
const VIEWS = {};
function render() {
  if (!tabOk(ui.tab)) ui.tab = "venta";
  paintNav();
  document.body.dataset.tab = ui.tab;
  VIEWS[ui.tab]($("#view"));
}
function moreMenu() {
  const items = [["cli", "Clientes"], ["prov", "Proveedores", "caja"], ["rep", "Reportes", "reportes"], ["aj", "Ajustes", "ajustes"]].filter((x) => !x[2] || can(x[2]));
  openModal(`<h2>Más opciones</h2><div class="menu">${items.map(([t, l]) => `<button class="mi" data-a="tab" data-t="${t}"><span class="ic">${svg(t)}</span>${l}</button>`).join("")}
    <button class="mi" data-a="theme"><span class="ic">${svg("moon")}</span>${document.documentElement.dataset.theme === "dark" ? "Tema claro" : "Tema oscuro"}</button>
    <button class="mi" data-a="switchuser"><span class="ic">${svg("user")}</span>Cambiar de usuario</button></div>`);
}
// Tema claro u oscuro: solo cambia la apariencia y se recuerda en este navegador.
function toggleTheme() {
  const dark = document.documentElement.dataset.theme !== "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  try { localStorage.setItem("cf-theme", dark ? "dark" : "light"); } catch (e) {}
  const m = $('meta[name="theme-color"]'); if (m) m.content = dark ? "#07090D" : "#F3F4F7";
  if (modalOpen()) closeModal();
}
act({ tab: (el) => { if (modalOpen()) closeModal(); go(el.dataset.t); }, more: moreMenu, close: closeModal, theme: toggleTheme });

/* ===================== 20 · USUARIOS, CLAVES Y PERMISOS ===================== */
const initials = (n) => String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const avHue = (u) => ([...String(u.id)].reduce((a, c) => a + c.charCodeAt(0), 0) * 47) % 360;
function me() { return usr(ui.user) || null; }
const userCan = (u, perm) => !!u && (u.role === "admin" || (DB.roles[u.role] || []).includes(perm));
function can(perm) { return userCan(me(), perm); }
const activeUsers = () => DB.users.filter((u) => u.on);
const needLogin = () => { const on = activeUsers(); return on.length > 1 || on.some((u) => u.pin); };

/* ---------- pantalla de ingreso y teclado de clave ---------- */
let pinBuf = "", pinCb = null, lastAct = Date.now();
function showLock(title, sub) {
  ui.locked = true; $("#lock").hidden = false;
  $("#lockTitle").textContent = title; $("#lockSub").textContent = sub || "";
}
function hideLock() { $("#lock").hidden = true; ui.locked = false; pinCb = null; pinBuf = ""; lastAct = Date.now(); }
function paintDots(err) {
  $$("#lockDots i").forEach((d, i) => d.classList.toggle("on", i < pinBuf.length));
  const dots = $("#lockDots"); dots.classList.remove("err"); if (err) { void dots.offsetWidth; dots.classList.add("err"); }
}
function askPin(title, sub, cb, cancelable = false, back = null) {
  pinBuf = ""; pinCb = cb;
  showLock(title, sub);
  $("#lockUsers").hidden = true; $("#lockPinArea").hidden = false;
  $("#lockCancel").hidden = !cancelable && !back; $("#lockCancel").textContent = back ? "Volver" : "Cancelar";
  $("#lockCancel").onclick = (e) => { e.stopPropagation(); if (back) back(); else hideLock(); };
  paintDots();
}
function pinKey(k) {
  if (!pinCb) return;
  if (k === "del") pinBuf = pinBuf.slice(0, -1);
  else if (pinBuf.length < 4) pinBuf += k;
  paintDots();
  if (pinBuf.length === 4) { const p = pinBuf, cb = pinCb; setTimeout(() => cb(p), 90); }
}
function pinBad() { pinBuf = ""; beep(false); paintDots(true); }
function loginScreen() {
  closeModalQuiet(); document.body.classList.remove("cart-open");
  const users = activeUsers();
  if (users.length === 1) return pickUser(users[0].id, true);
  showLock("¿Quién atiende?", "Toca tu nombre para entrar");
  $("#lockPinArea").hidden = true; $("#lockUsers").hidden = false; $("#lockCancel").hidden = true; pinCb = null;
  $("#lockUsers").innerHTML = users.map((u) => `<button class="luser" data-a="pickuser" data-id="${u.id}"><span class="av" style="--h:${avHue(u)}">${esc(initials(u.name))}</span><b>${esc(u.name)}</b><small>${esc(ROLE_LABEL[u.role] || u.role)}</small></button>`).join("");
}
function pickUser(id, only) {
  const u = usr(id); if (!u) return;
  if (!u.pin) return login(u);
  askPin(`Hola, ${u.name.split(" ")[0]}`, "Ingresa tu clave de 4 dígitos", (p) => { if (pinHash(p) === u.pin) login(u); else pinBad(); }, false, only ? null : loginScreen);
}
function login(u) {
  ui.user = u.id; hideLock(); log("Ingreso al sistema", u.name);
  if (!tabOk(ui.tab)) ui.tab = "venta";
  render(); focusQ();
}
function closeModalQuiet() { const m = $("#modal"); if (!m.hidden) { m.hidden = true; $(".sheet", m).innerHTML = ""; document.body.classList.remove("noscroll"); ui.pay = null; modalBack = null; stopScaleRead(); stopCam(); } }
function lockNow() { if (!needLogin()) return toast("Pon una clave a tu usuario en Ajustes para poder bloquear"); log("Salió / bloqueó", (me() || {}).name || ""); loginScreen(); }

// Operación delicada: si el usuario no tiene permiso, la autoriza alguien que sí lo tenga con su clave.
function need(perm, cb, what) {
  if (can(perm)) return cb(me());
  const sups = activeUsers().filter((u) => u.pin && userCan(u, perm));
  if (!sups.length) { beep(false); toast("Tu usuario no tiene permiso para esto. El administrador puede darlo en Ajustes › Usuarios.", true); return; }
  askPin("Clave de supervisor", "Para: " + (what || SENSITIVE[perm] || perm), (p) => {
    const s = sups.find((u) => u.pin === pinHash(p));
    if (!s) return pinBad();
    hideLock(); log("Autorización", `${s.name} autorizó a ${(me() || {}).name}: ${what || SENSITIVE[perm] || perm}`); cb(s);
  }, true);
}
// Crear o cambiar la clave de un usuario (se pide dos veces).
function setPinFor(u, done) {
  askPin(`Nueva clave para ${u.name}`, "4 dígitos que solo esa persona conozca", (a) => {
    askPin("Repite la clave", "", (b) => {
      if (a !== b) { pinBad(); toast("No coinciden. Intenta otra vez"); return setPinFor(u, done); }
      u.pin = pinHash(a); save(); hideLock(); log("Cambio de clave", u.name); toast("Clave guardada"); if (done) done();
    }, true);
  }, true);
}

// Bloqueo automático por inactividad.
["pointerdown", "keydown"].forEach((ev) => document.addEventListener(ev, () => { lastAct = Date.now(); }, true));
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (!ui.locked && hiddenAt && needLogin() && DB.cfg.lock > 0 && Date.now() - hiddenAt > DB.cfg.lock * 60000) loginScreen();
});
setInterval(() => { if (!ui.locked && ui.user && needLogin() && DB.cfg.lock > 0 && Date.now() - lastAct > DB.cfg.lock * 60000) loginScreen(); }, 15000);

act({
  pickuser: (el) => pickUser(el.dataset.id),
  lockkey: (el) => pinKey(el.dataset.k),
  switchuser: () => { closeModalQuiet(); if (!needLogin()) return toast("Solo hay un usuario. Agrega más en Ajustes › Usuarios"); log("Cambio de usuario", (me() || {}).name || ""); loginScreen(); },
  lock: lockNow
});

/* ===================== 30 · TICKET: líneas, presentaciones, totales con IGV, mesas y preventas ===================== */
const lineKey = (id, pres) => id + (pres ? ":" + pres : "");
const costOf = (p) => (p.recipe && p.recipe.length && !(p.cost > 0) ? r2(p.recipe.reduce((a, rc) => { const i = prod(rc.id); return a + (i ? (i.cost || 0) * rc.qty : 0); }, 0)) : p.cost || 0);
function resolveLine(l) {
  if (l.quick) return { name: l.name, price: l.price, base: l.price, cost: 0, stock: null, quick: true, unit: "u", code: "", f: 1, igv: true, p: null };
  const p = prod(l.id); if (!p) return null;
  const ps = l.pres ? (p.pres || []).find((x) => x.id === l.pres) : null;
  if (l.pres && !ps) return null;
  const base = ps ? ps.price : p.price;
  return { p, ps, name: ps ? `${p.name} (${ps.name})` : p.name, price: l.pr != null ? l.pr : base, base, cost: r2(costOf(p) * (ps ? ps.f : 1)), stock: p.stock, unit: ps ? "u" : p.unit, code: ps ? ps.code : p.code, f: ps ? ps.f : 1, igv: p.igv !== false, quick: false };
}
const linesOf = (t) => t.items.map((l) => ({ l, r: resolveLine(l) })).filter((x) => x.r);
const cartLines = () => linesOf(DB.cart);
function totalsOf(t) {
  const lines = linesOf(t);
  const sub = r2(lines.reduce((a, { l, r }) => a + r2(r.price * l.qty), 0));
  const disc = Math.min(Math.max(0, r2(t.disc)), sub);
  const total = r2(sub - disc), ratio = sub ? total / sub : 0;
  const gAmt = r2(lines.reduce((a, { l, r }) => a + (r.igv ? r2(r.price * l.qty) : 0), 0) * ratio);
  const rate = DB.cfg.igvOn ? (+DB.cfg.igv || 0) / 100 : 0;
  const gravada = rate ? r2(gAmt / (1 + rate)) : 0, igv = rate ? r2(gAmt - gravada) : 0;
  return { lines, sub, disc, total, gravada, igv, exo: rate ? r2(total - gAmt) : 0, count: lines.length };
}
const cartTotals = () => totalsOf(DB.cart);
const ticketTotal = (t) => totalsOf(t).total;
const unitTxt = (r) => (r.unit === "kg" ? " kg" : "");
// Cuánto de un producto (en unidades base) hay en el ticket, sin contar una línea.
const usedInCart = (pid, exceptKey) => r3(DB.cart.items.filter((i) => i.id === pid && lineKey(i.id, i.pres) !== exceptKey).reduce((a, i) => { const r = resolveLine(i); return a + (r ? i.qty * r.f : 0); }, 0));
function setLine(id, pres, qty, opts = {}) {
  const k = lineKey(id, pres), l = DB.cart.items.find((i) => lineKey(i.id, i.pres) === k);
  const r = resolveLine(l || { id, pres }); if (!r) return false;
  if (qty <= 0) DB.cart.items = DB.cart.items.filter((i) => i !== l);
  else {
    if (!r.quick && r.stock != null && !DB.cfg.negStock) {
      const need = r3(usedInCart(id, k) + qty * r.f);
      if (need > r.stock + 1e-9) { toast(r.stock <= 0 ? "Sin stock: " + r.p.name : `Solo quedan ${fmtQ(r.stock)}${r.p.unit === "kg" ? " kg" : ""} de ${r.p.name}`); beep(false); return false; }
    }
    if (!l || qty > l.qty) { ui.fresh = k; ui.bump = id; }
    if (l) l.qty = r3(qty); else DB.cart.items.push({ id, pres: pres || "", qty: r3(qty) });
    ui.sel = k;
  }
  save(); if (!opts.quiet) beep(true); paintSale(); return true;
}
function addToCart(p, qty = 1, pres = "") {
  const l = DB.cart.items.find((i) => lineKey(i.id, i.pres) === lineKey(p.id, pres));
  return setLine(p.id, pres, r3((l ? l.qty : 0) + qty));
}
function changeQty(k, d) {
  const l = DB.cart.items.find((i) => lineKey(i.id, i.pres) === k); if (!l) return;
  const r = resolveLine(l); if (!r) return;
  if (l.quick) { l.qty = Math.max(0, l.qty + d); if (!l.qty) DB.cart.items = DB.cart.items.filter((i) => i !== l); save(); paintSale(); return; }
  setLine(l.id, l.pres, r3(l.qty + d * (r.unit === "kg" ? 0.1 : 1)));
}
function dropCurrentTicket() {
  if (DB.tickets.length > 1) { DB.tickets.splice(DB.cur, 1); DB.cur = Math.max(0, Math.min(DB.cur, DB.tickets.length - 1)); }
  else { DB.tickets = [newTicket(1)]; DB.tseq = 1; DB.cur = 0; }
  ui.sel = null;
}
function newTicketNow(extra = {}) {
  DB.tickets.push(Object.assign(newTicket(++DB.tseq), extra)); DB.cur = DB.tickets.length - 1; ui.sel = null; save();
}
const ticketLabel = (t) => t.mesa ? `Mesa ${t.mesa}` : t.prev ? `Preventa ${t.prev}` : t.name || "Ticket " + t.n;

/* ---------- mesas (restaurantes y cuentas abiertas) ---------- */
function openTables() {
  const n = +DB.cfg.tables || 0; if (!n) return toast("Activa las mesas en Ajustes › Venta");
  openModal(`<h2>Mesas</h2><p class="muted" style="margin-bottom:12px">Toca una mesa para abrir o seguir su cuenta.</p><div class="mesas">${Array.from({ length: n }, (_, i) => {
    const m = i + 1, t = DB.tickets.find((x) => x.mesa === m), busy = t && t.items.length;
    const mins = t && t.t0 ? Math.round((Date.now() - t.t0) / 60000) : 0;
    return `<button class="mesa ${busy ? "busy" : ""} ${t && DB.tickets.indexOf(t) === DB.cur ? "on" : ""}" data-a="mesa" data-m="${m}"><b>${m}</b><small>${busy ? money(ticketTotal(t)) : "Libre"}</small>${busy && mins ? `<em>${mins} min</em>` : ""}</button>`;
  }).join("")}</div><div class="btns"><button class="btn sec" data-a="close">Cerrar</button></div>`, "wide");
}
function goTable(m) {
  let i = DB.tickets.findIndex((x) => x.mesa === m);
  if (i < 0) {
    if (!DB.cart.items.length && !DB.cart.mesa && !DB.cart.prev) { Object.assign(DB.cart, { mesa: m, name: "", t0: Date.now() }); i = DB.cur; }
    else { newTicketNow({ mesa: m, t0: Date.now() }); i = DB.cur; }
  }
  DB.cur = i; save(); closeModal(); paintSale(); toast(`Mesa ${m}`);
}

/* ---------- preventas: el vendedor arma el pedido, la caja lo cobra ---------- */
function savePrev() {
  const lines = cartLines(); if (!lines.length) return toast("Agrega productos primero");
  const t = DB.cart, no = ++DB.pseq;
  const pv = { no, t: Date.now(), date: dkey(), u: me().id, un: me().name, items: t.items.map((i) => Object.assign({}, i)), disc: t.disc || 0, client: t.client || "", total: ticketTotal(t), status: "pendiente", sale: 0 };
  DB.prev.push(pv); log("Preventa", `N° ${no} ${money(pv.total)}`);
  dropCurrentTicket(); save(); paintSale();
  openModal(`<div class="bigok"><span>Preventa guardada</span><b class="num">N° ${no}</b><p>El cliente paga en caja diciendo este número. Total ${money(pv.total)}.</p></div>
    <div class="btns h"><button class="btn sec" data-a="prevprint" data-n="${no}">${svg("print", "bi")}Imprimir</button><button class="btn" data-a="close" data-enter>Seguir vendiendo</button></div>`);
}
function loadPrev(no) {
  const pv = DB.prev.find((x) => x.no === +no);
  if (!pv) { toast(`No existe la preventa N° ${no}`); beep(false); return false; }
  if (pv.status !== "pendiente") { toast(pv.status === "cobrada" ? `La preventa N° ${no} ya fue cobrada` : `La preventa N° ${no} está anulada`); beep(false); return false; }
  const open = DB.tickets.findIndex((x) => x.prev === pv.no);
  if (open >= 0) { DB.cur = open; save(); paintSale(); return true; }
  const data = { prev: pv.no, items: pv.items.map((i) => Object.assign({}, i)), disc: pv.disc, client: pv.client };
  if (!DB.cart.items.length && !DB.cart.mesa && !DB.cart.prev) Object.assign(DB.cart, data); else newTicketNow(data);
  save(); beep(true); paintSale(); toast(`Preventa N° ${no} lista para cobrar`); return true;
}
function prevHtml(pv) {
  const lines = pv.items.map((i) => ({ l: i, r: resolveLine(i) })).filter((x) => x.r);
  return `<h3>${esc(DB.biz.name)}</h3><div class="c big">PREVENTA N° ${pv.no}</div><div class="c">${fmtDT(pv.t)} · Vendedor: ${esc(pv.un)}</div><hr>` +
    lines.map(({ l, r }) => `<div class="l"><span>${fmtQ(l.qty)}${unitTxt(r)} x ${esc(r.name)}</span><span>${money(r.price * l.qty)}</span></div>`).join("") +
    `<hr>${pv.disc ? `<div class="l"><span>Descuento</span><span>- ${money(pv.disc)}</span></div>` : ""}<div class="l t"><span>TOTAL</span><span>${money(pv.total)}</span></div><hr><div class="c">Pague en caja indicando el N° ${pv.no}</div>`;
}
act({
  mesas: openTables,
  mesa: (el) => goTable(+el.dataset.m),
  prevsave: savePrev,
  prevprint: (el) => { const pv = DB.prev.find((x) => x.no === +el.dataset.n); if (pv) printHtml(prevHtml(pv)); },
  prevload: () => promptBox({ title: "Cobrar una preventa", label: "Número de preventa", num: true, ph: "Ej: 15", ok: "Buscar", required: "Escribe el número" }, (v) => loadPrev(parseInt(v.replace(/\D/g, ""), 10)))
});

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

/* ===================== 32 · BALANZA: pesar productos, balanza USB y etiquetas con código ===================== */
const scaleState = { on: false, port: null, reader: null, kg: 0, stable: false, raw: "", last: 0 };
let pollT = 0;
const serialOk = () => "serial" in navigator;
function fmtOf(f) { const m = String(f || "8N1").match(/^([78])([NEO])([12])$/i) || [0, 8, "N", 1]; return { dataBits: +m[1], parity: { N: "none", E: "even", O: "odd" }[m[2].toUpperCase()], stopBits: +m[3] }; }
async function connectScale(ask) {
  if (!serialOk()) { if (ask) toast("Para conectar una balanza USB usa Chrome o Edge en la computadora.", true); return false; }
  try {
    let port = null;
    if (ask) port = await navigator.serial.requestPort();
    else { const ps = await navigator.serial.getPorts(); port = ps[0] || null; }
    if (!port) return false;
    if (scaleState.port === port && scaleState.on) return true;
    await port.open(Object.assign({ baudRate: +DB.cfg.scale.baud || 9600 }, fmtOf(DB.cfg.scale.fmt)));
    scaleState.port = port; scaleState.on = true; readLoop();
    if (ask) toast("Balanza conectada");
    refreshScaleUI(); return true;
  } catch (e) {
    if (e && e.name === "NotFoundError") return false;
    if (ask) toast("No se pudo conectar la balanza: " + ((e && e.message) || e), true);
    return false;
  }
}
async function disconnectScale() {
  scaleState.on = false;
  try { if (scaleState.reader) await scaleState.reader.cancel(); } catch (e) {}
  try { if (scaleState.port) await scaleState.port.close(); } catch (e) {}
  scaleState.port = null; refreshScaleUI();
}
async function readLoop() {
  const port = scaleState.port, dec = new TextDecoder(); let buf = "";
  while (port && port.readable && scaleState.on) {
    const reader = port.readable.getReader(); scaleState.reader = reader;
    try {
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split(/[\r\n\x02\x03]+/); buf = parts.pop(); if (buf.length > 120) buf = buf.slice(-60);
        parts.forEach(onScaleLine);
      }
    } catch (e) { break; } finally { try { reader.releaseLock(); } catch (e) {} }
  }
  if (scaleState.port === port) { scaleState.on = false; refreshScaleUI(); }
}
// Entiende los formatos más comunes: "ST,GS,+  0.250kg", "  0.250 kg", "00250 g", "W:0.250"...
function parseWeight(line) {
  const nums = [...line.matchAll(/([-+]?)\s*(\d+(?:[.,]\d+)?)\s*(kg|g|lb)?\b/gi)];
  if (!nums.length) return null;
  const pick = nums.find((x) => x[3]) || nums[nums.length - 1];
  let v = parseFloat(pick[2].replace(",", ".")); if (!isFinite(v)) return null;
  if (pick[1] === "-") v = 0;
  let unit = (pick[3] || "").toLowerCase();
  if (!unit) unit = DB.cfg.scale.unit === "g" ? "g" : DB.cfg.scale.unit === "kg" ? "kg" : /[.,]/.test(pick[2]) ? "kg" : v > 30 ? "g" : "kg";
  const kg = unit === "g" ? v / 1000 : unit === "lb" ? v * 0.45359 : v;
  return { kg: r3(Math.max(0, kg)), stable: !/\bUS\b|unst|motion|\bM\b/i.test(line) };
}
function onScaleLine(line) {
  line = line.trim(); if (!line) return;
  scaleState.raw = line.replace(/[^\x20-\x7e]/g, "·");
  const w = parseWeight(line); if (!w) return;
  scaleState.kg = w.kg; scaleState.stable = w.stable; scaleState.last = Date.now();
  if (ui.mk === "weigh" && ui.w && ui.w.src === "scale") paintWeighLcd();
  if (ui.mk === "scaletest") paintScaleTest();
}
const CMDS = { "": "", W: "W", ENQ: "\x05", P: "P\r\n", SI: "SI\r\n" };
function startPoll() {
  clearInterval(pollT);
  const c = CMDS[DB.cfg.scale.cmd || ""];
  if (!c || !scaleState.on || !scaleState.port || !scaleState.port.writable) return;
  const enc = new TextEncoder();
  pollT = setInterval(async () => {
    if (!scaleState.on || !scaleState.port || !scaleState.port.writable) return clearInterval(pollT);
    try { const w = scaleState.port.writable.getWriter(); await w.write(enc.encode(c)); w.releaseLock(); } catch (e) {}
  }, 350);
}
function stopScaleRead() { clearInterval(pollT); pollT = 0; }
function refreshScaleUI() {
  const t = $("#scaleTool"); if (t) { t.classList.toggle("live", scaleState.on); t.querySelector("span").textContent = scaleState.on ? "Balanza lista" : "Balanza"; }
  if (ui.mk === "weigh") paintWeighLcd();
}

/* ---------- ventana de pesado: simple, precio por kilo y peso ---------- */
// Acepta "0.5", "0,5" (kilos) o "250g" / "250 gr" (gramos).
function parseKg(txt) {
  const t = String(txt || "").trim().toLowerCase();
  if (!t) return 0;
  if (/(^|\d)\s*(g|gr|grs|gramos)$/.test(t)) return r3(num(t.replace(/[^\d.,]/g, "")) / 1000);
  return r3(num(t));
}
function openWeigh(id, mode) {
  const p = prod(id); if (!p) return;
  const l = DB.cart.items.find((i) => lineKey(i.id, i.pres) === lineKey(id, ""));
  if (mode === "add" && p.stock != null && p.stock <= 0 && !DB.cfg.negStock) { toast("Sin stock: " + p.name); beep(false); return; }
  const pk = l && l.pr != null ? l.pr : p.price;
  ui.w = { id, mode, src: "manual", have: l ? l.qty : 0 };
  openModal(`<div class="weigh simple">
    <div class="wtop">${pimg(p, "wimg")}<div><h2>${esc(p.name)}</h2><p class="muted">${[mode === "add" && l ? `Ya lleva ${fmtQ(l.qty)} kg` : "Se vende por kilo", p.stock != null ? `stock ${fmtQ(p.stock)} kg` : ""].filter(Boolean).join(" · ")}</p></div></div>
    <div class="two"><label class="fld"><span>Precio por kilo (S/)</span><input class="inp num big" id="wpk" data-in="wk" inputmode="decimal" value="${(+pk).toFixed(2)}" aria-label="Precio por kilo"></label>
      <label class="fld"><span>Peso (kg)</span><input class="inp num big" id="wkg" data-in="wk" inputmode="decimal" enterkeyhint="done" value="${mode === "set" && l ? String(l.qty) : ""}" placeholder="0.500" autocomplete="off" autofocus data-mfocus></label></div>
    <div class="wtot"><span>A pagar</span><b class="num" id="wtot">S/ 0.00</b></div>
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" id="wok" data-a="wok" data-enter>${mode === "set" ? "Guardar" : "Agregar"}</button></div></div>`, "weighm");
  ui.mk = "weigh"; paintWeighLcd();
}
const weighKg = () => parseKg(($("#wkg") || { value: "" }).value);
const weighPk = () => r2(num(($("#wpk") || { value: "" }).value));
function paintWeighLcd() {
  const w = ui.w; if (!w || !$("#wkg")) return;
  const kg = weighKg(), pk = weighPk(), amt = r2(kg * pk);
  const t = $("#wtot"); if (t) t.textContent = money(amt);
  const ok = $("#wok"); if (ok) { ok.disabled = !(kg > 0 && pk > 0); ok.textContent = kg > 0 && pk > 0 ? `${w.mode === "set" ? "Guardar" : "Agregar"} · ${money(amt)}` : w.mode === "set" ? "Guardar" : "Agregar"; }
}
function weighKey() {}
function weighOk() {
  const w = ui.w; if (!w) return;
  const p = prod(w.id), kg = weighKg(), pk = weighPk();
  if (!p || !(kg > 0)) return toast("Escribe el peso");
  if (!(pk > 0)) return toast("Escribe el precio por kilo");
  const total = w.mode === "add" ? r3(w.have + kg) : kg;
  if (setLine(p.id, "", total)) {
    const l = DB.cart.items.find((i) => lineKey(i.id, i.pres) === lineKey(p.id, ""));
    if (l) { if (pk !== p.price) l.pr = pk; else delete l.pr; save(); paintSale(); }
    ui.w = null; closeModal();
  }
}
// Etiqueta de balanza con código de barras: 2 + PLU + peso (g) o precio (céntimos) + dígito de control.
function parseLabel(code) {
  const L = DB.cfg.labels; if (!L.on || !/^2\d{12}$/.test(code)) return null;
  const pre = Math.min(3, Math.max(1, +L.pre || 2)), len = Math.min(6, Math.max(3, +L.len || 5));
  const plu = code.slice(pre, pre + len), val = parseInt(code.slice(pre + len, 12), 10);
  const p = DB.products.find((x) => x.code && x.code.replace(/^0+/, "") === plu.replace(/^0+/, ""));
  if (!p || !(val > 0)) return null;
  const qty = L.kind === "precio" ? r3(val / 100 / p.price) : p.unit === "kg" ? r3(val / 1000) : val;
  return qty > 0 ? { p, qty } : null;
}

/* ---------- prueba de la balanza (Ajustes) ---------- */
function openScaleTest() {
  openModal(`<h2>Probar balanza</h2><p class="muted" style="margin-bottom:10px">Pon algo en la balanza: aquí verás lo que envía y el peso que entiende Caja Fácil.</p>
    <div class="lcd live" id="stlcd"></div><p class="muted mono" id="straw" style="margin:8px 0 12px;word-break:break-all"></p>
    <div class="btns h"><button class="btn sec" data-a="close">Cerrar</button>${scaleState.on ? `<button class="btn red sec" data-a="scaleoff">Desconectar</button>` : `<button class="btn" data-a="scaleconnect">Conectar balanza</button>`}</div>`);
  ui.mk = "scaletest"; paintScaleTest(); if (scaleState.on) startPoll();
}
function paintScaleTest() {
  const el = $("#stlcd"); if (!el) return;
  el.innerHTML = `<div class="lrow main"><span>PESO</span><b class="num">${scaleState.kg.toFixed(3)}<i>kg</i></b></div><div class="lst">${scaleState.on ? (scaleState.last ? (scaleState.stable ? "Estable" : "En movimiento") : "Conectada. Esperando datos…") : "Sin conectar"}</div>`;
  const r = $("#straw"); if (r) r.textContent = scaleState.raw ? "Recibido: " + scaleState.raw : "Aún no llegan datos.";
}
act({
  wkey: (el) => weighKey(el.dataset.k),
  wtab: (el) => { const w = ui.w; if (!w) return; const t = el.dataset.t; if (t === "scale") { w.src = "scale"; startPoll(); } else { w.src = "manual"; w.tab = t; stopScaleRead(); } paintWeighLcd(); },
  wok: weighOk,
  scaletool: () => { if (scaleState.on) openScaleTest(); else if (serialOk() && DESK()) connectScale(true); else toast("Escribe el peso al tocar un producto por kilo. La balanza USB se conecta desde Chrome o Edge en la PC.", true); },
  scaleconnect: async () => { const ok = await connectScale(true); if (ok && ui.mk === "weigh" && ui.w) { const w = ui.w; openWeigh(w.id, w.mode); } else if (ui.mk === "scaletest") openScaleTest(); },
  scaleoff: async () => { await disconnectScale(); openScaleTest(); },
  scaletest: openScaleTest
});

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

/* ===================== 50 · CLIENTES: crédito, cuenta corriente, historial y puntos ===================== */
const clientSales = (c) => DB.sales.filter((s) => s.client === c.id);
// Cuenta corriente: cargos (ventas al crédito) y abonos (pagos y devoluciones), con saldo.
function ledgerOf(c) {
  const e = [];
  clientSales(c).forEach((s) => {
    if (s.void) return;
    const cr = paysOf(s).filter((p) => p.m === "credito").reduce((a, p) => a + p.amt, 0);
    if (cr > 0) e.push({ t: s.t, date: s.date, what: `Compra ${docShort(s)}`, cargo: r2(cr), abono: 0, sale: s.id });
    (s.returns || []).forEach((r) => { if (r.m === "credito") e.push({ t: r.t, date: dkey(new Date(r.t)), what: `Devolución ${docShort(s)}`, cargo: 0, abono: r.amount, sale: s.id }); });
  });
  DB.moves.filter((m) => m.type === "abono" && m.client === c.id).forEach((m) => e.push({ t: m.t, date: m.date, what: `Pago en ${METHODS[m.m] || "efectivo"}${m.note ? " · " + m.note : ""}`, cargo: 0, abono: m.amount, mv: m.id }));
  e.sort((a, b) => a.t - b.t);
  let bal = 0; e.forEach((x) => { bal = r2(bal + x.cargo - x.abono); x.bal = bal; });
  return e;
}
function balanceOf(c) { if (!c) return 0; const l = ledgerOf(c); return l.length ? Math.max(0, l[l.length - 1].bal) : 0; }
// Antigüedad: los pagos cubren primero las compras más antiguas.
function agingOf(c) {
  const l = ledgerOf(c); let paid = l.reduce((a, x) => a + x.abono, 0), oldest = null;
  for (const x of l) { if (!x.cargo) continue; if (paid >= x.cargo - 0.001) { paid = r2(paid - x.cargo); continue; } oldest = x.date; break; }
  const debt = balanceOf(c), days = oldest ? Math.round((pk(dkey()) - pk(oldest)) / 864e5) : 0;
  return { debt, oldest, days, late: debt > 0 && c.days > 0 && days > c.days };
}
function pointsOf(c) {
  if (!c) return 0;
  return Math.max(0, Math.floor(clientSales(c).filter((s) => !s.void).reduce((a, s) => a + (s.ptsEarn || 0) - (s.ptsUsed || 0), 0) + (+c.ptsAdj || 0)));
}
VIEWS.cli = function viewClients(v) {
  const all = DB.clients.map((c) => ({ c, a: agingOf(c) }));
  const debtors = all.filter((x) => x.a.debt > 0), late = all.filter((x) => x.a.late), tot = r2(debtors.reduce((a, x) => a + x.a.debt, 0));
  const F = [["todos", "Todos"], ["deuda", `Con deuda (${debtors.length})`], ["vencidos", `Vencidos (${late.length})`]];
  ui.cf = ui.cf || "todos";
  v.innerHTML = `<div class="ph"><h1>Clientes</h1><div class="row wrap">${can("clientes") ? `<button class="btn sm" data-a="clinewv">+ Nuevo cliente</button>` : ""}</div></div>
    <div class="sumrow"><div class="sum"><b>${DB.clients.length}</b><span>Clientes</span></div><div class="sum ${tot > 0 ? "warn" : ""}"><b class="num">${money(tot)}</b><span>Te deben (fiado)</span></div><div class="sum ${late.length ? "bad" : ""}"><b>${late.length}</b><span>Con pago vencido</span></div></div>
    <div class="seg tabs2">${F.map(([k, l]) => `<button class="${ui.cf === k ? "on" : ""}" data-a="cfil" data-f="${k}">${l}</button>`).join("")}</div>
    <input class="inp" id="cq" type="search" placeholder="Buscar por nombre, DNI, RUC o celular" style="margin-bottom:12px" value="${esc(ui.cq)}">
    <div class="list" id="clist"></div>`;
  paintCList();
};
function paintCList() {
  const el = $("#clist"); if (!el) return;
  if (!DB.clients.length) { el.innerHTML = `<div class="empty"><h2>Aún no tienes clientes</h2><p>Regístralos para venderles al crédito, darles factura o acumular puntos.</p></div>`; return; }
  const q = norm(ui.cq), raw = ui.cq || "";
  let list = DB.clients.map((c) => ({ c, a: agingOf(c) })).filter(({ c }) => !q || norm(c.name).includes(q) || (c.doc || "").includes(raw) || (c.phone || "").replace(/\D/g, "").includes(raw.replace(/\D/g, "") || "~"));
  if (ui.cf === "deuda") list = list.filter((x) => x.a.debt > 0); else if (ui.cf === "vencidos") list = list.filter((x) => x.a.late);
  list.sort((a, b) => b.a.debt - a.a.debt || a.c.name.localeCompare(b.c.name, "es"));
  el.innerHTML = list.slice(0, 300).map(({ c, a }) => { const pts = DB.cfg.pts.on ? pointsOf(c) : 0; return `<button class="it" data-a="cliopen" data-id="${c.id}"><span class="av" style="--h:${avHue(c)}">${esc(initials(c.name))}</span><div class="t"><b>${esc(c.name)}</b><small>${c.doc ? esc(c.dt + " " + c.doc) : "Sin documento"}${c.phone ? " · " + esc(fmtPhone(c.phone)) : ""}${pts ? ` · ${pts} pts` : ""}</small>${a.late ? ` <span class="tag out">Vencido hace ${a.days - c.days} d</span>` : ""}</div><div class="v num ${a.debt > 0 ? "warn" : ""}">${a.debt > 0 ? money(a.debt) : "Al día"}<small>${a.debt > 0 ? "debe" : ""}</small></div></button>`; }).join("") || `<div class="empty"><p>Nadie coincide con ese filtro.</p></div>`;
}
function openClient(id, cb) {
  const c = id ? cli(id) : { name: "", dt: "DNI", doc: "", phone: "", email: "", addr: "", limit: "", days: "", note: "" };
  ui.cecb = cb || null;
  openModal(`<h2>${id ? "Editar cliente" : "Nuevo cliente"}</h2>
    <label class="fld"><span>Nombre o razón social</span><input class="inp" id="ce-name" value="${esc(c.name)}" autofocus maxlength="80" autocomplete="off"></label>
    <div class="two"><label class="fld"><span>Documento</span><select class="inp" id="ce-dt">${["DNI", "RUC", "CE", ""].map((d) => `<option value="${d}" ${c.dt === d ? "selected" : ""}>${d || "Sin documento"}</option>`).join("")}</select></label>
      <label class="fld"><span>Número</span><input class="inp num" id="ce-doc" value="${esc(c.doc)}" inputmode="numeric" maxlength="12" autocomplete="off"></label></div>
    <div class="two"><label class="fld"><span>Celular (WhatsApp)</span><input class="inp num" id="ce-phone" value="${esc(c.phone)}" inputmode="tel" maxlength="15"></label>
      <label class="fld"><span>Correo</span><input class="inp" id="ce-email" value="${esc(c.email || "")}" inputmode="email" maxlength="60"></label></div>
    <label class="fld"><span>Dirección (sale en la factura)</span><input class="inp" id="ce-addr" value="${esc(c.addr || "")}" maxlength="100"></label>
    <div class="two"><label class="fld"><span>Límite de crédito S/ (0 = sin límite)</span><input class="inp num" id="ce-limit" value="${esc(c.limit || "")}" inputmode="decimal" placeholder="0"></label>
      <label class="fld"><span>Días para pagar</span><input class="inp num" id="ce-days" value="${esc(c.days || "")}" inputmode="numeric" placeholder="Ej: 15"></label></div>
    <label class="fld"><span>Nota</span><input class="inp" id="ce-note" value="${esc(c.note || "")}" maxlength="80" placeholder="Ej: paga los sábados"></label>
    <div class="btns h"><button class="btn sec" data-a="${cb ? "cecancel" : "close"}">Cancelar</button><button class="btn" data-enter data-a="clisave" data-id="${id || ""}">Guardar</button></div>
    ${id && can("clientes") ? `<button class="link" data-a="clidel" data-id="${id}" style="width:100%;color:var(--red)">Eliminar cliente</button>` : ""}`);
}
function saveClient(id) {
  const g = (k) => ($("#ce-" + k) || { value: "" }).value.trim();
  const name = g("name"), dt = g("dt"), doc = g("doc").replace(/\s/g, "");
  if (!name) return toast("Escribe el nombre");
  if (dt === "DNI" && doc && !dniOk(doc)) return toast("El DNI tiene 8 dígitos");
  if (dt === "RUC" && !rucOk(doc)) return toast("Ese RUC no es válido (11 dígitos)");
  if (doc && DB.clients.some((x) => x.doc === doc && x.id !== id)) return toast("Ya hay un cliente con ese documento");
  const data = { name, dt: doc ? dt : "", doc, phone: g("phone").replace(/[^\d+]/g, ""), email: g("email"), addr: g("addr"), limit: Math.max(0, r2(num(g("limit")))), days: Math.max(0, parseInt(g("days"), 10) || 0), note: g("note") };
  let c = id ? cli(id) : null;
  if (c) Object.assign(c, data); else { c = Object.assign({ id: uid(), t: Date.now() }, data); DB.clients.push(c); log("Cliente creado", name); }
  save(); const cb = ui.cecb; ui.cecb = null;
  if (cb) return cb(c);
  closeModal(); toast("Cliente guardado"); if (ui.tab === "cli") render();
}
function clientDetail(id, tab) {
  const c = cli(id); if (!c) return;
  const a = agingOf(c), l = ledgerOf(c), sales = clientSales(c).sort((x, y) => y.t - x.t), pts = pointsOf(c);
  const bought = r2(sales.filter((s) => !s.void).reduce((x, s) => x + s.total, 0));
  ui.ctab = tab || ui.ctab || "cuenta";
  openModal(`<div class="chead"><span class="av big" style="--h:${avHue(c)}">${esc(initials(c.name))}</span><div><h2>${esc(c.name)}</h2><p class="muted">${c.doc ? esc(c.dt + " " + c.doc) : "Sin documento"}${c.phone ? " · " + esc(fmtPhone(c.phone)) : ""}${c.addr ? " · " + esc(c.addr) : ""}</p>${c.note ? `<p class="muted sm">${esc(c.note)}</p>` : ""}</div></div>
    <div class="sumrow"><div class="sum ${a.debt > 0 ? "warn" : ""}"><b class="num">${money(a.debt)}</b><span>Debe${a.late ? ` · vencido` : ""}</span></div><div class="sum"><b class="num">${c.limit ? money(c.limit) : "—"}</b><span>Límite${c.days ? ` · ${c.days} días` : ""}</span></div><div class="sum"><b class="num">${money(bought)}</b><span>${sales.length} compras${DB.cfg.pts.on ? ` · ${pts} pts` : ""}</span></div></div>
    <div class="row wrap" style="margin-bottom:12px">${a.debt > 0 ? `<button class="btn sm" data-a="abono" data-id="${c.id}">Cobrar deuda</button>${c.phone ? `<button class="btn sec sm" data-a="cliwa" data-id="${c.id}">${svg("wa", "bi")}Recordar por WhatsApp</button>` : ""}` : ""}<button class="btn sec sm" data-a="cliprint" data-id="${c.id}">${svg("print", "bi")}Estado de cuenta</button>${can("clientes") ? `<button class="btn sec sm" data-a="cliedit" data-id="${c.id}">Editar datos</button>` : ""}${DB.cfg.pts.on && can("ajustes") ? `<button class="btn sec sm" data-a="ptsadj" data-id="${c.id}">Ajustar puntos</button>` : ""}</div>
    <div class="seg tabs2"><button class="${ui.ctab === "cuenta" ? "on" : ""}" data-a="ctab" data-t="cuenta" data-id="${c.id}">Cuenta corriente</button><button class="${ui.ctab === "hist" ? "on" : ""}" data-a="ctab" data-t="hist" data-id="${c.id}">Historial de compras</button></div>
    ${ui.ctab === "cuenta" ? (l.length ? `<div class="tablewrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Detalle</th><th class="r">Cargo</th><th class="r">Abono</th><th class="r">Saldo</th></tr></thead><tbody>${l.slice().reverse().map((x) => `<tr ${x.sale ? `data-a="sale" data-id="${x.sale}" class="click"` : ""}><td>${dmy(x.date)}</td><td>${esc(x.what)}</td><td class="r num">${x.cargo ? money(x.cargo) : ""}</td><td class="r num gain">${x.abono ? money(x.abono) : ""}</td><td class="r num"><b>${money(x.bal)}</b></td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">No tiene compras al crédito.</p>`)
    : (sales.length ? `<div class="list">${sales.slice(0, 100).map((s) => `<button class="it sm" data-a="sale" data-id="${s.id}"><div class="t"><b>${DOCS[s.doc.type]} ${docShort(s)}</b><small>${dmy(s.date)} ${hhmm(s.t)} · ${esc(methodLabel(s))} · ${s.items.length} ítems</small>${s.void ? ` <span class="tag void">Anulada</span>` : ""}</div><div class="v num">${money(s.total)}</div></button>`).join("")}</div>` : `<p class="muted">Aún no compra nada.</p>`)}
    <div class="btns"><button class="btn sec" data-a="close">Cerrar</button></div>`, "wide");
}
function openAbono(id) {
  const c = cli(id); if (!c) return; const debt = balanceOf(c);
  ui.ab = { id, m: "efectivo" };
  openModal(`<h2>Cobrar deuda</h2><p class="muted" style="margin-bottom:12px">${esc(c.name)} debe <b>${money(debt)}</b>.</p>
    <label class="fld"><span>Monto que paga (S/)</span><input class="inp num big" id="abq" inputmode="decimal" value="${debt.toFixed(2)}" autofocus></label>
    <div class="methods" id="abm">${["efectivo", "yape", "plin", "tarjeta", "transferencia"].map((m) => `<button class="mth ${m === "efectivo" ? "on" : ""}" data-a="abm" data-m="${m}">${METHODS[m]}</button>`).join("")}</div>
    <label class="fld"><span>Nota (opcional)</span><input class="inp" id="abn" maxlength="50"></label>
    <div class="btns h"><button class="btn sec" data-a="cliopen" data-id="${id}">Volver</button><button class="btn" data-enter data-a="abok">Registrar pago</button></div>`);
}
function stmtHtml(c) {
  const l = ledgerOf(c);
  return `<h2>Estado de cuenta</h2><p><b>${esc(c.name)}</b>${c.doc ? " · " + esc(c.dt + " " + c.doc) : ""}<br>${esc(DB.biz.name)} · ${fmtDT(Date.now())}</p>
    <table class="tbl"><thead><tr><th>Fecha</th><th>Detalle</th><th class="r">Cargo</th><th class="r">Abono</th><th class="r">Saldo</th></tr></thead><tbody>${l.map((x) => `<tr><td>${dmy(x.date)}</td><td>${esc(x.what)}</td><td class="r">${x.cargo ? money(x.cargo) : ""}</td><td class="r">${x.abono ? money(x.abono) : ""}</td><td class="r">${money(x.bal)}</td></tr>`).join("")}</tbody></table>
    <p style="font-size:1.2em"><b>Saldo pendiente: ${money(balanceOf(c))}</b></p>`;
}
act({
  clinewv: () => need("clientes", () => openClient("")),
  cliopen: (el) => clientDetail(el.dataset.id),
  cliedit: (el) => need("clientes", () => openClient(el.dataset.id, () => clientDetail(el.dataset.id))),
  clisave: (el) => saveClient(el.dataset.id),
  cecancel: () => { ui.cecb = null; closeModal(); },
  clidel: (el) => {
    const c = cli(el.dataset.id); if (!c) return;
    if (balanceOf(c) > 0) return toast("No puedes eliminar un cliente que tiene deuda");
    need("clientes", () => confirmBox(`¿Eliminar a ${c.name}?`, "Eliminar", () => { DB.clients = DB.clients.filter((x) => x !== c); DB.tickets.forEach((t) => { if (t.client === c.id) t.client = ""; }); log("Cliente eliminado", c.name); save(); render(); }, true, "Sus ventas pasadas conservan su nombre."));
  },
  ctab: (el) => clientDetail(el.dataset.id, el.dataset.t),
  cfil: (el) => { ui.cf = el.dataset.f; render(); },
  abono: (el) => need("abonos", () => openAbono(el.dataset.id), "Cobrar deuda"),
  abm: (el) => { ui.ab.m = el.dataset.m; $$("#abm .mth").forEach((b) => b.classList.toggle("on", b.dataset.m === ui.ab.m)); },
  abok: () => {
    const c = cli(ui.ab.id), amt = r2(num($("#abq").value)), debt = balanceOf(c);
    if (!(amt > 0)) return toast("Escribe el monto");
    if (amt > debt + 0.001) return toast(`No puede pagar más de lo que debe (${money(debt)})`);
    const m = addMove("abono", amt, $("#abn").value.trim(), { client: c.id, m: ui.ab.m });
    log("Cobro de deuda", `${c.name}: ${money(amt)} (${METHODS[ui.ab.m]})`);
    save(); toast(`Pago registrado. Ahora debe ${money(balanceOf(c))}`);
    openModal(`<div class="rcpt"><h3>${esc(DB.biz.name)}</h3><div class="c doc"><b>RECIBO DE PAGO</b></div><div class="l"><span>Fecha</span><span>${fmtDT(m.t)}</span></div><div class="l"><span>Cliente</span><span>${esc(c.name)}</span></div><hr><div class="l t"><span>PAGÓ</span><span>${money(amt)}</span></div><div class="l"><span>Medio</span><span>${METHODS[ui.ab.m]}</span></div><div class="l"><span>Saldo pendiente</span><span>${money(balanceOf(c))}</span></div><hr><div class="c">Atendido por ${esc(me().name)}</div></div>
      <div class="btns h"><button class="btn sec" data-a="abprint">${svg("print", "bi")}Imprimir</button><button class="btn" data-a="cliopen" data-id="${c.id}">Listo</button></div>`);
    ui.abhtml = $(".rcpt").innerHTML; if (ui.tab === "cli") VIEWS.cli($("#view"));
  },
  abprint: () => printHtml(ui.abhtml || ""),
  cliwa: (el) => { const c = cli(el.dataset.id); if (!c) return; window.open(`https://wa.me/51${c.phone.replace(/\D/g, "").slice(-9)}?text=` + encodeURIComponent(`Hola ${c.name.split(" ")[0]}, te saluda ${DB.biz.name}. Tu saldo pendiente es de ${money(balanceOf(c))}. ¡Gracias por tu preferencia!`), "_blank", "noopener"); },
  cliprint: (el) => { const c = cli(el.dataset.id); if (c) printHtml(stmtHtml(c), "rep"); },
  ptsadj: (el) => { const c = cli(el.dataset.id); promptBox({ title: "Ajustar puntos", text: `${esc(c.name)} tiene ${pointsOf(c)} puntos. Escribe cuántos sumar (o con signo menos para restar).`, label: "Puntos", num: true, ph: "Ej: 50 o -20" }, (v) => { const n = parseInt(v, 10); if (!n) return; c.ptsAdj = (+c.ptsAdj || 0) + n; log("Ajuste de puntos", `${c.name}: ${n}`); save(); clientDetail(c.id); }); }
});

/* ===================== 60 · CAJA: turnos por cajero, movimientos, arqueo, cierre del día y períodos ===================== */
const MOVE = { ingreso: ["Otro ingreso", 1], abono: ["Cobro de deuda", 1], proveedor: ["Pago a proveedor", -1], gasto: ["Gasto", -1], retiro: ["Retiro de efectivo", -1], devolucion: ["Devolución", -1], anulacion: ["Venta anulada (reembolso)", -1], yape: ["Yape anotado", 0] };
function addMove(type, amount, note, extra = {}) {
  const sh = curShift(), u = me();
  const m = Object.assign({ id: uid(), date: dkey(), t: Date.now(), type, amount: r2(amount), note: note || "", u: u ? u.name : "", uid: u ? u.id : "", shift: sh ? sh.id : "", m: "efectivo" }, extra);
  DB.moves.push(m); save(); return m;
}
// Efecto de un movimiento en el efectivo del cajón.
const cashEffect = (m) => { const d = (MOVE[m.type] || ["", 0])[1]; return d && (m.m || "efectivo") === "efectivo" ? d * m.amount : 0; };
const curShift = () => DB.shifts.find((s) => s.u === ui.user && !s.t1) || null;
const openShifts = () => DB.shifts.filter((s) => !s.t1);
// Ventas que cuentan en un turno: las anuladas en ese mismo turno no cuentan; si se anularon después, el reembolso sale en el turno donde se anuló.
const shiftSales = (sh) => DB.sales.filter((s) => s.shift === sh.id && (!s.void || (s.void.shift && s.void.shift !== sh.id)));
function sumPays(sales) { const by = {}; sales.forEach((s) => paysOf(s).forEach((p) => { by[p.m] = r2((by[p.m] || 0) + p.amt); })); return by; }
function shiftSummary(sh) {
  const sales = shiftSales(sh), by = sumPays(sales), moves = DB.moves.filter((m) => m.shift === sh.id);
  const mv = (t, cashOnly) => r2(moves.filter((m) => m.type === t && (!cashOnly || (m.m || "efectivo") === "efectivo")).reduce((a, m) => a + m.amount, 0));
  const cashMoves = r2(moves.reduce((a, m) => a + cashEffect(m), 0));
  const expected = r2((sh.open || 0) + (by.efectivo || 0) + cashMoves);
  return { n: sales.length, total: r2(sales.reduce((a, s) => a + s.total, 0)), by, abonos: mv("abono"), abonosCash: mv("abono", true), ingresos: mv("ingreso"), gastos: mv("gasto"), prov: mv("proveedor"), retiros: mv("retiro"), devol: mv("devolucion"), anul: mv("anulacion"), yapes: mv("yape"), expected, voids: DB.sales.filter((s) => s.void && s.void.shift === sh.id).length };
}
function dayTotals(k) {
  const sales = DB.sales.filter((s) => s.date === k && !s.void), by = sumPays(sales), moves = DB.moves.filter((m) => m.date === k);
  const mv = (t) => r2(moves.filter((m) => m.type === t).reduce((a, m) => a + m.amount, 0));
  const ret = r2(sales.reduce((a, s) => a + (s.returns || []).reduce((b, r) => b + r.amount, 0), 0));
  const total = r2(sales.reduce((a, s) => a + s.total, 0));
  return { n: sales.length, total, by, efectivo: by.efectivo || 0, yape: by.yape || 0, plin: by.plin || 0, tarjeta: by.tarjeta || 0, yapeMan: mv("yape"), yapeAll: r2((by.yape || 0) + mv("yape")), abonos: mv("abono"), gastos: mv("gasto"), prov: mv("proveedor"), retiros: mv("retiro"), ingresos: mv("ingreso"), devol: mv("devolucion"), ret, sales: r2(total + mv("yape")), voids: DB.sales.filter((s) => s.date === k && s.void).length };
}
function expectedCash(k) { return r2(DB.shifts.filter((s) => s.d0 === k).reduce((a, s) => a + (s.t1 ? s.expected : shiftSummary(s).expected), 0)); }
const countTotal = (q) => r2(DENOMS.reduce((a, d) => a + d * (q[d] || 0), 0));

/* ---------- abrir y cerrar caja ---------- */
function openShift(after) {
  const last = DB.shifts.filter((s) => s.t1).sort((a, b) => b.t1 - a.t1)[0];
  openModal(`<div class="qhead"><img class="qimg" src="${(window.CF_IMG || {}).dinero || ""}" alt=""><div><h2>Abrir caja</h2><p class="muted">${esc(me().name)} · ${fmtDT(Date.now())}</p></div></div>
    <label class="fld"><span>¿Con cuánto efectivo empiezas? (sencillo en el cajón)</span><input class="inp num big" id="shopen" inputmode="decimal" placeholder="0.00" autofocus></label>
    ${last ? `<p class="muted" style="margin:-4px 0 12px">El último cierre (${esc(last.un)}) contó ${money(last.counted)}.</p>` : ""}
    <div class="btns h"><button class="btn sec" data-a="close">Ahora no</button><button class="btn" data-enter id="shok">Abrir caja</button></div>`);
  $("#shok").onclick = (e) => {
    e.stopPropagation();
    const u = me(), sh = { id: uid(), u: u.id, un: u.name, t0: Date.now(), d0: dkey(), open: Math.max(0, r2(num($("#shopen").value))), t1: 0 };
    DB.shifts.push(sh); log("Apertura de caja", `${u.name}: ${money(sh.open)}`); save(); closeModal(); toast("Caja abierta"); paintNav();
    if (after) after(); else render();
  };
}
// Sin rodeos: la caja se abre sola en el primer cobro; el sencillo inicial se anota cuando quieras desde Caja.
function autoShift() {
  const u = me(); if (!u || curShift()) return;
  const sh = { id: uid(), u: u.id, un: u.name, t0: Date.now(), d0: dkey(), open: 0, t1: 0, auto: true };
  DB.shifts.push(sh); log("Apertura de caja", `${u.name}: automática al primer cobro`); save(); paintNav();
  toast("Abrimos tu caja. Anota tu sencillo en Caja");
}
function closeShiftUI(id) {
  const sh = DB.shifts.find((s) => s.id === id); if (!sh) return;
  ui.cnt = ui.cnt && ui.cnt.id === id ? ui.cnt : { id, q: {}, direct: "" };
  const S = shiftSummary(sh), q = ui.cnt.q, counted = ui.cnt.direct !== "" ? r2(num(ui.cnt.direct)) : countTotal(q), diff = r2(counted - S.expected), any = ui.cnt.direct !== "" || Object.values(q).some((n) => n > 0);
  openModal(`<h2>Cerrar caja de ${esc(sh.un)}</h2><p class="muted" style="margin-bottom:10px">Abierta ${fmtDT(sh.t0)} · ${S.n} ventas</p>
    <div class="cols2"><div>
      <div class="kv"><span>Caja inicial</span><b class="num">${money(sh.open)}</b></div>
      <div class="kv"><span>+ Ventas en efectivo</span><b class="num">${money(S.by.efectivo || 0)}</b></div>
      ${S.abonosCash ? `<div class="kv"><span>+ Cobros de deudas</span><b class="num">${money(S.abonosCash)}</b></div>` : ""}${S.ingresos ? `<div class="kv"><span>+ Otros ingresos</span><b class="num">${money(S.ingresos)}</b></div>` : ""}
      ${S.prov ? `<div class="kv"><span>− Proveedores</span><b class="num">${money(S.prov)}</b></div>` : ""}${S.gastos ? `<div class="kv"><span>− Gastos</span><b class="num">${money(S.gastos)}</b></div>` : ""}${S.retiros ? `<div class="kv"><span>− Retiros</span><b class="num">${money(S.retiros)}</b></div>` : ""}${S.devol || S.anul ? `<div class="kv"><span>− Devoluciones y anulaciones</span><b class="num">${money(S.devol + S.anul)}</b></div>` : ""}
      <div class="kv strong"><span>Debe haber</span><b class="num">${money(S.expected)}</b></div>
      <div class="kv"><span>Yape / Plin / tarjeta</span><b class="num">${money((S.by.yape || 0) + (S.by.plin || 0) + (S.by.tarjeta || 0) + (S.by.transferencia || 0))}</b></div>
      ${S.by.credito ? `<div class="kv"><span>Ventas al crédito</span><b class="num">${money(S.by.credito)}</b></div>` : ""}
      ${any ? `<div class="verdict ${diff === 0 ? "ok" : diff < 0 ? "short" : "over"}"><span>${diff === 0 ? "La caja cuadra" : diff < 0 ? "Falta dinero" : "Sobra dinero"}</span><b class="num">${money(Math.abs(diff))}</b></div>` : ""}
    </div><div>
      <p class="muted" style="margin-bottom:6px">Cuenta billetes y monedas (o escribe el total abajo):</p>
      ${DENOMS.map((d) => `<div class="den"><b class="num">S/ ${d < 1 ? d.toFixed(2) : d}</b><span class="step"><button data-a="den" data-d="${d}" data-v="-1" aria-label="Quitar">−</button><span class="num">${q[d] || 0}</span><button data-a="den" data-d="${d}" data-v="1" aria-label="Agregar">+</button></span><span class="s num">${money(d * (q[d] || 0))}</span></div>`).join("")}
      <label class="fld" style="margin-top:8px"><span>Total contado (S/)</span><input class="inp num" id="cntd" inputmode="decimal" value="${ui.cnt.direct !== "" ? esc(ui.cnt.direct) : any ? counted.toFixed(2) : ""}" placeholder="0.00"></label>
    </div></div>
    <label class="fld"><span>Observación (opcional)</span><input class="inp" id="cntn" maxlength="60"></label>
    <div class="btns h"><button class="btn sec" data-a="cntcancel">Cancelar</button><button class="btn" data-a="shclose" data-id="${sh.id}" ${any ? "" : "disabled"}>Cerrar caja e imprimir</button></div>`, "wide");
  ui.mk = "count";
}
function liqHtml(sh) {
  const S = sh.sum || shiftSummary(sh);
  return `<h3>${esc(DB.biz.name)}</h3><div class="c doc"><b>LIQUIDACIÓN DE CAJA</b></div>
    <div class="l"><span>Cajero</span><span>${esc(sh.un)}</span></div><div class="l"><span>Apertura</span><span>${fmtDT(sh.t0)}</span></div>${sh.t1 ? `<div class="l"><span>Cierre</span><span>${fmtDT(sh.t1)}</span></div>` : ""}<hr>
    <div class="l"><span>Ventas (${S.n})</span><span>${money(S.total)}</span></div>
    ${Object.entries(S.by).map(([m, a]) => `<div class="l"><span>  ${METHODS[m] || m}</span><span>${money(a)}</span></div>`).join("")}
    ${S.abonos ? `<div class="l"><span>Cobros de deudas</span><span>${money(S.abonos)}</span></div>` : ""}${S.ingresos ? `<div class="l"><span>Otros ingresos</span><span>${money(S.ingresos)}</span></div>` : ""}
    ${S.prov ? `<div class="l"><span>Proveedores</span><span>- ${money(S.prov)}</span></div>` : ""}${S.gastos ? `<div class="l"><span>Gastos</span><span>- ${money(S.gastos)}</span></div>` : ""}${S.retiros ? `<div class="l"><span>Retiros</span><span>- ${money(S.retiros)}</span></div>` : ""}${S.devol || S.anul ? `<div class="l"><span>Devoluciones/anulaciones</span><span>- ${money(S.devol + S.anul)}</span></div>` : ""}
    <hr><div class="l"><span>Caja inicial</span><span>${money(sh.open)}</span></div><div class="l t"><span>EFECTIVO ESPERADO</span><span>${money(sh.t1 ? sh.expected : S.expected)}</span></div>
    ${sh.t1 ? `<div class="l t"><span>CONTADO</span><span>${money(sh.counted)}</span></div><div class="l t"><span>${sh.diff === 0 ? "CUADRA" : sh.diff < 0 ? "FALTANTE" : "SOBRANTE"}</span><span>${money(Math.abs(sh.diff))}</span></div>` : ""}
    ${sh.note ? `<div class="c">${esc(sh.note)}</div>` : ""}<hr><div class="c">Firma: ____________________</div>`;
}
function zSummary(k) {
  const T = dayTotals(k), sales = DB.sales.filter((s) => s.date === k), docs = {};
  sales.forEach((s) => { const d = s.doc || { type: "NV", s: "NV01", n: s.id }, o = docs[d.s] || (docs[d.s] = { type: d.type, from: d.n, to: d.n, n: 0, total: 0, igv: 0 }); o.from = Math.min(o.from, d.n); o.to = Math.max(o.to, d.n); if (!s.void) { o.n++; o.total = r2(o.total + s.total); o.igv = r2(o.igv + (s.igv || 0)); } });
  const shifts = DB.shifts.filter((s) => s.d0 === k);
  return { T, docs, shifts: shifts.map((s) => ({ un: s.un, expected: s.t1 ? s.expected : shiftSummary(s).expected, counted: s.counted || 0, diff: s.diff || 0, open: !s.t1 })), counted: r2(shifts.reduce((a, s) => a + (s.counted || 0), 0)), expected: expectedCash(k) };
}
function zHtml(z) {
  const S = z.sum, T = S.T;
  return `<h3>${esc(DB.biz.name)}</h3>${DB.biz.ruc ? `<div class="c">RUC ${esc(DB.biz.ruc)}</div>` : ""}<div class="c doc"><b>CIERRE DEL DÍA (Z) N° ${pad(z.z, 4)}</b></div><div class="c">${dmy(z.date)} · ${esc(DB.biz.store)}</div><div class="c">Hecho por ${esc(z.un)} · ${fmtDT(z.t)}</div><hr>
    <div class="l"><span>Ventas (${T.n})</span><span>${money(T.total)}</span></div>${Object.entries(T.by).map(([m, a]) => `<div class="l"><span>  ${METHODS[m] || m}</span><span>${money(a)}</span></div>`).join("")}
    ${T.yapeMan ? `<div class="l"><span>Yapes anotados</span><span>${money(T.yapeMan)}</span></div>` : ""}${T.abonos ? `<div class="l"><span>Cobros de deudas</span><span>${money(T.abonos)}</span></div>` : ""}
    ${T.ret ? `<div class="l"><span>Devoluciones</span><span>- ${money(T.ret)}</span></div>` : ""}${T.voids ? `<div class="l"><span>Ventas anuladas</span><span>${T.voids}</span></div>` : ""}
    ${T.gastos || T.prov ? `<div class="l"><span>Gastos y proveedores</span><span>- ${money(T.gastos + T.prov)}</span></div>` : ""}<hr>
    <div class="c"><b>Comprobantes</b></div>${Object.entries(S.docs).map(([s, o]) => `<div class="l"><span>${s} ${o.from}–${o.to} (${o.n})</span><span>${money(o.total)}</span></div>`).join("") || `<div class="c">Sin comprobantes</div>`}
    ${DB.cfg.igvOn ? `<div class="l"><span>IGV incluido</span><span>${money(Object.values(S.docs).reduce((a, o) => a + o.igv, 0))}</span></div>` : ""}<hr>
    <div class="c"><b>Cajas</b></div>${S.shifts.map((s) => `<div class="l"><span>${esc(s.un)}${s.open ? " (abierta)" : ""}</span><span>${money(s.counted)} / ${money(s.expected)}</span></div>`).join("")}
    <div class="l t"><span>EFECTIVO ESPERADO</span><span>${money(S.expected)}</span></div><div class="l t"><span>CONTADO</span><span>${money(S.counted)}</span></div><div class="l t"><span>DIFERENCIA</span><span>${money(r2(S.counted - S.expected))}</span></div>`;
}

/* ---------- pantalla de caja ---------- */
VIEWS.caja = function viewCash(v) {
  const k = ui.date, T = dayTotals(k), mine = curShift(), today = k === dkey();
  const shifts = DB.shifts.filter((s) => s.d0 === k || (!s.t1 && today)).filter((s, i, a) => a.indexOf(s) === i).sort((a, b) => a.t0 - b.t0);
  const moves = DB.moves.filter((m) => m.date === k).sort((a, b) => b.t - a.t);
  const z = DB.closes.find((x) => x.date === k), others = shifts.filter((s) => !s.t1 && s.u !== ui.user);
  const MS = mine ? shiftSummary(mine) : null;
  v.innerHTML = `<div class="ph"><h1>Caja</h1>${can("caja") ? `<div class="row wrap"><button class="btn sec sm" data-a="mv" data-t="gasto">Gasto</button><button class="btn sec sm" data-a="tab" data-t="prov">Proveedores</button><button class="btn sec sm" data-a="mv" data-t="ingreso">Ingreso</button><button class="btn sec sm" data-a="mv" data-t="retiro">Retiro</button><button class="btn sec sm" data-a="mv" data-t="yape">Anotar Yapes</button></div>` : ""}</div>
    <div class="datebar"><button data-a="dstep" data-d="-1" aria-label="Día anterior">‹</button><label><span>${esc(fmtDate(k))}${!today ? ` · ${dmy(k)}` : ""}</span><input type="date" value="${k}" max="${dkey()}" data-in="date" aria-label="Elegir fecha"></label><button data-a="dstep" data-d="1" aria-label="Día siguiente" ${today ? "disabled" : ""}>›</button></div>
    ${today && can("caja") ? `<div class="card shiftcard ${mine ? "open" : ""}">${mine ? `<div class="row sp wrap"><div><h2>Tu caja está abierta</h2><p class="muted">Desde ${hhmm(mine.t0)} · empezaste con ${money(mine.open)} <button class="link xs" data-a="shopenedit" data-id="${mine.id}">${mine.open ? "Cambiar" : "Anotar sencillo"}</button> · ${MS.n} ventas</p></div><div class="bigcash"><span>Efectivo que debe haber</span><b class="num">${money(MS.expected)}</b></div></div>
      <div class="row wrap" style="margin-top:12px"><button class="btn" data-a="shcount" data-id="${mine.id}">Cerrar mi caja (arqueo)</button><button class="btn sec" data-a="liqprint" data-id="${mine.id}">${svg("print", "bi")}Corte parcial</button></div>`
      : `<div class="row sp wrap"><div><h2>Tu caja está cerrada</h2><p class="muted">Ábrela con el sencillo del cajón para empezar a cobrar.</p></div><button class="btn" data-a="shopen">Abrir caja</button></div>`}</div>` : ""}
    <div class="cols stack"><div class="stack">
      <div class="card"><h2>Ventas del día</h2>
        ${["efectivo", "yape", "plin", "tarjeta", "transferencia", "credito", "puntos"].filter((m) => T.by[m] || ["efectivo", "yape", "tarjeta"].includes(m)).map((m) => `<div class="kv"><span>${METHODS[m]}${m === "yape" && T.yapeMan ? ` (+ ${money(T.yapeMan)} anotados)` : ""}</span><span class="num">${money(m === "yape" ? T.yapeAll : T.by[m] || 0)}</span></div>`).join("")}
        <div class="kv strong"><span>Total vendido (${T.n} ventas)</span><span class="num">${money(T.sales)}</span></div>
        ${T.abonos ? `<div class="kv"><span>Cobros de deudas</span><span class="num">${money(T.abonos)}</span></div>` : ""}${T.ret ? `<div class="kv"><span>Devoluciones</span><span class="num">− ${money(T.ret)}</span></div>` : ""}${T.voids ? `<div class="kv"><span>Ventas anuladas</span><span class="num">${T.voids}</span></div>` : ""}</div>
      <div class="card"><h2>Movimientos</h2>${moves.length ? moves.map((m) => `<div class="kv"><span>${hhmm(m.t)} · ${MOVE[m.type] ? MOVE[m.type][0] : m.type}${m.m && m.m !== "efectivo" ? ` (${METHODS[m.m]})` : ""}${m.note ? " · " + esc(m.note) : ""}<small class="muted"> · ${esc(m.u || "")}</small></span><span class="num">${(MOVE[m.type] || [0, 0])[1] < 0 ? "−" : "+"} ${money(m.amount)}${can("cierre") && !["abono", "devolucion", "anulacion"].includes(m.type) && !isLocked(m.date) ? ` <button class="link xs" data-a="mvdel" data-id="${m.id}" aria-label="Borrar movimiento">✕</button>` : ""}</span></div>`).join("") : `<p class="muted">Sin gastos, pagos ni ingresos anotados.</p>`}</div>
    </div><div class="stack">
      <div class="card"><h2>Cajas del día</h2>${shifts.length ? shifts.map((s) => { const S = s.t1 ? null : shiftSummary(s); return `<div class="kv click" data-a="liq" data-id="${s.id}"><span><b>${esc(s.un)}</b><small class="muted"> · ${hhmm(s.t0)}${s.t1 ? "–" + hhmm(s.t1) : " · abierta"}</small></span><span class="num">${s.t1 ? `${money(s.counted)} <span class="tag ${s.diff === 0 ? "" : s.diff < 0 ? "out" : "low"}">${s.diff === 0 ? "cuadra" : (s.diff < 0 ? "falta " : "sobra ") + money(Math.abs(s.diff))}</span>` : `${money(S.expected)} <span class="tag">abierta</span>`}</span></div>`; }).join("") : `<p class="muted">Nadie abrió caja este día.</p>`}
        ${others.length && can("cierre") ? `<p class="muted sm" style="margin-top:8px">Como supervisor puedes cerrar una caja ajena tocándola.</p>` : ""}</div>
      ${can("cierre") ? `<div class="card"><h2>Cierre del día (Z)</h2>${z ? `<p>Cerrado por ${esc(z.un)} a las ${hhmm(z.t)} · Z N° ${pad(z.z, 4)}</p><div class="row wrap" style="margin-top:10px"><button class="btn sec" data-a="zprint" data-id="${z.id}">${svg("print", "bi")}Imprimir Z</button></div>`
        : `<p class="muted" style="margin-bottom:10px">Resume ventas, comprobantes y cajas del día. ${shifts.some((s) => !s.t1) ? "<b>Primero cierren las cajas abiertas.</b>" : ""}</p><button class="btn" data-a="zclose" ${shifts.some((s) => !s.t1) || (!T.n && !shifts.length) ? "disabled" : ""}>Hacer cierre del día</button>`}</div>
      <div class="card"><h2>Períodos</h2><p class="muted" style="margin-bottom:10px">Al cerrar un mes, sus ventas ya no se pueden anular ni devolver.</p>${DB.periods.slice(-4).reverse().map((p) => `<div class="kv"><span>${esc(p.label)}</span><span class="num">${money(p.total)} <small class="muted">· ${p.n} ventas</small></span></div>`).join("")}<button class="btn sec sm" data-a="period" style="margin-top:8px">Cerrar un mes</button></div>` : ""}
    </div></div>`;
};
function openMove(type) {
  const T = { yape: ["Anotar Yapes", "Yapes que recibiste y no registraste como venta. Escribe los montos separados por espacio. Ej: 5 10 7.50"], proveedor: ["Pago a proveedor", "Sale del efectivo de la caja."], gasto: ["Gasto", "Sale del efectivo de la caja. Ej: pasaje, bolsas, luz."], ingreso: ["Otro ingreso", "Entra dinero a la caja que no es venta. Ej: sencillo que trajiste."], retiro: ["Retiro de efectivo", "Dinero que sacas de la caja para guardarlo o depositarlo."] }[type];
  openModal(`<h2>${T[0]}</h2><p class="muted" style="margin-bottom:12px">${T[1]}</p>
    ${type === "yape" ? `<label class="fld"><span>Montos recibidos (S/)</span><input class="inp num" id="mva" inputmode="decimal" placeholder="5 10 7.50" autofocus autocomplete="off"></label><p class="muted" id="mvsum" style="margin-bottom:6px"></p>`
      : `<label class="fld"><span>Monto (S/)</span><input class="inp num big" id="mva" inputmode="decimal" placeholder="0.00" autofocus></label><label class="fld"><span>${type === "proveedor" ? "Proveedor" : "Detalle"}</span><input class="inp" id="mvn" placeholder="${type === "proveedor" ? "Ej: Distribuidora Lima" : "Opcional"}" maxlength="50"></label>`}
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" data-enter data-a="mvsave" data-t="${type}">Guardar</button></div>`);
}
function closePeriodUI() {
  const cur = mOf(), months = [...new Set(DB.sales.map((s) => mOf(s.date)))].filter((m) => !DB.periods.some((p) => p.m === m)).sort();
  if (!months.length) return toast("No hay meses con ventas por cerrar");
  openModal(`<h2>Cerrar un mes</h2><p class="muted" style="margin-bottom:12px">Guarda el resumen del mes y bloquea anulaciones y devoluciones de esas ventas.</p>
    <label class="fld"><span>Mes</span><select class="inp" id="pmon">${months.map((m) => `<option value="${m}" ${m === (months.includes(addD(cur + "-01", -1).slice(0, 7)) ? addD(cur + "-01", -1).slice(0, 7) : cur) ? "selected" : ""}>${monthName(m)}${m === cur ? " (en curso)" : ""}</option>`).join("")}</select></label>
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" data-a="periodok">Cerrar mes</button></div>`);
}
act({
  dstep: (el) => { const k = addD(ui.date, +el.dataset.d); if (k <= dkey()) { ui.date = k; render(); } },
  shopen: () => openShift(),
  shopenedit: (el) => {
    const sh = DB.shifts.find((x) => x.id === el.dataset.id); if (!sh || sh.t1) return;
    promptBox({ title: "Sencillo inicial", text: "¿Con cuánto efectivo empezaste en el cajón? Sirve para que el arqueo cuadre.", label: "Monto (S/)", num: true, value: sh.open ? sh.open.toFixed(2) : "", ph: "0.00", ok: "Guardar" }, (v) => {
      const n = Math.max(0, r2(num(v))); log("Sencillo inicial", `${sh.un}: ${money(sh.open)} → ${money(n)}`); sh.open = n; save(); toast("Guardado"); render();
    });
  },
  shcount: (el) => { ui.cnt = null; closeShiftUI(el.dataset.id); },
  liq: (el) => {
    const sh = DB.shifts.find((s) => s.id === el.dataset.id); if (!sh) return;
    if (!sh.t1 && sh.u !== ui.user) return can("cierre") ? confirmBox(`¿Cerrar la caja de ${sh.un}?`, "Hacer arqueo", () => { ui.cnt = null; closeShiftUI(sh.id); }, false) : toast("Solo un supervisor puede cerrar una caja ajena");
    if (!sh.t1) { ui.cnt = null; return closeShiftUI(sh.id); }
    openModal(`<div class="rcpt">${liqHtml(sh)}</div><div class="btns h"><button class="btn sec" data-a="close">Cerrar</button><button class="btn" data-a="liqprint" data-id="${sh.id}">${svg("print", "bi")}Imprimir</button></div>`);
  },
  liqprint: (el) => { const sh = DB.shifts.find((s) => s.id === el.dataset.id); if (sh) printHtml(liqHtml(sh)); },
  den: (el) => { const c = ui.cnt; if (!c) return; const d = el.dataset.d; c.q[d] = Math.max(0, (c.q[d] || 0) + +el.dataset.v); c.direct = ""; closeShiftUI(c.id); },
  cntcancel: () => { ui.cnt = null; closeModal(); },
  shclose: (el) => {
    const sh = DB.shifts.find((s) => s.id === el.dataset.id), c = ui.cnt; if (!sh || !c) return;
    const S = shiftSummary(sh), counted = c.direct !== "" ? r2(num(c.direct)) : countTotal(c.q);
    Object.assign(sh, { t1: Date.now(), d1: dkey(), q: c.q, counted, expected: S.expected, diff: r2(counted - S.expected), note: ($("#cntn") || { value: "" }).value.trim(), by: me().name, sum: S });
    log("Cierre de caja", `${sh.un}: esperado ${money(S.expected)}, contado ${money(counted)}`);
    ui.cnt = null; save(sh.d0); closeModal(); printHtml(liqHtml(sh)); toast(sh.diff === 0 ? "Caja cerrada: cuadra" : sh.diff < 0 ? `Caja cerrada: falta ${money(-sh.diff)}` : `Caja cerrada: sobra ${money(sh.diff)}`, true); render();
  },
  zclose: () => need("cierre", () => {
    const k = ui.date; if (DB.closes.some((x) => x.date === k)) return toast("Este día ya tiene cierre");
    const z = { id: uid(), z: ++DB.zseq, date: k, t: Date.now(), un: me().name, sum: zSummary(k) };
    DB.closes.push(z); log("Cierre del día", `Z ${z.z} · ${dmy(k)}`); save(k); printHtml(zHtml(z)); toast("Cierre del día guardado"); render();
  }, "Cierre del día"),
  zprint: (el) => { const z = DB.closes.find((x) => x.id === el.dataset.id); if (z) printHtml(zHtml(z)); },
  mv: (el) => need("caja", () => openMove(el.dataset.t)),
  mvsave: (el) => {
    const type = el.dataset.t;
    if (type === "yape") {
      const list = parseAmounts($("#mva").value); if (!list.length) return toast("Escribe al menos un monto");
      list.forEach((a) => addMove("yape", a, "", { m: "yape" }));
      toast(`${list.length} ${list.length === 1 ? "Yape anotado" : "Yapes anotados"}: ${money(list.reduce((a, b) => a + b, 0))}`);
    } else {
      const a = num($("#mva").value); if (!(a > 0)) return toast("Escribe un monto mayor a 0");
      addMove(type, a, $("#mvn").value.trim()); log(MOVE[type][0], `${money(a)} ${$("#mvn").value.trim()}`); toast("Guardado");
    }
    closeModal(); render();
  },
  mvdel: (el) => { const m = DB.moves.find((x) => x.id === el.dataset.id); if (!m) return; if (m.sup) return toast("Este pago es de un proveedor: bórralo desde Proveedores"); need("cierre", () => confirmBox("¿Borrar este movimiento?", "Borrar", () => { DB.moves = DB.moves.filter((x) => x !== m); log("Movimiento borrado", `${MOVE[m.type] ? MOVE[m.type][0] : m.type} ${money(m.amount)}`); save(m.date); render(); })); },
  period: () => need("cierre", closePeriodUI, "Cerrar un mes"),
  periodok: () => {
    const m = $("#pmon").value, from = m + "-01", to = addD(addD(from, 32).slice(0, 7) + "-01", -1);
    const sales = DB.sales.filter((s) => s.date >= from && s.date <= to && !s.void);
    const p = { id: uid(), m, from, to: m === mOf() ? dkey() : to, label: monthName(m), t: Date.now(), un: me().name, n: sales.length, total: r2(sales.reduce((a, s) => a + s.total, 0)), igv: r2(sales.reduce((a, s) => a + (s.igv || 0), 0)) };
    DB.periods.push(p); log("Cierre de período", p.label); save(); closeModal(); toast(`${p.label} cerrado`); render();
  }
});

/* ===================== 65 · PROVEEDORES: lo que debes, lo que abonas y lo que pagas ===================== */
// DB.supp = proveedores. DB.sm = movimientos: "deuda" (te fiaron mercadería) y "pago" (abono o pago al contado).
const supp = (id) => DB.supp.find((x) => x.id === id);
const suppBal = (s) => r2(DB.sm.filter((x) => x.sid === s.id).reduce((a, x) => a + (x.type === "deuda" ? x.amt : -x.amt), 0));
const suppTotalDebt = () => r2(DB.supp.reduce((a, s) => a + Math.max(0, suppBal(s)), 0));
const suppLast = (s) => DB.sm.filter((x) => x.sid === s.id).reduce((a, x) => Math.max(a, x.t), 0);

VIEWS.prov = function viewProv(v) {
  if (ui.ps && !supp(ui.ps)) ui.ps = null;
  if (ui.ps) return provDetail(v, supp(ui.ps));
  const list = DB.supp.slice().sort((a, b) => suppBal(b) - suppBal(a) || a.name.localeCompare(b.name, "es"));
  const debt = suppTotalDebt(), owing = DB.supp.filter((s) => suppBal(s) > 0).length;
  v.innerHTML = `<div class="ph"><h1>Proveedores</h1><button class="btn sm" data-a="psnew">${svg("plus", "bi")}Nuevo proveedor</button></div>
    <div class="sumrow two"><div class="sum ${debt > 0 ? "warn" : ""}"><b class="num">${money(debt)}</b><span>Debes en total${owing ? ` · ${owing} ${owing === 1 ? "proveedor" : "proveedores"}` : ""}</span></div>
      <div class="sum"><b class="num">${money(r2(DB.sm.filter((x) => x.type === "pago" && x.date === dkey()).reduce((a, x) => a + x.amt, 0)))}</b><span>Pagado hoy</span></div></div>
    ${list.length ? `<div class="list">${list.map((s) => { const b = suppBal(s); return `<button class="it" data-a="psopen" data-id="${s.id}"><div class="t"><b>${esc(s.name)}</b><small>${b > 0 ? "Le debes" : b < 0 ? "Tienes saldo a favor" : "Sin deuda"}${suppLast(s) ? " · último mov. " + dmy(dkeyOf(suppLast(s))) : ""}</small></div><div class="v num ${b > 0 ? "warn" : ""}">${b === 0 ? "—" : money(Math.abs(b))}</div></button>`; }).join("")}</div>`
      : `<div class="empty"><h2>Aún no tienes proveedores</h2><p>Agrega a quien te surte para anotar lo que le debes y lo que le vas pagando.</p><button class="btn" data-a="psnew">Agregar proveedor</button></div>`}`;
};
const dkeyOf = (t) => { const d = new Date(t), p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

function provDetail(v, s) {
  const b = suppBal(s), rows = DB.sm.filter((x) => x.sid === s.id).sort((x, y) => y.t - x.t);
  let run = b; const withBal = rows.map((x) => { const r = { x, bal: run }; run = r2(run - (x.type === "deuda" ? x.amt : -x.amt)); return r; });
  v.innerHTML = `<div class="ph"><div><button class="link" data-a="psback">‹ Proveedores</button><h1>${esc(s.name)}</h1>${s.phone ? `<p class="muted">${esc(s.phone)}</p>` : ""}${s.note ? `<p class="muted sm">${esc(s.note)}</p>` : ""}</div><button class="btn sec sm" data-a="psedit" data-id="${s.id}">${svg("edit", "bi")}Editar</button></div>
    <div class="sumrow two"><div class="sum ${b > 0 ? "warn" : ""}"><b class="num">${money(Math.abs(b))}</b><span>${b > 0 ? "Le debes" : b < 0 ? "Saldo a favor" : "Sin deuda"}</span></div></div>
    <div class="row wrap" style="margin-bottom:14px"><button class="btn" data-a="pspay" data-id="${s.id}">Pagar o abonar</button><button class="btn sec" data-a="psdebt" data-id="${s.id}">Anotar lo que me fiaron</button></div>
    <div class="card"><h2>Movimientos</h2>${withBal.length ? `<div class="tablewrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Detalle</th><th class="r">Deuda</th><th class="r">Pago</th><th class="r">Saldo</th><th></th></tr></thead><tbody>${withBal.map(({ x, bal }) => `<tr><td>${dmy(x.date)}</td><td>${x.type === "pago" ? "Pago" + (x.m && x.m !== "efectivo" ? " (" + METHODS[x.m] + ")" : " (efectivo)") : "Me fiaron"}${x.note ? " · " + esc(x.note) : ""}<small class="muted"> · ${esc(x.un || "")}</small></td><td class="r num">${x.type === "deuda" ? money(x.amt) : ""}</td><td class="r num">${x.type === "pago" ? money(x.amt) : ""}</td><td class="r num">${money(bal)}</td><td><button class="link xs" data-a="psdel" data-id="${x.id}" aria-label="Borrar movimiento">✕</button></td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">Todavía no hay movimientos.</p>`}</div>`;
}
function suppForm(id) {
  const s = id ? supp(id) : { name: "", phone: "", note: "" };
  openModal(`<h2>${id ? "Editar proveedor" : "Nuevo proveedor"}</h2>
    <label class="fld"><span>Nombre</span><input class="inp" id="pf-name" value="${esc(s.name)}" maxlength="50" placeholder="Ej: Distribuidora Lima" autofocus></label>
    <label class="fld"><span>Teléfono (opcional)</span><input class="inp" id="pf-phone" value="${esc(s.phone || "")}" inputmode="tel" maxlength="20"></label>
    <label class="fld"><span>Nota (opcional)</span><input class="inp" id="pf-note" value="${esc(s.note || "")}" maxlength="80" placeholder="Ej: viene los martes"></label>
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" data-enter data-a="pssave" data-id="${id || ""}">Guardar</button></div>
    ${id ? `<button class="link" data-a="psrm" data-id="${id}" style="width:100%;color:var(--red)">Eliminar proveedor</button>` : ""}`);
}
function suppMoney(kind, id) {
  const s = supp(id); if (!s) return; const b = suppBal(s);
  ui.sp = { id, kind, m: "efectivo" };
  openModal(`<h2>${kind === "pago" ? "Pagar o abonar" : "Anotar lo que me fiaron"}</h2><p class="muted" style="margin-bottom:12px">${esc(s.name)}${b > 0 ? ` · le debes <b>${money(b)}</b>` : ""}</p>
    <label class="fld"><span>Monto (S/)</span><input class="inp num big" id="spa" inputmode="decimal" placeholder="0.00" autofocus></label>
    ${kind === "pago" && b > 0 ? `<button class="link xs" data-a="spall" data-v="${b.toFixed(2)}" style="margin:-6px 0 10px">Pagar todo: ${money(b)}</button>` : ""}
    ${kind === "pago" ? `<div class="methods" id="spm">${["efectivo", "yape", "plin", "transferencia"].map((m) => `<button class="mth ${m === "efectivo" ? "on" : ""}" data-a="spm" data-m="${m}">${METHODS[m]}</button>`).join("")}</div><p class="muted sm" style="margin:-4px 0 10px">Si es efectivo, sale de la caja.</p>` : ""}
    <label class="fld"><span>Nota (opcional)</span><input class="inp" id="spn" maxlength="50" placeholder="${kind === "pago" ? "Ej: factura 123" : "Ej: gaseosas y arroz"}"></label>
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" data-enter data-a="spok">${kind === "pago" ? "Registrar pago" : "Anotar deuda"}</button></div>`);
}
act({
  psback: () => { ui.ps = null; render(); },
  psopen: (el) => { ui.ps = el.dataset.id; render(); window.scrollTo(0, 0); },
  psnew: () => suppForm(""),
  psedit: (el) => suppForm(el.dataset.id),
  pssave: (el) => {
    const g = (k) => ($("#pf-" + k) || { value: "" }).value.trim(), name = g("name"), id = el.dataset.id;
    if (!name) return toast("Escribe el nombre");
    if (DB.supp.some((x) => x.id !== id && x.name.toLowerCase() === name.toLowerCase())) return toast("Ya tienes un proveedor con ese nombre");
    let s = id ? supp(id) : null;
    if (s) Object.assign(s, { name, phone: g("phone"), note: g("note") }); else { s = { id: uid(), name, phone: g("phone"), note: g("note"), t: Date.now() }; DB.supp.push(s); log("Proveedor creado", name); }
    save(); closeModal(); toast("Proveedor guardado"); ui.ps = s.id; render();
  },
  psrm: (el) => { const s = supp(el.dataset.id); if (!s) return; const n = DB.sm.filter((x) => x.sid === s.id).length;
    confirmBox(`¿Eliminar a ${s.name}?`, "Eliminar", () => { DB.supp = DB.supp.filter((x) => x !== s); DB.sm = DB.sm.filter((x) => x.sid !== s.id); log("Proveedor eliminado", s.name); save(); ui.ps = null; toast("Proveedor eliminado"); render(); }, true, n ? `Se borran también sus ${n} movimientos. Los pagos en efectivo ya salieron de la caja y no se devuelven.` : ""); },
  pspay: (el) => suppMoney("pago", el.dataset.id),
  psdebt: (el) => suppMoney("deuda", el.dataset.id),
  spm: (el) => { ui.sp.m = el.dataset.m; $$("#spm .mth").forEach((b) => b.classList.toggle("on", b.dataset.m === ui.sp.m)); },
  spall: (el) => { const i = $("#spa"); if (i) { i.value = el.dataset.v; i.focus(); } },
  spok: () => {
    const p = ui.sp; if (!p) return; const s = supp(p.id); if (!s) return;
    const amt = r2(num($("#spa").value)); if (!(amt > 0)) return toast("Escribe un monto mayor a 0");
    const note = ($("#spn").value || "").trim(), u = me();
    const e = { id: uid(), sid: s.id, t: Date.now(), date: dkey(), type: p.kind, amt, note, m: p.kind === "pago" ? p.m : "", u: u ? u.id : "", un: u ? u.name : "" };
    if (p.kind === "pago") {
      if (p.m === "efectivo" && !can("caja")) return toast("Tu usuario no puede sacar dinero de la caja");
      const mv = addMove("proveedor", amt, `${s.name}${note ? " · " + note : ""}`, { m: p.m, sup: s.id }); e.mv = mv.id;
    }
    DB.sm.push(e); log(p.kind === "pago" ? "Pago a proveedor" : "Deuda con proveedor", `${s.name} ${money(amt)}`); save();
    ui.sp = null; closeModal(); toast(p.kind === "pago" ? `Pago registrado: ${money(amt)}` : `Anotado: le debes ${money(suppBal(s))}`); render();
  },
  psdel: (el) => { const x = DB.sm.find((y) => y.id === el.dataset.id); if (!x) return; const s = supp(x.sid);
    need("cierre", () => confirmBox("¿Borrar este movimiento?", "Borrar", () => {
      DB.sm = DB.sm.filter((y) => y !== x);
      if (x.mv) { const m = DB.moves.find((y) => y.id === x.mv); if (m) { DB.moves = DB.moves.filter((y) => y !== m); save(m.date); } }
      log("Movimiento de proveedor borrado", `${s ? s.name : ""} ${money(x.amt)}`); save(); render();
    }, true, x.mv ? "Si fue en efectivo, el dinero vuelve a la caja." : ""));
  }
});

/* ===================== 67 · NUBE (Supabase): respaldo automático, varias tiendas y panel del dueño ===================== */
// La caja SIEMPRE vende con sus datos locales (sin internet también). Esta parte solo copia los cambios a la nube
// cuando hay señal, y permite al dueño (con su cuenta de Google) ver todas sus tiendas y recuperar una tienda en otro equipo.
// Cada tienda o caja se identifica con DB.biz.sid; en la nube sus datos van separados por ese código.
const SB_URL = "https://ohdpfdzledddmhanscln.supabase.co";
const SB_KEY = "sb_publishable_ZTDGiZUQYzGXQ0Pv0J33pQ_759qa460"; // clave pública: los datos los protegen las reglas de seguridad (RLS)
const CLOUD_KEY = "cf-cloud";
// Lo que se respalda: cada elemento de estas listas es un registro en la nube.
const CLOUD_TYPES = ["products", "clients", "sales", "moves", "kx", "shifts", "closes", "periods", "prev", "supp", "sm"];
const cloud = { st: null, busy: false, timer: 0, err: "", last: 0, pending: 0, panel: null };

function cloudLoad() {
  if (cloud.st) return cloud.st;
  let o = null; try { o = JSON.parse(localStorage.getItem(CLOUD_KEY) || "null"); } catch (e) {}
  cloud.st = Object.assign({ ses: null, neg: "", negName: "", dev: "", h: {}, last: 0, ver: false }, o || {});
  if (!cloud.st.dev) cloud.st.dev = "D" + uid().slice(-6).toUpperCase();
  return cloud.st;
}
function cloudStore() { try { localStorage.setItem(CLOUD_KEY, JSON.stringify(cloud.st)); } catch (e) {} }
const cloudOn = () => { const s = cloudLoad(); return !!(s.ses && s.neg); };

/* ---------- sesión (Google por Supabase Auth, sin librerías) ---------- */
function cloudLoginGoogle() {
  const back = location.origin + location.pathname;
  location.href = `${SB_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(back)}`;
}
// Al volver de Google la sesión llega en la dirección (#access_token=...). La guardamos y limpiamos la dirección.
function cloudCatchRedirect() {
  const h = new URLSearchParams(location.hash.replace(/^#/, "")), q = new URLSearchParams(location.search);
  const err = h.get("error_description") || q.get("error_description");
  if (err) { cloud.err = err.replace(/\+/g, " "); history.replaceState(null, "", location.pathname); return "error"; }
  const at = h.get("access_token"); if (!at) return "";
  const s = cloudLoad();
  s.ses = { at, rt: h.get("refresh_token") || "", exp: Date.now() + (+h.get("expires_in") || 3600) * 1000, user: cloudUserFromJwt(at) };
  cloudStore(); history.replaceState(null, "", location.pathname); return "ok";
}
function cloudUserFromJwt(at) {
  try { const p = JSON.parse(atob(at.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); return { id: p.sub, email: p.email || "" }; } catch (e) { return { id: "", email: "" }; }
}
function cloudSetSession(j) {
  const s = cloudLoad();
  s.ses = { at: j.access_token, rt: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1000, user: j.user ? { id: j.user.id, email: j.user.email || "" } : cloudUserFromJwt(j.access_token) };
  cloudStore();
}
async function cloudToken() {
  const s = cloudLoad(); if (!s.ses) return "";
  if (Date.now() < s.ses.exp - 60000) return s.ses.at;
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: s.ses.rt }) });
  if (!r.ok) { if (r.status === 400 || r.status === 401) { s.ses = null; cloudStore(); cloud.err = "Tu sesión venció. Vuelve a entrar con Google."; } throw new Error("auth"); }
  cloudSetSession(await r.json()); return cloud.st.ses.at;
}
function cloudLogout() {
  const s = cloudLoad(); s.ses = null; s.neg = ""; s.negName = ""; s.h = {}; s.last = 0; s.ver = false; s.estado = ""; s.sop = null; s.admin = false; cloudStore(); applySusp(); cloud.cli = null;
  cloud.panel = null; toast("Cerraste sesión. Para seguir vendiendo, el dueño debe entrar con Google.");
}

/* ---------- llamadas a la base (PostgREST) ---------- */
async function sb(path, opt = {}) {
  const tk = await cloudToken();
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { method: opt.method || "GET", headers: Object.assign({ apikey: SB_KEY, Authorization: "Bearer " + tk, "Content-Type": "application/json" }, opt.headers || {}), body: opt.body ? JSON.stringify(opt.body) : undefined });
  if (!r.ok) { const t = await r.text().catch(() => ""); throw new Error(r.status + " " + t.slice(0, 160)); }
  const txt = await r.text(); // con «return=minimal» Supabase responde sin contenido
  return txt ? JSON.parse(txt) : null;
}
// La primera vez que el dueño entra, se crea su negocio en la nube.
async function cloudEnsureNegocio() {
  const s = cloudLoad(); if (s.neg) return s.neg;
  const uidMe = (s.ses && s.ses.user && s.ses.user.id) || "";
  // Solo los negocios propios (el proveedor también puede ver negocios de clientes que le dieron permiso de soporte)
  const list = await sb(`negocios?select=id,nombre,estado,soporte_hasta&dueno=eq.${uidMe}&order=creado.asc`);
  if (list.length) { s.neg = list[0].id; s.negName = list[0].nombre; s.estado = list[0].estado; s.sop = list[0].soporte_hasta; }
  else { const n = await sb("negocios", { method: "POST", headers: { Prefer: "return=representation" }, body: { nombre: DB.biz.name || "Mi negocio" } }); s.neg = n[0].id; s.negName = n[0].nombre; }
  s.chk = Date.now(); cloudStore(); return s.neg;
}

/* ---------- subir cambios ---------- */
function cloudHash(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0; return h.toString(36) + str.length.toString(36); }
const cloudKeyOf = (x) => (x.id != null ? String(x.id) : x.no != null ? "n" + x.no : "h" + cloudHash(JSON.stringify(x)));
// Ajustes de la tienda (nombre, comprobantes, usuarios...) van como un solo registro.
const cloudConfigDoc = () => ({ biz: DB.biz, cfg: DB.cfg, roles: DB.roles, users: DB.users, seq: DB.seq, pseq: DB.pseq, zseq: DB.zseq, v: DB.v });
function cloudSnapshot() {
  const out = new Map();
  CLOUD_TYPES.forEach((t) => (DB[t] || []).forEach((x) => { const id = cloudKeyOf(x); out.set(t + "|" + id, { tipo: t, id, datos: x }); }));
  out.set("config|tienda", { tipo: "config", id: "tienda", datos: cloudConfigDoc() });
  return out;
}
async function cloudPush(force) {
  if (!cloudOn() || cloud.busy || cloud.st.ver) return; // «solo ver»: este equipo no sube nada
  if (!navigator.onLine) { cloud.err = "Sin internet: se sube solo cuando vuelva la señal."; cloudPaint(); return; }
  cloud.busy = true; cloud.err = "";
  try {
    const s = cloudLoad(), snap = cloudSnapshot(), rows = [], hashes = {};
    snap.forEach((r, k) => { const hv = cloudHash(JSON.stringify(r.datos)); hashes[k] = hv; if (force || s.h[k] !== hv) rows.push({ negocio_id: s.neg, tienda: DB.biz.sid, tipo: r.tipo, id: r.id, datos: r.datos, borrado: false, dispositivo: s.dev }); });
    Object.keys(s.h).forEach((k) => { if (!snap.has(k)) { const [tipo, ...rest] = k.split("|"); rows.push({ negocio_id: s.neg, tienda: DB.biz.sid, tipo, id: rest.join("|"), datos: {}, borrado: true, dispositivo: s.dev }); } });
    cloud.pending = rows.length;
    for (let i = 0; i < rows.length; i += 400) {
      const part = rows.slice(i, i + 400);
      await sb("registros?on_conflict=negocio_id,tienda,tipo,id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: part });
      part.forEach((r) => { const k = r.tipo + "|" + r.id; if (r.borrado) delete s.h[k]; else s.h[k] = hashes[k]; });
      cloud.pending = Math.max(0, rows.length - i - part.length); cloudStore();
    }
    s.last = Date.now(); cloud.pending = 0; cloudStore();
  } catch (e) {
    cloud.err = /auth/.test(e.message) ? cloud.err || "Vuelve a entrar con Google." : navigator.onLine ? "No se pudo subir. Se reintenta solo." : "Sin internet: se sube solo cuando vuelva la señal.";
  } finally { cloud.busy = false; cloudPaint(); }
}
function cloudSchedule(ms = 5000) { if (!cloudOn()) return; clearTimeout(cloud.timer); cloud.timer = setTimeout(() => cloudPush(), ms); }

/* ---------- conectar esta caja / recuperar una tienda ---------- */
async function cloudStart() {
  try {
    await cloudEnsureNegocio(); await cloudCheckAdmin(); applySusp();
    const tiendas = await cloudTiendas();
    const mine = tiendas.find((t) => t.tienda === DB.biz.sid);
    if (!mine && tiendas.length && !DB.sales.length && !DB.products.length) { cloudPaint(); openRecover(tiendas); return; }
    await cloudPush(true); toast("Listo: esta caja ya se respalda en la nube");
  } catch (e) { cloud.err = "No se pudo conectar con la nube. Revisa tu internet."; }
  applySusp(); cloudPaint();
}
async function cloudTiendas() {
  await cloudEnsureNegocio(); // por si la primera conexión no llegó a crear el negocio
  const s = cloudLoad();
  const rows = await sb(`registros?select=tienda,actualizado,nombre:datos->biz->>store,negocio:datos->biz->>name&negocio_id=eq.${s.neg}&tipo=eq.config&borrado=eq.false&order=actualizado.desc`);
  return rows;
}
function openRecover(tiendas) {
  openModal(`<h2>Recuperar una tienda</h2><p class="muted" style="margin-bottom:12px">Trae a este equipo todos los datos de una tienda guardada en la nube: productos, ventas, clientes, caja y proveedores.</p>
    <div class="list">${tiendas.map((t) => `<button class="it" data-a="cloudrec" data-s="${esc(t.tienda)}"><div class="t"><b>${esc(t.nombre || t.tienda)}</b><small>Código ${esc(t.tienda)} · última copia ${fmtDT(Date.parse(t.actualizado))}</small></div></button>`).join("")}</div>
    <p class="muted sm" style="margin-top:10px">Usa una tienda en un solo equipo a la vez. Para otra caja, deja esta como tienda nueva.</p>
    <div class="btns h"><button class="btn sec" data-a="cloudview">Solo ver mis tiendas</button><button class="btn sec" data-a="cloudnew">Usar como tienda nueva</button></div>`);
}
async function cloudRecover(sid) {
  const s = cloudLoad(); toast("Trayendo los datos de la nube…");
  try {
    const rows = []; let from = 0;
    for (;;) {
      const part = await sb(`registros?select=tipo,id,datos&negocio_id=eq.${s.neg}&tienda=eq.${encodeURIComponent(sid)}&borrado=eq.false&order=tipo.asc,id.asc&limit=1000&offset=${from}`);
      rows.push(...part); if (part.length < 1000) break; from += 1000;
    }
    const cfg = rows.find((r) => r.tipo === "config");
    const o = Object.assign({}, cfg ? cfg.datos : {}); CLOUD_TYPES.forEach((t) => { o[t] = []; });
    rows.forEach((r) => { if (r.tipo !== "config" && o[r.tipo]) o[r.tipo].push(r.datos); });
    DB = normalize(o); DB.biz.sid = sid; s.ver = false;
    s.h = {}; cloudSnapshot().forEach((r, k) => { s.h[k] = cloudHash(JSON.stringify(r.datos)); }); s.last = Date.now(); cloudStore();
    saveAll(); await flush(); closeModal(); toast(`Listo: recuperaste ${o.sales.length} ventas y ${o.products.length} productos`, true); render();
  } catch (e) { toast("No se pudo traer la tienda. Revisa tu internet e inténtalo otra vez.", true); }
}

/* ---------- panel del dueño: todas las tiendas hoy ---------- */
async function cloudPanel() {
  const s = cloudLoad(), k = dkey();
  try {
    await cloudEnsureNegocio();
    const [tiendas, ventas] = await Promise.all([
      cloudTiendas(),
      sb(`registros?select=tienda,total:datos->total,pays:datos->pays,anulada:datos->void&negocio_id=eq.${s.neg}&tipo=eq.sales&borrado=eq.false&datos->>date=eq.${k}&limit=5000`)
    ]);
    const by = {};
    tiendas.forEach((t) => { by[t.tienda] = { name: t.nombre || t.tienda, act: t.actualizado, n: 0, total: 0, m: {} }; });
    ventas.forEach((v) => {
      if (v.anulada) return; const b = by[v.tienda] || (by[v.tienda] = { name: v.tienda, act: "", n: 0, total: 0, m: {} });
      b.n++; b.total = r2(b.total + (+v.total || 0)); (v.pays || []).forEach((p) => { b.m[p.m] = r2((b.m[p.m] || 0) + p.amt); });
    });
    cloud.panel = { t: Date.now(), by };
  } catch (e) { cloud.panel = { t: Date.now(), err: true, by: {} }; }
  if (ui.tab === "aj" && ui.atab === "nube") render();
}
function panelHtml() {
  const p = cloud.panel;
  if (!p) return `<p class="muted">Toca «Ver mis tiendas» para traer las ventas de hoy de todas tus cajas.</p>`;
  if (p.err) return `<p class="muted">No se pudo traer el resumen. Revisa tu internet.</p>`;
  const list = Object.entries(p.by), tot = r2(list.reduce((a, [, b]) => a + b.total, 0));
  if (!list.length) return `<p class="muted">Aún no hay tiendas en la nube.</p>`;
  return `<div class="kv strong"><span>Todas las tiendas hoy</span><span class="num">${money(tot)}</span></div>` + list.map(([sid, b]) => `<div class="kv"><span><b>${esc(b.name)}</b><small class="muted"> · ${b.n} ${b.n === 1 ? "venta" : "ventas"}${b.m.efectivo ? " · efectivo " + money(b.m.efectivo) : ""}${b.m.yape ? " · Yape " + money(b.m.yape) : ""}${b.act ? " · copia " + hhmm(Date.parse(b.act)) : ""}${sid === DB.biz.sid ? " · esta caja" : ""}</small></span><span class="num">${money(b.total)}</span></div>`).join("") + `<p class="muted sm" style="margin-top:8px">Actualizado a las ${hhmm(p.t)}</p>`;
}

/* ---------- licencia, soporte con permiso y panel del proveedor ---------- */
// Estado del negocio en la nube (activo / suspendido) y permiso de soporte.
async function cloudRefreshNeg() {
  const s = cloudLoad(); if (!s.ses || !s.neg) return;
  try {
    const r = await sb(`negocios?select=nombre,estado,soporte_hasta&id=eq.${s.neg}`);
    if (r && r[0]) { s.negName = r[0].nombre; s.estado = r[0].estado; s.sop = r[0].soporte_hasta; s.chk = Date.now(); cloudStore(); }
  } catch (e) {}
  applySusp();
}
async function cloudCheckAdmin() {
  const s = cloudLoad(); if (!s.ses) return;
  try { s.admin = !!(await sb("rpc/soy_admin", { method: "POST", body: {} })); cloudStore(); } catch (e) {}
}
// Licencia: cada caja se activa una vez con la cuenta de Google del dueño. Después vende sin internet
// (los cajeros con su PIN), pero debe revisar su licencia en la nube al menos cada LIC_DIAS días.
const LIC_DIAS = 15;
function gateState() {
  const s = cloudLoad();
  const viejo = !s.ver && s.chk && Date.now() - s.chk > LIC_DIAS * 864e5;
  if (!s.ses) return !s.neg ? "activar" : viejo ? "sesion" : ""; // si venció la sesión, sigue vendiendo hasta el plazo
  if (!s.neg) return "conectando";
  if (s.estado === "suspendido") return "suspendido";
  return viejo ? "revisar" : "";
}
function gateHtml(g) {
  const s = cloudLoad(), name = esc(s.negName || DB.biz.name || "tu negocio");
  const err = cloud.err ? `<p class="dpts">${esc(cloud.err)}</p>` : "";
  if (g === "activar") return `<b>Activa tu Caja Fácil</b><p>Para empezar, el <b>dueño</b> entra una sola vez con su cuenta de Google. Después la caja vende normal, también sin internet, y los cajeros usan su PIN.</p>${err}<button class="btn lg" data-a="cloudlogin" style="width:100%">Entrar con Google</button><p class="muted sm" style="margin-top:10px">Así tu información queda respaldada y tu licencia activa.</p>`;
  if (g === "sesion") return `<b>Vuelve a entrar con Google</b><p>Para seguir usando <b>${name}</b>, el dueño debe entrar otra vez con su cuenta de Google. Tus datos están seguros.</p>${err}<button class="btn lg" data-a="cloudlogin" style="width:100%">Entrar con Google</button>`;
  if (g === "conectando") return `<b>Conectando tu caja…</b><p>Estamos activando <b>${name}</b>. Necesitas internet solo para este paso.</p>${err}<div class="btns h"><button class="btn" data-a="gateretry">Reintentar</button><button class="btn sec" data-a="gateout">Usar otra cuenta</button></div>`;
  if (g === "suspendido") return `<b>Sistema suspendido</b><p>La licencia de Caja Fácil de <b>${name}</b> está suspendida. Tus datos siguen guardados y seguros.</p><p class="muted">Comunícate con tu proveedor de Caja Fácil para reactivarla.</p><button class="btn sec" data-a="suspcheck">Ya pagué, volver a revisar</button>`;
  return `<b>Conéctate a internet</b><p>Hace más de ${LIC_DIAS} días que esta caja no revisa su licencia. Conéctala a internet un momento y toca el botón. Tus datos están seguros.</p>${err}<button class="btn" data-a="suspcheck" style="width:100%">Ya tengo internet, revisar</button>`;
}
// Pantalla que bloquea la caja si no está activada, si la licencia está suspendida o si pasó mucho sin revisarla.
function applySusp() {
  const g = gateState();
  let el = $("#susp");
  if (!g) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement("div"); el.id = "susp"; el.setAttribute("role", "alertdialog"); el.setAttribute("aria-modal", "true"); document.body.appendChild(el); }
  const html = `<div class="suspc">${gateHtml(g)}</div>`;
  if (el.dataset.g !== g || el.innerHTML !== html) { el.dataset.g = g; el.innerHTML = html; }
}
const sopActivo = () => { const s = cloudLoad(); return !!(s.sop && Date.parse(s.sop) > Date.now()); };
async function cloudSoporte(horas) {
  const s = cloudLoad();
  const hasta = horas ? new Date(Date.now() + horas * 3600e3).toISOString() : null;
  try {
    await sb(`negocios?id=eq.${s.neg}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: { soporte_hasta: hasta } });
    s.sop = hasta; cloudStore(); log(horas ? "Acceso de soporte dado" : "Acceso de soporte quitado", horas ? `${horas} h` : "");
    toast(horas ? `Listo: soporte puede ver tus datos hasta el ${fmtDT(Date.parse(hasta))}` : "Listo: soporte ya no puede ver tus datos");
  } catch (e) { toast("No se pudo cambiar el acceso. Revisa tu internet.", true); }
  render();
}
function soporteHtml() {
  const s = cloudLoad(), on = sopActivo();
  return `<div class="card"><h2>Soporte técnico</h2><p class="muted" style="margin-bottom:10px">Si tienes un problema, puedes dejar que tu proveedor de Caja Fácil <b>vea</b> (sin cambiar nada) tus ventas, productos y caja por un tiempo.</p>
    <div class="kv"><span>Acceso de soporte</span><b>${on ? `Activo hasta ${fmtDT(Date.parse(s.sop))}` : "Cerrado"}</b></div>
    <div class="row wrap" style="margin-top:10px">${on ? `<button class="btn red sec" data-a="sopoff">Quitar acceso ahora</button>` : `<button class="btn sec" data-a="sopon" data-h="24">Dar acceso por 24 horas</button><button class="btn sec" data-a="sopon" data-h="168">Por 7 días</button>`}</div></div>`;
}
async function adminLoad() {
  try { cloud.cli = await sb("rpc/admin_negocios", { method: "POST", body: {} }); } catch (e) { cloud.cli = { err: true }; }
  if (ui.tab === "aj" && ui.atab === "nube") render();
}
function adminHtml() {
  const c = cloud.cli, me = (cloudLoad().neg || "");
  const body = !c ? `<p class="muted">Toca «Ver clientes» para traer la lista.</p>` : c.err ? `<p class="muted">No se pudo traer la lista. Revisa tu internet.</p>` : !c.length ? `<p class="muted">Aún no tienes clientes.</p>`
    : c.map((n) => { const sop = n.soporte_hasta && Date.parse(n.soporte_hasta) > Date.now(), mine = n.id === me;
      return `<div class="cli"><div class="clit"><b>${esc(n.nombre)}${mine ? " <small class=\"muted\">(tu negocio)</small>" : ""}</b><small>${esc(n.correo || "")} · ${n.tiendas || 0} ${n.tiendas === 1 ? "caja" : "cajas"} · ${n.ultima ? "última copia " + fmtDT(Date.parse(n.ultima)) : "sin copias aún"}</small>
        <small><span class="tag ${n.estado === "suspendido" ? "out" : ""}">${n.estado === "suspendido" ? "Suspendido" : "Activo"}</span> ${sop ? `<span class="tag">Soporte hasta ${fmtDT(Date.parse(n.soporte_hasta))}</span>` : ""}${n.nota ? " · " + esc(n.nota) : ""}</small></div>
        <div class="clia">${sop || mine ? `<button class="btn sec sm" data-a="adminver" data-id="${n.id}">Ver datos</button>` : `<button class="btn sec sm" disabled title="El cliente debe dar acceso de soporte">Sin permiso</button>`}${mine ? "" : n.estado === "suspendido" ? `<button class="btn sm" data-a="adminest" data-id="${n.id}" data-e="activo">Activar</button>` : `<button class="btn red sec sm" data-a="adminest" data-id="${n.id}" data-e="suspendido">Suspender</button>`}</div></div>`; }).join("");
  return `<div class="card"><div class="row sp"><h2>Mis clientes</h2><button class="btn sec sm" data-a="adminlist">Ver clientes</button></div><p class="muted sm" style="margin-bottom:8px">Solo tú ves esto. Para ver los datos de un cliente, él debe darte acceso en su Ajustes › Nube › Soporte técnico.</p>${body}</div>`;
}
// Resumen de solo lectura de un cliente que dio permiso.
async function adminVer(id) {
  toast("Trayendo los datos del cliente…");
  try {
    const desde = addD(dkey(), -6);
    const [base, ventas] = await Promise.all([
      sb(`registros?select=tienda,tipo,datos&negocio_id=eq.${id}&borrado=eq.false&tipo=in.(config,products)&limit=5000`),
      sb(`registros?select=tienda,datos&negocio_id=eq.${id}&borrado=eq.false&tipo=eq.sales&datos->>date=gte.${desde}&limit=5000`)
    ]);
    const tiendas = {};
    base.filter((r) => r.tipo === "config").forEach((r) => { tiendas[r.tienda] = (r.datos.biz && (r.datos.biz.store || r.datos.biz.name)) || r.tienda; });
    const prods = base.filter((r) => r.tipo === "products").map((r) => Object.assign({ _t: r.tienda }, r.datos));
    const vs = ventas.map((r) => Object.assign({ _t: r.tienda }, r.datos)).filter((v) => !v.void);
    const hoy = vs.filter((v) => v.date === dkey()), tot = (a) => r2(a.reduce((x, v) => x + (+v.total || 0), 0));
    const bajo = prods.filter((p) => p.stock != null && p.stock <= (p.min || 0)).slice(0, 15);
    const ult = vs.sort((a, b) => b.t - a.t).slice(0, 12);
    const negName = ((cloud.cli || []).find && (cloud.cli.find((n) => n.id === id) || {}).nombre) || "Cliente";
    openModal(`<h2>${esc(negName)}</h2><p class="muted" style="margin-bottom:12px">Solo lectura · ${Object.keys(tiendas).length} ${Object.keys(tiendas).length === 1 ? "caja" : "cajas"}: ${Object.values(tiendas).map(esc).join(", ") || "—"}</p>
      <div class="sumrow"><div class="sum"><b class="num">${money(tot(hoy))}</b><span>Hoy · ${hoy.length} ventas</span></div><div class="sum"><b class="num">${money(tot(vs))}</b><span>Últimos 7 días · ${vs.length}</span></div><div class="sum ${bajo.length ? "warn" : ""}"><b class="num">${prods.length}</b><span>Productos · ${bajo.length} por acabarse</span></div></div>
      ${bajo.length ? `<h3 style="margin:10px 0 6px">Por acabarse</h3>${bajo.map((p) => `<div class="kv"><span>${esc(p.name)}<small class="muted"> · ${esc(tiendas[p._t] || p._t)}</small></span><span class="num">${fmtQ(p.stock)}${p.unit === "kg" ? " kg" : ""}</span></div>`).join("")}` : ""}
      <h3 style="margin:12px 0 6px">Últimas ventas</h3>${ult.length ? ult.map((v) => `<div class="kv"><span>${dmy(v.date)} ${hhmm(v.t)}<small class="muted"> · ${esc(tiendas[v._t] || v._t)} · ${esc((v.pays || []).map((p) => METHODS[p.m] || p.m).join(" + "))}</small></span><span class="num">${money(v.total)}</span></div>`).join("") : `<p class="muted">Sin ventas en los últimos 7 días.</p>`}
      <div class="btns"><button class="btn sec" data-a="close">Cerrar</button></div>`, "wide");
  } catch (e) { toast("No se pudo ver: el cliente debe darte acceso de soporte", true); }
}

/* ---------- pantalla en Ajustes › Nube ---------- */
function cloudSettingsHtml() {
  const s = cloudLoad();
  if (!s.ses) return `<div class="card"><h2>Tu negocio en la nube</h2><p class="muted" style="margin-bottom:12px">Entra con tu cuenta de Google y esta caja guardará una copia automática en la nube. Así:</p>
      <div class="kv"><span>Ves las ventas de todas tus tiendas desde tu celular</span></div><div class="kv"><span>Si se malogra la computadora, recuperas todo</span></div><div class="kv"><span>La caja sigue vendiendo sin internet y sube los cambios cuando vuelve la señal</span></div>
      ${cloud.err ? `<p class="dpts" style="margin-top:10px">${esc(cloud.err)}</p>` : ""}
      <button class="btn lg" data-a="cloudlogin" style="margin-top:14px;width:100%">Entrar con Google</button>
      <p class="muted sm" style="margin-top:8px">Solo el dueño entra con Google. Los cajeros siguen usando su PIN.</p></div>`;
  return `<div class="card"><h2>Tu negocio en la nube</h2>
      <div class="kv"><span>Cuenta</span><b>${esc((s.ses.user || {}).email || "Google")}</b></div>
      <div class="kv"><span>Negocio</span><b>${esc(s.negName || "—")}</b></div>
      <div class="kv"><span>Esta caja</span><b>${esc(DB.biz.store)} <small class="muted">(${esc(DB.biz.sid)})</small></b></div>
      <div class="kv"><span>Copia en la nube</span><b id="cloudst">${cloudStatus()}</b></div>
      <div class="row wrap" style="margin-top:12px">${s.ver ? `<button class="btn" data-a="cloudnew">Usar este equipo como caja</button>` : `<button class="btn" data-a="cloudpush">Subir ahora</button>`}<button class="btn sec" data-a="cloudrecover">Recuperar una tienda</button><button class="btn sec" data-a="cloudout">Cerrar sesión</button></div></div>
    ${s.ver ? "" : soporteHtml()}${s.admin ? adminHtml() : ""}
    <div class="card"><div class="row sp"><h2>Mis tiendas hoy</h2><button class="btn sec sm" data-a="cloudpanel">Ver mis tiendas</button></div>${panelHtml()}</div>`;
}
function cloudStatus() {
  const s = cloudLoad();
  if (cloud.busy) return cloud.pending ? `Subiendo… faltan ${cloud.pending}` : "Subiendo…";
  if (cloud.err) return esc(cloud.err);
  if (s.ver) return "Solo ver: este equipo no sube datos";
  return s.last ? `Al día · ${hhmm(s.last)}` : "Aún no se sube nada";
}
function cloudPaint() { const el = $("#cloudst"); if (el) el.innerHTML = cloudStatus(); else if (ui.tab === "aj" && ui.atab === "nube" && !modalOpen()) render(); }

act({
  cloudlogin: () => cloudLoginGoogle(),
  cloudout: () => confirmBox("¿Cerrar sesión en la nube?", "Cerrar sesión", () => { cloudLogout(); render(); }, false, "La caja se bloquea hasta que el dueño vuelva a entrar con Google. Tus datos no se borran."),
  cloudpush: () => { if (cloudLoad().ses && !cloud.st.neg) { toast("Conectando tu caja…"); cloudStart(); } else { cloudPush(true); cloudPaint(); } },
  cloudpanel: () => { cloud.panel = null; cloudPanel(); toast("Trayendo las ventas de hoy…"); },
  cloudrecover: async () => { try { const t = await cloudTiendas(); if (!t.length) return toast("Aún no hay tiendas en la nube"); openRecover(t); } catch (e) { toast("Sin conexión con la nube", true); } },
  cloudrec: (el) => { const sid = el.dataset.s; closeModal(); confirmBox("¿Traer esta tienda a este equipo?", "Traer datos", () => cloudRecover(sid), false, "Lo que hay ahora en este equipo se reemplaza por lo de la nube."); },
  cloudnew: async () => { closeModal(); cloud.st.ver = false; cloudStore(); await cloudPush(true); toast("Listo: esta caja se guarda como tienda nueva"); },
  sopon: (el) => cloudSoporte(+el.dataset.h),
  sopoff: () => confirmBox("¿Quitar el acceso de soporte?", "Quitar acceso", () => cloudSoporte(0), false),
  adminlist: () => { cloud.cli = null; adminLoad(); },
  adminver: (el) => adminVer(el.dataset.id),
  adminest: (el) => { const id = el.dataset.id, e = el.dataset.e, n = (cloud.cli || []).find((x) => x.id === id) || {};
    const go = async () => { try { await sb("rpc/admin_estado", { method: "POST", body: { n: id, e } }); toast(e === "suspendido" ? `${n.nombre} quedó suspendido` : `${n.nombre} está activo otra vez`); } catch (er) { toast("No se pudo cambiar el estado", true); } adminLoad(); };
    if (e === "suspendido") confirmBox(`¿Suspender a ${n.nombre || "este cliente"}?`, "Suspender", go, true, "Su caja se bloquea la próxima vez que se conecte a la nube. Sus datos no se borran."); else go(); },
  suspcheck: async () => { const s = cloudLoad(), t0 = s.chk; await cloudRefreshNeg();
    if (s.estado === "suspendido") toast("Sigue suspendido. Comunícate con tu proveedor.", true);
    else if (s.chk === t0) toast("No hay conexión con la nube. Revisa tu internet.", true);
    else toast("¡Listo! Tu caja está activa."); },
  gateretry: () => { cloud.err = ""; applySusp(); cloudStart(); },
  gateout: () => { cloudLogout(); cloudLoginGoogle(); },
  cloudview: () => { cloud.st.ver = true; cloudStore(); closeModal(); ui.tab = "aj"; ui.atab = "nube"; render(); cloudPanel(); toast("Este equipo solo mira tus tiendas"); }
});

/* ---------- arranque: sesión que vuelve de Google, subida automática ---------- */
function cloudBoot() {
  const r = cloudCatchRedirect();
  if (r === "ok") { ui.tab = "aj"; ui.atab = "nube"; render(); toast("Entraste con Google. Conectando tu caja…"); cloudStart(); }
  else if (r === "error") { ui.tab = "aj"; ui.atab = "nube"; render(); toast("No se pudo entrar con Google: " + cloud.err, true); }
  else if (cloudOn()) { const s = cloudLoad(); if (!s.chk) { s.chk = Date.now(); cloudStore(); } cloudSchedule(3000); applySusp(); cloudRefreshNeg(); cloudCheckAdmin(); }
  else if (cloudLoad().ses) { applySusp(); cloudStart(); } // entró con Google pero no terminó de conectar
  else applySusp();
  // Cada vez que la app guarda algo, se programa una subida (agrupa los cambios de varios segundos).
  const _save = save; save = function () { const out = _save.apply(this, arguments); cloudSchedule(); return out; };
  window.addEventListener("online", () => cloudSchedule(1000));
  setInterval(() => { if (cloudOn() && !document.hidden) { cloudPush(); cloudRefreshNeg(); } else applySusp(); }, 120000);
}

/* ===================== 70 · VENTAS: comprobantes, anulaciones, devoluciones, preventas y despacho ===================== */
function rangeKeys(r, from, to) {
  const t = dkey();
  if (r === "hoy") return [t, t];
  if (r === "ayer") return [addD(t, -1), addD(t, -1)];
  if (r === "7d") return [addD(t, -6), t];
  if (r === "mes") return [t.slice(0, 8) + "01", t];
  if (r === "mesant") { const f = addD(t.slice(0, 8) + "01", -1).slice(0, 8) + "01"; return [f, addD(t.slice(0, 8) + "01", -1)]; }
  return [from || t, to || t];
}
const RANGES = [["hoy", "Hoy"], ["ayer", "Ayer"], ["7d", "7 días"], ["mes", "Este mes"], ["mesant", "Mes pasado"], ["rango", "Elegir fechas"]];
function rangeBar(key) {
  return `<div class="chips">${RANGES.map(([k, n]) => `<button class="chip ${ui.range === k ? "on" : ""}" data-a="range" data-r="${k}">${n}</button>`).join("")}</div>
    ${ui.range === "rango" ? `<div class="filters"><label class="fld"><span>Desde</span><input class="inp" type="date" data-in="rfrom" value="${ui.from}" max="${dkey()}"></label><label class="fld"><span>Hasta</span><input class="inp" type="date" data-in="rto" value="${ui.to}" max="${dkey()}"></label></div>` : ""}`;
}
const returnedQty = (s, i) => r3((s.returns || []).reduce((a, r) => a + r.items.filter((x) => x.i === i).reduce((b, x) => b + x.qty, 0), 0));
const retTotal = (s) => r2((s.returns || []).reduce((a, r) => a + r.amount, 0));
VIEWS.ventas = function viewSales(v) {
  const [from, to] = rangeKeys(ui.range, ui.from, ui.to);
  const pend = DB.prev.filter((p) => p.status === "pendiente").length, desp = DB.sales.filter((s) => s.prev && !s.void && !s.disp).length;
  const T = [["ventas", "Comprobantes"], ["prev", `Preventas${pend ? ` (${pend})` : ""}`], ["desp", `Por despachar${desp ? ` (${desp})` : ""}`], ["dev", "Devoluciones y anuladas"]];
  v.innerHTML = `<div class="ph"><h1>Ventas</h1>${can("reportes") ? `<button class="btn sec sm" data-a="vcsv">Exportar CSV</button>` : ""}</div>
    <div class="seg tabs2">${T.map(([k, l]) => `<button class="${ui.vtab === k ? "on" : ""}" data-a="vtab" data-t="${k}">${l}</button>`).join("")}</div>
    ${ui.vtab === "prev" || ui.vtab === "desp" ? "" : rangeBar()}
    ${ui.vtab === "ventas" ? `<div class="filters"><input class="inp" id="vq" type="search" placeholder="Número, cliente o producto" value="${esc(ui.vq)}">
      <select class="inp" data-in="vdoc"><option value="">Todos los comprobantes</option>${Object.entries(DOCS).map(([k, n]) => `<option value="${k}" ${ui.vdoc === k ? "selected" : ""}>${n}</option>`).join("")}</select>
      <select class="inp" data-in="vuser"><option value="">Todos los usuarios</option>${DB.users.map((u) => `<option value="${u.id}" ${ui.vuser === u.id ? "selected" : ""}>${esc(u.name)}</option>`).join("")}</select></div>` : ""}
    <div id="vlist"></div>`;
  paintVList(from, to);
};
function saleRow(s) {
  const ret = retTotal(s), cr = paysOf(s).some((p) => p.m === "credito");
  return `<button class="it" data-a="sale" data-id="${s.id}"><span class="dt ${s.doc.type}">${s.doc.type === "NV" ? "NV" : s.doc.type}</span><div class="t"><b>${docShort(s)}${s.cname ? " · " + esc(s.cname) : ""}</b><small>${dmy(s.date)} ${hhmm(s.t)} · ${esc(methodLabel(s))} · ${esc(s.uname || "")}${s.mesa ? " · Mesa " + s.mesa : ""}${s.prev ? " · Preventa " + s.prev : ""}</small>
    ${s.void ? ` <span class="tag void">Anulada</span>` : ""}${ret ? ` <span class="tag low">Devolución ${money(ret)}</span>` : ""}${cr && !s.void ? ` <span class="tag">Crédito</span>` : ""}</div><div class="v num ${s.void ? "strike" : ""}">${money(s.total)}</div></button>`;
}
function paintVList(from, to) {
  const el = $("#vlist"); if (!el) return;
  if (ui.vtab === "prev") {
    const l = DB.prev.slice().sort((a, b) => b.no - a.no).slice(0, 200);
    el.innerHTML = l.length ? `<div class="list">${l.map((p) => `<div class="it"><span class="dt P">P</span><div class="t"><b>Preventa N° ${p.no}${p.client && cli(p.client) ? " · " + esc(cli(p.client).name) : ""}</b><small>${dmy(p.date)} ${hhmm(p.t)} · ${esc(p.un)} · ${p.items.length} ítems</small> <span class="tag ${p.status === "pendiente" ? "low" : p.status === "anulada" ? "void" : ""}">${p.status}</span></div><div class="v num">${money(p.total)}</div>
      <div class="acts">${p.status === "pendiente" && can("cobrar") ? `<button class="btn sm" data-a="prevgo" data-n="${p.no}">Cobrar</button><button class="btn sec sm" data-a="prevvoid" data-n="${p.no}">Anular</button>` : ""}<button class="btn sec sm" data-a="prevprint" data-n="${p.no}" aria-label="Imprimir">${svg("print", "bi")}</button>${p.sale ? `<button class="btn sec sm" data-a="sale" data-id="${p.sale}">Ver venta</button>` : ""}</div></div>`).join("")}</div>`
      : `<div class="empty"><h2>Sin preventas</h2><p>Un vendedor arma el pedido con «Preventa» y la caja lo cobra con su número.</p></div>`;
    return;
  }
  if (ui.vtab === "desp") {
    const l = DB.sales.filter((s) => s.prev && !s.void && !s.disp).sort((a, b) => a.t - b.t);
    el.innerHTML = l.length ? `<p class="muted" style="margin-bottom:10px">Pedidos de preventa ya pagados que falta entregar al cliente.</p><div class="list">${l.map((s) => `<div class="it"><span class="dt P">${s.prev}</span><div class="t"><b>Preventa N° ${s.prev} · ${docShort(s)}</b><small>Pagado ${hhmm(s.t)} · ${s.items.map((i) => `${fmtQ(i.qty)} ${esc(i.name)}`).join(", ").slice(0, 120)}</small></div><div class="acts"><button class="btn sm" data-a="dispatch" data-id="${s.id}">Despachado</button></div></div>`).join("")}</div>`
      : `<div class="empty"><h2>Nada por despachar</h2><p>Aquí aparecen las preventas cobradas hasta que las entregues.</p></div>`;
    return;
  }
  let l = DB.sales.filter((s) => s.date >= from && s.date <= to);
  if (ui.vtab === "dev") l = l.filter((s) => s.void || (s.returns || []).length);
  else {
    const q = norm(ui.vq), raw = (ui.vq || "").trim();
    if (raw) l = l.filter((s) => docShort(s).toLowerCase().includes(raw.toLowerCase()) || String(s.doc.n) === raw.replace(/^0+/, "") || norm(s.cname).includes(q) || (s.cdoc || "").includes(raw) || s.items.some((i) => norm(i.name).includes(q)));
    if (ui.vdoc) l = l.filter((s) => s.doc.type === ui.vdoc);
    if (ui.vuser) l = l.filter((s) => s.user === ui.vuser);
  }
  if (!can("reportes")) l = l.filter((s) => s.user === ui.user);
  l.sort((a, b) => b.t - a.t);
  const tot = r2(l.filter((s) => !s.void).reduce((a, s) => a + s.total - retTotal(s), 0));
  el.innerHTML = l.length ? `<p class="muted" style="margin:4px 0 10px">${l.length} ${l.length === 1 ? "venta" : "ventas"} · neto ${money(tot)}</p><div class="list">${l.slice(0, 300).map(saleRow).join("")}</div>${l.length > 300 ? `<p class="muted">Mostrando 300. Exporta para ver todas.</p>` : ""}`
    : `<div class="empty"><p>No hay ventas con esos filtros.</p></div>`;
}

/* ---------- anular ---------- */
function doVoid(s) {
  if (s.void) return;
  if (isLocked(s.date)) return toast("Ese mes está cerrado: ya no se puede anular", true);
  if ((s.returns || []).length) return toast("Esta venta ya tiene devoluciones: devuelve el resto en vez de anular", true);
  need("anular", (sup) => promptBox({ title: "Anular venta", text: `${DOCS[s.doc.type]} ${docNo(s)} por ${money(s.total)}. El stock vuelve al inventario${paysOf(s).some((p) => p.m === "credito") ? " y se borra la deuda" : ""}.`, label: "Motivo", ph: "Ej: el cliente se arrepintió", required: "Escribe el motivo", ok: "Anular venta", danger: true }, (why) => {
    const sh = curShift();
    s.void = { t: Date.now(), u: (me() || {}).name, by: sup.name, why, shift: sh ? sh.id : "" };
    s.items.forEach((it) => { if (!it.quick) { const p = prod(it.id); if (p) consume(p, -r3(it.qty * (it.f || 1)), "anulacion", docShort(s)); } });
    if (!(s.shift && s.void.shift === s.shift)) paysOf(s).forEach((p) => { if (!["credito", "puntos"].includes(p.m)) addMove("anulacion", p.amt, docShort(s), { m: p.m }); });
    if (s.prev) { const pv = DB.prev.find((x) => x.no === s.prev); if (pv) pv.status = "anulada"; }
    log("Venta anulada", `${docShort(s)} ${money(s.total)} · ${why}${sup.id !== ui.user ? " · autorizó " + sup.name : ""}`);
    save(s.date); toast("Venta anulada"); render(); showReceipt(s, false);
  }), "Anular venta " + docShort(s));
}

/* ---------- devoluciones ---------- */
function openReturn(s) {
  if (s.void) return;
  if (isLocked(s.date)) return toast("Ese mes está cerrado: ya no se puede devolver", true);
  if (!s.items.some((it, i) => it.qty - returnedQty(s, i) > 0)) return toast("Ya se devolvió todo de esta venta");
  need("devolver", (sup) => {
    const cr = paysOf(s).some((p) => p.m === "credito") && s.client;
    ui.ret = { id: s.id, q: {}, m: cr ? "credito" : "efectivo", restock: true, sup: sup.name };
    paintReturn();
  }, "Devolución de " + docShort(s));
}
function retAmount(s) {
  const ratio = s.sub ? s.total / s.sub : 1;
  return r2(Object.entries(ui.ret.q).reduce((a, [i, q]) => a + q * s.items[i].price * ratio, 0));
}
function paintReturn() {
  const r = ui.ret, s = saleById(r.id); if (!s) return;
  const amt = retAmount(s), cr = paysOf(s).some((p) => p.m === "credito") && s.client;
  const M = ["efectivo", "yape", "plin", "tarjeta", "transferencia"].concat(cr ? ["credito"] : []);
  openModal(`<h2>Devolución · ${docShort(s)}</h2><p class="muted" style="margin-bottom:10px">Marca lo que el cliente devuelve.</p>
    <div class="list">${s.items.map((it, i) => { const left = r3(it.qty - returnedQty(s, i)), q = r.q[i] || 0, kg = it.unit === "kg"; return left > 0 ? `<div class="it sm"><div class="t"><b>${esc(it.name)}</b><small>Vendió ${fmtQ(it.qty)}${kg ? " kg" : ""} × ${money(it.price)}${left < it.qty ? ` · ya devolvió ${fmtQ(it.qty - left)}` : ""}</small></div>
      <span class="step"><button data-a="retq" data-i="${i}" data-v="-1" aria-label="Menos">−</button><span class="num">${fmtQ(q)}</span><button data-a="retq" data-i="${i}" data-v="1" aria-label="Más">+</button></span>${kg || left !== Math.round(left) ? `<button class="link xs" data-a="retall" data-i="${i}">todo</button>` : ""}</div>` : ""; }).join("")}</div>
    <p class="muted" style="margin:12px 0 6px">Devolver el dinero con:</p>
    <div class="methods m6">${M.map((m) => `<button class="mth ${r.m === m ? "on" : ""}" data-a="retm" data-m="${m}">${m === "credito" ? "Rebajar su deuda" : METHODS[m]}</button>`).join("")}</div>
    <label class="ck" style="margin:6px 0 10px"><input type="checkbox" id="retstock" ${r.restock ? "checked" : ""}> Los productos regresan al stock (están en buen estado)</label>
    <label class="fld"><span>Motivo</span><input class="inp" id="retwhy" placeholder="Ej: producto vencido, se equivocó" maxlength="60" value="${esc(r.why || "")}"></label>
    <div class="vuelto"><span>Total a devolver</span><b class="num">${money(amt)}</b></div>
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" data-a="retok" ${amt > 0 ? "" : "disabled"}>Hacer devolución</button></div>`, "wide");
  ui.mk = "ret";
}
function retRead() { const r = ui.ret; if (!r) return; const w = $("#retwhy"); if (w) r.why = w.value; const k = $("#retstock"); if (k) r.restock = k.checked; }
function doReturn() {
  retRead(); const r = ui.ret, s = saleById(r.id); if (!s) return;
  const amount = retAmount(s); if (!(amount > 0)) return;
  if (!r.why.trim()) return toast("Escribe el motivo");
  const items = Object.entries(r.q).filter(([, q]) => q > 0).map(([i, q]) => ({ i: +i, qty: r3(q) }));
  if (r.m === "credito" && amount > balanceOf(cli(s.client)) + 0.001) return toast("Devuelve en efectivo: su deuda es menor que el monto");
  const ret = { t: Date.now(), u: me().name, by: r.sup, items, amount, m: r.m, why: r.why.trim(), restock: r.restock };
  s.returns = s.returns || []; s.returns.push(ret);
  if (r.restock) items.forEach(({ i, qty }) => { const it = s.items[i]; if (!it.quick) { const p = prod(it.id); if (p) consume(p, -r3(qty * (it.f || 1)), "devolucion", docShort(s)); } });
  if (r.m !== "credito") addMove("devolucion", amount, `${docShort(s)} · ${ret.why}`, { m: r.m, client: s.client || "" });
  log("Devolución", `${docShort(s)} ${money(amount)} (${r.m === "credito" ? "a cuenta" : METHODS[r.m]}) · ${ret.why}`);
  ui.ret = null; save(s.date); closeModal();
  printHtml(`<h3>${esc(DB.biz.name)}</h3><div class="c doc"><b>CONSTANCIA DE DEVOLUCIÓN</b></div><div class="l"><span>Comprobante</span><span>${docNo(s)}</span></div><div class="l"><span>Fecha</span><span>${fmtDT(ret.t)}</span></div><hr>${items.map(({ i, qty }) => `<div class="l"><span>${fmtQ(qty)} × ${esc(s.items[i].name)}</span><span></span></div>`).join("")}<hr><div class="l t"><span>DEVUELTO</span><span>${money(amount)}</span></div><div class="l"><span>Medio</span><span>${r.m === "credito" ? "Rebaja de deuda" : METHODS[r.m]}</span></div><div class="c">Motivo: ${esc(ret.why)}</div>`);
  toast(`Devolución registrada: ${money(amount)}`, true); render();
}
act({
  vtab: (el) => { ui.vtab = el.dataset.t; render(); },
  range: (el) => { ui.range = el.dataset.r; render(); },
  sale: (el) => { const s = saleById(el.dataset.id); if (s) showReceipt(s, false); },
  void: (el) => { const s = saleById(el.dataset.id); if (s) doVoid(s); },
  ret: (el) => { const s = saleById(el.dataset.id); if (s) openReturn(s); },
  retq: (el) => { retRead(); const r = ui.ret, s = saleById(r.id), i = +el.dataset.i, it = s.items[i], left = r3(it.qty - returnedQty(s, i)), step = it.unit === "kg" ? 0.1 : 1; r.q[i] = Math.min(left, Math.max(0, r3((r.q[i] || 0) + +el.dataset.v * step))); paintReturn(); },
  retall: (el) => { retRead(); const r = ui.ret, s = saleById(r.id), i = +el.dataset.i; r.q[i] = r3(s.items[i].qty - returnedQty(s, i)); paintReturn(); },
  retm: (el) => { retRead(); ui.ret.m = el.dataset.m; paintReturn(); },
  retok: doReturn,
  dispatch: (el) => { const s = saleById(el.dataset.id); if (!s || s.disp) return; s.disp = { t: Date.now(), u: me().name }; log("Despacho", `Preventa ${s.prev} · ${docShort(s)}`); save(s.date); toast("Marcado como despachado"); if (modalOpen()) closeModal(); render(); },
  prevgo: (el) => { if (loadPrev(+el.dataset.n)) go("venta"); },
  prevvoid: (el) => { const pv = DB.prev.find((x) => x.no === +el.dataset.n); if (pv) confirmBox(`¿Anular la preventa N° ${pv.no}?`, "Anular", () => { pv.status = "anulada"; DB.tickets.forEach((t, i) => { if (t.prev === pv.no) t.prev = 0; }); log("Preventa anulada", "N° " + pv.no); save(pv.date); render(); }); },
  vcsv: () => {
    const [from, to] = rangeKeys(ui.range, ui.from, ui.to);
    const rows = [["fecha", "hora", "comprobante", "numero", "cliente", "documento", "usuario", "medio de pago", "producto", "cantidad", "precio", "importe", "total comprobante", "igv", "estado"]];
    DB.sales.filter((s) => s.date >= from && s.date <= to).sort((a, b) => a.t - b.t).forEach((s) => s.items.forEach((i) => rows.push([s.date, hhmm(s.t), DOCS[s.doc.type], docNo(s), s.cname || "", s.cdoc || "", s.uname || "", methodLabel(s), i.name, i.qty, i.price, r2(i.price * i.qty), s.total, s.igv || 0, s.void ? "anulada" : retTotal(s) ? "con devolución" : "ok"])));
    csvOut(rows, `ventas-${from}-a-${to}.csv`);
  }
});

/* ===================== 80 · REPORTES: ventas, ganancias, cajeros, comprobantes y tiendas ===================== */
const catOfItem = (i) => i.cat || ((prod(i.id) || {}).cat) || "Sin categoría";
function repSales(from, to, scope) {
  const local = DB.sales.filter((s) => s.date >= from && s.date <= to).map((s) => ({ store: DB.biz.store, sid: DB.biz.sid, date: s.date, t: s.t, total: s.total, ret: retTotal(s), pays: paysOf(s), items: s.items.map((i) => ({ name: i.name, qty: i.qty, price: i.price, cost: i.cost || 0, cat: catOfItem(i), id: i.id, unit: i.unit })), user: s.uname || "", doc: s.doc, igv: s.igv || 0, gravada: s.gravada || 0, void: !!s.void, id: s.id }));
  if (scope !== "todas") return local;
  const remote = [];
  Object.entries(DB.stores).forEach(([sid, st]) => (st.sales || []).forEach((s) => { if (s.date >= from && s.date <= to) remote.push(Object.assign({ store: st.name, sid }, s)); }));
  return local.concat(remote);
}
function aggregate(list) {
  const ok = list.filter((s) => !s.void), A = { n: ok.length, gross: 0, ret: 0, net: 0, cost: 0, by: {}, day: {}, hour: {}, cat: {}, prod: {}, user: {}, doc: {}, store: {}, voids: list.length - ok.length };
  ok.forEach((s) => {
    A.gross = r2(A.gross + s.total); A.ret = r2(A.ret + (s.ret || 0));
    s.pays.forEach((p) => { A.by[p.m] = r2((A.by[p.m] || 0) + p.amt); });
    A.day[s.date] = r2((A.day[s.date] || 0) + s.total - (s.ret || 0));
    const h = new Date(s.t).getHours(); A.hour[h] = r2((A.hour[h] || 0) + s.total);
    const ratio = s.total && s.items.length ? s.total / s.items.reduce((a, i) => a + i.price * i.qty, 0) || 1 : 1;
    s.items.forEach((i) => {
      const amt = r2(i.price * i.qty * ratio), cost = r2((i.cost || 0) * i.qty);
      A.cost = r2(A.cost + cost);
      A.cat[i.cat] = r2((A.cat[i.cat] || 0) + amt);
      const o = A.prod[i.name] || (A.prod[i.name] = { q: 0, m: 0, c: 0, unit: i.unit }); o.q = r3(o.q + i.qty); o.m = r2(o.m + amt); o.c = r2(o.c + cost);
    });
    const u = A.user[s.user || "—"] || (A.user[s.user || "—"] = { n: 0, m: 0 }); u.n++; u.m = r2(u.m + s.total);
    const dt = s.doc ? s.doc.type : "NV", d = A.doc[dt] || (A.doc[dt] = { n: 0, m: 0, igv: 0, grav: 0 }); d.n++; d.m = r2(d.m + s.total); d.igv = r2(d.igv + (s.igv || 0)); d.grav = r2(d.grav + (s.gravada || 0));
    const st = A.store[s.store] || (A.store[s.store] = { n: 0, m: 0 }); st.n++; st.m = r2(st.m + s.total - (s.ret || 0));
  });
  A.net = r2(A.gross - A.ret); A.profit = r2(A.net - A.cost); A.avg = A.n ? r2(A.gross / A.n) : 0;
  return A;
}
const hbars = (obj, fmt = money, max = 8, label = (k) => esc(k)) => { const e = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, max), m = e.length ? e[0][1] || 1 : 1; return e.map(([k, n]) => `<div class="hb"><div class="row sp"><span>${label(k)}</span><b class="num">${fmt(n)}</b></div><div class="hbar"><i style="width:${Math.max(2, (n / m) * 100)}%"></i></div></div>`).join("") || `<p class="muted">Sin datos en este periodo.</p>`; };
VIEWS.rep = function viewReports(v) {
  const [from, to] = rangeKeys(ui.range, ui.from, ui.to), scope = Object.keys(DB.stores).length ? ui.rscope : "local";
  const list = repSales(from, to, scope), A = aggregate(list), costs = can("costos");
  const keys = []; for (let k = from; k <= to && keys.length < 62; k = addD(k, 1)) keys.push(k);
  const maxD = Math.max(1, ...keys.map((k) => A.day[k] || 0)), hk = Object.keys(A.hour).map(Number), h0 = Math.min(6, ...hk), h1 = Math.max(22, ...hk), hours = Array.from({ length: h1 - h0 + 1 }, (_, i) => i + h0), maxH = Math.max(1, ...hours.map((h) => A.hour[h] || 0));
  const moves = scope === "local" ? DB.moves.filter((m) => m.date >= from && m.date <= to) : [];
  const mv = (t) => r2(moves.filter((m) => m.type === t).reduce((a, m) => a + m.amount, 0));
  const credit = A.by.credito || 0, abonos = mv("abono"), yapeMan = mv("yape");
  const shifts = scope === "local" ? DB.shifts.filter((s) => s.d0 >= from && s.d0 <= to).sort((a, b) => a.t0 - b.t0) : [];
  const top = Object.entries(A.prod).sort((a, b) => b[1].m - a[1].m).slice(0, 12);
  ui.repData = { from, to, A, shifts, scope, top };
  v.innerHTML = `<div class="ph"><h1>Reportes</h1><div class="row wrap"><button class="btn sec sm" data-a="repprint">${svg("print", "bi")}Imprimir</button><button class="btn sec sm" data-a="vcsv">Exportar ventas</button></div></div>
    ${Object.keys(DB.stores).length ? `<div class="seg tabs2"><button class="${scope === "local" ? "on" : ""}" data-a="rscope" data-s="local">Esta tienda</button><button class="${scope === "todas" ? "on" : ""}" data-a="rscope" data-s="todas">Todas las tiendas (${Object.keys(DB.stores).length + 1})</button></div>` : ""}
    ${rangeBar()}
    <div class="kpis">
      <div class="kpi main"><span>Ventas netas</span><b class="num">${money(A.net + yapeMan)}</b><small>${from === to ? fmtDate(from) : dmy(from) + " – " + dmy(to)}</small></div>
      <div class="kpi"><span>Ventas</span><b class="num">${A.n}</b><small>Ticket promedio ${money(A.avg)}</small></div>
      ${costs ? `<div class="kpi"><span>Ganancia estimada</span><b class="num">${money(A.profit)}</b><small>Margen ${A.net ? Math.round((A.profit / A.net) * 100) : 0}%</small></div>` : ""}
      <div class="kpi"><span>Al crédito</span><b class="num">${money(credit)}</b><small>Cobrado de deudas ${money(abonos)}</small></div>
      <div class="kpi"><span>Devoluciones</span><b class="num">${money(A.ret)}</b><small>${A.voids} anuladas</small></div></div>
    <div class="cols stack"><div class="stack">
      ${keys.length > 1 ? `<div class="card"><h2>Ventas por día</h2><div class="bars">${keys.map((k) => `<div class="bar ${k === dkey() ? "t" : ""}" title="${dmy(k)}: ${money(A.day[k] || 0)}"><i style="height:${Math.max(2, ((A.day[k] || 0) / maxD) * 100)}%"></i><span>${keys.length > 10 ? pk(k).getDate() : ["D", "L", "M", "M", "J", "V", "S"][pk(k).getDay()]}</span></div>`).join("")}</div></div>` : ""}
      <div class="card"><h2>Horas con más ventas</h2><div class="bars hours">${hours.map((h) => `<div class="bar" title="${h}:00 · ${money(A.hour[h] || 0)}"><i style="height:${Math.max(2, ((A.hour[h] || 0) / maxH) * 100)}%"></i><span>${h}</span></div>`).join("")}</div></div>
      <div class="card"><h2>Por medio de pago</h2>${hbars(Object.assign({}, A.by, yapeMan ? { "yape (anotados)": yapeMan } : {}), money, 9, (k) => esc(METHODS[k] || k))}</div>
      <div class="card"><h2>Por categoría</h2>${hbars(A.cat)}</div>
    </div><div class="stack">
      <div class="card"><h2>Productos más vendidos</h2>${top.length ? `<div class="tablewrap"><table class="tbl"><thead><tr><th>Producto</th><th class="r">Cant.</th><th class="r">Vendido</th>${costs ? `<th class="r">Ganancia</th>` : ""}</tr></thead><tbody>${top.map(([n, o]) => `<tr><td>${esc(n)}</td><td class="r num">${fmtQ(o.q)}${o.unit === "kg" ? " kg" : ""}</td><td class="r num">${money(o.m)}</td>${costs ? `<td class="r num">${money(o.m - o.c)}</td>` : ""}</tr>`).join("")}</tbody></table></div>` : `<p class="muted">Sin ventas en este periodo.</p>`}</div>
      <div class="card"><h2>Por cajero o vendedor</h2>${Object.keys(A.user).length ? `<table class="tbl"><thead><tr><th>Usuario</th><th class="r">Ventas</th><th class="r">Total</th><th class="r">Promedio</th></tr></thead><tbody>${Object.entries(A.user).sort((a, b) => b[1].m - a[1].m).map(([u, o]) => `<tr><td>${esc(u)}</td><td class="r num">${o.n}</td><td class="r num">${money(o.m)}</td><td class="r num">${money(o.m / o.n)}</td></tr>`).join("")}</tbody></table>` : `<p class="muted">Sin datos.</p>`}</div>
      <div class="card"><h2>Comprobantes e IGV</h2><table class="tbl"><thead><tr><th>Tipo</th><th class="r">Cant.</th><th class="r">Op. gravada</th><th class="r">IGV</th><th class="r">Total</th></tr></thead><tbody>${Object.entries(A.doc).map(([d, o]) => `<tr><td>${DOCS[d] || d}</td><td class="r num">${o.n}</td><td class="r num">${money(o.grav)}</td><td class="r num">${money(o.igv)}</td><td class="r num">${money(o.m)}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">Sin comprobantes.</td></tr>`}</tbody></table><p class="muted sm" style="margin-top:6px">Útil para tu declaración mensual. Las notas de venta no son comprobantes de pago.</p></div>
      ${shifts.length ? `<div class="card"><h2>Liquidaciones por cajero</h2><div class="tablewrap"><table class="tbl"><thead><tr><th>Cajero</th><th>Fecha</th><th class="r">Esperado</th><th class="r">Contado</th><th class="r">Diferencia</th></tr></thead><tbody>${shifts.map((s) => { const e = s.t1 ? s.expected : shiftSummary(s).expected; return `<tr class="click" data-a="liq" data-id="${s.id}"><td>${esc(s.un)}</td><td>${dmy(s.d0)} ${hhmm(s.t0)}</td><td class="r num">${money(e)}</td><td class="r num">${s.t1 ? money(s.counted) : "abierta"}</td><td class="r num ${s.diff < 0 ? "loss" : s.diff > 0 ? "gain" : ""}">${s.t1 ? money(s.diff) : ""}</td></tr>`; }).join("")}</tbody></table></div></div>` : ""}
      ${scope === "todas" ? `<div class="card"><h2>Por tienda</h2><table class="tbl"><thead><tr><th>Tienda</th><th class="r">Ventas</th><th class="r">Neto</th></tr></thead><tbody>${Object.entries(A.store).map(([s, o]) => `<tr><td>${esc(s)}</td><td class="r num">${o.n}</td><td class="r num">${money(o.m)}</td></tr>`).join("")}</tbody></table><p class="muted sm" style="margin-top:6px">${Object.values(DB.stores).map((s) => `${esc(s.name)}: datos hasta ${s.to ? dmy(s.to) : "—"}`).join(" · ")}</p></div>` : ""}
    </div></div>`;
};
function reportHtml() {
  const { from, to, A, shifts, top } = ui.repData;
  return `<h2>Reporte de ventas · ${esc(DB.biz.name)}</h2><p>${dmy(from)} al ${dmy(to)} · impreso ${fmtDT(Date.now())} por ${esc(me().name)}</p>
    <table class="tbl"><tbody><tr><td>Ventas netas</td><td class="r"><b>${money(A.net)}</b></td></tr><tr><td>N° de ventas</td><td class="r">${A.n}</td></tr><tr><td>Ticket promedio</td><td class="r">${money(A.avg)}</td></tr>${can("costos") ? `<tr><td>Costo de lo vendido</td><td class="r">${money(A.cost)}</td></tr><tr><td>Ganancia estimada</td><td class="r"><b>${money(A.profit)}</b></td></tr>` : ""}<tr><td>Devoluciones</td><td class="r">${money(A.ret)}</td></tr><tr><td>Anuladas</td><td class="r">${A.voids}</td></tr></tbody></table>
    <h3>Por medio de pago</h3><table class="tbl"><tbody>${Object.entries(A.by).map(([m, a]) => `<tr><td>${METHODS[m] || m}</td><td class="r">${money(a)}</td></tr>`).join("")}</tbody></table>
    <h3>Comprobantes</h3><table class="tbl"><thead><tr><th>Tipo</th><th class="r">Cant.</th><th class="r">Gravada</th><th class="r">IGV</th><th class="r">Total</th></tr></thead><tbody>${Object.entries(A.doc).map(([d, o]) => `<tr><td>${DOCS[d] || d}</td><td class="r">${o.n}</td><td class="r">${money(o.grav)}</td><td class="r">${money(o.igv)}</td><td class="r">${money(o.m)}</td></tr>`).join("")}</tbody></table>
    <h3>Productos más vendidos</h3><table class="tbl"><thead><tr><th>Producto</th><th class="r">Cant.</th><th class="r">Vendido</th></tr></thead><tbody>${top.map(([n, o]) => `<tr><td>${esc(n)}</td><td class="r">${fmtQ(o.q)}</td><td class="r">${money(o.m)}</td></tr>`).join("")}</tbody></table>
    <h3>Por usuario</h3><table class="tbl"><tbody>${Object.entries(A.user).map(([u, o]) => `<tr><td>${esc(u)}</td><td class="r">${o.n} ventas</td><td class="r">${money(o.m)}</td></tr>`).join("")}</tbody></table>
    ${shifts.length ? `<h3>Liquidaciones</h3><table class="tbl"><thead><tr><th>Cajero</th><th>Apertura</th><th class="r">Esperado</th><th class="r">Contado</th><th class="r">Dif.</th></tr></thead><tbody>${shifts.map((s) => `<tr><td>${esc(s.un)}</td><td>${fmtDT(s.t0)}</td><td class="r">${money(s.t1 ? s.expected : shiftSummary(s).expected)}</td><td class="r">${s.t1 ? money(s.counted) : "abierta"}</td><td class="r">${s.t1 ? money(s.diff) : ""}</td></tr>`).join("")}</tbody></table>` : ""}`;
}
act({
  rscope: (el) => { ui.rscope = el.dataset.s; render(); },
  repprint: () => printHtml(reportHtml(), "rep")
});

/* ===================== 90 · AJUSTES: negocio, comprobantes, usuarios, balanza, tiendas y datos ===================== */
const ATABS = [["negocio", "Negocio"], ["comp", "Comprobantes"], ["cobros", "Cobros y puntos"], ["venta", "Pantalla de venta"], ["balanza", "Balanza"], ["usuarios", "Usuarios y permisos"], ["tiendas", "Tiendas"], ["nube", "Nube"], ["datos", "Datos y respaldo"], ["bitacora", "Bitácora"]];
const fld = (label, inner, hint) => `<label class="fld"><span>${label}</span>${inner}${hint ? `<small class="hint2">${hint}</small>` : ""}</label>`;
const inp = (key, val, o = {}) => `<input class="inp ${o.num ? "num" : ""}" data-set="${key}" value="${esc(val ?? "")}" ${o.num ? 'inputmode="decimal"' : ""} ${o.ph ? `placeholder="${esc(o.ph)}"` : ""} maxlength="${o.max || 80}">`;
const tog = (key, on, label, sub) => `<div class="set"><div><b>${label}</b>${sub ? `<small>${sub}</small>` : ""}</div><button class="switch" data-a="tog" data-k="${key}" aria-pressed="${!!on}" aria-label="${esc(label)}"></button></div>`;
const getK = (k) => k.split(".").reduce((o, x) => (o == null ? o : o[x]), DB);
function setK(k, v) { const p = k.split("."), last = p.pop(), o = p.reduce((a, x) => a[x], DB); o[last] = v; }
function dbSize() { try { return new Blob([JSON.stringify(DB)]).size; } catch (e) { return 0; } }
const kb = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");
VIEWS.aj = function viewSettings(v) {
  const t = ui.atab, C = DB.cfg, B = DB.biz;
  let body = "";
  if (t === "negocio") body = `<div class="card"><h2>Datos del negocio</h2><p class="muted" style="margin-bottom:10px">Salen en los comprobantes y reportes.</p>
      ${fld("Nombre comercial", inp("biz.name", B.name, { max: 50 }))}
      <div class="two">${fld("RUC", inp("biz.ruc", B.ruc, { ph: "Opcional", max: 11 }))}${fld("Teléfono", inp("biz.phone", B.phone, { max: 20 }))}</div>
      ${fld("Dirección", inp("biz.addr", B.addr, { max: 100 }))}
      ${fld("Mensaje al pie del ticket", inp("biz.foot", B.foot, { max: 80 }))}
      <div class="two">${fld("Nombre de esta tienda o caja", inp("biz.store", B.store, { max: 40 }), "Para reportes entre tiendas")}${fld("Código de tienda", `<input class="inp" value="${esc(B.sid)}" disabled>`)}</div></div>`;
  else if (t === "comp") body = `<div class="card"><h2>Comprobantes</h2>
      ${tog("cfg.igvOn", C.igvOn, "Mis precios incluyen IGV", "Muestra op. gravada e IGV en boletas y facturas")}
      ${C.igvOn ? `<div class="two">${fld("Tasa de IGV (%)", inp("cfg.igv", C.igv, { num: true, max: 5 }), "18% general · 10.5% restaurantes MYPE")}${fld("Comprobante por defecto", `<select class="inp" data-set="cfg.docDef">${Object.entries(DOCS).map(([k, n]) => `<option value="${k}" ${C.docDef === k ? "selected" : ""}>${n}</option>`).join("")}</select>`)}</div>` : fld("Comprobante por defecto", `<select class="inp" data-set="cfg.docDef">${Object.entries(DOCS).map(([k, n]) => `<option value="${k}" ${C.docDef === k ? "selected" : ""}>${n}</option>`).join("")}</select>`)}
      <h3 class="h3">Series y numeración</h3><div class="tablewrap"><table class="tbl"><thead><tr><th>Comprobante</th><th>Serie</th><th>Último número</th></tr></thead><tbody>${Object.entries(DOCS).map(([k, n]) => `<tr><td>${n}</td><td><input class="inp sm" data-set="cfg.series.${k}.s" value="${esc(C.series[k].s)}" maxlength="4"></td><td><input class="inp sm num" data-set="cfg.series.${k}.n" value="${C.series[k].n}" inputmode="numeric" maxlength="8"></td></tr>`).join("")}</tbody></table></div>
      <p class="muted sm" style="margin-top:8px">Los comprobantes de Caja Fácil son de control interno. Para que una boleta o factura sea electrónica válida, emítela también en SUNAT (SEE-SOL) o con tu proveedor electrónico usando la misma serie y número.</p></div>
      <div class="card"><h2>Impresión</h2>${fld("Ancho de la ticketera", `<select class="inp" data-set="cfg.paper"><option value="80" ${+C.paper === 80 ? "selected" : ""}>80 mm</option><option value="58" ${+C.paper === 58 ? "selected" : ""}>58 mm</option></select>`)}
      ${tog("cfg.autoPrint", C.autoPrint, "Imprimir el ticket al cobrar", "Sin tener que tocar «Imprimir»")}
      <p class="muted sm">En Chrome puedes imprimir sin la ventana de impresión iniciándolo con la opción --kiosk-printing.</p></div>`;
  else if (t === "cobros") body = `<div class="card"><h2>Yape y Plin</h2><p class="muted" style="margin-bottom:10px">Tu número aparece en la pantalla de cobro para que el cliente pague sin preguntar.</p>
      <div class="two">${fld("Número de Yape", inp("cfg.yapeNum", C.yapeNum, { ph: "987 654 321", max: 15 }))}${fld("Número de Plin", inp("cfg.plinNum", C.plinNum, { ph: "Opcional", max: 15 }))}</div>
      ${fld("Nombre que le aparece al cliente", inp("cfg.payName", C.payName, { ph: "Ej: Minimarket Los Andes", max: 40 }))}</div>
      <div class="card"><h2>Programa de puntos</h2>${tog("cfg.pts.on", C.pts.on, "Dar puntos a clientes registrados", "Acumulan al comprar y los canjean como descuento")}
      ${C.pts.on ? `<div class="two">${fld("Puntos por cada S/ 1", inp("cfg.pts.per", C.pts.per, { num: true }))}${fld("Valor de 1 punto (S/)", inp("cfg.pts.val", C.pts.val, { num: true }), `100 puntos = ${money(100 * C.pts.val)}`)}</div>${fld("Puntos mínimos para canjear", inp("cfg.pts.min", C.pts.min, { num: true }))}` : ""}</div>`;
  else if (t === "venta") body = `<div class="card"><h2>Pantalla de venta</h2>
      ${fld("Cómo se ve la venta", `<div class="seg">${[["scan", "Escáner (minimarket)"], ["tiles", "Fichas con fotos"]].map(([k, n]) => `<button class="${(C.view === "tiles" ? "tiles" : "scan") === k ? "on" : ""}" data-a="setv" data-k="cfg.view" data-v="${k}">${n}</button>`).join("")}</div>`, "Escáner: sin fotos, muestra lo último que pasaste. Fichas: productos con foto para tocar")}
      ${fld("Tamaño de las fichas de productos", `<div class="seg">${[["s", "Pequeñas"], ["m", "Medianas"], ["l", "Grandes (táctil)"]].map(([k, n]) => `<button class="${C.tile === k ? "on" : ""}" data-a="setv" data-k="cfg.tile" data-v="${k}">${n}</button>`).join("")}</div>`)}
      ${fld("Mesas o cuentas abiertas", inp("cfg.tables", C.tables, { num: true, ph: "0 = no uso mesas", max: 3 }), "Para restaurantes, juguerías o cuentas que se van sumando")}
      ${tog("cfg.needShift", C.needShift, "Preguntar el sencillo antes del primer cobro", "Apagado: la caja se abre sola al primer cobro y el sencillo se anota después en Caja")}
      ${tog("cfg.negStock", C.negStock, "Permitir vender sin stock", "Si está apagado, avisa cuando no queda")}
      ${tog("cfg.mute", !C.mute, "Sonidos", "Pitido al agregar y cobrar")}
      ${fld("Bloquear tras minutos sin uso", inp("cfg.lock", C.lock, { num: true, max: 3 }), "0 = nunca. Solo si los usuarios tienen clave")}</div>
      <div class="card" style="margin-top:14px"><h2>Códigos de barras</h2><p class="muted">Con lector USB o Bluetooth no hay nada que configurar: escanea y el producto entra solo al ticket. Sin lector, toca <b>Cámara</b> en la pantalla de venta y apunta con el celular o la webcam.</p><p class="muted" style="margin-top:8px">Para que un producto se reconozca, escribe su código en Productos, en «Código rápido o de barras».</p></div>`;
  else if (t === "balanza") body = `<div class="card"><h2>Balanza USB o serial</h2><p class="muted" style="margin-bottom:10px">Con Chrome o Edge en la computadora, Caja Fácil lee el peso directo de la balanza. Si no tienes balanza conectada, igual puedes escribir los gramos al vender.</p>
      <div class="set"><div><b>${scaleState.on ? "Balanza conectada" : "Balanza sin conectar"}</b><small>${serialOk() ? "Tu navegador permite balanzas" : "Este navegador no permite balanzas USB"}</small></div><div class="row">${scaleState.on ? `<button class="btn sec sm" data-a="scaletest">Probar</button><button class="btn red sec sm" data-a="scaleoff">Desconectar</button>` : `<button class="btn sm" data-a="scaleconnect" ${serialOk() ? "" : "disabled"}>Conectar</button>`}</div></div>
      <div class="two">${fld("Velocidad (baudios)", `<select class="inp" data-set="cfg.scale.baud">${[1200, 2400, 4800, 9600, 19200, 38400].map((b) => `<option ${+C.scale.baud === b ? "selected" : ""}>${b}</option>`).join("")}</select>`, "Casi todas usan 9600")}${fld("Formato", `<select class="inp" data-set="cfg.scale.fmt">${["8N1", "7E1", "7O1", "8E1"].map((f) => `<option ${C.scale.fmt === f ? "selected" : ""}>${f}</option>`).join("")}</select>`)}</div>
      <div class="two">${fld("La balanza envía el peso", `<select class="inp" data-set="cfg.scale.cmd"><option value="" ${!C.scale.cmd ? "selected" : ""}>Sola, todo el tiempo</option><option value="W" ${C.scale.cmd === "W" ? "selected" : ""}>Cuando se le pide «W» (Toledo)</option><option value="ENQ" ${C.scale.cmd === "ENQ" ? "selected" : ""}>Cuando se le pide ENQ</option><option value="P" ${C.scale.cmd === "P" ? "selected" : ""}>Cuando se le pide «P»</option><option value="SI" ${C.scale.cmd === "SI" ? "selected" : ""}>Cuando se le pide «SI» (MT-SICS)</option></select>`)}${fld("Unidad", `<select class="inp" data-set="cfg.scale.unit"><option value="auto" ${C.scale.unit === "auto" ? "selected" : ""}>Detectar sola</option><option value="kg" ${C.scale.unit === "kg" ? "selected" : ""}>Kilos</option><option value="g" ${C.scale.unit === "g" ? "selected" : ""}>Gramos</option></select>`)}</div>
      <p class="muted sm">Si cambias la velocidad o el formato, desconecta y vuelve a conectar.</p></div>
      <div class="card"><h2>Etiquetas con código de barras</h2><p class="muted" style="margin-bottom:10px">Si tu balanza imprime etiquetas (código que empieza con 2), al escanearlas se agrega el producto con su peso.</p>
      ${tog("cfg.labels.on", C.labels.on, "Leer etiquetas de balanza")}
      <div class="two">${fld("Dígitos de prefijo", inp("cfg.labels.pre", C.labels.pre, { num: true, max: 1 }), "Normalmente 2 (ej: 20, 21…)")}${fld("Dígitos del código del producto", inp("cfg.labels.len", C.labels.len, { num: true, max: 1 }), "Normalmente 5")}</div>
      ${fld("La etiqueta trae", `<select class="inp" data-set="cfg.labels.kind"><option value="peso" ${C.labels.kind === "peso" ? "selected" : ""}>El peso en gramos</option><option value="precio" ${C.labels.kind === "precio" ? "selected" : ""}>El precio en céntimos</option></select>`)}
      <p class="muted sm">Ejemplo: 2000001002508 → producto con código 1, 250 g.</p></div>`;
  else if (t === "usuarios") body = `<div class="card"><div class="row sp"><h2>Usuarios</h2><button class="btn sm" data-a="unew">+ Usuario</button></div><p class="muted" style="margin-bottom:10px">Cada persona entra con su nombre y su clave. Así sabes quién vendió, anuló o cerró caja.</p>
      <div class="list">${DB.users.map((u) => `<button class="it" data-a="uedit" data-id="${u.id}"><span class="av" style="--h:${avHue(u)}">${esc(initials(u.name))}</span><div class="t"><b>${esc(u.name)}${u.id === ui.user ? " (tú)" : ""}</b><small>${esc(ROLE_LABEL[u.role])} · ${u.pin ? "con clave" : "sin clave"}${u.on ? "" : " · desactivado"}</small></div></button>`).join("")}</div>
      ${!DB.users.some((u) => u.pin && u.role === "admin") ? `<p class="warnbox">Ponle una clave al Administrador: sin ella cualquiera puede entrar como dueño y nadie puede autorizar operaciones delicadas.</p>` : ""}</div>
      <div class="card"><h2>Permisos por tipo de usuario</h2><p class="muted" style="margin-bottom:10px">El administrador siempre puede todo. Lo que un usuario no puede hacer, lo autoriza un supervisor con su clave en ese momento.</p>
      <div class="tablewrap"><table class="tbl perms"><thead><tr><th>Puede…</th>${["cajero", "vendedor"].map((r) => `<th class="c">${ROLE_LABEL[r].split(" ")[0]}</th>`).join("")}</tr></thead><tbody>${PERMS.map(([k, l]) => `<tr><td>${l}</td>${["cajero", "vendedor"].map((r) => `<td class="c"><input type="checkbox" data-perm="${r}:${k}" ${DB.roles[r].includes(k) ? "checked" : ""} aria-label="${esc(ROLE_LABEL[r] + ": " + l)}"></td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`;
  else if (t === "nube") body = cloudSettingsHtml();
  else if (t === "tiendas") { const st = Object.entries(DB.stores); body = `<div class="card"><h2>Varias tiendas</h2><p class="muted" style="margin-bottom:10px">Envía y recibe archivos entre tiendas (por WhatsApp, correo o USB). Esta tienda: <b>${esc(B.store)}</b> (${esc(B.sid)}).</p>
      <div class="acts3"><button class="btn sec" data-a="sendcat">Enviar catálogo<br><small>productos y precios</small></button><button class="btn sec" data-a="sendsales">Enviar ventas<br><small>a la tienda principal</small></button><label class="btn">Recibir archivo<br><small>catálogo, ventas o transferencia</small><input type="file" accept=".json,application/json" data-in="recvfile" hidden></label></div>
      <p class="muted sm" style="margin-top:10px">Las transferencias de stock se hacen desde Productos › Transferir.</p></div>
      <div class="card"><h2>Tiendas recibidas</h2>${st.length ? st.map(([sid, s]) => `<div class="kv"><span><b>${esc(s.name)}</b><small class="muted"> · ${(s.sales || []).length} ventas · hasta ${s.to ? dmy(s.to) : "—"} · recibido ${fmtDT(s.t)}</small></span><button class="link xs" data-a="storedel" data-id="${esc(sid)}">Quitar</button></div>`).join("") + `<p class="muted sm" style="margin-top:8px">Míralas juntas en Reportes › Todas las tiendas.</p>` : `<p class="muted">Aún no recibes ventas de otras tiendas.</p>`}</div>`; }
  else if (t === "datos") { const size = dbSize(); body = `<div class="card"><h2>Respaldo</h2><p class="muted" style="margin-bottom:10px">Tus datos viven en esta computadora (${kb(size)}). Descarga un respaldo seguido y guárdalo en tu correo o USB.<br><b>${C.lastBackup ? "Último respaldo: " + fmtDT(C.lastBackup) : "Aún no descargas ningún respaldo."}</b></p>
      <div class="two"><button class="btn" data-a="backup">Descargar respaldo</button><label class="btn sec">Restaurar respaldo<input type="file" accept="application/json,.json" data-in="restore" hidden></label></div></div>
      <div class="card"><h2>Organizar la base de datos</h2><p class="muted" style="margin-bottom:10px">${DB.sales.length} ventas · ${DB.products.length} productos · ${DB.clients.length} clientes · ${DB.kx.length} movimientos de stock.</p>
      <div class="two"><button class="btn sec" data-a="dbcheck">Revisar y reparar</button><button class="btn sec" data-a="archive">Archivar ventas antiguas</button></div>
      ${(DB.archive || []).length ? `<p class="muted sm" style="margin-top:8px">Meses archivados: ${DB.archive.map((a) => esc(monthName(a.m))).join(", ")}</p>` : ""}</div>
      <div class="card"><h2>Zona de cuidado</h2><div class="two"><button class="btn sec" data-a="sample">Cargar ejemplos</button><button class="btn red sec" data-a="reset">Borrar todo</button></div></div>
      <p class="muted sm">Imágenes de productos: Fluent Emoji de Microsoft (licencia MIT).</p>`; }
  else if (t === "bitacora") { const q = norm(ui.lq || ""), l = DB.log.filter((x) => !q || norm(x.a + " " + x.x + " " + x.u).includes(q)).slice().reverse().slice(0, 300); body = `<div class="card"><div class="row sp wrap"><h2>Bitácora de seguridad</h2><button class="btn sec sm" data-a="logcsv">Exportar</button></div><p class="muted" style="margin-bottom:10px">Quién entró, anuló, devolvió, cambió precios, cerró caja o autorizó algo.</p>
      <input class="inp" id="lq" type="search" placeholder="Buscar" value="${esc(ui.lq || "")}" style="margin-bottom:10px">
      ${l.length ? `<div class="tablewrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>${l.map((x) => `<tr><td>${fmtDT(x.t)}</td><td>${esc(x.u)}</td><td>${esc(x.a)}</td><td>${esc(x.x)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">Sin registros.</p>`}</div>`; }
  v.innerHTML = `<div class="ph"><h1>Ajustes</h1></div><div class="aj"><nav class="ajnav">${ATABS.map(([k, n]) => `<button class="${t === k ? "on" : ""}" data-a="atab" data-t="${k}">${n}</button>`).join("")}</nav><div class="stack">${body}</div></div>`;
};
function openUser(id) {
  const u = id ? usr(id) : { name: "", role: "cajero", on: true, pin: "" };
  ui.ue = { id, role: u.role };
  openModal(`<h2>${id ? "Editar usuario" : "Nuevo usuario"}</h2>
    <label class="fld"><span>Nombre</span><input class="inp" id="un" value="${esc(u.name)}" maxlength="30" autofocus autocomplete="off"></label>
    <label class="fld"><span>Tipo</span><select class="inp" id="ur" ${id && id === ui.user ? "disabled" : ""}>${Object.entries(ROLE_LABEL).map(([k, n]) => `<option value="${k}" ${u.role === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>
    ${id ? `<div class="set"><div><b>Clave</b><small>${u.pin ? "Tiene clave de 4 dígitos" : "Sin clave"}</small></div><div class="row"><button class="btn sec sm" data-a="upin" data-id="${id}">${u.pin ? "Cambiar" : "Poner clave"}</button>${u.pin ? `<button class="btn red sec sm" data-a="upinoff" data-id="${id}">Quitar</button>` : ""}</div></div>
      ${id !== ui.user ? `<label class="ck"><input type="checkbox" id="uon" ${u.on ? "checked" : ""}> Puede entrar al sistema</label>` : ""}` : `<p class="muted">Después de guardar le pondrás su clave.</p>`}
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" data-enter data-a="usave">Guardar</button></div>
    ${id && id !== ui.user && id !== "u1" ? `<button class="link" data-a="udel" data-id="${id}" style="width:100%;color:var(--red)">Eliminar usuario</button>` : ""}`);
}
/* ---------- archivos entre tiendas ---------- */
function sendCatalog() {
  const pack = { cf: "caja-facil", kind: "catalog", id: "CAT-" + uid().toUpperCase(), t: Date.now(), from: { sid: DB.biz.sid, name: DB.biz.store }, products: DB.products.map((p) => ({ name: p.name, code: p.code, price: p.price, cost: p.cost || 0, cat: p.cat || "", unit: p.unit, min: p.min || 0, igv: p.igv !== false, pres: p.pres || [], img: p.img && p.img.startsWith("lib:") ? p.img : "" })) };
  download(`catalogo-${DB.biz.sid}-${dkey()}.json`, JSON.stringify(pack), "application/json"); log("Catálogo enviado", `${pack.products.length} productos`); toast("Catálogo descargado: envíalo a la otra tienda");
}
function sendSales() {
  promptBox({ title: "Enviar ventas", text: "¿Desde qué fecha? Se envían las ventas de esta tienda hasta hoy.", label: "Desde (AAAA-MM-DD)", value: DB.cfg.lastSent || dkey().slice(0, 8) + "01", ok: "Descargar archivo" }, (from) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return toast("Fecha no válida");
    const to = dkey(), list = repSales(from, to, "local").map((s) => ({ id: s.id, date: s.date, t: s.t, total: s.total, ret: s.ret, pays: s.pays, items: s.items.map((i) => ({ name: i.name, qty: i.qty, price: i.price, cost: i.cost, cat: i.cat, unit: i.unit })), user: s.user, doc: s.doc, igv: s.igv, gravada: s.gravada, void: s.void }));
    const pack = { cf: "caja-facil", kind: "sales", id: "VEN-" + uid().toUpperCase(), t: Date.now(), from: { sid: DB.biz.sid, name: DB.biz.store }, range: [from, to], sales: list };
    DB.cfg.lastSent = to; save(); download(`ventas-${DB.biz.sid}-${from}-a-${to}.json`, JSON.stringify(pack), "application/json"); log("Ventas enviadas", `${list.length} ventas ${from} a ${to}`); toast("Archivo de ventas descargado");
  });
}
function receivePack(o) {
  if (!o || typeof o !== "object") return toast("Ese archivo no es de Caja Fácil");
  if (o.cf !== "caja-facil") {
    if (Array.isArray(o.products) && Array.isArray(o.sales)) return confirmBox("Es un respaldo completo. ¿Restaurarlo? Reemplaza todos los datos actuales.", "Restaurar", () => restoreDB(o), true);
    return toast("Ese archivo no es de Caja Fácil");
  }
  if (o.from && o.from.sid === DB.biz.sid && o.kind !== "catalog") return toast("Ese archivo salió de esta misma tienda");
  if (o.kind === "transfer") {
    if (DB.recv.includes(o.id)) return toast("Esa transferencia ya fue recibida antes", true);
    const rows = o.items.map((x) => ({ x, p: DB.products.find((p) => (x.code && p.code === x.code) || norm(p.name) === norm(x.name)) }));
    openModal(`<h2>Recibir transferencia</h2><p class="muted" style="margin-bottom:10px">De <b>${esc(o.from.name)}</b> · ${fmtDT(o.t)}</p><div class="list">${rows.map(({ x, p }) => `<div class="it sm"><div class="t"><b>${esc(x.name)}</b><small>${p ? `Stock actual ${p.stock == null ? "sin control" : fmtQ(p.stock)}` : "Producto nuevo: se creará"}</small></div><div class="v num">+${fmtQ(x.qty)}${x.unit === "kg" ? " kg" : ""}</div></div>`).join("")}</div>
      <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" id="trok">Recibir y sumar al stock</button></div>`, "wide");
    $("#trok").onclick = (e) => {
      e.stopPropagation();
      rows.forEach(({ x, p }) => {
        if (!p) { p = { id: uid(), name: x.name, code: x.code || "", price: x.price, cost: x.cost, cat: x.cat, unit: x.unit === "kg" ? "kg" : "u", stock: 0, min: 0, pres: [], recipe: [], igv: true, img: "" }; if (p.code && DB.products.some((y) => y.code === p.code)) p.code = ""; DB.products.push(p); }
        if (p.stock == null) p.stock = 0;
        stockAdd(p, x.qty, "trf_in", `De ${o.from.name} · ${o.id}`);
      });
      DB.recv.push(o.id); log("Transferencia recibida", `${o.id} de ${o.from.name}`); save(); closeModal(); toast("Transferencia recibida"); render();
    };
    return;
  }
  if (o.kind === "catalog") {
    let nw = 0, up = 0;
    o.products.forEach((x) => {
      const p = DB.products.find((y) => (x.code && y.code === x.code) || norm(y.name) === norm(x.name));
      if (p) { Object.assign(p, { name: x.name, price: x.price, cost: x.cost, cat: x.cat, unit: x.unit, igv: x.igv, pres: x.pres || [] }); if (x.img) p.img = x.img; up++; }
      else { if (x.code && DB.products.some((y) => y.code === x.code)) return; DB.products.push({ id: uid(), name: x.name, code: x.code, price: x.price, cost: x.cost, cat: x.cat, unit: x.unit, igv: x.igv, pres: x.pres || [], recipe: [], stock: null, min: x.min || 0, img: x.img || "" }); nw++; }
    });
    log("Catálogo recibido", `De ${o.from.name}: ${nw} nuevos, ${up} actualizados`); save(); toast(`Catálogo recibido: ${nw} nuevos, ${up} actualizados`, true); render(); return;
  }
  if (o.kind === "sales") {
    const st = DB.stores[o.from.sid] || (DB.stores[o.from.sid] = { name: o.from.name, sales: [] });
    st.name = o.from.name; st.t = Date.now();
    const ids = new Set(o.sales.map((s) => s.id)); st.sales = st.sales.filter((s) => !ids.has(s.id)).concat(o.sales);
    st.from = st.sales.reduce((a, s) => (!a || s.date < a ? s.date : a), ""); st.to = st.sales.reduce((a, s) => (s.date > a ? s.date : a), "");
    log("Ventas recibidas", `${o.from.name}: ${o.sales.length} ventas`); save(); toast(`Recibidas ${o.sales.length} ventas de ${o.from.name}`, true); render(); return;
  }
  toast("No reconozco ese archivo");
}
function restoreDB(o) { DB = normalize(o); ui.user = DB.users[0].id; saveAll(); log("Respaldo restaurado", ""); toast("Respaldo restaurado"); if (needLogin()) loginScreen(); else go("venta"); }
function dbCheck() {
  const fixes = [];
  const seen = new Map();
  DB.products.forEach((p) => { if (p.code) { if (seen.has(p.code)) { fixes.push(`Código ${p.code} repetido en «${p.name}»: se quitó`); p.code = ""; } else seen.set(p.code, p); } if (!(p.price > 0)) fixes.push(`«${p.name}» no tiene precio`); if (p.stock != null && p.stock < 0) fixes.push(`«${p.name}» tiene stock negativo (${fmtQ(p.stock)})`); p.recipe = (p.recipe || []).filter((r) => prod(r.id)); });
  DB.tickets.forEach((t) => { const n = t.items.length; t.items = t.items.filter((i) => i.quick || resolveLine(i)); if (t.items.length < n) fixes.push("Se quitaron productos borrados de un ticket en espera"); if (t.client && !cli(t.client)) t.client = ""; });
  const open = DB.shifts.filter((s) => !s.t1 && s.d0 < addD(dkey(), -2)); if (open.length) fixes.push(`${open.length} caja(s) siguen abiertas desde hace días: ciérralas en Caja`);
  saveAll(); log("Revisión de base de datos", fixes.length + " observaciones");
  openModal(`<h2>Revisión terminada</h2>${fixes.length ? `<ul class="ul">${fixes.slice(0, 30).map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : `<p>Todo está en orden.</p>`}<div class="btns"><button class="btn" data-a="close">Listo</button></div>`);
}
function archiveUI() {
  const months = allMonths().filter((m) => m < mOf()).filter((m) => DB.sales.some((s) => mOf(s.date) === m));
  if (!months.length) return toast("No hay meses anteriores para archivar");
  openModal(`<h2>Archivar ventas antiguas</h2><p class="muted" style="margin-bottom:12px">Descarga las ventas y movimientos hasta el mes que elijas y los quita de esta computadora para que todo vaya más rápido. En reportes queda el total de cada mes archivado.</p>
    <label class="fld"><span>Archivar hasta (incluido)</span><select class="inp" id="armon">${months.map((m) => `<option value="${m}">${monthName(m)}</option>`).join("")}</select></label>
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" data-a="archiveok">Descargar y archivar</button></div>`);
}
act({
  atab: (el) => { ui.atab = el.dataset.t; render(); },
  tog: (el) => { const k = el.dataset.k, v = !getK(k); setK(k, k === "cfg.mute" ? !DB.cfg.mute : v); save(); render(); },
  setv: (el) => { setK(el.dataset.k, el.dataset.v); save(); render(); },
  unew: () => openUser(""),
  uedit: (el) => openUser(el.dataset.id),
  usave: () => {
    const name = $("#un").value.trim(); if (!name) return toast("Escribe el nombre");
    const id = ui.ue.id, role = $("#ur").value;
    if (DB.users.some((u) => u.id !== id && norm(u.name) === norm(name))) return toast("Ya hay un usuario con ese nombre");
    if (id) {
      const u = usr(id); if (u.role === "admin" && role !== "admin" && DB.users.filter((x) => x.role === "admin" && x.on).length < 2) return toast("Debe quedar al menos un administrador");
      u.name = name; u.role = role; const on = $("#uon"); if (on) u.on = on.checked; log("Usuario editado", name); save(); closeModal(); render();
    } else {
      const u = { id: "u" + uid(), name, role, pin: "", on: true }; DB.users.push(u); log("Usuario creado", `${name} (${ROLE_LABEL[role]})`); save(); closeModal(); render();
      setPinFor(u, () => render());
    }
  },
  upin: (el) => { const u = usr(el.dataset.id); closeModal(); setPinFor(u, () => render()); },
  upinoff: (el) => { const u = usr(el.dataset.id); u.pin = ""; log("Clave quitada", u.name); save(); closeModal(); toast("Clave quitada"); render(); },
  udel: (el) => { const u = usr(el.dataset.id); confirmBox(`¿Eliminar a ${u.name}?`, "Eliminar", () => { DB.users = DB.users.filter((x) => x !== u); log("Usuario eliminado", u.name); save(); render(); }, true, "Sus ventas pasadas conservan su nombre."); },
  sendcat: sendCatalog,
  sendsales: sendSales,
  storedel: (el) => confirmBox("¿Quitar las ventas de esa tienda?", "Quitar", () => { delete DB.stores[el.dataset.id]; save(); render(); }),
  backup: () => { DB.cfg.lastBackup = Date.now(); save(); download(`respaldo-caja-facil-${dkey()}.json`, JSON.stringify(DB), "application/json"); log("Respaldo descargado", ""); toast("Respaldo descargado"); render(); },
  reset: () => need("ajustes", () => confirmBox("¿Borrar TODOS los datos? Esto no se puede deshacer.", "Borrar todo", () => { DB = normalize(null); ui.user = DB.users[0].id; saveAll(); toast("Datos borrados"); go("venta"); }, true, "Descarga un respaldo antes si tienes dudas.")),
  dbcheck: dbCheck,
  archive: archiveUI,
  archiveok: () => {
    const m = $("#armon").value, pick = (k) => DB[k].filter((x) => mOf(BIG[k](x)) <= m);
    const pack = { cf: "caja-facil", kind: "archive", upto: m, t: Date.now(), store: DB.biz.store, sales: pick("sales"), moves: pick("moves"), kx: pick("kx"), log: pick("log") };
    download(`archivo-caja-facil-hasta-${m}.json`, JSON.stringify(pack), "application/json");
    const sum = {}; pack.sales.forEach((s) => { const k = mOf(s.date), o = sum[k] || (sum[k] = { m: k, n: 0, total: 0 }); if (!s.void) { o.n++; o.total = r2(o.total + s.total); } });
    DB.archive = (DB.archive || []).concat(Object.values(sum));
    Object.keys(BIG).forEach((k) => { DB[k] = DB[k].filter((x) => mOf(BIG[k](x)) > m); });
    saveAll(); closeModal(); log("Ventas archivadas", "hasta " + monthName(m)); toast(`Archivado hasta ${monthName(m)}. Guarda bien el archivo descargado.`, true); render();
  },
  logcsv: () => csvOut([["fecha", "usuario", "accion", "detalle"], ...DB.log.map((x) => [fmtDT(x.t), x.u, x.a, x.x])], `bitacora-${dkey()}.csv`)
});

/* ===================== 99 · EVENTOS, TECLADO E INICIO ===================== */
document.addEventListener("click", (e) => {
  if (e.target === $("#modal")) { if (ui.mk === "pay" || ui.mk === "weigh" || ui.mk === "count") return; if (ui.mk === "cam" && cam.mode === "codigo") return A.camback(); return closeModal(); }
  const el = e.target.closest("[data-a]");
  const gate = $("#susp"); if (gate && !gate.contains(e.target)) return; // caja bloqueada (licencia): solo funciona su aviso
  if (el && A[el.dataset.a] && !el.disabled) { e.preventDefault(); A[el.dataset.a](el); }
});
function keepFocus(id, fn) {
  const el = $("#" + id), pos = el ? el.selectionStart : null; fn();
  const n = $("#" + id); if (n) { n.focus(); try { if (pos != null) n.setSelectionRange(pos, pos); } catch (e) {} }
}
let lqT;
document.addEventListener("input", (e) => {
  const t = e.target, id = t.id;
  if (id === "q") { ui.q = t.value; paintGrid(); }
  else if (id === "pq") { ui.pq = t.value; paintPList(); }
  else if (id === "cq") { ui.cq = t.value; paintCList(); }
  else if (id === "vq") { ui.vq = t.value; const [f, to] = rangeKeys(ui.range, ui.from, ui.to); paintVList(f, to); }
  else if (id === "pcq") { ui.pcq = t.value; const l = $("#pclist"); if (l && ui.pclist) l.innerHTML = ui.pclist(); }
  else if (id === "imgq") { const g = $("#imggrid"); if (g && ui.imgdraw) g.innerHTML = ui.imgdraw(t.value); }
  else if (id === "lq") { clearTimeout(lqT); lqT = setTimeout(() => { ui.lq = t.value; keepFocus("lq", render); }, 250); }
  else if (id === "trfq") { ui.trfq = t.value; trfRead(); keepFocus("trfq", openTransfer); }
  else if (t.dataset.in === "recv" && ui.pay) { ui.pay.recv = t.value; updPay(); }
  else if (id === "pref" && ui.pay) ui.pay.ref = t.value;
  else if (id === "imp") updImport();
  else if (id === "rsq" || id === "rsc") updRestock();
  else if (t.dataset.in === "wk") paintWeighLcd();
  else if (id === "qv") updQty();
  else if (id === "cntd" && ui.cnt) { ui.cnt.direct = t.value; const b = $("[data-a=shclose]"); if (b) b.disabled = t.value.trim() === "" && !Object.values(ui.cnt.q).some((n) => n > 0); }
  else if (id === "mva" && $("#mvsum")) { const l = parseAmounts(t.value); $("#mvsum").textContent = l.length ? `${l.length} ${l.length === 1 ? "monto" : "montos"} · Total ${money(l.reduce((a, b) => a + b, 0))}` : ""; }
});
// Los cambios se aplican un instante después: redibujar justo durante un "blur" da error en algunos navegadores.
document.addEventListener("change", (e) => { const t = e.target; setTimeout(() => onChange(t), 0); });
function onChange(t) {
  const k = t.dataset.in;
  if (t.dataset.set) return applySetting(t);
  if (t.dataset.perm) { const [r, p] = t.dataset.perm.split(":"), L = DB.roles[r]; if (t.checked) { if (!L.includes(p)) L.push(p); } else DB.roles[r] = L.filter((x) => x !== p); log("Permisos", `${ROLE_LABEL[r]}: ${t.checked ? "puede" : "no puede"} ${PERMS.find((x) => x[0] === p)[1]}`); save(); toast("Permiso guardado"); return; }
  if (t.closest && t.closest("#pe") && t.dataset.f === "unit") { readPE(); paintPE(); return; }
  if (t.id === "cntd" && ui.cnt) { closeShiftUI(ui.cnt.id); return; }
  if (k === "disc") {
    const v = Math.max(0, r2(num(t.value))), apply = () => { DB.cart.disc = v; if (v) log("Descuento", `${money(v)} en ${ticketLabel(DB.cart)}`); save(); paintCart(); };
    if (v > 0 && !can("descuento")) { t.value = DB.cart.disc || ""; return need("descuento", apply, `Descuento de ${money(v)}`); }
    return apply();
  }
  if (k === "date") { if (t.value && t.value <= dkey()) { ui.date = t.value; render(); } return; }
  if (k === "rfrom" || k === "rto") { if (t.value) { ui[k === "rfrom" ? "from" : "to"] = t.value; if (ui.from > ui.to) ui.to = ui.from; render(); } return; }
  if (["kxp", "kxt", "kxfrom", "kxto", "vdoc", "vuser"].includes(k)) { ui[k] = t.value; render(); return; }
  if (k === "impfile") { const f = t.files[0]; if (f) readText(f, (txt) => { const el = $("#imp"); if (el) { el.value = txt; updImport(); } }); t.value = ""; return; }
  if (k === "pphoto") { const f = t.files[0]; t.value = ""; if (f) { readPE(); readPhoto(f, (url) => { ui.pe.d.img = url; paintPE(); }); } return; }
  if (k === "restore" || k === "recvfile") {
    const f = t.files[0]; t.value = ""; if (!f) return;
    readText(f, (txt) => { let o; try { o = JSON.parse(txt); } catch (err) { return toast("Ese archivo no se puede leer"); } if (k === "restore") { if (!o || !Array.isArray(o.products) || !Array.isArray(o.sales)) return toast("Ese archivo no es un respaldo válido"); need("ajustes", () => confirmBox("¿Restaurar este respaldo? Reemplaza los datos actuales.", "Restaurar", () => restoreDB(o), true)); } else receivePack(o); });
  }
}
function applySetting(t) {
  const key = t.dataset.set; let v = t.value.trim();
  const numeric = /\.(igv|tables|lock|per|val|min|n|pre|len|baud|paper)$/.test(key);
  if (numeric) { v = /\.n$|tables|lock|pre|len|baud|paper/.test(key) ? Math.max(0, parseInt(v, 10) || 0) : Math.max(0, num(v)); }
  if (key === "biz.name" && !v) v = "Mi negocio";
  if (key.endsWith(".s")) v = v.toUpperCase().slice(0, 4);
  if (key === "cfg.yapeNum" || key === "cfg.plinNum") v = v.replace(/\D/g, "");
  setK(key, v); save(); toast("Guardado"); paintNav();
  if (/tables|pts|igvOn|docDef|scale\.(baud|fmt)/.test(key)) render();
}
function moveSel(d) {
  const ks = cartLines().map((x) => lineKey(x.l.id, x.l.pres)); if (!ks.length) return;
  let i = ks.indexOf(ui.sel); i = i < 0 ? ks.length - 1 : Math.min(ks.length - 1, Math.max(0, i + d));
  ui.sel = ks[i]; $$(".ln").forEach((x) => x.classList.toggle("sel", x.dataset.k === ui.sel));
  const s = $(".ln.sel"); if (s) s.scrollIntoView({ block: "nearest" });
}
// Teclado: lector de códigos de barras (escribe el código + Enter) y atajos para PC.
// Si la acción vino del teclado, las ventanas abren sin animación (se usan cientos de veces al día).
const setInput = (k) => { if (document.documentElement.dataset.input !== k) document.documentElement.dataset.input = k; };
document.addEventListener("pointerdown", () => setInput("ptr"), true);
document.addEventListener("keydown", (e) => {
  if (e.key.length > 1 || e.ctrlKey || e.altKey) setInput("kbd");
  if ($("#susp")) { if (e.key !== "Tab" && e.key !== "Enter" && e.key !== " ") e.preventDefault(); return; } // caja bloqueada: ni teclas ni lector
  if (ui.locked) { if (/^\d$/.test(e.key)) pinKey(e.key); else if (e.key === "Backspace") pinKey("del"); else if (e.key === "Escape" && !$("#lockCancel").hidden) $("#lockCancel").click(); return; }
  const open = modalOpen(), field = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName), inQ = e.target.id === "q";
  if (e.key === "Escape" && open) { e.preventDefault(); if (ui.mk === "cam" && cam.mode === "codigo") return A.camback(); return closeModal(); }
  if (e.key === "Escape" && !open && ui.tab === "venta" && ui.done) { e.preventDefault(); return A.newsale(); }
  if (open && ui.mk === "pay" && ui.pay && !ui.pay.split && ui.pay.method === "efectivo" && !field && !e.ctrlKey && !e.metaKey && /^[\d.,]$/.test(e.key)) {
    e.preventDefault(); ui.pay.other = true; ui.pay.recv = e.key; paintPay();
    const i = $("#recv"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } return;
  }
  const FM = { F2: "efectivo", F8: "yape", F9: "tarjeta", F10: "plin" };
  if (FM[e.key]) {
    e.preventDefault();
    if (open) {
      if (ui.mk !== "pay" || !ui.pay) return;
      if (ui.pay.split) A.partadd({ dataset: { m: FM[e.key] } });
      else if (e.key === "F2" && ui.pay.method === "efectivo") confirmPay();
      else { ui.pay.method = FM[e.key]; paintPay(); }
    } else if (ui.tab === "venta") { if (!can("cobrar") && e.key === "F2") savePrev(); else startPay(FM[e.key]); }
    return;
  }
  if (e.key === "F1") { e.preventDefault(); if (!open && ui.tab === "venta") pickClient(); return; }
  if (e.key === "F7") { e.preventDefault(); if (ui.mk === "pay" || (!open && ui.tab === "venta")) A.split(); return; }
  if (e.key === "F4") { e.preventDefault(); if (!open && ui.tab === "venta") A.tknew(); return; }
  if (e.key === "F6") { e.preventDefault(); if (!open && ui.tab === "venta") editLine(ui.sel); return; }
  if ((e.key === "F3" || (e.key === "/" && !field)) && !open && ui.tab === "venta") { e.preventDefault(); A.focusq(); return; }
  if (!open && ui.tab === "venta") {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); moveSel(e.key === "ArrowDown" ? 1 : -1); return; }
    if (!field || (inQ && !e.target.value)) {
      if (e.key === "+") { e.preventDefault(); if (ui.sel) changeQty(ui.sel, 1); return; }
      if (e.key === "-") { e.preventDefault(); if (ui.sel) changeQty(ui.sel, -1); return; }
      if (e.key === "Delete") { e.preventDefault(); A.rmsel(); return; }
      if (e.key === "*") { e.preventDefault(); editLine(ui.sel); return; }
    }
    // Si el lector de códigos escribe sin que el buscador tenga el foco, se lo damos.
    if (!field && e.key.length === 1 && /[\w]/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) { const q = $("#q"); if (q) q.focus(); }
  }
  if (e.key === "Enter") {
    const id = e.target.id;
    if (id === "q" && !open) {
      e.preventDefault();
      if (e.target.value.trim()) submitCode(e.target.value);
      else if (ui.done) A.newsale();
      else if (cartLines().length) { if (can("cobrar")) startPay("efectivo"); else savePrev(); }
    }
    else if (!open && !field && ui.tab === "venta" && ui.done) { e.preventDefault(); A.newsale(); }
    else if (open && (id === "recv" || id === "pref") && $("#payok")) { e.preventDefault(); if (!$("#payok").disabled) confirmPay(); }
    else if (open && id === "pamt") { e.preventDefault(); const ok = $("#payok"); if (ok && !ok.disabled && !e.target.value.trim()) confirmPay(); else A.partadd({ dataset: { m: "efectivo" } }); }
    else if (id === "qv") { e.preventDefault(); A.qok(); }
    else if (open && e.target.tagName !== "BUTTON" && e.target.tagName !== "TEXTAREA" && e.target.tagName !== "SELECT") {
      const b = $("#modal [data-enter]:not(:disabled), #modal #payok:not(:disabled)"); if (b) { e.preventDefault(); b.click(); }
    }
    return;
  }
  if (open && ui.mk === "pay" && ui.pay && !ui.pay.split && !field && !e.ctrlKey && !e.metaKey) {
    const m = { e: "efectivo", y: "yape", p: "plin", t: "tarjeta", r: "transferencia", c: "credito" }[e.key.toLowerCase()];
    if (m) { ui.pay.method = m; paintPay(); }
  }
});

/* ---------- inicio ---------- */
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
window.addEventListener("afterprint", () => { const p = $("#print"); if (p) p.innerHTML = ""; });
window.CF = { get DB() { return DB; }, ui, flush, save, dayTotals, cartTotals, totalsOf, parseImport, splitCalc, parseWeight, parseLabel, letras, rucOk, balanceOf, pointsOf, onScaleLine, scaleState, shiftSummary, agingOf, expectedCash, suppBal, curShift, cloud, cloudLoad, cloudSetSession, cloudPush, cloudStart, cloudRecover, cloudPanel, cloudSnapshot };
// Fondo: foto del puesto (nítida en la pantalla de ingreso, suave detrás de la app).
function paintBg() {
  const F = window.CF_FOTO || {}; if (!F._puesto) return;
  const st = document.documentElement.style;
  st.setProperty("--puesto", `url("${F._puesto}")`); st.setProperty("--puesto-suave", `url("${F._puesto_suave}")`);
}
async function boot() {
  paintBg();
  await loadDB();
  if (!DB.users.some((u) => u.on && u.role === "admin")) { const a = DB.users.find((u) => u.role === "admin") || DB.users[0]; a.on = true; a.role = "admin"; }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  $("#lockPad").innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-a="lockkey" data-k="${n}">${n}</button>`).join("") + `<button class="ghost" tabindex="-1" aria-hidden="true"></button><button data-a="lockkey" data-k="0">0</button><button data-a="lockkey" data-k="del" aria-label="Borrar">⌫</button>`;
  if (needLogin()) { ui.user = null; render(); loginScreen(); }
  else { ui.user = activeUsers()[0].id; render(); }
  if (serialOk() && DESK()) connectScale(false);
  if (!cloudOn() && DB.sales.length && (!DB.cfg.lastBackup || Date.now() - DB.cfg.lastBackup > 7 * 864e5)) setTimeout(() => { if (!ui.locked) toast("Hace días que no descargas un respaldo. Hazlo en Ajustes › Datos.", true); }, 2500);
  document.body.classList.add("ready");
  cloudBoot();
}
boot();

})();
