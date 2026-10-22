// Caja Fácil · «vitrina-ia» (OPCIONAL, extra de pago): Luis dibuja una imagen nueva para la vitrina con una IA de imágenes.
// La caja NO depende de esto: los afiches con productos se arman en la caja, gratis y sin internet.
// Sirve con cualquier servicio de imágenes compatible con el formato OpenAI (/v1/images/generations).
// Secretos de Supabase (nunca en la app ni en el repo):
//   IMG_URL   (ej. https://api.openai.com/v1/images/generations)
//   IMG_KEY   (clave del servicio)
//   IMG_MODEL (ej. gpt-image-1)
//   IMG_SIZE  (opcional, ej. 1536x1024; por defecto 1024x1024)
// Cada dibujo cuenta en el mismo límite diario que la voz (voz_usar): solo negocios activos con el extra de voz e IA.
// Despliegue: supabase functions deploy vitrina-ia   (con verify_jwt activado, que es lo normal)
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

function aBase64(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf); let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
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

  // Sin clave del servicio no se gasta ningún uso del día.
  const urlImg = Deno.env.get("IMG_URL"), clave = Deno.env.get("IMG_KEY"), modelo = Deno.env.get("IMG_MODEL");
  if (!urlImg || !clave || !modelo) return json({ error: "sin_ia" }, 503);

  // ¿Miembro del negocio, negocio activo, con el extra de voz e IA y sin pasar el límite de hoy?
  const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const ok = await fetch(`${url}/rest/v1/rpc/voz_usar`, {
    method: "POST",
    headers: { apikey: anon, Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ neg }),
  });
  if (!ok.ok || (await ok.json()) !== true) return json({ error: "ia_no_disponible" }, 403);

  try {
    const r = await fetch(urlImg, {
      method: "POST",
      headers: { Authorization: "Bearer " + clave, "content-type": "application/json" },
      body: JSON.stringify({ model: modelo, prompt: instruccion(idea), n: 1, size: Deno.env.get("IMG_SIZE") || "1024x1024" }),
      signal: AbortSignal.timeout(90000),
    });
    if (!r.ok) return json({ error: "ia" }, 502);
    const d = await r.json();
    const it = d?.data?.[0] || {};
    if (it.b64_json) return json({ img: "data:image/png;base64," + it.b64_json });
    if (it.url && /^https:\/\//.test(it.url)) {
      const im = await fetch(it.url, { signal: AbortSignal.timeout(30000) });
      if (!im.ok) return json({ error: "ia" }, 502);
      const tipo = (im.headers.get("content-type") || "image/png").split(";")[0];
      if (!/^image\//.test(tipo)) return json({ error: "ia" }, 502);
      return json({ img: `data:${tipo};base64,` + aBase64(await im.arrayBuffer()) });
    }
    return json({ error: "ia" }, 502);
  } catch {
    return json({ error: "ia" }, 502);
  }
});
