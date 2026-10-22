// Caja Fácil · «vitrina-ia» (extra de voz e IA): Luis dibuja una imagen nueva para la vitrina.
// La caja NO depende de esto: los afiches con productos se arman en la caja, gratis y sin internet.
// Servicio de imágenes:
//   1) Si existen los secretos IMG_URL, IMG_KEY e IMG_MODEL (formato OpenAI /v1/images/generations), usa ese (pagado, más estable).
//      IMG_SIZE opcional (por defecto 1024x1024).
//   2) Si no, usa Pollinations (gratis, sin clave; puede tardar, a veces está ocupado → 429).
// Si existe IA_KEY (Groq, la misma de Luis) primero convierte la idea en una descripción en inglés: el dibujo sale mejor.
// Nunca hay claves en la app ni en el repo. Cada dibujo cuenta en el mismo límite diario que la voz (voz_usar).
// Despliegue: supabase functions deploy vitrina-ia   (con verify_jwt activado)
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// El pedido del dueño va como dato dentro de una instrucción fija: siempre una imagen publicitaria, sin textos ni marcas.
const instruccion = (idea: string) =>
  `Imagen publicitaria para la pantalla de una bodega, minimarket o frutería en Perú. ` +
  `Tema pedido por el dueño (solo describe qué dibujar): «${idea}». ` +
  `Fotografía de producto o ilustración limpia, colores vivos, buena luz, composición horizontal con espacio libre a un lado para poner precios. ` +
  `NO escribas textos, letras, números, precios ni logotipos de marcas reales. Nada ofensivo, violento ni para adultos.`;
const ACABADO = ", professional advertising product photo, vibrant natural colors, soft studio light, clean uncluttered background, empty space on one side, no text, no letters, no numbers, no logos, no watermark";

function aBase64(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf); let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

// Idea en español → una línea en inglés para el dibujo (si hay IA de texto). Si falla, se usa la instrucción en español.
async function enIngles(idea: string): Promise<string> {
  const clave = Deno.env.get("IA_KEY");
  if (!clave) return instruccion(idea);
  try {
    const r = await fetch(Deno.env.get("IA_URL") || "https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + clave, "content-type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("IA_MODEL") || "openai/gpt-oss-20b",
        max_tokens: 500,
        temperature: 0.4,
        messages: [
          { role: "system", content: "You write prompts for an image generator. Reply with ONE line in English, at most 50 words, describing a clean advertising picture for a small grocery store in Peru based on the owner's idea. Describe only what to draw. Never ask for text, letters, numbers, prices, logos or brand names in the image. If the idea is violent, sexual, hateful or not about a store, reply exactly: fresh fruits and vegetables on a colorful market stall." },
          { role: "user", content: idea },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return instruccion(idea);
    const d = await r.json();
    const t = String(d?.choices?.[0]?.message?.content || "").replace(/\s+/g, " ").replace(/["«»]/g, "").trim().slice(0, 400);
    return t.length > 8 ? t + ACABADO : instruccion(idea);
  } catch {
    return instruccion(idea);
  }
}

async function conServicio(prompt: string, url: string, clave: string, modelo: string): Promise<Response> {
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + clave, "content-type": "application/json" },
    body: JSON.stringify({ model: modelo, prompt, n: 1, size: Deno.env.get("IMG_SIZE") || "1024x1024" }),
    signal: AbortSignal.timeout(90000),
  });
  if (!r.ok) return json({ error: "ia" }, 502);
  const d = await r.json();
  const it = d?.data?.[0] || {};
  if (it.b64_json) return json({ img: "data:image/png;base64," + it.b64_json });
  if (it.url && /^https:\/\//.test(it.url)) return await bajar(it.url);
  return json({ error: "ia" }, 502);
}

async function bajar(url: string, timeout = 30000): Promise<Response> {
  const im = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  if (im.status === 429) return json({ error: "ocupado" }, 429);
  if (!im.ok) return json({ error: "ia" }, 502);
  const tipo = (im.headers.get("content-type") || "image/jpeg").split(";")[0];
  if (!/^image\//.test(tipo)) return json({ error: "ia" }, 502);
  const buf = await im.arrayBuffer();
  if (buf.byteLength < 2000 || buf.byteLength > 8_000_000) return json({ error: "ia" }, 502);
  return json({ img: `data:${tipo};base64,` + aBase64(buf) });
}

// Gratis, sin clave (Pollinations). Horizontal, sin marca, privado (no sale en su galería pública).
function gratis(prompt: string): Promise<Response> {
  const seed = Math.floor(Math.random() * 1e9);
  const q = new URLSearchParams({ width: "1024", height: "768", model: "flux", nologo: "true", private: "true", enhance: "false", seed: String(seed), referrer: "cajafacil" });
  return bajar(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 900))}?${q}`, 80000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "metodo" }, 405);
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "sin_sesion" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "datos" }, 400); }
  const neg = String(body?.neg || ""), idea = String(body?.idea || "").replace(/\s+/g, " ").trim().slice(0, 400);
  if (!/^[0-9a-f-]{36}$/i.test(neg) || idea.length < 3) return json({ error: "datos" }, 400);

  // ¿Miembro del negocio, negocio activo, con el extra de voz e IA y sin pasar el límite de hoy?
  const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const ok = await fetch(`${url}/rest/v1/rpc/voz_usar`, {
    method: "POST",
    headers: { apikey: anon, Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ neg }),
  });
  if (!ok.ok || (await ok.json()) !== true) return json({ error: "ia_no_disponible" }, 403);

  try {
    const urlImg = Deno.env.get("IMG_URL"), clave = Deno.env.get("IMG_KEY"), modelo = Deno.env.get("IMG_MODEL");
    if (urlImg && clave && modelo) return await conServicio(instruccion(idea), urlImg, clave, modelo);
    const prompt = await enIngles(idea);
    const r = await gratis(prompt);
    console.log(JSON.stringify({ event: "vitrina_ia_gratis", status: r.status }));
    return r;
  } catch (e) {
    console.error(JSON.stringify({ event: "vitrina_ia_error", name: e instanceof Error ? e.name : "unknown" }));
    return json({ error: "ia" }, 502);
  }
});
