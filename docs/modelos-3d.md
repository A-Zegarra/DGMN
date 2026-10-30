# Modelos 3D detallados

## Estado actual

- **Agumon usa el modelo 3D detallado por defecto**, tanto en el visor como en el
  mundo.
- En **desarrollo** se usa `agumon_linkz_rigged.glb` (rigueado, más fiel al
  anime). En el **build público** se usa `agumon.glb`, el modelo original de
  Blender, para no publicar material de terceros.
- El modo **sprite 8-bit** es opcional y se activa con `?retro=1`. No forma parte
  del build público actual.
- **Gabumon y Patamon** mantienen los modelos procedurales low-poly como
  respaldo. El visor lo indica con la etiqueta `Low-poly`.
- Si el GLB no existe o falla, el juego vuelve automáticamente al modelo
  procedural. Nada se rompe.

## Cómo está montado

```text
tools/model-gen/blender/agumon_vinyl.py   genera la malla, los renders y el GLB
tools/model-gen/blender/out/              GLB, .blend denso y previsualizaciones
MODELOS DE SPRITES/ENTRADA/               modelos de entrada y scripts de adaptación
apps/client/public/models/                assets públicos servidos por Vite/Cloudflare
DetailedDigimon.tsx                       carga GLB, ajusta materiales y anima nodos
CharacterStage.tsx                        visor con luces de estudio, sombras y órbita
DigimonBody.tsx                           elige GLB detallado o modelo procedural
```

`DetailedDigimon` mantiene dos rutas: `MODEL_URLS` para el mundo y
`SHOWCASE_URLS` para el visor. La variante de exhibición se elige con
`variant="showcase"` desde `CharacterStage.tsx`.

El modelo se construye con primitivas suaves (esferas, cápsulas y tubos), se
fusiona con un *remesh* por vóxeles de 7–8 mm, se alisa con un modificador
`Smooth` y se decima a un presupuesto de ~40.000 triángulos. La boca se talla
con una diferencia booleana y la barriga se pinta con un degradado de color por
vértice. Las piezas se guardan en una jerarquía de nodos:

- `body`
- `head`
- `jaw`
- `armL`, `armR`
- `legL`, `legR`
- `tail`
- ojos, dientes, boca y garras como piezas hijas

Three.js reproduce una animación procedural sobre esos nodos: caminar, correr,
respirar, girar la cabeza, mover la cola y abrir/cerrar ligeramente la boca.

## Materiales y render

- `MeshPhysicalMaterial` con clearcoat bajo para el acabado de figura de vinilo.
- Color por vértice para la barriga, sin textura externa.
- Entorno IBL suave en el mundo y luces de estudio en el visor.
- Sombras direccionales y contact shadows en el visor.
- Tone mapping ACES y salida sRGB.

## Modelo Linkz rigueado

`apps/client/public/models/agumon_linkz_rigged.glb` viene del FBX de *Digimon
Linkz* que está en `MODELOS DE SPRITES/ENTRADA/digimon-linkz-agumon/`.

> **Solo desarrollo privado.** Es material de terceros. El build público usa
> `agumon.glb` y no incluye este archivo.

- 5.042 triángulos, una textura de 512×512, 34 huesos y ~315 KB.
- El FBX original trae 11 clips, pero al importarlos las poses salen deformadas
  (el `idle` parece una pose sentada). Por eso el GLB no lleva clips: la
  animación se hace por huesos desde Three.js.
- `DetailedDigimon` aplica una pose base (brazos abajo) y anima piernas, rodillas,
  tobillos, brazos, cabeza y cola. Hay ciclo de idle, caminar y correr.
- El GLB hereda una escala de armadura muy grande. Al cargarlo, se mide su caja
  real y se normaliza a 1,75 de alto, centrado y con los pies en el suelo.
- Los modelos con skin se clonan con `SkeletonUtils.clone`; si se usa un clon
  normal, el esqueleto deja de deformar la malla.
- El cargador conserva los mapas de textura al sustituir materiales por
  `MeshPhysicalMaterial`.

Los scripts de adaptación están en
`MODELOS DE SPRITES/ENTRADA/digimon-linkz-agumon/`:
`linkz_rigged.py` exporta el rig, `linkz_static.py` genera la variante estática y
`adapt_linkz.py` fue la primera prueba con clips.

## Modo 8-bit

El estilo 8-bit es **opcional**. Se activa con `?retro=1` y se desactiva
recargando sin ese parámetro. Mantiene las cámaras de primera y tercera persona,
pero renderiza la escena a baja resolución y usa un sprite de Agumon en lugar del
modelo 3D.

- Hoja: `apps/client/public/sprites/agumon_sheet.png` (768×480, 8 direcciones
  × 5 poses, 96×96 por celda, ~142 KB).
- Poses: idle + 4 pasos de caminar.
- Paleta reducida a 28 colores y contorno de 1 píxel.
- `SpriteDigimon.tsx` dibuja un billboard que mira a la cámara y elige la
  dirección según el ángulo entre la cámara y el rumbo del personaje.
- El tamer y las demás especies siguen usando los modelos low-poly; solo el
  Agumon compañero usa sprite.

Los sprites se generan desde el modelo rigueado con
`MODELOS DE SPRITES/ENTRADA/digimon-linkz-agumon/gen_sprites.py` y se componen
con `make_sheet.py` (Pillow). Son material de terceros y no se despliegan en la
versión pública.

## Presupuesto técnico

| Elemento | Valor actual |
|---|---:|
| Triángulos del Agumon público (Blender) | ~39.500 |
| Tamaño del GLB público | ~769 KB |
| Materiales | 12 |
| Triángulos del Agumon de desarrollo (Linkz) | 5.042 |
| GLB de desarrollo | ~315 KB |
| Huesos del rig Linkz | 34 |
| Altura | 1,75–1,8 unidades |

El Agumon de vinilo (`agumon.glb`) sigue disponible como alternativa: 39.514
triángulos, 769 KB y 12 materiales. La malla densa de ese modelo se guarda en
`tools/model-gen/blender/out/` para renders.

## Sustituir por un modelo profesional

1. Exporta el personaje como **GLB** con escala en metros y los pies en `y = 0`.
2. Usa nombres de nodos equivalentes si quieres conservar la animación
   procedural.
3. Copia el archivo a `apps/client/public/models/agumon.glb`.
4. Recarga el cliente. El visor y el juego lo usarán automáticamente.
5. Ajusta la escala en `DigimonBody.tsx` solo si el modelo no mide ~1,8 unidades.

Para añadir otra especie:

1. Crea `gabumon.glb` y `patamon.glb` en la misma carpeta.
2. Añade su ruta en `MODEL_URLS` de `DetailedDigimon.tsx`.
3. Verifica que el visor muestre la etiqueta `PBR detallado`.

## Herramientas gratuitas recomendadas

No hace falta instalar nada para usar el pipeline actual. Si quieres producir
modelos con calidad de escultura:

- **Blender** (gratuito): modelado, escultura, UVs, rigging y exportación GLB.
- **Meshy AI** (plan gratuito limitado): imagen a 3D; útil para una base rápida.
- **Material Maker** (gratuito): materiales procedurales PBR.
- **Krita** (gratuito): texturas y retoque.
- **Sketchfab** (cuenta gratuita): algunos modelos Agumon tienen licencia
  **CC Attribution**; hay que respetar atribución y no usar modelos con
  licencia no comercial en una versión pública.

Los modelos officiales de Digimon solo deben usarse en este prototipo privado.
Para una versión pública hay que sustituirlos por criaturas originales.

## Siguiente fase

1. Refinar la cabeza del Agumon con una pasada de escultura manual (párpados,
   pliegues de la boca y transición hocico-cráneo).
2. Producir Gabumon, Patamon y sus evoluciones con el mismo pipeline.
3. Añadir un esqueleto real, pesos y animaciones de caminar, atacar e idle;
   hornear mapas de normales desde la malla densa.
4. Generar LOD automático y comprimir con Meshopt/KTX2.
5. Medir FPS en un Android físico y ajustar el presupuesto.
