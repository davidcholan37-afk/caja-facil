/* ===================== 50 · CLIENTES: crédito, cuenta corriente, historial y puntos ===================== */
const clientSales = (c) => DB.sales.filter((s) => s.client === c.id);
// Cuenta corriente: cargos (ventas al crédito) y abonos (pagos y devoluciones), con saldo.
function ledgerOf(c) {
  const e = [];
  clientSales(c).forEach((s) => {
    if (s.void) return;
    const cr = paysOf(s).filter((p) => p.m === "credito").reduce((a, p) => a + p.amt, 0);
    if (cr > 0) e.push({ t: s.t, date: s.date, what: `Compra ${docShort(s)}`, cargo: r2(cr), abono: 0, sale: s.id });
    (s.returns || []).forEach((r) => { if (r.m === "credito") e.push({ t: r.t, date: dkey(new Date(r.t)), what: `Devolución ${docShort(s)}`, cargo: 0, abono: r.amount, sale: s.id }); });
  });
  DB.moves.filter((m) => m.type === "abono" && m.client === c.id).forEach((m) => e.push({ t: m.t, date: m.date, what: `Pago en ${METHODS[m.m] || "efectivo"}${m.note ? " · " + m.note : ""}`, cargo: 0, abono: m.amount, mv: m.id }));
  e.sort((a, b) => a.t - b.t);
  let bal = 0; e.forEach((x) => { bal = r2(bal + x.cargo - x.abono); x.bal = bal; });
  return e;
}
function balanceOf(c) { if (!c) return 0; const l = ledgerOf(c); return l.length ? Math.max(0, l[l.length - 1].bal) : 0; }
// Antigüedad: los pagos cubren primero las compras más antiguas.
function agingOf(c) {
  const l = ledgerOf(c); let paid = l.reduce((a, x) => a + x.abono, 0), oldest = null;
  for (const x of l) { if (!x.cargo) continue; if (paid >= x.cargo - 0.001) { paid = r2(paid - x.cargo); continue; } oldest = x.date; break; }
  const debt = balanceOf(c), days = oldest ? Math.round((pk(dkey()) - pk(oldest)) / 864e5) : 0;
  return { debt, oldest, days, late: debt > 0 && c.days > 0 && days > c.days };
}
function pointsOf(c) {
  if (!c) return 0;
  return Math.max(0, Math.floor(clientSales(c).filter((s) => !s.void).reduce((a, s) => a + (s.ptsEarn || 0) - (s.ptsUsed || 0), 0) + (+c.ptsAdj || 0)));
}
VIEWS.cli = function viewClients(v) {
  const all = DB.clients.map((c) => ({ c, a: agingOf(c) }));
  const debtors = all.filter((x) => x.a.debt > 0), late = all.filter((x) => x.a.late), tot = r2(debtors.reduce((a, x) => a + x.a.debt, 0));
  const F = [["todos", "Todos"], ["deuda", `Con deuda (${debtors.length})`], ["vencidos", `Vencidos (${late.length})`]];
  ui.cf = ui.cf || "todos";
  v.innerHTML = `<div class="ph"><h1>Clientes</h1><div class="row wrap">${can("clientes") ? `<button class="btn sm" data-a="clinewv">+ Nuevo cliente</button>` : ""}</div></div>
    <div class="sumrow"><div class="sum"><b>${DB.clients.length}</b><span>Clientes</span></div><div class="sum ${tot > 0 ? "warn" : ""}"><b class="num">${money(tot)}</b><span>Te deben (fiado)</span></div><div class="sum ${late.length ? "bad" : ""}"><b>${late.length}</b><span>Con pago vencido</span></div></div>
    <div class="seg tabs2">${F.map(([k, l]) => `<button class="${ui.cf === k ? "on" : ""}" data-a="cfil" data-f="${k}">${l}</button>`).join("")}</div>
    <input class="inp" id="cq" type="search" placeholder="Buscar por nombre, DNI, RUC o celular" style="margin-bottom:12px" value="${esc(ui.cq)}">
    <div class="list" id="clist"></div>`;
  paintCList();
};
function paintCList() {
  const el = $("#clist"); if (!el) return;
  if (!DB.clients.length) { el.innerHTML = `<div class="empty"><h2>Aún no tienes clientes</h2><p>Regístralos para venderles al crédito, darles factura o acumular puntos.</p></div>`; return; }
  const q = norm(ui.cq), raw = ui.cq || "";
  let list = DB.clients.map((c) => ({ c, a: agingOf(c) })).filter(({ c }) => !q || norm(c.name).includes(q) || (c.doc || "").includes(raw) || (c.phone || "").replace(/\D/g, "").includes(raw.replace(/\D/g, "") || "~"));
  if (ui.cf === "deuda") list = list.filter((x) => x.a.debt > 0); else if (ui.cf === "vencidos") list = list.filter((x) => x.a.late);
  list.sort((a, b) => b.a.debt - a.a.debt || a.c.name.localeCompare(b.c.name, "es"));
  el.innerHTML = list.slice(0, 300).map(({ c, a }) => { const pts = DB.cfg.pts.on ? pointsOf(c) : 0; return `<button class="it" data-a="cliopen" data-id="${c.id}"><span class="av" style="--h:${avHue(c)}">${esc(initials(c.name))}</span><div class="t"><b>${esc(c.name)}</b><small>${c.doc ? esc(c.dt + " " + c.doc) : "Sin documento"}${c.phone ? " · " + esc(fmtPhone(c.phone)) : ""}${pts ? ` · ${pts} pts` : ""}</small>${a.late ? ` <span class="tag out">Vencido hace ${a.days - c.days} d</span>` : ""}</div><div class="v num ${a.debt > 0 ? "warn" : ""}">${a.debt > 0 ? money(a.debt) : "Al día"}<small>${a.debt > 0 ? "debe" : ""}</small></div></button>`; }).join("") || `<div class="empty"><p>Nadie coincide con ese filtro.</p></div>`;
}
function openClient(id, cb) {
  const c = id ? cli(id) : { name: "", dt: "DNI", doc: "", phone: "", email: "", addr: "", limit: "", days: "", note: "" };
  ui.cecb = cb || null;
  openModal(`<h2>${id ? "Editar cliente" : "Nuevo cliente"}</h2>
    <label class="fld"><span>Nombre o razón social</span><input class="inp" id="ce-name" value="${esc(c.name)}" autofocus maxlength="80" autocomplete="off"></label>
    <div class="two"><label class="fld"><span>Documento</span><select class="inp" id="ce-dt">${["DNI", "RUC", "CE", ""].map((d) => `<option value="${d}" ${c.dt === d ? "selected" : ""}>${d || "Sin documento"}</option>`).join("")}</select></label>
      <label class="fld"><span>Número</span><input class="inp num" id="ce-doc" value="${esc(c.doc)}" inputmode="numeric" maxlength="12" autocomplete="off"></label></div>
    <div class="two"><label class="fld"><span>Celular (WhatsApp)</span><input class="inp num" id="ce-phone" value="${esc(c.phone)}" inputmode="tel" maxlength="15"></label>
      <label class="fld"><span>Correo</span><input class="inp" id="ce-email" value="${esc(c.email || "")}" inputmode="email" maxlength="60"></label></div>
    <label class="fld"><span>Dirección (sale en la factura)</span><input class="inp" id="ce-addr" value="${esc(c.addr || "")}" maxlength="100"></label>
    <div class="two"><label class="fld"><span>Límite de crédito S/ (0 = sin límite)</span><input class="inp num" id="ce-limit" value="${esc(c.limit || "")}" inputmode="decimal" placeholder="0"></label>
      <label class="fld"><span>Días para pagar</span><input class="inp num" id="ce-days" value="${esc(c.days || "")}" inputmode="numeric" placeholder="Ej: 15"></label></div>
    <label class="fld"><span>Nota</span><input class="inp" id="ce-note" value="${esc(c.note || "")}" maxlength="80" placeholder="Ej: paga los sábados"></label>
    <div class="btns h"><button class="btn sec" data-a="${cb ? "cecancel" : "close"}">Cancelar</button><button class="btn" data-enter data-a="clisave" data-id="${id || ""}">Guardar</button></div>
    ${id && can("clientes") ? `<button class="link" data-a="clidel" data-id="${id}" style="width:100%;color:var(--red)">Eliminar cliente</button>` : ""}`);
}
function saveClient(id) {
  const g = (k) => ($("#ce-" + k) || { value: "" }).value.trim();
  const name = g("name"), dt = g("dt"), doc = g("doc").replace(/\s/g, "");
  if (!name) return toast("Escribe el nombre");
  if (dt === "DNI" && doc && !dniOk(doc)) return toast("El DNI tiene 8 dígitos");
  if (dt === "RUC" && !rucOk(doc)) return toast("Ese RUC no es válido (11 dígitos)");
  if (doc && DB.clients.some((x) => x.doc === doc && x.id !== id)) return toast("Ya hay un cliente con ese documento");
  const data = { name, dt: doc ? dt : "", doc, phone: g("phone").replace(/[^\d+]/g, ""), email: g("email"), addr: g("addr"), limit: Math.max(0, r2(num(g("limit")))), days: Math.max(0, parseInt(g("days"), 10) || 0), note: g("note") };
  let c = id ? cli(id) : null;
  if (c) Object.assign(c, data); else { c = Object.assign({ id: uid(), t: Date.now() }, data); DB.clients.push(c); log("Cliente creado", name); }
  save(); const cb = ui.cecb; ui.cecb = null;
  if (cb) return cb(c);
  closeModal(); toast("Cliente guardado"); if (ui.tab === "cli") render();
}
function clientDetail(id, tab) {
  const c = cli(id); if (!c) return;
  const a = agingOf(c), l = ledgerOf(c), sales = clientSales(c).sort((x, y) => y.t - x.t), pts = pointsOf(c);
  const bought = r2(sales.filter((s) => !s.void).reduce((x, s) => x + s.total, 0));
  ui.ctab = tab || ui.ctab || "cuenta";
  openModal(`<div class="chead"><span class="av big" style="--h:${avHue(c)}">${esc(initials(c.name))}</span><div><h2>${esc(c.name)}</h2><p class="muted">${c.doc ? esc(c.dt + " " + c.doc) : "Sin documento"}${c.phone ? " · " + esc(fmtPhone(c.phone)) : ""}${c.addr ? " · " + esc(c.addr) : ""}</p>${c.note ? `<p class="muted sm">${esc(c.note)}</p>` : ""}</div></div>
    <div class="sumrow"><div class="sum ${a.debt > 0 ? "warn" : ""}"><b class="num">${money(a.debt)}</b><span>Debe${a.late ? ` · vencido` : ""}</span></div><div class="sum"><b class="num">${c.limit ? money(c.limit) : "—"}</b><span>Límite${c.days ? ` · ${c.days} días` : ""}</span></div><div class="sum"><b class="num">${money(bought)}</b><span>${sales.length} compras${DB.cfg.pts.on ? ` · ${pts} pts` : ""}</span></div></div>
    <div class="row wrap" style="margin-bottom:12px">${a.debt > 0 ? `<button class="btn sm" data-a="abono" data-id="${c.id}">Cobrar deuda</button>${c.phone ? `<button class="btn sec sm" data-a="cliwa" data-id="${c.id}">${svg("wa", "bi")}Recordar por WhatsApp</button>` : ""}` : ""}<button class="btn sec sm" data-a="cliprint" data-id="${c.id}">${svg("print", "bi")}Estado de cuenta</button>${can("clientes") ? `<button class="btn sec sm" data-a="cliedit" data-id="${c.id}">Editar datos</button>` : ""}${DB.cfg.pts.on && can("ajustes") ? `<button class="btn sec sm" data-a="ptsadj" data-id="${c.id}">Ajustar puntos</button>` : ""}</div>
    <div class="seg tabs2"><button class="${ui.ctab === "cuenta" ? "on" : ""}" data-a="ctab" data-t="cuenta" data-id="${c.id}">Cuenta corriente</button><button class="${ui.ctab === "hist" ? "on" : ""}" data-a="ctab" data-t="hist" data-id="${c.id}">Historial de compras</button></div>
    ${ui.ctab === "cuenta" ? (l.length ? `<div class="tablewrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Detalle</th><th class="r">Cargo</th><th class="r">Abono</th><th class="r">Saldo</th></tr></thead><tbody>${l.slice().reverse().map((x) => `<tr ${x.sale ? `data-a="sale" data-id="${x.sale}" class="click"` : ""}><td>${dmy(x.date)}</td><td>${esc(x.what)}</td><td class="r num">${x.cargo ? money(x.cargo) : ""}</td><td class="r num gain">${x.abono ? money(x.abono) : ""}</td><td class="r num"><b>${money(x.bal)}</b></td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">No tiene compras al crédito.</p>`)
    : (sales.length ? `<div class="list">${sales.slice(0, 100).map((s) => `<button class="it sm" data-a="sale" data-id="${s.id}"><div class="t"><b>${DOCS[s.doc.type]} ${docShort(s)}</b><small>${dmy(s.date)} ${hhmm(s.t)} · ${esc(methodLabel(s))} · ${s.items.length} ítems</small>${s.void ? ` <span class="tag void">Anulada</span>` : ""}</div><div class="v num">${money(s.total)}</div></button>`).join("")}</div>` : `<p class="muted">Aún no compra nada.</p>`)}
    <div class="btns"><button class="btn sec" data-a="close">Cerrar</button></div>`, "wide");
}
function openAbono(id) {
  const c = cli(id); if (!c) return; const debt = balanceOf(c);
  ui.ab = { id, m: "efectivo" };
  openModal(`<h2>Cobrar deuda</h2><p class="muted" style="margin-bottom:12px">${esc(c.name)} debe <b>${money(debt)}</b>.</p>
    <label class="fld"><span>Monto que paga (S/)</span><input class="inp num big" id="abq" inputmode="decimal" value="${debt.toFixed(2)}" autofocus></label>
    <div class="methods" id="abm">${["efectivo", "yape", "plin", "tarjeta", "transferencia"].map((m) => `<button class="mth ${m === "efectivo" ? "on" : ""}" data-a="abm" data-m="${m}">${METHODS[m]}</button>`).join("")}</div>
    <label class="fld"><span>Nota (opcional)</span><input class="inp" id="abn" maxlength="50"></label>
    <div class="btns h"><button class="btn sec" data-a="cliopen" data-id="${id}">Volver</button><button class="btn" data-enter data-a="abok">Registrar pago</button></div>`);
}
function stmtHtml(c) {
  const l = ledgerOf(c);
  return `<h2>Estado de cuenta</h2><p><b>${esc(c.name)}</b>${c.doc ? " · " + esc(c.dt + " " + c.doc) : ""}<br>${esc(DB.biz.name)} · ${fmtDT(Date.now())}</p>
    <table class="tbl"><thead><tr><th>Fecha</th><th>Detalle</th><th class="r">Cargo</th><th class="r">Abono</th><th class="r">Saldo</th></tr></thead><tbody>${l.map((x) => `<tr><td>${dmy(x.date)}</td><td>${esc(x.what)}</td><td class="r">${x.cargo ? money(x.cargo) : ""}</td><td class="r">${x.abono ? money(x.abono) : ""}</td><td class="r">${money(x.bal)}</td></tr>`).join("")}</tbody></table>
    <p style="font-size:1.2em"><b>Saldo pendiente: ${money(balanceOf(c))}</b></p>`;
}
act({
  clinewv: () => need("clientes", () => openClient("")),
  cliopen: (el) => clientDetail(el.dataset.id),
  cliedit: (el) => need("clientes", () => openClient(el.dataset.id, () => clientDetail(el.dataset.id))),
  clisave: (el) => saveClient(el.dataset.id),
  cecancel: () => { ui.cecb = null; closeModal(); },
  clidel: (el) => {
    const c = cli(el.dataset.id); if (!c) return;
    if (balanceOf(c) > 0) return toast("No puedes eliminar un cliente que tiene deuda");
    need("clientes", () => confirmBox(`¿Eliminar a ${c.name}?`, "Eliminar", () => { DB.clients = DB.clients.filter((x) => x !== c); DB.tickets.forEach((t) => { if (t.client === c.id) t.client = ""; }); log("Cliente eliminado", c.name); save(); render(); }, true, "Sus ventas pasadas conservan su nombre."));
  },
  ctab: (el) => clientDetail(el.dataset.id, el.dataset.t),
  cfil: (el) => { ui.cf = el.dataset.f; render(); },
  abono: (el) => need("abonos", () => openAbono(el.dataset.id), "Cobrar deuda"),
  abm: (el) => { ui.ab.m = el.dataset.m; $$("#abm .mth").forEach((b) => b.classList.toggle("on", b.dataset.m === ui.ab.m)); },
  abok: () => {
    const c = cli(ui.ab.id), amt = r2(num($("#abq").value)), debt = balanceOf(c);
    if (!(amt > 0)) return toast("Escribe el monto");
    if (amt > debt + 0.001) return toast(`No puede pagar más de lo que debe (${money(debt)})`);
    const m = addMove("abono", amt, $("#abn").value.trim(), { client: c.id, m: ui.ab.m });
    log("Cobro de deuda", `${c.name}: ${money(amt)} (${METHODS[ui.ab.m]})`);
    save(); toast(`Pago registrado. Ahora debe ${money(balanceOf(c))}`);
    openModal(`<div class="rcpt"><h3>${esc(DB.biz.name)}</h3><div class="c doc"><b>RECIBO DE PAGO</b></div><div class="l"><span>Fecha</span><span>${fmtDT(m.t)}</span></div><div class="l"><span>Cliente</span><span>${esc(c.name)}</span></div><hr><div class="l t"><span>PAGÓ</span><span>${money(amt)}</span></div><div class="l"><span>Medio</span><span>${METHODS[ui.ab.m]}</span></div><div class="l"><span>Saldo pendiente</span><span>${money(balanceOf(c))}</span></div><hr><div class="c">Atendido por ${esc(me().name)}</div></div>
      <div class="btns h"><button class="btn sec" data-a="abprint">${svg("print", "bi")}Imprimir</button><button class="btn" data-a="cliopen" data-id="${c.id}">Listo</button></div>`);
    ui.abhtml = $(".rcpt").innerHTML; if (ui.tab === "cli") VIEWS.cli($("#view"));
  },
  abprint: () => printHtml(ui.abhtml || ""),
  cliwa: (el) => { const c = cli(el.dataset.id); if (!c) return; window.open(`https://wa.me/51${c.phone.replace(/\D/g, "").slice(-9)}?text=` + encodeURIComponent(`Hola ${c.name.split(" ")[0]}, te saluda ${DB.biz.name}. Tu saldo pendiente es de ${money(balanceOf(c))}. ¡Gracias por tu preferencia!`), "_blank", "noopener"); },
  cliprint: (el) => { const c = cli(el.dataset.id); if (c) printHtml(stmtHtml(c), "rep"); },
  ptsadj: (el) => { const c = cli(el.dataset.id); promptBox({ title: "Ajustar puntos", text: `${esc(c.name)} tiene ${pointsOf(c)} puntos. Escribe cuántos sumar (o con signo menos para restar).`, label: "Puntos", num: true, ph: "Ej: 50 o -20" }, (v) => { const n = parseInt(v, 10); if (!n) return; c.ptsAdj = (+c.ptsAdj || 0) + n; log("Ajuste de puntos", `${c.name}: ${n}`); save(); clientDetail(c.id); }); }
});
