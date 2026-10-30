# Lección 1 — Primeros pasos: tu primer huevo Digi

**Duración:** 90 minutos (puedes partirla en dos sesiones de 45).
**Nivel:** 0, no hace falta experiencia.
**Objetivo:** perder el miedo a la interfaz, aprender a navegar y transformar
objetos, y exportar tu primer `.glb` con la escala correcta del juego.

El ejercicio es un **huevo Digi** estilizado. No es un encargo final: es una
pieza pequeña para practicar esfera, escala, materiales, origen y exportación.
Sirve como base para huevos de evolución o para props del Bosque Digital.

---

## Antes de empezar

1. Abre Blender 5.2.
2. Abre la plantilla:
   `File > Open` → `art-source/templates/plantilla_digimon.blend`.
3. Guarda una copia de trabajo:
   `File > Save As` → crea la carpeta `art-source/digitama/` y guarda como
   `digitama_v01.blend`.

> **Regla de oro:** nunca guardes encima de la plantilla. Cada versión lleva su
> número: `v01`, `v02`, `v03`…

La plantilla ya tiene:

- el suelo en `Z = 0`,
- una regla de 1,80 m,
- la flecha de dirección frontal,
- las luces y la cámara de estudio,
- la colección `ENTREGA` activa.

Lo que añadas con `Shift + A` caerá en `ENTREGA`. Si no, arrastra el objeto a
esa colección en el **Outliner** (la lista de arriba a la derecha).

---

## Parte A — La interfaz en 5 minutos

No hace falta memorizar todo. Solo identifica estas zonas:

| Zona | Dónde está | Para qué sirve |
|---|---|---|
| **3D Viewport** | Centro | Ver y modelar |
| **Toolbar** | Izquierda del viewport | Herramientas; se oculta con `T` |
| **Sidebar** | Derecha del viewport | Medidas y datos; se oculta con `N` |
| **Outliner** | Arriba a la derecha | Objetos y colecciones |
| **Properties** | Abajo a la derecha | Materiales, modificadores, render |
| **Timeline** | Abajo | Animación (aún no la usamos) |
| **Workspaces** | Arriba | Layout, Modeling, Shading… |
| **Status Bar** | Abajo del todo | Atajos y mensajes |

Consejo que te va a salvar muchas veces: **`F3` abre la búsqueda de comandos**.
Si no recuerdas dónde está algo, pulsa `F3` y escribe lo que quieres hacer.

---

## Parte B — Navegar sin perderte (15 min)

Haz estos ejercicios en orden. No toques todavía el modelado.

1. **Orbitar:** mantén pulsado el botón central del ratón (MMB) y arrastra.
   La vista gira alrededor del objeto.
2. **Desplazar:** `Shift + MMB` y arrastra.
3. **Zoom:** rueda del ratón.
4. **Ver todo:** pulsa `Home`.
5. **Enfocar un objeto:** selecciónalo con clic izquierdo y pulsa `Numpad .`
   (el punto del teclado numérico).
6. **Vistas fijas:** `Numpad 1` (frente), `Numpad 3` (derecha), `Numpad 7`
   (arriba). `Ctrl + 1/3/7` da las vistas opuestas.
7. **Perspectiva / ortográfica:** `Numpad 5`. Para medir proporciones, la
   ortográfica es más fiable.
8. **Cámara:** `Numpad 0`. Vuelve a `Numpad 0` para salir.
9. **Ocultar la referencia:** en el Outliner, pulsa el ojo de la colección
   `REFERENCIA`. Vuelve a mostrarla. Así compruebas que el suelo, la regla y la
   flecha no forman parte del personaje.

> **Sin teclado numérico:** `Edit > Preferences > Input` → activa
> **Emulate Numpad**. También puedes usar el menú `View` del viewport.
>
> **Sin botón central (trackpad):** en esas mismas preferencias activa
> **Emulate 3 Button Mouse** y usa `Alt + clic` para orbitar.

### Comprobación

Deberías poder girar alrededor de la escena, acercarte a la regla y volver a ver
todo con `Home` sin usar los menús.

---

## Parte C — Mover, rotar y escalar (15 min)

Vamos a ensuciar la escena un momento y luego borramos.

1. Coloca el cursor 3D en el origen: `Shift + S` → `Cursor to World Origin`.
2. Añade un cubo: `Shift + A` → `Mesh` → `Cube`.
3. Muévelo: pulsa `G`, luego `X`, escribe `2` y pulsa `Enter`. Se movió 2 m en
   X.
4. Rótalo: `R`, `Z`, `45`, `Enter`.
5. Escálalo: `S`, `2`, `Enter` (el doble en todos los ejes). Prueba `S`, `Z`,
   `0.5`, `Enter`.
6. Deshaz varias veces con `Ctrl + Z`.
7. Duplícalo: `Shift + D`, `X`, `1`, `Enter`.
8. Bórralo: selecciónalo y pulsa `X` → `Delete`.

Reglas de los atajos:

- Después de `G`, `R` o `S`, **el movimiento sigue al ratón**. Si escribes un
  número, se aplica exactamente ese valor.
- `X`, `Y` o `Z` restringen al eje. Pulsar dos veces la misma tecla usa el eje
  local del objeto.
- `Enter` confirma; `Esc` o clic derecho cancela.
- `Ctrl + Z` deshace. `Ctrl + Shift + Z` rehace.

### Aplicar transformaciones

Cuando escales o rotes un objeto, Blender guarda esa transformación en el
objeto. Para el juego conviene “hornearla” en la malla:

`Ctrl + A` → `All Transforms`.

Especialmente importante antes de exportar un personaje. Si el GLB lleva
escalas raras, en el juego puede aparecer deformado o con el origen desplazado.

---

## Parte D — El huevo Digi (30 min)

### 1. La cáscara

1. `Shift + S` → `Cursor to World Origin`.
2. `Shift + A` → `Mesh` → `UV Sphere`.
3. Antes de tocar otra cosa, pulsa `F9` (panel de la última operación) y pon:
   - **Segments:** 32
   - **Rings:** 16
   - **Radius:** `0.35`
4. Cierra el panel.
5. Con la esfera seleccionada, escala en Z: `S`, `Z`, `1.3`, `Enter`.
   Ahora mide 0,91 m de alto.
6. Súbela para que la base quede en el suelo: `G`, `Z`, `0.455`, `Enter`.
7. Renómbrala: `F2` y escribe `Digitama_Cascara`.
8. Clic derecho → `Shade Smooth`.

> **Por qué 0,35 y 1,3:** una esfera de radio 0,35 m mide 0,70 m de ancho. Al
> escalar Z por 1,3 mide 0,91 m de alto. Al subirla 0,455 m, la mitad de su
> altura, la base toca exactamente `Z = 0`.

### 2. La banda

1. `Shift + S` → `Cursor to World Origin`.
2. `Shift + A` → `Mesh` → `Torus`.
3. `F9` y ajusta:
   - **Major Radius:** `0.356`
   - **Minor Radius:** `0.026`
   - **Major Segments:** 48
   - **Minor Segments:** 12
4. Ciérralo y súbelo: `G`, `Z`, `0.455`, `Enter`.
5. Renómbralo `Digitama_Banda`.
6. Clic derecho → `Shade Smooth`.

El toro se crea horizontal, así que rodea la cintura del huevo. Si la banda
queda flotando o demasiado hundida, selecciónala y usa `S` para ajustar el
tamaño; si acabas de crearla, `F9` te deja cambiar `Major Radius` y
`Minor Radius`.

### 3. Materiales

Vamos a darle color. Selecciona la cáscara y abre **Properties** → pestaña
**Material** (el icono del balón rojo).

1. Pulsa **New**. Renombra el material como `Cascara`.
2. En **Base Color**, elige un crema cálido. Hex aproximado: `#E9D6AC`.
3. **Roughness:** `0.45`. **Metallic:** `0.0`.
4. Selecciona la banda → **New** → material `Banda`.
5. Color verde azulado oscuro: `#0E5B54`. **Roughness:** `0.35`,
   **Metallic:** `0.1`.

Cambia a **Material Preview** (el tercer icono de esferas en la esquina
superior derecha del viewport, o `Z` → `Material Preview`) para ver los
materiales con luz.

> **Truco:** si no ves el color, asegúrate de que estás en la pestaña
> **Material** del objeto correcto. Cada objeto tiene su propia lista.

### 4. Aplicar transformaciones

1. Selecciona `Digitama_Cascara`.
2. Con `Shift` pulsado, selecciona `Digitama_Banda`.
3. `Ctrl + A` → `All Transforms`.

El origen naranja de ambos debe quedar en el centro del suelo, entre los pies
imaginarios del huevo. Eso es lo que espera el juego.

### 5. Reto opcional: manchas

Si terminas antes de los 90 minutos:

1. Añade una `UV Sphere` pequeña, radio `0.04`.
2. `S`, `Y`, `0.45`, `Enter` para aplanarla.
3. Colócala sobre la cáscara, enterrando un poco la mitad.
4. Duplícala con `Shift + D` dos o tres veces.
5. Material `Manchas`, color naranja `#E07A1F`.
6. Aplica las transformaciones también a las manchas.

No pasa nada si una mancha queda un poco fuera: es un ejercicio de colocación,
no una pieza final. En la siguiente lección veremos cómo proyectarlas bien
sobre la superficie.

---

## Parte E — Una captura digna (10 min)

La plantilla ya tiene cámara y luces. Para un primer plano:

1. Selecciona `Camara_Estudio` en el Outliner.
2. Pulsa `Numpad 0` para ver por la cámara.
3. Mueve la cámara con `G` y acerca con la rueda hasta que el huevo ocupe una
   parte bonita del encuadre.
4. Si prefieres encuadrar desde el viewport: coloca la vista a tu gusto y pulsa
   `Ctrl + Alt + Numpad 0` (alinea la cámara activa a la vista).
5. Pulsa `F12` para renderizar.
6. En la ventana del render: `Image > Save As` → guarda como
   `art-source/digitama/capturas/digitama_34.png`.

Con una captura 3/4 es suficiente para esta lección. En las siguientes
añadiremos frente, perfil y espalda.

---

## Parte F — Exportar el GLB (10 min)

1. Guarda el `.blend` con `Ctrl + S`.
2. Selecciona **solo** los objetos del huevo:
   - clic en `Digitama_Cascara`,
   - `Shift + clic` en `Digitama_Banda` (y en las manchas, si las hiciste).
3. `File > Export > glTF 2.0 (.glb/.gltf)`.
4. En el panel de exportación:
   - **Format:** `glTF Binary (.glb)`
   - **Include:** marca `Selected Objects`
   - **Transform:** marca `+Y Up`
   - **Data > Mesh:** marca `Apply Modifiers`
   - **Animation:** desmarcado (todavía no hay animaciones)
5. Guarda como:
   `art-source/digitama/digitama_v01.glb`.
6. Comprueba que el archivo existe y pesa más de 0 KB.

### Verificación rápida

1. Guarda todo.
2. `File > New > General`.
3. Borra el cubo por defecto (`X`).
4. `File > Import > glTF 2.0` y elige tu `.glb`.
5. Selecciona el objeto importado y pulsa `N` → pestaña **Item**. En
   **Dimensions** debe medir aproximadamente `0,70 × 0,70 × 0,91 m`.
6. Si está bien, vuelve a abrir `digitama_v01.blend` y termina.

> Si el huevo sale gigante, minúsculo o girado, revisa: unidades en metros,
> `Ctrl + A > All Transforms` y `+Y Up` en la exportación.

---

## Checklist de la lección

- [ ] Guardé `art-source/digitama/digitama_v01.blend`.
- [ ] El huevo mide ~0,91 m de alto y la base toca el suelo.
- [ ] Los objetos están en la colección `ENTREGA`.
- [ ] La cáscara y la banda tienen materiales con nombre.
- [ ] Apliqué `Ctrl + A > All Transforms`.
- [ ] Exporté `digitama_v01.glb` con `Selected Objects` y `+Y Up`.
- [ ] Reimporté el GLB y comprobé las dimensiones.
- [ ] Guardé una captura 3/4.
- [ ] Rellené `notas.md`.

### Plantilla de `notas.md`

Crea `art-source/digitama/notas.md` con:

```markdown
# Digitama v01

## Cambios
-

## Pendiente
-

## Dudas para integrar
-
```

---

## Si algo sale mal

| Problema | Solución |
|---|---|
| No veo el objeto | `Home`, luego `Numpad .`; revisa el ojo del Outliner |
| El objeto desapareció | `Ctrl + Z`; comprueba que no esté en otra colección |
| No puedo orbitar | Usa MMB; si no tienes, activa Emulate 3 Button Mouse |
| `G`, `R` o `S` no hacen nada | El ratón debe estar sobre el viewport, no sobre un panel |
| El huevo está enterrado | Selecciónalo y `G`, `Z`, `0.455`, `Enter` |
| Se ve facetado | Clic derecho → `Shade Smooth` |
| El material no cambia | Estás editando el material de otro objeto; revisa la selección |
| El GLB sale enorme | No aplicaste escala o la escena no está en metros |
| El GLB sale girado | Marca `+Y Up` al exportar; el personaje debe mirar a `-Y` |
| El render está oscuro | `Numpad 0`, revisa que las luces de `ESTUDIO` estén visibles |

---

## Qué me tienes que enviar

Cuando termines, dime la ruta de:

```text
art-source/digitama/digitama_v01.blend
art-source/digitama/digitama_v01.glb
art-source/digitama/capturas/digitama_34.png
art-source/digitama/notas.md
```

No hace falta que esté perfecto. Con esto reviso escala, orientación, materiales
y exportación, y te digo qué ajustar antes de pasar al Nivel 1.

---

## Para la próxima

En la Lección 2 modelaremos una **roca low-poly** del Bosque Digital. Ahí
aprenderás el modo edición de verdad: vértices, caras, extrusión, loop cuts y
bisel. El huevo solo era el calentamiento.
