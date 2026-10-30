# Hojas originales — Digimon World DS

## Agumon (integrado)

- Fuente: https://www.spriters-resource.com/ds_dsi/dgmnworldds/sheet/48418/
- Copia obtenida mediante el archivo histórico del enlace de descarga:
  https://web.archive.org/web/2024im_/https://www.spriters-resource.com/download/48418/
- Original sin modificar: `agumon_raw.png` (352 × 144).
- Créditos que figuran en la hoja: **Mighty Jetters y redblueyellow**.
- La ficha del sitio indica a **Garamonde** como submitter.
- Juego y personajes pertenecen a sus respectivos titulares. La descarga no
  otorga una licencia de redistribución; conservar para el prototipo interno.

`python scripts/prepare-agumon-ds.py` genera el atlas utilizado por el cliente
en `apps/client/src/assets/sprites/agumon-ds.png`. Requiere Pillow.
Elimina los colores de fondo y recorta/refleja los píxeles originales,
sin redibujado. Se usa en el visor, compañeros y salvajes Agumon.

La hoja no incluye ocho direcciones de movimiento: las vistas derecha se
reflejan y los ángulos traseros reutilizan la diagonal. El atlas tiene 8 columnas
y 7 filas: idle, cuatro pasos y poses de ataque/reacción recortadas de la parte
superior de la hoja. Las poses grandes se reducen con nearest-neighbor para
mantener el tamaño del personaje. La fila de reacción se acompaña de un
destello rojo y retroceso; la hoja no identifica una animación de daño específica.

## Angemon (integrado)

- Fuente: https://www.spriters-resource.com/ds_dsi/dgmnworldds/sheet/48611/
- Original: `angemon_raw.png` (312 × 425). Créditos visibles en la hoja:
  **A.J. Nitro y Dazz**. Se corrigió la atribución previa al revisar el original.
- Atlas de 8 × 7 celdas generado por `scripts/prepare-party-sprites.py`.

## Devimon (integrado)

- Fuente: https://www.spriters-resource.com/ds_dsi/dgmnworldds/sheet/48593/
- Copia histórica: https://web.archive.org/web/2024im_/https://www.spriters-resource.com/download/48593/
- Original sin modificar: `devimon_raw.png` (406 × 334).
- Créditos visibles: **redblueyellow**.
- `python scripts/prepare-evolution-sprites.py` genera `devimon-ds.png`:
  atlas de 8 × 7 celdas, conservando la paleta original. Los sectores sin
  dirección propia reutilizan la vista disponible más cercana.
- Se aplican las mismas limitaciones de derechos y uso interno descritas arriba.

## Línea evolutiva original proporcionada por el usuario (integrada)

Koromon, Greymon, MetalGreymon y WarGreymon se leen de sus carpetas en
`MODELOS DE SPRITES/`, sin modificar esas hojas. `scripts/prepare-evolution-sprites.py`
recorta movimiento y poses de combate, elimina únicamente sus fondos y genera
atlas de 384 × 336. MetalGreymon ya tiene transparencia: se conservan sus
contornos negros. Los originales y sus créditos se conservan completos.

Procedencia, hashes SHA-256 y créditos: `evolution-provenance.json`.
No hay ocho ángulos completos para todas las etapas: algunos sectores reutilizan
la vista original más cercana o su reflejo. Las poses de ataque/reacción se
normalizan con nearest-neighbor para evitar cambios bruscos de tamaño.

## Protagonista y compañeros DS (integrados)

| Personaje | Hoja TSR | Original | Créditos visibles |
| --- | --- | --- | --- |
| Protagonista / domador | 48323 | `tamer_raw.png` (328 × 626) | RadSpyro y redblueyellow |
| Gabumon | 41249 | `gabumon_raw.png` (412 × 203) | redblueyellow |
| Patamon | 48422 | `patamon_raw.png` (355 × 134) | Mighty Jetters y redblueyellow |
| Garurumon | 48583 | `garurumon_raw.png` (313 × 294) | RadSpyro |

Fuentes: `https://www.spriters-resource.com/ds_dsi/dgmnworldds/asset/<id>/`.
Se obtuvieron copias históricas mediante
`https://web.archive.org/web/2024im_/https://www.spriters-resource.com/download/<id>/`.
Los originales se conservan completos y sin modificar; el juego no los descarga
de esos sitios. Se aplican las mismas limitaciones de derechos y uso interno.

`python scripts/prepare-party-sprites.py` produce los atlas de estos cuatro
personajes y Angemon. Procedencia, créditos, dimensiones, SHA-256 de originales
y atlas, y limitaciones por personaje: `party-provenance.json`.

El domador usa el protagonista masculino sin recoloreado, con ocho vistas
originales y tres poses por dirección (idle y dos pasos). El atlas de 384 × 240
tiene cinco filas. Se conserva también la protagonista femenina en la hoja,
pero no se añade un selector de apariencia. El domador no tiene ataques.

Los cuatro Digimon usan atlas de 384 × 336 (siete filas: idle, cuatro pasos,
ataque y reacción). No todas las hojas tienen ocho ángulos completos; se
reutiliza/refleja la vista disponible más cercana. Las poses de combate grandes
se ajustan con nearest-neighbor sin alterar los colores. La reacción no se
presenta como una secuencia original específica de daño.

Pagumon y Gazimon, especies antiguas que no aparecen en los spawns PvE actuales,
siguen con respaldos 2D provisionales. Ninguno se sustituye por modelos 3D.
