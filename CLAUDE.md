# Caja Fácil — punto de venta (bodegas, minimarkets, fruterías)

App web estática (HTML/CSS/JS sin frameworks) publicada con GitHub Pages. Todo se guarda en el navegador (IndexedDB + copia en localStorage). El dueño es David (Lima, Perú); háblale en español simple.

## Cómo está armado
- **Edita solo `src/`**. `script.js` y `style.css` de la raíz son GENERADOS: nunca los edites a mano.
- `src/*.js` se unen en orden alfabético dentro de una IIFE → `script.js`.
- `src/style.css` → `style.css` con las fuentes de `src/fonts/` incrustadas en base64.
- Después de cualquier cambio corre: `sh build.sh` (necesita python3) y luego `node --check script.js`.
- `img.js` (ilustraciones), `fotos.js` (fotos de frutas/verduras) y `escaner.js` (lector de códigos html5-qrcode) son librerías de datos: no se tocan.
- `sw.js` es el service worker (red primero). Si agregas archivos nuevos, súmalos a su lista.

## Módulos (src/)
00-core datos, migraciones y ejemplos · 10-ui navegación, íconos, ventanas · 20-auth usuarios y PIN · 30-cart ticket · 31-sale pantalla de venta y cobro · 32-scale cajita de peso por kilo y balanza · 33-camera escanear con cámara · 40-products · 50-clients (crédito) · 60-cash caja, arqueo, cierres · 65-prov proveedores (deuda y abonos) · 67-cloud nube · 68-install botón «Instalar Caja Fácil» (Ajustes › Negocio) · 70-sales · 80-reports · 90-settings · 99-events teclado y eventos.

## Reglas de diseño
- Diseño actual: «caja moderna» (ticket a la izquierda, búsqueda arriba, teclas F1–F12 abajo en PC), crema + azul petróleo.
- Movimiento según Emil Kowalski: solo transform/opacity, menos de 300 ms, curva `--ease-out`, `scale(.97)` al presionar, sin animación cuando la acción viene del teclado.
- Textos cortos, modernos y en español peruano (S/, Yape, Plin).
- No agregar funciones que David no pidió.

## Skills de diseño
- Para rediseños usa `.claude/skills/redesign-skill` (de taste-skill, MIT) junto con emil-design-eng y frontend-design.
- Para facilidad de uso, accesibilidad y toque usa `.claude/skills/ui-ux-pro-max` (MIT). Su buscador se corre desde la raíz: `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<consulta>" --domain ux`.
- Para la página de ventas (landing) usa `.claude/skills/taste-skill` (de taste-skill, MIT) y prueba con Playwright mirando capturas.
- Forma de trabajo (de addyosmani/agent-skills, MIT): `interview-me` (una pregunta a la vez) → `spec-driven-development` → construir con `frontend-ui-engineering` → probar → `shipping-and-launch`.
- Esta app es HTML/CSS/JS sin frameworks: NO instales Tailwind, React, npm ni librerías de íconos aunque una skill lo sugiera. Todo se hace en `src/style.css` y `src/*.js`.
- Un rediseño cambia solo la apariencia; las funciones no se tocan.

## Modos de la pantalla de venta
- «Escáner (minimarket)» es el modo por defecto (`DB.cfg.view` distinto de "tiles"): sin fotos, lo último que pasaste, accesos para productos sin código y búsqueda en lista.
- «Fichas con fotos» (`DB.cfg.view = "tiles"`) se elige en Ajustes › Pantalla de venta.

## Nube (Supabase)
- `src/67-cloud.js`: respaldo automático, recuperar una tienda en otro equipo y panel «Mis tiendas hoy» (Ajustes › Nube). Sin librerías: usa fetch a la API REST y a Auth de Supabase.
- Proyecto `caja-facil` (São Paulo). URL y clave **publishable** están en el código (son públicas); NUNCA pongas la clave secret/service_role en la app.
- Tablas: `negocios`, `miembros`, `registros` (cada elemento de DB.products/sales/... es una fila; `tienda` = DB.biz.sid). Seguridad con RLS: cada usuario solo ve los negocios donde es miembro (`privado.es_miembro`).
- La caja siempre vende con sus datos locales; la nube solo copia cuando hay internet. Una tienda (sid) se usa en un solo equipo a la vez.
- Solo el dueño entra con Google; los cajeros siguen con PIN.
- Licencia: la caja no funciona hasta activarla con Google (pantalla `#susp`). Se bloquea si el proveedor la suspende o si pasan 15 días (`LIC_DIAS`) sin revisar la licencia con internet. Si vence la sesión de Google, sigue vendiendo hasta ese plazo.
- Soporte: el cliente da permiso por 24 h o 7 días (Ajustes › Nube); el proveedor (tabla `privado.admins`) ve «Mis clientes», mira datos solo con permiso y suspende/activa.

## Página de ventas
- `web/` es la landing para vender Caja Fácil (HTML/CSS nativo, Geist, capturas reales en `web/img/`). Plan en `docs/spec-web-ventas.md`. Precio S/ 50 al mes, 15 días gratis, WhatsApp 904 623 137. No toques la caja al editarla.
- `privacidad.html`, `terminos.html` (estilos en `legal.css`), `404.html` y `sitemap.xml` están en la raíz.

## Probar
Sirve la carpeta con `python3 -m http.server 8765` y abre http://localhost:8765. Botón «Cargar ejemplos» para tener productos de prueba.
