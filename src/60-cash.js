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
/* Caja «botones grandes» (opción D de David, 26 oct 2026): cuánto debe haber en el cajón, 4 botones grandes, cambio de turno resaltado y cómo te pagaron. */
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
  open: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>'
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
// «Cómo te pagaron»: cada medio del que más entró al que menos, con su barra, % y cuántas ventas; compra promedio, hora fuerte y fiado.
function cajaPagos(k, T, today) {
  const sales = DB.sales.filter((s) => s.date === k && !s.void), cnt = {}, hrs = {};
  sales.forEach((s) => { new Set(paysOf(s).map((p) => p.m)).forEach((m) => { cnt[m] = (cnt[m] || 0) + 1; }); const h = new Date(s.t).getHours(); hrs[h] = (hrs[h] || 0) + s.total; });
  const rows = Object.keys(METHODS).map((m) => ({ m, amt: r2((m === "yape" ? T.yapeAll : T.by[m]) || 0), n: cnt[m] || 0 })).filter((r) => r.amt > 0).sort((a, b) => b.amt - a.amt);
  const sum = rows.reduce((a, r) => a + r.amt, 0), max = rows.length ? rows[0].amt : 0, top = rows.length > 1;
  const hTop = Object.keys(hrs).sort((a, b) => hrs[b] - hrs[a])[0];
  return `<h2 class="cjh">Cómo te pagaron ${today ? "hoy" : "este día"}</h2><div class="cjtot"><b class="num">${money(T.sales)}</b><span>${T.n === 1 ? "1 venta" : `${T.n} ventas`}</span></div>
    ${rows.length ? `<div class="cjpr">${rows.map((r, i) => `<div class="cjr${i === 0 && top ? " top" : ""}"><span class="cjn">${i + 1}</span><i class="pmi m-${r.m}" aria-hidden="true"></i><div class="cjnm"><span>${METHODS[r.m]}${i === 0 && top ? "<em>El más usado</em>" : ""}${r.m === "yape" && T.yapeMan ? `<small>${money(T.yapeMan)} anotados a mano</small>` : ""}</span><div class="cjbar"><i class="m-${r.m}" style="width:${max ? Math.max(2, (r.amt / max) * 100).toFixed(1) : 0}%"></i></div></div><div class="cjv num">${money(r.amt)}<small>${Math.round((r.amt / sum) * 100)}%${r.n ? ` · ${r.n === 1 ? "1 venta" : r.n + " ventas"}` : ""}</small></div></div>`).join("")}</div>`
      : `<p class="muted cjvac">Todavía no hay ventas ${today ? "hoy" : "este día"}.</p>`}
    ${T.n ? `<div class="cjmini"><div><b class="num">${money(T.total / T.n)}</b>Compra promedio</div><div><b>${hTop !== undefined ? cjHora(+hTop) : "—"}</b>Hora que más vendes</div><div><b class="num">${money(T.by.credito || 0)}</b>Fiado ${today ? "hoy" : "ese día"}</div></div>` : ""}
    ${T.abonos ? `<div class="kv"><span>Cobros de deudas</span><span class="num">${money(T.abonos)}</span></div>` : ""}${T.ret ? `<div class="kv"><span>Devoluciones</span><span class="num">− ${money(T.ret)}</span></div>` : ""}${T.voids ? `<div class="kv"><span>Ventas anuladas</span><span class="num">${T.voids}</span></div>` : ""}`;
}
// Turnos del día y el botón resaltado «Pasar al turno de la tarde/noche».
function cajaTurnos(shifts, mine, today) {
  const ix = cjIdx(shifts);
  const rows = shifts.map((s) => {
    const [tn, ic] = CJ_TN[ix.get(s)], S = s.t1 ? null : shiftSummary(s);
    const tag = s.t1 ? `<span class="tag ${s.diff === 0 ? "cjok" : s.diff < 0 ? "out" : "low"}">${s.diff === 0 ? "Cuadró ✓" : (s.diff < 0 ? "Faltó " : "Sobró ") + money(Math.abs(s.diff))}</span>` : `<span class="tag cjon">Abierta</span>`;
    return `<button class="cjtr" data-a="liq" data-id="${s.id}"><span class="cjic ${ic}">${cjI(ic)}</span><span class="cjtx"><b>${tn} · ${esc(s.un)}</b><small>${s.t1 ? `${hhmm(s.t0)}–${hhmm(s.t1)} · contó ${money(s.counted)}` : `Desde ${hhmm(s.t0)} · ${S.n === 1 ? "1 venta" : S.n + " ventas"}${s === mine ? " · tú" : ""}`}</small></span>${tag}</button>`;
  }).join("");
  if (!today) return `<div class="card cjturn"><h2 class="cjth">Cajas del día</h2><div class="cjtl">${rows || `<p class="muted cjvac">Nadie abrió caja este día.</p>`}</div></div>`;
  const others = shifts.filter((s) => !s.t1 && s !== mine);
  const ni = mine ? Math.max(cjHi(Date.now()), ix.get(mine) + 1) : 0, next = ni > 2 ? null : [CJ_TN[ni][2], CJ_TN[ni][1]];
  return `<div class="card cjturn${mine ? " on" : ""}"><h2 class="cjth">${cjI("swap")}${mine ? "Cambio de turno" : "Turnos de hoy"}</h2>
    <div class="cjtl">${rows}${mine && next ? `<div class="cjtr cjwait"><span class="cjic ${next[1]}">${cjI(next[1])}</span><span class="cjtx"><b>Turno de ${next[0]}</b><small>Le toca a quien reciba la caja</small></span><span class="tag">Sigue</span></div>` : rows ? "" : `<p class="muted cjvac">Nadie abrió caja hoy.</p>`}</div>
    ${mine ? `<button class="cjtbtn" data-a="shturno" data-id="${mine.id}">${cjI("swap")}${next ? `Pasar al turno de ${next[0]}` : "Pasar la caja a otro cajero"}</button><button class="cjtlink" data-a="shcount" data-id="${mine.id}">Cerrar la caja por hoy</button>` : ""}
    ${others.length && can("cierre") ? `<p class="muted sm cjsup">Como supervisor puedes cerrar una caja ajena tocándola.</p>` : ""}</div>`;
}
VIEWS.caja = function viewCash(v) {
  const k = ui.date, T = dayTotals(k), mine = curShift(), today = k === dkey(), puede = can("caja"), hoy = today && puede;
  const shifts = DB.shifts.filter((s) => s.d0 === k || (!s.t1 && today)).filter((s, i, a) => a.indexOf(s) === i).sort((a, b) => a.t0 - b.t0);
  const moves = DB.moves.filter((m) => m.date === k).sort((a, b) => b.t - a.t);
  const z = DB.closes.find((x) => x.date === k), MS = mine ? shiftSummary(mine) : null;
  const datebar = `<div class="datebar"><button data-a="dstep" data-d="-1" aria-label="Día anterior">‹</button><label><span>${esc(fmtDate(k))}${!today ? ` · ${dmy(k)}` : ""}</span><input type="date" value="${k}" max="${dkey()}" data-in="date" aria-label="Elegir fecha"></label><button data-a="dstep" data-d="1" aria-label="Día siguiente" ${today ? "disabled" : ""}>›</button></div>`;
  const ln = (t, a, neg) => `<span>${t}</span><b class="num${neg ? " neg" : ""}">${money(a)}</b>`;
  const cash = !hoy ? "" : mine
    ? `<div class="card cjcash"><small>En el cajón debe haber</small><div class="cjm num">${money(MS.expected)}</div>
      <div class="cjhow">${ln(`Empezaste con <button class="link xs" data-a="shopenedit" data-id="${mine.id}">${mine.open ? "Cambiar" : "Anotar sencillo"}</button>`, mine.open)}${ln("+ Vendiste en efectivo", MS.by.efectivo || 0)}${MS.abonosCash ? ln("+ Te pagaron deudas", MS.abonosCash) : ""}${MS.ingresos ? ln("+ Metiste plata", MS.ingresos) : ""}${MS.gastos ? ln("− Gastos", MS.gastos, 1) : ""}${MS.prov ? ln("− Proveedores", MS.prov, 1) : ""}${MS.retiros ? ln("− Sacaste", MS.retiros, 1) : ""}${MS.devol || MS.anul ? ln("− Devoluciones", MS.devol + MS.anul, 1) : ""}</div></div>`
    : `<div class="card cjcash off"><small>Tu caja está cerrada</small><div class="cjm">Ábrela para empezar a vender</div><button class="cjopen" data-a="shopen">${cjI("open")}<span>Abrir caja<small>Con el sencillo del cajón</small></span></button></div>`;
  const tb = (t, ic, tit, sub, cls, off) => `<button class="cjb ${cls}" data-a="mv" data-t="${t}"${off ? ' disabled title="Primero abre tu caja"' : ""}>${cjI(ic)}<span>${tit}<small>${sub}</small></span></button>`;
  const btns = !hoy ? "" : `<div class="cjg">${tb("gasto", "gasto", "Anotar un gasto", "Bolsas, pasaje, luz…", "c-gas", !mine)}${tb("retiro", "retiro", "Sacar plata", "Guardar o depositar", "c-sac", !mine)}${tb("ingreso", "ingreso", "Meter plata", "Sencillo, cambio", "c-met", !mine)}${tb("yape", "yape", "Anotar Yapes", "Los que no pasaste", "c-yap")}</div>
    ${mine ? `<button class="cjpbar" data-a="liqprint" data-id="${mine.id}">${cjI("print")}Imprimir cómo voy <small>(corte sin cerrar)</small></button>` : ""}`;
  const all = ui.cjAll || moves.length <= 4, ms = all ? moves : moves.slice(0, 3);
  const mvs = `<div class="card cjlast"><h2 class="cjh">${today ? "Lo último de hoy" : "Movimientos"}${moves.length > 4 ? `<button class="link" data-a="cjall">${ui.cjAll ? "Ver menos" : `Ver todo (${moves.length}) ›`}</button>` : ""}</h2>
    ${moves.length ? ms.map((m) => { const sg = (MOVE[m.type] || [0, 0])[1]; return `<div class="cjmv"><span>${MOVE[m.type] ? MOVE[m.type][0] : m.type}${m.m && m.m !== "efectivo" ? ` (${METHODS[m.m]})` : ""}${m.note ? " · " + esc(m.note) : ""}<small>${hhmm(m.t)}${m.u ? " · " + esc(m.u) : ""}</small></span><span class="num ${sg < 0 ? "neg" : sg > 0 ? "pos" : ""}">${sg < 0 ? "−" : "+"} ${money(m.amount)}${can("cierre") && !["abono", "devolucion", "anulacion"].includes(m.type) && !isLocked(m.date) ? ` <button class="link xs" data-a="mvdel" data-id="${m.id}" aria-label="Borrar movimiento">✕</button>` : ""}</span></div>`; }).join("") : `<p class="muted cjvac">Sin gastos, pagos ni ingresos anotados.</p>`}</div>`;
  const abiertas = shifts.some((s) => !s.t1);
  const cierre = can("cierre") ? `<details class="card cjz"${!today ? " open" : ""}><summary><span>Cierre del día (Z) y del mes</span>${z ? `<span class="tag cjok">Z N° ${pad(z.z, 4)}</span>` : ""}</summary>
      <div class="cjzb">${z ? `<p>Cerrado por ${esc(z.un)} a las ${hhmm(z.t)} · Z N° ${pad(z.z, 4)}</p><button class="btn sec" data-a="zprint" data-id="${z.id}">${svg("print", "bi")}Imprimir Z</button>`
        : `<p class="muted">Resume ventas, comprobantes y cajas del día. ${abiertas ? "<b>Primero cierren las cajas abiertas.</b>" : ""}</p><button class="btn" data-a="zclose" ${abiertas || (!T.n && !shifts.length) ? "disabled" : ""}>Hacer cierre del día</button>`}
      <h3>Cerrar el mes</h3><p class="muted sm">Al cerrar un mes, sus ventas ya no se pueden anular ni devolver.</p>${DB.periods.slice(-4).reverse().map((p) => `<div class="kv"><span>${esc(p.label)}</span><span class="num">${money(p.total)} <small class="muted">· ${p.n} ventas</small></span></div>`).join("")}<button class="btn sec sm" data-a="period">Cerrar un mes</button></div></details>` : "";
  const pagos = `<div class="card cjpay">${cajaPagos(k, T, today)}</div>`, turnos = cajaTurnos(shifts, puede ? mine : null, today);
  v.innerHTML = `<div class="ph cjph"><h1>Caja</h1>${datebar}</div>
    <div class="cj"><div class="cjcol">${hoy ? cash + btns + mvs : pagos + mvs}</div><div class="cjcol">${hoy ? turnos + pagos : turnos}${cierre}</div></div>`;
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
