#!/bin/sh
# Une los archivos de src/ en script.js y arma style.css con las fuentes incluidas (los archivos que se suben a GitHub).
cd "$(dirname "$0")"
{
  echo "/* Caja Fácil — punto de venta para bodegas, minimarkets y fruterías. Versión 5."
  echo "   Todo se guarda en este navegador (IndexedDB). Archivo generado desde src/. */"
  echo "(() => {"
  echo "\"use strict\";"
  for f in src/*.js; do cat "$f"; echo; done
  echo "})();"
} > script.js
# Las fuentes ya no van dentro del CSS (pesaba 370 KB): se copian a fonts/ y el navegador solo baja las que usa.
mkdir -p fonts && cp src/fonts/*.woff2 fonts/
cp src/style.css style.css
python3 - <<'PY'
css = open("style.css", encoding="utf-8").read()
css = css.replace("/* Caja Fácil v5", "/* Fuentes (carpeta fonts/): Geist y Geist Mono (SIL OFL), Archivo (Omnibus-Type, OFL) y Caveat Brush (Impallari Type, OFL).\n   Caja Fácil v5", 1)
open("style.css", "w", encoding="utf-8").write(css)
PY

# Versión en index.html: el navegador baja script.js y style.css nuevos apenas cambian.
python3 - <<'PY'
import hashlib, re
v = hashlib.md5(open("script.js","rb").read() + open("style.css","rb").read()).hexdigest()[:8]
h = open("index.html", encoding="utf-8").read()
h = re.sub(r'href="style\.css(\?v=[\w-]+)?"', 'href="style.css?v=' + v + '"', h)
h = re.sub(r'src="script\.js(\?v=[\w-]+)?"', 'src="script.js?v=' + v + '"', h)
# Versión de las librerías de datos (img.js, fotos.js, escaner.js): casi nunca cambian, así se guardan en el equipo sin volver a bajarse.
def hv(f): return hashlib.md5(open(f, "rb").read()).hexdigest()[:8]
h = re.sub(r'window\.CF_V=\{[^}]*\}', 'window.CF_V={"img.js":"%s","fotos.js":"%s","escaner.js":"%s"}' % (hv("img.js"), hv("fotos.js"), hv("escaner.js")), h)
open("index.html", "w", encoding="utf-8").write(h)
PY
