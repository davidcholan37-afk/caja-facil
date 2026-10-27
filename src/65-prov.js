/* ===================== 65 · PROVEEDORES: lo que debes, lo que abonas y lo que pagas ===================== */
// DB.supp = proveedores. DB.sm = movimientos: "deuda" (te fiaron mercadería) y "pago" (abono o pago al contado).
const supp = (id) => DB.supp.find((x) => x.id === id);
// Lo que le debes. Nunca baja de 0: si le pagas más de lo que le debías (o le pagas sin deberle, al contado), eso fue una compra
// al contado y no queda «a tu favor» (pedido de David, 26 oct 2026: «yo solo quiero anotar que pagué 70 de la boleta»).
const suppBal = (s) => { let b = 0; DB.sm.filter((x) => x.sid === s.id).sort((x, y) => x.t - y.t).forEach((x) => { b = Math.max(0, r2(b + (x.type === "deuda" ? x.amt : -x.amt))); }); return b; };
const suppTotalDebt = () => r2(DB.supp.reduce((a, s) => a + Math.max(0, suppBal(s)), 0));
const suppLast = (s) => DB.sm.filter((x) => x.sid === s.id).reduce((a, x) => Math.max(a, x.t), 0);

// Lista «con botones» (opción A de David, 26 oct 2026): resumen, buscador, filtros y en cada fila Pagar (todo), Abonar y Me fiaron.
const PV_COL = ["#0E7490", "#B45309", "#7C3AED", "#15803D", "#BE123C", "#1E4E8C"];
const pvIni = (n) => (String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("") || "?").toUpperCase();
const pvCol = (n) => PV_COL[[...String(n || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % PV_COL.length];
const PV_IC = { pay: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>', abono: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', box: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/>', srch: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>', truck: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>' };
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
      <div class="pvsal"><b class="num ${b > 0 ? "debe" : "cero"}">${b > 0 ? money(b) : "Sin deuda"}</b><small>${b > 0 ? "le debes" : ""}</small></div>
      <div class="pvacts">${b > 0 ? `<button class="pvb pay" data-a="pspayall" data-id="${s.id}">${pvI("pay")}Pagar</button><button class="pvb abo" data-a="pspay" data-id="${s.id}">${pvI("abono")}Abonar</button>` : `<button class="pvb fio" data-a="pspay" data-id="${s.id}">${pvI("pay")}Pagar</button>`}</div></div>`;
  };
  v.innerHTML = `<div class="ph"><h1>Proveedores</h1><button class="btn sm" data-a="psnew">${svg("plus", "bi")}Nuevo proveedor</button></div>
    ${list.length ? `<button class="pvllego" data-a="llego">${pvI("truck")}<span>Llegó un proveedor</span><small>anota lo que dejó y lo que le pagas, de una</small></button><div class="pvsum"><div class="card pvs ${debt > 0 ? "big" : ""}"><small>Debes en total${owing ? ` · ${owing} ${owing === 1 ? "proveedor" : "proveedores"}` : ""}</small><b class="num">${money(debt)}</b></div><div class="card pvs"><small>Pagado hoy</small><b class="num">${money(hoy)}</b></div><div class="card pvs"><small>Te fiaron este mes</small><b class="num">${money(fiado)}</b></div></div>
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
// Detalle del proveedor «lista simple» (opción 2 de David, 26 oct 2026; antes «conversación»): arriba cuánto le debes
// con Pagar todo / Abonar / Me fiaron, y abajo los movimientos del más nuevo al más viejo con «Hoy / Ayer / Hace N días».
const PV_MAX = 60;
function provDetail(v, s) {
  const b = suppBal(s), rows = DB.sm.filter((x) => x.sid === s.id).sort((x, y) => y.t - x.t);
  const all = ui.pvAll === s.id || rows.length <= PV_MAX, shown = all ? rows : rows.slice(0, PV_MAX);
  const nuevo = ui.pvNew; ui.pvNew = null;
  const list = shown.map((x) => {
    const pg = x.type === "pago", sub = [pvDia(x.date), hhmm(x.t), pg && x.m ? "con " + (METHODS[x.m] || x.m) : ""].filter(Boolean).join(" · ");
    return `<div class="pvmv ${pg ? "p" : "d"}${x.id === nuevo ? " nuevo" : ""}"><div class="pvmt"><b>${pg ? "Le pagaste" : "Te fió"}${x.note ? " · " + esc(x.note) : ""}</b><small>${sub}</small></div>
      <span class="pvma num">${pg ? "−" : "+"} ${money(x.amt)}</span><button class="pvdel" data-a="psdel" data-id="${x.id}" aria-label="Borrar este movimiento" title="Borrar">✕</button></div>`;
  }).join("");
  v.innerHTML = `<button class="link pvback" data-a="psback">‹ Proveedores</button>
    <div class="pvhd"><span class="pvav big" style="background:${pvCol(s.name)}">${esc(pvIni(s.name))}</span>
      <div class="pvchn"><h1>${esc(s.name)}</h1><p>${[s.phone ? esc(s.phone) : "", s.note ? esc(s.note) : ""].filter(Boolean).join(" · ") || "Sin celular ni nota"}</p></div>
      <button class="btn sec sm pved" data-a="psedit" data-id="${s.id}" aria-label="Editar proveedor">${svg("edit", "bi")}<span>Editar</span></button></div>
    <div class="card pvtop"><div class="pvdebe ${b > 0 ? "owe" : b < 0 ? "fav" : "ok"}"><small>${b > 0 ? "Le debes" : b < 0 ? "A tu favor" : "No le debes"}</small><b class="num">${b === 0 ? "S/ 0.00 ✓" : money(Math.abs(b))}</b></div>
      <div class="pvtacts">${b > 0 ? `<button class="pvb pay" data-a="pspayall" data-id="${s.id}">${pvI("pay")}Pagar todo</button><button class="pvb abo" data-a="pspay" data-id="${s.id}">${pvI("abono")}Abonar</button>` : `<button class="pvb abo" data-a="pspay" data-id="${s.id}">${pvI("pay")}Pagar</button>`}<button class="pvb fio" data-a="llego" data-id="${s.id}">${pvI("box")}Me fiaron</button></div></div>
    <div class="card pvlist">${list || `<div class="pvvac"><b>Todavía no hay movimientos</b><span>Cuando ${esc(s.name)} te deje mercadería, toca «Me fiaron». Cuando le pagues, toca «Pagar todo» o «Abonar».</span></div>`}
      ${!all ? `<button class="pvmore" data-a="pvall" data-id="${s.id}">Ver ${rows.length - PV_MAX} movimientos anteriores</button>` : ""}</div>`;
}
// «Llegó un proveedor» (opción 1 de 5 elegida por David, 26 oct 2026: «lo único que veo difícil y demorado es proveedores»):
// en una sola ventana se elige al proveedor, se escribe lo que dejó y cuánto se le paga ahora (Nada / Todo / Solo lo de hoy / Otro)
// con qué medio; abajo se ve al toque en cuánto queda la deuda. Guarda la deuda y el pago juntos.
function llegoUI(id) {
  ui.ll = { id: id || "", pay: "hoy", m: "efectivo", dejo: "", otro: "", note: "" };
  llegoPaint();
}
function llegoRead() {
  const L = ui.ll; if (!L) return; const g = (k) => $("#" + k);
  if (g("lla")) L.dejo = g("lla").value; if (g("llo")) L.otro = g("llo").value; if (g("lln")) L.note = g("lln").value;
}
function llegoCalc() {
  const L = ui.ll, s = supp(L.id); if (!s) return null;
  const b = suppBal(s), dejo = Math.max(0, r2(num(L.dejo))), total = r2(b + dejo);
  const pago = L.pay === "todo" ? total : L.pay === "hoy" ? dejo : L.pay === "otro" ? Math.max(0, r2(num(L.otro))) : 0;
  return { s, b, dejo, total, pago, queda: Math.max(0, r2(total - pago)) };
}
function llegoPaint() {
  const L = ui.ll; if (!L) return;
  const s = supp(L.id);
  if (!s) {
    const list = DB.supp.slice().sort((a, b) => suppLast(b) - suppLast(a) || cmpEs(a.name, b.name));
    openModal(`<h2>Llegó un proveedor</h2><p class="muted" style="margin-bottom:10px">¿Quién llegó?</p>
      <label class="pvq llsrch">${pvI("srch")}<input type="search" id="llq" placeholder="Buscar proveedor…" autocomplete="off" aria-label="Buscar proveedor" autofocus></label>
      <div class="llpick" id="llpick">${list.map((x) => { const b = suppBal(x); return `<button class="llp" data-a="llpick" data-id="${x.id}" data-n="${esc(norm(x.name))}"><span class="pvav" style="background:${pvCol(x.name)}">${esc(pvIni(x.name))}</span><b>${esc(x.name)}</b><small class="num ${b > 0 ? "debe" : ""}">${b > 0 ? "debes " + money(b) : "sin deuda"}</small></button>`; }).join("") || `<p class="muted">Aún no tienes proveedores.</p>`}</div>
      <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn sec" data-a="psnew">${svg("plus", "bi")}Nuevo proveedor</button></div>`);
    const q = $("#llq");
    if (q) {
      q.oninput = () => { const v = norm(q.value); $$("#llpick .llp").forEach((b) => { b.hidden = !!v && !b.dataset.n.includes(v); }); };
      q.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); const b = $$("#llpick .llp").find((x) => !x.hidden); if (b) b.click(); } };
    }
    return;
  }
  const b = suppBal(s), cash = can("caja");
  // «ordenado y más chico» (David, 26 oct 2026): cabecera de una línea, cada pregunta en su fila con la etiqueta a la izquierda,
  // cuánto pagas y con qué en botones del mismo ancho, y abajo la cuenta (debías + boleta − pagas = quedas debiendo).
  const chip = (k, t, sub) => `<button class="llc${L.pay === k ? " on" : ""}" data-a="llpay" data-k="${k}" aria-pressed="${L.pay === k}"><span>${t}</span><small class="num"${sub[0] === "#" ? ` id="${sub.slice(1)}"` : ""}>${sub[0] === "#" ? "" : sub}</small></button>`;
  const row = (lab, body, cls = "") => `<div class="llrow${cls}"><span class="lllab">${lab}</span><div class="llval">${body}</div></div>`;
  openModal(`<div class="llhd"><span class="pvav" style="background:${pvCol(s.name)}">${esc(pvIni(s.name))}</span><div><h2>Llegó ${esc(s.name)}</h2><small>${b > 0 ? `Ya le debías <b class="num">${money(b)}</b>` : "No le debías nada"}</small></div><button class="link" data-a="llcambiar">Cambiar</button></div>
    ${row(`Boleta<small>vacía si solo cobra</small>`, `<label class="llbox"><i>S/</i><input id="lla" class="num" inputmode="decimal" placeholder="0.00" autocomplete="off" value="${esc(L.dejo)}" aria-label="De cuánto es la boleta"></label>`)}
    ${row("Le pagas", `<div class="llseg${b > 0 ? " c4" : ""}">${chip("hoy", "La boleta", "#llh")}${b > 0 ? chip("todo", "Todo", "#llt") : ""}${chip("otro", "Abono", "una parte")}${chip("nada", "Nada", "me fió")}</div>
      ${L.pay === "otro" ? `<label class="llbox sm"><i>S/</i><input id="llo" class="num" inputmode="decimal" placeholder="¿Cuánto abonas?" autocomplete="off" value="${esc(L.otro)}" aria-label="Cuánto abonas"></label>` : ""}`)}
    ${L.pay !== "nada" ? row(`Con${L.m === "efectivo" ? `<small class="${cash ? "" : "bad"}">${cash ? "sale de la caja" : "no puedes sacar de la caja"}</small>` : ""}`, `<div class="llseg c4 llm">${["efectivo", "yape", "plin", "bcp"].map((m) => `<button class="llc${L.m === m ? " on" : ""}" data-a="llmet" data-m="${m}" aria-pressed="${L.m === m}"><i class="pmi m-${m}" aria-hidden="true"></i><span>${METHODS[m]}</span></button>`).join("")}</div>`) : ""}
    ${row("Nota", `<input class="inp" id="lln" maxlength="50" placeholder="Opcional: factura 123, gaseosas…" value="${esc(L.note)}" aria-label="Nota">`)}
    <div class="llres" id="llres" aria-live="polite"></div>
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" id="llok" data-a="llok" data-enter>Guardar</button></div>`, "llsheet");
  ["lla", "llo", "lln"].forEach((k) => { const i = $("#" + k); if (i) i.oninput = () => { llegoRead(); llegoUpd(); }; });
  llegoUpd();
  setTimeout(() => { const i = $(L.pay === "otro" && !L.otro ? "#llo" : "#lla"); if (i && !L.dejo) { i.focus(); i.select(); } }, 30);
}
function llegoUpd() {
  const c = llegoCalc(); if (!c) return;
  const t = $("#llt"), h = $("#llh"), r = $("#llres"), ok = $("#llok");
  if (t) t.textContent = money(Math.max(0, c.total)); if (h) h.textContent = money(c.dejo);
  if (r) {
    r.className = "llres " + (c.queda > 0 ? "debe" : "ok");
    const ln = (t, v) => `<p><span>${t}</span><span class="num">${v}</span></p>`;
    const parts = (c.b > 0 ? ln("Ya le debías", money(c.b)) : "") + (c.dejo > 0 ? ln("+ Boleta de hoy", money(c.dejo)) : "") + (c.pago > 0 ? ln("− Le pagas", money(c.pago)) : "");
    r.innerHTML = (parts ? `<div class="llcta">${parts}</div>` : "") + `<p class="lltot"><span>${c.queda > 0 ? "Le quedarás debiendo" : "No le debes nada"}</span><b class="num">${c.queda > 0 ? money(c.queda) : "✓"}</b></p>`;
  }
  if (ok) ok.disabled = !(c.dejo > 0 || c.pago > 0);
}
act({
  llego: (el) => llegoUI(el.dataset.id),
  llpick: (el) => { if (!ui.ll) return; ui.ll.id = el.dataset.id; llegoPaint(); },
  llcambiar: () => { if (!ui.ll) return; llegoRead(); ui.ll.id = ""; llegoPaint(); },
  llpay: (el) => { if (!ui.ll) return; llegoRead(); ui.ll.pay = el.dataset.k; llegoPaint(); if (el.dataset.k === "otro") setTimeout(() => { const i = $("#llo"); if (i) i.focus(); }, 40); },
  llmet: (el) => { if (!ui.ll) return; llegoRead(); ui.ll.m = el.dataset.m; llegoPaint(); },
  llok: () => {
    llegoRead(); const L = ui.ll, c = L && llegoCalc(); if (!c) return;
    if (!(c.dejo > 0 || c.pago > 0)) return toast("Escribe lo que te dejó o cuánto le pagas");
    if (c.pago > 0 && REM) return toast("Los pagos a proveedores se anotan en la caja de la tienda", true);
    if (c.pago > 0 && L.m === "efectivo" && !can("caja")) return toast("Tu usuario no puede sacar dinero de la caja");
    const s = c.s, u = me(), note = (L.note || "").trim(), t = Date.now();
    let nuevo = null;
    if (c.dejo > 0) { const e = { id: uid(), sid: s.id, t, date: dkey(), type: "deuda", amt: c.dejo, note, m: "", u: u ? u.id : "", un: u ? u.name : "" }; DB.sm.push(e); nuevo = e.id; }
    if (c.pago > 0) {
      const mv = addMove("proveedor", c.pago, `${s.name}${note ? " · " + note : ""}`, { m: L.m, sup: s.id });
      const e = { id: uid(), sid: s.id, t: t + 1, date: dkey(), type: "pago", amt: c.pago, note, m: L.m, mv: mv.id, u: u ? u.id : "", un: u ? u.name : "" }; DB.sm.push(e); nuevo = e.id;
    }
    log("Llegó un proveedor", `${s.name}: dejó ${money(c.dejo)}${c.pago > 0 ? `, le pagaste ${money(c.pago)} (${METHODS[L.m]})` : ""}`); save();
    if (ui.ps === s.id) ui.pvNew = nuevo;
    ui.ll = null; closeModal();
    toast(c.queda > 0 ? `Anotado: le debes ${money(c.queda)} a ${s.name}` : c.pago > 0 ? `Anotado: le pagaste ${money(c.pago)} a ${s.name} ✓` : `Anotado ✓`);
    render();
  }
});
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
  psopen: (el) => { ui.ps = el.dataset.id; render(); window.scrollTo(0, 0); },
  pvall: (el) => { ui.pvAll = el.dataset.id; render(); },
  psnew: () => suppForm(""),
  psedit: (el) => suppForm(el.dataset.id),
  pssave: (el) => {
    const g = (k) => ($("#pf-" + k) || { value: "" }).value.trim(), name = g("name"), id = el.dataset.id;
    if (!name) return toast("Escribe el nombre");
    if (DB.supp.some((x) => x.id !== id && x.name.toLowerCase() === name.toLowerCase())) return toast("Ya tienes un proveedor con ese nombre");
    let s = id ? supp(id) : null;
    if (s) Object.assign(s, { name, phone: g("phone"), note: g("note") }); else { s = { id: uid(), name, phone: g("phone"), note: g("note"), t: Date.now() }; DB.supp.push(s); log("Proveedor creado", name); }
    save(); toast("Proveedor guardado");
    if (ui.ll && !id) { ui.ll.id = s.id; render(); return llegoPaint(); } // vino de «Llegó un proveedor»: sigue ahí con el nuevo
    closeModal(); ui.ps = s.id; render();
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
