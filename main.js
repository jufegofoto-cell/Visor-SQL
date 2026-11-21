// Visor SQL EnergyPlus — contenedor de escritorio (Electron)
// Carga app/index.html (autocontenido, sin dependencias externas).
// preload.js expone a la ventana solo lo necesario para abrir archivos y recibir comandos del menú.
const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Los archivos SQL anuales sub-horarios pueden ser grandes: más memoria para el motor JS
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096');

const DATA_EXT = /\.(sql|db|sqlite|sqlite3|epw|csv)$/i;
const MAX_RECENT = 10;
let win = null;
let rendererReady = false;
const pending = []; // archivos recibidos antes de que la ventana esté lista

if (!app.requestSingleInstanceLock()) { app.quit(); }

// ---------- Archivos pasados por el sistema (doble clic, «Abrir con», arrastrar al ícono) ----------
function filesFromArgv(argv, cwd) {
    return argv.slice(1).filter(a => a && !a.startsWith('-') && DATA_EXT.test(a))
        .map(a => path.resolve(cwd || process.cwd(), a)).filter(isFile);
}
function isFile(p) { try { return fs.statSync(p).isFile(); } catch (e) { return false; } }

async function readDataFile(p) {
    const full = path.resolve(String(p || ''));
    if (!DATA_EXT.test(full)) throw new Error('Tipo de archivo no admitido');
    if (!isFile(full)) throw new Error('No se encontró el archivo: ' + full);
    const data = await fs.promises.readFile(full);
    return { path: full, name: path.basename(full), size: data.length, data };
}
async function sendFile(p, asCase = false) {
    if (!win || !rendererReady) { pending.push({ p, asCase }); return; }
    try {
        const f = await readDataFile(p);
        win.webContents.send('open-file', Object.assign(f, { asCase }));
        if (!asCase) noteRecent(f.path);
    } catch (e) {
        dialog.showMessageBox(win, { type: 'error', title: 'No se pudo abrir', message: String(e.message || e) });
    }
}

// ---------- Archivos recientes ----------
const recentFile = () => path.join(app.getPath('userData'), 'recientes.json');
function loadRecents() {
    try { return JSON.parse(fs.readFileSync(recentFile(), 'utf8')).filter(p => typeof p === 'string'); } catch (e) { return []; }
}
function saveRecents(list) { try { fs.writeFileSync(recentFile(), JSON.stringify(list.slice(0, MAX_RECENT), null, 1)); } catch (e) {} }
function noteRecent(p) {
    if (!p || !DATA_EXT.test(p)) return;
    const list = [p].concat(loadRecents().filter(x => x.toLowerCase() !== p.toLowerCase()));
    saveRecents(list);
    try { app.addRecentDocument(p); } catch (e) {}
    buildMenu();
}

function createWindow() {
    win = new BrowserWindow({
        width: 1500,
        height: 950,
        minWidth: 1024,
        minHeight: 640,
        title: 'Visor SQL EnergyPlus',
        backgroundColor: '#f1f5f9',
        icon: path.join(__dirname, 'build', 'icon.ico'),
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            spellcheck: false
        }
    });

    win.loadFile(path.join(__dirname, 'app', 'index.html'));
    win.once('ready-to-show', () => { win.maximize(); win.show(); });
    win.webContents.on('did-start-loading', () => { rendererReady = false; });

    // Enlaces externos: navegador del sistema; la ventana nunca navega fuera de la app
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:\/\//i.test(url)) shell.openExternal(url);
        return { action: 'deny' };
    });
    win.webContents.on('will-navigate', (e, url) => {
        if (url !== win.webContents.getURL()) {
            e.preventDefault();
            if (/^https?:\/\//i.test(url)) shell.openExternal(url);
        }
    });

    // Exportar CSV / R / Excel / PDF / imágenes / sesión: diálogo "Guardar como"
    win.webContents.session.on('will-download', (_e, item) => {
        const target = dialog.showSaveDialogSync(win, {
            title: 'Guardar archivo exportado',
            defaultPath: path.join(app.getPath('documents'), item.getFilename())
        });
        if (target) item.setSavePath(target); else item.cancel();
    });

    win.on('closed', () => { win = null; rendererReady = false; });
}

// ---------- Comunicación con la ventana ----------
ipcMain.on('renderer-ready', () => {
    rendererReady = true;
    const list = pending.splice(0);
    list.forEach(x => sendFile(x.p, x.asCase));
});
ipcMain.handle('read-file', async (_e, p) => {
    const f = await readDataFile(p);
    return f;
});
ipcMain.handle('open-dialog', async (_e, asCase) => {
    const r = await dialog.showOpenDialog(win, {
        title: asCase ? 'Agregar casos SQL para comparar' : 'Abrir resultados de simulación',
        properties: asCase ? ['openFile', 'multiSelections'] : ['openFile'],
        filters: asCase ? [{ name: 'Resultados EnergyPlus (SQL)', extensions: ['sql', 'db', 'sqlite', 'sqlite3'] }]
            : [{ name: 'Resultados y clima', extensions: ['sql', 'db', 'sqlite', 'sqlite3', 'epw', 'csv'] }]
    });
    return r.canceled ? [] : r.filePaths;
});
ipcMain.on('note-recent', (_e, p) => noteRecent(p));
ipcMain.handle('recents', () => loadRecents().filter(isFile).map(p => ({ path: p, name: path.basename(p), dir: path.dirname(p) })));
ipcMain.handle('clear-recents', () => { saveRecents([]); try { app.clearRecentDocuments(); } catch (e) {} buildMenu(); return true; });

function menuCmd(cmd) { if (win) win.webContents.send('menu', cmd); }
async function openViaDialog(asCase) {
    const r = await dialog.showOpenDialog(win, {
        title: asCase ? 'Agregar casos SQL para comparar' : 'Abrir resultados de simulación',
        properties: asCase ? ['openFile', 'multiSelections'] : ['openFile'],
        filters: asCase ? [{ name: 'Resultados EnergyPlus (SQL)', extensions: ['sql', 'db', 'sqlite', 'sqlite3'] }]
            : [{ name: 'Resultados y clima', extensions: ['sql', 'db', 'sqlite', 'sqlite3', 'epw', 'csv'] }]
    });
    if (!r.canceled) for (const p of r.filePaths) await sendFile(p, asCase);
}

function buildMenu() {
    const recents = loadRecents().filter(isFile);
    const template = [
        {
            label: 'Archivo',
            submenu: [
                { label: 'Abrir…', accelerator: 'CmdOrCtrl+O', click: () => openViaDialog(false) },
                { label: 'Agregar casos SQL para comparar…', click: () => openViaDialog(true) },
                {
                    label: 'Archivos recientes',
                    submenu: recents.length ? recents.map(p => ({ label: path.basename(p) + '  —  ' + path.dirname(p), click: () => sendFile(p) }))
                        .concat([{ type: 'separator' }, { label: 'Borrar la lista', click: () => { saveRecents([]); try { app.clearRecentDocuments(); } catch (e) {} buildMenu(); } }])
                        : [{ label: '(vacía)', enabled: false }]
                },
                { type: 'separator' },
                { label: 'Guardar sesión…', accelerator: 'CmdOrCtrl+S', click: () => menuCmd('save-session') },
                { label: 'Abrir sesión…', accelerator: 'CmdOrCtrl+Shift+O', click: () => menuCmd('open-session') },
                { type: 'separator' },
                { label: 'Exportar Excel de la sección', accelerator: 'CmdOrCtrl+E', click: () => menuCmd('excel') },
                { label: 'Informe PDF…', accelerator: 'CmdOrCtrl+P', click: () => menuCmd('report') },
                { type: 'separator' },
                { label: 'Recargar visor', accelerator: 'F5', click: () => win && win.reload() },
                { type: 'separator' },
                { label: 'Salir', role: 'quit' }
            ]
        },
        {
            label: 'Ver',
            submenu: [
                { label: 'Unidades SI', click: () => menuCmd('units-SI') },
                { label: 'Unidades IP', click: () => menuCmd('units-IP') },
                { type: 'separator' },
                { label: 'Acercar', role: 'zoomIn' },
                { label: 'Alejar', role: 'zoomOut' },
                { label: 'Tamaño original', role: 'resetZoom' },
                { type: 'separator' },
                { label: 'Pantalla completa', role: 'togglefullscreen' },
                { label: 'Herramientas de desarrollo', accelerator: 'Ctrl+Shift+I', role: 'toggleDevTools' }
            ]
        },
        {
            label: 'Ayuda',
            submenu: [
                {
                    label: 'Tipos de gráficos (Acerca de)',
                    accelerator: 'F1',
                    click: () => win && win.webContents.executeJavaScript(
                        "switchTab('about', document.querySelector('.tab-btn[data-tab=\"about\"]'))").catch(() => {})
                },
                { type: 'separator' },
                {
                    label: 'Versión',
                    click: () => dialog.showMessageBox(win, {
                        type: 'info',
                        title: 'Acerca de',
                        message: `Visor SQL EnergyPlus ${app.getVersion()}`,
                        detail: 'Visor offline de resultados de EnergyPlus / OpenStudio (SQL), EPW y CSV.\n' +
                                `Electron ${process.versions.electron} · Chromium ${process.versions.chrome}`
                    })
                }
            ]
        }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on('second-instance', (_e, argv, workingDirectory) => {
    if (process.env.VISOR_DEBUG) console.log('second-instance', JSON.stringify(argv), workingDirectory);
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
    filesFromArgv(argv, workingDirectory).forEach(p => sendFile(p));
});
// macOS: archivo soltado sobre el ícono del Dock
app.on('open-file', (e, p) => { e.preventDefault(); sendFile(p); });

app.whenReady().then(() => {
    buildMenu();
    createWindow();
    filesFromArgv(process.argv).forEach(p => pending.push({ p, asCase: false }));
});

app.on('window-all-closed', () => app.quit());
