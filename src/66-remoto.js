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
function remPickHtml(neg, tiendas, cli = []) {
  const it = (t, n, mine) => `<button class="it" data-a="remone" data-n="${esc(n)}" data-s="${esc(t.tienda)}" data-name="${esc(tiendaNom(t))}"><div class="t"><b>${esc(tiendaNom(t))}</b><small>${!mine && t.correo ? esc(t.correo) + " · " : ""}${t.negocio && t.nombre ? esc(t.nombre) + " · " : ""}Código ${esc(t.tienda)} · última copia ${fmtDT(Date.parse(t.actualizado))}${t.tienda === DB.biz.sid && !cloudLoad().ver ? " · este equipo tiene una copia" : ""}</small></div></button>`;
  return `<h2>¿Qué caja quieres manejar?</h2><p class="muted" style="margin-bottom:12px">Cambia sus productos, precios, clientes, proveedores, usuarios, ajustes y vitrina desde aquí.</p>
    ${tiendas.length ? `${cli.length ? `<h3 class="remh">Tu negocio</h3>` : ""}<div class="list">${tiendas.map((t) => it(t, neg, true)).join("")}</div>` : ""}
    ${cli.length ? `<h3 class="remh">Cajas de tus clientes <small class="muted">· te dieron permiso</small></h3><div class="list">${cli.map((t) => it(t, t.neg, false)).join("")}</div>` : ""}
    <div class="btns"><button class="btn sec" data-a="close">Cancelar</button></div>`;
}
// Cajas de clientes que le dieron permiso de soporte al proveedor (pedido de David, 26 oct 2026: «ya me dio acceso pero no me aparece al manejar caja»).
async function remClientes() {
  const st = cloudLoad(); if (!st.admin) return [];
  const out = [];
  try {
    const ns = await sb("rpc/admin_negocios", { method: "POST", body: {} });
    for (const n of (ns || []).filter((n) => n.id !== st.neg && n.soporte_hasta && Date.parse(n.soporte_hasta) > Date.now())) {
      try { const r = await sb(`registros?select=tienda,actualizado,nombre:datos->biz->>store,negocio:datos->biz->>name&negocio_id=eq.${n.id}&tipo=eq.config&borrado=eq.false&order=actualizado.desc`); r.forEach((x) => out.push({ ...x, neg: n.id, correo: n.correo || "" })); } catch (e) {}
    }
  } catch (e) {}
  return out;
}
async function remPick() {
  try {
    const dev = cloudLoad().dev, ver = cloudLoad().ver;
    // La tienda de este equipo no se ofrece… salvo que en la nube la escriba OTRO equipo: entonces este es solo una
    // copia (p. ej. un celular donde se usó «Recuperar una tienda» de la caja de la tienda) y sí se puede manejar.
    const [t0, cli] = await Promise.all([cloudTiendas(), remClientes()]);
    const t = t0.filter((x) => ver || x.tienda !== DB.biz.sid || (x.dispositivo && x.dispositivo !== dev));
    if (!t.length && !cli.length) return toast(cloudLoad().admin ? "No hay otra caja de tu negocio y ningún cliente te dio permiso de soporte" : "No hay otra caja de tu negocio en la nube");
    openModal(remPickHtml(cloudLoad().neg, t, cli));
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
  return `<div class="card"><h2>Manejar otra caja</h2><p class="muted" style="margin-bottom:10px">Cambia productos, precios, stock, clientes, usuarios, ajustes y vitrina de otra caja de tu negocio${cloudLoad().admin ? " (o de un cliente que te dio permiso)" : ""} desde este equipo. Su caja recibe los cambios sola en un minuto. Tus datos de aquí no se tocan.</p><button class="btn sec" data-a="rempick">Elegir caja</button></div>`;
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
