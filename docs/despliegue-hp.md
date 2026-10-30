# Despliegue de prueba en el HP

**Estado:** dos procesos activos en el HP:
- Juego Colyseus en `/home/alvaro/digiworld`, puerto **2567**.
- Cliente estático en `/home/alvaro/digiworld-web`, puerto **8080**.

**Acceso:** administración por Tailscale (`100.116.141.27`) y juego mediante
el túnel dedicado en <https://digiworld.aliproinv.com>.
**Servicios existentes:** no se modificó Nginx, Cloudflare, MySQL ni las 20 apps
de PM2. El juego corre como procesos aparte.

---

## 1. Comprobaciones

```bash
curl -s http://127.0.0.1:2567/health
curl -s -I http://127.0.0.1:8080/
ss -tulpn | grep -E ':2567|:8080'
tail -n 30 /home/alvaro/digiworld/server.log
tail -n 10 /home/alvaro/web.log
```

Desde la laptop, por Tailscale:

```powershell
Invoke-WebRequest http://100.116.141.27:2567/health -UseBasicParsing
Invoke-WebRequest http://100.116.141.27:8080/ -UseBasicParsing
```

---

## 2. Servicios y operación

Los tres procesos están registrados como servicios systemd y arrancan con el HP:

| Servicio | Función | Puerto |
|---|---|---|
| `digiworld-server` | Servidor Colyseus | 2567 |
| `digiworld-web` | Cliente estático con Python | 8080 |
| `cloudflared-digiworld` | Túnel público dedicado | — |

Comandos:

```bash
systemctl status digiworld-server digiworld-web cloudflared-digiworld
sudo systemctl restart digiworld-server
sudo systemctl restart digiworld-web
sudo systemctl restart cloudflared-digiworld
sudo journalctl -u digiworld-server -f
sudo journalctl -u digiworld-web -f
sudo journalctl -u cloudflared-digiworld -f
```

Detener temporalmente:

```bash
sudo systemctl stop digiworld-server digiworld-web cloudflared-digiworld
```

Volver a arrancar:

```bash
sudo systemctl start digiworld-server digiworld-web cloudflared-digiworld
```

Los servicios están `enabled`, así que sobreviven a un reinicio del HP. No se
modificó `cloudflared.service`, el túnel de las apps de producción.

### 2.1 Cliente estático (puerto 8080)

El cliente compilado se sirve con Python desde `/home/alvaro/digiworld-web`. No
necesita Vite ni Nginx. Al reemplazar los archivos, el servicio sirve la versión
nueva sin reiniciarse.

Si el puerto queda ocupado por un proceso viejo:

```bash
fuser -k 8080/tcp 2>/dev/null || true
sudo systemctl restart digiworld-web
```

`fuser` es más seguro que `pkill -f` para este caso porque no coincide con el
propio comando.

---

## 3. Actualizar el código

Desde Windows, en la raíz del proyecto:

```powershell
tar -czf "$env:TEMP\digiworld-src.tar.gz" `
  --exclude=node_modules --exclude=dist --exclude=.git --exclude="*.log" .
pscp "$env:TEMP\digiworld-src.tar.gz" usuario@100.116.141.27:/home/alvaro/
```

En el HP:

```bash
cd /home/alvaro
tar -xzf digiworld-src.tar.gz -C digiworld
rm digiworld-src.tar.gz
cd digiworld
pnpm install --filter @digiworld/server...
```

Extraer sobre la carpeta conserva `node_modules`. Solo ejecuta `pnpm install` si
cambió `package.json` o `pnpm-lock.yaml`; para cambios de código basta con
reiniciar el servicio:

```bash
sudo systemctl restart digiworld-server
```

### 3.1 Actualizar el cliente estático

Desde Windows, para generar un build público sin modelos de terceros:

```powershell
pnpm build:public
```

Ese script compila con `VITE_SERVER_URL=https://digiworld.aliproinv.com` y elimina
de `dist/` todos los modelos de personajes y los sprites privados. La presentación
activa es solo sprites DS: `dist/models` no debe existir.

Luego empaqueta `apps/client/dist`:

```powershell
tar -czf "$env:TEMP\digiworld-web.tar.gz" -C apps/client/dist .
pscp "$env:TEMP\digiworld-web.tar.gz" usuario@100.116.141.27:/home/alvaro/
```

En el HP:

```bash
cd /home/alvaro
mkdir -p digiworld-web
tar -xzf digiworld-web.tar.gz -C digiworld-web
rm digiworld-web.tar.gz
```

No hace falta reiniciar Python para archivos estáticos: sirve el contenido nuevo
en la siguiente petición.

Conservar los assets anteriores evita romper pestañas que aún tengan abierto
el cliente anterior. El cliente nuevo no solicita modelos GLB/GLTF.

### 3.2 Protección de las partidas

Antes de actualizar, respaldar por separado código, web y `apps/server/data`
con permisos privados (`umask 077`). Nunca incluir datos locales en el archivo
de actualización ni reemplazar el directorio remoto de datos.

Para cambios de servidor, detener solo `digiworld-server`, obtener otra copia
del archivo de perfiles ya detenido, extraer únicamente `apps/server/src`,
`packages/shared/src` y `packages/content/src`, y arrancar el servicio.
Comprobar `/health` antes de reemplazar el cliente estático. No reiniciar
los otros servicios ni las aplicaciones ajenas al juego.

La actualización DS/PvE conserva los perfiles existentes y migra el inventario
al entrar. Los respaldos están en `/home/alvaro/digiworld-backups/`.
Pruebas públicas: `scripts/test-agumon-ds.cjs`,
`scripts/test-persistence-ui.cjs` y `scripts/test-pve-ui.cjs`, usando
`GAME_URL=https://digiworld.aliproinv.com/`.

### 3.3 Misiones del refugio

La actualización de misiones añade `packages/content/src/quests.ts` y actualiza
el catálogo, mensajes, `WorldRoom` y `profile-store`. No requiere dependencias
nuevas ni Docker. Los perfiles sin `quests` se migran al entrar, conservando
especie, nivel, inventario y el resto del progreso.

Se respaldaron código, web y datos antes de publicar, y otra vez los datos con
el servicio detenido. Los respaldos de esta actualización llevan el sufijo
`before-quests-20261029-053921`. Se verificó por SHA-256 que la extracción no
modificó los perfiles; se reinició únicamente `digiworld-server` y después se
publicó el cliente manteniendo los assets anteriores.

Prueba adicional: `scripts/test-quests-ui.cjs`. No pasar `QUEST_UI_TOKEN` en las
pruebas públicas: esa variable es solo para una base temporal local de pruebas.

### 3.4 Tienda del refugio

La tienda añade `packages/content/src/shop.ts`, sus mensajes y el manejo de
compras en `WorldRoom`; usa el inventario existente, sin formato de perfiles
nuevo. El cliente añade una pestaña Tienda dentro de la mochila.

Respaldos de código, web y datos: `before-shop-20261029-101715`, además de la
copia de datos con el servicio detenido. Se verificó el SHA-256 del archivo de
perfiles antes/después de extraer el código y se reinició solo el servidor del
juego. Los assets antiguos se conservaron.

Pruebas: `apps/server/test/shop.ts` y `scripts/test-shop-ui.cjs`. Las compras
reales automatizadas usan únicamente una fixture temporal local; no pasar
`SHOP_UI_TOKEN` al probar el sitio público.

### 3.5 Protagonista y compañeros originales DS

Actualización solo de cliente: domador, Gabumon, Patamon, Garurumon y Angemon
usan atlas originales locales. Se publicó `apps/client/dist` sin reiniciar el
servidor ni reemplazar sus fuentes o datos. Se conservaron los assets anteriores.

Respaldos: `web-before-party-sprites-20261029-123218.tar.gz` y
`data-before-party-sprites-20261029-123218.tar.gz`. Se verificó que el SHA-256 de
los perfiles no cambió durante la extracción; se mantuvieron permisos 600.

Pruebas: `python scripts/test-party-sprites.py` y
`node scripts/test-party-sprites-ui.cjs`. La prueba pública no lleva
`PARTY_UI_TOKENS`; esas claves son exclusivamente para fixtures locales aisladas.

### 3.6 Vinculación y recuperación de partidas

Actualiza `profile-store`, `profile-access`, las rutas HTTP, `WorldRoom`,
`app.config` y los mensajes compartidos. No necesita dependencias nuevas, Docker
ni cambios en Cloudflare: `/room/profile-access/redeem` usa el prefijo ya
encaminado al juego. Se reinició únicamente `digiworld-server`.

Respaldos de código, web y datos con sufijo
`before-profile-access-20261029-142649`, incluida otra copia de datos con el
servicio detenido. Antes de publicar se validó el archivo real con el nuevo
lector, sin escribirlo. El SHA-256 no cambió al extraer código.

La primera escritura migra el contenedor JSON a **v2** sin mover las partidas.
Después de la prueba pública se verificaron los 57 perfiles anteriores:
**0 perdidos y 0 modificados** respecto a la copia con el servidor detenido.
Se validó de nuevo el archivo completo con el lector v2 y permisos 600.

**No degradar el servidor a un lector v1 después de crear accesos.** Un rollback
del cliente sigue siendo posible conservando el servidor compatible con v2.
Nunca restaurar perfiles antiguos sobre progreso nuevo. La protección de versión
del servidor anterior rechaza v2 para evitar borrar sus alias/recuperaciones.

Pruebas: `apps/server/test/profile-access.ts` y
`scripts/test-profile-access-ui.cjs`, además de las regresiones habituales.
La prueba pública se ejecuta sin `ACCESS_UI_TOKEN`; las claves de fixture solo
se permiten en bases temporales locales. Instrucciones y seguridad:
`docs/vinculacion-partidas.md`.

---

## 4. Red

- El servidor escucha en `*:2567` (todas las interfaces), comprobado con `ss`.
- El cliente estático escucha en `*:8080`.
- Tailscale cifra el tráfico entre laptop, teléfono y HP. La instancia actual es
  **privada**: solo es accesible desde la tailnet.
- Para una alfa pública, publica el cliente en Cloudflare Pages y expón el
  WebSocket con Cloudflare Tunnel:

```bash
cloudflared tunnel --url http://localhost:2567
```

No abras el puerto 2567 en el router ni en el firewall. Publicar los nombres o
assets oficiales de Digimon en Internet requiere resolver la licencia primero.

### 4.1 Túnel público de Cloudflare

El juego usa un túnel **dedicado**, separado del `cloudflared.service` que sirve
las apps de producción. No se modificó el túnel existente.

| Recurso | Valor |
|---|---|
| Túnel | `digiworld` |
| ID | `39e832a4-ac09-485f-b3c7-242a88c76330` |
| Config | `/home/alvaro/.cloudflared/digiworld.yml` |
| Credenciales | `/home/alvaro/.cloudflared/39e832a4-ac09-485f-b3c7-242a88c76330.json` |
| Servicio | `cloudflared-digiworld.service` |
| Cliente | <https://digiworld.aliproinv.com> |
| Juego | `wss://digiworld.aliproinv.com` (mismo host) |
| Alias del juego | `wss://digiworld-api.aliproinv.com`, `wss://digiworld-game.aliproinv.com` |

El túnel enruta por **ruta** dentro del mismo hostname:

- `/matchmake/*`, `/room/*`, `/health` y los WebSockets `/<room>/<token>`
  van al puerto 2567.
- Todo lo demás (`/`, `/assets/*`, `/robots.txt`) se sirve desde el cliente
  estático en el puerto 8080.

Así el navegador reutiliza el mismo origen para el matchmaking y el WebSocket,
evita CORS y evita que la reserva de sala expire por un segundo subdominio.

Los alias `digiworld-api` y `digiworld-game` apuntan directamente al servidor
de juego. Se conservan por compatibilidad, pero el cliente usa el hostname
principal. El alias `digiworld-game` también ayudó cuando el navegador mantuvo
una caché DNS negativa del primer subdominio.

Comandos:

```bash
sudo systemctl status cloudflared-digiworld
sudo systemctl restart cloudflared-digiworld
sudo journalctl -u cloudflared-digiworld -f
```

Las rutas DNS se crearon con:

```bash
cloudflared tunnel route dns --overwrite-dns 39e832a4-ac09-485f-b3c7-242a88c76330 digiworld.aliproinv.com
cloudflared tunnel route dns --overwrite-dns 39e832a4-ac09-485f-b3c7-242a88c76330 digiworld-api.aliproinv.com
cloudflared tunnel route dns --overwrite-dns 39e832a4-ac09-485f-b3c7-242a88c76330 digiworld-game.aliproinv.com
```

Para compilar el cliente contra el servidor público:

```powershell
$env:VITE_SERVER_URL = "https://digiworld.aliproinv.com"
pnpm --filter @digiworld/client build
```

Luego se sube `apps/client/dist` a `/home/alvaro/digiworld-web` como se indica
en la sección 3.1.

**Privacidad:** el enlace no está indexado (`robots.txt` y `noindex`) y no se
promociona, pero cualquiera que lo conozca puede entrar: no hay autenticación
todavía. Para una prueba más cerrada, añadir Cloudflare Access o un token de
entrada en el servidor.

---

## 5. Consumo medido (25/10/2026)

| Métrica | Valor |
|---|---|
| `digiworld-server` (pnpm + tsx + Node) | ~167 MB RSS |
| `digiworld-web` (Python) | ~12 MB RSS |
| `cloudflared-digiworld` | ~20 MB RSS |
| RAM disponible en el HP | ~3.4 GB |
| Load average con 3 jugadores | 0.30 |
| Jugadores probados | 3 pestañas contra el cliente estático |
| FPS del cliente | 60 FPS a 800 × 674 CSS |
| Layout móvil | Probado en un iframe de 390 × 674 |

Para una alfa de 20–30 jugadores conviene ejecutar el servidor compilado con
`node` (sin `pnpm` ni `tsx`) y medir de nuevo.

---

## 6. Seguridad

- Cambiar la contraseña SSH compartida por chat.
- Instalar una clave pública y desactivar `PasswordAuthentication`.
- No reutilizar la contraseña en otros servicios.
- Mantener el repositorio privado mientras contenga nombres o assets oficiales.
- Si se publica, proteger la instancia con Cloudflare Access o una contraseña
  temporal mientras siga siendo un prototipo interno.

---

## 7. Próximo paso de despliegue

La versión privada y el enlace público ya están activos:

- Cliente público: `https://digiworld.aliproinv.com`
- Servidor público: `wss://digiworld.aliproinv.com` (mismo host)
- Cliente por Tailscale: `http://100.116.141.27:8080`

Siguientes mejoras:

1. Añadir Cloudflare Access o un token de entrada si el enlace se comparte más.
2. Medir latencia y jugadores simultáneos con usuarios reales.
3. Reemplazar los assets oficiales por contenido original antes de cualquier
   promoción pública.
4. Migrar los servicios a un VPS si la alfa crece más allá de 20–30 jugadores.
