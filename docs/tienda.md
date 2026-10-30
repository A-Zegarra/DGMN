# Tienda del refugio

Abrir **Mochila / Mapa → Tienda**. No añade controles al HUD ni personajes 3D.

| Oferta | Coste por compra | Entrega |
| --- | --- | --- |
| Disco de vida | 50 Bits | 1 disco de vida |
| Disco de energía | 40 Bits | 1 disco de energía |
| Suministros de las ruinas | 1 sello de Devimon | 5 discos de vida, 3 de energía y 200 Bits |

Cada acción compra un único lote. No se venden objetos ni se intercambia entre
jugadores. Comprar no cura, no da XP y no cambia las recargas de combate.

## Reglas del servidor

- Domador y compañero deben estar en el Refugio del Inicio (radio 16).
- Se rechaza durante combate/duelo, derrota o transformación del compañero.
- El cliente solo envía `offerId`. Precio, coste, cantidades y propietario se
  resuelven en el servidor. Campos de precio/cantidad enviados por un cliente
  modificado se ignoran.
- Se comprueban saldo y espacio para el lote completo, incluidos los Bits que
  entrega el canje. Un rechazo no consume Bits, sellos ni espacio.
- Cobro y entrega se aplican sin interrupción y se guardan juntos con el perfil.
  No requiere formato de guardado nuevo ni migración del inventario.
- Hay un intervalo de 400 ms entre compras aceptadas por sesión. El cliente
  bloquea las compras mientras espera respuesta y durante ese intervalo.
  Una compra nueva después del intervalo es otro lote, con otro cobro.
- Inventario, recibos y errores son privados. Si hay un error de disco se muestra
  el aviso habitual; no cerrar hasta confirmar el guardado.

Catálogo: `packages/content/src/shop.ts`. El precio se puede ajustar ahí sin
aceptar valores del navegador ni tocar archivos de partidas.

## Pruebas

```text
pnpm --filter @digiworld/server exec tsx test/shop.ts
node scripts/test-shop-ui.cjs
```

El test de servidor cubre compras y canje, mensajes malformados/precios falsos,
saldo, capacidad, radio seguro de ambos personajes, estados bloqueados,
ráfagas de peticiones, privacidad y restauración después de reiniciar.

El test de navegador usa `GAME_URL` y prueba 1280×800, 390×844, 360×640 y 844×390:
precios, botones sin saldo, scroll y navegación de pestañas con teclado. Tab y
Shift+Tab quedan dentro de la ventana aunque todas las compras estén deshabilitadas.
También fuerza un botón deshabilitado y comprueba que el servidor rechaza la
compra sin Bits, sin modificar el saldo.
Requiere Chrome y `puppeteer-core` en `NODE_PATH`.

Para una compra real automatizada sin tocar perfiles reales:

1. Ejecutar `pnpm --filter @digiworld/server exec tsx test/seed-shop-ui.ts`.
2. Arrancar el servidor local con `DIGIWORLD_DATA_DIR` igual al directorio
   temporal **nuevo** mostrado por la fixture, y Vite con servidor local.
3. Pasar la clave pública de prueba mostrada como `SHOP_UI_TOKEN` al ejecutar
   `test-shop-ui.cjs`. Comprueba dos compras, un canje, inventario exacto y recarga.

Nunca usar esa clave ni esa base temporal en producción. Las pruebas públicas
se ejecutan sin `SHOP_UI_TOKEN`. Capturas en `%TEMP%/opencode/shop-qa/`.
