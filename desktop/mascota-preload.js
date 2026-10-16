// Puente mínimo entre la mascota y el programa: arrastrar, tocar y menú. Nada más.
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("mascota", {
  mover: (dx, dy) => ipcRenderer.send("mascota:mover", dx, dy),
  fin: () => ipcRenderer.send("mascota:fin"),
  tocar: () => ipcRenderer.send("mascota:tocar"),
  menu: () => ipcRenderer.send("mascota:menu")
});
