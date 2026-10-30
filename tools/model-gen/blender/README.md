# Agumon en estilo figura de vinilo (Blender)

Generador del Agumon PBR pensado para el visor y el mundo de DIGIWORLD ONLINE.
Construye el personaje con primitivas suaves, las funde con un *remesh* por
vóxeles, las alisa, aplica materiales PBR y exporta un GLB optimizado para el
juego. Además guarda una versión densa para renders y una hoja de contacto con
cuatro vistas.

## Requisitos

- Blender 5.x (probado con 5.2.3 LTS).
- No hace falta instalar nada más: el script usa `bpy` y `bmesh`.

## Uso

Desde la raíz del repositorio:

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b `
  --factory-startup `
  --python tools/model-gen/blender/agumon_vinyl.py
```

Opciones útiles (van después de `--`):

| Opción | Efecto |
|---|---|
| `--quick` | Render rápido (320×400, 16 muestras) para iterar |
| `--no-render` | Solo genera el `.blend` y el `.glb` |
| `--views front,side` | Renderiza solo esas vistas |
| `--game` | Renderiza la malla de juego (40k) en vez de la densa |

Ejemplos:

```powershell
# Iterar rápido la vista frontal
blender -b --python tools/model-gen/blender/agumon_vinyl.py -- --quick --views front

# Comprobar cómo se ve el GLB final
blender -b --python tools/model-gen/blender/agumon_vinyl.py -- --quick --game --views front,three_quarter
```

## Salidas

Todo se escribe en `tools/model-gen/blender/out/`:

| Archivo | Contenido |
|---|---|
| `agumon_vinyl.glb` | Modelo de juego, ~39.500 triángulos, ~0,75 MB |
| `agumon_vinyl.blend` | Escena completa con malla densa (~322k triángulos) y de juego |
| `preview_front.png` | Vista frontal de la malla densa |
| `preview_three_quarter.png` | Vista 3/4 |
| `preview_side.png` | Perfil |
| `preview_back.png` | Reverso |
| `preview_head.png` | Primer plano de la cabeza |
| `agumon_contact.png` | Hoja de contacto 2×2 |
| `preview_game_*.png` | Vistas de la malla de juego (con `--game`) |

En el `.blend`, la colección `DENSE` está oculta y la colección `GAME` es la
visible. Para renders finales, activa `DENSE` y desactiva `GAME`; el estudio
(luces, fondo oliva y cámara) ya está montado.

## Jerarquía del GLB

```
Agumon
└── body
    ├── head
    │   ├── jaw
    │   │   ├── teethLower
    │   │   └── tongue
    │   ├── teethUpper
    │   ├── throat
    │   ├── nostrilL / nostrilR
    │   └── eyeWhite / eyeIris / eyePupil / eyeGlint / eyeRim (L y R)
    ├── armL → clawHandL
    ├── armR → clawHandR
    ├── legL → clawFootL
    ├── legR → clawFootR
    └── tail
```

Los nombres `body`, `head`, `jaw`, `armL`, `armR`, `legL`, `legR` y `tail` son
exactamente los que busca `apps/client/src/game/models/DetailedDigimon.tsx`, así
que la animación procedural existente funciona sin cambios.

Los materiales también conservan los nombres que el visor reconoce:
`BodyVinyl`, `BodyVinylBelly`, `ClawIvory`, `ToothIvory`, `EyeWhite`, `EyeIris`,
`EyePupil`, `EyeGlint`, `EyeSocket`, `Mouth`, `Tongue` y `Nostril`.

## Presupuesto técnico

| Elemento | Valor |
|---|---:|
| Triángulos (GLB) | ~39.500 |
| Triángulos (malla densa) | ~322.000 |
| Tamaño del GLB | ~0,75 MB |
| Materiales | 12 |
| Texturas | 0 (color y materiales) |
| Nodos animables | 7 principales |
| Altura | ~1,75 unidades |
| Pies | apoyados en `y = 0` |

La malla de juego se obtiene decimando cada pieza con un presupuesto por nodo y
un ajuste final para no pasar de 40.000 triángulos.

## Llevarlo al juego

1. Copia `out/agumon_vinyl.glb` a `apps/client/public/models/agumon.glb`.
2. Recarga el cliente. El visor de inicio y el compañero del mundo lo cargan
   automáticamente.
3. Si el modelo se ve desproporcionado, ajusta la escala en
   `apps/client/src/game/DigimonBody.tsx`.
4. Si añades animaciones esqueléticas más adelante, reproduce el `AnimationMixer`
   desde `DetailedDigimon.tsx` en lugar de la animación por nodos.

## Cómo está construido

- Cuerpo, cabeza, mandíbula, brazos, piernas y cola se modelan con esferas,
  cápsulas y tubos.
- Cada pieza se une con `Remesh` en modo vóxel (7–8 mm) y se alisa con un
  modificador `Smooth`, lo que produce superficies orgánicas cerradas.
- La boca se talla con una diferencia booleana; las caras interiores reciben el
  material `Mouth`.
- Los ojos usan casquetes esféricos para el iris y la pupila, de modo que quedan
  pintados sobre el globo ocular sin anillos flotantes.
- La barriga se pinta con un degradado suave en un atributo de color por vértice
  (`Col`), así que no hay costuras ni bordes dentados.
- Las garras y los dientes son tubos cónicos con radio decreciente.

## Limitaciones conocidas

Es una **primera pasada generada por procedimiento**, no una escultura manual.
La silueta, los colores y los materiales siguen las referencias de figura de
vinilo, pero el modelado de la cabeza (hocico, párpados y transición al cráneo)
todavía puede ganar mucho con una pasada de escultura en Blender.

Siguientes pasos recomendados:

1. Refinar la cabeza con esculpido manual (párpados, pliegues de la boca, fosas
   nasales) usando este archivo como base.
2. Añadir un esqueleto real y pesos para animaciones de caminar, atacar y idle.
3. Hornear mapas de normales y oclusión a partir de la malla densa.
4. Generar LODs para Android y comprimir con Meshopt/KTX2.
