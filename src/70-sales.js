/* ===================== 70 · VENTAS: comprobantes, anulaciones, devoluciones, preventas y despacho ===================== */
function rangeKeys(r, from, to) {
  const t = dkey();
  if (r === "hoy") return [t, t];
  if (r === "ayer") return [addD(t, -1), addD(t, -1)];
  if (r === "7d") return [addD(t, -6), t];
  if (r === "mes") return [t.slice(0, 8) + "01", t];
  if (r === "mesant") { const f = addD(t.slice(0, 8) + "01", -1).slice(0, 8) + "01"; return [f, addD(t.slice(0, 8) + "01", -1)]; }
  return [from || t, to || t];
}
const RANGES = [["hoy", "Hoy"], ["ayer", "Ayer"], ["7d", "7 días"], ["mes", "Este mes"], ["mesant", "Mes pasado"], ["rango", "Elegir fechas"]];
function rangeBar(key) {
  return `<div class="chips">${RANGES.map(([k, n]) => `<button class="chip ${ui.range === k ? "on" : ""}" data-a="range" data-r="${k}">${n}</button>`).join("")}</div>
    ${ui.range === "rango" ? `<div class="filters"><label class="fld"><span>Desde</span><input class="inp" type="date" data-in="rfrom" value="${ui.from}" max="${dkey()}"></label><label class="fld"><span>Hasta</span><input class="inp" type="date" data-in="rto" value="${ui.to}" max="${dkey()}"></label></div>` : ""}`;
}
const returnedQty = (s, i) => r3((s.returns || []).reduce((a, r) => a + r.items.filter((x) => x.i === i).reduce((b, x) => b + x.qty, 0), 0));
const retTotal = (s) => r2((s.returns || []).reduce((a, r) => a + r.amount, 0));
VIEWS.ventas = function viewSales(v) {
  const [from, to] = rangeKeys(ui.range, ui.from, ui.to);
  const pend = DB.prev.filter((p) => p.status === "pendiente").length, desp = DB.sales.filter((s) => s.prev && !s.void && !s.disp).length;
  const T = [["ventas", "Comprobantes"], ["prev", `Preventas${pend ? ` (${pend})` : ""}`], ["desp", `Por despachar${desp ? ` (${desp})` : ""}`], ["dev", "Devoluciones y anuladas"]];
  v.innerHTML = `<div class="ph"><h1>Ventas</h1>${can("reportes") ? `<button class="btn sec sm" data-a="vcsv">Exportar CSV</button>` : ""}</div>
    <div class="seg tabs2">${T.map(([k, l]) => `<button class="${ui.vtab === k ? "on" : ""}" data-a="vtab" data-t="${k}">${l}</button>`).join("")}</div>
    ${ui.vtab === "prev" || ui.vtab === "desp" ? "" : rangeBar()}
    ${ui.vtab === "ventas" ? `<div class="filters"><input class="inp" id="vq" type="search" placeholder="Número, cliente o producto" value="${esc(ui.vq)}">
      <select class="inp" data-in="vdoc"><option value="">Todos los comprobantes</option>${Object.entries(DOCS).map(([k, n]) => `<option value="${k}" ${ui.vdoc === k ? "selected" : ""}>${n}</option>`).join("")}</select>
      <select class="inp" data-in="vuser"><option value="">Todos los usuarios</option>${DB.users.map((u) => `<option value="${u.id}" ${ui.vuser === u.id ? "selected" : ""}>${esc(u.name)}</option>`).join("")}</select></div>` : ""}
    <div id="vlist"></div>`;
  paintVList(from, to);
};
function saleRow(s) {
  const ret = retTotal(s), cr = paysOf(s).some((p) => p.m === "credito");
  return `<button class="it" data-a="sale" data-id="${s.id}"><span class="dt ${s.doc.type}">${s.doc.type === "NV" ? "NV" : s.doc.type}</span><div class="t"><b>${docShort(s)}${s.cname ? " · " + esc(s.cname) : ""}</b><small>${dmy(s.date)} ${hhmm(s.t)} · ${esc(methodLabel(s))} · ${esc(s.uname || "")}${s.mesa ? " · Mesa " + s.mesa : ""}${s.prev ? " · Preventa " + s.prev : ""}</small>
    ${s.void ? ` <span class="tag void">Anulada</span>` : ""}${ret ? ` <span class="tag low">Devolución ${money(ret)}</span>` : ""}${cr && !s.void ? ` <span class="tag">Crédito</span>` : ""}</div><div class="v num ${s.void ? "strike" : ""}">${money(s.total)}</div></button>`;
}
function paintVList(from, to) {
  const el = $("#vlist"); if (!el) return;
  if (ui.vtab === "prev") {
    const l = DB.prev.slice().sort((a, b) => b.no - a.no).slice(0, 200);
    el.innerHTML = l.length ? `<div class="list">${l.map((p) => `<div class="it"><span class="dt P">P</span><div class="t"><b>Preventa N° ${p.no}${p.client && cli(p.client) ? " · " + esc(cli(p.client).name) : ""}</b><small>${dmy(p.date)} ${hhmm(p.t)} · ${esc(p.un)} · ${p.items.length} ítems</small> <span class="tag ${p.status === "pendiente" ? "low" : p.status === "anulada" ? "void" : ""}">${p.status}</span></div><div class="v num">${money(p.total)}</div>
      <div class="acts">${p.status === "pendiente" && can("cobrar") ? `<button class="btn sm" data-a="prevgo" data-n="${p.no}">Cobrar</button><button class="btn sec sm" data-a="prevvoid" data-n="${p.no}">Anular</button>` : ""}<button class="btn sec sm" data-a="prevprint" data-n="${p.no}" aria-label="Imprimir">${svg("print", "bi")}</button>${p.sale ? `<button class="btn sec sm" data-a="sale" data-id="${p.sale}">Ver venta</button>` : ""}</div></div>`).join("")}</div>`
      : `<div class="empty"><h2>Sin preventas</h2><p>Un vendedor arma el pedido con «Preventa» y la caja lo cobra con su número.</p></div>`;
    return;
  }
  if (ui.vtab === "desp") {
    const l = DB.sales.filter((s) => s.prev && !s.void && !s.disp).sort((a, b) => a.t - b.t);
    el.innerHTML = l.length ? `<p class="muted" style="margin-bottom:10px">Pedidos de preventa ya pagados que falta entregar al cliente.</p><div class="list">${l.map((s) => `<div class="it"><span class="dt P">${s.prev}</span><div class="t"><b>Preventa N° ${s.prev} · ${docShort(s)}</b><small>Pagado ${hhmm(s.t)} · ${s.items.map((i) => `${fmtQ(i.qty)} ${esc(i.name)}`).join(", ").slice(0, 120)}</small></div><div class="acts"><button class="btn sm" data-a="dispatch" data-id="${s.id}">Despachado</button></div></div>`).join("")}</div>`
      : `<div class="empty"><h2>Nada por despachar</h2><p>Aquí aparecen las preventas cobradas hasta que las entregues.</p></div>`;
    return;
  }
  let l = DB.sales.filter((s) => s.date >= from && s.date <= to);
  if (ui.vtab === "dev") l = l.filter((s) => s.void || (s.returns || []).length);
  else {
    const q = norm(ui.vq), raw = (ui.vq || "").trim();
    if (raw) l = l.filter((s) => docShort(s).toLowerCase().includes(raw.toLowerCase()) || String(s.doc.n) === raw.replace(/^0+/, "") || norm(s.cname).includes(q) || (s.cdoc || "").includes(raw) || s.items.some((i) => norm(i.name).includes(q)));
    if (ui.vdoc) l = l.filter((s) => s.doc.type === ui.vdoc);
    if (ui.vuser) l = l.filter((s) => s.user === ui.vuser);
  }
  if (!can("reportes")) l = l.filter((s) => s.user === ui.user);
  l.sort((a, b) => b.t - a.t);
  const tot = r2(l.filter((s) => !s.void).reduce((a, s) => a + s.total - retTotal(s), 0));
  el.innerHTML = l.length ? `<p class="muted" style="margin:4px 0 10px">${l.length} ${l.length === 1 ? "venta" : "ventas"} · neto ${money(tot)}</p><div class="list">${l.slice(0, 300).map(saleRow).join("")}</div>${l.length > 300 ? `<p class="muted">Mostrando 300. Exporta para ver todas.</p>` : ""}`
    : `<div class="empty"><p>No hay ventas con esos filtros.</p></div>`;
}

/* ---------- anular ---------- */
function doVoid(s) {
  if (s.void) return;
  if (isLocked(s.date)) return toast("Ese mes está cerrado: ya no se puede anular", true);
  if ((s.returns || []).length) return toast("Esta venta ya tiene devoluciones: devuelve el resto en vez de anular", true);
  need("anular", (sup) => promptBox({ title: "Anular venta", text: `${DOCS[s.doc.type]} ${docNo(s)} por ${money(s.total)}. El stock vuelve al inventario${paysOf(s).some((p) => p.m === "credito") ? " y se borra la deuda" : ""}.`, label: "Motivo", ph: "Ej: el cliente se arrepintió", required: "Escribe el motivo", ok: "Anular venta", danger: true }, (why) => {
    const sh = curShift();
    s.void = { t: Date.now(), u: (me() || {}).name, by: sup.name, why, shift: sh ? sh.id : "" };
    s.items.forEach((it) => { if (!it.quick) { const p = prod(it.id); if (p) consume(p, -r3(it.qty * (it.f || 1)), "anulacion", docShort(s)); } });
    if (!(s.shift && s.void.shift === s.shift)) paysOf(s).forEach((p) => { if (!["credito", "puntos"].includes(p.m)) addMove("anulacion", p.amt, docShort(s), { m: p.m }); });
    if (s.prev) { const pv = DB.prev.find((x) => x.no === s.prev); if (pv) pv.status = "anulada"; }
    log("Venta anulada", `${docShort(s)} ${money(s.total)} · ${why}${sup.id !== ui.user ? " · autorizó " + sup.name : ""}`);
    save(s.date); toast("Venta anulada"); render(); showReceipt(s, false);
  }), "Anular venta " + docShort(s));
}

/* ---------- devoluciones ---------- */
function openReturn(s) {
  if (s.void) return;
  if (isLocked(s.date)) return toast("Ese mes está cerrado: ya no se puede devolver", true);
  if (!s.items.some((it, i) => it.qty - returnedQty(s, i) > 0)) return toast("Ya se devolvió todo de esta venta");
  need("devolver", (sup) => {
    const cr = paysOf(s).some((p) => p.m === "credito") && s.client;
    ui.ret = { id: s.id, q: {}, m: cr ? "credito" : "efectivo", restock: true, sup: sup.name };
    paintReturn();
  }, "Devolución de " + docShort(s));
}
function retAmount(s) {
  const ratio = s.sub ? s.total / s.sub : 1;
  return r2(Object.entries(ui.ret.q).reduce((a, [i, q]) => a + q * s.items[i].price * ratio, 0));
}
function paintReturn() {
  const r = ui.ret, s = saleById(r.id); if (!s) return;
  const amt = retAmount(s), cr = paysOf(s).some((p) => p.m === "credito") && s.client;
  const M = ["efectivo", "yape", "plin", "tarjeta", "transferencia"].concat(cr ? ["credito"] : []);
  openModal(`<h2>Devolución · ${docShort(s)}</h2><p class="muted" style="margin-bottom:10px">Marca lo que el cliente devuelve.</p>
    <div class="list">${s.items.map((it, i) => { const left = r3(it.qty - returnedQty(s, i)), q = r.q[i] || 0, kg = it.unit === "kg"; return left > 0 ? `<div class="it sm"><div class="t"><b>${esc(it.name)}</b><small>Vendió ${fmtQ(it.qty)}${kg ? " kg" : ""} × ${money(it.price)}${left < it.qty ? ` · ya devolvió ${fmtQ(it.qty - left)}` : ""}</small></div>
      <span class="step"><button data-a="retq" data-i="${i}" data-v="-1" aria-label="Menos">−</button><span class="num">${fmtQ(q)}</span><button data-a="retq" data-i="${i}" data-v="1" aria-label="Más">+</button></span>${kg || left !== Math.round(left) ? `<button class="link xs" data-a="retall" data-i="${i}">todo</button>` : ""}</div>` : ""; }).join("")}</div>
    <p class="muted" style="margin:12px 0 6px">Devolver el dinero con:</p>
    <div class="methods m6">${M.map((m) => `<button class="mth ${r.m === m ? "on" : ""}" data-a="retm" data-m="${m}">${m === "credito" ? "Rebajar su deuda" : METHODS[m]}</button>`).join("")}</div>
    <label class="ck" style="margin:6px 0 10px"><input type="checkbox" id="retstock" ${r.restock ? "checked" : ""}> Los productos regresan al stock (están en buen estado)</label>
    <label class="fld"><span>Motivo</span><input class="inp" id="retwhy" placeholder="Ej: producto vencido, se equivocó" maxlength="60" value="${esc(r.why || "")}"></label>
    <div class="vuelto"><span>Total a devolver</span><b class="num">${money(amt)}</b></div>
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" data-a="retok" ${amt > 0 ? "" : "disabled"}>Hacer devolución</button></div>`, "wide");
  ui.mk = "ret";
}
function retRead() { const r = ui.ret; if (!r) return; const w = $("#retwhy"); if (w) r.why = w.value; const k = $("#retstock"); if (k) r.restock = k.checked; }
function doReturn() {
  retRead(); const r = ui.ret, s = saleById(r.id); if (!s) return;
  const amount = retAmount(s); if (!(amount > 0)) return;
  if (!r.why.trim()) return toast("Escribe el motivo");
  const items = Object.entries(r.q).filter(([, q]) => q > 0).map(([i, q]) => ({ i: +i, qty: r3(q) }));
  if (r.m === "credito" && amount > balanceOf(cli(s.client)) + 0.001) return toast("Devuelve en efectivo: su deuda es menor que el monto");
  const ret = { t: Date.now(), u: me().name, by: r.sup, items, amount, m: r.m, why: r.why.trim(), restock: r.restock };
  s.returns = s.returns || []; s.returns.push(ret);
  if (r.restock) items.forEach(({ i, qty }) => { const it = s.items[i]; if (!it.quick) { const p = prod(it.id); if (p) consume(p, -r3(qty * (it.f || 1)), "devolucion", docShort(s)); } });
  if (r.m !== "credito") addMove("devolucion", amount, `${docShort(s)} · ${ret.why}`, { m: r.m, client: s.client || "" });
  log("Devolución", `${docShort(s)} ${money(amount)} (${r.m === "credito" ? "a cuenta" : METHODS[r.m]}) · ${ret.why}`);
  ui.ret = null; save(s.date); closeModal();
  printHtml(`<h3>${esc(DB.biz.name)}</h3><div class="c doc"><b>CONSTANCIA DE DEVOLUCIÓN</b></div><div class="l"><span>Comprobante</span><span>${docNo(s)}</span></div><div class="l"><span>Fecha</span><span>${fmtDT(ret.t)}</span></div><hr>${items.map(({ i, qty }) => `<div class="l"><span>${fmtQ(qty)} × ${esc(s.items[i].name)}</span><span></span></div>`).join("")}<hr><div class="l t"><span>DEVUELTO</span><span>${money(amount)}</span></div><div class="l"><span>Medio</span><span>${r.m === "credito" ? "Rebaja de deuda" : METHODS[r.m]}</span></div><div class="c">Motivo: ${esc(ret.why)}</div>`);
  toast(`Devolución registrada: ${money(amount)}`, true); render();
}
act({
  vtab: (el) => { ui.vtab = el.dataset.t; render(); },
  range: (el) => { ui.range = el.dataset.r; render(); },
  sale: (el) => { const s = saleById(el.dataset.id); if (s) showReceipt(s, false); },
  void: (el) => { const s = saleById(el.dataset.id); if (s) doVoid(s); },
  ret: (el) => { const s = saleById(el.dataset.id); if (s) openReturn(s); },
  retq: (el) => { retRead(); const r = ui.ret, s = saleById(r.id), i = +el.dataset.i, it = s.items[i], left = r3(it.qty - returnedQty(s, i)), step = it.unit === "kg" ? 0.1 : 1; r.q[i] = Math.min(left, Math.max(0, r3((r.q[i] || 0) + +el.dataset.v * step))); paintReturn(); },
  retall: (el) => { retRead(); const r = ui.ret, s = saleById(r.id), i = +el.dataset.i; r.q[i] = r3(s.items[i].qty - returnedQty(s, i)); paintReturn(); },
  retm: (el) => { retRead(); ui.ret.m = el.dataset.m; paintReturn(); },
  retok: doReturn,
  dispatch: (el) => { const s = saleById(el.dataset.id); if (!s || s.disp) return; s.disp = { t: Date.now(), u: me().name }; log("Despacho", `Preventa ${s.prev} · ${docShort(s)}`); save(s.date); toast("Marcado como despachado"); if (modalOpen()) closeModal(); render(); },
  prevgo: (el) => { if (loadPrev(+el.dataset.n)) go("venta"); },
  prevvoid: (el) => { const pv = DB.prev.find((x) => x.no === +el.dataset.n); if (pv) confirmBox(`¿Anular la preventa N° ${pv.no}?`, "Anular", () => { pv.status = "anulada"; DB.tickets.forEach((t, i) => { if (t.prev === pv.no) t.prev = 0; }); log("Preventa anulada", "N° " + pv.no); save(pv.date); render(); }); },
  vcsv: () => {
    const [from, to] = rangeKeys(ui.range, ui.from, ui.to);
    const rows = [["fecha", "hora", "comprobante", "numero", "cliente", "documento", "usuario", "medio de pago", "producto", "cantidad", "precio", "importe", "total comprobante", "igv", "estado"]];
    DB.sales.filter((s) => s.date >= from && s.date <= to).sort((a, b) => a.t - b.t).forEach((s) => s.items.forEach((i) => rows.push([s.date, hhmm(s.t), DOCS[s.doc.type], docNo(s), s.cname || "", s.cdoc || "", s.uname || "", methodLabel(s), i.name, i.qty, i.price, r2(i.price * i.qty), s.total, s.igv || 0, s.void ? "anulada" : retTotal(s) ? "con devolución" : "ok"])));
    csvOut(rows, `ventas-${from}-a-${to}.csv`);
  }
});
