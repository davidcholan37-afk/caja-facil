// Caja Fácil · «voz-oido» (OPCIONAL): convierte la voz del cajero en texto con Whisper (mucho más preciso que el oído sin internet).
// La caja NO depende de esto: si falla, la voz sigue con el oído del navegador o el de sin internet (Vosk).
// Sirve con cualquier API tipo OpenAI que tenga /audio/transcriptions (Groq, etc.).
// Secretos de Supabase (nunca en la app ni en el repo): STT_URL (opcional; si falta se saca de IA_URL),
// STT_KEY (opcional; si falta se usa IA_KEY), STT_MODEL (opcional; por defecto whisper-large-v3-turbo).
// Despliegue: supabase functions deploy voz-oido   (con verify_jwt activado, que es lo normal)
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const lista = (x: unknown, max: number) =>
  Array.isArray(x) ? x.filter((n) => typeof n === "string").map((n) => (n as string).trim().slice(0, 40)).filter(Boolean).slice(0, max) : [];

// Frases que Whisper inventa cuando solo hay ruido o silencio.
const INVENTADAS = /(subt[ií]tulos|amara\.org|gracias por ver|suscr[ií]b|thanks for watching|no olvides|hasta la pr[oó]xima|nos vemos en el|m[uú]sica|\bcc\b|zeoranger)/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "metodo" }, 405);
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "sin_sesion" }, 401);

  let fd: FormData;
  try { fd = await req.formData(); } catch { return json({ error: "datos" }, 400); }
  const neg = String(fd.get("neg") || "");
  const audio = fd.get("audio");
  if (!/^[0-9a-f-]{36}$/i.test(neg) || !(audio instanceof File)) return json({ error: "datos" }, 400);
  if (audio.size < 1000 || audio.size > 1_500_000) return json({ error: "datos" }, 400);
  let cat: any = {};
  try { cat = JSON.parse(String(fd.get("catalogo") || "{}")) || {}; } catch { cat = {}; }

  // ¿Es miembro, el negocio está activo, tiene voz y no pasó su límite de hoy?
  const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const ok = await fetch(`${url}/rest/v1/rpc/voz_usar`, {
    method: "POST",
    headers: { apikey: anon, Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ neg }),
  });
  if (!ok.ok || (await ok.json()) !== true) return json({ error: "voz_no_disponible" }, 403);

  const iaUrl = Deno.env.get("IA_URL") || "";
  const urlSTT = Deno.env.get("STT_URL") || iaUrl.replace(/\/chat\/completions\/?$/, "/audio/transcriptions");
  const clave = Deno.env.get("STT_KEY") || Deno.env.get("IA_KEY");
  const modelo = Deno.env.get("STT_MODEL") || "whisper-large-v3-turbo";
  if (!urlSTT || !/\/audio\/transcriptions$/.test(urlSTT) || !clave) return json({ error: "sin_ia" }, 503);

  // Pista para Whisper: palabras de la caja, así escribe bien «Yape», «Plin» y los nombres de los productos.
  let pista = "Caja de bodega en Perú: soles, céntimos, Yape, Plin, efectivo, tarjeta, kilo, medio kilo, docena.";
  for (const n of [...lista(cat.productos, 60), ...lista(cat.clientes, 15), ...lista(cat.proveedores, 10)]) {
    if (pista.length + n.length + 2 > 650) break;
    pista += ", " + n;
  }

  const out = new FormData();
  out.append("file", audio, audio.name || "voz.webm");
  out.append("model", modelo);
  out.append("language", "es");
  out.append("temperature", "0");
  out.append("response_format", "verbose_json");
  out.append("prompt", pista);
  try {
    const r = await fetch(urlSTT, { method: "POST", headers: { Authorization: "Bearer " + clave }, body: out, signal: AbortSignal.timeout(15000) });
    if (r.status === 429) return json({ error: "ocupado" }, 429);
    if (!r.ok) return json({ error: "ia" }, 502);
    const d = await r.json();
    const segs: any[] = Array.isArray(d?.segments) ? d.segments : [];
    let texto = "";
    if (segs.length) {
      texto = segs
        .filter((s) => !(typeof s?.no_speech_prob === "number" && s.no_speech_prob > 0.6) && !(typeof s?.avg_logprob === "number" && s.avg_logprob < -1.2))
        .map((s) => String(s?.text || "")).join(" ");
    } else texto = String(d?.text || "");
    texto = texto.replace(/\s+/g, " ").trim().slice(0, 300);
    if (!texto || INVENTADAS.test(texto) || pista.includes(texto)) texto = "";
    return json({ texto });
  } catch {
    return json({ error: "ia" }, 502);
  }
});
