// Caja Fácil para Windows: una ventana propia que abre la caja publicada en GitHub Pages.
// Así se actualiza sola (cada cambio del sistema llega sin reinstalar) y funciona sin internet gracias al service worker.
// Google no permite iniciar sesión dentro de programas de escritorio, por eso el ingreso se hace en el navegador
// normal y vuelve aquí con el enlace cajafacil://auth#... (ver «#login-escritorio» en src/67-cloud.js).
const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("path");

const APP_URL = "https://davidcholan37-afk.github.io/caja-facil/";
const AUTH_URL = "https://ohdpfdzledddmhanscln.supabase.co/auth/v1/authorize";
const PROTOCOL = "cajafacil";
let win = null;
let pendingLink = process.argv.find((a) => a.startsWith(PROTOCOL + "://")) || null;

// Un solo programa abierto a la vez: si se abre otra vez (o llega el enlace de Google), se usa la ventana existente.
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on("second-instance", (_e, argv) => {
    const link = argv.find((a) => a.startsWith(PROTOCOL + "://"));
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
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

function inApp(url) { return url.startsWith(APP_URL) || url === APP_URL.slice(0, -1); }

function createWindow() {
  win = new BrowserWindow({
    width: 1366, height: 820, minWidth: 900, minHeight: 600,
    title: "Caja Fácil", backgroundColor: "#F3F4F7", show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false }
  });
  Menu.setApplicationMenu(null);
  // Se marca el navegador interno para que la caja sepa que corre como programa de Windows.
  win.webContents.setUserAgent(win.webContents.getUserAgent() + " CajaFacilEscritorio/" + app.getVersion());
  win.once("ready-to-show", () => { win.maximize(); win.show(); });

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
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
