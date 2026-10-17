/* ===================== 71 · LUIS: asistente de ayuda (IA + órdenes + sin internet) ===================== */
// Luis tiene tres modos, siempre en el mismo chat:
//  1) Órdenes escritas («anota 2 leche», «cuánto vendí hoy»): las entiende el mismo intérprete local de la voz y,
//     antes de tocar nada, muestra la tarjeta «Entendí» con Aceptar. Necesita el extra de voz (vozOk).
//  2) Preguntas: las contesta la IA (función `ayuda`), que ahora sabe en qué pantalla estás y puede mandar botones «Ir a…».
//  3) Sin internet: contesta con pasos guardados en la app (HELP_KB). Todo es local y no manda nada.
let helpMessages = [], helpBusy = false, helpLastErr = "", helpCards = {}, helpCardN = 0, helpTick = 0;
const hn = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/* ---------- a dónde puede llevarte (solo navegar; nunca cambia datos) ---------- */
// clave → [pestaña, subpestaña, nombre]
const HELP_DEST = {
  venta: ["venta", "", "Vender"],
  ventas: ["ventas", "ventas", "Ventas"], "ventas.prev": ["ventas", "prev", "Preventas"], "ventas.desp": ["ventas", "desp", "Por despachar"], "ventas.dev": ["ventas", "dev", "Devoluciones"],
  prod: ["prod", "lista", "Productos"], "prod.low": ["prod", "low", "Por reponer"], "prod.exp": ["prod", "exp", "Por vencer"], "prod.idle": ["prod", "idle", "Sin mover"], "prod.kx": ["prod", "kx", "Movimientos"],
  cli: ["cli", "", "Clientes"], caja: ["caja", "", "Caja"], prov: ["prov", "", "Proveedores"], rep: ["rep", "", "Reportes"],
  aj: ["aj", "negocio", "Ajustes"], "aj.negocio": ["aj", "negocio", "Ajustes › Negocio"], "aj.comp": ["aj", "comp", "Comprobantes"], "aj.cobros": ["aj", "cobros", "Cobros y puntos"],
  "aj.venta": ["aj", "venta", "Pantalla de venta"], "aj.balanza": ["aj", "balanza", "Balanza"], "aj.usuarios": ["aj", "usuarios", "Usuarios y permisos"], "aj.tiendas": ["aj", "tiendas", "Tiendas"],
  "aj.nube": ["aj", "nube", "Nube"], "aj.datos": ["aj", "datos", "Datos y respaldo"], "aj.bitacora": ["aj", "bitacora", "Bitácora"]
};
const HELP_NAV = [["sin mover", "prod.idle"], ["por vencer", "prod.exp"], ["vencimiento", "prod.exp"], ["vencer", "prod.exp"], ["por reponer", "prod.low"], ["reponer", "prod.low"], ["stock bajo", "prod.low"],
  ["kardex", "prod.kx"], ["movimientos", "prod.kx"], ["preventas", "ventas.prev"], ["devoluciones", "ventas.dev"], ["despachar", "ventas.desp"], ["historial", "ventas"],
  ["productos", "prod"], ["inventario", "prod"], ["clientes", "cli"], ["fiados", "cli"], ["proveedores", "prov"], ["reportes", "rep"], ["ganancia", "rep"],
  ["ajustes", "aj"], ["configuracion", "aj"], ["nube", "aj.nube"], ["respaldo", "aj.datos"], ["copia de seguridad", "aj.datos"], ["usuarios", "aj.usuarios"],
  ["balanza", "aj.balanza"], ["cobros", "aj.cobros"], ["tiendas", "aj.tiendas"], ["bitacora", "aj.bitacora"], ["ventas", "ventas"], ["vender", "venta"], ["venta", "venta"], ["arqueo", "caja"], ["caja", "caja"]
].sort((a, b) => b[0].length - a[0].length);
function helpGo(k) {
  const d = HELP_DEST[k]; if (!d) return;
  if (!tabOk(d[0])) return toast("No tienes permiso para entrar ahí");
  if (modalOpen()) closeModal();
  if (d[0] === "prod") ui.ptab = d[1]; else if (d[0] === "ventas") ui.vtab = d[1];
  else if (d[0] === "aj") { ui.atab = d[1]; if (!ATABS_BASIC.includes(d[1])) ui.amore = true; }
  go(d[0]);
  if (window.matchMedia && matchMedia("(max-width:640px)").matches) helpClose();
  toast("Aquí está: " + d[2]); helpStatus();
}
const helpDest = (k) => { const d = HELP_DEST[k]; return d && tabOk(d[0]) ? d : null; };

/* ---------- pantalla actual y sugerencias ---------- */
function helpScreen() {
  const t = (TABS.find((x) => x[0] === ui.tab) || [])[1] || "Caja Fácil", sub = [];
  if (ui.tab === "prod") { const d = Object.values(HELP_DEST).find((x) => x[0] === "prod" && x[1] === ui.ptab); if (d && ui.ptab !== "lista") sub.push(d[2]); }
  if (ui.tab === "ventas") { const d = Object.values(HELP_DEST).find((x) => x[0] === "ventas" && x[1] === ui.vtab); if (d && ui.vtab !== "ventas") sub.push(d[2]); }
  if (ui.tab === "aj") { const x = ATABS.find((y) => y[0] === ui.atab); if (x) sub.push(x[1]); }
  return [t].concat(sub).join(" › ");
}
const HELP_CHIPS = {
  venta: { q: ["¿Cómo cobro con Yape?", "¿Cómo dejo una venta en espera?", "¿Cómo uso la balanza?"], c: ["cuánto vendí hoy", "qué se vende más"] },
  ventas: { q: ["¿Cómo anulo una venta?", "¿Cómo mando el ticket por WhatsApp?"], c: ["anula la última venta", "cuánto vendí hoy"] },
  prod: { q: ["¿Cómo creo un producto?", "¿Cómo pongo precio por mayor?", "¿Cómo registro vencimientos?"], c: ["qué hay que comprar", "qué vence pronto"] },
  cli: { q: ["¿Cómo fío a un cliente?", "¿Cómo le recuerdo su deuda?"], c: ["nuevo cliente Rosa celular 987654321"] },
  caja: { q: ["¿Cómo cierro mi caja?", "¿Cómo anoto un gasto?"], c: ["anota un gasto de 20 en bolsas", "cierra la caja", "cuánto vendí hoy"] },
  prov: { q: ["¿Cómo pago a un proveedor?", "¿Cómo anoto lo que me fiaron?"], c: ["crea el proveedor Gloria celular 987654321", "qué hay que comprar"] },
  rep: { q: ["¿Cómo veo mi ganancia?"], c: ["cuánto vendí hoy", "cuánto vendí esta semana"] },
  aj: { q: ["¿Cómo hago una copia de seguridad?", "¿Cómo creo un cajero con PIN?", "¿Cómo instalo la app?"], c: [] }
};
function helpChips() {
  const box = $("#helpChips"); if (!box) return;
  const s = HELP_CHIPS[ui.tab] || HELP_CHIPS.venta, list = (vozOk() ? s.c.map((t) => ({ t, c: 1 })) : []).concat(s.q.map((t) => ({ t })));
  const key = ui.tab + "|" + (vozOk() ? 1 : 0); if (box.dataset.k === key) return; box.dataset.k = key;
  box.innerHTML = list.slice(0, 5).map((x, i) => `<button type="button" class="hl-chip${x.c ? " cmd" : ""}" data-a="ayudaChip" data-q="${esc(x.t)}" style="--i:${i}">${x.c ? '<b aria-hidden="true">›_</b>' : ""}${esc(x.t)}</button>`).join("");
}
function helpStatus() {
  const online = cloudOn() && navigator.onLine !== false, ord = vozOk(), w = $("#helpWhere"), s = $("#helpStatus"), p = $("#helpChat");
  if (s) { s.classList.toggle("off", !online); s.lastChild.textContent = online ? (ord ? "En línea · listo para órdenes" : "En línea") : (ord ? "Sin internet · órdenes y pasos guardados" : "Sin internet · pasos guardados"); }
  if (w) { const t = helpScreen(); if (w.dataset.t !== t) { w.dataset.t = t; w.innerHTML = `<i aria-hidden="true"></i>Estás en <b>${esc(t)}</b>`; } }
  if (p && !p.hidden) helpChips();
}

/* ---------- sin internet: pasos guardados ---------- */
// k = pedazos de palabra (sin tildes) que delatan el tema; gana el que más coincide.
const HELP_KB = [
  { k: ["cobr", "yape", "plin", "vuelto", "tarjeta", "efectivo"], t: "Cobrar una venta", go: "venta", s: ["En Vender, agrega los productos al ticket.", "Toca Efectivo, Yape, Plin, Culqi o Tarjeta (atajos F2, F8, F10 y F9; Culqi con la tecla Q dentro del cobro).", "Si es efectivo, escribe con cuánto paga y verás el vuelto.", "Confirma y la venta queda guardada."] },
  { k: ["buscar", "escane", "codigo de barras", "agregar al ticket", "agrego un producto a la venta", "anotar un producto"], t: "Agregar productos al ticket", go: "venta", s: ["Escribe el nombre arriba (F3) o escanea el código de barras.", "Toca el producto para sumarlo.", "Cambia la cantidad con F6 y quita una línea con Supr."] },
  { k: ["producto nuevo", "crear producto", "crear un producto", "nuevo producto", "agregar producto", "registrar producto", "creo un producto"], t: "Crear un producto", go: "prod", s: ["Entra a Productos.", "Toca el botón para agregar un producto.", "Escribe nombre, precio, costo y stock.", "Guarda. Ya aparece en Vender."] },
  { k: ["cambiar precio", "cambiar el precio", "editar producto", "subir precio", "precio de un producto", "cambio el precio"], t: "Cambiar un precio", go: "prod", s: ["Entra a Productos.", "Toca el producto.", "Cambia el precio y guarda."] },
  { k: ["stock", "reponer", "se acaba", "agotad", "poco", "pedido"], t: "Ver qué falta y pedir al proveedor", go: "prod.low", s: ["En Productos abre «Por reponer».", "Verás lo que falta ordenado por proveedor.", "Toca el botón de WhatsApp de cada proveedor para mandarle el pedido."] },
  { k: ["venc", "caduc"], t: "Controlar vencimientos", go: "prod.exp", s: ["En la ficha del producto pon la fecha de vencimiento.", "En Productos abre «Por vencer» para ver lo que vence pronto."] },
  { k: ["mayor", "docena", "por cantidad", "mayorista"], t: "Precio por mayor", go: "prod", s: ["Abre el producto en Productos.", "Pon desde cuántas unidades y el precio por unidad.", "En la venta el precio baja solo cuando llegas a esa cantidad."] },
  { k: ["sin mover", "no se vende", "no vende", "estancad"], t: "Productos que no se mueven", go: "prod.idle", s: ["En Productos abre «Sin mover».", "Ahí están los productos que no se venden hace tiempo."] },
  { k: ["fiad", "credito", "cliente", "abono", "deben", "me debe"], t: "Vender fiado y cobrar abonos", go: "cli", s: ["Crea al cliente en Clientes.", "En la venta elige al cliente (F1) y cobra con Crédito.", "Cuando pague, abre al cliente y registra el abono."] },
  { k: ["recordar", "recordatorio", "avisar deuda", "cobrarle"], t: "Recordarle su deuda a un cliente", go: "cli", s: ["Entra a Clientes.", "Abre al cliente que debe.", "Manda el recordatorio por WhatsApp."] },
  { k: ["imprim", "whatsapp", "compartir ticket", "enviar ticket", "mandar ticket"], t: "Mandar o imprimir el ticket", go: "ventas", s: ["Entra a Ventas y abre la venta.", "Elige imprimir o enviarlo por WhatsApp."] },
  { k: ["boleta", "factura", "ruc", "dni", "sunat"], t: "Boleta y factura", go: "aj.comp", s: ["Para factura, elige un cliente con RUC válido (F1).", "Las boletas desde S/ 700 piden el DNI del cliente.", "Los datos de comprobantes están en Ajustes › Comprobantes."] },
  { k: ["anular", "devol", "me equivoque", "cancelar venta", "error en la venta"], t: "Anular o devolver una venta", go: "ventas", s: ["Entra a Ventas.", "Abre la venta equivocada.", "Elige anular o devolver. Necesitas permiso para hacerlo."] },
  { k: ["abrir caja", "cerrar caja", "cierro mi caja", "arqueo", "cierre", "turno", "contar"], t: "Abrir y cerrar la caja", go: "caja", s: ["En Caja toca «Abrir caja» y pon el sencillo inicial.", "Al terminar toca «Cerrar mi caja (arqueo)» y cuenta el dinero.", "Cierra con «Cerrar caja e imprimir»."] },
  { k: ["gasto", "retiro", "ingreso de dinero", "sale dinero", "saque plata"], t: "Anotar un gasto, ingreso o retiro", go: "caja", s: ["Entra a Caja.", "Toca Gasto, Ingreso de dinero o Retiro de dinero.", "Escribe el monto y el motivo, y guarda."] },
  { k: ["proveedor", "me fiaron", "debo a", "pago a", "pagar a", "abonar"], t: "Pagar a un proveedor", go: "prov", s: ["Entra a Proveedores y abre al proveedor.", "Toca «Pagar o abonar» (o «Pagar todo»).", "Para lo que te fiaron, toca «Anotar lo que me fiaron»."] },
  { k: ["report", "ganancia", "cuanto vendi", "resumen", "utilidad"], t: "Ver ventas y ganancia", go: "rep", s: ["Entra a Reportes y elige el periodo.", "Si tienes la voz activa, también puedes escribirme: «cuánto vendí hoy»."] },
  { k: ["balanza", "kilo", "peso", "gramos", "fruta", "verdura"], t: "Vender por peso", go: "venta", s: ["Pon el producto como «por kilo» en Productos.", "En Vender escribe el peso o usa la balanza si la conectaste.", "Configura la balanza en Ajustes › Balanza."] },
  { k: ["usuario", "pin", "cajero", "permiso", "clave"], t: "Cajeros y PIN", go: "aj.usuarios", s: ["Entra a Ajustes › Usuarios y permisos.", "Crea al cajero y elige qué puede hacer.", "Cada uno entra con su PIN. No compartas tu PIN."] },
  { k: ["respaldo", "copia", "nube", "otro equipo", "recuperar", "google"], t: "Copia de seguridad y nube", go: "aj.nube", s: ["Con internet, la nube copia tu caja sola (Ajustes › Nube).", "Para tener un archivo propio, usa Ajustes › Datos y respaldo.", "Para usarla en otro equipo, entra con la misma cuenta de Google."] },
  { k: ["sin internet", "offline", "no hay internet", "se cayo el internet", "wifi"], t: "Trabajar sin internet", go: "venta", s: ["La caja sigue vendiendo con sus datos guardados.", "La nube copia sola cuando vuelve el internet.", "La licencia se revisa con internet al menos cada 15 días."] },
  { k: ["voz", "micro", "hablar", "dictar", "dicta"], t: "Usar la voz", go: "venta", s: ["Toca el micrófono y di, por ejemplo, «anota dos leches».", "Aparece la tarjeta «Entendí». Si está bien, toca Aceptar.", "Si algo no está en tus productos, di el precio («anota un audífono de 14.50») y se anota como venta libre, sin crear el producto (solo con permiso).", "Es un extra: si no ves el micrófono, pídelo a tu proveedor."] },
  { k: ["instalar", "aplicacion", "programa", "escritorio", "icono"], t: "Instalar Caja Fácil", go: "aj.negocio", s: ["Entra a Ajustes › Negocio.", "Toca «Instalar Caja Fácil»."] },
  { k: ["licencia", "suspend", "bloquead", "activar", "vencio mi"], t: "Caja bloqueada o sin activar", go: "aj.nube", s: ["Entra con tu cuenta de Google en la pantalla de activación.", "Si dice suspendida, habla con el proveedor.", "Si pasaron 15 días sin internet, conéctate un momento para revisar la licencia."] },
  { k: ["fichas", "fotos", "pantalla de venta", "minimarket", "modo escaner"], t: "Cambiar la pantalla de venta", go: "aj.venta", s: ["Entra a Ajustes › Pantalla de venta.", "Elige «Escáner (minimarket)» o «Fichas con fotos»."] },
  { k: ["atajo", "tecla", "teclado", "f1", "f2"], t: "Teclas rápidas", go: "venta", s: ["F1 cliente · F3 buscar · F4 en espera · F6 cantidad.", "F2 efectivo · F8 Yape · F10 Plin · F9 tarjeta · F7 dividir pago.", "Supr quita la línea elegida."] },
  { k: ["preventa", "en espera", "guardar venta", "dejar pendiente"], t: "Dejar una venta en espera", go: "venta", s: ["En Vender toca «En espera» (F4) para guardar el ticket y atender a otro.", "O usa «Guardar preventa» y luego «Cobrar preventa»."] },
  { k: ["soporte", "contacto", "ayuda humana", "hablar con alguien"], t: "Hablar con una persona", go: "aj.nube", s: ["En Ajustes › Nube puedes darle permiso a soporte por 24 horas o 7 días.", "También puedes escribir por WhatsApp al 904 623 137."] }
];
function helpKB(text) {
  const n = " " + hn(text) + " ";
  let best = null, bs = 0;
  for (const e of HELP_KB) {
    const sc = e.k.reduce((t, k) => t + (n.includes(k.length < 4 ? " " + k + " " : k) ? 1 : 0), 0);
    if (sc > bs) { bs = sc; best = e; }
  }
  return best;
}
const helpKBText = (e) => `${e.t}:\n${e.s.map((x, i) => `${i + 1}. ${x}`).join("\n")}`;

/* ---------- el chat ---------- */
const helpReduced = () => document.documentElement.classList.contains("lite") || (window.matchMedia && matchMedia("(prefers-reduced-motion:reduce)").matches);
function helpType(el, text, done) {
  if (helpReduced() || text.length < 40) { el.textContent = text; return done(); }
  const parts = text.split(/(\s+)/), step = Math.max(2, Math.ceil(parts.length / 24)); let i = 0;
  const tick = () => {
    if (!el.isConnected) return done();
    i = Math.min(parts.length, i + step); el.textContent = parts.slice(0, i).join("");
    const l = $("#helpMessages"); if (l) l.scrollTop = l.scrollHeight;
    if (i >= parts.length) done(); else setTimeout(tick, 26);
  };
  tick();
}
function helpGoBtns(keys) {
  const ok = [...new Set(keys)].map((k) => [k, helpDest(k)]).filter((x) => x[1]).slice(0, 3);
  if (!ok.length) return null;
  const w = document.createElement("div"); w.className = "hl-go";
  w.innerHTML = ok.map(([k, d]) => `<button type="button" class="hl-gob" data-a="ayudaIr" data-k="${k}"><span>Ir a ${esc(d[2])}</span>${svg("next")}</button>`).join("");
  return w;
}
function helpAppend(role, text, o) {
  o = o || {};
  const list = $("#helpMessages"); if (!list) return null;
  const item = document.createElement("div");
  item.className = "help-message " + (role === "assistant" ? "assistant" : "user") + (o.temporary ? " temporary" : "");
  item.setAttribute("role", "listitem");
  const body = document.createElement("span"); body.className = "help-message-text"; item.appendChild(body);
  const extras = () => {
    [o.node, o.go && helpGoBtns(o.go)].forEach((n) => { if (n) item.appendChild(n); });
    list.scrollTop = list.scrollHeight;
  };
  list.appendChild(item);
  if (o.temporary) {
    body.innerHTML = '<span class="hl-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="hl-tt"></span>';
    body.lastChild.textContent = text;
  } else if (role === "assistant" && text && !o.instant) helpType(body, String(text), extras);
  else { body.textContent = String(text || ""); extras(); }
  if (!body.textContent && !o.temporary) body.remove();
  list.scrollTop = list.scrollHeight;
  return item;
}
function helpSay(text, o) { // respuesta de Luis que también queda en la conversación
  helpMessages.push({ role: "assistant", content: String(text).slice(0, 1200) });
  if (helpMessages.length > 10) helpMessages = helpMessages.slice(-10);
  return helpAppend("assistant", text, o);
}
function helpOpen() {
  const panel = $("#helpChat"), launch = $("#helpLauncher");
  if (!panel) return;
  panel.hidden = false;
  if (launch) launch.hidden = true;
  if (!helpMessages.length) {
    const hello = vozOk()
      ? "Hola, soy Luis. Pregúntame cómo se hace algo o dame una orden, por ejemplo «anota 2 leches» o «cuánto vendí hoy». Antes de tocar algo te pido que aceptes."
      : "Hola, soy Luis. Pregúntame cómo se hace algo en Caja Fácil y te llevo a la pantalla correcta. Tampoco cambio tus datos por mi cuenta.";
    helpMessages.push({ role: "assistant", content: hello });
    helpAppend("assistant", hello);
  }
  helpStatus(); clearInterval(helpTick); helpTick = setInterval(helpStatus, 1200);
  const input = $("#helpInput");
  if (input) setTimeout(() => input.focus(), 0);
}
function helpClose() {
  const panel = $("#helpChat"), launch = $("#helpLauncher");
  if (panel) panel.hidden = true;
  if (launch) launch.hidden = false;
  clearInterval(helpTick);
}
function helpError(status, code) {
  if (status === 401) return "Tu sesión venció. Vuelve a entrar con Google y prueba otra vez.";
  if (status === 403 || status === 429) return "El chat no está disponible ahora para esta cuenta o alcanzó su límite diario. Consulta al proveedor de Caja Fácil.";
  if (status === 503 || code === "sin_ia") return "El servicio de ayuda aún no está configurado. Consulta al proveedor de Caja Fácil.";
  return "";
}

/* ---------- órdenes escritas (mismo intérprete que la voz) ---------- */
const HELP_Q = /^(como|donde|por que|porque|para que|que es|que significa|que hago|que pasa|cuando|puedo|se puede|no puedo|no me|no funciona|no sale|no aparece|ayuda|explica|ensena|dime como|tengo un problema|me sale|me salio|me aparece|error)\b/;
function helpAnswerNode(rs) {
  const w = document.createElement("div"); w.className = "hl-ans";
  w.innerHTML = rs.map((r) => `<div class="hl-at">${esc(r.title)}</div>${r.big ? `<div class="hl-big num">${esc(r.big)}</div>` : ""}<p>${esc(r.w)}</p>${r.rows && r.rows.length ? `<div class="hl-rows">${r.rows.slice(0, 8).map(([l, v, f]) => `<div class="hl-row"><span>${esc(l)}</span><b class="num">${esc(v)}</b>${f != null && f !== false ? `<i style="transform:scaleX(${Math.max(.04, Math.min(1, +f || 0))})"></i>` : ""}</div>`).join("")}</div>` : ""}`).join("");
  return w;
}
function helpPlanCard(plan, texto) {
  const id = ++helpCardN, ok = plan.some((x) => x.ok), w = document.createElement("div");
  w.className = "hl-card"; helpCards[id] = { plan, texto };
  w.innerHTML = `${ok ? '<div class="hl-ch"><i aria-hidden="true"></i>Entendí</div>' : ""}
    <div class="hl-cl">${plan.map((x, i) => `<div class="hl-pl ${x.ok ? "" : "bad"}" style="--i:${i}"><span class="hl-pi">${svg(x.ok ? "check" : "close")}</span><span>${esc(x.rc ? `${x.rc.q} ${x.rc.n}` : x.txt)}${x.pick ? `<span class="hl-pick">${x.pick.map((pk, k) => `<button type="button" class="hl-b sec" data-a="ayudaPick" data-id="${id}" data-i="${i}" data-j="${k}">${esc(pk.label)}</button>`).join("")}</span>` : ""}</span></div>`).join("")}</div>
    ${ok ? `<div class="hl-cb"><button type="button" class="hl-b sec" data-a="ayudaNo" data-id="${id}">Cancelar</button><button type="button" class="hl-b" data-a="ayudaSi" data-id="${id}">Aceptar</button></div>` : ""}`;
  helpCards[id].el = w;
  return w;
}
// Devuelve true si el texto era una orden y ya se atendió.
function helpTryCommand(text) {
  if (!vozOk() || HELP_Q.test(hn(text))) return false;
  let acc, plan;
  try { acc = vzParse(text); if (!acc || !acc.length) return false; plan = vzPlan(acc); } catch (e) { return false; }
  if (!plan || !plan.length) return false;
  if (plan.every((x) => x.ok && x.ans)) {
    const rs = plan.map((x) => { try { return x.ans(); } catch (e) { return null; } }).filter(Boolean);
    if (!rs.length) return false;
    helpSay(rs.map((r) => `${r.title}: ${r.w}`).join(" "), { node: helpAnswerNode(rs), instant: true });
    return true;
  }
  helpSay(plan.some((x) => x.ok) ? "Esto es lo que entendí. ¿Lo hago?" : plan.some((x) => x.pick) ? "Elige uno:" : "No pude hacerlo:", { node: helpPlanCard(plan, text), instant: true });
  return true;
}
function helpNavIntent(n) {
  const m = n.match(/^(llevame|llevarme|vamos|ir|abre|abreme|abrir|muestrame|muestra|mostrar|quiero ir|quiero ver|anda)( a| al| a la| a los| a las| el| la| los| las| mi| mis)* (.+)$/);
  if (!m || m[3].split(" ").length > 6 || /\d|\bcon\b/.test(m[3])) return null;
  const hit = HELP_NAV.find(([k]) => (" " + m[3] + " ").includes(" " + k + " ") || (k.length > 5 && m[3].includes(k)));
  return hit ? hit[1] : null;
}

/* ---------- enviar ---------- */
async function helpSend(value) {
  const input = $("#helpInput"), textValue = String(value == null && input ? input.value : value || "").trim().slice(0, 1200);
  if (!textValue || helpBusy) return;
  if (input) input.value = "";
  helpAppend("user", textValue, { instant: true });
  helpMessages.push({ role: "user", content: textValue });
  const n = hn(textValue);
  // 1) «llévame a productos»: no hace falta IA
  const nav = helpNavIntent(n);
  if (nav && helpDest(nav)) { helpSay("Te llevo a " + HELP_DEST[nav][2] + ".", { go: [nav], instant: true }); setTimeout(() => helpGo(nav), 120); return; }
  // 2) órdenes
  if (helpTryCommand(textValue)) return;
  // 3) sin internet: pasos guardados
  if (!cloudOn() || navigator.onLine === false) {
    const kb = helpKB(textValue);
    if (kb) return void helpSay(helpKBText(kb), { go: [kb.go] });
    return void helpSay("Sin internet no puedo usar la IA, pero la caja sigue vendiendo." + (vozOk() ? " Aún puedo hacer órdenes como «anota 2 leches» o «cuánto vendí hoy»." : " Prueba con palabras como «cobrar», «caja» o «proveedor» y te muestro los pasos."));
  }
  // 4) la IA
  helpBusy = true; $("#helpChat").classList.add("busy");
  const send = $("#helpSend");
  if (send) send.disabled = true;
  const waiting = helpAppend("assistant", "Pensando…", { temporary: true });
  try {
    const session = cloudLoad(), token = await cloudToken();
    const r = await fetch(SB_URL + "/functions/v1/ayuda", {
      method: "POST",
      headers: { apikey: SB_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ neg: session.neg, mensajes: helpMessages.slice(-8), pantalla: helpScreen(), ordenes: vozOk() }),
      signal: AbortSignal.timeout(30000)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error("ayuda"), { status: r.status, code: data.error });
    let answer = String(data.respuesta || "").trim().slice(0, 2200);
    const go = [...answer.matchAll(/\[\[ir:([a-z.]+)\]\]/g)].map((x) => x[1]).filter((k) => HELP_DEST[k]);
    answer = answer.replace(/\[\[ir:[a-z.]*\]\]/g, "").replace(/\n{3,}/g, "\n\n").trim() || "No recibí una respuesta. Cuéntame qué pantalla estás usando y qué pasó.";
    if (waiting) waiting.remove();
    helpSay(answer, { go });
  } catch (e) {
    if (waiting) waiting.remove();
    const msg = helpError(e.status || 0, e.code || "");
    if (msg) helpSay(msg);
    else {
      const kb = helpKB(textValue);
      helpSay(kb ? "No pude conectar con la IA. Esto es lo que tengo guardado:\n" + helpKBText(kb) : "No pude conectar con la IA. Revisa tu conexión e inténtalo otra vez.", kb ? { go: [kb.go] } : {});
    }
  } finally {
    if (waiting) waiting.remove();
    helpBusy = false; $("#helpChat").classList.remove("busy");
    if (send) send.disabled = false;
    if (input) input.focus();
  }
}

/* ---------- «Pedir ayuda a Luis» cuando sale un aviso ---------- */
// Solo se manda el texto del aviso y el nombre de la pantalla, nada del negocio.
function helpToastAdd(t, msg) {
  helpLastErr = String(msg || "");
  const chat = $("#helpChat");
  if (!/\b(no|error|falta|fallo|sin|elige|revisa|invalid|incorrect|vencid|necesit|debes|solo)\b/i.test(hn(msg)) || (chat && !chat.hidden)) return;
  const b = document.createElement("button"); b.type = "button"; b.className = "tbtn"; b.dataset.a = "ayudaError"; b.textContent = "Pedir ayuda a Luis";
  t.appendChild(b);
}

const helpForm = $("#helpForm");
if (helpForm) helpForm.addEventListener("submit", (e) => { e.preventDefault(); helpSend(); });
const helpPanel = $("#helpChat");
if (helpPanel) helpPanel.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); helpClose(); const l = $("#helpLauncher"); if (l) l.focus(); } });
act({
  ayudaAbrir: helpOpen,
  ayudaCerrar: helpClose,
  ayudaChip: (el) => helpSend(el.dataset.q),
  ayudaIr: (el) => helpGo(el.dataset.k),
  ayudaError: () => { const e = helpLastErr; helpOpen(); if (e) helpSend("Me salió este aviso: «" + e.slice(0, 200) + "». ¿Qué hago?"); },
  ayudaSi: (el) => {
    const c = helpCards[el.dataset.id]; if (!c || c.done) return; c.done = true;
    const bar = c.el.querySelector(".hl-cb"); if (bar) bar.outerHTML = `<div class="hl-done">${svg("check")}Hecho</div>`;
    const abre = c.plan.some((x) => x.ok && x.run);
    vz = { plan: c.plan, texto: c.texto }; vozAccept();
    if (abre) { helpClose(); return; }
    helpSay(c.plan.some((x) => x.ok && x.add) ? "Listo, ya está en tu ticket." : "Listo.", { go: c.plan.some((x) => x.ok && x.add) ? ["venta"] : [], instant: true });
  },
  // «¿cuál?»: tocas el que quieres y la tarjeta se vuelve a armar con ese
  ayudaPick: (el) => {
    const c = helpCards[el.dataset.id]; if (!c || c.done) return;
    const i = +el.dataset.i, pk = c.plan[i] && c.plan[i].pick && c.plan[i].pick[+el.dataset.j]; if (!pk) return;
    c.plan[i] = vzPlan([pk.a], c.plan.filter((_, k) => k !== i))[0];
    c.done = true; c.el.replaceWith(helpPlanCard(c.plan, c.texto));
  },
  ayudaNo: (el) => {
    const c = helpCards[el.dataset.id]; if (!c || c.done) return; c.done = true;
    const bar = c.el.querySelector(".hl-cb"); if (bar) bar.outerHTML = `<div class="hl-done no">${svg("close")}Cancelado</div>`;
    helpSay("Cancelado. No cambié nada.", { instant: true });
  }
});
