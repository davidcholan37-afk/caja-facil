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
  else if (id === "cntd" && ui.cnt) { ui.cnt.direct = t.value; arqUpd(); }
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
