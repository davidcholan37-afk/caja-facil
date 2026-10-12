/* ===================== 69 · VOZ: «anota un yogurt», «paga 50 a Gloria» ===================== */
// Gratis y sin claves. Dos oídos: con internet usa el de Chrome (mejor); sin internet usa Vosk (modelo en español de 34 MB
// que se instala una vez). El mismo intérprete local entiende las frases con TUS productos, clientes y proveedores.
// Siempre sale la tarjeta «Entendí» y nada se anota, cobra ni paga sin tu Aceptar.
const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const vozOk = () => cloudOn() && !!cloudLoad().voz;
const vzElectron = typeof navigator !== "undefined" && /Electron/i.test(navigator.userAgent); // el programa de Windows no trae el oído de Chrome
const VZ_CACHE = "cf-voz-1", VZ_FILES = ["voz/vosk.js", "voz/recognizer-processor.js", "voz/model-es.tar.gz"];
const vzInstalled = () => { try { return localStorage.getItem("cf-voz-off") === "1"; } catch (e) { return false; } };
let vz = null; // sesión de voz en curso: { eng, rec, ac, ms, fin: [], part: "", texto, plan }

function stopVoz() {
  const s = vz; vz = null; if (!s) return;
  try { if (s.rec && s.eng === "web") { s.rec.onresult = s.rec.onend = s.rec.onerror = null; s.rec.abort(); } } catch (e) {}
  vzCleanVosk(s);
}
function vzCleanVosk(s) {
  try { clearTimeout(s.endT); clearTimeout(s.max); if (s.vrec) s.vrec.remove(); } catch (e) {}
  try { if (s.ms) s.ms.getTracks().forEach((t) => t.stop()); } catch (e) {}
  try { if (s.ac && s.ac.state !== "closed") s.ac.close(); } catch (e) {}
  if (s.eng === "vosk") vzIdle();
}

/* ---------- intérprete en español (sin IA, sin internet) ---------- */
const VZ_N = { cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500 };
const VZ_ANOTA = new Set(["anota", "anotame", "agrega", "agregame", "pon", "ponme", "anade", "anademe", "suma", "apunta", "apuntame", "dame", "registra", "cobra"]);
const VZ_PAGA = new Set(["paga", "pagale", "pagar", "pagame", "abona", "abonale", "abonar", "cancela"]);
const VZ_FIA = new Set(["fia", "fiale", "fiar", "fiado", "fiame", "credito"]);
const VZ_MEDIOS = new Set(["efectivo", "yape", "plin", "transferencia"]);
const vzIsNum = (t) => /^\d+([.,]\d+)?$/.test(t) || t in VZ_N;
const vzIsQty = (t) => vzIsNum(t) || /^(medio|media|cuarto|cuartos|kilo|kilos|kg|kilogramo|kilogramos|gramo|gramos|gr|sol|soles)$/.test(t);
const vzNumVal = (t) => (t in VZ_N ? VZ_N[t] : parseFloat(t.replace(",", ".")));
// «un kilo y medio» → 1.5 kg · «tres cuartos» → 0.75 kg · «dos soles» → monto 2
function vzQty(toks) {
  let val = 0, prevNum = 0, kg = false, sol = false, any = false;
  toks.forEach((t) => {
    if (vzIsNum(t)) { const n = vzNumVal(t); val += n; prevNum = n; any = true; return; }
    const wasNum = prevNum; prevNum = 0;
    if (/^(kilo|kilos|kg|kilogramo|kilogramos)$/.test(t)) { kg = true; if (!val) val = 1; }
    else if (/^(gramo|gramos|gr)$/.test(t)) { kg = true; val = val / 1000; }
    else if (/^(medio|media)$/.test(t)) { val += 0.5; any = true; }
    else if (/^(cuarto|cuartos)$/.test(t)) { kg = true; any = true; val = wasNum ? val - wasNum + wasNum * 0.25 : val + 0.25; }
    else if (/^(sol|soles)$/.test(t)) sol = true;
  });
  if (!any && !kg && !sol) return null;
  return { val: r3(val), kg, sol };
}
function vzTokens(text) {
  return norm(text).replace(/[¿?¡!.,;:]/g, " ").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean)
    .flatMap((t) => (/^\d+$/.test(t) || !/\d/.test(t) ? [t] : [t])); // (los números con coma ya llegaron como "2 5": se ignoran)
}
// Nombre = lo que sigue a «a/al» hasta el primer número o palabra de pago.
function vzNameAfterA(toks) {
  const i = toks.findIndex((t) => t === "a" || t === "al" || t === "para");
  const src = i >= 0 ? toks.slice(i + 1) : toks.filter((t) => !vzIsQty(t) && !VZ_MEDIOS.has(t));
  const out = []; for (const t of src) { if (vzIsQty(t) || ["por", "en", "con", "de", "del", "soles", "sol"].includes(t) || VZ_MEDIOS.has(t)) { if (out.length) break; else continue; } out.push(t); }
  return out.join(" ");
}
function vzMoney(toks) { const q = vzQty(toks.filter((t) => vzIsQty(t) && !/^(medio|media|cuarto|cuartos|kilo|kilos|kg|gramo|gramos|gr)$/.test(t) || t === "medio")); return q && q.val > 0 ? q.val : 0; }
function vzParse(text) {
  const toks = vzTokens(text), out = [];
  if (!toks.length) return out;
  if (toks.includes("cuanto") && toks.some((t) => /^vend/.test(t)) || (toks.includes("ventas") && toks.includes("hoy")) || toks.join(" ").includes("resumen del dia")) return [{ tipo: "consulta", consulta: "ventas_hoy" }];
  // cortar en órdenes: cada verbo abre una
  const kind = (t) => (VZ_PAGA.has(t) ? "pagar" : VZ_FIA.has(t) ? "fiar" : VZ_ANOTA.has(t) ? "anotar" : "");
  const cuts = []; toks.forEach((t, i) => { if (kind(t)) cuts.push(i); });
  if (!cuts.length) cuts.push(-1); // sin verbo: solo vale si empieza con cantidad («un yogurt»)
  cuts.forEach((c, n) => {
    const seg = toks.slice(c + 1, n + 1 < cuts.length ? cuts[n + 1] : toks.length), k = c >= 0 ? kind(toks[c]) : "anotar";
    // «anota fiado a rosa 10 soles» es un fiado
    if (k === "anotar" && seg[0] && VZ_FIA.has(seg[0])) return out.push(...vzParseFia(seg.slice(1)));
    if (k === "fiar") return out.push(...vzParseFia(seg));
    if (k === "pagar") { const nombre = vzNameAfterA(seg), monto = vzMoney(seg), medio = seg.find((t) => VZ_MEDIOS.has(t)); return nombre && out.push({ tipo: "pagar_proveedor", nombre, ...(monto ? { monto } : {}), ...(medio ? { medio } : {}) }); }
    if (c < 0 && !(seg[0] && vzIsQty(seg[0]))) return;
    // anotar: partir en productos cuando aparece una cantidad nueva o «y/con/más»
    let cur = { q: [], n: [] }; const items = [];
    const push = () => { if (cur.n.length) items.push(cur); cur = { q: [], n: [] }; };
    seg.forEach((t, i) => {
      if (vzIsQty(t)) { if (cur.n.length) push(); cur.q.push(t); }
      else if (["y", "e", "mas", "con", "tambien"].includes(t)) { if (cur.n.length) push(); }
      else if ((t === "de" || t === "del") && !cur.n.length) { /* «un cuarto DE arroz» */ }
      else cur.n.push(t);
    });
    push();
    items.forEach((it) => {
      const q = vzQty(it.q), nombre = it.n.join(" ");
      if (!nombre) return;
      const a = { tipo: "anotar", nombre };
      if (q && q.sol && q.val > 0) a.monto = q.val; else if (q && q.val > 0) { a.cantidad = q.val; a.unidad = q.kg ? "kg" : "unid"; }
      out.push(a);
    });
  });
  return out;
}
function vzParseFia(seg) {
  const nombre = vzNameAfterA(seg), monto = vzMoney(seg);
  return nombre ? [{ tipo: "fiado", nombre, ...(monto ? { monto } : {}) }] : [];
}

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
      if (kg && !a.cantidad && !a.monto) return { ok: false, txt: `${p.name}: dime cuánto pesa (por ejemplo «un cuarto»)` };
      if (!kg && a.unidad === "kg") return { ok: false, txt: `${p.name} se vende por unidad, no por peso` };
      if (!kg && a.monto && !a.cantidad) return { ok: false, txt: `${p.name}: dime cuántas unidades, no los soles` };
      if (kg && a.unidad === "unid" && !a.monto) return { ok: false, txt: `${p.name}: dime cuánto pesa (por ejemplo «un kilo» o «medio kilo»)` };
      if (kg && !a.cantidad && a.monto) { if (!(p.price > 0)) return { ok: false, txt: `${p.name}: dime cuánto pesa` }; a.cantidad = r3(a.monto / p.price); }
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

/* ---------- oído sin internet (Vosk): se instala una vez y queda en el equipo ---------- */
let vzModelP = null, vzIdleT = 0, vzBlobs = null;
async function vzCache() { return await caches.open(VZ_CACHE); }
// Baja los 3 archivos a la memoria del navegador. cb(0..1) para la barra.
async function vzInstall(cb) {
  const cache = await vzCache(), sizes = [5.8e6, 3e3, 34.5e6], tot = sizes.reduce((a, b) => a + b, 0); let done = 0;
  for (let i = 0; i < VZ_FILES.length; i++) {
    if (await cache.match(VZ_FILES[i])) { done += sizes[i]; cb && cb(done / tot); continue; }
    const r = await fetch(VZ_FILES[i], { cache: "no-store" }); if (!r.ok || !r.body) throw new Error("http " + r.status);
    const rd = r.body.getReader(), parts = []; let got = 0;
    for (;;) { const { done: d, value } = await rd.read(); if (d) break; parts.push(value); got += value.length; cb && cb((done + got) / tot); }
    await cache.put(VZ_FILES[i], new Response(new Blob(parts), { headers: { "Content-Type": i === 0 || i === 1 ? "text/javascript" : "application/gzip" } }));
    done += sizes[i];
  }
  try { localStorage.setItem("cf-voz-off", "1"); } catch (e) {}
}
async function vzGetBlobs() {
  if (vzBlobs) return vzBlobs;
  const cache = await vzCache(), out = [];
  for (const f of VZ_FILES) { const r = await cache.match(f); if (!r) throw new Error("falta " + f); out.push(URL.createObjectURL(await r.blob())); }
  return (vzBlobs = { vosk: out[0], proc: out[1], model: out[2] });
}
function vzGetModel() {
  clearTimeout(vzIdleT);
  if (!vzModelP) vzModelP = (async () => {
    const b = await vzGetBlobs();
    if (!window.Vosk) await new Promise((ok, no) => { const sc = document.createElement("script"); sc.src = b.vosk; sc.onload = ok; sc.onerror = () => no(new Error("vosk")); document.head.appendChild(sc); });
    const model = await window.Vosk.createModel(b.model);
    return model;
  })().catch((e) => { vzModelP = null; throw e; });
  return vzModelP;
}
// Pasado un rato sin usar la voz, se libera la memoria (~150 MB).
function vzIdle() { clearTimeout(vzIdleT); vzIdleT = setTimeout(() => { const p = vzModelP; vzModelP = null; if (p) p.then((m) => m.terminate()).catch(() => {}); }, 120000); }
// Lista corta de palabras: tus productos, clientes y proveedores + números y órdenes. Así el oído se equivoca mucho menos.
function vzGrammar() {
  const w = new Set("anota anótame agrega agrégame pon ponme añade añádeme suma apunta apúntame dame registra paga págale pagar abona abónale fía fíale fiado crédito cuánto cuanto vendí vendido vendimos ventas hoy resumen del día de la el un una uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciséis diecisiete dieciocho diecinueve veinte veintiún veintiuno veintidós veintitrés veinticuatro veinticinco treinta cuarenta cincuenta sesenta setenta ochenta noventa cien ciento doscientos trescientos cuatrocientos quinientos medio media cuarto cuartos kilo kilos gramos soles sol y a al por con más también yape plin efectivo transferencia para".split(" "));
  const add = (n) => String(n || "").toLowerCase().split(/[^a-záéíóúüñ]+/).forEach((x) => { if (x.length > 1) w.add(x); });
  DB.products.filter((p) => p.on !== false).forEach((p) => add(p.name)); DB.clients.forEach((c) => add(c.name)); DB.supp.forEach((c) => add(c.name));
  return [...w, "[unk]"];
}

/* ---------- pantallas: escuchando, entendí, errores ---------- */
function vzShow(html) { openModal(html); ui.mk = "voz"; }
const vzListenHtml = (txt) => `<div class="vzbox" role="status"><div class="vzmic">${svg("mic")}</div><h2>Te escucho…</h2><p class="vzt" id="vzt" aria-live="polite">${txt}</p>
  <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" data-a="vozstop">Listo</button></div></div>`;
const VZ_EJ = "Di, por ejemplo: «anota un yogurt y un cuarto de arroz»";
function vzSet(t) { const e = $("#vzt"); if (e) e.textContent = t; }

function vozStart() {
  if (!vozOk()) return toast("La voz no está activada en tu caja. Pídela a tu proveedor.", true);
  stopVoz();
  if (SR && navigator.onLine && !vzElectron) return vzWeb();
  if (vzInstalled()) return vzVosk();
  vzOfrecer(navigator.onLine ? "" : "Sin internet, la voz necesita instalarse en esta caja.");
}
function vzOfrecer(msg) {
  if (!navigator.onLine) return vzError(msg || "Sin internet. Conéctate una vez para instalar la voz sin internet.");
  vzShow(`<div class="vzbox"><div class="vzmic">${svg("mic")}</div><h2>Voz sin internet</h2><p class="muted" style="margin:6px 0 14px">${esc(msg || "")} Se instala una sola vez (34 MB) y después funciona sin internet.</p>
    <div class="btns h"><button class="btn sec" data-a="close">Ahora no</button><button class="btn" data-a="vozinstall" data-enter>Instalar (34 MB)</button></div></div>`);
}
async function vzDoInstall() {
  vzShow(`<div class="vzbox" role="status"><div class="vzmic busy">${svg("mic")}</div><h2>Instalando voz…</h2><div class="vzbar"><i id="vzbar"></i></div><p class="vzt" id="vzt">0 %</p></div>`);
  const mk = ui.mk;
  try { await vzInstall((f) => { const b = $("#vzbar"); if (b) b.style.transform = `scaleX(${f})`; vzSet(Math.round(f * 100) + " %"); }); }
  catch (e) { if (ui.mk === mk) vzError("No se pudo instalar. Revisa tu internet e intenta otra vez."); return; }
  if (ui.mk === mk) { toast("Voz instalada. Ya funciona sin internet"); vozStart(); }
}

/* oído de Chrome (con internet) */
function vzWeb() {
  let rec; try { rec = new SR(); } catch (e) { return vzVoskOrErr(); }
  rec.lang = "es-PE"; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
  const s = vz = { eng: "web", rec, texto: "" };
  vzShow(vzListenHtml(VZ_EJ));
  rec.onresult = (e) => { let all = ""; for (let i = 0; i < e.results.length; i++) all += e.results[i][0].transcript + " "; s.texto = all.trim(); vzSet("«" + s.texto + "»"); };
  rec.onerror = (e) => {
    if (vz !== s) return;
    if (e.error === "network" || e.error === "service-not-allowed" && !s.texto) { stopVoz(); return vzVoskOrErr(); }
    const m = { "not-allowed": "Permite el micrófono en el navegador y vuelve a intentar.", "no-speech": "No te escuché. Acércate al micrófono e intenta otra vez.", "audio-capture": "No encuentro el micrófono." }[e.error];
    if (m) { stopVoz(); vzError(m); }
  };
  rec.onend = () => { if (vz === s) vozSend(); };
  try { rec.start(); } catch (e) { stopVoz(); vzVoskOrErr(); }
}
function vzVoskOrErr() { if (vzInstalled()) vzVosk(); else vzOfrecer("Esta caja no puede usar el oído de internet."); }

/* oído sin internet (Vosk) */
async function vzVosk() {
  const s = vz = { eng: "vosk", texto: "", fin: [], part: "" };
  vzShow(vzListenHtml("Preparando la voz…"));
  let model, ms;
  try {
    model = await vzGetModel(); // primero el modelo, después el micrófono: así no se pierde lo que dices
    if (vz !== s) return vzCleanVosk(s);
    s.ac = new AudioContext({ sampleRate: 16000 }); await s.ac.audioWorklet.addModule((await vzGetBlobs()).proc);
    if (vz !== s) return vzCleanVosk(s);
  } catch (e) {
    if (vz !== s) return; stopVoz();
    return vzError(e && e.name === "NotAllowedError" ? "Permite el micrófono en el navegador y vuelve a intentar." : e && e.name === "NotFoundError" ? "No encuentro el micrófono." : "No se pudo preparar la voz. Vuelve a instalarla desde el botón de voz.");
  }
  if (vz !== s) return vzCleanVosk(s);
  try {
    const ch = new MessageChannel(); model.registerPort(ch.port1);
    const rec = s.vrec = new model.KaldiRecognizer(16000, JSON.stringify(vzGrammar()));
    rec.on("result", (m) => { const t = ((m.result && m.result.text) || "").replace(/\[unk\]/g, " ").replace(/\s+/g, " ").trim(); if (t) s.fin.push(t); s.part = ""; vzSet("«" + s.fin.join(" ") + "»"); if (s.stopping) return vozSend(s); if (t) { clearTimeout(s.endT); s.endT = setTimeout(() => vzStop(), 1300); } });
    rec.on("partialresult", (m) => { const p = ((m.result && m.result.partial) || "").replace(/\[unk\]/g, " ").replace(/\s+/g, " ").trim(); if (p) { s.part = p; clearTimeout(s.endT); vzSet("«" + (s.fin.join(" ") + " " + p).trim() + "»"); } });
    const ac = s.ac;
    const node = new AudioWorkletNode(ac, "recognizer-processor", { channelCount: 1, numberOfInputs: 1, numberOfOutputs: 1 });
    node.port.postMessage({ action: "init", recognizerId: rec.id }, [ch.port2]);
    node.connect(ac.destination);
    await new Promise((ok) => setTimeout(ok, 350)); // deja que el oído termine de armarse
    ms = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); // el micrófono se abre al final
    s.ms = ms; if (vz !== s) return vzCleanVosk(s);
    ac.createMediaStreamSource(ms).connect(node);
    vzSet(VZ_EJ);
    s.max = setTimeout(() => vz === s && vzStop(), 20000);
  } catch (e) { if (vz === s) { stopVoz(); vzError(e && e.name === "NotAllowedError" ? "Permite el micrófono en el navegador y vuelve a intentar." : e && e.name === "NotFoundError" ? "No encuentro el micrófono." : "No se pudo prender la voz. Intenta otra vez."); } }
}
// Termina de escuchar: pide lo último que oyó y sigue.
function vzStop() {
  const s = vz; if (!s || s.stopping) return;
  if (s.eng !== "vosk") { try { s.rec.stop(); } catch (e) { vozSend(s); } return; }
  s.stopping = true; clearTimeout(s.endT);
  try { s.vrec.retrieveFinalResult(); } catch (e) { return vozSend(s); }
  setTimeout(() => vozSend(s), 1500); // por si el oído no contesta
}

function vzError(msg) { vzShow(`<div class="vzbox"><h2>No pude</h2><p class="muted" style="margin:6px 0 14px">${esc(msg)}</p><div class="btns h"><button class="btn sec" data-a="close">Cerrar</button><button class="btn" data-a="voz">Intentar otra vez</button></div></div>`); }

// Entiende la frase con el intérprete de la caja (sin internet). Si no entiende nada y tú lo prendiste,
// pide ayuda a una IA gratuita (opcional; si falla se ignora).
async function vozSend(s) {
  s = s || vz; if (!s || s.sent) return; s.sent = true;
  const texto = (s.eng === "vosk" ? [...s.fin, s.part].filter(Boolean).join(" ") : s.texto || "").trim();
  if (vz === s) vz = null; vzCleanVosk(s);
  if (!texto) return vzError("No te escuché. Acércate al micrófono e intenta otra vez.");
  let acc = vzParse(texto);
  if (!acc.length && navigator.onLine && vzIaOn()) {
    vzShow(`<div class="vzbox" role="status"><div class="vzmic busy">${svg("mic")}</div><h2>Entendiendo…</h2><p class="vzt">«${esc(texto)}»</p></div>`);
    acc = await vzNube(texto);
  }
  vzEntendi(texto, acc);
}
const vzIaOn = () => { try { return localStorage.getItem("cf-voz-ia") === "1" && cloudOn(); } catch (e) { return false; } };
async function vzNube(texto) {
  try {
    const tk = await cloudToken(), neg = cloudLoad().neg;
    const r = await fetch(`${SB_URL}/functions/v1/voz`, { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + tk, "Content-Type": "application/json" }, body: JSON.stringify({ neg, texto }), signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const a = (await r.json()).acciones; return Array.isArray(a) ? a : [];
  } catch (e) { return []; }
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
act({ voz: vozStart, vozstop: vzStop, vozok: vozAccept, vozinstall: vzDoInstall });
