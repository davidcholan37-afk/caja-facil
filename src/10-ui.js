/* ===================== 10 · INTERFAZ: estado, imágenes, avisos, ventanas, navegación ===================== */
const ui = { tab: "venta", q: "", cat: "", user: null, date: dkey(), range: "hoy", from: dkey(), to: dkey(), pay: null, locked: false, sel: null, pq: "", ptab: "lista", cq: "", vq: "", vtab: "ventas", rscope: "local", atab: "negocio", kxp: "" };
const DESK = () => window.matchMedia("(min-width:960px)").matches;
const A = {}; // acciones: data-a="nombre" en cualquier botón
const act = (o) => Object.assign(A, o);

/* ---------- imágenes de productos ---------- */
const IMGMAP = [
  [/papas? (fritas|lays)|papitas|\bchips|pringles|doritos|chizito|cuates|piqueo/, "papas_fritas"],
  [/sandwich|sanguche|butifarra|\btriple\b/, "sandwich"], [/hamburguesa/, "hamburguesa"], [/pizza/, "pizza"],
  [/\bsopa|\bcaldo|ramen|aji-no-men|maruchan|calducho/, "sopa"], [/\btamal|humita/, "tamal"],
  [/manzana verde/, "manzana_verde"], [/manzana/, "manzana"], [/panqueque|pancake/, "panqueque"], [/\bpanal|biberon|mamadera/, "biberon"],
  [/papaya/, "papaya"], [/\bmelon/, "melon"], [/pan frances|baguette|ciabatta/, "pan_frances"], [/croissant|cachito/, "croissant"],
  [/paneton|\bkeke|queque|cupcake|muffin|pionono/, "keke"], [/\btorta|pastel/, "torta"],
  [/\bpan\b|\bpanes\b|tostada|\bmolde\b|bizcocho/, "pan"],
  [/tomate/, "tomate"], [/\bcol\b|repollo/, "col"], [/lechuga|espinaca|acelga|\bapio/, "lechuga"], [/cebolla/, "cebolla"],
  [/\bpapas?\b|olluco|\byuca/, "papa"], [/camote/, "camote"], [/beterraga|betarraga|remolacha/, "beterraga"], [/zanahoria|\bnabo/, "zanahoria"], [/\bajos?\b/, "ajo"],
  [/pimiento (rojo|morron)|pimenton/, "pimiento_rojo"], [/pimiento amarillo/, "pimiento_amarillo"], [/pimiento/, "pimiento"], [/\baji\b|rocoto|\bchile\b/, "aji"], [/zapallito|calabac|zucchini/, "zapallito"], [/pepino/, "pepino"],
  [/brocoli|coliflor/, "brocoli"], [/choclo|\bmaiz|\bcancha\b/, "choclo"], [/berenjena/, "berenjena"], [/palta|aguacate/, "palta"],
  [/limon amarillo/, "limon_amarillo"], [/limon|\blima\b/, "limon"], [/champi|\bhongo/, "champinon"], [/\bkion|jengibre/, "kion"], [/arveja|vainita|\bhaba/, "arveja"],
  [/maracuy|granadilla/, "maracuya"], [/\bgranadas?\b/, "granada"], [/ciruela/, "ciruela"], [/esparrago/, "esparrago"], [/\bporo\b|puerro/, "poro"],
  [/frejol|frijol|lenteja|pallar|garbanzo|menestra/, "menestra"], [/aceituna/, "aceituna"],
  [/culantro|perejil|hierbabuena|huacatay|albahaca|\bmenta\b|oregano|romero/, "hierbas"],
  [/platano|banana|guineo/, "platano"], [/mandarina|tangelo|clementina/, "mandarina"], [/toronja|pomelo/, "toronja"], [/naranja/, "naranja"], [/\bmango/, "mango"], [/\bpinas?\b/, "pina"],
  [/\buvas?\b/, "uva"], [/fresa|frutilla/, "fresa"], [/\bperas?\b/, "pera"], [/durazno|melocoton|nectarin/, "durazno"], [/sandia/, "sandia"],
  [/cereza|guinda/, "cereza"], [/\bkiwi/, "kiwi"], [/\bcoco\b/, "coco"],
  [/\barroz/, "arroz"], [/avena|quinua|\btrigo|cereal|kiwicha|harina|semola/, "cereal"],
  [/huevo/, "huevo"], [/leche|yogur/, "leche"], [/queso/, "queso"], [/mantequilla|margarina/, "mantequilla"],
  [/\bsal\b/, "sal"], [/\bmiel\b/, "miel"], [/mermelada|mayonesa|ketchup|mostaza|\bsalsa|manjar|frasco/, "frasco"],
  [/\batun|sardina|conserva|\blata\b|filete de/, "conserva"], [/fideo|tallarin|spaghetti|macarron|canuto|tornillo|\bpasta\b|codito/, "fideos"],
  [/aceite/, "aceite"], [/vinagre|sillao|\bsoya\b|botella/, "botella"],
  [/chocolate|sublime|cua cua|beso de moza|princesa|wafer/, "chocolate"], [/caramelo|gomita|chicle|marshmallow|golosina/, "caramelo"], [/chupetin|chupete|\bpaleta\b/, "chupetin"],
  [/galleta|\bsoda\b|vainilla|\boreo|casino|morocha|chomp/, "galleta"], [/canchita|popcorn|palomita/, "canchita"], [/\bmani\b|pecana|\bnuez|almendra/, "mani"],
  [/\bdonas?\b|picaron/, "dona"], [/helado|frio rico/, "helado"],
  [/\bagua\b|san luis|\bcielo\b/, "agua"], [/cerveza|pilsen|cusquena|\bcristal\b/, "cerveza"], [/\bvino|pisco|\bron\b|whisky|vodka|coctel/, "vino"],
  [/espumante|champan|sidra/, "espumante"], [/\bjugo|nectar|frugos|\bpulp|cifrut|chicha/, "jugo"], [/\bcafe\b|nescafe|kirma|altomayo/, "cafe"],
  [/\bte\b|infusion|manzanilla|\banis\b|hierba luisa|mate de/, "te"], [/\bmate\b/, "mate"],
  [/gaseosa|\bcola\b|\bkola\b|\bcoca\b|sprite|fanta|pepsi|guarana|seven up|7 ?up|bebida|refresco|energizante|\bvolt\b|gatorade|sporade/, "gaseosa"],
  [/pollo|gallina|pechuga|\balitas?\b/, "pollo"], [/chancho|cerdo|costilla|chuleta/, "cerdo"], [/tocino|jamon|chorizo/, "tocino"],
  [/salchicha|hot ?dog/, "salchicha"], [/carne|\bres\b|bistec|\blomo\b|molida|guiso/, "carne"],
  [/pescado|jurel|bonito|tilapia|trucha|caballa|merluza/, "pescado"], [/langostino|camaron|marisco/, "langostino"],
  [/detergente|\bace\b|bolivar|\bopal\b|ariel|suavizante|lejia|clorox|limpiador|poett/, "detergente"],
  [/papel bond|cuaderno|\bblock\b/, "cuaderno"], [/jabon/, "jabon"], [/esponja|lavavajilla|sapolio/, "esponja"],
  [/papel|servilleta/, "papel"], [/cepillo|pasta dental|dental|colgate|kolynos/, "cepillo"],
  [/shampoo|champu|acondicionador|crema|locion|desodorante|\bgel\b/, "shampoo"], [/escoba|recogedor|trapeador/, "escoba"], [/\bbalde|\btina\b|batea/, "balde"],
  [/cigarr|hamilton|marlboro|lucky/, "cigarro"], [/\bbolsas?\b/, "bolsa"], [/taper|descartable|tecnopor/, "taper"],
  [/hielo|cubito/, "hielo"], [/\bvelas?\b/, "vela"], [/pastilla|paracetamol|panadol|ibuprofeno|medicina|jarabe|aspirina/, "medicina"],
  [/\bpilas?\b|bateria|duracell/, "pilas"], [/\bfoco|lampara/, "foco"], [/perro|ricocan|mimaskot|canbo/, "perro"], [/\bgato|whiskas|michi/, "gato"],
  [/lapiz|lapicero|plumon|borrador|colores/, "lapiz"], [/juguete|peluche|pelota/, "peluche"], [/labial|maquillaje|esmalte|rimel/, "labial"], [/recarga|servicio/, "billete"]
];
const CATMAP = [[/verdur|hortaliza/, "brocoli"], [/fruta/, "manzana"], [/licor|cerveza|vino/, "cerveza"], [/bebida|gaseosa|refresco/, "gaseosa"], [/lacteo|leche/, "leche"], [/panader|\bpan/, "pan"], [/carne|pollo|embutido/, "carne"], [/pescad|marisco/, "pescado"], [/limpieza/, "detergente"], [/higiene|cuidado|perfum|tocador/, "shampoo"], [/golosina|dulce|confite/, "caramelo"], [/snack|piqueo/, "canchita"], [/abarrote/, "canasta"], [/farmacia|botica|medic/, "medicina"], [/mascota/, "perro"], [/libreria|util|escolar/, "lapiz"], [/bazar|plastico/, "bolsa"], [/comida|menu|plato|cocina/, "sopa"], [/helado/, "helado"]];
const IMGNAME = { tomate: "Tomate", lechuga: "Lechuga", cebolla: "Cebolla", papa: "Papa", zanahoria: "Zanahoria", ajo: "Ajo", pimiento: "Pimiento", aji: "Ají", pepino: "Pepino", brocoli: "Brócoli", choclo: "Choclo", berenjena: "Berenjena", palta: "Palta", limon: "Limón", limon_amarillo: "Limón amarillo", papaya: "Papaya", col: "Col", mandarina: "Mandarina", toronja: "Toronja", maracuya: "Maracuyá", granada: "Granada", ciruela: "Ciruela", esparrago: "Espárrago", poro: "Poro", beterraga: "Beterraga", zapallito: "Zapallito", pimiento_rojo: "Pimiento rojo", pimiento_amarillo: "Pimiento amarillo", champinon: "Champiñón", kion: "Kion", arveja: "Arveja", menestra: "Menestras", camote: "Camote", aceituna: "Aceituna", hierbas: "Hierbas", platano: "Plátano", manzana: "Manzana", manzana_verde: "Manzana verde", naranja: "Naranja", mango: "Mango", pina: "Piña", uva: "Uva", fresa: "Fresa", pera: "Pera", durazno: "Durazno", sandia: "Sandía", melon: "Melón", cereza: "Cereza", kiwi: "Kiwi", coco: "Coco", arroz: "Arroz", cereal: "Cereales", pan: "Pan", pan_frances: "Pan francés", croissant: "Cachito", huevo: "Huevo", huevos: "Huevos", leche: "Leche", queso: "Queso", mantequilla: "Mantequilla", sal: "Sal", miel: "Miel", frasco: "Frasco", conserva: "Conserva", fideos: "Fideos", aceite: "Aceite", botella: "Botella", chocolate: "Chocolate", caramelo: "Caramelo", chupetin: "Chupetín", galleta: "Galleta", canchita: "Canchita", mani: "Maní", dona: "Dona", keke: "Keke", torta: "Torta", pastel: "Pastel", helado: "Helado", helado_cono: "Helado de cono", gaseosa: "Gaseosa", agua: "Agua", cerveza: "Cerveza", brindis: "Cervezas", vino: "Vino", espumante: "Espumante", jugo: "Jugo", cafe: "Café", te: "Té", mate: "Mate", vaso: "Vaso", biberon: "Biberón", carne: "Carne", pollo: "Pollo", cerdo: "Cerdo", tocino: "Tocino", pescado: "Pescado", langostino: "Langostino", salchicha: "Hot dog", jabon: "Jabón", detergente: "Detergente", esponja: "Esponja", papel: "Papel", cepillo: "Cepillo", shampoo: "Shampoo", escoba: "Escoba", balde: "Balde", cigarro: "Cigarro", caja: "Caja", carrito: "Carrito", bolsa: "Bolsa", canasta: "Canasta", taper: "Táper", sandwich: "Sándwich", hamburguesa: "Hamburguesa", papas_fritas: "Papitas", pizza: "Pizza", sopa: "Sopa", tamal: "Tamal", pretzel: "Pretzel", panqueque: "Panqueque", hielo: "Hielo", dinero: "Dinero", billete: "Billete", vela: "Vela", galleta_arroz: "Galleta de arroz", medicina: "Medicina", pilas: "Pilas", foco: "Foco", perro: "Perro", gato: "Gato", cuaderno: "Cuaderno", lapiz: "Lápiz", peluche: "Peluche", labial: "Labial" };
function imgKey(p) {
  if (p.img && /^(lib|foto):/.test(p.img)) return p.img.slice(p.img.indexOf(":") + 1);
  const n = norm(p.name);
  for (const [re, k] of IMGMAP) if (re.test(n)) return k;
  const c = norm(p.cat);
  for (const [re, k] of CATMAP) if (re.test(c)) return k;
  return "caja";
}
const FOTO = () => window.CF_FOTO || {};
// "foto": fotografía real (de la tienda o del celular); "art": ilustración 3D sobre fondo de color.
function imgKind(p) {
  if (!p) return "art";
  if (p.img && p.img.startsWith("data:")) return "foto";
  if (p.img && p.img.startsWith("lib:")) return "art";
  return FOTO()[imgKey(p)] ? "foto" : "art";
}
function imgSrc(p) {
  if (p && p.img && p.img.startsWith("data:")) return p.img;
  const I = window.CF_IMG || {}, k = imgKey(p);
  if (imgKind(p) === "foto") return FOTO()[k];
  return I[k] || I.caja || "";
}
const catImg = (c) => {
  const I = window.CF_IMG || {}, F = FOTO();
  if (c === "__top") return I.carrito; if (c === "__fav") return I.canasta;
  const p = DB.products.find((x) => x.cat === c && imgKind(x) === "foto") || DB.products.find((x) => x.cat === c);
  if (p) return imgSrc(p);
  const n = norm(c); for (const [re, k] of CATMAP) if (re.test(n)) return F[k] || I[k];
  return I.caja;
};
// Cartulinas fosforescentes de mercado: el color del precio de cada producto.
const CARDS = ["#FFE53D", "#9BEA5A", "#FF9A3D", "#6FD3FF", "#FF6FB0", "#FFFFFF"];
const CARDNAME = ["Amarillo", "Verde", "Naranja", "Celeste", "Rosado", "Blanco"];
const OLDTINT = { "#E8F5E9": 1, "#FFF3E0": 2, "#E3F2FD": 3, "#FCE4EC": 4, "#F3E5F5": 4, "#E0F7FA": 3, "#FFFDE7": 0, "#EFEBE9": 5 };
const CATCARD = [[/verdur|hortaliza/, 1], [/fruta/, 2], [/bebida|gaseosa|refresco|licor|cerveza|\bagua/, 3], [/snack|golosina|dulce|confite|piqueo/, 4], [/abarrote/, 0], [/lacteo|leche|queso/, 5], [/panader|\bpan/, 2], [/limpieza|higiene|tocador|aseo/, 3], [/carne|pollo|embutido|pescad/, 4]];
const TINTS = CARDS;
function tintOf(p) {
  const c = String(p.color || "").toUpperCase();
  if (c) return CARDS.includes(c) ? c : OLDTINT[c] != null ? CARDS[OLDTINT[c]] : c;
  const n = norm(p.cat || "");
  for (const [re, i] of CATCARD) if (re.test(n)) return CARDS[i];
  return CARDS[[...norm(p.cat || p.name)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 5];
}
const pimg = (p, cls = "pim") => { const s = imgSrc(p); return s ? `<img class="${cls} k-${imgKind(p)}" src="${s}" alt="" loading="lazy" decoding="async">` : `<span class="${cls} noimg" aria-hidden="true">${esc((p.name || "?").slice(0, 1).toUpperCase())}</span>`; };
// Foto tomada con el celular o elegida de la PC: se recorta cuadrada y se achica para que ocupe poco.
function readPhoto(file, cb) {
  if (!file) return;
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => {
    const S = 320, c = document.createElement("canvas"); c.width = c.height = S;
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, S, S);
    const r = Math.max(S / img.width, S / img.height), w = img.width * r, h = img.height * r;
    x.drawImage(img, (S - w) / 2, (S - h) / 2, w, h); URL.revokeObjectURL(url);
    cb(c.toDataURL("image/jpeg", 0.82));
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast("No se pudo leer esa imagen"); };
  img.src = url;
}

/* ---------- sonido y avisos ---------- */
let ac;
function beep(ok = true) {
  if (DB.cfg.mute) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = "sine"; o.frequency.value = ok ? 880 : 200;
    g.gain.setValueAtTime(0.08, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12);
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.13);
  } catch (e) {}
  if (!ok && navigator.vibrate) navigator.vibrate(60);
}
let toastT;
function toast(msg, long) {
  const t = $("#toast"); if (!t) return;
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), long ? 4200 : 2400);
}

/* ---------- ventanas ---------- */
let modalBack = null;
function openModal(html, cls = "") {
  const m = $("#modal"); if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  ui.mk = "";
  const sh = $(".sheet", m); sh.className = "sheet " + cls; sh.innerHTML = html; m.hidden = false; sh.scrollTop = 0;
  document.body.classList.add("noscroll");
  const f = $("[autofocus]", m); if (f && (DESK() || f.dataset.mfocus !== undefined)) setTimeout(() => { f.focus(); if (f.select && f.value) f.select(); }, 60);
}
function closeModal() {
  const m = $("#modal"); m.hidden = true; $(".sheet", m).innerHTML = ""; document.body.classList.remove("noscroll");
  ui.pay = null; ui.mk = ""; stopScaleRead(); stopCam();
  const b = modalBack; modalBack = null; if (b) return b();
  focusQ();
}
const modalOpen = () => !$("#modal").hidden;
function confirmBox(msg, label, cb, danger = true, detail = "") {
  openModal(`<h2>${esc(msg)}</h2>${detail ? `<p class="muted" style="margin-bottom:6px">${detail}</p>` : ""}<div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn ${danger ? "red" : ""}" id="cfYes" data-enter>${esc(label)}</button></div>`);
  $("#cfYes").onclick = (e) => { e.stopPropagation(); closeModal(); cb(); };
}
// Pide un dato (motivo, nombre, monto...) en una ventana pequeña.
function promptBox(o, cb) {
  openModal(`<h2>${esc(o.title)}</h2>${o.text ? `<p class="muted" style="margin-bottom:12px">${o.text}</p>` : ""}
    <label class="fld"><span>${esc(o.label)}</span>${o.area ? `<textarea class="inp" id="pbv" rows="3" placeholder="${esc(o.ph || "")}" autofocus>${esc(o.value || "")}</textarea>` : `<input class="inp ${o.num ? "num" : ""}" id="pbv" ${o.num ? 'inputmode="decimal"' : ""} value="${esc(o.value || "")}" placeholder="${esc(o.ph || "")}" maxlength="${o.max || 80}" autofocus autocomplete="off">`}</label>
    <div class="btns h"><button class="btn sec" data-a="close">Cancelar</button><button class="btn ${o.danger ? "red" : ""}" id="pbok" data-enter>${esc(o.ok || "Guardar")}</button></div>`);
  $("#pbok").onclick = (e) => { e.stopPropagation(); const v = $("#pbv").value.trim(); if (o.required && !v) { toast(o.required); return; } closeModal(); cb(v); };
}
function download(name, text, type) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(text instanceof Blob ? text : new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
function csvOut(rows, name) { download(name, "﻿" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n"), "text/csv;charset=utf-8"); }
function readText(file, cb) {
  const rd = new FileReader();
  rd.onload = () => { const txt = String(rd.result); if (txt.includes("�")) { const r2d = new FileReader(); r2d.onload = () => cb(String(r2d.result)); r2d.readAsText(file, "windows-1252"); } else cb(txt); };
  rd.readAsText(file);
}
// Imprime en la ticketera (58 u 80 mm) o en hoja A4 para informes.
function printHtml(html, kind = "ticket") {
  const p = $("#print"); p.className = kind === "ticket" ? "pt" + DB.cfg.paper : "rep"; p.innerHTML = html;
  setTimeout(() => window.print(), 30);
}

/* ---------- íconos ---------- */
const IC = {
  venta: '<path d="M6 7h13l-1.5 8H8zM6 7 5 3H2"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
  ventas: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/>',
  prod: '<path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10"/>',
  cli: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  prov: '<path d="M2.5 6.5h11v10h-11zM13.5 10h4l3 3v3.5h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  caja: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v.01M18 15v.01"/>',
  rep: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  aj: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.2-.8.2-1.2z"/>',
  mas: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  scale: '<path d="M4 20h16l-2-9H6zM12 11V6M8 6h8"/><circle cx="12" cy="15.5" r="2"/>',
  mesa: '<path d="M3 9h18M5 9v11M19 9v11M8 9V5h8v4"/>',
  prev: '<path d="M7 3h10v18l-5-3-5 3z"/>',
  cam: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>',
  wa: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/>',
  scan: '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M7.5 9v6M10.5 9v6M14 9v6M16.5 9v6" stroke-width="1.6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  hold: '<path d="M6 4h12v16l-6-4-6 4z"/><path d="M12 8v4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  torch: '<path d="M9 3h6v4l-1.5 3v10h-3V10L9 7z"/>',
  money: '<rect x="2.5" y="6" width="19" height="12" rx="1.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v.01M18 14.5v.01"/>'
};
const svg = (k, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${IC[k] || ""}</svg>`;

/* ---------- navegación ---------- */
const TABS = [["venta", "Vender", null], ["ventas", "Ventas", null], ["prod", "Productos", null], ["cli", "Clientes", null], ["caja", "Caja", "caja"], ["prov", "Proveedores", "caja"], ["rep", "Reportes", "reportes"], ["aj", "Ajustes", "ajustes"]];
const tabOk = (t) => { const x = TABS.find((y) => y[0] === t); return x && (!x[2] || can(x[2])); };
function paintNav() {
  const u = me(), tabs = TABS.filter((t) => !t[2] || can(t[2]));
  const btn = ([id, label]) => `<button class="tab ${ui.tab === id ? "on" : ""}" data-a="tab" data-t="${id}" ${ui.tab === id ? 'aria-current="page"' : ""}><span class="ic">${svg(id)}</span><span>${label}</span></button>`;
  $("#sideNav").innerHTML = tabs.map(btn).join("");
  const mob = ["venta", "ventas", "caja", "prod"].filter((t) => tabs.some((x) => x[0] === t)).map((t) => tabs.find((x) => x[0] === t));
  const moreOn = !mob.some((x) => x[0] === ui.tab);
  $("#tabNav").innerHTML = mob.map(btn).join("") + `<button class="tab ${moreOn ? "on" : ""}" data-a="more"><span class="ic">${svg("mas")}</span><span>Más</span></button>`;
  $("#bizName").textContent = DB.biz.name || "Caja Fácil";
  $("#storeName").textContent = DB.biz.store || "Punto de venta";
  $("#userChip").innerHTML = u ? `<span class="av" style="--h:${avHue(u)}">${esc(initials(u.name))}</span><span class="un"><b>${esc(u.name)}</b><small>${esc(ROLE_LABEL[u.role] || u.role)}${curShift() ? " · caja abierta" : ""}</small></span>` : "";
  document.title = (DB.biz.name ? DB.biz.name + " · " : "") + "Caja Fácil";
}
function go(tab) {
  if (!tabOk(tab)) { toast("Tu usuario no tiene acceso a esa sección"); tab = "venta"; }
  ui.tab = tab; document.body.classList.remove("cart-open"); render(); window.scrollTo(0, 0);
}
const VIEWS = {};
function render() {
  if (!tabOk(ui.tab)) ui.tab = "venta";
  paintNav();
  document.body.dataset.tab = ui.tab;
  VIEWS[ui.tab]($("#view"));
}
function moreMenu() {
  const items = [["cli", "Clientes"], ["prov", "Proveedores", "caja"], ["rep", "Reportes", "reportes"], ["aj", "Ajustes", "ajustes"]].filter((x) => !x[2] || can(x[2]));
  openModal(`<h2>Más opciones</h2><div class="menu">${items.map(([t, l]) => `<button class="mi" data-a="tab" data-t="${t}"><span class="ic">${svg(t)}</span>${l}</button>`).join("")}
    <button class="mi" data-a="switchuser"><span class="ic">${svg("user")}</span>Cambiar de usuario</button></div>`);
}
act({ tab: (el) => { if (modalOpen()) closeModal(); go(el.dataset.t); }, more: moreMenu, close: closeModal });
