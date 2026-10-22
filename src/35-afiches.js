/* ---------- Afiches: estilos (a mano, súper, pizarra, encarte, verde y fechas), combos, lista de precios e ideas de Luis.
   Todo se dibuja con CSS (sin imágenes ni librerías), así pesa poco y se ve nítido en cualquier pantalla. ---------- */
const VIT_ST = [["clasico", "Clásico"], ["mano", "A mano"], ["super", "Súper"], ["pizarra", "Pizarra"], ["encarte", "Encarte"], ["verde", "Verde"], ["patrias", "Fiestas Patrias"], ["navidad", "Navidad"], ["mama", "Día de la Madre"]];
const VIT_ST_N = Object.fromEntries(VIT_ST);
// Estilo con el que empieza cada tipo cuando no se pide uno (se cambia con un toque)
const VIT_ST_DEF = { oferta: "super", precio: "super", nuevo: "verde", destacado: "verde", combo: "encarte", lista: "pizarra", aviso: "pizarra" };
const vitSplit = (n) => { const [e, c] = (+n || 0).toFixed(2).split("."); return { e, c }; };
// «2x1» → «Llevas 2, pagas 1»
const vitPromoSub = (pr) => { const m = String(pr || "").match(/^(\d+)\s*x\s*(\d+)$/i); return m ? `Llevas ${m[1]}, pagas ${m[2]}` : ""; };
// Lo que muestra el afiche, igual para todos los estilos.
function vitTplData(v) {
  const p = !["aviso", "lista"].includes(v.tpl) && v.pid ? prod(v.pid) : null, d = vitTplPrice(v, p), kg = !!(p && p.unit === "kg");
  const name = v.title || (p ? p.name : v.tpl === "aviso" ? "Escribe tu aviso" : v.tpl === "lista" ? "Precios de hoy" : "Elige un producto");
  const sub = v.sub || (v.tpl === "combo" ? vitPromoSub(v.promo) : "") || (v.h ? `Hasta el ${dmy(v.h).slice(0, 5)}` : "");
  const rows = v.tpl === "lista" ? (v.rows || []).slice(0, 8).map((r) => { const q = r.pid ? prod(r.pid) : null; return { name: r.name || (q ? q.name : ""), pr: +r.price || (q ? ofertaOf(q) || +q.price || 0 : 0), kg: !!(q && q.unit === "kg") }; }).filter((r) => r.name && r.pr > 0) : null;
  const tag = VIT_TAG[v.tpl] || "";
  return { p, d, kg, name, sub, rows, promo: v.tpl === "combo" ? String(v.promo || "").trim() : "", tag: norm(tag).replace(/[¡!]/g, "") === norm(name).replace(/[¡!]/g, "") ? "" : tag };
}
const vitPriceHtml = (pr, kg, cls = "vs-pr") => { const { e, c } = vitSplit(pr); return `<span class="${cls} num"><small>S/</small>${e}<sup><i>.</i>${c}</sup>${kg ? "<em>kilo</em>" : ""}</span>`; };
const vitRowsHtml = (rows, cls) => `<div class="${cls}">${rows.map((r) => `<div><span>${esc(r.name)}</span><i></i><b class="num">S/ ${r.pr.toFixed(2)}${r.kg ? "<small> kg</small>" : ""}</b></div>`).join("")}</div>`;
// Estilos nuevos: un solo armado; cada estilo lo acomoda con su CSS (bloque «Afiches: estilos» de style.css).
function vitStHtml(v) {
  const D = vitTplData(v), st = VIT_ST_N[v.st] ? v.st : "mano";
  const img = D.p && imgSrc(D.p) ? `<div class="vs-im k-${imgKind(D.p)}">${pimg(D.p, "vs-pim")}</div>` : "";
  const tag = st === "mano" && D.tag ? `¡${D.tag.replace(/[¡!]/g, "")}!` : D.tag;
  const big = v.tpl === "aviso" || v.tpl === "lista" ? "" : D.promo ? `<span class="vs-pr vs-promo">${esc(D.promo)}</span>` : D.d.pr > 0 ? vitPriceHtml(D.d.pr, D.kg) : "";
  const old = D.d.old && !["combo", "lista", "aviso"].includes(v.tpl) ? `<span class="vs-old">Antes <s>S/ ${D.d.old.toFixed(2)}</s></span>` : "";
  const n = D.name.length;
  return `<div class="vs s-${st} t-${esc(v.tpl || "oferta")}${img ? "" : " noimg"}${n > 14 ? " lg" : ""}${n > 30 ? " xl" : ""}"><div class="vs-w"><i class="vs-dec" aria-hidden="true"></i>${tag ? `<span class="vs-tg">${esc(tag)}</span>` : ""}<b class="vs-nm">${esc(D.name)}</b>${img}${D.rows ? vitRowsHtml(D.rows, "vs-rows") : ""}${big || old ? `<div class="vs-pz">${old}${big}</div>` : ""}${D.sub ? `<span class="vs-sb">${esc(D.sub)}</span>` : ""}<span class="vs-biz">${esc(DB.biz.name || "")}</span></div></div>`;
}
// Tira de estilos para elegir (en el chat de Luis y en Ajustes): cada uno se ve en chiquito con el mismo contenido.
function vitStStrip(v, a, id) {
  const cur = VIT_ST_N[v.st] ? v.st : "clasico";
  return `<div class="vsts" role="group" aria-label="Estilo del afiche">${VIT_ST.map(([k, nm]) => `<button type="button" class="vst${cur === k ? " on" : ""}" data-a="${a}" ${id ? `data-id="${id}" ` : `data-k="st" `}data-v="${k}" aria-pressed="${cur === k}"><span class="vst-b">${vitTplHtml(Object.assign({}, v, { st: k }))}</span><small>${nm}</small></button>`).join("")}</div>`;
}

/* ---------- Luis entiende estilos, combos y listas ---------- */
const VIT_ST_RX = [["mano", /\b(a mano|plumon|cartulina|fosforescente)\b/], ["super", /\b(?:estilo|tipo|como|de) (?:el |un )?(?:super|supermercado)\b|\betiqueta de super\b/], ["pizarra", /\b(pizarra|tiza|pizarrita)\b/], ["encarte", /\b(encarte|volante|folleto)\b/], ["verde", /\b(?:estilo|en|color|fondo|tipo) verde\b/], ["navidad", /\b(navidad|navideno|navidena|navidenos)\b/], ["patrias", /\b(fiestas patrias|patrio|patria|28 de julio)\b/], ["mama", /\b(dia de la madre|dia de las madres|para mama|para las mamas)\b/], ["clasico", /\b(?:estilo|tipo) clasico\b/]];
const VIT_NUM = { uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6 };
const vitN = (w) => (VIT_NUM[w] != null ? VIT_NUM[w] : +w);
function vitParseStyle(n) { for (const [k, rx] of VIT_ST_RX) { const m = n.match(rx); if (m) return [k, m[0]]; } return null; }
// «2x1», «3x2», «lleva 3 paga 2», «3 panetones por 50 soles» → [texto, trozo a quitar]
function vitParsePromo(n) {
  let m = n.match(/\b([2-9])\s*x\s*([1-8])\b/); if (m && +m[1] > +m[2]) return [`${m[1]}x${m[2]}`, m[0]];
  m = n.match(/\blleva(?:s)? (\d|dos|tres|cuatro|cinco|seis) (?:y )?paga(?:s)? (\d|uno|una|dos|tres|cuatro|cinco)\b/); if (m && vitN(m[1]) > vitN(m[2])) return [`${vitN(m[1])}x${vitN(m[2])}`, m[0]];
  m = n.match(/\b([2-9]|dos|tres|cuatro|cinco|seis)\s+((?:[a-zñ]+\s+){1,3}?)(?:por|x|a)\s+(\d+(?:[.,]\d{1,2})?)\s*(?:soles|sol|lucas)\b/);
  if (m) return [`${vitN(m[1])} x S/ ${(+num(m[3])).toFixed(2).replace(/\.00$/, "")}`, m[0], m[2].trim()];
  return null;
}
// «lista de precios de frutas» o «oferta de papaya 3.50, mango 5 y plátano 2» → filas
function vitParseList(t, n) {
  if (/\blista de precios?\b|\bprecios de (hoy|la semana)\b/.test(n)) {
    const cats = [...new Set(DB.products.map((p) => p.cat).filter(Boolean))];
    const cat = cats.find((c) => n.includes(norm(c))) || cats.find((c) => { const k = norm(c).replace(/s$/, ""); return k.length > 3 && n.includes(k); });
    const top = topIds(), rank = (p) => { const i = top.indexOf(p.id); return i < 0 ? 999 : i; };
    const ps = DB.products.filter((p) => p.on !== false && p.price > 0 && (!cat || p.cat === cat)).sort((a, b) => rank(a) - rank(b) || cmpEs(a.name, b.name)).slice(0, 6);
    return ps.length ? { title: cat ? cat : "Precios de hoy", rows: ps.map((p) => ({ pid: p.id, name: p.name, price: 0 })) } : null;
  }
  const segs = t.split(/,|;|\s+y\s+(?=[a-záéíóúñ])/i).map((s) => s.trim()).filter(Boolean);
  const rows = segs.map((s) => { const k = norm(s), m = k.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:soles|sol)?\s*$/); if (!m) return null; const rest = k.slice(0, m.index).replace(/\b(a|en|por|de)\s*$/, ""), p = vitFindProd(rest); const nm = p ? p.name : rest.split(/\s+/).filter((w) => !VIT_RELLENO.has(w)).join(" "); return nm ? { pid: p ? p.id : "", name: p ? p.name : nm.charAt(0).toUpperCase() + nm.slice(1, 40), price: r2(num(m[1])) } : null; }).filter(Boolean);
  return rows.length >= 2 ? { title: "Ofertas de hoy", rows: rows.slice(0, 8) } : null;
}
const vitIdeasPedido = (n) => (/\b(sugiere(me)?|sugerencias?|ideas?|propon(me|e)?|propuestas?)\b/.test(n) && /\b(ofertas?|promos?|promociones?|vitrina|afiches?|carteles?|descuentos?)\b/.test(n)) || /\bque (ofertas?|promos?|promociones?|descuentos?) (hago|pongo|puedo|me recomiendas|saco)\b/.test(n) || /\bque (puedo|deberia) (ofertar|rematar|poner en oferta)\b/.test(n);

/* ---------- Ideas de Luis: con lo que vence y lo que no se mueve, más la fecha del año ---------- */
const vitR10 = (x) => Math.max(0.1, Math.floor(x * 10 + 1e-6) / 10);
function vitTemporada() {
  const d = new Date(), m = d.getMonth() + 1, dia = d.getDate();
  if ((m === 11 && dia >= 10) || (m === 12 && dia <= 24)) { const p = vitFindProd("paneton"); return { why: "Se viene Navidad: el panetón y el chocolate se venden más estas semanas.", v: p ? { tpl: "destacado", st: "navidad", pid: p.id } : { tpl: "aviso", st: "navidad", title: "¡Feliz Navidad! Panetón y chocolate para tu mesa" } }; }
  if (m === 7 && dia <= 28) return { why: "Se vienen las Fiestas Patrias: un saludo en la vitrina se ve bien.", v: { tpl: "aviso", st: "patrias", title: "¡Felices Fiestas Patrias!" } };
  const mayo = new Date(d.getFullYear(), 4, 1), madre = new Date(d.getFullYear(), 4, 1 + ((7 - mayo.getDay()) % 7) + 7);
  if (d <= madre && (madre - d) / 864e5 <= 14) return { why: "Se viene el Día de la Madre.", v: { tpl: "aviso", st: "mama", title: "¡Feliz día, mamá!" } };
  return null;
}
function vitIdeas() {
  const out = [], used = new Set(), base = { kind: "tpl", tone: 0, title: "", sub: "", h: "", price: 0 };
  expItems(10).filter((p) => daysTo(p.exp) >= 0 && +p.price > 0).slice(0, 2).forEach((p) => {
    const pr = vitR10(p.price * 0.8); if (pr >= p.price) return; used.add(p.id);
    out.push({ why: `${expTxt(p)}${p.stock != null ? ` y te quedan ${fmtQ(p.stock)}${p.unit === "kg" ? " kg" : ""}` : ""}. Te propongo bajarlo un 20% para que salga antes.`, v: Object.assign({}, base, { tpl: "oferta", st: "mano", pid: p.id, price: pr, h: p.exp, cobrar: true }) });
  });
  idleItems(30).filter((x) => !used.has(x.p.id) && +x.p.price > 0).slice(0, 2).forEach(({ p, days, val }) => {
    const pr = vitR10(p.price * 0.88); if (pr >= p.price) return; used.add(p.id);
    const h = new Date(); h.setDate(h.getDate() + 7);
    out.push({ why: `No se vende hace ${days} días y tienes ${money(val)} parados en eso. Una oferta de una semana lo mueve.`, v: Object.assign({}, base, { tpl: "oferta", st: "encarte", pid: p.id, price: pr, h: dkey(h), cobrar: true }) });
  });
  const fx = vitTemporada(); if (fx) out.push({ why: fx.why, v: Object.assign({}, base, fx.v) });
  const top = topIds().map((id) => prod(id)).find((p) => p && p.on !== false && !used.has(p.id));
  if (top && out.length < 4) out.push({ why: "Es lo que más vendes: ponerlo a la vista ayuda a que lo pidan.", v: Object.assign({}, base, { tpl: "destacado", st: "super", pid: top.id }) });
  return out.slice(0, 4);
}
