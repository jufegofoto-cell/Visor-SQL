// Copia la versión de package.json en app/index.html (const APP_VERSION).
// Única fuente de la versión: package.json (el flujo de GitHub la toma de la etiqueta vX.Y.Z).
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'app', 'index.html');
const { version } = require('../package.json');
const html = fs.readFileSync(file, 'utf8');
const re = /const APP_VERSION = '[^']*';/;
if (!re.test(html)) { console.error('✗ No se encontró APP_VERSION en app/index.html'); process.exit(1); }
const out = html.replace(re, `const APP_VERSION = '${version}';`).replace(/(<span class="app-version">)[^<]*(<\/span>)/g, `$1${version}$2`);
if (out !== html) { fs.writeFileSync(file, out); console.log(`✓ app/index.html actualizado a la versión ${version}`); }
else console.log(`✓ app/index.html ya está en la versión ${version}`);
