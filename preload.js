// Visor SQL EnergyPlus — puente seguro entre la ventana (sandbox) y el proceso principal.
// Solo expone operaciones concretas: abrir archivos de resultados, recientes y comandos del menú.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('visorDesktop', {
    isDesktop: true,
    // Archivos que llegan desde el sistema: doble clic, «Abrir con», menú Abrir, recientes
    onOpenFile: cb => ipcRenderer.on('open-file', (_e, f) => cb(f)),
    // Comandos del menú de la aplicación (guardar sesión, Excel, informe...)
    onMenu: cb => ipcRenderer.on('menu', (_e, cmd) => cb(cmd)),
    readFile: p => ipcRenderer.invoke('read-file', p),
    openDialog: asCase => ipcRenderer.invoke('open-dialog', !!asCase),
    pathForFile: file => { try { return webUtils.getPathForFile(file) || ''; } catch (e) { return ''; } },
    noteRecent: p => ipcRenderer.send('note-recent', p),
    recents: () => ipcRenderer.invoke('recents'),
    clearRecents: () => ipcRenderer.invoke('clear-recents'),
    ready: () => ipcRenderer.send('renderer-ready')
});
