// Validación previa a la compilación: el HTML debe ser autocontenido y su script principal compilar.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = path.join(__dirname, '..', 'app', 'index.html');
const fail = msg => { console.error('✗ ' + msg); process.exit(1); };
const ok = msg => console.log('✓ ' + msg);

if (!fs.existsSync(file)) fail('No existe app/index.html');
const html = fs.readFileSync(file, 'utf8');
ok(`app/index.html (${(html.length / 1048576).toFixed(1)} MB)`);

// Sin dependencias externas (CDN)
const external = [...html.matchAll(/<(script|link|img)\b[^>]*\b(src|href)\s*=\s*["']\s*(https?:)?\/\//gi)];
if (external.length) fail(`Recursos externos encontrados: ${external.map(m => m[0]).join(' | ')}`);
ok('Sin recursos externos');

// Librerías embebidas
[['Plotly', /plotly\.js( \([^)]*\))? v\d/], ['Papa Parse', /Papa Parse/], ['sql.js (initSqlJs)', /initSqlJs/], ['WASM de SQLite', /const SQL_WASM_B64 = "/], ['jsPDF (informe PDF)', /jsPDF 2\.\d/], ['fflate (Excel)', /fflate 0\.\d/]]
  .forEach(([name, re]) => { if (!re.test(html)) fail(`Falta ${name}`); ok(`${name} embebido`); });

// El script de la aplicación compila
const start = html.lastIndexOf('<script>/* ====');
const end = html.lastIndexOf('</script>');
if (start < 0 || end < start) fail('No se encontró el script principal de la aplicación');
try {
  new vm.Script(html.slice(start + '<script>'.length, end), { filename: 'app-main.js' });
} catch (e) { fail('Error de sintaxis en el script principal: ' + e.message); }
ok('Script principal compila');

// Funciones de la versión 2.6 presentes
['buildComfort', 'updateVentilation', 'updateHeatBalance', 'readSqlCase', 'tabularSummary', 'exportExcel', 'generateReport', 'exportPlotImage',
  'openSqlPrepared', 'applySession', 'setUnitSystem', 'initDragDrop']
  .forEach(fn => { if (!new RegExp('function ' + fn + '\\(').test(html)) fail(`Falta la función ${fn}`); });
ok('Módulos: confort, ventilación, balance, casos, resumen, exportaciones, sesiones, unidades y escritorio');

// Estilos precompilados (sin el compilador de Tailwind en tiempo de ejecución)
if (!/<style id="tailwind-precompilado">/.test(html)) fail('Falta el CSS de Tailwind precompilado');
if (/var qv=Object\.create;var Hi=Object\.defineProperty/.test(html)) fail('El compilador de Tailwind en tiempo de ejecución sigue incluido');
ok('CSS de Tailwind precompilado');

// sql.js identificable para el Worker de carga
if (!/<script id="sqljs-lib">/.test(html)) fail('Falta <script id="sqljs-lib"> (lo usa el Worker de carga)');
ok('sql.js disponible para el Worker');

// Una sola fuente de versión: package.json
const pkg = require('../package.json');
const m = html.match(/const APP_VERSION = '([^']*)';/);
if (!m) fail('No se encontró APP_VERSION en el HTML');
if (m[1] !== pkg.version) fail(`APP_VERSION (${m[1]}) ≠ package.json (${pkg.version}): ejecute npm run sync-version`);
ok(`Versión ${pkg.version} coherente (HTML = package.json)`);

// Escritorio
['main.js', 'preload.js'].forEach(f => { if (!fs.existsSync(path.join(__dirname, '..', f))) fail('Falta ' + f); });
if (!(pkg.build.files || []).includes('preload.js')) fail('preload.js no está en build.files');
ok('main.js + preload.js');

console.log('Validación correcta.');
