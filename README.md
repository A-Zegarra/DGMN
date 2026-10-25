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
- [x] Cámara isométrica que sigue al jugador.
- [x] Mapa low-poly con árboles, rocas y senderos instanciados.
- [x] Selección de compañero: Agumon, Gabumon o Patamon.
- [x] Chat de zona y lista de jugadores conectados.
- [x] Desconexión limpia y actualización de la lista de jugadores.
- [x] Instancia de prueba desplegada en el HP y probada por Tailscale.
- [ ] Combate, enemigos salvajes y evoluciones (siguiente etapa).
- [ ] Guardado persistente.
- [ ] Controles táctiles dedicados.

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

Abre dos pestañas del navegador para ver a dos jugadores en el mismo mundo.
También puedes abrir el cliente desde el teléfono en la misma red o por
Tailscale.

### Probar desde el teléfono

1. Conecta el teléfono a la misma red Tailscale que la laptop y el HP.
2. Arranca el cliente en la laptop con `pnpm dev:client`.
3. Abre en el teléfono `http://100.84.154.39:5173`.

El cliente ya está configurado para usar el servidor del HP
(`ws://100.116.141.27:2567`) mediante `apps/client/.env.local`. Si el servidor
está en la laptop, cambia esa URL a la IP de la laptop.

Vite escucha en `0.0.0.0`. Si usas el HP como servidor, su IP de Tailscale es
`100.116.141.27`.

## Controles

| Acción | Teclado / ratón | Táctil |
|---|---|---|
| Mover | `WASD` o flechas | Toca el suelo |
| Correr | `Shift` | — |
| Ir a un punto | Clic en el suelo | Toca el suelo |
| Chat | `Enter` | Toca el campo |

## Estructura

```text
apps/
  client/            React + Vite + React Three Fiber
    src/game/        Escena, cámara, terreno, props y avatares
    src/net/         Cliente Colyseus y predicción local
    src/ui/          Inicio, HUD y chat
  server/            Colyseus 0.18
    src/rooms/       WorldRoom y estado autoritativo
packages/
  content/           Especies, estadísticas, evoluciones y zonas
  shared/            Esquema sincronizado, constantes y mensajes
docs/                Diseño y análisis técnico
```

## Cómo funciona la red

- El cliente envía solo la **intención de movimiento** (`x`, `z`, `run`) a 20 Hz.
- El servidor integra la posición, limita la velocidad y el área jugable, y
  detiene al jugador si deja de recibir input durante 250 ms.
- El cliente predice su propio movimiento y corrige si se desvía más de 1.1 m.
- Los demás jugadores se interpolan a partir de la posición autoritativa.
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
5. Controles táctiles y prueba en un Android real.

## Servidor de pruebas

La instancia actual corre en el HP, en `/home/alvaro/digiworld`, sobre el puerto
2567. Usa ~124 MB de RAM con dos jugadores y no toca las apps existentes. Los
detalles de actualización, arranque y parada están en
[`docs/despliegue-hp.md`](docs/despliegue-hp.md).

## Notas de seguridad

- No expongas el puerto 2567 directamente a Internet; usa Cloudflare Tunnel o
  Tailscale.
- Cambia la contraseña SSH del servidor y usa clave pública antes de desplegar.
- Los assets oficiales van en `content/official/`, que está ignorado por Git.
