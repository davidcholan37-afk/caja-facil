# Caja Fácil — Plano de construcción (spec de diseño)

Punto de venta web para **bodegas, minimarkets y fruterías de Lima, Perú**. Lo usa un cajero que atiende rápido, muchas veces con lector de códigos de barras USB, en una PC (1366×768) o en un celular (390×844). Moneda: soles (S/). Medios de pago: Efectivo, Yape, Plin, Tarjeta, Transferencia, Crédito.

**Objetivo del diseño:** moderno, tranquilo y muy fácil de usar. Nada llamativo: sin fondos de fotos, sin neón, sin letras tipo plumón. Lo importante (total, cobrar, vuelto) se ve grande; lo demás es discreto.

---

## 1. Sistema visual

### Colores
| Token | Hex | Uso |
| --- | --- | --- |
| Fondo | `#E9E5DC` | fondo general (crema arena) |
| Superficie | `#F7F4EE` | fichas, botones, barras |
| Superficie hundida | `#E2DDD1` | fondos de imagen, pastillas |
| Papel | `#FFFEFB` | ticket y ventanas |
| Tinta | `#2A2823` | texto principal |
| Tinta 2 | `#4D4A42` | texto secundario |
| Tinta 3 | `#857F72` | ayudas, etiquetas |
| Acento | `#2E4A5A` | azul petróleo: Cobrar, seleccionado, activo |
| Acento oscuro | `#1E2B33` | barra de búsqueda |
| Línea | `rgba(42,40,35,.12)` | bordes de 1 px |
| Éxito | `#1C8A4C` sobre `#E2F4E8` | «¡Vendido!» |
| Aviso | `#A85F00` | deudas, stock bajo |
| Error | `#CF3527` | quitar, falta dinero |

### Tipografía
- Una sola familia: **Archivo** (sans). Números tabulares para precios.
- Total grande: 800, −0.035em. Títulos: 750–800. Texto: 500–650.
- Mayúsculas solo en las teclas (F1, F2…). Todo lo demás en tipo oración.

### Forma
- Radios: 12 px (botones, teclas), 16 px (fichas, ticket), 20–22 px (ventanas).
- Bordes de 1 px en vez de sombras. Una sombra suave solo en ventanas flotantes.

### Movimiento (estilo Emil Kowalski)
- Solo `transform` y `opacity`. Curva `cubic-bezier(.23,1,.32,1)`. Siempre menos de 300 ms.
- Todo lo que se toca se hunde a `scale(.97)` al presionar (160 ms).
- Ventanas: en PC aparecen con zoom de 0.97 a 1 y opacidad (180 ms). En celular suben desde abajo como cajón (320 ms).
- Si la acción vino del teclado (F2, Enter), las ventanas abren sin animación.
- Hover solo con mouse (`@media (hover:hover)`).

---

## 2. Pantallas

### A. Vender (PC) — la más importante
```
┌────┬──────────────────┬───────────────────────────────────────────┐
│    │ TICKET           │ [ Escanea o escribe un producto      ] [📷][⚖][🔖][+] │
│ M  │ Mi negocio  hora │ ┌─────────────────────────────────────────┐ │
│ E  │ Ticket 1  espera │ │ Lo último que pasaste                   │ │
│ N  │ Cliente · Nota   │ │ Cerveza 620 ml               S/ 7.00    │ │
│ Ú  │ Cant Producto  S/│ │ 1 × S/ 7.00                             │ │
│    │  2  Inca Kola 6.0│ └─────────────────────────────────────────┘ │
│ 88 │  1  Arroz     4.5│ Sin código de barras                        │
│ px │                  │ [Tomate 1][Cebolla 2][Pan 11][Huevos 12]... │
│    │ Subtotal / IGV   │                                             │
│    │ Total   S/ 17.50 │ Mi negocio                Caja Fácil · user │
│    │ [ Cobrar S/17.50 F2 ]│ [F1 Clientes][F2 Cobrar][F3 Buscar][F4 En espera][F6 Cantidad][F7 Dividir] │
│    │ [Crédito][Dividir]│ [F8 Yape][F9 Tarjeta][F10 Plin][Supr Quitar][Crédito][Descuento] │
└────┴──────────────────┴───────────────────────────────────────────┘
```
- **Menú lateral** (88 px): Vender, Ventas, Productos, Clientes, Caja, Proveedores, Reportes, Ajustes. Ícono + texto pequeño. El activo va en pastilla azul petróleo.
- **Ticket** a la izquierda (420 px), en papel blanco: filas con cantidad editable (− 2 +), nombre, precio unitario e importe. La fila seleccionada se marca con una franja azul a la izquierda. Abajo: Subtotal, IGV 18% y **Total** grande.
- **Cobrar**: botón azul petróleo de ancho completo con el total. Debajo, pequeños: Crédito, Dividir, Preventa.
- **Búsqueda**: barra oscura (`#1E2B33`) con texto claro. El lector escribe ahí y Enter agrega el producto.
- **Modo escáner (por defecto)**: no hay fotos de productos. Arriba, una tarjeta con «Lo último que pasaste», con el nombre y el importe grandes. Debajo, una cuadrícula de botones de texto para lo que **no tiene código** (verduras, pan, huevos, sueltos), con su código corto en una pastilla.
- **Al escribir**: los resultados salen en **lista** (nombre, código, stock y precio a la derecha).
- **Teclas F** abajo: 12 teclas planas, ícono de color, texto en tipo oración y la tecla en una pastilla gris arriba a la izquierda.
- **Modo fichas (opcional en Ajustes)**: cuadrícula de productos con foto, precio y nombre.

### B. Vender (celular)
- Arriba: búsqueda, botón cámara (azul) y botón «más».
- Centro: «Lo último que pasaste» y los accesos sin código en 2 columnas.
- Fija abajo: barra **Ver ticket · S/ 17.50** (blanca) y **Cobrar** (azul).
- Pestañas inferiores: Vender, Ventas, Caja, Productos, Más.

### C. Cobrar (ventana)
- «A cobrar» + **S/ 10.00** enorme. Etiqueta pequeña del comprobante (Nota de venta).
- Medios de pago como pastillas: **Efectivo** (activo, oscuro), Yape, Plin, Tarjeta, Transferencia, Crédito.
- Efectivo: 5 tarjetas de billete en fila: **Exacto** (sin vuelto), S/ 20, S/ 50, S/ 100, S/ 200, cada una con «Vuelto S/ x». Un toque cobra.
- Enlace discreto «Paga con otro monto» (abre un campo + vuelto). Abajo: «Volver» y «Dividir pago F7».
- Yape/Plin: número del negocio grande y botón «Ya llegó el Yape: cobrar S/ x».

### D. ¡Vendido! (el ticket después de cobrar)
- Sello verde en pastilla: ✓ **¡Vendido!**
- Número del comprobante. Caja grande: **Vuelto S/ 10.00**, y abajo «Pagó con S/ 20.00 · total S/ 10.00».
- Botones: Imprimir, WhatsApp, y el enlace «Ver comprobante».
- Botón grande **Nueva venta** (Enter) y la ayuda «O escanea el siguiente producto y seguimos».

### E. Pesar por kilo (ventana pequeña)
- Foto o ícono + nombre («Arroz Costeño suelto») + «Se vende por kilo · stock 50 kg».
- Dos campos grandes lado a lado: **Precio por kilo (S/)** (editable) y **Peso (kg)** (acepta 0.5 o 250g).
- Línea punteada y **A pagar S/ 2.25** grande.
- Botones: Cancelar | **Agregar · S/ 2.25**. Sin teclado numérico en pantalla ni botones rápidos.

### F. Proveedores
- Lista: nombre, «Le debes / Sin deuda», monto a la derecha (ámbar si debe). Resumen arriba: «Debes en total» y «Pagado hoy».
- Detalle: nombre grande, tarjeta «Le debes S/ 50.00», botones **Pagar o abonar** y «Anotar lo que me fiaron». Tabla de movimientos: Fecha, Detalle, Deuda, Pago, Saldo.
- Ventana de pago: Monto, «Pagar todo: S/ x», método (Efectivo, Yape, Plin, Transferencia) y la nota «Si es efectivo, sale de la caja».

### G. Caja
- Tarjeta «Tu caja está abierta» con «Efectivo que debe haber» grande y botones «Cerrar mi caja (arqueo)» y «Corte parcial».
- Ventas del día por medio de pago, movimientos (gastos, proveedores, retiros) y cierre del día (Z).

---

## 3. Textos (tono)
Cortos, cercanos, peruanos, sin tecnicismos. Ejemplos:
- Búsqueda: «Escanea o escribe un producto»
- Ticket vacío: «Todo listo para vender — Escanea, busca o toca un producto para empezar.»
- Sin productos: «Empecemos por tus productos»
- Cobrar: «A cobrar», «Paga con otro monto», «Volver»
- Después de cobrar: «¡Vendido!», «O escanea el siguiente producto y seguimos.»
- Avisos: «Abrimos tu caja. Anota tu sencillo en Caja», «Primero agrega algo al ticket», «No encontramos «x»»

## 4. Reglas
- Lo más usado tiene que estar a un toque o a una tecla.
- Contraste alto en totales y botones. Tamaño táctil mínimo 44 px.
- Respetar `prefers-reduced-motion`.
- Nada de fondos con fotos, degradados llamativos ni sombras pesadas.
