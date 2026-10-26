# Modelos 3D detallados

## Estado actual

- **Agumon** tiene un modelo GLB con materiales PBR, ojos, dientes, garras y
  piezas articuladas. Se ve en el visor de la pantalla de inicio y en el mundo.
- **Gabumon y Patamon** mantienen los modelos procedurales low-poly como
  respaldo. El visor lo indica con la etiqueta `Low-poly`.
- Si el GLB no existe o falla, el juego vuelve automáticamente al modelo
  procedural. Nada se rompe.

## Cómo está montado

```text
tools/model-gen/agumon.py     genera la malla y el GLB
apps/client/public/models/    assets públicos servidos por Vite/Cloudflare
DetailedDigimon.tsx           carga GLB, sustituye materiales y anima nodos
CharacterStage.tsx            visor con luces de estudio, sombras y órbita
DigimonBody.tsx               elige GLB detallado o modelo procedural
```

El modelo se construye con campos de distancia y `marching cubes`, se suaviza,
se reduce a un presupuesto de triángulos y se exporta con `trimesh`. Las piezas
se guardan en una jerarquía de nodos:

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

## Presupuesto técnico

| Elemento | Valor actual |
|---|---:|
| Triángulos del Agumon | ~75.000 |
| Tamaño del GLB | ~1,9 MB |
| Materiales | 10 |
| Nodos animables | 7 principales |
| Texturas | 0 (colores y materiales) |

Para Android conviene bajar a 25.000–40.000 triángulos y añadir LOD. Para PC se
puede mantener el modelo actual. Una versión final con texturas PBR de 2K y
mapas normales debería quedar entre 3 y 8 MB por personaje.

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

1. Sustituir el Agumon de prueba por un GLB esculpido de calidad final.
2. Producir Gabumon, Patamon y sus evoluciones con el mismo pipeline.
3. Añadir texturas PBR, mapas normales y animaciones esqueléticas.
4. Generar LOD automático y comprimir con Meshopt/KTX2.
5. Medir FPS en un Android físico y ajustar el presupuesto.
