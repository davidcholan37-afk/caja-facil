/* ===================== 69 · VOZ: «anota un yogurt», «paga 50 a Gloria» (extra de pago) ===================== */
// Flujo: micrófono → texto (Chrome) → la nube lo convierte en órdenes simples → la caja las busca en TUS productos,
// clientes y proveedores → te muestra «Entendí» → tú tocas Aceptar. Nada se anota ni se paga sin tu Aceptar.
const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const vozOk = () => !!SR && cloudOn() && !!cloudLoad().voz;
let vz = null; // { rec, texto, plan }

function stopVoz() { if (vz && vz.rec) { try { vz.rec.onresult = vz.rec.onend = vz.rec.onerror = null; vz.rec.abort(); } catch (e) {} } vz = null; }

/* ---------- buscar nombres en lo que ya tiene la caja ---------- */
const VZ_STOP = new Set(["de", "del", "la", "el", "los", "las", "un", "una", "unos", "unas", "y", "con", "para", "a", "al", "dona", "don", "senora", "senor", "sra", "sr"]);
const vzStem = (w) => (w.length > 4 ? w.replace(/(es|s)$/, "") : w.replace(/s$/, ""));
const vzToks = (s) => norm(s).replace(/[^a-z0-9ñ ]/g, " ").split(/\s+/).filter((w) => w && !VZ_STOP.has(w)).map(vzStem);
const vzHit = (q, w) => w === q || (q.length >= 3 && w.startsWith(q)) || (w.length >= 3 && q.startsWith(w));
// Devuelve { it } si hay uno claro, { amb: [...] } si hay varios parecidos, {} si no hay.
function vzFind(list, name, getName) {
  const q = vzToks(name); if (!q.length) return {};
  const cand = list.filter((x) => { const w = vzToks(getName(x)); return q.every((t) => w.some((y) => vzHit(t, y))); });
  if (cand.length === 1) return { it: cand[0] };
  if (!cand.length) return {};
  const ex = cand.filter((x) => { const w = vzToks(getName(x)); return w.length === q.length; });
  if (ex.length === 1) return { it: ex[0] };
  return { amb: cand.slice(0, 3).map(getName) };
}

/* ---------- convertir cada orden en una línea de «Entendí» ---------- */
function vzPlan(acc) {
  return acc.map((a) => {
    if (a.tipo === "consulta") return !(can("caja") || can("reportes")) ? { ok: false, txt: "Tu usuario no puede ver las ventas del día" } : { ok: true, txt: "Ver las ventas de hoy", run: () => vzVentas() };
    if (a.tipo === "anotar") {
      const r = vzFind(DB.products.filter((p) => p.on !== false), a.nombre, (p) => p.name);
      if (r.amb) return { ok: false, txt: `«${a.nombre}»: hay varios (${r.amb.join(", ")}). Di el nombre completo.` };
      const p = r.it; if (!p) return { ok: false, txt: `No encontré el producto «${a.nombre}»` };
      if ((p.pres || []).length) return { ok: false, txt: `${p.name}: tiene presentaciones, tócalo para elegir una` };
      const kg = p.unit === "kg";
      if (kg && !a.cantidad) return { ok: false, txt: `${p.name}: dime cuánto pesa (por ejemplo «un cuarto»)` };
      if (!kg && a.unidad === "kg") return { ok: false, txt: `${p.name} se vende por unidad, no por peso` };
      const qty = r3(a.cantidad || 1);
      return { ok: true, txt: `${fmtQ(qty)}${kg ? " kg" : ""} × ${p.name}`, add: [p, qty] };
    }
    if (a.tipo === "pagar_proveedor") {
      if (!can("caja")) return { ok: false, txt: "Tu usuario no puede pagar a proveedores" };
      const r = vzFind(DB.supp, a.nombre, (s) => s.name);
      if (r.amb) return { ok: false, txt: `Proveedor «${a.nombre}»: hay varios (${r.amb.join(", ")}). Di el nombre completo.` };
      if (!r.it) return { ok: false, txt: `No encontré al proveedor «${a.nombre}»` };
      if (!a.monto) return { ok: false, txt: `Pago a ${r.it.name}: dime el monto` };
      return { ok: true, modal: true, txt: `Pagar ${money(a.monto)} a ${r.it.name}${a.medio ? " (" + METHODS[a.medio].toLowerCase() + ")" : ""}`, run: () => vzPagar(r.it, a.monto, a.medio) };
    }
    if (a.tipo === "fiado") {
      const r = vzFind(DB.clients, a.nombre, (c) => c.name);
      if (r.amb) return { ok: false, txt: `Cliente «${a.nombre}»: hay varios (${r.amb.join(", ")}). Di el nombre completo.` };
      if (!r.it) return { ok: false, txt: `No encontré al cliente «${a.nombre}»` };
      if (!a.monto && !cartLines().length) return { ok: false, txt: `Fiado a ${r.it.name}: dime el monto o anota primero los productos` };
      return { ok: true, modal: true, txt: a.monto ? `Fiar ${money(a.monto)} a ${r.it.name}` : `Fiar este ticket a ${r.it.name}`, run: () => vzFiar(r.it, a.monto) };
    }
    return { ok: false, txt: "No entendí esta orden" };
  });
}

/* ---------- lo que hace cada orden (siempre con las pantallas que ya existen) ---------- */
function vzPagar(s, monto, medio) {
  suppMoney("pago", s.id);
  const i = $("#spa"); if (i) i.value = r2(monto).toFixed(2);
  if (medio && $(`#spm [data-m="${medio}"]`)) $(`#spm [data-m="${medio}"]`).click();
}
function vzFiar(c, monto) {
  setClient(c.id);
  if (monto) { DB.cart.items.push({ id: "q" + uid(), pres: "", quick: true, name: "Fiado", price: r2(monto), qty: 1 }); save(); paintSale(); }
  startPay("credito");
}
function vzVentas() {
  const t = dayTotals(dkey());
  openModal(`<h2>Ventas de hoy</h2><div class="kv"><span>Total</span><b class="num">${money(t.total)}</b></div>
    <div class="kv"><span>Ventas</span><b class="num">${t.n}</b></div><div class="kv"><span>Efectivo</span><b class="num">${money(t.efectivo)}</b></div>
    <div class="kv"><span>Yape</span><b class="num">${money(t.yapeAll)}</b></div><div class="kv"><span>Plin</span><b class="num">${money(t.plin)}</b></div>
    <div class="kv"><span>Tarjeta</span><b class="num">${money(t.tarjeta)}</b></div>
    <div class="btns h"><button class="btn" data-a="close" data-enter>Listo</button></div>`);
}

/* ---------- pantallas: escuchando, entendí, errores ---------- */
function vzShow(html) { openModal(html); ui.mk = "voz"; }
function vozStart() {
  if (!vozOk()) return toast("La voz no está activada en tu caja. Pídela a tu proveedor.", true);
  if (!navigator.onLine) return toast("La voz necesita internet.", true);
  stopVoz();
  let rec; try { rec = new SR(); } catch (e) { return toast("Este navegador no puede escuchar. Usa Chrome.", true); }
  rec.lang = "es-PE"; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
  vz = { rec, texto: "", fin: "" };
  vzShow(`<div class="vzbox" role="status"><div class="vzmic">${svg("mic")}</div><h2>Te escucho…</h2><p class="vzt" id="vzt" aria-live="polite">Di, por ejemplo: «anota un yogurt y un cuarto de arroz»</p>
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" data-a="vozstop">Listo</button></div></div>`);
  rec.onresult = (e) => { let fin = "", tmp = ""; for (let i = 0; i < e.results.length; i++) { (e.results[i].isFinal ? (fin += e.results[i][0].transcript) : (tmp += e.results[i][0].transcript)); } if (vz) { vz.fin = fin; vz.texto = (fin + " " + tmp).trim(); } const t = $("#vzt"); if (t && vz) t.textContent = "«" + vz.texto + "»"; };
  rec.onerror = (e) => { const m = { "not-allowed": "Permite el micrófono en el navegador y vuelve a intentar.", "service-not-allowed": "Permite el micrófono en el navegador y vuelve a intentar.", "no-speech": "No te escuché. Acércate al micrófono e intenta otra vez.", network: "La voz necesita internet." }[e.error]; if (m) { stopVoz(); vzError(m); } };
  rec.onend = () => { if (vz) vozSend(); };
  try { rec.start(); } catch (e) { stopVoz(); vzError("No se pudo prender el micrófono."); }
}
function vzError(msg) { vzShow(`<div class="vzbox"><h2>No pude</h2><p class="muted" style="margin:6px 0 14px">${esc(msg)}</p><div class="btns h"><button class="btn sec" data-a="close">Cerrar</button><button class="btn" data-a="voz">Intentar otra vez</button></div></div>`); }
async function vozSend() {
  const texto = ((vz && vz.texto) || "").trim(); stopVoz();
  if (!texto) return vzError("No te escuché. Acércate al micrófono e intenta otra vez.");
  vzShow(`<div class="vzbox" role="status"><div class="vzmic busy">${svg("mic")}</div><h2>Entendiendo…</h2><p class="vzt">«${esc(texto)}»</p></div>`);
  let acc;
  try {
    const tk = await cloudToken(), neg = cloudLoad().neg;
    const r = await fetch(`${SB_URL}/functions/v1/voz`, { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + tk, "Content-Type": "application/json" }, body: JSON.stringify({ neg, texto }), signal: AbortSignal.timeout(20000) });
    if (r.status === 403) return vzError("La voz no está activada o llegaste al límite de hoy. Habla con tu proveedor.");
    if (!r.ok) return vzError("La voz no respondió. Intenta otra vez en un momento.");
    acc = (await r.json()).acciones || [];
  } catch (e) { return vzError("No hay conexión. La voz necesita internet; la caja sigue vendiendo normal."); }
  vzEntendi(texto, acc);
}
function vzEntendi(texto, acc) {
  if (!acc.length) return vzError(`No entendí «${texto}». Prueba con «anota un yogurt» o «paga 50 a Gloria».`);
  const plan = vzPlan(acc); vz = { plan, texto };
  const ok = plan.filter((x) => x.ok), modales = ok.filter((x) => x.modal).length;
  if (modales > 1) plan.forEach((x) => { if (x.modal && x !== ok.find((y) => y.modal)) { x.ok = false; x.txt += " (hazlo por separado, uno por vez)"; } });
  const hay = plan.some((x) => x.ok);
  vzShow(`<h2>Entendí</h2><p class="muted sm" style="margin-bottom:8px">«${esc(texto)}»</p>
    <div class="vzlist">${plan.map((x) => `<div class="vzl ${x.ok ? "" : "bad"}"><span class="vzi">${x.ok ? svg("check") : svg("close")}</span><span>${esc(x.txt)}</span></div>`).join("")}</div>
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button>${hay ? `<button class="btn" data-a="vozok" data-enter>Aceptar</button>` : `<button class="btn" data-a="voz">Hablar otra vez</button>`}</div>`);
}
function vozAccept() {
  const plan = ((vz && vz.plan) || []).filter((x) => x.ok); vz = null; if (!plan.length) return closeModal();
  closeModal();
  const adds = plan.filter((x) => x.add); adds.forEach((x) => addToCart(x.add[0], x.add[1]));
  if (adds.length) { paintSale(); beep(true); toast(adds.length === 1 ? "Anotado" : `Anotados: ${adds.length} productos`); }
  const m = plan.find((x) => x.run); if (m) m.run();
}
act({ voz: vozStart, vozstop: () => { if (vz && vz.rec) { try { vz.rec.stop(); } catch (e) { vozSend(); } } }, vozok: vozAccept });
