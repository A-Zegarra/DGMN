# Academia Blender — DIGIWORLD ONLINE

Ruta práctica para aprender Blender construyendo, poco a poco, el arte 3D del
juego. No es un curso genérico: cada ejercicio termina en un archivo que se
puede revisar, exportar e integrar en el cliente.

## Cómo funciona

- Cada nivel tiene una parte de técnica y un **entregable** dentro de
  `art-source/`.
- Las sesiones son de 60–90 minutos. Mejor dos sesiones cortas por semana que
  una maratón.
- Tú modelas y exportas; yo reviso escala, orientación, materiales, presupuesto
  de triángulos e integración en el juego.
- Si algo no sale, no lo borres: guarda una copia, anota el problema y seguimos
  desde ahí. Iterar es parte del trabajo.
- Los nombres de la interfaz van en inglés porque es el idioma por defecto de
  Blender. La traducción va entre paréntesis cuando hace falta.

## Mapa de la ruta

| Nivel | Sesiones | Qué aprendes | Entregable |
|---|---:|---|---|
| 0. Conocer Blender | 1 | Interfaz, navegación, mover/rotar/escalar, guardar | Huevo Digi exportado |
| 1. Modelado low-poly | 2 | Modo edición, extrusión, loop cuts, bevel, modificadores | Roca y árbol del Bosque Digital |
| 2. Formas orgánicas | 3 | Blockout, remesh, escultura básica, booleanos, proporciones | Blockout de Gabumon/Patamon o cabeza de Agumon v2 |
| 3. UVs y materiales | 2 | Costuras, unwrap, PBR, pintura de texturas, baking | Personaje texturizado |
| 4. Rigging | 2 | Armature, pesos, poses, IK básico | Rig funcional con nombres del proyecto |
| 5. Animación | 2 | Keyframes, Graph Editor, loops, acciones | Idle + Walk + Attack |
| 6. Optimización y entrega | 1 | Decimate, LOD, compresión, validación GLB | GLB integrado en el juego |

Total: unas 13 sesiones. A una sesión por semana son tres meses; a dos, unas
seis semanas.

### Dos estilos, un mismo oficio

El juego usa dos salidas para el mismo modelo:

- **GLB PBR** para el visor y el modo HD (`?hd=1`).
- **Hoja de sprites 8-bit** para el estilo principal: 8 direcciones × poses,
  renderizadas desde el modelo en Blender y compuestas con Pillow.

El curso empieza por el oficio común (modelar, texturizar, riggear, animar) y
al final del Nivel 3 podemos desviarnos a la hoja de sprites si quieres producir
el estilo principal. El pipeline ya existe en
`MODELOS DE SPRITES/ENTRADA/digimon-linkz-agumon/gen_sprites.py`; no hay que
inventarlo de cero.

### Ruta rápida si ya has modelado antes

1. Lee las reglas del proyecto y abre la plantilla.
2. Salta al Nivel 2 y empieza por la cabeza del Agumon actual.
3. Usa los niveles 3–6 como referencia cuando llegues a UVs, rigging y
   animación.

## Reglas del proyecto (no negociables)

Estas reglas están puestas en la plantilla para que no tengas que memorizarlas.

| Regla | Valor |
|---|---|
| Unidad | 1 unidad de Blender = 1 metro |
| Altura de un Rookie | 1,5–1,9 m (Agumon ~1,8 m) |
| Pies | Apoyados en `Z = 0` |
| Origen | Centro entre los pies |
| Orientación | El personaje mira hacia `-Y` en Blender |
| Transformaciones | `Object > Apply > All Transforms` antes de exportar |
| Triángulos (PC) | 30.000–60.000 |
| Triángulos (Android) | 12.000–25.000 |
| Materiales (PC) | 4–8 |
| Materiales (Android) | 2–4 |
| Texturas (PC / Android) | 2K / 1K |
| Huesos | 40–80 en PC; 30–50 en Android |
| Formato de entrega | `.blend` + `.glb` + capturas + `notas.md` |

Nombres de huesos recomendados:

```text
root, hips, spine, chest, neck, head, jaw
arm_L, forearm_L, hand_L
arm_R, forearm_R, hand_R
leg_L, shin_L, foot_L
leg_R, shin_R, foot_R
tail_01, tail_02, tail_03
```

Nombres de acciones: `Idle`, `Walk`, `Run`, `Attack`, `Ability`, `Hit`,
`Victory`, `Death`.

## Tu kit de trabajo

```text
art-source/templates/plantilla_digimon.blend   escena con escala y estudio
art-source/templates/plantilla_digimon.png     vista previa de la plantilla
art-source/templates/crear_plantilla.py        regenera la plantilla
art-source/academia-blender/leccion-01-...md   primera sesión
```

La plantilla trae:

- Suelo con cuadrícula de 1 × 1 m.
- Regla vertical de 1,80 m.
- Flecha que marca la dirección frontal (`-Y`).
- Colecciones `ENTREGA`, `REFERENCIA` y `ESTUDIO`.
- Cámara y tres luces de estudio listas para renderizar.
- Colección `ENTREGA` activa: lo que añadas cae ahí automáticamente.
- Texto `LEEME` dentro del editor de texto de Blender con el checklist.

## Flujo de entrega

1. Abre la plantilla y guarda una copia:
   `art-source/<personaje>/<personaje>_v01.blend`. Nunca guardes encima del
   archivo original.
2. Modela dentro de `ENTREGA`. `REFERENCIA` y `ESTUDIO` no se exportan.
3. Exporta solo lo seleccionado a
   `art-source/<personaje>/<personaje>_v01.glb`.
4. Haz capturas de frente, perfil, 3/4 y espalda en `capturas/`.
5. Rellena `notas.md` con cambios, pendientes y dudas.
6. Avísame con la ruta. Reviso el GLB, lo integro y te devuelvo capturas del
   juego para la siguiente iteración.

### Checklist antes de decir “está listo”

- [ ] Mide entre 1,5 y 1,9 m si es un Rookie.
- [ ] Los pies tocan `Z = 0`.
- [ ] Mira hacia `-Y`.
- [ ] `Ctrl+A > All Transforms` aplicado.
- [ ] Triángulos dentro del presupuesto.
- [ ] Materiales con nombres claros.
- [ ] Sin suelo, luces, cámara ni figuras de referencia en la exportación.
- [ ] Texturas empaquetadas o en carpeta relativa.
- [ ] El `.glb` se importa en una escena limpia y se ve bien.
- [ ] `notas.md` actualizado.

## Atajos esenciales

| Acción | Atajo |
|---|---|
| Órbita | Arrastrar botón central (MMB) |
| Desplazar vista | `Shift` + MMB |
| Zoom | Rueda del ratón |
| Ver todo | `Home` |
| Enfocar selección | `Numpad .` |
| Vista frontal / derecha / superior | `Numpad 1` / `3` / `7` |
| Vista opuesta | `Ctrl` + `1` / `3` / `7` |
| Alternar perspectiva / ortográfica | `Numpad 5` |
| Ver por la cámara | `Numpad 0` |
| Añadir objeto | `Shift + A` |
| Mover / rotar / escalar | `G` / `R` / `S` |
| Restringir a un eje | `X` / `Y` / `Z` tras `G`, `R` o `S` |
| Duplicar | `Shift + D` |
| Borrar | `X` |
| Seleccionar todo / nada | `A` / `Alt + A` |
| Selección por caja | `B` |
| Cambiar modo objeto / edición | `Tab` |
| Vértice / arista / cara | `1` / `2` / `3` en modo edición |
| Extruir | `E` |
| Loop cut | `Ctrl + R` |
| Bisel | `Ctrl + B` |
| Inset | `I` |
| Unir vértices | `M` |
| Rellenar cara | `F` |
| Recalcular normales | `Shift + N` |
| Sombrear suave | Clic derecho → `Shade Smooth` |
| Aplicar transformaciones | `Ctrl + A` → `All Transforms` |
| Buscar cualquier comando | `F3` |
| Guardar / guardar como | `Ctrl + S` / `Ctrl + Shift + S` |
| Render | `F12` |
| Deshacer / rehacer | `Ctrl + Z` / `Ctrl + Shift + Z` |

> Si usas portátil sin teclado numérico: `Edit > Preferences > Input` y activa
> **Emulate Numpad**. También puedes usar los menús `View` y `Add`.

## Cómo te ayudo yo

- Preparo ejercicios y plantillas como esta.
- Reviso tus archivos y te digo exactamente qué corregir (escala, topología,
  UVs, pesos, presupuesto).
- Integro el GLB en el visor y en el mundo, y te mando capturas.
- Si te atascas en un paso, pégame el error o una captura y lo resolvemos.

## Legal

El prototipo es privado, pero el arte que se publique debe ser original o estar
licenciado. No subas modelos extraídos de Digimon ni arte oficial a un
repositorio público. Para la versión pública sustituiremos el content pack por
criaturas propias.

## Empieza aquí

Abre la plantilla y sigue
[`leccion-01-primeros-pasos.md`](leccion-01-primeros-pasos.md). Al terminar
tendrás tu primer GLB exportado y sabrás navegar por Blender sin miedo.
