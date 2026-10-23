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
    // Solo se revisan las ventas, movimientos y kardex de los meses que cambiaron desde la última subida
    // (al abrir la caja, si falló una subida o tras recuperar/importar, se revisa todo una vez).
    const s = cloudLoad(), rows = [], hashes = {}, seen = new Set(), full = force || !cloud.dm, dm = cloud.dm || new Set();
    cloud.dm = new Set(); cloud.dmFly = dm; dmSave();
    const put = (tipo, id, datos, k, hv) => { hashes[k] = hv; if (force || s.h[k] !== hv) rows.push({ negocio_id: s.neg, tienda: DB.biz.sid, tipo, id, datos, borrado: false, dispositivo: s.dev }); };
    CLOUD_TYPES.forEach((t) => (DB[t] || []).forEach((x) => {
      const id = cloudKeyOf(x), k = t + "|" + id; seen.add(k);
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
// Nombre de una tienda en las listas de la nube: el del negocio (todas suelen llamarse «Tienda principal»).
const tiendaNom = (t) => t.negocio || t.nombre || t.tienda;
function openRecover(tiendas) {
  openModal(`<h2>Recuperar una tienda</h2><p class="muted" style="margin-bottom:12px">Trae a este equipo todos los datos de una tienda guardada en la nube: productos, ventas, clientes, caja y proveedores.</p>
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
  return `<div class="card"><h2>Soporte técnico</h2><p class="muted" style="margin-bottom:10px">Si tienes un problema, puedes dejar que tu proveedor de Caja Fácil <b>vea</b> (sin cambiar nada) tus ventas, productos y caja por un tiempo.</p>
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
        <div class="clia">${mine ? "" : `<button class="btn sec sm" data-a="adminren" data-id="${n.id}">Renovar 1 mes</button>`}${n.vozOk ? `<button class="btn sec sm" data-a="adminvoz" data-id="${n.id}" data-e="${n.voz ? 0 : 1}">${n.voz ? "Quitar voz" : "Dar voz"}</button>` : ""}${sop || mine ? `<button class="btn sec sm" data-a="adminver" data-id="${n.id}">Ver datos</button>` : `<button class="btn sec sm" disabled title="El cliente debe dar acceso de soporte">Sin permiso</button>`}${mine ? "" : n.estado === "suspendido" || n.estado === "pendiente" ? `<button class="btn sm" data-a="adminest" data-id="${n.id}" data-e="activo">Activar</button>` : `<button class="btn red sec sm" data-a="adminest" data-id="${n.id}" data-e="suspendido">Suspender</button>`}</div></div>`; }).join("");
  return `<div class="card"><div class="row sp"><h2>Mis clientes</h2><button class="btn sec sm" data-a="adminlist">Ver clientes</button></div><div class="row wrap" style="margin-bottom:8px"><button class="btn sm" data-a="admincod">Generar código</button><button class="btn sec sm" data-a="adminacc">Dar acceso por correo</button></div><p class="muted sm" style="margin-bottom:8px">Solo tú ves esto. Para ver los datos de un cliente, él debe darte acceso en su Ajustes › Nube › Soporte técnico.</p>${body}</div>`;
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
      <p class="muted sm" style="margin-top:8px">Solo el dueño entra con Google. Los cajeros siguen usando su PIN. Al entrar aceptas los <a href="terminos.html" target="_blank" rel="noopener">Términos</a> y la <a href="privacidad.html" target="_blank" rel="noopener">Política de privacidad</a>.</p></div>`;
  return `<div class="card"><h2>Tu negocio en la nube</h2>
      <div class="kv"><span>Cuenta</span><b>${esc((s.ses.user || {}).email || "Google")}</b></div>
      <div class="kv"><span>Negocio</span><b>${esc(s.negName || "—")}</b></div>
      <div class="kv"><span>Esta caja</span><b>${esc(DB.biz.store)} <small class="muted">(${esc(DB.biz.sid)})</small></b></div>
      <div class="kv"><span>Copia en la nube</span><b id="cloudst">${cloudStatus()}</b></div>
      ${s.vence ? `<div class="kv"><span>Tu plan</span><b>${diasVence() < 0 ? "Venció" : "Vence"} el ${dmy(dkey(new Date(s.vence)))}</b></div>` : ""}
      <div class="row wrap" style="margin-top:12px">${s.ver ? `<button class="btn" data-a="cloudnew">Usar este equipo como caja</button>` : `<button class="btn" data-a="cloudpush">Subir ahora</button>`}<button class="btn sec" data-a="cloudrecover">Recuperar una tienda</button><button class="btn sec" data-a="cloudout">Cerrar sesión</button></div></div>
    ${s.ver ? "" : soporteHtml()}${s.admin ? adminHtml() : ""}
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
}
