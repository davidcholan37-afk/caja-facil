// Caja Fácil para Windows: una ventana propia que abre la caja publicada en GitHub Pages.
// Así se actualiza sola (cada cambio del sistema llega sin reinstalar) y funciona sin internet gracias al service worker.
// Google no permite iniciar sesión dentro de programas de escritorio, por eso el ingreso se hace en el navegador
// normal y vuelve aquí con el enlace cajafacil://auth#... (ver «#login-escritorio» en src/67-cloud.js).
const { app, BrowserWindow, Menu, shell, dialog, session } = require("electron");
const path = require("path");
const fs = require("fs");

const APP_URL = "https://davidcholan37-afk.github.io/caja-facil/";
const AUTH_URL = "https://ohdpfdzledddmhanscln.supabase.co/auth/v1/authorize";
const PROTOCOL = "cajafacil";
// Algunas computadoras dejan la ventana en blanco con la tarjeta de video: se dibuja con el procesador (suficiente para la caja).
app.disableHardwareAcceleration();
// La nube (Supabase) responde error 500 si el nombre del navegador lleva la «á» de «Fácil» («CajaFácil/1.0.5»).
// Se quitan los acentos y todo carácter no ASCII del nombre con que el programa se presenta en internet.
const ascii = (s) => String(s).normalize("NFD").replace(/[^\x20-\x7E]/g, "");
try { app.userAgentFallback = ascii(app.userAgentFallback); } catch (_) {}
let win = null;
let caidas = 0, modoTemporal = false, limpiado = false, etapa = "abriendo";
const ultimos = [];
let pendingLink = process.argv.find((a) => a.startsWith(PROTOCOL + "://")) || null;

// Un solo programa abierto a la vez: si se abre otra vez (o llega el enlace de Google), se usa la ventana existente.
// Si no se pudo abrir, se avisa con un mensaje (antes se cerraba en silencio).
function avisar(texto) { try { dialog.showErrorBox("Caja Fácil", texto); } catch (_) {} }
process.on("uncaughtException", (e) => avisar("No se pudo abrir el programa.\n\n" + (e && e.stack || e)));
if (!app.requestSingleInstanceLock()) {
  avisar("Caja Fácil ya está abierta (quizá escondida). Ciérrala desde el Administrador de tareas y ábrela de nuevo.");
  app.quit();
}
else {
  app.on("second-instance", (_e, argv) => {
    const link = argv.find((a) => a.startsWith(PROTOCOL + "://"));
    if (!win || win.isDestroyed()) { win = null; if (link) pendingLink = link; if (app.isReady()) createWindow(); return; }
    if (win.isMinimized()) win.restore();
    win.show(); win.focus();
    if (link) openLink(link);
  });
}
if (process.defaultApp && process.argv.length >= 2) app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
else app.setAsDefaultProtocolClient(PROTOCOL);

// cajafacil://auth#access_token=... → la caja guarda la sesión como si volviera de Google.
function openLink(link) {
  const i = link.indexOf("#");
  if (!win || i < 0) { pendingLink = link; return; }
  win.loadURL(APP_URL + link.slice(i));
}

// Pantalla completa (sin barra de título ni barra de Windows): en pantallas chicas de caja (NCR 1024×768) empieza así.
// F11 la pone o la quita y el programa recuerda la elección en este equipo.
const PREF = () => path.join(app.getPath("userData"), "pantalla.json");
function leerPref() { try { return JSON.parse(fs.readFileSync(PREF(), "utf8")); } catch (e) { return {}; } }
function guardarPref(o) { try { fs.writeFileSync(PREF(), JSON.stringify(o)); } catch (e) {} }
function empiezaCompleta() {
  const p = leerPref(); if (typeof p.completa === "boolean") return p.completa;
  try { const { screen } = require("electron"); const s = screen.getPrimaryDisplay().size; return s.width <= 1280 || s.height <= 800; } catch (e) { return false; }
}

function inApp(url) { return url.startsWith(APP_URL) || url === APP_URL.slice(0, -1); }

function createWindow(temporal) {
  win = new BrowserWindow({
    width: 1366, height: 820, minWidth: 900, minHeight: 600,
    title: "Caja Fácil", backgroundColor: "#F3F4F7", show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: { contextIsolation: true, sandbox: false, nodeIntegration: false, spellcheck: false, partition: temporal ? "cf-temporal" : undefined }
  });
  Menu.setApplicationMenu(null);
  // Se marca el navegador interno para que la caja sepa que corre como programa de Windows.
  win.webContents.setUserAgent(ascii(win.webContents.getUserAgent()) + " CajaFacilEscritorio/" + app.getVersion());
  let visible = false;
  const mostrar = () => { if (visible || win.isDestroyed()) return; visible = true; win.maximize(); if (empiezaCompleta()) win.setFullScreen(true); win.show(); };
  win.webContents.on("before-input-event", (e, input) => {
    if (input.type === "keyDown" && input.key === "F11") { e.preventDefault(); const c = !win.isFullScreen(); win.setFullScreen(c); guardarPref({ completa: c }); }
  });
  win.once("ready-to-show", mostrar);
  setTimeout(mostrar, 6000); // si la página tarda, la ventana aparece igual

  // Entrar con Google: en el navegador normal, nunca dentro del programa.
  win.webContents.on("will-navigate", (e, url) => {
    if (url.startsWith(AUTH_URL)) { e.preventDefault(); shell.openExternal(APP_URL + "#login-escritorio"); return; }
    if (!inApp(url)) { e.preventDefault(); shell.openExternal(url); }
  });
  // WhatsApp, correo y enlaces externos se abren fuera.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (inApp(url)) return { action: "allow" };
    if (/^(https?:|mailto:)/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  // Sin internet la primera vez (aún no hay copia guardada): mensaje claro en vez de una ventana en blanco.
  win.webContents.on("did-fail-load", (_e, code, _desc, url, isMain) => {
    if (!isMain || code === -3) return; // -3 = carga cancelada (normal al navegar)
    const html = `<!doctype html><meta charset="utf-8"><title>Caja Fácil</title><body style="margin:0;display:grid;place-items:center;height:100vh;background:#F3F4F7;font:16px system-ui,Segoe UI,sans-serif;color:#1D1D1F;text-align:center">
      <div><div style="width:64px;height:64px;margin:0 auto 18px;border-radius:16px;background:#0A66FF;color:#fff;display:grid;place-items:center;font-weight:600;font-size:26px">S/</div>
      <h1 style="font-size:24px;margin:0 0 8px">Necesitas internet esta primera vez</h1>
      <p style="color:#6E6E73;margin:0 0 20px">Conéctate a internet y toca el botón. Después Caja Fácil también funciona sin señal.</p>
      <a href="${APP_URL}" style="display:inline-block;background:#0A66FF;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px">Volver a intentar</a></div></body>`;
    win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  });

  if (pendingLink && pendingLink.includes("#")) { const l = pendingLink; pendingLink = null; win.loadURL(APP_URL + l.slice(l.indexOf("#"))); }
  else win.loadURL(APP_URL);
  const wc = win.webContents, w = win;
  wc.on("did-start-loading", () => { etapa = "cargando la página"; });
  wc.on("dom-ready", () => { etapa = "la página ya dibujó"; });
  wc.on("did-finish-load", () => { etapa = "la página cargó"; });
  wc.on("console-message", (_e, _nivel, msg) => { ultimos.push(String(msg).slice(0, 90)); if (ultimos.length > 4) ultimos.shift(); });
  let cerrando = false;
  wc.on("render-process-gone", (_e, d) => {
    if (d.reason === "clean-exit" || cerrando || win !== w) return;
    caidas++;
    // 1.º: borrar solo lo que se vuelve a armar solo (copias de archivos y service worker); las ventas y productos no se tocan.
    if (!limpiado) {
      limpiado = true;
      const ses = session.defaultSession;
      ses.clearStorageData({ storages: ["serviceworkers", "cachestorage"] }).then(() => ses.clearCache()).catch(() => {}).then(() => { if (!w.isDestroyed()) wc.reload(); });
      return;
    }
    if (caidas <= 3) { setTimeout(() => { if (!w.isDestroyed()) wc.reload(); }, 800); return; }
    if (!modoTemporal) { // última prueba: sesión limpia, sin los datos guardados de este equipo
      modoTemporal = true; cerrando = true; createWindow(true); setTimeout(() => { if (!w.isDestroyed()) w.destroy(); }, 300); return;
    }
    avisar("La ventana se cerró sola: " + d.reason + " (código " + d.exitCode + ")\nEtapa: " + etapa + (modoTemporal ? " · sesión limpia" : "") + "\nÚltimos avisos: " + (ultimos.join(" | ") || "ninguno") + "\n\nSe abrirá la caja en tu navegador para que sigas vendiendo.");
    shell.openExternal(APP_URL);
  });
}

app.whenReady().then(() => createWindow()).catch((e) => avisar("No se pudo abrir el programa.\n\n" + (e && e.stack || e)));
app.on("window-all-closed", () => app.quit());
