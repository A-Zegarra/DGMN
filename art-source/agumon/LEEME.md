# Trabajo de Agumon en Blender

## Archivo base

Abre:

```text
tools/model-gen/blender/out/agumon_vinyl.blend
```

y guárdalo como copia de trabajo:

```text
art-source/agumon/agumon_edit_v01.blend
```

No guardes encima del original. La escena tiene dos colecciones:

- `DENSE`: malla de escultura, ~322.000 triángulos.
- `GAME`: malla optimizada para el juego, ~39.500 triángulos.

Para esculpir detalles finos usa `DENSE`. Para comprobar el resultado final,
oculta `DENSE` y muestra `GAME`.

## Primer objetivo: la cabeza

El propio generador marca la cabeza como la parte que más necesita una pasada
manual. Prioriza:

- párpados y expresión de los ojos,
- transición del hocico al cráneo,
- fosas nasales,
- comisuras de la boca,
- pliegues del labio y la mandíbula,
- forma de las mejillas.

No hace falta rehacer todo el cuerpo en la primera pasada.

## Exportar

1. Selecciona solo la colección `GAME` (sin luces, cámara ni suelo).
2. `File > Export > glTF 2.0 (.glb/.gltf)`.
3. Formato **glTF Binary (.glb)**.
4. `+Y Up`, `Apply Modifiers`, `Include > Selected Objects`.
5. Guarda como:

```text
art-source/agumon/agumon_edit_v01.glb
```

6. Renderiza o captura **frente, perfil, 3/4 y espalda** y guárdalas en
   `art-source/agumon/capturas/`.

## Entregar

Deja en `art-source/agumon/`:

```text
agumon_edit_v01.blend
agumon_edit_v01.glb
capturas/
notas.md
```

En `notas.md` escribe qué cambiaste, qué falta y qué quieres que revise.

Cuando esté, avísame con la ruta. Yo lo integro en el visor y en el juego, reviso
escala/materiales/animación y te devuelvo capturas para la siguiente iteración.
