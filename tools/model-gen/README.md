# Generador de modelos 3D

Este directorio contiene el generador del modelo detallado de Agumon. No hace
falta Blender ni ningún programa de pago: usa **Python + numpy + trimesh** para
construir superficies orgánicas suaves y exportarlas a GLB.

## Requisitos

- Python 3.11 o superior.
- Las dependencias de `requirements.txt`.

## Uso

Desde la raíz del proyecto:

```powershell
python -m venv .venv-modelos
.\.venv-modelos\Scripts\Activate.ps1
pip install -r tools/model-gen/requirements.txt
python tools/model-gen/agumon.py
```

El resultado se escribe en:

```text
apps/client/public/models/agumon.glb
```

El visor de la pantalla de inicio y el compañero del juego lo cargan
automáticamente. En desarrollo se añade una marca de versión para evitar la
caché; en producción el archivo se sirve desde `/models/agumon.glb`.

## Qué genera

- Cuerpo, cabeza, mandíbula, brazos, piernas y cola articulados por nodos.
- Ojos con esclerótica, iris, pupila y brillo.
- Dientes, garras, boca, lengua y fosas nasales.
- Materiales PBR con color de vértice para la barriga.
- Mallas cerradas y verificadas antes de exportar.

El GLB final tiene unos 75.000 triángulos y pesa alrededor de 1,9 MB. Es un
modelo de **primera pasada estilizada**, pensado para validar el pipeline. Para
la fidelidad de un render de escultura profesional conviene sustituirlo por un
GLB creado en Blender/ZBrush/Meshy por un artista.

## Sustituir el modelo

1. Guarda el GLB final como `apps/client/public/models/agumon.glb`.
2. Mantén los nombres de nodos si quieres conservar las animaciones:
   `body`, `head`, `jaw`, `armL`, `armR`, `legL`, `legR`, `tail`.
3. Si el modelo tiene animaciones propias, se pueden reproducir con
   `AnimationMixer`; el cargador actual usa animación procedural sobre esos
   nodos.
4. Ajusta la escala en `apps/client/src/game/DigimonBody.tsx` si el modelo no
   está modelado a ~1,8 unidades de altura.

Para añadir otra especie, crea su GLB y añade una entrada en
`apps/client/src/game/models/DetailedDigimon.tsx`.
