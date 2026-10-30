# Controles, cámara e interfaz

## Correcciones

- Entrada de teclado y joystick enviada a 20 Hz, independiente de los FPS de
  WebGL. Soltar el control envía la parada sin esperar otro fotograma.
- Las teclas se liberan también en captura: una ventana no puede interceptar
  `keyup` y dejar movimiento activo. Pérdida de foco, pestaña oculta, cambio de
  orientación y salida de página limpian teclado, ratón y dedos.
- Joystick con un único dedo propietario, zona muerta y radio calculado desde
  su tamaño real. Liberación al cancelar el gesto, perder captura o desmontar.
  Otro dedo puede girar la cámara sin tomar el mando del joystick.
- Mochila, evolución, cámara, chat y solicitud de duelo suspenden los controles
  del mundo. Al cerrarlos se requiere una pulsación nueva; no se reanudan teclas
  que seguían físicamente apretadas. Tab permanece dentro de los diálogos.
- Enter abre el chat; enviar o Escape devuelve el teclado al juego.
- Cámara elevada entre 20° y 65°. El ajuste de inclinación se aplica al instante.
  El encuadre considera al compañero y el formato vertical. El tamaño del sprite
  se calcula de forma estable, sin variar con su rotación o animación de golpe.
- El seguimiento automático no gira mientras se usa el joystick: evita caminar
  en espiral al mantener una dirección lateral.
- Cabecera medida con ResizeObserver. Información del compañero y objetivo en
  columnas separadas, habilidades y joystick en zonas distintas, chat como
  ventana y ayuda de teclado plegable. Se respetan márgenes seguros de pantalla.

## Pruebas reproducibles

Se necesita Chrome y `puppeteer-core` disponible en `NODE_PATH`. No se necesita
Docker. Ejecutar el servidor local y Vite con `VITE_SERVER_URL=http://localhost:2567`
(la variable de entorno prevalece sobre una `.env.local` que apunte al HP).

```text
pnpm dev:server
pnpm dev:client
node scripts/test-controls-ui.cjs
node scripts/test-camera-views.cjs
```

`GAME_URL` permite indicar otro puerto de Vite. Estas dos pruebas necesitan el
cliente de desarrollo para leer telemetría; la compilación pública no expone
`window.__dw`.

La prueba de controles usa eventos de teclado y ratón de Chrome y dedos CDP,
incluidos dos dedos a la vez, cancelación y pérdida nativa de captura.
Comprueba también el movimiento autoritativo cuando se suspende la actualización
visual y detecta solapamientos y botones tapados mediante geometría e hit-testing.

Resoluciones: 1280×800, 1024×768, 390×844, 360×640, 844×390 y 667×375.
La prueba de cámara recorre cuatro orientaciones en escritorio, móvil vertical
y horizontal, comprueba la visibilidad de ambos personajes, los límites de
inclinación y una colisión controlada contra una pared.

Capturas y resultados: `%TEMP%/opencode/controls-qa/`.
Son pruebas de navegador con emulación táctil; la sensación y rendimiento en un
Android físico deben comprobarse también en el dispositivo del usuario.
