/* ===================== 80 · REPORTES: ventas, ganancias, cajeros, comprobantes y tiendas ===================== */
const catOfItem = (i) => i.cat || ((prod(i.id) || {}).cat) || "Sin categoría";
function repSales(from, to, scope) {
  const local = DB.sales.filter((s) => s.date >= from && s.date <= to).map((s) => ({ store: DB.biz.store, sid: DB.biz.sid, date: s.date, t: s.t, total: s.total, ret: retTotal(s), pays: paysOf(s), items: s.items.map((i) => ({ name: i.name, qty: i.qty, price: i.price, cost: i.cost || 0, cat: catOfItem(i), id: i.id, unit: i.unit })), user: s.uname || "", doc: s.doc, igv: s.igv || 0, gravada: s.gravada || 0, void: !!s.void, id: s.id }));
  if (scope !== "todas") return local;
  const remote = [];
  Object.entries(DB.stores).forEach(([sid, st]) => (st.sales || []).forEach((s) => { if (s.date >= from && s.date <= to) remote.push(Object.assign({ store: st.name, sid }, s)); }));
  return local.concat(remote);
}
function aggregate(list) {
  const ok = list.filter((s) => !s.void), A = { n: ok.length, gross: 0, ret: 0, net: 0, cost: 0, by: {}, day: {}, hour: {}, cat: {}, prod: {}, user: {}, doc: {}, store: {}, voids: list.length - ok.length };
  ok.forEach((s) => {
    A.gross = r2(A.gross + s.total); A.ret = r2(A.ret + (s.ret || 0));
    s.pays.forEach((p) => { A.by[p.m] = r2((A.by[p.m] || 0) + p.amt); });
    A.day[s.date] = r2((A.day[s.date] || 0) + s.total - (s.ret || 0));
    const h = new Date(s.t).getHours(); A.hour[h] = r2((A.hour[h] || 0) + s.total);
    const ratio = s.total && s.items.length ? s.total / s.items.reduce((a, i) => a + i.price * i.qty, 0) || 1 : 1;
    s.items.forEach((i) => {
      const amt = r2(i.price * i.qty * ratio), cost = r2((i.cost || 0) * i.qty);
      A.cost = r2(A.cost + cost);
      A.cat[i.cat] = r2((A.cat[i.cat] || 0) + amt);
      const o = A.prod[i.name] || (A.prod[i.name] = { q: 0, m: 0, c: 0, unit: i.unit }); o.q = r3(o.q + i.qty); o.m = r2(o.m + amt); o.c = r2(o.c + cost);
    });
    const u = A.user[s.user || "—"] || (A.user[s.user || "—"] = { n: 0, m: 0 }); u.n++; u.m = r2(u.m + s.total);
    const dt = s.doc ? s.doc.type : "NV", d = A.doc[dt] || (A.doc[dt] = { n: 0, m: 0, igv: 0, grav: 0 }); d.n++; d.m = r2(d.m + s.total); d.igv = r2(d.igv + (s.igv || 0)); d.grav = r2(d.grav + (s.gravada || 0));
    const st = A.store[s.store] || (A.store[s.store] = { n: 0, m: 0 }); st.n++; st.m = r2(st.m + s.total - (s.ret || 0));
  });
  A.net = r2(A.gross - A.ret); A.profit = r2(A.net - A.cost); A.avg = A.n ? r2(A.gross / A.n) : 0;
  return A;
}
const hbars = (obj, fmt = money, max = 8, label = (k) => esc(k)) => { const e = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, max), m = e.length ? e[0][1] || 1 : 1; return e.map(([k, n]) => `<div class="hb"><div class="row sp"><span>${label(k)}</span><b class="num">${fmt(n)}</b></div><div class="hbar"><i style="width:${Math.max(2, (n / m) * 100)}%"></i></div></div>`).join("") || `<p class="muted">Sin datos en este periodo.</p>`; };
VIEWS.rep = function viewReports(v) {
  const [from, to] = rangeKeys(ui.range, ui.from, ui.to), scope = Object.keys(DB.stores).length ? ui.rscope : "local";
  const list = repSales(from, to, scope), A = aggregate(list), costs = can("costos");
  const keys = []; for (let k = from; k <= to && keys.length < 62; k = addD(k, 1)) keys.push(k);
  const maxD = Math.max(1, ...keys.map((k) => A.day[k] || 0)), hk = Object.keys(A.hour).map(Number), h0 = Math.min(6, ...hk), h1 = Math.max(22, ...hk), hours = Array.from({ length: h1 - h0 + 1 }, (_, i) => i + h0), maxH = Math.max(1, ...hours.map((h) => A.hour[h] || 0));
  const moves = scope === "local" ? DB.moves.filter((m) => m.date >= from && m.date <= to) : [];
  const mv = (t) => r2(moves.filter((m) => m.type === t).reduce((a, m) => a + m.amount, 0));
  const credit = A.by.credito || 0, abonos = mv("abono"), yapeMan = mv("yape");
  const shifts = scope === "local" ? DB.shifts.filter((s) => s.d0 >= from && s.d0 <= to).sort((a, b) => a.t0 - b.t0) : [];
  const top = Object.entries(A.prod).sort((a, b) => b[1].m - a[1].m).slice(0, 12);
  ui.repData = { from, to, A, shifts, scope, top };
  v.innerHTML = `<div class="ph"><h1>Reportes</h1><div class="row wrap"><button class="btn sec sm" data-a="repprint">${svg("print", "bi")}Imprimir</button><button class="btn sec sm" data-a="vcsv">Exportar ventas</button></div></div>
    ${Object.keys(DB.stores).length ? `<div class="seg tabs2"><button class="${scope === "local" ? "on" : ""}" data-a="rscope" data-s="local">Esta tienda</button><button class="${scope === "todas" ? "on" : ""}" data-a="rscope" data-s="todas">Todas las tiendas (${Object.keys(DB.stores).length + 1})</button></div>` : ""}
    ${rangeBar()}
    <div class="kpis">
      <div class="kpi main"><span>Ventas netas</span><b class="num">${money(A.net + yapeMan)}</b><small>${from === to ? fmtDate(from) : dmy(from) + " – " + dmy(to)}</small></div>
      <div class="kpi"><span>Ventas</span><b class="num">${A.n}</b><small>Ticket promedio ${money(A.avg)}</small></div>
      ${costs ? `<div class="kpi"><span>Ganancia estimada</span><b class="num">${money(A.profit)}</b><small>Margen ${A.net ? Math.round((A.profit / A.net) * 100) : 0}%</small></div>` : ""}
      <div class="kpi"><span>Al crédito</span><b class="num">${money(credit)}</b><small>Cobrado de deudas ${money(abonos)}</small></div>
      <div class="kpi"><span>Devoluciones</span><b class="num">${money(A.ret)}</b><small>${A.voids} anuladas</small></div></div>
    <div class="cols stack"><div class="stack">
      ${keys.length > 1 ? `<div class="card"><h2>Ventas por día</h2><div class="bars">${keys.map((k) => `<div class="bar ${k === dkey() ? "t" : ""}" title="${dmy(k)}: ${money(A.day[k] || 0)}"><i style="height:${Math.max(2, ((A.day[k] || 0) / maxD) * 100)}%"></i><span>${keys.length > 10 ? pk(k).getDate() : ["D", "L", "M", "M", "J", "V", "S"][pk(k).getDay()]}</span></div>`).join("")}</div></div>` : ""}
      <div class="card"><h2>Horas con más ventas</h2><div class="bars hours">${hours.map((h) => `<div class="bar" title="${h}:00 · ${money(A.hour[h] || 0)}"><i style="height:${Math.max(2, ((A.hour[h] || 0) / maxH) * 100)}%"></i><span>${h}</span></div>`).join("")}</div></div>
      <div class="card"><h2>Por medio de pago</h2>${hbars(Object.assign({}, A.by, yapeMan ? { "yape (anotados)": yapeMan } : {}), money, 9, (k) => esc(METHODS[k] || k))}</div>
      <div class="card"><h2>Por categoría</h2>${hbars(A.cat)}</div>
    </div><div class="stack">
      <div class="card"><h2>Productos más vendidos</h2>${top.length ? `<div class="tablewrap"><table class="tbl"><thead><tr><th>Producto</th><th class="r">Cant.</th><th class="r">Vendido</th>${costs ? `<th class="r">Ganancia</th>` : ""}</tr></thead><tbody>${top.map(([n, o]) => `<tr><td>${esc(n)}</td><td class="r num">${fmtQ(o.q)}${o.unit === "kg" ? " kg" : ""}</td><td class="r num">${money(o.m)}</td>${costs ? `<td class="r num">${money(o.m - o.c)}</td>` : ""}</tr>`).join("")}</tbody></table></div>` : `<p class="muted">Sin ventas en este periodo.</p>`}</div>
      <div class="card"><h2>Por cajero o vendedor</h2>${Object.keys(A.user).length ? `<table class="tbl"><thead><tr><th>Usuario</th><th class="r">Ventas</th><th class="r">Total</th><th class="r">Promedio</th></tr></thead><tbody>${Object.entries(A.user).sort((a, b) => b[1].m - a[1].m).map(([u, o]) => `<tr><td>${esc(u)}</td><td class="r num">${o.n}</td><td class="r num">${money(o.m)}</td><td class="r num">${money(o.m / o.n)}</td></tr>`).join("")}</tbody></table>` : `<p class="muted">Sin datos.</p>`}</div>
      <div class="card"><h2>Comprobantes e IGV</h2><table class="tbl"><thead><tr><th>Tipo</th><th class="r">Cant.</th><th class="r">Op. gravada</th><th class="r">IGV</th><th class="r">Total</th></tr></thead><tbody>${Object.entries(A.doc).map(([d, o]) => `<tr><td>${DOCS[d] || d}</td><td class="r num">${o.n}</td><td class="r num">${money(o.grav)}</td><td class="r num">${money(o.igv)}</td><td class="r num">${money(o.m)}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">Sin comprobantes.</td></tr>`}</tbody></table><p class="muted sm" style="margin-top:6px">Útil para tu declaración mensual. Las notas de venta no son comprobantes de pago.</p></div>
      ${shifts.length ? `<div class="card"><h2>Liquidaciones por cajero</h2><div class="tablewrap"><table class="tbl"><thead><tr><th>Cajero</th><th>Fecha</th><th class="r">Esperado</th><th class="r">Contado</th><th class="r">Diferencia</th></tr></thead><tbody>${shifts.map((s) => { const e = s.t1 ? s.expected : shiftSummary(s).expected; return `<tr class="click" data-a="liq" data-id="${s.id}"><td>${esc(s.un)}</td><td>${dmy(s.d0)} ${hhmm(s.t0)}</td><td class="r num">${money(e)}</td><td class="r num">${s.t1 ? money(s.counted) : "abierta"}</td><td class="r num ${s.diff < 0 ? "loss" : s.diff > 0 ? "gain" : ""}">${s.t1 ? money(s.diff) : ""}</td></tr>`; }).join("")}</tbody></table></div></div>` : ""}
      ${scope === "todas" ? `<div class="card"><h2>Por tienda</h2><table class="tbl"><thead><tr><th>Tienda</th><th class="r">Ventas</th><th class="r">Neto</th></tr></thead><tbody>${Object.entries(A.store).map(([s, o]) => `<tr><td>${esc(s)}</td><td class="r num">${o.n}</td><td class="r num">${money(o.m)}</td></tr>`).join("")}</tbody></table><p class="muted sm" style="margin-top:6px">${Object.values(DB.stores).map((s) => `${esc(s.name)}: datos hasta ${s.to ? dmy(s.to) : "—"}`).join(" · ")}</p></div>` : ""}
    </div></div>`;
};
function reportHtml() {
  const { from, to, A, shifts, top } = ui.repData;
  return `<h2>Reporte de ventas · ${esc(DB.biz.name)}</h2><p>${dmy(from)} al ${dmy(to)} · impreso ${fmtDT(Date.now())} por ${esc(me().name)}</p>
    <table class="tbl"><tbody><tr><td>Ventas netas</td><td class="r"><b>${money(A.net)}</b></td></tr><tr><td>N° de ventas</td><td class="r">${A.n}</td></tr><tr><td>Ticket promedio</td><td class="r">${money(A.avg)}</td></tr>${can("costos") ? `<tr><td>Costo de lo vendido</td><td class="r">${money(A.cost)}</td></tr><tr><td>Ganancia estimada</td><td class="r"><b>${money(A.profit)}</b></td></tr>` : ""}<tr><td>Devoluciones</td><td class="r">${money(A.ret)}</td></tr><tr><td>Anuladas</td><td class="r">${A.voids}</td></tr></tbody></table>
    <h3>Por medio de pago</h3><table class="tbl"><tbody>${Object.entries(A.by).map(([m, a]) => `<tr><td>${METHODS[m] || m}</td><td class="r">${money(a)}</td></tr>`).join("")}</tbody></table>
    <h3>Comprobantes</h3><table class="tbl"><thead><tr><th>Tipo</th><th class="r">Cant.</th><th class="r">Gravada</th><th class="r">IGV</th><th class="r">Total</th></tr></thead><tbody>${Object.entries(A.doc).map(([d, o]) => `<tr><td>${DOCS[d] || d}</td><td class="r">${o.n}</td><td class="r">${money(o.grav)}</td><td class="r">${money(o.igv)}</td><td class="r">${money(o.m)}</td></tr>`).join("")}</tbody></table>
    <h3>Productos más vendidos</h3><table class="tbl"><thead><tr><th>Producto</th><th class="r">Cant.</th><th class="r">Vendido</th></tr></thead><tbody>${top.map(([n, o]) => `<tr><td>${esc(n)}</td><td class="r">${fmtQ(o.q)}</td><td class="r">${money(o.m)}</td></tr>`).join("")}</tbody></table>
    <h3>Por usuario</h3><table class="tbl"><tbody>${Object.entries(A.user).map(([u, o]) => `<tr><td>${esc(u)}</td><td class="r">${o.n} ventas</td><td class="r">${money(o.m)}</td></tr>`).join("")}</tbody></table>
    ${shifts.length ? `<h3>Liquidaciones</h3><table class="tbl"><thead><tr><th>Cajero</th><th>Apertura</th><th class="r">Esperado</th><th class="r">Contado</th><th class="r">Dif.</th></tr></thead><tbody>${shifts.map((s) => `<tr><td>${esc(s.un)}</td><td>${fmtDT(s.t0)}</td><td class="r">${money(s.t1 ? s.expected : shiftSummary(s).expected)}</td><td class="r">${s.t1 ? money(s.counted) : "abierta"}</td><td class="r">${s.t1 ? money(s.diff) : ""}</td></tr>`).join("")}</tbody></table>` : ""}`;
}
act({
  rscope: (el) => { ui.rscope = el.dataset.s; render(); },
  repprint: () => printHtml(reportHtml(), "rep")
});
