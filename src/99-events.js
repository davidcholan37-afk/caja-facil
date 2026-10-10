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
