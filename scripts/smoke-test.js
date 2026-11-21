// Prueba de humo en Electron (el mismo motor del ejecutable): npm test
// Abre app/index.html con preload.js en una ventana oculta, carga dos SQL reales de EnergyPlus
// (tests/fixtures, enero, modelo AirflowNetwork de 3 zonas) y recorre las funciones principales.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const FIX = path.join(ROOT, 'tests', 'fixtures');
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'visor-smoke-'));
const errors = [];
const downloads = [];

// Manejadores equivalentes a los de main.js
ipcMain.handle('read-file', async (_e, p) => { const data = await fs.promises.readFile(p); return { path: p, name: path.basename(p), size: data.length, data }; });
ipcMain.handle('recents', () => []);
ipcMain.handle('clear-recents', () => true);
ipcMain.handle('open-dialog', () => []);
ipcMain.on('note-recent', () => {});
let ready = false;
ipcMain.on('renderer-ready', () => { ready = true; });

function fail(msg) { console.error('✗ ' + msg); finish(1); }
function finish(code) {
    try { fs.rmSync(OUT, { recursive: true, force: true }); } catch (e) {}
    app.exit(code);
}
const wait = ms => new Promise(r => setTimeout(r, ms));

app.whenReady().then(async () => {
    const win = new BrowserWindow({ show: false, width: 1500, height: 950,
        webPreferences: { preload: path.join(ROOT, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    win.webContents.on('console-message', function (e) {
        const level = e && e.level !== undefined ? e.level : arguments[1], text = e && e.message !== undefined ? e.message : arguments[2];
        if (level === 'error' || level === 3) errors.push(text);
    });
    win.webContents.on('render-process-gone', (_e, d) => fail('El proceso de la ventana terminó: ' + d.reason));
    win.webContents.session.on('will-download', (_e, item) => {
        const p = path.join(OUT, item.getFilename());
        item.setSavePath(p);
        item.once('done', (_ev, state) => downloads.push({ name: item.getFilename(), state, size: state === 'completed' ? fs.statSync(p).size : 0 }));
    });
    const timer = setTimeout(() => fail('Tiempo de prueba agotado (5 min)'), 300000);
    await win.loadFile(path.join(ROOT, 'app', 'index.html'));
    const js = code => win.webContents.executeJavaScript(code);
    const until = async (cond, ms = 120000) => { const t0 = Date.now(); while (!(await js(cond))) { if (Date.now() - t0 > ms) throw new Error('Esperando: ' + cond); await wait(100); } };
    const idle = () => until(`document.getElementById('loading').style.display === 'none'`);
    const check = (ok, msg) => { if (!ok) throw new Error(msg); console.log('✓ ' + msg); };
    const send = (file, asCase) => { const data = fs.readFileSync(file); win.webContents.send('open-file', { path: file, name: path.basename(file), size: data.length, data, asCase }); };
    try {
        await until('typeof SQL !== "undefined" && !!SQL');
        await until('true'); for (let i = 0; i < 50 && !ready; i++) await wait(100);
        check(ready && await js('!!(window.visorDesktop && window.visorDesktop.isDesktop)'), 'Puente de escritorio (preload) activo');
        check(await js('APP_VERSION') === require(path.join(ROOT, 'package.json')).version, 'Versión del HTML = versión de package.json');

        send(path.join(FIX, 'caso_A.sql'), false);
        await until(`App.backend === 'sql'`); await idle();
        const info = await js(`({ n: App.variables.length, z: App.zones.length, worker: App.lastLoad && App.lastLoad.worker, path: App.filePath,
            off: [...document.querySelectorAll('.tab-btn.disabled')].map(b => b.dataset.tab), tab: !!App.tabSummary })`);
        check(info.n > 20 && info.z === 3, `SQL cargado: ${info.n} variables, ${info.z} zonas`);
        check(info.worker === true, 'Índice y conteos calculados en el Worker');
        check(info.path.endsWith('caso_A.sql'), 'Ruta del archivo registrada (recientes / sesión)');
        check(!['zonetemp', 'ventilation', 'heatbal', 'cases'].some(t => info.off.includes(t)), 'Pestañas de análisis activas');
        check(info.tab, 'Indicadores de los reportes tabulares');

        await js(`(() => { const s = document.getElementById('zt-var'); s.value = [...s.options].find(o => /Operative/.test(o.value)).value; s.dispatchEvent(new Event('change'));
            document.getElementById('zt-model').value = 'ashrae80'; document.getElementById('zt-update').click(); })()`);
        await idle();
        check(await js(`document.querySelectorAll('#zt-comfort-table tbody tr').length === 3 && !!document.getElementById('zt-adaptive').data`), 'Confort adaptativo ASHRAE 55 con grados-hora por zona');

        await js(`document.getElementById('vn-update').click()`); await idle();
        await js(`document.getElementById('vt-update').click()`); await idle();
        check(await js(`document.querySelectorAll('#vn-table tbody tr').length > 0 && document.querySelectorAll('#vt-table tbody tr').length === 2`), 'Ventilación natural y cruce apertura × temperatura');

        await js(`document.getElementById('hb-update').click()`); await idle();
        check(await js(`document.querySelectorAll('#hb-table tbody tr').length > 2 && !!document.getElementById('hb-monthly').data`), 'Balance térmico mensual');

        send(path.join(FIX, 'caso_B.sql'), true);
        await until('CASES.list.length === 1'); await idle();
        await js(`(() => { const v = App.variables.find(x => x.name === 'Zone Operative Temperature' && x.keyValue === 'WEST_ZONE'); setPickerValue('vp-cmp', v.id);
            document.getElementById('cmp-agg').value = 'hourly'; document.getElementById('cmp-update').click(); })()`);
        await idle();
        await js(`document.getElementById('cmp-comfort-update').click()`); await idle();
        check(await js(`document.querySelectorAll('#cmp-table tbody tr').length === 2 && document.getElementById('cmp-diff').data[0].type === 'heatmap'
            && document.querySelectorAll('#cmp-comfort-table tbody tr').length === 6`), 'Comparación de casos: series, mapa de diferencias y confort');

        const siMax = await js(`Math.max(...document.getElementById('zt-curves').data.filter(t => t.name === 'WEST_ZONE')[0].y)`);
        await js('setUnitSystem("IP")'); await idle(); await wait(300);
        const ip = await js(`({ u: App.variables.find(x => x.name === 'Zone Operative Temperature').units, max: Math.max(...document.getElementById('zt-curves').data.filter(t => t.name === 'WEST_ZONE')[0].y),
            bmin: document.getElementById('zt-bmin').value })`);
        check(ip.u === 'F' && Math.abs(ip.max - (siMax * 1.8 + 32)) < 0.01 && ip.bmin === '68', `Unidades IP: ${siMax.toFixed(2)} °C → ${ip.max.toFixed(2)} °F`);
        await js('setUnitSystem("SI")'); await idle();

        const sess = await js('JSON.stringify(collectSession())');
        await js(`(() => { document.getElementById('zt-model').value = 'en3'; ZT.selected.clear(); HB.off.add('air0'); })()`);
        await js(`applySession(${sess})`); await idle();
        const r = await js(`({ m: document.getElementById('zt-model').value, z: ZT.selected.size, hb: HB.off.has('air0') })`);
        check(r.m === 'ashrae80' && r.z === 3 && !r.hb, 'Sesión: guardar y restaurar la configuración');

        await js(`exportPlotImage(document.getElementById('zt-adaptive'), 'png')`);
        await js(`exportPlotImage(document.getElementById('zt-monthly'), 'svg')`);
        await js(`switchTab('zonetemp', document.querySelector('.tab-btn[data-tab="zonetemp"]')); exportExcel()`);
        await js(`openReportDialog(); generateReport()`);
        for (let i = 0; i < 600 && downloads.length < 4; i++) await wait(100);
        const ok = ext => downloads.some(d => d.name.endsWith(ext) && d.state === 'completed' && d.size > 1000);
        check(ok('.png') && ok('.svg') && ok('.xlsx') && ok('.pdf'), `Exportaciones: ${downloads.map(d => `${d.name.split('.').pop()} ${(d.size / 1024).toFixed(0)} KB`).join(', ')}`);

        check(errors.length === 0, 'Sin errores en la consola' + (errors.length ? ': ' + errors.join(' | ') : ''));
        clearTimeout(timer);
        console.log('Prueba de humo correcta.');
        finish(0);
    } catch (e) {
        fail(e.message + (errors.length ? '\nErrores de consola: ' + errors.join(' | ') : ''));
    }
});
