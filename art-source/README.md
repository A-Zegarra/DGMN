# Arte 3D y colaboración en Blender

Esta carpeta es el punto de encuentro para el arte original del proyecto.

```text
art-source/
  README.md
  academia-blender/    ruta de aprendizaje y lecciones
  agumon/              modelo de trabajo, GLB exportados y notas
  referencias/         imágenes de referencia (no se publican)
  templates/           plantilla de Blender con escala y orientación
```

## Para empezar

- Ruta completa: [`academia-blender/README.md`](academia-blender/README.md).
- Primera sesión: [`academia-blender/leccion-01-primeros-pasos.md`](academia-blender/leccion-01-primeros-pasos.md).
- Plantilla de escena: [`templates/README.md`](templates/README.md).


## Reparto de trabajo

- **Arte (Blender):** modelado, escultura, UVs, texturas, rigging y animaciones.
- **Código (yo):** importación a Unity/Three.js, shaders, visor, integración,
  optimización, pruebas en web/Android y despliegue.

No hace falta que toques el código. Tú entregas `.blend` + `.glb` + capturas, y
yo lo integro y te devuelvo el resultado dentro del juego.

## Reglas de escala y orientación

- Unidad: **1 unidad de Blender = 1 metro**.
- Altura de un Rookie: **1,5–1,9 m**. Agumon: ~1,8 m.
- Pies en **Z = 0**. El origen del objeto, en el centro entre los pies.
- El personaje mira hacia **-Y en Blender**. El exportador glTF lo convierte a
  +Z en el juego.
- Aplica las transformaciones antes de exportar:
  `Object > Apply > All Transforms`.
- No escales el objeto principal con valores raros; mejor modela a escala real.

## Presupuesto técnico

| Elemento | PC | Android |
|---|---:|---:|
| Triángulos | 30.000–60.000 | 12.000–25.000 |
| Materiales | 4–8 | 2–4 |
| Texturas | 2K | 1K |
| Huesos | 40–80 | 30–50 |

Para la primera pasada no hace falta llegar al presupuesto móvil; priorizamos que
se vea bien y luego hago LOD.

## Nombres recomendados

Si el modelo usa esqueleto, nombres de huesos:

```text
root, hips, spine, chest, neck, head, jaw
arm_L, forearm_L, hand_L
arm_R, forearm_R, hand_R
leg_L, shin_L, foot_L
leg_R, shin_R, foot_R
tail_01, tail_02, tail_03
```

Acciones/animaciones (en inglés, para que las detecte el código):

```text
Idle, Walk, Run, Attack, Ability, Hit, Victory, Death
```

Si el modelo no tiene esqueleto, no pasa nada: podemos animarlo por nodos como el
Agumon actual.

## Exportar a GLB

En Blender:

1. `File > Export > glTF 2.0 (.glb/.gltf)`.
2. Formato: **glTF Binary (.glb)**.
3. Marca:
   - `+Y Up`
   - `Apply Modifiers`
   - `Include > Selected Objects` o la colección del personaje.
   - `Data > Armature` si existe.
   - `Animation > Animation Mode: Actions` si hay animaciones.
4. No exportes cámaras, luces, el suelo de referencia ni la plantilla de escala.
5. Comprueba que las texturas estén empaquetadas o en una carpeta relativa.

## Qué entregar

En `art-source/agumon/`:

```text
agumon_v01.blend
agumon_v01.glb
texturas/            (si no están empaquetadas)
capturas/            (frente, perfil, 3/4 y espalda)
notas.md             (qué cambiaste y qué falta)
```

Puedes dejar el `.blend` pesado fuera de Git y compartirlo por Drive/OneDrive.
El `.glb` final optimizado sí lo integraré en el juego.

## Primera tarea recomendada

**Mejorar la cabeza y la silueta del Agumon actual.**

1. Abre `apps/client/public/models/agumon.glb` en Blender como referencia.
2. Decide si vas a editar esa malla o modelar una nueva desde cero.
3. Prioriza:
   - hocico más definido,
   - ojos más integrados,
   - boca con dientes y lengua,
   - proporción cabeza/cuerpo,
   - manos y pies.
4. Exporta `agumon_v01.glb` y avísame con la ruta.
5. Yo lo meto en el visor y en el juego, y te paso capturas para iterar.

## Herramientas opcionales

- **PureRef** o **Kuadro**: tablero de referencias.
- **Krita**: texturas y retoque.
- **Material Maker**: materiales procedurales.
- **Ucupaint**: pintura por capas dentro de Blender.
- **Rigify**: rigs humanoides; para criaturas conviene un rig manual.
- **Git LFS**: si quieres versionar `.blend` grandes en Git.

## Legal

Los modelos oficiales de Digimon son de Bandai Namco. Este proyecto es privado.
No subas modelos extraídos ni arte oficial al repositorio público. Para la
versión pública, el arte debe ser original o estar licenciado.
