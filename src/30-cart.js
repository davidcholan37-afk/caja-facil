/* ===================== 30 · TICKET: líneas, presentaciones, totales con IGV, mesas y preventas ===================== */
const lineKey = (id, pres) => id + (pres ? ":" + pres : "");
const costOf = (p) => (p.recipe && p.recipe.length && !(p.cost > 0) ? r2(p.recipe.reduce((a, rc) => { const i = prod(rc.id); return a + (i ? (i.cost || 0) * rc.qty : 0); }, 0)) : p.cost || 0);
function resolveLine(l) {
  if (l.quick) return { name: l.name, price: l.price, base: l.price, cost: 0, stock: null, quick: true, unit: "u", code: "", f: 1, igv: true, p: null };
  const p = prod(l.id); if (!p) return null;
  const ps = l.pres ? (p.pres || []).find((x) => x.id === l.pres) : null;
  if (l.pres && !ps) return null;
  const base = ps ? ps.price : p.price;
  return { p, ps, name: ps ? `${p.name} (${ps.name})` : p.name, price: l.pr != null ? l.pr : base, base, cost: r2(costOf(p) * (ps ? ps.f : 1)), stock: p.stock, unit: ps ? "u" : p.unit, code: ps ? ps.code : p.code, f: ps ? ps.f : 1, igv: p.igv !== false, quick: false };
}
const linesOf = (t) => t.items.map((l) => ({ l, r: resolveLine(l) })).filter((x) => x.r);
const cartLines = () => linesOf(DB.cart);
function totalsOf(t) {
  const lines = linesOf(t);
  const sub = r2(lines.reduce((a, { l, r }) => a + r2(r.price * l.qty), 0));
  const disc = Math.min(Math.max(0, r2(t.disc)), sub);
  const total = r2(sub - disc), ratio = sub ? total / sub : 0;
  const gAmt = r2(lines.reduce((a, { l, r }) => a + (r.igv ? r2(r.price * l.qty) : 0), 0) * ratio);
  const rate = DB.cfg.igvOn ? (+DB.cfg.igv || 0) / 100 : 0;
  const gravada = rate ? r2(gAmt / (1 + rate)) : 0, igv = rate ? r2(gAmt - gravada) : 0;
  return { lines, sub, disc, total, gravada, igv, exo: rate ? r2(total - gAmt) : 0, count: lines.length };
}
const cartTotals = () => totalsOf(DB.cart);
const ticketTotal = (t) => totalsOf(t).total;
const unitTxt = (r) => (r.unit === "kg" ? " kg" : "");
// Cuánto de un producto (en unidades base) hay en el ticket, sin contar una línea.
const usedInCart = (pid, exceptKey) => r3(DB.cart.items.filter((i) => i.id === pid && lineKey(i.id, i.pres) !== exceptKey).reduce((a, i) => { const r = resolveLine(i); return a + (r ? i.qty * r.f : 0); }, 0));
function setLine(id, pres, qty, opts = {}) {
  const k = lineKey(id, pres), l = DB.cart.items.find((i) => lineKey(i.id, i.pres) === k);
  const r = resolveLine(l || { id, pres }); if (!r) return false;
  if (qty <= 0) DB.cart.items = DB.cart.items.filter((i) => i !== l);
  else {
    if (!r.quick && r.stock != null && !DB.cfg.negStock) {
      const need = r3(usedInCart(id, k) + qty * r.f);
      if (need > r.stock + 1e-9) { toast(r.stock <= 0 ? "Sin stock: " + r.p.name : `Solo quedan ${fmtQ(r.stock)}${r.p.unit === "kg" ? " kg" : ""} de ${r.p.name}`); beep(false); return false; }
    }
    if (!l || qty > l.qty) { ui.fresh = k; ui.bump = id; }
    if (l) l.qty = r3(qty); else DB.cart.items.push({ id, pres: pres || "", qty: r3(qty) });
    ui.sel = k;
  }
  save(); if (!opts.quiet) beep(true); paintSale(); return true;
}
function addToCart(p, qty = 1, pres = "") {
  const l = DB.cart.items.find((i) => lineKey(i.id, i.pres) === lineKey(p.id, pres));
  return setLine(p.id, pres, r3((l ? l.qty : 0) + qty));
}
function changeQty(k, d) {
  const l = DB.cart.items.find((i) => lineKey(i.id, i.pres) === k); if (!l) return;
  const r = resolveLine(l); if (!r) return;
  if (l.quick) { l.qty = Math.max(0, l.qty + d); if (!l.qty) DB.cart.items = DB.cart.items.filter((i) => i !== l); save(); paintSale(); return; }
  setLine(l.id, l.pres, r3(l.qty + d * (r.unit === "kg" ? 0.1 : 1)));
}
function dropCurrentTicket() {
  if (DB.tickets.length > 1) { DB.tickets.splice(DB.cur, 1); DB.cur = Math.max(0, Math.min(DB.cur, DB.tickets.length - 1)); }
  else { DB.tickets = [newTicket(1)]; DB.tseq = 1; DB.cur = 0; }
  ui.sel = null;
}
function newTicketNow(extra = {}) {
  DB.tickets.push(Object.assign(newTicket(++DB.tseq), extra)); DB.cur = DB.tickets.length - 1; ui.sel = null; save();
}
const ticketLabel = (t) => t.mesa ? `Mesa ${t.mesa}` : t.prev ? `Preventa ${t.prev}` : t.name || "Ticket " + t.n;

/* ---------- mesas (restaurantes y cuentas abiertas) ---------- */
function openTables() {
  const n = +DB.cfg.tables || 0; if (!n) return toast("Activa las mesas en Ajustes › Venta");
  openModal(`<h2>Mesas</h2><p class="muted" style="margin-bottom:12px">Toca una mesa para abrir o seguir su cuenta.</p><div class="mesas">${Array.from({ length: n }, (_, i) => {
    const m = i + 1, t = DB.tickets.find((x) => x.mesa === m), busy = t && t.items.length;
    const mins = t && t.t0 ? Math.round((Date.now() - t.t0) / 60000) : 0;
    return `<button class="mesa ${busy ? "busy" : ""} ${t && DB.tickets.indexOf(t) === DB.cur ? "on" : ""}" data-a="mesa" data-m="${m}"><b>${m}</b><small>${busy ? money(ticketTotal(t)) : "Libre"}</small>${busy && mins ? `<em>${mins} min</em>` : ""}</button>`;
  }).join("")}</div><div class="btns"><button class="btn sec" data-a="close">Cerrar</button></div>`, "wide");
}
function goTable(m) {
  let i = DB.tickets.findIndex((x) => x.mesa === m);
  if (i < 0) {
    if (!DB.cart.items.length && !DB.cart.mesa && !DB.cart.prev) { Object.assign(DB.cart, { mesa: m, name: "", t0: Date.now() }); i = DB.cur; }
    else { newTicketNow({ mesa: m, t0: Date.now() }); i = DB.cur; }
  }
  DB.cur = i; save(); closeModal(); paintSale(); toast(`Mesa ${m}`);
}

/* ---------- preventas: el vendedor arma el pedido, la caja lo cobra ---------- */
function savePrev() {
  const lines = cartLines(); if (!lines.length) return toast("Agrega productos primero");
  const t = DB.cart, no = ++DB.pseq;
  const pv = { no, t: Date.now(), date: dkey(), u: me().id, un: me().name, items: t.items.map((i) => Object.assign({}, i)), disc: t.disc || 0, client: t.client || "", total: ticketTotal(t), status: "pendiente", sale: 0 };
  DB.prev.push(pv); log("Preventa", `N° ${no} ${money(pv.total)}`);
  dropCurrentTicket(); save(); paintSale();
  openModal(`<div class="bigok"><span>Preventa guardada</span><b class="num">N° ${no}</b><p>El cliente paga en caja diciendo este número. Total ${money(pv.total)}.</p></div>
    <div class="btns h"><button class="btn sec" data-a="prevprint" data-n="${no}">${svg("print", "bi")}Imprimir</button><button class="btn" data-a="close" data-enter>Seguir vendiendo</button></div>`);
}
function loadPrev(no) {
  const pv = DB.prev.find((x) => x.no === +no);
  if (!pv) { toast(`No existe la preventa N° ${no}`); beep(false); return false; }
  if (pv.status !== "pendiente") { toast(pv.status === "cobrada" ? `La preventa N° ${no} ya fue cobrada` : `La preventa N° ${no} está anulada`); beep(false); return false; }
  const open = DB.tickets.findIndex((x) => x.prev === pv.no);
  if (open >= 0) { DB.cur = open; save(); paintSale(); return true; }
  const data = { prev: pv.no, items: pv.items.map((i) => Object.assign({}, i)), disc: pv.disc, client: pv.client };
  if (!DB.cart.items.length && !DB.cart.mesa && !DB.cart.prev) Object.assign(DB.cart, data); else newTicketNow(data);
  save(); beep(true); paintSale(); toast(`Preventa N° ${no} lista para cobrar`); return true;
}
function prevHtml(pv) {
  const lines = pv.items.map((i) => ({ l: i, r: resolveLine(i) })).filter((x) => x.r);
  return `<h3>${esc(DB.biz.name)}</h3><div class="c big">PREVENTA N° ${pv.no}</div><div class="c">${fmtDT(pv.t)} · Vendedor: ${esc(pv.un)}</div><hr>` +
    lines.map(({ l, r }) => `<div class="l"><span>${fmtQ(l.qty)}${unitTxt(r)} x ${esc(r.name)}</span><span>${money(r.price * l.qty)}</span></div>`).join("") +
    `<hr>${pv.disc ? `<div class="l"><span>Descuento</span><span>- ${money(pv.disc)}</span></div>` : ""}<div class="l t"><span>TOTAL</span><span>${money(pv.total)}</span></div><hr><div class="c">Pague en caja indicando el N° ${pv.no}</div>`;
}
act({
  mesas: openTables,
  mesa: (el) => goTable(+el.dataset.m),
  prevsave: savePrev,
  prevprint: (el) => { const pv = DB.prev.find((x) => x.no === +el.dataset.n); if (pv) printHtml(prevHtml(pv)); },
  prevload: () => promptBox({ title: "Cobrar una preventa", label: "Número de preventa", num: true, ph: "Ej: 15", ok: "Buscar", required: "Escribe el número" }, (v) => loadPrev(parseInt(v.replace(/\D/g, ""), 10)))
});
