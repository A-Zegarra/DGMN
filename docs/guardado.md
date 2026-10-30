# Guardado persistente

## Uso

La primera vez que entras, el navegador crea una clave aleatoria de 256 bits.
El servidor guarda el perfil indexado por SHA-256 de esa clave; los dispositivos
vinculados tienen credenciales propias que resuelven al mismo perfil. El nombre no es
una contraseña: otra persona con el mismo nombre no puede cargar tu partida.
La clave no se incluye en el estado público de la sala ni se guarda en texto
claro en el archivo del servidor.

- Se guarda al entrar, ganar XP, evolucionar, terminar un duelo, usar un objeto,
  comprar/canjear en la tienda, entregar una misión, salir y cada 10 s.
- **Guardar y salir** espera una confirmación de escritura identificada por una
  solicitud única antes de cerrar. Si falla, se muestra un aviso y no se cierra.
- Al recargar o volver a entrar aparece **Tu partida guardada / Continuar con…**.
- El resumen local solo sirve para mostrar la pantalla inicial. El servidor
  ignora cambios locales de especie, nivel, XP o victorias.
- Dos pestañas no pueden usar el mismo perfil simultáneamente. Cierra la otra
  partida antes de continuar; los perfiles distintos sí pueden jugar juntos.
- El botón de selección de inicial solo se muestra para un perfil nuevo: no
  sobrescribimos un compañero existente al elegir accidentalmente otro inicial.

**No borres los datos de tu único acceso.** La credencial vive en `localStorage`.
Desde **Mochila / Mapa → Partida** puedes vincular otro navegador mediante un
código temporal y crear una clave de recuperación de un solo uso para guardar
fuera del navegador. No hay recuperación por nombre/correo. Un modo privado
pierde su acceso al cerrar; sin otro dispositivo o clave guardada no hay
recuperación automática. Consulta `docs/vinculacion-partidas.md`.

## Datos

Se conservan nombre, especie/etapa, nivel, XP, umbral de XP, HP, EP, posición del
domador y del compañero, orientación, victorias/derrotas y recargas de habilidades.
También inventario (Bits, discos y sellos), recarga de discos y diario de misiones.
Las compras guardan cobro y entrega juntos en la misma instantánea del perfil.
Las máximas de HP/EP se recalculan usando la especie y el nivel, sin confiar en
valores enviados por el cliente.

Los objetivos, duelos activos, entradas de movimiento y aggro no se restauran.
Un compañero guardado debilitado reaparece recuperado para evitar un bloqueo.
Las recargas y el bloqueo de transformación no desaparecen por recargar la web.

Las sesiones anteriores a esta actualización no tenían una clave/perfil guardado;
no pueden reconstruirse automáticamente después de reiniciar el servidor.

## Disco y operación

- Archivo por defecto: `apps/server/data/profiles.json`, independiente del cwd.
- `DIGIWORLD_DATA_DIR` permite elegir un directorio persistente externo.
- Escrituras serializadas a un temporal único, sincronización del archivo y
  renombrado atómico. Permisos solicitados en Linux: directorio 0700, archivo 0600.
- Un archivo corrupto o de versión no compatible no se sobrescribe: se rechazan
  nuevas aperturas persistentes hasta que se restaure una copia válida.
- Se leen perfiles v1 y v2; las nuevas escrituras usan v2, que conserva perfiles
  y añade hashes/alias de acceso. No usar un servidor antiguo con un guardado v2.
- Los fallos de disco se notifican al propietario; no se anuncia un guardado
  exitoso hasta que termina la escritura. Se reintenta en el próximo autoguardado.
- Guardado diseñado para **un único proceso de servidor**. No ejecutar dos
  servidores contra el mismo archivo. Para múltiples procesos se necesita una BD
  con bloqueo/transacciones compartidos.

En el HP el archivo por defecto está en
`/home/alvaro/digiworld/apps/server/data/profiles.json` y queda fuera de
`/home/alvaro/digiworld-web`: no se sirve por HTTP. Las actualizaciones de código
deben conservar ese directorio. Hacer copias de seguridad del directorio de datos
(preferentemente con el servicio detenido); nunca incluirlo en Git o en el build
del cliente. Un apagado brusco puede perder los cambios desde el último guardado;
el autoguardado periódico limita esa ventana a unos 10 s, además de los eventos
de progreso que guardan inmediatamente.

## Pruebas

```bash
pnpm --filter @digiworld/server exec tsx test/profile-store.ts
pnpm --filter @digiworld/server exec tsx test/profile-room.ts
pnpm --filter @digiworld/server exec tsx test/profile-access.ts
node scripts/test-persistence-ui.cjs
```

Las pruebas del almacén/sala usan directorios temporales exclusivos, verifican
reinicio, MetalGreymon/WarGreymon, XP, posición, vida/energía, recargas, rechazo
de doble sesión, integridad ante corrupción y reintento tras error de disco.
La prueba de navegador requiere Puppeteer en NODE_PATH y comprueba recarga,
continuación, salida confirmada y rechazo de un resumen local falsificado.
