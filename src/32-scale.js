/* ===================== 32 · BALANZA: pesar productos, balanza USB y etiquetas con código ===================== */
const scaleState = { on: false, port: null, reader: null, kg: 0, stable: false, raw: "", last: 0 };
let pollT = 0;
const serialOk = () => "serial" in navigator;
function fmtOf(f) { const m = String(f || "8N1").match(/^([78])([NEO])([12])$/i) || [0, 8, "N", 1]; return { dataBits: +m[1], parity: { N: "none", E: "even", O: "odd" }[m[2].toUpperCase()], stopBits: +m[3] }; }
async function connectScale(ask) {
  if (!serialOk()) { if (ask) toast("Para conectar una balanza USB usa Chrome o Edge en la computadora.", true); return false; }
  try {
    let port = null;
    if (ask) port = await navigator.serial.requestPort();
    else { const ps = await navigator.serial.getPorts(); port = ps[0] || null; }
    if (!port) return false;
    if (scaleState.port === port && scaleState.on) return true;
    await port.open(Object.assign({ baudRate: +DB.cfg.scale.baud || 9600 }, fmtOf(DB.cfg.scale.fmt)));
    scaleState.port = port; scaleState.on = true; readLoop();
    if (ask) toast("Balanza conectada");
    refreshScaleUI(); return true;
  } catch (e) {
    if (e && e.name === "NotFoundError") return false;
    if (ask) toast("No se pudo conectar la balanza: " + ((e && e.message) || e), true);
    return false;
  }
}
async function disconnectScale() {
  scaleState.on = false;
  try { if (scaleState.reader) await scaleState.reader.cancel(); } catch (e) {}
  try { if (scaleState.port) await scaleState.port.close(); } catch (e) {}
  scaleState.port = null; refreshScaleUI();
}
async function readLoop() {
  const port = scaleState.port, dec = new TextDecoder(); let buf = "";
  while (port && port.readable && scaleState.on) {
    const reader = port.readable.getReader(); scaleState.reader = reader;
    try {
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split(/[\r\n\x02\x03]+/); buf = parts.pop(); if (buf.length > 120) buf = buf.slice(-60);
        parts.forEach(onScaleLine);
      }
    } catch (e) { break; } finally { try { reader.releaseLock(); } catch (e) {} }
  }
  if (scaleState.port === port) { scaleState.on = false; refreshScaleUI(); }
}
// Entiende los formatos más comunes: "ST,GS,+  0.250kg", "  0.250 kg", "00250 g", "W:0.250"...
function parseWeight(line) {
  const nums = [...line.matchAll(/([-+]?)\s*(\d+(?:[.,]\d+)?)\s*(kg|g|lb)?\b/gi)];
  if (!nums.length) return null;
  const pick = nums.find((x) => x[3]) || nums[nums.length - 1];
  let v = parseFloat(pick[2].replace(",", ".")); if (!isFinite(v)) return null;
  if (pick[1] === "-") v = 0;
  let unit = (pick[3] || "").toLowerCase();
  if (!unit) unit = DB.cfg.scale.unit === "g" ? "g" : DB.cfg.scale.unit === "kg" ? "kg" : /[.,]/.test(pick[2]) ? "kg" : v > 30 ? "g" : "kg";
  const kg = unit === "g" ? v / 1000 : unit === "lb" ? v * 0.45359 : v;
  return { kg: r3(Math.max(0, kg)), stable: !/\bUS\b|unst|motion|\bM\b/i.test(line) };
}
function onScaleLine(line) {
  line = line.trim(); if (!line) return;
  scaleState.raw = line.replace(/[^\x20-\x7e]/g, "·");
  const w = parseWeight(line); if (!w) return;
  scaleState.kg = w.kg; scaleState.stable = w.stable; scaleState.last = Date.now();
  if (ui.mk === "weigh" && ui.w && ui.w.src === "scale") paintWeighLcd();
  if (ui.mk === "scaletest") paintScaleTest();
}
const CMDS = { "": "", W: "W", ENQ: "\x05", P: "P\r\n", SI: "SI\r\n" };
function startPoll() {
  clearInterval(pollT);
  const c = CMDS[DB.cfg.scale.cmd || ""];
  if (!c || !scaleState.on || !scaleState.port || !scaleState.port.writable) return;
  const enc = new TextEncoder();
  pollT = setInterval(async () => {
    if (!scaleState.on || !scaleState.port || !scaleState.port.writable) return clearInterval(pollT);
    try { const w = scaleState.port.writable.getWriter(); await w.write(enc.encode(c)); w.releaseLock(); } catch (e) {}
  }, 350);
}
function stopScaleRead() { clearInterval(pollT); pollT = 0; }
function refreshScaleUI() {
  const t = $("#scaleTool"); if (t) { t.classList.toggle("live", scaleState.on); t.querySelector("span").textContent = scaleState.on ? "Balanza lista" : "Balanza"; }
  if (ui.mk === "weigh") paintWeighLcd();
}

/* ---------- ventana de pesado: simple, precio por kilo y peso ---------- */
// Acepta "0.5", "0,5" (kilos) o "250g" / "250 gr" (gramos).
function parseKg(txt) {
  const t = String(txt || "").trim().toLowerCase();
  if (!t) return 0;
  if (/(^|\d)\s*(g|gr|grs|gramos)$/.test(t)) return r3(num(t.replace(/[^\d.,]/g, "")) / 1000);
  return r3(num(t));
}
function openWeigh(id, mode) {
  const p = prod(id); if (!p) return;
  const l = DB.cart.items.find((i) => lineKey(i.id, i.pres) === lineKey(id, ""));
  if (mode === "add" && p.stock != null && p.stock <= 0 && !DB.cfg.negStock) { toast("Sin stock: " + p.name); beep(false); return; }
  const pk = l && l.pr != null ? l.pr : p.price;
  ui.w = { id, mode, src: "manual", have: l ? l.qty : 0 };
  openModal(`<div class="weigh simple">
    <div class="wtop">${pimg(p, "wimg")}<div><h2>${esc(p.name)}</h2><p class="muted">${[mode === "add" && l ? `Ya lleva ${fmtQ(l.qty)} kg` : "Se vende por kilo", p.stock != null ? `stock ${fmtQ(p.stock)} kg` : ""].filter(Boolean).join(" · ")}</p></div></div>
    <div class="two"><label class="fld"><span>Precio por kilo (S/)</span><input class="inp num big" id="wpk" data-in="wk" inputmode="decimal" value="${(+pk).toFixed(2)}" aria-label="Precio por kilo"></label>
      <label class="fld"><span>Peso (kg)</span><input class="inp num big" id="wkg" data-in="wk" inputmode="decimal" enterkeyhint="done" value="${mode === "set" && l ? String(l.qty) : ""}" placeholder="0.500" autocomplete="off" autofocus data-mfocus></label></div>
    <div class="wtot"><span>A pagar</span><b class="num" id="wtot">S/ 0.00</b></div>
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn" id="wok" data-a="wok" data-enter>${mode === "set" ? "Guardar" : "Agregar"}</button></div></div>`, "weighm");
  ui.mk = "weigh"; paintWeighLcd();
}
const weighKg = () => parseKg(($("#wkg") || { value: "" }).value);
const weighPk = () => r2(num(($("#wpk") || { value: "" }).value));
function paintWeighLcd() {
  const w = ui.w; if (!w || !$("#wkg")) return;
  const kg = weighKg(), pk = weighPk(), amt = r2(kg * pk);
  const t = $("#wtot"); if (t) t.textContent = money(amt);
  const ok = $("#wok"); if (ok) { ok.disabled = !(kg > 0 && pk > 0); ok.textContent = kg > 0 && pk > 0 ? `${w.mode === "set" ? "Guardar" : "Agregar"} · ${money(amt)}` : w.mode === "set" ? "Guardar" : "Agregar"; }
}
function weighKey() {}
function weighOk() {
  const w = ui.w; if (!w) return;
  const p = prod(w.id), kg = weighKg(), pk = weighPk();
  if (!p || !(kg > 0)) return toast("Escribe el peso");
  if (!(pk > 0)) return toast("Escribe el precio por kilo");
  const total = w.mode === "add" ? r3(w.have + kg) : kg;
  if (setLine(p.id, "", total)) {
    const l = DB.cart.items.find((i) => lineKey(i.id, i.pres) === lineKey(p.id, ""));
    if (l) { if (pk !== p.price) l.pr = pk; else delete l.pr; save(); paintSale(); }
    ui.w = null; closeModal();
  }
}
// Etiqueta de balanza con código de barras: 2 + PLU + peso (g) o precio (céntimos) + dígito de control.
function parseLabel(code) {
  const L = DB.cfg.labels; if (!L.on || !/^2\d{12}$/.test(code)) return null;
  const pre = Math.min(3, Math.max(1, +L.pre || 2)), len = Math.min(6, Math.max(3, +L.len || 5));
  const plu = code.slice(pre, pre + len), val = parseInt(code.slice(pre + len, 12), 10);
  const p = DB.products.find((x) => x.code && x.code.replace(/^0+/, "") === plu.replace(/^0+/, ""));
  if (!p || !(val > 0)) return null;
  const qty = L.kind === "precio" ? r3(val / 100 / p.price) : p.unit === "kg" ? r3(val / 1000) : val;
  return qty > 0 ? { p, qty } : null;
}

/* ---------- prueba de la balanza (Ajustes) ---------- */
function openScaleTest() {
  openModal(`<h2>Probar balanza</h2><p class="muted" style="margin-bottom:10px">Pon algo en la balanza: aquí verás lo que envía y el peso que entiende Caja Fácil.</p>
    <div class="lcd live" id="stlcd"></div><p class="muted mono" id="straw" style="margin:8px 0 12px;word-break:break-all"></p>
    <div class="btns h"><button class="btn sec" data-a="close">Cerrar</button>${scaleState.on ? `<button class="btn red sec" data-a="scaleoff">Desconectar</button>` : `<button class="btn" data-a="scaleconnect">Conectar balanza</button>`}</div>`);
  ui.mk = "scaletest"; paintScaleTest(); if (scaleState.on) startPoll();
}
function paintScaleTest() {
  const el = $("#stlcd"); if (!el) return;
  el.innerHTML = `<div class="lrow main"><span>PESO</span><b class="num">${scaleState.kg.toFixed(3)}<i>kg</i></b></div><div class="lst">${scaleState.on ? (scaleState.last ? (scaleState.stable ? "Estable" : "En movimiento") : "Conectada. Esperando datos…") : "Sin conectar"}</div>`;
  const r = $("#straw"); if (r) r.textContent = scaleState.raw ? "Recibido: " + scaleState.raw : "Aún no llegan datos.";
}
act({
  wkey: (el) => weighKey(el.dataset.k),
  wtab: (el) => { const w = ui.w; if (!w) return; const t = el.dataset.t; if (t === "scale") { w.src = "scale"; startPoll(); } else { w.src = "manual"; w.tab = t; stopScaleRead(); } paintWeighLcd(); },
  wok: weighOk,
  scaletool: () => { if (scaleState.on) openScaleTest(); else if (serialOk() && DESK()) connectScale(true); else toast("Escribe el peso al tocar un producto por kilo. La balanza USB se conecta desde Chrome o Edge en la PC.", true); },
  scaleconnect: async () => { const ok = await connectScale(true); if (ok && ui.mk === "weigh" && ui.w) { const w = ui.w; openWeigh(w.id, w.mode); } else if (ui.mk === "scaletest") openScaleTest(); },
  scaleoff: async () => { await disconnectScale(); openScaleTest(); },
  scaletest: openScaleTest
});
