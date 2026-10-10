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

---

# Rediseño v2 (nivel Apple, identidad propia)

## Auditoría de la v1 (redesign-skill, taste-skill, frontend-design, emil-design-eng)
| Problema en la v1 | Por qué se ve genérico | Cambio en la v2 |
| --- | --- | --- |
| Portada dividida: texto a la izquierda, captura chica a la derecha y un celular encima | Es la plantilla de landing más común; el producto se ve pequeño | Titular centrado y corto, y la caja enorme saliendo de un escenario gris claro |
| Insignia «15 días gratis» y botón relleno + botón con borde repetidos 3 veces | Etiquetas decorativas y la pareja de botones de siempre | Un botón píldora principal y un enlace de texto «Escríbeme por WhatsApp ›» |
| Mosaico de 6 tarjetas con borde, una azul y una negra | Kit de tarjetas SaaS; el bloque negro rompe el tema claro | Capítulos: pesar (dividido), cobrar (imagen grande apilada), caja (dividido) y una rejilla tipográfica sin tarjetas |
| Franja «sin internet» de solo texto | Sección plana | Declaración grande con 3 datos y la caja en el celular |
| Pasos dentro de cajitas numeradas | Plantilla | Numerales grandes y finos en una sola línea |
| Preguntas en acordeón | Patrón genérico que esconde las respuestas | Lista lado a lado: título fijo a la izquierda, respuestas visibles |
| Burbuja verde flotante de WhatsApp | Segundo color de acento sobre todo | WhatsApp fijo en la barra superior (siempre visible) |
| Pesos 700 y titulares gruesos | Se ven pesados | Geist 600 con tracking negativo, cuerpo 17-19 px |
| Capturas de ventanas con esquinas del fondo borroso | Recortes sucios | Capturas con fondo transparente y en alta resolución (srcset) |

## Lectura de diseño
Página de producto de consumo para dueños de bodegas de Lima, con el refinamiento de una página de producto de Apple (titular centrado, producto enorme, mucho aire), identidad propia por el ticket impreso y el «S/». HTML y CSS nativos, Geist.
- Diales: DESIGN_VARIANCE 6 · MOTION_INTENSITY 5 · VISUAL_DENSITY 3.
- Color: blanco #FFFFFF y escenarios #F4F5F7, tinta #111418, gris #5B6270, acento único #0A66FF (el de la caja). Oscuro automático.
- Forma: botones en píldora, escenarios de imagen 28 px, capturas 14 px. Nada más.
- Movimiento (Emil): entrada única de la portada; las imágenes se descubren con clip-path una sola vez al aparecer; el ticket sale de la ranura. Todo con ease-out fuerte, solo transform/opacity/clip-path, y nada si el sistema pide menos movimiento.

# v3 (más Apple, menos IA)
- Sin paneles grises alrededor de las imágenes: franjas a todo lo ancho (blanco, gris #F5F5F7 y un único momento oscuro en «Se va el internet»).
- Frases de Apple: la idea en negrita y la explicación en gris en el mismo párrafo.
- Letra del sistema de Apple (SF Pro) en iPhone y Mac; Geist en Windows y Android.
- Precio en la portada («Desde S/ 50 al mes. Los primeros 15 días, gratis.»), como Apple muestra «Desde…».
- La plantilla de Figma del usuario era genérica (fotos de comida y textos de relleno); no se usó como base.

# v4: «Un día en la bodega» (aprobado por David)

## Auditoría de la v3 (redesign-skill + taste-skill)
| En la v3 | Problema | En la v4 |
| --- | --- | --- |
| Funciones sueltas (kilo, vuelto, caja) | Muestra piezas, no cuenta cómo ayuda en el día | Historia con hora: 7:00 abres, 10:00 vendes, 13:00 cobras con Yape, 21:00 cierras y la caja cuadra |
| Portada clara | Correcta pero sin impacto | Portada oscura y cinematográfica: la caja iluminada sobre negro, se acerca al bajar |
| Dos bloques oscuros posibles | Rompería el tema | Un solo cambio deliberado: portada oscura → resto claro; «Se va el internet» pasa a claro |
| Sin dónde funciona | El cliente no sabe si sirve en su equipo | Sección PC + celular + app instalada, con capturas reales |

## Lectura de diseño (taste-skill 0.B)
Página de producto para dueños de bodegas de Lima, con lenguaje de lanzamiento de Apple (portada cinematográfica, narrativa con pantalla fija, mucho aire), identidad propia por el ticket impreso y el «S/». HTML y CSS nativos (sin React, GSAP ni Tailwind: el proyecto lo prohíbe), Geist / SF Pro.
- Diales: DESIGN_VARIANCE 6 · MOTION_INTENSITY 6 · VISUAL_DENSITY 3.
- Movimiento (emil-design-eng): scroll-driven CSS (`animation-timeline: view()`) con respaldo estático; cambios de pantalla de la historia con IntersectionObserver (sin escuchar el scroll); fundido + blur suave; nada con teclado ni con «reducir movimiento».
- Solo se edita `web/`. El POS (`src/`, `index.html`, `script.js`, `style.css`, `sw.js`) no se toca.
