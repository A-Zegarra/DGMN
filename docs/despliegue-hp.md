# Despliegue de prueba en el HP

**Estado:** dos procesos activos en el HP:
- Juego Colyseus en `/home/alvaro/digiworld`, puerto **2567**.
- Cliente estático en `/home/alvaro/digiworld-web`, puerto **8080**.

**Acceso:** Tailscale (`100.116.141.27`). No está expuesto a Internet.
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

## 2. Arrancar y detener

Arrancar:

```bash
cd /home/alvaro/digiworld
nohup pnpm --filter @digiworld/server start > server.log 2>&1 &
echo $! > server.pid
```

Detener:

```bash
cd /home/alvaro/digiworld
pkill -f "[t]sx src/index.ts" || true
[ -f server.pid ] && kill "$(cat server.pid)" 2>/dev/null || true
rm -f server.pid
```

El patrón `[t]sx` evita que `pkill` se mate a sí mismo.

Para que sobreviva a un reinicio del HP, conviene registrar el proceso en PM2:

```bash
cd /home/alvaro/digiworld/apps/server
pm2 start "node --import tsx src/index.ts" --name digiworld-server --time
pm2 save
```

> `pm2 save` reescribe la lista de procesos de PM2. Úsalo solo si estás de
> acuerdo en añadir el juego a la lista existente.

### 2.1 Cliente estático (puerto 8080)

El cliente compilado se sirve con Python, sin Vite ni Nginx:

```bash
cd /home/alvaro
nohup python3 -m http.server 8080 --bind 0.0.0.0 \
  --directory /home/alvaro/digiworld-web > web.log 2>&1 &
echo $! > web.pid
```

Detener:

```bash
[ -f /home/alvaro/web.pid ] && kill "$(cat /home/alvaro/web.pid)" 2>/dev/null || true
rm -f /home/alvaro/web.pid
```

Si el puerto queda ocupado por un proceso viejo:

```bash
fuser -k 8080/tcp 2>/dev/null || true
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
reiniciar el proceso.

### 3.1 Actualizar el cliente estático

Desde Windows, después de `pnpm --filter @digiworld/client build`:

```powershell
tar -czf "$env:TEMP\digiworld-web.tar.gz" -C apps/client/dist .
pscp "$env:TEMP\digiworld-web.tar.gz" usuario@100.116.141.27:/home/alvaro/
```

En el HP:

```bash
cd /home/alvaro
rm -rf digiworld-web
mkdir digiworld-web
tar -xzf digiworld-web.tar.gz -C digiworld-web
rm digiworld-web.tar.gz
```

No hace falta reiniciar Python para archivos estáticos: sirve el contenido nuevo
en la siguiente petición.

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

---

## 5. Consumo medido (25/10/2026)

| Métrica | Valor |
|---|---|
| Proceso Node del juego | ~155 MB RSS |
| Proceso `tsx` auxiliar | ~56 MB RSS |
| Servidor web Python | ~23 MB RSS |
| RAM disponible en el HP | ~3.4 GB |
| Load average con 3 jugadores | 0.30 |
| Jugadores probados | 3 pestañas contra el cliente estático por Tailscale |
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

La versión privada ya está publicada en la tailnet:

- Cliente: `http://100.116.141.27:8080`
- Servidor: `ws://100.116.141.27:2567`

Para abrirla a Internet:

1. Crear un proyecto en Cloudflare Pages y subir `apps/client/dist`.
2. Publicar el servidor con Cloudflare Tunnel y un subdominio, por ejemplo
   `digiworld.aliproinv.com`.
3. Recompilar el cliente con la URL `wss://` pública.
4. Medir latencia y jugadores simultáneos antes de abrirlo a más gente.
