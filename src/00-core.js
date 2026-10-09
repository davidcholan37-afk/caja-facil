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
  pts: { on: false, per: 1, val: 0.02, min: 100 }, lock: 3, tile: "m", showImg: true, needShift: false, negStock: false,
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
