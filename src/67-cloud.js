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
  cloud.st = Object.assign({ ses: null, neg: "", negName: "", dev: "", h: {}, last: 0 }, o || {});
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
  const s = cloudLoad(); s.ses = null; s.neg = ""; s.negName = ""; s.h = {}; s.last = 0; cloudStore();
  cloud.panel = null; toast("Cerraste sesión en la nube. Esta caja sigue funcionando igual.");
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
  const list = await sb("negocios?select=id,nombre&order=creado.asc");
  if (list.length) { s.neg = list[0].id; s.negName = list[0].nombre; }
  else { const n = await sb("negocios", { method: "POST", headers: { Prefer: "return=representation" }, body: { nombre: DB.biz.name || "Mi negocio" } }); s.neg = n[0].id; s.negName = n[0].nombre; }
  cloudStore(); return s.neg;
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
  if (!cloudOn() || cloud.busy) return;
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
    await cloudEnsureNegocio();
    const tiendas = await cloudTiendas();
    const mine = tiendas.find((t) => t.tienda === DB.biz.sid);
    if (!mine && tiendas.length && !DB.sales.length && !DB.products.length) { cloudPaint(); openRecover(tiendas); return; }
    await cloudPush(true); toast("Listo: esta caja ya se respalda en la nube");
  } catch (e) { cloud.err = "No se pudo conectar con la nube. Revisa tu internet."; }
  cloudPaint();
}
async function cloudTiendas() {
  const s = cloudLoad();
  const rows = await sb(`registros?select=tienda,actualizado,nombre:datos->biz->>store,negocio:datos->biz->>name&negocio_id=eq.${s.neg}&tipo=eq.config&borrado=eq.false&order=actualizado.desc`);
  return rows;
}
function openRecover(tiendas) {
  openModal(`<h2>Recuperar una tienda</h2><p class="muted" style="margin-bottom:12px">Trae a este equipo todos los datos de una tienda guardada en la nube: productos, ventas, clientes, caja y proveedores.</p>
    <div class="list">${tiendas.map((t) => `<button class="it" data-a="cloudrec" data-s="${esc(t.tienda)}"><div class="t"><b>${esc(t.nombre || t.tienda)}</b><small>Código ${esc(t.tienda)} · última copia ${fmtDT(Date.parse(t.actualizado))}</small></div></button>`).join("")}</div>
    <p class="muted sm" style="margin-top:10px">Usa una tienda en un solo equipo a la vez. Para otra caja, deja esta como tienda nueva.</p>
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn sec" data-a="cloudnew">Usar como tienda nueva</button></div>`);
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
    DB = normalize(o); DB.biz.sid = sid;
    s.h = {}; cloudSnapshot().forEach((r, k) => { s.h[k] = cloudHash(JSON.stringify(r.datos)); }); s.last = Date.now(); cloudStore();
    saveAll(); await flush(); closeModal(); toast(`Listo: recuperaste ${o.sales.length} ventas y ${o.products.length} productos`, true); render();
  } catch (e) { toast("No se pudo traer la tienda. Revisa tu internet e inténtalo otra vez.", true); }
}

/* ---------- panel del dueño: todas las tiendas hoy ---------- */
async function cloudPanel() {
  const s = cloudLoad(), k = dkey();
  try {
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
  return `<div class="kv strong"><span>Todas las tiendas hoy</span><span class="num">${money(tot)}</span></div>` + list.map(([sid, b]) => `<div class="kv"><span><b>${esc(b.name)}</b><small class="muted"> · ${b.n} ${b.n === 1 ? "venta" : "ventas"}${b.m.efectivo ? " · efectivo " + money(b.m.efectivo) : ""}${b.m.yape ? " · Yape " + money(b.m.yape) : ""}${b.act ? " · copia " + hhmm(Date.parse(b.act)) : ""}${sid === DB.biz.sid ? " · esta caja" : ""}</small></span><span class="num">${money(b.total)}</span></div>`).join("") + `<p class="muted sm" style="margin-top:8px">Actualizado ${hhmm(p.t)}.</p>`;
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
      <div class="row wrap" style="margin-top:12px"><button class="btn" data-a="cloudpush">Subir ahora</button><button class="btn sec" data-a="cloudrecover">Recuperar una tienda</button><button class="btn sec" data-a="cloudout">Cerrar sesión</button></div></div>
    <div class="card"><div class="row sp"><h2>Mis tiendas hoy</h2><button class="btn sec sm" data-a="cloudpanel">Ver mis tiendas</button></div>${panelHtml()}</div>`;
}
function cloudStatus() {
  const s = cloudLoad();
  if (cloud.busy) return cloud.pending ? `Subiendo… faltan ${cloud.pending}` : "Subiendo…";
  if (cloud.err) return esc(cloud.err);
  return s.last ? `Al día · ${hhmm(s.last)}` : "Aún no se sube nada";
}
function cloudPaint() { const el = $("#cloudst"); if (el) el.innerHTML = cloudStatus(); else if (ui.tab === "aj" && ui.atab === "nube" && !modalOpen()) render(); }

act({
  cloudlogin: () => cloudLoginGoogle(),
  cloudout: () => confirmBox("¿Cerrar sesión en la nube?", "Cerrar sesión", () => { cloudLogout(); render(); }, false, "Esta caja deja de subir copias, pero sigue vendiendo normal."),
  cloudpush: () => { cloudPush(true); cloudPaint(); },
  cloudpanel: () => { cloud.panel = null; cloudPanel(); toast("Trayendo las ventas de hoy…"); },
  cloudrecover: async () => { try { const t = await cloudTiendas(); if (!t.length) return toast("Aún no hay tiendas en la nube"); openRecover(t); } catch (e) { toast("Sin conexión con la nube", true); } },
  cloudrec: (el) => { const sid = el.dataset.s; closeModal(); confirmBox("¿Traer esta tienda a este equipo?", "Traer datos", () => cloudRecover(sid), false, "Lo que hay ahora en este equipo se reemplaza por lo de la nube."); },
  cloudnew: async () => { closeModal(); await cloudPush(true); toast("Listo: esta caja se guarda como tienda nueva"); }
});

/* ---------- arranque: sesión que vuelve de Google, subida automática ---------- */
function cloudBoot() {
  const r = cloudCatchRedirect();
  if (r === "ok") { ui.tab = "aj"; ui.atab = "nube"; render(); toast("Entraste con Google. Conectando tu caja…"); cloudStart(); }
  else if (r === "error") { ui.tab = "aj"; ui.atab = "nube"; render(); toast("No se pudo entrar con Google: " + cloud.err, true); }
  else if (cloudOn()) cloudSchedule(3000);
  // Cada vez que la app guarda algo, se programa una subida (agrupa los cambios de varios segundos).
  const _save = save; save = function () { const out = _save.apply(this, arguments); cloudSchedule(); return out; };
  window.addEventListener("online", () => cloudSchedule(1000));
  setInterval(() => { if (cloudOn() && !document.hidden) cloudPush(); }, 120000);
}
