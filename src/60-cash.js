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
// Cambiar turno (pedido de David, 26 oct 2026): se cuenta la caja y, al cerrar, el que sigue abre con lo contado ya puesto.
// No imprime solo: «Imprimir» queda como botón.
const arqRes = (sh) => (sh.diff === 0 ? "La caja cuadra ✓" : sh.diff < 0 ? `Faltó ${money(-sh.diff)}` : `Sobró ${money(sh.diff)}`);
function turnoSigue(sh) {
  openModal(`<div class="arqfin"><span class="arqico ${sh.diff === 0 ? "ok" : sh.diff < 0 ? "short" : "over"}">${sh.diff === 0 ? "✓" : "!"}</span><h2>Turno cerrado</h2>
    <p>${esc(sh.un)} dejó <b class="num">${money(sh.counted)}</b> en el cajón · ${arqRes(sh)}</p><p class="muted">¿Quién recibe la caja?</p></div>
    <div class="btns h">${needLogin() ? `<button class="btn sec" data-a="shopen">Sigo yo</button><button class="btn" data-a="turnolock" data-enter>Entra otro cajero</button>` : `<button class="btn sec" data-a="close">Ahora no</button><button class="btn" data-a="shopen" data-enter>Abrir el siguiente turno</button>`}</div>
    <button class="link arqprn" data-a="liqprint" data-id="${sh.id}">${svg("print", "bi")}Imprimir el cierre del turno</button>`);
}
// Al terminar: lo que pasó y botones para imprimir si quiere.
function cajaListo(sh, z) {
  openModal(`<div class="arqfin"><span class="arqico ${!sh || sh.diff === 0 ? "ok" : sh.diff < 0 ? "short" : "over"}">${!sh || sh.diff === 0 ? "✓" : "!"}</span><h2>${z ? "Día cerrado" : "Caja cerrada"}</h2>
    ${sh ? `<p>Contaste <b class="num">${money(sh.counted)}</b> · ${arqRes(sh)}</p>` : ""}${z ? `<p class="muted">Cierre del día (Z) N° ${pad(z.z, 4)} guardado.</p>` : ""}</div>
    <div class="btns h">${sh ? `<button class="btn sec" data-a="liqprint" data-id="${sh.id}">${svg("print", "bi")}Imprimir caja</button>` : ""}${z ? `<button class="btn sec" data-a="zprint" data-id="${z.id}">${svg("print", "bi")}Imprimir Z</button>` : ""}<button class="btn" data-a="close" data-enter>Listo</button></div>`);
}
// Cerrar caja del día: cuenta tu caja si está abierta y luego hace el cierre del día (Z).
function cerrarDia() {
  if (REM) return remCierreUI(); // a distancia: todas las cajas abiertas en una sola ventana
  const k = dkey(); ui.date = k;
  const mine = curShift(), z = DB.closes.some((x) => x.date === k);
  if (z) { if (mine) { ui.cnt = null; ui.turno = ui.dia = false; return closeShiftUI(mine.id); } return toast("Hoy ya tiene cierre del día"); }
  const abiertas = DB.shifts.filter((s) => !s.t1 && s.u !== ui.user);
  if (abiertas.length && ui.lastSh) { cajaListo(ui.lastSh); ui.lastSh = null; }
  if (abiertas.length) return toast(`Primero cierren ${abiertas.length === 1 ? "la caja de" : "las cajas de"} ${abiertas.map((s) => s.un).join(", ")}. Tócala en «Cajas del día».`, true);
  if (mine) { ui.cnt = null; ui.turno = false; ui.dia = true; return closeShiftUI(mine.id); }
  need("cierre", () => A.zclose(), "Cierre del día");
}
// Contar la caja: la ventana de siempre (resumen a la izquierda, billetes y monedas a la derecha) pero más compacta
// (pedido de David, 26 oct 2026) y con «Contaste S/ X» + «Ver lo que contaste». Todo se pone al día sin redibujar la ventana.
const denLbl = (d) => (d < 1 ? `S/ ${d.toFixed(2)}` : `S/ ${d}`);
function closeShiftUI(id) {
  const sh = DB.shifts.find((s) => s.id === id); if (!sh) return;
  ui.cnt = ui.cnt && ui.cnt.id === id ? ui.cnt : { id, q: {}, direct: "" };
  const S = shiftSummary(sh), q = ui.cnt.q, conDen = Object.values(q).some((n) => n > 0);
  const val = ui.cnt.direct !== "" ? ui.cnt.direct : conDen ? countTotal(q).toFixed(2) : "";
  const tit = ui.turno ? "Cambiar turno" : ui.dia ? "Cerrar caja del día" : `Cerrar la caja de ${esc(sh.un)}`;
  const ok = ui.turno ? "Cerrar y pasar la caja" : ui.dia ? "Cerrar caja del día" : "Cerrar caja";
  const ln = (t, a, cls) => `<div class="kv${cls ? " " + cls : ""}"><span>${t}</span><b class="num">${money(a)}</b></div>`;
  const dig = (S.by.yape || 0) + (S.by.plin || 0) + (S.by.bcp || 0) + (S.by.culqi || 0) + (S.by.tarjeta || 0) + (S.by.transferencia || 0);
  openModal(`<div class="arqv"><h2>${tit}</h2><p class="muted">${esc(sh.un)} · abierta ${fmtDT(sh.t0)} · ${S.n === 1 ? "1 venta" : S.n + " ventas"}</p>
    <div class="cols2"><div>
      ${ln("Caja inicial", sh.open)}${ln("+ Ventas en efectivo", S.by.efectivo || 0)}${S.abonosCash ? ln("+ Cobros de deudas", S.abonosCash) : ""}${S.ingresos ? ln("+ Otros ingresos", S.ingresos) : ""}${S.prov ? ln("− Proveedores", S.prov) : ""}${S.gastos ? ln("− Gastos", S.gastos) : ""}${S.retiros ? ln("− Retiros", S.retiros) : ""}${S.devol || S.anul ? ln("− Devoluciones y anulaciones", S.devol + S.anul) : ""}
      ${ln("Debe haber", S.expected, "strong")}${ln("Yape / Plin / BCP / tarjeta", dig)}${S.by.credito ? ln("Ventas al crédito", S.by.credito) : ""}
      <div class="arqsum"><span>Contaste</span><b class="num" id="arqtot">S/ 0.00</b></div>
      <div class="verdict" id="arqres" aria-live="polite"></div>
      <button class="link arqver" data-a="arqver" id="arqverb">Ver lo que contaste</button>
      <div class="arqlist" id="arqlist" hidden></div>
    </div><div>
      <p class="muted sm" style="margin-bottom:4px">Cuenta billetes y monedas (o escribe el total abajo):</p>
      ${DENOMS.map((d) => `<div class="den"><b class="num">${denLbl(d)}</b><span class="step"><button data-a="den" data-d="${d}" data-v="-1" aria-label="Quitar ${denLbl(d)}">−</button><span class="num" data-dq="${d}">${q[d] || 0}</span><button data-a="den" data-d="${d}" data-v="1" aria-label="Agregar ${denLbl(d)}">+</button></span><span class="s num" data-ds="${d}">${money(d * (q[d] || 0))}</span></div>`).join("")}
      <label class="fld" style="margin-top:6px"><span>Total contado (S/)</span><input class="inp num" id="cntd" inputmode="decimal" placeholder="0.00" autocomplete="off" value="${esc(val)}"></label>
    </div></div>
    <label class="fld"><span>Observación (opcional)</span><input class="inp" id="cntn" maxlength="60"></label></div>
    <div class="btns h"><button class="btn sec" data-a="cntcancel">Cancelar</button><button class="btn" id="arqok" data-a="shclose" data-id="${sh.id}" data-enter disabled>${ok}</button></div>`, "wide");
  ui.mk = "count"; ui.cnt.exp = S.expected; ui.cnt.ver = false; arqUpd();
}
// Pone al día lo contado, el resultado y la lista sin volver a dibujar la ventana (así no se pierde lo que se escribe).
function arqUpd() {
  const c = ui.cnt, r = $("#arqres"), b = $("#arqok"); if (!c || !r) return;
  const dir = c.direct.trim() !== "", any = dir || Object.values(c.q).some((n) => n > 0), counted = dir ? r2(num(c.direct)) : countTotal(c.q), diff = r2(counted - (c.exp || 0));
  DENOMS.forEach((d) => { const e = $(`[data-ds="${d}"]`); if (e) e.textContent = money(d * (c.q[d] || 0)); });
  const t = $("#arqtot"); if (t) t.textContent = money(any ? counted : 0);
  r.hidden = !any; r.className = "verdict " + (diff === 0 ? "ok" : diff < 0 ? "short" : "over");
  r.innerHTML = `<span>${diff === 0 ? "La caja cuadra" : diff < 0 ? "Falta dinero" : "Sobra dinero"}</span><b class="num">${diff === 0 ? "✓" : money(Math.abs(diff))}</b>`;
  const L = $("#arqlist"), vb = $("#arqverb");
  if (vb) vb.textContent = c.ver ? "Ocultar lo que contaste" : "Ver lo que contaste";
  if (L) {
    L.hidden = !c.ver;
    const rows = DENOMS.filter((d) => c.q[d] > 0).map((d) => `<div><span>${c.q[d]} × ${denLbl(d)}</span><b class="num">${money(d * c.q[d])}</b></div>`).join("");
    L.innerHTML = rows || dir ? `${rows}${dir && rows && r2(countTotal(c.q)) !== counted ? `<div class="muted"><span>Escribiste el total a mano</span><b class="num">${money(counted)}</b></div>` : ""}${!rows && dir ? `<div><span>Escribiste el total</span><b class="num">${money(counted)}</b></div>` : ""}<div class="tot"><span>Total contado</span><b class="num">${money(counted)}</b></div>` : `<p class="muted sm">Todavía no contaste nada.</p>`;
  }
  if (b) b.disabled = !any;
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
// «Ventas del día»: total grande, barra con lo que entró por cada medio y cada medio con su logo o ícono.
function cajaDia(T) {
  const rows = ["efectivo", "yape", "plin", "bcp", "culqi", "tarjeta", "transferencia", "credito", "puntos"]
    .filter((m) => T.by[m] || ["efectivo", "yape", "plin"].includes(m))
    .map((m) => ({ m, amt: (m === "yape" ? T.yapeAll : T.by[m]) || 0 }));
  const sum = rows.reduce((a, r) => a + r.amt, 0);
  const pct = (a) => (sum > 0 ? Math.round((a / sum) * 100) : 0);
  return `<div class="vdtop"><h2>Ventas del día</h2><div class="vdtot"><b class="num">${money(T.sales)}</b><span>${T.n === 1 ? "1 venta" : `${T.n} ventas`}</span></div></div>
    ${sum > 0 ? `<div class="vdbar" role="img" aria-label="${rows.filter((r) => r.amt > 0).map((r) => `${METHODS[r.m]} ${pct(r.amt)}%`).join(", ")}">${rows.filter((r) => r.amt > 0).map((r) => `<i class="m-${r.m}" style="width:${((r.amt / sum) * 100).toFixed(2)}%"></i>`).join("")}</div>` : ""}
    <div class="vdrows">${rows.map((r) => `<div class="vdr${r.amt ? "" : " cero"}"><i class="pmi m-${r.m}" aria-hidden="true"></i><span class="vdn">${METHODS[r.m]}${r.m === "yape" && T.yapeMan ? `<small>${money(T.yapeMan)} anotados a mano</small>` : ""}</span>${sum > 0 && r.amt ? `<span class="vdp">${pct(r.amt)}%</span>` : ""}<b class="num">${money(r.amt)}</b></div>`).join("")}</div>`;
}

VIEWS.caja = function viewCash(v) {
  // A distancia la caja abierta es la del cajero de la tienda (no la de este equipo).
  const k = ui.date, T = dayTotals(k), mine = REM ? openShifts().sort((a, b) => a.t0 - b.t0)[0] || null : curShift(), today = k === dkey();
  const shifts = DB.shifts.filter((s) => s.d0 === k || (!s.t1 && today)).filter((s, i, a) => a.indexOf(s) === i).sort((a, b) => a.t0 - b.t0);
  const moves = DB.moves.filter((m) => m.date === k).sort((a, b) => b.t - a.t);
  const z = DB.closes.find((x) => x.date === k), others = shifts.filter((s) => !s.t1 && (REM ? s !== mine : s.u !== ui.user));
  const MS = mine ? shiftSummary(mine) : null;
  v.innerHTML = `<div class="ph"><h1>Caja</h1>${can("caja") ? `<div class="row wrap"><button class="btn sec sm" data-a="mv" data-t="gasto">Gasto</button><button class="btn sec sm" data-a="mv" data-t="yape">Anotar Yapes</button><button class="btn sec sm" data-a="cajamas">Más</button></div>` : ""}</div>
    <div class="datebar"><button data-a="dstep" data-d="-1" aria-label="Día anterior">‹</button><label><span>${esc(fmtDate(k))}${!today ? ` · ${dmy(k)}` : ""}</span><input type="date" value="${k}" max="${dkey()}" data-in="date" aria-label="Elegir fecha"></label><button data-a="dstep" data-d="1" aria-label="Día siguiente" ${today ? "disabled" : ""}>›</button></div>
    ${today && can("caja") ? `<div class="card shiftcard ${mine ? "open" : ""}">${mine ? `<div class="row sp wrap"><div><h2>${REM ? `Caja abierta · ${esc(mine.un)}` : "Tu caja está abierta"}</h2><p class="muted">Desde ${hhmm(mine.t0)} · ${REM ? "empezó" : "empezaste"} con ${money(mine.open)} <button class="link xs" data-a="shopenedit" data-id="${mine.id}">${mine.open ? "Cambiar" : "Anotar sencillo"}</button> · ${MS.n} ventas</p></div><div class="bigcash"><span>Efectivo que debe haber</span><b class="num">${money(MS.expected)}</b></div></div>
      <div class="row wrap cjacts3" style="margin-top:12px"><button class="btn sec" data-a="shturno" data-id="${mine.id}">${svg("swap", "bi")}Cambiar turno</button><button class="btn" data-a="cerrardia">${svg("lock", "bi")}Cerrar caja del día</button></div>`
      : `<div class="row sp wrap"><div><h2>${REM ? "Su caja está cerrada" : "Tu caja está cerrada"}</h2><p class="muted">${REM ? "Se abre sola con su primera venta, o ábrela aquí con el sencillo del cajón." : "Ábrela con el sencillo del cajón para empezar a cobrar."}</p></div><div class="row wrap cjacts3">${!z && shifts.length ? `<button class="btn sec" data-a="cerrardia">${svg("lock", "bi")}Cerrar caja del día</button>` : ""}<button class="btn" data-a="shopen">Abrir caja</button></div></div>`}${REM ? `<p class="muted sm" style="margin-top:10px">Ves la última copia que subió su caja. Lo que hagas aquí le llega en un minuto y allá se calcula con todas sus ventas.</p>` : ""}</div>` : ""}
    <div class="cols stack"><div class="stack">
      <div class="card vdia">${cajaDia(T)}
        ${T.abonos ? `<div class="kv"><span>Cobros de deudas</span><span class="num">${money(T.abonos)}</span></div>` : ""}${T.ret ? `<div class="kv"><span>Devoluciones</span><span class="num">− ${money(T.ret)}</span></div>` : ""}${T.voids ? `<div class="kv"><span>Ventas anuladas</span><span class="num">${T.voids}</span></div>` : ""}</div>
      <div class="card"><h2>Movimientos</h2>${moves.length ? moves.map((m) => `<div class="kv"><span>${hhmm(m.t)} · ${MOVE[m.type] ? MOVE[m.type][0] : m.type}${m.m && m.m !== "efectivo" ? ` (${METHODS[m.m]})` : ""}${m.note ? " · " + esc(m.note) : ""}<small class="muted"> · ${esc(m.u || "")}</small></span><span class="num">${(MOVE[m.type] || [0, 0])[1] < 0 ? "−" : "+"} ${money(m.amount)}${can("cierre") && !["abono", "devolucion", "anulacion"].includes(m.type) && !isLocked(m.date) ? ` <button class="link xs" data-a="mvdel" data-id="${m.id}" aria-label="Borrar movimiento">✕</button>` : ""}</span></div>`).join("") : `<p class="muted">Sin gastos, pagos ni ingresos anotados.</p>`}</div>
    </div><div class="stack">
      <div class="card"><h2>Cajas del día</h2>${shifts.length ? shifts.map((s) => { const S = s.t1 ? null : shiftSummary(s); return `<div class="kv click" data-a="liq" data-id="${s.id}"><span><b>${esc(s.un)}</b><small class="muted"> · ${hhmm(s.t0)}${s.t1 ? "–" + hhmm(s.t1) : " · abierta"}</small></span><span class="num">${s.t1 ? `${money(s.counted)} <span class="tag ${s.diff === 0 ? "" : s.diff < 0 ? "out" : "low"}">${s.diff === 0 ? "cuadra" : (s.diff < 0 ? "falta " : "sobra ") + money(Math.abs(s.diff))}</span>` : `${money(S.expected)} <span class="tag">abierta</span>`}</span></div>`; }).join("") : `<p class="muted">Nadie abrió caja este día.</p>`}
        ${others.length && can("cierre") ? `<p class="muted sm" style="margin-top:8px">Como supervisor puedes cerrar una caja ajena tocándola.</p>` : ""}</div>
      ${can("cierre") ? `<div class="card"><h2>Cerrar el día</h2>${z ? `<p>Cerrado por ${esc(z.un)} a las ${hhmm(z.t)} · Z N° ${pad(z.z, 4)}</p><div class="row wrap" style="margin-top:10px"><button class="btn sec" data-a="zprint" data-id="${z.id}">${svg("print", "bi")}Imprimir Z</button></div>`
        : `<p class="muted" style="margin-bottom:10px">Resume ventas, comprobantes y cajas del día. ${shifts.some((s) => !s.t1) ? "<b>Primero cierren las cajas abiertas.</b>" : ""}</p><button class="btn" data-a="zclose" ${shifts.some((s) => !s.t1) || (!T.n && !shifts.length) ? "disabled" : ""}>Hacer cierre del día</button>`}</div>
      <details class="card dtl"><summary>Cerrar el mes</summary><p class="muted" style="margin:10px 0">Al cerrar un mes, sus ventas ya no se pueden anular ni devolver.</p>${DB.periods.slice(-4).reverse().map((p) => `<div class="kv"><span>${esc(p.label)}</span><span class="num">${money(p.total)} <small class="muted">· ${p.n} ventas</small></span></div>`).join("")}<button class="btn sec sm" data-a="period" style="margin-top:8px">Cerrar un mes</button></details>` : ""}
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
  shcount: (el) => { ui.cnt = null; ui.turno = ui.dia = false; ui.lastSh = null; closeShiftUI(el.dataset.id); },
  shturno: (el) => { ui.cnt = null; ui.turno = true; ui.dia = false; closeShiftUI(el.dataset.id); },
  turnolock: () => { closeModal(); lockNow(); },
  cerrardia: () => { ui.lastSh = null; cerrarDia(); },
  liq: (el) => {
    const sh = DB.shifts.find((s) => s.id === el.dataset.id); if (!sh) return; ui.turno = ui.dia = false;
    if (!sh.t1 && sh.u !== ui.user) return can("cierre") ? confirmBox(`¿Cerrar la caja de ${sh.un}?`, "Hacer arqueo", () => { ui.cnt = null; closeShiftUI(sh.id); }, false) : toast("Solo un supervisor puede cerrar una caja ajena");
    if (!sh.t1) { ui.cnt = null; return closeShiftUI(sh.id); }
    openModal(`<div class="rcpt">${liqHtml(sh)}</div><div class="btns h"><button class="btn sec" data-a="close">Cerrar</button><button class="btn" data-a="liqprint" data-id="${sh.id}">${svg("print", "bi")}Imprimir</button></div>`);
  },
  liqprint: (el) => { const sh = DB.shifts.find((s) => s.id === el.dataset.id); if (sh) printHtml(liqHtml(sh)); },
  den: (el) => {
    const c = ui.cnt; if (!c) return; const d = el.dataset.d; c.q[d] = Math.max(0, (c.q[d] || 0) + +el.dataset.v); c.direct = "";
    const n = $(`[data-dq="${d}"]`); if (n) n.textContent = c.q[d]; const i = $("#cntd"); if (i) i.value = Object.values(c.q).some((x) => x > 0) ? countTotal(c.q).toFixed(2) : ""; arqUpd();
  },
  arqver: () => { if (ui.cnt) { ui.cnt.ver = !ui.cnt.ver; arqUpd(); } },
  cntcancel: () => { ui.cnt = null; ui.turno = ui.dia = false; closeModal(); },
  shclose: (el) => {
    const sh = DB.shifts.find((s) => s.id === el.dataset.id), c = ui.cnt; if (!sh || !c) return;
    const S = shiftSummary(sh), counted = c.direct !== "" ? r2(num(c.direct)) : countTotal(c.q);
    Object.assign(sh, { t1: Date.now(), d1: dkey(), q: c.q, counted, expected: S.expected, diff: r2(counted - S.expected), note: ($("#cntn") || { value: "" }).value.trim(), by: me().name, sum: S });
    log("Cierre de caja", `${sh.un}: esperado ${money(S.expected)}, contado ${money(counted)}`);
    ui.cnt = null; save(sh.d0); closeModal(); render();
    if (ui.turno) { ui.turno = false; turnoSigue(sh); }
    else if (ui.dia) { ui.dia = false; ui.lastSh = sh; cerrarDia(); }
    else cajaListo(sh);
  },
  zclose: () => need("cierre", () => {
    const k = ui.date; if (DB.closes.some((x) => x.date === k)) return toast("Este día ya tiene cierre");
    const z = { id: uid(), z: ++DB.zseq, date: k, t: Date.now(), un: me().name, sum: zSummary(k) };
    DB.closes.push(z); log("Cierre del día", `Z ${z.z} · ${dmy(k)}`); save(k); render(); cajaListo(ui.lastSh, z); ui.lastSh = null;
  }, "Cierre del día"),
  zprint: (el) => { const z = DB.closes.find((x) => x.id === el.dataset.id); if (z) printHtml(zHtml(z)); },
  cajamas: () => openModal(`<h2>Más movimientos de caja</h2><div class="fgrid" style="margin:12px 0"><button class="fb" data-a="tab" data-t="prov">Proveedores</button><button class="fb" data-a="mv" data-t="ingreso">Ingreso de dinero</button><button class="fb" data-a="mv" data-t="retiro">Retiro de dinero</button></div><div class="btns h"><button class="btn sec" data-a="close">Cerrar</button></div>`),
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
