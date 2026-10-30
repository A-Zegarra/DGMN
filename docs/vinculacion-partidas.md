# Una partida en PC y Android

No se copia ni se fusiona progreso. Los dispositivos acceden al **mismo perfil**
del servidor con credenciales diferentes. Solo una sesión puede jugar a la vez.
No hay registro con correo/contraseña ni recuperación por nombre de domador.

## Vincular otro dispositivo

1. En el dispositivo que ya tiene tu partida, entra en
   **Mochila / Mapa → Partida → Generar código de vinculación**.
2. En el otro, abre el inicio de `https://digiworld.aliproinv.com` y pulsa
   **Vincular o recuperar partida**. Debe ser un navegador **sin otra partida**.
3. Selecciona código de vinculación, pega el código y confirma.
4. En el origen usa **Guardar y salir**; después pulsa **Continuar** en el destino.

El código caduca en **5 minutos** y sirve para un solo dispositivo. Generar otro
invalida el anterior; también se puede cancelar. No publiques códigos ni los
pegues en el chat. La clave privada del navegador original nunca se muestra ni
se entrega al otro dispositivo. Hay un máximo de 16 accesos adicionales activos.

El navegador de destino conserva su acceso anterior hasta que el servidor
confirma el vínculo. Si se pierde la respuesta o la red, reintentar desde el
mismo navegador retoma la credencial pendiente: no requiere otro código ni crea
otra copia de la partida. El candidato pendiente se guarda **antes** de enviarlo.

Si el navegador de destino ya tiene una partida, se bloquea la operación incluso
si alguien altera el resumen local. Usa otro perfil de navegador para conservar
ambas partidas. No se añade un botón de reemplazar/borrar progreso.

## Recuperación

En **Mochila / Mapa → Partida**, confirma y crea una **clave de recuperación**.
Se muestra solo en ese momento: guárdala en un gestor de contraseñas u otro lugar
privado fuera del navegador. Cerrar la pestaña oculta la clave; no permite volver
a consultarla. Generar otra invalida la anterior.

Si pierdes los accesos, en un navegador nuevo usa **Vincular o recuperar partida
→ Clave de recuperación guardada**. La clave es de **un solo uso**. Después de
recuperar, genera y guarda una nueva. Si otra sesión sigue abierta, hay que salir
de ella para jugar; recuperar no expulsa a una sesión que está en uso.

**Si pierdes todos los accesos y no guardaste una clave de recuperación, no hay
recuperación automática.** No borres los datos del único navegador que conserva
tu acceso. Los nombres de jugadores no sirven como contraseña.

## Desvincular dispositivos

Desde tu partida, confirma **Desvincular los demás** para conservar solo el
navegador actual. Invalida también códigos de enlace y recuperación anteriores;
crea después otra clave de recuperación. No borra personajes, objetos o misiones.

Esto funciona también desde un dispositivo vinculado: la credencial original
puede quedar revocada. En un navegador revocado se muestra el rechazo al entrar,
sin crear una partida nueva con sus datos antiguos. Para vincularlo de nuevo usa
otro perfil limpio o limpia su acceso local **solo después de comprobar que
conservas otro acceso y una recuperación válida**.

## Seguridad y persistencia

- Vinculación: 16 caracteres base32 aleatorios (80 bits), temporales y solo en
  memoria. Recuperación: 32 caracteres (160 bits); solo SHA-256 en disco.
- Cada navegador usa una credencial propia aleatoria de 256 bits. El servidor
  conserva únicamente hashes, alias al perfil canónico y accesos revocados.
- Una cola serializa guardados y cambios de acceso. Se confirma el vínculo
  después de la escritura atómica y sincronizada; un autoguardado concurrente no
  puede borrar alias. Mientras se confirma un alias se reservan las credenciales
  de destino para impedir crear un perfil primario que colisione con él.
- Las revisiones de acceso invalidan enlaces concurrentes con una revocación.
- Códigos generados solo desde una sesión autenticada, tras confirmar guardado;
  límite de 5 s por acción. Ningún secreto va al estado público ni al chat.
- Recepción por JSON en `POST /room/profile-access/redeem`; nunca en URL ni GET.
  El prefijo `/room` ya está encaminado al juego por el túnel existente.
- Respuestas sin caché, CORS acotado, cuerpos limitados, errores sin incluir el
  contenido recibido y 10 intentos por IP/minuto, con límite global de 120.
  Solo se confía en `CF-Connecting-IP` si el par real es el túnel local.
- `DIGIWORLD_ALLOWED_ORIGINS` permite añadir orígenes explícitos separados por
  comas. En desarrollo se admiten puertos HTTP de localhost. Los orígenes del
  sitio público y de las URLs Tailscale documentadas están incluidos.

### Formato del guardado

`profiles.json` pasa de versión **1 a 2**, manteniendo las claves y los perfiles
originales. La versión 2 añade `access`: alias, hashes de recuperación,
credenciales revocadas y revisiones. No contiene tokens ni códigos en claro.
El archivo conserva permisos 600 y no se sirve por HTTP.

**No ejecutar el servidor anterior sobre datos v2.** Su comprobación de versión
rechaza el archivo en lugar de eliminar información de acceso. Después de crear
vínculos, una reversión debe mantener un servidor compatible con v2; no restaurar
un archivo de perfiles anterior porque perdería progreso y accesos recientes.
Un rollback solo del cliente es compatible con el servidor nuevo.

## Pruebas

```text
pnpm --filter @digiworld/server exec tsx test/profile-access.ts
node scripts/test-profile-access-ui.cjs
```

El test de servidor verifica migración, expiración, cancelación, sustitución de
códigos, reintentos, no reemplazo, recuperación única, revocación, bloqueo de
sesiones, carreras de escritura/join, fallo de disco, corrupción, HTTP, CORS y
límites. Los tests anteriores de perfiles/combate/PvE también deben pasar.

El test de navegador usa contextos independientes, simula una respuesta perdida,
comprueba PC→móvil, inventario/misiones/nivel/XP, recuperación y revocación. Una
sesión SDK mantiene ocupado el perfil sin necesitar dos renderizadores WebGL
de software a la vez. Capturas sin códigos privados:
`%TEMP%/opencode/profile-access-qa/`. Requiere Chrome y `puppeteer-core` en NODE_PATH.

Para probar progreso avanzado sin tocar partidas reales, ejecutar
`apps/server/test/seed-access-ui.ts`, arrancar un servidor local con
`DIGIWORLD_DATA_DIR` apuntando a la base temporal **nueva** indicada y pasar
`ACCESS_UI_TOKEN` al test. Esa clave pública de prueba solo se permite en
localhost. Las pruebas públicas se ejecutan **sin** esa variable y crean su
propia partida de QA. La sensación táctil/rendimiento en Android físico sigue
pendiente de comprobar en el dispositivo.
