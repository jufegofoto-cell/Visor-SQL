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
[['Plotly', /plotly\.js v\d/], ['Papa Parse', /Papa Parse/], ['sql.js (initSqlJs)', /initSqlJs/], ['WASM de SQLite', /const SQL_WASM_B64 = "/]]
  .forEach(([name, re]) => { if (!re.test(html)) fail(`Falta ${name}`); ok(`${name} embebido`); });

// El script de la aplicación compila
const start = html.lastIndexOf('<script>/* ====');
const end = html.lastIndexOf('</script>');
if (start < 0 || end < start) fail('No se encontró el script principal de la aplicación');
try {
  new vm.Script(html.slice(start + '<script>'.length, end), { filename: 'app-main.js' });
} catch (e) { fail('Error de sintaxis en el script principal: ' + e.message); }
ok('Script principal compila');

console.log('Validación correcta.');
