# Página para vender Caja Fácil (spec)

## Intención (interview-me, confirmada por David)
- **Qué es:** una página para que dueños de bodegas, minimarkets y fruterías conozcan Caja Fácil.
- **Para quién:** dueños de negocios pequeños en Lima, que llegan casi siempre desde el celular (WhatsApp, TikTok, Facebook).
- **Qué deben hacer:** dos caminos. Botón principal **«Pruébala gratis»**, que abre la caja y se activa con Google. Botón secundario **«Escríbeme por WhatsApp»** (904 623 137).
- **Prueba:** 15 días gratis. Al terminar, David decide si suspende desde «Mis clientes»; la app no cambia.
- **Precio:** S/ 50 al mes, visible en la página.
- **Fuera de alcance:** pagos en línea, formularios, blog, boletas o facturas SUNAT (la página debe decir con honestidad que aún no las emite), analítica.

## Dónde vive
- `web/index.html` → `https://davidcholan37-afk.github.io/caja-facil/web/`
- «Pruébala gratis» lleva a `../` (la caja).
- Archivos propios en `web/` (CSS, fuentes, imágenes). La caja (`index.html`, `src/`) no se toca.

## Lectura de diseño (taste-skill)
Landing de software para dueños de bodegas de Lima, con un lenguaje claro y de confianza de producto moderno, apoyado en capturas reales de la caja. HTML y CSS nativos con Geist, sin frameworks.
- Diales: DESIGN_VARIANCE 6 · MOTION_INTENSITY 4 · VISUAL_DENSITY 4 (negocio pequeño, primero la confianza).
- Colores: los mismos de la caja. Fondo #F4F5F7, tinta #0E1420, un solo acento azul #0A66FF. Modo oscuro según el sistema.
- Forma: radios 12 px en botones y 20 px en paneles, en toda la página.
- El elemento memorable: el **precio como un ticket impreso** (papel térmico, Geist Mono), porque el ticket es lo que la caja imprime todos los días. El resto queda tranquilo.

## Secciones (cada una con un formato distinto)
1. Barra: logo, Funciones, Precio, Preguntas, «Pruébala gratis».
2. Portada dividida: titular, una frase de hasta 20 palabras, dos botones; a la derecha, capturas reales de la PC y del celular.
3. Funciones en mosaico (bento) de 6 celdas con capturas reales: lector y cámara, venta por kilo, cobro con vuelto y Yape/Plin, fiado, proveedores, caja y cierre.
4. Franja «Sin internet también vende»: copia en la nube y ver tus tiendas desde el celular.
5. Cómo empiezas: 3 pasos reales en línea de tiempo.
6. Precio: el ticket.
7. Preguntas frecuentes (acordeón).
8. Cierre con los dos botones y pie con privacidad, términos, correo y WhatsApp.
- Botón flotante de WhatsApp (punto 18 de la lista de 20 del video).

## Lista del video «20 cosas antes de lanzar tu web»
Aviso legal y privacidad (enlazados), sin cookies de seguimiento, HTTPS (GitHub), título y descripción, datos estructurados (SoftwareApplication con precio), sitemap, favicon, texto alternativo en imágenes, imágenes comprimidas (WebP), carga rápida, contraste AA, bien en celular, página 404, WhatsApp visible, una sola llamada a la acción principal. Pendiente: ficha de Google, analítica y robots.txt (necesitan dominio propio o cuentas).

## Cómo se prueba
Playwright en 390 px y 1366 px, modo claro y oscuro: capturas revisadas, sin scroll horizontal, sin errores de consola, enlaces funcionando, cero rayas largas (—) en el texto (regla de taste-skill).
