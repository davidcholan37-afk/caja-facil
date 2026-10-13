/* ===================== 71 · AYUDA IA: chat de guía y diagnóstico ===================== */
// El chat usa texto para no interferir con las voces existentes. No lee ni modifica ventas, clientes o inventario.
let helpMessages = [], helpBusy = false;

function helpAppend(role, text, temporary) {
  const list = $("#helpMessages");
  if (!list) return null;
  const item = document.createElement("div");
  item.className = "help-message " + (role === "assistant" ? "assistant" : "user") + (temporary ? " temporary" : "");
  item.setAttribute("role", "listitem");
  const body = document.createElement("span");
  body.className = "help-message-text";
  body.textContent = String(text || "");
  item.appendChild(body);
  list.appendChild(item);
  list.scrollTop = list.scrollHeight;
  return item;
}
function helpOpen() {
  const panel = $("#helpChat"), launch = $("#helpLauncher");
  if (!panel) return;
  panel.hidden = false;
  if (launch) launch.hidden = true;
  if (!helpMessages.length) {
    const hello = "Hola, soy Luis, el asistente de Caja Fácil. Puedes preguntarme cómo usar una sección o contarme qué error apareció. No puedo ver tus ventas ni cambiar datos.";
    helpMessages.push({ role: "assistant", content: hello });
    helpAppend("assistant", hello);
  }
  const input = $("#helpInput");
  if (input) setTimeout(() => input.focus(), 0);
}
function helpClose() {
  const panel = $("#helpChat"), launch = $("#helpLauncher");
  if (panel) panel.hidden = true;
  if (launch) launch.hidden = false;
}
function helpError(status, code) {
  if (status === 401) return "Tu sesión venció. Vuelve a entrar con Google y prueba otra vez.";
  if (status === 403 || status === 429) return "El chat no está disponible ahora para esta cuenta o alcanzó su límite diario. Consulta al proveedor de Caja Fácil.";
  if (status === 503 || code === "sin_ia") return "El servicio de ayuda aún no está configurado. Consulta al proveedor de Caja Fácil.";
  if (status === 502) return "La IA no pudo responder esta vez. Revisa tu conexión e inténtalo de nuevo.";
  return "No se pudo enviar la pregunta. Revisa tu conexión e inténtalo otra vez.";
}
async function helpSend(value) {
  const input = $("#helpInput"), textValue = String(value == null && input ? input.value : value || "").trim().slice(0, 1200);
  if (!textValue || helpBusy) return;
  if (input) input.value = "";
  helpAppend("user", textValue);
  helpMessages.push({ role: "user", content: textValue });
  if (!cloudOn()) {
    const offline = "Para consultar la IA necesitas internet y una sesión activa. Puedes seguir usando la caja sin internet.";
    helpMessages.push({ role: "assistant", content: offline }); helpAppend("assistant", offline); return;
  }
  helpBusy = true;
  const send = $("#helpSend");
  if (send) send.disabled = true;
  const waiting = helpAppend("assistant", "Estoy revisando tu pregunta…", true);
  try {
    const session = cloudLoad(), token = await cloudToken();
    const r = await fetch(SB_URL + "/functions/v1/ayuda", {
      method: "POST",
      headers: { apikey: SB_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ neg: session.neg, mensajes: helpMessages.slice(-8) }),
      signal: AbortSignal.timeout(30000)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error("ayuda"), { status: r.status, code: data.error });
    const answer = String(data.respuesta || "").trim().slice(0, 2200) || "No recibí una respuesta. Cuéntame qué pantalla estás usando y qué pasó.";
    helpMessages.push({ role: "assistant", content: answer });
    if (helpMessages.length > 10) helpMessages = helpMessages.slice(-10);
    helpAppend("assistant", answer);
  } catch (e) {
    const answer = helpError(e.status || 0, e.code || "");
    helpMessages.push({ role: "assistant", content: answer });
    if (helpMessages.length > 10) helpMessages = helpMessages.slice(-10);
    helpAppend("assistant", answer);
  } finally {
    if (waiting) waiting.remove();
    helpBusy = false;
    if (send) send.disabled = false;
    if (input) input.focus();
  }
}
const helpForm = $("#helpForm");
if (helpForm) helpForm.addEventListener("submit", (e) => { e.preventDefault(); helpSend(); });
act({
  ayudaAbrir: helpOpen,
  ayudaCerrar: helpClose
});
