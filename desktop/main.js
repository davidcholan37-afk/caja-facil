// Caja Fácil para Windows: una ventana propia que abre la caja publicada en GitHub Pages.
// Así se actualiza sola (cada cambio del sistema llega sin reinstalar) y funciona sin internet gracias al service worker.
// Google no permite iniciar sesión dentro de programas de escritorio, por eso el ingreso se hace en el navegador
// normal y vuelve aquí con el enlace cajafacil://auth#... (ver «#login-escritorio» en src/67-cloud.js).
const { app, BrowserWindow, Menu, Tray, nativeImage, screen, ipcMain, shell, dialog, session } = require("electron");
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
let win = null, mascota = null, tray = null;
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


// ---- Luis, la mascota: un tomatito pixelado que flota en una esquina del escritorio ----
// Al tocarlo abre el chat de Luis dentro de la caja. Se arrastra, se esconde con clic derecho y vuelve desde el ícono junto al reloj.
// No roba el foco (no interrumpe al escanear o escribir) y la ventana se recorta con el contorno del dibujo (sin transparencia, por la tarjeta de video).
const ARTE = [
  ".......GG.......", "....G..GG..G....", ".....GGGGGG.....", "...KKKGGGGKKK...", "..KRRRKGGKRRRK..", ".KRRRRRKKRRRRRK.",
  ".KRHHRRRRRRRRRK.", "KRRHRRRRRRRRRRRK", "KRRREERRRREERRRK", "KRRREERRRREERRRK", "KRRRRRRRRRRRRRRK", "KRPPRRRKKRRPPRRK",
  ".KRRRRRRRRRRRRK.", "..KRRRRRRRRRRK..", "...KKRRRRRRKK...", ".....KKKKKK....."
];
const ESC = 6, LADO = 16 * ESC;
const ajustes = () => path.join(app.getPath("userData"), "mascota.json");
function leerAjustes() { try { return JSON.parse(fs.readFileSync(ajustes(), "utf8")) || {}; } catch (_) { return {}; } }
function guardarAjustes(o) { try { fs.writeFileSync(ajustes(), JSON.stringify({ ...leerAjustes(), ...o })); } catch (_) {} }
function formaMascota() {
  const r = [];
  ARTE.forEach((fila, y) => { let x = 0; while (x < 16) { if (fila[x] === ".") { x++; continue; } const i = x; while (x < 16 && fila[x] !== ".") x++; r.push({ x: i * ESC, y: y * ESC, width: (x - i) * ESC, height: ESC }); } });
  return r;
}
function posicionLibre() {
  const a = leerAjustes();
  const pantallas = screen.getAllDisplays();
  const vale = typeof a.x === "number" && typeof a.y === "number" && pantallas.some((d) => a.x >= d.workArea.x - 10 && a.y >= d.workArea.y - 10 && a.x <= d.workArea.x + d.workArea.width - 40 && a.y <= d.workArea.y + d.workArea.height - 40);
  if (vale) return { x: a.x, y: a.y };
  const w = screen.getPrimaryDisplay().workArea;
  return { x: w.x + w.width - LADO - 24, y: w.y + w.height - LADO - 24 };
}
function mostrarMascota() {
  if (mascota && !mascota.isDestroyed()) { mascota.showInactive(); return; }
  const p = posicionLibre();
  mascota = new BrowserWindow({
    width: LADO, height: LADO, x: p.x, y: p.y, frame: false, resizable: false, maximizable: false, minimizable: false, fullscreenable: false,
    skipTaskbar: true, focusable: false, alwaysOnTop: true, hasShadow: false, show: false, backgroundColor: "#E5483A", title: "Luis",
    webPreferences: { preload: path.join(__dirname, "mascota-preload.js"), contextIsolation: true, sandbox: false, nodeIntegration: false, spellcheck: false }
  });
  try { mascota.setShape(formaMascota()); } catch (_) {}
  mascota.setAlwaysOnTop(true, "floating");
  mascota.loadFile(path.join(__dirname, "mascota.html"));
  mascota.once("ready-to-show", () => { if (mascota && !mascota.isDestroyed()) mascota.showInactive(); });
  mascota.on("closed", () => { mascota = null; });
  guardarAjustes({ oculta: false });
}
function esconderMascota() { guardarAjustes({ oculta: true }); if (mascota && !mascota.isDestroyed()) mascota.close(); }
function abrirLuis() {
  if (!win || win.isDestroyed()) { createWindow(); return; }
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
  win.webContents.executeJavaScript("(()=>{const l=document.getElementById('helpLauncher');if(l&&!l.hidden)l.click();else{const i=document.getElementById('helpInput');if(i)i.focus();}})()").catch(() => {});
}
ipcMain.on("mascota:mover", (e, dx, dy) => {
  if (!mascota || mascota.isDestroyed() || e.sender !== mascota.webContents) return;
  const [x, y] = mascota.getPosition();
  mascota.setPosition(Math.round(x + (+dx || 0)), Math.round(y + (+dy || 0)));
});
ipcMain.on("mascota:fin", (e) => { if (mascota && !mascota.isDestroyed() && e.sender === mascota.webContents) { const [x, y] = mascota.getPosition(); guardarAjustes({ x, y }); } });
ipcMain.on("mascota:tocar", (e) => { if (mascota && !mascota.isDestroyed() && e.sender === mascota.webContents) abrirLuis(); });
ipcMain.on("mascota:menu", (e) => {
  if (!mascota || mascota.isDestroyed() || e.sender !== mascota.webContents) return;
  Menu.buildFromTemplate([
    { label: "Hablar con Luis", click: abrirLuis },
    { label: "Esconder a Luis", click: esconderMascota }
  ]).popup({ window: mascota });
});
function crearBandeja() {
  if (tray) return;
  try {
    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, "build", "icon.png")).resize({ width: 16, height: 16 }));
    tray.setToolTip("Caja Fácil");
    const menu = () => Menu.buildFromTemplate([
      { label: "Abrir Caja Fácil", click: () => { if (win && !win.isDestroyed()) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } else createWindow(); } },
      { label: "Mostrar a Luis", click: mostrarMascota },
      { label: "Esconder a Luis", click: esconderMascota }
    ]);
    tray.on("click", () => { if (win && !win.isDestroyed()) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
    tray.on("right-click", () => tray.popUpContextMenu(menu()));
  } catch (_) { tray = null; }
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
  const mostrar = () => { if (visible || win.isDestroyed()) return; visible = true; win.maximize(); win.show(); };
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
  w.on("closed", () => { if (win === w && mascota && !mascota.isDestroyed()) mascota.close(); });
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

app.whenReady().then(() => { createWindow(); crearBandeja(); if (!leerAjustes().oculta) mostrarMascota(); }).catch((e) => avisar("No se pudo abrir el programa.\n\n" + (e && e.stack || e)));
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => { if (mascota && !mascota.isDestroyed()) mascota.destroy(); });
