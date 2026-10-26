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
  const ok = list.filter((s) => !s.void), A = { n: ok.length, gross: 0, ret: 0, net: 0, cost: 0, by: {}, byN: {}, day: {}, hour: {}, cat: {}, prod: {}, user: {}, doc: {}, store: {}, voids: list.length - ok.length };
  ok.forEach((s) => {
    A.gross = r2(A.gross + s.total); A.ret = r2(A.ret + (s.ret || 0));
    s.pays.forEach((p) => { A.by[p.m] = r2((A.by[p.m] || 0) + p.amt); });
    new Set(s.pays.map((p) => p.m)).forEach((m) => { A.byN[m] = (A.byN[m] || 0) + 1; });
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
/* Reportes «te lo cuenta en palabras» (opción 3 de David, 26 oct 2026): frase del periodo, los 5 números de siempre,
   «Cómo te pagaron» ordenado por medio y tarjetas con lo importante (mejor hora, mejor día, estrella, a pérdida, fiado…). El detalle sigue abajo. */
const RP_IC = {
  hora: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3 2 6M19 3l3 3"/>', dia: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  star: '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/>', warn: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  fiado: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6"/>', cat: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>', ret: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'
};
const rpI = (k) => `<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${RP_IC[k]}</svg>`;
const rpSuf = (h) => (h % 24 < 12 ? "a. m." : "p. m."), rpHora = (h) => (rpSuf(h) === rpSuf(h + 1) ? `${h % 12 || 12} a ${(h + 1) % 12 || 12} ${rpSuf(h)}` : `${h % 12 || 12} ${rpSuf(h)} a ${(h + 1) % 12 || 12} ${rpSuf(h + 1)}`);
// Barras con punta redondeada; la más alta resaltada con su monto. Cada barra dice su valor al pasar el mouse.
function rpBars(vals, labels, tips) {
  const n = vals.length, W = Math.max(440, n * 34), H = 120, mx = Math.max(1, ...vals), hi = vals.indexOf(Math.max(...vals)), bw = W / n, ww = Math.min(34, bw * 0.64);
  return `<svg class="rpbars" viewBox="0 0 ${W} ${H + 22}" role="img" aria-label="${esc(tips[hi] || "")}">${vals.map((v, i) => {
    const bh = v > 0 ? Math.max(3, (v / mx) * (H - 22)) : 2, x = i * bw + (bw - ww) / 2, y = H - bh, r = Math.min(4, bh / 2);
    return `<g><title>${esc(tips[i])}</title><rect x="${x - (bw - ww) / 2}" y="0" width="${bw}" height="${H}" fill="transparent" stroke="none"/><path d="M${x},${H} V${y + r} Q${x},${y} ${x + r},${y} H${x + ww - r} Q${x + ww},${y} ${x + ww},${y + r} V${H} Z" class="${i === hi && v > 0 ? "hi" : ""}"/>${n <= 24 ? `<text x="${x + ww / 2}" y="${H + 16}" text-anchor="middle">${labels[i]}</text>` : ""}</g>`;
  }).join("")}<line x1="0" x2="${W}" y1="${H}" y2="${H}" class="base"/></svg>`;
}
VIEWS.rep = function viewReports(v) {
  const [from, to] = rangeKeys(ui.range, ui.from, ui.to), scope = Object.keys(DB.stores).length ? ui.rscope : "local";
  const list = repSales(from, to, scope), A = aggregate(list), costs = can("costos");
  const keys = []; for (let k = from; k <= to && keys.length < 62; k = addD(k, 1)) keys.push(k);
  const hk = Object.keys(A.hour).map(Number), h0 = Math.min(7, ...hk), h1 = Math.max(21, ...hk), hours = Array.from({ length: h1 - h0 + 1 }, (_, i) => i + h0);
  const moves = scope === "local" ? DB.moves.filter((m) => m.date >= from && m.date <= to) : [];
  const mv = (t) => r2(moves.filter((m) => m.type === t).reduce((a, m) => a + m.amount, 0));
  const credit = A.by.credito || 0, abonos = mv("abono"), yapeMan = mv("yape"), net = r2(A.net + yapeMan);
  const shifts = scope === "local" ? DB.shifts.filter((s) => s.d0 >= from && s.d0 <= to).sort((a, b) => a.t0 - b.t0) : [];
  const top = Object.entries(A.prod).sort((a, b) => b[1].m - a[1].m).slice(0, 12);
  ui.repData = { from, to, A, shifts, scope, top };
  // Periodo anterior del mismo largo, para decir «12% más que ayer».
  const len = keys.length, pf = addD(from, -len), pt = addD(from, -1);
  const P = aggregate(repSales(pf, pt, scope)), pYape = scope === "local" ? r2(DB.moves.filter((m) => m.type === "yape" && m.date >= pf && m.date <= pt).reduce((a, m) => a + m.amount, 0)) : 0, pNet = r2(P.net + pYape);
  const delta = pNet > 0 ? Math.round(((net - pNet) / pNet) * 100) : null, mucho = delta !== null && delta >= 200;
  const lab = { hoy: "Hoy", ayer: "Ayer", "7d": "En estos 7 días", mes: "Este mes", mesant: "El mes pasado" }[ui.range] || (from === to ? `El ${fmtDate(from).toLowerCase()}` : `Del ${dmy(from)} al ${dmy(to)}`);
  const plab = { hoy: "ayer", ayer: "anteayer", "7d": "los 7 días anteriores", mes: "el mismo tramo del mes anterior", mesant: "el mes anterior" }[ui.range] || "el periodo anterior";
  const lead = A.n || yapeMan ? `${lab} vendiste <b class="num">${money(net)}</b> en <b>${A.n === 1 ? "1 venta" : A.n + " ventas"}</b>${delta !== null && delta !== 0 ? `, <b>${mucho ? `mucho más que ${plab} (${money(pNet)})` : `${Math.abs(delta)}% ${delta > 0 ? "más" : "menos"} que ${plab}`}</b>` : ""}.${costs && A.n ? ` Te quedaron <b class="num">${money(A.profit)}</b> de ganancia` : ""}${credit ? `${costs && A.n ? " y" : ""} fiaste <b class="num">${money(credit)}</b>` : ""}${(costs && A.n) || credit ? "." : ""}`
    : `${lab} todavía no hay ventas.`;
  // Cómo te pagaron: cada medio del que más entró al que menos; los Yapes anotados a mano van junto a Yape.
  const pays = Object.keys(METHODS).map((m) => ({ m, amt: r2((A.by[m] || 0) + (m === "yape" ? yapeMan : 0)), n: A.byN[m] || 0, man: m === "yape" ? yapeMan : 0 })).filter((x) => x.amt > 0).sort((a, b) => b.amt - a.amt);
  const psum = pays.reduce((a, x) => a + x.amt, 0), pmax = pays.length ? pays[0].amt : 1;
  const raro = yapeMan > 1000 && yapeMan > (A.net || 0) * 0.6;
  const payCard = `<div class="card rppay"><h2>Cómo te pagaron <b class="num">${money(psum)}</b></h2>
    ${pays.length ? `<div class="rpms" style="--c:${Math.min(6, pays.length)};--c2:${pays.length > 4 ? Math.ceil(pays.length / 2) : pays.length}">${pays.map((x, i) => `<div class="rpm"><span class="rpmh"><i class="pmi m-${x.m}" aria-hidden="true"></i>${METHODS[x.m]}</span><b class="num">${money(x.amt)}</b>
      <span class="rpbar"><i style="width:${Math.max(3, (x.amt / pmax) * 100).toFixed(1)}%"></i></span><small>${Math.round((x.amt / psum) * 100)}%${x.n ? ` · ${x.n} ${x.n === 1 ? "venta" : "ventas"}` : ""}</small>
      ${x.man ? `<small class="${raro ? "rpraro" : ""}">${money(x.man)} anotados a mano${raro ? " · ¿está bien? Revísalo en Caja" : ""}</small>` : ""}</div>`).join("")}</div>`
      : `<p class="muted">Sin ventas en este periodo.</p>`}</div>`;
  // Tarjetas con lo importante (solo las que tienen algo que decir).
  const cards = [];
  if (A.n) {
    const hb = hours.reduce((a, h) => ((A.hour[h] || 0) > (A.hour[a] || 0) ? h : a), hours[0]), hlow = hours.filter((h) => h >= 8 && h <= 20).reduce((a, h) => ((A.hour[h] || 0) < (A.hour[a] || 0) ? h : a), 8);
    cards.push(["hora", "g", `Tu mejor hora fue de ${rpHora(hb)}`, `Vendiste ${money(A.hour[hb] || 0)} en esa hora.${(A.hour[hlow] || 0) < (A.hour[hb] || 0) * 0.25 ? ` De ${rpHora(hlow)} casi no entra nadie.` : ""}`, rpBars(hours.map((h) => A.hour[h] || 0), hours.map((h) => h), hours.map((h) => `${h}:00 · ${money(A.hour[h] || 0)}`))]);
  }
  if (keys.length > 1 && A.n) {
    const bd = keys.reduce((a, k) => ((A.day[k] || 0) > (A.day[a] || 0) ? k : a), keys[0]);
    cards.push(["dia", "b", `Tu mejor día fue el ${fmtDate(bd).toLowerCase() === "hoy" || fmtDate(bd) === "Ayer" ? fmtDate(bd).toLowerCase() : PV_DOW[pk(bd).getDay()] + " " + pk(bd).getDate()}`, `Vendiste ${money(A.day[bd] || 0)}. En promedio vendes ${money(A.net / keys.length)} por día.`, rpBars(keys.map((k) => A.day[k] || 0), keys.map((k) => (keys.length > 10 ? pk(k).getDate() : ["D", "L", "M", "M", "J", "V", "S"][pk(k).getDay()])), keys.map((k) => `${dmy(k)} · ${money(A.day[k] || 0)}`))]);
  }
  if (top.length) {
    const [n, o] = top[0];
    cards.push(["star", "g", `${esc(n)} fue tu estrella`, `${fmtQ(o.q)}${o.unit === "kg" ? " kg" : ""} vendidos, ${money(o.m)}${costs && o.c ? ` y ${money(o.m - o.c)} de ganancia` : ""}.`, `<div class="rptop">${top.slice(1, 5).map(([n2, o2]) => `<div><span>${esc(n2)}</span><b class="num">${money(o2.m)}</b></div>`).join("")}</div>`]);
  }
  const loss = costs ? Object.entries(A.prod).filter(([, o]) => o.c > 0 && o.m - o.c < -0.009).sort((a, b) => (a[1].m - a[1].c) - (b[1].m - b[1].c)) : [];
  if (loss.length) cards.push(["warn", "w", loss.length === 1 ? `${esc(loss[0][0])}: lo vendes a pérdida` : `${loss.length} productos los vendes a pérdida`, `Te cuestan más de lo que los vendes. Revisa su precio en Productos.`, `<div class="rptop">${loss.slice(0, 4).map(([n, o]) => `<div><span>${esc(n)}</span><b class="num rpo">− ${money(o.c - o.m)}</b></div>`).join("")}</div>`]);
  const cats = Object.entries(A.cat).sort((a, b) => b[1] - a[1]);
  if (cats.length > 1) cards.push(["cat", "b", `Lo que más se vende: ${esc(cats[0][0])}`, `${Math.round((cats[0][1] / (A.net || 1)) * 100)}% de lo vendido.`, hbars(A.cat, money, 4)]);
  if (credit || abonos) {
    const debe = DB.clients.reduce((a, c) => a + balanceOf(c), 0);
    cards.push(["fiado", "o", credit ? `Fiaste ${money(credit)}` : `Te pagaron deudas`, `${abonos ? `Te pagaron ${money(abonos)} de deudas.` : "Nadie pagó deudas en este periodo."}${debe ? ` Tus clientes te deben ${money(debe)} en total.` : ""}`, ""]);
  }
  if (A.ret || A.voids) cards.push(["ret", "n", `Devoluciones y anuladas`, `${A.ret ? `Devolviste ${money(A.ret)}.` : ""}${A.voids ? ` ${A.voids === 1 ? "Se anuló 1 venta" : `Se anularon ${A.voids} ventas`}.` : ""}`, ""]);
  v.innerHTML = `<div class="ph"><h1>Reportes</h1><div class="row wrap"><button class="btn sec sm" data-a="repprint">${svg("print", "bi")}Imprimir</button><button class="btn sec sm" data-a="vcsv">Exportar ventas</button></div></div>
    ${Object.keys(DB.stores).length ? `<div class="seg tabs2"><button class="${scope === "local" ? "on" : ""}" data-a="rscope" data-s="local">Esta tienda</button><button class="${scope === "todas" ? "on" : ""}" data-a="rscope" data-s="todas">Todas las tiendas (${Object.keys(DB.stores).length + 1})</button></div>` : ""}
    ${rangeBar()}
    <div class="card rplead"><p>${lead}</p></div>
    <div class="kpis">
      <div class="kpi main"><span>Ventas netas</span><b class="num">${money(net)}</b><small>${from === to ? fmtDate(from) : dmy(from) + " – " + dmy(to)}${delta !== null && delta !== 0 ? ` · <span class="${delta > 0 ? "rpup" : "rpdn"}">${delta > 0 ? "▲" : "▼"} ${mucho ? `${plab}: ${money(pNet)}` : `${Math.abs(delta)}% vs ${plab}`}</span>` : ""}</small></div>
      <div class="kpi"><span>Ventas</span><b class="num">${A.n}</b><small>Ticket promedio ${money(A.avg)}</small></div>
      ${costs ? `<div class="kpi"><span>Ganancia estimada</span><b class="num">${money(A.profit)}</b><small>Margen ${A.net ? Math.round((A.profit / A.net) * 100) : 0}%</small></div>` : ""}
      <div class="kpi"><span>Al crédito</span><b class="num">${money(credit)}</b><small>Cobrado de deudas ${money(abonos)}</small></div>
      <div class="kpi"><span>Devoluciones</span><b class="num">${money(A.ret)}</b><small>${A.voids} anuladas</small></div></div>
    ${payCard}
    ${cards.length ? `<div class="rpins">${cards.map(([ic, tone, t, d, extra]) => `<div class="card rpin t-${tone}"><span class="rpic">${rpI(ic)}</span><h3>${t}</h3><p>${d}</p>${extra}</div>`).join("")}</div>` : ""}
    <h2 class="rpsec">Más detalle</h2>
    <div class="cols stack"><div class="stack">
      <div class="card"><h2>Productos más vendidos</h2>${top.length ? `<div class="tablewrap"><table class="tbl"><thead><tr><th>Producto</th><th class="r">Cant.</th><th class="r">Vendido</th>${costs ? `<th class="r">Ganancia</th>` : ""}</tr></thead><tbody>${top.map(([n, o]) => `<tr><td>${esc(n)}</td><td class="r num">${fmtQ(o.q)}${o.unit === "kg" ? " kg" : ""}</td><td class="r num">${money(o.m)}</td>${costs ? `<td class="r num ${o.m - o.c < 0 ? "loss" : ""}">${money(o.m - o.c)}</td>` : ""}</tr>`).join("")}</tbody></table></div>` : `<p class="muted">Sin ventas en este periodo.</p>`}</div>
      <div class="card"><h2>Por categoría</h2>${hbars(A.cat)}</div>
      <div class="card"><h2>Por cajero o vendedor</h2>${Object.keys(A.user).length ? `<table class="tbl"><thead><tr><th>Usuario</th><th class="r">Ventas</th><th class="r">Total</th><th class="r">Promedio</th></tr></thead><tbody>${Object.entries(A.user).sort((a, b) => b[1].m - a[1].m).map(([u, o]) => `<tr><td>${esc(u)}</td><td class="r num">${o.n}</td><td class="r num">${money(o.m)}</td><td class="r num">${money(o.m / o.n)}</td></tr>`).join("")}</tbody></table>` : `<p class="muted">Sin datos.</p>`}</div>
    </div><div class="stack">
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
