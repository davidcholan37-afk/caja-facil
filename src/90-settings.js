/* ===================== 90 · AJUSTES: negocio, comprobantes, usuarios, balanza, tiendas y datos ===================== */
const ATABS = [["negocio", "Negocio"], ["comp", "Comprobantes"], ["cobros", "Cobros y puntos"], ["venta", "Pantalla de venta"], ["balanza", "Balanza"], ["usuarios", "Usuarios y permisos"], ["tiendas", "Tiendas"], ["nube", "Nube"], ["datos", "Datos y respaldo"], ["bitacora", "Bitácora"]];
const fld = (label, inner, hint) => `<label class="fld"><span>${label}</span>${inner}${hint ? `<small class="hint2">${hint}</small>` : ""}</label>`;
const inp = (key, val, o = {}) => `<input class="inp ${o.num ? "num" : ""}" data-set="${key}" value="${esc(val ?? "")}" ${o.num ? 'inputmode="decimal"' : ""} ${o.ph ? `placeholder="${esc(o.ph)}"` : ""} maxlength="${o.max || 80}">`;
const tog = (key, on, label, sub) => `<div class="set"><div><b>${label}</b>${sub ? `<small>${sub}</small>` : ""}</div><button class="switch" data-a="tog" data-k="${key}" aria-pressed="${!!on}" aria-label="${esc(label)}"></button></div>`;
const getK = (k) => k.split(".").reduce((o, x) => (o == null ? o : o[x]), DB);
function setK(k, v) { const p = k.split("."), last = p.pop(), o = p.reduce((a, x) => a[x], DB); o[last] = v; }
function dbSize() { try { return new Blob([JSON.stringify(DB)]).size; } catch (e) { return 0; } }
const kb = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");
VIEWS.aj = function viewSettings(v) {
  const t = ui.atab, C = DB.cfg, B = DB.biz;
  let body = "";
  if (t === "negocio") body = `${installHtml()}<div class="card"><h2>Datos del negocio</h2><p class="muted" style="margin-bottom:10px">Salen en los comprobantes y reportes.</p>
      ${fld("Nombre comercial", inp("biz.name", B.name, { max: 50 }))}
      <div class="two">${fld("RUC", inp("biz.ruc", B.ruc, { ph: "Opcional", max: 11 }))}${fld("Teléfono", inp("biz.phone", B.phone, { max: 20 }))}</div>
      ${fld("Dirección", inp("biz.addr", B.addr, { max: 100 }))}
      ${fld("Mensaje al pie del ticket", inp("biz.foot", B.foot, { max: 80 }))}
      <div class="two">${fld("Nombre de esta tienda o caja", inp("biz.store", B.store, { max: 40 }), "Para reportes entre tiendas")}${fld("Código de tienda", `<input class="inp" value="${esc(B.sid)}" disabled>`)}</div></div>`;
  else if (t === "comp") body = `<div class="card"><h2>Comprobantes</h2>
      ${tog("cfg.igvOn", C.igvOn, "Mis precios incluyen IGV", "Muestra op. gravada e IGV en boletas y facturas")}
      ${C.igvOn ? `<div class="two">${fld("Tasa de IGV (%)", inp("cfg.igv", C.igv, { num: true, max: 5 }), "18% general · 10.5% restaurantes MYPE")}${fld("Comprobante por defecto", `<select class="inp" data-set="cfg.docDef">${Object.entries(DOCS).map(([k, n]) => `<option value="${k}" ${C.docDef === k ? "selected" : ""}>${n}</option>`).join("")}</select>`)}</div>` : fld("Comprobante por defecto", `<select class="inp" data-set="cfg.docDef">${Object.entries(DOCS).map(([k, n]) => `<option value="${k}" ${C.docDef === k ? "selected" : ""}>${n}</option>`).join("")}</select>`)}
      <h3 class="h3">Series y numeración</h3><div class="tablewrap"><table class="tbl"><thead><tr><th>Comprobante</th><th>Serie</th><th>Último número</th></tr></thead><tbody>${Object.entries(DOCS).map(([k, n]) => `<tr><td>${n}</td><td><input class="inp sm" data-set="cfg.series.${k}.s" value="${esc(C.series[k].s)}" maxlength="4"></td><td><input class="inp sm num" data-set="cfg.series.${k}.n" value="${C.series[k].n}" inputmode="numeric" maxlength="8"></td></tr>`).join("")}</tbody></table></div>
      <p class="muted sm" style="margin-top:8px">Los comprobantes de Caja Fácil son de control interno. Para que una boleta o factura sea electrónica válida, emítela también en SUNAT (SEE-SOL) o con tu proveedor electrónico usando la misma serie y número.</p></div>
      <div class="card"><h2>Impresión</h2>${fld("Ancho de la ticketera", `<select class="inp" data-set="cfg.paper"><option value="80" ${+C.paper === 80 ? "selected" : ""}>80 mm</option><option value="58" ${+C.paper === 58 ? "selected" : ""}>58 mm</option></select>`)}
      ${tog("cfg.autoPrint", C.autoPrint, "Imprimir el ticket al cobrar", "Sin tener que tocar «Imprimir»")}
      <p class="muted sm">En Chrome puedes imprimir sin la ventana de impresión iniciándolo con la opción --kiosk-printing.</p></div>`;
  else if (t === "cobros") body = `<div class="card"><h2>Yape y Plin</h2><p class="muted" style="margin-bottom:10px">Tu número aparece en la pantalla de cobro para que el cliente pague sin preguntar.</p>
      <div class="two">${fld("Número de Yape", inp("cfg.yapeNum", C.yapeNum, { ph: "987 654 321", max: 15 }))}${fld("Número de Plin", inp("cfg.plinNum", C.plinNum, { ph: "Opcional", max: 15 }))}</div>
      ${fld("Nombre que le aparece al cliente", inp("cfg.payName", C.payName, { ph: "Ej: Minimarket Los Andes", max: 40 }))}</div>
      <div class="card"><h2>Programa de puntos</h2>${tog("cfg.pts.on", C.pts.on, "Dar puntos a clientes registrados", "Acumulan al comprar y los canjean como descuento")}
      ${C.pts.on ? `<div class="two">${fld("Puntos por cada S/ 1", inp("cfg.pts.per", C.pts.per, { num: true }))}${fld("Valor de 1 punto (S/)", inp("cfg.pts.val", C.pts.val, { num: true }), `100 puntos = ${money(100 * C.pts.val)}`)}</div>${fld("Puntos mínimos para canjear", inp("cfg.pts.min", C.pts.min, { num: true }))}` : ""}</div>`;
  else if (t === "venta") body = `<div class="card"><h2>Pantalla de venta</h2>
      ${fld("Cómo se ve la venta", `<div class="seg">${[["scan", "Escáner (minimarket)"], ["tiles", "Fichas con fotos"]].map(([k, n]) => `<button class="${(C.view === "tiles" ? "tiles" : "scan") === k ? "on" : ""}" data-a="setv" data-k="cfg.view" data-v="${k}">${n}</button>`).join("")}</div>`, "Escáner: sin fotos, muestra lo último que pasaste. Fichas: productos con foto para tocar")}
      ${fld("Tamaño de las fichas de productos", `<div class="seg">${[["s", "Pequeñas"], ["m", "Medianas"], ["l", "Grandes (táctil)"]].map(([k, n]) => `<button class="${C.tile === k ? "on" : ""}" data-a="setv" data-k="cfg.tile" data-v="${k}">${n}</button>`).join("")}</div>`)}
      ${fld("Mesas o cuentas abiertas", inp("cfg.tables", C.tables, { num: true, ph: "0 = no uso mesas", max: 3 }), "Para restaurantes, juguerías o cuentas que se van sumando")}
      ${tog("cfg.needShift", C.needShift, "Preguntar el sencillo antes del primer cobro", "Apagado: la caja se abre sola al primer cobro y el sencillo se anota después en Caja")}
      ${tog("cfg.negStock", C.negStock, "Permitir vender sin stock", "Si está apagado, avisa cuando no queda")}
      ${tog("cfg.mute", !C.mute, "Sonidos", "Pitido al agregar y cobrar")}
      ${fld("Bloquear tras minutos sin uso", inp("cfg.lock", C.lock, { num: true, max: 3 }), "0 = nunca. Solo si los usuarios tienen clave")}</div>
      <div class="card" style="margin-top:14px"><h2>Códigos de barras</h2><p class="muted">Con lector USB o Bluetooth no hay nada que configurar: escanea y el producto entra solo al ticket. Sin lector, toca <b>Cámara</b> en la pantalla de venta y apunta con el celular o la webcam.</p><p class="muted" style="margin-top:8px">Para que un producto se reconozca, escribe su código en Productos, en «Código rápido o de barras».</p></div>`;
  else if (t === "balanza") body = `<div class="card"><h2>Balanza USB o serial</h2><p class="muted" style="margin-bottom:10px">Con Chrome o Edge en la computadora, Caja Fácil lee el peso directo de la balanza. Si no tienes balanza conectada, igual puedes escribir los gramos al vender.</p>
      <div class="set"><div><b>${scaleState.on ? "Balanza conectada" : "Balanza sin conectar"}</b><small>${serialOk() ? "Tu navegador permite balanzas" : "Este navegador no permite balanzas USB"}</small></div><div class="row">${scaleState.on ? `<button class="btn sec sm" data-a="scaletest">Probar</button><button class="btn red sec sm" data-a="scaleoff">Desconectar</button>` : `<button class="btn sm" data-a="scaleconnect" ${serialOk() ? "" : "disabled"}>Conectar</button>`}</div></div>
      <div class="two">${fld("Velocidad (baudios)", `<select class="inp" data-set="cfg.scale.baud">${[1200, 2400, 4800, 9600, 19200, 38400].map((b) => `<option ${+C.scale.baud === b ? "selected" : ""}>${b}</option>`).join("")}</select>`, "Casi todas usan 9600")}${fld("Formato", `<select class="inp" data-set="cfg.scale.fmt">${["8N1", "7E1", "7O1", "8E1"].map((f) => `<option ${C.scale.fmt === f ? "selected" : ""}>${f}</option>`).join("")}</select>`)}</div>
      <div class="two">${fld("La balanza envía el peso", `<select class="inp" data-set="cfg.scale.cmd"><option value="" ${!C.scale.cmd ? "selected" : ""}>Sola, todo el tiempo</option><option value="W" ${C.scale.cmd === "W" ? "selected" : ""}>Cuando se le pide «W» (Toledo)</option><option value="ENQ" ${C.scale.cmd === "ENQ" ? "selected" : ""}>Cuando se le pide ENQ</option><option value="P" ${C.scale.cmd === "P" ? "selected" : ""}>Cuando se le pide «P»</option><option value="SI" ${C.scale.cmd === "SI" ? "selected" : ""}>Cuando se le pide «SI» (MT-SICS)</option></select>`)}${fld("Unidad", `<select class="inp" data-set="cfg.scale.unit"><option value="auto" ${C.scale.unit === "auto" ? "selected" : ""}>Detectar sola</option><option value="kg" ${C.scale.unit === "kg" ? "selected" : ""}>Kilos</option><option value="g" ${C.scale.unit === "g" ? "selected" : ""}>Gramos</option></select>`)}</div>
      <p class="muted sm">Si cambias la velocidad o el formato, desconecta y vuelve a conectar.</p></div>
      <div class="card"><h2>Etiquetas con código de barras</h2><p class="muted" style="margin-bottom:10px">Si tu balanza imprime etiquetas (código que empieza con 2), al escanearlas se agrega el producto con su peso.</p>
      ${tog("cfg.labels.on", C.labels.on, "Leer etiquetas de balanza")}
      <div class="two">${fld("Dígitos de prefijo", inp("cfg.labels.pre", C.labels.pre, { num: true, max: 1 }), "Normalmente 2 (ej: 20, 21…)")}${fld("Dígitos del código del producto", inp("cfg.labels.len", C.labels.len, { num: true, max: 1 }), "Normalmente 5")}</div>
      ${fld("La etiqueta trae", `<select class="inp" data-set="cfg.labels.kind"><option value="peso" ${C.labels.kind === "peso" ? "selected" : ""}>El peso en gramos</option><option value="precio" ${C.labels.kind === "precio" ? "selected" : ""}>El precio en céntimos</option></select>`)}
      <p class="muted sm">Ejemplo: 2000001002508 → producto con código 1, 250 g.</p></div>`;
  else if (t === "usuarios") body = `<div class="card"><div class="row sp"><h2>Usuarios</h2><button class="btn sm" data-a="unew">+ Usuario</button></div><p class="muted" style="margin-bottom:10px">Cada persona entra con su nombre y su clave. Así sabes quién vendió, anuló o cerró caja.</p>
      <div class="list">${DB.users.map((u) => `<button class="it" data-a="uedit" data-id="${u.id}"><span class="av" style="--h:${avHue(u)}">${esc(initials(u.name))}</span><div class="t"><b>${esc(u.name)}${u.id === ui.user ? " (tú)" : ""}</b><small>${esc(ROLE_LABEL[u.role])} · ${u.pin ? "con clave" : "sin clave"}${u.on ? "" : " · desactivado"}</small></div></button>`).join("")}</div>
      ${!DB.users.some((u) => u.pin && u.role === "admin") ? `<p class="warnbox">Ponle una clave al Administrador: sin ella cualquiera puede entrar como dueño y nadie puede autorizar operaciones delicadas.</p>` : ""}</div>
      <div class="card"><h2>Permisos por tipo de usuario</h2><p class="muted" style="margin-bottom:10px">El administrador siempre puede todo. Lo que un usuario no puede hacer, lo autoriza un supervisor con su clave en ese momento.</p>
      <div class="tablewrap"><table class="tbl perms"><thead><tr><th>Puede…</th>${["cajero", "vendedor"].map((r) => `<th class="c">${ROLE_LABEL[r].split(" ")[0]}</th>`).join("")}</tr></thead><tbody>${PERMS.map(([k, l]) => `<tr><td>${l}</td>${["cajero", "vendedor"].map((r) => `<td class="c"><input type="checkbox" data-perm="${r}:${k}" ${DB.roles[r].includes(k) ? "checked" : ""} aria-label="${esc(ROLE_LABEL[r] + ": " + l)}"></td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`;
  else if (t === "nube") body = cloudSettingsHtml();
  else if (t === "tiendas") { const st = Object.entries(DB.stores); body = `<div class="card"><h2>Varias tiendas</h2><p class="muted" style="margin-bottom:10px">Envía y recibe archivos entre tiendas (por WhatsApp, correo o USB). Esta tienda: <b>${esc(B.store)}</b> (${esc(B.sid)}).</p>
      <div class="acts3"><button class="btn sec" data-a="sendcat">Enviar catálogo<br><small>productos y precios</small></button><button class="btn sec" data-a="sendsales">Enviar ventas<br><small>a la tienda principal</small></button><label class="btn">Recibir archivo<br><small>catálogo, ventas o transferencia</small><input type="file" accept=".json,application/json" data-in="recvfile" hidden></label></div>
      <p class="muted sm" style="margin-top:10px">Las transferencias de stock se hacen desde Productos › Transferir.</p></div>
      <div class="card"><h2>Tiendas recibidas</h2>${st.length ? st.map(([sid, s]) => `<div class="kv"><span><b>${esc(s.name)}</b><small class="muted"> · ${(s.sales || []).length} ventas · hasta ${s.to ? dmy(s.to) : "—"} · recibido ${fmtDT(s.t)}</small></span><button class="link xs" data-a="storedel" data-id="${esc(sid)}">Quitar</button></div>`).join("") + `<p class="muted sm" style="margin-top:8px">Míralas juntas en Reportes › Todas las tiendas.</p>` : `<p class="muted">Aún no recibes ventas de otras tiendas.</p>`}</div>`; }
  else if (t === "datos") { const size = dbSize(); body = `<div class="card"><h2>Respaldo</h2><p class="muted" style="margin-bottom:10px">Tus datos viven en esta computadora (${kb(size)}). Descarga un respaldo seguido y guárdalo en tu correo o USB.<br><b>${C.lastBackup ? "Último respaldo: " + fmtDT(C.lastBackup) : "Aún no descargas ningún respaldo."}</b></p>
      <div class="two"><button class="btn" data-a="backup">Descargar respaldo</button><label class="btn sec">Restaurar respaldo<input type="file" accept="application/json,.json" data-in="restore" hidden></label></div></div>
      <div class="card"><h2>Organizar la base de datos</h2><p class="muted" style="margin-bottom:10px">${DB.sales.length} ventas · ${DB.products.length} productos · ${DB.clients.length} clientes · ${DB.kx.length} movimientos de stock.</p>
      <div class="two"><button class="btn sec" data-a="dbcheck">Revisar y reparar</button><button class="btn sec" data-a="archive">Archivar ventas antiguas</button></div>
      ${(DB.archive || []).length ? `<p class="muted sm" style="margin-top:8px">Meses archivados: ${DB.archive.map((a) => esc(monthName(a.m))).join(", ")}</p>` : ""}</div>
      <div class="card"><h2>Zona de cuidado</h2><div class="two"><button class="btn sec" data-a="sample">Cargar ejemplos</button><button class="btn red sec" data-a="reset">Borrar todo</button></div></div>
      <p class="muted sm">Imágenes de productos: Fluent Emoji de Microsoft (licencia MIT).</p>`; }
  else if (t === "bitacora") { const q = norm(ui.lq || ""), l = DB.log.filter((x) => !q || norm(x.a + " " + x.x + " " + x.u).includes(q)).slice().reverse().slice(0, 300); body = `<div class="card"><div class="row sp wrap"><h2>Bitácora de seguridad</h2><button class="btn sec sm" data-a="logcsv">Exportar</button></div><p class="muted" style="margin-bottom:10px">Quién entró, anuló, devolvió, cambió precios, cerró caja o autorizó algo.</p>
      <input class="inp" id="lq" type="search" placeholder="Buscar" value="${esc(ui.lq || "")}" style="margin-bottom:10px">
      ${l.length ? `<div class="tablewrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>${l.map((x) => `<tr><td>${fmtDT(x.t)}</td><td>${esc(x.u)}</td><td>${esc(x.a)}</td><td>${esc(x.x)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">Sin registros.</p>`}</div>`; }
  v.innerHTML = `<div class="ph"><h1>Ajustes</h1></div><div class="aj"><nav class="ajnav">${ATABS.map(([k, n]) => `<button class="${t === k ? "on" : ""}" data-a="atab" data-t="${k}">${n}</button>`).join("")}</nav><div class="stack">${body}</div></div>`;
};
function openUser(id) {
  const u = id ? usr(id) : { name: "", role: "cajero", on: true, pin: "" };
  ui.ue = { id, role: u.role };
  openModal(`<h2>${id ? "Editar usuario" : "Nuevo usuario"}</h2>
    <label class="fld"><span>Nombre</span><input class="inp" id="un" value="${esc(u.name)}" maxlength="30" autofocus autocomplete="off"></label>
    <label class="fld"><span>Tipo</span><select class="inp" id="ur" ${id && id === ui.user ? "disabled" : ""}>${Object.entries(ROLE_LABEL).map(([k, n]) => `<option value="${k}" ${u.role === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>
    ${id ? `<div class="set"><div><b>Clave</b><small>${u.pin ? "Tiene clave de 4 dígitos" : "Sin clave"}</small></div><div class="row"><button class="btn sec sm" data-a="upin" data-id="${id}">${u.pin ? "Cambiar" : "Poner clave"}</button>${u.pin ? `<button class="btn red sec sm" data-a="upinoff" data-id="${id}">Quitar</button>` : ""}</div></div>
      ${id !== ui.user ? `<label class="ck"><input type="checkbox" id="uon" ${u.on ? "checked" : ""}> Puede entrar al sistema</label>` : ""}` : `<p class="muted">Después de guardar le pondrás su clave.</p>`}
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" data-enter data-a="usave">Guardar</button></div>
    ${id && id !== ui.user && id !== "u1" ? `<button class="link" data-a="udel" data-id="${id}" style="width:100%;color:var(--red)">Eliminar usuario</button>` : ""}`);
}
/* ---------- archivos entre tiendas ---------- */
function sendCatalog() {
  const pack = { cf: "caja-facil", kind: "catalog", id: "CAT-" + uid().toUpperCase(), t: Date.now(), from: { sid: DB.biz.sid, name: DB.biz.store }, products: DB.products.map((p) => ({ name: p.name, code: p.code, price: p.price, cost: p.cost || 0, cat: p.cat || "", unit: p.unit, min: p.min || 0, igv: p.igv !== false, pres: p.pres || [], img: p.img && p.img.startsWith("lib:") ? p.img : "" })) };
  download(`catalogo-${DB.biz.sid}-${dkey()}.json`, JSON.stringify(pack), "application/json"); log("Catálogo enviado", `${pack.products.length} productos`); toast("Catálogo descargado: envíalo a la otra tienda");
}
function sendSales() {
  promptBox({ title: "Enviar ventas", text: "¿Desde qué fecha? Se envían las ventas de esta tienda hasta hoy.", label: "Desde (AAAA-MM-DD)", value: DB.cfg.lastSent || dkey().slice(0, 8) + "01", ok: "Descargar archivo" }, (from) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return toast("Fecha no válida");
    const to = dkey(), list = repSales(from, to, "local").map((s) => ({ id: s.id, date: s.date, t: s.t, total: s.total, ret: s.ret, pays: s.pays, items: s.items.map((i) => ({ name: i.name, qty: i.qty, price: i.price, cost: i.cost, cat: i.cat, unit: i.unit })), user: s.user, doc: s.doc, igv: s.igv, gravada: s.gravada, void: s.void }));
    const pack = { cf: "caja-facil", kind: "sales", id: "VEN-" + uid().toUpperCase(), t: Date.now(), from: { sid: DB.biz.sid, name: DB.biz.store }, range: [from, to], sales: list };
    DB.cfg.lastSent = to; save(); download(`ventas-${DB.biz.sid}-${from}-a-${to}.json`, JSON.stringify(pack), "application/json"); log("Ventas enviadas", `${list.length} ventas ${from} a ${to}`); toast("Archivo de ventas descargado");
  });
}
function receivePack(o) {
  if (!o || typeof o !== "object") return toast("Ese archivo no es de Caja Fácil");
  if (o.cf !== "caja-facil") {
    if (Array.isArray(o.products) && Array.isArray(o.sales)) return confirmBox("Es un respaldo completo. ¿Restaurarlo? Reemplaza todos los datos actuales.", "Restaurar", () => restoreDB(o), true);
    return toast("Ese archivo no es de Caja Fácil");
  }
  if (o.from && o.from.sid === DB.biz.sid && o.kind !== "catalog") return toast("Ese archivo salió de esta misma tienda");
  if (o.kind === "transfer") {
    if (DB.recv.includes(o.id)) return toast("Esa transferencia ya fue recibida antes", true);
    const rows = o.items.map((x) => ({ x, p: DB.products.find((p) => (x.code && p.code === x.code) || norm(p.name) === norm(x.name)) }));
    openModal(`<h2>Recibir transferencia</h2><p class="muted" style="margin-bottom:10px">De <b>${esc(o.from.name)}</b> · ${fmtDT(o.t)}</p><div class="list">${rows.map(({ x, p }) => `<div class="it sm"><div class="t"><b>${esc(x.name)}</b><small>${p ? `Stock actual ${p.stock == null ? "sin control" : fmtQ(p.stock)}` : "Producto nuevo: se creará"}</small></div><div class="v num">+${fmtQ(x.qty)}${x.unit === "kg" ? " kg" : ""}</div></div>`).join("")}</div>
      <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" id="trok">Recibir y sumar al stock</button></div>`, "wide");
    $("#trok").onclick = (e) => {
      e.stopPropagation();
      rows.forEach(({ x, p }) => {
        if (!p) { p = { id: uid(), name: x.name, code: x.code || "", price: x.price, cost: x.cost, cat: x.cat, unit: x.unit === "kg" ? "kg" : "u", stock: 0, min: 0, pres: [], recipe: [], igv: true, img: "" }; if (p.code && DB.products.some((y) => y.code === p.code)) p.code = ""; DB.products.push(p); }
        if (p.stock == null) p.stock = 0;
        stockAdd(p, x.qty, "trf_in", `De ${o.from.name} · ${o.id}`);
      });
      DB.recv.push(o.id); log("Transferencia recibida", `${o.id} de ${o.from.name}`); save(); closeModal(); toast("Transferencia recibida"); render();
    };
    return;
  }
  if (o.kind === "catalog") {
    let nw = 0, up = 0;
    o.products.forEach((x) => {
      const p = DB.products.find((y) => (x.code && y.code === x.code) || norm(y.name) === norm(x.name));
      if (p) { Object.assign(p, { name: x.name, price: x.price, cost: x.cost, cat: x.cat, unit: x.unit, igv: x.igv, pres: x.pres || [] }); if (x.img) p.img = x.img; up++; }
      else { if (x.code && DB.products.some((y) => y.code === x.code)) return; DB.products.push({ id: uid(), name: x.name, code: x.code, price: x.price, cost: x.cost, cat: x.cat, unit: x.unit, igv: x.igv, pres: x.pres || [], recipe: [], stock: null, min: x.min || 0, img: x.img || "" }); nw++; }
    });
    log("Catálogo recibido", `De ${o.from.name}: ${nw} nuevos, ${up} actualizados`); save(); toast(`Catálogo recibido: ${nw} nuevos, ${up} actualizados`, true); render(); return;
  }
  if (o.kind === "sales") {
    const st = DB.stores[o.from.sid] || (DB.stores[o.from.sid] = { name: o.from.name, sales: [] });
    st.name = o.from.name; st.t = Date.now();
    const ids = new Set(o.sales.map((s) => s.id)); st.sales = st.sales.filter((s) => !ids.has(s.id)).concat(o.sales);
    st.from = st.sales.reduce((a, s) => (!a || s.date < a ? s.date : a), ""); st.to = st.sales.reduce((a, s) => (s.date > a ? s.date : a), "");
    log("Ventas recibidas", `${o.from.name}: ${o.sales.length} ventas`); save(); toast(`Recibidas ${o.sales.length} ventas de ${o.from.name}`, true); render(); return;
  }
  toast("No reconozco ese archivo");
}
function restoreDB(o) { DB = normalize(o); ui.user = DB.users[0].id; saveAll(); log("Respaldo restaurado", ""); toast("Respaldo restaurado"); if (needLogin()) loginScreen(); else go("venta"); }
function dbCheck() {
  const fixes = [];
  const seen = new Map();
  DB.products.forEach((p) => { if (p.code) { if (seen.has(p.code)) { fixes.push(`Código ${p.code} repetido en «${p.name}»: se quitó`); p.code = ""; } else seen.set(p.code, p); } if (!(p.price > 0)) fixes.push(`«${p.name}» no tiene precio`); if (p.stock != null && p.stock < 0) fixes.push(`«${p.name}» tiene stock negativo (${fmtQ(p.stock)})`); p.recipe = (p.recipe || []).filter((r) => prod(r.id)); });
  DB.tickets.forEach((t) => { const n = t.items.length; t.items = t.items.filter((i) => i.quick || resolveLine(i)); if (t.items.length < n) fixes.push("Se quitaron productos borrados de un ticket en espera"); if (t.client && !cli(t.client)) t.client = ""; });
  const open = DB.shifts.filter((s) => !s.t1 && s.d0 < addD(dkey(), -2)); if (open.length) fixes.push(`${open.length} caja(s) siguen abiertas desde hace días: ciérralas en Caja`);
  saveAll(); log("Revisión de base de datos", fixes.length + " observaciones");
  openModal(`<h2>Revisión terminada</h2>${fixes.length ? `<ul class="ul">${fixes.slice(0, 30).map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : `<p>Todo está en orden.</p>`}<div class="btns"><button class="btn" data-a="close">Listo</button></div>`);
}
function archiveUI() {
  const months = allMonths().filter((m) => m < mOf()).filter((m) => DB.sales.some((s) => mOf(s.date) === m));
  if (!months.length) return toast("No hay meses anteriores para archivar");
  openModal(`<h2>Archivar ventas antiguas</h2><p class="muted" style="margin-bottom:12px">Descarga las ventas y movimientos hasta el mes que elijas y los quita de esta computadora para que todo vaya más rápido. En reportes queda el total de cada mes archivado.</p>
    <label class="fld"><span>Archivar hasta (incluido)</span><select class="inp" id="armon">${months.map((m) => `<option value="${m}">${monthName(m)}</option>`).join("")}</select></label>
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" data-a="archiveok">Descargar y archivar</button></div>`);
}
act({
  atab: (el) => { ui.atab = el.dataset.t; render(); },
  tog: (el) => { const k = el.dataset.k, v = !getK(k); setK(k, k === "cfg.mute" ? !DB.cfg.mute : v); save(); render(); },
  setv: (el) => { setK(el.dataset.k, el.dataset.v); save(); render(); },
  unew: () => openUser(""),
  uedit: (el) => openUser(el.dataset.id),
  usave: () => {
    const name = $("#un").value.trim(); if (!name) return toast("Escribe el nombre");
    const id = ui.ue.id, role = $("#ur").value;
    if (DB.users.some((u) => u.id !== id && norm(u.name) === norm(name))) return toast("Ya hay un usuario con ese nombre");
    if (id) {
      const u = usr(id); if (u.role === "admin" && role !== "admin" && DB.users.filter((x) => x.role === "admin" && x.on).length < 2) return toast("Debe quedar al menos un administrador");
      u.name = name; u.role = role; const on = $("#uon"); if (on) u.on = on.checked; log("Usuario editado", name); save(); closeModal(); render();
    } else {
      const u = { id: "u" + uid(), name, role, pin: "", on: true }; DB.users.push(u); log("Usuario creado", `${name} (${ROLE_LABEL[role]})`); save(); closeModal(); render();
      setPinFor(u, () => render());
    }
  },
  upin: (el) => { const u = usr(el.dataset.id); closeModal(); setPinFor(u, () => render()); },
  upinoff: (el) => { const u = usr(el.dataset.id); u.pin = ""; log("Clave quitada", u.name); save(); closeModal(); toast("Clave quitada"); render(); },
  udel: (el) => { const u = usr(el.dataset.id); confirmBox(`¿Eliminar a ${u.name}?`, "Eliminar", () => { DB.users = DB.users.filter((x) => x !== u); log("Usuario eliminado", u.name); save(); render(); }, true, "Sus ventas pasadas conservan su nombre."); },
  sendcat: sendCatalog,
  sendsales: sendSales,
  storedel: (el) => confirmBox("¿Quitar las ventas de esa tienda?", "Quitar", () => { delete DB.stores[el.dataset.id]; save(); render(); }),
  backup: () => { DB.cfg.lastBackup = Date.now(); save(); download(`respaldo-caja-facil-${dkey()}.json`, JSON.stringify(DB), "application/json"); log("Respaldo descargado", ""); toast("Respaldo descargado"); render(); },
  reset: () => need("ajustes", () => confirmBox("¿Borrar TODOS los datos? Esto no se puede deshacer.", "Borrar todo", () => { DB = normalize(null); ui.user = DB.users[0].id; saveAll(); toast("Datos borrados"); go("venta"); }, true, "Descarga un respaldo antes si tienes dudas.")),
  dbcheck: dbCheck,
  archive: archiveUI,
  archiveok: () => {
    const m = $("#armon").value, pick = (k) => DB[k].filter((x) => mOf(BIG[k](x)) <= m);
    const pack = { cf: "caja-facil", kind: "archive", upto: m, t: Date.now(), store: DB.biz.store, sales: pick("sales"), moves: pick("moves"), kx: pick("kx"), log: pick("log") };
    download(`archivo-caja-facil-hasta-${m}.json`, JSON.stringify(pack), "application/json");
    const sum = {}; pack.sales.forEach((s) => { const k = mOf(s.date), o = sum[k] || (sum[k] = { m: k, n: 0, total: 0 }); if (!s.void) { o.n++; o.total = r2(o.total + s.total); } });
    DB.archive = (DB.archive || []).concat(Object.values(sum));
    Object.keys(BIG).forEach((k) => { DB[k] = DB[k].filter((x) => mOf(BIG[k](x)) > m); });
    saveAll(); closeModal(); log("Ventas archivadas", "hasta " + monthName(m)); toast(`Archivado hasta ${monthName(m)}. Guarda bien el archivo descargado.`, true); render();
  },
  logcsv: () => csvOut([["fecha", "usuario", "accion", "detalle"], ...DB.log.map((x) => [fmtDT(x.t), x.u, x.a, x.x])], `bitacora-${dkey()}.csv`)
});
