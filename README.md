# Visor SQL EnergyPlus

Visor offline de resultados de simulación térmica de **EnergyPlus / OpenStudio** (`eplusout.sql`), con soporte para EPW y CSV y funciones estilo DView: explorador de variables, temperaturas de zonas con curva promedio anual, mapas de calor, perfiles mensuales, estadísticas, PDF/CDF, curva de duración y dispersión. Solo se activan las variables que tienen datos en el archivo, y todas están disponibles en todos los gráficos (cada gráfico se adapta a la frecuencia horaria, diaria o mensual). La sección *Acerca de* (F1 en la versión de escritorio) explica cada tipo de gráfico.

La aplicación es un único HTML autocontenido (`app/index.html`, sin CDN) empaquetado como ejecutable portable de Windows x64 con Electron.

## Estructura

```
app/index.html                     Visor (HTML autocontenido)
main.js                            Ventana de escritorio (Electron)
package.json                       Dependencias y configuración de electron-builder
build/icon.ico                     Ícono de la aplicación
scripts/validate.js                Validación previa a la compilación
.github/workflows/build-windows.yml  Compilación en GitHub Actions
```

## Compilar en GitHub

1. Suba esta carpeta a un repositorio de GitHub.
2. **Versión publicada:** cree y suba una etiqueta; el flujo compila y adjunta el `.exe` a un Release.
   ```
   git tag v2.5.0
   git push origin v2.5.0
   ```
3. **Prueba sin publicar:** pestaña *Actions* → *Compilar Windows x64* → *Run workflow*. Los `.exe` quedan en *Artifacts* de esa ejecución.

Resultado, dos archivos:
- `VisorSQL-EnergyPlus-<versión>-portable-x64.exe`: se ejecuta con doble clic, sin instalación (ideal para USB).
- `VisorSQL-EnergyPlus-<versión>-instalador-x64.exe`: instala en la carpeta del usuario (o la que se elija), crea accesos directos en el escritorio y el menú Inicio y se desinstala desde *Configuración → Aplicaciones* de Windows.

## Compilar localmente (Windows)

```
npm ci
npm start                 # abre el visor
npm run dist              # portable + instalador en dist/
npm run dist:portable     # solo el portable
npm run dist:installer    # solo el instalador
```

## Notas

- El ejecutable no está firmado; Windows SmartScreen puede mostrar un aviso la primera vez (*Más información → Ejecutar de todas formas*).
- Para actualizar el visor basta con reemplazar `app/index.html` y crear una nueva etiqueta.
