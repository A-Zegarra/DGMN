# Carpeta de entrada de modelos

Deja aquí los archivos que quieras que adapte. Puedes crear una subcarpeta por
personaje o por autor:

```text
MODELOS DE SPRITES/ENTRADA/
  agumon-sketchfab/
    modelo.glb
    referencia-frente.png
    referencia-perfil.png
    LICENCIA.txt
```

## Formatos preferidos

| Formato | Cuándo usarlo | Notas |
|---|---|---|
| `.blend` | Si el modelo está en Blender | Mejor opción para editar. Empaqueta las texturas. |
| `.glb` | Si viene de un visor web, Meshy, Tripo, etc. | Lleva geometría, materiales y texturas en un solo archivo. |
| `.fbx` | Si viene de Maya, 3ds Max, Mixamo, ZBrush... | Incluye las texturas aparte en la misma carpeta o un `.zip`. |
| `.obj` + `.mtl` | Modelos simples o escaneados | Incluye las texturas aparte. |
| `.zip` | Cualquier combinación de los anteriores | La opción más segura si hay varias texturas. |
| `.png` / `.jpg` / `.webp` | Hojas de diseño, turnarounds o referencias 2D | Una vista por imagen o una hoja con frente/perfil/espalda. |

No puedo abrir directamente `.max`, `.ma`, `.mb`, `.c4d`, `.ztl` ni `.psd`.
Exporta desde el programa original a `.blend`, `.glb` o `.fbx`; para las
referencias 2D, exporta a PNG o JPG.

## Si es un .blend

En Blender: `Archivo > Recursos externos > Empaquetar recursos`.
Así las texturas viajan dentro del archivo.

## Si es FBX/OBJ

Crea una carpeta con el modelo y sus texturas, y comprímela en `.zip`. Evita
rutas absolutas o letras de unidad dentro del `.mtl`.

## Qué conviene incluir

1. El modelo (una sola versión, la más reciente).
2. Referencias visuales: frente, perfil, espalda y primer plano de la cara.
3. Si tiene rig: dime si es Mixamo, Rigify u otro, y si quieres conservarlo.
4. Altura o escala deseada (por defecto lo dejo en ~1,75 unidades).
5. Licencia o autor, sobre todo si viene de Sketchfab u otro usuario.

## Qué haré con él

- Importarlo y revisar escala, orientación, jerarquía y materiales.
- Renombrar los nodos a `body`, `head`, `jaw`, `armL`, `armR`, `legL`, `legR`,
  `tail` para que funcione la animación del juego.
- Reducirlo al presupuesto de ~40.000 triángulos y generar la malla densa para
  renders.
- Aplicar el acabado de vinilo PBR si hace falta.
- Exportar el GLB, renderizar vistas de comparación e integrarlo en el visor.
