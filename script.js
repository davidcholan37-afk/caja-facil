/* Caja Fácil — punto de venta para bodegas, minimarkets y fruterías. Versión 5.
   Todo se guarda en este navegador (IndexedDB). Archivo generado desde src/. */
(() => {
"use strict";
/* ===================== 00 · MODO PRUEBA (solo en localhost) ===================== */
// Para probar la voz en tu propia PC sin entrar con Google: abre http://localhost:8765/#voz-prueba
// Solo funciona en localhost / 127.0.0.1. En la página publicada NO hace nada.
(function () {
  if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
  try {
    if (location.hash === "#voz-prueba") { localStorage.setItem("cf-voz-prueba", "1"); history.replaceState(null, "", location.pathname); }
    if (localStorage.getItem("cf-voz-prueba") !== "1") return;
    localStorage.setItem("cf-cloud", JSON.stringify({ ses: { at: "x", rt: "r", exp: Date.now() + 9e9, user: { id: "prueba", email: "prueba@local" } }, neg: "11111111-1111-1111-1111-111111111111", negName: "Prueba de voz", chk: Date.now(), last: Date.now(), voz: true }));
    const f = window.fetch; // la nube se queda quieta: nada sale a internet
    window.fetch = (u, ...a) => (String((u && u.url) || u).indexOf("supabase.co") >= 0 ? Promise.reject(new TypeError("modo prueba")) : f.call(window, u, ...a));
  } catch (e) {}
})();

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
const normCalc = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
// norm() se usa por cada producto en cada tecla de la búsqueda: se recuerda el resultado (nombres de productos se repiten mucho).
const normMemo = new Map();
const norm = (s) => { if (s == null || s === "") return ""; const k = typeof s === "string" ? s : String(s), h = normMemo.get(k); if (h !== undefined) return h; const v = normCalc(k); if (normMemo.size > 20000) normMemo.clear(); normMemo.set(k, v); return v; };
// Buscar por palabras sueltas, en cualquier orden: «manz vin» encuentra «Vinagre de manzana». q ya viene con norm().
const nameHit = (name, q) => { const n = norm(name), pw = n.split(/\s+/); return q.split(/\s+/).filter(Boolean).every((w) => pw.some((x) => x.startsWith(w)) || (w.length >= 3 && n.includes(w))); };
// Primero los que empiezan con lo escrito, luego los que lo tienen en otra palabra, al final el resto.
const nameRank = (name, q) => { const ws = q.split(/\s+/).filter(Boolean), n = norm(name); if (!ws.length || n.startsWith(ws[0])) return 0; return n.split(/\s+/).some((w) => w.startsWith(ws[0])) ? 1 : 2; };
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

const METHODS = { efectivo: "Efectivo", yape: "Yape", plin: "Plin", bcp: "BCP", culqi: "Culqi", tarjeta: "Tarjeta", transferencia: "Transferencia", credito: "Crédito", puntos: "Puntos" };
const FK = { efectivo: "F2", yape: "F8", plin: "F10" }; // F9 también cobra en efectivo (pedido de David); tarjeta: tecla T en el cobro
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
  ["costos", "Ver costos y ganancias"], ["limite", "Vender pasando el límite de crédito"], ["libre", "Vender por voz algo que no está en productos"], ["ajustes", "Ajustes, usuarios y respaldos"]
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
  mute: false, yapeNum: "", plinNum: "", payName: "", igv: 18, igvOn: true, paper: 80, autoPrint: false, redAuto: true, tables: 0,
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
// «Manejar otra caja» (66-remoto): mientras dura, aquí no se guarda nada y Vender/Caja no se muestran.
let REM = null;
const REM_TABS_NO = { venta: 1, caja: 1 };
// Ordenar por nombre en español (localeCompare con "es": V8 lo hace rápido; un Intl.Collator propio resultó más lento).
const cmpEs = (a, b) => String(a).localeCompare(String(b), "es");

/* ---------- guardado: IndexedDB por meses (rápido aunque haya miles de ventas) ---------- */
const LSKEY = "caja-facil-v1";
const BIG = { sales: (x) => x.date, moves: (x) => x.date, kx: (x) => x.d, log: (x) => x.d };
let idb = null, saveT = 0, dirtyCore = false, dirtyCart = false, dirtyM = new Set(), inflight = 0, knownMonths = [], monthsScan = true;
// El ticket en curso se guarda aparte («tk»): agregar un producto ya no vuelve a escribir todos los productos ni el mes de ventas.
const CART_KEYS = ["tickets", "cur", "tseq"];
const cartJSON = () => JSON.stringify({ tickets: DB.tickets, cur: DB.cur, tseq: DB.tseq });
const mOf = (date) => String(date || dkey()).slice(0, 7);
function idbOpen() {
  return new Promise((ok, no) => {
    if (!window.indexedDB) return no();
    try { const r = indexedDB.open("caja-facil", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); r.onblocked = () => no(); } catch (e) { no(e); }
  });
}
const idbGet = (k) => new Promise((ok, no) => { const q = idb.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error); });
// Lee varias claves en una sola transacción y en paralelo (antes cada mes se pedía y esperaba uno por uno).
const idbGetMany = (keys) => new Promise((ok, no) => {
  if (!keys.length) return ok([]);
  const st = idb.transaction("kv").objectStore("kv"), out = new Array(keys.length); let left = keys.length;
  keys.forEach((k, i) => { const q = st.get(k); q.onsuccess = () => { out[i] = q.result; if (!--left) ok(out); }; q.onerror = () => no(q.error); });
});
function coreJSON() { const o = {}; Object.keys(DB).forEach((k) => { if (!BIG[k]) o[k] = DB[k]; }); return JSON.stringify(o); }
function monthJSON(m) { const o = {}; Object.keys(BIG).forEach((k) => { o[k] = DB[k].filter((x) => mOf(BIG[k](x)) === m); }); return JSON.stringify(o); }
function allMonths() { const s = new Set(); Object.keys(BIG).forEach((k) => DB[k].forEach((x) => s.add(mOf(BIG[k](x))))); s.add(mOf()); return [...s].sort(); }
function lsSave(str) { try { localStorage.setItem(LSKEY, str); return true; } catch (e) { toast("No se pudo guardar: el almacenamiento está lleno. Descarga un respaldo."); return false; } }
function flush(hiding) {
  if (REM) { dirtyCore = false; dirtyCart = false; dirtyM.clear(); return; } // otra caja: sus cambios viajan a la nube, no a este equipo
  if (dirtyCore || dirtyM.size || dirtyCart) {
    if (!idb) { dirtyCore = false; dirtyCart = false; dirtyM.clear(); lsSave(JSON.stringify(DB)); return; }
    // Recorrer toda la historia para saber qué meses hay solo cuando hace falta (al cargar, al borrar o con un mes nuevo).
    const fast = !monthsScan && [...dirtyM].every((m) => knownMonths.includes(m));
    const months = fast ? knownMonths : allMonths(), puts = [["tk", cartJSON()]];
    if (dirtyCore || dirtyM.size) puts.push(["core", coreJSON()], ["months", JSON.stringify(months)]);
    dirtyM.forEach((m) => puts.push(["m:" + m, monthJSON(m)]));
    const gone = knownMonths.filter((m) => !months.includes(m));
    dirtyCore = false; dirtyCart = false; dirtyM.clear(); knownMonths = months; monthsScan = false;
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
function saveCart() { dirtyCart = true; clearTimeout(saveT); saveT = setTimeout(flush, 30); }
let DBV = 0; // sube con cada cambio guardado: los índices (ventas por cliente…) se rehacen solo cuando cambia
function save(...dates) { DBV++; dirtyCore = true; dirtyM.add(mOf()); dates.forEach((d) => d && dirtyM.add(mOf(d))); clearTimeout(saveT); saveT = setTimeout(flush, 30); }
function saveAll() { monthsScan = true; allMonths().forEach((m) => dirtyM.add(m)); save(); }
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
        const raws = await idbGetMany(months.map((m) => "m:" + m));
        raws.forEach((raw) => { const ch = JSON.parse(raw || "null"); if (ch) Object.keys(BIG).forEach((k) => { const a = ch[k], t = obj[k]; if (a) for (let i = 0; i < a.length; i++) t.push(a[i]); }); });
        try { const tk = JSON.parse((await idbGet("tk")) || "null"); if (tk && Array.isArray(tk.tickets) && tk.tickets.length) CART_KEYS.forEach((k) => { obj[k] = tk[k]; }); } catch (e) {}
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
const imgKeyMemo = new Map();
function imgKey(p) {
  if (p.img && /^(lib|foto):/.test(p.img)) return p.img.slice(p.img.indexOf(":") + 1);
  const mk = p.name + "\u0001" + (p.cat || ""), hit = imgKeyMemo.get(mk); if (hit) return hit;
  const v = imgKeyCalc(p); if (imgKeyMemo.size > 5000) imgKeyMemo.clear(); imgKeyMemo.set(mk, v); return v;
}
function imgKeyCalc(p) {
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
// Las imágenes viven como texto (data:) en img.js, fotos.js y en la ficha del producto. Pegarlas tal cual en el HTML
// obliga al navegador a leer cientos de KB en cada pintada; se convierten una sola vez en una dirección corta (blob:).
const imgBlob = new Map();
function bu(key, uri) {
  if (!uri || uri.slice(0, 5) !== "data:") return uri || "";
  key += "|" + uri.length;
  let u = imgBlob.get(key); if (u) return u;
  try {
    const i = uri.indexOf(","), bin = atob(uri.slice(i + 1)), b = new Uint8Array(bin.length);
    for (let j = 0; j < bin.length; j++) b[j] = bin.charCodeAt(j);
    u = URL.createObjectURL(new Blob([b], { type: uri.slice(5, uri.indexOf(";")) }));
  } catch (e) { return uri; }
  imgBlob.set(key, u); return u;
}
const IB = (k) => bu("i:" + k, (window.CF_IMG || {})[k]);
const FB = (k) => bu("f:" + k, FOTO()[k]);
function imgSrc(p) {
  if (p && p.img && p.img.startsWith("data:")) return bu("p:" + p.id, p.img);
  const k = imgKey(p);
  if (imgKind(p) === "foto") return FB(k);
  return IB(k) || IB("caja");
}
const catImg = (c) => {
  if (c === "__top") return IB("carrito"); if (c === "__fav") return IB("canasta");
  const p = DB.products.find((x) => x.cat === c && imgKind(x) === "foto") || DB.products.find((x) => x.cat === c);
  if (p) return imgSrc(p);
  const n = norm(c); for (const [re, k] of CATMAP) if (re.test(n)) return FB(k) || IB(k);
  return IB("caja");
};
// img.js y fotos.js pesan más de 900 KB: se bajan DESPUÉS de que la caja ya está lista (con la cola libre) y, al llegar,
// se vuelve a pintar la pantalla para que salgan las imágenes. Mientras tanto se ven las letras de cada producto.
const libUrl = (n) => n + ((window.CF_V || {})[n] ? "?v=" + window.CF_V[n] : "");
function libsLater() {
  const falta = [["img.js", "CF_IMG"], ["fotos.js", "CF_FOTO"]].filter(([, g]) => !window[g]);
  if (!falta.length) return;
  let n = falta.length;
  // Al llegar se repinta UNA vez (sin rehacer toda la pantalla de venta) y las fotos de los productos se preparan después,
  // en ratos libres, sin volver a pintar al final (antes, con 6 600 productos, la NCR repintaba todo justo al cobrar).
  const fin = () => { if (!--n) { imgRefresh(0); calentar(DB.products.slice(), 0); } };
  const bajar = () => falta.forEach(([f]) => { const s = document.createElement("script"); s.src = libUrl(f); s.async = true; s.onload = fin; s.onerror = fin; document.head.appendChild(s); });
  if (window.requestIdleCallback) requestIdleCallback(bajar, { timeout: 2500 }); else setTimeout(bajar, 600);
}
// Convierte las imágenes de los productos en tandas chicas (así la primera pintada con fotos no se traba en equipos lentos).
function calentar(l, i) {
  const t0 = performance.now();
  for (; i < l.length && performance.now() - t0 < 8; i++) try { imgSrc(l[i]); } catch (e) {}
  if (i < l.length) (window.requestIdleCallback ? requestIdleCallback(() => calentar(l, i), { timeout: 1000 }) : setTimeout(() => calentar(l, i), 30));
}
// Volver a pintar porque llegaron imágenes o cambios de otro equipo. En Vender NO se rehace la pantalla: solo cambian el
// ticket, las categorías y las fichas/vitrina si de verdad son distintas (así no pestañea ni se cierra lo que estás haciendo).
function imgRefresh(tries) {
  if (ui.tab === "venta" && $("#grid") && !ui.locked) { softSale(); return; }
  const a = document.activeElement, lk = $("#lock"), escribiendo = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.value;
  if (ui.locked || (lk && !lk.hidden) || escribiendo || modalOpen()) { if (tries < 24) setTimeout(() => imgRefresh(tries + 1), 1500); return; }
  render();
}
function softSale() {
  document.body.dataset.tienda = DB.biz.name || "";
  const br = $(".brandrow > b"); if (br && br.textContent !== (DB.biz.name || "Caja Fácil")) br.textContent = DB.biz.name || "Caja Fácil";
  paintSale(); paintNav();
}
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
  if (long && typeof helpToastAdd === "function") helpToastAdd(t, msg); // «Pedir ayuda a Luis» (71-ayuda.js)
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
// Al cerrar con el mouse o el dedo, el fondo oscuro se desvanece en 160 ms (antes desaparecía de golpe junto con la
// ventana y se veía como un pestañeo). Con el teclado, en modo rápido o con movimiento reducido: al instante.
function modalGhost(m) {
  const h = document.documentElement;
  if (m.hidden || h.dataset.input === "kbd" || h.classList.contains("lite") || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const g = document.createElement("div"); g.className = "modal mghost"; g.setAttribute("aria-hidden", "true");
  document.body.appendChild(g);
  requestAnimationFrame(() => requestAnimationFrame(() => g.classList.add("out")));
  setTimeout(() => g.remove(), 260);
}
function closeModal() {
  const m = $("#modal"); modalGhost(m); m.hidden = true; m.classList.remove("na"); $(".sheet", m).innerHTML = ""; document.body.classList.remove("noscroll");
  ui.pay = null; ui.mk = ""; stopScaleRead(); stopCam(); stopVoz();
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
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/>',
  scan: '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M7.5 9v6M10.5 9v6M14 9v6M16.5 9v6" stroke-width="1.6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  next: '<path d="M5 12h13M13 6l6 6-6 6"/>',
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
const TABS = [["venta", "Vender", null], ["ventas", "Ventas", null], ["prod", "Productos", null], ["cli", "Clientes", null], ["prov", "Proveedores", "caja"], ["caja", "Caja", "caja"], ["rep", "Reportes", "reportes"], ["aj", "Ajustes", "ajustes"]];
const TAB_GRUPO = { prod: 1, caja: 1 }; // en el menú de la izquierda: línea antes de cada grupo
const tabOk = (t) => { const x = TABS.find((y) => y[0] === t); return x && (!x[2] || can(x[2])) && !(REM && REM_TABS_NO[t]); };
function paintNav() {
  const u = me(), tabs = TABS.filter((t) => tabOk(t[0]));
  const btn = ([id, label]) => `<button class="tab ${ui.tab === id ? "on" : ""} ${TAB_GRUPO[id] ? "g" : ""}" data-a="tab" data-t="${id}" ${ui.tab === id ? 'aria-current="page"' : ""}><span class="ic">${svg(id)}</span><span>${label}</span></button>`;
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
  if (!tabOk(tab)) { if (REM) return remNo(); toast("Tu usuario no tiene acceso a esa sección"); tab = "venta"; }
  ui.tab = tab; document.body.classList.remove("cart-open"); render(); window.scrollTo(0, 0);
}
const VIEWS = {};
function render() {
  if (!tabOk(ui.tab)) ui.tab = REM ? "prod" : "venta";
  paintNav();
  document.body.dataset.tab = ui.tab;
  document.body.dataset.tienda = (DB.biz && DB.biz.name) || "Caja Fácil"; // cartel del toldo (CSS body::before)
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
// Pantalla completa (botón «Completa» del menú, solo PC). La preferencia va por equipo en localStorage cf-full.
// El navegador no deja entrar solo al abrir: si estaba activada, entra con el primer clic, toque o tecla (escanear cuenta).
// Con Keyboard Lock, Esc sigue cerrando ventanas de la caja; para salir de pantalla completa se mantiene Esc o se usa el botón.
const fsOn = () => !!document.fullscreenElement;
function fsPref(v) { try { if (v === undefined) return localStorage.getItem("cf-full") === "1"; localStorage.setItem("cf-full", v ? "1" : "0"); } catch (e) {} return false; }
function fsEnter() {
  const el = document.documentElement; if (!el.requestFullscreen || fsOn()) return;
  el.requestFullscreen({ navigationUI: "hide" }).then(() => { try { const k = navigator.keyboard; if (k && k.lock) k.lock(["Escape"]).catch(() => {}); } catch (e) {} }).catch(() => {});
}
function fsArm() {
  if (!fsPref() || fsOn() || !DESK() || !document.documentElement.requestFullscreen) return;
  const off = () => { removeEventListener("keydown", go, true); removeEventListener("pointerup", go, true); };
  const go = (e) => { if (e.type === "keydown" && (e.key === "Escape" || e.key === "F11")) return; off(); if (fsPref()) fsEnter(); };
  addEventListener("keydown", go, true); addEventListener("pointerup", go, true);
}
document.addEventListener("fullscreenchange", () => { const on = fsOn(); document.documentElement.classList.toggle("fs-on", on); if (!on) { try { navigator.keyboard && navigator.keyboard.unlock && navigator.keyboard.unlock(); } catch (e) {} } });

act({ fulltoggle: () => { if (fsOn()) { fsPref(false); document.exitFullscreen().catch(() => {}); } else { fsPref(true); fsEnter(); } } });
act({ tab: (el) => { if (modalOpen()) closeModal(); go(el.dataset.t); }, more: moreMenu, close: closeModal, theme: toggleTheme , sidetoggle: () => { const off = document.documentElement.classList.toggle("side-off"); try { localStorage.setItem("cf-side", off ? "0" : "1"); } catch (e) {} (off ? $(".siderail") : $(".sidehide"))?.focus({ preventScroll: true }); } });

/* ===================== 20 · USUARIOS, CLAVES Y PERMISOS ===================== */
const initials = (n) => String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const avHue = (u) => ([...String(u.id)].reduce((a, c) => a + c.charCodeAt(0), 0) * 47) % 360;
function me() { return usr(ui.user) || null; }
const userCan = (u, perm) => !!u && (u.role === "admin" || (DB.roles[u.role] || []).includes(perm));
function can(perm) { return userCan(me(), perm); }
const activeUsers = () => DB.users.filter((u) => u.on);
const needLogin = () => { if (REM) return false; const on = activeUsers(); return on.length > 1 || on.some((u) => u.pin); };

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
/* Freno a las claves malas: a los 5 fallos seguidos hay que esperar (30 s, luego 1, 2, 4… hasta 5 min). */
const PIN_FAIL = "cf-pin-fail";
function pinFail() { try { return JSON.parse(localStorage.getItem(PIN_FAIL)) || { n: 0, until: 0 }; } catch (e) { return { n: 0, until: 0 }; } }
function pinFailSave(f) { try { localStorage.setItem(PIN_FAIL, JSON.stringify(f)); } catch (e) {} }
const pinWait = () => Math.max(0, Math.ceil((pinFail().until - Date.now()) / 1000));
const pinOk = () => { const f = pinFail(); if (f.n || f.until) pinFailSave({ n: 0, until: 0 }); };
function pinKey(k) {
  if (!pinCb) return;
  const w = pinWait(); if (w > 0) { pinBuf = ""; paintDots(); return toast(`Muchos intentos. Espera ${w} s e intenta otra vez`, true); }
  if (k === "del") pinBuf = pinBuf.slice(0, -1);
  else if (pinBuf.length < 4) pinBuf += k;
  paintDots();
  if (pinBuf.length === 4) { const p = pinBuf, cb = pinCb; setTimeout(() => cb(p), 90); }
}
function pinBad(count = true) {
  pinBuf = ""; beep(false); paintDots(true);
  if (!count) return;
  const f = pinFail(); f.n += 1;
  if (f.n % 5 === 0) { const s = Math.min(300, 30 * 2 ** (f.n / 5 - 1)); f.until = Date.now() + s * 1000; toast(`Muchos intentos. Espera ${s} s e intenta otra vez`, true); }
  pinFailSave(f);
}
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
  pinOk(); ui.user = u.id; hideLock(); log("Ingreso al sistema", u.name);
  if (!tabOk(ui.tab)) ui.tab = "venta";
  render(); focusQ(); avisoDia();
}
function closeModalQuiet() { const m = $("#modal"); if (!m.hidden) { m.hidden = true; $(".sheet", m).innerHTML = ""; document.body.classList.remove("noscroll"); ui.pay = null; modalBack = null; stopScaleRead(); stopCam(); stopVoz(); } }
function lockNow() { if (!needLogin()) return toast("Pon una clave a tu usuario en Ajustes para poder bloquear"); log("Salió / bloqueó", (me() || {}).name || ""); loginScreen(); }

// Operación delicada: si el usuario no tiene permiso, la autoriza alguien que sí lo tenga con su clave.
function need(perm, cb, what) {
  if (can(perm)) return cb(me());
  const sups = activeUsers().filter((u) => u.pin && userCan(u, perm));
  if (!sups.length) { beep(false); toast("Tu usuario no tiene permiso para esto. El administrador puede darlo en Ajustes › Usuarios.", true); return; }
  askPin("Clave de supervisor", "Para: " + (what || SENSITIVE[perm] || perm), (p) => {
    const s = sups.find((u) => u.pin === pinHash(p));
    if (!s) return pinBad();
    pinOk(); hideLock(); log("Autorización", `${s.name} autorizó a ${(me() || {}).name}: ${what || SENSITIVE[perm] || perm}`); cb(s);
  }, true);
}
// Crear o cambiar la clave de un usuario (se pide dos veces).
function setPinFor(u, done) {
  askPin(`Nueva clave para ${u.name}`, "4 dígitos que solo esa persona conozca", (a) => {
    askPin("Repite la clave", "", (b) => {
      if (a !== b) { pinBad(false); toast("No coinciden. Intenta otra vez"); return setPinFor(u, done); }
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
// Precio por mayor: desde cierta cantidad, cada unidad cuesta menos (solo producto sin presentación y sin precio cambiado a mano).
const mayorOf = (p, qty) => (p && p.mayor && p.mayor.q > 0 && p.mayor.p > 0 && qty >= p.mayor.q ? p.mayor.p : null);
// Precio de oferta: p.oferta = {p, hasta}; vale hasta el día «hasta» (inclusive); sin fecha vale siempre.
const ofertaOf = (p) => (p && p.oferta && p.oferta.p > 0 && (!p.oferta.hasta || dkey() <= p.oferta.hasta) ? p.oferta.p : null);
function resolveLine(l) {
  if (l.quick) return { name: l.name, price: l.price, base: l.price, cost: 0, stock: null, quick: true, unit: "u", code: "", f: 1, igv: true, p: null };
  const p = prod(l.id); if (!p) return null;
  const ps = l.pres ? (p.pres || []).find((x) => x.id === l.pres) : null;
  if (l.pres && !ps) return null;
  const base = ps ? ps.price : p.price, my0 = !ps && l.pr == null ? mayorOf(p, l.qty) : null, of = !ps && l.pr == null ? ofertaOf(p) : null, my = of != null && (my0 == null || of <= my0) ? of : my0, tn = my != null && my === of ? "oferta" : "mayor";
  return { p, ps, name: ps ? `${p.name} (${ps.name})` : p.name, price: l.pr != null ? l.pr : my != null ? my : base, tier: my != null, tn, base, cost: r2(costOf(p) * (ps ? ps.f : 1)), stock: p.stock, unit: ps ? "u" : p.unit, code: ps ? ps.code : p.code, f: ps ? ps.f : 1, igv: p.igv !== false, quick: false };
}
const linesOf = (t) => t.items.map((l) => ({ l, r: resolveLine(l) })).filter((x) => x.r);
const cartLines = () => linesOf(DB.cart);
function totalsOf(t) {
  const lines = linesOf(t);
  const sub = r2(lines.reduce((a, { l, r }) => a + r2(r.price * l.qty), 0));
  const disc = Math.min(Math.max(0, r2(t.disc)), sub);
  // Redondeo automático a los 10 céntimos más cercanos (1.92 → 1.90, 1.95 → 2.00), salvo que se apague en Ajustes › Cobros.
  // red > 0 baja el total; red < 0 lo sube.
  const t0 = r2(sub - disc), red = DB.cfg.redAuto !== false && t0 > 0 ? r2(t0 - redTo(t0)) : 0;
  const total = r2(t0 - red), ratio = sub ? total / sub : 0;
  const gAmt = r2(lines.reduce((a, { l, r }) => a + (r.igv ? r2(r.price * l.qty) : 0), 0) * ratio);
  const rate = DB.cfg.igvOn ? (+DB.cfg.igv || 0) / 100 : 0;
  const gravada = rate ? r2(gAmt / (1 + rate)) : 0, igv = rate ? r2(gAmt - gravada) : 0;
  return { lines, sub, disc, red, total, gravada, igv, exo: rate ? r2(total - gAmt) : 0, count: lines.length };
}
const cartTotals = () => totalsOf(DB.cart);
const redTo = (n) => Math.round(r2(n * 10)) / 10;
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
  saveCart(); if (!opts.quiet) beep(true); paintSale(); return true;
}
function addToCart(p, qty = 1, pres = "") {
  const l = DB.cart.items.find((i) => lineKey(i.id, i.pres) === lineKey(p.id, pres));
  return setLine(p.id, pres, r3((l ? l.qty : 0) + qty));
}
function changeQty(k, d) {
  const l = DB.cart.items.find((i) => lineKey(i.id, i.pres) === k); if (!l) return;
  const r = resolveLine(l); if (!r) return;
  if (l.quick) { l.qty = Math.max(0, l.qty + d); if (!l.qty) DB.cart.items = DB.cart.items.filter((i) => i !== l); saveCart(); paintSale(); return; }
  setLine(l.id, l.pres, r3(l.qty + d * (r.unit === "kg" ? 0.1 : 1)));
}
function dropCurrentTicket() {
  if (DB.tickets.length > 1) { DB.tickets.splice(DB.cur, 1); DB.cur = Math.max(0, Math.min(DB.cur, DB.tickets.length - 1)); }
  else { DB.tickets = [newTicket(1)]; DB.tseq = 1; DB.cur = 0; }
  ui.sel = null;
}
// Después de cobrar (o guardar una preventa) el ticket cobrado se borra y la caja queda en un ticket NUEVO vacío,
// listo para el siguiente cliente; los «En espera» con productos siguen esperando (se vuelve a ellos con ← →).
// Los vacíos no se acumulan: queda uno solo, y si no hay nada en espera vuelve a «Ticket 1». (David, 24 oct 2026)
function freshTicketAfterSale() {
  DB.tickets.splice(DB.cur, 1); ui.sel = null;
  DB.tickets = DB.tickets.filter((t) => t.items.length || t.mesa || t.prev || t.name);
  if (!DB.tickets.length) { DB.tickets = [newTicket(1)]; DB.tseq = 1; DB.cur = 0; return; }
  DB.tickets.push(newTicket(++DB.tseq)); DB.cur = DB.tickets.length - 1;
}
function tkStep(d) {
  const n = DB.tickets.length; if (n < 2) return;
  DB.cur = (DB.cur + d + n) % n; ui.sel = null; ui.done = null; saveCart(); paintSale(); focusQ();
}
function newTicketNow(extra = {}) {
  DB.tickets.push(Object.assign(newTicket(++DB.tseq), extra)); DB.cur = DB.tickets.length - 1; ui.sel = null; saveCart();
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
  DB.cur = i; saveCart(); closeModal(); paintSale(); toast(`Mesa ${m}`);
}

/* ---------- preventas: el vendedor arma el pedido, la caja lo cobra ---------- */
function savePrev() {
  const lines = cartLines(); if (!lines.length) return toast("Agrega productos primero");
  const t = DB.cart, no = ++DB.pseq;
  const pv = { no, t: Date.now(), date: dkey(), u: me().id, un: me().name, items: t.items.map((i) => Object.assign({}, i)), disc: t.disc || 0, client: t.client || "", total: ticketTotal(t), status: "pendiente", sale: 0 };
  DB.prev.push(pv); log("Preventa", `N° ${no} ${money(pv.total)}`);
  freshTicketAfterSale(); save(); paintSale();
  openModal(`<div class="bigok"><span>Preventa guardada</span><b class="num">N° ${no}</b><p>El cliente paga en caja diciendo este número. Total ${money(pv.total)}.</p></div>
    <div class="btns h"><button class="btn sec" data-a="prevprint" data-n="${no}">${svg("print", "bi")}Imprimir</button><button class="btn" data-a="close" data-enter>Seguir vendiendo</button></div>`);
}
function loadPrev(no) {
  const pv = DB.prev.find((x) => x.no === +no);
  if (!pv) { toast(`No existe la preventa N° ${no}`); beep(false); return false; }
  if (pv.status !== "pendiente") { toast(pv.status === "cobrada" ? `La preventa N° ${no} ya fue cobrada` : `La preventa N° ${no} está anulada`); beep(false); return false; }
  const open = DB.tickets.findIndex((x) => x.prev === pv.no);
  if (open >= 0) { DB.cur = open; saveCart(); paintSale(); return true; }
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
        <label class="sbox">${svg("search")}<input id="q" type="search" enterkeyhint="go" placeholder="${DESK() ? (innerWidth < 1100 ? "Escanea o busca" : "Escanea o escribe un producto") : "Busca o escanea"}" autocomplete="off" value="${esc(ui.q)}" aria-label="Buscar producto o código"></label>
        <button class="tool cam" data-a="camscan" title="Escanear códigos con la cámara">${svg("scan")}<span>Cámara</span></button>
        <button class="tool xtra ${scaleState.on ? "live" : ""}" data-a="scaletool" id="scaleTool" title="Balanza">${svg("scale")}<span>${scaleState.on ? "Balanza lista" : "Balanza"}</span></button>
        ${tables ? `<button class="tool xtra" data-a="mesas" title="Mesas">${svg("mesa")}<span>Mesas</span></button>` : ""}
        ${cobra ? `<button class="tool xtra" data-a="prevload" title="Cobrar una preventa">${svg("prev")}<span>Preventa</span></button>` : ""}
        <button class="tool xtra" data-a="quick" title="Cobrar un monto suelto">${svg("plus")}<span>Monto</span></button>
        ${vozOk() ? `<button class="tool vozb" data-a="voz" title="Hablar: anota productos, fiado o pagos" aria-label="Hablar">${svg("mic")}<span>Voz</span></button>` : ""}
        <button class="tool more" data-a="tools" title="Balanza, mesas, monto suelto y más (Ctrl K)" aria-label="Más herramientas">${svg("mas")}<span>Más</span></button>
      </div>
      <div class="chips cats" id="cats"></div>
      <div class="grid t-${DB.cfg.tile}" id="grid"></div>
      <div class="brandrow"><b>${esc(DB.biz.name || "Caja Fácil")}</b>${curShift() ? `<i class="cstat">Caja abierta</i>` : ""}<i class="cstat net ${navigator.onLine ? "" : "off"}" id="net">${navigator.onLine ? "En línea" : "Sin internet"}</i><span>${esc((me() || {}).name || "")}</span></div>
      <div class="fkeys"><button class="fk fun" data-a="tools" title="Todas las funciones (Ctrl K)">${svg("mas")}<span>Funciones</span><kbd>Ctrl K</kbd></button>
    </div>
    </section>
    <aside class="cart" id="cart" aria-label="Ticket actual"></aside>
  </div>
  <div class="cartbar" id="cartbar" hidden></div>`;
  paintSale(); focusQ();
};
function paintSale() { if (ui.tab !== "venta" || !$("#grid")) return; paintCats(); paintGrid(); paintCart(); }
// Más vendidos (30 días). Se recuerda mientras no cambien las ventas: antes recorría toda la historia en cada pintada.
let topMemo = { k: "", v: [] };
function topIds() {
  const last = DB.sales[DB.sales.length - 1], k = dkey() + "|" + DB.sales.length + "|" + (last ? last.id + (last.void ? "v" : "") : "");
  if (topMemo.k === k) return topMemo.v;
  topMemo = { k, v: topIdsCalc() }; return topMemo.v;
}
function topIdsCalc() {
  const from = addD(dkey(), -30), m = {};
  DB.sales.forEach((x) => { if (x.void || x.date < from) return; x.items.forEach((i) => { if (!i.quick) m[i.id] = (m[i.id] || 0) + i.qty * (i.f || 1); }); });
  return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 18).map((e) => e[0]);
}
function paintCats() {
  const el = $("#cats"); if (!el) return;
  if (catMemo.el === el && catMemo.k === catKey()) return; // nada cambió: ni siquiera se recalcula (6 600 productos en la NCR)
  const cats = [...new Set(DB.products.map((p) => p.cat).filter(Boolean))].sort((a, b) => cmpEs(a, b));
  if (!cats.length && !DB.products.length) { el.innerHTML = ""; return; }
  const im = (c) => { const s = catImg(c); return s ? `<img src="${s}" alt="">` : ""; };
  const chip = (c, label, img = true) => `<button class="chip ${ui.cat === c ? "on" : ""}" data-a="cat" data-c="${esc(c)}">${img ? im(c) : ""}${label}</button>`;
  const h = chip("", "Todo", false) + (DB.products.some((p) => p.fav) ? chip("__fav", "★ Favoritos", false) : "") + chip("__top", "Más vendidos", false) + cats.map((c) => chip(c, esc(c))).join("");
  if (el._gh !== h) { el.innerHTML = h; el._gh = h; } // igual que antes: no se rehace (las fotos de las categorías no parpadean)
  catMemo = { k: catKey(), el };
}
// Las categorías solo cambian si cambian los productos (DBV), la elegida o si llegaron las imágenes.
let catMemo = { k: "", el: null };
const catKey = () => DBV + "|" + ui.cat + "|" + !!window.CF_IMG + !!window.CF_FOTO;
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
// «Vitrina (prueba)»: mosaico de fotos cuando no buscas; al escribir salen los productos con foto y una vista previa (↑ ↓ elige, Enter agrega).
const vit = () => DB.cfg.view === "vit";
const VIT_FOTOS = ["tomate", "palta", "limon", "platano", "zanahoria", "mango", "papa", "naranja", "camote", "cebolla", "manzana", "mandarina"];
let quickMemo = { k: "", v: [] };
function vitHome() {
  const lines = cartLines(), cur = lines.find(({ l }) => lineKey(l.id, l.pres) === ui.sel) || lines[lines.length - 1];
  const tops = topIds();
  // Los accesos «sin código» solo cambian si cambian los productos o las ventas: antes se ordenaban los 6 600 productos de la NCR en cada venta.
  const qk = DBV + "|" + topMemo.k;
  if (quickMemo.k !== qk) quickMemo = { k: qk, v: DB.products.filter((p) => p.on !== false && (!p.code || p.code.length <= 5))
    .sort((a, b) => ((b.fav ? 1 : 0) - (a.fav ? 1 : 0)) || ((tops.indexOf(a.id) + 1 || 999) - (tops.indexOf(b.id) + 1 || 999)) || cmpEs(a.name, b.name)).slice(0, 10) };
  const quick = quickMemo.v;

  const tiles = VIT_FOTOS.map((k) => { const s = FB(k); return `<i${s ? ` style="background-image:url('${s}')"` : ""}></i>`; }).join("");
  const sl = vitSlidesHtml(); if (sl) return sl;
  return `<div class="vit-home"><div class="vmos" aria-hidden="true">${tiles}</div></div>`;
}
function vitResults(list, key) {
  const k = norm(key), hit = (n) => { const i = norm(n).indexOf(k); return k && i >= 0 && norm(n).length === n.length ? esc(n.slice(0, i)) + "<mark>" + esc(n.slice(i, i + k.length)) + "</mark>" + esc(n.slice(i + k.length)) : esc(n); };
  const sel = list[ui.vsel] || list[0], kg = (p) => p.unit === "kg" ? "/kg" : "";
  const st = (p) => p.stock == null ? "" : p.stock <= 0 ? "Sin stock" : `${fmtQ(p.stock)}${p.unit === "kg" ? " kg" : ""} en stock`;
  return `<div class="vres"><div class="vlist" role="listbox">${list.map((p, i) => `<button class="vr ${i === ui.vsel ? "on" : ""} ${p.stock != null && p.stock <= 0 ? "out" : ""}" role="option" aria-selected="${i === ui.vsel}" data-a="add" data-id="${p.id}"><span class="vth">${pimg(p)}</span><b>${hit(p.name)}</b><span class="num">${money(p.price)}${kg(p)}</span></button>`).join("")}</div>
    <div class="vpv"><div class="vbig">${pimg(sel)}</div><h3>${esc(sel.name)}</h3><div class="vpp num">${money(sel.price)}${kg(sel)}</div><div class="vch">${st(sel) ? `<span>${st(sel)}</span>` : ""}<span>${sel.code ? "Cód. " + esc(sel.code) : "Sin código"}</span>${sel.cat ? `<span>${esc(sel.cat)}</span>` : ""}</div><button class="vbtn" data-a="add" data-id="${sel.id}">Agregar al ticket<span class="kbd">Enter</span></button></div></div>`;
}
let quickMemoS = { k: "", v: [] };
function scanHome() {
  const lines = cartLines(), cur = lines.find(({ l }) => lineKey(l.id, l.pres) === ui.sel) || lines[lines.length - 1];
  const tops = topIds(), qk = "s|" + DBV + "|" + topMemo.k;
  if (quickMemoS.k !== qk) quickMemoS = { k: qk, v: DB.products.filter((p) => p.on !== false && (!p.code || p.code.length <= 5))
    .sort((a, b) => ((b.fav ? 1 : 0) - (a.fav ? 1 : 0)) || ((tops.indexOf(a.id) + 1 || 999) - (tops.indexOf(b.id) + 1 || 999)) || cmpEs(a.name, b.name)).slice(0, 18) };
  const quick = quickMemoS.v;
  const last = cur ? `<div class="lastp ${ui.bump ? "fresh" : ""}"><small>Último</small><b class="ln1">${esc(cur.r.name)}</b><span class="ln2 num">${fmtQ(cur.l.qty)}${unitTxt(cur.r)} × ${money(cur.r.price)}</span><b class="ln3 num">${money(r2(cur.r.price * cur.l.qty))}</b></div>`
    : `<div class="lastp idle">${svg("scan")}<b class="ln1">Escanea un producto</b></div>`;
  return `${last}${quick.length ? `<div class="quick"><h3>Sin código</h3><div class="qgrid">${quick.map((p) => `<button class="qk" data-a="add" data-id="${p.id}">${p.code ? `<i class="num">${esc(p.code)}</i>` : ""}<b>${esc(p.name)}</b><span class="num">${money(p.price)}${p.unit === "kg" ? "/kg" : ""}</span></button>`).join("")}</div></div>` : ""}`;
}
// Orden de la búsqueda en Vender: el código exacto primero; al buscar por nombre, primero lo que se vende por kilo
// (lo que no tiene código de barras se busca escribiendo; pedido de David); luego lo que empieza igual, favoritos y A-Z.
// Igual que saleCmp pero rápido con miles de productos: cada clave se calcula una sola vez (antes nameRank se llamaba en
// cada comparación: con un código «775…» que coincide con 6 000 productos tardaba ~0,5 s en una PC lenta).
function saleSort(list, key, q, favs) {
  const kg = !!q && !/^\d+$/.test(key);
  const d = list.map((p) => [p, p.code === key ? 0 : 1, kg && p.unit === "kg" ? 0 : 1, q ? nameRank(p.name, q) : 0, favs && p.fav ? 0 : 1, norm(p.name)]);
  d.sort((a, b) => a[1] - b[1] || a[2] - b[2] || a[3] - b[3] || a[4] - b[4] || (a[5] < b[5] ? -1 : a[5] > b[5] ? 1 : 0));
  return d.map((x) => x[0]);
}
function saleCmp(key, q, favs) {
  const kg = !!q && !/^\d+$/.test(key);
  return (a, b) => ((b.code === key) - (a.code === key)) || (kg ? (b.unit === "kg") - (a.unit === "kg") : 0) || (q ? nameRank(a.name, q) - nameRank(b.name, q) : 0) || ((b.fav ? 1 : 0) - (a.fav ? 1 : 0)) * (favs ? 1 : 0) || cmpEs(a.name, b.name);
}
function gMark(scroll) {
  const its = $$("#grid > [data-a=add]");
  if (!ui.gq || !its.length) { its.forEach((x) => x.classList.remove("ksel")); return; }
  ui.gsel = Math.max(0, Math.min(its.length - 1, ui.gsel || 0));
  its.forEach((x, i) => x.classList.toggle("ksel", i === ui.gsel));
  if (scroll) its[ui.gsel].scrollIntoView({ block: "nearest" });
}
// ↑ ↓ (y ← → en Fichas): d = ±1 lado a lado, ±"fila" arriba/abajo.
function gMove(d, rows) {
  const its = $$("#grid > [data-a=add]"); if (!its.length) return;
  let step = 1;
  if (rows) { const top = its[0].offsetTop; step = Math.max(1, its.filter((x) => x.offsetTop === top).length); }
  ui.gsel = Math.max(0, Math.min(its.length - 1, (ui.gsel || 0) + d * step)); gMark(true);
}
// Inicio de la vitrina / escáner: al buscar se cambia por la lista y al agregar vuelve. Se guardan sus elementos y se
// vuelven a poner tal cual (las fotos no se recargan ni parpadean); solo se rehace si su contenido cambió.
function homePut(el, h) {
  if (el._gh === h) return;
  const c = el._home;
  if (c && c.h === h && c.nodes.length) el.replaceChildren(...c.nodes);
  else { el.innerHTML = h; el._home = { h, nodes: [...el.childNodes] }; }
  el._gh = h;
}
function paintGrid() {
  const el = $("#grid"); if (!el) return;
  if (!DB.products.length) {
    el._gh = null; el.innerHTML = `<div class="empty hero" style="grid-column:1/-1"><h2>Empecemos por tus productos</h2><p>Agrégalos uno por uno, súbelos desde Excel o prueba primero con una lista de ejemplo.</p><div class="row" style="justify-content:center;gap:10px;flex-wrap:wrap">${can("precios") ? `<button class="btn" data-a="pnew">Agregar producto</button>` : ""}<button class="btn sec" data-a="sample">Cargar ejemplos</button></div></div>`;
    return;
  }
  const sm = scanMode(); document.body.classList.toggle("scanmode", sm); el.classList.toggle("scanlist", sm);
  document.body.classList.toggle("vit", sm && vit());
  document.body.classList.add("vtk"); // el ticket y los botones de pago se ven como en Vitrina en todos los modos (pedido de David)
  if (sm && vit() && !ui.q.trim() && !ui.cat) { homePut(el, vitHome()); ui.bump = null; ui.vlist = []; return; }
  if (sm && !ui.q.trim() && !ui.cat) { homePut(el, scanHome()); ui.bump = null; return; }
  const raw = ui.q.trim(), mm = raw.match(/^[\d.,\/]+\s*(?:k?g|gr)?\s*[*xX]\s*(.*)$/i), key = mm ? mm[1].trim() : raw, q = norm(key);
  const tops = ui.cat === "__top" ? topIds() : [];
  const catOk = (p) => !ui.cat || (ui.cat === "__top" ? tops.includes(p.id) : ui.cat === "__fav" ? p.fav : p.cat === ui.cat);
  let list = DB.products.filter((p) => p.on !== false && catOk(p) && (!q || nameHit(p.name, q) || (p.code || "") === key || (p.code || "").startsWith(key) || (p.pres || []).some((x) => x.code === key)));
  if (ui.cat === "__top" && !q) list.sort((a, b) => tops.indexOf(a.id) - tops.indexOf(b.id));
  else list = saleSort(list, key, q, !ui.cat);
  if (!list.length) { el._gh = null; el.innerHTML = ui.cat === "__top" && !q ? `<div class="empty" style="grid-column:1/-1"><h2>Aún no hay más vendidos</h2><p>Aparecerán aquí con tus primeras ventas.</p></div>` : `<div class="empty" style="grid-column:1/-1"><h2>No encontré «${esc(raw)}»${ui.cat && !ui.cat.startsWith("__") ? ` en ${esc(ui.cat)}` : ""}</h2><p>${ui.cat ? "Toca «Todo» para buscar en todos los productos." : "Prueba con otro nombre o código, o usa «Monto» para cobrar un importe suelto."}</p></div>`; return; }
  if (sm && vit() && q) { ui.vq = key; ui.vlist = list.slice(0, 12).map((p) => p.id); ui.vsel = Math.min(ui.vsel || 0, ui.vlist.length - 1); { const h = vitResults(list.slice(0, 12), key); if (el._gh !== h) { el.innerHTML = h; el._gh = h; } } ui.bump = null; return; }
  // Resultados de la búsqueda (Escáner y Fichas): uno marcado que se mueve con las flechas y Enter agrega (gMark).
  if (q) { if (ui.graw !== raw) ui.gsel = 0; ui.graw = raw; ui.gq = key; ui.glist = list.slice(0, 120).map((p) => p.id); } else { ui.gq = null; ui.glist = []; }
  const inCart = {}; DB.cart.items.forEach((i) => { const r = resolveLine(i); if (r && !i.quick) inCart[i.id] = r3((inCart[i.id] || 0) + i.qty * r.f); });
  const MAXL = 120, shown = list.slice(0, MAXL);
  // Si la lista es la misma (solo cambió el ticket), no se vuelve a dibujar: solo se ponen las cantidades. En PC lentas redibujar 120 fichas por producto agregado pesaba.
  const html = shown.map((p) => (sm ? rowHtml : tileHtml)(p, 0)).join("") + (list.length > MAXL ? `<p class="muted" style="grid-column:1/-1;padding:8px 4px">Mostrando ${MAXL} de ${list.length}. Escribe más para encontrar el producto.</p>` : "");
  if (el._gh !== html || !el.firstElementChild) { el.innerHTML = html; el._gh = html; }
  qtyMarks(el, inCart, sm); gMark();
  ui.bump = null;
}
// Pone o quita la cantidad que ya está en el ticket sobre cada ficha/fila, sin redibujar la lista.
function qtyMarks(el, inCart, sm) {
  el.querySelectorAll("[data-a=add][data-id]").forEach((b) => {
    const id = b.dataset.id, q = inCart[id], cur = b.querySelector(sm ? ".pq" : ".qty");
    b.classList.toggle("in", !!q);
    if (!q) { if (cur) cur.remove(); return; }
    const txt = fmtQ(q) + ((prod(id) || {}).unit === "kg" ? " kg" : ""), bump = !sm && ui.bump === id;
    if (cur && cur.textContent === txt && !bump) return;
    const n = document.createElement("span"); n.className = (sm ? "pq" : "qty") + " num" + (bump ? " bump" : ""); n.textContent = txt;
    if (cur) cur.replaceWith(n); else if (sm) b.insertBefore(n, b.querySelector(".pp")); else (b.querySelector(".pbox") || b).appendChild(n);
  });
}
function paintTickets() {
  const el = $("#tks"); if (!el) return;
  el.innerHTML = DB.tickets.map((t, i) => `<button class="tk ${i === DB.cur ? "on" : ""} ${t.mesa ? "mesa" : ""}" data-a="tk" data-i="${i}" title="Pasa de un ticket a otro con las flechas ← →">${esc(ticketLabel(t))}<small class="num">${t.items.length ? money(ticketTotal(t)) : "vacío"}</small></button>`).join("");
}
const nItems = (n) => `${n} ${n === 1 ? "producto" : "productos"}`;
function paintCart() {
  const el = $("#cart"); if (!el) return;
  const t = DB.cart, T = cartTotals(), lines = T.lines, cobra = can("cobrar"), c = cli(t.client), doc = t.doc || DB.cfg.docDef || "NV";
  // Tras cobrar, si la caja pasó a un ticket en espera, «¡Vendido!» se sigue viendo hasta que se escanea algo o se sigue.
  if (lines.length && !(ui.doneTk === t && t.items.length === ui.doneN)) ui.done = null;
  const bar = $("#cartbar");
  if (ui.done && saleById(ui.done)) { const h = doneHtml(saleById(ui.done)); if (el._gh !== h) { el.innerHTML = h; el._gh = h; } if (bar) bar.hidden = true; return; }
  ui.done = null;
  if (!lines.length) document.body.classList.remove("cart-open");
  if (!lines.some((x) => lineKey(x.l.id, x.l.pres) === ui.sel)) ui.sel = lines.length ? lineKey(lines[lines.length - 1].l.id, lines[lines.length - 1].l.pres) : null;
  const debt = c ? balanceOf(c) : 0, pts = c && DB.cfg.pts.on ? pointsOf(c) : 0, dis = lines.length ? "" : "disabled";
  const fresh = ui.fresh; ui.fresh = null;
  const html = `<div class="cart-in">
    <div class="paper">
      <div class="rhead">
        <div class="rtop"><span class="rtime num">${hhmm(Date.now())}</span><button class="cart-x" data-a="closecart" aria-label="Cerrar ticket">${svg("close")}</button></div>
        <div class="rmeta">${t.mesa || t.prev ? `<b class="tkn">${esc(ticketLabel(t))}</b>` : `<button class="tkn" data-a="tkname" title="Ponerle un nombre a este ticket">${esc(ticketLabel(t))}${svg("edit")}</button>`}
          <span class="racts"><button class="ib" data-a="tknew" title="Poner en espera y atender a otro cliente (F5)">${svg("hold")}<span>En espera</span></button>${lines.length || DB.tickets.length > 1 ? `<button class="ib" data-a="clear" title="${DB.tickets.length > 1 ? "Quitar este ticket" : "Vaciar el ticket"}">${svg("trash")}<span>${DB.tickets.length > 1 ? "Quitar" : "Vaciar"}</span></button>` : ""}</span></div>
        ${DB.tickets.length > 1 ? `<div class="tks" id="tks"></div>` : ""}
        <div class="who">
          <button class="cl ${c ? "set" : ""}" data-a="pickcli">${c ? `<span class="av" style="--h:${avHue(c)}">${esc(initials(c.name))}</span>` : `<span class="av none">${svg("user")}</span>`}<span><b>${c ? esc(c.name) : "Público general"}</b><small>${c ? `${c.doc ? esc(c.dt) + " " + esc(c.doc) : "Sin documento"}${debt > 0 ? " · debe " + money(debt) : ""}${pts ? ` · ${pts} pts` : ""}` : "Elegir cliente"}</small></span></button>
          <div class="seg" role="group" aria-label="Comprobante">${Object.keys(DOCS).map((d) => `<button class="${doc === d ? "on" : ""}" data-a="doc" data-d="${d}" title="${DOCS[d]}">${d === "NV" ? "Nota" : DOCS[d]}</button>`).join("")}</div>
        </div>
      </div>
      <div class="lines">${lines.length ? `<div class="lh" aria-hidden="true"><span>Cant.</span><span>Producto</span><span>P. unit.</span><span>Importe</span><span></span></div>` + lines.map(({ l, r }) => { const k = lineKey(l.id, l.pres); return `<div class="ln ${ui.sel === k ? "sel" : ""} ${fresh === k ? "fresh" : ""}" data-a="sel" data-k="${k}">
        <span class="qc step"><button class="sb" data-a="dec" data-k="${k}" aria-label="Quitar uno">−</button><button class="qv num" data-a="qedit" data-k="${k}" aria-label="Cambiar cantidad">${fmtQ(l.qty)}${unitTxt(r)}</button><button class="sb" data-a="inc" data-k="${k}" aria-label="Agregar uno">+</button></span>
        <span class="nm">${r.p ? pimg(r.p, "lim") : ""}<span><b>${esc(r.name)}</b>${r.code ? `<small>Cód. ${esc(r.code)}</small>` : ""}</span></span>
        <button class="pu num ${l.pr != null || r.tier ? "chg" : ""}" data-a="lprice" data-k="${k}" title="${r.tier ? (r.tn === "oferta" ? "Precio de oferta" : "Precio por mayor") : "Cambiar precio"}">${money(r.price)}${r.unit === "kg" ? "<small>/kg</small>" : r.tier ? `<small>${r.tn || "mayor"}</small>` : ""}</button>
        <span class="amt num">${money(r2(r.price * l.qty))}</span>
        <button class="rm" data-a="rmline" data-k="${k}" aria-label="Quitar ${esc(r.name)}">${svg("close")}</button></div>`; }).join("") : `<div class="cart-empty">${svg("scan")}<p><b>Escanea o busca un producto</b></p></div>`}</div>
      <div class="tot">
        ${lines.length ? `<div class="trow"><div class="trl">${ui.showDisc || t.disc ? `<label class="disc"><span>Descuento S/</span><input class="inp num" id="disc" data-in="disc" inputmode="decimal" placeholder="0.00" value="${t.disc ? t.disc : ""}"></label>` : `<button class="link xs" data-a="showdisc">+ Descuento</button>`}</div>
          <div class="sumx" ${DB.cfg.igvOn || T.disc ? "" : "hidden"}><span>Subtotal <b class="num">${money(T.sub)}</b></span>${DB.cfg.igvOn ? `<span>IGV ${DB.cfg.igv}% <b class="num">${money(T.igv)}</b></span>` : ""}</div></div>` : ""}
        <div class="bigtot"><span>Total<small>${nItems(T.count)}${T.disc ? ` · descuento ${money(T.disc)}` : ""}${T.red ? ` · redondeo ${T.red > 0 ? "−" : "+"}${money(Math.abs(T.red))}` : ""}</small></span><b class="num" id="cartTotal">${money(T.total)}</b></div>
      </div>
    </div>
    <div class="paybox">
      ${cobra ? `<div class="paymini pay4"><button class="pm efectivo" data-a="pay" data-m="efectivo" ${dis}>Efectivo<span class="pmx num">${lines.length ? money(T.total) : "<small>Agrega un producto</small>"}</span><span class="kbd">F2</span></button><button class="pm yape" data-a="pay" data-m="yape" ${dis}>Yape</button><button class="pm plin" data-a="pay" data-m="plin" ${dis}>Plin</button><button class="pm bcp" data-a="pay" data-m="bcp" ${dis}>BCP</button><button class="pm" data-a="paymas" ${dis}>Más</button></div>`
      : `<button class="cobrar" data-a="prevsave" ${dis}><span>Guardar preventa</span><span class="kbd">F2</span></button><p class="phint">El cliente paga en caja con el número de preventa.</p>`}
    </div></div>`;
  if (el._gh !== html) { el.innerHTML = html; el._gh = html; } // si el ticket no cambió, no se rehace (sin parpadeo)
  paintTickets();
  // Mostrar la línea elegida en el siguiente cuadro (antes medía la pantalla en medio de pintar: lento en la NCR).
  cancelAnimationFrame(paintCart.raf); paintCart.raf = requestAnimationFrame(() => { const sel = $(".ln.sel"); if (sel && sel.scrollIntoViewIfNeeded) sel.scrollIntoViewIfNeeded(false); else if (sel) sel.scrollIntoView({ block: "nearest" }); });
  if (bar) {
    bar.hidden = !lines.length;
    bar.innerHTML = `<button class="cb-open ${fresh ? "bump" : ""}" data-a="opencart"><span class="cbn num">${T.count}</span><span class="cbt">Ver ticket<b class="num">${money(T.total)}</b></span></button>${cobra ? `<button class="cb-pay" data-a="pay" data-m="efectivo">Cobrar</button>` : `<button class="cb-pay" data-a="prevsave">Guardar</button>`}`;
  }
}
// Después de cobrar: el ticket muestra el vuelto bien grande hasta que empiece la siguiente venta.
function doneHtml(s) {
  const pays = paysOf(s), cash = s.recv > 0 && pays.some((p) => p.m === "efectivo"), c = cli(s.client);
  return `<div class="cart-in"><div class="paper done" role="status">
    <div class="rtop"><span class="rtime num">${hhmm(s.t)}</span><button class="cart-x" data-a="newsale" aria-label="Cerrar">${svg("close")}</button></div>
    <div class="stamp">${svg("check")}<span>¡Vendido!</span></div>
    <p class="dno">${DOCS[s.doc ? s.doc.type : "NV"]} ${docNo(s)}${s.cname ? ` · ${esc(s.cname)}` : ""}</p>
    ${cash ? `<div class="vu"><span>Vuelto</span><b class="num" id="doneChange">${money(s.change)}</b><small>Pagó con ${money(s.recv)} · total ${money(s.total)}</small></div>`
      : `<div class="vu paid"><span>${esc(methodLabel(s))}</span><b class="num">${money(s.total)}</b><small>${s.ref ? "Operación " + esc(s.ref) : pays.some((p) => p.m === "credito") ? "Anotado en la cuenta del cliente" : "Pago completo"}</small></div>`}
    ${s.ptsEarn ? `<p class="dpts">${esc(s.cname.split(" ")[0])} ganó ${s.ptsEarn} puntos</p>` : ""}
    <div class="dacts"><button class="btn sec" data-a="print" data-id="${s.id}">${svg("print", "bi")}Imprimir</button><button class="btn sec" data-a="wa" data-id="${s.id}">${svg("wa", "bi")}WhatsApp${c && c.phone ? "" : ""}</button></div>
    <button class="link" data-a="seercpt" data-id="${s.id}">Ver comprobante</button>
  </div>
  <div class="paybox"><button class="cobrar next" data-a="newsale">${DB.cart.items.length ? "Seguir con " + esc(ticketLabel(DB.cart)) : "Nueva venta"}<span class="kbd">Enter</span></button><p class="phint">${DB.cart.items.length ? `${esc(ticketLabel(DB.cart))} estaba en espera (${money(ticketTotal(DB.cart))}).` : "O escanea el siguiente producto y seguimos."}</p></div></div>`;
}

/* ---------- cliente y comprobante del ticket ---------- */
function pickClient(cb) {
  const list = () => {
    const q = norm(ui.pcq || ""), cs = DB.clients.filter((c) => !q || norm(c.name).includes(q) || (c.doc || "").includes(ui.pcq || "") || (c.phone || "").includes(ui.pcq || "")).sort((a, b) => cmpEs(a.name, b.name)).slice(0, 60);
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
  saveCart(); const cb = ui.clicb; ui.clicb = null; closeModal(); paintSale(); if (cb) cb();
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
  const M = ["efectivo", "yape", "plin", "bcp", "tarjeta", "credito"].filter((m) => m !== "credito" || DB.clients.length || can("clientes"));
  const KEYL = { efectivo: "E", yape: "Y", plin: "P", bcp: "B", tarjeta: "T", credito: "C" };
  let body;
  if (p.method === "efectivo" && due <= 0) body = `<button class="btn lg" id="payok" data-a="payok" data-enter>Cobrar ${money(due)}</button>`;
  else if (p.method === "efectivo") body = `<div class="bills"><button class="bill exact" data-a="cashgo" data-v="${due}" data-enter><small>Exacto</small><b class="num">${money(due)}</b><em>Sin vuelto</em></button>${cashOpts(due).map((v) => `<button class="bill ${billCls(v)}" data-a="cashgo" data-v="${v}"><small>${BILLS.includes(v) ? "Billete" : "Paga con"}</small><b class="num">S/ ${v}</b><em class="num">Vuelto ${money(r2(v - due))}</em></button>`).join("")}</div>
      ${p.other ? `<div class="other"><label class="fld"><span>Otro monto</span><input class="inp num big" id="recv" data-in="recv" inputmode="decimal" enterkeyhint="done" placeholder="${due.toFixed(2)}" value="${esc(p.recv)}" ${p.recv === "" ? "autofocus" : ""}></label><div class="vuelto" id="vuelto"></div></div>
      <button class="btn lg" id="payok" data-a="payok">Cobrar en efectivo</button>` : `<button class="link" data-a="payother" style="margin:0 0 6px">Paga con otro monto</button>`}`;
  else if (p.method === "yape" || p.method === "plin") body = `${payTo(p.method)}<button class="btn lg go ${p.method}" id="payok" data-a="payok">Ya llegó el ${METHODS[p.method]}: cobrar ${money(due)}</button>`;
  else if (p.method === "credito") body = `${creditBlock()}<button class="btn lg" id="payok" data-a="payok" ${c ? "" : "disabled"}>Anotar ${money(due)} al crédito</button>`;
  else body = `<label class="fld"><span>${p.method === "tarjeta" ? "Pasa la tarjeta en tu POS. N° de operación (opcional)" : p.method === "bcp" ? "Cobra con BCP. N° de operación (opcional)" : p.method === "culqi" ? "Cobra con Culqi (enlace, QR o POS). N° de operación (opcional)" : "N° de operación de la transferencia (opcional)"}</span><input class="inp" id="pref" value="${esc(p.ref)}" placeholder="Ej: 004512" autocomplete="off" autofocus></label>
      <button class="btn lg${p.method === "culqi" || p.method === "bcp" ? " go " + p.method : ""}" id="payok" data-a="payok">Cobrar ${money(due)} con ${p.method === "culqi" || p.method === "bcp" ? METHODS[p.method] : METHODS[p.method].toLowerCase()}</button>`;
  openModal(`<div class="payhead"><div class="paytot"><span>A cobrar</span><b class="num">${money(due)}</b>${p.pts ? `<small>Total ${money(total)} − puntos ${money(p.pts)}</small>` : ""}</div><span class="tag">${DOCS[doc]}${c ? " · " + esc(c.name) : ""}</span></div>
    ${ptsBlock()}
    <div class="methods" role="tablist" aria-label="Medio de pago">${M.map((k) => `<button class="mth ${k} ${p.method === k ? "on" : ""}" role="tab" aria-selected="${p.method === k}" data-a="method" data-m="${k}" data-k="${KEYL[k]}"><span>${METHODS[k]}</span></button>`).join("")}</div>
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
// Dividir pago (rehecho el 25 oct 2026 a pedido de David, para que sea fácil): arriba el total y una barra con lo que ya
// se pagó por cada medio; «Falta» / «Vuelto» en grande; paso 1 «¿Cuánto paga?» (vacío = lo que falta, o montos rápidos)
// y paso 2 «¿Con qué paga?» (cada medio con su logo; tocarlo agrega esa parte). Crédito sin cliente pide elegirlo.
function paintSplit() {
  const p = ui.pay, r = splitCalc(), due = payDue(), falta = Math.max(0, r.rem), c = cli(DB.cart.client);
  const paid = r2(r.cashGiven + r.nonCash);
  let st, cls;
  if (r.nonCash > due) { st = `<span>Yape, Plin, BCP, tarjeta o crédito no pueden pasar el total</span><b></b>`; cls = "bad"; }
  else if (r.rem > 0) { st = `<span>${p.parts.length ? "Falta" : "Por pagar"}</span><b class="num">${money(r.rem)}</b>`; cls = "falta"; }
  else if (r.change > 0) { st = `<span>Vuelto</span><b class="num">${money(r.change)}</b>`; cls = "ok"; }
  else { st = `<span>Pago completo</span><b>✓</b>`; cls = "ok"; }
  const M = ["efectivo", "yape", "plin", "bcp", "tarjeta"].concat(DB.clients.length || can("clientes") ? ["credito"] : []);
  const base = Math.max(due, paid) || 1;
  const quick = [];
  if (falta > 0) {
    quick.push([falta, "Lo que falta"]);
    if (!p.parts.length && due >= 2) quick.push([r2(Math.round(due * 5) / 10), "La mitad"]);
    [10, 20, 50, 100].filter((v) => v < falta - 0.001).slice(-3).forEach((v) => quick.push([v, ""]));
  }
  openModal(`<div class="sphead"><div><h2>Dividir pago</h2><p class="muted">Una parte con un medio y el resto con otro.</p></div><div class="sptot"><span>Total</span><b class="num">${money(due)}</b></div></div>
    ${ptsBlock()}
    <div class="spbar" aria-hidden="true">${p.parts.map((x) => `<i class="m-${x.m}" style="width:${Math.min(100, (x.amt / base) * 100).toFixed(2)}%"></i>`).join("")}</div>
    <div class="vuelto spst ${cls}" id="splitst">${st}</div>
    ${p.parts.length ? `<div class="parts">${p.parts.map((x, i) => `<div class="part"><i class="pmi m-${x.m}" aria-hidden="true"></i><span>${METHODS[x.m]}</span><b class="num">${money(x.amt)}</b><button class="x" data-a="partdel" data-i="${i}" aria-label="Quitar este pago">✕</button></div>`).join("")}</div>` : ""}
    ${falta > 0 ? `<div class="spstep"><span class="spn">1</span><b>¿Cuánto paga?</b></div>
    <div class="sprow"><input class="inp num big" id="pamt" inputmode="decimal" placeholder="${falta.toFixed(2)}" aria-label="Monto de esta parte (vacío = lo que falta)" autofocus>
      <div class="spq">${quick.map(([v, t]) => `<button class="spc" data-a="pamtset" data-v="${v}">${t ? `<small>${t}</small>` : ""}<b class="num">${money(v)}</b></button>`).join("")}</div></div>
    <div class="spstep"><span class="spn">2</span><b>¿Con qué paga?</b></div>
    <div class="spm">${M.map((m) => `<button class="spmb" data-a="partadd" data-m="${m}"><i class="pmi m-${m}" aria-hidden="true"></i><span>${METHODS[m]}</span></button>`).join("")}</div>` : ""}
    ${p.parts.some((x) => x.m === "yape") && DB.cfg.yapeNum ? `<p class="muted" style="margin:8px 0 0">Yape: <b>${fmtPhone(DB.cfg.yapeNum)}</b></p>` : ""}
    <div class="btns h spfoot"><button class="btn sec" data-a="split">Volver</button><button class="btn" id="payok" data-a="payok" ${r.ok ? "data-enter" : "disabled"}>${r.ok ? `Cobrar ${money(due)}` : "Confirmar cobro"}</button></div>`, "paym spl");
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
    beep(true); closeModal(); ui.done = s.id; ui.doneTk = DB.cart; ui.doneN = DB.cart.items.length; ui.q = ""; const qi = $("#q"); if (qi) qi.value = "";
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
    items, sub: T.sub, disc: T.disc, red: T.red || 0, total: T.total, gravada: T.gravada, igv: T.igv, exo: T.exo, pays,
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
  freshTicketAfterSale(); save();
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
    ${s.disc || s.red ? `<div class="l"><span>Subtotal</span><span>${money(s.sub)}</span></div>` : ""}${s.disc ? `<div class="l"><span>Descuento</span><span>- ${money(s.disc)}</span></div>` : ""}${s.red ? `<div class="l"><span>Redondeo</span><span>${s.red > 0 ? "-" : "+"} ${money(Math.abs(s.red))}</span></div>` : ""}
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
  if (s.red) t += `\nRedondeo: ${s.red > 0 ? "-" : "+"}${money(Math.abs(s.red))}`;
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
// Código de barras que la caja no conoce: se busca el producto una vez y queda enlazado.
function learnOpen(code) {
  ui.lc = code; const q = norm(ui.lq2 || ""), found = q ? DB.products.filter((p) => p.on !== false && nameHit(p.name, q)).slice(0, 8) : [];
  openModal(`<h2>Código nuevo</h2>
    <p class="muted" style="margin-bottom:10px">La caja no conoce <b class="num">${esc(code)}</b>. Busca el producto: la próxima vez ya lo reconoce.</p>
    <label class="fld"><span>¿Qué producto es?</span><input class="inp" id="wq" type="search" value="${esc(ui.lq2 || "")}" placeholder="Escribe el nombre" autocomplete="off"></label>
    <div class="list" id="wfound">${found.map((p) => `<button class="it sm" data-a="learnpick" data-id="${p.id}"><span class="iti">${pimg(p, "lim")}</span><div class="t"><b>${esc(p.name)}</b><small>${p.code ? "Cód. " + esc(p.code) + " · " : ""}${money(p.price)}</small></div><div class="v">Es este</div></button>`).join("") || (q ? `<p class="muted" style="padding:8px 2px">No encontré ese producto. Prueba con otra palabra.</p>` : "")}</div>
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button></div>`, "wide");
  ui.mk = "learn"; setTimeout(() => { const i = $("#wq"); if (i) i.focus(); }, 30);
}
// Código escrito o escaneado: "6", "3*6", "P15" (preventa), etiqueta de balanza (2xxxxx...), código de presentación.
// Códigos → producto en un mapa (se rehace solo cuando cambian los datos, DBV). Mismo orden de antes: código del
// producto, código de una presentación y por último los códigos de barras aprendidos (p.bar).
let codeIdx = { v: -1, m: null };
function codeFind(code) {
  if (codeIdx.v !== DBV || !codeIdx.m) {
    const m = new Map();
    for (const x of DB.products) if (x.code && !m.has(x.code)) m.set(x.code, [x, ""]);
    for (const x of DB.products) for (const y of x.pres || []) if (y.code && !m.has(y.code)) m.set(y.code, [x, y.id]);
    for (const x of DB.products) for (const b of x.bar || []) if (b && !m.has(b)) m.set(b, [x, ""]);
    codeIdx = { v: DBV, m };
  }
  return codeIdx.m.get(code);
}
function submitCode(raw) {
  raw = raw.trim(); if (!raw) return;
  const clear = () => { ui.q = ""; ui.vsel = 0; const qi = $("#q"); if (qi) qi.value = ""; };
  const pv = raw.match(/^p\s*-?\s*(\d+)$/i);
  if (pv && can("cobrar")) { clear(); loadPrev(+pv[1]); paintGrid(); return; }
  let qty = null, code = raw;
  const m = raw.match(/^([\d.,\/]+\s*(?:k?g|gr)?)\s*[*xX]\s*(.+)$/i);
  if (m) { qty = r3(parseQty(m[1])); code = m[2].trim(); if (!(qty > 0)) { toast("Cantidad no válida"); beep(false); return; } }
  const hit = codeFind(code); // código del producto, de una presentación o de barras aprendido
  let p = hit && !hit[1] && hit[0].code === code ? hit[0] : null, pres = "";
  const lab = !p && qty == null ? parseLabel(code) : null;
  if (lab) { clear(); addToCart(lab.p, lab.qty); paintGrid(); return; }
  if (!p && hit) { p = hit[0]; pres = hit[1]; }
  const exact = !!p;
  if (!p) { const k = norm(code), list = DB.products.filter((x) => nameHit(x.name, k)); if (list.length === 1) p = list[0]; else if (list.length > 1) { list.sort(saleCmp(code, k, true)); const kgs = list.filter((x) => x.unit === "kg");
      // En Vitrina, Enter toma el marcado de la lista (si la lista es de esta misma búsqueda; si no, el primero). Con peso «0.250*…» y un solo producto por kilo, ese.
      const vp = vit() ? (ui.vq === code && ui.vlist && ui.vlist.length > 1 ? prod(ui.vlist[ui.vsel || 0]) : list[0]) : ui.gq === code && ui.glist && ui.glist.length ? prod(ui.glist[ui.gsel || 0]) || list[0] : list[0]; if (vp) p = vp; else { toast("Hay varios productos así: toca el que quieras"); return; } } }
  if (!p && qty == null && /^\d{6,}$/.test(code) && can("cobrar")) { beep(false); clear(); ui.lq2 = ""; learnOpen(code); return; } // código de barras nuevo: se enlaza a un producto
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
  learnpick: (el) => { const p = prod(el.dataset.id), c = ui.lc; if (!p || !c) return; p.bar = p.bar || []; if (!p.bar.includes(c)) p.bar.push(c); save(); log("Código enlazado", `${c} → ${p.name}`); ui.lq2 = ""; ui.lc = ""; closeModal(); submitCode(c); },
  add: (el) => { const p = prod(el.dataset.id); if (!p) return;
    // Si en el buscador se escribió la cantidad o el peso con asterisco («0.250*pal») y se toca un producto de la
    // lista (aunque no sea el primero), se agrega con esa cantidad, sin pedir el peso otra vez.
    const qi = $("#q"), m = qi && ui.tab === "venta" ? qi.value.trim().match(/^([\d.,\/]+\s*(?:k?g|gr)?)\s*[*xX]\s*(.*)$/i) : null;
    if (m) { const q = r3(parseQty(m[1])); if (q > 0) { ui.q = ""; ui.vsel = 0; qi.value = ""; addToCart(p, q); paintGrid(); focusQ(); return; } }
    if ((p.pres || []).length) presPicker(p); else if (p.unit === "kg") openWeigh(p.id, "add"); else addToCart(p); },
  addpres: (el) => { const p = prod(el.dataset.id); if (!p) return; const pres = el.dataset.p; closeModal(); if (!pres && p.unit === "kg") openWeigh(p.id, "add"); else addToCart(p, 1, pres); },
  inc: (el) => changeQty(el.dataset.k, 1),
  dec: (el) => changeQty(el.dataset.k, -1),
  sel: (el) => { ui.sel = el.dataset.k; $$(".ln").forEach((x) => x.classList.toggle("sel", x.dataset.k === ui.sel)); },
  qedit: (el) => editLine(el.dataset.k),
  qeditsel: () => editLine(ui.sel),
  qok: () => { const q = ui.qty; if (!q || !$("#qv")) return; const v = r3(parseQty($("#qv").value)); if (setLine(q.id, q.pres, v)) closeModal(); },
  rmline: (el) => { const k = el.dataset.k; DB.cart.items = DB.cart.items.filter((i) => lineKey(i.id, i.pres) !== k); saveCart(); beep(true); paintSale(); focusQ(); },
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
    dropCurrentTicket(); saveCart(); paintSale(); focusQ();
  }),
  tknew: () => { if (!DB.cart.items.length) { toast("Este ticket ya está vacío: úsalo"); return; } newTicketNow(); paintSale(); focusQ(); toast("Ticket nuevo. El anterior quedó en espera"); },
  tk: (el) => { const i = +el.dataset.i; if (i === DB.cur) return; DB.cur = i; ui.sel = null; saveCart(); paintSale(); focusQ(); },
  tkname: () => promptBox({ title: "Nombre del ticket", text: "Ayuda a reconocerlo cuando hay varios en espera. Ej: señora de azul.", label: "Nombre", value: DB.cart.name, max: 24 }, (v) => { DB.cart.name = v; save(); paintSale(); }),
  cat: (el) => { ui.cat = el.dataset.c; paintCats(); paintGrid(); focusQ(); },
  opencart: () => document.body.classList.add("cart-open"),
  closecart: () => document.body.classList.remove("cart-open"),
  pickcli: (el) => { const back = el && el.dataset && el.dataset.back === "pay" && ui.pay ? Object.assign({}, ui.pay) : null; pickClient(back ? () => { ui.pay = back; paintPay(); } : null); },
  clipick: (el) => setClient(el.dataset.id),
  clinone: () => { DB.cart.client = ""; if (DB.cart.doc === "F") DB.cart.doc = ""; setClient(""); },
  clinew: () => { const cb = ui.clicb; openClient("", (c) => { ui.clicb = cb; setClient(c.id); }); },
  doc: (el) => { DB.cart.doc = el.dataset.d; saveCart(); paintCart(); const m = docCheck(); if (m) toast(m, true); },
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
    if (m === "credito" && !cli(DB.cart.client)) { toast("Elige a quién le fías"); return A.pickcli({ dataset: { back: "pay" } }); }
    if (m !== "efectivo" && a > falta + 0.001) { toast(`${METHODS[m]} no puede pasar de lo que falta (${money(falta)})`); beep(false); return; }
    p.parts.push({ m, amt: a }); paintPay();
  },
  pamtset: (el) => { const i = $("#pamt"); if (i) { i.value = String(el.dataset.v); i.focus(); i.select(); } },
  partdel: (el) => { ui.pay.parts.splice(+el.dataset.i, 1); paintPay(); },
  gosettings: () => { closeModal(); ui.atab = "cobros"; go("aj"); },
  focusq: () => { const q = $("#q"); if (q) { q.focus(); q.select(); } },
  // Siguiente venta: en Vender solo se repinta el ticket (antes se rehacía toda la pantalla y la vitrina pestañeaba).
  newsale: () => {
    if (modalOpen()) closeModal(); ui.done = null; ui.doneTk = null; ui.q = ""; document.body.classList.remove("cart-open");
    if (ui.tab === "venta" && $("#grid")) { const q = $("#q"); if (q) q.value = ""; paintSale(); focusQ(); } else render();
  },
  payother: () => { if (ui.pay) { ui.pay.other = true; paintPay(); } },
  cashgo: (el) => { if (!ui.pay) return; ui.pay.recv = String(el.dataset.v); confirmPay(); },
  showdisc: () => { if (!can("descuento")) return need("descuento", () => { ui.showDisc = true; paintCart(); const d = $("#disc"); if (d) d.focus(); }, "Descuento"); ui.showDisc = true; paintCart(); const d = $("#disc"); if (d) d.focus(); },
  seercpt: (el) => { const s = saleById(el.dataset.id); if (s) showReceipt(s, true); },
  tools: () => {
    const cobra = can("cobrar");
    const f = (act, ic, name, key, m) => `<button class="fb" data-a="fn" data-f="${act}"${m ? ` data-m="${m}"` : ""}>${svg(ic)}<span>${name}</span>${key ? `<kbd>${key}</kbd>` : ""}</button>`;
    openModal(`<h2>Funciones</h2>
      <h3 class="fh">Cobrar</h3><div class="fgrid">
      ${cobra ? f("pay", "money", "Efectivo", "F2", "efectivo") + f("pay", "money", "Yape", "F8", "yape") + f("pay", "money", "Plin", "F10", "plin") + f("pay", "money", "BCP", "", "bcp") + f("pay", "caja", "Tarjeta", "", "tarjeta") + f("split", "ventas", "Dividir pago", "F7") + f("pay", "cli", "Crédito", "", "credito") : ""}
      ${f("prevsave", "prev", "Guardar preventa", cobra ? "" : "F2")}${cobra ? f("prevload", "prev", "Cobrar preventa") : ""}
      </div>
      <h3 class="fh">Ticket</h3><div class="fgrid">
      ${f("pickcli", "cli", "Cliente", "F1")}${f("focusq", "search", "Buscar", "F3")}${f("tknew", "hold", "En espera", "F5")}${f("qeditsel", "edit", "Cantidad", "F6")}${f("rmsel", "trash", "Quitar línea", "Supr")}${f("showdisc", "plus", "Descuento")}
      </div>
      <h3 class="fh">Más</h3><div class="fgrid">
      ${vozOk() ? f("voz", "mic", "Voz") : ""}${f("camscan", "scan", "Cámara")}${f("scaletool", "scale", "Balanza")}${f("quick", "plus", "Monto suelto")}${+DB.cfg.tables ? f("mesas", "mesa", "Mesas") : ""}
      </div>`, "wide");
  },
  paymas: () => {
    const f = (act, ic, name, key, m) => `<button class="fb" data-a="fn" data-f="${act}"${m ? ` data-m="${m}"` : ""}>${svg(ic)}<span>${name}</span>${key ? `<kbd>${key}</kbd>` : ""}</button>`;
    openModal(`<h2>Otras formas de pago</h2><div class="fgrid" style="margin:12px 0">${f("pay", "caja", "Tarjeta", "", "tarjeta")}${f("pay", "cli", "Crédito", "", "credito")}${f("split", "ventas", "Dividir pago", "F7")}${f("prevsave", "prev", "Guardar preventa", "")}</div><div class="btns h"><button class="btn sec" data-a="close">Cerrar</button></div>`);
  },
  fn: (el) => { const a = el.dataset.f; closeModal(); if (A[a]) A[a]({ dataset: { m: el.dataset.m || "" } }); },
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

const paintNet = () => { const n = $("#net"); if (!n) return; const on = navigator.onLine; n.classList.toggle("off", !on); n.textContent = on ? "En línea" : "Sin internet"; };
window.addEventListener("online", paintNet); window.addEventListener("offline", paintNet);

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
    const s = document.createElement("script"); s.src = libUrl("escaner.js"); s.async = true;
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
  const p = DB.products.find((x) => (x.code && x.code === code) || (x.bar || []).includes(code));
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
  const T = v.tpl, conProd = !["aviso", "lista"].includes(T);
  const rowsTxt = (v.rows || []).map((r) => `${r.name || (r.pid && prod(r.pid) ? prod(r.pid).name : "")}${+r.price ? " " + (+r.price).toFixed(2) : ""}`).join("\n");
  return `<div class="vtform"><div class="vtpwrap"><div class="vtp-prev" style="aspect-ratio:${vitAspect()}">${vitTplHtml(v)}</div>
    <div class="vtpf"><div class="seg vtpk" role="group" aria-label="Plantilla">${VIT_TPLS.map(([k, n]) => `<button class="${T === k ? "on" : ""}" data-a="vtpset" data-k="tpl" data-v="${k}">${n}</button>`).join("")}</div>
      <div class="vtmini"><span>Estilo</span>${vitStStrip(v, "vtpset")}</div>
      ${!v.st || v.st === "clasico" ? `<button class="btn sec sm" data-a="vtpset" data-k="tone" data-v="${((v.tone || 0) + 1) % 3}">Otro color</button>` : ""}
      ${conProd ? `<label class="vtmini"><span>Producto${T === "combo" ? " (opcional)" : ""}</span><input class="inp" list="vtpprods" data-vtp="prod" value="${esc(p ? p.name : "")}" placeholder="Escribe y elige" autocomplete="off"><datalist id="vtpprods">${names}</datalist></label>` : ""}
      ${T === "combo" ? `<label class="vtmini"><span>Promoción</span><input class="inp" data-vtp="promo" maxlength="24" value="${esc(v.promo || "")}" placeholder="Ej: 2x1, 3x2, 3 x S/ 10"></label>` : ""}
      <label class="vtmini"><span>${T === "aviso" ? "Aviso" : T === "lista" ? "Título" : "Título (vacío = nombre del producto)"}</span><input class="inp" data-vtp="title" maxlength="70" value="${esc(v.title || "")}"></label>
      ${T === "lista" ? `<label class="vtmini"><span>Productos y precios (uno por línea; sin precio usa el de la caja)</span><textarea class="inp" data-vtp="rows" rows="5" placeholder="Papaya 3.50\nMango 5\nPlátano">${esc(rowsTxt)}</textarea></label>` : ""}
      ${conProd && T !== "combo" ? `<label class="vtmini"><span>Precio a mostrar (vacío = el de la caja)</span><input class="inp num" data-vtp="price" inputmode="decimal" value="${v.price ? (+v.price).toFixed(2) : ""}" placeholder="${p ? vitTplPrice(Object.assign({}, v, { price: 0 }), p).pr.toFixed(2) : "0.00"}"></label>` : ""}
      <label class="vtmini"><span>Texto chico (opcional)</span><input class="inp" data-vtp="sub" maxlength="50" value="${esc(v.sub || "")}" placeholder="${T === "aviso" ? "Ej: Gracias por su preferencia" : "Ej: Solo este fin de semana"}"></label>
      ${vitUntilFld(v)}<button class="btn sec sm" data-a="vitquitar">Borrar esta vitrina</button></div></div></div>`;
}
// «Papaya 3.50» por línea → filas de la lista (busca el producto para tomar su precio si no pones uno)
function vitRowsParse(txt) {
  return String(txt || "").split(/\n/).map((l) => l.trim()).filter(Boolean).slice(0, 8).map((l) => {
    const m = l.match(/^(.*?)\s+(?:s\/\.?\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:soles|sol)?$/i), nm = (m ? m[1] : l).trim(), k = norm(nm);
    const p = DB.products.find((x) => norm(x.name) === k) || (k.length > 2 ? DB.products.find((x) => x.on !== false && norm(x.name).startsWith(k + " ")) || vitFindProd(nm) : null);
    return { pid: p ? p.id : "", name: p && norm(p.name) === k ? p.name : nm.slice(0, 40), price: m ? r2(num(m[2])) : 0 };
  });
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
const VIT_TPLS = [["oferta", "Oferta"], ["nuevo", "Nuevo"], ["precio", "Precio especial"], ["destacado", "Destacado"], ["combo", "2x1 o combo"], ["lista", "Lista de precios"], ["aviso", "Aviso"]];
const VIT_TPL_N = Object.fromEntries(VIT_TPLS);
const VIT_TAG = { oferta: "Oferta", nuevo: "¡Nuevo!", precio: "Precio especial", destacado: "Recomendado", combo: "Promoción", lista: "Precios de hoy", aviso: "Aviso" };
// Precio que se muestra: el que pusiste; si no, el de la caja (con su oferta si está vigente, y el normal tachado).
function vitTplPrice(v, p) {
  const nor = p ? +p.price || 0 : 0, of = p ? ofertaOf(p) : null, mine = +v.price || 0;
  if (mine > 0) return { pr: mine, old: nor > mine + 0.004 ? nor : 0 };
  if (of && of < nor) return { pr: of, old: nor };
  return { pr: nor, old: 0 };
}
function vitTplHtml(v) {
  if (v.st && v.st !== "clasico" && VIT_ST_N[v.st]) return vitStHtml(v);
  const D = vitTplData(v), p = D.p, d = D.d, kg = D.kg;
  const img = p && v.tpl !== "lista" ? `<div class="vtp-im k-${imgKind(p)}">${pimg(p, "vtp-pim")}</div>` : "";
  const big = v.tpl === "aviso" || v.tpl === "lista" ? "" : D.promo ? `<span class="vtp-pr vtp-promo">${esc(D.promo)}</span>` : d.pr > 0 ? `<span class="vtp-pr num"><small>S/</small>${d.pr.toFixed(2)}${kg ? "<small>/kg</small>" : ""}</span>` : "";
  const old = d.old && !["combo", "lista"].includes(v.tpl) ? `<s class="vtp-old num">${money(d.old)}</s>` : "";
  return `<div class="vtp t-${esc(v.tpl || "oferta")} tn-${(+v.tone || 0) % 3}${img ? "" : " noimg"}"><i class="vtp-dec" aria-hidden="true"></i><div class="vtp-in">${img}<div class="vtp-tx"><span class="vtp-tag">${D.tag}</span><b class="vtp-nm">${esc(D.name)}</b>${D.rows ? vitRowsHtml(D.rows, "vtp-rows") : ""}${old}${big}${D.sub ? `<span class="vtp-sub">${esc(D.sub)}</span>` : ""}</div></div></div>`;
}
const vitSlideHtml = (v, all) => (v.kind === "tpl" ? vitTplHtml(v) : `<div class="vimgbox">${vitImgHtml(v, all)}</div>`);
// Las que salen en la venta: prendidas, sin vencer y con algo que mostrar.
const vitActive = () => { const hoy = dkey(); return vitList().filter((v) => v.on !== false && (!v.h || v.h >= hoy) && (v.kind === "tpl" ? (v.tpl === "aviso" ? !!v.title : v.tpl === "lista" ? !!(v.rows && v.rows.length) : !!(v.pid && prod(v.pid)) || !!v.title || !!v.promo) : !!v.img)); };
function vitSlidesHtml() {
  const L = vitActive(); if (!L.length) return "";
  const cur = (ui.vsi || 0) % L.length;
  // Solo se dibuja el afiche que se ve; los demás se dibujan cuando les toca (vitTurn): rápido aunque haya 12.
  return `<div class="vit-home custom vslides">${L.map((v, i) => `<div class="vsl${i === cur ? " on" : ""}">${i === cur ? vitSlideHtml(v) : ""}</div>`).join("")}${L.length > 1 ? `<div class="vdots" aria-hidden="true">${L.map((v, i) => `<i class="${i === cur ? "on" : ""}"></i>`).join("")}</div>` : ""}</div>`;
}
// Turno: cada N segundos pasa a la siguiente (solo cambia clases, no vuelve a dibujar la pantalla).
function vitTurn() {
  const box = document.querySelector("#grid .vslides");
  if (box && !document.hidden) {
    const sl = box.querySelectorAll(".vsl");
    if (sl.length > 1) { const n = ((ui.vsi || 0) + 1) % sl.length; ui.vsi = n; if (!sl[n].firstChild) { const v = vitActive()[n]; if (v) sl[n].innerHTML = vitSlideHtml(v); } sl.forEach((e, i) => e.classList.toggle("on", i === n)); box.querySelectorAll(".vdots i").forEach((e, i) => e.classList.toggle("on", i === n)); }
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
  vtpnew: () => { const top = topIds()[0], p = (top && prod(top)) || DB.products.find((x) => x.on !== false); const n = vitNewTpl({ pid: p ? p.id : "", tpl: p ? "oferta" : "aviso", st: p ? "super" : "pizarra" }); if (n) { ui.vsl = n.id; render(); } },
  vianew: () => { helpOpen(); const i = $("#helpInput"); if (i) { i.value = "Dibuja "; i.focus(); try { i.setSelectionRange(7, 7); } catch (e) {} } },
  vtpset: (el) => { const k = el.dataset.k, v = vitSel(); if (k === "st" && v && el.dataset.v === "clasico" && (!v.st || v.st === "clasico")) { vitSet({ tone: ((+v.tone || 0) + 1) % 3 }); return void render(); } vitSet({ [k]: k === "tone" ? +el.dataset.v : el.dataset.v }); render(); }
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
  else if (d.vtp === "rows") patch = { rows: vitRowsParse(t.value) };
  else if (d.vtp === "promo") patch = { promo: t.value.slice(0, 24) };
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
const VIT_RELLENO = new Set("haz hazme hace crea creame pon ponme ponle arma armame prepara preparame genera quiero una un uno la el lo los las de del para en con a al por que mi mis tu su vitrina afiche cartel letrero banner poster publicidad anuncio anuncia imagen diseno diseño oferta ofertas ofertita promo promocion descuento remate liquidacion nuevo nueva novedad llego llegaron recien destaca destacado destacada recomendado recomendada recomienda precio precios especial aviso avisa luis porfa favor soles sol s/ s/. esta este solo nomas hoy hasta y ya tenemos hay venta estilo tipo como combo lista lleva llevas paga pagas x".split(" "));
function vitParseLuis(text) {
  const t = String(text || "").trim(), n = norm(t).replace(/\s+/g, " ");
  // 1) dibujo con IA
  const ia = n.match(/^(?:luis,?\s+)?(?:por favor\s+)?(?:dibuja|dibujame|dibujar|genera|generame|crea|creame|haz|hazme)\s+(?:una?\s+)?(?:imagen|foto|dibujo|fondo|ilustracion)\b(?:\s+con\s+ia)?[\s,:]*(?:de|con|para)?\s*/) || n.match(/^(?:luis,?\s+)?(?:dibuja|dibujame)\s+/);
  if (ia) { const idea = t.slice(ia[0].length).trim(); return { ia: idea || t }; }
  // 2) ideas de Luis: «¿qué oferta hago?», «sugiéreme ofertas»
  if (vitIdeasPedido(n)) return { ideas: true };
  // 3) afiche con un producto, combo, lista de precios o aviso (con estilo si lo dice)
  const sty = vitParseStyle(n), stv = sty ? sty[0] : "";
  const ctx = /\b(vitrina|afiche|cartel|letrero|banner|poster|publicidad)\b/.test(n) || !!sty;
  const promo = vitParsePromo(n), lista = /\b(oferta|ofertas|promo|promocion|lista de precios?|precios de)\b/.test(n) ? vitParseList(t, n) : null;
  if (lista) return Object.assign({ tpl: "lista", st: stv, tone: 0, pid: "", sub: "", price: 0, h: (vitHasta(n) || [""])[0] }, lista);
  const tpl = promo || /\bcombo\b/.test(n) ? "combo" : /\b(oferta|ofertita|promo|promocion|descuento|remate|liquidacion)\b/.test(n) ? "oferta"
    : /^(?:luis,?\s+)?(?:pon(?:me)?\s+(?:un\s+)?|haz(?:me)?\s+un\s+|crea\s+un\s+)?(aviso|anuncio|comunicado)\b|\b(avisa|anuncia) que\b|\bque diga\b/.test(n) ? "aviso"
    : /\b(destaca|destacado|destacada|recomendado|recomendada|recomienda)\b/.test(n) ? "destacado"
    : /\bprecio especial\b/.test(n) ? "precio"
    : /\b(nuevo|nueva|novedad|llego|recien llegad)/.test(n) && ctx ? "nuevo" : ctx ? "destacado" : null;
  if (!tpl) return null;
  const out = { tpl, st: stv, tone: 0, pid: "", title: "", sub: "", price: 0, h: "", promo: promo ? promo[0] : "" };
  let rest = n; if (sty) rest = rest.replace(sty[1], " "); if (promo) rest = rest.replace(promo[1], " " + (promo[2] || "") + " ");
  const ha = vitHasta(n); if (ha) { out.h = ha[0]; out.sub = ha[1]; rest = rest.replace(ha[2], " "); }
  if (tpl === "aviso") {
    const m = t.match(/(?:aviso|anuncio|comunicado|avisa que|anuncia que|que diga)\s*[:,]?\s*/i);
    let tx = m ? t.slice(t.toLowerCase().indexOf(m[0].toLowerCase()) + m[0].length) : "";
    tx = tx.replace(/^["'«“]+|["'»”]+$/g, "").replace(/\s+en la vitrina\.?$/i, "").replace(/\s*,?\s*(?:estilo|tipo)\s+[a-záéíóúñ ]+$/i, "").trim();
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
// ¿Este afiche baja el precio de un producto? Entonces se puede cobrar así en la caja (p.oferta).
const vitCobrable = (v) => { const p = v.kind === "tpl" && ["oferta", "precio"].includes(v.tpl) && v.pid ? prod(v.pid) : null; return p && +v.price > 0 && +v.price < +p.price - 0.004 ? p : null; };
function vitCard(v, why) {
  const id = ++vitCardN, w = document.createElement("div"); vitCards[id] = { v, el: w };
  const pc = vitCobrable(v);
  w.className = "hl-card hl-vit";
  w.innerHTML = `<div class="hl-ch"><i aria-hidden="true"></i>${why ? "Idea de Luis" : "Para tu vitrina"}</div>${why ? `<p class="hl-vwhy">${esc(why)}</p>` : ""}<div class="hl-vprev">${vitCardPrev(v)}</div>
    ${v.kind === "tpl" ? vitStStrip(v, "vlSt", id) : ""}
    ${pc ? `<label class="hl-vco"><input type="checkbox" data-vco="${id}"${v.cobrar !== false ? " checked" : ""}><span>Cobrar ${money(v.price)} en la caja${v.h ? ` hasta el ${dmy(v.h).slice(0, 5)}` : ""} <small>(ahora ${money(pc.price)})</small></span></label>` : ""}
    <div class="hl-cb"><button type="button" class="hl-b sec" data-a="vlNo" data-id="${id}">${why ? "No, gracias" : "Cancelar"}</button><button type="button" class="hl-b" data-a="vlSi" data-id="${id}">Poner en la vitrina</button></div>`;
  return w;
}
// Devuelve true si el texto era un pedido para la vitrina y ya se atendió.
function vitLuis(text) {
  let r; try { r = vitParseLuis(text); } catch (e) { return false; }
  if (!r) return false;
  if (r.ia !== undefined) { vitIA(r.ia); return true; }
  if (r.ideas) {
    const I = vitIdeas();
    if (!I.length) { helpSay("Por ahora no veo productos por vencer ni parados, y aún no tienes ventas para saber qué destacar. Pídeme uno directo, por ejemplo: «haz una oferta de Inca Kola a 2.90 hasta el domingo»."); return true; }
    helpSay(I.length === 1 ? "Te propongo esta:" : `Te propongo ${I.length} ideas. Elige el estilo que más te guste y ponlas en tu vitrina:`);
    I.forEach((x) => helpAppend("assistant", "", { node: vitCard(Object.assign({ kind: "tpl" }, x.v), x.why), instant: true }));
    return true;
  }
  if (r.tpl === "lista" && !(r.rows && r.rows.length)) { helpSay("¿Qué productos pongo en la lista? Por ejemplo: «lista de precios de frutas» o «oferta de papaya 3.50, mango 5 y plátano 2»."); return true; }
  if (!["aviso", "lista"].includes(r.tpl) && !r.pid && !r.title && !r.promo) { helpSay("¿De qué producto hago el afiche? Por ejemplo: «haz una oferta de Inca Kola a 2.90 hasta el domingo»."); return true; }
  if (r.tpl === "aviso" && !r.title) { helpSay("¿Qué pongo en el aviso? Por ejemplo: «aviso: hoy cerramos a las 9 pm»."); return true; }
  const v = Object.assign({ kind: "tpl" }, r), p = v.pid ? prod(v.pid) : null;
  if (!v.st) v.st = VIT_ST_DEF[v.tpl] || "super";
  const nota = p && !v.price && v.tpl !== "combo" ? ` Usé el precio de tu caja (${money(vitTplPrice(v, p).pr)}).` : !p && !["aviso", "lista"].includes(v.tpl) ? " No encontré ese producto en tu caja, así que va sin foto." : v.tpl === "combo" && v.promo ? ` ${/^\d+x\d+$/.test(v.promo) ? `El ${v.promo}` : "La promoción"} sale en el afiche; al cobrar, aplícalo con un descuento.` : "";
  helpSay("Así quedaría." + nota + " Elige el estilo que más te guste y ponlo en tu vitrina.", { node: vitCard(v), instant: true });
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
    const v = { kind: "ia", img: vitEncode(c), ts: Date.now(), fit: "cover", zoom: 100, tx: 0, ty: 0, bg: "#ffffff", txt: vitIATextos(idea) };
    if (wait) wait.remove();
    helpSay("Aquí está. Si te gusta, ponla en tu vitrina; después puedes agregarle textos y precios en Ajustes › Pantalla de venta.", { node: vitCard(v), instant: true });
  } catch (e) {
    if (wait) wait.remove();
    const st = e.status || 0;
    helpSay(st === 503 || st === 404 ? "La IA de dibujo todavía no está activada: falta poner la clave del servicio de imágenes. Mientras tanto puedo armarte afiches con tus productos, por ejemplo: «haz una oferta de Inca Kola a 2.90»."
      : st === 429 ? "La IA gratuita está dibujando otra imagen. Espera unos segundos y vuelve a pedírmelo."
      : st === 403 ? "La IA de dibujo es parte del extra de voz e IA, o ya usaste los pedidos de hoy. Pídele a tu proveedor que lo active."
      : st === 401 ? "Tu sesión de Google venció. Vuelve a entrar en Ajustes › Nube." : "No pude dibujar ahora. Inténtalo otra vez en un momento.");
  } finally { if (wait) wait.remove(); helpBusy = false; if (chat) chat.classList.remove("busy"); }
}
// «dibuja una canasta de frutas para la oferta de papaya a 3.50» → etiqueta «Oferta» y sello con el precio encima del dibujo
function vitIATextos(idea) {
  const n = norm(idea), m = n.match(/(?:\ba|\bpor|s\/\.?)\s*(\d+(?:[.,]\d{1,2})?)\b|(\d+(?:[.,]\d{1,2})?)\s*(?:soles|sol)\b/), out = [], id = () => "t" + Date.now().toString(36) + Math.floor(Math.random() * 999);
  const tag = /\b(oferta|promo|promocion|descuento|remate)\b/.test(n) ? "oferta" : /\b(nuevo|nueva|novedad)\b/.test(n) ? "nuevo" : "";
  if (tag) out.push(Object.assign({ id: id() }, VIT_TXT[tag]));
  if (m) out.push(Object.assign({ id: id() }, VIT_TXT.precio, { t: "S/ " + (+num(m[1] || m[2])).toFixed(2) }));
  return out;
}
function vitCardDone(c, txt) { c.done = true; c.el.querySelectorAll("button").forEach((b) => { b.disabled = true; }); if (txt) helpSay(txt.t, txt.o); }
act({
  vlSt: (el) => {
    const c = vitCards[el.dataset.id]; if (!c || c.done) return; const k = el.dataset.v, cur = c.v.st || "clasico";
    if (k === "clasico" && cur === "clasico") c.v.tone = ((+c.v.tone || 0) + 1) % 3; else c.v.st = k;
    const b = c.el.querySelector(".hl-vprev"); if (b) b.innerHTML = vitCardPrev(c.v);
    c.el.querySelectorAll(".vst").forEach((x) => { const on = x.dataset.v === k; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on); });
  },
  vlNo: (el) => { const c = vitCards[el.dataset.id]; if (!c || c.done) return; vitCardDone(c, { t: "Listo, no la puse." }); },
  vlSi: (el) => {
    const c = vitCards[el.dataset.id]; if (!c || c.done) return;
    need("ajustes", () => {
      const L = vitList(), v = c.v;
      if (L.length >= VIT_MAX) return void helpSay(`Ya tienes ${VIT_MAX} vitrinas. Borra alguna en Ajustes › Pantalla de venta y vuelve a intentarlo.`, { go: ["aj.venta"] });
      if (v.kind === "ia" && L.filter((x) => x.kind !== "tpl").length >= VIT_MAX_IMG) return void helpSay(`Ya tienes ${VIT_MAX_IMG} imágenes (pesan). Borra alguna en Ajustes › Pantalla de venta.`, { go: ["aj.venta"] });
      const n = Object.assign({ id: vitId(), on: true }, v); delete n.cobrar; L.push(n);
      // Cobrar ese precio en la caja: precio de oferta del producto hasta la misma fecha del afiche.
      const pc = vitCobrable(v), ck = c.el.querySelector("[data-vco]"); let cobro = "";
      if (pc && ck && ck.checked) { if (can("precios")) { pc.oferta = { p: r2(+v.price), hasta: v.h || "" }; log("Precio de oferta", `${pc.name}: ${money(v.price)}${v.h ? " hasta " + dmy(v.h) : ""} (Luis)`); cobro = ` La caja ya cobra ${pc.name} a ${money(v.price)}${v.h ? ` hasta el ${dmy(v.h).slice(0, 5)}` : ""}.`; } else cobro = " El precio de la caja no lo cambié: tu usuario no tiene permiso de precios."; }
      ui.vsi = vitActive().findIndex((x) => x.id === n.id); save(); log("Vitrina", (v.kind === "ia" ? "Dibujo con IA" : vitName(n)) + " (Luis)");
      if (ui.tab === "venta") paintSale();
      const otra = DB.cfg.view !== "vit";
      vitCardDone(c, { t: (otra ? "Listo, ya está guardada. Tu pantalla de venta no está en modo Vitrina; actívalo para verla." : `Listo, ya está en tu vitrina.${vitActive().length > 1 ? ` Se turna con las demás cada ${+DB.cfg.vitRot || 8} segundos.` : ""}`) + cobro, o: otra ? { node: vitVerBtn() } : {} });
    }, "Cambiar la vitrina");
  },
  vlVer: () => { DB.cfg.view = "vit"; save(); helpClose(); go("venta"); }
});
function vitVerBtn() { const w = document.createElement("div"); w.className = "hl-go"; w.innerHTML = `<button type="button" class="hl-gob" data-a="vlVer">Activar la Vitrina y verla</button>`; return w; }

/* ---------- Afiches: estilos (a mano, súper, pizarra, encarte, verde y fechas), combos, lista de precios e ideas de Luis.
   Todo se dibuja con CSS (sin imágenes ni librerías), así pesa poco y se ve nítido en cualquier pantalla. ---------- */
const VIT_ST = [["clasico", "Clásico"], ["mano", "A mano"], ["super", "Súper"], ["pizarra", "Pizarra"], ["encarte", "Encarte"], ["verde", "Verde"], ["patrias", "Fiestas Patrias"], ["navidad", "Navidad"], ["mama", "Día de la Madre"]];
const VIT_ST_N = Object.fromEntries(VIT_ST);
// Estilo con el que empieza cada tipo cuando no se pide uno (se cambia con un toque)
const VIT_ST_DEF = { oferta: "super", precio: "super", nuevo: "verde", destacado: "verde", combo: "encarte", lista: "pizarra", aviso: "pizarra" };
const vitSplit = (n) => { const [e, c] = (+n || 0).toFixed(2).split("."); return { e, c }; };
// «2x1» → «Llevas 2, pagas 1»
const vitPromoSub = (pr) => { const m = String(pr || "").match(/^(\d+)\s*x\s*(\d+)$/i); return m ? `Llevas ${m[1]}, pagas ${m[2]}` : ""; };
// Lo que muestra el afiche, igual para todos los estilos.
function vitTplData(v) {
  const p = !["aviso", "lista"].includes(v.tpl) && v.pid ? prod(v.pid) : null, d = vitTplPrice(v, p), kg = !!(p && p.unit === "kg");
  const name = v.title || (p ? p.name : v.tpl === "aviso" ? "Escribe tu aviso" : v.tpl === "lista" ? "Precios de hoy" : "Elige un producto");
  const sub = v.sub || (v.tpl === "combo" ? vitPromoSub(v.promo) : "") || (v.h ? `Hasta el ${dmy(v.h).slice(0, 5)}` : "");
  const rows = v.tpl === "lista" ? (v.rows || []).slice(0, 8).map((r) => { const q = r.pid ? prod(r.pid) : null; return { name: r.name || (q ? q.name : ""), pr: +r.price || (q ? ofertaOf(q) || +q.price || 0 : 0), kg: !!(q && q.unit === "kg") }; }).filter((r) => r.name && r.pr > 0) : null;
  const tag = VIT_TAG[v.tpl] || "";
  return { p, d, kg, name, sub, rows, promo: v.tpl === "combo" ? String(v.promo || "").trim() : "", tag: norm(tag).replace(/[¡!]/g, "") === norm(name).replace(/[¡!]/g, "") ? "" : tag };
}
const vitPriceHtml = (pr, kg, cls = "vs-pr") => { const { e, c } = vitSplit(pr); return `<span class="${cls} num"><small>S/</small>${e}<sup><i>.</i>${c}</sup>${kg ? "<em>kilo</em>" : ""}</span>`; };
const vitRowsHtml = (rows, cls) => `<div class="${cls}">${rows.map((r) => `<div><span>${esc(r.name)}</span><i></i><b class="num">S/ ${r.pr.toFixed(2)}${r.kg ? "<small> kg</small>" : ""}</b></div>`).join("")}</div>`;
// Estilos nuevos: un solo armado; cada estilo lo acomoda con su CSS (bloque «Afiches: estilos» de style.css).
function vitStHtml(v) {
  const D = vitTplData(v), st = VIT_ST_N[v.st] ? v.st : "mano";
  const img = D.p && imgSrc(D.p) ? `<div class="vs-im k-${imgKind(D.p)}">${pimg(D.p, "vs-pim")}</div>` : "";
  const tag = st === "mano" && D.tag ? `¡${D.tag.replace(/[¡!]/g, "")}!` : D.tag;
  const big = v.tpl === "aviso" || v.tpl === "lista" ? "" : D.promo ? `<span class="vs-pr vs-promo">${esc(D.promo)}</span>` : D.d.pr > 0 ? vitPriceHtml(D.d.pr, D.kg) : "";
  const old = D.d.old && !["combo", "lista", "aviso"].includes(v.tpl) ? `<span class="vs-old">Antes <s>S/ ${D.d.old.toFixed(2)}</s></span>` : "";
  const n = D.name.length;
  return `<div class="vs s-${st} t-${esc(v.tpl || "oferta")}${img ? "" : " noimg"}${n > 14 ? " lg" : ""}${n > 30 ? " xl" : ""}"><div class="vs-w"><i class="vs-dec" aria-hidden="true"></i>${tag ? `<span class="vs-tg">${esc(tag)}</span>` : ""}<b class="vs-nm">${esc(D.name)}</b>${img}${D.rows ? vitRowsHtml(D.rows, "vs-rows") : ""}${big || old ? `<div class="vs-pz">${old}${big}</div>` : ""}${D.sub ? `<span class="vs-sb">${esc(D.sub)}</span>` : ""}<span class="vs-biz">${esc(DB.biz.name || "")}</span></div></div>`;
}
// Tira de estilos para elegir (en el chat de Luis y en Ajustes): cada uno se ve en chiquito con el mismo contenido.
function vitStStrip(v, a, id) {
  const cur = VIT_ST_N[v.st] ? v.st : "clasico";
  return `<div class="vsts" role="group" aria-label="Estilo del afiche">${VIT_ST.map(([k, nm]) => `<button type="button" class="vst${cur === k ? " on" : ""}" data-a="${a}" ${id ? `data-id="${id}" ` : `data-k="st" `}data-v="${k}" aria-pressed="${cur === k}"><span class="vst-b">${vitTplHtml(Object.assign({}, v, { st: k }))}</span><small>${nm}</small></button>`).join("")}</div>`;
}

/* ---------- Luis entiende estilos, combos y listas ---------- */
const VIT_ST_RX = [["mano", /\b(a mano|plumon|cartulina|fosforescente)\b/], ["super", /\b(?:estilo|tipo|como|de) (?:el |un )?(?:super|supermercado)\b|\betiqueta de super\b/], ["pizarra", /\b(pizarra|tiza|pizarrita)\b/], ["encarte", /\b(encarte|volante|folleto)\b/], ["verde", /\b(?:estilo|en|color|fondo|tipo) verde\b/], ["navidad", /\b(navidad|navideno|navidena|navidenos)\b/], ["patrias", /\b(fiestas patrias|patrio|patria|28 de julio)\b/], ["mama", /\b(dia de la madre|dia de las madres|para mama|para las mamas)\b/], ["clasico", /\b(?:estilo|tipo) clasico\b/]];
const VIT_NUM = { uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6 };
const vitN = (w) => (VIT_NUM[w] != null ? VIT_NUM[w] : +w);
function vitParseStyle(n) { for (const [k, rx] of VIT_ST_RX) { const m = n.match(rx); if (m) return [k, m[0]]; } return null; }
// «2x1», «3x2», «lleva 3 paga 2», «3 panetones por 50 soles» → [texto, trozo a quitar]
function vitParsePromo(n) {
  let m = n.match(/\b([2-9])\s*x\s*([1-8])\b/); if (m && +m[1] > +m[2]) return [`${m[1]}x${m[2]}`, m[0]];
  m = n.match(/\blleva(?:s)? (\d|dos|tres|cuatro|cinco|seis) (?:y )?paga(?:s)? (\d|uno|una|dos|tres|cuatro|cinco)\b/); if (m && vitN(m[1]) > vitN(m[2])) return [`${vitN(m[1])}x${vitN(m[2])}`, m[0]];
  m = n.match(/\b([2-9]|dos|tres|cuatro|cinco|seis)\s+((?:[a-zñ]+\s+){1,3}?)(?:por|x|a)\s+(\d+(?:[.,]\d{1,2})?)\s*(?:soles|sol|lucas)\b/);
  if (m) return [`${vitN(m[1])} x S/ ${(+num(m[3])).toFixed(2).replace(/\.00$/, "")}`, m[0], m[2].trim()];
  return null;
}
// «lista de precios de frutas» o «oferta de papaya 3.50, mango 5 y plátano 2» → filas
function vitParseList(t, n) {
  if (/\blista de precios?\b|\bprecios de (hoy|la semana)\b/.test(n)) {
    const cats = [...new Set(DB.products.map((p) => p.cat).filter(Boolean))];
    const cat = cats.find((c) => n.includes(norm(c))) || cats.find((c) => { const k = norm(c).replace(/s$/, ""); return k.length > 3 && n.includes(k); });
    const top = topIds(), rank = (p) => { const i = top.indexOf(p.id); return i < 0 ? 999 : i; };
    const ps = DB.products.filter((p) => p.on !== false && p.price > 0 && (!cat || p.cat === cat)).sort((a, b) => rank(a) - rank(b) || cmpEs(a.name, b.name)).slice(0, 6);
    return ps.length ? { title: cat ? cat : "Precios de hoy", rows: ps.map((p) => ({ pid: p.id, name: p.name, price: 0 })) } : null;
  }
  const segs = t.split(/,|;|\s+y\s+(?=[a-záéíóúñ])/i).map((s) => s.trim()).filter(Boolean);
  const rows = segs.map((s) => { const k = norm(s), m = k.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:soles|sol)?\s*$/); if (!m) return null; const rest = k.slice(0, m.index).replace(/\b(a|en|por|de)\s*$/, ""), p = vitFindProd(rest); const nm = p ? p.name : rest.split(/\s+/).filter((w) => !VIT_RELLENO.has(w)).join(" "); return nm ? { pid: p ? p.id : "", name: p ? p.name : nm.charAt(0).toUpperCase() + nm.slice(1, 40), price: r2(num(m[1])) } : null; }).filter(Boolean);
  return rows.length >= 2 ? { title: "Ofertas de hoy", rows: rows.slice(0, 8) } : null;
}
const vitIdeasPedido = (n) => (/\b(sugiere(me)?|sugerencias?|ideas?|propon(me|e)?|propuestas?)\b/.test(n) && /\b(ofertas?|promos?|promociones?|vitrina|afiches?|carteles?|descuentos?)\b/.test(n)) || /\bque (ofertas?|promos?|promociones?|descuentos?) (hago|pongo|puedo|me recomiendas|saco)\b/.test(n) || /\bque (puedo|deberia) (ofertar|rematar|poner en oferta)\b/.test(n);

/* ---------- Ideas de Luis: con lo que vence y lo que no se mueve, más la fecha del año ---------- */
const vitR10 = (x) => Math.max(0.1, Math.floor(x * 10 + 1e-6) / 10);
function vitTemporada() {
  const d = new Date(), m = d.getMonth() + 1, dia = d.getDate();
  if ((m === 11 && dia >= 10) || (m === 12 && dia <= 24)) { const p = vitFindProd("paneton"); return { why: "Se viene Navidad: el panetón y el chocolate se venden más estas semanas.", v: p ? { tpl: "destacado", st: "navidad", pid: p.id } : { tpl: "aviso", st: "navidad", title: "¡Feliz Navidad! Panetón y chocolate para tu mesa" } }; }
  if (m === 7 && dia <= 28) return { why: "Se vienen las Fiestas Patrias: un saludo en la vitrina se ve bien.", v: { tpl: "aviso", st: "patrias", title: "¡Felices Fiestas Patrias!" } };
  const mayo = new Date(d.getFullYear(), 4, 1), madre = new Date(d.getFullYear(), 4, 1 + ((7 - mayo.getDay()) % 7) + 7);
  if (d <= madre && (madre - d) / 864e5 <= 14) return { why: "Se viene el Día de la Madre.", v: { tpl: "aviso", st: "mama", title: "¡Feliz día, mamá!" } };
  return null;
}
function vitIdeas() {
  const out = [], used = new Set(), base = { kind: "tpl", tone: 0, title: "", sub: "", h: "", price: 0 };
  expItems(10).filter((p) => daysTo(p.exp) >= 0 && +p.price > 0).slice(0, 2).forEach((p) => {
    const pr = vitR10(p.price * 0.8); if (pr >= p.price) return; used.add(p.id);
    out.push({ why: `${expTxt(p)}${p.stock != null ? ` y te quedan ${fmtQ(p.stock)}${p.unit === "kg" ? " kg" : ""}` : ""}. Te propongo bajarlo un 20% para que salga antes.`, v: Object.assign({}, base, { tpl: "oferta", st: "mano", pid: p.id, price: pr, h: p.exp, cobrar: true }) });
  });
  idleItems(30).filter((x) => !used.has(x.p.id) && +x.p.price > 0).slice(0, 2).forEach(({ p, days, val }) => {
    const pr = vitR10(p.price * 0.88); if (pr >= p.price) return; used.add(p.id);
    const h = new Date(); h.setDate(h.getDate() + 7);
    out.push({ why: `No se vende hace ${days} días y tienes ${money(val)} parados en eso. Una oferta de una semana lo mueve.`, v: Object.assign({}, base, { tpl: "oferta", st: "encarte", pid: p.id, price: pr, h: dkey(h), cobrar: true }) });
  });
  const fx = vitTemporada(); if (fx) out.push({ why: fx.why, v: Object.assign({}, base, fx.v) });
  const top = topIds().map((id) => prod(id)).find((p) => p && p.on !== false && !used.has(p.id));
  if (top && out.length < 4) out.push({ why: "Es lo que más vendes: ponerlo a la vista ayuda a que lo pidan.", v: Object.assign({}, base, { tpl: "destacado", st: "super", pid: top.id }) });
  return out.slice(0, 4);
}

/* ===================== 40 · PRODUCTOS E INVENTARIO ===================== */
const lowItems = () => DB.products.filter((p) => p.stock != null && p.stock <= (p.min || 0)).sort((a, b) => a.stock - b.stock || cmpEs(a.name, b.name));
// Por vencer (hasta n días, ya vencidos incluidos) y sin mover (con stock y sin movimiento hace n días o más).
const daysTo = (d) => Math.round((pk(d) - pk(dkey())) / 864e5);
const expItems = (n = 7) => DB.products.filter((p) => p.exp && (p.stock == null || p.stock > 0) && daysTo(p.exp) <= n).sort((a, b) => a.exp.localeCompare(b.exp) || cmpEs(a.name, b.name));
const expTxt = (p) => { const d = daysTo(p.exp); return d < 0 ? `Vencido hace ${-d} ${d === -1 ? "día" : "días"}` : d === 0 ? "Vence hoy" : d === 1 ? "Vence mañana" : `Vence en ${d} días`; };
let kxLast = { v: -1 };
const idleItems = (n = 30) => {
  if (kxLast.v !== DBV || kxLast.n !== DB.kx.length) { const m = {}; DB.kx.forEach((x) => { if (x.t > (m[x.p] || 0)) m[x.p] = x.t; }); kxLast = { v: DBV, n: DB.kx.length, m }; }
  const last = kxLast.m;
  const lim = Date.now() - n * 864e5;
  return DB.products.filter((p) => p.stock > 0 && last[p.id] && last[p.id] < lim).map((p) => ({ p, days: Math.floor((Date.now() - last[p.id]) / 864e5), val: r2(p.stock * costOf(p)) })).sort((a, b) => b.val - a.val || b.days - a.days);
};
// Pedido por proveedor: agrupa lo que se está acabando según el proveedor de cada producto.
function lowGroups() {
  const g = new Map();
  lowItems().forEach((p) => { const s = p.sup && typeof supp === "function" ? supp(p.sup) : null, k = s ? s.id : ""; if (!g.has(k)) g.set(k, { s, l: [] }); g.get(k).l.push(p); });
  return [...g.values()].sort((a, b) => (a.s ? 0 : 1) - (b.s ? 0 : 1) || (a.s ? cmpEs(a.s.name, b.s.name) : 0));
}
const waNum = (t) => { const d = String(t || "").replace(/\D/g, ""); return d.length >= 9 ? "51" + d.slice(-9) : ""; };
const suggest = (p) => Math.max(1, Math.ceil(Math.max((p.min || 0) * 2 - p.stock, p.min || 1)));
VIEWS.prod = function viewProducts(v) {
  const low = lowItems(), val = r2(DB.products.reduce((a, p) => a + Math.max(0, p.stock || 0) * costOf(p), 0)), nExp = expItems().length, nIdle = idleItems().length;
  const T = [["lista", "Inventario"], ["low", `Por reponer${low.length ? ` (${low.length})` : ""}`], ["exp", `Por vencer${nExp ? ` (${nExp})` : ""}`], ["idle", `Sin mover${nIdle ? ` (${nIdle})` : ""}`], ["kx", "Movimientos (kardex)"]];
  v.innerHTML = `<div class="ph"><h1>Productos</h1><div class="row wrap">
      <button class="btn sec sm" data-a="prodmas">Más</button>${can("precios") ? `<button class="btn sm" data-a="pnew">+ Nuevo producto</button>` : ""}</div></div>
    <div class="seg tabs2">${T.map(([k, l]) => `<button class="${ui.ptab === k ? "on" : ""}" data-a="ptab" data-t="${k}">${l}</button>`).join("")}</div>
    <div id="pbody"></div>`;
  { const on = $(".tabs2 .on"); if (on && on.scrollIntoView) on.scrollIntoView({ inline: "center", block: "nearest" }); }
  if (ui.ptab === "kx") return paintKardex();
  if (ui.ptab === "low") return paintLow();
  if (ui.ptab === "exp") return paintExp();
  if (ui.ptab === "idle") return paintIdle();
  $("#pbody").innerHTML = `<div class="sumrow">${prodSum(low, val)}</div>
    <input class="inp" id="pq" type="search" placeholder="Buscar por nombre, categoría o código (↑ ↓ y Enter)" style="margin-bottom:12px" value="${esc(ui.pq)}">
    <div class="list" id="plist"></div>`;
  paintPList();
};
function prodSum(low, val) {
  low = low || lowItems(); if (val == null) val = r2(DB.products.reduce((a, p) => a + Math.max(0, p.stock || 0) * costOf(p), 0));
  return `<div class="sum"><b>${DB.products.length}</b><span>Productos</span></div><button class="sum lowbtn ${low.length ? "warn" : ""}" data-a="ptab" data-t="low"><b>${low.length}</b><span>Stock bajo · ver</span></button>${can("costos") ? `<div class="sum"><b class="num">${money(val)}</b><span>Inventario al costo</span></div>` : `<div class="sum"><b>${[...new Set(DB.products.map((p) => p.cat).filter(Boolean))].length}</b><span>Categorías</span></div>`}`;
}
// Una fila de la lista de Productos (también se usa para cambiar solo esa fila al guardar).
function pRow(p) {
  const kgp = p.unit === "kg", tag = (p.stock == null ? "" : p.stock <= 0 ? `<span class="tag out">Agotado</span>` : p.stock <= (p.min || 0) ? `<span class="tag low">Stock bajo</span>` : "") + (p.exp && (p.stock == null || p.stock > 0) && daysTo(p.exp) <= 7 ? ` <span class="tag ${daysTo(p.exp) < 0 ? "out" : "low"}">${expTxt(p)}</span>` : "");
  const extra = [p.cat || "Sin categoría", p.code ? "Cód. " + p.code : "", p.on === false ? "Oculto en venta" : ""].filter(Boolean).join(" · ");
  return `<button class="it" data-a="pedit" data-id="${p.id}"><span class="iti" style="--tint:${tintOf(p)}">${pimg(p, "lim")}</span><div class="t"><b>${esc(p.name)}${p.fav ? " ★" : ""}</b><small>${esc(extra)}</small> ${tag}</div><div class="v num">${money(p.price)}${kgp ? " /kg" : ""}<small>${p.stock == null ? "Sin control" : fmtQ(p.stock) + (kgp ? " kg" : " und.")}</small></div></button>`;
}
function paintPList() {
  const el = $("#plist"); if (!el) return;
  if (!DB.products.length) { el.innerHTML = `<div class="empty"><h2>Inventario vacío</h2><p>Agrega tu primer producto, impórtalos desde Excel o carga ejemplos para probar.</p><button class="btn sec" data-a="sample">Cargar ejemplos</button></div>`; return; }
  const q = norm(ui.pq), raw = ui.pq || "";
  // También por códigos de barras aprendidos (p.bar); el código exacto (lo que manda el lector) sale primero.
  const cod = raw.trim(), exact = (p) => !!cod && (p.code === cod || (p.bar || []).includes(cod) || (p.pres || []).some((x) => x.code === cod));
  const list = DB.products.filter((p) => !q || norm(p.name).includes(q) || norm(p.cat).includes(q) || (p.code || "").includes(cod) || (p.bar || []).some((b) => String(b).includes(cod)) || (p.pres || []).some((x) => (x.code || "").includes(cod)))
    .sort((a, b) => (exact(b) - exact(a)) || (q ? nameRank(a.name, q) - nameRank(b.name, q) : 0) || (a.stock != null && a.stock <= (a.min || 0) ? 0 : 1) - (b.stock != null && b.stock <= (b.min || 0) ? 0 : 1) || cmpEs(a.name, b.name));
  el.innerHTML = list.slice(0, 120).map(pRow).join("") + (list.length > 120 ? `<p class="muted">Mostrando 120 de ${list.length}. Busca para encontrar el resto.</p>` : "") || `<div class="empty"><p>Nada coincide con tu búsqueda.</p></div>`;
  // Con algo escrito, el primero queda marcado: Enter lo abre; ↑ ↓ se mueven.
  ui.psel = q ? 0 : -1; pselMark();
}
function pselMark() { const it = document.querySelectorAll("#plist .it"); it.forEach((b, i) => b.classList.toggle("sel", i === ui.psel)); if (it[ui.psel] && ui.psel > 0) it[ui.psel].scrollIntoView({ block: "nearest" }); }

/* ---------- ficha del producto ---------- */
function openProduct(id) {
  const p = id ? prod(id) : null;
  if (p && !can("precios")) return productInfo(p);
  const base = p ? JSON.parse(JSON.stringify(p)) : { id: "", name: "", price: "", cost: "", stock: "", min: 5, cat: ui.cat && !ui.cat.startsWith("__") ? ui.cat : "", code: "", unit: "u", pres: [], recipe: [], igv: true, img: "", fav: false, color: "", on: true };
  base.mq = base.mayor ? base.mayor.q : ""; base.mp = base.mayor ? base.mayor.p : ""; base.sup = base.sup || ""; base.exp = base.exp || ""; base.op = base.oferta ? base.oferta.p : ""; base.oh = base.oferta ? base.oferta.hasta || "" : "";
  ui.pe = { id: id || "", d: base, stock0: p ? p.stock : null };
  ui.peTab = "";
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
  const kg = d.unit === "kg", others = DB.products.filter((x) => x.id !== id).sort((a, b) => cmpEs(a.name, b.name));
  const imgMode = d.img && d.img.startsWith("data:") ? "Tu foto" : d.img && d.img.startsWith("foto:") ? "Foto elegida" : d.img && d.img.startsWith("lib:") ? "Ilustración elegida" : "Automática por nombre";
  // Ficha «precio arriba» (opción 4 elegida por David, 23 oct 2026): adelante lo principal en grande (precio, costo, nombre,
  // categoría, se vende, código y stock); lo demás en 4 botones de arriba que abren su parte (ui.peTab, se recuerda al repintar).
  const tab = ui.peTab || "", hasOfe = !!(d.mq || d.sup || d.exp || d.op), nPres = (d.pres || []).length, nRec = (d.recipe || []).length;
  const OPI = { foto: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3.5"/></svg>', ofe: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/></svg>', pres: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3"/></svg>', rec: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h4"/></svg>' };
  const opb = (k, t, badge) => `<button type="button" class="${tab === k ? "on" : ""}" data-a="petab" data-p="${k}" aria-expanded="${tab === k}">${OPI[k]}<span>${t}</span>${badge ? `<i class="opn">${badge}</i>` : ""}</button>`;
  const opp = (k, t, html) => `<div class="oppanel ${tab === k ? "on" : ""}" data-p="${k}"><div class="ophead"><b>${t}</b><button type="button" class="opx" data-a="petab" data-p="${k}">Cerrar</button></div>${html}</div>`;
  openModal(`<div id="pe" class="pe4"><h2>${id ? "Editar producto" : "Nuevo producto"}</h2>
    <div class="opbar">${opb("foto", "Foto y color")}${opb("ofe", "Oferta y más", hasOfe ? "•" : "")}${opb("pres", "Presentaciones", nPres || "")}${opb("rec", "Receta", nRec || "")}</div>
    ${opp("foto", "Foto y color", `
    <div class="pe-top">
      <div class="pe-img k-${imgKind(d)}" style="--cc:${tintOf(d)}">${pimg(d, "big")}<span class="prc num"><i>S/</i>${num(d.price || 0).toFixed(2)}</span><small>${imgMode}</small></div>
      <div class="pe-imgb"><button class="btn sec sm" data-a="imgpick">Elegir imagen</button><label class="btn sec sm">${svg("cam", "bi")}Tomar foto<input type="file" accept="image/*" capture="environment" data-in="pphoto" hidden></label>${d.img ? `<button class="link" data-a="imgauto">Usar automática</button>` : ""}
        <span class="cl-l">Color de la cartulina del precio</span>
        <div class="colors" role="group" aria-label="Color de la cartulina">${["", ...CARDS].map((c, i) => `<button class="sw ${(d.color || "").toUpperCase() === c ? "on" : ""}" data-a="pcolor" data-c="${c}" style="background:${c || "transparent"}" title="${c ? CARDNAME[i - 1] : "Automático según la categoría"}" aria-label="${c ? CARDNAME[i - 1] : "Automático"}">${c ? "" : "A"}</button>`).join("")}</div></div>
    </div>`)}
    ${opp("ofe", "Oferta y más", `
    <div class="two"><label class="fld"><span>Precio de oferta (S/)</span><input class="inp num" data-f="op" inputmode="decimal" value="${esc(d.op)}" placeholder="Ej: 2.50"></label>
      <label class="fld"><span>Oferta hasta (opcional)</span><input class="inp" type="date" data-f="oh" value="${esc(d.oh)}"></label></div>
    <div class="two"><label class="fld"><span>Precio por mayor: desde${kg ? " (kg)" : " (unidades)"}</span><input class="inp num" data-f="mq" inputmode="decimal" value="${esc(d.mq)}" placeholder="Ej: 12"></label>
      <label class="fld"><span>Cada ${kg ? "kilo" : "una"} cuesta (S/)</span><input class="inp num" data-f="mp" inputmode="decimal" value="${esc(d.mp)}" placeholder="Ej: 0.80"></label></div>
    <div class="two"><label class="fld"><span>Proveedor</span><select class="inp" data-f="sup"><option value="">Sin proveedor</option>${DB.supp.slice().sort((a, b) => cmpEs(a.name, b.name)).map((s) => `<option value="${s.id}" ${s.id === d.sup ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>
      <label class="fld"><span>Fecha de vencimiento</span><input class="inp" type="date" data-f="exp" value="${esc(d.exp)}"></label></div>
    <div class="two"><label class="fld"><span>Avisar si baja de</span><input class="inp num" data-f="min" inputmode="decimal" value="${esc(d.min)}"></label>
      <div class="checks"><label class="ck"><input type="checkbox" data-f="igv" ${d.igv !== false ? "checked" : ""}> Afecto a IGV</label><label class="ck"><input type="checkbox" data-f="fav" ${d.fav ? "checked" : ""}> Favorito (sale primero)</label><label class="ck"><input type="checkbox" data-f="on" ${d.on !== false ? "checked" : ""}> Mostrar en venta</label></div></div>`)}
    ${opp("pres", "Presentaciones", `
      <div class="prows">${(d.pres || []).map((x) => `<div class="prow" data-id="${x.id}"><input class="inp" data-pf="name" value="${esc(x.name)}" placeholder="Paquete x6"><input class="inp num" data-pf="f" inputmode="decimal" value="${esc(x.f || "")}" placeholder="${kg ? "kg" : "Unid."}" title="${kg ? "Kilos" : "Unidades"} que contiene"><input class="inp num" data-pf="price" inputmode="decimal" value="${esc(x.price || "")}" placeholder="Precio"><input class="inp" data-pf="code" value="${esc(x.code || "")}" placeholder="Código"><button class="x" data-a="presdel" data-id="${x.id}" aria-label="Quitar">✕</button></div>`).join("")}</div>
      <button class="btn sec sm" data-a="presadd">+ Agregar presentación</button>`)}
    ${opp("rec", "Receta o insumos", `
      <div class="prows">${(d.recipe || []).map((x, i) => `<div class="rrow"><select class="inp" data-rf="id">${others.map((o) => `<option value="${o.id}" ${o.id === x.id ? "selected" : ""}>${esc(o.name)}${o.unit === "kg" ? " (kg)" : ""}</option>`).join("")}</select><input class="inp num" data-rf="qty" inputmode="decimal" value="${esc(x.qty || "")}" placeholder="Cantidad"><button class="x" data-a="recdel" data-i="${i}" aria-label="Quitar">✕</button></div>`).join("")}</div>
      ${others.length ? `<button class="btn sec sm" data-a="recadd">+ Agregar insumo</button>` : `<p class="muted">Primero crea los insumos como productos.</p>`}`)}
    <div class="pe-main">
    <div class="tiles"><label class="fld"><span>Precio de venta${kg ? " (por kilo)" : ""}</span><input class="inp num" data-f="price" inputmode="decimal" value="${esc(d.price === "" || d.price == null || isNaN(+d.price) ? d.price : num(d.price).toFixed(2))}" placeholder="0.00"></label>
      <label class="fld"><span>Costo${kg ? " (por kilo)" : ""}</span><input class="inp num" data-f="cost" inputmode="decimal" value="${esc(d.cost === "" || d.cost == null || isNaN(+d.cost) ? d.cost : num(d.cost).toFixed(2))}" placeholder="${(d.recipe || []).length ? "De la receta" : "Opcional"}"></label></div>
    <label class="fld"><span>Nombre</span><input class="inp" data-f="name" value="${esc(d.name)}" ${id ? "" : "autofocus"} autocomplete="off" maxlength="60" placeholder="Ej: Tomate italiano"></label>
    <div class="two"><label class="fld"><span>Categoría</span><input class="inp" data-f="cat" list="catlist" value="${esc(d.cat)}" placeholder="Verduras, Bebidas..."><datalist id="catlist">${cats.map((c) => `<option value="${esc(c)}">`).join("")}</datalist></label>
      <div class="fld"><span>Se vende</span><input type="hidden" data-f="unit" value="${kg ? "kg" : "u"}"><div class="useg" role="group" aria-label="Se vende"><button type="button" class="${!kg ? "on" : ""}" data-a="punit" data-v="u" aria-pressed="${!kg}">Por unidad</button><button type="button" class="${kg ? "on" : ""}" data-a="punit" data-v="kg" aria-pressed="${kg}">Por kilo</button></div></div></div>
    <div class="two"><label class="fld"><span>Código de barras</span><span class="codein"><input class="inp" data-f="code" value="${esc(d.code)}" placeholder="Ej: ${nextCode()}" autocomplete="off"><button type="button" class="scanb" data-a="camcode" title="Leer el código con la cámara" aria-label="Leer el código con la cámara">${svg("scan")}</button></span></label>
      <label class="fld"><span>Stock (cuántos hay)${kg ? " en kg" : ""}</span><input class="inp num" data-f="stock" inputmode="decimal" value="${d.stock == null ? "" : esc(d.stock)}" placeholder="Vacío = sin control"></label></div>
    </div>
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
  const mq = String(d.mq ?? "").trim(), mp = String(d.mp ?? "").trim();
  if ((mq || mp) && !(num(mq) >= 2 && num(mp) > 0)) return toast("Precio por mayor: escribe desde cuánto (2 o más) y el precio de cada uno");
  if (mq && num(mp) >= price) return toast("El precio por mayor debe ser menor al precio normal");
  const op = String(d.op ?? "").trim();
  if (op && !(num(op) > 0 && num(op) < price)) return toast("El precio de oferta debe ser menor al precio normal");
  if (d.oh && !op) return toast("Pon el precio de oferta o quita la fecha");
  const oferta = op ? { p: r2(num(op)), hasta: d.oh || "" } : null;
  const mayor = mq ? { q: r3(num(mq)), p: r2(num(mp)) } : null;
  const data = { mayor, oferta, sup: d.sup || "", exp: d.exp || "", name, price, cost: r2(num(d.cost)), min: Math.max(0, r3(num(d.min))), cat: String(d.cat || "").trim(), code, unit: d.unit === "kg" ? "kg" : "u", pres, recipe, igv: !!d.igv, fav: !!d.fav, on: !!d.on, img: d.img || "", color: d.color || "" };
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
    ui.pe = null; save(); closeModal(); toast("Producto guardado");
    const row = id && ui.tab === "prod" && $(`#plist .it[data-id="${id}"]`), sum = $("#pbody .sumrow");
    if (row) {
      // Solo cambia lo que cambió: la foto se queda tal cual (si se vuelve a crear, parpadea un instante).
      const t = document.createElement("template"); t.innerHTML = pRow(p); const nw = t.content.firstElementChild;
      const oi = $(".iti", row), ni = $(".iti", nw);
      if (oi && ni && oi.outerHTML === ni.outerHTML) { ["t", "v"].forEach((c) => { const a = $("." + c, row), b = $("." + c, nw); if (a && b && a.innerHTML !== b.innerHTML) a.innerHTML = b.innerHTML; }); }
      else row.replaceWith(nw);
      if (sum) sum.innerHTML = prodSum(); pselMark();
      const q = $("#pq"); if (q && DESK()) { q.focus(); if (q.value) q.select(); }
    } else render();
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
  const draw = (q) => { const a = fk.filter((k) => ok(q, k)), b = ik.filter((k) => ok(q, k)); return (a.length ? `<p class="igh">Fotos reales</p>` + a.map((k) => cell("foto", k, FB(k))).join("") : "") + (b.length ? `<p class="igh">Ilustraciones</p>` + b.map((k) => cell("lib", k, IB(k))).join("") : "") || `<p class="muted">No hay imágenes con ese nombre. Toma una foto de tu producto.</p>`; };
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
  const sorted = DB.products.slice().sort((a, b) => cmpEs(a.name, b.name));
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
  const G = lowGroups(), sinProv = !DB.supp.length || G.some((g) => !g.s);
  const row = (p) => `<div class="it"><span class="iti" style="--tint:${tintOf(p)}">${pimg(p, "lim")}</span><div class="t"><b>${esc(p.name)}</b><small>Quedan ${fmtQ(p.stock)}${p.unit === "kg" ? " kg" : ""} · mínimo ${fmtQ(p.min || 0)} · pedir ${suggest(p)}${p.unit === "kg" ? " kg" : ""}</small></div>${can("stock") ? `<button class="btn sm" data-a="restock" data-id="${p.id}" data-back="1">Ingreso</button>` : ""}</div>`;
  el.innerHTML = l.length ? `<p class="muted" style="margin-bottom:10px">Productos que llegaron a su mínimo, separados por proveedor. «Pedir» es una sugerencia para cubrir el doble del mínimo.</p>
    ${G.map((g) => `<div class="lgrp"><div class="lgh"><b>${g.s ? esc(g.s.name) : "Sin proveedor"}</b><button class="btn sm" data-a="lowwa" data-s="${g.s ? g.s.id : ""}">${svg("wa", "bi")}${g.s ? "Pedir por WhatsApp" : "Enviar por WhatsApp"}</button></div><div class="list">${g.l.map(row).join("")}</div></div>`).join("")}
    ${sinProv ? `<p class="muted sm" style="margin-top:10px">Elige el proveedor de cada producto en su ficha (Más opciones) para armar un pedido por proveedor.</p>` : ""}
    <div class="row wrap" style="margin-top:12px"><button class="btn sec" data-a="lowprint">${svg("print", "bi")}Imprimir lista</button></div>`
    : `<div class="empty"><img class="eimg" src="${IB("canasta")}" alt=""><h2>Todo en orden</h2><p>Ningún producto está por debajo de su mínimo.</p></div>`;
}

// Una vez al día, al abrir la caja: avisa lo que vence esta semana.
function avisoDia() {
  try {
    if (DB.cfg.avisoDia === dkey()) return;
    const l = expItems(); if (!l.length) return;
    DB.cfg.avisoDia = dkey(); save();
    const n = l.slice(0, 3).map((p) => p.name).join(", ") + (l.length > 3 ? ` y ${l.length - 3} más` : "");
    setTimeout(() => { if (!ui.locked && !modalOpen()) toast(`Por vencer: ${n}. Míralos en Productos`, true); }, 1500);
  } catch (e) {}
}
function paintExp() {
  const l = expItems(), el = $("#pbody");
  el.innerHTML = l.length ? `<p class="muted" style="margin-bottom:10px">Productos vencidos o que vencen en los próximos 7 días. Ponle la fecha en su ficha (Más opciones).</p>
    <div class="list">${l.map((p) => `<button class="it" data-a="pedit" data-id="${p.id}"><span class="iti" style="--tint:${tintOf(p)}">${pimg(p, "lim")}</span><div class="t"><b>${esc(p.name)}</b><small>${dmy(p.exp)}${p.stock != null ? ` · quedan ${fmtQ(p.stock)}${p.unit === "kg" ? " kg" : ""}` : ""}</small></div><span class="tag ${daysTo(p.exp) < 0 ? "out" : "low"}">${expTxt(p)}</span></button>`).join("")}</div>`
    : `<div class="empty"><img class="eimg" src="${IB("canasta")}" alt=""><h2>Nada por vencer</h2><p>${DB.products.some((p) => p.exp) ? "Ningún producto vence esta semana." : "Pon la fecha de vencimiento en la ficha de tus productos (Más opciones) y aquí verás lo que vence pronto."}</p></div>`;
}
function paintIdle() {
  const l = idleItems(), el = $("#pbody"), tot = r2(l.reduce((a, x) => a + x.val, 0));
  el.innerHTML = l.length ? `<p class="muted" style="margin-bottom:10px">Productos con stock que no se mueven hace 30 días o más.${can("costos") ? ` Plata parada al costo: <b class="num">${money(tot)}</b>.` : ""}</p>
    <div class="list">${l.map(({ p, days, val }) => `<button class="it" data-a="pedit" data-id="${p.id}"><span class="iti" style="--tint:${tintOf(p)}">${pimg(p, "lim")}</span><div class="t"><b>${esc(p.name)}</b><small>Sin movimiento hace ${days} días · ${fmtQ(p.stock)}${p.unit === "kg" ? " kg" : " und."}</small></div>${can("costos") && val > 0 ? `<div class="v num">${money(val)}<small>parado</small></div>` : ""}</button>`).join("")}</div>`
    : `<div class="empty"><img class="eimg" src="${IB("canasta")}" alt=""><h2>Todo se mueve</h2><p>Ningún producto con stock lleva 30 días sin venderse ni moverse.</p></div>`;
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
    rows.push({ name, price: r2(price), cost: isNaN(cost) ? null : r2(cost), stock: st == null || isNaN(st) ? null : r3(st), cat: (c[4] || "").trim(), code, unit: /^k/i.test((c[6] || "").trim()) ? "kg" : "u", bar: (c[7] || "").split(/[\s|;,]+/).filter((x) => /^\d{6,}$/.test(x)), ln });
  }
  rows.forEach((r) => { r.ex = DB.products.find((p) => (r.code && p.code === r.code) || norm(p.name) === norm(r.name)) || null; });
  rows = rows.filter((r) => { if (r.code && DB.products.some((p) => p.code === r.code && p !== r.ex)) { res.errs.push(r.ln); return false; } return true; });
  res.rows = rows; res.news = rows.filter((r) => !r.ex).length; res.upd = rows.filter((r) => r.ex).length;
  return res;
}
function openImport() {
  openModal(`<h2>Importar productos</h2>
    <p class="muted" style="margin-bottom:8px">Copia las filas desde Excel y pégalas aquí, o elige un archivo CSV. Columnas en este orden:</p>
    <p style="margin-bottom:10px"><b>Nombre · Precio · Costo · Stock · Categoría · Código · Unidad</b> <span class="muted">(Unidad: u o kg; opcional al final: códigos de barras separados por espacio)</span></p>
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
  const own = new Map(); DB.products.forEach((p) => (p.bar || []).forEach((c) => own.set(c, p)));
  r.rows.forEach((x) => {
    if (x.ex) {
      Object.assign(x.ex, { name: x.name, price: x.price, unit: x.unit }); if (x.cost != null) x.ex.cost = x.cost; if (x.cat) x.ex.cat = x.cat; if (x.code) x.ex.code = x.code;
      if (x.stock != null) { if (x.ex.stock == null) x.ex.stock = 0; stockAdd(x.ex, r3(x.stock - x.ex.stock), "import", "Importación"); }
    } else {
      const p = { id: uid(), name: x.name, price: x.price, cost: x.cost || 0, stock: x.stock == null ? null : 0, min: x.stock == null ? 0 : x.unit === "kg" ? 3 : 5, cat: x.cat, code: x.code, unit: x.unit, pres: [], recipe: [], igv: true, img: "" };
      DB.products.push(p); x.ex = p; if (x.stock) stockAdd(p, x.stock, "import", "Importación");
    }
    // Códigos de barras (columna opcional 8): se suman al producto, salvo los que ya son de otro.
    const t = x.ex; if (t && x.bar.length) { t.bar = t.bar || []; x.bar.forEach((c) => { const o = own.get(c); if ((!o || o === t) && !t.bar.includes(c) && t.code !== c) { t.bar.push(c); own.set(c, t); } }); }
  });
  log("Importación de productos", `${r.news} nuevos, ${r.upd} actualizados`);
  save(); closeModal(); toast(`Importados: ${r.news} nuevos, ${r.upd} actualizados`); render();
}
const exportProducts = () => csvOut([["nombre", "precio", "costo", "stock", "categoria", "codigo", "unidad"], ...DB.products.map((p) => [p.name, p.price, p.cost || 0, p.stock == null ? "" : p.stock, p.cat || "", p.code || "", p.unit === "kg" ? "kg" : "u"])], `productos-${dkey()}.csv`);

/* ---------- transferencias entre tiendas (por archivo) ---------- */
function openTransfer() {
  ui.trf = ui.trf || { to: "", items: [] };
  const t = ui.trf, q = norm(ui.trfq || "");
  const found = q ? DB.products.filter((p) => nameHit(p.name, q) || (p.code || "") === ui.trfq).slice(0, 8) : [];
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
  // Ficha del producto: botones de arriba (abren/cierran su parte sin repintar) y «Por unidad / Por kilo»
  petab: (el) => {
    const k = el.dataset.p; ui.peTab = ui.peTab === k ? "" : k;
    $$("#pe .opbar button").forEach((b) => { const on = b.dataset.p === ui.peTab; b.classList.toggle("on", on); b.setAttribute("aria-expanded", on); });
    $$("#pe .oppanel").forEach((x) => x.classList.toggle("on", x.dataset.p === ui.peTab));
  },
  punit: (el) => { if (!ui.pe) return; readPE(); ui.pe.d.unit = el.dataset.v; paintPE(); },
  ptab: (el) => { if (modalOpen()) closeModal(); ui.ptab = el.dataset.t; if (ui.tab !== "prod") go("prod"); else render(); },
  prodmas: () => openModal(`<h2>Más opciones</h2><div class="fgrid" style="margin:12px 0">${can("precios") ? `<button class="fb" data-a="impopen">Importar</button>` : ""}<button class="fb" data-a="expprod">Exportar</button>${can("stock") ? `<button class="fb" data-a="trfopen">Transferir stock</button>` : ""}</div><div class="btns h"><button class="btn sec" data-a="close">Cerrar</button></div>`),
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
    if (pay && REM) return toast("Pagar desde la caja se hace en la caja de la tienda. Quita esa marca para anotar solo el ingreso.");
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
  lowwa: (el) => {
    const k = (el && el.dataset.s) || "", g = lowGroups().find((x) => (x.s ? x.s.id : "") === k); if (!g) return;
    const txt = `*Pedido - ${DB.biz.name}*\n${g.s ? `Hola ${g.s.name}, necesito:\n` : ""}` + g.l.map((p) => `- ${p.name}: ${suggest(p)}${p.unit === "kg" ? " kg" : ""}`).join("\n");
    window.open(`https://wa.me/${g.s ? waNum(g.s.phone) : ""}?text=` + encodeURIComponent(txt), "_blank", "noopener");
  },
  lowprint: () => printHtml(`<h2>Lista de reposición · ${esc(DB.biz.name)}</h2><p>${fmtDT(Date.now())}</p><table class="tbl"><thead><tr><th>Producto</th><th class="r">Quedan</th><th class="r">Mínimo</th><th class="r">Pedir</th></tr></thead><tbody>${lowItems().map((p) => `<tr><td>${esc(p.name)}</td><td class="r">${fmtQ(p.stock)}</td><td class="r">${fmtQ(p.min || 0)}</td><td class="r"><b>${suggest(p)}</b></td></tr>`).join("")}</tbody></table>`, "rep"),
  impopen: () => need("precios", openImport),
  impok: applyImport,
  tpl: () => csvOut([["nombre", "precio", "costo", "stock", "categoria", "codigo", "unidad"], ["Tomate", "4.50", "3", "30", "Verduras", "1", "kg"], ["Lechuga", "2.50", "1.5", "20", "Verduras", "2", "u"], ["Gaseosa 500 ml", "3", "2.2", "24", "Bebidas", "7750001", "u"]], "plantilla-productos.csv"),
  expprod: () => { closeModal(); if (!DB.products.length) return toast("Aún no hay productos para exportar"); exportProducts(); },
  trfopen: () => need("stock", () => { ui.trf = null; ui.trfq = ""; openTransfer(); }, "Transferir stock"),
  trfadd: (el) => { trfRead(); const t = ui.trf; if (!t.items.some((x) => x.id === el.dataset.id)) t.items.push({ id: el.dataset.id, qty: 1 }); ui.trfq = ""; openTransfer(); },
  trfdel: (el) => { trfRead(); ui.trf.items.splice(+el.dataset.i, 1); openTransfer(); },
  trfok: doTransfer,
  trfcancel: () => { ui.trf = null; ui.trfq = ""; closeModal(); }
});

/* ===================== 50 · CLIENTES: crédito, cuenta corriente, historial y puntos ===================== */
// Ventas y abonos agrupados por cliente en una sola pasada. Antes, la lista de Clientes revisaba todas las ventas una vez por cada cliente.
let cliIdx = { v: -1 };
function cliIndex() {
  if (cliIdx.v === DBV && cliIdx.n === DB.sales.length && cliIdx.m === DB.moves.length) return cliIdx;
  const s = new Map(), a = new Map(), add = (mp, k, x) => { const l = mp.get(k); if (l) l.push(x); else mp.set(k, [x]); };
  DB.sales.forEach((x) => { if (x.client) add(s, x.client, x); });
  DB.moves.forEach((m) => { if (m.type === "abono" && m.client) add(a, m.client, m); });
  cliIdx = { v: DBV, n: DB.sales.length, m: DB.moves.length, s, a }; return cliIdx;
}
const clientSales = (c) => (cliIndex().s.get(c.id) || []).slice();
// Cuenta corriente: cargos (ventas al crédito) y abonos (pagos y devoluciones), con saldo.
function ledgerOf(c) {
  const e = [];
  clientSales(c).forEach((s) => {
    if (s.void) return;
    const cr = paysOf(s).filter((p) => p.m === "credito").reduce((a, p) => a + p.amt, 0);
    if (cr > 0) e.push({ t: s.t, date: s.date, what: `Compra ${docShort(s)}`, cargo: r2(cr), abono: 0, sale: s.id });
    (s.returns || []).forEach((r) => { if (r.m === "credito") e.push({ t: r.t, date: dkey(new Date(r.t)), what: `Devolución ${docShort(s)}`, cargo: 0, abono: r.amount, sale: s.id }); });
  });
  (cliIndex().a.get(c.id) || []).forEach((m) => e.push({ t: m.t, date: m.date, what: `Pago en ${METHODS[m.m] || "efectivo"}${m.note ? " · " + m.note : ""}`, cargo: 0, abono: m.amount, mv: m.id }));
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
  v.innerHTML = `<div class="ph"><h1>Clientes</h1><div class="row wrap">${debtors.length ? `<button class="btn sec sm" data-a="clirem">${svg("wa", "bi")}Recordar deudas</button>` : ""}${can("clientes") ? `<button class="btn sm" data-a="clinewv">+ Nuevo cliente</button>` : ""}</div></div>
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
  list.sort((a, b) => b.a.debt - a.a.debt || cmpEs(a.c.name, b.c.name));
  el.innerHTML = list.slice(0, 300).map(({ c, a }) => { const pts = DB.cfg.pts.on ? pointsOf(c) : 0; return `<button class="it" data-a="cliopen" data-id="${c.id}"><span class="av" style="--h:${avHue(c)}">${esc(initials(c.name))}</span><div class="t"><b>${esc(c.name)}</b><small>${c.doc ? esc(c.dt + " " + c.doc) : "Sin documento"}${c.phone ? " · " + esc(fmtPhone(c.phone)) : ""}${pts ? ` · ${pts} pts` : ""}</small>${a.late ? ` <span class="tag out">Vencido hace ${a.days - c.days} d</span>` : ""}</div><div class="v num ${a.debt > 0 ? "warn" : ""}">${a.debt > 0 ? money(a.debt) : "Al día"}<small>${a.debt > 0 ? "debe" : ""}</small></div></button>`; }).join("") || `<div class="empty"><p>Nadie coincide con ese filtro.</p></div>`;
}
function openClient(id, cb) {
  const c = id ? cli(id) : { name: "", dt: "DNI", doc: "", phone: "", email: "", addr: "", limit: "", days: "", note: "" };
  ui.cecb = cb || null;
  openModal(`<h2>${id ? "Editar cliente" : "Nuevo cliente"}</h2>
    <label class="fld"><span>Nombre o razón social</span><input class="inp" id="ce-name" value="${esc(c.name)}" autofocus maxlength="80" autocomplete="off"></label>
    <div class="two"><label class="fld"><span>Documento</span><select class="inp" id="ce-dt">${["DNI", "RUC", "CE", ""].map((d) => `<option value="${d}" ${c.dt === d ? "selected" : ""}>${d || "Sin documento"}</option>`).join("")}</select></label>
      <label class="fld"><span>Número</span><input class="inp num" id="ce-doc" value="${esc(c.doc)}" inputmode="numeric" maxlength="12" autocomplete="off"></label></div>
    <label class="fld"><span>Celular (WhatsApp)</span><input class="inp num" id="ce-phone" value="${esc(c.phone)}" inputmode="tel" maxlength="15"></label>
    <div class="two"><label class="fld"><span>Límite de crédito S/ (0 = sin límite)</span><input class="inp num" id="ce-limit" value="${esc(c.limit || "")}" inputmode="decimal" placeholder="0"></label>
      <label class="fld"><span>Días para pagar</span><input class="inp num" id="ce-days" value="${esc(c.days || "")}" inputmode="numeric" placeholder="Ej: 15"></label></div>
    <details class="box" ${c.email || c.addr || c.note ? "open" : ""}><summary><b>Más datos</b><small>Correo, dirección (sale en la factura) y nota</small></summary>
    <label class="fld"><span>Correo</span><input class="inp" id="ce-email" value="${esc(c.email || "")}" inputmode="email" maxlength="60"></label>
    <label class="fld"><span>Dirección (sale en la factura)</span><input class="inp" id="ce-addr" value="${esc(c.addr || "")}" maxlength="100"></label>
    <label class="fld"><span>Nota</span><input class="inp" id="ce-note" value="${esc(c.note || "")}" maxlength="80" placeholder="Ej: paga los sábados"></label></details>
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
// «Recordar deudas»: todos los que deben, con un botón de WhatsApp cada uno (marca a quién ya le avisaste hoy).
function openRem() {
  const l = DB.clients.map((c) => ({ c, a: agingOf(c) })).filter((x) => x.a.debt > 0).sort((x, y) => y.a.debt - x.a.debt);
  openModal(`<h2>Recordar deudas</h2><p class="muted" style="margin-bottom:12px">Toca «WhatsApp» y se abre el mensaje ya escrito. Tú solo lo envías.</p>
    <div class="list" id="remlist">${l.map(({ c, a }) => `<div class="it"><span class="av" style="--h:${avHue(c)}">${esc(initials(c.name))}</span><div class="t"><b>${esc(c.name)}</b><small>Debe ${money(a.debt)}${a.days ? ` · hace ${a.days} días` : ""}${c.rem === dkey() ? " · ya le avisaste hoy" : ""}</small></div>${c.phone ? `<button class="btn ${c.rem === dkey() ? "sec " : ""}sm" data-a="cliwa" data-id="${c.id}">${svg("wa", "bi")}WhatsApp</button>` : `<small class="muted">Sin celular</small>`}</div>`).join("")}</div>
    <div class="btns"><button class="btn sec" data-a="remclose">Cerrar</button></div>`, "wide");
}
function openAbono(id) {
  const c = cli(id); if (!c) return; const debt = balanceOf(c);
  ui.ab = { id, m: "efectivo" };
  openModal(`<h2>Cobrar deuda</h2><p class="muted" style="margin-bottom:12px">${esc(c.name)} debe <b>${money(debt)}</b>.</p>
    <label class="fld"><span>Monto que paga (S/)</span><input class="inp num big" id="abq" inputmode="decimal" value="${debt.toFixed(2)}" autofocus></label>
    <div class="methods" id="abm">${["efectivo", "yape", "plin", "bcp", "tarjeta"].map((m) => `<button class="mth ${m === "efectivo" ? "on" : ""}" data-a="abm" data-m="${m}">${METHODS[m]}</button>`).join("")}</div>
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
  cliwa: (el) => {
    const c = cli(el.dataset.id); if (!c) return;
    const a = agingOf(c), desde = a.oldest ? ` desde el ${dmy(a.oldest)}` : "";
    window.open(`https://wa.me/51${c.phone.replace(/\D/g, "").slice(-9)}?text=` + encodeURIComponent(`Hola ${c.name.split(" ")[0]}, te saluda ${DB.biz.name}. Tienes pendiente ${money(a.debt)}${desde}. Cuando puedas, pásate a pagar. ¡Gracias por tu preferencia!`), "_blank", "noopener");
    c.rem = dkey(); save(); if ($("#remlist")) openRem();
  },
  clirem: () => openRem(),
  remclose: () => closeModal(),
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
  openModal(`<div class="qhead"><img class="qimg" src="${IB("dinero")}" alt=""><div><h2>Abrir caja</h2><p class="muted">${esc(me().name)} · ${fmtDT(Date.now())}</p></div></div>
    <label class="fld"><span>¿Con cuánto efectivo empiezas? (sencillo en el cajón)</span><input class="inp num big" id="shopen" inputmode="decimal" placeholder="0.00" autofocus${last && last.d1 === dkey() ? ` value="${last.counted.toFixed(2)}"` : ""}></label>
    ${last ? `<p class="muted" style="margin:-4px 0 12px">${last.d1 === dkey() ? `El turno anterior (${esc(last.un)}) dejó ${money(last.counted)} en el cajón.` : `El último cierre (${esc(last.un)}) contó ${money(last.counted)}.`}</p>` : ""}
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
      <div class="kv"><span>Yape / Plin / BCP / tarjeta</span><b class="num">${money((S.by.yape || 0) + (S.by.plin || 0) + (S.by.bcp || 0) + (S.by.culqi || 0) + (S.by.tarjeta || 0) + (S.by.transferencia || 0))}</b></div>
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
// Tras «Pasar al turno de…»: ¿quién recibe la caja? Sin claves, la abre el mismo usuario con lo contado.
function turnoSigue(sh) {
  if (!needLogin()) return openShift();
  openModal(`<h2>Turno cerrado</h2><p class="muted" style="margin-bottom:14px">${esc(sh.un)} dejó ${money(sh.counted)} en el cajón. ¿Quién recibe la caja?</p>
    <div class="btns h"><button class="btn sec" data-a="shopen">Sigo yo</button><button class="btn" data-a="turnolock">Entra otro cajero</button></div>`);
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
/* Caja «barra de turno» (opción 2 de David, 26 oct 2026): barra del turno arriba, cuánto debe haber en el cajón, 4 botones grandes y cómo te pagaron. */
const CJ_IC = {
  gasto: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6"/>',
  retiro: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 9v6M9 12l3 3 3-3"/>',
  ingreso: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 15V9M9 12l3-3 3 3"/>',
  yape: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  sunset: '<path d="M17 18a5 5 0 0 0-10 0M12 9V2M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1M16 5l-4 4-4-4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  swap: '<path d="M17 3l4 4-4 4"/><path d="M3 7h18"/><path d="M7 21l-4-4 4-4"/><path d="M21 17H3"/>',
  open: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
};
const cjI = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CJ_IC[k]}</svg>`;
// Turno: por la hora en que empezó (mañana antes de la 1 p. m., tarde antes de las 7 p. m., noche) o el que sigue al último que se cerró antes.
const CJ_TN = [["Mañana", "sun", "la mañana"], ["Tarde", "sunset", "la tarde"], ["Noche", "moon", "la noche"]];
const cjHi = (t) => { const h = new Date(t).getHours(); return h < 13 ? 0 : h < 19 ? 1 : 2; };
function cjIdx(shifts) {
  const ix = new Map();
  shifts.forEach((s) => { let i = cjHi(s.t0); shifts.forEach((o) => { if (o !== s && o.t1 && o.t1 <= s.t0 && ix.has(o)) i = Math.max(i, Math.min(2, ix.get(o) + 1)); }); ix.set(s, i); });
  return ix;
}
const cjHora = (h) => `${h % 12 || 12}–${(h + 1) % 12 || 12} ${h < 12 ? "a. m." : "p. m."}`;
// «Cómo te pagaron»: cada medio del que más entró al que menos (tarjetitas con logo, monto, barra, % y ventas); compra promedio, hora fuerte y fiado.
function cajaPagos(k, T, today) {
  const sales = DB.sales.filter((s) => s.date === k && !s.void), cnt = {}, hrs = {};
  sales.forEach((s) => { new Set(paysOf(s).map((p) => p.m)).forEach((m) => { cnt[m] = (cnt[m] || 0) + 1; }); const h = new Date(s.t).getHours(); hrs[h] = (hrs[h] || 0) + s.total; });
  const rows = Object.keys(METHODS).map((m) => ({ m, amt: r2((m === "yape" ? T.yapeAll : T.by[m]) || 0), n: cnt[m] || 0 })).filter((r) => r.amt > 0).sort((a, b) => b.amt - a.amt);
  const sum = rows.reduce((a, r) => a + r.amt, 0), max = rows.length ? rows[0].amt : 0, top = rows.length > 1;
  const hTop = Object.keys(hrs).sort((a, b) => hrs[b] - hrs[a])[0];
  return `<h2 class="cjh">Cómo te pagaron ${today ? "hoy" : "este día"}<b class="num">${money(T.sales)}</b></h2>
    ${rows.length ? `<div class="cjchips" style="--n:${Math.min(rows.length, 5)}">${rows.map((r, i) => `<div class="cjpc${i === 0 && top ? " best" : ""}"><span class="cjpch"><i class="pmi m-${r.m}" aria-hidden="true"></i>${METHODS[r.m]}</span><b class="num">${money(r.amt)}</b><span class="cjbar"><i class="m-${r.m}" style="width:${max ? Math.max(3, (r.amt / max) * 100).toFixed(1) : 0}%"></i></span><small>${Math.round((r.amt / sum) * 100)}%${r.n ? ` · ${r.n} ${r.n === 1 ? "venta" : "ventas"}` : ""}${i === 0 && top ? " · el más usado" : ""}</small>${r.m === "yape" && T.yapeMan ? `<small>${money(T.yapeMan)} anotados a mano</small>` : ""}</div>`).join("")}</div>`
      : `<p class="muted cjvac">Todavía no hay ventas ${today ? "hoy" : "este día"}.</p>`}
    ${T.n ? `<div class="cjmini"><span><b class="num">${money(T.total / T.n)}</b> compra promedio</span><span><b>${hTop !== undefined ? cjHora(+hTop) : "—"}</b> hora fuerte</span><span><b class="num">${money(T.by.credito || 0)}</b> fiado</span></div>` : ""}
    ${T.abonos ? `<div class="kv"><span>Cobros de deudas</span><span class="num">${money(T.abonos)}</span></div>` : ""}${T.ret ? `<div class="kv"><span>Devoluciones</span><span class="num">− ${money(T.ret)}</span></div>` : ""}${T.voids ? `<div class="kv"><span>Ventas anuladas</span><span class="num">${T.voids}</span></div>` : ""}`;
}
// Barra del turno (opción 2 de David, 26 oct 2026): turno actual, Mañana › Tarde › Noche (cada turno se toca para ver su cierre) y a la derecha «Pasar al turno de…» y «Cerrar caja del día».
function cajaBar(shifts, mine, today) {
  const ix = cjIdx(shifts);
  const chip = (s) => { const [tn] = CJ_TN[ix.get(s)], st = s.t1 ? (s.diff === 0 ? " ✓" : s.diff < 0 ? ` · faltó ${money(-s.diff)}` : ` · sobró ${money(s.diff)}`) : ""; return `<button class="cjst${s === mine ? " on" : s.t1 ? " done" : " open"}" data-a="liq" data-id="${s.id}" title="${s.t1 ? "Ver su cierre" : "Caja abierta"}">${tn} · ${esc(s.un)}${st}</button>`; };
  const ni = mine ? Math.max(cjHi(Date.now()), ix.get(mine) + 1) : 0, next = mine && ni <= 2 ? CJ_TN[ni] : null;
  const steps = shifts.map(chip).join('<i aria-hidden="true">›</i>') + (next ? `<i aria-hidden="true">›</i><span class="cjst wait">${next[0]}</span>` : "");
  if (!today) return `<div class="cjbar2 past"><span class="cjbi">${cjI("swap")}</span><div class="cjbt"><b>Cajas del día</b><small>${shifts.length ? "Toca una para ver su cierre" : "Nadie abrió caja este día"}</small></div>${shifts.length ? `<div class="cjsteps">${steps}</div>` : ""}</div>`;
  if (!mine) return `<div class="cjbar2"><span class="cjbi">${cjI("open")}</span><div class="cjbt"><b>Tu caja está cerrada</b><small>${shifts.length ? "Toca un turno para ver su cierre" : "Nadie abrió caja hoy"}</small></div>${shifts.length ? `<div class="cjsteps">${steps}</div>` : ""}<div class="cjbb"><button class="cjgo" data-a="shopen">${cjI("open")}Abrir caja</button></div></div>`;
  const [tn, ic] = CJ_TN[ix.get(mine)], S = shiftSummary(mine);
  return `<div class="cjbar2"><span class="cjbi">${cjI(ic)}</span><div class="cjbt"><b>Turno ${tn.toLowerCase()} · ${esc(mine.un)}</b><small>Desde ${hhmm(mine.t0)} · ${S.n === 1 ? "1 venta" : S.n + " ventas"}</small></div><div class="cjsteps">${steps}</div>
    <div class="cjbb">${next ? `<button class="cjgo" data-a="shturno" data-id="${mine.id}">${cjI("swap")}Pasar al turno de ${next[2]}</button>` : `<button class="cjgo" data-a="shturno" data-id="${mine.id}">${cjI("swap")}Pasar la caja</button>`}<button class="cjend" data-a="shcount" data-id="${mine.id}">${cjI("lock")}Cerrar caja del día</button></div></div>`;
}
VIEWS.caja = function viewCash(v) {
  const k = ui.date, T = dayTotals(k), mine0 = curShift(), today = k === dkey(), puede = can("caja"), hoy = today && puede, mine = puede ? mine0 : null;
  const shifts = DB.shifts.filter((s) => s.d0 === k || (!s.t1 && today)).filter((s, i, a) => a.indexOf(s) === i).sort((a, b) => a.t0 - b.t0);
  const moves = DB.moves.filter((m) => m.date === k).sort((a, b) => b.t - a.t);
  const z = DB.closes.find((x) => x.date === k), MS = mine ? shiftSummary(mine) : null;
  const datebar = `<div class="datebar"><button data-a="dstep" data-d="-1" aria-label="Día anterior">‹</button><label><span>${esc(fmtDate(k))}${!today ? ` · ${dmy(k)}` : ""}</span><input type="date" value="${k}" max="${dkey()}" data-in="date" aria-label="Elegir fecha"></label><button data-a="dstep" data-d="1" aria-label="Día siguiente" ${today ? "disabled" : ""}>›</button></div>`;
  const ln = (t, a, neg) => `<div><span>${t}</span><b class="num${neg ? " neg" : ""}">${money(a)}</b></div>`;
  const cash = !hoy ? "" : mine
    ? `<div class="card cjcash"><small>En el cajón debe haber</small><div class="cjm num">${money(MS.expected)}</div>
      <div class="cjhow">${ln(`Empezaste con <button class="link xs" data-a="shopenedit" data-id="${mine.id}">${mine.open ? "Cambiar" : "Anotar sencillo"}</button>`, mine.open)}${ln("+ Vendiste en efectivo", MS.by.efectivo || 0)}${MS.abonosCash ? ln("+ Te pagaron deudas", MS.abonosCash) : ""}${MS.ingresos ? ln("+ Metiste plata", MS.ingresos) : ""}${MS.gastos ? ln("− Gastos", MS.gastos, 1) : ""}${MS.prov ? ln("− Proveedores", MS.prov, 1) : ""}${MS.retiros ? ln("− Sacaste", MS.retiros, 1) : ""}${MS.devol || MS.anul ? ln("− Devoluciones", MS.devol + MS.anul, 1) : ""}</div></div>`
    : `<div class="card cjcash off"><small>Tu caja está cerrada</small><div class="cjm">Ábrela para empezar a vender</div><p class="muted">Toca «Abrir caja» arriba y pon el sencillo del cajón.</p></div>`;
  const tb = (t, ic, tit, sub, cls, off) => `<button class="cjb ${cls}" data-a="mv" data-t="${t}"${off ? ' disabled title="Primero abre tu caja"' : ""}>${cjI(ic)}<span>${tit}<small>${sub}</small></span></button>`;
  const btns = !hoy ? "" : `<div class="cjacts"><div class="cjg">${tb("gasto", "gasto", "Anotar un gasto", "Bolsas, pasaje, luz…", "c-gas", !mine)}${tb("retiro", "retiro", "Sacar plata", "Guardar o depositar", "c-sac", !mine)}${tb("ingreso", "ingreso", "Meter plata", "Sencillo, cambio", "c-met", !mine)}${tb("yape", "yape", "Anotar Yapes", "Los que no pasaste", "c-yap")}</div>
    ${mine ? `<button class="cjpbar" data-a="liqprint" data-id="${mine.id}">${cjI("print")}Imprimir cómo voy <small>(corte sin cerrar)</small></button>` : ""}</div>`;
  const all = ui.cjAll || moves.length <= 4, ms = all ? moves : moves.slice(0, 3);
  const mvs = `<h2 class="cjh">${today ? "Lo último" : "Movimientos"}${moves.length > 4 ? `<button class="link" data-a="cjall">${ui.cjAll ? "Ver menos" : `Ver todo (${moves.length}) ›`}</button>` : ""}</h2>
    ${moves.length ? ms.map((m) => { const sg = (MOVE[m.type] || [0, 0])[1]; return `<div class="cjmv"><span>${MOVE[m.type] ? MOVE[m.type][0] : m.type}${m.m && m.m !== "efectivo" ? ` (${METHODS[m.m]})` : ""}${m.note ? " · " + esc(m.note) : ""}<small>${hhmm(m.t)}${m.u ? " · " + esc(m.u) : ""}</small></span><span class="num ${sg < 0 ? "neg" : sg > 0 ? "pos" : ""}">${sg < 0 ? "−" : "+"} ${money(m.amount)}${can("cierre") && !["abono", "devolucion", "anulacion"].includes(m.type) && !isLocked(m.date) ? ` <button class="link xs" data-a="mvdel" data-id="${m.id}" aria-label="Borrar movimiento">✕</button>` : ""}</span></div>`; }).join("") : `<p class="muted cjvac">Sin gastos, pagos ni ingresos anotados.</p>`}`;
  const abiertas = shifts.some((s) => !s.t1);
  const cierre = can("cierre") ? `<details class="cjz"${!today ? " open" : ""}><summary><span>Cierre del día (Z) y del mes</span>${z ? `<span class="tag cjok">Z N° ${pad(z.z, 4)}</span>` : ""}</summary>
      <div class="cjzb">${z ? `<p>Cerrado por ${esc(z.un)} a las ${hhmm(z.t)} · Z N° ${pad(z.z, 4)}</p><button class="btn sec" data-a="zprint" data-id="${z.id}">${svg("print", "bi")}Imprimir Z</button>`
        : `<p class="muted">Resume ventas, comprobantes y cajas del día. ${abiertas ? "<b>Primero cierren las cajas abiertas.</b>" : ""}</p><button class="btn" data-a="zclose" ${abiertas || (!T.n && !shifts.length) ? "disabled" : ""}>Hacer cierre del día</button>`}
      <h3>Cerrar el mes</h3><p class="muted sm">Al cerrar un mes, sus ventas ya no se pueden anular ni devolver.</p>${DB.periods.slice(-4).reverse().map((p) => `<div class="kv"><span>${esc(p.label)}</span><span class="num">${money(p.total)} <small class="muted">· ${p.n} ventas</small></span></div>`).join("")}<button class="btn sec sm" data-a="period">Cerrar un mes</button></div></details>` : "";
  const others = shifts.filter((s) => !s.t1 && s !== mine);
  v.innerHTML = `<div class="ph cjph"><h1>Caja</h1>${datebar}</div><div class="cj">
    ${cajaBar(shifts, mine, today)}${others.length && can("cierre") && today ? `<p class="muted sm cjsup">Como supervisor puedes cerrar una caja ajena tocando su turno.</p>` : ""}
    ${hoy ? `<div class="cjmid">${cash}${btns}</div>` : ""}
    <div class="cjbot"><div class="card cjpay">${cajaPagos(k, T, today)}</div><div class="card cjlast">${mvs}${cierre}</div></div></div>`;
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
  shcount: (el) => { ui.cnt = null; ui.turno = false; closeShiftUI(el.dataset.id); },
  // Cambio de turno: el mismo arqueo y, al cerrar, se le pasa la caja al que sigue (con lo contado ya puesto como sencillo).
  shturno: (el) => { ui.cnt = null; ui.turno = true; closeShiftUI(el.dataset.id); },
  turnolock: () => { closeModal(); lockNow(); },
  cjall: () => { ui.cjAll = !ui.cjAll; render(); },
  liq: (el) => {
    const sh = DB.shifts.find((s) => s.id === el.dataset.id); if (!sh) return; ui.turno = false;
    if (!sh.t1 && sh.u !== ui.user) return can("cierre") ? confirmBox(`¿Cerrar la caja de ${sh.un}?`, "Hacer arqueo", () => { ui.cnt = null; closeShiftUI(sh.id); }, false) : toast("Solo un supervisor puede cerrar una caja ajena");
    if (!sh.t1) { ui.cnt = null; return closeShiftUI(sh.id); }
    openModal(`<div class="rcpt">${liqHtml(sh)}</div><div class="btns h"><button class="btn sec" data-a="close">Cerrar</button><button class="btn" data-a="liqprint" data-id="${sh.id}">${svg("print", "bi")}Imprimir</button></div>`);
  },
  liqprint: (el) => { const sh = DB.shifts.find((s) => s.id === el.dataset.id); if (sh) printHtml(liqHtml(sh)); },
  den: (el) => { const c = ui.cnt; if (!c) return; const d = el.dataset.d; c.q[d] = Math.max(0, (c.q[d] || 0) + +el.dataset.v); c.direct = ""; closeShiftUI(c.id); },
  cntcancel: () => { ui.cnt = null; ui.turno = false; closeModal(); },
  shclose: (el) => {
    const sh = DB.shifts.find((s) => s.id === el.dataset.id), c = ui.cnt; if (!sh || !c) return;
    const S = shiftSummary(sh), counted = c.direct !== "" ? r2(num(c.direct)) : countTotal(c.q);
    Object.assign(sh, { t1: Date.now(), d1: dkey(), q: c.q, counted, expected: S.expected, diff: r2(counted - S.expected), note: ($("#cntn") || { value: "" }).value.trim(), by: me().name, sum: S });
    log("Cierre de caja", `${sh.un}: esperado ${money(S.expected)}, contado ${money(counted)}`);
    ui.cnt = null; save(sh.d0); closeModal(); printHtml(liqHtml(sh)); toast(sh.diff === 0 ? "Caja cerrada: cuadra" : sh.diff < 0 ? `Caja cerrada: falta ${money(-sh.diff)}` : `Caja cerrada: sobra ${money(sh.diff)}`, true); render();
    if (ui.turno) { ui.turno = false; turnoSigue(sh); }
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

// Lista «con botones» (opción A de David, 26 oct 2026): resumen, buscador, filtros y en cada fila Pagar (todo), Abonar y Me fiaron.
const PV_COL = ["#0E7490", "#B45309", "#7C3AED", "#15803D", "#BE123C", "#1E4E8C"];
const pvIni = (n) => (String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("") || "?").toUpperCase();
const pvCol = (n) => PV_COL[[...String(n || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % PV_COL.length];
const PV_IC = { pay: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>', abono: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', box: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/>', srch: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>' };
const pvI = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PV_IC[k]}</svg>`;
function pvFilter() {
  const q = norm(ui.psq || ""), f = ui.pf || "all"; let n = 0;
  $$("#pvlist .pvrow").forEach((r) => { const ok = (!q || r.dataset.n.includes(q)) && (f === "all" || (f === "debo" ? r.dataset.b === "1" : r.dataset.b !== "1")); r.hidden = !ok; if (ok) n++; });
  const e = $("#pvnone"); if (e) e.hidden = n > 0;
}
VIEWS.prov = function viewProv(v) {
  if (ui.ps && !supp(ui.ps)) ui.ps = null;
  if (ui.ps) return provDetail(v, supp(ui.ps));
  const list = DB.supp.slice().sort((a, b) => suppBal(b) - suppBal(a) || cmpEs(a.name, b.name));
  const debt = suppTotalDebt(), owing = DB.supp.filter((s) => suppBal(s) > 0).length, mes = dkey().slice(0, 7);
  const hoy = r2(DB.sm.filter((x) => x.type === "pago" && x.date === dkey()).reduce((a, x) => a + x.amt, 0));
  const fiado = r2(DB.sm.filter((x) => x.type === "deuda" && (x.date || "").slice(0, 7) === mes).reduce((a, x) => a + x.amt, 0));
  const f = ui.pf || "all";
  const row = (s) => {
    const b = suppBal(s), last = suppLast(s), sub = [s.phone ? esc(s.phone) : "", s.note ? esc(s.note) : "", last ? "últ. mov. " + dmy(dkeyOf(last)) : ""].filter(Boolean).join(" · ");
    return `<div class="card pvrow" data-n="${esc(norm(s.name + " " + (s.phone || "") + " " + (s.note || "")))}" data-b="${b > 0 ? 1 : 0}">
      <button class="pvopen" data-a="psopen" data-id="${s.id}" aria-label="Ver a ${esc(s.name)}"><span class="pvav" style="background:${pvCol(s.name)}">${esc(pvIni(s.name))}</span><span class="pvnm"><b>${esc(s.name)}</b><small>${sub || "Sin movimientos"}</small></span></button>
      <div class="pvsal"><b class="num ${b > 0 ? "debe" : "cero"}">${b > 0 ? money(b) : b < 0 ? money(-b) : "Sin deuda"}</b><small>${b > 0 ? "le debes" : b < 0 ? "a tu favor" : ""}</small></div>
      <div class="pvacts">${b > 0 ? `<button class="pvb pay" data-a="pspayall" data-id="${s.id}">${pvI("pay")}Pagar</button><button class="pvb abo" data-a="pspay" data-id="${s.id}">${pvI("abono")}Abonar</button>` : ""}<button class="pvb fio" data-a="psdebt" data-id="${s.id}">${pvI("box")}Me fiaron</button></div></div>`;
  };
  v.innerHTML = `<div class="ph"><h1>Proveedores</h1><button class="btn sm" data-a="psnew">${svg("plus", "bi")}Nuevo proveedor</button></div>
    ${list.length ? `<div class="pvsum"><div class="card pvs ${debt > 0 ? "big" : ""}"><small>Debes en total${owing ? ` · ${owing} ${owing === 1 ? "proveedor" : "proveedores"}` : ""}</small><b class="num">${money(debt)}</b></div><div class="card pvs"><small>Pagado hoy</small><b class="num">${money(hoy)}</b></div><div class="card pvs"><small>Te fiaron este mes</small><b class="num">${money(fiado)}</b></div></div>
    <div class="pvtools"><label class="pvq">${pvI("srch")}<input type="search" id="psq" placeholder="Buscar proveedor…" value="${esc(ui.psq || "")}" autocomplete="off" aria-label="Buscar proveedor"></label><div class="pvfl" role="group" aria-label="Mostrar">${[["all", "Todos"], ["debo", "Les debo"], ["cero", "Sin deuda"]].map(([k, t]) => `<button class="${f === k ? "on" : ""}" data-a="pvf" data-f="${k}" aria-pressed="${f === k}">${t}</button>`).join("")}</div></div>
    <div id="pvlist">${list.map(row).join("")}<p class="muted pvnone" id="pvnone" hidden>No hay proveedores así.</p></div>`
      : `<div class="empty"><h2>Aún no tienes proveedores</h2><p>Agrega a quien te surte para anotar lo que le debes y lo que le vas pagando.</p><button class="btn" data-a="psnew">Agregar proveedor</button></div>`}`;
  const q = $("#psq"); if (q) { q.oninput = () => { ui.psq = q.value; pvFilter(); }; pvFilter(); }
};
const dkeyOf = (t) => { const d = new Date(t), p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

// Día de un movimiento como lo dice la gente: «Hoy», «Ayer», «Hace 3 días · jueves 23 de octubre» (hasta 30 días) y luego «lunes 19 de octubre».
const PV_DOW = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
function pvDia(k) {
  const t = dkey(), n = Math.round((pk(t) - pk(k)) / 864e5), d = pk(k), dia = `${PV_DOW[d.getDay()]} ${d.getDate()}`;
  if (n <= 0) return "Hoy";
  if (n === 1) return "Ayer";
  if (n < 31) return `Hace ${n} días · ${dia} de ${MONTHS[d.getMonth()]}`;
  return `${dia} de ${MONTHS[d.getMonth()]}${k.slice(0, 4) !== t.slice(0, 4) ? " de " + k.slice(0, 4) : ""}`;
}
// Detalle del proveedor «conversación» (opción 3 de David, 26 oct 2026): lo que te fió a la izquierda, lo que le pagaste a la derecha,
// separadores «Hoy / Ayer / Hace N días», arriba la deuda fija y abajo Pagar todo / Abonar / Me fiaron fijos. Abre en lo más nuevo (abajo).
const PV_MAX = 60;
const pvEnd = () => requestAnimationFrame(() => { window.scrollTo(0, 1e7); const v = $("#view"); if (v && v.scrollHeight > v.clientHeight) v.scrollTop = 1e7; });
function provDetail(v, s) {
  const b = suppBal(s), rows = DB.sm.filter((x) => x.sid === s.id).sort((x, y) => y.t - x.t);
  let run = b; const withBal = rows.map((x) => { const r = { x, bal: run }; run = r2(run - (x.type === "deuda" ? x.amt : -x.amt)); return r; });
  const fio = r2(rows.filter((x) => x.type === "deuda").reduce((a, x) => a + x.amt, 0)), pago = r2(rows.filter((x) => x.type === "pago").reduce((a, x) => a + x.amt, 0)), ult = rows.find((x) => x.type === "pago");
  const pct = fio > 0 ? Math.min(100, Math.round((pago / fio) * 100)) : 0;
  const all = ui.pvAll === s.id || withBal.length <= PV_MAX, shown = (all ? withBal : withBal.slice(0, PV_MAX)).slice().reverse();
  const nuevo = ui.pvNew; ui.pvNew = null;
  let dAnt = "";
  const chat = shown.map(({ x, bal }) => {
    const pg = x.type === "pago", sep = x.date !== dAnt ? `<div class="pvsep"><span>${pvDia(x.date)}</span></div>` : ""; dAnt = x.date;
    return `${sep}<div class="pvbb ${pg ? "p" : "d"}${x.id === nuevo ? " nuevo" : ""}"><div class="pvbub">
      <div class="pvbh">${pvI(pg ? "pay" : "box")}<span>${pg ? `Le pagaste${x.m ? " con " + (METHODS[x.m] || x.m) : ""}` : "Te fió"}</span><button class="pvdel" data-a="psdel" data-id="${x.id}" aria-label="Borrar este movimiento" title="Borrar">✕</button></div>
      <b class="num">${money(x.amt)}</b>${x.note ? `<p>${esc(x.note)}</p>` : ""}
      <small><span>${hhmm(x.t)}${x.un ? " · " + esc(x.un) : ""}</span><span class="num">${bal > 0 ? "quedó " + money(bal) : bal < 0 ? "a favor " + money(-bal) : "quedó en cero ✓"}</span></small></div></div>`;
  }).join("");
  v.innerHTML = `<button class="link pvback" data-a="psback">‹ Proveedores</button>
    <div class="card pvch"><span class="pvav big" style="background:${pvCol(s.name)}">${esc(pvIni(s.name))}</span>
      <div class="pvchn"><h1>${esc(s.name)}</h1><p>${[s.phone ? esc(s.phone) : "", s.note ? esc(s.note) : ""].filter(Boolean).join(" · ") || "Sin celular ni nota"}</p>
        ${fio > 0 ? `<div class="pvprog" role="img" aria-label="Ya le pagaste ${pct}% de lo que te fió"><i style="width:${pct}%"></i></div><p class="pvpt">Ya le pagaste <b class="num">${money(pago)}</b> de <b class="num">${money(fio)}</b> que te fió${ult ? ` · último pago ${pvDia(ult.date).split(" · ")[0].toLowerCase()}` : ""}</p>` : ""}</div>
      <div class="pvchd ${b > 0 ? "owe" : b < 0 ? "fav" : "ok"}"><small>${b > 0 ? "Le debes" : b < 0 ? "A tu favor" : "No le debes"}</small><b class="num">${b === 0 ? "S/ 0.00 ✓" : money(Math.abs(b))}</b></div>
      <button class="btn sec sm pved" data-a="psedit" data-id="${s.id}" aria-label="Editar proveedor">${svg("edit", "bi")}<span>Editar</span></button></div>
    <div class="card pvchat"><div class="pvleg"><span>← Lo que te fió</span><span>Lo que le pagaste →</span></div>
      ${!all ? `<div class="pvsep"><button class="pvmore" data-a="pvall" data-id="${s.id}">Ver ${withBal.length - PV_MAX} movimientos anteriores</button></div>` : ""}
      ${chat || `<div class="pvvac"><b>Todavía no hay movimientos</b><span>Cuando ${esc(s.name)} te deje mercadería, toca «Me fiaron». Cuando le pagues, toca «Pagar todo» o «Abonar».</span></div>`}</div>
    <div class="pvbar">${b > 0 ? `<button class="pvb pay" data-a="pspayall" data-id="${s.id}">${pvI("pay")}Pagar todo</button><button class="pvb abo" data-a="pspay" data-id="${s.id}">${pvI("abono")}Abonar</button>` : `<button class="pvb abo" data-a="pspay" data-id="${s.id}">${pvI("pay")}Pagar</button>`}<button class="pvb fio" data-a="psdebt" data-id="${s.id}">${pvI("box")}Me fiaron</button></div>`;
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
function suppMoney(kind, id, modo) {
  const s = supp(id); if (!s) return; const b = suppBal(s), todo = modo === "todo" && b > 0;
  ui.sp = { id, kind, m: "efectivo" };
  openModal(`<h2>${kind === "pago" ? (todo ? "Pagar todo" : b > 0 ? "Abonar" : "Pagar") : "Anotar lo que me fiaron"}</h2><p class="muted" style="margin-bottom:12px">${esc(s.name)}${b > 0 ? ` · le debes <b>${money(b)}</b>` : ""}</p>
    <label class="fld"><span>Monto (S/)</span><input class="inp num big" id="spa" inputmode="decimal" placeholder="0.00" autofocus${todo ? ` value="${b.toFixed(2)}"` : ""}></label>
    ${kind === "pago" && b > 0 && !todo ? `<button class="link xs" data-a="spall" data-v="${b.toFixed(2)}" style="margin:-6px 0 10px">Pagar todo: ${money(b)}</button>` : ""}
    ${kind === "pago" ? `<div class="methods" id="spm">${["efectivo", "yape", "plin", "transferencia"].map((m) => `<button class="mth ${m === "efectivo" ? "on" : ""}" data-a="spm" data-m="${m}">${METHODS[m]}</button>`).join("")}</div><p class="muted sm" style="margin:-4px 0 10px">Si es efectivo, sale de la caja.</p>` : ""}
    <label class="fld"><span>Nota (opcional)</span><input class="inp" id="spn" maxlength="50" placeholder="${kind === "pago" ? "Ej: factura 123" : "Ej: gaseosas y arroz"}"></label>
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" data-enter data-a="spok">${kind === "pago" ? "Registrar pago" : "Anotar deuda"}</button></div>`);
  if (todo) setTimeout(() => { const i = $("#spa"); if (i) i.select(); }, 0);
}
act({
  psback: () => { ui.ps = null; render(); },
  psopen: (el) => { ui.ps = el.dataset.id; render(); pvEnd(); },
  pvall: (el) => { ui.pvAll = el.dataset.id; render(); },
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
  pspayall: (el) => suppMoney("pago", el.dataset.id, "todo"),
  pvf: (el) => { ui.pf = el.dataset.f; $$(".pvfl button").forEach((b) => { const on = b === el; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); }); pvFilter(); },
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
    if (ui.ps === s.id) ui.pvNew = e.id;
    ui.sp = null; closeModal(); toast(p.kind === "pago" ? `Pago registrado: ${money(amt)}` : `Anotado: le debes ${money(suppBal(s))}`); render(); if (ui.ps === s.id) pvEnd();
  },
  psdel: (el) => { const x = DB.sm.find((y) => y.id === el.dataset.id); if (!x) return; const s = supp(x.sid);
    need("cierre", () => confirmBox("¿Borrar este movimiento?", "Borrar", () => {
      DB.sm = DB.sm.filter((y) => y !== x);
      if (x.mv) { const m = DB.moves.find((y) => y.id === x.mv); if (m) { DB.moves = DB.moves.filter((y) => y !== m); save(m.date); } }
      log("Movimiento de proveedor borrado", `${s ? s.name : ""} ${money(x.amt)}`); save(); render();
    }, true, x.mv ? "Si fue en efectivo, el dinero vuelve a la caja." : ""));
  }
});

/* ===================== 66 · MANEJAR OTRA CAJA (cambios a distancia) ===================== */
// Desde otro equipo (la laptop del dueño o del proveedor con permiso de soporte) se abre la tienda de una caja
// tal como está en la nube y se usa la caja de siempre: productos, clientes, proveedores, usuarios, ajustes y vitrina.
// Lo que cambia se manda a la tabla «cambios»; la caja de la tienda la revisa cada minuto y los aplica sola.
// Los datos propios de este equipo no se tocan (mientras dura, no se guarda nada aquí) y las ventas,
// la caja y los cobros solo se hacen en la caja de la tienda.
const REM_KEY = "cf-remoto"; // sessionStorage: { neg, sid, name } de la caja que se está manejando
// En un equipo que no es caja (celular del dueño de viaje: «solo ver mis tiendas») se recuerda también en localStorage,
// así al volver a abrir entra directo a manejar su caja (pedido de David, 25 oct 2026).
const REM_FIJO = "cf-remoto-fijo";
const remFijoGet = () => { try { return cloudLoad().ver ? JSON.parse(localStorage.getItem(REM_FIJO) || "null") : null; } catch (e) { return null; } };
const REM_T = ["products", "clients", "supp", "sm", "users"]; // registros que viajan por su clave (como en la nube)
const REM_CFG_NO = { lastBackup: 1, avisoDia: 1, series: 1 }; // ajustes que cambian solos o llevan el correlativo
// Acciones que mueven dinero o datos de toda la tienda: solo en la caja de la tienda.
const REM_NO = { void: 1, ret: 1, retok: 1, dispatch: 1, prevgo: 1, prevvoid: 1, abono: 1, abok: 1, pspay: 1, pspayall: 1, sample: 1, reset: 1, archive: 1, dbcheck: 1, cloudrecover: 1, cloudrec: 1, cloudnew: 1, cloudout: 1, cloudpush: 1, cloudview: 1, sopon: 1, sopoff: 1, lock: 1, codecanje: 1, remgo: 1, remcli: 1, rempick: 1 };
const remState = { busy: false, err: "", sent: [], timer: 0, watch: 0, pull: false };
const remNo = () => toast("Eso se hace en la caja de la tienda. Desde aquí cambias productos, clientes, proveedores, usuarios y ajustes.");

/* ---------- lo que se compara: foto de cómo estaba la última vez que se envió ---------- */
function remCfgDoc() {
  const o = {};
  Object.keys(DB.biz).forEach((k) => { if (k !== "sid") o["biz." + k] = DB.biz[k]; });
  Object.keys(DB.cfg).forEach((k) => {
    if (k === "series") Object.keys(DB.cfg.series || {}).forEach((d) => { o["cfg.series." + d + ".s"] = (DB.cfg.series[d] || {}).s; });
    else if (!REM_CFG_NO[k]) o["cfg." + k] = DB.cfg[k];
  });
  o.roles = DB.roles;
  return o;
}
function remSnap() {
  const base = {}, cfg = new Map(), cd = remCfgDoc();
  REM_T.forEach((t) => { const m = new Map(); cloudEach(t, (x, k) => m.set(k, JSON.stringify(x))); base[t] = m; });
  Object.keys(cd).forEach((p) => cfg.set(p, JSON.stringify(cd[p])));
  return { base, cfg, kxRef: DB.kx[DB.kx.length - 1] || null, logRef: DB.log[DB.log.length - 1] || null };
}
// Lo agregado al final de una lista desde la foto (kardex y bitácora solo crecen).
function remSince(arr, ref) { const i = ref ? arr.lastIndexOf(ref) : -1; return ref && i < 0 ? [] : arr.slice(i + 1); }

// Qué cambió: registros nuevos, borrados o con campos distintos (solo esos campos, para no pisar lo que la caja
// cambió mientras tanto). El stock viaja como «sumar/restar» (kardex), porque la caja sigue vendiendo.
function remDiff() {
  const r = [], kx = remSince(DB.kx, REM.kxRef), lg = remSince(DB.log, REM.logRef), c = {}, cu = [], sum = {};
  kx.forEach((e) => { sum[e.p] = r3((sum[e.p] || 0) + (+e.q || 0)); });
  const kxOut = kx.map((e) => ({ p: e.p, ty: e.ty, q: e.q, r: e.r || "" }));
  REM_T.forEach((t) => {
    const base = REM.base[t], seen = new Set();
    cloudEach(t, (x, k) => {
      seen.add(k); const j = JSON.stringify(x), b = base.get(k);
      if (b === j) return;
      if (b === undefined) { const v = JSON.parse(j); if (t === "products" && v.stock != null) v.stock = r3(v.stock - (sum[v.id] || 0)); r.push({ t, k, op: "add", v }); return; }
      const o = JSON.parse(b), f = {}, un = [];
      new Set([...Object.keys(o), ...Object.keys(x)]).forEach((q) => {
        if (t === "products" && q === "stock") return;
        if (JSON.stringify(o[q]) !== JSON.stringify(x[q])) { if (x[q] === undefined) un.push(q); else f[q] = x[q]; }
      });
      if (t === "products") {
        const a = o.stock, z = x.stock;
        if (z == null && a != null) f.stock = null;
        else if (z != null && a == null) f.stock = r3(z - (sum[x.id] || 0));
        else if (z != null) { const rest = r3(z - a - (sum[x.id] || 0)); if (rest) kxOut.push({ p: x.id, ty: "ajuste", q: rest, r: "Cambio desde otro equipo" }); }
      }
      if (Object.keys(f).length || un.length) r.push({ t, k, op: "set", f, un });
    });
    base.forEach((_, k) => { if (!seen.has(k)) r.push({ t, k, op: "del" }); });
  });
  const cd = remCfgDoc();
  Object.keys(cd).forEach((p) => { if (REM.cfg.get(p) !== JSON.stringify(cd[p])) c[p] = cd[p] === undefined ? null : cd[p]; });
  REM.cfg.forEach((_, p) => { if (!(p in cd)) cu.push(p); });
  return { r, kx: kxOut, log: lg.map((e) => ({ a: e.a, x: e.x, u: e.u })), c, cu, n: r.length + kxOut.length + Object.keys(c).length + cu.length };
}
const REM_NOM = { products: ["producto", "productos"], clients: ["cliente", "clientes"], supp: ["proveedor", "proveedores"], sm: ["deuda de proveedor", "deudas de proveedor"], users: ["usuario", "usuarios"] };
function remResumen(d) {
  const by = {}, partes = [];
  d.r.forEach((x) => { (by[x.t] = by[x.t] || new Set()).add(x.k); });
  const stock = new Set(d.kx.map((e) => e.p).filter((p) => !(by.products && by.products.has(p))));
  REM_T.forEach((t) => { const n = by[t] ? by[t].size : 0; if (n) partes.push(`${n} ${REM_NOM[t][n === 1 ? 0 : 1]}`); });
  if (stock.size) partes.push(`stock de ${stock.size} ${stock.size === 1 ? "producto" : "productos"}`);
  const cfg = Object.keys(d.c).concat(d.cu);
  if (cfg.some((p) => p === "cfg.vits" || p === "cfg.vitRot")) partes.push("vitrina");
  if (cfg.some((p) => p !== "cfg.vits" && p !== "cfg.vitRot")) partes.push("ajustes");
  const precio = d.log.find((e) => e.a === "Cambio de precio");
  return (partes.join(", ") || "cambios") + (precio && d.log.length === 1 ? ` (${precio.x})` : "");
}

/* ---------- aplicar un paquete de cambios (en la caja de la tienda, o al abrir la laptop si aún no llegó) ---------- */
function remSetPath(path, v) {
  const ks = path.split("."); let o = DB;
  for (let i = 0; i < ks.length - 1; i++) { if (!o[ks[i]] || typeof o[ks[i]] !== "object") o[ks[i]] = {}; o = o[ks[i]]; }
  const k = ks[ks.length - 1]; if (v === undefined) delete o[k]; else o[k] = v;
}
function remApply(d, quiet, meta) {
  if (!d) return;
  const idx = {}, mapOf = (t) => idx[t] || (idx[t] = (() => { const m = new Map(); cloudEach(t, (x, k) => m.set(k, x)); return m; })());
  (d.r || []).forEach((c) => {
    const arr = DB[c.t]; if (!Array.isArray(arr) || !REM_NOM[c.t]) return;
    const m = mapOf(c.t), x = m.get(c.k);
    if (c.op === "del") { if (x) { const i = arr.indexOf(x); if (i >= 0) arr.splice(i, 1); m.delete(c.k); } }
    else if (c.op === "add") { if (x) Object.assign(x, c.v); else { const v = Object.assign({}, c.v); arr.push(v); m.set(c.k, v); } }
    else if (c.op === "set" && x) { Object.assign(x, c.f || {}); (c.un || []).forEach((q) => { delete x[q]; }); }
  });
  (d.kx || []).forEach((e) => { const p = prod(e.p); if (p && p.stock != null) stockAdd(p, +e.q || 0, e.ty || "ajuste", (e.r ? e.r + " · " : "") + "desde otro equipo"); });
  Object.keys(d.c || {}).forEach((p) => remSetPath(p, d.c[p]));
  (d.cu || []).forEach((p) => remSetPath(p, undefined));
  if (!DB.users.some((u) => u.on && u.role === "admin")) { const a = DB.users.find((u) => u.role === "admin") || DB.users[0]; if (a) { a.on = true; a.role = "admin"; } }
  if (quiet) return;
  const quien = (meta && meta.autor) || "otro equipo";
  (d.log || []).forEach((e) => DB.log.push({ t: Date.now(), d: dkey(), u: (e.u || "Dueño") + " (a distancia)", a: e.a, x: e.x }));
  log("Cambios desde otro equipo", `${(meta && meta.resumen) || ""} · ${quien}`);
}

/* ---------- en la laptop: abrir, enviar y salir ---------- */
async function remLoad() {
  let o = null; try { o = JSON.parse(sessionStorage.getItem(REM_KEY) || "null"); } catch (e) {}
  if (!o) o = remFijoGet();
  if (!o || !o.neg || !o.sid) return false;
  try {
    const rows = []; let from = 0;
    for (;;) {
      const part = await sb(`registros?select=tipo,id,datos&negocio_id=eq.${o.neg}&tienda=eq.${encodeURIComponent(o.sid)}&borrado=eq.false&order=tipo.asc,id.asc&limit=1000&offset=${from}`);
      rows.push(...part); if (part.length < 1000) break; from += 1000;
    }
    const cfg = rows.find((r) => r.tipo === "config"); if (!cfg) throw new Error("sin tienda");
    const d = Object.assign({}, cfg.datos); CLOUD_TYPES.forEach((t) => { d[t] = []; });
    rows.forEach((r) => { if (r.tipo !== "config" && d[r.tipo]) d[r.tipo].push(r.datos); });
    const pend = await sb(`cambios?select=id,datos,resumen,creado&negocio_id=eq.${o.neg}&tienda=eq.${encodeURIComponent(o.sid)}&aplicado=is.null&order=id.asc`);
    DB = normalize(d); DB.biz.sid = o.sid; DB.tickets = [newTicket(1)]; DB.cur = 0;
    REM = { neg: o.neg, sid: o.sid, name: o.name || DB.biz.name };
    pend.forEach((c) => remApply(c.datos, true));
    remState.sent = pend.map((c) => ({ id: c.id, res: c.resumen, t: Date.parse(c.creado), ok: false }));
    Object.assign(REM, remSnap());
    const a = DB.users.find((u) => u.on && u.role === "admin") || DB.users[0]; ui.user = a.id; ui.tab = "prod";
    return true;
  } catch (e) {
    try { sessionStorage.removeItem(REM_KEY); if (e && e.message === "sin tienda") localStorage.removeItem(REM_FIJO); } catch (er) {}
    REM = null; setTimeout(() => toast("No se pudo abrir esa caja. Revisa tu internet e inténtalo otra vez.", true), 600);
    return false;
  }
}
function remSchedule(ms = 1200) { if (!REM) return; clearTimeout(remState.timer); remState.timer = setTimeout(remSend, ms); }
async function remSend() {
  if (!REM) return;
  if (remState.busy) return remSchedule(1500);
  const d = remDiff(); if (!d.n) { remPaint(); return; }
  const snap = remSnap(), res = remResumen(d); // la foto se toma ya: lo que cambie mientras se envía va en el siguiente
  remState.busy = true; remState.err = ""; remPaint();
  try {
    const row = await sb("cambios", { method: "POST", headers: { Prefer: "return=representation" }, body: { negocio_id: REM.neg, tienda: REM.sid, datos: { r: d.r, kx: d.kx, log: d.log, c: d.c, cu: d.cu }, resumen: res, dispositivo: cloudLoad().dev } });
    Object.assign(REM, snap);
    remState.sent.push({ id: row[0].id, res, t: Date.now(), ok: false });
    remWatchSoon(8000);
  } catch (e) {
    remState.err = navigator.onLine ? "No se pudo enviar. Se reintenta solo." : "Sin internet: tus cambios esperan.";
    remSchedule(10000);
  } finally { remState.busy = false; remPaint(); }
}
// ¿La caja ya los aplicó? Se pregunta seguido mientras falte alguno.
function remWatchSoon(ms) { clearTimeout(remState.watch); remState.watch = setTimeout(remWatch, ms); }
async function remWatch() {
  const ids = remState.sent.filter((x) => !x.ok).map((x) => x.id);
  if (!REM || !ids.length) return;
  try {
    const l = await sb(`cambios?select=id,aplicado&id=in.(${ids.join(",")})`);
    l.forEach((c) => { const x = remState.sent.find((y) => y.id === c.id); if (x && c.aplicado) { x.ok = Date.parse(c.aplicado); } });
    remPaint();
  } catch (e) {}
  if (remState.sent.some((x) => !x.ok)) remWatchSoon(15000);
}
async function remSalir() {
  if (remState.busy) { toast("Enviando tus cambios…"); return setTimeout(remSalir, 1200); }
  if (REM && remDiff().n) { await remSend(); if (remState.err) return toast("Aún no se envían tus cambios. Revisa tu internet antes de salir.", true); }
  try { sessionStorage.removeItem(REM_KEY); localStorage.removeItem(REM_FIJO); } catch (e) {}
  location.reload();
}
function remGo(neg, sid, name) {
  const copia = sid === DB.biz.sid && !cloudLoad().ver;
  confirmBox(`¿Manejar la caja de ${name} desde aquí?`, "Manejar", () => {
    if (copia) { cloud.st.ver = true; cloudStore(); } // este equipo era una copia: deja de ser caja (no sube ni recibe como ella)
    try { sessionStorage.setItem(REM_KEY, JSON.stringify({ neg, sid, name })); if (cloudLoad().ver) localStorage.setItem(REM_FIJO, JSON.stringify({ neg, sid, name })); } catch (e) { return toast("Este navegador no lo permite", true); }
    location.reload();
  }, false, copia ? "Este equipo tiene una copia de esa caja: desde ahora deja de ser caja (no sube ni recibe nada como ella) y solo la maneja a distancia. Lo que tenía guardado no se borra. Hazlo solo en tu celular o laptop, nunca en la caja de la tienda." : "Los datos de este equipo no se tocan. Lo que cambies le llega solo a su caja en un minuto, cuando esté prendida y con internet. Vender y la caja se ven solo allá.");
}
function remPickHtml(neg, tiendas) {
  return `<h2>¿Qué caja quieres manejar?</h2><p class="muted" style="margin-bottom:12px">Cambia sus productos, precios, clientes, proveedores, usuarios, ajustes y vitrina desde aquí.</p>
    <div class="list">${tiendas.map((t) => `<button class="it" data-a="remone" data-n="${esc(neg)}" data-s="${esc(t.tienda)}" data-name="${esc(tiendaNom(t))}"><div class="t"><b>${esc(tiendaNom(t))}</b><small>${t.negocio && t.nombre ? esc(t.nombre) + " · " : ""}Código ${esc(t.tienda)} · última copia ${fmtDT(Date.parse(t.actualizado))}${t.tienda === DB.biz.sid && !cloudLoad().ver ? " · este equipo tiene una copia" : ""}</small></div></button>`).join("")}</div>
    <div class="btns"><button class="btn sec" data-a="close">Cancelar</button></div>`;
}
async function remPick() {
  try {
    const dev = cloudLoad().dev, ver = cloudLoad().ver;
    // La tienda de este equipo no se ofrece… salvo que en la nube la escriba OTRO equipo: entonces este es solo una
    // copia (p. ej. un celular donde se usó «Recuperar una tienda» de la caja de la tienda) y sí se puede manejar.
    const t = (await cloudTiendas()).filter((x) => ver || x.tienda !== DB.biz.sid || (x.dispositivo && x.dispositivo !== dev));
    if (!t.length) return toast("No hay otra caja de tu negocio en la nube");
    openModal(remPickHtml(cloudLoad().neg, t));
  } catch (e) { toast("Sin conexión con la nube", true); }
}
async function remCliente(id) {
  try {
    const t = await sb(`registros?select=tienda,actualizado,nombre:datos->biz->>store,negocio:datos->biz->>name&negocio_id=eq.${id}&tipo=eq.config&borrado=eq.false&order=actualizado.desc`);
    if (!t.length) return toast("Ese cliente aún no tiene cajas en la nube");
    if (t.length === 1) return remGo(id, t[0].tienda, tiendaNom(t[0]));
    openModal(remPickHtml(id, t));
  } catch (e) { toast("No se pudo: el cliente debe darte acceso de soporte", true); }
}

/* ---------- barra «Manejando la caja de…» ---------- */
function remPaint() {
  if (!REM) return;
  let el = $("#rembar");
  if (!el) { el = document.createElement("div"); el.id = "rembar"; el.setAttribute("role", "status"); document.body.appendChild(el); document.documentElement.classList.add("rem"); }
  const falta = remState.sent.filter((x) => !x.ok).length, pend = remDiff().n;
  const st = remState.busy ? ["env", "Enviando tus cambios…"] : remState.err ? ["err", remState.err]
    : falta || pend ? ["esp", `Esperando a su caja · ${falta + (pend ? 1 : 0)} ${falta + (pend ? 1 : 0) === 1 ? "envío" : "envíos"}`]
    : remState.sent.length ? ["ok", "Su caja ya aplicó todo"] : ["ok", "Lo que cambies se envía solo"];
  const html = `<span class="rb-dot ${st[0]}" aria-hidden="true"></span><span class="rb-tx"><b>Manejando: ${esc(REM.name)}</b><small>${esc(st[1])}</small></span><button class="rb-btn" data-a="remver">Ver</button><button class="rb-btn out" data-a="remsalir">Salir</button>`;
  if (el.innerHTML !== html) el.innerHTML = html;
  if (ui.tab === "aj" && ui.atab === "nube" && !modalOpen() && $("#remlist")) $("#remlist").innerHTML = remListHtml();
}
function remListHtml() {
  if (!remState.sent.length) return `<p class="muted">Aún no envías cambios.</p>`;
  return remState.sent.slice().reverse().slice(0, 30).map((x) => `<div class="kv"><span>${esc(x.res)}<small class="muted"> · ${hhmm(x.t)}</small></span><b class="${x.ok ? "" : "muted"}">${x.ok ? "✓ Aplicado " + hhmm(x.ok) : "Esperando a su caja"}</b></div>`).join("");
}
// En Ajustes › Nube mientras se maneja otra caja.
function remSettingsHtml() {
  return `<div class="card"><h2>Manejando: ${esc(REM.name)}</h2><p class="muted" style="margin-bottom:10px">Lo que cambias aquí (productos, precios, stock, clientes, proveedores, usuarios, ajustes y vitrina) se envía solo. Su caja lo aplica en un minuto si está prendida y con internet; si no, cuando se conecte.</p>
    <div class="kv"><span>Código de la caja</span><b>${esc(REM.sid)}</b></div>
    <h3 style="margin:12px 0 6px">Lo que enviaste</h3><div id="remlist">${remListHtml()}</div>
    <p class="muted sm" style="margin-top:10px">Vender, la caja, anular ventas y cobrar deudas se hacen solo en la caja de la tienda.</p>
    <div class="btns h"><button class="btn" data-a="remsalir">Salir y volver a mi caja</button></div></div>`;
}
function remOfrecerHtml() {
  return `<div class="card"><h2>Manejar otra caja</h2><p class="muted" style="margin-bottom:10px">Cambia productos, precios, stock, clientes, usuarios, ajustes y vitrina de otra caja de tu negocio desde este equipo. Su caja recibe los cambios sola en un minuto. Tus datos de aquí no se tocan.</p><button class="btn sec" data-a="rempick">Elegir caja</button></div>`;
}

/* ---------- en la caja de la tienda: recibir y aplicar ---------- */
const REM_OK_KEY = "cf-rem-ok"; // ids ya aplicados aquí: si falla el «aplicado» en la nube, no se aplican dos veces
function remOkList() { try { const l = JSON.parse(localStorage.getItem(REM_OK_KEY) || "[]"); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
async function remPull() {
  if (REM || !cloudOn() || cloudLoad().ver || remState.pull || !navigator.onLine) return;
  remState.pull = true;
  try {
    const s = cloudLoad();
    // Si en la nube esta tienda la escribe OTRO equipo, este es una copia: no recibe (los cambios son para la caja de verdad).
    if (!remState.dueno || Date.now() - remState.dueno.t > 6e5) {
      const c = await sb(`registros?select=dispositivo&negocio_id=eq.${s.neg}&tienda=eq.${encodeURIComponent(DB.biz.sid)}&tipo=eq.config&limit=1`);
      remState.dueno = { t: Date.now(), dev: c[0] && c[0].dispositivo };
    }
    if (remState.dueno.dev && remState.dueno.dev !== s.dev) return;
    const l = await sb(`cambios?select=id,datos,resumen,autor&negocio_id=eq.${s.neg}&tienda=eq.${encodeURIComponent(DB.biz.sid)}&aplicado=is.null&order=id.asc&limit=40`);
    if (!l.length) return;
    const ok = remOkList(), nuevos = l.filter((c) => !ok.includes(c.id));
    if (nuevos.length && modalOpen()) { setTimeout(remPull, 15000); return; } // está cobrando o con una ventana: espera a que termine
    nuevos.forEach((c) => { remApply(c.datos, false, c); ok.push(c.id); });
    if (nuevos.length) {
      try { localStorage.setItem(REM_OK_KEY, JSON.stringify(ok.slice(-400))); } catch (e) {}
      save(); toast(`Cambios del dueño: ${nuevos.map((c) => c.resumen).join(" · ")}`);
      imgRefresh(0); // vuelve a pintar cuando no estés escribiendo
    }
    await sb(`cambios?id=in.(${l.map((c) => c.id).join(",")})`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: { aplicado: new Date().toISOString(), aplicado_por: s.dev } });
  } catch (e) {} finally { remState.pull = false; }
}
function remBoot() {
  if (REM) { remPaint(); remWatchSoon(2000); setInterval(remPaint, 30000); return; }
  setTimeout(remPull, 4000);
  setInterval(remPull, 60000);
  window.addEventListener("online", () => setTimeout(remPull, 2000));
}

act({
  remver: () => { if (modalOpen()) closeModal(); ui.tab = "aj"; ui.atab = "nube"; render(); },
  remsalir: () => remSalir(),
  rempick: () => remPick(),
  // Equipo nuevo (celular del dueño): no se vuelve caja, solo maneja la suya. Si hay una sola tienda va directo.
  remfresh: async () => {
    closeModal(); cloud.st.ver = true; cloudStore(); ui.tab = "aj"; ui.atab = "nube"; render();
    try {
      const t = await cloudTiendas();
      if (!t.length) return toast("Aún no hay cajas de tu negocio en la nube");
      if (t.length === 1) return remGo(cloudLoad().neg, t[0].tienda, tiendaNom(t[0]));
      openModal(remPickHtml(cloudLoad().neg, t));
    } catch (e) { toast("Sin conexión con la nube", true); }
  },
  remcli: (el) => remCliente(el.dataset.id),
  remone: (el) => { closeModal(); remGo(el.dataset.n, el.dataset.s, el.dataset.name); }
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
  // Entrada pedida por el programa de Windows: la sesión no se queda en este navegador, vuelve al programa.
  let desk = 0; try { desk = +localStorage.getItem(DESK_KEY) || 0; } catch (e) {}
  if (desk && Date.now() - desk < 15 * 60e3) {
    try { localStorage.removeItem(DESK_KEY); } catch (e) {}
    const link = "cajafacil://auth" + location.hash;
    history.replaceState(null, "", location.pathname);
    deskReturn(link); return "escritorio";
  }
  const s = cloudLoad();
  s.ses = { at, rt: h.get("refresh_token") || "", exp: Date.now() + (+h.get("expires_in") || 3600) * 1000, user: cloudUserFromJwt(at) };
  cloudStore(); history.replaceState(null, "", location.pathname); return "ok";
}
/* ---------- programa de Windows (desktop/) ---------- */
// Google no deja iniciar sesión dentro de programas de escritorio. El programa abre el navegador normal en
// «#login-escritorio»; aquí se entra con Google y, al volver, se devuelve la sesión al programa con cajafacil://auth#...
const DESK_KEY = "cf-escritorio";
const isDesktopApp = () => /Electron|CajaFacilEscritorio/.test(navigator.userAgent);
function deskReturn(link) {
  const el = document.createElement("div"); el.id = "deskret"; el.setAttribute("role", "dialog");
  el.innerHTML = `<div class="suspc"><b>Listo, ya entraste</b><p>Vuelve al programa <b>Caja Fácil</b> en tu computadora. Si no se abrió solo, toca el botón.</p><a class="btn" href="${link}" style="width:100%">Abrir Caja Fácil</a><p class="muted sm" style="margin-top:10px">Puedes cerrar esta pestaña.</p></div>`;
  document.body.appendChild(el);
  setTimeout(() => { location.href = link; }, 300);
}
// Si el programa ya estaba abierto, recibe la sesión como un cambio de «#» (sin recargar la página): se recarga para que entre.
window.addEventListener("hashchange", () => { if (isDesktopApp() && /(^#|&)access_token=/.test(location.hash)) location.reload(); });
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
  const list = await sb(`negocios?select=id,nombre,estado,soporte_hasta,vence&dueno=eq.${uidMe}&order=creado.asc`);
  if (list.length) { s.neg = list[0].id; s.negName = list[0].nombre; s.estado = list[0].estado; s.sop = list[0].soporte_hasta; s.vence = list[0].vence || null; }
  else { const n = await sb("negocios", { method: "POST", headers: { Prefer: "return=representation" }, body: { nombre: DB.biz.name || "Mi negocio" } }); s.neg = n[0].id; s.negName = n[0].nombre; s.estado = n[0].estado || s.estado; }
  s.chk = Date.now(); cloudStore(); return s.neg;
}

/* ---------- subir cambios ---------- */
// La configuración (con la imagen de la vitrina) se arma de nuevo en cada subida: se recuerda su huella por su texto.
let cloudBig = { s: "", h: "" };
function cloudHashOf(x) { const str = JSON.stringify(x); if (str.length > 20000 && str === cloudBig.s) return cloudBig.h; const h = cloudHash(str); if (str.length > 20000) cloudBig = { s: str, h }; return h; }
function cloudHash(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0; return h.toString(36) + str.length.toString(36); }
// Los movimientos de inventario no tienen id: su clave sale de su contenido (no cambian después de creados), se calcula una vez.
const cloudKeyMemo = new WeakMap();
const cloudKeyOf = (x) => { if (x.id != null) return String(x.id); if (x.no != null) return "n" + x.no; let k = cloudKeyMemo.get(x); if (!k) { k = "h" + cloudHash(JSON.stringify(x)); cloudKeyMemo.set(x, k); } return k; };
// Recorre los registros de un tipo con su clave para la nube. Si dos tienen la misma clave (productos con id repetido,
// movimientos idénticos), el 2.º va como «clave~2»: la nube rechaza TODO un envío que trae dos veces la misma clave
// (pasó el 22 oct 2026: una caja no pudo subir nada desde las 8:15 pm).
function cloudEach(t, fn) {
  const vistos = new Map();
  (DB[t] || []).forEach((x) => { let id = cloudKeyOf(x); const n = (vistos.get(id) || 0) + 1; vistos.set(id, n); if (n > 1) id += "~" + n; fn(x, id); });
}
// Ajustes de la tienda (nombre, comprobantes, usuarios...) van como un solo registro.
const cloudConfigDoc = () => ({ biz: DB.biz, cfg: DB.cfg, roles: DB.roles, users: DB.users, seq: DB.seq, pseq: DB.pseq, zseq: DB.zseq, v: DB.v });
function cloudSnapshot() {
  const out = new Map();
  CLOUD_TYPES.forEach((t) => cloudEach(t, (x, id) => { out.set(t + "|" + id, { tipo: t, id, datos: x }); }));
  out.set("config|tienda", { tipo: "config", id: "tienda", datos: cloudConfigDoc() });
  return out;
}
async function cloudPush(force) {
  if (REM || !cloudOn() || cloud.busy || cloud.st.ver) return; // «solo ver»: este equipo no sube nada
  if (!navigator.onLine) { cloud.err = "Sin internet: se sube solo cuando vuelva la señal."; cloudPaint(); return; }
  cloud.busy = true; cloud.err = "";
  try {
    // Solo se revisan las ventas, movimientos y kardex de los meses que cambiaron desde la última subida
    // (al abrir la caja, si falló una subida o tras recuperar/importar, se revisa todo una vez).
    const s = cloudLoad(), rows = [], hashes = {}, seen = new Set(), full = force || !cloud.dm, dm = cloud.dm || new Set();
    cloud.dm = new Set(); cloud.dmFly = dm; dmSave();
    const put = (tipo, id, datos, k, hv) => { hashes[k] = hv; if (force || s.h[k] !== hv) rows.push({ negocio_id: s.neg, tienda: DB.biz.sid, tipo, id, datos, borrado: false, dispositivo: s.dev }); };
    CLOUD_TYPES.forEach((t) => cloudEach(t, (x, id) => {
      const k = t + "|" + id; seen.add(k);
      if (!full && BIG[t] && s.h[k] && !dm.has(mOf(BIG[t](x)))) { hashes[k] = s.h[k]; return; }
      put(t, id, x, k, cloudHashOf(x));
    }));
    { const k = "config|tienda", d = cloudConfigDoc(); seen.add(k); put("config", "tienda", d, k, cloudHashOf(d)); }
    Object.keys(s.h).forEach((k) => { if (!seen.has(k)) { const [tipo, ...rest] = k.split("|"); rows.push({ negocio_id: s.neg, tienda: DB.biz.sid, tipo, id: rest.join("|"), datos: {}, borrado: true, dispositivo: s.dev }); } });
    cloud.pending = rows.length;
    for (let i = 0; i < rows.length; i += 400) {
      const part = rows.slice(i, i + 400);
      await sb("registros?on_conflict=negocio_id,tienda,tipo,id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: part });
      part.forEach((r) => { const k = r.tipo + "|" + r.id; if (r.borrado) delete s.h[k]; else s.h[k] = hashes[k]; });
      cloud.pending = Math.max(0, rows.length - i - part.length); cloudStore();
    }
    s.last = Date.now(); cloud.pending = 0; cloudStore(); cloud.dmFly = null; dmSave();
  } catch (e) {
    cloud.dm = null; cloud.dmFly = null; dmSave(); // algo no subió: la próxima vez se revisa todo
    cloud.err = /auth/.test(e.message) ? cloud.err || "Vuelve a entrar con Google." : navigator.onLine ? "No se pudo subir. Se reintenta solo." : "Sin internet: se sube solo cuando vuelva la señal.";
  } finally { cloud.busy = false; cloudPaint(); }
}
function cloudSchedule(ms = 5000) { if (REM) return remSchedule(); if (!cloudOn()) return; clearTimeout(cloud.timer); cloud.timer = setTimeout(() => cloudPush(), ms); }

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
  const rows = await sb(`registros?select=tienda,actualizado,dispositivo,nombre:datos->biz->>store,negocio:datos->biz->>name&negocio_id=eq.${s.neg}&tipo=eq.config&borrado=eq.false&order=actualizado.desc`);
  return rows;
}
// Nombre de una tienda en las listas de la nube: el del negocio (todas suelen llamarse «Tienda principal»).
const tiendaNom = (t) => t.negocio || t.nombre || t.tienda;
function openRecover(tiendas) {
  openModal(`<div class="remfresh"><b>¿Estás de viaje o en tu celular?</b><p>Cambia precios, productos, stock y ajustes de tu caja desde aquí. Le llegan solos.</p><button class="btn" data-a="remfresh">Manejar mi caja desde aquí</button></div>
    <h2>Recuperar una tienda</h2><p class="muted" style="margin-bottom:12px">Trae a este equipo todos los datos de una tienda guardada en la nube: productos, ventas, clientes, caja y proveedores.</p>
    <div class="list">${tiendas.map((t) => `<button class="it" data-a="cloudrec" data-s="${esc(t.tienda)}"><div class="t"><b>${esc(tiendaNom(t))}</b><small>${t.negocio && t.nombre ? esc(t.nombre) + " · " : ""}Código ${esc(t.tienda)} · última copia ${fmtDT(Date.parse(t.actualizado))}${t.tienda === DB.biz.sid ? " · este equipo" : ""}</small></div></button>`).join("")}</div>
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
    tiendas.forEach((t) => { by[t.tienda] = { name: tiendaNom(t), act: t.actualizado, n: 0, total: 0, m: {} }; });
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
    const r = await sb(`negocios?select=nombre,estado,soporte_hasta,vence&id=eq.${s.neg}`);
    if (r && r[0]) { s.negName = r[0].nombre; s.estado = r[0].estado; s.sop = r[0].soporte_hasta; s.vence = r[0].vence || null; s.chk = Date.now(); cloudStore(); }
  } catch (e) {}
  try { const v = await sb(`negocios?select=voz&id=eq.${s.neg}`); s.voz = !!(v && v[0] && v[0].voz); cloudStore(); } catch (e) {}
  applySusp(); cloudAvisoVence();
}
async function cloudCheckAdmin() {
  const s = cloudLoad(); if (!s.ses) return;
  try { s.admin = !!(await sb("rpc/soy_admin", { method: "POST", body: {} })); cloudStore(); } catch (e) {}
}
// Licencia: cada caja se activa una vez con la cuenta de Google del dueño. Después vende sin internet
// (los cajeros con su PIN), pero debe revisar su licencia en la nube al menos cada LIC_DIAS días.
const LIC_DIAS = 15;
const diasVence = () => { const s = cloudLoad(); return s.vence ? Math.ceil((Date.parse(s.vence) - Date.now()) / 864e5) : null; };
// Una vez al día, desde 5 días antes: avisa que se acaba el mes pagado.
function cloudAvisoVence() {
  const d = diasVence(); if (d === null || d < 1 || d > 5) return;
  let k = ""; try { k = localStorage.getItem("cf-vence-aviso") || ""; } catch (e) {}
  if (k === dkey()) return;
  try { localStorage.setItem("cf-vence-aviso", dkey()); } catch (e) {}
  toast(`Tu plan vence ${d === 1 ? "mañana" : "en " + d + " días"}. Yapea S/ 150 al 904 623 137 y avísame por WhatsApp.`, true);
}
const WEB_COMPRAR = "https://davidcholan37-afk.github.io/caja-facil/web/comprar/";
function gateState() {
  const s = cloudLoad();
  const viejo = !s.ver && s.chk && Date.now() - s.chk > LIC_DIAS * 864e5;
  if (!s.ses) return !s.neg ? "activar" : viejo ? "sesion" : ""; // si venció la sesión, sigue vendiendo hasta el plazo
  if (!s.neg) return "conectando";
  if (s.estado === "suspendido") return "suspendido";
  if (s.estado === "pendiente") return "pendiente";
  if (s.vence && Date.parse(s.vence) < Date.now()) return "vencido";
  return viejo ? "revisar" : "";
}
function gateHtml(g) {
  const s = cloudLoad(), name = esc(s.negName || DB.biz.name || "tu negocio");
  const err = cloud.err ? `<p class="dpts">${esc(cloud.err)}</p>` : "";
  if (g === "activar") return `<div class="gate-pic" aria-hidden="true"><picture><source media="(max-width: 700px)" srcset="web/img/bodega-cel-800.webp"><img src="web/img/bodega-1280.webp" alt="" width="1280" height="960" decoding="async"></picture><div class="gate-tx"><b>Tu bodega, al céntimo.</b><span>Ventas, caja, fiado y proveedores en una sola pantalla.</span></div></div><div class="gate-form"><img class="gate-logo" src="icon-192.png" width="56" height="56" alt=""><h1>Crea tu cuenta gratis</h1><p class="gate-sub">15 días de prueba gratis. Sin tarjeta.</p>${err}<button class="gbtn" data-a="cloudlogin"><svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>Continuar con Google</button><p class="gate-note">Entra el dueño, una sola vez. Después la caja vende también sin internet y los cajeros usan su PIN.</p><p class="gate-legal">Al entrar aceptas los <a href="terminos.html" target="_blank" rel="noopener">Términos</a> y la <a href="privacidad.html" target="_blank" rel="noopener">Política de privacidad</a>.</p></div>`;
  if (g === "sesion") return `<b>Vuelve a entrar con Google</b><p>Para seguir usando <b>${name}</b>, el dueño debe entrar otra vez con su cuenta de Google. Tus datos están seguros.</p>${err}<button class="btn lg" data-a="cloudlogin" style="width:100%">Entrar con Google</button>`;
  if (g === "conectando") return `<b>Conectando tu caja…</b><p>Estamos activando <b>${name}</b>. Necesitas internet solo para este paso.</p>${err}<div class="btns h"><button class="btn" data-a="gateretry">Reintentar</button><button class="btn sec" data-a="gateout">Usar otra cuenta</button></div>`;
  if (g === "pendiente") return `<b>Activa tu caja</b><p>Escribe el código que te dio tu proveedor al comprar <b>Caja Fácil</b>. Sirve una sola vez.</p><label class="fld"><input class="inp num" id="gcode" placeholder="XXXX-XXXX-XXXX" maxlength="20" autocomplete="off" autocapitalize="characters" style="text-align:center;letter-spacing:.08em"></label>${err}<button class="btn lg" data-a="codecanje" style="width:100%">Activar mi caja</button><p class="muted sm" style="margin-top:12px">¿Aún no tienes código? <a href="${WEB_COMPRAR}" target="_blank" rel="noopener">Compra aquí</a> o <a href="https://wa.me/51904623137?text=${encodeURIComponent("Hola, quiero mi código de Caja Fácil")}" target="_blank" rel="noopener">escríbeme por WhatsApp</a>.</p><button class="link" data-a="suspcheck" style="margin-top:6px">Ya me activaron, volver a revisar</button>`;
  if (g === "vencido") return `<b>Tu plan venció</b><p>El mes de <b>${name}</b> terminó el ${dmy(dkey(new Date(cloudLoad().vence)))}. Tus datos siguen guardados y seguros.</p><p class="muted">Yapea <b>S/ 150</b> al <b>904 623 137</b> (David Cholan Ramos) y avísame por WhatsApp para renovar.</p><a class="btn lg" href="https://wa.me/51904623137?text=${encodeURIComponent("Hola, ya renové Caja Fácil. Te mando mi captura.")}" target="_blank" rel="noopener" style="width:100%">Avisar por WhatsApp</a><button class="link" data-a="suspcheck" style="margin-top:8px">Ya renové, volver a revisar</button>`;
  if (g === "suspendido") return `<b>Sistema suspendido</b><p>La licencia de Caja Fácil de <b>${name}</b> está suspendida. Tus datos siguen guardados y seguros.</p><p class="muted">Comunícate con tu proveedor de Caja Fácil para reactivarla.</p><button class="btn sec" data-a="suspcheck">Ya pagué, volver a revisar</button>`;
  return `<b>Conéctate a internet</b><p>Hace más de ${LIC_DIAS} días que esta caja no revisa su licencia. Conéctala a internet un momento y toca el botón. Tus datos están seguros.</p>${err}<button class="btn" data-a="suspcheck" style="width:100%">Ya tengo internet, revisar</button>`;
}
// Pantalla que bloquea la caja si no está activada, si la licencia está suspendida o si pasó mucho sin revisarla.
function applySusp() {
  const g = gateState();
  let el = $("#susp");
  if (!g) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement("div"); el.id = "susp"; el.setAttribute("role", "alertdialog"); el.setAttribute("aria-modal", "true"); document.body.appendChild(el); }
  const html = `<div class="${g === "activar" ? "gate" : "suspc"}">${gateHtml(g)}</div>`;
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
  return `<div class="card"><h2>Soporte técnico</h2><p class="muted" style="margin-bottom:10px">Si tienes un problema, puedes dejar que tu proveedor de Caja Fácil vea tus ventas, productos y caja, y te ayude a cambiar productos, precios y ajustes, por un tiempo.</p>
    <div class="kv"><span>Acceso de soporte</span><b>${on ? `Activo hasta ${fmtDT(Date.parse(s.sop))}` : "Cerrado"}</b></div>
    <div class="row wrap" style="margin-top:10px">${on ? `<button class="btn red sec" data-a="sopoff">Quitar acceso ahora</button>` : `<button class="btn sec" data-a="sopon" data-h="24">Dar acceso por 24 horas</button><button class="btn sec" data-a="sopon" data-h="168">Por 7 días</button>`}</div></div>`;
}
async function adminLoad() {
  try { cloud.cli = await sb("rpc/admin_negocios", { method: "POST", body: {} }); } catch (e) { cloud.cli = { err: true }; }
  try { const vz = await sb("rpc/admin_voz_lista", { method: "POST", body: {} }); if (Array.isArray(cloud.cli)) cloud.cli.forEach((n) => { const v = vz.find((x) => x.id === n.id); if (v) { n.voz = v.voz; n.voz_limite = v.voz_limite; n.usos_hoy = v.usos_hoy; n.vozOk = true; } }); } catch (e) {}
  if (ui.tab === "aj" && ui.atab === "nube") render();
}
function adminHtml() {
  const c = cloud.cli, me = (cloudLoad().neg || "");
  const body = !c ? `<p class="muted">Toca «Ver clientes» para traer la lista.</p>` : c.err ? `<p class="muted">No se pudo traer la lista. Revisa tu internet.</p>` : !c.length ? `<p class="muted">Aún no tienes clientes.</p>`
    : c.map((n) => { const sop = n.soporte_hasta && Date.parse(n.soporte_hasta) > Date.now(), mine = n.id === me;
      return `<div class="cli"><div class="clit"><b>${esc(n.nombre)}${mine ? " <small class=\"muted\">(tu negocio)</small>" : ""}</b><small>${esc(n.correo || "")} · ${n.tiendas || 0} ${n.tiendas === 1 ? "caja" : "cajas"} · ${n.ultima ? "última copia " + fmtDT(Date.parse(n.ultima)) : "sin copias aún"}</small>
        <small><span class="tag ${n.estado === "suspendido" || n.estado === "pendiente" ? "out" : ""}">${n.estado === "suspendido" ? "Suspendido" : n.estado === "pendiente" ? "Esperando código" : "Activo"}</span> ${n.vence ? `<span class="tag ${Date.parse(n.vence) < Date.now() + 5 * 864e5 ? "out" : ""}">${Date.parse(n.vence) < Date.now() ? "Venció" : "Vence"} ${dmy(dkey(new Date(n.vence)))}</span> ` : ""}${sop ? `<span class="tag">Soporte hasta ${fmtDT(Date.parse(n.soporte_hasta))}</span>` : ""}${n.nota ? " · " + esc(n.nota) : ""}</small>${n.vozOk ? `<small><span class="tag ${n.voz ? "" : "out"}">Voz ${n.voz ? "activa · hoy " + n.usos_hoy + " de " + n.voz_limite : "apagada"}</span></small>` : ""}</div>
        <div class="clia">${mine ? "" : `<button class="btn sec sm" data-a="adminren" data-id="${n.id}">Renovar 1 mes</button>`}${n.vozOk ? `<button class="btn sec sm" data-a="adminvoz" data-id="${n.id}" data-e="${n.voz ? 0 : 1}">${n.voz ? "Quitar voz" : "Dar voz"}</button>` : ""}${sop && !mine ? `<button class="btn sm" data-a="remcli" data-id="${n.id}">Manejar su caja</button>` : ""}${sop || mine ? `<button class="btn sec sm" data-a="adminver" data-id="${n.id}">Ver datos</button>` : `<button class="btn sec sm" disabled title="El cliente debe dar acceso de soporte">Sin permiso</button>`}${mine ? "" : n.estado === "suspendido" || n.estado === "pendiente" ? `<button class="btn sm" data-a="adminest" data-id="${n.id}" data-e="activo">Activar</button>` : `<button class="btn red sec sm" data-a="adminest" data-id="${n.id}" data-e="suspendido">Suspender</button>`}</div></div>`; }).join("");
  return `<div class="card"><div class="row sp"><h2>Mis clientes</h2><button class="btn sec sm" data-a="adminlist">Ver clientes</button></div><div class="row wrap" style="margin-bottom:8px"><button class="btn sm" data-a="admincod">Generar código</button><button class="btn sec sm" data-a="adminacc">Dar acceso por correo</button></div><p class="muted sm" style="margin-bottom:8px">Solo tú ves esto. Para ver o manejar la caja de un cliente, él debe darte acceso en su Ajustes › Nube › Soporte técnico.</p>${body}</div>`;
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
  if (REM) return remSettingsHtml();
  if (!s.ses) return `<div class="card"><h2>Tu negocio en la nube</h2><p class="muted" style="margin-bottom:12px">Entra con tu cuenta de Google y esta caja guardará una copia automática en la nube. Así:</p>
      <div class="kv"><span>Ves las ventas de todas tus tiendas desde tu celular</span></div><div class="kv"><span>Si se malogra la computadora, recuperas todo</span></div><div class="kv"><span>La caja sigue vendiendo sin internet y sube los cambios cuando vuelve la señal</span></div>
      ${cloud.err ? `<p class="dpts" style="margin-top:10px">${esc(cloud.err)}</p>` : ""}
      <button class="btn lg" data-a="cloudlogin" style="margin-top:14px;width:100%">Entrar con Google</button>
      <p class="muted sm" style="margin-top:8px">Solo el dueño entra con Google. Los cajeros siguen usando su PIN. Al entrar aceptas los <a href="terminos.html" target="_blank" rel="noopener">Términos</a> y la <a href="privacidad.html" target="_blank" rel="noopener">Política de privacidad</a>.</p></div>`;
  return `<div class="card"><h2>Tu negocio en la nube</h2>
      <div class="kv"><span>Cuenta</span><b>${esc((s.ses.user || {}).email || "Google")}</b></div>
      <div class="kv"><span>Negocio</span><b>${esc(s.negName || "—")}</b></div>
      <div class="kv"><span>Esta caja</span><b>${esc(DB.biz.store)} <small class="muted">(${esc(DB.biz.sid)})</small></b></div>
      <div class="kv"><span>Copia en la nube</span><b id="cloudst">${cloudStatus()}</b></div>
      ${s.vence ? `<div class="kv"><span>Tu plan</span><b>${diasVence() < 0 ? "Venció" : "Vence"} el ${dmy(dkey(new Date(s.vence)))}</b></div>` : ""}
      <div class="row wrap" style="margin-top:12px">${s.ver ? `<button class="btn" data-a="cloudnew">Usar este equipo como caja</button>` : `<button class="btn" data-a="cloudpush">Subir ahora</button>`}<button class="btn sec" data-a="cloudrecover">Recuperar una tienda</button><button class="btn sec" data-a="cloudout">Cerrar sesión</button></div></div>
    ${remOfrecerHtml()}${s.ver ? "" : soporteHtml()}${s.admin ? adminHtml() : ""}
    <div class="card"><div class="row sp"><h2>Mis tiendas hoy</h2><button class="btn sec sm" data-a="cloudpanel">Ver mis tiendas</button></div>${panelHtml()}</div>
    <p class="muted sm" style="text-align:center">${'<a href="terminos.html" target="_blank" rel="noopener">Términos de uso</a> · <a href="privacidad.html" target="_blank" rel="noopener">Política de privacidad</a>'}</p>`;
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
  adminvoz: async (el) => { const id = el.dataset.id, on = el.dataset.e === "1", n = (cloud.cli || []).find((x) => x.id === id) || {};
    try { await sb("rpc/admin_voz", { method: "POST", body: { neg: id, activa: on, limite: n.voz_limite || 150 } }); toast(on ? `${n.nombre} ya tiene la voz` : `${n.nombre} ya no tiene la voz`); } catch (er) { toast("No se pudo cambiar la voz", true); } adminLoad(); },
  adminest: (el) => { const id = el.dataset.id, e = el.dataset.e, n = (cloud.cli || []).find((x) => x.id === id) || {};
    const go = async () => { try { await sb("rpc/admin_estado", { method: "POST", body: { n: id, e } }); toast(e === "suspendido" ? `${n.nombre} quedó suspendido` : `${n.nombre} está activo otra vez`); } catch (er) { toast("No se pudo cambiar el estado", true); } adminLoad(); };
    if (e === "suspendido") confirmBox(`¿Suspender a ${n.nombre || "este cliente"}?`, "Suspender", go, true, "Su caja se bloquea la próxima vez que se conecte a la nube. Sus datos no se borran."); else go(); },
  suspcheck: async () => { const s = cloudLoad(), t0 = s.chk; await cloudRefreshNeg();
    if (s.estado === "suspendido") toast("Sigue suspendido. Comunícate con tu proveedor.", true);
    else if (gateState() === "vencido") toast("Tu plan sigue vencido. Avísame por WhatsApp cuando yapees.", true);
    else if (gateState() === "pendiente") toast("Tu caja aún espera su código.", true);
    else if (s.chk === t0) toast("No hay conexión con la nube. Revisa tu internet.", true);
    else toast("¡Listo! Tu caja está activa."); },
  codecanje: async () => { const v = (($("#gcode") || {}).value || "").trim();
    if (!v) { toast("Escribe tu código", true); return; }
    try { const ok = await sb("rpc/canjear_codigo", { method: "POST", body: { c: v } });
      if (ok) { await cloudRefreshNeg(); toast("¡Listo! Tu caja está activa."); } else toast("Ese código no sirve o ya se usó. Pídeme uno nuevo.", true);
    } catch (e) { toast("No se pudo revisar el código. Revisa tu internet.", true); } },
  adminren: (el) => { const id = el.dataset.id, n = (cloud.cli || []).find((x) => x.id === id) || {};
    confirmBox(`¿Renovar 1 mes a ${n.nombre || "este cliente"}?`, "Renovar", async () => {
      try { const v = await sb("rpc/admin_renovar", { method: "POST", body: { n: id, meses: 1 } }); toast(`Renovado hasta el ${dmy(dkey(new Date(v)))}`); } catch (e) { toast("No se pudo renovar", true); } adminLoad(); }, false, "Suma 1 mes desde hoy (o desde su vencimiento si aún le quedan días) y deja su caja activa."); },
  admincod: () => promptBox({ title: "Generar código", text: "Crea un código de un solo uso para un cliente que ya pagó.", label: "Para quién (opcional)", ph: "Ej: Minimarket Don Lucho", max: 60, ok: "Generar" }, async (nota) => {
    try { const c = await sb("rpc/admin_codigo_nuevo", { method: "POST", body: { nota_txt: nota } });
      const msg = `Hola, gracias por tu compra de Caja Fácil. Tu código es ${c} (sirve una sola vez). Entra a ${WEB_COMPRAR} , escríbelo en «Ingresar código» y se descarga el programa.`;
      openModal(`<h2>Código listo</h2><p class="muted" style="margin-bottom:10px">${nota ? esc(nota) + " · " : ""}Sirve una sola vez.</p><p class="cfcode num">${esc(c)}</p>
        <div class="btns"><a class="btn" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener" style="text-decoration:none;display:flex;justify-content:center">Enviar por WhatsApp</a><button class="btn sec" data-a="copycod" data-c="${esc(c)}">Copiar código</button><button class="btn sec" data-a="close">Cerrar</button></div>`);
    } catch (e) { toast("No se pudo generar el código", true); } }),
  copycod: (el) => { try { navigator.clipboard.writeText(el.dataset.c); toast("Código copiado"); } catch (e) { toast(el.dataset.c); } },
  adminacc: () => promptBox({ title: "Dar acceso por correo", text: "Para pruebas: cuando esta persona entre con ese correo de Google, su caja se activa sin código.", label: "Correo de Google", ph: "cliente@gmail.com", max: 80, required: "Escribe el correo", ok: "Dar acceso" }, async (mail) => {
    try { const n = await sb("rpc/admin_dar_acceso", { method: "POST", body: { correo_txt: mail } }); toast(n ? "Listo: su caja ya está activa" : "Listo: cuando entre con " + mail + " su caja se activa sola"); adminLoad(); } catch (e) { toast("No se pudo dar el acceso. Revisa el correo.", true); } }),
  gateretry: () => { cloud.err = ""; applySusp(); cloudStart(); },
  gateout: () => { cloudLogout(); cloudLoginGoogle(); },
  cloudview: () => { cloud.st.ver = true; cloudStore(); closeModal(); ui.tab = "aj"; ui.atab = "nube"; render(); cloudPanel(); toast("Este equipo solo mira tus tiendas"); }
});

/* ---------- arranque: sesión que vuelve de Google, subida automática ---------- */
// Meses pendientes de subir, guardados en el equipo: al abrir la caja no hace falta revisar toda la historia otra vez.
// Se guardan los que están por subir y los que se están subiendo; solo se borran cuando la subida termina bien.
const DM_KEY = "cf-cloud-dm";
function dmSave() { try { if (cloud.dm) localStorage.setItem(DM_KEY, JSON.stringify([...new Set([...cloud.dm, ...(cloud.dmFly || [])])])); else localStorage.removeItem(DM_KEY); } catch (e) {} }
function dmLoad() { try { const v = JSON.parse(localStorage.getItem(DM_KEY) || "null"); if (Array.isArray(v)) cloud.dm = new Set(v); } catch (e) {} }
function cloudBoot() {
  dmLoad();
  if (location.hash === "#login-escritorio") { // lo abre el programa de Windows para entrar con Google
    try { localStorage.setItem(DESK_KEY, String(Date.now())); } catch (e) {}
    history.replaceState(null, "", location.pathname); cloudLoginGoogle(); return;
  }
  const r = cloudCatchRedirect();
  if (r === "escritorio") return;
  if (r === "ok") { ui.tab = "aj"; ui.atab = "nube"; render(); toast("Entraste con Google. Conectando tu caja…"); cloudStart(); }
  else if (r === "error") { ui.tab = "aj"; ui.atab = "nube"; render(); toast("No se pudo entrar con Google: " + cloud.err, true); }
  else if (cloudOn()) { const s = cloudLoad(); if (!s.chk) { s.chk = Date.now(); cloudStore(); } cloudSchedule(3000); applySusp(); cloudRefreshNeg(); cloudCheckAdmin(); }
  else if (cloudLoad().ses) { applySusp(); cloudStart(); } // entró con Google pero no terminó de conectar
  else applySusp();
  // Cada vez que la app guarda algo, se programa una subida (agrupa los cambios de varios segundos).
  const _save = save; save = function (...dates) { const out = _save.apply(this, arguments); if (cloud.dm) { cloud.dm.add(mOf()); dates.forEach((d) => d && cloud.dm.add(mOf(d))); dmSave(); } cloudSchedule(); return out; };
  const _saveAll = saveAll; saveAll = function () { cloud.dm = null; dmSave(); return _saveAll.apply(this, arguments); };
  window.addEventListener("online", () => cloudSchedule(1000));
  setInterval(() => { if (cloudOn() && !document.hidden) { cloudPush(); cloudRefreshNeg(); } else applySusp(); }, 120000);
  remBoot(); // cambios hechos desde otro equipo
}

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

/* ---------- Modo rápido: menos adornos para celulares y PC lentos ---------- */
// «cf-lite»: "1" siempre, "0" nunca, sin valor = automático (equipo de 2 núcleos o poca memoria, o la prueba de velocidad de abajo).
// Cada equipo decide por sí mismo: no viaja a la nube ni a otras cajas.
const liteGet = () => { try { return localStorage.getItem("cf-lite"); } catch (e) { return null; } };
function liteApply() {
  const f = liteGet(); let on;
  if (f === "1") on = true; else if (f === "0") on = false;
  else { let a = null; try { a = localStorage.getItem("cf-lite-auto"); } catch (e) {} const n = navigator; on = a === "1" || n.hardwareConcurrency <= 2 || n.deviceMemory <= 2; }
  document.documentElement.classList.toggle("lite", !!on);
}
// Mide cuánto tarda este equipo en una cuenta corta. Se hace una vez (y cada 30 días), con la caja ya lista y sin molestar.
function liteBench(force) {
  if (liteGet() !== null) return;
  try { const t = +localStorage.getItem("cf-lite-auto-t") || 0; if (!force && t && Date.now() - t < 30 * 864e5) return; } catch (e) {}
  const run = () => {
    const t0 = performance.now(); let s = 0;
    for (let i = 0; i < 2e6; i++) s += Math.sqrt(i) * ((i & 7) + 1) % 3;
    const a = []; for (let i = 0; i < 30000; i++) a.push((i * 7919) % 10007); a.sort((x, y) => x - y);
    return performance.now() - t0 + (s < 0 ? 1 : 0);
  };
  const go = () => {
    if (document.hidden) return setTimeout(go, 5000);
    const ms = Math.min(run(), run(), run());
    try { localStorage.setItem("cf-lite-auto", ms > 70 ? "1" : "0"); localStorage.setItem("cf-lite-auto-t", String(Date.now())); } catch (e) {}
    liteApply();
  };
  setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(go, { timeout: 4000 }) : go()), 3000);
}
function liteHtml() {
  const f = liteGet(), m = f === "1" ? "1" : f === "0" ? "0" : "auto", on = document.documentElement.classList.contains("lite");
  return `<div class="card"><h2>Modo rápido</h2><p class="muted" style="margin-bottom:12px">Quita sombras, transparencias y movimientos para que la caja vaya fluida en celulares y computadoras lentas. Ahora está <b>${on ? "encendido" : "apagado"}</b>${m === "auto" ? " (automático según tu equipo)" : ""}.</p>
    <div class="seg tabs2">${[["auto", "Automático"], ["1", "Encendido"], ["0", "Apagado"]].map(([v, l]) => `<button class="${m === v ? "on" : ""}" data-a="liteset" data-v="${v}">${l}</button>`).join("")}</div></div>`;
}
act({
  liteset: (el) => {
    const v = el.dataset.v;
    try { if (v === "auto") { localStorage.removeItem("cf-lite"); localStorage.removeItem("cf-lite-auto"); localStorage.removeItem("cf-lite-auto-t"); } else localStorage.setItem("cf-lite", v); } catch (e) {}
    liteApply(); if (v === "auto") liteBench(true);
    toast(v === "1" ? "Modo rápido encendido" : v === "0" ? "Modo rápido apagado" : "Modo rápido automático");
    if (ui.tab === "aj") render();
  }
});

// Versión nueva al abrir: el programa de Windows (y a veces el navegador) abre la copia guardada de la página
// hasta 10 minutos después de publicar. Al arrancar se pide la página a la red; si trae otra huella de script.js,
// se recarga una sola vez (cuando no hay una ventana abierta ni algo escrito). Las ventas y el ticket no se tocan.
function verNueva() {
  if (!location.protocol.startsWith("http")) return;
  const s = document.querySelector('script[src*="script.js?v="]'), cur = s && (s.getAttribute("src").match(/script\.js\?v=(\w+)/) || [])[1];
  if (!cur) return;
  fetch(location.href.split("#")[0], { cache: "reload" }).then((r) => (r.ok ? r.text() : "")).then((t) => {
    const n = (t.match(/script\.js\?v=(\w+)/) || [])[1];
    if (!n || n === cur) return;
    try { if (sessionStorage.getItem("cf-ver") === n) return; sessionStorage.setItem("cf-ver", n); } catch (e) { return; }
    const libre = () => !modalOpen() && !(document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName) && document.activeElement.value);
    let vueltas = 0;
    const intenta = () => { if (libre()) location.reload(); else if (++vueltas < 40) setTimeout(intenta, 15000); };
    intenta();
  }).catch(() => {});
}

/* ===================== 69 · VOZ: «anota un yogurt», «paga 50 a Gloria» ===================== */
// Gratis y sin claves. Dos oídos: con internet usa el de Chrome (mejor); sin internet usa Vosk (modelo en español de 34 MB
// que se instala una vez). El mismo intérprete local entiende las frases con TUS productos, clientes y proveedores.
// Siempre sale la tarjeta «Entendí» y nada se anota, cobra ni paga sin tu Aceptar.
const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const vozOk = () => cloudOn() && !!cloudLoad().voz;
const vzElectron = typeof navigator !== "undefined" && /Electron/i.test(navigator.userAgent); // el programa de Windows no trae el oído de Chrome
const VZ_CACHE = "cf-voz-1", VZ_FILES = ["voz/vosk.js", "voz/recognizer-processor.js", "voz/model-es.tar.gz"];
const vzInstalled = () => { try { return localStorage.getItem("cf-voz-off") === "1"; } catch (e) { return false; } };
let vz = null; // sesión de voz en curso: { eng, rec, ac, ms, fin: [], part: "", texto, plan }

function stopVoz() {
  const s = vz; vz = null; if (!s) return;
  try { if (s.rec && s.eng === "web") { s.rec.onresult = s.rec.onend = s.rec.onerror = null; s.rec.abort(); } clearTimeout(s.endT); clearTimeout(s.max); } catch (e) {}
  vzCleanVosk(s);
}
function vzCleanVosk(s) {
  try { clearTimeout(s.endT); clearTimeout(s.max); clearInterval(s.vadT); if (s.vrec) s.vrec.remove(); } catch (e) {}
  try { if (s.mrec && s.mrec.state !== "inactive") { s.mrec.onstop = null; s.mrec.stop(); } } catch (e) {}
  try { if (s.ms) s.ms.getTracks().forEach((t) => t.stop()); } catch (e) {}
  try { if (s.ac && s.ac.state !== "closed") s.ac.close(); } catch (e) {}
  if (s.eng === "vosk") vzIdle();
}

/* ---------- intérprete en español (sin IA, sin internet) ---------- */
const VZ_N = { cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900 };
const VZ_ANOTA = new Set(["anota", "anotame", "agrega", "agregame", "pon", "ponme", "anade", "anademe", "suma", "apunta", "apuntame", "dame", "registra", "crea", "crear", "ponle", "agregale", "sumale", "anotale", "mete", "metele", "llevo", "lleva", "quiero", "echa", "echame", "echale", "alcanzame", "pasame", "marcame", "cargame", "cargale", "despacha", "despachame", "vende", "vendeme", "necesito", "quisiera", "queria", "regalame", "sirveme"]);
const VZ_PAGA = new Set(["paga", "pagale", "pagar", "pagame", "abona", "abonale", "abonar", "cancela", "pago", "pagaron", "pagan", "pague", "pagamos", "salda", "saldale", "saldar", "liquida", "liquidale", "liquidar", "deposita", "depositale", "adelanta", "adelantale"]);
const VZ_FIA = new Set(["fia", "fiale", "fiar", "fiado", "fiame", "credito"]);
const VZ_COBRA = new Set(["cobra", "cobrar", "cobrame", "cobrale", "cobrarle", "cobramos"]);
const VZ_QUITA = new Set(["quita", "quitale", "quitame", "quitar", "saca", "sacame", "elimina", "borra", "borrame", "retira", "sacale", "restale", "resta", "descuenta", "devuelve", "devuelvo", "anula", "anulame", "anulale", "anular", "tacha", "tachame", "tachale", "descarta", "descartale", "olvida"]);
const VZ_ULT = new Set(["eso", "ese", "esa", "esto", "ultimo", "ultima", "anterior", "mismo", "misma"]); // «quita 1» = del último producto
const VZ_VACIA = new Set(["vacia", "vaciar", "limpia", "limpiar"]);
const VZ_CAMBIA = new Set(["cambia", "cambiale", "cambiar", "modifica", "corrige"]);
const VZ_UPD = new Set(["actualiza", "actualizale", "actualizar", "actualizame", "cambia", "cambiale", "cambiar", "modifica", "modificale", "corrige", "corrigele", "ponle", "pon", "sube", "subele", "baja", "bajale", "fija", "fijale", "edita", "editale"]);
const VZ_LLEGO = new Set(["llego", "llegaron", "ingresa", "ingresan", "ingreso", "ingresaron", "repon", "repone", "reponer", "reponle", "entro", "entraron", "recibi"]);
const VZ_OFF = new Set(["desactiva", "desactivar", "desactivale", "oculta", "ocultar", "ocultale", "ocultame", "esconde", "escondeme", "desactivame", "esconder", "apaga"]);
const VZ_ON = new Set(["activa", "activar", "activale", "activame", "muestra", "mostrar", "prende"]);
const VZ_MUEVE = new Set(["mueve", "mover", "muevelo", "pasa", "pasalo", "asigna", "asignale", "clasifica"]);
const VZ_MEDIOS = new Set(["efectivo", "yape", "plin", "transferencia", "tarjeta"]);
const VZ_UNI = /^(medio|media|cuarto|cuartos|kilo|kilos|kilito|kilitos|kg|kilogramo|kilogramos|gramo|gramos|gr|docena|docenas|par|pares)$/;
const vzIsNum = (t) => /^\d+(#\d+)?$/.test(t) || t in VZ_N;
const vzIsQty = (t) => vzIsNum(t) || VZ_UNI.test(t) || /^(sol|soles)$/.test(t);
const vzNumVal = (t) => (t in VZ_N ? VZ_N[t] : parseFloat(t.replace("#", ".")));
// «un kilo y medio» → 1.5 kg · «tres cuartos» → 0.75 kg · «media docena» → 6 · «dos soles» → monto 2 · «un sol cincuenta» → 1.50
function vzQty(toks) {
  let val = 0, prev = 0, kg = false, sol = false, any = false;
  toks.forEach((t) => {
    if (vzIsNum(t)) { const n = vzNumVal(t); if (sol) val += n / 100; else val += n; prev = n; any = true; return; }
    const was = prev; prev = 0;
    if (/^(kilo|kilos|kilito|kilitos|kg|kilogramo|kilogramos)$/.test(t)) { kg = true; if (!val) val = 1; }
    else if (/^(gramo|gramos|gr)$/.test(t)) { kg = true; val = val / 1000; }
    else if (/^(medio|media)$/.test(t)) { val += 0.5; prev = 0.5; any = true; }
    else if (/^(cuarto|cuartos)$/.test(t)) { kg = true; any = true; val = was ? val - was + was * 0.25 : val + 0.25; }
    else if (/^(docena|docenas)$/.test(t)) { any = true; const b = was || 1; val = val - b + b * 12; }
    else if (/^(par|pares)$/.test(t)) { any = true; const b = was || 1; val = val - b + b * 2; }
    else if (/^(sol|soles)$/.test(t)) { sol = true; any = true; }
  });
  if (!any && !kg && !sol) return null;
  return { val: r3(val), kg, sol };
}
// Como lo dice la gente: «yapéame», «en cash», «con visa»…
const VZ_ALIAS = { yapeo: "yape", yapeado: "yape", yapea: "yape", yapeame: "yape", yapear: "yape", yapeando: "yape", yapes: "yape", plineo: "plin", plineado: "plin", plinea: "plin", plineame: "plin", cash: "efectivo", contado: "efectivo", visa: "tarjeta", pos: "tarjeta", mastercard: "tarjeta", llape: "yape", jape: "yape", yapi: "yape", yapee: "yape", plim: "plin", pling: "plin", plinn: "plin", debito: "tarjeta", transfer: "transferencia", transferi: "transferencia", transferencias: "transferencia", deposito: "transferencia", billete: "efectivo", billetes: "efectivo", monedas: "efectivo", cuartito: "cuarto", cuartitos: "cuartos" };
const VZ_DROP = new Set(["unidad", "unidades", "unid", "und", "unds"]); // «dos unidades de atún» = «dos atún»
const VZ_INI = new Set(["oye", "oe", "mira", "hola", "buenas", "bueno", "entonces", "pues", "ya", "porfa", "porfis", "disculpa", "perdon", "joven", "amigo"]);
const VZ_FIN = new Set(["porfa", "porfis", "gracias", "nomas", "pues", "oe"]);
const VZ_CIERRA = new Set(["cierra", "cierrame", "cerrar", "cerremos", "finaliza", "finalizar", "termina", "terminar", "terminemos"]);
function vzTokens(text) {
  const t = String(text).toLowerCase().replace(/\b1\s*\/\s*2\b/g, " medio ").replace(/\b1\s*\/\s*4\b/g, " un cuarto ").replace(/\b3\s*\/\s*4\b/g, " tres cuartos ");
  let w = norm(t).replace(/(\d)[.,](\d)/g, "$1#$2").replace(/(^|\s)s\//g, " ").replace(/\bya\s*pe\b/g, "yape").replace(/[^a-z0-9# ]/g, " ").split(/\s+/).filter(Boolean).map((x) => VZ_ALIAS[x] || x).filter((x) => !VZ_DROP.has(x));
  // «mejor no el queso», «ya no quiero la gaseosa» = quita
  const neg = [["mejor", "no"], ["ya", "no", "quiero"], ["ya", "no"], ["no", "quiero"]].find((n) => n.every((x, i) => w[i] === x));
  if (neg && w.length > neg.length) w = ["quita"].concat(w.slice(neg.length));
  // saludos y cortesías: «oye, dos panes por favor»
  while (w.length > 1 && VZ_INI.has(w[0])) w.shift();
  if (w[0] === "a" && w[1] === "ver") w = w.slice(2);
  for (;;) {
    if (w.length > 2 && w[w.length - 2] === "por" && w[w.length - 1] === "favor") w.splice(-2);
    else if (w.length > 1 && VZ_FIN.has(w[w.length - 1])) w.pop();
    else break;
  }
  // «cincuenta céntimos» = 0.50 soles
  const c = [];
  w.forEach((x) => { if (/^(centimo|centimos|centavo|centavos)$/.test(x) && c.length && vzIsNum(c[c.length - 1])) { const n = vzNumVal(c.pop()); c.push(n > 0 && n < 100 ? "0#" + String(Math.round(n)).padStart(2, "0") : String(n)); c.push("soles"); } else c.push(x); });
  w = c;
  // «cierra la venta», «termina la cuenta» = cobra
  if (w.some((x) => /^(venta|cuenta|ticket|pedido)$/.test(x))) w = w.map((x) => (VZ_CIERRA.has(x) ? "cobra" : x));
  return w;
}
// Nombre = lo que sigue a «a/al/para» hasta el primer número o palabra de pago.
function vzNameAfterA(toks) {
  let i = toks.findIndex((t) => t === "a" || t === "al" || t === "para");
  const iDe = i < 0 ? toks.findIndex((t, k) => (t === "de" || t === "del") && toks.slice(0, k).includes("deuda")) : -1; // «cancela la deuda de Gloria»
  if (iDe >= 0) i = iDe;
  const src = i >= 0 ? toks.slice(i + 1) : toks.filter((t) => !vzIsQty(t) && !VZ_MEDIOS.has(t));
  const out = []; for (const t of src) {
    if (/^(proveedor|proveedora|proveedores|cliente|clienta|dona|don|senor|senora|sra|sr)$/.test(t)) continue; if (vzIsQty(t) || ["por", "en", "con", "de", "del", "soles", "sol"].includes(t) || VZ_MEDIOS.has(t)) { if (out.length) break; else continue; } out.push(t); }
  return out.join(" ");
}
// Dinero: «dos con cincuenta» y «dos cincuenta» valen 2.50; «treinta y cinco» vale 35.
function vzMoney(toks) {
  const w = []; toks.forEach((t) => { if (vzIsNum(t) || /^(sol|soles)$/.test(t) || t === "con") w.push(t); });
  const m = []; for (let i = 0; i < w.length; i++) {
    const t = w[i];
    if (t === "con") { if (m.length && vzIsNum(w[i + 1] || "")) { const a = vzNumVal(m.pop()), c = vzNumVal(w[++i]); m.push(String(r2(a + (c < 100 ? c / 100 : c))).replace(".", "#")); } continue; }
    const pv = m[m.length - 1];
    if (vzIsNum(t) && pv && vzIsNum(pv) && vzNumVal(pv) <= 99 && vzNumVal(pv) % 1 === 0 && vzNumVal(t) >= 10 && vzNumVal(t) <= 99 && !(pv in VZ_N && vzNumVal(pv) >= 20 && vzNumVal(pv) % 10 === 0 && vzNumVal(t) < 10)) { m.push(String(r2(vzNumVal(m.pop()) + vzNumVal(t) / 100)).replace(".", "#")); continue; }
    m.push(t);
  }
  const q = vzQty(m.filter((t) => vzIsNum(t) || /^(sol|soles)$/.test(t)));
  return q && q.val > 0 ? q.val : 0;
}
const VZ_LINK = new Set(["de", "del", "a", "en", "cuesta", "cuestan", "vale", "valen", "sale", "salen"]); // «audífono DE 14.50»: palabra que une el nombre con su precio
const VZ_FN = new Set(["el", "la", "los", "las", "de", "del", "un", "una", "unos", "unas", "a", "al", "cuanto", "cuantos", "cuantas", "cuesta", "cuestan", "vale", "valen", "precio", "esta", "estan", "es", "son", "quedan", "queda", "quedo", "hay", "stock", "tengo", "tenemos", "me", "mi", "mis", "en", "producto", "kilo", "kilos", "docena", "docenas", "dime", "dame", "cual", "que", "por", "tiene", "tienes", "cuesta", "sale", "salen", "cobran", "cobras", "cobro", "como"]);

/* ---------- preguntas y descuento: «cuánto me debe Rosa», «qué se está acabando», «cuánto hay en caja», «descuento de 2 soles» ---------- */
const VZ_BAJO = /^(acabando|acaba|acabar|acabarse|acabaron|acabado|acabados|agotando|agotado|agotados|agotarse|faltan|faltando|escasea|escasos|reponer|pedir|comprar)$/;
const VZ_ASK_RUIDO = new Set(["que", "se", "esta", "estan", "por", "ya", "queda", "quedan", "poco", "pocos", "pocas", "poca", "stock", "bajo", "bajos", "hay", "tengo", "tenemos", "falta", "faltan", "me", "mi", "mis", "lo", "los", "las", "el", "la", "de", "del", "dime", "dame", "cuales", "cual", "cuanto", "cuantos", "cosas", "productos", "producto", "mercaderia", "algo", "toca", "debo", "hoy", "lista", "un", "una", "a", "para", "estoy", "estamos", "voy", "vamos", "tiene", "tienes", "tienen"]);
const vzPeriodo = (toks) => (toks.includes("ayer") ? "ayer" : toks.includes("semana") ? "semana" : toks.includes("mes") ? "mes" : "hoy");
function vzRango(per) {
  const d = new Date(), k = (x) => dkey(x);
  if (per === "ayer") { const y = new Date(d.getTime() - 864e5); return { from: k(y), to: k(y), label: "ayer" }; }
  if (per === "semana") return { from: k(new Date(d.getTime() - 6 * 864e5)), to: k(d), label: "en los últimos 7 días" };
  if (per === "mes") return { from: k(new Date(d.getFullYear(), d.getMonth(), 1)), to: k(d), label: "este mes" };
  return { from: k(d), to: k(d), label: "hoy" };
}
function vzParseAsk(toks, j, raw) {
  const has = (re) => toks.some((t) => re.test(t));
  const medio = toks.find((t) => VZ_MEDIOS.has(t));
  // descuento al ticket: «descuento de 2 soles», «dale 10 por ciento de descuento», «quita el descuento»
  const iD = toks.findIndex((t) => /^(descuento|descuentito|rebaja|rebajale|rebajar|rebajita)$/.test(t) || (/^(descuenta|descuentale)$/.test(t) && has(/^(sol|soles|ciento|porciento)$/)));
  if (iD >= 0) {
    const desde = toks.slice(iD);
    if (desde.some((t) => /^(quita|quitale|quitar|saca|sacale|elimina|borra|sin|cancela|anula)$/.test(t)) || toks.slice(0, iD).some((t) => /^(quita|quitale|quitar|saca|sacale|elimina|borra|sin|cancela|anula)$/.test(t))) return [{ tipo: "descuento", monto: 0 }];
    const pre = toks.slice(0, iD); while (pre.length && /^(y|e|con|ademas|tambien|mas|aplica|aplicale|hazle|hazme|dale|ponle|pon|un|una|de|el|al|ticket|dame)$/.test(pre[pre.length - 1])) pre.pop();
    const out = pre.length ? vzParse(pre.join(" ")) : [];
    const pct = /%/.test(raw) || desde.some((t, i) => t === "porciento" || (t === "por" && desde[i + 1] === "ciento"));
    const num = desde.filter((t, i) => !(t === "ciento" && desde[i - 1] === "por") && !(t === "por" && desde[i + 1] === "ciento"));
    const valor = (ts) => (pct ? ((vzQty(ts.filter(vzIsNum)) || {}).val || 0) : vzMoney(ts));
    let v = valor(num);
    if (!v && !out.length) v = valor(toks.filter((t, i) => !(t === "ciento" && toks[i - 1] === "por") && !(t === "por" && toks[i + 1] === "ciento"))); // «dale 5 soles de descuento»
    return v > 0 ? out.concat({ tipo: "descuento", ...(pct ? { pct: v } : { monto: v }) }) : out;
  }
  if (!toks.length) return null;
  // repetir la última venta: «repite la última venta», «ponme lo mismo de antes», «repite y cobra con yape»
  if ((has(/^(repite|repiteme|repetir|repitele|repitelo|repetime)$/) || (toks.includes("mismo") && toks.includes("lo") && has(/^(antes|anterior|ultima|ultimo|nuevo|vez|igual)$/))) && !has(/^(precio|cuesta|vale|cuanto)$/)) {
    const cob = toks.some((t) => VZ_COBRA.has(t) || t === "cobra") ? [{ tipo: "cobrar", medio: medio || "efectivo" }] : [];
    return [{ tipo: "repetir" }, ...cob];
  }
  // ganancia y más vendidos: «cuánto gané hoy», «qué se vende más esta semana» (si nombras un producto, no es esto)
  const per = vzPeriodo(toks), sobra = toks.filter((t) => !VZ_FN.has(t) && !VZ_ASK_RUIDO.has(t) && !/^(gane|ganamos|gano|ganancia|ganancias|utilidad|utilidades|vende|vendido|vendidos|vendo|vendemos|venden|vendio|vendieron|vendi|mas|hoy|ayer|semana|mes|esta|este|dia|total|neta|ahora|producto|productos|mejor|cosa|cosas|lo|se|le|ultimos|dias|siete|pasada|pasado|actual|va|llevo|llevamos|top|estrella|favorito|favoritos|que|cual|cuales|quien|cuanta|cuantas)$/.test(t) && !vzIsNum(t));
  if (!sobra.length && has(/^(gane|ganamos|gano|ganancia|ganancias|utilidad|utilidades)$/)) return [{ tipo: "consulta", consulta: "ganancia", per }];
  if (!sobra.length && ((has(/^(vende|vendido|vendidos|vendo|vendemos|venden|vendio|vendieron|vendi)$/) && toks.includes("mas")) || has(/^(top|estrella|favorito|favoritos)$/)) && !toks.includes("cuanto")) return [{ tipo: "consulta", consulta: "mas_vendidos", per }];
  // ventas del día (total o por medio de pago)
  const hoy = has(/^(hoy|dia)$/) || j.includes("resumen del dia");
  if ((toks.includes("cuanto") && has(/^vend/)) || (toks.includes("ventas") && hoy) || j.includes("resumen del dia")) return [{ tipo: "consulta", consulta: "ventas_hoy", ...(medio ? { medio } : {}) }];
  const verbo = toks.some((t) => VZ_PAGA.has(t) || VZ_COBRA.has(t) || VZ_QUITA.has(t) || VZ_CAMBIA.has(t) || VZ_UPD.has(t) || (VZ_LLEGO.has(t) && toks.some(vzIsNum)) || VZ_OFF.has(t) || VZ_ON.has(t) || (VZ_FIA.has(t) && !/^(fiado|fiados)$/.test(t)));
  if (verbo) return null;
  // deudas: «cuánto me debe Rosa», «quién me debe», «cuánto le debo a Gloria»
  const dw = has(/^(debe|deben|debo|debemos|debes|deuda|deudas|deudor|deudores|moroso|morosos)$/) || (has(/^(fiado|fiados)$/) && has(/^(cuanto|cuantos|quien|quienes|lista|total|hay|tengo)$/));
  if (dw && !has(VZ_BAJO) && !has(/^(cancelo|cancelaron|salde|saldo|pagaron|pago)$/)) {
    const prov = has(/^(debo|debemos|proveedor|proveedores)$/);
    const nombre = toks.filter((t) => !VZ_FN.has(t) && !vzIsNum(t) && !["debe", "deben", "debo", "debemos", "debes", "deuda", "deudas", "deudor", "deudores", "moroso", "morosos", "fiado", "fiados", "quien", "quienes", "lista", "total", "le", "les", "cliente", "clientes", "proveedor", "proveedores", "todos", "todas", "tengo", "hay", "cuanto", "cuantos", "fia", "fiaron", "con", "nos", "te", "se"].includes(t)).join(" ");
    return [{ tipo: "consulta", consulta: "deuda", ...(nombre ? { nombre } : {}), ...(prov ? { prov: true } : {}) }];
  }
  // qué comprar, qué vence, qué no se mueve
  if (!toks.some(vzIsNum)) {
    if (j.includes("que comprar") || j.includes("que compro") || j.includes("lista de compra") || j.includes("que tengo que comprar") || j.includes("que debo comprar") || j.includes("que necesito comprar") || j.includes("que hay que comprar") || j.includes("que me falta comprar") || j.includes("que falta comprar") || j.includes("que pedir") || j.includes("que pido") || j.includes("que tengo que pedir")) return [{ tipo: "consulta", consulta: "comprar" }];
    if (j.includes("no se vende") || j.includes("no se venden") || j.includes("no se mueve") || j.includes("no se mueven") || j.includes("sin mover") || j.includes("no vendo") || j.includes("no rota") || j.includes("no rotan") || j.includes("productos parados") || j.includes("plata parada") || j.includes("dinero parado") || j.includes("mercaderia parada")) return [{ tipo: "consulta", consulta: "sin_mover" }];
    if (has(/^(vence|vencen|vencer|venceran|vencera|vencimiento|vencimientos|vencido|vencidos|vencida|vencidas|caduca|caducan|caducado|caducados|vencio)$/)) {
      const nombre = toks.filter((t) => !VZ_FN.has(t) && !VZ_ASK_RUIDO.has(t) && !/^(vence|vencen|vencer|venceran|vencera|vencimiento|vencimientos|vencido|vencidos|vencida|vencidas|caduca|caducan|caducado|caducados|vencio|cuando|pronto|esta|semana|productos|producto|algo|alguno|alguna|que|cual|cuales|hay|tengo|proximo|proximos|dias|dia|ya|por)$/.test(t)).join(" ");
      return [{ tipo: "consulta", consulta: "vence", ...(nombre ? { nombre } : {}) }];
    }
  }
  // qué se está acabando
  const lista = j.includes("poco stock") || j.includes("stock bajo") || j.includes("queda poco") || j.includes("quedan pocos") || j.includes("quedan pocas") || j.includes("que falta") || j.includes("que me falta");
  if ((has(VZ_BAJO) || lista) && !toks.some(vzIsNum)) {
    const nombre = toks.filter((t) => !VZ_ASK_RUIDO.has(t) && !VZ_BAJO.test(t) && !VZ_FN.has(t)).join(" ");
    return nombre ? [{ tipo: "stock", nombre }] : [{ tipo: "consulta", consulta: "bajos" }];
  }
  // plata en caja
  if (has(/^(caja|plata|dinero|efectivo)$/) && has(/^(cuanto|cuantos|hay|tengo|tenemos|queda|quedan|llevo|llevamos)$/) && !has(/^(precio|cuesta|vale)$/)) {
    if (medio && medio !== "efectivo") return [{ tipo: "consulta", consulta: "ventas_hoy", medio }];
    return [{ tipo: "consulta", consulta: "caja" }];
  }
  if (medio && toks.includes("cuanto") && !has(/^(cuesta|vale|precio)$/)) return [{ tipo: "consulta", consulta: "ventas_hoy", medio }];
  // total del ticket: «cuánto es», «cuánto sería todo», «cuánto llevo»
  if (toks[0] === "cuanto" && toks.length <= 6 && toks.every((t) => ["cuanto", "es", "seria", "sera", "va", "llevo", "llevamos", "sale", "son", "me", "lo", "en", "total", "todo", "la", "el", "cuenta", "ticket", "le", "cobro", "cobras", "mas", "ahora", "ya"].includes(t))) return [{ tipo: "consulta", consulta: "ticket" }];
  return null;
}
const VZ_ABONO = /^(pago|pagaron|pagan|abono|abonaron|abona|cancelo|cancelaron|dejo|dejaron|entrego|entregaron|dio|dieron)$/;
const VZ_NOMBRE_RUIDO = new Set(["me", "le", "nos", "ya", "hoy", "ahora", "con", "de", "del", "su", "sus", "la", "el", "los", "las", "un", "una", "deuda", "fiado", "cuenta", "parte", "a", "por", "en", "soles", "sol", "cliente", "clientes", "senora", "senor", "sra", "sr", "dona", "don", "yo", "nosotros", "y", "tambien", "ademas", "mas"]);
// «Rosa me pagó diez soles», «Rosa abonó 20 con yape», «recibí diez soles de Rosa»: un cliente paga su deuda
function vzParseAbono(toks) {
  const medio = toks.find((t) => VZ_MEDIOS.has(t)), monto = vzMoney(toks.filter((t) => !VZ_MEDIOS.has(t)));
  const todo = !(monto > 0) && (toks.some((t) => /^(todo|toda|completo|completa|entero|entera)$/.test(t)) || toks.some((t) => /^(cancelo|cancelaron|salde|saldo)$/.test(t)));
  if (!(monto > 0) && !todo) return null;
  const clean = (ts) => ts.filter((t) => !VZ_NOMBRE_RUIDO.has(t) && !vzIsNum(t) && !VZ_MEDIOS.has(t) && !VZ_UNI.test(t)).join(" ");
  const iV = toks.findIndex((t) => VZ_ABONO.test(t));
  if (iV > 0 && VZ_PAGA.has(toks[0]) && !VZ_ABONO.test(toks[0])) return null; // «paga a gloria 500 de abono»: el que paga eres tú
  if (iV > 0 && toks[iV + 1] === "con" && toks.some((t) => VZ_COBRA.has(t) || t === "cobra")) return null; // «cobra, pagó con veinte»: es con cuánto paga, no un abono
  if (iV > 0) { const nombre = clean(toks.slice(0, iV)); if (nombre) return [{ tipo: "abono", nombre, ...(monto > 0 ? { monto } : { todo: true }), ...(medio ? { medio } : {}) }]; }
  const iR = toks.findIndex((t) => /^(recibi|cobre|recibimos|cobramos)$/.test(t));
  if (iR >= 0) { const iD = toks.findIndex((t, i) => i > iR && (t === "de" || t === "a")); const nombre = iD >= 0 ? clean(toks.slice(iD + 1)) : ""; if (nombre) return [{ tipo: "abono", nombre, monto, ...(medio ? { medio } : {}) }]; }
  return null;
}
// «Gloria me fió 300», «me fiaron 300 de Gloria», «le quedo debiendo 200 a Gloria», «compré fiado a Gloria 300»: anota lo que le debes al proveedor
function vzParseDeudaProv(toks) {
  const j = toks.join(" "), monto = vzMoney(toks.filter((t) => !VZ_MEDIOS.has(t)));
  if (!(monto > 0)) return null;
  const sinRuido = (ts) => ts.filter((t) => !VZ_NOMBRE_RUIDO.has(t) && !vzIsNum(t) && !VZ_UNI.test(t) && !/^(mercaderia|mercancia|productos|producto|proveedor|proveedora|ayer|hoy|ahora|compre|compramos|fiaron|fio|fie)$/.test(t));
  const iF = toks.findIndex((t) => /^(fio|fiaron|fie|fiamos)$/.test(t));
  if (iF >= 0) {
    const antes = sinRuido(toks.slice(0, iF)).join(" "), nombre = antes || vzNameAfterA(toks.slice(iF + 1));
    return nombre ? [{ tipo: "deuda_proveedor", nombre, monto }] : null;
  }
  const iD = toks.findIndex((t, k) => /^debiendo$/.test(t) && /^(quedo|quede|quedamos|sigo|seguimos)$/.test(toks[k - 1] || ""));
  if (iD >= 0) { const nombre = vzNameAfterA(toks.slice(iD + 1)); return nombre ? [{ tipo: "deuda_proveedor", nombre, monto }] : null; }
  if (/^(compre|compramos)$/.test(toks[0] || "") && toks.some((t) => /^(fiado|credito)$/.test(t))) { const nombre = vzNameAfterA(toks.slice(toks.findIndex((t) => /^(fiado|credito)$/.test(t)) + 1)); return nombre ? [{ tipo: "deuda_proveedor", nombre, monto }] : null; }
  return null;
}
// Gestión de la caja: crear proveedor o cliente, gasto, retiro, abrir/cerrar caja, anular una venta
const VZ_CREA = new Set(["crea", "crear", "creame", "agrega", "agregar", "agregame", "agregale", "registra", "registrar", "registrame", "anade", "anadir", "nuevo", "nueva", "inscribe"]);
const VZ_G_RUIDO = new Set(["el", "la", "los", "las", "un", "una", "uno", "nuevo", "nueva", "se", "llama", "llamado", "llamada", "de", "del", "con", "celular", "cel", "telefono", "fono", "numero", "whatsapp", "dni", "documento", "es", "su", "y", "para", "que", "mi", "al", "a", "proveedor", "proveedora", "cliente", "clienta", "te", "me", "lo"]);
const vzTitulo = (n) => String(n).split(" ").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
function vzParseGestion(toks, j, raw) {
  const has = (re) => toks.some((t) => re.test(t));
  // crear proveedor o cliente: «crea el proveedor Gloria celular 904623137»
  const iE = toks.findIndex((t) => /^(proveedor|proveedora|cliente|clienta)$/.test(t));
  if (iE >= 0 && has(/^(crea|crear|creame|agrega|agregar|agregame|agregale|registra|registrar|registrame|anade|anadir|inscribe|nuevo|nueva)$/) && !has(/^(paga|pagale|pagar|abona|abono|fiado|fia|fiale|cobra|debe|deuda)$/) && !has(/^producto$/)) {
    const prov = /^proveedor/.test(toks[iE]), dig = toks.filter((t) => /^\d+$/.test(t)).join(""), doc = !prov && dig.length === 8 ? dig : "", phone = doc ? "" : dig.length >= 7 ? dig : "";
    const nombre = toks.filter((t) => !VZ_CREA.has(t) && !VZ_ANOTA.has(t) && !VZ_G_RUIDO.has(t) && !/^[\d#]+$/.test(t) && !vzIsNum(t)).join(" ");
    // con las tildes y mayúsculas tal como las dijiste («Pérez», «Ñahui»)
    const parts = nombre.split(" "), orig = String(raw || "").split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}'-]/gu, "")).filter(Boolean), pick = []; let k = 0;
    orig.forEach((w) => { if (k < parts.length && norm(w) === parts[k]) { pick.push(w); k++; } });
    const bonito = pick.length === parts.length ? pick.join(" ") : nombre;
    return nombre ? [{ tipo: prov ? "crear_proveedor" : "crear_cliente", nombre: bonito, ...(phone ? { celular: phone } : {}), ...(doc ? { doc } : {}) }] : [];
  }
  const monto = vzMoney(toks.filter((t, i) => !/^\d{7,}$/.test(t) && !(/^(un|una|uno)$/.test(t) && !/^(sol|soles)$/.test(toks[i + 1] || ""))));
  // gasto: «anota un gasto de 20 en bolsas», «gasté 15 en pasajes»
  if (has(/^(gasto|gastos|gaste|gastamos|gastado)$/) && monto > 0 && !has(/^(producto|proveedor)$/)) {
    const det = toks.filter((t) => !VZ_FN.has(t) && !VZ_ANOTA.has(t) && !vzIsNum(t) && !/^(gasto|gastos|gaste|gastamos|gastado|soles|sol|caja|hice|hicimos|tuve|tuvimos|otro|registra|con|y)$/.test(t) && !/^[\d#]+$/.test(t)).join(" ");
    return [{ tipo: "mov_caja", mov: "gasto", monto, ...(det ? { detalle: det } : {}) }];
  }
  // retiro: «retira 100 de la caja», «saqué 50 de la caja»
  if (monto > 0 && toks.includes("caja") && has(/^(retira|retiro|retirar|retiramos|retire|saque|saca|sacar|sacamos|sacame)$/) && !has(/^(producto|proveedor|gasto)$/)) return [{ tipo: "mov_caja", mov: "retiro", monto }];
  if (monto > 0 && toks[0] === "retiro" && !has(/^(producto|proveedor)$/)) return [{ tipo: "mov_caja", mov: "retiro", monto }];
  // abrir y cerrar caja
  if (toks.includes("caja") || toks.includes("arqueo")) {
    if (has(/^(abre|abrir|abreme|abrimos|abri|apertura|aperturar|aperturame)$/) && (monto > 0 || has(/^(con|sencillo|inicio|empiezo|empezar)$/))) return [{ tipo: "abrir_caja", ...(monto > 0 ? { monto } : {}) }];
    if (toks.length <= 4 && has(/^(abre|abrir|abreme|abrimos|apertura|aperturar)$/)) return [{ tipo: "abrir_caja" }];
    if (has(/^(cierra|cerrar|cierrame|cerramos|cierre|arqueo|arquear|arquea)$/) && !has(/^(dia|mes)$/)) return [{ tipo: "cerrar_caja" }];
  }
  // anular una venta ya cobrada: «anula la última venta», «anula la venta de 25 soles»
  if (has(/^(anula|anular|anulame|anulale|cancela|cancelar|elimina|borra)$/) && has(/^(venta|ventas|boleta|factura)$/)) {
    if (has(/^(ultima|anterior|pasada|reciente|recien|ultimo)$/)) return [{ tipo: "anular_venta", ultima: true }];
    if (monto > 0) return [{ tipo: "anular_venta", monto }];
    const nombre = vzNameAfterA(toks) || ""; if (nombre) return [{ tipo: "anular_venta", nombre }];
  }
  return null;
}
function vzParse(text) {
  const toks = vzTokens(text), out = [], j = toks.join(" ");
  if (!toks.length) return out;
  const ask = vzParseAsk(toks, j, String(text)); if (ask) return ask;
  const ges = vzParseGestion(toks, j, text); if (ges) return ges;
  const abo = vzParseAbono(toks); if (abo) return abo;
  const dpv = vzParseDeudaProv(toks); if (dpv) return dpv;
  // esconder o mostrar un producto en la venta: «desactiva el limón»
  if (toks.some((t) => VZ_OFF.has(t) || VZ_ON.has(t))) {
    const on = toks.some((t) => VZ_ON.has(t)), nombre = toks.filter((t) => !VZ_OFF.has(t) && !VZ_ON.has(t) && !VZ_FN.has(t) && !["producto", "articulo", "de", "la", "venta", "y"].includes(t) && !vzIsNum(t)).join(" ");
    return nombre ? [{ tipo: on ? "activar" : "desactivar", nombre }] : [];
  }
  // categoría: «cambia la categoría del limón a frutas» · «mueve el limón a categoría frutas» · «ponle categoría frutas al limón»
  if (toks.includes("categoria") && toks.some((t) => VZ_UPD.has(t) || VZ_MUEVE.has(t) || VZ_ANOTA.has(t))) {
    const ic = toks.indexOf("categoria"), noise = (t) => VZ_UPD.has(t) || VZ_MUEVE.has(t) || VZ_ANOTA.has(t) || ["el", "la", "los", "las", "su", "producto", "articulo", "de", "del", "a", "al", "en", "como", "para", "sea", "y"].includes(t);
    const before = toks.slice(0, ic).filter((t) => !noise(t)), after = toks.slice(ic + 1); let nombre = "", cat = "";
    const CON = ["a", "al", "en", "como", "para", "sea", "es"];
    if (before.length) { nombre = before.join(" "); cat = after.filter((t) => !["a", "al", "en", "como", "de", "la", "el"].includes(t) || false).join(" "); const k = after.findIndex((t) => !["a", "en", "como", "de", "la", "el", "sea", "es"].includes(t)); cat = k >= 0 ? after.slice(k).join(" ") : ""; }
    else if (["de", "del"].includes(after[0])) { const rest = after.slice(1), k = rest.findIndex((t) => CON.includes(t)); if (k > 0) { nombre = rest.slice(0, k).filter((t) => t !== "la" && t !== "el").join(" "); cat = rest.slice(k + 1).join(" "); } }
    else { const k = after.findIndex((t) => CON.includes(t)); if (k > 0) { cat = after.slice(0, k).join(" "); nombre = after.slice(k + 1).filter((t) => t !== "la" && t !== "el").join(" "); } }
    return nombre && cat ? [{ tipo: "categoria", nombre, categoria: cat }] : [];
  }
  // cambiar precio, costo o stock de un producto: «actualiza el precio del huevo a 6.70 y costo a 6»
  const kwOf = (t) => (t === "precio" ? "precio" : t === "costo" ? "costo" : t === "codigo" ? "codigo" : t === "stock" || t === "inventario" ? "stock" : "");
  if (toks.some((t) => VZ_UPD.has(t)) && toks.some((t) => kwOf(t)) && !toks.includes("nuevo")) {
    const first = toks.findIndex((t) => kwOf(t)), SKIP = (t) => VZ_UPD.has(t) || VZ_FN.has(t) || ["y", "e", "su", "producto", "articulo", "barras", "barra", "numero"].includes(t);
    // «actualiza el limón a 4.50 y costo 3.50»: el número antes de «costo/stock» (sin decir «precio») es el precio
    const preT = toks.slice(0, first), iq = preT.findIndex((t) => vzIsQty(t)), preMoney = iq >= 0 && !toks.includes("precio") ? vzMoney(preT.slice(iq)) : 0;
    const pre = (iq >= 0 && preMoney > 0 ? preT.slice(0, iq) : preT).filter((t) => !SKIP(t) && !vzIsQty(t) && !["a", "en", "por"].includes(t)).join(" ");
    const segs = []; toks.slice(first).forEach((t) => { if (kwOf(t)) segs.push({ k: kwOf(t), t: [] }); else segs[segs.length - 1].t.push(t); });
    const r = {}; let nombre = pre; if (preMoney > 0 && nombre) r.precio = preMoney;
    segs.forEach((sg) => {
      let i = 0; while (i < sg.t.length && ["de", "del", "el", "la", "al", "los", "las", "su", "producto", "barras", "barra", "numero"].includes(sg.t[i])) i++;
      const nm = []; while (i < sg.t.length && !vzIsQty(sg.t[i]) && !["a", "en", "por", "sea", "sean", "es", "son", "y"].includes(sg.t[i])) nm.push(sg.t[i++]);
      if (!nombre && nm.length) nombre = nm.join(" ");
      const rest = sg.t.slice(i);
      if (!nombre) { let l = -1; rest.forEach((t, j) => { if (vzIsQty(t)) l = j; }); const tn = rest.slice(l + 1).filter((t) => !SKIP(t)); if (tn.length) nombre = tn.join(" "); } // «stock 12 al tomate»
      if (sg.k === "codigo") { const c = rest.filter((t) => /^\d+$/.test(t)).join(""); if (c) r.codigo = c; }
      else if (sg.k === "stock") { const q = vzQty(rest.filter(vzIsQty)); if (q && q.val >= 0 && !q.sol) r.stock = q.val; }
      else { const m = vzMoney(rest); if (m > 0) r[sg.k] = m; }
    });
    return nombre && Object.keys(r).length ? [{ tipo: "actualizar", nombre, ...r }] : [];
  }
  // llegó mercadería: «llegaron 20 huevos y 10 atunes» suma al stock
  if (toks.some((t) => VZ_LLEGO.has(t))) {
    const seg = toks.filter((t) => !VZ_LLEGO.has(t)), items = []; let cur = { q: [], n: [] };
    // «un audífono DE 14.50»: lo que sigue a «de/a/en…» tras el nombre es su precio (se usa solo si ese producto no está en la caja)
    const push = () => {
      if (cur.n.length) items.push(cur);
      else if (cur.q.length && items.length) { const pv = items[items.length - 1]; if (!pv.post && VZ_LINK.has(pv.n[pv.n.length - 1])) pv.post = cur.q; }
      cur = { q: [], n: [] };
    };
    seg.forEach((t) => {
      if (vzIsQty(t)) { if (cur.n.length) push(); cur.q.push(t); }
      else if (["y", "e", "mas", "con", "tambien"].includes(t)) { if (cur.n.length) push(); }
      else if (VZ_FN.has(t) || ["mercaderia", "inventario", "nuevos", "nuevas"].includes(t)) { /* relleno */ }
      else cur.n.push(t);
    });
    push();
    const res = items.map((it) => { const q = vzQty(it.q); return q && q.val > 0 && !q.sol ? { tipo: "ingreso", nombre: it.n.join(" "), cantidad: q.val, unidad: q.kg ? "kg" : "unid" } : null; }).filter(Boolean);
    if (res.length) return res;
  }
  // «el precio del huevo a siete soles» (sin verbo) cambia el precio
  const iPr = toks.indexOf("precio");
  if (iPr >= 0 && !toks.includes("cuanto") && !j.includes("a como") && !toks.some((t) => /^(cuesta|cuestan|vale|valen|sale|salen)$/.test(t))) {
    const iA = toks.findIndex((t, i) => i > iPr && (t === "a" || t === "en" || t === "por")), m = iA > iPr ? vzMoney(toks.slice(iA + 1)) : 0;
    const nombre = iA > iPr ? toks.slice(iPr + 1, iA).filter((t) => !VZ_FN.has(t) && !vzIsNum(t)).join(" ") : "";
    if (m > 0 && nombre) return [{ tipo: "actualizar", nombre, precio: m }];
  }
  // precio y stock de un producto
  const pr = toks.some((t) => /^(cuesta|cuestan|vale|valen|precio|sale|salen|cobran|cobras|cobro)$/.test(t)) || j.includes("a como") || (toks.includes("cuanto") && toks.some((t) => /^(esta|estan|es|son|sera|seria|lo|la|los|las|el|un|una)$/.test(t))), st = toks.some((t) => /^(quedan|queda|quedo|hay|stock|tengo|tenemos)$/.test(t));
  if ((pr || st) && !toks.some((t) => VZ_ANOTA.has(t) || VZ_PAGA.has(t) || VZ_FIA.has(t) || VZ_COBRA.has(t) || VZ_QUITA.has(t))) {
    const nombre = toks.filter((t) => !VZ_FN.has(t) && !vzIsNum(t)).join(" ");
    return nombre ? [{ tipo: pr ? "precio" : "stock", nombre }] : [];
  }
  // producto nuevo: «crea producto galleta soda a un sol»
  const ip = toks.findIndex((t) => t === "producto" || t === "articulo");
  if (ip >= 0 && toks.some((t) => VZ_ANOTA.has(t) || t === "nuevo")) {
    const rest = toks.slice(ip + 1).filter((t) => t !== "nuevo"), cut = rest.findIndex((t) => vzIsQty(t) || ["a", "en", "por", "cuesta", "vale", "precio", "costo", "stock"].includes(t));
    const nombre = (cut >= 0 ? rest.slice(0, cut) : rest).join(" "), tail = cut >= 0 ? rest.slice(cut) : [];
    const ic = tail.indexOf("costo"), is = tail.indexOf("stock");
    const ends = [ic, is].filter((x) => x >= 0), pTail = ends.length ? tail.slice(0, Math.min(...ends)) : tail;
    const seg = (i, o) => { if (i < 0) return []; const f = o.filter((x) => x > i); return tail.slice(i + 1, f.length ? Math.min(...f) : tail.length); };
    const precio = vzMoney(pTail), costo = vzMoney(seg(ic, [is])), sq = vzQty(seg(is, [ic]).filter(vzIsQty)), kg = pTail.some((t) => /^(kilo|kilos|kg)$/.test(t));
    return nombre ? [{ tipo: "crear_producto", nombre, ...(precio ? { monto: precio } : {}), ...(costo ? { costo } : {}), ...(sq && sq.val > 0 && !sq.sol ? { stock: sq.val } : {}), unidad: kg ? "kg" : "unid" }] : [];
  }
  // vaciar el ticket
  if (toks.some((t) => VZ_VACIA.has(t)) && toks.some((t) => t === "ticket" || t === "cuenta" || t === "todo") || toks.some((t) => VZ_QUITA.has(t)) && toks.some((t) => t === "todo" || t === "todos") ) return [{ tipo: "vaciar" }];
  // cortar en órdenes: cada verbo abre una
  const kind = (t) => (VZ_PAGA.has(t) ? "pagar" : VZ_FIA.has(t) ? "fiar" : VZ_COBRA.has(t) ? "cobrar" : VZ_QUITA.has(t) ? "quitar" : VZ_CAMBIA.has(t) ? "cambiar" : VZ_ANOTA.has(t) ? "anotar" : "");
  const cuts = []; toks.forEach((t, i) => { if (kind(t)) cuts.push(i); });
  if (!cuts.length) cuts.push(-1); // sin verbo: solo vale si empieza con cantidad («un yogurt»)
  cuts.forEach((c, n) => {
    const seg = toks.slice(c + 1, n + 1 < cuts.length ? cuts[n + 1] : toks.length), k = c >= 0 ? kind(toks[c]) : "anotar";
    // «anota fiado a rosa 10 soles» es un fiado
    if ((k === "anotar" || k === "cobrar") && seg[0] && VZ_FIA.has(seg[0])) return out.push(...vzParseFia(seg.slice(1)));
    if (k === "fiar") return out.push(...vzParseFia(seg));
    // «cobra con efectivo, paga con cincuenta»: el «paga con» es con cuánto paga el cliente, no un pago a proveedor
    if (k === "pagar" && seg[0] === "con" && out.length && out[out.length - 1].tipo === "cobrar" && out[out.length - 1].medio === "efectivo") {
      const m = vzMoney(seg.slice(1).filter((t) => !VZ_MEDIOS.has(t))); if (m) { out[out.length - 1].monto = m; return; }
    }
    if (k === "cobrar" || (k === "pagar" && !vzNameAfterA(seg) && seg.some((t) => VZ_MEDIOS.has(t)))) {
      const medio = seg.find((t) => VZ_MEDIOS.has(t)) || "efectivo", monto = vzMoney(seg.filter((t) => !VZ_MEDIOS.has(t)));
      return out.push({ tipo: "cobrar", medio, ...(monto && medio === "efectivo" ? { monto } : {}) });
    }
    if (k === "pagar") {
      const nombre = vzNameAfterA(seg), monto = vzMoney(seg), medio = seg.find((t) => VZ_MEDIOS.has(t));
      const todo = !monto && seg.some((t) => /^(todo|toda|completo|completa|total|deuda|saldo|entero|entera)$/.test(t)), prov = seg.some((t) => /^proveedor(a|es)?$/.test(t));
      return nombre && out.push({ tipo: "pagar_proveedor", nombre, ...(monto ? { monto } : {}), ...(todo ? { todo: true } : {}), ...(prov ? { prov: true } : {}), ...(medio ? { medio } : {}) });
    }
    if (k === "quitar") {
      const iq = seg.findIndex(vzIsQty), q = iq >= 0 ? vzQty(seg.filter(vzIsQty)) : null;
      const raw = seg.filter((t) => !vzIsQty(t) && !VZ_FN.has(t) && t !== "ticket" && t !== "y" && t !== "e"), nom = raw.filter((t) => !VZ_ULT.has(t)), nombre = nom.join(" ");
      const ult = !nombre && (raw.length > 0 || iq >= 0); // «quita 1», «quita eso», «quita el último»
      if (!nombre && !ult) return;
      return out.push({ tipo: "quitar", nombre, ...(ult ? { ultimo: true } : {}), ...(q && q.val > 0 && !q.sol ? { cantidad: q.val, unidad: q.kg ? "kg" : "unid" } : {}) });
    }
    if (k === "cambiar") {
      let ia = -1; seg.forEach((t, i) => { if (["a", "por", "en", "sean", "son"].includes(t) && i > 0 && seg.slice(i + 1).some(vzIsQty)) ia = i; });
      if (ia < 0) return;
      const q = vzQty(seg.slice(ia + 1).filter(vzIsQty)), nombre = seg.slice(0, ia).filter((t) => !VZ_FN.has(t) && !vzIsQty(t)).join(" ");
      return nombre && q && q.val > 0 && !q.sol && out.push({ tipo: "cambiar", nombre, cantidad: q.val, unidad: q.kg ? "kg" : "unid" });
    }
    const pi = seg.indexOf("por"), porOk = pi > 0 && !seg.slice(0, pi).some(vzIsQty) && seg.slice(pi + 1).some(vzIsQty); // «pan por un sol cincuenta»
    if (c < 0 && !porOk) { const f = seg.findIndex(vzIsQty); if (f < 0 || f > 2 || !seg.slice(0, f).every((t) => VZ_FN.has(t) || t === "y")) return; seg.splice(0, f); } // sin verbo vale si empieza con cantidad (ignorando «los», «y»…)
    // anotar: partir en productos cuando aparece una cantidad nueva o «y/con/más»
    let cur = { q: [], n: [] }; const items = [];
    // «un audífono DE 14.50»: lo que sigue a «de/a/en…» tras el nombre es su precio (se usa solo si ese producto no está en la caja)
    const push = () => {
      if (cur.n.length) items.push(cur);
      else if (cur.q.length && items.length) { const pv = items[items.length - 1]; if (!pv.post && VZ_LINK.has(pv.n[pv.n.length - 1])) pv.post = cur.q; }
      cur = { q: [], n: [] };
    };
    let por = false;
    seg.forEach((t, i) => {
      if (vzIsQty(t)) { if (cur.n.length && !por) push(); cur.q.push(t); }
      else if (t === "por" && cur.n.length && seg.slice(i + 1).some(vzIsQty)) { por = true; cur.por = true; cur.q = []; } // «pan POR un sol»: lo que sigue es el monto
      else if (["y", "e", "mas", "con", "tambien"].includes(t)) { if (cur.n.length) { push(); por = false; } else if (cur.q.length && items.length && !items[items.length - 1].post && VZ_LINK.has(items[items.length - 1].n.slice(-1)[0])) push(); } // «audífono de 14.50 Y 2 leches»: el precio queda con el audífono
      else if ((t === "de" || t === "del") && !cur.n.length) { /* «un cuarto DE arroz» */ }
      else cur.n.push(t);
    });
    push();
    items.forEach((it) => {
      const q = vzQty(it.q), nombre = it.n.join(" ");
      if (!nombre) return;
      const a = { tipo: "anotar", nombre };
      if (q && q.sol && q.val > 0) a.monto = q.val; else if (q && q.val > 0) { a.cantidad = q.val; a.unidad = q.kg ? "kg" : "unid"; }
      // datos para vender algo que no está en los productos (venta libre): nombre sin «de/a…» y las palabras del precio
      const nl = it.n.slice(); while (nl.length && VZ_LINK.has(nl[nl.length - 1])) nl.pop();
      const lp = it.post || (it.por ? it.q : null);
      if (nl.length) a.ln = nl.join(" ");
      if (it.por) a.por = true;
      if (lp && lp.length) a.lp = lp;
      out.push(a);
    });
  });
  return out;
}
function vzParseFia(seg) {
  const nombre = vzNameAfterA(seg), monto = vzMoney(seg);
  return nombre ? [{ tipo: "fiado", nombre, ...(monto ? { monto } : {}) }] : [];
}

// Chrome da varias opciones de cada frase; me quedo con la que la caja entiende mejor (más productos encontrados).
function vzMejor(top, segs) {
  try {
    if (!segs.length || segs.every((a) => a.length < 2)) return top;
    const score = (t) => { const pl = vzPlan(vzParse(t)); return pl.filter((x) => x.ok).length * 3 - pl.filter((x) => !x.ok).length * 2 - pl.filter((x) => x.ok && /\(oí /.test(x.txt)).length; };
    const base = segs.map((a) => a[0]), cands = [base.join(" ")];
    segs.forEach((a, i) => a.slice(1).forEach((alt) => { const c = base.slice(); c[i] = alt; cands.push(c.join(" ")); }));
    let best = cands[0], bs = score(best);
    cands.slice(1).forEach((c) => { const sc = score(c); if (sc > bs) { bs = sc; best = c; } });
    return best.trim() || top;
  } catch (e) { return top; }
}

/* ---------- buscar nombres en lo que ya tiene la caja ---------- */
const VZ_STOP = new Set(["de", "del", "la", "el", "los", "las", "un", "una", "unos", "unas", "y", "con", "para", "a", "al", "dona", "don", "senora", "senor", "sra", "sr"]);
const vzStem = (w) => (w.length > 4 ? w.replace(/(es|s)$/, "") : w.replace(/s$/, ""));
const vzToks = (s) => norm(s).replace(/[^a-z0-9ñ ]/g, " ").split(/\s+/).filter((w) => w && !VZ_STOP.has(w)).map(vzStem);
const vzHit = (q, w) => w === q || (q.length >= 3 && w.startsWith(q)) || (w.length >= 3 && q.startsWith(w));
// Suena parecido: «zeboya» ≈ «cebolla», «inka» ≈ «inca» (b/v, c/s/z, ll/y, h muda...).
function vzSound(w) {
  return norm(w).replace(/[^a-z]/g, "").replace(/h/g, "").replace(/ll/g, "y").replace(/qu/g, "k").replace(/c(?=[ei])/g, "s").replace(/z/g, "s").replace(/c/g, "k").replace(/v/g, "b").replace(/w/g, "u").replace(/g(?=[ei])/g, "j").replace(/gu(?=[ei])/g, "g").replace(/x/g, "s").replace(/(.)\1+/g, "$1")
    .replace(/^rr/, "r").replace(/([aeiou])\1/g, "$1");
}
function vzDist(a, b) {
  const m = a.length, n = b.length; if (!m || !n) return Math.max(m, n);
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return prev[n];
}
const vzMax = (len) => (len <= 3 ? 0 : len <= 5 ? 1 : 2);
// Devuelve { it } si hay uno claro, { amb: [...] } si hay varios parecidos, {} si no hay. { aprox } = lo adiviné por el sonido.
function vzFind(list, name, getName, nojoin) {
  const q = vzToks(name); if (!q.length) return {};
  const cand = list.filter((x) => { const w = vzToks(getName(x)); return q.every((t) => w.some((y) => vzHit(t, y))); });
  if (cand.length === 1) return { it: cand[0] };
  if (cand.length) {
    const ex = cand.filter((x) => { const w = vzToks(getName(x)); return w.length === q.length; });
    if (ex.length === 1) return { it: ex[0] };
    return { amb: cand.slice(0, 3).map(getName), ambIt: cand.slice(0, 3) };
  }
  // nada exacto: probar por parecido de sonido (voz arrastrada, mal pronunciada o mal oída)
  const qs = q.map(vzSound), scored = [];
  list.forEach((x) => {
    const ws = vzToks(getName(x)).map(vzSound); let tot = 0;
    for (const t of qs) { if (t.length < 3) return; let best = 9; ws.forEach((w) => { const d = Math.min(vzDist(t, w), w.length >= 3 && t.length >= 3 ? vzDist(t, w.slice(0, t.length)) : 9); if (d < best) best = d; }); if (best > vzMax(t.length)) return; tot += best; }
    scored.push({ x, tot });
  });
  if (!scored.length) {
    // a veces se oye una palabra partida: «a tun» por «atún», «coca cola» por «cocacola»
    if (!nojoin) {
      const raw = norm(name).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
      for (let i = 0; i + 1 < raw.length; i++) { const r = vzFind(list, raw.slice(0, i).concat(raw[i] + raw[i + 1], raw.slice(i + 2)).join(" "), getName, true); if (r.it) return { it: r.it, aprox: true }; }
    }
    return {};
  }
  scored.sort((a, b) => a.tot - b.tot);
  if (scored.length === 1 || scored[0].tot < scored[1].tot) return { it: scored[0].x, aprox: true };
  { const top = scored.filter((c) => c.tot === scored[0].tot).slice(0, 3); return { amb: top.map((c) => getName(c.x)), ambIt: top.map((c) => c.x) }; }
}
const vzAp = (r, nombre) => (r.aprox ? ` (oí «${nombre}»)` : "");

/* ---------- respuestas: se escriben y (si está activado) se dicen en voz alta ---------- */
const vzHabla = () => !DB.cfg.vozCalla; // Ajustes › Pantalla de venta: «La voz responde hablando»
function vzShutUp() { try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {} }
function vzDi(txt) {
  if (!vzHabla() || !txt) return;
  try {
    const ss = window.speechSynthesis; if (!ss || typeof SpeechSynthesisUtterance === "undefined") return;
    ss.cancel();
    const u = new SpeechSynthesisUtterance(txt), vs = ss.getVoices ? ss.getVoices() : [];
    const v = vs.find((x) => /^es[-_]PE/i.test(x.lang)) || vs.find((x) => /^es[-_](MX|US|419|AR|CO|CL)/i.test(x.lang)) || vs.find((x) => /^es/i.test(x.lang));
    u.lang = v ? v.lang : "es-PE"; if (v) u.voice = v; u.rate = 1;
    ss.speak(u);
  } catch (e) {}
}
// «4 soles con 50», «70 céntimos»: así se lee bien en voz alta
const vzSoles = (n) => { n = r2(n); const e = Math.floor(n), c = Math.round((n - e) * 100); if (!e && c) return `${c} céntimos`; return `${e} ${e === 1 ? "sol" : "soles"}${c ? ` con ${c}` : ""}`; };
const vzQDi = (n) => fmtQ(n).replace(".", ",");
// fn(dinero, cantidad) → frase escrita y frase hablada
const vzMk = (fn) => ({ w: fn(money, fmtQ), say: fn(vzSoles, vzQDi) });
// Línea del plan que es solo una respuesta: si es lo único que pediste, se muestra y se dice al instante (sin «Aceptar»)
const vzAns = (txt, ans) => ({ ok: true, txt, ans, modal: true, run: () => vzResponder([{ ans }], "") });
const amb = (r, a) => ({ ok: false, txt: `«${a.nombre}»: ¿cuál? ${r.amb.join(", ")}`, pick: r.amb.map((n) => ({ label: n, a: { ...a, nombre: n } })) });
function vzAnsProd(p, tipo) {
  const kg = p.unit === "kg", f = p.stock == null ? null : p.stock;
  const rows = [["Precio", money(p.price) + (kg ? " /kg" : "")], ...(p.pres || []).map((x) => [x.name, money(x.price)]), ["Stock", f == null ? "No llevas stock" : `${fmtQ(f)}${kg ? " kg" : " und."}`]];
  const m = vzMk((d, q) => tipo === "stock"
    ? (f == null ? `No llevas el stock de ${p.name}.` : f <= 0 ? `Ya no queda ${p.name}.` : `Quedan ${q(f)}${kg ? " kilos" : ""} de ${p.name}${f <= (p.min || 0) ? ", ya está bajo" : ""}.`)
    : `${p.name} ${kg ? "está a" : "cuesta"} ${d(p.price)}${kg ? " el kilo" : ""}.`);
  return { title: p.name, w: m.w, say: m.say, rows };
}
function vzConsulta(a) {
  const k = a.consulta;
  if (k === "ventas_hoy") {
    if (!(can("caja") || can("reportes"))) return { ok: false, txt: "Tu usuario no puede ver las ventas del día" };
    const lbl = a.medio ? METHODS[a.medio] || a.medio : "";
    return vzAns(a.medio ? `Ver cuánto entró hoy por ${lbl}` : "Ver las ventas de hoy", () => {
      const t = dayTotals(dkey()), by = { efectivo: t.efectivo, yape: t.yapeAll, plin: t.plin, tarjeta: t.tarjeta, transferencia: (t.by || {}).transferencia || 0 };
      const rows = [...(a.medio ? [["Total", money(t.total)]] : []), ["Ventas", String(t.n)], ["Efectivo", money(t.efectivo)], ["Yape", money(t.yapeAll)], ["Plin", money(t.plin)], ["Tarjeta", money(t.tarjeta)]];
      const m = vzMk((d) => a.medio ? `Hoy entraron ${d(by[a.medio] || 0)} por ${lbl}.` : t.n ? `Hoy vendiste ${d(t.total)} en ${t.n} ${t.n === 1 ? "venta" : "ventas"}.` : "Hoy todavía no hay ventas.");
      return { title: "Ventas de hoy", w: m.w, say: m.say, rows, big: t.n || a.medio ? money(a.medio ? by[a.medio] || 0 : t.total) : "" };
    });
  }
  if (k === "ganancia") {
    if (!can("costos")) return { ok: false, txt: "Tu usuario no puede ver las ganancias" };
    const g = vzRango(a.per), cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    return vzAns(`Ver la ganancia de ${g.label}`, () => {
      const A = aggregate(repSales(g.from, g.to, "local")), sinCosto = Object.values(A.prod).filter((o) => o.m > 0 && !(o.c > 0)).length;
      const nota = A.n && sinCosto ? ` Ojo: ${sinCosto === 1 ? "un producto no tiene" : sinCosto + " productos no tienen"} costo, así que es aproximada.` : "";
      const m = vzMk((d) => A.n ? `${cap(g.label)} vendiste ${d(A.net)} y ganaste unos ${d(A.profit)}.${nota}` : `${cap(g.label)} no hay ventas.`);
      return { title: "Ganancia", w: m.w, say: m.say, big: A.n ? money(A.profit) : "", rows: A.n ? [["Vendido", money(A.net)], ["Costo", money(A.cost)], ["Ganancia", money(A.profit)], ["Margen", `${A.net ? Math.round((A.profit / A.net) * 100) : 0} %`]] : [] };
    });
  }
  if (k === "mas_vendidos") {
    if (!(can("caja") || can("reportes"))) return { ok: false, txt: "Tu usuario no puede ver las ventas" };
    const g = vzRango(a.per);
    return vzAns(`Ver lo más vendido ${g.label}`, () => {
      const A = aggregate(repSales(g.from, g.to, "local")), l = Object.entries(A.prod).sort((x, y) => y[1].q - x[1].q).slice(0, 5);
      const fq = (o) => `${fmtQ(o.q)}${o.unit === "kg" ? " kg" : " und"}`;
      const m = vzMk(() => l.length ? `Lo más vendido ${g.label} es ${l[0][0]}, ${fq(l[0][1])}.${l.length > 1 ? ` Luego ${l.slice(1, 3).map((x) => x[0]).join(" y ")}.` : ""}` : `${g.label === "hoy" ? "Hoy" : "En ese tiempo"} todavía no hay ventas.`);
      const mx = l.length ? l[0][1].q || 1 : 1;
      return { title: "Lo más vendido", w: m.w, say: m.say, rows: l.map(([n, o]) => [n, `${fq(o)} · ${money(o.m)}`, Math.max(.06, o.q / mx)]) };
    });
  }
  if (k === "caja") {
    if (!can("caja")) return { ok: false, txt: "Tu usuario no puede ver la caja" };
    return vzAns("Ver cuánto hay en caja", () => {
      const abiertos = DB.shifts.filter((s) => !s.t1);
      if (!abiertos.length) return { title: "Caja", w: "No hay una caja abierta ahora.", say: "No hay una caja abierta ahora.", rows: [] };
      const ef = r2(abiertos.reduce((x, s) => x + shiftSummary(s).expected, 0)), m = vzMk((d) => `En caja deberías tener ${d(ef)} en efectivo.`);
      return { title: "Caja", w: m.w, say: m.say, big: money(ef), rows: [] };
    });
  }
  if (k === "deuda") {
    if (a.prov) {
      if (!can("caja")) return { ok: false, txt: "Tu usuario no puede ver lo que debes a proveedores" };
      let s = null;
      if (a.nombre) { const r = vzFind(DB.supp, a.nombre, (x) => x.name); if (r.amb) return amb(r, a); if (!r.it) return { ok: false, txt: `No encontré al proveedor «${a.nombre}»` }; s = r.it; }
      return vzAns(s ? `Ver cuánto le debes a ${s.name}` : "Ver cuánto debes a proveedores", () => {
        if (s) { const b = Math.max(0, suppBal(s)), m = vzMk((d) => b ? `Le debes ${d(b)} a ${s.name}.` : `No le debes nada a ${s.name}.`); return { title: s.name, w: m.w, say: m.say, rows: [["Deuda", money(b)]] }; }
        const l = DB.supp.filter((x) => suppBal(x) > 0).sort((x, y) => suppBal(y) - suppBal(x)), tot = suppTotalDebt();
        const m = vzMk((d) => l.length ? `Debes ${d(tot)} a ${l.length} ${l.length === 1 ? "proveedor" : "proveedores"}. ${l.slice(0, 3).map((x) => `${x.name} ${d(suppBal(x))}`).join(", ")}.` : "No le debes nada a ningún proveedor.");
        return { title: "Deuda a proveedores", w: m.w, say: m.say, rows: l.slice(0, 8).map((x) => [x.name, money(suppBal(x))]) };
      });
    }
    if (!(can("clientes") || can("abonos") || can("credito"))) return { ok: false, txt: "Tu usuario no puede ver las deudas de clientes" };
    let c = null;
    if (a.nombre) { const r = vzFind(DB.clients, a.nombre, (x) => x.name); if (r.amb) return amb(r, a); if (!r.it) return { ok: false, txt: `No encontré al cliente «${a.nombre}»` }; c = r.it; }
    return vzAns(c ? `Ver cuánto te debe ${c.name}` : "Ver quién te debe", () => {
      if (c) { const b = balanceOf(c), m = vzMk((d) => b ? `${c.name} te debe ${d(b)}.` : `${c.name} no te debe nada.`); return { title: c.name, w: m.w, say: m.say, rows: [["Debe", money(b)]] }; }
      const l = DB.clients.map((x) => ({ x, b: balanceOf(x) })).filter((y) => y.b > 0).sort((y, z) => z.b - y.b), tot = r2(l.reduce((acc, y) => acc + y.b, 0));
      const m = vzMk((d) => l.length ? `Te deben ${d(tot)} en total, ${l.length} ${l.length === 1 ? "cliente" : "clientes"}. ${l.slice(0, 3).map((y) => `${y.x.name} ${d(y.b)}`).join(", ")}.` : "Nadie te debe nada.");
      return { title: "Quién te debe", w: m.w, say: m.say, rows: l.slice(0, 8).map((y) => [y.x.name, money(y.b)]) };
    });
  }
  if (k === "comprar") {
    return vzAns("Ver qué te falta comprar", () => {
      const G = lowGroups(), n = G.reduce((x, g) => x + g.l.length, 0);
      const m = vzMk((d, q) => n ? `Te falta comprar ${n} ${n === 1 ? "producto" : "productos"}: ${G.flatMap((g) => g.l).slice(0, 4).map((p) => `${p.name} (${q(suggest(p))}${p.unit === "kg" ? " kilos" : ""})`).join(", ")}${n > 4 ? " y otros más" : ""}.` : "No te falta comprar nada: todo está sobre su mínimo.");
      return { title: "Qué comprar", w: m.w, say: m.say, rows: G.flatMap((g) => g.l.map((p) => [p.name + (g.s ? ` · ${g.s.name}` : ""), `pedir ${fmtQ(suggest(p))}${p.unit === "kg" ? " kg" : ""}`])).slice(0, 10) };
    });
  }
  if (k === "vence") {
    let pr = null;
    if (a.nombre) { const r = vzFind(DB.products, a.nombre, (x) => x.name); if (r.amb) return amb(r, a); if (!r.it) return { ok: false, txt: `No encontré el producto «${a.nombre}»` }; pr = r.it; }
    return vzAns(pr ? `Ver cuándo vence ${pr.name}` : "Ver qué vence pronto", () => {
      if (pr) { const m = vzMk(() => pr.exp ? `${pr.name}: ${expTxt(pr).toLowerCase()} (${dmy(pr.exp)}).` : `${pr.name} no tiene fecha de vencimiento.`); return { title: pr.name, w: m.w, say: m.say, rows: pr.exp ? [["Vence", dmy(pr.exp)]] : [] }; }
      const l = expItems(), m = vzMk(() => l.length ? `${l.length === 1 ? "Vence pronto 1 producto" : `Vencen pronto ${l.length} productos`}: ${l.slice(0, 4).map((p) => `${p.name} (${expTxt(p).toLowerCase()})`).join(", ")}${l.length > 4 ? " y otros más" : ""}.` : "No hay productos por vencer esta semana.");
      return { title: "Por vencer", w: m.w, say: m.say, rows: l.slice(0, 10).map((p) => [p.name, expTxt(p)]) };
    });
  }
  if (k === "sin_mover") {
    return vzAns("Ver qué no se mueve", () => {
      const l = idleItems(), tot = r2(l.reduce((x, y) => x + y.val, 0));
      const m = vzMk((d) => l.length ? `Tienes ${l.length} ${l.length === 1 ? "producto" : "productos"} sin moverse hace más de 30 días${can("costos") && tot > 0 ? `, con ${d(tot)} parados` : ""}: ${l.slice(0, 3).map((y) => y.p.name).join(", ")}${l.length > 3 ? " y otros más" : ""}.` : "Todo se está moviendo: ningún producto lleva 30 días parado.");
      return { title: "Sin mover", w: m.w, say: m.say, big: l.length && can("costos") && tot > 0 ? money(tot) : "", rows: l.slice(0, 8).map((y) => [y.p.name, `${y.days} días${can("costos") && y.val > 0 ? " · " + money(y.val) : ""}`]) };
    });
  }
  if (k === "bajos") {
    return vzAns("Ver qué se está acabando", () => {
      const l = lowItems(), m = vzMk((d, q) => l.length ? `Se están acabando ${l.length} ${l.length === 1 ? "producto" : "productos"}: ${l.slice(0, 4).map((p) => p.stock <= 0 ? `${p.name} (ya no queda)` : `${p.name} (${q(p.stock)})`).join(", ")}${l.length > 4 ? " y otros más" : ""}.` : "Todo bien: ningún producto está bajo de stock.");
      return { title: "Se está acabando", w: m.w, say: m.say, rows: l.slice(0, 10).map((p) => [p.name, p.stock <= 0 ? "Agotado" : `quedan ${fmtQ(p.stock)}${p.unit === "kg" ? " kg" : ""}`]) };
    });
  }
  if (k === "ticket") {
    return vzAns("Ver el total del ticket", () => {
      const T = cartTotals(), m = vzMk((d) => T.count ? `El ticket va en ${d(T.total)}${T.disc ? `, con descuento de ${d(T.disc)}` : ""}.` : "El ticket está vacío.");
      return { title: "Ticket", w: m.w, say: m.say, rows: T.count ? [["Productos", String(T.count)], ["Total", money(T.total)]] : [] };
    });
  }
  return { ok: false, txt: "No entendí esta pregunta" };
}

/* ---------- convertir cada orden en una línea de «Entendí» ---------- */
function vzPlan(acc, prev) {
  const pend = (prev || []).filter((x) => x.ok && x.add).map((x) => x.add[0]); // productos que ya vas a anotar en esta misma lista
  let willAdd = pend.length > 0;
  const lineOf = (nombre) => vzFind(cartLines().filter((x) => !x.l.quick), nombre, (x) => x.r.name);
  return acc.map((a) => {
    if (a.tipo === "consulta") return vzConsulta(a);
    if (a.tipo === "descuento") {
      if (!can("descuento")) return { ok: false, txt: "Tu usuario no puede hacer descuentos" };
      if (!cartLines().length && !willAdd) return { ok: false, txt: "Descuento: primero anota los productos" };
      if (!a.pct && !a.monto) return { ok: true, txt: "Quitar el descuento del ticket", exec: () => { DB.cart.disc = 0; save(); paintCart(); } };
      if (a.pct && a.pct >= 100) return { ok: false, txt: "Descuento: el porcentaje debe ser menor a 100" };
      if (a.monto && !willAdd && a.monto > cartTotals().sub) return { ok: false, txt: `Descuento: ${money(a.monto)} es más que el ticket (${money(cartTotals().sub)})` };
      return { ok: true, txt: a.pct ? `Descuento de ${fmtQ(a.pct)} % al ticket` : `Descuento de ${money(a.monto)} al ticket`, exec: () => {
        const sub = cartTotals().sub, v = Math.min(a.pct ? r2(sub * a.pct / 100) : r2(a.monto), sub); if (!(v > 0)) return;
        DB.cart.disc = v; log("Descuento", `${money(v)} en ${ticketLabel(DB.cart)} (voz)`); save(); paintCart();
      } };
    }
    if (a.tipo === "anotar") {
      const r = vzFind(DB.products.filter((p) => p.on !== false), a.nombre, (p) => p.name);
      if (r.amb) return amb(r, a);
      const p = r.it;
      if (!p) {
        // No está entre los productos: con precio y permiso se anota como venta libre (no se crea el producto ni se toca el stock)
        const nm = String(a.ln || "").trim();
        if (!nm || /^\d/.test(nm) || /^(todo|todos|eso|esto|algo|nada|cosa|cosas|lo|la|el)$/.test(nm)) return { ok: false, txt: `No encontré el producto «${a.nombre}»` };
        const nomL = nm.charAt(0).toUpperCase() + nm.slice(1), pr = a.lp ? vzMoney(a.lp) : (a.monto || 0);
        if (!(pr > 0)) return { ok: false, txt: `«${nomL}» no está en tus productos. Dime el precio, por ejemplo «${nm} de 14.50»` };
        if (a.unidad === "kg") return { ok: false, txt: `«${nomL}» no está en tus productos: se anota por unidad, no por peso` };
        if (!can("libre")) return { ok: false, txt: `«${nomL}» no está en tus productos y no tienes permiso para venderlo como venta libre` };
        const qL = a.por ? 1 : r3(a.cantidad || 1); // «cuaderno por 3 soles»: 3 soles es el total
        willAdd = true;
        return { ok: true, txt: `${fmtQ(qL)} × ${nomL} · ${money(pr)} (no está en tus productos: venta libre)`, exec: () => {
          DB.cart.items.push({ id: "q" + uid(), pres: "", quick: true, name: nomL, price: r2(pr), qty: qL });
          log("Venta libre", `${nomL} ${money(pr)} × ${fmtQ(qL)} (voz)`); save(); paintSale();
        }, rc: { q: fmtQ(qL), n: nomL + " (libre)", amt: r2(qL * pr) } };
      }
      if ((p.pres || []).length) return { ok: false, txt: `${p.name}: tiene presentaciones, tócalo para elegir una` };
      const kg = p.unit === "kg";
      if (kg && !a.cantidad && !a.monto) return { ok: false, txt: `${p.name}: dime cuánto pesa (por ejemplo «un cuarto»)` };
      if (!kg && a.unidad === "kg") return { ok: false, txt: `${p.name} se vende por unidad, no por peso` };
      if (!kg && a.monto && !a.cantidad) return { ok: false, txt: `${p.name}: dime cuántas unidades, no los soles` };
      if (kg && a.unidad === "unid" && !a.monto) return { ok: false, txt: `${p.name}: dime cuánto pesa (por ejemplo «un kilo» o «medio kilo»)` };
      if (kg && !a.cantidad && a.monto) { if (!(p.price > 0)) return { ok: false, txt: `${p.name}: dime cuánto pesa` }; a.cantidad = r3(a.monto / p.price); }
      const qty = r3(a.cantidad || 1);
      willAdd = true; pend.push(p);
      return { ok: true, txt: `${fmtQ(qty)}${kg ? " kg" : ""} × ${p.name}${vzAp(r, a.nombre)}`, add: [p, qty], rc: { q: `${fmtQ(qty)}${kg ? " kg" : ""}`, n: p.name, amt: r2(qty * (mayorOf(p, r3(qty + (cartLines().find((x) => x.l.id === p.id && !x.l.pres) || { l: { qty: 0 } }).l.qty)) ?? p.price ?? 0)) } };
    }
    if (a.tipo === "quitar" && (a.ultimo || pend.length)) {
      // algo que acabas de decir en esta misma frase («anota 2 atunes, quita 1»): se quita al aceptar, ya anotado
      const rp = a.ultimo ? { it: pend[pend.length - 1] } : vzFind(pend, a.nombre, (x) => x.name), pp = rp.it;
      if (pp) {
        const kg = pp.unit === "kg";
        if (a.cantidad && !kg && a.unidad === "kg") return { ok: false, txt: `${pp.name} se vende por unidad, no por peso` };
        const cant = a.cantidad || 0;
        return { ok: true, txt: cant ? `Quitar ${fmtQ(cant)}${kg ? " kg" : ""} de ${pp.name}${vzAp(rp, a.nombre)}` : `Quitar ${pp.name}${vzAp(rp, a.nombre)}`,
          exec: () => { const x = cartLines().find((y) => y.l.id === pp.id && !y.l.pres); if (!x) return; setLine(x.l.id, x.l.pres, cant && cant < x.l.qty ? r3(x.l.qty - cant) : 0); } };
      }
    }
    if (a.tipo === "quitar" && a.ultimo) {
      const ls = cartLines().filter((x) => !x.l.quick).pop();
      if (!ls) return { ok: false, txt: "No hay nada en el ticket para quitar" };
      a = { ...a, nombre: ls.r.name };
    }
    if (a.tipo === "quitar" || a.tipo === "cambiar") {
      const r = lineOf(a.nombre);
      if (r.amb) return amb(r, a);
      const x = r.it; if (!x) return { ok: false, txt: `No encuentro «${a.nombre}» en el ticket` };
      const kg = x.r.unit === "kg";
      if (a.cantidad && !kg && a.unidad === "kg") return { ok: false, txt: `${x.r.name} se vende por unidad, no por peso` };
      if (a.cantidad && kg && a.unidad === "unid" && a.tipo === "cambiar") return { ok: false, txt: `${x.r.name}: dime cuánto pesa (por ejemplo «un kilo»)` };
      const sufijo = kg ? " kg" : "";
      if (a.tipo === "cambiar") return { ok: true, txt: `Cambiar ${x.r.name} a ${fmtQ(a.cantidad)}${sufijo}${vzAp(r, a.nombre)}`, exec: () => setLine(x.l.id, x.l.pres, r3(a.cantidad)) };
      if (!a.cantidad || a.cantidad >= x.l.qty) return { ok: true, txt: `Quitar ${x.r.name} del ticket${vzAp(r, a.nombre)}`, exec: () => setLine(x.l.id, x.l.pres, 0) };
      return { ok: true, txt: `Quitar ${fmtQ(a.cantidad)}${sufijo} de ${x.r.name}`, exec: () => setLine(x.l.id, x.l.pres, r3(x.l.qty - a.cantidad)) };
    }
    if (a.tipo === "vaciar") {
      const n = cartLines().length; if (!n) return { ok: false, txt: "El ticket ya está vacío" };
      return { ok: true, txt: `Vaciar el ticket (${n} ${n === 1 ? "producto" : "productos"})`, exec: () => { DB.cart.items = []; save(); paintSale(); } };
    }
    if (a.tipo === "cobrar") {
      if (!can("cobrar")) return { ok: false, txt: "Tu usuario no puede cobrar" };
      if (!cartLines().length && !willAdd) return { ok: false, txt: "Cobrar: primero anota los productos" };
      const mt = METHODS[a.medio] || "Efectivo";
      return { ok: true, modal: true, pay: { medio: a.medio || "efectivo", monto: a.monto || 0 }, txt: `Cobrar el ticket con ${mt}${a.monto ? ` (paga con ${money(a.monto)})` : ""}`, run: () => vzCobrar(a.medio, a.monto) };
    }
    if (a.tipo === "crear_producto") {
      if (!can("precios")) return { ok: false, txt: "Tu usuario no puede crear productos" };
      const r = vzFind(DB.products, a.nombre, (p) => p.name);
      if (r.it && vzToks(r.it.name).length === vzToks(a.nombre).length) return { ok: false, txt: `Ya existe «${r.it.name}»` };
      if (!a.monto) return { ok: false, txt: `Producto «${a.nombre}»: dime el precio (por ejemplo «a dos cincuenta»)` };
      const nm = a.nombre.replace(/\b\w/g, (c) => c.toUpperCase());
      return { ok: true, modal: true, txt: `Crear producto «${nm}» a ${money(a.monto)}${a.unidad === "kg" ? " por kilo" : ""}${a.costo ? `, costo ${money(a.costo)}` : ""}${a.stock ? `, stock ${fmtQ(a.stock)}` : ""} (lo revisas antes de guardar)`, run: () => vzNuevo(nm, a.monto, a.unidad === "kg", a.costo, a.stock) };
    }
    if (a.tipo === "actualizar") {
      const r = vzFind(DB.products.filter((p) => p.on !== false), a.nombre, (p) => p.name);
      if (r.amb) return amb(r, a);
      const p = r.it; if (!p) return { ok: false, txt: `No encontré el producto «${a.nombre}»` };
      if (a.codigo && !can("precios")) return { ok: false, txt: "Tu usuario no puede cambiar códigos" };
      if (a.codigo) {
        if (a.codigo.length < 4) return { ok: false, txt: `${p.name}: el código «${a.codigo}» es muy corto. Dilo número por número` };
        const dup = DB.products.find((x) => x.id !== p.id && (x.code === a.codigo || (x.pres || []).some((y) => y.code === a.codigo)));
        if (dup) return { ok: false, txt: `El código ${a.codigo} ya lo usa «${dup.name}»` };
      }
      if (a.precio && !can("precios")) return { ok: false, txt: "Tu usuario no puede cambiar precios" };
      if (a.costo && !can("costos")) return { ok: false, txt: "Tu usuario no puede cambiar costos" };
      if (a.stock != null && !can("stock")) return { ok: false, txt: "Tu usuario no puede cambiar el stock" };
      if (a.stock != null && p.stock == null) return { ok: false, txt: `${p.name}: no llevas stock de este producto. Actívalo en su ficha` };
      const kg = p.unit === "kg", partes = [];
      if (a.precio) partes.push(`precio ${money(a.precio)} (antes ${money(p.price)})`);
      if (a.costo) partes.push(`costo ${money(a.costo)}${p.cost ? ` (antes ${money(p.cost)})` : ""}`);
      if (a.stock != null) partes.push(`stock ${fmtQ(a.stock)}${kg ? " kg" : ""} (antes ${fmtQ(p.stock)})`);
      if (a.codigo) partes.push(`código ${a.codigo}${p.code ? ` (antes ${p.code})` : ""}`);
      if (!partes.length) return { ok: false, txt: `${p.name}: dime qué cambiar (precio, costo, stock o código)` };
      return { ok: true, txt: `${p.name}${vzAp(r, a.nombre)}: ${partes.join(", ")}`, exec: () => {
        if (a.precio && a.precio !== p.price) log("Cambio de precio", `${p.name}: ${money(p.price)} → ${money(a.precio)} (voz)`);
        if (a.precio) p.price = r2(a.precio);
        if (a.costo) p.cost = r2(a.costo);
        if (a.codigo) p.code = a.codigo;
        if (a.stock != null) stockAdd(p, r3(a.stock - p.stock), "ajuste", "Por voz");
        save(); toast("Producto actualizado"); render();
      } };
    }
    if (a.tipo === "activar" || a.tipo === "desactivar") {
      if (!can("precios")) return { ok: false, txt: "Tu usuario no puede cambiar productos" };
      const on = a.tipo === "activar", r = vzFind(DB.products.filter((p) => (p.on !== false) !== on), a.nombre, (p) => p.name);
      if (r.amb) return amb(r, a);
      const p = r.it; if (!p) return { ok: false, txt: on ? `No encontré «${a.nombre}» entre los productos ocultos` : `No encontré el producto «${a.nombre}»` };
      return { ok: true, txt: `${on ? "Mostrar" : "Ocultar"} ${p.name} en la venta${vzAp(r, a.nombre)}`, exec: () => { p.on = on; log(on ? "Producto activado" : "Producto desactivado", p.name + " (voz)"); save(); toast(on ? "Producto visible" : "Producto oculto"); render(); } };
    }
    if (a.tipo === "categoria") {
      if (!can("precios")) return { ok: false, txt: "Tu usuario no puede cambiar productos" };
      const r = vzFind(DB.products.filter((p) => p.on !== false), a.nombre, (p) => p.name);
      if (r.amb) return amb(r, a);
      const p = r.it; if (!p) return { ok: false, txt: `No encontré el producto «${a.nombre}»` };
      const cats = [...new Set(DB.products.map((x) => x.cat).filter(Boolean))], rc = vzFind(cats, a.categoria, (c) => c);
      const nueva = !rc.it, cat = rc.it || a.categoria.replace(/\b\w/g, (c) => c.toUpperCase());
      if (p.cat === cat) return { ok: false, txt: `${p.name} ya está en «${cat}»` };
      return { ok: true, txt: `Pasar ${p.name}${vzAp(r, a.nombre)} a la categoría «${cat}»${nueva ? " (nueva)" : ""}`, exec: () => { p.cat = cat; save(); toast("Categoría cambiada"); render(); } };
    }
    if (a.tipo === "ingreso") {
      if (!can("stock")) return { ok: false, txt: "Tu usuario no puede ingresar mercadería" };
      const r = vzFind(DB.products.filter((p) => p.on !== false), a.nombre, (p) => p.name);
      if (r.amb) return amb(r, a);
      const p = r.it; if (!p) return { ok: false, txt: `No encontré el producto «${a.nombre}»` };
      if (p.stock == null) return { ok: false, txt: `${p.name}: no llevas stock de este producto. Actívalo en su ficha` };
      const kg = p.unit === "kg"; if (!kg && a.unidad === "kg") return { ok: false, txt: `${p.name} se vende por unidad, no por peso` };
      const q = r3(a.cantidad || 0); if (!(q > 0)) return { ok: false, txt: `${p.name}: dime cuántos llegaron` };
      return { ok: true, txt: `Sumar ${fmtQ(q)}${kg ? " kg" : ""} al stock de ${p.name}${vzAp(r, a.nombre)} (quedan ${fmtQ(r3(p.stock + q))})`, exec: () => { stockAdd(p, q, "ingreso", "Por voz"); save(); toast("Stock actualizado"); render(); } };
    }
    if (a.tipo === "precio" || a.tipo === "stock") {
      const r = vzFind(DB.products.filter((p) => p.on !== false), a.nombre, (p) => p.name);
      if (r.amb) return amb(r, a);
      if (!r.it) return { ok: false, txt: `No encontré el producto «${a.nombre}»` };
      return vzAns(`Ver ${a.tipo === "precio" ? "el precio" : "el stock"} de ${r.it.name}${vzAp(r, a.nombre)}`, () => vzAnsProd(r.it, a.tipo));
    }
    if (a.tipo === "pagar_proveedor") {
      if (!can("caja")) return { ok: false, txt: "Tu usuario no puede pagar a proveedores" };
      const r = vzFind(DB.supp, a.nombre, (s) => s.name);
      if (r.amb) return amb(r, a);
      if (!r.it) { if (!a.prov) { const rc = vzFind(DB.clients, a.nombre, (c) => c.name); if (rc.it || rc.amb) return vzAbono({ ...a, tipo: "abono" }); } return { ok: false, txt: `No encontré al proveedor «${a.nombre}»` }; } // «abónale a Rosa»: si es cliente, es su deuda
      let monto = a.monto;
      if (!monto && a.todo) { const b = suppBal(r.it); if (!(b > 0)) return { ok: false, txt: `No le debes nada a ${r.it.name}` }; monto = b; }
      if (!monto) return { ok: false, txt: `Pago a ${r.it.name}: dime el monto` };
      return { ok: true, modal: true, txt: `Pagar ${money(monto)}${a.todo && !a.monto ? " (toda la deuda)" : ""} a ${r.it.name}${vzAp(r, a.nombre)}${a.medio ? " (" + METHODS[a.medio].toLowerCase() + ")" : ""}`, run: () => vzPagar(r.it, monto, a.medio) };
    }
    if (a.tipo === "deuda_proveedor") {
      if (!can("caja")) return { ok: false, txt: "Tu usuario no puede anotar deudas de proveedores" };
      const r = vzFind(DB.supp, a.nombre, (s) => s.name);
      if (r.amb) return amb(r, a);
      if (!r.it) return { ok: false, txt: `No encontré al proveedor «${a.nombre}»` };
      if (!a.monto) return { ok: false, txt: `${r.it.name}: dime cuánto te fió` };
      return { ok: true, modal: true, txt: `Anotar que ${r.it.name}${vzAp(r, a.nombre)} te fió ${money(a.monto)} (lo confirmas antes de guardar)`, run: () => vzDeudaProv(r.it, a.monto) };
    }
    if (a.tipo === "crear_proveedor") {
      if (!can("caja")) return { ok: false, txt: "Tu usuario no puede crear proveedores" };
      const nm = vzTitulo(a.nombre);
      if (DB.supp.some((x) => x.name.toLowerCase() === nm.toLowerCase())) return { ok: false, txt: `Ya tienes un proveedor «${nm}»` };
      return { ok: true, txt: `Crear proveedor «${nm}»${a.celular ? `, celular ${a.celular}` : " (sin celular)"}`, exec: () => { const s = { id: uid(), name: nm, phone: a.celular || "", note: "", t: Date.now() }; DB.supp.push(s); log("Proveedor creado", nm + " (Luis)"); save(); } };
    }
    if (a.tipo === "crear_cliente") {
      if (!can("clientes")) return { ok: false, txt: "Tu usuario no puede crear clientes" };
      const nm = vzTitulo(a.nombre);
      if (DB.clients.some((x) => norm(x.name) === norm(nm))) return { ok: false, txt: `Ya tienes un cliente «${nm}»` };
      if (a.doc && DB.clients.some((x) => x.doc === a.doc)) return { ok: false, txt: `Ya hay un cliente con el DNI ${a.doc}` };
      return { ok: true, txt: `Crear cliente «${nm}»${a.celular ? `, celular ${a.celular}` : ""}${a.doc ? `, DNI ${a.doc}` : ""}`, exec: () => { const c = { id: uid(), name: nm, dt: a.doc ? "DNI" : "", doc: a.doc || "", phone: a.celular || "", email: "", addr: "", limit: 0, days: 0, note: "", t: Date.now() }; DB.clients.push(c); log("Cliente creado", nm + " (Luis)"); save(); } };
    }
    if (a.tipo === "mov_caja") {
      if (!can("caja")) return { ok: false, txt: "Tu usuario no puede mover dinero de la caja" };
      if (!curShift()) return { ok: false, txt: "Primero abre tu caja" };
      const nom = a.mov === "gasto" ? "Gasto" : "Retiro de efectivo";
      return { ok: true, txt: `${nom} de ${money(a.monto)}${a.detalle ? ` (${a.detalle})` : ""}${a.mov === "retiro" ? " de la caja" : ""}`, exec: () => { addMove(a.mov, a.monto, a.detalle || ""); log(nom, `${money(a.monto)} ${a.detalle || ""} (Luis)`); } };
    }
    if (a.tipo === "abrir_caja") {
      if (curShift()) return { ok: false, txt: "Tu caja ya está abierta" };
      return { ok: true, txt: `Abrir tu caja${a.monto ? ` con ${money(a.monto)} de sencillo` : ""}`, exec: () => { const u = me(); DB.shifts.push({ id: uid(), u: u.id, un: u.name, t0: Date.now(), d0: dkey(), open: Math.max(0, r2(a.monto || 0)), t1: 0 }); log("Apertura de caja", `${u.name}: ${money(a.monto || 0)} (Luis)`); save(); paintNav(); } };
    }
    if (a.tipo === "cerrar_caja") {
      const sh = curShift(); if (!sh) return { ok: false, txt: "No tienes una caja abierta" };
      return { ok: true, modal: true, txt: "Cerrar tu caja (cuentas el efectivo antes de confirmar)", run: () => { ui.cnt = null; closeShiftUI(sh.id); } };
    }
    if (a.tipo === "anular_venta") {
      const vivas = DB.sales.filter((x) => !x.void).sort((x, y) => y.t - x.t);
      let ls = a.id ? vivas.filter((x) => x.id === a.id) : a.ultima ? vivas.slice(0, 1) : a.monto ? vivas.filter((x) => Math.abs(x.total - a.monto) < 0.005).slice(0, 3) : vivas.filter((x) => x.client && norm((cli(x.client) || {}).name || "").includes(norm(a.nombre))).slice(0, 3);
      if (!ls.length) return { ok: false, txt: a.ultima ? "No hay ventas para anular" : "No encontré esa venta" };
      if (ls.length > 1) return { ok: false, txt: "Hay varias ventas parecidas: ¿cuál?", pick: ls.map((x) => ({ label: `${docShort(x)} · ${money(x.total)} · ${hhmm(x.t)}`, a: { tipo: "anular_venta", monto: x.total, id: x.id } })) };
      const sv = ls[0];
      return { ok: true, modal: true, txt: `Anular la venta ${docShort(sv)} de ${money(sv.total)} (${hhmm(sv.t)}). Te pido el motivo antes de anular`, run: () => doVoid(sv) };
    }
    if (a.tipo === "abono") return vzAbono(a);
    if (a.tipo === "repetir") {
      const sv = DB.sales.filter((x) => !x.void && x.items && x.items.length).sort((x, y) => y.t - x.t)[0];
      if (!sv) return { ok: false, txt: "Todavía no hay ventas para repetir" };
      const its = sv.items.filter((i) => i.quick || (prod(i.id) && prod(i.id).on !== false));
      if (!its.length) return { ok: false, txt: "Los productos de la última venta ya no están" };
      const nom = its.slice(0, 3).map((i) => String(i.name).replace(/ \(.*\)$/, "")).join(", ") + (its.length > 3 ? " y más" : "");
      willAdd = true;
      return { ok: true, txt: `Repetir la última venta: ${nom} (${its.length} ${its.length === 1 ? "producto" : "productos"}, ${money(sv.total)})`, exec: () => {
        its.forEach((i) => { if (i.quick) DB.cart.items.push({ id: "q" + uid(), pres: "", quick: true, name: i.name, price: i.price, qty: i.qty }); else addToCart(prod(i.id), i.qty, i.pres || ""); });
        save(); paintSale();
      } };
    }
    if (a.tipo === "fiado") {
      const r = vzFind(DB.clients, a.nombre, (c) => c.name);
      if (r.amb) return amb(r, a);
      if (!r.it) return { ok: false, txt: `No encontré al cliente «${a.nombre}»` };
      if (!a.monto && !cartLines().length && !willAdd) return { ok: false, txt: `Fiado a ${r.it.name}: dime el monto o anota primero los productos` };
      return { ok: true, modal: true, txt: a.monto ? `Fiar ${money(a.monto)} a ${r.it.name}${vzAp(r, a.nombre)}` : `Fiar este ticket a ${r.it.name}${vzAp(r, a.nombre)}`, run: () => vzFiar(r.it, a.monto) };
    }
    return { ok: false, txt: "No entendí esta orden" };
  });
}

/* ---------- lo que hace cada orden (siempre con las pantallas que ya existen) ---------- */
function vzPagar(s, monto, medio) {
  suppMoney("pago", s.id);
  const i = $("#spa"); if (i) i.value = r2(monto).toFixed(2);
  if (medio && $(`#spm [data-m="${medio}"]`)) $(`#spm [data-m="${medio}"]`).click();
}
function vzDeudaProv(s, monto) {
  suppMoney("deuda", s.id);
  const i = $("#spa"); if (i) i.value = r2(monto).toFixed(2);
}
function vzAbono(a) {
  if (!can("abonos")) return { ok: false, txt: "Tu usuario no puede cobrar deudas" };
  const r = vzFind(DB.clients, a.nombre, (c) => c.name);
  if (r.amb) return amb(r, a);
  if (!r.it) return { ok: false, txt: `No encontré al cliente «${a.nombre}»` };
  const c = r.it, debt = balanceOf(c);
  if (!(debt > 0)) return { ok: false, txt: `${c.name} no te debe nada` };
  if (!a.monto && a.todo) a = { ...a, monto: debt };
  if (!a.monto) return { ok: false, txt: `Pago de ${c.name}: dime el monto` };
  if (a.monto > debt + 0.001) return { ok: false, txt: `${c.name} solo debe ${money(debt)}` };
  return { ok: true, modal: true, txt: `Cobrar ${money(a.monto)} de la deuda de ${c.name}${vzAp(r, a.nombre)}${a.medio ? " (" + METHODS[a.medio].toLowerCase() + ")" : ""}`, run: () => vzAbonar(c, a.monto, a.medio) };
}
function vzAbonar(c, monto, medio) {
  openAbono(c.id);
  const i = $("#abq"); if (i) i.value = r2(monto).toFixed(2);
  if (medio && $(`#abm [data-m="${medio}"]`)) $(`#abm [data-m="${medio}"]`).click();
}
function vzFiar(c, monto) {
  setClient(c.id);
  if (monto) { DB.cart.items.push({ id: "q" + uid(), pres: "", quick: true, name: "Fiado", price: r2(monto), qty: 1 }); save(); paintSale(); }
  startPay("credito");
}
function vzCobrar(medio, monto) {
  startPay(medio);
  if (monto && ui.pay && ui.pay.method === "efectivo") { ui.pay.recv = String(monto); paintPay(); }
}
function vzNuevo(nombre, precio, kg, costo, stock) {
  openProduct("");
  if (!ui.pe) return;
  Object.assign(ui.pe.d, { name: nombre, price: String(precio), unit: kg ? "kg" : "u", ...(costo ? { cost: String(costo) } : {}), ...(stock ? { stock: String(stock) } : {}) }); paintPE();
}
function vzInfo(p) {
  const kg = p.unit === "kg", stock = p.stock == null ? "No llevas stock de este producto" : `${fmtQ(p.stock)}${kg ? " kg" : " und."}`;
  openModal(`<h2>${esc(p.name)}</h2><div class="kv"><span>Precio</span><b class="num">${money(p.price)}${kg ? " /kg" : ""}</b></div>
    ${(p.pres || []).map((x) => `<div class="kv"><span>${esc(x.name)}</span><b class="num">${money(x.price)}</b></div>`).join("")}
    <div class="kv"><span>Stock</span><b class="num">${esc(stock)}</b></div>
    <div class="btns h"><button class="btn" data-a="close" data-enter>Listo</button></div>`);
}
function vzVentas() {
  const t = dayTotals(dkey());
  openModal(`<h2>Ventas de hoy</h2><div class="kv"><span>Total</span><b class="num">${money(t.total)}</b></div>
    <div class="kv"><span>Ventas</span><b class="num">${t.n}</b></div><div class="kv"><span>Efectivo</span><b class="num">${money(t.efectivo)}</b></div>
    <div class="kv"><span>Yape</span><b class="num">${money(t.yapeAll)}</b></div><div class="kv"><span>Plin</span><b class="num">${money(t.plin)}</b></div>
    <div class="kv"><span>Tarjeta</span><b class="num">${money(t.tarjeta)}</b></div>
    <div class="btns h"><button class="btn" data-a="close" data-enter>Listo</button></div>`);
}

/* ---------- oído sin internet (Vosk): se instala una vez y queda en el equipo ---------- */
let vzModelP = null, vzIdleT = 0, vzBlobs = null;
// Los 3 archivos del oído se guardan en IndexedDB (no en Cache Storage: el programa de Windows se cierra si se usa).
const VZ_TIPO = ["text/javascript", "text/javascript", "application/gzip"];
function vzDb() { return new Promise((ok, no) => { const r = indexedDB.open("cf-voz-db", 1); r.onupgradeneeded = () => r.result.createObjectStore("f"); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error || new Error("idb")); }); }
async function vzIdbGet(k) { const db = await vzDb(); return new Promise((ok, no) => { const q = db.transaction("f").objectStore("f").get(k); q.onsuccess = () => { db.close(); ok(q.result || null); }; q.onerror = () => { db.close(); no(q.error); }; }); }
async function vzIdbPut(k, blob) { const db = await vzDb(); return new Promise((ok, no) => { const tx = db.transaction("f", "readwrite"); tx.objectStore("f").put(blob, k); tx.oncomplete = () => { db.close(); ok(); }; tx.onerror = tx.onabort = () => { db.close(); no(tx.error || new Error("idb")); }; }); }
// Devuelve el archivo guardado. Quien ya la instaló en el navegador (versión anterior, Cache Storage) la pasa a IndexedDB sola.
async function vzFile(f) {
  let b = await vzIdbGet(f); if (b) return b;
  if (!vzElectron && typeof caches !== "undefined") { try { if (!(await caches.has(VZ_CACHE))) return null; const r = await (await caches.open(VZ_CACHE)).match(f); if (r) { b = await r.blob(); await vzIdbPut(f, b); return b; } } catch (e) {} }
  return null;
}
// Baja los 3 archivos y los guarda. cb(0..1) para la barra.
async function vzInstall(cb) {
  const sizes = [5.8e6, 3e3, 34.5e6], tot = sizes.reduce((x, y) => x + y, 0); let done = 0;
  for (let i = 0; i < VZ_FILES.length; i++) {
    if (await vzFile(VZ_FILES[i])) { done += sizes[i]; cb && cb(done / tot); continue; }
    const r = await fetch(VZ_FILES[i], { cache: "no-store" }); if (!r.ok || !r.body) throw new Error("http " + r.status);
    const rd = r.body.getReader(), parts = []; let got = 0;
    for (;;) { const { done: d, value } = await rd.read(); if (d) break; parts.push(value); got += value.length; cb && cb((done + got) / tot); }
    await vzIdbPut(VZ_FILES[i], new Blob(parts, { type: VZ_TIPO[i] }));
    done += sizes[i];
  }
  try { localStorage.setItem("cf-voz-off", "1"); } catch (e) {}
}
async function vzGetBlobs() {
  if (vzBlobs) return vzBlobs;
  const out = [];
  for (const f of VZ_FILES) { const b = await vzFile(f); if (!b) throw new Error("falta " + f); out.push(URL.createObjectURL(b)); }
  return (vzBlobs = { vosk: out[0], proc: out[1], model: out[2] });
}
function vzGetModel() {
  clearTimeout(vzIdleT);
  if (!vzModelP) vzModelP = (async () => {
    const b = await vzGetBlobs();
    if (!window.Vosk) await new Promise((ok, no) => { const sc = document.createElement("script"); sc.src = b.vosk; sc.onload = ok; sc.onerror = () => no(new Error("vosk")); document.head.appendChild(sc); });
    const model = await window.Vosk.createModel(b.model);
    return model;
  })().catch((e) => { vzModelP = null; throw e; });
  return vzModelP;
}
// Pasado un rato sin usar la voz, se libera la memoria (~150 MB).
function vzIdle() { clearTimeout(vzIdleT); vzIdleT = setTimeout(() => { const p = vzModelP; vzModelP = null; if (p) p.then((m) => m.terminate()).catch(() => {}); }, 120000); }
// Lista corta de palabras: tus productos, clientes y proveedores + números y órdenes. Así el oído se equivoca mucho menos.
function vzGrammar() {
  const w = new Set("desactiva desactivar oculta esconde activa activar muestra categoría categoria código codigo barras mueve mover pasa asigna actualiza actualízale actualizar sube súbele baja bájale fija edita costo precio stock inventario llegaron llegó ingresa ingresaron ingresó repón repone reponer entraron recibí nuevo producto anota anótame agrega agrégame pon ponme añade añádeme suma apunta apúntame dame registra paga págale pagar abona abónale fía fíale fiado crédito cuánto cuanto vendí vendido vendimos ventas hoy resumen del día de la el un una uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciséis diecisiete dieciocho diecinueve veinte veintiún veintiuno veintidós veintitrés veinticuatro veinticinco treinta cuarenta cincuenta sesenta setenta ochenta noventa cien ciento doscientos trescientos cuatrocientos quinientos medio media cuarto cuartos kilo kilos gramos soles sol y a al por con más también yape plin efectivo transferencia para tarjeta quita quítale quitar saca sácame elimina borra bórrame retira vacía vaciar limpia limpiar cambia cámbiale cambiar modifica corrige cobra cóbrame cobrar cóbrale cuesta cuestan vale valen precio stock quedan queda quedó hay tengo tenemos producto nuevo crea crear docena docenas par pares kilito kilitos todo todos ticket cuenta mil cuántos cuántas es son están está qué cuál debe deben debo debemos deuda deudas deudor deudores quién quiénes fiados acabando acaba acabar acabarse agotando agotado agotados faltan falta poco pocos descuento descuentito rebaja rebájale descuenta ciento porciento por ciento caja sale salen cobran cobras cobro cómo como total llevo sería seria va echa échame echame échale alcánzame pásame márcame cárgame yapeo yapeado yapéame plineo cash contado visa seiscientos setecientos ochocientos novecientos veintiséis veintisiete veintiocho veintinueve le les lo nos te se proveedor proveedora fió fio fiaron debiendo quedo quedó salda saldar saldo liquida liquidar pagué pague pagamos deposita adelanta adelántale pagó completo completa entera canceló cancelo compré compre abono".split(" "));
  const add = (n) => String(n || "").toLowerCase().split(/[^a-záéíóúüñ]+/).forEach((x) => { if (x.length > 1) w.add(x); });
  DB.products.filter((p) => p.on !== false).forEach((p) => add(p.name)); DB.clients.forEach((c) => add(c.name)); DB.supp.forEach((c) => add(c.name));
  return [...w, "[unk]"];
}

/* ---------- pantallas: escuchando, entendí, errores ---------- */
function vzShow(html) { openModal(html); ui.mk = "voz"; }
const vzListenHtml = (txt) => `<div class="vzbox" role="status"><div class="vzmic"><i class="vzo"></i><i class="vzo b"></i><i class="vzo c"></i><span class="vzg">${svg("mic")}</span></div><h2>Te escucho…</h2><p class="vzt" id="vzt" aria-live="polite">${txt}</p>
  <div class="btns h"><button class="btn sec" data-a="vozpausa" id="vzp">Pausar</button><button class="btn" data-a="vozstop">Listo</button></div>
  <p class="sm" style="margin-top:6px"><button class="link" data-a="${vzKeep ? "vozback" : "close"}">Cancelar</button>${vzInstalled() || vzElectron ? "" : `<button class="link" data-a="vozinstall">Instalar voz sin internet (34 MB)</button>`}</p></div>`;
let vzKeep = null; // lista de la tarjeta «Entendí» que se conserva al tocar «Agregar más»
const VZ_PAUSA = 2500; // ms en silencio para dar por terminada la frase
const VZ_EJ = "Di, por ejemplo: «anota un yogurt y un cuarto de arroz» o «cobra con yape»";
let vzKn = null; // palabras de tus productos, clientes y proveedores (para marcar lo que la caja reconoce)
const vzNorm = (w) => w.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function vzKnown() {
  if (vzKn) return vzKn; vzKn = new Set();
  const add = (n) => String(n || "").split(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+/).forEach((x) => { if (x.length > 2) vzKn.add(vzNorm(x)); });
  DB.products.filter((p) => p.on !== false).forEach((p) => add(p.name)); DB.clients.forEach((c) => add(c.name)); DB.supp.forEach((c) => add(c.name));
  return vzKn;
}
// Lo que dices sale grande; los productos y nombres que la caja reconoce se marcan.
function vzSet(t) {
  const e = $("#vzt"); if (!e) return;
  if (/^«.*»$/s.test(t)) {
    const k = vzKnown(); e.classList.add("live");
    e.innerHTML = esc(t.slice(1, -1)).split(/(\s+)/).map((w) => (/^\s*$/.test(w) ? w : (k.has(vzNorm(w.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]/g, ""))) || /^\d+([.,]\d+)?$/.test(w)) ? `<mark class="vzw">${w}</mark>` : w)).join("");
    return;
  }
  e.classList.remove("live"); e.textContent = t;
}

function vozStart() {
  if (!vozOk()) return toast("La voz no está activada en tu caja. Pídela a tu proveedor.", true);
  stopVoz(); vzShutUp();
  if (SR && navigator.onLine && !vzElectron) return vzWeb();
  if (navigator.onLine && vzNubeOn() && window.MediaRecorder) return vzNubeRec(); // programa de Windows, iPhone…: oído en la nube (mucho mejor que el de 34 MB)
  if (vzInstalled()) return vzVosk();
  vzOfrecer(navigator.onLine ? "" : "Sin internet, la voz necesita instalarse en esta caja.");
}
function vzOfrecer(msg) {
  if (!navigator.onLine) return vzError(msg || "Sin internet. Conéctate una vez para instalar la voz sin internet.");
  vzShow(`<div class="vzbox"><div class="vzmic"><i class="vzo"></i><i class="vzo b"></i><i class="vzo c"></i><span class="vzg">${svg("mic")}</span></div><h2>Voz sin internet</h2><p class="muted" style="margin:6px 0 14px">${esc(msg || "")} Se instala una sola vez (34 MB) y después funciona sin internet.</p>
    <div class="btns h"><button class="btn sec" data-a="close">Ahora no</button><button class="btn" data-a="vozinstall" data-enter>Instalar (34 MB)</button></div></div>`);
}
async function vzDoInstall() {
  stopVoz();
  vzShow(`<div class="vzbox" role="status"><div class="vzmic busy"><i class="vzo"></i><i class="vzo b"></i><i class="vzo c"></i><span class="vzg">${svg("mic")}</span></div><h2>Instalando voz…</h2><div class="vzbar"><i id="vzbar"></i></div><p class="vzt" id="vzt">0 %</p></div>`);
  const mk = ui.mk;
  try { await vzInstall((f) => { const b = $("#vzbar"); if (b) b.style.transform = `scaleX(${f})`; vzSet(Math.round(f * 100) + " %"); }); }
  catch (e) { if (ui.mk === mk) vzError("No se pudo instalar. Revisa tu internet e intenta otra vez."); return; }
  if (ui.mk === mk) { toast("Voz instalada. Ya funciona sin internet"); vozStart(); }
}

/* oído de Chrome (con internet) */
function vzWeb() {
  const s = vz = { eng: "web", texto: "", base: "" };
  vzKn = null; vzShow(vzListenHtml(VZ_EJ));
  s.max = setTimeout(() => vz === s && vzStop(), 30000);
  vzWebRec(s);
}
// Un «oído» de Chrome; al pausar se apaga y al seguir se prende otro, juntando lo dicho.
function vzWebRec(s) {
  let rec; try { rec = new SR(); } catch (e) { stopVoz(); return vzVoskOrErr(); }
  rec.lang = "es-PE"; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 5;
  s.rec = rec;
  rec.onresult = (e) => { if (vz !== s || s.rec !== rec) return; let all = ""; for (let i = 0; i < e.results.length; i++) all += e.results[i][0].transcript + " "; try { s.altsCur = Array.from(e.results, (r) => Array.from(r, (x) => x.transcript)); } catch (er) {} s.texto = (s.base + " " + all).trim(); vzSet("«" + s.texto + "»"); clearTimeout(s.endT); s.endT = setTimeout(() => vz === s && vzStop(), VZ_PAUSA); }; // sigue escuchando hasta que callas un rato
  rec.onerror = (e) => {
    if (vz !== s || s.rec !== rec) return;
    if (e.error === "network" || e.error === "service-not-allowed" && !s.texto) { stopVoz(); return vzVoskOrErr(); }
    const m = { "not-allowed": "Permite el micrófono en el navegador y vuelve a intentar.", "no-speech": "No te escuché. Acércate al micrófono e intenta otra vez.", "audio-capture": "No encuentro el micrófono." }[e.error];
    if (m) { stopVoz(); vzError(m); }
  };
  rec.onend = () => { if (vz === s && s.rec === rec && !s.paused) vozSend(); };
  try { rec.start(); } catch (e) { stopVoz(); vzVoskOrErr(); }
}
// Pausar: deja de escuchar sin perder lo dicho. Seguir: continúa la misma frase.
function vzPausa() {
  const s = vz; if (!s || s.stopping || !s.eng) return;
  s.paused = !s.paused;
  clearTimeout(s.endT); clearTimeout(s.max);
  const b = $("#vzp"), m = $(".vzmic"), h = $("#modal h2");
  if (b) b.textContent = s.paused ? "Seguir" : "Pausar"; if (m) m.classList.toggle("busy", s.paused); if (h) h.textContent = s.paused ? "En pausa" : "Te escucho…";
  if (s.eng === "web") {
    if (s.paused) { s.base = s.texto; s.altsBase = (s.altsBase || []).concat(s.altsCur || []); s.altsCur = []; const r = s.rec; s.rec = null; try { r.onresult = r.onend = r.onerror = null; r.abort(); } catch (e) {} }
    else vzWebRec(s);
  } else if (s.eng === "nube") {
    try { if (s.paused) s.mrec.pause(); else s.mrec.resume(); } catch (e) {}
  } else {
    try { if (s.paused) s.src.disconnect(); else s.src.connect(s.node); } catch (e) {}
  }
  if (!s.paused) s.max = setTimeout(() => vz === s && vzStop(), 30000);
}
function vzVoskOrErr() { if (navigator.onLine && vzNubeOn() && window.MediaRecorder) vzNubeRec(); else if (vzInstalled()) vzVosk(); else vzOfrecer("Esta caja no puede usar el oído de internet."); }


/* oído en la nube (programa de Windows, iPhone…): graba, manda el audio con TUS productos como pista y vuelve el texto */
let vzNubeCaida = 0; // si la nube no responde (función no instalada o sin clave), se prueba de nuevo en 10 minutos
const vzNubeOn = () => { try { return localStorage.getItem("cf-voz-nube") !== "0" && cloudOn() && Date.now() - vzNubeCaida > 600000; } catch (e) { return false; } };
// El círculo del micrófono late con lo que oye: así ves si tu micrófono te escucha.
function vzMedidor(s, ac, src) {
  try {
    const an = ac.createAnalyser(); an.fftSize = 1024; src.connect(an); s.an = an; const buf = new Float32Array(an.fftSize);
    s.lvT = setInterval(() => { an.getFloatTimeDomainData(buf); let q = 0; for (let i = 0; i < buf.length; i++) q += buf[i] * buf[i]; s.rms = Math.sqrt(q / buf.length); const m = $(".vzmic"); if (m) m.style.setProperty("--lv", (1 + Math.min(.3, s.rms * 5)).toFixed(3)); }, 70);
  } catch (e) {}
}
async function vzNubeRec() {
  const s = vz = { eng: "nube", texto: "", heard: 0, last: 0, t0: Date.now(), floor: null };
  vzKn = null; vzShow(vzListenHtml("Preparando el micrófono…"));
  let ms;
  try { ms = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch (e) { if (vz !== s) return; stopVoz(); return vzError(e && e.name === "NotAllowedError" ? "Permite el micrófono y vuelve a intentar." : e && e.name === "NotFoundError" ? "No encuentro el micrófono." : "No se pudo prender el micrófono."); }
  if (vz !== s) { try { ms.getTracks().forEach((t) => t.stop()); } catch (e) {} return; }
  try {
    s.ms = ms; s.ac = new (window.AudioContext || window.webkitAudioContext)(); const src = s.ac.createMediaStreamSource(ms); vzMedidor(s, s.ac, src);
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((m) => MediaRecorder.isTypeSupported(m)) || "";
    const rec = s.mrec = new MediaRecorder(ms, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined), chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => { if (vz === s || s.stopping) vzNubeSend(s, chunks.length ? new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" }) : null); };
    rec.start(250); vzSet(VZ_EJ);
    // detector de voz: se corta solo cuando callas un rato; nunca antes de oírte hablar
    let calib = [];
    s.vadT = setInterval(() => {
      if (vz !== s || s.paused || s.stopping) return;
      const now = Date.now(), r = s.rms || 0;
      if (s.floor === null) { calib.push(r); if (now - s.t0 > 500) { calib.sort((a, b) => a - b); s.floor = calib[Math.floor(calib.length * .3)] || 0.003; } return; }
      const hablando = r > Math.max(0.012, s.floor * 3.2);
      if (hablando) { s.heard += 70; s.last = now; vzSet("Te escucho…"); }
      if (s.heard >= 300 && now - s.last > 1100) vzStop();
      else if (!s.heard && now - s.t0 > 7000) vzStop();
      else if (now - s.t0 > 22000) vzStop();
    }, 70);
  } catch (e) { if (vz === s) { stopVoz(); vzError("No se pudo grabar la voz. Intenta otra vez."); } }
}
async function vzNubeTexto(blob) {
  const tk = await cloudToken(), neg = cloudLoad().neg, fd = new FormData();
  fd.append("neg", neg); fd.append("catalogo", JSON.stringify(vzCatalogo()));
  fd.append("audio", blob, "voz." + (/mp4/.test(blob.type) ? "m4a" : /ogg/.test(blob.type) ? "ogg" : "webm"));
  const r = await fetch(`${SB_URL}/functions/v1/voz-oido`, { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + tk }, body: fd, signal: AbortSignal.timeout(20000) });
  if (!r.ok) { const e = new Error("nube " + r.status); e.st = r.status; throw e; }
  return String(((await r.json()) || {}).texto || "").trim();
}
async function vzNubeSend(s, blob) {
  if (s.sent) return; s.sent = true; const dur = Date.now() - s.t0, oyo = s.heard >= 300; if (vz === s) vz = null; vzCleanVosk(s);
  if (!blob || blob.size < 1500 || !oyo) { const k = vzKeep; if (k) { vzKeep = null; toast("No te escuché. Tu lista sigue igual"); return vzShowPlan(k.plan, k.texto); } return vzError("No te escuché. Acércate al micrófono e intenta otra vez."); }
  vzShow(`<div class="vzbox" role="status"><div class="vzmic busy"><i class="vzo"></i><i class="vzo b"></i><i class="vzo c"></i><span class="vzg">${svg("mic")}</span></div><h2>Entendiendo…</h2></div>`);
  const mk = ui.mk; let texto = "";
  try { texto = await vzNubeTexto(blob); }
  catch (e) {
    if (ui.mk !== mk) return;
    const st = e && e.st; if (!st || st === 404 || st === 503 || st === 502 || st >= 500) vzNubeCaida = Date.now();
    return vzError(st === 403 ? "Ya usaste toda la voz de hoy." : st === 429 ? "Muchos pedidos juntos. Espera unos segundos y vuelve a hablar." : vzInstalled() ? "La nube no respondió. La próxima vez uso la voz sin internet." : "La nube no respondió. Revisa tu internet e intenta otra vez.");
  }
  if (ui.mk !== mk) return;
  if (!texto) { const k = vzKeep; if (k) { vzKeep = null; toast("No te escuché. Tu lista sigue igual"); return vzShowPlan(k.plan, k.texto); } return vzError("No te escuché. Acércate al micrófono e intenta otra vez."); }
  vozSend({ eng: "nube", texto });
}

/* oído sin internet (Vosk) */
async function vzVosk() {
  const s = vz = { eng: "vosk", texto: "", fin: [], part: "" };
  vzKn = null; vzShow(vzListenHtml("Preparando la voz…"));
  let model, ms;
  try {
    model = await vzGetModel(); // primero el modelo, después el micrófono: así no se pierde lo que dices
    if (vz !== s) return vzCleanVosk(s);
    s.ac = new AudioContext({ sampleRate: 16000 }); await s.ac.audioWorklet.addModule((await vzGetBlobs()).proc);
    if (vz !== s) return vzCleanVosk(s);
  } catch (e) {
    if (vz !== s) return; stopVoz();
    if (e && /^falta /.test(e.message || "")) { try { localStorage.removeItem("cf-voz-off"); } catch (er) {} return vzOfrecer("Hay que instalar la voz de nuevo en esta caja."); }
    return vzError(e && e.name === "NotAllowedError" ? "Permite el micrófono en el navegador y vuelve a intentar." : e && e.name === "NotFoundError" ? "No encuentro el micrófono." : "No se pudo preparar la voz. Vuelve a instalarla desde el botón de voz.");
  }
  if (vz !== s) return vzCleanVosk(s);
  try {
    const ch = new MessageChannel(); model.registerPort(ch.port1);
    const rec = s.vrec = new model.KaldiRecognizer(16000, JSON.stringify(vzGrammar()));
    rec.on("result", (m) => { const t = ((m.result && m.result.text) || "").replace(/\[unk\]/g, " ").replace(/\s+/g, " ").trim(); if (t) s.fin.push(t); s.part = ""; vzSet("«" + s.fin.join(" ") + "»"); if (s.stopping) return vozSend(s); if (t) { clearTimeout(s.endT); s.endT = setTimeout(() => vzStop(), VZ_PAUSA); } });
    rec.on("partialresult", (m) => { const p = ((m.result && m.result.partial) || "").replace(/\[unk\]/g, " ").replace(/\s+/g, " ").trim(); if (p) { s.part = p; clearTimeout(s.endT); vzSet("«" + (s.fin.join(" ") + " " + p).trim() + "»"); } });
    const ac = s.ac;
    const node = new AudioWorkletNode(ac, "recognizer-processor", { channelCount: 1, numberOfInputs: 1, numberOfOutputs: 1 });
    node.port.postMessage({ action: "init", recognizerId: rec.id }, [ch.port2]);
    node.connect(ac.destination);
    await new Promise((ok) => setTimeout(ok, 350)); // deja que el oído termine de armarse
    ms = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: true, autoGainControl: true } }); // el micrófono se abre al final (volumen automático: los micrófonos de laptop suelen oír muy bajito)
    s.ms = ms; if (vz !== s) return vzCleanVosk(s);
    s.node = node; s.src = ac.createMediaStreamSource(ms); s.src.connect(node); vzMedidor(s, ac, s.src);
    vzSet(VZ_EJ);
    s.max = setTimeout(() => vz === s && vzStop(), 20000);
  } catch (e) { if (vz === s) { stopVoz(); vzError(e && e.name === "NotAllowedError" ? "Permite el micrófono en el navegador y vuelve a intentar." : e && e.name === "NotFoundError" ? "No encuentro el micrófono." : "No se pudo prender la voz. Intenta otra vez."); } }
}
// Termina de escuchar: pide lo último que oyó y sigue.
function vzStop() {
  const s = vz; if (!s || s.stopping) return;
  if (s.eng === "nube") { s.stopping = true; clearInterval(s.vadT); try { if (s.mrec.state === "paused") s.mrec.resume(); s.mrec.stop(); } catch (e) { vzNubeSend(s, null); } return; }
  if (s.eng !== "vosk") { if (s.paused || !s.rec) return vozSend(s); try { s.rec.stop(); } catch (e) { vozSend(s); } return; }
  s.stopping = true; clearTimeout(s.endT);
  try { s.vrec.retrieveFinalResult(); } catch (e) { return vozSend(s); }
  setTimeout(() => vozSend(s), 1500); // por si el oído no contesta
}

function vzError(msg) { vzShow(`<div class="vzbox"><h2>No pude</h2><p class="muted" style="margin:6px 0 14px">${esc(msg)}</p><div class="btns h"><button class="btn sec" data-a="close">Cerrar</button><button class="btn" data-a="voz">Intentar otra vez</button></div></div>`); }

// Entiende la frase con el intérprete de la caja (sin internet). Si no entiende nada y tú lo prendiste,
// pide ayuda a una IA gratuita (opcional; si falla se ignora).
async function vozSend(s) {
  s = s || vz; if (!s || s.sent) return; s.sent = true;
  let texto = (s.eng === "vosk" ? [...s.fin, s.part].filter(Boolean).join(" ") : s.texto || "").trim();
  if (s.eng !== "vosk" && texto) texto = vzMejor(texto, (s.altsBase || []).concat(s.altsCur || []));
  if (vz === s) vz = null; vzCleanVosk(s);
  if (!texto) { const k = vzKeep; if (k) { vzKeep = null; toast("No te escuché. Tu lista sigue igual"); return vzShowPlan(k.plan, k.texto); } return vzError("No te escuché. Acércate al micrófono e intenta otra vez."); }
  let acc = vzParse(texto);
  // Si la caja no entendió todo y hay IA, se le pide ayuda; me quedo con lo que entienda mejor (nunca empeora).
  const prev = vzKeep && vzKeep.plan, valor = (x) => { const pl = vzPlan(x, prev); return pl.filter((i) => i.ok).length * 3 - pl.filter((i) => !i.ok).length * 2; };
  if (navigator.onLine && vzIaOn() && (!acc.length || vzPlan(acc, prev).some((i) => !i.ok))) {
    vzShow(`<div class="vzbox" role="status"><div class="vzmic busy"><i class="vzo"></i><i class="vzo b"></i><i class="vzo c"></i><span class="vzg">${svg("mic")}</span></div><h2>Entendiendo…</h2><p class="vzt">«${esc(texto)}»</p></div>`);
    const ia = await vzNube(texto);
    if (ia.length && (!acc.length || valor(ia) > valor(acc))) acc = ia;
  }
  vzEntendi(texto, acc);
}
let vzIaCaida = 0; // si la IA no responde (no instalada o sin clave), no se vuelve a intentar por 10 minutos
const vzIaOn = () => { try { return localStorage.getItem("cf-voz-ia") !== "0" && cloudOn() && Date.now() - vzIaCaida > 600000; } catch (e) { return false; } };
const vzCatalogo = () => ({
  productos: DB.products.filter((p) => p.on !== false).slice(0, 400).map((p) => p.name),
  clientes: DB.clients.slice(0, 100).map((c) => c.name), proveedores: DB.supp.slice(0, 60).map((c) => c.name),
  ticket: cartLines().filter((x) => !x.l.quick).slice(0, 30).map((x) => x.r.name)
});
async function vzNube(texto) {
  try {
    const tk = await cloudToken(), neg = cloudLoad().neg;
    const r = await fetch(`${SB_URL}/functions/v1/voz`, { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + tk, "Content-Type": "application/json" }, body: JSON.stringify({ neg, texto, catalogo: vzCatalogo() }), signal: AbortSignal.timeout(9000) });
    if (!r.ok) { if (r.status === 404 || r.status === 503) vzIaCaida = Date.now(); return []; }
    const a = (await r.json()).acciones; return Array.isArray(a) ? a : [];
  } catch (e) { return []; }
}
function vzEntendi(texto, acc) {
  const k = vzKeep; vzKeep = null;
  if (!acc.length) {
    if (k) { toast("No entendí. Tu lista sigue igual"); return vzShowPlan(k.plan, k.texto); }
    return vzError(`No entendí «${texto}». Prueba con «anota un yogurt» o «paga 50 a Gloria».`);
  }
  let plan = vzPlan(acc, k && k.plan);
  if (k) { plan = k.plan.concat(plan); texto = k.texto + " + " + texto; } // se suma a lo que ya tenías
  vzShowPlan(plan, texto);
}
// Solo preguntas (precio, stock, ventas, deudas…): se responde al instante, escrito y en voz alta, sin pedir «Aceptar».
function vzResponder(plan, texto) {
  vz = null;
  const rs = plan.map((x) => { try { return x.ans(); } catch (e) { return null; } }).filter(Boolean);
  if (!rs.length) return closeModal();
  vzShow(`<div class="vzbox vzres" role="status">${rs.map((r) => `<h2>${esc(r.title)}</h2>${r.big ? `<div class="vzbig num">${esc(r.big)}</div><p class="vzans sm2">${esc(r.w)}</p>` : `<p class="vzans">${esc(r.w)}</p>`}${r.rows.length ? `<div class="vzrows">${r.rows.map(([l, v, f], i) => `<div class="kv${f ? " vzbr" : ""}"${f ? ` style="--f:${f.toFixed(3)};--i:${i}"` : ""}><span>${esc(l)}</span><b class="num">${esc(v)}</b></div>`).join("")}</div>` : ""}`).join("")}
    <p class="sm" style="margin-top:8px"><button class="link" data-a="vozhabla">${vzHabla() ? "Silenciar las respuestas habladas" : "Activar las respuestas habladas"}</button></p>
    <div class="btns h"><button class="btn sec" data-a="voz">Preguntar otra cosa</button><button class="btn" data-a="close" data-enter>Listo</button></div></div>`);
  vzDi(rs.map((r) => r.say).join(" "));
}
function vzShowPlan(plan, texto) {
  if (plan.length && plan.every((x) => x.ok && x.ans)) return vzResponder(plan, texto);
  vz = { plan, texto };
  const ok = plan.filter((x) => x.ok), modales = ok.filter((x) => x.modal).length;
  if (modales > 1) plan.forEach((x) => { if (x.modal && x !== ok.find((y) => y.modal)) { x.ok = false; x.txt += " (hazlo por separado, uno por vez)"; } });
  const hay = plan.some((x) => x.ok);
  const rc = plan.filter((x) => x.ok && x.rc), suma = r2(rc.reduce((t, x) => t + x.rc.amt, 0));
  // Cobrar desde la misma tarjeta: fichas de pago, y vuelto si dijiste con cuánto paga.
  const cob = plan.find((x) => x.ok && x.pay), puedeCobrar = hay && can("cobrar") && (rc.length || cartLines().length || cob);
  const totalCob = r2(cartTotals().total + suma), vuelto = cob && cob.pay.medio === "efectivo" && cob.pay.monto > totalCob ? r2(cob.pay.monto - totalCob) : 0;
  const cobLabel = cob ? (plan.some((x) => x.ok && (x.add || x.exec)) ? "Anotar y cobrar" : "Cobrar") : "Aceptar";
  vzShow(`<h2>Entendí</h2><p class="muted sm" style="margin-bottom:8px">«${esc(texto)}»</p>
    <div class="vzlist">${plan.map((x, i) => `<div class="vzl ${x.ok ? "" : "bad"}" style="--i:${i}"><span class="vzi">${x.ok ? svg("check") : svg("close")}</span>${x.rc ? `<span class="vzn"><b class="vzq">${esc(x.rc.q)}</b> ${esc(x.rc.n)}${x.txt.slice(x.txt.indexOf(x.rc.n) + x.rc.n.length) ? `<small>${esc(x.txt.slice(x.txt.indexOf(x.rc.n) + x.rc.n.length).trim())}</small>` : ""}</span><b class="num vzm">${money(x.rc.amt)}</b>` : `<span>${esc(x.txt)}${x.pick ? `<span class="vzpick">${x.pick.map((pk, k) => `<button class="btn sec sm" data-a="vozpick" data-i="${i}" data-j="${k}">${esc(pk.label)}</button>`).join("")}</span>` : ""}</span>`}</div>`).join("")}${rc.length ? `<div class="vzsum"><span>Suma de lo que anotas</span><b class="num">${money(suma)}</b></div>` : ""}</div>
    ${puedeCobrar ? `<div class="vzpayh">Cobrar con</div><div class="vzpay" role="group" aria-label="Cobrar con">${["efectivo", "yape", "plin", "tarjeta"].map((m) => `<button class="vzp${cob && cob.pay.medio === m ? " on" : ""}" data-a="vozpay" data-m="${m}">${METHODS[m]}</button>`).join("")}</div>${vuelto ? `<div class="vzsum"><span>Vuelto</span><b class="num">${money(vuelto)}</b></div>` : ""}` : ""}
    ${hay ? `<button class="btn sec" data-a="vozmas" style="width:100%;margin-top:10px">+ Agregar más</button>` : ""}
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button>${hay ? `<button class="btn" data-a="vozok" data-enter>${cobLabel}</button>` : `<button class="btn" data-a="voz">Hablar otra vez</button>`}</div>`);
}
// Un ✓ que aparece y se va, y una vibración corta si el equipo la tiene.
function vzTic() {
  try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) {}
  if (document.documentElement.dataset.input === "kbd") return;
  const d = document.createElement("div"); d.className = "vztic"; d.setAttribute("aria-hidden", "true"); d.innerHTML = svg("check");
  document.body.appendChild(d); setTimeout(() => d.remove(), 900);
}
function vozAccept() {
  const plan = ((vz && vz.plan) || []).filter((x) => x.ok); vz = null; if (!plan.length) return closeModal();
  closeModal();
  let n = 0; // en el orden en que lo dijiste: anotar, quitar, cambiar...
  plan.forEach((x) => { if (x.add) { addToCart(x.add[0], x.add[1]); n++; } else if (x.exec) { x.exec(); n++; } });
  if (n) { paintSale(); beep(true); vzTic(); toast(n === 1 ? "Listo" : `Listo: ${n} cambios en el ticket`); }
  const m = plan.find((x) => x.run); if (m) m.run();
}
act({
  voz: () => { vzKeep = null; vozStart(); },
  vozmas: () => { const p = vz && vz.plan; if (!p) return; vzKeep = { plan: p.filter((x) => x.ok), texto: vz.texto }; vozStart(); },
  vozback: () => { const k = vzKeep; vzKeep = null; stopVoz(); if (k) vzShowPlan(k.plan, k.texto); else closeModal(); },
  vozstop: vzStop, vozpausa: vzPausa, vozok: vozAccept, vozinstall: vzDoInstall,
  // Una ficha de pago: anota lo de la tarjeta y abre el cobro con ese método (nunca cobra solo).
  vozpay: (el) => {
    const s = vz; if (!s || !s.plan || !can("cobrar")) return;
    const m = el.dataset.m, old = s.plan.find((x) => x.pay), base = s.plan.filter((x) => !x.pay);
    const nuevo = vzPlan([{ tipo: "cobrar", medio: m, monto: m === "efectivo" && old ? old.pay.monto : 0 }], base)[0];
    if (!nuevo || !nuevo.ok) return toast(nuevo ? nuevo.txt : "No se puede cobrar", true);
    s.plan = base.concat(nuevo); vozAccept();
  },
  // «hay varios parecidos»: tocas el que quieres y esa línea se resuelve
  vozpick: (el) => {
    const s = vz; if (!s || !s.plan) return;
    const i = +el.dataset.i, pk = s.plan[i] && s.plan[i].pick && s.plan[i].pick[+el.dataset.j]; if (!pk) return;
    s.plan[i] = vzPlan([pk.a], s.plan.filter((_, k) => k !== i))[0];
    vzShowPlan(s.plan, s.texto);
  },
  vozhabla: () => {
    DB.cfg.vozCalla = !DB.cfg.vozCalla; save();
    if (DB.cfg.vozCalla) vzShutUp();
    toast(DB.cfg.vozCalla ? "La voz ya no habla" : "La voz responderá hablando");
    const b = $('[data-a="vozhabla"]'); if (b) b.textContent = vzHabla() ? "Silenciar las respuestas habladas" : "Activar las respuestas habladas";
  }
});

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
    ${ui.vtab === "ventas" ? `<input class="inp" id="vq" type="search" placeholder="Número, cliente o producto" value="${esc(ui.vq)}" style="margin-bottom:10px">
      <details class="box" ${ui.vdoc || ui.vuser ? "open" : ""}><summary><b>Filtrar</b><small>Por tipo de comprobante o por usuario</small></summary><div class="filters" style="margin-top:8px">
      <select class="inp" data-in="vdoc"><option value="">Todos los comprobantes</option>${Object.entries(DOCS).map(([k, n]) => `<option value="${k}" ${ui.vdoc === k ? "selected" : ""}>${n}</option>`).join("")}</select>
      <select class="inp" data-in="vuser"><option value="">Todos los usuarios</option>${DB.users.map((u) => `<option value="${u.id}" ${ui.vuser === u.id ? "selected" : ""}>${esc(u.name)}</option>`).join("")}</select></div></details>` : ""}
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
  const M = ["efectivo", "yape", "plin", "bcp", "tarjeta"].concat(cr ? ["credito"] : []);
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

/* ===================== 71 · LUIS: asistente de ayuda (IA + órdenes + sin internet) ===================== */
// Luis tiene tres modos, siempre en el mismo chat:
//  1) Órdenes escritas («anota 2 leche», «cuánto vendí hoy»): las entiende el mismo intérprete local de la voz y,
//     antes de tocar nada, muestra la tarjeta «Entendí» con Aceptar. Necesita el extra de voz (vozOk).
//  2) Preguntas: las contesta la IA (función `ayuda`), que ahora sabe en qué pantalla estás y puede mandar botones «Ir a…».
//  3) Sin internet: contesta con pasos guardados en la app (HELP_KB). Todo es local y no manda nada.
let helpMessages = [], helpBusy = false, helpLastErr = "", helpCards = {}, helpCardN = 0, helpTick = 0;
const hn = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/* ---------- a dónde puede llevarte (solo navegar; nunca cambia datos) ---------- */
// clave → [pestaña, subpestaña, nombre]
const HELP_DEST = {
  venta: ["venta", "", "Vender"],
  ventas: ["ventas", "ventas", "Ventas"], "ventas.prev": ["ventas", "prev", "Preventas"], "ventas.desp": ["ventas", "desp", "Por despachar"], "ventas.dev": ["ventas", "dev", "Devoluciones"],
  prod: ["prod", "lista", "Productos"], "prod.low": ["prod", "low", "Por reponer"], "prod.exp": ["prod", "exp", "Por vencer"], "prod.idle": ["prod", "idle", "Sin mover"], "prod.kx": ["prod", "kx", "Movimientos"],
  cli: ["cli", "", "Clientes"], caja: ["caja", "", "Caja"], prov: ["prov", "", "Proveedores"], rep: ["rep", "", "Reportes"],
  aj: ["aj", "negocio", "Ajustes"], "aj.negocio": ["aj", "negocio", "Ajustes › Negocio"], "aj.comp": ["aj", "comp", "Comprobantes"], "aj.cobros": ["aj", "cobros", "Cobros y puntos"],
  "aj.venta": ["aj", "venta", "Pantalla de venta"], "aj.balanza": ["aj", "balanza", "Balanza"], "aj.usuarios": ["aj", "usuarios", "Usuarios y permisos"], "aj.tiendas": ["aj", "tiendas", "Tiendas"],
  "aj.nube": ["aj", "nube", "Nube"], "aj.datos": ["aj", "datos", "Datos y respaldo"], "aj.bitacora": ["aj", "bitacora", "Bitácora"]
};
const HELP_NAV = [["sin mover", "prod.idle"], ["por vencer", "prod.exp"], ["vencimiento", "prod.exp"], ["vencer", "prod.exp"], ["por reponer", "prod.low"], ["reponer", "prod.low"], ["stock bajo", "prod.low"],
  ["kardex", "prod.kx"], ["movimientos", "prod.kx"], ["preventas", "ventas.prev"], ["devoluciones", "ventas.dev"], ["despachar", "ventas.desp"], ["historial", "ventas"],
  ["productos", "prod"], ["inventario", "prod"], ["clientes", "cli"], ["fiados", "cli"], ["proveedores", "prov"], ["reportes", "rep"], ["ganancia", "rep"],
  ["ajustes", "aj"], ["configuracion", "aj"], ["nube", "aj.nube"], ["respaldo", "aj.datos"], ["copia de seguridad", "aj.datos"], ["usuarios", "aj.usuarios"],
  ["balanza", "aj.balanza"], ["cobros", "aj.cobros"], ["tiendas", "aj.tiendas"], ["bitacora", "aj.bitacora"], ["ventas", "ventas"], ["vender", "venta"], ["venta", "venta"], ["arqueo", "caja"], ["caja", "caja"]
].sort((a, b) => b[0].length - a[0].length);
function helpGo(k) {
  const d = HELP_DEST[k]; if (!d) return;
  if (!tabOk(d[0])) return toast("No tienes permiso para entrar ahí");
  if (modalOpen()) closeModal();
  if (d[0] === "prod") ui.ptab = d[1]; else if (d[0] === "ventas") ui.vtab = d[1];
  else if (d[0] === "aj") { ui.atab = d[1]; if (!ATABS_BASIC.includes(d[1])) ui.amore = true; }
  go(d[0]);
  if (window.matchMedia && matchMedia("(max-width:640px)").matches) helpClose();
  toast("Aquí está: " + d[2]); helpStatus();
}
const helpDest = (k) => { const d = HELP_DEST[k]; return d && tabOk(d[0]) ? d : null; };

/* ---------- pantalla actual y sugerencias ---------- */
function helpScreen() {
  const t = (TABS.find((x) => x[0] === ui.tab) || [])[1] || "Caja Fácil", sub = [];
  if (ui.tab === "prod") { const d = Object.values(HELP_DEST).find((x) => x[0] === "prod" && x[1] === ui.ptab); if (d && ui.ptab !== "lista") sub.push(d[2]); }
  if (ui.tab === "ventas") { const d = Object.values(HELP_DEST).find((x) => x[0] === "ventas" && x[1] === ui.vtab); if (d && ui.vtab !== "ventas") sub.push(d[2]); }
  if (ui.tab === "aj") { const x = ATABS.find((y) => y[0] === ui.atab); if (x) sub.push(x[1]); }
  return [t].concat(sub).join(" › ");
}
const HELP_CHIPS = {
  venta: { q: ["¿Cómo cobro con Yape?", "¿Cómo dejo una venta en espera?", "¿Cómo uso la balanza?"], c: ["cuánto vendí hoy", "qué se vende más"] },
  ventas: { q: ["¿Cómo anulo una venta?", "¿Cómo mando el ticket por WhatsApp?"], c: ["anula la última venta", "cuánto vendí hoy"] },
  prod: { q: ["¿Cómo creo un producto?", "¿Cómo pongo precio por mayor?", "¿Cómo registro vencimientos?"], c: ["qué hay que comprar", "qué vence pronto"] },
  cli: { q: ["¿Cómo fío a un cliente?", "¿Cómo le recuerdo su deuda?"], c: ["nuevo cliente Rosa celular 987654321"] },
  caja: { q: ["¿Cómo cierro mi caja?", "¿Cómo anoto un gasto?"], c: ["anota un gasto de 20 en bolsas", "cierra la caja", "cuánto vendí hoy"] },
  prov: { q: ["¿Cómo pago a un proveedor?", "¿Cómo anoto lo que me fiaron?"], c: ["crea el proveedor Gloria celular 987654321", "qué hay que comprar"] },
  rep: { q: ["¿Cómo veo mi ganancia?"], c: ["cuánto vendí hoy", "cuánto vendí esta semana"] },
  aj: { q: ["¿Cómo hago una copia de seguridad?", "¿Cómo creo un cajero con PIN?", "¿Cómo instalo la app?"], c: [] }
};
function helpChips() {
  const box = $("#helpChips"); if (!box) return;
  const s = HELP_CHIPS[ui.tab] || HELP_CHIPS.venta, list = ((ui.tab === "venta" || ui.tab === "aj") && can("ajustes") ? [{ t: "¿Qué oferta hago?", c: 1 }, { t: "Haz una oferta para la vitrina", c: 1 }] : []).concat(vozOk() ? s.c.map((t) => ({ t, c: 1 })) : []).concat(s.q.map((t) => ({ t })));
  const key = ui.tab + "|" + (vozOk() ? 1 : 0); if (box.dataset.k === key) return; box.dataset.k = key;
  box.innerHTML = list.slice(0, 5).map((x, i) => `<button type="button" class="hl-chip${x.c ? " cmd" : ""}" data-a="ayudaChip" data-q="${esc(x.t)}" style="--i:${i}">${x.c ? '<b aria-hidden="true">›_</b>' : ""}${esc(x.t)}</button>`).join("");
}
function helpStatus() {
  const online = cloudOn() && navigator.onLine !== false, ord = vozOk(), w = $("#helpWhere"), s = $("#helpStatus"), p = $("#helpChat");
  if (s) { s.classList.toggle("off", !online); s.lastChild.textContent = online ? (ord ? "En línea · listo para órdenes" : "En línea") : (ord ? "Sin internet · órdenes y pasos guardados" : "Sin internet · pasos guardados"); }
  if (w) { const t = helpScreen(); if (w.dataset.t !== t) { w.dataset.t = t; w.innerHTML = `<i aria-hidden="true"></i>Estás en <b>${esc(t)}</b>`; } }
  if (p && !p.hidden) helpChips();
}

/* ---------- sin internet: pasos guardados ---------- */
// k = pedazos de palabra (sin tildes) que delatan el tema; gana el que más coincide.
const HELP_KB = [
  { k: ["cobr", "yape", "plin", "vuelto", "tarjeta", "efectivo"], t: "Cobrar una venta", go: "venta", s: ["En Vender, agrega los productos al ticket.", "Toca Efectivo, Yape, Plin, BCP o Tarjeta (atajos: F2 o F9 efectivo, F8 Yape, F10 Plin; dentro del cobro, B BCP, T tarjeta y C crédito; ← → cambian de medio).", "Si es efectivo, escribe con cuánto paga y verás el vuelto.", "Confirma y la venta queda guardada."] },
  { k: ["buscar", "escane", "codigo de barras", "agregar al ticket", "agrego un producto a la venta", "anotar un producto"], t: "Agregar productos al ticket", go: "venta", s: ["Escribe el nombre arriba (F3) o escanea el código de barras.", "Toca el producto para sumarlo.", "Cambia la cantidad con F6 y quita una línea con Supr."] },
  { k: ["producto nuevo", "crear producto", "crear un producto", "nuevo producto", "agregar producto", "registrar producto", "creo un producto"], t: "Crear un producto", go: "prod", s: ["Entra a Productos.", "Toca el botón para agregar un producto.", "Escribe nombre, precio, costo y stock.", "Guarda. Ya aparece en Vender."] },
  { k: ["cambiar precio", "cambiar el precio", "editar producto", "subir precio", "precio de un producto", "cambio el precio"], t: "Cambiar un precio", go: "prod", s: ["Entra a Productos.", "Toca el producto.", "Cambia el precio y guarda."] },
  { k: ["stock", "reponer", "se acaba", "agotad", "poco", "pedido"], t: "Ver qué falta y pedir al proveedor", go: "prod.low", s: ["En Productos abre «Por reponer».", "Verás lo que falta ordenado por proveedor.", "Toca el botón de WhatsApp de cada proveedor para mandarle el pedido."] },
  { k: ["venc", "caduc"], t: "Controlar vencimientos", go: "prod.exp", s: ["En la ficha del producto pon la fecha de vencimiento.", "En Productos abre «Por vencer» para ver lo que vence pronto."] },
  { k: ["mayor", "docena", "por cantidad", "mayorista"], t: "Precio por mayor", go: "prod", s: ["Abre el producto en Productos y toca «Oferta y más» (arriba).", "Pon desde cuántas unidades y el precio por unidad.", "En la venta el precio baja solo cuando llegas a esa cantidad."] },
  { k: ["sin mover", "no se vende", "no vende", "estancad"], t: "Productos que no se mueven", go: "prod.idle", s: ["En Productos abre «Sin mover».", "Ahí están los productos que no se venden hace tiempo."] },
  { k: ["fiad", "credito", "cliente", "abono", "deben", "me debe"], t: "Vender fiado y cobrar abonos", go: "cli", s: ["Crea al cliente en Clientes.", "En la venta elige al cliente (F1) y cobra con Crédito.", "Cuando pague, abre al cliente y registra el abono."] },
  { k: ["recordar", "recordatorio", "avisar deuda", "cobrarle"], t: "Recordarle su deuda a un cliente", go: "cli", s: ["Entra a Clientes.", "Abre al cliente que debe.", "Manda el recordatorio por WhatsApp."] },
  { k: ["imprim", "whatsapp", "compartir ticket", "enviar ticket", "mandar ticket"], t: "Mandar o imprimir el ticket", go: "ventas", s: ["Entra a Ventas y abre la venta.", "Elige imprimir o enviarlo por WhatsApp."] },
  { k: ["boleta", "factura", "ruc", "dni", "sunat"], t: "Boleta y factura", go: "aj.comp", s: ["Para factura, elige un cliente con RUC válido (F1).", "Las boletas desde S/ 700 piden el DNI del cliente.", "Los datos de comprobantes están en Ajustes › Comprobantes."] },
  { k: ["anular", "devol", "me equivoque", "cancelar venta", "error en la venta"], t: "Anular o devolver una venta", go: "ventas", s: ["Entra a Ventas.", "Abre la venta equivocada.", "Elige anular o devolver. Necesitas permiso para hacerlo."] },
  { k: ["abrir caja", "cerrar caja", "cierro mi caja", "arqueo", "cierre", "contar"], t: "Abrir y cerrar la caja", go: "caja", s: ["En Caja toca «Abrir caja» y pon el sencillo inicial.", "En la noche toca «Cerrar caja del día» (arriba a la derecha) y cuenta el dinero.", "Cierra con «Cerrar caja e imprimir»."] },
  { k: ["flechas", "teclado", "sin mouse", "sin el mouse", "moverme"], t: "Usar la caja con las flechas", s: ["Fuera de Vender, las flechas ↑ ↓ ← → mueven el borde verde al botón de al lado, también al menú de la izquierda.", "Enter aprieta lo marcado; Esc cierra la ventana o vuelve atrás.", "En Vender las flechas siguen igual: tickets, líneas del ticket, resultados y cobro."] },
  { k: ["turno", "cambio de turno", "turno de la tarde", "turno de la noche", "pasar la caja", "otro cajero"], t: "Cambio de turno", go: "caja", s: ["En Caja, en la barra azul de arriba, toca el botón amarillo «Pasar al turno de la tarde».", "Cuenta el dinero y toca «Cerrar caja e imprimir».", "El que sigue abre la caja: ya sale lo que se contó como sencillo."] },
  { k: ["gasto", "retiro", "ingreso de dinero", "sale dinero", "saque plata", "sacar plata", "meter plata"], t: "Anotar un gasto, meter o sacar plata", go: "caja", s: ["Entra a Caja.", "Toca «Anotar un gasto», «Sacar plata» o «Meter plata».", "Escribe el monto y el motivo, y guarda."] },
  { k: ["proveedor", "me fiaron", "debo a", "pago a", "pagar a", "abonar"], t: "Pagar a un proveedor", go: "prov", s: ["Entra a Proveedores.", "En la fila del proveedor toca «Pagar» (paga todo lo que le debes) o «Abonar» (una parte).", "Para lo que te fiaron, toca «Me fiaron»."] },
  { k: ["report", "ganancia", "cuanto vendi", "resumen", "utilidad"], t: "Ver ventas y ganancia", go: "rep", s: ["Entra a Reportes y elige el periodo.", "Si tienes la voz activa, también puedes escribirme: «cuánto vendí hoy»."] },
  { k: ["balanza", "kilo", "peso", "gramos", "fruta", "verdura"], t: "Vender por peso", go: "venta", s: ["Pon el producto como «por kilo» en Productos.", "En Vender escribe el peso o usa la balanza si la conectaste.", "Configura la balanza en Ajustes › Balanza."] },
  { k: ["usuario", "pin", "cajero", "permiso", "clave"], t: "Cajeros y PIN", go: "aj.usuarios", s: ["Entra a Ajustes › Usuarios y permisos.", "Crea al cajero y elige qué puede hacer.", "Cada uno entra con su PIN. No compartas tu PIN."] },
  { k: ["respaldo", "copia", "nube", "otro equipo", "recuperar", "google"], t: "Copia de seguridad y nube", go: "aj.nube", s: ["Con internet, la nube copia tu caja sola (Ajustes › Nube).", "Para tener un archivo propio, usa Ajustes › Datos y respaldo.", "Para usarla en otro equipo, entra con la misma cuenta de Google."] },
  { k: ["sin internet", "offline", "no hay internet", "se cayo el internet", "wifi"], t: "Trabajar sin internet", go: "venta", s: ["La caja sigue vendiendo con sus datos guardados.", "La nube copia sola cuando vuelve el internet.", "La licencia se revisa con internet al menos cada 15 días."] },
  { k: ["voz", "micro", "hablar", "dictar", "dicta"], t: "Usar la voz", go: "venta", s: ["Toca el micrófono y di, por ejemplo, «anota dos leches».", "Aparece la tarjeta «Entendí». Si está bien, toca Aceptar.", "Si algo no está en tus productos, di el precio («anota un audífono de 14.50») y se anota como venta libre, sin crear el producto (solo con permiso).", "Es un extra: si no ves el micrófono, pídelo a tu proveedor."] },
  { k: ["instalar", "aplicacion", "programa", "escritorio", "icono"], t: "Instalar Caja Fácil", go: "aj.negocio", s: ["Entra a Ajustes › Negocio.", "Toca «Instalar Caja Fácil»."] },
  { k: ["licencia", "suspend", "bloquead", "activar", "vencio mi"], t: "Caja bloqueada o sin activar", go: "aj.nube", s: ["Entra con tu cuenta de Google en la pantalla de activación.", "Si dice suspendida, habla con el proveedor.", "Si pasaron 15 días sin internet, conéctate un momento para revisar la licencia."] },
  { k: ["fichas", "fotos", "pantalla de venta", "minimarket", "modo escaner"], t: "Cambiar la pantalla de venta", go: "aj.venta", s: ["Entra a Ajustes › Pantalla de venta.", "Elige «Escáner (minimarket)» o «Fichas con fotos»."] },
  { k: ["atajo", "tecla", "teclado", "f1", "f2"], t: "Teclas rápidas", go: "venta", s: ["F1 cliente · F3 buscar · F5 en espera · F6 cantidad.", "F2 o F9 efectivo · F8 Yape · F10 Plin · En el cobro, flechas ← → eligen el medio de pago y ↓ los billetes; Enter cobra con el marcado · F7 dividir pago.", "Supr quita la línea elegida."] },
  { k: ["preventa", "en espera", "guardar venta", "dejar pendiente"], t: "Dejar una venta en espera", go: "venta", s: ["En Vender toca «En espera» (F5) para guardar el ticket y atender a otro.", "O usa «Guardar preventa» y luego «Cobrar preventa»."] },
  { k: ["ocultar menu", "esconder menu", "quitar menu", "menu de la izquierda", "mas espacio", "mostrar menu", "volver a poner el menu"], t: "Ocultar o mostrar el menú", s: ["En la computadora, abajo del menú de la izquierda toca «Ocultar».", "Queda una franja verde delgada al borde izquierdo: tócala para que vuelva el menú.", "La caja recuerda tu elección en ese equipo."] },
  { k: ["manejar otra caja", "cambiar desde mi laptop", "cambiar a distancia", "otra caja", "desde otra computadora", "remoto", "cambios a distancia"], t: "Manejar otra caja desde aquí", s: ["Ve a Ajustes › Nube › «Manejar otra caja» y toca «Elegir caja».", "Elige la caja y toca «Manejar». Arriba sale la barra «Manejando: …».", "Cambia productos, precios, stock, clientes, proveedores, usuarios, ajustes o la vitrina como siempre: se envía solo.", "Su caja lo aplica en un minuto si está prendida y con internet. En «Ver» sale si ya lo aplicó.", "Para terminar toca «Salir»: vuelves a tus datos de este equipo, que no se tocaron."] },
  { k: ["celular", "de viaje", "desde mi celular", "desde el celular", "fuera de la tienda", "no estoy en la tienda", "precios desde"], t: "Cambiar precios desde el celular (de viaje)", s: ["En el celular abre la página de Caja Fácil en Chrome (la misma dirección de siempre).", "Toca «Continuar con Google» y entra con la cuenta de Google del dueño (la misma de la caja).", "Sale una ventana: toca «Manejar mi caja desde aquí» y luego «Manejar».", "Cambia precios, productos, stock o ajustes como siempre: le llegan solos a la caja en un minuto si está prendida y con internet.", "El celular lo recuerda: la próxima vez entra directo. Para dejar de manejarla toca «Salir» arriba."] },
  { k: ["pantalla completa", "f11", "barra de windows", "barra de tareas", "maximizar"], t: "Pantalla completa", s: ["Toca «Completa» en el menú de la izquierda (abajo, junto a «Ocultar»): la caja ocupa toda la pantalla, sin la barra de Windows.", "Para volver, toca «Normal» o mantén apretada la tecla Esc.", "La caja lo recuerda en ese equipo: al abrirla otra vez entra sola en pantalla completa con el primer clic o el primer producto que escanees."] },
  { k: ["redondear", "redondeo", "centimos", "redondea"], t: "Redondear el total", go: "aj.cobros", s: ["La caja redondea el total sola a los 10 céntimos más cercanos: S/ 1.92 → S/ 1.90 y S/ 1.95 → S/ 2.00.", "En el ticket y en el comprobante sale como «Redondeo».", "Se apaga o se prende en Ajustes › Cobros y puntos › Redondeo."] },
  { k: ["vitrina", "afiche", "oferta", "promocion", "anuncio", "aviso", "imagen", "publicidad", "cartel", "dibuja", "2x1", "combo", "lista de precios", "pizarra", "estilo", "ideas"], t: "Afiches para la vitrina", go: "aj.venta", s: ["Pídemelo aquí: «haz una oferta de Inca Kola a 2.90 hasta el domingo», «2x1 en yogur», «lleva 3 paga 2 en atún», «lista de precios de frutas», «oferta de papaya 3.50, mango 5 y plátano 2» o «aviso: hoy cerramos a las 9 pm».", "Elige el estilo con un toque: Clásico, A mano, Súper, Pizarra, Encarte, Verde, Fiestas Patrias, Navidad o Día de la Madre. También puedes decirlo: «… estilo pizarra».", "Si la oferta baja el precio, marca «Cobrar … en la caja» y la caja cobra ese precio hasta la fecha del afiche.", "Escribe «¿qué oferta hago?» y te propongo afiches con lo que vence pronto o no se vende.", "En Ajustes › Pantalla de venta ves todas: ocultar, ordenar, editar y cada cuántos segundos cambian. «Dibuja …» hace un dibujo con IA (necesita internet y el extra de IA)."] },
  { k: ["soporte", "contacto", "ayuda humana", "hablar con alguien"], t: "Hablar con una persona", go: "aj.nube", s: ["En Ajustes › Nube puedes darle permiso a soporte por 24 horas o 7 días.", "También puedes escribir por WhatsApp al 904 623 137."] }
];
function helpKB(text) {
  const n = " " + hn(text) + " ";
  let best = null, bs = 0;
  for (const e of HELP_KB) {
    const sc = e.k.reduce((t, k) => t + (n.includes(k.length < 4 ? " " + k + " " : k) ? 1 : 0), 0);
    if (sc > bs) { bs = sc; best = e; }
  }
  return best;
}
const helpKBText = (e) => `${e.t}:\n${e.s.map((x, i) => `${i + 1}. ${x}`).join("\n")}`;

/* ---------- el chat ---------- */
const helpReduced = () => document.documentElement.classList.contains("lite") || (window.matchMedia && matchMedia("(prefers-reduced-motion:reduce)").matches);
function helpType(el, text, done) {
  if (helpReduced() || text.length < 40) { el.textContent = text; return done(); }
  const parts = text.split(/(\s+)/), step = Math.max(2, Math.ceil(parts.length / 24)); let i = 0;
  const tick = () => {
    if (!el.isConnected) return done();
    i = Math.min(parts.length, i + step); el.textContent = parts.slice(0, i).join("");
    const l = $("#helpMessages"); if (l) l.scrollTop = l.scrollHeight;
    if (i >= parts.length) done(); else setTimeout(tick, 26);
  };
  tick();
}
function helpGoBtns(keys) {
  const ok = [...new Set(keys)].map((k) => [k, helpDest(k)]).filter((x) => x[1]).slice(0, 3);
  if (!ok.length) return null;
  const w = document.createElement("div"); w.className = "hl-go";
  w.innerHTML = ok.map(([k, d]) => `<button type="button" class="hl-gob" data-a="ayudaIr" data-k="${k}"><span>Ir a ${esc(d[2])}</span>${svg("next")}</button>`).join("");
  return w;
}
function helpAppend(role, text, o) {
  o = o || {};
  const list = $("#helpMessages"); if (!list) return null;
  const item = document.createElement("div");
  item.className = "help-message " + (role === "assistant" ? "assistant" : "user") + (o.temporary ? " temporary" : "");
  item.setAttribute("role", "listitem");
  const body = document.createElement("span"); body.className = "help-message-text"; item.appendChild(body);
  const extras = () => {
    [o.node, o.go && helpGoBtns(o.go)].forEach((n) => { if (n) item.appendChild(n); });
    list.scrollTop = list.scrollHeight;
  };
  list.appendChild(item);
  if (o.temporary) {
    body.innerHTML = '<span class="hl-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="hl-tt"></span>';
    body.lastChild.textContent = text;
  } else if (role === "assistant" && text && !o.instant) helpType(body, String(text), extras);
  else { body.textContent = String(text || ""); extras(); }
  if (!body.textContent && !o.temporary) body.remove();
  list.scrollTop = list.scrollHeight;
  return item;
}
function helpSay(text, o) { // respuesta de Luis que también queda en la conversación
  helpMessages.push({ role: "assistant", content: String(text).slice(0, 1200) });
  if (helpMessages.length > 10) helpMessages = helpMessages.slice(-10);
  return helpAppend("assistant", text, o);
}
function helpOpen() {
  const panel = $("#helpChat"), launch = $("#helpLauncher");
  if (!panel) return;
  panel.hidden = false;
  if (launch) launch.hidden = true;
  if (!helpMessages.length) {
    const hello = vozOk()
      ? "Hola, soy Luis. Pregúntame cómo se hace algo o dame una orden, por ejemplo «anota 2 leches» o «cuánto vendí hoy». Antes de tocar algo te pido que aceptes."
      : "Hola, soy Luis. Pregúntame cómo se hace algo en Caja Fácil y te llevo a la pantalla correcta. Tampoco cambio tus datos por mi cuenta.";
    helpMessages.push({ role: "assistant", content: hello });
    helpAppend("assistant", hello);
  }
  helpStatus(); clearInterval(helpTick); helpTick = setInterval(helpStatus, 1200);
  const input = $("#helpInput");
  if (input) setTimeout(() => input.focus(), 0);
}
function helpClose() {
  const panel = $("#helpChat"), launch = $("#helpLauncher");
  if (panel) panel.hidden = true;
  if (launch) launch.hidden = false;
  clearInterval(helpTick);
}
function helpError(status, code) {
  if (status === 401) return "Tu sesión venció. Vuelve a entrar con Google y prueba otra vez.";
  if (status === 403 || status === 429) return "El chat no está disponible ahora para esta cuenta o alcanzó su límite diario. Consulta al proveedor de Caja Fácil.";
  if (status === 503 || code === "sin_ia") return "El servicio de ayuda aún no está configurado. Consulta al proveedor de Caja Fácil.";
  return "";
}

/* ---------- órdenes escritas (mismo intérprete que la voz) ---------- */
const HELP_Q = /^(como|donde|por que|porque|para que|que es|que significa|que hago|que pasa|cuando|puedo|se puede|no puedo|no me|no funciona|no sale|no aparece|ayuda|explica|ensena|dime como|tengo un problema|me sale|me salio|me aparece|error)\b/;
function helpAnswerNode(rs) {
  const w = document.createElement("div"); w.className = "hl-ans";
  w.innerHTML = rs.map((r) => `<div class="hl-at">${esc(r.title)}</div>${r.big ? `<div class="hl-big num">${esc(r.big)}</div>` : ""}<p>${esc(r.w)}</p>${r.rows && r.rows.length ? `<div class="hl-rows">${r.rows.slice(0, 8).map(([l, v, f]) => `<div class="hl-row"><span>${esc(l)}</span><b class="num">${esc(v)}</b>${f != null && f !== false ? `<i style="transform:scaleX(${Math.max(.04, Math.min(1, +f || 0))})"></i>` : ""}</div>`).join("")}</div>` : ""}`).join("");
  return w;
}
function helpPlanCard(plan, texto) {
  const id = ++helpCardN, ok = plan.some((x) => x.ok), w = document.createElement("div");
  w.className = "hl-card"; helpCards[id] = { plan, texto };
  w.innerHTML = `${ok ? '<div class="hl-ch"><i aria-hidden="true"></i>Entendí</div>' : ""}
    <div class="hl-cl">${plan.map((x, i) => `<div class="hl-pl ${x.ok ? "" : "bad"}" style="--i:${i}"><span class="hl-pi">${svg(x.ok ? "check" : "close")}</span><span>${esc(x.rc ? `${x.rc.q} ${x.rc.n}` : x.txt)}${x.pick ? `<span class="hl-pick">${x.pick.map((pk, k) => `<button type="button" class="hl-b sec" data-a="ayudaPick" data-id="${id}" data-i="${i}" data-j="${k}">${esc(pk.label)}</button>`).join("")}</span>` : ""}</span></div>`).join("")}</div>
    ${ok ? `<div class="hl-cb"><button type="button" class="hl-b sec" data-a="ayudaNo" data-id="${id}">Cancelar</button><button type="button" class="hl-b" data-a="ayudaSi" data-id="${id}">Aceptar</button></div>` : ""}`;
  helpCards[id].el = w;
  return w;
}
// Devuelve true si el texto era una orden y ya se atendió.
function helpTryCommand(text) {
  if (!vozOk() || HELP_Q.test(hn(text))) return false;
  let acc, plan;
  try { acc = vzParse(text); if (!acc || !acc.length) return false; plan = vzPlan(acc); } catch (e) { return false; }
  if (!plan || !plan.length) return false;
  if (plan.every((x) => x.ok && x.ans)) {
    const rs = plan.map((x) => { try { return x.ans(); } catch (e) { return null; } }).filter(Boolean);
    if (!rs.length) return false;
    helpSay(rs.map((r) => `${r.title}: ${r.w}`).join(" "), { node: helpAnswerNode(rs), instant: true });
    return true;
  }
  helpSay(plan.some((x) => x.ok) ? "Esto es lo que entendí. ¿Lo hago?" : plan.some((x) => x.pick) ? "Elige uno:" : "No pude hacerlo:", { node: helpPlanCard(plan, text), instant: true });
  return true;
}
function helpNavIntent(n) {
  const m = n.match(/^(llevame|llevarme|vamos|ir|abre|abreme|abrir|muestrame|muestra|mostrar|quiero ir|quiero ver|anda)( a| al| a la| a los| a las| el| la| los| las| mi| mis)* (.+)$/);
  if (!m || m[3].split(" ").length > 6 || /\d|\bcon\b/.test(m[3])) return null;
  const hit = HELP_NAV.find(([k]) => (" " + m[3] + " ").includes(" " + k + " ") || (k.length > 5 && m[3].includes(k)));
  return hit ? hit[1] : null;
}

/* ---------- enviar ---------- */
async function helpSend(value) {
  const input = $("#helpInput"), textValue = String(value == null && input ? input.value : value || "").trim().slice(0, 1200);
  if (!textValue || helpBusy) return;
  if (input) input.value = "";
  helpAppend("user", textValue, { instant: true });
  helpMessages.push({ role: "user", content: textValue });
  const n = hn(textValue);
  // 1) «llévame a productos»: no hace falta IA
  const nav = helpNavIntent(n);
  if (nav && helpDest(nav)) { helpSay("Te llevo a " + HELP_DEST[nav][2] + ".", { go: [nav], instant: true }); setTimeout(() => helpGo(nav), 120); return; }
  // 2) afiches e imágenes para la vitrina (gratis; el dibujo con IA pide internet)
  if (vitLuis(textValue)) return;
  // 3) órdenes
  if (helpTryCommand(textValue)) return;
  // 3) sin internet: pasos guardados
  if (!cloudOn() || navigator.onLine === false) {
    const kb = helpKB(textValue);
    if (kb) return void helpSay(helpKBText(kb), { go: [kb.go] });
    return void helpSay("Sin internet no puedo usar la IA, pero la caja sigue vendiendo." + (vozOk() ? " Aún puedo hacer órdenes como «anota 2 leches» o «cuánto vendí hoy»." : " Prueba con palabras como «cobrar», «caja» o «proveedor» y te muestro los pasos."));
  }
  // 4) la IA
  helpBusy = true; $("#helpChat").classList.add("busy");
  const send = $("#helpSend");
  if (send) send.disabled = true;
  const waiting = helpAppend("assistant", "Pensando…", { temporary: true });
  try {
    const session = cloudLoad(), token = await cloudToken();
    const r = await fetch(SB_URL + "/functions/v1/ayuda", {
      method: "POST",
      headers: { apikey: SB_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ neg: session.neg, mensajes: helpMessages.slice(-8), pantalla: helpScreen(), ordenes: vozOk() }),
      signal: AbortSignal.timeout(30000)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error("ayuda"), { status: r.status, code: data.error });
    let answer = String(data.respuesta || "").trim().slice(0, 2200);
    const go = [...answer.matchAll(/\[\[ir:([a-z.]+)\]\]/g)].map((x) => x[1]).filter((k) => HELP_DEST[k]);
    answer = answer.replace(/\[\[ir:[a-z.]*\]\]/g, "").replace(/\n{3,}/g, "\n\n").trim() || "No recibí una respuesta. Cuéntame qué pantalla estás usando y qué pasó.";
    if (waiting) waiting.remove();
    helpSay(answer, { go });
  } catch (e) {
    if (waiting) waiting.remove();
    const msg = helpError(e.status || 0, e.code || "");
    if (msg) helpSay(msg);
    else {
      const kb = helpKB(textValue);
      helpSay(kb ? "No pude conectar con la IA. Esto es lo que tengo guardado:\n" + helpKBText(kb) : "No pude conectar con la IA. Revisa tu conexión e inténtalo otra vez.", kb ? { go: [kb.go] } : {});
    }
  } finally {
    if (waiting) waiting.remove();
    helpBusy = false; $("#helpChat").classList.remove("busy");
    if (send) send.disabled = false;
    if (input) input.focus();
  }
}

/* ---------- «Pedir ayuda a Luis» cuando sale un aviso ---------- */
// Solo se manda el texto del aviso y el nombre de la pantalla, nada del negocio.
function helpToastAdd(t, msg) {
  helpLastErr = String(msg || "");
  const chat = $("#helpChat");
  if (!/\b(no|error|falta|fallo|sin|elige|revisa|invalid|incorrect|vencid|necesit|debes|solo)\b/i.test(hn(msg)) || (chat && !chat.hidden)) return;
  const b = document.createElement("button"); b.type = "button"; b.className = "tbtn"; b.dataset.a = "ayudaError"; b.textContent = "Pedir ayuda a Luis";
  t.appendChild(b);
}

const helpForm = $("#helpForm");
if (helpForm) helpForm.addEventListener("submit", (e) => { e.preventDefault(); helpSend(); });
const helpPanel = $("#helpChat");
if (helpPanel) helpPanel.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); helpClose(); const l = $("#helpLauncher"); if (l) l.focus(); } });
act({
  ayudaAbrir: helpOpen,
  ayudaCerrar: helpClose,
  ayudaChip: (el) => helpSend(el.dataset.q),
  ayudaIr: (el) => helpGo(el.dataset.k),
  ayudaError: () => { const e = helpLastErr; helpOpen(); if (e) helpSend("Me salió este aviso: «" + e.slice(0, 200) + "». ¿Qué hago?"); },
  ayudaSi: (el) => {
    const c = helpCards[el.dataset.id]; if (!c || c.done) return; c.done = true;
    const bar = c.el.querySelector(".hl-cb"); if (bar) bar.outerHTML = `<div class="hl-done">${svg("check")}Hecho</div>`;
    const abre = c.plan.some((x) => x.ok && x.run);
    vz = { plan: c.plan, texto: c.texto }; vozAccept();
    if (abre) { helpClose(); return; }
    helpSay(c.plan.some((x) => x.ok && x.add) ? "Listo, ya está en tu ticket." : "Listo.", { go: c.plan.some((x) => x.ok && x.add) ? ["venta"] : [], instant: true });
  },
  // «¿cuál?»: tocas el que quieres y la tarjeta se vuelve a armar con ese
  ayudaPick: (el) => {
    const c = helpCards[el.dataset.id]; if (!c || c.done) return;
    const i = +el.dataset.i, pk = c.plan[i] && c.plan[i].pick && c.plan[i].pick[+el.dataset.j]; if (!pk) return;
    c.plan[i] = vzPlan([pk.a], c.plan.filter((_, k) => k !== i))[0];
    c.done = true; c.el.replaceWith(helpPlanCard(c.plan, c.texto));
  },
  ayudaNo: (el) => {
    const c = helpCards[el.dataset.id]; if (!c || c.done) return; c.done = true;
    const bar = c.el.querySelector(".hl-cb"); if (bar) bar.outerHTML = `<div class="hl-done no">${svg("close")}Cancelado</div>`;
    helpSay("Cancelado. No cambié nada.", { instant: true });
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
  const ok = list.filter((s) => !s.void), A = { n: ok.length, gross: 0, ret: 0, net: 0, cost: 0, by: {}, byN: {}, day: {}, hour: {}, cat: {}, prod: {}, user: {}, doc: {}, store: {}, voids: list.length - ok.length };
  ok.forEach((s) => {
    A.gross = r2(A.gross + s.total); A.ret = r2(A.ret + (s.ret || 0));
    s.pays.forEach((p) => { A.by[p.m] = r2((A.by[p.m] || 0) + p.amt); });
    new Set(s.pays.map((p) => p.m)).forEach((m) => { A.byN[m] = (A.byN[m] || 0) + 1; });
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
/* Reportes «te lo cuenta en palabras» (opción 3 de David, 26 oct 2026): frase del periodo, los 5 números de siempre,
   «Cómo te pagaron» ordenado por medio y tarjetas con lo importante (mejor hora, mejor día, estrella, a pérdida, fiado…). El detalle sigue abajo. */
const RP_IC = {
  hora: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3 2 6M19 3l3 3"/>', dia: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  star: '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/>', warn: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  fiado: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6"/>', cat: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>', ret: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'
};
const rpI = (k) => `<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${RP_IC[k]}</svg>`;
const rpSuf = (h) => (h % 24 < 12 ? "a. m." : "p. m."), rpHora = (h) => (rpSuf(h) === rpSuf(h + 1) ? `${h % 12 || 12} a ${(h + 1) % 12 || 12} ${rpSuf(h)}` : `${h % 12 || 12} ${rpSuf(h)} a ${(h + 1) % 12 || 12} ${rpSuf(h + 1)}`);
// Barras con punta redondeada; la más alta resaltada con su monto. Cada barra dice su valor al pasar el mouse.
function rpBars(vals, labels, tips) {
  const n = vals.length, W = Math.max(440, n * 34), H = 120, mx = Math.max(1, ...vals), hi = vals.indexOf(Math.max(...vals)), bw = W / n, ww = Math.min(34, bw * 0.64);
  return `<svg class="rpbars" viewBox="0 0 ${W} ${H + 22}" role="img" aria-label="${esc(tips[hi] || "")}">${vals.map((v, i) => {
    const bh = v > 0 ? Math.max(3, (v / mx) * (H - 22)) : 2, x = i * bw + (bw - ww) / 2, y = H - bh, r = Math.min(4, bh / 2);
    return `<g><title>${esc(tips[i])}</title><rect x="${x - (bw - ww) / 2}" y="0" width="${bw}" height="${H}" fill="transparent" stroke="none"/><path d="M${x},${H} V${y + r} Q${x},${y} ${x + r},${y} H${x + ww - r} Q${x + ww},${y} ${x + ww},${y + r} V${H} Z" class="${i === hi && v > 0 ? "hi" : ""}"/>${n <= 24 ? `<text x="${x + ww / 2}" y="${H + 16}" text-anchor="middle">${labels[i]}</text>` : ""}</g>`;
  }).join("")}<line x1="0" x2="${W}" y1="${H}" y2="${H}" class="base"/></svg>`;
}
VIEWS.rep = function viewReports(v) {
  const [from, to] = rangeKeys(ui.range, ui.from, ui.to), scope = Object.keys(DB.stores).length ? ui.rscope : "local";
  const list = repSales(from, to, scope), A = aggregate(list), costs = can("costos");
  const keys = []; for (let k = from; k <= to && keys.length < 62; k = addD(k, 1)) keys.push(k);
  const hk = Object.keys(A.hour).map(Number), h0 = Math.min(7, ...hk), h1 = Math.max(21, ...hk), hours = Array.from({ length: h1 - h0 + 1 }, (_, i) => i + h0);
  const moves = scope === "local" ? DB.moves.filter((m) => m.date >= from && m.date <= to) : [];
  const mv = (t) => r2(moves.filter((m) => m.type === t).reduce((a, m) => a + m.amount, 0));
  const credit = A.by.credito || 0, abonos = mv("abono"), yapeMan = mv("yape"), net = r2(A.net + yapeMan);
  const shifts = scope === "local" ? DB.shifts.filter((s) => s.d0 >= from && s.d0 <= to).sort((a, b) => a.t0 - b.t0) : [];
  const top = Object.entries(A.prod).sort((a, b) => b[1].m - a[1].m).slice(0, 12);
  ui.repData = { from, to, A, shifts, scope, top };
  // Periodo anterior del mismo largo, para decir «12% más que ayer».
  const len = keys.length, pf = addD(from, -len), pt = addD(from, -1);
  const P = aggregate(repSales(pf, pt, scope)), pYape = scope === "local" ? r2(DB.moves.filter((m) => m.type === "yape" && m.date >= pf && m.date <= pt).reduce((a, m) => a + m.amount, 0)) : 0, pNet = r2(P.net + pYape);
  const delta = pNet > 0 ? Math.round(((net - pNet) / pNet) * 100) : null;
  const lab = { hoy: "Hoy", ayer: "Ayer", "7d": "En estos 7 días", mes: "Este mes", mesant: "El mes pasado" }[ui.range] || (from === to ? `El ${fmtDate(from).toLowerCase()}` : `Del ${dmy(from)} al ${dmy(to)}`);
  const plab = { hoy: "ayer", ayer: "anteayer", "7d": "los 7 días anteriores", mes: "el mismo tramo del mes anterior", mesant: "el mes anterior" }[ui.range] || "el periodo anterior";
  const lead = A.n || yapeMan ? `${lab} vendiste <b class="rpg num">${money(net)}</b> en <b>${A.n === 1 ? "1 venta" : A.n + " ventas"}</b>${delta !== null && delta !== 0 ? `, <b class="${delta > 0 ? "rpg" : "rpo"}">${Math.abs(delta)}% ${delta > 0 ? "más" : "menos"} que ${plab}</b>` : ""}.${costs && A.n ? ` Te quedaron <b class="num">${money(A.profit)}</b> de ganancia` : ""}${credit ? `${costs && A.n ? " y" : ""} fiaste <b class="rpo num">${money(credit)}</b>` : ""}${(costs && A.n) || credit ? "." : ""}`
    : `${lab} todavía no hay ventas.`;
  // Cómo te pagaron: cada medio del que más entró al que menos; los Yapes anotados a mano van junto a Yape.
  const pays = Object.keys(METHODS).map((m) => ({ m, amt: r2((A.by[m] || 0) + (m === "yape" ? yapeMan : 0)), n: A.byN[m] || 0, man: m === "yape" ? yapeMan : 0 })).filter((x) => x.amt > 0).sort((a, b) => b.amt - a.amt);
  const psum = pays.reduce((a, x) => a + x.amt, 0), pmax = pays.length ? pays[0].amt : 1;
  const raro = yapeMan > 1000 && yapeMan > (A.net || 0) * 0.6;
  const payCard = `<div class="card rppay"><h2>Cómo te pagaron <b class="num">${money(psum)}</b></h2>
    ${pays.length ? `<div class="rpstk" role="img" aria-label="${pays.map((x) => `${METHODS[x.m]} ${Math.round((x.amt / psum) * 100)}%`).join(", ")}">${pays.map((x) => `<i class="m-${x.m}" style="flex:${x.amt}" title="${METHODS[x.m]}: ${money(x.amt)}"></i>`).join("")}</div>
    <div class="rpms" style="--c:${Math.min(6, pays.length)};--c2:${pays.length > 4 ? Math.ceil(pays.length / 2) : pays.length}">${pays.map((x, i) => `<div class="rpm${i === 0 && pays.length > 1 ? " best" : ""}"><span class="rpmh"><i class="pmi m-${x.m}" aria-hidden="true"></i>${METHODS[x.m]}${i === 0 && pays.length > 1 ? `<em>El más usado</em>` : ""}</span><b class="num">${money(x.amt)}</b>
      <span class="rpbar"><i class="m-${x.m}" style="width:${Math.max(3, (x.amt / pmax) * 100).toFixed(1)}%"></i></span><small>${Math.round((x.amt / psum) * 100)}%${x.n ? ` · ${x.n} ${x.n === 1 ? "venta" : "ventas"}` : ""}</small>
      ${x.man ? `<small class="${raro ? "rpraro" : ""}">${money(x.man)} anotados a mano${raro ? " · ¿está bien? Revísalo en Caja" : ""}</small>` : ""}</div>`).join("")}</div>`
      : `<p class="muted">Sin ventas en este periodo.</p>`}</div>`;
  // Tarjetas con lo importante (solo las que tienen algo que decir).
  const cards = [];
  if (A.n) {
    const hb = hours.reduce((a, h) => ((A.hour[h] || 0) > (A.hour[a] || 0) ? h : a), hours[0]), hlow = hours.filter((h) => h >= 8 && h <= 20).reduce((a, h) => ((A.hour[h] || 0) < (A.hour[a] || 0) ? h : a), 8);
    cards.push(["hora", "g", `Tu mejor hora fue de ${rpHora(hb)}`, `Vendiste ${money(A.hour[hb] || 0)} en esa hora.${(A.hour[hlow] || 0) < (A.hour[hb] || 0) * 0.25 ? ` De ${rpHora(hlow)} casi no entra nadie.` : ""}`, rpBars(hours.map((h) => A.hour[h] || 0), hours.map((h) => h), hours.map((h) => `${h}:00 · ${money(A.hour[h] || 0)}`))]);
  }
  if (keys.length > 1 && A.n) {
    const bd = keys.reduce((a, k) => ((A.day[k] || 0) > (A.day[a] || 0) ? k : a), keys[0]);
    cards.push(["dia", "b", `Tu mejor día fue el ${fmtDate(bd).toLowerCase() === "hoy" || fmtDate(bd) === "Ayer" ? fmtDate(bd).toLowerCase() : PV_DOW[pk(bd).getDay()] + " " + pk(bd).getDate()}`, `Vendiste ${money(A.day[bd] || 0)}. En promedio vendes ${money(A.net / keys.length)} por día.`, rpBars(keys.map((k) => A.day[k] || 0), keys.map((k) => (keys.length > 10 ? pk(k).getDate() : ["D", "L", "M", "M", "J", "V", "S"][pk(k).getDay()])), keys.map((k) => `${dmy(k)} · ${money(A.day[k] || 0)}`))]);
  }
  if (top.length) {
    const [n, o] = top[0];
    cards.push(["star", "g", `${esc(n)} fue tu estrella`, `${fmtQ(o.q)}${o.unit === "kg" ? " kg" : ""} vendidos, ${money(o.m)}${costs && o.c ? ` y ${money(o.m - o.c)} de ganancia` : ""}.`, `<div class="rptop">${top.slice(1, 5).map(([n2, o2]) => `<div><span>${esc(n2)}</span><b class="num">${money(o2.m)}</b></div>`).join("")}</div>`]);
  }
  const loss = costs ? Object.entries(A.prod).filter(([, o]) => o.c > 0 && o.m - o.c < -0.009).sort((a, b) => (a[1].m - a[1].c) - (b[1].m - b[1].c)) : [];
  if (loss.length) cards.push(["warn", "w", loss.length === 1 ? `${esc(loss[0][0])}: lo vendes a pérdida` : `${loss.length} productos los vendes a pérdida`, `Te cuestan más de lo que los vendes. Revisa su precio en Productos.`, `<div class="rptop">${loss.slice(0, 4).map(([n, o]) => `<div><span>${esc(n)}</span><b class="num rpo">− ${money(o.c - o.m)}</b></div>`).join("")}</div>`]);
  const cats = Object.entries(A.cat).sort((a, b) => b[1] - a[1]);
  if (cats.length > 1) cards.push(["cat", "b", `Lo que más se vende: ${esc(cats[0][0])}`, `${Math.round((cats[0][1] / (A.net || 1)) * 100)}% de lo vendido.`, hbars(A.cat, money, 4)]);
  if (credit || abonos) {
    const debe = DB.clients.reduce((a, c) => a + balanceOf(c), 0);
    cards.push(["fiado", "o", credit ? `Fiaste ${money(credit)}` : `Te pagaron deudas`, `${abonos ? `Te pagaron ${money(abonos)} de deudas.` : "Nadie pagó deudas en este periodo."}${debe ? ` Tus clientes te deben ${money(debe)} en total.` : ""}`, ""]);
  }
  if (A.ret || A.voids) cards.push(["ret", "n", `Devoluciones y anuladas`, `${A.ret ? `Devolviste ${money(A.ret)}.` : ""}${A.voids ? ` ${A.voids === 1 ? "Se anuló 1 venta" : `Se anularon ${A.voids} ventas`}.` : ""}`, ""]);
  v.innerHTML = `<div class="ph"><h1>Reportes</h1><div class="row wrap"><button class="btn sec sm" data-a="repprint">${svg("print", "bi")}Imprimir</button><button class="btn sec sm" data-a="vcsv">Exportar ventas</button></div></div>
    ${Object.keys(DB.stores).length ? `<div class="seg tabs2"><button class="${scope === "local" ? "on" : ""}" data-a="rscope" data-s="local">Esta tienda</button><button class="${scope === "todas" ? "on" : ""}" data-a="rscope" data-s="todas">Todas las tiendas (${Object.keys(DB.stores).length + 1})</button></div>` : ""}
    ${rangeBar()}
    <div class="card rplead"><p>${lead}</p></div>
    <div class="kpis">
      <div class="kpi main"><span>Ventas netas</span><b class="num">${money(net)}</b><small>${from === to ? fmtDate(from) : dmy(from) + " – " + dmy(to)}${delta !== null && delta !== 0 ? ` · <span class="${delta > 0 ? "rpup" : "rpdn"}">${delta > 0 ? "▲" : "▼"} ${Math.abs(delta)}% vs ${plab}</span>` : ""}</small></div>
      <div class="kpi"><span>Ventas</span><b class="num">${A.n}</b><small>Ticket promedio ${money(A.avg)}</small></div>
      ${costs ? `<div class="kpi"><span>Ganancia estimada</span><b class="num">${money(A.profit)}</b><small>Margen ${A.net ? Math.round((A.profit / A.net) * 100) : 0}%</small></div>` : ""}
      <div class="kpi"><span>Al crédito</span><b class="num">${money(credit)}</b><small>Cobrado de deudas ${money(abonos)}</small></div>
      <div class="kpi"><span>Devoluciones</span><b class="num">${money(A.ret)}</b><small>${A.voids} anuladas</small></div></div>
    ${payCard}
    ${cards.length ? `<div class="rpins">${cards.map(([ic, tone, t, d, extra]) => `<div class="card rpin t-${tone}"><span class="rpic">${rpI(ic)}</span><h3>${t}</h3><p>${d}</p>${extra}</div>`).join("")}</div>` : ""}
    <h2 class="rpsec">Más detalle</h2>
    <div class="cols stack"><div class="stack">
      <div class="card"><h2>Productos más vendidos</h2>${top.length ? `<div class="tablewrap"><table class="tbl"><thead><tr><th>Producto</th><th class="r">Cant.</th><th class="r">Vendido</th>${costs ? `<th class="r">Ganancia</th>` : ""}</tr></thead><tbody>${top.map(([n, o]) => `<tr><td>${esc(n)}</td><td class="r num">${fmtQ(o.q)}${o.unit === "kg" ? " kg" : ""}</td><td class="r num">${money(o.m)}</td>${costs ? `<td class="r num ${o.m - o.c < 0 ? "loss" : ""}">${money(o.m - o.c)}</td>` : ""}</tr>`).join("")}</tbody></table></div>` : `<p class="muted">Sin ventas en este periodo.</p>`}</div>
      <div class="card"><h2>Por categoría</h2>${hbars(A.cat)}</div>
      <div class="card"><h2>Por cajero o vendedor</h2>${Object.keys(A.user).length ? `<table class="tbl"><thead><tr><th>Usuario</th><th class="r">Ventas</th><th class="r">Total</th><th class="r">Promedio</th></tr></thead><tbody>${Object.entries(A.user).sort((a, b) => b[1].m - a[1].m).map(([u, o]) => `<tr><td>${esc(u)}</td><td class="r num">${o.n}</td><td class="r num">${money(o.m)}</td><td class="r num">${money(o.m / o.n)}</td></tr>`).join("")}</tbody></table>` : `<p class="muted">Sin datos.</p>`}</div>
    </div><div class="stack">
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
const ATABS_BASIC = ["negocio", "cobros", "venta", "usuarios", "datos"]; // lo de todos los días; el resto va en «Más opciones»
const ATABS = [["negocio", "Negocio"], ["comp", "Comprobantes"], ["cobros", "Cobros y puntos"], ["venta", "Pantalla de venta"], ["balanza", "Balanza"], ["usuarios", "Usuarios y permisos"], ["tiendas", "Tiendas"], ["nube", "Nube"], ["datos", "Datos y respaldo"], ["bitacora", "Bitácora"]];
const fld = (label, inner, hint) => `<label class="fld"><span>${label}</span>${inner}${hint ? `<small class="hint2">${hint}</small>` : ""}</label>`;
const inp = (key, val, o = {}) => `<input class="inp ${o.num ? "num" : ""}" data-set="${key}" value="${esc(val ?? "")}" ${o.num ? 'inputmode="decimal"' : ""} ${o.ph ? `placeholder="${esc(o.ph)}"` : ""} maxlength="${o.max || 80}">`;
const tog = (key, on, label, sub) => `<div class="set"><div><b>${label}</b>${sub ? `<small>${sub}</small>` : ""}</div><button class="switch" data-a="tog" data-k="${key}" aria-pressed="${!!on}" aria-label="${esc(label)}"></button></div>`;
const getK = (k) => k.split(".").reduce((o, x) => (o == null ? o : o[x]), DB);
function setK(k, v) { const p = k.split("."), last = p.pop(), o = p.reduce((a, x) => a[x], DB); o[last] = v; }
function dbSize() { try { return new Blob([JSON.stringify(DB)]).size; } catch (e) { return 0; } }
const kb = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");
const ajBtn = ([k, n], t) => `<button class="${t === k ? "on" : ""}" data-a="atab" data-t="${k}">${n}</button>`;
function ajNav(t) {
  const basic = ATABS.filter(([k]) => ATABS_BASIC.includes(k)), more = ATABS.filter(([k]) => !ATABS_BASIC.includes(k));
  const open = ui.amore || more.some(([k]) => k === t);
  return basic.map((x) => ajBtn(x, t)).join("") + `<button class="ajmore" data-a="amore" aria-expanded="${open}">${open ? "Menos opciones" : "Más opciones"}</button>` + (open ? more.map((x) => ajBtn(x, t)).join("") : "");
}
VIEWS.aj = function viewSettings(v) {
  const t = ui.atab, C = DB.cfg, B = DB.biz;
  let body = "";
  if (t === "negocio") body = `${installHtml()}${liteHtml()}<div class="card"><h2>Datos del negocio</h2><p class="muted" style="margin-bottom:10px">Salen en los comprobantes y reportes.</p>
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
      <div class="card"><h2>Redondeo</h2>${tog("cfg.redAuto", C.redAuto !== false, "Redondear el total solo", "A los 10 céntimos más cercanos: S/ 1.92 → S/ 1.90 y S/ 1.95 → S/ 2.00. Sale en el comprobante como «Redondeo».")}</div>
      <div class="card"><h2>Programa de puntos</h2>${tog("cfg.pts.on", C.pts.on, "Dar puntos a clientes registrados", "Acumulan al comprar y los canjean como descuento")}
      ${C.pts.on ? `<div class="two">${fld("Puntos por cada S/ 1", inp("cfg.pts.per", C.pts.per, { num: true }))}${fld("Valor de 1 punto (S/)", inp("cfg.pts.val", C.pts.val, { num: true }), `100 puntos = ${money(100 * C.pts.val)}`)}</div>${fld("Puntos mínimos para canjear", inp("cfg.pts.min", C.pts.min, { num: true }))}` : ""}</div>`;
  else if (t === "venta") body = `<div class="card"><h2>Pantalla de venta</h2>
      ${fld("Cómo se ve la venta", `<div class="seg">${[["scan", "Escáner (minimarket)"], ["tiles", "Fichas con fotos"], ["vit", "Vitrina (prueba)"]].map(([k, n]) => `<button class="${(C.view === "tiles" ? "tiles" : C.view === "vit" ? "vit" : "scan") === k ? "on" : ""}" data-a="setv" data-k="cfg.view" data-v="${k}">${n}</button>`).join("")}</div>`, "Escáner: sin fotos, muestra lo último que pasaste. Fichas: productos con foto para tocar. Vitrina (prueba): mosaico de fotos y búsqueda con foto, con otro ticket")}
      ${fld("Tamaño de las fichas de productos", `<div class="seg">${[["s", "Pequeñas"], ["m", "Medianas"], ["l", "Grandes (táctil)"]].map(([k, n]) => `<button class="${C.tile === k ? "on" : ""}" data-a="setv" data-k="cfg.tile" data-v="${k}">${n}</button>`).join("")}</div>`)}
      ${fld("Mesas o cuentas abiertas", inp("cfg.tables", C.tables, { num: true, ph: "0 = no uso mesas", max: 3 }), "Para restaurantes, juguerías o cuentas que se van sumando")}
      ${tog("cfg.needShift", C.needShift, "Preguntar el sencillo antes del primer cobro", "Apagado: la caja se abre sola al primer cobro y el sencillo se anota después en Caja")}
      ${tog("cfg.negStock", C.negStock, "Permitir vender sin stock", "Si está apagado, avisa cuando no queda")}
      ${tog("cfg.mute", !C.mute, "Sonidos", "Pitido al agregar y cobrar")}
      ${vozOk() ? tog("cfg.vozCalla", !C.vozCalla, "La voz responde hablando", "Si le preguntas «cuánto sale el kilo de tomate» o «cuánto me debe Rosa», te lo dice en voz alta además de escribirlo") : ""}
      ${fld("Bloquear tras minutos sin uso", inp("cfg.lock", C.lock, { num: true, max: 3 }), "0 = nunca. Solo si los usuarios tienen clave")}</div>
      <div class="card" style="margin-top:14px"><h2>Códigos de barras</h2><p class="muted">Con lector USB o Bluetooth no hay nada que configurar: escanea y el producto entra solo al ticket. Sin lector, toca <b>Cámara</b> en la pantalla de venta y apunta con el celular o la webcam.</p><p class="muted" style="margin-top:8px">Para que un producto se reconozca, escribe su código en Productos, en «Código rápido o de barras».</p></div>${C.view === "vit" ? vitEditor() : ""}`;
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
  v.innerHTML = `<div class="ph"><h1>Ajustes</h1></div><div class="aj"><nav class="ajnav">${ajNav(t)}</nav><div class="stack">${body}</div></div>`;
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
function restoreDB(o) { if (REM) return remNo(); DB = normalize(o); ui.user = DB.users[0].id; saveAll(); log("Respaldo restaurado", ""); toast("Respaldo restaurado"); if (needLogin()) loginScreen(); else go("venta"); }
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
  amore: () => { const enMas = !ATABS_BASIC.includes(ui.atab), abierto = ui.amore || enMas; if (abierto) { if (enMas) ui.atab = "negocio"; ui.amore = false; } else ui.amore = true; render(); },
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
  if (el && A[el.dataset.a] && !el.disabled) { e.preventDefault(); if (REM && REM_NO[el.dataset.a]) return remNo(); A[el.dataset.a](el); }
});
// Campos de número (precio, costo, stock, cantidad, monto…): al hacer clic o tocar, el número queda marcado entero
// y lo que escribas lo reemplaza. Solo con el mouse/dedo, nunca cuando la caja pone el cursor por su cuenta.
const NUM_IN = "input.num, input[inputmode=decimal], input[inputmode=numeric]";
document.addEventListener("pointerdown", (e) => { const t = e.target; if (t && t.matches && t.matches(NUM_IN) && document.activeElement !== t) t._selAll = true; }, true);
// Buscadores (Productos, Vender, Clientes…): cada clic marca todo lo escrito, así lo nuevo reemplaza sin borrar con la X (pedido de David).
const SEARCH_IN = "#pq, #q, input[type=search]";
document.addEventListener("pointerdown", (e) => { const t = e.target; if (t && t.matches && t.matches(SEARCH_IN)) t._selAll = true; }, true);
// Con el mouse se marca al soltar y se evita que Chrome desmarque (si ya estaba marcado lo desmarcaba al soltar); con el dedo, en el clic.
document.addEventListener("mouseup", (e) => { const t = e.target; if (t && t._selAll) { t._selAll = false; if (t.value) { e.preventDefault(); try { t.select(); } catch (er) {} } } }, true);
document.addEventListener("click", (e) => { const t = e.target; if (t && t._selAll) { t._selAll = false; if (t.value) try { t.select(); } catch (er) {} } }, true);
function keepFocus(id, fn) {
  const el = $("#" + id), pos = el ? el.selectionStart : null; fn();
  const n = $("#" + id); if (n) { n.focus(); try { if (pos != null) n.setSelectionRange(pos, pos); } catch (e) {} }
}
let lqT, qT;
document.addEventListener("input", (e) => {
  const t = e.target, id = t.id;
  // Buscar mientras se escribe. Si son solo números largos (el lector de barras está escribiendo un código), se espera más:
  // el lector termina con Enter y la lista no hace falta (antes se buscaba y ordenaba todo con cada número).
  if (id === "q") {
    ui.q = t.value; ui.vsel = 0; clearTimeout(qT);
    const v = ui.q.trim(), now = performance.now(), rapido = now - (ui.qT0 || 0) < 45; ui.qT0 = now; // el lector escribe una tecla cada pocos ms
    qT = setTimeout(paintGrid, rapido || /^\d{5,}$/.test(v) ? 350 : /^\d+$/.test(v) ? 120 : v.length > 1 ? 70 : 0); // un número suelto también espera: puede ser el lector empezando
  }
  else if (id === "pq") { ui.pq = t.value; clearTimeout(qT); qT = setTimeout(paintPList, 70); }
  else if (id === "cq") { ui.cq = t.value; paintCList(); }
  else if (id === "vq") { ui.vq = t.value; const [f, to] = rangeKeys(ui.range, ui.from, ui.to); paintVList(f, to); }
  else if (id === "pcq") { ui.pcq = t.value; const l = $("#pclist"); if (l && ui.pclist) l.innerHTML = ui.pclist(); }
  else if (id === "imgq") { const g = $("#imggrid"); if (g && ui.imgdraw) g.innerHTML = ui.imgdraw(t.value); }
  else if (id === "lq") { clearTimeout(lqT); lqT = setTimeout(() => { ui.lq = t.value; keepFocus("lq", render); }, 250); }
  else if (id === "wq") { ui.lq2 = t.value; keepFocus("wq", () => learnOpen(ui.lc)); }
  else if (id === "trfq") { ui.trfq = t.value; trfRead(); keepFocus("trfq", openTransfer); }
  else if (t.dataset.in === "recv" && ui.pay) { ui.pay.recv = t.value; updPay(); }
  else if (id === "pref" && ui.pay) ui.pay.ref = t.value;
  else if (id === "imp") updImport();
  else if (id && id.slice(0, 3) === "vt-") { const k = id.slice(3); vitSet(k === "bg" ? { bg: t.value } : { [k]: +t.value }, true); vitLive(); }
  else if (t.dataset.vtx) { const f = t.dataset.vtx; vitTxSet(t.dataset.id, { [f]: f === "s" ? +t.value : t.value }, true); vitLive(); }
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
  if (k === "vitfile") { ui.vrepl = !!t.dataset.repl; vitLoad(t.files[0]); t.value = ""; return; }
  if ((t.id && t.id.slice(0, 3) === "vt-") || t.dataset.vtx) { save(); return; }
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
// Cobro con flechas. En los medios de pago ← → pasan al anterior/siguiente en orden (y queda elegido); ↓ baja a los
// billetes o al botón de cobrar. Ahí las flechas se mueven a lo que está al lado/arriba/abajo, y ↑ desde la fila de
// arriba vuelve a los medios. Enter cobra con lo marcado.
function payNav(k) {
  const vis = (x) => x && x.offsetParent !== null && !x.disabled;
  const mths = $$("#modal .mth").filter(vis), on = $("#modal .mth.on");
  const body = [...$$("#modal .paybody .bill"), ...$$("#modal .paybody #payok"), ...$$("#modal .paybody [data-a=payother]")].filter(vis);
  let cur = document.activeElement;
  if (!mths.includes(cur) && !body.includes(cur)) cur = on;
  if (!cur) return;
  const pick = (el) => { if (el.classList.contains("mth")) { A.method(el); const n = $("#modal .mth.on"); if (n) n.focus(); } else el.focus(); };
  if (mths.includes(cur)) {
    if (k === "ArrowLeft" || k === "ArrowRight") { const i = mths.indexOf(cur), n = mths[(i + (k === "ArrowRight" ? 1 : -1) + mths.length) % mths.length]; return pick(n); }
    if (k === "ArrowDown" && body.length) body[0].focus();
    return;
  }
  const dx = k === "ArrowRight" ? 1 : k === "ArrowLeft" ? -1 : 0, dy = k === "ArrowDown" ? 1 : k === "ArrowUp" ? -1 : 0;
  const r0 = cur.getBoundingClientRect(), cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
  let best = null, bd = 1e9;
  body.forEach((c) => {
    if (c === cur) return;
    const r = c.getBoundingClientRect(), x = r.left + r.width / 2 - cx, y = r.top + r.height / 2 - cy;
    const main = dx ? x * dx : y * dy, cross = dx ? Math.abs(y) : Math.abs(x);
    if (main <= 4) return; const d = main + cross * 2.5; if (d < bd) { bd = d; best = c; }
  });
  if (best) best.focus(); else if (k === "ArrowUp" && on) on.focus();
}
// Toda la caja con flechas (pedido de David, 26 oct 2026): fuera de Vender, las flechas llevan el foco (borde verde) al botón,
// campo o fila que está al lado en esa dirección, también al menú de la izquierda. Enter lo aprieta y Esc vuelve atrás o cierra.
// En los campos de texto ← → mueven el cursor y solo salen del campo desde el borde (o si está vacío o todo marcado).
const GN_SEL = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [data-a], [tabindex]:not([tabindex="-1"])';
function gnScope() {
  if (modalOpen()) return [$("#modal")];
  const h = $(".help-chat:not([hidden])"); if (h && h.contains(document.activeElement)) return [h];
  return [$("#view"), $("aside.side"), $("#tabNav")].filter(Boolean);
}
const gnVis = (el) => { if (el.disabled || el.closest("[hidden],[inert],[aria-hidden=true]")) return false; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const cs = getComputedStyle(el); return cs.visibility !== "hidden" && cs.display !== "none" && !(el.matches("input,select") && +cs.opacity === 0); };
function gnItems() {
  const out = [];
  gnScope().forEach((sc) => sc.querySelectorAll(GN_SEL).forEach((el) => {
    if (el.matches("main#view") || (el.matches("[data-a]") && el.parentElement && el.parentElement.closest("button,a[href]"))) return; // un botón dentro de otro: cuenta el de afuera
    if (el.matches("[data-a]:not(button,a,input,select,textarea,summary)") && el.querySelector("button,a[href],input,select,textarea")) return; // filas con botones adentro: se va a los botones
    if (gnVis(el)) out.push(el);
  }));
  return out;
}
const gnKey = (el) => el && (el.id ? "#" + el.id : el.dataset && el.dataset.a ? `[data-a="${el.dataset.a}"]${el.dataset.t ? `[data-t="${el.dataset.t}"]` : ""}${el.dataset.id ? `[data-id="${el.dataset.id}"]` : ""}${el.dataset.m ? `[data-m="${el.dataset.m}"]` : ""}${el.dataset.f ? `[data-f="${el.dataset.f}"]` : ""}` : "");
let gnLast = "", gnTab = "";
function gnFocus(el) {
  if (!el.matches("button,a[href],input,select,textarea,summary,[tabindex]")) el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true }); el.scrollIntoView({ block: "nearest", inline: "nearest" }); gnLast = gnKey(el); gnTab = ui.tab + "|" + (ui.ps || "");
}
// ¿La flecha la usa el campo (mover el cursor, cambiar la opción) o sirve para salir de él?
function gnFieldKeeps(t, k) {
  if (!/INPUT|TEXTAREA|SELECT/.test(t.tagName)) return false;
  if (t.tagName === "SELECT") return k === "ArrowUp" || k === "ArrowDown";
  if (/date|time|month|week|range|color|file/.test(t.type)) return true;
  if (/checkbox|radio/.test(t.type)) return false;
  const v = t.value || ""; if (!v) return false;
  let a = 0, b = 0; try { a = t.selectionStart; b = t.selectionEnd; } catch (e) { return false; }
  if (a === 0 && b === v.length) return false; // todo marcado: sale
  if (t.tagName === "TEXTAREA") return k === "ArrowUp" ? v.slice(0, a).includes("\n") : k === "ArrowDown" ? v.slice(b).includes("\n") : k === "ArrowLeft" ? a > 0 : b < v.length;
  if (k === "ArrowLeft") return a > 0;
  if (k === "ArrowRight") return b < v.length;
  return false;
}
function gnav(k, from) {
  const items = gnItems(); if (!items.length) return false;
  let cur = from && from !== document.body && items.includes(from) ? from : null;
  if (!cur && gnLast && gnTab === ui.tab + "|" + (ui.ps || "")) { try { const x = document.querySelector(gnLast); if (x && items.includes(x)) cur = x; } catch (e) {} }
  if (!cur) { // nada marcado: empieza por lo primero de la pantalla (arriba a la izquierda, sin contar el menú)
    const main = items.filter((x) => !x.closest("aside.side,#tabNav"));
    const pool = main.length ? main : items;
    const first = pool.reduce((a, x) => { const r = x.getBoundingClientRect(), ra = a.getBoundingClientRect(); return r.top + r.left * 0.3 < ra.top + ra.left * 0.3 - 2 && r.bottom > 0 ? x : a; }, pool.find((x) => x.getBoundingClientRect().bottom > 0) || pool[0]);
    gnFocus(first); return true;
  }
  const dx = k === "ArrowRight" ? 1 : k === "ArrowLeft" ? -1 : 0, dy = k === "ArrowDown" ? 1 : k === "ArrowUp" ? -1 : 0;
  const r0 = cur.getBoundingClientRect();
  let best = null, bs = 1e9;
  items.forEach((c) => {
    if (c === cur || c.contains(cur) || cur.contains(c)) return;
    const r = c.getBoundingClientRect();
    const main = dx > 0 ? r.left - r0.right : dx < 0 ? r0.left - r.right : dy > 0 ? r.top - r0.bottom : r0.top - r.bottom;
    const cMain = dx ? (r.left + r.width / 2 - (r0.left + r0.width / 2)) * dx : (r.top + r.height / 2 - (r0.top + r0.height / 2)) * dy;
    if (cMain <= 2 || main < -Math.min(r0.width, r0.height, dx ? r.width : r.height) / 2) return;
    const cross = dx ? Math.max(0, r.top - r0.bottom, r0.top - r.bottom) : Math.max(0, r.left - r0.right, r0.left - r.right);
    const off = dx ? Math.abs(r.top + r.height / 2 - (r0.top + r0.height / 2)) : Math.abs(r.left + r.width / 2 - (r0.left + r0.width / 2));
    const sc = Math.max(0, main) + cross * 6 + off * 0.15;
    if (sc < bs) { bs = sc; best = c; }
  });
  if (best) { gnFocus(best); if (best.matches("input:not([type=checkbox]):not([type=radio]),textarea") && best.select && best.value) try { best.select(); } catch (e) {} return true; }
  return false;
}
function moveSel(d) {
  const ks = cartLines().map((x) => lineKey(x.l.id, x.l.pres)); if (!ks.length) return;
  let i = ks.indexOf(ui.sel); i = i < 0 ? ks.length - 1 : Math.min(ks.length - 1, Math.max(0, i + d));
  ui.sel = ks[i]; $$(".ln").forEach((x) => x.classList.toggle("sel", x.dataset.k === ui.sel));
  const s = $(".ln.sel"); if (s) s.scrollIntoView({ block: "nearest" });
}
// Teclado: lector de códigos de barras (escribe el código + Enter) y atajos para PC.
// Si la acción vino del teclado, las ventanas abren sin animación (se usan cientos de veces al día).
// Al pasar del teclado/lector al dedo o mouse, lo que ya está en pantalla NO vuelve a hacer su animación de entrada
// (antes el cobro y el «¡Vendido!» se ponían invisibles y volvían a aparecer: el «pestañeo» de la NCR). Se marca con .na.
const setInput = (k) => {
  const h = document.documentElement; if (h.dataset.input === k) return;
  if (h.dataset.input === "kbd") $$("#modal:not([hidden]), .paper.done, .stamp, .help-chat, .help-message, .gate-form > *").forEach((e) => e.classList.add("na"));
  h.dataset.input = k;
};
document.addEventListener("pointerdown", () => setInput("ptr"), true);
document.addEventListener("keydown", (e) => {
  if (e.key.length > 1 || e.ctrlKey || e.altKey) setInput("kbd");
  if ($("#susp")) { if (e.target.id === "gcode") { if (e.key === "Enter") { e.preventDefault(); A.codecanje(); } return; } if (e.key !== "Tab" && e.key !== "Enter" && e.key !== " ") e.preventDefault(); return; } // caja bloqueada: ni teclas ni lector
  if (ui.locked) { if (/^\d$/.test(e.key)) pinKey(e.key); else if (e.key === "Backspace") pinKey("del"); else if (e.key === "Escape" && !$("#lockCancel").hidden) $("#lockCancel").click(); return; }
  const open = modalOpen(), field = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName), inQ = e.target.id === "q";
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && ui.tab === "venta") { e.preventDefault(); if (!open) A.tools(); else if ($("#modal .fgrid")) closeModal(); return; }
  if (e.key === "Escape" && open) { e.preventDefault(); if (ui.mk === "cam" && cam.mode === "codigo") return A.camback(); return closeModal(); }
  if (e.key === "Escape" && !open && ui.tab === "venta" && ui.done) { e.preventDefault(); return A.newsale(); }
  // Cobro: las flechas se mueven entre los medios de pago (al pasar por uno, queda elegido) y los billetes; Enter cobra con el marcado.
  if (open && ui.mk === "pay" && ui.pay && !ui.pay.split && /^Arrow(Left|Right|Up|Down)$/.test(e.key) && !(field && e.target.value) && !e.shiftKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); payNav(e.key); return; }
  if (open && ui.mk === "pay" && ui.pay && !ui.pay.split && ui.pay.method === "efectivo" && !field && !e.ctrlKey && !e.metaKey && /^[\d.,]$/.test(e.key)) {
    e.preventDefault(); ui.pay.other = true; ui.pay.recv = e.key; paintPay();
    const i = $("#recv"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } return;
  }
  const FM = { F2: "efectivo", F8: "yape", F9: "efectivo", F10: "plin" }; // F9 = efectivo, igual que F2 (pedido de David)
  if (FM[e.key]) {
    e.preventDefault();
    if (open) {
      if (ui.mk !== "pay" || !ui.pay) return;
      if (ui.pay.split) A.partadd({ dataset: { m: FM[e.key] } });
      else if ((e.key === "F2" || e.key === "F9") && ui.pay.method === "efectivo") confirmPay();
      else { ui.pay.method = FM[e.key]; paintPay(); }
    } else if (ui.tab === "venta") { if (!can("cobrar") && (e.key === "F2" || e.key === "F9")) savePrev(); else startPay(FM[e.key]); }
    return;
  }
  if (e.key === "F1") { e.preventDefault(); if (!open && ui.tab === "venta") pickClient(); return; }
  if (e.key === "F7") { e.preventDefault(); if (ui.mk === "pay" || (!open && ui.tab === "venta")) A.split(); return; }
  if (e.key === "F5") { e.preventDefault(); if (!open && ui.tab === "venta") A.tknew(); return; }
  if (e.key === "F6") { e.preventDefault(); if (!open && ui.tab === "venta") editLine(ui.sel); return; }
  if ((e.key === "F3" || (e.key === "/" && !field)) && !open && ui.tab === "venta") { e.preventDefault(); A.focusq(); return; }
  if (!open && ui.tab === "venta") {
    // ← → pasan de un ticket a otro (En espera) sin el mouse; ↑ ↓ también, si el ticket actual está vacío
    // (con productos ↑ ↓ siguen eligiendo la línea). Solo con el buscador vacío, para no mover el cursor del texto.
    const lr = e.key === "ArrowLeft" || e.key === "ArrowRight", ud = e.key === "ArrowDown" || e.key === "ArrowUp";
    if ((lr || (ud && !DB.cart.items.length)) && DB.tickets.length > 1 && (!field || (inQ && !e.target.value)) && !e.shiftKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault(); tkStep(e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1); return;
    }
    // Escáner y Fichas: con algo escrito, ↑ ↓ se mueven por los resultados; en Fichas también ← →.
    if (inQ && e.target.value.trim() && !vit() && ui.glist && ui.glist.length && !e.shiftKey && !e.ctrlKey && !e.altKey) {
      const tiles = DB.cfg.view === "tiles";
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); gMove(e.key === "ArrowDown" ? 1 : -1, tiles); return; }
      if (tiles && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { e.preventDefault(); gMove(e.key === "ArrowRight" ? 1 : -1, false); return; }
    }
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && vit() && ui.q.trim() && ui.vlist && ui.vlist.length > 1) { e.preventDefault(); ui.vsel = Math.min(ui.vlist.length - 1, Math.max(0, (ui.vsel || 0) + (e.key === "ArrowDown" ? 1 : -1))); paintGrid(); const on = $("#grid .vr.on"); if (on) on.scrollIntoView({ block: "nearest" }); return; }
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
  // Ficha del producto: ← → pasan al campo anterior/siguiente (precio, costo, stock…) cuando el número está todo
  // marcado o el cursor ya está en el borde; el campo al que llegas queda marcado para escribir encima.
  if (open && (e.key === "ArrowRight" || e.key === "ArrowLeft") && !e.shiftKey && e.target.closest && e.target.closest("#pe") && e.target.tagName === "INPUT" && !/checkbox|radio|date|file|color/.test(e.target.type)) {
    const t = e.target, len = (t.value || "").length; let a = 0, b = 0; try { a = t.selectionStart; b = t.selectionEnd; } catch (er) {}
    const all = len > 0 && a === 0 && b === len, edge = e.key === "ArrowRight" ? a === len && b === len : a === 0 && b === 0;
    if (all || edge) {
      const f = [...document.querySelectorAll("#pe input, #pe select")].filter((x) => !/checkbox|radio|file|color|hidden/.test(x.type) && !x.disabled && x.offsetParent !== null);
      const n = f[f.indexOf(t) + (e.key === "ArrowRight" ? 1 : -1)];
      if (n) { e.preventDefault(); n.focus(); try { if (n.select && n.tagName === "INPUT" && n.type !== "date") n.select(); } catch (er) {} return; }
    }
  }
  // Productos: ↑ ↓ por la lista del buscador y Enter abre la ficha (también con el lector de códigos).
  if (!open && ui.tab === "prod" && (e.target.id === "pq" || e.target.closest("#plist")) && ["ArrowDown", "ArrowUp", "Enter"].includes(e.key)) {
    const it = [...document.querySelectorAll("#plist .it")];
    if (it.length && (e.target.id === "pq" || e.key !== "Enter")) {
      e.preventDefault();
      if (e.key === "Enter") { (it[ui.psel] || it[0]).click(); return; }
      ui.psel = Math.min(it.length - 1, Math.max(0, (ui.psel == null ? -1 : ui.psel) + (e.key === "ArrowDown" ? 1 : -1))); pselMark();
      if (e.target.id !== "pq") it[ui.psel].focus();
      return;
    }
  }
  // Flechas en toda la caja (menos en Vender, que tiene las suyas; ahí solo si el foco ya está en el menú).
  if (/^Arrow(Up|Down|Left|Right)$/.test(e.key) && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && !(ui.mk === "pay" && open && ui.pay && !ui.pay.split)
    && (open || ui.tab !== "venta" || (e.target.closest && e.target.closest("aside.side,#tabNav"))) && !e.target.closest(".help-chat .help-input") && !gnFieldKeeps(e.target, e.key)) {
    if (gnav(e.key, e.target)) { e.preventDefault(); return; }
  }
  // Enter sobre una fila que se abre al tocarla (no es botón): la abre.
  if (e.key === "Enter" && !field && e.target.matches && e.target.matches("[data-a]:not(button,a,summary)")) { e.preventDefault(); e.target.click(); return; }
  // Esc sin ventana abierta: vuelve atrás (detalle del proveedor, etc.).
  if (e.key === "Escape" && !open && ui.tab !== "venta") { const b = $("#view [data-a$=back]"); if (b) { e.preventDefault(); b.click(); return; } }
  if (e.key === "Enter") {
    const id = e.target.id;
    if (id === "q" && !open) {
      e.preventDefault();
      if (e.target.value.trim()) { clearTimeout(qT); submitCode(e.target.value); }
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
    const m = { e: "efectivo", y: "yape", p: "plin", b: "bcp", t: "tarjeta", c: "credito" }[e.key.toLowerCase()];
    if (m) { ui.pay.method = m; paintPay(); }
  }
});

/* ---------- inicio ---------- */
// En el programa de Windows se registra "sw.js?escritorio=1": ese service worker no usa el almacén de copias (ver sw.js).
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register(/Electron\/|CajaFacilEscritorio/.test(navigator.userAgent) ? "sw.js?escritorio=1" : "sw.js").catch(() => {});
window.addEventListener("afterprint", () => { const p = $("#print"); if (p) p.innerHTML = ""; });
window.CF = { get DB() { return DB; }, ui, flush, save: (...a) => save(...a), dayTotals, cartTotals, totalsOf, parseImport, splitCalc, parseWeight, parseLabel, letras, rucOk, balanceOf, pointsOf, onScaleLine, scaleState, shiftSummary, agingOf, expectedCash, suppBal, curShift, cloud, cloudLoad, cloudSetSession, cloudPush, cloudStart, cloudRecover, cloudPanel, cloudSnapshot, vzParse, vzPlan, remPull, remSend, get REM() { return REM; }, remState };
async function boot() {
  await loadDB();
  await remLoad(); // «Manejar otra caja»: trae esa tienda de la nube en vez de la de este equipo
  if (!DB.users.some((u) => u.on && u.role === "admin")) { const a = DB.users.find((u) => u.role === "admin") || DB.users[0]; a.on = true; a.role = "admin"; }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  $("#lockPad").innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-a="lockkey" data-k="${n}">${n}</button>`).join("") + `<button class="ghost" tabindex="-1" aria-hidden="true"></button><button data-a="lockkey" data-k="0">0</button><button data-a="lockkey" data-k="del" aria-label="Borrar">⌫</button>`;
  if (needLogin()) { ui.user = null; render(); loginScreen(); }
  else if (REM) render();
  else { ui.user = activeUsers()[0].id; render(); avisoDia(); }
  if (!REM && serialOk() && DESK()) connectScale(false);
  if (!cloudOn() && DB.sales.length && (!DB.cfg.lastBackup || Date.now() - DB.cfg.lastBackup > 7 * 864e5)) setTimeout(() => { if (!ui.locked) toast("Hace días que no descargas un respaldo. Hazlo en Ajustes › Datos.", true); }, 2500);
  document.body.classList.add("ready");
  fsArm();
  cloudBoot();
  libsLater();
  liteBench();
  setTimeout(verNueva, 1500);
}
boot();

})();
