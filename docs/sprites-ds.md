# Sprites estilo Digimon World DS (Modo 2.5D en 3ª persona elevada)

## Línea original integrada

Koromon, Agumon, Greymon, MetalGreymon y WarGreymon usan sus hojas originales
locales en modo **Sprites DS**. Las hojas aportadas por el usuario se conservan
en `MODELOS DE SPRITES/`; sus atlas se preparan con
`python scripts/prepare-evolution-sprites.py`. Las poses grandes de combate se
ajustan con nearest-neighbor y se conservan los colores y la transparencia.
Ninguna necesita `?customsprites=1` ni conexión a The Spriters Resource al jugar.

Devimon también usa su hoja original DS (TSR 48593, redblueyellow), incluida
en el atlas local. Los nuevos salvajes PvE solo usan especies con atlas original.
El domador ya usa el protagonista original, y Gabumon, Patamon, Garurumon y
Angemon también tienen atlas originales locales. Pagumon y Gazimon siguen con
respaldos 2D, pero no aparecen en los spawns actuales. No se usan modelos 3D.

## Domador, Gabumon y Patamon

`python scripts/prepare-party-sprites.py` genera cinco atlas desde los originales
sin modificarlos. El domador tiene ocho vistas originales y cinco filas; los
Digimon tienen siete filas, incluidas poses de combate. Se conservan colores y
transparencia, sin redibujar ni inventar ángulos ausentes.

La configuración de cada atlas indica sus filas: no se interpreta el domador
como una hoja de combate de siete filas. Los originales comparten un canvas por
personaje, independientemente de nombre, chaqueta o compañero del jugador, sin
recoloreado ni decodificaciones repetidas por apariencia.

Procedencia, hashes y limitaciones: `art-source/ds-sheets/party-provenance.json`.
Las hojas del domador conservan ambos protagonistas; por ahora se usa únicamente
el masculino y no hay selector de apariencia.

Pruebas: `python scripts/test-party-sprites.py` y
`node scripts/test-party-sprites-ui.cjs` (Chrome y `puppeteer-core` en `NODE_PATH`).
La primera verifica integridad, paleta, alpha, alineación y reproducción exacta.
La segunda comprueba los píxeles realmente pintados en los canvas del visor y
del mundo, sus dimensiones y la caché, en escritorio y móvil; rechaza peticiones
GLB/GLTF o a sitios externos de sprites. `GAME_URL` permite probar local o público.

Para Garurumon y Angemon en el mundo, `apps/server/test/seed-party-ui.ts` prepara
una base temporal nueva. Arrancar el servidor local con `DIGIWORLD_DATA_DIR`
apuntando a esa base y pasar el JSON de claves mostrado como `PARTY_UI_TOKENS`
al test de navegador. Esas claves públicas de prueba solo se permiten contra
localhost; no se usan en producción. No añade APIs de prueba al juego.

## Agumon original

Agumon usa ahora los píxeles reales de la hoja TSR **48418**, no el dibujo
procedural. Se carga automáticamente, sin `?customsprites=1`, tanto en el visor
como para compañeros y salvajes. El atlas forma parte de los assets compilados;
no requiere acceder a TSR mientras se juega. Créditos y limitaciones de las
direcciones disponibles: `art-source/ds-sheets/README.md`.

Las instrucciones siguientes corresponden al formato personalizado del motor,
**no al formato de las hojas originales descargadas**. No basta con renombrar
una hoja de TSR: primero hay que recortar sus fotogramas y limpiar el fondo.

El juego incluye un modo **2.5D estilo Digimon World DS / Ragnarok Online** activo por defecto:

- **Cámara en 3ª persona elevada (38°)**: sin primera persona, con órbita libre de 360° (clic izquierdo), orientación de personaje (clic derecho), avance con ambos botones y zoom progresivo con la rueda del ratón.
- **Domadores y Digimon en Sprite 2D (8 direcciones)**: tanto el Domador como todos los Digimon (compañero y salvajes) se dibujan con filtrado pixel-art nítido (`NearestFilter`) sobre el escenario 3D, orientándose hacia la cámara e inclinándose hacia la vista elevada.
- **Solo sprites DS**: no existe selector 3D ni alternancia con `V`.
  Las preferencias antiguas y `?3d=1` ya no cambian la representación.
  No se cargan GLB/GLTF y el build público no incluye la carpeta `models`.

---

## Cómo usar hojas descargadas de The Spriters Resource (`dgmnworldds`)

Para las hojas personalizadas opcionales, activar `?customsprites=1` y colocar
archivos en `apps/client/public/sprites/` con estos nombres. Este mecanismo es
de desarrollo; los atlas originales integrados se cargan sin esa opción y
tienen prioridad. El build público excluye las hojas de esta carpeta:

| Personaje / Digimon | Ruta del archivo |
|---|---|
| Domador (Tamer) | `apps/client/public/sprites/tamer_ds.png` |
| Agumon | `apps/client/public/sprites/agumon_ds.png` |
| Gabumon | `apps/client/public/sprites/gabumon_ds.png` |
| Patamon | `apps/client/public/sprites/patamon_ds.png` |
| Greymon | `apps/client/public/sprites/greymon_ds.png` |
| Garurumon | `apps/client/public/sprites/garurumon_ds.png` |
| Angemon | `apps/client/public/sprites/angemon_ds.png` |

### Formato de la cuadrícula (Grid)

Cada archivo `*_ds.png` utiliza una cuadrícula uniforme de **8 columnas × 5 filas** con fondo transparente:

- **8 columnas (direcciones respecto a la cámara)**:
  1. `Columna 0`: Sur (frente)
  2. `Columna 1`: Suroeste (diagonal frontal izquierda)
  3. `Columna 2`: Oeste (perfil izquierdo)
  4. `Columna 3`: Noroeste (diagonal trasera izquierda)
  5. `Columna 4`: Norte (espalda)
  6. `Columna 5`: Noreste (diagonal trasera derecha)
  7. `Columna 6`: Este (perfil derecho)
  8. `Columna 7`: Sureste (diagonal frontal derecha)
- **5 filas (animación)**:
  - `Fila 0`: Pose quieta (*idle*)
  - `Filas 1 a 4`: Ciclo de caminar / correr (4 pasos)

Si un archivo `*_ds.png` no está presente en `apps/client/public/sprites/`, el motor genera automáticamente en memoria el atlas pixel-art estilo Nintendo DS de esa especie o domador para que nunca falten texturas.
