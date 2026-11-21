# Visor SQL EnergyPlus

Visor offline de resultados de simulación térmica de **EnergyPlus / OpenStudio** (`eplusout.sql`), con soporte para EPW y CSV y funciones estilo DView: explorador de variables, temperaturas de zonas con curva promedio anual, mapas de calor, perfiles mensuales, estadísticas, PDF/CDF, curva de duración y dispersión. Solo se activan las variables que tienen datos en el archivo, y todas están disponibles en todos los gráficos (cada gráfico se adapta a la frecuencia horaria, diaria o mensual). La sección *Acerca de* (F1 en la versión de escritorio) explica cada tipo de gráfico.

### Novedades 2.7

- **Escritorio**: doble clic sobre `.sql` / `.epw` (el instalador registra la asociación), «Abrir con…» (también con el portable), *Archivo → Abrir* (Ctrl+O), *Agregar casos SQL…*, **archivos recientes** (menú, barra lateral y lista de saltos de Windows) y una sola ventana: abrir otro archivo lo lleva a la ventana existente.
- **Arrastrar y soltar** archivos sobre la ventana (varios SQL: el primero es el base y los demás se agregan como casos; en *Comparación de Casos* se agregan como casos; una sesión `.json` la restaura).
- **Sesiones** (`.json`, Ctrl+S / Ctrl+Shift+O): variables, criterios, zonas, casos y gráficos generados; en escritorio guarda también las rutas y reabre los archivos.
- **Unidades SI / IP** en el encabezado: series, estadísticas, balance, indicadores y exportaciones.
- **Rendimiento**: índice y conteo de registros en un Web Worker (la ventana no se bloquea al cargar), Plotly cartesiano y CSS de Tailwind precompilado: el HTML pasa de 5,4 MB a 2,8 MB.
- **Mantenimiento**: la versión sale solo de `package.json` (`npm run sync-version`), `npm run validate` revisa librerías, módulos, CSS y versión, y `npm test` ejecuta una prueba de humo en Electron con dos SQL reales (`tests/fixtures`). Ambos corren en GitHub Actions antes de compilar.

### Novedades 2.6

- **Confort adaptativo** en *Temperaturas de Zonas*: ASHRAE 55 (80 % / 90 %) y EN 16798-1 (categorías I–III) además del rango fijo, con banda diaria variable, diagrama adaptativo, % de horas en confort por mes, **grados-hora** de disconfort por zona y opción de evaluar solo horas ocupadas (*Zone People Occupant Count* > 0).
- **Ventilación Natural**: variables AirflowNetwork / ZoneVentilation / infiltración (renovaciones, caudales en m³/h, factor de apertura), horas con ventilación activa y cruce apertura × temperatura interior/exterior.
- **Balance Térmico**: términos *Zone Air Heat Balance* (o ganancias y pérdidas de energía) en barras mensuales, total anual, perfil diario y tabla, por zona o total, en kWh o kWh/m².
- **Comparación de Casos**: varios `eplusout.sql` superpuestos, mapa de calor de diferencias hora a hora, tabla de deltas, confort por zona y caso, e indicadores de los reportes por caso.
- **Indicadores del modelo** en el Resumen (energía del sitio, EUI, horas fuera de consigna, usos finales) leídos de los reportes tabulares.
- **Exportaciones**: PNG ×3 o SVG de cada gráfico (barra del gráfico), **Excel** con una hoja por gráfico y tabla de la sección activa, e **informe PDF** con las secciones elegidas.

Para aprovechar todo, agregue en el modelo `Output:SQLite, SimpleAndTabular;` y variables como *Site Outdoor Air Drybulb Temperature*, *Zone Operative Temperature*, *Zone People Occupant Count*, *AFN Zone Ventilation Air Change Rate*, *AFN Surface Venting Window or Door Opening Factor* y *Zone Air Heat Balance \** (horarias).

La aplicación es un único HTML autocontenido (`app/index.html`, sin CDN) empaquetado como ejecutable portable de Windows x64 con Electron.

## Estructura

```
app/index.html                     Visor (HTML autocontenido: Plotly, sql.js, Papa Parse, jsPDF, fflate)
main.js                            Ventana de escritorio (Electron)
package.json                       Dependencias y configuración de electron-builder
build/icon.ico                     Ícono de la aplicación
preload.js                         Puente seguro ventana ↔ Electron (abrir archivos, recientes, menú)
scripts/validate.js                Validación previa a la compilación
scripts/sync-version.js            Copia la versión de package.json al HTML
scripts/smoke-test.js              Prueba de humo en Electron (npm test)
tests/fixtures/                    Dos SQL de ejemplo (AirflowNetwork, 3 zonas, enero) y sus IDF
.github/workflows/build-windows.yml  Compilación en GitHub Actions
```

## Compilar en GitHub

1. Suba esta carpeta a un repositorio de GitHub.
2. **Versión publicada:** cree y suba una etiqueta; el flujo compila y adjunta el `.exe` a un Release.
   ```
   git tag v2.7.0
   git push origin v2.7.0
   ```
3. **Prueba sin publicar:** pestaña *Actions* → *Compilar Windows x64* → *Run workflow*. Los `.exe` quedan en *Artifacts* de esa ejecución.

Resultado, dos archivos:
- `VisorSQL-EnergyPlus-<versión>-portable-x64.exe`: se ejecuta con doble clic, sin instalación (ideal para USB).
- `VisorSQL-EnergyPlus-<versión>-instalador-x64.exe`: instala en la carpeta del usuario (o la que se elija), crea accesos directos en el escritorio y el menú Inicio y se desinstala desde *Configuración → Aplicaciones* de Windows.

## Compilar localmente (Windows)

```
npm ci
npm start                 # abre el visor
npm run validate          # revisa el HTML
npm test                  # prueba de humo en Electron con los SQL de ejemplo
npm run dist              # portable + instalador en dist/
npm run dist:portable     # solo el portable
npm run dist:installer    # solo el instalador
```

## Notas

- Asociación de archivos: la registra el **instalador** (doble clic sobre `.sql` / `.epw`). Con el portable use «Abrir con…» → *Elegir otra aplicación* → el `.exe`.
- Para actualizar la versión: cambie `version` en `package.json` y ejecute `npm run sync-version` (con una etiqueta `vX.Y.Z` el flujo de GitHub lo hace solo).

- El ejecutable no está firmado; Windows SmartScreen puede mostrar un aviso la primera vez (*Más información → Ejecutar de todas formas*).
- Para actualizar el visor basta con reemplazar `app/index.html` y crear una nueva etiqueta.
