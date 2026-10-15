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
  try { if (s.rec && s.eng === "web") { s.rec.onresult = s.rec.onend = s.rec.onerror = null; s.rec.abort(); } clearTimeout(s.endT); clearTimeout(s.max); } catch (e) {}
  vzCleanVosk(s);
}
function vzCleanVosk(s) {
  try { clearTimeout(s.endT); clearTimeout(s.max); clearInterval(s.vadT); if (s.vrec) s.vrec.remove(); } catch (e) {}
  try { if (s.mrec && s.mrec.state !== "inactive") { s.mrec.onstop = null; s.mrec.stop(); } } catch (e) {}
  try { if (s.ms) s.ms.getTracks().forEach((t) => t.stop()); } catch (e) {}
  try { if (s.ac && s.ac.state !== "closed") s.ac.close(); } catch (e) {}
  if (s.eng === "vosk") vzIdle();
}

/* ---------- intérprete en español (sin IA, sin internet) ---------- */
const VZ_N = { cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900 };
const VZ_ANOTA = new Set(["anota", "anotame", "agrega", "agregame", "pon", "ponme", "anade", "anademe", "suma", "apunta", "apuntame", "dame", "registra", "crea", "crear", "ponle", "agregale", "sumale", "anotale", "mete", "metele", "llevo", "lleva", "quiero", "echa", "echame", "echale", "alcanzame", "pasame", "marcame", "cargame", "cargale", "despacha", "despachame", "vende", "vendeme", "necesito", "quisiera", "queria", "regalame", "sirveme"]);
const VZ_PAGA = new Set(["paga", "pagale", "pagar", "pagame", "abona", "abonale", "abonar", "cancela", "pago", "pagaron", "pagan"]);
const VZ_FIA = new Set(["fia", "fiale", "fiar", "fiado", "fiame", "credito"]);
const VZ_COBRA = new Set(["cobra", "cobrar", "cobrame", "cobrale", "cobrarle", "cobramos"]);
const VZ_QUITA = new Set(["quita", "quitale", "quitame", "quitar", "saca", "sacame", "elimina", "borra", "borrame", "retira", "sacale", "restale", "resta", "descuenta", "devuelve", "devuelvo", "anula", "anulame", "anulale", "anular", "tacha", "tachame", "tachale", "descarta", "descartale", "olvida"]);
const VZ_ULT = new Set(["eso", "ese", "esa", "esto", "ultimo", "ultima", "anterior", "mismo", "misma"]); // «quita 1» = del último producto
const VZ_VACIA = new Set(["vacia", "vaciar", "limpia", "limpiar"]);
const VZ_CAMBIA = new Set(["cambia", "cambiale", "cambiar", "modifica", "corrige"]);
const VZ_UPD = new Set(["actualiza", "actualizale", "actualizar", "actualizame", "cambia", "cambiale", "cambiar", "modifica", "modificale", "corrige", "corrigele", "ponle", "pon", "sube", "subele", "baja", "bajale", "fija", "fijale", "edita", "editale"]);
const VZ_LLEGO = new Set(["llego", "llegaron", "ingresa", "ingresan", "ingreso", "ingresaron", "repon", "repone", "reponer", "reponle", "entro", "entraron", "recibi"]);
const VZ_OFF = new Set(["desactiva", "desactivar", "desactivale", "oculta", "ocultar", "ocultale", "ocultame", "esconde", "escondeme", "desactivame", "esconder", "apaga"]);
const VZ_ON = new Set(["activa", "activar", "activale", "activame", "muestra", "mostrar", "prende"]);
const VZ_MUEVE = new Set(["mueve", "mover", "muevelo", "pasa", "pasalo", "asigna", "asignale", "clasifica"]);
const VZ_MEDIOS = new Set(["efectivo", "yape", "plin", "transferencia", "tarjeta"]);
const VZ_UNI = /^(medio|media|cuarto|cuartos|kilo|kilos|kilito|kilitos|kg|kilogramo|kilogramos|gramo|gramos|gr|docena|docenas|par|pares)$/;
const vzIsNum = (t) => /^\d+(#\d+)?$/.test(t) || t in VZ_N;
const vzIsQty = (t) => vzIsNum(t) || VZ_UNI.test(t) || /^(sol|soles)$/.test(t);
const vzNumVal = (t) => (t in VZ_N ? VZ_N[t] : parseFloat(t.replace("#", ".")));
// «un kilo y medio» → 1.5 kg · «tres cuartos» → 0.75 kg · «media docena» → 6 · «dos soles» → monto 2 · «un sol cincuenta» → 1.50
function vzQty(toks) {
  let val = 0, prev = 0, kg = false, sol = false, any = false;
  toks.forEach((t) => {
    if (vzIsNum(t)) { const n = vzNumVal(t); if (sol) val += n / 100; else val += n; prev = n; any = true; return; }
    const was = prev; prev = 0;
    if (/^(kilo|kilos|kilito|kilitos|kg|kilogramo|kilogramos)$/.test(t)) { kg = true; if (!val) val = 1; }
    else if (/^(gramo|gramos|gr)$/.test(t)) { kg = true; val = val / 1000; }
    else if (/^(medio|media)$/.test(t)) { val += 0.5; prev = 0.5; any = true; }
    else if (/^(cuarto|cuartos)$/.test(t)) { kg = true; any = true; val = was ? val - was + was * 0.25 : val + 0.25; }
    else if (/^(docena|docenas)$/.test(t)) { any = true; const b = was || 1; val = val - b + b * 12; }
    else if (/^(par|pares)$/.test(t)) { any = true; const b = was || 1; val = val - b + b * 2; }
    else if (/^(sol|soles)$/.test(t)) { sol = true; any = true; }
  });
  if (!any && !kg && !sol) return null;
  return { val: r3(val), kg, sol };
}
// Como lo dice la gente: «yapéame», «en cash», «con visa»…
const VZ_ALIAS = { yapeo: "yape", yapeado: "yape", yapea: "yape", yapeame: "yape", yapear: "yape", yapeando: "yape", yapes: "yape", plineo: "plin", plineado: "plin", plinea: "plin", plineame: "plin", cash: "efectivo", contado: "efectivo", visa: "tarjeta", pos: "tarjeta", mastercard: "tarjeta", llape: "yape", jape: "yape", yapi: "yape", yapee: "yape", plim: "plin", pling: "plin", plinn: "plin", debito: "tarjeta", transfer: "transferencia", transferi: "transferencia", transferencias: "transferencia", deposito: "transferencia", billete: "efectivo", billetes: "efectivo", monedas: "efectivo", cuartito: "cuarto", cuartitos: "cuartos" };
const VZ_DROP = new Set(["unidad", "unidades", "unid", "und", "unds"]); // «dos unidades de atún» = «dos atún»
const VZ_INI = new Set(["oye", "oe", "mira", "hola", "buenas", "bueno", "entonces", "pues", "ya", "porfa", "porfis", "disculpa", "perdon", "joven", "amigo"]);
const VZ_FIN = new Set(["porfa", "porfis", "gracias", "nomas", "pues", "oe"]);
const VZ_CIERRA = new Set(["cierra", "cierrame", "cerrar", "cerremos", "finaliza", "finalizar", "termina", "terminar", "terminemos"]);
function vzTokens(text) {
  const t = String(text).toLowerCase().replace(/\b1\s*\/\s*2\b/g, " medio ").replace(/\b1\s*\/\s*4\b/g, " un cuarto ").replace(/\b3\s*\/\s*4\b/g, " tres cuartos ");
  let w = norm(t).replace(/(\d)[.,](\d)/g, "$1#$2").replace(/(^|\s)s\//g, " ").replace(/\bya\s*pe\b/g, "yape").replace(/[^a-z0-9# ]/g, " ").split(/\s+/).filter(Boolean).map((x) => VZ_ALIAS[x] || x).filter((x) => !VZ_DROP.has(x));
  // «mejor no el queso», «ya no quiero la gaseosa» = quita
  const neg = [["mejor", "no"], ["ya", "no", "quiero"], ["ya", "no"], ["no", "quiero"]].find((n) => n.every((x, i) => w[i] === x));
  if (neg && w.length > neg.length) w = ["quita"].concat(w.slice(neg.length));
  // saludos y cortesías: «oye, dos panes por favor»
  while (w.length > 1 && VZ_INI.has(w[0])) w.shift();
  if (w[0] === "a" && w[1] === "ver") w = w.slice(2);
  for (;;) {
    if (w.length > 2 && w[w.length - 2] === "por" && w[w.length - 1] === "favor") w.splice(-2);
    else if (w.length > 1 && VZ_FIN.has(w[w.length - 1])) w.pop();
    else break;
  }
  // «cincuenta céntimos» = 0.50 soles
  const c = [];
  w.forEach((x) => { if (/^(centimo|centimos|centavo|centavos)$/.test(x) && c.length && vzIsNum(c[c.length - 1])) { const n = vzNumVal(c.pop()); c.push(n > 0 && n < 100 ? "0#" + String(Math.round(n)).padStart(2, "0") : String(n)); c.push("soles"); } else c.push(x); });
  w = c;
  // «cierra la venta», «termina la cuenta» = cobra
  if (w.some((x) => /^(venta|cuenta|ticket|pedido)$/.test(x))) w = w.map((x) => (VZ_CIERRA.has(x) ? "cobra" : x));
  return w;
}
// Nombre = lo que sigue a «a/al/para» hasta el primer número o palabra de pago.
function vzNameAfterA(toks) {
  const i = toks.findIndex((t) => t === "a" || t === "al" || t === "para");
  const src = i >= 0 ? toks.slice(i + 1) : toks.filter((t) => !vzIsQty(t) && !VZ_MEDIOS.has(t));
  const out = []; for (const t of src) { if (vzIsQty(t) || ["por", "en", "con", "de", "del", "soles", "sol"].includes(t) || VZ_MEDIOS.has(t)) { if (out.length) break; else continue; } out.push(t); }
  return out.join(" ");
}
// Dinero: «dos con cincuenta» y «dos cincuenta» valen 2.50; «treinta y cinco» vale 35.
function vzMoney(toks) {
  const w = []; toks.forEach((t) => { if (vzIsNum(t) || /^(sol|soles)$/.test(t) || t === "con") w.push(t); });
  const m = []; for (let i = 0; i < w.length; i++) {
    const t = w[i];
    if (t === "con") { if (m.length && vzIsNum(w[i + 1] || "")) { const a = vzNumVal(m.pop()), c = vzNumVal(w[++i]); m.push(String(r2(a + (c < 100 ? c / 100 : c))).replace(".", "#")); } continue; }
    const pv = m[m.length - 1];
    if (vzIsNum(t) && pv && vzIsNum(pv) && vzNumVal(pv) <= 99 && vzNumVal(pv) % 1 === 0 && vzNumVal(t) >= 10 && vzNumVal(t) <= 99 && !(pv in VZ_N && vzNumVal(pv) >= 20 && vzNumVal(pv) % 10 === 0 && vzNumVal(t) < 10)) { m.push(String(r2(vzNumVal(m.pop()) + vzNumVal(t) / 100)).replace(".", "#")); continue; }
    m.push(t);
  }
  const q = vzQty(m.filter((t) => vzIsNum(t) || /^(sol|soles)$/.test(t)));
  return q && q.val > 0 ? q.val : 0;
}
const VZ_FN = new Set(["el", "la", "los", "las", "de", "del", "un", "una", "unos", "unas", "a", "al", "cuanto", "cuantos", "cuantas", "cuesta", "cuestan", "vale", "valen", "precio", "esta", "estan", "es", "son", "quedan", "queda", "quedo", "hay", "stock", "tengo", "tenemos", "me", "mi", "mis", "en", "producto", "kilo", "kilos", "docena", "docenas", "dime", "dame", "cual", "que", "por", "tiene", "tienes", "cuesta", "sale", "salen", "cobran", "cobras", "cobro", "como"]);

/* ---------- preguntas y descuento: «cuánto me debe Rosa», «qué se está acabando», «cuánto hay en caja», «descuento de 2 soles» ---------- */
const VZ_BAJO = /^(acabando|acaba|acabar|acabarse|acabaron|acabado|acabados|agotando|agotado|agotados|agotarse|faltan|faltando|escasea|escasos|reponer|pedir|comprar)$/;
const VZ_ASK_RUIDO = new Set(["que", "se", "esta", "estan", "por", "ya", "queda", "quedan", "poco", "pocos", "pocas", "poca", "stock", "bajo", "bajos", "hay", "tengo", "tenemos", "falta", "faltan", "me", "mi", "mis", "lo", "los", "las", "el", "la", "de", "del", "dime", "dame", "cuales", "cual", "cuanto", "cuantos", "cosas", "productos", "producto", "mercaderia", "algo", "toca", "debo", "hoy", "lista", "un", "una", "a", "para", "estoy", "estamos", "voy", "vamos", "tiene", "tienes", "tienen"]);
const vzPeriodo = (toks) => (toks.includes("ayer") ? "ayer" : toks.includes("semana") ? "semana" : toks.includes("mes") ? "mes" : "hoy");
function vzRango(per) {
  const d = new Date(), k = (x) => dkey(x);
  if (per === "ayer") { const y = new Date(d.getTime() - 864e5); return { from: k(y), to: k(y), label: "ayer" }; }
  if (per === "semana") return { from: k(new Date(d.getTime() - 6 * 864e5)), to: k(d), label: "en los últimos 7 días" };
  if (per === "mes") return { from: k(new Date(d.getFullYear(), d.getMonth(), 1)), to: k(d), label: "este mes" };
  return { from: k(d), to: k(d), label: "hoy" };
}
function vzParseAsk(toks, j, raw) {
  const has = (re) => toks.some((t) => re.test(t));
  const medio = toks.find((t) => VZ_MEDIOS.has(t));
  // descuento al ticket: «descuento de 2 soles», «dale 10 por ciento de descuento», «quita el descuento»
  const iD = toks.findIndex((t) => /^(descuento|descuentito|rebaja|rebajale|rebajar|rebajita)$/.test(t) || (/^(descuenta|descuentale)$/.test(t) && has(/^(sol|soles|ciento|porciento)$/)));
  if (iD >= 0) {
    const desde = toks.slice(iD);
    if (desde.some((t) => /^(quita|quitale|quitar|saca|sacale|elimina|borra|sin|cancela|anula)$/.test(t)) || toks.slice(0, iD).some((t) => /^(quita|quitale|quitar|saca|sacale|elimina|borra|sin|cancela|anula)$/.test(t))) return [{ tipo: "descuento", monto: 0 }];
    const pre = toks.slice(0, iD); while (pre.length && /^(y|e|con|ademas|tambien|mas|aplica|aplicale|hazle|hazme|dale|ponle|pon|un|una|de|el|al|ticket|dame)$/.test(pre[pre.length - 1])) pre.pop();
    const out = pre.length ? vzParse(pre.join(" ")) : [];
    const pct = /%/.test(raw) || desde.some((t, i) => t === "porciento" || (t === "por" && desde[i + 1] === "ciento"));
    const num = desde.filter((t, i) => !(t === "ciento" && desde[i - 1] === "por") && !(t === "por" && desde[i + 1] === "ciento"));
    const valor = (ts) => (pct ? ((vzQty(ts.filter(vzIsNum)) || {}).val || 0) : vzMoney(ts));
    let v = valor(num);
    if (!v && !out.length) v = valor(toks.filter((t, i) => !(t === "ciento" && toks[i - 1] === "por") && !(t === "por" && toks[i + 1] === "ciento"))); // «dale 5 soles de descuento»
    return v > 0 ? out.concat({ tipo: "descuento", ...(pct ? { pct: v } : { monto: v }) }) : out;
  }
  if (!toks.length) return null;
  // repetir la última venta: «repite la última venta», «ponme lo mismo de antes», «repite y cobra con yape»
  if ((has(/^(repite|repiteme|repetir|repitele|repitelo|repetime)$/) || (toks.includes("mismo") && toks.includes("lo") && has(/^(antes|anterior|ultima|ultimo|nuevo|vez|igual)$/))) && !has(/^(precio|cuesta|vale|cuanto)$/)) {
    const cob = toks.some((t) => VZ_COBRA.has(t) || t === "cobra") ? [{ tipo: "cobrar", medio: medio || "efectivo" }] : [];
    return [{ tipo: "repetir" }, ...cob];
  }
  // ganancia y más vendidos: «cuánto gané hoy», «qué se vende más esta semana» (si nombras un producto, no es esto)
  const per = vzPeriodo(toks), sobra = toks.filter((t) => !VZ_FN.has(t) && !VZ_ASK_RUIDO.has(t) && !/^(gane|ganamos|gano|ganancia|ganancias|utilidad|utilidades|vende|vendido|vendidos|vendo|vendemos|venden|vendio|vendieron|vendi|mas|hoy|ayer|semana|mes|esta|este|dia|total|neta|ahora|producto|productos|mejor|cosa|cosas|lo|se|le|ultimos|dias|siete|pasada|pasado|actual|va|llevo|llevamos|top|estrella|favorito|favoritos|que|cual|cuales|quien|cuanta|cuantas)$/.test(t) && !vzIsNum(t));
  if (!sobra.length && has(/^(gane|ganamos|gano|ganancia|ganancias|utilidad|utilidades)$/)) return [{ tipo: "consulta", consulta: "ganancia", per }];
  if (!sobra.length && ((has(/^(vende|vendido|vendidos|vendo|vendemos|venden|vendio|vendieron|vendi)$/) && toks.includes("mas")) || has(/^(top|estrella|favorito|favoritos)$/)) && !toks.includes("cuanto")) return [{ tipo: "consulta", consulta: "mas_vendidos", per }];
  // ventas del día (total o por medio de pago)
  const hoy = has(/^(hoy|dia)$/) || j.includes("resumen del dia");
  if ((toks.includes("cuanto") && has(/^vend/)) || (toks.includes("ventas") && hoy) || j.includes("resumen del dia")) return [{ tipo: "consulta", consulta: "ventas_hoy", ...(medio ? { medio } : {}) }];
  const verbo = toks.some((t) => VZ_PAGA.has(t) || VZ_COBRA.has(t) || VZ_QUITA.has(t) || VZ_CAMBIA.has(t) || VZ_UPD.has(t) || (VZ_LLEGO.has(t) && toks.some(vzIsNum)) || VZ_OFF.has(t) || VZ_ON.has(t) || (VZ_FIA.has(t) && !/^(fiado|fiados)$/.test(t)));
  if (verbo) return null;
  // deudas: «cuánto me debe Rosa», «quién me debe», «cuánto le debo a Gloria»
  const dw = has(/^(debe|deben|debo|debemos|debes|deuda|deudas|deudor|deudores|moroso|morosos)$/) || (has(/^(fiado|fiados)$/) && has(/^(cuanto|cuantos|quien|quienes|lista|total|hay|tengo)$/));
  if (dw && !has(VZ_BAJO)) {
    const prov = has(/^(debo|debemos|proveedor|proveedores)$/);
    const nombre = toks.filter((t) => !VZ_FN.has(t) && !vzIsNum(t) && !["debe", "deben", "debo", "debemos", "debes", "deuda", "deudas", "deudor", "deudores", "moroso", "morosos", "fiado", "fiados", "quien", "quienes", "lista", "total", "le", "les", "cliente", "clientes", "proveedor", "proveedores", "todos", "todas", "tengo", "hay", "cuanto", "cuantos", "fia", "fiaron", "con", "nos", "te", "se"].includes(t)).join(" ");
    return [{ tipo: "consulta", consulta: "deuda", ...(nombre ? { nombre } : {}), ...(prov ? { prov: true } : {}) }];
  }
  // qué se está acabando
  const lista = j.includes("poco stock") || j.includes("stock bajo") || j.includes("queda poco") || j.includes("quedan pocos") || j.includes("quedan pocas") || j.includes("que falta") || j.includes("que me falta");
  if ((has(VZ_BAJO) || lista) && !toks.some(vzIsNum)) {
    const nombre = toks.filter((t) => !VZ_ASK_RUIDO.has(t) && !VZ_BAJO.test(t) && !VZ_FN.has(t)).join(" ");
    return nombre ? [{ tipo: "stock", nombre }] : [{ tipo: "consulta", consulta: "bajos" }];
  }
  // plata en caja
  if (has(/^(caja|plata|dinero|efectivo)$/) && has(/^(cuanto|cuantos|hay|tengo|tenemos|queda|quedan|llevo|llevamos)$/) && !has(/^(precio|cuesta|vale)$/)) {
    if (medio && medio !== "efectivo") return [{ tipo: "consulta", consulta: "ventas_hoy", medio }];
    return [{ tipo: "consulta", consulta: "caja" }];
  }
  if (medio && toks.includes("cuanto") && !has(/^(cuesta|vale|precio)$/)) return [{ tipo: "consulta", consulta: "ventas_hoy", medio }];
  // total del ticket: «cuánto es», «cuánto sería todo», «cuánto llevo»
  if (toks[0] === "cuanto" && toks.length <= 6 && toks.every((t) => ["cuanto", "es", "seria", "sera", "va", "llevo", "llevamos", "sale", "son", "me", "lo", "en", "total", "todo", "la", "el", "cuenta", "ticket", "le", "cobro", "cobras", "mas", "ahora", "ya"].includes(t))) return [{ tipo: "consulta", consulta: "ticket" }];
  return null;
}
const VZ_ABONO = /^(pago|pagaron|pagan|abono|abonaron|abona|cancelo|cancelaron|dejo|dejaron|entrego|entregaron|dio|dieron)$/;
const VZ_NOMBRE_RUIDO = new Set(["me", "le", "nos", "ya", "hoy", "ahora", "con", "de", "del", "su", "sus", "la", "el", "los", "las", "un", "una", "deuda", "fiado", "cuenta", "parte", "a", "por", "en", "soles", "sol", "cliente", "clientes", "senora", "senor", "sra", "sr", "dona", "don", "yo", "nosotros", "y", "tambien", "ademas", "mas"]);
// «Rosa me pagó diez soles», «Rosa abonó 20 con yape», «recibí diez soles de Rosa»: un cliente paga su deuda
function vzParseAbono(toks) {
  const medio = toks.find((t) => VZ_MEDIOS.has(t)), monto = vzMoney(toks.filter((t) => !VZ_MEDIOS.has(t)));
  if (!(monto > 0)) return null;
  const clean = (ts) => ts.filter((t) => !VZ_NOMBRE_RUIDO.has(t) && !vzIsNum(t) && !VZ_MEDIOS.has(t) && !VZ_UNI.test(t)).join(" ");
  const iV = toks.findIndex((t) => VZ_ABONO.test(t));
  if (iV > 0 && toks[iV + 1] === "con" && toks.some((t) => VZ_COBRA.has(t) || t === "cobra")) return null; // «cobra, pagó con veinte»: es con cuánto paga, no un abono
  if (iV > 0) { const nombre = clean(toks.slice(0, iV)); if (nombre) return [{ tipo: "abono", nombre, monto, ...(medio ? { medio } : {}) }]; }
  const iR = toks.findIndex((t) => /^(recibi|cobre|recibimos|cobramos)$/.test(t));
  if (iR >= 0) { const iD = toks.findIndex((t, i) => i > iR && (t === "de" || t === "a")); const nombre = iD >= 0 ? clean(toks.slice(iD + 1)) : ""; if (nombre) return [{ tipo: "abono", nombre, monto, ...(medio ? { medio } : {}) }]; }
  return null;
}
function vzParse(text) {
  const toks = vzTokens(text), out = [], j = toks.join(" ");
  if (!toks.length) return out;
  const ask = vzParseAsk(toks, j, String(text)); if (ask) return ask;
  const abo = vzParseAbono(toks); if (abo) return abo;
  // esconder o mostrar un producto en la venta: «desactiva el limón»
  if (toks.some((t) => VZ_OFF.has(t) || VZ_ON.has(t))) {
    const on = toks.some((t) => VZ_ON.has(t)), nombre = toks.filter((t) => !VZ_OFF.has(t) && !VZ_ON.has(t) && !VZ_FN.has(t) && !["producto", "articulo", "de", "la", "venta", "y"].includes(t) && !vzIsNum(t)).join(" ");
    return nombre ? [{ tipo: on ? "activar" : "desactivar", nombre }] : [];
  }
  // categoría: «cambia la categoría del limón a frutas» · «mueve el limón a categoría frutas» · «ponle categoría frutas al limón»
  if (toks.includes("categoria") && toks.some((t) => VZ_UPD.has(t) || VZ_MUEVE.has(t) || VZ_ANOTA.has(t))) {
    const ic = toks.indexOf("categoria"), noise = (t) => VZ_UPD.has(t) || VZ_MUEVE.has(t) || VZ_ANOTA.has(t) || ["el", "la", "los", "las", "su", "producto", "articulo", "de", "del", "a", "al", "en", "como", "para", "sea", "y"].includes(t);
    const before = toks.slice(0, ic).filter((t) => !noise(t)), after = toks.slice(ic + 1); let nombre = "", cat = "";
    const CON = ["a", "al", "en", "como", "para", "sea", "es"];
    if (before.length) { nombre = before.join(" "); cat = after.filter((t) => !["a", "al", "en", "como", "de", "la", "el"].includes(t) || false).join(" "); const k = after.findIndex((t) => !["a", "en", "como", "de", "la", "el", "sea", "es"].includes(t)); cat = k >= 0 ? after.slice(k).join(" ") : ""; }
    else if (["de", "del"].includes(after[0])) { const rest = after.slice(1), k = rest.findIndex((t) => CON.includes(t)); if (k > 0) { nombre = rest.slice(0, k).filter((t) => t !== "la" && t !== "el").join(" "); cat = rest.slice(k + 1).join(" "); } }
    else { const k = after.findIndex((t) => CON.includes(t)); if (k > 0) { cat = after.slice(0, k).join(" "); nombre = after.slice(k + 1).filter((t) => t !== "la" && t !== "el").join(" "); } }
    return nombre && cat ? [{ tipo: "categoria", nombre, categoria: cat }] : [];
  }
  // cambiar precio, costo o stock de un producto: «actualiza el precio del huevo a 6.70 y costo a 6»
  const kwOf = (t) => (t === "precio" ? "precio" : t === "costo" ? "costo" : t === "codigo" ? "codigo" : t === "stock" || t === "inventario" ? "stock" : "");
  if (toks.some((t) => VZ_UPD.has(t)) && toks.some((t) => kwOf(t)) && !toks.includes("nuevo")) {
    const first = toks.findIndex((t) => kwOf(t)), SKIP = (t) => VZ_UPD.has(t) || VZ_FN.has(t) || ["y", "e", "su", "producto", "articulo", "barras", "barra", "numero"].includes(t);
    const pre = toks.slice(0, first).filter((t) => !SKIP(t) && !vzIsQty(t)).join(" ");
    const segs = []; toks.slice(first).forEach((t) => { if (kwOf(t)) segs.push({ k: kwOf(t), t: [] }); else segs[segs.length - 1].t.push(t); });
    const r = {}; let nombre = pre;
    segs.forEach((sg) => {
      let i = 0; while (i < sg.t.length && ["de", "del", "el", "la", "al", "los", "las", "su", "producto", "barras", "barra", "numero"].includes(sg.t[i])) i++;
      const nm = []; while (i < sg.t.length && !vzIsQty(sg.t[i]) && !["a", "en", "por", "sea", "sean", "es", "son", "y"].includes(sg.t[i])) nm.push(sg.t[i++]);
      if (!nombre && nm.length) nombre = nm.join(" ");
      const rest = sg.t.slice(i);
      if (!nombre) { let l = -1; rest.forEach((t, j) => { if (vzIsQty(t)) l = j; }); const tn = rest.slice(l + 1).filter((t) => !SKIP(t)); if (tn.length) nombre = tn.join(" "); } // «stock 12 al tomate»
      if (sg.k === "codigo") { const c = rest.filter((t) => /^\d+$/.test(t)).join(""); if (c) r.codigo = c; }
      else if (sg.k === "stock") { const q = vzQty(rest.filter(vzIsQty)); if (q && q.val >= 0 && !q.sol) r.stock = q.val; }
      else { const m = vzMoney(rest); if (m > 0) r[sg.k] = m; }
    });
    return nombre && Object.keys(r).length ? [{ tipo: "actualizar", nombre, ...r }] : [];
  }
  // llegó mercadería: «llegaron 20 huevos y 10 atunes» suma al stock
  if (toks.some((t) => VZ_LLEGO.has(t))) {
    const seg = toks.filter((t) => !VZ_LLEGO.has(t)), items = []; let cur = { q: [], n: [] };
    const push = () => { if (cur.n.length) items.push(cur); cur = { q: [], n: [] }; };
    seg.forEach((t) => {
      if (vzIsQty(t)) { if (cur.n.length) push(); cur.q.push(t); }
      else if (["y", "e", "mas", "con", "tambien"].includes(t)) { if (cur.n.length) push(); }
      else if (VZ_FN.has(t) || ["mercaderia", "inventario", "nuevos", "nuevas"].includes(t)) { /* relleno */ }
      else cur.n.push(t);
    });
    push();
    const res = items.map((it) => { const q = vzQty(it.q); return q && q.val > 0 && !q.sol ? { tipo: "ingreso", nombre: it.n.join(" "), cantidad: q.val, unidad: q.kg ? "kg" : "unid" } : null; }).filter(Boolean);
    if (res.length) return res;
  }
  // «el precio del huevo a siete soles» (sin verbo) cambia el precio
  const iPr = toks.indexOf("precio");
  if (iPr >= 0 && !toks.includes("cuanto") && !j.includes("a como") && !toks.some((t) => /^(cuesta|cuestan|vale|valen|sale|salen)$/.test(t))) {
    const iA = toks.findIndex((t, i) => i > iPr && (t === "a" || t === "en" || t === "por")), m = iA > iPr ? vzMoney(toks.slice(iA + 1)) : 0;
    const nombre = iA > iPr ? toks.slice(iPr + 1, iA).filter((t) => !VZ_FN.has(t) && !vzIsNum(t)).join(" ") : "";
    if (m > 0 && nombre) return [{ tipo: "actualizar", nombre, precio: m }];
  }
  // precio y stock de un producto
  const pr = toks.some((t) => /^(cuesta|cuestan|vale|valen|precio|sale|salen|cobran|cobras|cobro)$/.test(t)) || j.includes("a como") || (toks.includes("cuanto") && toks.some((t) => /^(esta|estan|es|son|sera|seria|lo|la|los|las|el|un|una)$/.test(t))), st = toks.some((t) => /^(quedan|queda|quedo|hay|stock|tengo|tenemos)$/.test(t));
  if ((pr || st) && !toks.some((t) => VZ_ANOTA.has(t) || VZ_PAGA.has(t) || VZ_FIA.has(t) || VZ_COBRA.has(t) || VZ_QUITA.has(t))) {
    const nombre = toks.filter((t) => !VZ_FN.has(t) && !vzIsNum(t)).join(" ");
    return nombre ? [{ tipo: pr ? "precio" : "stock", nombre }] : [];
  }
  // producto nuevo: «crea producto galleta soda a un sol»
  const ip = toks.findIndex((t) => t === "producto" || t === "articulo");
  if (ip >= 0 && toks.some((t) => VZ_ANOTA.has(t) || t === "nuevo")) {
    const rest = toks.slice(ip + 1).filter((t) => t !== "nuevo"), cut = rest.findIndex((t) => vzIsQty(t) || ["a", "en", "por", "cuesta", "vale", "precio", "costo", "stock"].includes(t));
    const nombre = (cut >= 0 ? rest.slice(0, cut) : rest).join(" "), tail = cut >= 0 ? rest.slice(cut) : [];
    const ic = tail.indexOf("costo"), is = tail.indexOf("stock");
    const ends = [ic, is].filter((x) => x >= 0), pTail = ends.length ? tail.slice(0, Math.min(...ends)) : tail;
    const seg = (i, o) => { if (i < 0) return []; const f = o.filter((x) => x > i); return tail.slice(i + 1, f.length ? Math.min(...f) : tail.length); };
    const precio = vzMoney(pTail), costo = vzMoney(seg(ic, [is])), sq = vzQty(seg(is, [ic]).filter(vzIsQty)), kg = pTail.some((t) => /^(kilo|kilos|kg)$/.test(t));
    return nombre ? [{ tipo: "crear_producto", nombre, ...(precio ? { monto: precio } : {}), ...(costo ? { costo } : {}), ...(sq && sq.val > 0 && !sq.sol ? { stock: sq.val } : {}), unidad: kg ? "kg" : "unid" }] : [];
  }
  // vaciar el ticket
  if (toks.some((t) => VZ_VACIA.has(t)) && toks.some((t) => t === "ticket" || t === "cuenta" || t === "todo") || toks.some((t) => VZ_QUITA.has(t)) && toks.some((t) => t === "todo" || t === "todos") ) return [{ tipo: "vaciar" }];
  // cortar en órdenes: cada verbo abre una
  const kind = (t) => (VZ_PAGA.has(t) ? "pagar" : VZ_FIA.has(t) ? "fiar" : VZ_COBRA.has(t) ? "cobrar" : VZ_QUITA.has(t) ? "quitar" : VZ_CAMBIA.has(t) ? "cambiar" : VZ_ANOTA.has(t) ? "anotar" : "");
  const cuts = []; toks.forEach((t, i) => { if (kind(t)) cuts.push(i); });
  if (!cuts.length) cuts.push(-1); // sin verbo: solo vale si empieza con cantidad («un yogurt»)
  cuts.forEach((c, n) => {
    const seg = toks.slice(c + 1, n + 1 < cuts.length ? cuts[n + 1] : toks.length), k = c >= 0 ? kind(toks[c]) : "anotar";
    // «anota fiado a rosa 10 soles» es un fiado
    if ((k === "anotar" || k === "cobrar") && seg[0] && VZ_FIA.has(seg[0])) return out.push(...vzParseFia(seg.slice(1)));
    if (k === "fiar") return out.push(...vzParseFia(seg));
    // «cobra con efectivo, paga con cincuenta»: el «paga con» es con cuánto paga el cliente, no un pago a proveedor
    if (k === "pagar" && seg[0] === "con" && out.length && out[out.length - 1].tipo === "cobrar" && out[out.length - 1].medio === "efectivo") {
      const m = vzMoney(seg.slice(1).filter((t) => !VZ_MEDIOS.has(t))); if (m) { out[out.length - 1].monto = m; return; }
    }
    if (k === "cobrar" || (k === "pagar" && !vzNameAfterA(seg) && seg.some((t) => VZ_MEDIOS.has(t)))) {
      const medio = seg.find((t) => VZ_MEDIOS.has(t)) || "efectivo", monto = vzMoney(seg.filter((t) => !VZ_MEDIOS.has(t)));
      return out.push({ tipo: "cobrar", medio, ...(monto && medio === "efectivo" ? { monto } : {}) });
    }
    if (k === "pagar") { const nombre = vzNameAfterA(seg), monto = vzMoney(seg), medio = seg.find((t) => VZ_MEDIOS.has(t)); return nombre && out.push({ tipo: "pagar_proveedor", nombre, ...(monto ? { monto } : {}), ...(medio ? { medio } : {}) }); }
    if (k === "quitar") {
      const iq = seg.findIndex(vzIsQty), q = iq >= 0 ? vzQty(seg.filter(vzIsQty)) : null;
      const raw = seg.filter((t) => !vzIsQty(t) && !VZ_FN.has(t) && t !== "ticket" && t !== "y" && t !== "e"), nom = raw.filter((t) => !VZ_ULT.has(t)), nombre = nom.join(" ");
      const ult = !nombre && (raw.length > 0 || iq >= 0); // «quita 1», «quita eso», «quita el último»
      if (!nombre && !ult) return;
      return out.push({ tipo: "quitar", nombre, ...(ult ? { ultimo: true } : {}), ...(q && q.val > 0 && !q.sol ? { cantidad: q.val, unidad: q.kg ? "kg" : "unid" } : {}) });
    }
    if (k === "cambiar") {
      let ia = -1; seg.forEach((t, i) => { if (["a", "por", "en", "sean", "son"].includes(t) && i > 0 && seg.slice(i + 1).some(vzIsQty)) ia = i; });
      if (ia < 0) return;
      const q = vzQty(seg.slice(ia + 1).filter(vzIsQty)), nombre = seg.slice(0, ia).filter((t) => !VZ_FN.has(t) && !vzIsQty(t)).join(" ");
      return nombre && q && q.val > 0 && !q.sol && out.push({ tipo: "cambiar", nombre, cantidad: q.val, unidad: q.kg ? "kg" : "unid" });
    }
    const pi = seg.indexOf("por"), porOk = pi > 0 && !seg.slice(0, pi).some(vzIsQty) && seg.slice(pi + 1).some(vzIsQty); // «pan por un sol cincuenta»
    if (c < 0 && !porOk) { const f = seg.findIndex(vzIsQty); if (f < 0 || f > 2 || !seg.slice(0, f).every((t) => VZ_FN.has(t) || t === "y")) return; seg.splice(0, f); } // sin verbo vale si empieza con cantidad (ignorando «los», «y»…)
    // anotar: partir en productos cuando aparece una cantidad nueva o «y/con/más»
    let cur = { q: [], n: [] }; const items = [];
    const push = () => { if (cur.n.length) items.push(cur); cur = { q: [], n: [] }; };
    let por = false;
    seg.forEach((t, i) => {
      if (vzIsQty(t)) { if (cur.n.length && !por) push(); cur.q.push(t); }
      else if (t === "por" && cur.n.length && seg.slice(i + 1).some(vzIsQty)) { por = true; cur.q = []; } // «pan POR un sol»: lo que sigue es el monto
      else if (["y", "e", "mas", "con", "tambien"].includes(t)) { if (cur.n.length) { push(); por = false; } }
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

// Chrome da varias opciones de cada frase; me quedo con la que la caja entiende mejor (más productos encontrados).
function vzMejor(top, segs) {
  try {
    if (!segs.length || segs.every((a) => a.length < 2)) return top;
    const score = (t) => { const pl = vzPlan(vzParse(t)); return pl.filter((x) => x.ok).length * 3 - pl.filter((x) => !x.ok).length * 2 - pl.filter((x) => x.ok && /\(oí /.test(x.txt)).length; };
    const base = segs.map((a) => a[0]), cands = [base.join(" ")];
    segs.forEach((a, i) => a.slice(1).forEach((alt) => { const c = base.slice(); c[i] = alt; cands.push(c.join(" ")); }));
    let best = cands[0], bs = score(best);
    cands.slice(1).forEach((c) => { const sc = score(c); if (sc > bs) { bs = sc; best = c; } });
    return best.trim() || top;
  } catch (e) { return top; }
}

/* ---------- buscar nombres en lo que ya tiene la caja ---------- */
const VZ_STOP = new Set(["de", "del", "la", "el", "los", "las", "un", "una", "unos", "unas", "y", "con", "para", "a", "al", "dona", "don", "senora", "senor", "sra", "sr"]);
const vzStem = (w) => (w.length > 4 ? w.replace(/(es|s)$/, "") : w.replace(/s$/, ""));
const vzToks = (s) => norm(s).replace(/[^a-z0-9ñ ]/g, " ").split(/\s+/).filter((w) => w && !VZ_STOP.has(w)).map(vzStem);
const vzHit = (q, w) => w === q || (q.length >= 3 && w.startsWith(q)) || (w.length >= 3 && q.startsWith(w));
// Suena parecido: «zeboya» ≈ «cebolla», «inka» ≈ «inca» (b/v, c/s/z, ll/y, h muda...).
function vzSound(w) {
  return norm(w).replace(/[^a-z]/g, "").replace(/h/g, "").replace(/ll/g, "y").replace(/qu/g, "k").replace(/c(?=[ei])/g, "s").replace(/z/g, "s").replace(/c/g, "k").replace(/v/g, "b").replace(/w/g, "u").replace(/g(?=[ei])/g, "j").replace(/gu(?=[ei])/g, "g").replace(/x/g, "s").replace(/(.)\1+/g, "$1")
    .replace(/^rr/, "r").replace(/([aeiou])\1/g, "$1");
}
function vzDist(a, b) {
  const m = a.length, n = b.length; if (!m || !n) return Math.max(m, n);
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return prev[n];
}
const vzMax = (len) => (len <= 3 ? 0 : len <= 5 ? 1 : 2);
// Devuelve { it } si hay uno claro, { amb: [...] } si hay varios parecidos, {} si no hay. { aprox } = lo adiviné por el sonido.
function vzFind(list, name, getName, nojoin) {
  const q = vzToks(name); if (!q.length) return {};
  const cand = list.filter((x) => { const w = vzToks(getName(x)); return q.every((t) => w.some((y) => vzHit(t, y))); });
  if (cand.length === 1) return { it: cand[0] };
  if (cand.length) {
    const ex = cand.filter((x) => { const w = vzToks(getName(x)); return w.length === q.length; });
    if (ex.length === 1) return { it: ex[0] };
    return { amb: cand.slice(0, 3).map(getName), ambIt: cand.slice(0, 3) };
  }
  // nada exacto: probar por parecido de sonido (voz arrastrada, mal pronunciada o mal oída)
  const qs = q.map(vzSound), scored = [];
  list.forEach((x) => {
    const ws = vzToks(getName(x)).map(vzSound); let tot = 0;
    for (const t of qs) { if (t.length < 3) return; let best = 9; ws.forEach((w) => { const d = Math.min(vzDist(t, w), w.length >= 3 && t.length >= 3 ? vzDist(t, w.slice(0, t.length)) : 9); if (d < best) best = d; }); if (best > vzMax(t.length)) return; tot += best; }
    scored.push({ x, tot });
  });
  if (!scored.length) {
    // a veces se oye una palabra partida: «a tun» por «atún», «coca cola» por «cocacola»
    if (!nojoin) {
      const raw = norm(name).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
      for (let i = 0; i + 1 < raw.length; i++) { const r = vzFind(list, raw.slice(0, i).concat(raw[i] + raw[i + 1], raw.slice(i + 2)).join(" "), getName, true); if (r.it) return { it: r.it, aprox: true }; }
    }
    return {};
  }
  scored.sort((a, b) => a.tot - b.tot);
  if (scored.length === 1 || scored[0].tot < scored[1].tot) return { it: scored[0].x, aprox: true };
  { const top = scored.filter((c) => c.tot === scored[0].tot).slice(0, 3); return { amb: top.map((c) => getName(c.x)), ambIt: top.map((c) => c.x) }; }
}
const vzAp = (r, nombre) => (r.aprox ? ` (oí «${nombre}»)` : "");

/* ---------- respuestas: se escriben y (si está activado) se dicen en voz alta ---------- */
const vzHabla = () => !DB.cfg.vozCalla; // Ajustes › Pantalla de venta: «La voz responde hablando»
function vzShutUp() { try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {} }
function vzDi(txt) {
  if (!vzHabla() || !txt) return;
  try {
    const ss = window.speechSynthesis; if (!ss || typeof SpeechSynthesisUtterance === "undefined") return;
    ss.cancel();
    const u = new SpeechSynthesisUtterance(txt), vs = ss.getVoices ? ss.getVoices() : [];
    const v = vs.find((x) => /^es[-_]PE/i.test(x.lang)) || vs.find((x) => /^es[-_](MX|US|419|AR|CO|CL)/i.test(x.lang)) || vs.find((x) => /^es/i.test(x.lang));
    u.lang = v ? v.lang : "es-PE"; if (v) u.voice = v; u.rate = 1;
    ss.speak(u);
  } catch (e) {}
}
// «4 soles con 50», «70 céntimos»: así se lee bien en voz alta
const vzSoles = (n) => { n = r2(n); const e = Math.floor(n), c = Math.round((n - e) * 100); if (!e && c) return `${c} céntimos`; return `${e} ${e === 1 ? "sol" : "soles"}${c ? ` con ${c}` : ""}`; };
const vzQDi = (n) => fmtQ(n).replace(".", ",");
// fn(dinero, cantidad) → frase escrita y frase hablada
const vzMk = (fn) => ({ w: fn(money, fmtQ), say: fn(vzSoles, vzQDi) });
// Línea del plan que es solo una respuesta: si es lo único que pediste, se muestra y se dice al instante (sin «Aceptar»)
const vzAns = (txt, ans) => ({ ok: true, txt, ans, modal: true, run: () => vzResponder([{ ans }], "") });
const amb = (r, a) => ({ ok: false, txt: `«${a.nombre}»: ¿cuál? ${r.amb.join(", ")}`, pick: r.amb.map((n) => ({ label: n, a: { ...a, nombre: n } })) });
function vzAnsProd(p, tipo) {
  const kg = p.unit === "kg", f = p.stock == null ? null : p.stock;
  const rows = [["Precio", money(p.price) + (kg ? " /kg" : "")], ...(p.pres || []).map((x) => [x.name, money(x.price)]), ["Stock", f == null ? "No llevas stock" : `${fmtQ(f)}${kg ? " kg" : " und."}`]];
  const m = vzMk((d, q) => tipo === "stock"
    ? (f == null ? `No llevas el stock de ${p.name}.` : f <= 0 ? `Ya no queda ${p.name}.` : `Quedan ${q(f)}${kg ? " kilos" : ""} de ${p.name}${f <= (p.min || 0) ? ", ya está bajo" : ""}.`)
    : `${p.name} ${kg ? "está a" : "cuesta"} ${d(p.price)}${kg ? " el kilo" : ""}.`);
  return { title: p.name, w: m.w, say: m.say, rows };
}
function vzConsulta(a) {
  const k = a.consulta;
  if (k === "ventas_hoy") {
    if (!(can("caja") || can("reportes"))) return { ok: false, txt: "Tu usuario no puede ver las ventas del día" };
    const lbl = a.medio ? METHODS[a.medio] || a.medio : "";
    return vzAns(a.medio ? `Ver cuánto entró hoy por ${lbl}` : "Ver las ventas de hoy", () => {
      const t = dayTotals(dkey()), by = { efectivo: t.efectivo, yape: t.yapeAll, plin: t.plin, tarjeta: t.tarjeta, transferencia: (t.by || {}).transferencia || 0 };
      const rows = [...(a.medio ? [["Total", money(t.total)]] : []), ["Ventas", String(t.n)], ["Efectivo", money(t.efectivo)], ["Yape", money(t.yapeAll)], ["Plin", money(t.plin)], ["Tarjeta", money(t.tarjeta)]];
      const m = vzMk((d) => a.medio ? `Hoy entraron ${d(by[a.medio] || 0)} por ${lbl}.` : t.n ? `Hoy vendiste ${d(t.total)} en ${t.n} ${t.n === 1 ? "venta" : "ventas"}.` : "Hoy todavía no hay ventas.");
      return { title: "Ventas de hoy", w: m.w, say: m.say, rows, big: t.n || a.medio ? money(a.medio ? by[a.medio] || 0 : t.total) : "" };
    });
  }
  if (k === "ganancia") {
    if (!can("costos")) return { ok: false, txt: "Tu usuario no puede ver las ganancias" };
    const g = vzRango(a.per), cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    return vzAns(`Ver la ganancia de ${g.label}`, () => {
      const A = aggregate(repSales(g.from, g.to, "local")), sinCosto = Object.values(A.prod).filter((o) => o.m > 0 && !(o.c > 0)).length;
      const nota = A.n && sinCosto ? ` Ojo: ${sinCosto === 1 ? "un producto no tiene" : sinCosto + " productos no tienen"} costo, así que es aproximada.` : "";
      const m = vzMk((d) => A.n ? `${cap(g.label)} vendiste ${d(A.net)} y ganaste unos ${d(A.profit)}.${nota}` : `${cap(g.label)} no hay ventas.`);
      return { title: "Ganancia", w: m.w, say: m.say, big: A.n ? money(A.profit) : "", rows: A.n ? [["Vendido", money(A.net)], ["Costo", money(A.cost)], ["Ganancia", money(A.profit)], ["Margen", `${A.net ? Math.round((A.profit / A.net) * 100) : 0} %`]] : [] };
    });
  }
  if (k === "mas_vendidos") {
    if (!(can("caja") || can("reportes"))) return { ok: false, txt: "Tu usuario no puede ver las ventas" };
    const g = vzRango(a.per);
    return vzAns(`Ver lo más vendido ${g.label}`, () => {
      const A = aggregate(repSales(g.from, g.to, "local")), l = Object.entries(A.prod).sort((x, y) => y[1].q - x[1].q).slice(0, 5);
      const fq = (o) => `${fmtQ(o.q)}${o.unit === "kg" ? " kg" : " und"}`;
      const m = vzMk(() => l.length ? `Lo más vendido ${g.label} es ${l[0][0]}, ${fq(l[0][1])}.${l.length > 1 ? ` Luego ${l.slice(1, 3).map((x) => x[0]).join(" y ")}.` : ""}` : `${g.label === "hoy" ? "Hoy" : "En ese tiempo"} todavía no hay ventas.`);
      const mx = l.length ? l[0][1].q || 1 : 1;
      return { title: "Lo más vendido", w: m.w, say: m.say, rows: l.map(([n, o]) => [n, `${fq(o)} · ${money(o.m)}`, Math.max(.06, o.q / mx)]) };
    });
  }
  if (k === "caja") {
    if (!can("caja")) return { ok: false, txt: "Tu usuario no puede ver la caja" };
    return vzAns("Ver cuánto hay en caja", () => {
      const abiertos = DB.shifts.filter((s) => !s.t1);
      if (!abiertos.length) return { title: "Caja", w: "No hay una caja abierta ahora.", say: "No hay una caja abierta ahora.", rows: [] };
      const ef = r2(abiertos.reduce((x, s) => x + shiftSummary(s).expected, 0)), m = vzMk((d) => `En caja deberías tener ${d(ef)} en efectivo.`);
      return { title: "Caja", w: m.w, say: m.say, big: money(ef), rows: [] };
    });
  }
  if (k === "deuda") {
    if (a.prov) {
      if (!can("caja")) return { ok: false, txt: "Tu usuario no puede ver lo que debes a proveedores" };
      let s = null;
      if (a.nombre) { const r = vzFind(DB.supp, a.nombre, (x) => x.name); if (r.amb) return amb(r, a); if (!r.it) return { ok: false, txt: `No encontré al proveedor «${a.nombre}»` }; s = r.it; }
      return vzAns(s ? `Ver cuánto le debes a ${s.name}` : "Ver cuánto debes a proveedores", () => {
        if (s) { const b = Math.max(0, suppBal(s)), m = vzMk((d) => b ? `Le debes ${d(b)} a ${s.name}.` : `No le debes nada a ${s.name}.`); return { title: s.name, w: m.w, say: m.say, rows: [["Deuda", money(b)]] }; }
        const l = DB.supp.filter((x) => suppBal(x) > 0).sort((x, y) => suppBal(y) - suppBal(x)), tot = suppTotalDebt();
        const m = vzMk((d) => l.length ? `Debes ${d(tot)} a ${l.length} ${l.length === 1 ? "proveedor" : "proveedores"}. ${l.slice(0, 3).map((x) => `${x.name} ${d(suppBal(x))}`).join(", ")}.` : "No le debes nada a ningún proveedor.");
        return { title: "Deuda a proveedores", w: m.w, say: m.say, rows: l.slice(0, 8).map((x) => [x.name, money(suppBal(x))]) };
      });
    }
    if (!(can("clientes") || can("abonos") || can("credito"))) return { ok: false, txt: "Tu usuario no puede ver las deudas de clientes" };
    let c = null;
    if (a.nombre) { const r = vzFind(DB.clients, a.nombre, (x) => x.name); if (r.amb) return amb(r, a); if (!r.it) return { ok: false, txt: `No encontré al cliente «${a.nombre}»` }; c = r.it; }
    return vzAns(c ? `Ver cuánto te debe ${c.name}` : "Ver quién te debe", () => {
      if (c) { const b = balanceOf(c), m = vzMk((d) => b ? `${c.name} te debe ${d(b)}.` : `${c.name} no te debe nada.`); return { title: c.name, w: m.w, say: m.say, rows: [["Debe", money(b)]] }; }
      const l = DB.clients.map((x) => ({ x, b: balanceOf(x) })).filter((y) => y.b > 0).sort((y, z) => z.b - y.b), tot = r2(l.reduce((acc, y) => acc + y.b, 0));
      const m = vzMk((d) => l.length ? `Te deben ${d(tot)} en total, ${l.length} ${l.length === 1 ? "cliente" : "clientes"}. ${l.slice(0, 3).map((y) => `${y.x.name} ${d(y.b)}`).join(", ")}.` : "Nadie te debe nada.");
      return { title: "Quién te debe", w: m.w, say: m.say, rows: l.slice(0, 8).map((y) => [y.x.name, money(y.b)]) };
    });
  }
  if (k === "bajos") {
    return vzAns("Ver qué se está acabando", () => {
      const l = lowItems(), m = vzMk((d, q) => l.length ? `Se están acabando ${l.length} ${l.length === 1 ? "producto" : "productos"}: ${l.slice(0, 4).map((p) => p.stock <= 0 ? `${p.name} (ya no queda)` : `${p.name} (${q(p.stock)})`).join(", ")}${l.length > 4 ? " y otros más" : ""}.` : "Todo bien: ningún producto está bajo de stock.");
      return { title: "Se está acabando", w: m.w, say: m.say, rows: l.slice(0, 10).map((p) => [p.name, p.stock <= 0 ? "Agotado" : `quedan ${fmtQ(p.stock)}${p.unit === "kg" ? " kg" : ""}`]) };
    });
  }
  if (k === "ticket") {
    return vzAns("Ver el total del ticket", () => {
      const T = cartTotals(), m = vzMk((d) => T.count ? `El ticket va en ${d(T.total)}${T.disc ? `, con descuento de ${d(T.disc)}` : ""}.` : "El ticket está vacío.");
      return { title: "Ticket", w: m.w, say: m.say, rows: T.count ? [["Productos", String(T.count)], ["Total", money(T.total)]] : [] };
    });
  }
  return { ok: false, txt: "No entendí esta pregunta" };
}

/* ---------- convertir cada orden en una línea de «Entendí» ---------- */
function vzPlan(acc, prev) {
  const pend = (prev || []).filter((x) => x.ok && x.add).map((x) => x.add[0]); // productos que ya vas a anotar en esta misma lista
  let willAdd = pend.length > 0;
  const lineOf = (nombre) => vzFind(cartLines().filter((x) => !x.l.quick), nombre, (x) => x.r.name);
  return acc.map((a) => {
    if (a.tipo === "consulta") return vzConsulta(a);
    if (a.tipo === "descuento") {
      if (!can("descuento")) return { ok: false, txt: "Tu usuario no puede hacer descuentos" };
      if (!cartLines().length && !willAdd) return { ok: false, txt: "Descuento: primero anota los productos" };
      if (!a.pct && !a.monto) return { ok: true, txt: "Quitar el descuento del ticket", exec: () => { DB.cart.disc = 0; save(); paintCart(); } };
      if (a.pct && a.pct >= 100) return { ok: false, txt: "Descuento: el porcentaje debe ser menor a 100" };
      if (a.monto && !willAdd && a.monto > cartTotals().sub) return { ok: false, txt: `Descuento: ${money(a.monto)} es más que el ticket (${money(cartTotals().sub)})` };
      return { ok: true, txt: a.pct ? `Descuento de ${fmtQ(a.pct)} % al ticket` : `Descuento de ${money(a.monto)} al ticket`, exec: () => {
        const sub = cartTotals().sub, v = Math.min(a.pct ? r2(sub * a.pct / 100) : r2(a.monto), sub); if (!(v > 0)) return;
        DB.cart.disc = v; log("Descuento", `${money(v)} en ${ticketLabel(DB.cart)} (voz)`); save(); paintCart();
      } };
    }
    if (a.tipo === "anotar") {
      const r = vzFind(DB.products.filter((p) => p.on !== false), a.nombre, (p) => p.name);
      if (r.amb) return amb(r, a);
      const p = r.it; if (!p) return { ok: false, txt: `No encontré el producto «${a.nombre}»` };
      if ((p.pres || []).length) return { ok: false, txt: `${p.name}: tiene presentaciones, tócalo para elegir una` };
      const kg = p.unit === "kg";
      if (kg && !a.cantidad && !a.monto) return { ok: false, txt: `${p.name}: dime cuánto pesa (por ejemplo «un cuarto»)` };
      if (!kg && a.unidad === "kg") return { ok: false, txt: `${p.name} se vende por unidad, no por peso` };
      if (!kg && a.monto && !a.cantidad) return { ok: false, txt: `${p.name}: dime cuántas unidades, no los soles` };
      if (kg && a.unidad === "unid" && !a.monto) return { ok: false, txt: `${p.name}: dime cuánto pesa (por ejemplo «un kilo» o «medio kilo»)` };
      if (kg && !a.cantidad && a.monto) { if (!(p.price > 0)) return { ok: false, txt: `${p.name}: dime cuánto pesa` }; a.cantidad = r3(a.monto / p.price); }
      const qty = r3(a.cantidad || 1);
      willAdd = true; pend.push(p);
      return { ok: true, txt: `${fmtQ(qty)}${kg ? " kg" : ""} × ${p.name}${vzAp(r, a.nombre)}`, add: [p, qty], rc: { q: `${fmtQ(qty)}${kg ? " kg" : ""}`, n: p.name, amt: r2(qty * (p.price || 0)) } };
    }
    if (a.tipo === "quitar" && (a.ultimo || pend.length)) {
      // algo que acabas de decir en esta misma frase («anota 2 atunes, quita 1»): se quita al aceptar, ya anotado
      const rp = a.ultimo ? { it: pend[pend.length - 1] } : vzFind(pend, a.nombre, (x) => x.name), pp = rp.it;
      if (pp) {
        const kg = pp.unit === "kg";
        if (a.cantidad && !kg && a.unidad === "kg") return { ok: false, txt: `${pp.name} se vende por unidad, no por peso` };
        const cant = a.cantidad || 0;
        return { ok: true, txt: cant ? `Quitar ${fmtQ(cant)}${kg ? " kg" : ""} de ${pp.name}${vzAp(rp, a.nombre)}` : `Quitar ${pp.name}${vzAp(rp, a.nombre)}`,
          exec: () => { const x = cartLines().find((y) => y.l.id === pp.id && !y.l.pres); if (!x) return; setLine(x.l.id, x.l.pres, cant && cant < x.l.qty ? r3(x.l.qty - cant) : 0); } };
      }
    }
    if (a.tipo === "quitar" && a.ultimo) {
      const ls = cartLines().filter((x) => !x.l.quick).pop();
      if (!ls) return { ok: false, txt: "No hay nada en el ticket para quitar" };
      a = { ...a, nombre: ls.r.name };
    }
    if (a.tipo === "quitar" || a.tipo === "cambiar") {
      const r = lineOf(a.nombre);
      if (r.amb) return amb(r, a);
      const x = r.it; if (!x) return { ok: false, txt: `No encuentro «${a.nombre}» en el ticket` };
      const kg = x.r.unit === "kg";
      if (a.cantidad && !kg && a.unidad === "kg") return { ok: false, txt: `${x.r.name} se vende por unidad, no por peso` };
      if (a.cantidad && kg && a.unidad === "unid" && a.tipo === "cambiar") return { ok: false, txt: `${x.r.name}: dime cuánto pesa (por ejemplo «un kilo»)` };
      const sufijo = kg ? " kg" : "";
      if (a.tipo === "cambiar") return { ok: true, txt: `Cambiar ${x.r.name} a ${fmtQ(a.cantidad)}${sufijo}${vzAp(r, a.nombre)}`, exec: () => setLine(x.l.id, x.l.pres, r3(a.cantidad)) };
      if (!a.cantidad || a.cantidad >= x.l.qty) return { ok: true, txt: `Quitar ${x.r.name} del ticket${vzAp(r, a.nombre)}`, exec: () => setLine(x.l.id, x.l.pres, 0) };
      return { ok: true, txt: `Quitar ${fmtQ(a.cantidad)}${sufijo} de ${x.r.name}`, exec: () => setLine(x.l.id, x.l.pres, r3(x.l.qty - a.cantidad)) };
    }
    if (a.tipo === "vaciar") {
      const n = cartLines().length; if (!n) return { ok: false, txt: "El ticket ya está vacío" };
      return { ok: true, txt: `Vaciar el ticket (${n} ${n === 1 ? "producto" : "productos"})`, exec: () => { DB.cart.items = []; save(); paintSale(); } };
    }
    if (a.tipo === "cobrar") {
      if (!can("cobrar")) return { ok: false, txt: "Tu usuario no puede cobrar" };
      if (!cartLines().length && !willAdd) return { ok: false, txt: "Cobrar: primero anota los productos" };
      const mt = METHODS[a.medio] || "Efectivo";
      return { ok: true, modal: true, pay: { medio: a.medio || "efectivo", monto: a.monto || 0 }, txt: `Cobrar el ticket con ${mt}${a.monto ? ` (paga con ${money(a.monto)})` : ""}`, run: () => vzCobrar(a.medio, a.monto) };
    }
    if (a.tipo === "crear_producto") {
      if (!can("precios")) return { ok: false, txt: "Tu usuario no puede crear productos" };
      const r = vzFind(DB.products, a.nombre, (p) => p.name);
      if (r.it && vzToks(r.it.name).length === vzToks(a.nombre).length) return { ok: false, txt: `Ya existe «${r.it.name}»` };
      if (!a.monto) return { ok: false, txt: `Producto «${a.nombre}»: dime el precio (por ejemplo «a dos cincuenta»)` };
      const nm = a.nombre.replace(/\b\w/g, (c) => c.toUpperCase());
      return { ok: true, modal: true, txt: `Crear producto «${nm}» a ${money(a.monto)}${a.unidad === "kg" ? " por kilo" : ""}${a.costo ? `, costo ${money(a.costo)}` : ""}${a.stock ? `, stock ${fmtQ(a.stock)}` : ""} (lo revisas antes de guardar)`, run: () => vzNuevo(nm, a.monto, a.unidad === "kg", a.costo, a.stock) };
    }
    if (a.tipo === "actualizar") {
      const r = vzFind(DB.products.filter((p) => p.on !== false), a.nombre, (p) => p.name);
      if (r.amb) return amb(r, a);
      const p = r.it; if (!p) return { ok: false, txt: `No encontré el producto «${a.nombre}»` };
      if (a.codigo && !can("precios")) return { ok: false, txt: "Tu usuario no puede cambiar códigos" };
      if (a.codigo) {
        if (a.codigo.length < 4) return { ok: false, txt: `${p.name}: el código «${a.codigo}» es muy corto. Dilo número por número` };
        const dup = DB.products.find((x) => x.id !== p.id && (x.code === a.codigo || (x.pres || []).some((y) => y.code === a.codigo)));
        if (dup) return { ok: false, txt: `El código ${a.codigo} ya lo usa «${dup.name}»` };
      }
      if (a.precio && !can("precios")) return { ok: false, txt: "Tu usuario no puede cambiar precios" };
      if (a.costo && !can("costos")) return { ok: false, txt: "Tu usuario no puede cambiar costos" };
      if (a.stock != null && !can("stock")) return { ok: false, txt: "Tu usuario no puede cambiar el stock" };
      if (a.stock != null && p.stock == null) return { ok: false, txt: `${p.name}: no llevas stock de este producto. Actívalo en su ficha` };
      const kg = p.unit === "kg", partes = [];
      if (a.precio) partes.push(`precio ${money(a.precio)} (antes ${money(p.price)})`);
      if (a.costo) partes.push(`costo ${money(a.costo)}${p.cost ? ` (antes ${money(p.cost)})` : ""}`);
      if (a.stock != null) partes.push(`stock ${fmtQ(a.stock)}${kg ? " kg" : ""} (antes ${fmtQ(p.stock)})`);
      if (a.codigo) partes.push(`código ${a.codigo}${p.code ? ` (antes ${p.code})` : ""}`);
      if (!partes.length) return { ok: false, txt: `${p.name}: dime qué cambiar (precio, costo, stock o código)` };
      return { ok: true, txt: `${p.name}${vzAp(r, a.nombre)}: ${partes.join(", ")}`, exec: () => {
        if (a.precio && a.precio !== p.price) log("Cambio de precio", `${p.name}: ${money(p.price)} → ${money(a.precio)} (voz)`);
        if (a.precio) p.price = r2(a.precio);
        if (a.costo) p.cost = r2(a.costo);
        if (a.codigo) p.code = a.codigo;
        if (a.stock != null) stockAdd(p, r3(a.stock - p.stock), "ajuste", "Por voz");
        save(); toast("Producto actualizado"); render();
      } };
    }
    if (a.tipo === "activar" || a.tipo === "desactivar") {
      if (!can("precios")) return { ok: false, txt: "Tu usuario no puede cambiar productos" };
      const on = a.tipo === "activar", r = vzFind(DB.products.filter((p) => (p.on !== false) !== on), a.nombre, (p) => p.name);
      if (r.amb) return amb(r, a);
      const p = r.it; if (!p) return { ok: false, txt: on ? `No encontré «${a.nombre}» entre los productos ocultos` : `No encontré el producto «${a.nombre}»` };
      return { ok: true, txt: `${on ? "Mostrar" : "Ocultar"} ${p.name} en la venta${vzAp(r, a.nombre)}`, exec: () => { p.on = on; log(on ? "Producto activado" : "Producto desactivado", p.name + " (voz)"); save(); toast(on ? "Producto visible" : "Producto oculto"); render(); } };
    }
    if (a.tipo === "categoria") {
      if (!can("precios")) return { ok: false, txt: "Tu usuario no puede cambiar productos" };
      const r = vzFind(DB.products.filter((p) => p.on !== false), a.nombre, (p) => p.name);
      if (r.amb) return amb(r, a);
      const p = r.it; if (!p) return { ok: false, txt: `No encontré el producto «${a.nombre}»` };
      const cats = [...new Set(DB.products.map((x) => x.cat).filter(Boolean))], rc = vzFind(cats, a.categoria, (c) => c);
      const nueva = !rc.it, cat = rc.it || a.categoria.replace(/\b\w/g, (c) => c.toUpperCase());
      if (p.cat === cat) return { ok: false, txt: `${p.name} ya está en «${cat}»` };
      return { ok: true, txt: `Pasar ${p.name}${vzAp(r, a.nombre)} a la categoría «${cat}»${nueva ? " (nueva)" : ""}`, exec: () => { p.cat = cat; save(); toast("Categoría cambiada"); render(); } };
    }
    if (a.tipo === "ingreso") {
      if (!can("stock")) return { ok: false, txt: "Tu usuario no puede ingresar mercadería" };
      const r = vzFind(DB.products.filter((p) => p.on !== false), a.nombre, (p) => p.name);
      if (r.amb) return amb(r, a);
      const p = r.it; if (!p) return { ok: false, txt: `No encontré el producto «${a.nombre}»` };
      if (p.stock == null) return { ok: false, txt: `${p.name}: no llevas stock de este producto. Actívalo en su ficha` };
      const kg = p.unit === "kg"; if (!kg && a.unidad === "kg") return { ok: false, txt: `${p.name} se vende por unidad, no por peso` };
      const q = r3(a.cantidad || 0); if (!(q > 0)) return { ok: false, txt: `${p.name}: dime cuántos llegaron` };
      return { ok: true, txt: `Sumar ${fmtQ(q)}${kg ? " kg" : ""} al stock de ${p.name}${vzAp(r, a.nombre)} (quedan ${fmtQ(r3(p.stock + q))})`, exec: () => { stockAdd(p, q, "ingreso", "Por voz"); save(); toast("Stock actualizado"); render(); } };
    }
    if (a.tipo === "precio" || a.tipo === "stock") {
      const r = vzFind(DB.products.filter((p) => p.on !== false), a.nombre, (p) => p.name);
      if (r.amb) return amb(r, a);
      if (!r.it) return { ok: false, txt: `No encontré el producto «${a.nombre}»` };
      return vzAns(`Ver ${a.tipo === "precio" ? "el precio" : "el stock"} de ${r.it.name}${vzAp(r, a.nombre)}`, () => vzAnsProd(r.it, a.tipo));
    }
    if (a.tipo === "pagar_proveedor") {
      if (!can("caja")) return { ok: false, txt: "Tu usuario no puede pagar a proveedores" };
      const r = vzFind(DB.supp, a.nombre, (s) => s.name);
      if (r.amb) return amb(r, a);
      if (!r.it) { const rc = vzFind(DB.clients, a.nombre, (c) => c.name); if (rc.it || rc.amb) return vzAbono({ ...a, tipo: "abono" }); return { ok: false, txt: `No encontré al proveedor «${a.nombre}»` }; } // «abónale a Rosa»: si es cliente, es su deuda
      if (!a.monto) return { ok: false, txt: `Pago a ${r.it.name}: dime el monto` };
      return { ok: true, modal: true, txt: `Pagar ${money(a.monto)} a ${r.it.name}${vzAp(r, a.nombre)}${a.medio ? " (" + METHODS[a.medio].toLowerCase() + ")" : ""}`, run: () => vzPagar(r.it, a.monto, a.medio) };
    }
    if (a.tipo === "abono") return vzAbono(a);
    if (a.tipo === "repetir") {
      const sv = DB.sales.filter((x) => !x.void && x.items && x.items.length).sort((x, y) => y.t - x.t)[0];
      if (!sv) return { ok: false, txt: "Todavía no hay ventas para repetir" };
      const its = sv.items.filter((i) => i.quick || (prod(i.id) && prod(i.id).on !== false));
      if (!its.length) return { ok: false, txt: "Los productos de la última venta ya no están" };
      const nom = its.slice(0, 3).map((i) => String(i.name).replace(/ \(.*\)$/, "")).join(", ") + (its.length > 3 ? " y más" : "");
      willAdd = true;
      return { ok: true, txt: `Repetir la última venta: ${nom} (${its.length} ${its.length === 1 ? "producto" : "productos"}, ${money(sv.total)})`, exec: () => {
        its.forEach((i) => { if (i.quick) DB.cart.items.push({ id: "q" + uid(), pres: "", quick: true, name: i.name, price: i.price, qty: i.qty }); else addToCart(prod(i.id), i.qty, i.pres || ""); });
        save(); paintSale();
      } };
    }
    if (a.tipo === "fiado") {
      const r = vzFind(DB.clients, a.nombre, (c) => c.name);
      if (r.amb) return amb(r, a);
      if (!r.it) return { ok: false, txt: `No encontré al cliente «${a.nombre}»` };
      if (!a.monto && !cartLines().length && !willAdd) return { ok: false, txt: `Fiado a ${r.it.name}: dime el monto o anota primero los productos` };
      return { ok: true, modal: true, txt: a.monto ? `Fiar ${money(a.monto)} a ${r.it.name}${vzAp(r, a.nombre)}` : `Fiar este ticket a ${r.it.name}${vzAp(r, a.nombre)}`, run: () => vzFiar(r.it, a.monto) };
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
function vzAbono(a) {
  if (!can("abonos")) return { ok: false, txt: "Tu usuario no puede cobrar deudas" };
  const r = vzFind(DB.clients, a.nombre, (c) => c.name);
  if (r.amb) return amb(r, a);
  if (!r.it) return { ok: false, txt: `No encontré al cliente «${a.nombre}»` };
  const c = r.it, debt = balanceOf(c);
  if (!(debt > 0)) return { ok: false, txt: `${c.name} no te debe nada` };
  if (!a.monto) return { ok: false, txt: `Pago de ${c.name}: dime el monto` };
  if (a.monto > debt + 0.001) return { ok: false, txt: `${c.name} solo debe ${money(debt)}` };
  return { ok: true, modal: true, txt: `Cobrar ${money(a.monto)} de la deuda de ${c.name}${vzAp(r, a.nombre)}${a.medio ? " (" + METHODS[a.medio].toLowerCase() + ")" : ""}`, run: () => vzAbonar(c, a.monto, a.medio) };
}
function vzAbonar(c, monto, medio) {
  openAbono(c.id);
  const i = $("#abq"); if (i) i.value = r2(monto).toFixed(2);
  if (medio && $(`#abm [data-m="${medio}"]`)) $(`#abm [data-m="${medio}"]`).click();
}
function vzFiar(c, monto) {
  setClient(c.id);
  if (monto) { DB.cart.items.push({ id: "q" + uid(), pres: "", quick: true, name: "Fiado", price: r2(monto), qty: 1 }); save(); paintSale(); }
  startPay("credito");
}
function vzCobrar(medio, monto) {
  startPay(medio);
  if (monto && ui.pay && ui.pay.method === "efectivo") { ui.pay.recv = String(monto); paintPay(); }
}
function vzNuevo(nombre, precio, kg, costo, stock) {
  openProduct("");
  if (!ui.pe) return;
  Object.assign(ui.pe.d, { name: nombre, price: String(precio), unit: kg ? "kg" : "u", ...(costo ? { cost: String(costo) } : {}), ...(stock ? { stock: String(stock) } : {}) }); paintPE();
}
function vzInfo(p) {
  const kg = p.unit === "kg", stock = p.stock == null ? "No llevas stock de este producto" : `${fmtQ(p.stock)}${kg ? " kg" : " und."}`;
  openModal(`<h2>${esc(p.name)}</h2><div class="kv"><span>Precio</span><b class="num">${money(p.price)}${kg ? " /kg" : ""}</b></div>
    ${(p.pres || []).map((x) => `<div class="kv"><span>${esc(x.name)}</span><b class="num">${money(x.price)}</b></div>`).join("")}
    <div class="kv"><span>Stock</span><b class="num">${esc(stock)}</b></div>
    <div class="btns h"><button class="btn" data-a="close" data-enter>Listo</button></div>`);
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
// Los 3 archivos del oído se guardan en IndexedDB (no en Cache Storage: el programa de Windows se cierra si se usa).
const VZ_TIPO = ["text/javascript", "text/javascript", "application/gzip"];
function vzDb() { return new Promise((ok, no) => { const r = indexedDB.open("cf-voz-db", 1); r.onupgradeneeded = () => r.result.createObjectStore("f"); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error || new Error("idb")); }); }
async function vzIdbGet(k) { const db = await vzDb(); return new Promise((ok, no) => { const q = db.transaction("f").objectStore("f").get(k); q.onsuccess = () => { db.close(); ok(q.result || null); }; q.onerror = () => { db.close(); no(q.error); }; }); }
async function vzIdbPut(k, blob) { const db = await vzDb(); return new Promise((ok, no) => { const tx = db.transaction("f", "readwrite"); tx.objectStore("f").put(blob, k); tx.oncomplete = () => { db.close(); ok(); }; tx.onerror = tx.onabort = () => { db.close(); no(tx.error || new Error("idb")); }; }); }
// Devuelve el archivo guardado. Quien ya la instaló en el navegador (versión anterior, Cache Storage) la pasa a IndexedDB sola.
async function vzFile(f) {
  let b = await vzIdbGet(f); if (b) return b;
  if (!vzElectron && typeof caches !== "undefined") { try { if (!(await caches.has(VZ_CACHE))) return null; const r = await (await caches.open(VZ_CACHE)).match(f); if (r) { b = await r.blob(); await vzIdbPut(f, b); return b; } } catch (e) {} }
  return null;
}
// Baja los 3 archivos y los guarda. cb(0..1) para la barra.
async function vzInstall(cb) {
  const sizes = [5.8e6, 3e3, 34.5e6], tot = sizes.reduce((x, y) => x + y, 0); let done = 0;
  for (let i = 0; i < VZ_FILES.length; i++) {
    if (await vzFile(VZ_FILES[i])) { done += sizes[i]; cb && cb(done / tot); continue; }
    const r = await fetch(VZ_FILES[i], { cache: "no-store" }); if (!r.ok || !r.body) throw new Error("http " + r.status);
    const rd = r.body.getReader(), parts = []; let got = 0;
    for (;;) { const { done: d, value } = await rd.read(); if (d) break; parts.push(value); got += value.length; cb && cb((done + got) / tot); }
    await vzIdbPut(VZ_FILES[i], new Blob(parts, { type: VZ_TIPO[i] }));
    done += sizes[i];
  }
  try { localStorage.setItem("cf-voz-off", "1"); } catch (e) {}
}
async function vzGetBlobs() {
  if (vzBlobs) return vzBlobs;
  const out = [];
  for (const f of VZ_FILES) { const b = await vzFile(f); if (!b) throw new Error("falta " + f); out.push(URL.createObjectURL(b)); }
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
  const w = new Set("desactiva desactivar oculta esconde activa activar muestra categoría categoria código codigo barras mueve mover pasa asigna actualiza actualízale actualizar sube súbele baja bájale fija edita costo precio stock inventario llegaron llegó ingresa ingresaron ingresó repón repone reponer entraron recibí nuevo producto anota anótame agrega agrégame pon ponme añade añádeme suma apunta apúntame dame registra paga págale pagar abona abónale fía fíale fiado crédito cuánto cuanto vendí vendido vendimos ventas hoy resumen del día de la el un una uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciséis diecisiete dieciocho diecinueve veinte veintiún veintiuno veintidós veintitrés veinticuatro veinticinco treinta cuarenta cincuenta sesenta setenta ochenta noventa cien ciento doscientos trescientos cuatrocientos quinientos medio media cuarto cuartos kilo kilos gramos soles sol y a al por con más también yape plin efectivo transferencia para tarjeta quita quítale quitar saca sácame elimina borra bórrame retira vacía vaciar limpia limpiar cambia cámbiale cambiar modifica corrige cobra cóbrame cobrar cóbrale cuesta cuestan vale valen precio stock quedan queda quedó hay tengo tenemos producto nuevo crea crear docena docenas par pares kilito kilitos todo todos ticket cuenta mil cuántos cuántas es son están está qué cuál debe deben debo debemos deuda deudas deudor deudores quién quiénes fiados acabando acaba acabar acabarse agotando agotado agotados faltan falta poco pocos descuento descuentito rebaja rebájale descuenta ciento porciento por ciento caja sale salen cobran cobras cobro cómo como total llevo sería seria va echa échame echame échale alcánzame pásame márcame cárgame yapeo yapeado yapéame plineo cash contado visa seiscientos setecientos ochocientos novecientos veintiséis veintisiete veintiocho veintinueve le les lo nos te se".split(" "));
  const add = (n) => String(n || "").toLowerCase().split(/[^a-záéíóúüñ]+/).forEach((x) => { if (x.length > 1) w.add(x); });
  DB.products.filter((p) => p.on !== false).forEach((p) => add(p.name)); DB.clients.forEach((c) => add(c.name)); DB.supp.forEach((c) => add(c.name));
  return [...w, "[unk]"];
}

/* ---------- pantallas: escuchando, entendí, errores ---------- */
function vzShow(html) { openModal(html); ui.mk = "voz"; }
const vzListenHtml = (txt) => `<div class="vzbox" role="status"><div class="vzmic"><i class="vzo"></i><i class="vzo b"></i><i class="vzo c"></i><span class="vzg">${svg("mic")}</span></div><h2>Te escucho…</h2><p class="vzt" id="vzt" aria-live="polite">${txt}</p>
  <div class="btns h"><button class="btn sec" data-a="vozpausa" id="vzp">Pausar</button><button class="btn" data-a="vozstop">Listo</button></div>
  <p class="sm" style="margin-top:6px"><button class="link" data-a="${vzKeep ? "vozback" : "close"}">Cancelar</button>${vzInstalled() || vzElectron ? "" : `<button class="link" data-a="vozinstall">Instalar voz sin internet (34 MB)</button>`}</p></div>`;
let vzKeep = null; // lista de la tarjeta «Entendí» que se conserva al tocar «Agregar más»
const VZ_PAUSA = 2500; // ms en silencio para dar por terminada la frase
const VZ_EJ = "Di, por ejemplo: «anota un yogurt y un cuarto de arroz» o «cobra con yape»";
let vzKn = null; // palabras de tus productos, clientes y proveedores (para marcar lo que la caja reconoce)
const vzNorm = (w) => w.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function vzKnown() {
  if (vzKn) return vzKn; vzKn = new Set();
  const add = (n) => String(n || "").split(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+/).forEach((x) => { if (x.length > 2) vzKn.add(vzNorm(x)); });
  DB.products.filter((p) => p.on !== false).forEach((p) => add(p.name)); DB.clients.forEach((c) => add(c.name)); DB.supp.forEach((c) => add(c.name));
  return vzKn;
}
// Lo que dices sale grande; los productos y nombres que la caja reconoce se marcan.
function vzSet(t) {
  const e = $("#vzt"); if (!e) return;
  if (/^«.*»$/s.test(t)) {
    const k = vzKnown(); e.classList.add("live");
    e.innerHTML = esc(t.slice(1, -1)).split(/(\s+)/).map((w) => (/^\s*$/.test(w) ? w : (k.has(vzNorm(w.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]/g, ""))) || /^\d+([.,]\d+)?$/.test(w)) ? `<mark class="vzw">${w}</mark>` : w)).join("");
    return;
  }
  e.classList.remove("live"); e.textContent = t;
}

function vozStart() {
  if (!vozOk()) return toast("La voz no está activada en tu caja. Pídela a tu proveedor.", true);
  stopVoz(); vzShutUp();
  if (SR && navigator.onLine && !vzElectron) return vzWeb();
  if (navigator.onLine && vzNubeOn() && window.MediaRecorder) return vzNubeRec(); // programa de Windows, iPhone…: oído en la nube (mucho mejor que el de 34 MB)
  if (vzInstalled()) return vzVosk();
  vzOfrecer(navigator.onLine ? "" : "Sin internet, la voz necesita instalarse en esta caja.");
}
function vzOfrecer(msg) {
  if (!navigator.onLine) return vzError(msg || "Sin internet. Conéctate una vez para instalar la voz sin internet.");
  vzShow(`<div class="vzbox"><div class="vzmic"><i class="vzo"></i><i class="vzo b"></i><i class="vzo c"></i><span class="vzg">${svg("mic")}</span></div><h2>Voz sin internet</h2><p class="muted" style="margin:6px 0 14px">${esc(msg || "")} Se instala una sola vez (34 MB) y después funciona sin internet.</p>
    <div class="btns h"><button class="btn sec" data-a="close">Ahora no</button><button class="btn" data-a="vozinstall" data-enter>Instalar (34 MB)</button></div></div>`);
}
async function vzDoInstall() {
  stopVoz();
  vzShow(`<div class="vzbox" role="status"><div class="vzmic busy"><i class="vzo"></i><i class="vzo b"></i><i class="vzo c"></i><span class="vzg">${svg("mic")}</span></div><h2>Instalando voz…</h2><div class="vzbar"><i id="vzbar"></i></div><p class="vzt" id="vzt">0 %</p></div>`);
  const mk = ui.mk;
  try { await vzInstall((f) => { const b = $("#vzbar"); if (b) b.style.transform = `scaleX(${f})`; vzSet(Math.round(f * 100) + " %"); }); }
  catch (e) { if (ui.mk === mk) vzError("No se pudo instalar. Revisa tu internet e intenta otra vez."); return; }
  if (ui.mk === mk) { toast("Voz instalada. Ya funciona sin internet"); vozStart(); }
}

/* oído de Chrome (con internet) */
function vzWeb() {
  const s = vz = { eng: "web", texto: "", base: "" };
  vzKn = null; vzShow(vzListenHtml(VZ_EJ));
  s.max = setTimeout(() => vz === s && vzStop(), 30000);
  vzWebRec(s);
}
// Un «oído» de Chrome; al pausar se apaga y al seguir se prende otro, juntando lo dicho.
function vzWebRec(s) {
  let rec; try { rec = new SR(); } catch (e) { stopVoz(); return vzVoskOrErr(); }
  rec.lang = "es-PE"; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 5;
  s.rec = rec;
  rec.onresult = (e) => { if (vz !== s || s.rec !== rec) return; let all = ""; for (let i = 0; i < e.results.length; i++) all += e.results[i][0].transcript + " "; try { s.altsCur = Array.from(e.results, (r) => Array.from(r, (x) => x.transcript)); } catch (er) {} s.texto = (s.base + " " + all).trim(); vzSet("«" + s.texto + "»"); clearTimeout(s.endT); s.endT = setTimeout(() => vz === s && vzStop(), VZ_PAUSA); }; // sigue escuchando hasta que callas un rato
  rec.onerror = (e) => {
    if (vz !== s || s.rec !== rec) return;
    if (e.error === "network" || e.error === "service-not-allowed" && !s.texto) { stopVoz(); return vzVoskOrErr(); }
    const m = { "not-allowed": "Permite el micrófono en el navegador y vuelve a intentar.", "no-speech": "No te escuché. Acércate al micrófono e intenta otra vez.", "audio-capture": "No encuentro el micrófono." }[e.error];
    if (m) { stopVoz(); vzError(m); }
  };
  rec.onend = () => { if (vz === s && s.rec === rec && !s.paused) vozSend(); };
  try { rec.start(); } catch (e) { stopVoz(); vzVoskOrErr(); }
}
// Pausar: deja de escuchar sin perder lo dicho. Seguir: continúa la misma frase.
function vzPausa() {
  const s = vz; if (!s || s.stopping || !s.eng) return;
  s.paused = !s.paused;
  clearTimeout(s.endT); clearTimeout(s.max);
  const b = $("#vzp"), m = $(".vzmic"), h = $("#modal h2");
  if (b) b.textContent = s.paused ? "Seguir" : "Pausar"; if (m) m.classList.toggle("busy", s.paused); if (h) h.textContent = s.paused ? "En pausa" : "Te escucho…";
  if (s.eng === "web") {
    if (s.paused) { s.base = s.texto; s.altsBase = (s.altsBase || []).concat(s.altsCur || []); s.altsCur = []; const r = s.rec; s.rec = null; try { r.onresult = r.onend = r.onerror = null; r.abort(); } catch (e) {} }
    else vzWebRec(s);
  } else if (s.eng === "nube") {
    try { if (s.paused) s.mrec.pause(); else s.mrec.resume(); } catch (e) {}
  } else {
    try { if (s.paused) s.src.disconnect(); else s.src.connect(s.node); } catch (e) {}
  }
  if (!s.paused) s.max = setTimeout(() => vz === s && vzStop(), 30000);
}
function vzVoskOrErr() { if (navigator.onLine && vzNubeOn() && window.MediaRecorder) vzNubeRec(); else if (vzInstalled()) vzVosk(); else vzOfrecer("Esta caja no puede usar el oído de internet."); }


/* oído en la nube (programa de Windows, iPhone…): graba, manda el audio con TUS productos como pista y vuelve el texto */
let vzNubeCaida = 0; // si la nube no responde (función no instalada o sin clave), se prueba de nuevo en 10 minutos
const vzNubeOn = () => { try { return localStorage.getItem("cf-voz-nube") !== "0" && cloudOn() && Date.now() - vzNubeCaida > 600000; } catch (e) { return false; } };
// El círculo del micrófono late con lo que oye: así ves si tu micrófono te escucha.
function vzMedidor(s, ac, src) {
  try {
    const an = ac.createAnalyser(); an.fftSize = 1024; src.connect(an); s.an = an; const buf = new Float32Array(an.fftSize);
    s.lvT = setInterval(() => { an.getFloatTimeDomainData(buf); let q = 0; for (let i = 0; i < buf.length; i++) q += buf[i] * buf[i]; s.rms = Math.sqrt(q / buf.length); const m = $(".vzmic"); if (m) m.style.setProperty("--lv", (1 + Math.min(.3, s.rms * 5)).toFixed(3)); }, 70);
  } catch (e) {}
}
async function vzNubeRec() {
  const s = vz = { eng: "nube", texto: "", heard: 0, last: 0, t0: Date.now(), floor: null };
  vzKn = null; vzShow(vzListenHtml("Preparando el micrófono…"));
  let ms;
  try { ms = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch (e) { if (vz !== s) return; stopVoz(); return vzError(e && e.name === "NotAllowedError" ? "Permite el micrófono y vuelve a intentar." : e && e.name === "NotFoundError" ? "No encuentro el micrófono." : "No se pudo prender el micrófono."); }
  if (vz !== s) { try { ms.getTracks().forEach((t) => t.stop()); } catch (e) {} return; }
  try {
    s.ms = ms; s.ac = new (window.AudioContext || window.webkitAudioContext)(); const src = s.ac.createMediaStreamSource(ms); vzMedidor(s, s.ac, src);
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((m) => MediaRecorder.isTypeSupported(m)) || "";
    const rec = s.mrec = new MediaRecorder(ms, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined), chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => { if (vz === s || s.stopping) vzNubeSend(s, chunks.length ? new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" }) : null); };
    rec.start(250); vzSet(VZ_EJ);
    // detector de voz: se corta solo cuando callas un rato; nunca antes de oírte hablar
    let calib = [];
    s.vadT = setInterval(() => {
      if (vz !== s || s.paused || s.stopping) return;
      const now = Date.now(), r = s.rms || 0;
      if (s.floor === null) { calib.push(r); if (now - s.t0 > 500) { calib.sort((a, b) => a - b); s.floor = calib[Math.floor(calib.length * .3)] || 0.003; } return; }
      const hablando = r > Math.max(0.012, s.floor * 3.2);
      if (hablando) { s.heard += 70; s.last = now; vzSet("Te escucho…"); }
      if (s.heard >= 300 && now - s.last > 1100) vzStop();
      else if (!s.heard && now - s.t0 > 7000) vzStop();
      else if (now - s.t0 > 22000) vzStop();
    }, 70);
  } catch (e) { if (vz === s) { stopVoz(); vzError("No se pudo grabar la voz. Intenta otra vez."); } }
}
async function vzNubeTexto(blob) {
  const tk = await cloudToken(), neg = cloudLoad().neg, fd = new FormData();
  fd.append("neg", neg); fd.append("catalogo", JSON.stringify(vzCatalogo()));
  fd.append("audio", blob, "voz." + (/mp4/.test(blob.type) ? "m4a" : /ogg/.test(blob.type) ? "ogg" : "webm"));
  const r = await fetch(`${SB_URL}/functions/v1/voz-oido`, { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + tk }, body: fd, signal: AbortSignal.timeout(20000) });
  if (!r.ok) { const e = new Error("nube " + r.status); e.st = r.status; throw e; }
  return String(((await r.json()) || {}).texto || "").trim();
}
async function vzNubeSend(s, blob) {
  if (s.sent) return; s.sent = true; const dur = Date.now() - s.t0, oyo = s.heard >= 300; if (vz === s) vz = null; vzCleanVosk(s);
  if (!blob || blob.size < 1500 || !oyo) { const k = vzKeep; if (k) { vzKeep = null; toast("No te escuché. Tu lista sigue igual"); return vzShowPlan(k.plan, k.texto); } return vzError("No te escuché. Acércate al micrófono e intenta otra vez."); }
  vzShow(`<div class="vzbox" role="status"><div class="vzmic busy"><i class="vzo"></i><i class="vzo b"></i><i class="vzo c"></i><span class="vzg">${svg("mic")}</span></div><h2>Entendiendo…</h2></div>`);
  const mk = ui.mk; let texto = "";
  try { texto = await vzNubeTexto(blob); }
  catch (e) {
    if (ui.mk !== mk) return;
    const st = e && e.st; if (!st || st === 404 || st === 503 || st === 502 || st >= 500) vzNubeCaida = Date.now();
    return vzError(st === 403 ? "Ya usaste toda la voz de hoy." : st === 429 ? "Muchos pedidos juntos. Espera unos segundos y vuelve a hablar." : vzInstalled() ? "La nube no respondió. La próxima vez uso la voz sin internet." : "La nube no respondió. Revisa tu internet e intenta otra vez.");
  }
  if (ui.mk !== mk) return;
  if (!texto) { const k = vzKeep; if (k) { vzKeep = null; toast("No te escuché. Tu lista sigue igual"); return vzShowPlan(k.plan, k.texto); } return vzError("No te escuché. Acércate al micrófono e intenta otra vez."); }
  vozSend({ eng: "nube", texto });
}

/* oído sin internet (Vosk) */
async function vzVosk() {
  const s = vz = { eng: "vosk", texto: "", fin: [], part: "" };
  vzKn = null; vzShow(vzListenHtml("Preparando la voz…"));
  let model, ms;
  try {
    model = await vzGetModel(); // primero el modelo, después el micrófono: así no se pierde lo que dices
    if (vz !== s) return vzCleanVosk(s);
    s.ac = new AudioContext({ sampleRate: 16000 }); await s.ac.audioWorklet.addModule((await vzGetBlobs()).proc);
    if (vz !== s) return vzCleanVosk(s);
  } catch (e) {
    if (vz !== s) return; stopVoz();
    if (e && /^falta /.test(e.message || "")) { try { localStorage.removeItem("cf-voz-off"); } catch (er) {} return vzOfrecer("Hay que instalar la voz de nuevo en esta caja."); }
    return vzError(e && e.name === "NotAllowedError" ? "Permite el micrófono en el navegador y vuelve a intentar." : e && e.name === "NotFoundError" ? "No encuentro el micrófono." : "No se pudo preparar la voz. Vuelve a instalarla desde el botón de voz.");
  }
  if (vz !== s) return vzCleanVosk(s);
  try {
    const ch = new MessageChannel(); model.registerPort(ch.port1);
    const rec = s.vrec = new model.KaldiRecognizer(16000, JSON.stringify(vzGrammar()));
    rec.on("result", (m) => { const t = ((m.result && m.result.text) || "").replace(/\[unk\]/g, " ").replace(/\s+/g, " ").trim(); if (t) s.fin.push(t); s.part = ""; vzSet("«" + s.fin.join(" ") + "»"); if (s.stopping) return vozSend(s); if (t) { clearTimeout(s.endT); s.endT = setTimeout(() => vzStop(), VZ_PAUSA); } });
    rec.on("partialresult", (m) => { const p = ((m.result && m.result.partial) || "").replace(/\[unk\]/g, " ").replace(/\s+/g, " ").trim(); if (p) { s.part = p; clearTimeout(s.endT); vzSet("«" + (s.fin.join(" ") + " " + p).trim() + "»"); } });
    const ac = s.ac;
    const node = new AudioWorkletNode(ac, "recognizer-processor", { channelCount: 1, numberOfInputs: 1, numberOfOutputs: 1 });
    node.port.postMessage({ action: "init", recognizerId: rec.id }, [ch.port2]);
    node.connect(ac.destination);
    await new Promise((ok) => setTimeout(ok, 350)); // deja que el oído termine de armarse
    ms = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: true, autoGainControl: true } }); // el micrófono se abre al final (volumen automático: los micrófonos de laptop suelen oír muy bajito)
    s.ms = ms; if (vz !== s) return vzCleanVosk(s);
    s.node = node; s.src = ac.createMediaStreamSource(ms); s.src.connect(node); vzMedidor(s, ac, s.src);
    vzSet(VZ_EJ);
    s.max = setTimeout(() => vz === s && vzStop(), 20000);
  } catch (e) { if (vz === s) { stopVoz(); vzError(e && e.name === "NotAllowedError" ? "Permite el micrófono en el navegador y vuelve a intentar." : e && e.name === "NotFoundError" ? "No encuentro el micrófono." : "No se pudo prender la voz. Intenta otra vez."); } }
}
// Termina de escuchar: pide lo último que oyó y sigue.
function vzStop() {
  const s = vz; if (!s || s.stopping) return;
  if (s.eng === "nube") { s.stopping = true; clearInterval(s.vadT); try { if (s.mrec.state === "paused") s.mrec.resume(); s.mrec.stop(); } catch (e) { vzNubeSend(s, null); } return; }
  if (s.eng !== "vosk") { if (s.paused || !s.rec) return vozSend(s); try { s.rec.stop(); } catch (e) { vozSend(s); } return; }
  s.stopping = true; clearTimeout(s.endT);
  try { s.vrec.retrieveFinalResult(); } catch (e) { return vozSend(s); }
  setTimeout(() => vozSend(s), 1500); // por si el oído no contesta
}

function vzError(msg) { vzShow(`<div class="vzbox"><h2>No pude</h2><p class="muted" style="margin:6px 0 14px">${esc(msg)}</p><div class="btns h"><button class="btn sec" data-a="close">Cerrar</button><button class="btn" data-a="voz">Intentar otra vez</button></div></div>`); }

// Entiende la frase con el intérprete de la caja (sin internet). Si no entiende nada y tú lo prendiste,
// pide ayuda a una IA gratuita (opcional; si falla se ignora).
async function vozSend(s) {
  s = s || vz; if (!s || s.sent) return; s.sent = true;
  let texto = (s.eng === "vosk" ? [...s.fin, s.part].filter(Boolean).join(" ") : s.texto || "").trim();
  if (s.eng !== "vosk" && texto) texto = vzMejor(texto, (s.altsBase || []).concat(s.altsCur || []));
  if (vz === s) vz = null; vzCleanVosk(s);
  if (!texto) { const k = vzKeep; if (k) { vzKeep = null; toast("No te escuché. Tu lista sigue igual"); return vzShowPlan(k.plan, k.texto); } return vzError("No te escuché. Acércate al micrófono e intenta otra vez."); }
  let acc = vzParse(texto);
  // Si la caja no entendió todo y hay IA, se le pide ayuda; me quedo con lo que entienda mejor (nunca empeora).
  const prev = vzKeep && vzKeep.plan, valor = (x) => { const pl = vzPlan(x, prev); return pl.filter((i) => i.ok).length * 3 - pl.filter((i) => !i.ok).length * 2; };
  if (navigator.onLine && vzIaOn() && (!acc.length || vzPlan(acc, prev).some((i) => !i.ok))) {
    vzShow(`<div class="vzbox" role="status"><div class="vzmic busy"><i class="vzo"></i><i class="vzo b"></i><i class="vzo c"></i><span class="vzg">${svg("mic")}</span></div><h2>Entendiendo…</h2><p class="vzt">«${esc(texto)}»</p></div>`);
    const ia = await vzNube(texto);
    if (ia.length && (!acc.length || valor(ia) > valor(acc))) acc = ia;
  }
  vzEntendi(texto, acc);
}
let vzIaCaida = 0; // si la IA no responde (no instalada o sin clave), no se vuelve a intentar por 10 minutos
const vzIaOn = () => { try { return localStorage.getItem("cf-voz-ia") !== "0" && cloudOn() && Date.now() - vzIaCaida > 600000; } catch (e) { return false; } };
const vzCatalogo = () => ({
  productos: DB.products.filter((p) => p.on !== false).slice(0, 400).map((p) => p.name),
  clientes: DB.clients.slice(0, 100).map((c) => c.name), proveedores: DB.supp.slice(0, 60).map((c) => c.name),
  ticket: cartLines().filter((x) => !x.l.quick).slice(0, 30).map((x) => x.r.name)
});
async function vzNube(texto) {
  try {
    const tk = await cloudToken(), neg = cloudLoad().neg;
    const r = await fetch(`${SB_URL}/functions/v1/voz`, { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + tk, "Content-Type": "application/json" }, body: JSON.stringify({ neg, texto, catalogo: vzCatalogo() }), signal: AbortSignal.timeout(9000) });
    if (!r.ok) { if (r.status === 404 || r.status === 503) vzIaCaida = Date.now(); return []; }
    const a = (await r.json()).acciones; return Array.isArray(a) ? a : [];
  } catch (e) { return []; }
}
function vzEntendi(texto, acc) {
  const k = vzKeep; vzKeep = null;
  if (!acc.length) {
    if (k) { toast("No entendí. Tu lista sigue igual"); return vzShowPlan(k.plan, k.texto); }
    return vzError(`No entendí «${texto}». Prueba con «anota un yogurt» o «paga 50 a Gloria».`);
  }
  let plan = vzPlan(acc, k && k.plan);
  if (k) { plan = k.plan.concat(plan); texto = k.texto + " + " + texto; } // se suma a lo que ya tenías
  vzShowPlan(plan, texto);
}
// Solo preguntas (precio, stock, ventas, deudas…): se responde al instante, escrito y en voz alta, sin pedir «Aceptar».
function vzResponder(plan, texto) {
  vz = null;
  const rs = plan.map((x) => { try { return x.ans(); } catch (e) { return null; } }).filter(Boolean);
  if (!rs.length) return closeModal();
  vzShow(`<div class="vzbox vzres" role="status">${rs.map((r) => `<h2>${esc(r.title)}</h2>${r.big ? `<div class="vzbig num">${esc(r.big)}</div><p class="vzans sm2">${esc(r.w)}</p>` : `<p class="vzans">${esc(r.w)}</p>`}${r.rows.length ? `<div class="vzrows">${r.rows.map(([l, v, f], i) => `<div class="kv${f ? " vzbr" : ""}"${f ? ` style="--f:${f.toFixed(3)};--i:${i}"` : ""}><span>${esc(l)}</span><b class="num">${esc(v)}</b></div>`).join("")}</div>` : ""}`).join("")}
    <p class="sm" style="margin-top:8px"><button class="link" data-a="vozhabla">${vzHabla() ? "Silenciar las respuestas habladas" : "Activar las respuestas habladas"}</button></p>
    <div class="btns h"><button class="btn sec" data-a="voz">Preguntar otra cosa</button><button class="btn" data-a="close" data-enter>Listo</button></div></div>`);
  vzDi(rs.map((r) => r.say).join(" "));
}
function vzShowPlan(plan, texto) {
  if (plan.length && plan.every((x) => x.ok && x.ans)) return vzResponder(plan, texto);
  vz = { plan, texto };
  const ok = plan.filter((x) => x.ok), modales = ok.filter((x) => x.modal).length;
  if (modales > 1) plan.forEach((x) => { if (x.modal && x !== ok.find((y) => y.modal)) { x.ok = false; x.txt += " (hazlo por separado, uno por vez)"; } });
  const hay = plan.some((x) => x.ok);
  const rc = plan.filter((x) => x.ok && x.rc), suma = r2(rc.reduce((t, x) => t + x.rc.amt, 0));
  // Cobrar desde la misma tarjeta: fichas de pago, y vuelto si dijiste con cuánto paga.
  const cob = plan.find((x) => x.ok && x.pay), puedeCobrar = hay && can("cobrar") && (rc.length || cartLines().length || cob);
  const totalCob = r2(cartTotals().total + suma), vuelto = cob && cob.pay.medio === "efectivo" && cob.pay.monto > totalCob ? r2(cob.pay.monto - totalCob) : 0;
  const cobLabel = cob ? (plan.some((x) => x.ok && (x.add || x.exec)) ? "Anotar y cobrar" : "Cobrar") : "Aceptar";
  vzShow(`<h2>Entendí</h2><p class="muted sm" style="margin-bottom:8px">«${esc(texto)}»</p>
    <div class="vzlist">${plan.map((x, i) => `<div class="vzl ${x.ok ? "" : "bad"}" style="--i:${i}"><span class="vzi">${x.ok ? svg("check") : svg("close")}</span>${x.rc ? `<span class="vzn"><b class="vzq">${esc(x.rc.q)}</b> ${esc(x.rc.n)}${x.txt.slice(x.txt.indexOf(x.rc.n) + x.rc.n.length) ? `<small>${esc(x.txt.slice(x.txt.indexOf(x.rc.n) + x.rc.n.length).trim())}</small>` : ""}</span><b class="num vzm">${money(x.rc.amt)}</b>` : `<span>${esc(x.txt)}${x.pick ? `<span class="vzpick">${x.pick.map((pk, k) => `<button class="btn sec sm" data-a="vozpick" data-i="${i}" data-j="${k}">${esc(pk.label)}</button>`).join("")}</span>` : ""}</span>`}</div>`).join("")}${rc.length ? `<div class="vzsum"><span>Suma de lo que anotas</span><b class="num">${money(suma)}</b></div>` : ""}</div>
    ${puedeCobrar ? `<div class="vzpayh">Cobrar con</div><div class="vzpay" role="group" aria-label="Cobrar con">${["efectivo", "yape", "plin", "tarjeta"].map((m) => `<button class="vzp${cob && cob.pay.medio === m ? " on" : ""}" data-a="vozpay" data-m="${m}">${METHODS[m]}</button>`).join("")}</div>${vuelto ? `<div class="vzsum"><span>Vuelto</span><b class="num">${money(vuelto)}</b></div>` : ""}` : ""}
    ${hay ? `<button class="btn sec" data-a="vozmas" style="width:100%;margin-top:10px">+ Agregar más</button>` : ""}
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button>${hay ? `<button class="btn" data-a="vozok" data-enter>${cobLabel}</button>` : `<button class="btn" data-a="voz">Hablar otra vez</button>`}</div>`);
}
// Un ✓ que aparece y se va, y una vibración corta si el equipo la tiene.
function vzTic() {
  try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) {}
  if (document.documentElement.dataset.input === "kbd") return;
  const d = document.createElement("div"); d.className = "vztic"; d.setAttribute("aria-hidden", "true"); d.innerHTML = svg("check");
  document.body.appendChild(d); setTimeout(() => d.remove(), 900);
}
function vozAccept() {
  const plan = ((vz && vz.plan) || []).filter((x) => x.ok); vz = null; if (!plan.length) return closeModal();
  closeModal();
  let n = 0; // en el orden en que lo dijiste: anotar, quitar, cambiar...
  plan.forEach((x) => { if (x.add) { addToCart(x.add[0], x.add[1]); n++; } else if (x.exec) { x.exec(); n++; } });
  if (n) { paintSale(); beep(true); vzTic(); toast(n === 1 ? "Listo" : `Listo: ${n} cambios en el ticket`); }
  const m = plan.find((x) => x.run); if (m) m.run();
}
act({
  voz: () => { vzKeep = null; vozStart(); },
  vozmas: () => { const p = vz && vz.plan; if (!p) return; vzKeep = { plan: p.filter((x) => x.ok), texto: vz.texto }; vozStart(); },
  vozback: () => { const k = vzKeep; vzKeep = null; stopVoz(); if (k) vzShowPlan(k.plan, k.texto); else closeModal(); },
  vozstop: vzStop, vozpausa: vzPausa, vozok: vozAccept, vozinstall: vzDoInstall,
  // Una ficha de pago: anota lo de la tarjeta y abre el cobro con ese método (nunca cobra solo).
  vozpay: (el) => {
    const s = vz; if (!s || !s.plan || !can("cobrar")) return;
    const m = el.dataset.m, old = s.plan.find((x) => x.pay), base = s.plan.filter((x) => !x.pay);
    const nuevo = vzPlan([{ tipo: "cobrar", medio: m, monto: m === "efectivo" && old ? old.pay.monto : 0 }], base)[0];
    if (!nuevo || !nuevo.ok) return toast(nuevo ? nuevo.txt : "No se puede cobrar", true);
    s.plan = base.concat(nuevo); vozAccept();
  },
  // «hay varios parecidos»: tocas el que quieres y esa línea se resuelve
  vozpick: (el) => {
    const s = vz; if (!s || !s.plan) return;
    const i = +el.dataset.i, pk = s.plan[i] && s.plan[i].pick && s.plan[i].pick[+el.dataset.j]; if (!pk) return;
    s.plan[i] = vzPlan([pk.a], s.plan.filter((_, k) => k !== i))[0];
    vzShowPlan(s.plan, s.texto);
  },
  vozhabla: () => {
    DB.cfg.vozCalla = !DB.cfg.vozCalla; save();
    if (DB.cfg.vozCalla) vzShutUp();
    toast(DB.cfg.vozCalla ? "La voz ya no habla" : "La voz responderá hablando");
    const b = $('[data-a="vozhabla"]'); if (b) b.textContent = vzHabla() ? "Silenciar las respuestas habladas" : "Activar las respuestas habladas";
  }
});
