/* ===================== 65 · PROVEEDORES: lo que debes, lo que abonas y lo que pagas ===================== */
// DB.supp = proveedores. DB.sm = movimientos: "deuda" (te fiaron mercadería) y "pago" (abono o pago al contado).
const supp = (id) => DB.supp.find((x) => x.id === id);
const suppBal = (s) => r2(DB.sm.filter((x) => x.sid === s.id).reduce((a, x) => a + (x.type === "deuda" ? x.amt : -x.amt), 0));
const suppTotalDebt = () => r2(DB.supp.reduce((a, s) => a + Math.max(0, suppBal(s)), 0));
const suppLast = (s) => DB.sm.filter((x) => x.sid === s.id).reduce((a, x) => Math.max(a, x.t), 0);

// Lista «con botones» (opción A de David, 26 oct 2026): resumen, buscador, filtros y en cada fila Pagar (todo), Abonar y Me fiaron.
const PV_COL = ["#0E7490", "#B45309", "#7C3AED", "#15803D", "#BE123C", "#1E4E8C"];
const pvIni = (n) => (String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("") || "?").toUpperCase();
const pvCol = (n) => PV_COL[[...String(n || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % PV_COL.length];
const PV_IC = { pay: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>', abono: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', box: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/>', srch: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>' };
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
      <div class="pvsal"><b class="num ${b > 0 ? "debe" : "cero"}">${b > 0 ? money(b) : b < 0 ? money(-b) : "Sin deuda"}</b><small>${b > 0 ? "le debes" : b < 0 ? "a tu favor" : ""}</small></div>
      <div class="pvacts">${b > 0 ? `<button class="pvb pay" data-a="pspayall" data-id="${s.id}">${pvI("pay")}Pagar</button><button class="pvb abo" data-a="pspay" data-id="${s.id}">${pvI("abono")}Abonar</button>` : ""}<button class="pvb fio" data-a="psdebt" data-id="${s.id}">${pvI("box")}Me fiaron</button></div></div>`;
  };
  v.innerHTML = `<div class="ph"><h1>Proveedores</h1><button class="btn sm" data-a="psnew">${svg("plus", "bi")}Nuevo proveedor</button></div>
    ${list.length ? `<div class="pvsum"><div class="card pvs ${debt > 0 ? "big" : ""}"><small>Debes en total${owing ? ` · ${owing} ${owing === 1 ? "proveedor" : "proveedores"}` : ""}</small><b class="num">${money(debt)}</b></div><div class="card pvs"><small>Pagado hoy</small><b class="num">${money(hoy)}</b></div><div class="card pvs"><small>Te fiaron este mes</small><b class="num">${money(fiado)}</b></div></div>
    <div class="pvtools"><label class="pvq">${pvI("srch")}<input type="search" id="psq" placeholder="Buscar proveedor…" value="${esc(ui.psq || "")}" autocomplete="off" aria-label="Buscar proveedor"></label><div class="pvfl" role="group" aria-label="Mostrar">${[["all", "Todos"], ["debo", "Les debo"], ["cero", "Sin deuda"]].map(([k, t]) => `<button class="${f === k ? "on" : ""}" data-a="pvf" data-f="${k}" aria-pressed="${f === k}">${t}</button>`).join("")}</div></div>
    <div id="pvlist">${list.map(row).join("")}<p class="muted pvnone" id="pvnone" hidden>No hay proveedores así.</p></div>`
      : `<div class="empty"><h2>Aún no tienes proveedores</h2><p>Agrega a quien te surte para anotar lo que le debes y lo que le vas pagando.</p><button class="btn" data-a="psnew">Agregar proveedor</button></div>`}`;
  const q = $("#psq"); if (q) { q.oninput = () => { ui.psq = q.value; pvFilter(); }; pvFilter(); }
};
const dkeyOf = (t) => { const d = new Date(t), p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

function provDetail(v, s) {
  const b = suppBal(s), rows = DB.sm.filter((x) => x.sid === s.id).sort((x, y) => y.t - x.t);
  let run = b; const withBal = rows.map((x) => { const r = { x, bal: run }; run = r2(run - (x.type === "deuda" ? x.amt : -x.amt)); return r; });
  v.innerHTML = `<div class="ph"><div><button class="link" data-a="psback">‹ Proveedores</button><h1>${esc(s.name)}</h1>${s.phone ? `<p class="muted">${esc(s.phone)}</p>` : ""}${s.note ? `<p class="muted sm">${esc(s.note)}</p>` : ""}</div><button class="btn sec sm" data-a="psedit" data-id="${s.id}">${svg("edit", "bi")}Editar</button></div>
    <div class="sumrow two"><div class="sum ${b > 0 ? "warn" : ""}"><b class="num">${money(Math.abs(b))}</b><span>${b > 0 ? "Le debes" : b < 0 ? "Saldo a favor" : "Sin deuda"}</span></div></div>
    <div class="row wrap pvdacts" style="margin-bottom:14px">${b > 0 ? `<button class="btn" data-a="pspayall" data-id="${s.id}">${pvI("pay")}Pagar todo</button>` : ""}<button class="btn ${b > 0 ? "sec" : ""}" data-a="pspay" data-id="${s.id}">${pvI("abono")}${b > 0 ? "Abonar" : "Pagar"}</button><button class="btn sec" data-a="psdebt" data-id="${s.id}">${pvI("box")}Me fiaron</button></div>
    <div class="card"><h2>Movimientos</h2>${withBal.length ? `<div class="tablewrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Detalle</th><th class="r">Deuda</th><th class="r">Pago</th><th class="r">Saldo</th><th></th></tr></thead><tbody>${withBal.map(({ x, bal }) => `<tr><td>${dmy(x.date)}</td><td>${x.type === "pago" ? "Pago" + (x.m && x.m !== "efectivo" ? " (" + METHODS[x.m] + ")" : " (efectivo)") : "Me fiaron"}${x.note ? " · " + esc(x.note) : ""}<small class="muted"> · ${esc(x.un || "")}</small></td><td class="r num">${x.type === "deuda" ? money(x.amt) : ""}</td><td class="r num">${x.type === "pago" ? money(x.amt) : ""}</td><td class="r num">${money(bal)}</td><td><button class="link xs" data-a="psdel" data-id="${x.id}" aria-label="Borrar movimiento">✕</button></td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">Todavía no hay movimientos.</p>`}</div>`;
}
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
  psnew: () => suppForm(""),
  psedit: (el) => suppForm(el.dataset.id),
  pssave: (el) => {
    const g = (k) => ($("#pf-" + k) || { value: "" }).value.trim(), name = g("name"), id = el.dataset.id;
    if (!name) return toast("Escribe el nombre");
    if (DB.supp.some((x) => x.id !== id && x.name.toLowerCase() === name.toLowerCase())) return toast("Ya tienes un proveedor con ese nombre");
    let s = id ? supp(id) : null;
    if (s) Object.assign(s, { name, phone: g("phone"), note: g("note") }); else { s = { id: uid(), name, phone: g("phone"), note: g("note"), t: Date.now() }; DB.supp.push(s); log("Proveedor creado", name); }
    save(); closeModal(); toast("Proveedor guardado"); ui.ps = s.id; render();
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
