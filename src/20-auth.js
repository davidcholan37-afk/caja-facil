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
