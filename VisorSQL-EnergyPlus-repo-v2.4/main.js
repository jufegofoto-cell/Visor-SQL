// Visor SQL EnergyPlus — contenedor de escritorio (Electron)
// Carga app/index.html (autocontenido, sin dependencias externas).
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');

// Los archivos SQL anuales sub-horarios pueden ser grandes: más memoria para el motor JS
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096');

if (!app.requestSingleInstanceLock()) { app.quit(); }

let win = null;

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
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.once('ready-to-show', () => { win.maximize(); win.show(); });

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

  // Exportar CSV / script R / estadísticas: diálogo "Guardar como"
  win.webContents.session.on('will-download', (_e, item) => {
    const target = dialog.showSaveDialogSync(win, {
      title: 'Guardar archivo exportado',
      defaultPath: path.join(app.getPath('documents'), item.getFilename())
    });
    if (target) item.setSavePath(target); else item.cancel();
  });

  win.on('closed', () => { win = null; });
}

function buildMenu() {
  const template = [
    {
      label: 'Archivo',
      submenu: [
        { label: 'Recargar visor', accelerator: 'F5', click: () => win && win.reload() },
        { type: 'separator' },
        { label: 'Salir', role: 'quit' }
      ]
    },
    {
      label: 'Ver',
      submenu: [
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

app.on('second-instance', () => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

app.whenReady().then(() => {
  buildMenu();
  createWindow();
});

app.on('window-all-closed', () => app.quit());
