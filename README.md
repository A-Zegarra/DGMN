# DIGIWORLD ONLINE

Prototipo interno de un MMORPG 2.5D con sprites DS inspirado en Digimon, pensado para
navegador y Android. La primera versión es una prueba técnica de mundo
compartido: varios jugadores caminan por el Bosque Digital en tiempo real, eligen
un compañero, conversan, se retan a duelos con habilidades y energía, y pueden ver
los sprites de sus compañeros en un visor con cámara elevada.

**Presentación activa: solo personajes en sprites DS.** Se retiró el selector
3D y la tecla `V` ya no alterna estilos. Los modelos y herramientas artísticas
anteriores se conservan como archivos históricos, pero no se cargan ni se
incluyen en el build público. El escenario y la cámara elevada mantienen la
base 2.5D existente.

> **Uso interno.** Los nombres y criaturas de Digimon pertenecen a sus
> titulares. Este repositorio debe permanecer privado mientras use contenido
> oficial. Para una versión pública se sustituye el *content pack* oficial por
> criaturas originales.

## Estado actual — v0.1.0

- [x] Monorepo con cliente, servidor y contenido compartido.
- [x] Servidor autoritativo con tick de 20 Hz y parches de 15 Hz.
- [x] Movimiento con predicción local y reconciliación básica.
- [x] Tamer y Digimon separados: el compañero deambula cerca del tamer.
- [x] Cámara elevada DS en tercera persona con órbita libre, zoom y colisiones.
- [x] Joystick virtual con liberación de captura y cámara multitáctil independiente.
- [x] Zona táctil dedicada para mirar, independiente del joystick.
- [x] Botón de pantalla completa horizontal / volver a vertical.
- [x] Controles táctiles: joystick izquierdo y mirada en el resto de la pantalla.
- [x] Personajes exclusivamente en sprites 2D; sin selector 3D ni atajo `V`.
- [x] Atlas DS originales del domador, las líneas de Agumon/Gabumon/Patamon y Devimon, incluidos en el build.
- [x] Visor de sprites con rotación y filtrado pixel-art.
- [x] Tercera persona con sombras suaves, cielo degradado, texturas, vegetación y colinas.
- [x] Terreno visual de 400 × 400 m con árboles, rocas y senderos instanciados.
- [x] Selección de compañero: Agumon, Gabumon o Patamon.
- [x] Chat de zona y lista de jugadores conectados.
- [x] Combate PvP en tiempo real con duelos por invitación.
- [x] HP, EP, regeneración, enfriamientos y 3 habilidades por especie.
- [x] Autoataques cada 2 s cuando ambos Digimon están a menos de 6 m.
- [x] Digimon salvajes con patrulla, aggro, persecución, ataque y respawn.
- [x] Experiencia, subida de nivel y mejora de vida/energía.
- [x] Línea Koromon → Agumon → Greymon → MetalGreymon → WarGreymon, con requisitos y habilidades por etapa.
- [x] Objetivos con `Tab` o clic, panel de rival/salvaje y barras de vida/energía.
- [x] Avisos de daño/curación, resultado del duelo y rendición.
- [x] Desconexión limpia, aparición separada y actualización de jugadores.
- [x] Cliente estático servido desde el HP y probado por Tailscale.
- [x] Túnel público dedicado en Cloudflare, con `noindex`, separado de las apps existentes.
- [x] Zonas PvE, botín, inventario, discos y jefe Devimon.
- [x] Tres misiones encadenadas con progreso y recompensas persistentes del servidor.
- [x] Tienda del refugio: discos con Bits y suministros mediante sellos de Devimon.
- [x] Domador, Gabumon, Patamon, Garurumon y Angemon con sprites DS originales.
- [x] Guardado persistente en servidor, continuación desde el mismo navegador y protección contra sesiones duplicadas.
- [x] Vinculación PC/Android por código temporal, recuperación de un solo uso y revocación de otros dispositivos.
- [ ] Prueba en un Android físico.

## Requisitos

- Node.js 22 o superior (probado con 24).
- pnpm 11.
- Windows, macOS o Linux para el cliente.
- El servidor puede correr en la misma máquina o en el HP con Ubuntu.

Si PowerShell bloquea `pnpm.ps1` con un error de *execution policy*, usa
`pnpm.cmd` o ejecuta una vez:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## Instalación

```bash
pnpm install
```

## Desarrollo

Dos terminales:

```bash
pnpm dev:server
pnpm dev:client
```

O ambos a la vez:

```bash
pnpm dev
```

Direcciones:

- Cliente: <http://localhost:5173>
- Servidor: <http://localhost:2567>
- Salud del servidor: <http://localhost:2567/health>

Servidor de pruebas en el HP (Tailscale): <http://100.116.141.27:2567/health>.
El archivo `apps/client/.env.local` apunta a ese servidor. Para desarrollo sin el
HP, usa `VITE_SERVER_URL=http://localhost:2567` en el entorno de Vite, sin borrar
la configuración existente.

Cliente estático en el HP: <http://100.116.141.27:8080>. Es la versión compilada
y no necesita Vite ni la laptop encendida; solo Tailscale.

Enlace público de prueba: <https://digiworld.aliproinv.com>. El cliente y el
servidor comparten el mismo hostname: el túnel enruta `/matchmake`,
`/room`, `/health` y los WebSockets al puerto 2567; el resto se sirve como
cliente estático. No está indexado ni se promociona, pero cualquiera con el
enlace puede entrar.

Abre dos pestañas del navegador para ver a dos jugadores en el mismo mundo.
También puedes abrir el cliente desde el teléfono en la misma red o por
Tailscale.

### Probar desde el teléfono

1. Con Internet: abre `https://digiworld.aliproinv.com`.
2. Solo red local/Tailscale: abre `http://100.116.141.27:8080`.

Para desarrollo con recarga en caliente, arranca `pnpm dev:client` en la laptop y
abre `http://100.84.154.39:5173`. El cliente usa el servidor del HP
(`ws://100.116.141.27:2567`) mediante `apps/client/.env.local`. Si el servidor
está en la laptop, cambia esa URL a la IP de la laptop.

Vite escucha en `0.0.0.0`. Si usas el HP como servidor, su IP de Tailscale es
`100.116.141.27`.

## Controles

| Acción | Teclado / ratón | Táctil |
|---|---|---|
| Avanzar / retroceder | `W` / `S`, flechas o ambos botones del ratón | Joystick izquierdo |
| Girar / desplazamiento lateral | `A` / `D` giran (`Der. + A/D` lateral) · `Q` / `E` lateral | Joystick izquierdo |
| Orbitar / orientar cámara | Izquierdo: orbitar libre · Derecho: orientar personaje · Rueda: zoom (3–24 m) | Arrastra fuera del joystick |
| Ajustes de cámara | Botón **Ajustes cámara** (sensibilidad, FOV, modos clásico/seguimiento/combate) | Botón **Ajustes cámara** |
| Digievolucionar | Botón **Evolución** | Botón **Evolución** |
| Inventario, mapa, misiones y tienda | **Mochila / Mapa** → pestaña correspondiente | Igual |
| Retirar compañero | `R` o botón en mochila | Botón en mochila |
| Pantalla completa | Botón **Pantalla** | Botón **Horizontal / Vertical** |
| Correr | `Shift` | — |
| Fijar objetivo | `Tab` (jugadores y salvajes) o clic sobre un Digimon | Botón **Objetivo** |
| Habilidades | `1`, `2`, `3` | Botones de habilidad |
| Retar a duelo | Panel de objetivo → **Retar a duelo** | Igual |
| Chat | `Enter` | Botón Chat |

En tercera persona ves al tamer desde detrás y puedes orbitar la cámara. El
Digimon deambula alrededor del tamer y ataca de forma independiente; no se
queda pegado a la cámara. No hay primera persona ni modo de personajes 3D.
Consulta [`docs/controles-interfaz.md`](docs/controles-interfaz.md).

El botón de pantalla completa intenta bloquear la orientación horizontal en
Android. En navegadores que no permiten el bloqueo (por ejemplo, Safari en
iPhone), la pantalla completa puede funcionar pero la rotación queda manual.

En la pantalla de inicio, arrastra el sprite del visor para girarlo. La rotación
automática también está activada.

## Combate y duelos

### Guardado de la partida

El servidor guarda tu compañero, evolución, nivel, XP, HP/EP, posición y
victorias/derrotas. Hay autoguardado cada 10 s y al ganar XP/evolucionar; usa
**Guardar y salir** para esperar la confirmación del disco. Al volver aparece
**Continuar con…**. No borres los datos del sitio: contienen la clave privada de
acceso. No se identifica a los jugadores solo por su nombre. Para usar la misma
partida en PC/Android: **Mochila / Mapa → Partida** genera un código temporal;
en el otro navegador sin partida usa **Vincular o recuperar partida** desde el
inicio. Solo una sesión puede jugar a la vez. Allí también puedes crear una
clave de recuperación de un solo uso y desvincular otros dispositivos.
Consulta `docs/guardado.md` y `docs/vinculacion-partidas.md`.

El combate PvP es por **duelos** y lo valida el servidor. También hay **PvE** con
Digimon salvajes por el Bosque Digital.

1. Fija a otro domador con `Tab`, haciendo clic sobre su Digimon o con el botón
   **Objetivo** en móvil.
2. Pulsa **Retar a duelo**. Ambos deben estar a menos de **15 m**.
3. El rival recibe la invitación y puede aceptar o rechazar. La solicitud caduca
   a los 15 s.
4. Al aceptar, ambos recuperan HP y EP y empieza el duelo.

Reglas actuales:

- Cada especie tiene **3 habilidades** propias, con coste de **EP**,
  enfriamiento y alcance. Se usan con `1`–`3` o con la barra inferior.
- Los **ataques básicos** son automáticos cada **2 s** si ambos están a menos de
  **6 m**. El jugador solo decide movimiento, objetivo y habilidades.
- El daño combina el poder de la habilidad con `ATK` del atacante y `DEF` del
  defensor. Patamon y Angemon tienen una habilidad de curación.
- El EP se regenera lentamente durante el duelo; fuera de combate también se
  recupera HP.
- Al llegar a **0 HP** termina el duelo. El ganador recupera toda su vida y
  energía; el perdedor reaparece a los **3,5 s**. Se suman victorias y derrotas.
- El botón **Rendirse** del panel de duelo entrega la victoria al rival.
- El feed de la derecha (solo escritorio) muestra golpes automáticos,
  habilidades recibidas y curaciones; el chat de zona conserva el historial.

El servidor comprueba distancia, objetivo, EP, enfriamientos, estado de combate y
HP. El cliente solo muestra el resultado y bloquea botones para evitar pulsaciones
inválidas.

### Digimon salvajes y experiencia

- Hay **20 salvajes** de nivel 1 a 17 y **Devimon**, jefe de nivel 14.
- Patrullan alrededor de su zona, detectan jugadores a menos de **9 m** y los
  persiguen.
- Atacan cuerpo a cuerpo cada **1,8 s** y vuelven a su zona si el jugador se aleja
  demasiado o entra en un duelo.
- Se pueden fijar con `Tab`, con clic o con el botón **🎯 Objetivo** de la barra
  de habilidades.
- La barra muestra la distancia. Al pulsar una habilidad fuera de alcance,
  el compañero se acerca y la lanza al entrar en rango; moverse manualmente,
  pulsar Escape o Cancelar interrumpe la orden (caduca a los 15 segundos).
- Los salvajes tienen barras de vida en el mundo. Los golpes confirmados por
  el servidor generan impactos, proyectiles y números de daño/curación 3D.
- El bosque incluye copas de varios volúmenes, ruinas digitales y cristales.
- Fuera de un duelo, las habilidades y los autoataques se dirigen al salvaje
  seleccionado.
- Al derrotarlos se gana **XP**; al subir de nivel aumentan HP, EP y el daño.
- Los salvajes reaparecen a los **12 s** y Devimon a los **2 minutos**. El compañero derrotado reaparece a los
  **3,5 s** sin perder progreso.
- No se puede iniciar un duelo mientras un salvaje te está atacando.

## Sprites y progresión PvE

La presentación activa usa únicamente sprites DS sobre el escenario 2.5D.
Los archivos artísticos 3D anteriores son históricos: no se cargan ni se publican.
Consulta [`docs/sprites-ds.md`](docs/sprites-ds.md) para los atlas y sus créditos.

En **Mochila / Mapa → Misiones** se activa una cadena de tres objetivos: pradera,
espesura y Devimon. Hay que volver al refugio con el compañero para entregar cada
misión. Las bajas, la participación en el jefe y las recompensas se validan y
guardan en el servidor; no se conceden premios repetidos. Detalles en
[`docs/misiones.md`](docs/misiones.md) y [`docs/pve.md`](docs/pve.md).

La pestaña **Tienda** permite comprar discos de vida (50 Bits), de energía
(40 Bits) y canjear 1 sello de Devimon por 5 discos de vida, 3 de energía y
200 Bits. Solo atiende en el refugio, fuera de combate, y requiere espacio
para el lote completo. Ver [`docs/tienda.md`](docs/tienda.md).

## Estructura

```text
apps/
  client/            React + Vite + React Three Fiber
    public/models/   Archivo histórico, excluido del build público
    src/assets/      Atlas DS incluidos en la compilación
    src/game/        Escena 2.5D, cámara elevada, tamer y compañero
    src/game/models/ Render de sprites y respaldos 2D
    src/net/         Cliente Colyseus, predicción y mirada
    src/ui/          Inicio, HUD, chat, visor y joystick
  server/            Colyseus 0.18
    src/rooms/       WorldRoom y estado autoritativo
packages/
  content/           Especies, estadísticas, evoluciones, zonas, misiones y habilidades
  shared/            Esquema sincronizado, constantes y mensajes
tools/model-gen/    Archivo de herramientas artísticas anteriores
docs/                Diseño, sprites, análisis técnico y despliegue
```

## Cómo funciona la red

- El cliente envía la **intención de movimiento** (`x`, `z`, `run`) y la
  orientación (`yaw`) a 20 Hz.
- El servidor integra la posición, limita la velocidad y el área jugable, y
  detiene al jugador si deja de recibir input durante 250 ms.
- El cliente predice su propio movimiento y corrige si se desvía más de 1.1 m.
- Los demás jugadores se interpolan a partir de la posición autoritativa.
- El servidor sincroniza la posición y el estado del compañero, independientemente
  del domador. El cliente interpola su representación.
- El combate es autoritativo: el servidor valida invitaciones, distancia,
  objetivos, EP, enfriamientos y autoataques, y aplica el daño. Los clientes
  reciben eventos de golpe, habilidad y fin de duelo.
- El estado se sincroniza con `@colyseus/schema` 5 y la API `schema()`.

## Scripts

| Comando | Función |
|---|---|
| `pnpm dev` | Servidor y cliente en paralelo |
| `pnpm dev:server` | Solo servidor Colyseus |
| `pnpm dev:client` | Solo cliente Vite |
| `pnpm typecheck` | TypeScript en todos los paquetes |
| `pnpm build` | Compilación de producción |
| `pnpm build:public` | Build público con URL del HP y sin assets privados |

## Siguiente etapa

1. Prueba en un Android real y ajustes de rendimiento según el dispositivo.
2. Ampliar las apariencias DS y cubrir las especies antiguas aún provisionales
   (Pagumon/Gazimon, no usadas en los spawns actuales).
3. Ampliar el contenido PvE a partir de la cadena de misiones actual.
4. Ajustar economía y ampliar la tienda según las pruebas de juego; no hay
   intercambio entre jugadores.

## Motor y presentación

El cliente usa **Three.js 0.186 + React Three Fiber 9** como motor 3D web. La
vista es **tercera persona elevada** (20°–65°). No existe alternancia a primera
persona o a personajes 3D.

El render incluye sombras suaves, una luz solar que sigue al jugador, cielo
degradado con shader, terreno de 400 × 400 m con texturas procedurales de césped
y tierra, matas de hierba, flores y colinas lejanas. Todos los personajes se
dibujan como sprites 2D nítidos, incluidos los respaldos provisionales.

Cambiar a Unity o Godot implicaría reescribir el cliente y el despliegue actual.
Se mantiene el motor del escenario y la cámara, sin crear nuevos modelos 3D de
personajes. Los siguientes cambios artísticos deben ampliar los atlas DS.

## Servidor de pruebas

La instancia actual corre en el HP en dos procesos separados:

| Servicio | Ruta | Puerto | Unit |
|---|---|---|---|
| Juego Colyseus | `/home/alvaro/digiworld` | 2567 | `digiworld-server` |
| Cliente estático | `/home/alvaro/digiworld-web` | 8080 | `digiworld-web` |
| Túnel Cloudflare | `~/.cloudflared/digiworld.yml` | — | `cloudflared-digiworld` |

Con tres jugadores usa ~167 MB para el servicio del juego, ~12 MB para el
servidor web y ~20 MB para el túnel. No toca las apps existentes. Los detalles
de actualización, arranque, parada y Cloudflare están en
[`docs/despliegue-hp.md`](docs/despliegue-hp.md).

## Notas de seguridad

- No expongas el puerto 2567 directamente a Internet; usa Cloudflare Tunnel o
  Tailscale.
- El enlace público no tiene autenticación. No lo promociones y, si se filtra,
  rota el subdominio o añade Cloudflare Access.
- Cambia la contraseña SSH del servidor y usa clave pública antes de desplegar.
- Los assets oficiales van en `content/official/`, que está ignorado por Git.
