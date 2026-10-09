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
python3 - <<'PY'
import base64, re
css = open("src/style.css", encoding="utf-8").read()
def emb(m):
    data = base64.b64encode(open("src/" + m.group(1), "rb").read()).decode()
    return 'url(data:font/woff2;base64,' + data + ')'
css = re.sub(r'url\((fonts/[\w.-]+\.woff2)\)', emb, css)
css = css.replace("/* Caja Fácil v5", "/* Fuentes incluidas: Archivo (Omnibus-Type, OFL) y Caveat Brush (Impallari Type, OFL).\n   Caja Fácil v5", 1)
open("style.css", "w", encoding="utf-8").write(css)
PY
