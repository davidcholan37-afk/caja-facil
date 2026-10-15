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
00-core datos, migraciones y ejemplos · 10-ui navegación, íconos, ventanas · 20-auth usuarios y PIN · 30-cart ticket · 31-sale pantalla de venta y cobro · 32-scale cajita de peso por kilo y balanza · 33-camera escanear con cámara · 40-products · 50-clients (crédito) · 60-cash caja, arqueo, cierres · 65-prov proveedores (deuda y abonos) · 67-cloud nube · 68-install botón «Instalar Caja Fácil» (Ajustes › Negocio) · 69-voz voz con IA (extra de pago) · 70-sales · 80-reports · 90-settings · 99-events teclado y eventos.

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

## Avisos y precios (Productos y Clientes)
- Ficha del producto › Más opciones: **precio por mayor** (`p.mayor = {q, p}`: desde q unidades/kg cada una cuesta p; se aplica solo en `resolveLine` con `mayorOf`, no en presentaciones ni si cambias el precio a mano; la línea muestra «mayor»), **proveedor** (`p.sup` = id de `DB.supp`) y **fecha de vencimiento** (`p.exp` = AAAA-MM-DD).
- Productos tiene pestañas: Inventario · Por reponer (agrupado por proveedor, botón «Pedir por WhatsApp» con el celular del proveedor, `lowGroups`) · Por vencer (`expItems`, 7 días) · Sin mover (`idleItems`, 30 días sin movimiento en el kardex, con la plata parada al costo) · Movimientos.
- `avisoDia()`: una vez al día al abrir la caja avisa lo que vence esta semana (`DB.cfg.avisoDia`).
- Clientes › «Recordar deudas»: lista de deudores con botón de WhatsApp (mensaje con monto y desde cuándo; marca `c.rem` = día en que se avisó). Ticket por WhatsApp ya existía (`wa` en el comprobante).
- Voz de pagos: «paga a proveedor Gloria 500», «paga a Gloria 500 de abono», «le pagué 500 a Gloria», «salda/cancela la deuda de Gloria» o «págale todo» (`todo`: paga el saldo completo), «Rosa pagó todo» (abono por toda su deuda), y **deuda_proveedor**: «Gloria me fió 300», «me fiaron 300 de Gloria», «le quedo debiendo 200 a Gloria», «compré fiado a Gloria 300» (abre «Anotar lo que me fiaron» con el monto; se confirma antes de guardar). `vzNameAfterA` ignora «proveedor», «cliente», «doña»…
- Voz: consultas `comprar`, `vence` (con o sin producto) y `sin_mover` (también en la función `voz` de la nube).

## Voz (gratis, con y sin internet; extra que el proveedor activa)
- `src/69-voz.js`: botón micrófono (solo si el negocio tiene `voz` activa en la nube). Oído: con internet el de Chrome (Web Speech); sin internet (o en el programa de Windows) **Vosk** con el modelo español de 34 MB (`voz/`, Apache 2.0), que se instala una vez en Cache Storage `cf-voz-1` (bandera `cf-voz-off` en localStorage). Con Vosk se le pasa una gramática con los productos/clientes/proveedores de la caja.
- El intérprete es local (`vzParse`, sin IA): órdenes anotar, quitar, cambiar, vaciar, cobrar (con yape/plin/efectivo/tarjeta; solo abre el cobro), crear_producto (abre la ficha prellenada, con costo y stock), actualizar (precio, costo, stock y código de barras de un producto existente), activar/desactivar (mostrar u ocultar en la venta), categoria, ingreso («llegaron 20 huevos» suma stock), precio/stock, pagar_proveedor, fiado, abono, repetir, consulta (ventas_hoy, ganancia, mas_vendidos, con `per` hoy/ayer/semana/mes); cantidades: kilo, medio, cuarto, cuartito, docena, par, céntimos, «dos cincuenta», «pan por un sol»; muletillas («oye», «por favor», «nomas») y variantes mal oídas (llape, jape, «ya pe», plim, débito) se limpian en `vzTokens`; «pagó con yape»/«cierra la venta» cobran; «anula», «tacha», «mejor no X» quitan → se buscan en los datos de la caja → tarjeta «Entendí» → Aceptar. Nada se anota ni paga sin Aceptar; respeta permisos (`can`).
- Pantallas de la voz (estilo Apple): orbe que late con el volumen (`.vzmic` con `--lv`), palabras reconocidas marcadas en vivo (`vzSet`/`vzKnown`), tarjeta «Entendí» tipo recibo (`rc` en cada línea de `vzPlan`) con fichas «Cobrar con» Efectivo/Yape/Plin/Tarjeta (`vozpay`: anota y abre el cobro, nunca cobra solo; solo con permiso `cobrar`), vuelto si dices «paga con 50», respuestas con número grande (`big`) y barras, y ✓ al aceptar (`vzTic`). Solo transform/opacity.
- IA gratuita (Groq u otra tipo OpenAI): se usa SOLO si el intérprete local no entendió todo y hay internet; se queda con lo que entienda mejor (`vozSend`: `valor`). Se apaga con localStorage `cf-voz-ia`="0"; si la función no existe o no tiene clave (404/503) no se vuelve a intentar por 10 min. Llama a `supabase/functions/voz/index.ts` (secretos `IA_URL`, `IA_KEY`, `IA_MODEL` de Supabase, ej. llama-3.3-70b-versatile) y le manda el catálogo (nombres de productos, clientes, proveedores y lo que hay en el ticket; nunca teléfonos ni documentos). Acciones: anotar, quitar, cambiar, vaciar, cobrar, crear_producto, actualizar, ingreso, activar, desactivar, categoria, precio, stock, pagar_proveedor, fiado, consulta. Nunca claves en la app ni en el repo.
- `supabase/voz.sql` (columnas `voz`, `voz_limite`, `voz_usar`, `admin_voz`) ya aplicado (migración voz_extra). El proveedor activa la voz en Ajustes › Nube › Mis clientes («Dar voz»).
- `sw.js` no toca `/voz/` ni borra `cf-voz-1`.
- Oído en la nube (`supabase/functions/voz-oido/index.ts`, Whisper tipo OpenAI; secretos opcionales `STT_URL`, `STT_KEY`, `STT_MODEL`, si faltan usa los de IA): en el programa de Windows y cuando no hay Web Speech se graba con el micrófono (volumen automático + detector de silencio) y se manda el audio con el catálogo como pista. Si falla (403 sin voz, 429, 5xx) se avisa y por 10 min se usa Vosk. Se apaga con localStorage `cf-voz-nube`="0". Cuenta en el mismo límite diario (`voz_usar`).

## Programa de Windows
- `desktop/` (Electron): ventana que abre la caja publicada (se actualiza sola). El .exe lo fabrica GitHub Actions (`.github/workflows/escritorio.yml`) y lo publica en Releases como `CajaFacil-Setup.exe`. Para una versión nueva del programa sube `version` en `desktop/package.json`.
- Google no deja entrar dentro del programa: abre el navegador en `#login-escritorio` y vuelve con `cajafacil://auth#...` (ver `src/67-cloud.js`).

## Página de ventas
- `web/` es la landing para vender Caja Fácil (HTML/CSS nativo, Geist, capturas reales en `web/img/`). Plan en `docs/spec-web-ventas.md`. Precio S/ 50 al mes, 15 días gratis, WhatsApp 904 623 137. No toques la caja al editarla.
- `web/cine/` es una página ESPECIAL aparte («Un día en tu bodega»: cielo WebGL que se atraviesa con el scroll, bodega real y las funciones por hora). Se hizo una sola vez para mostrarla; `web/index.html` sigue siendo la página de ventas de siempre. Sin librerías, `noindex`.
- `privacidad.html`, `terminos.html` (estilos en `legal.css`), `404.html` y `sitemap.xml` están en la raíz.

## Probar
Sirve la carpeta con `python3 -m http.server 8765` y abre http://localhost:8765. Botón «Cargar ejemplos» para tener productos de prueba.
