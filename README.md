# DIGIWORLD ONLINE

Prototipo interno de un MMORPG 3D ligero inspirado en Digimon, pensado para
navegador y Android. La primera versión es una prueba técnica de mundo
compartido: varios jugadores caminan por el Bosque Digital en tiempo real, eligen
un compañero y conversan por chat.

> **Uso interno.** Los nombres y criaturas de Digimon pertenecen a sus
> titulares. Este repositorio debe permanecer privado mientras use contenido
> oficial. Para una versión pública se sustituye el *content pack* oficial por
> criaturas originales.

## Estado actual — v0.1.0

- [x] Monorepo con cliente, servidor y contenido compartido.
- [x] Servidor autoritativo con tick de 20 Hz y parches de 15 Hz.
- [x] Movimiento con predicción local y reconciliación básica.
- [x] Tamer y Digimon separados: el compañero deambula cerca del tamer.
- [x] Primera y tercera persona con cámara libre y `V`.
- [x] Joystick virtual visible en primera y tercera persona desde móvil.
- [x] Zona táctil dedicada para mirar, independiente del joystick.
- [x] Botón de pantalla completa horizontal / volver a vertical.
- [x] Controles táctiles: joystick izquierdo y mirada en el resto de la pantalla.
- [x] Modelos low-poly propios para Agumon, Gabumon y Patamon.
- [x] Tercera persona con sombras suaves, cielo degradado, texturas, vegetación y colinas.
- [x] Terreno visual de 400 × 400 m con árboles, rocas y senderos instanciados.
- [x] Selección de compañero: Agumon, Gabumon o Patamon.
- [x] Chat de zona y lista de jugadores conectados.
- [x] Desconexión limpia, aparición separada y actualización de jugadores.
- [x] Cliente estático servido desde el HP y probado por Tailscale.
- [x] Túnel público dedicado en Cloudflare, con `noindex`, separado de las apps existentes.
- [ ] Combate, enemigos salvajes y evoluciones (siguiente etapa).
- [ ] Guardado persistente.
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
El archivo `apps/client/.env.local` apunta a ese servidor. Si trabajas sin el
HP, bórralo o cambia la URL a `http://localhost:2567`.

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
| Mover | `WASD` o flechas | Joystick izquierdo |
| Mirar / orbitar | Ratón (clic para capturarlo) | Arrastra fuera del joystick |
| Cambiar vista | `V` o botón del HUD | Botón del HUD |
| Pantalla completa | Botón **Pantalla** | Botón **Horizontal / Vertical** |
| Correr | `Shift` | — |
| Chat | `Enter` | Botón Chat |

En tercera persona ves al tamer desde detrás y puedes orbitar la cámara. El
Digimon deambula alrededor del tamer, se detiene a mirarte y vuelve a moverse
cada pocos segundos; no se queda pegado a la cámara. En primera persona lo ves
al girarte. La vista isométrica se retiró para evitar el aspecto de tablero.

El botón de pantalla completa intenta bloquear la orientación horizontal en
Android. En navegadores que no permiten el bloqueo (por ejemplo, Safari en
iPhone), la pantalla completa puede funcionar pero la rotación queda manual.

## Estructura

```text
apps/
  client/            React + Vite + React Three Fiber
    src/game/        Escena, cámara FP/TP, tamer y compañero
    src/game/models/ Modelos low-poly por especie
    src/net/         Cliente Colyseus, predicción y mirada
    src/ui/          Inicio, HUD, chat y joystick
  server/            Colyseus 0.18
    src/rooms/       WorldRoom y estado autoritativo
packages/
  content/           Especies, estadísticas, evoluciones y zonas
  shared/            Esquema sincronizado, constantes y mensajes
docs/                Diseño, análisis técnico y despliegue
```

## Cómo funciona la red

- El cliente envía la **intención de movimiento** (`x`, `z`, `run`) y la
  orientación (`yaw`) a 20 Hz.
- El servidor integra la posición, limita la velocidad y el área jugable, y
  detiene al jugador si deja de recibir input durante 250 ms.
- El cliente predice su propio movimiento y corrige si se desvía más de 1.1 m.
- Los demás jugadores se interpolan a partir de la posición autoritativa.
- El compañero no se sincroniza: cada cliente calcula su seguimiento a partir
  del movimiento del tamer, así que no consume ancho de banda extra.
- El estado se sincroniza con `@colyseus/schema` 5 y la API `schema()`.

## Scripts

| Comando | Función |
|---|---|
| `pnpm dev` | Servidor y cliente en paralelo |
| `pnpm dev:server` | Solo servidor Colyseus |
| `pnpm dev:client` | Solo cliente Vite |
| `pnpm typecheck` | TypeScript en todos los paquetes |
| `pnpm build` | Compilación de producción |

## Siguiente etapa

1. Enemigos salvajes con patrulla, aggro y persecución.
2. Combate por turnos validado en el servidor.
3. Experiencia, afinidad y primera evolución.
4. Guardado SQLite de nivel, especie e inventario.
5. Prueba en un Android real.
6. Modelos GLB con animaciones esqueléticas.

## Motor y modelos

El cliente usa **Three.js 0.186 + React Three Fiber 9** como motor 3D web. La
vista principal es **tercera persona**; `V` alterna a primera persona. La
isométrica se retiró para evitar el aspecto de tablero.

El render incluye sombras suaves, una luz solar que sigue al jugador, cielo
degradado con shader, terreno de 400 × 400 m con texturas procedurales de césped
y tierra, matas de hierba, flores y colinas lejanas. Los modelos actuales de
Agumon, Gabumon y Patamon son procedurales, low-poly y con detalles propios
(ojos con brillo, dientes, lengua, pelaje, cuernos, orejas, garras y cola).

Cambiar a Unity o Godot implicaría reescribir el cliente y el despliegue actual.
Para conseguir aún más detalle no hace falta cambiar de motor: el siguiente paso
es importar modelos **GLB** con sus animaciones y mantener los procedurales como
respaldo. Se pueden sustituir sin tocar el servidor.

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
