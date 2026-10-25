# Análisis de viabilidad — DIGIWORLD ONLINE (v2)

**Fecha:** 25 de octubre de 2026
**Estado:** servidor HP verificado por SSH (solo lectura, sin cambios).
**Alcance:** viabilidad técnica con la laptop ASUS y el servidor HP reales, y propuesta de estilo visual para web en tiempo real.

---

## 1. Resumen ejecutivo

| Área | Veredicto | Comentario |
|---|---|---|
| Desarrollo en la laptop ASUS | **Viable con ajustes** | CPU y SSD suficientes; 8 GB de RAM y 48 GB libres son el límite. |
| Servidor HP | **Mejor de lo esperado** | 8 GB (no 4), 3.6 GB disponibles, CPU casi idle, 333 GB libres. |
| Multijugador 20–30 jugadores | **Viable** | Una zona, tick 15 Hz, assets fuera del servidor. |
| Multijugador 50+ | **Viable solo con 16 GB** | La RAM es ampliable al máximo de 16 GB por 25–40 USD. |
| Tiempo real tipo WoW | **Viable por etapas** | Mundo en tiempo real desde v0.1; combate en tiempo real en v0.2. |
| 3D low-poly en web | **Recomendado** | Más liviano que 3D con texturas y reutiliza modelos oficiales. |
| Campaña completa por temporadas | **Proyecto de años** | El riesgo es contenido y arte, no hardware. |
| Uso de Digimon oficiales | **Aceptable solo interno** | No publicar, no subir a repositorio público, aislar en content pack privado. |

**Conclusión:** el proyecto es viable como prototipo y alfa cerrada con el hardware actual. La arquitectura web-first del chat es correcta. La decisión importante no es 3D sí o no, sino **qué estilo visual permite producir contenido rápido sin sacrificar la sensación de MMO**.

---

## 2. Hardware real medido

### 2.1 Laptop de desarrollo (ASUS VivoBook X515EA)

| Componente | Medición |
|---|---|
| CPU | Intel Core i5-1135G7 — 4 núcleos / 8 hilos, 2.4 GHz (Tiger Lake) |
| RAM | 8 GB (2 × 4 GB DDR4-3200) — 0.6 GB libres al medir |
| GPU | Intel Iris Xe integrada (~1 GB compartidos) |
| Disco | NVMe Intel 512 GB — 48.4 GB libres |
| Sistema | Windows 11 Home build 26300 |
| Node / pnpm / Git | 24.14.0 / 11.1.1 / 2.55.0 |
| Docker / Python | 29.6.2 / 3.14.3 |
| MySQL | 9.5 instalado, detenido |
| Blender / JDK / Android SDK | No instalados |

**Cuello de botella:** 8 GB de RAM. Un stack cómodo (VS Code + Vite + navegador + Node + MySQL) consume 5–6 GB. Cabe, pero sin emulador de Android ni Docker Desktop simultáneos.

**Disco:** 48 GB libres alcanzan para código, Blender y node_modules, pero no para Android Studio completo (~15–25 GB) sin liberar espacio.

**Mejora:** la placa X515EA suele permitir 4 GB soldados + 1 ranura SODIMM. Confirmar con CPU-Z antes de comprar 16 GB DDR4-3200 (30–45 USD).

### 2.2 Servidor HP (verificado)

| Componente | Medición real |
|---|---|
| Host | ali-home-server, Ubuntu 26.04 LTS, kernel 7.0 |
| CPU | Intel Core i7-2670QM — 4 núcleos / 8 hilos, 2.2–3.1 GHz (Sandy Bridge, 2011) |
| RAM | **8 GB** (2 × 4 GB DDR3-1333), máximo soportado **16 GB**, 2 ranuras ocupadas |
| RAM disponible | **3.6 GB** + 4 GB de swap sin usar |
| Disco | Hitachi HTS54757 HDD 698 GB, ~80 MB/s secuencial, 333 GB libres |
| Red | Wi-Fi 2.4 GHz (canal 11), señal −56 dBm, 65–117 Mbit/s de enlace |
| Node / pnpm | 24.19.0 / 11.1.1 |
| MySQL | 8.4.11 nativo + 2 contenedores MySQL (8.0 y 8.4) |
| Nginx / Docker / Cloudflare | 1.28.3 / 29.8.1 / 2026.8.2 |
| Tailscale | Activo, IP 100.116.141.27 |
| Carga | load average 0.35; CPU 2.8 %; RAM 49.5 % |

**Consumo actual:**
- 20 aplicaciones PM2 (Next.js y APIs): ~2.0 GB.
- 3 instancias MySQL (1 nativa + 2 Docker): ~1.4 GB.
- cloudflared: ~119 MB.
- Postgres en Docker: ~65 MB.

**Lectura:** el chat decía 4 GB; en realidad son 8 GB y hay 3.6 GB disponibles. El CPU está casi libre. El servidor aguanta una alfa de 20–30 jugadores sin ampliar. Los límites reales son el HDD, el Wi-Fi 2.4 GHz y la RAM compartida con 20 apps en producción.

---

## 3. Capacidad estimada del servidor

Supuestos: Colyseus en proceso aparte, una zona, tick de 15 Hz, guardado por lotes, modelos servidos desde CDN y no desde el HP.

| Concurrentes | Veredicto | Exigencia |
|---|---|---|
| 2–5 | **Cómodo** | Pruebas funcionales, incluso con todo lo actual. |
| 10–20 | **Cómodo** | ~300–500 MB de RAM para el juego. |
| 20–30 | **Viable** | Una zona, interés por distancia, guardado por lotes. |
| 30–50 | **Al límite** | 16 GB recomendable; vigilar CPU y Wi-Fi. |
| 50+ | **No sin ampliar** | 16 GB + SSD + Ethernet, o VPS. |

**Notas:**
- El HDD soporta pocas operaciones aleatorias por segundo: nada de escribir en base de datos por cada acción.
- El Wi-Fi 2.4 GHz añade jitter; para pruebas serias de tiempo real conviene cable Ethernet o 5 GHz.
- Consolidar las 3 instancias MySQL podría liberar 0.5–1 GB, pero **no se debe tocar** sin revisar qué apps dependen de cada una.

---

## 4. Propuesta visual: qué usar en vez de 3D pesado

### 4.1 La idea clave

El 3D no es el problema. Lo pesado son las **texturas grandes, las sombras en tiempo real, el exceso de polígonos y las draw calls**. Un 3D low-poly plano, sin texturas y sin sombras, pesa menos que muchos juegos 2D con sprites grandes.

### 4.2 Opciones

| Criterio | 3D low-poly plano | 2.5D isométrico con sprites | 3D con texturas |
|---|---|---|---|
| Peso en navegador | **Bajo** | **Muy bajo** | Alto |
| Uso de modelos oficiales 3D | **Directo (GLB)** | Requiere renderizarlos a sprites | Directo |
| Animaciones | Reutiliza rigs existentes | 8 direcciones × clips | Reutiliza rigs |
| Coste de arte nuevo | Medio | Alto | Muy alto |
| Cámara | Isométrica o tercera persona | Fija isométrica | Tercera persona |
| Móvil | 30–60 fps | 60 fps | 20–30 fps |
| Sensación de MMO | **Alta** | Media (estilo Ragnarok) | Muy alta |
| Complejidad de red | Baja (x, y, z) | Baja (x, y) | Baja |

### 4.3 Recomendación

**3D low-poly estilizado con cámara en tercera persona**, estética de diorama
natural:

- **Modelos:** 1 500–3 000 triángulos por Digimon, un solo material, color plano o paleta de 256 px.
- **Mundo:** terreno de una malla con colores por vértice, props de 50–500 triángulos instanciados.
- **Sin sombras en tiempo real:** círculo oscuro bajo cada criatura.
- **Niebla y distancia de dibujo de 50–70 m.**
- **Menos de 150 draw calls** y 30–40 personajes visibles.
- **Cámara en tercera persona** con órbita y primera persona con `V`.
- **Controles:** WASD + clic para mover, joystick táctil en Android. Sin capturar el puntero.
- **Objetivo:** 60 fps en PC, 30 fps en móvil de gama media a 720p.

**Por qué:** reutiliza los modelos 3D oficiales que ya tienes, se siente como un
MMO real y es lo bastante liviano para Iris Xe y teléfonos. La tercera persona
evita el aspecto de tablero de la isométrica y permite ver al Digimon y al
entorno con más profundidad.

**Alternativa 2.5D:** si prefieres el mínimo peso posible o tienes arte 2D, el estilo Ragnarok Online (sprites animados sobre terreno 3D) es aún más liviano, pero exige convertir cada modelo 3D a sprites en 8 direcciones. Solo conviene si el arte 2D ya existe.

**No recomendado:** 3D con texturas PBR, sombras dinámicas y postprocesado. Se ve mejor, pero multiplica el peso, el coste de arte y los problemas en móvil.

---

## 5. Arquitectura en tiempo real

### 5.1 Modelo de red

| Capa | Decisión |
|---|---|
| Salas | Una sala Colyseus por zona/canal, máximo 30 jugadores |
| Tick | 15 Hz para movimiento; 20 Hz solo en combate |
| Cliente | Interpolación de 100 ms y predicción local del jugador |
| Servidor | Autoritativo: valida velocidad, colisiones, cooldowns y daño |
| Interés | Solo se sincronizan entidades a 60–80 m |
| Persistencia | SQLite en alfa; MySQL 8.4 cuando existan cuentas |
| Assets | Cloudflare R2/CDN; nunca desde el HP |
| Transporte | WebSocket sobre TLS vía Cloudflare Tunnel; Tailscale para pruebas internas |

### 5.2 Tiempo real por etapas

1. **v0.1 — Mundo vivo:** movimiento en tiempo real, otros jugadores visibles, compañero que sigue, enemigos que patrullan y persiguen.
2. **v0.1 — Combate por turnos:** superposición instanciada, sin problemas de latencia. Es la forma más rápida de tener combate divertido y validado en servidor.
3. **v0.2 — Combate en tiempo real:** ataque automático, 3 habilidades con cooldown, validación por distancia y servidor. Aquí se acerca a WoW.
4. **v0.3 — PvP y captura:** reglas por generación, escaneo de datos, intercambio.

Intentar combate en tiempo real desde el día uno multiplica la complejidad de red antes de tener mundo, cámara y criaturas funcionando.

---

## 6. Alcance de la v0.1

### 6.1 Contenido mínimo

- **Una zona:** Bosque Digital, 200 × 200 m, con colisiones y puntos de aparición.
- **Tres compañeros iniciales:** Agumon, Gabumon y Patamon.
- **Una evolución por línea:** Greymon, Garurumon y Angemon.
- **Enemigos salvajes:** Koromon, Pagumon y Gazimon.
- **Un jefe de zona:** Devimon.
- **Tres misiones encadenadas:** tutorial, cacería y primera evolución.
- **Sistemas:** nivel, experiencia, afinidad por tipo de enemigo, inventario mínimo, guardado.
- **Multijugador:** 2–10 jugadores en la misma zona, chat y presencia.

Total: **7 modelos de criatura + 1 jefe**. Es un alcance realista para las primeras semanas.

### 6.2 Lo que NO entra en la v0.1

- Temporadas completas, Adventure 02, Tamers.
- Cientos de Digimon.
- PvP, intercambios, captura por escaneo.
- Digivices y emblemas.
- Combate en tiempo real.
- Cuentas con correo y recuperación.

---

## 7. Despliegue

| Pieza | Dónde | Notas |
|---|---|---|
| Cliente web | Cloudflare Pages | Gratis, CDN global, HTTPS |
| Servidor de juego | HP, puerto 2567 | Servicio PM2/systemd aparte, límite de memoria |
| Proxy y TLS | Nginx + Cloudflare Tunnel | `wss://` sin abrir puertos |
| Pruebas internas | Tailscale | `ws://100.116.141.27:2567` desde laptop o teléfono |
| Base de datos | SQLite alfa → MySQL 8.4 | No añadir otra instancia MySQL ahora |
| Assets | Cloudflare R2 / disco local | Pack oficial privado, pack original público |

**Regla:** el servidor del juego no sirve modelos ni texturas. Solo estado y lógica.

---

## 8. Legalidad y organización del contenido

El uso interno y local reduce el riesgo, pero conviene diseñar desde el inicio para poder publicar sin rehacer nada:

- Repositorio **privado** mientras contenga assets oficiales.
- Dos carpetas de contenido: `content/official` (privada, no se publica) y `content/original` (pública).
- El motor y las reglas no dependen de los assets: un *content pack* define modelos, nombres, estadísticas y evoluciones.
- Si algún día se publica, se cambia el pack oficial por el original sin tocar el código.
- No subir modelos oficiales a GitHub público ni a Cloudflare Pages público.

---

## 9. Compras recomendadas

| Artículo | Para qué | Coste aprox. |
|---|---|---|
| 2 × 8 GB DDR3-1333 para el HP | Llegar a los 16 GB máximos | 25–40 USD |
| 16 GB SODIMM DDR4-3200 para la laptop | Blender + Vite + navegador a la vez | 30–45 USD |
| SSD SATA 240–480 GB para el HP | MySQL, swap y sistema | 20–35 USD |
| Cable Ethernet | Eliminar jitter del Wi-Fi 2.4 GHz | 5–10 USD |
| Pasta térmica | El i7 de 2011 probablemente hace throttling | 5–8 USD |

**Prioridad:** cable Ethernet (gratis/barato) → RAM del HP → RAM de la laptop → SSD.

---

## 10. Plan de arranque

| Semana | Entregable |
|---|---|
| 1 | Monorepo, servidor Colyseus, sala de prueba, movimiento con cápsulas |
| 2 | Cámara en tercera persona, mapa del bosque, dos jugadores por Tailscale |
| 3 | Compañero que sigue, enemigos salvajes, aggro y persecución |
| 4 | Combate por turnos, daño validado en servidor, experiencia |
| 5 | Evolución, guardado SQLite, UI básica, controles táctiles |
| 6 | Tres modelos low-poly, animaciones básicas, pruebas en teléfono |

El arte propio o la conversión de modelos oficiales puede sumar 2–4 semanas adicionales.

---

## 11. Decisiones tomadas y pendientes

**Tomadas:**
1. **Estilo visual:** 3D low-poly con cámara en tercera persona, materiales con
   textura, sombras suaves y cielo degradado.
2. **Assets:** todavía no hay modelos; se usan primitivas de color y la
   arquitectura queda lista para un *content pack* oficial privado.
3. **Desarrollo:** Windows para cliente y arte; HP Ubuntu como servidor de
   pruebas.
4. **Red:** Tailscale para pruebas internas; Cloudflare Tunnel para una alfa
   pública.

**Pendientes:**
1. **Combate:** turnos en v0.1 y tiempo real en v0.2, o tiempo real desde el
   inicio. Recomendación: turnos primero.
2. **Seguridad:** cambiar la contraseña SSH compartida por chat y pasar a clave
   pública.
3. **Red del HP:** confirmar si se puede conectar por Ethernet o 5 GHz.
4. **Persistencia:** SQLite en la alfa y MySQL 8.4 cuando existan cuentas.

---

## 12. Estado de implementación (25/10/2026)

### Construido

- Monorepo pnpm con `apps/client`, `apps/server`, `packages/shared` y
  `packages/content`.
- Servidor Colyseus 0.18 autoritativo, tick de 20 Hz, parches de 15 Hz,
  validación de velocidad, límites y orientación (`yaw`).
- Cliente React 19 + Vite 8 + React Three Fiber 9 + Three.js 186.
- **Tamer y Digimon separados**: el compañero deambula en un radio cercano, se
  detiene a mirar al tamer y no consume estado de red adicional.
- **Primera y tercera persona** con `V`: tercera persona con órbita de cámara
  y primera persona con captura de ratón.
- **Joystick virtual visible** en móvil y **zona táctil dedicada** para mirar,
  independiente del joystick.
- **Botón de pantalla completa** que intenta bloquear la orientación horizontal
  en Android.
- **Modelos low-poly propios** para Agumon, Gabumon y Patamon, con detalles
  (ojos con brillo, dientes, lengua, pelaje, cuernos, orejas y garras), variantes
  para Greymon, Garurumon y Angemon, y un modelo genérico para el resto.
- **Iluminación y entorno más detallados**: sombras suaves, cielo degradado,
  sol dinámico que sigue al jugador, terreno de 400 × 400 m con texturas
  procedurales de césped y tierra, matas de hierba, flores y colinas lejanas.
- Árboles/rocas/arbustos instanciados, plaza central y aparición separada de
  jugadores.
- Predicción local, reconciliación, interpolación de jugadores remotos y
  etiquetas de nombre con sprites de canvas escaladas por distancia.
- Selección de Agumon, Gabumon o Patamon; datos de estadísticas y evoluciones.
- Chat de zona con límite de frecuencia, lista de jugadores y desconexión limpia.
- UI responsive con chat colapsable en móvil.
- Build de producción correcto servido desde el HP.
- **Túnel dedicado de Cloudflare** (`digiworld`) con servicio systemd propio,
  separado del túnel de producción, y `noindex` en el cliente.

### Probado

| Prueba | Resultado |
|---|---|
| Movimiento con WASD | ~4.2 m/s, corregido por el servidor |
| Tercera persona + ratón | Cámara detrás del tamer y órbita con el ratón |
| Primera persona con `V` | Movimiento relativo a la cámara y yaw sincronizado |
| Compañero libre | Deambula alrededor del tamer y se detiene a mirarlo |
| Cámara y compañero | No se queda entre cámara y tamer en tercera persona |
| Joystick y mirada táctil | Movimiento y giro verificados antes y después de usar el joystick |
| Pantalla completa | Botón presente; el bloqueo de orientación depende del navegador |
| Tres jugadores en el mismo mundo | Visibles, separados y sincronizados |
| Cuatro jugadores con modelos | 60 FPS, modelos Agumon, Gabumon y Patamon |
| Sombras, cielo y terreno | Render sin errores; sombras y texturas visibles |
| Chat entre jugadores | Recibido en los clientes |
| Desconexión | El jugador desaparece y se anuncia en el chat |
| Cliente estático en el HP | Conectado por Tailscale en el puerto 8080 |
| Acceso público por Cloudflare | Cliente HTTPS + WebSocket `wss://`, chat y movimiento |
| Rendimiento del cliente | 60 FPS a 800 × 674 CSS |
| Layout móvil | Probado a 390 × 674 |
| RAM del servidor con 3 jugadores | ~155 MB de juego + 56 MB de `tsx` + 23 MB web + 20 MB túnel |

### Pendiente inmediato

1. Enemigos salvajes (Koromon, Pagumon, Gazimon) con patrulla y aggro.
2. Combate por turnos validado en el servidor.
3. Experiencia, nivel y primera evolución.
4. Guardado SQLite.
5. Prueba en un Android físico.
6. Autenticación opcional para el enlace público (Cloudflare Access o token).

