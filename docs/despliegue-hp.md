# Despliegue de prueba en el HP

**Estado:** instancia activa en `/home/alvaro/digiworld`, puerto **2567**.
**Acceso:** Tailscale (`100.116.141.27`). No está expuesta a Internet.
**Servicios existentes:** no se modificó Nginx, Cloudflare, MySQL ni las 20 apps
de PM2. El juego corre como un proceso aparte.

---

## 1. Comprobaciones

```bash
curl -s http://127.0.0.1:2567/health
ss -tulpn | grep 2567
tail -n 30 /home/alvaro/digiworld/server.log
```

Desde la laptop, por Tailscale:

```powershell
Invoke-WebRequest http://100.116.141.27:2567/health -UseBasicParsing
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
rm -rf digiworld
mkdir digiworld
tar -xzf digiworld-src.tar.gz -C digiworld
rm digiworld-src.tar.gz
cd digiworld
pnpm install --filter @digiworld/server...
```

Reinicia el proceso con los comandos de la sección 2.

---

## 4. Red

- El servidor escucha en `*:2567` (todas las interfaces), comprobado con `ss`.
- Tailscale cifra el tráfico entre laptop, teléfono y HP.
- Para una alfa pública, publica el cliente en Cloudflare Pages y expón el
  WebSocket con Cloudflare Tunnel:

```bash
cloudflared tunnel --url http://localhost:2567
```

No abras el puerto 2567 en el router ni en el firewall.

---

## 5. Consumo medido (25/10/2026)

| Métrica | Valor |
|---|---|
| Proceso Node del juego | ~124 MB RSS |
| Procesos auxiliares de `pnpm`/`tsx` | ~169 MB RSS |
| RAM disponible en el HP | ~3.4 GB |
| Load average con 2 jugadores | 0.29 |
| Jugadores probados | 2 navegadores en la laptop, ambos por Tailscale |
| FPS del cliente | 60 FPS a 800 × 674 CSS |

Para una alfa de 20–30 jugadores conviene ejecutar el servidor compilado con
`node` (sin `pnpm` ni `tsx`) y medir de nuevo.

---

## 6. Seguridad

- Cambiar la contraseña SSH compartida por chat.
- Instalar una clave pública y desactivar `PasswordAuthentication`.
- No reutilizar la contraseña en otros servicios.
- Mantener el repositorio privado mientras contenga nombres o assets oficiales.

---

## 7. Próximo paso de despliegue

1. Compilar el cliente (`pnpm build`) y publicarlo en Cloudflare Pages.
2. Publicar el servidor con Cloudflare Tunnel y un subdominio, por ejemplo
   `digiworld.aliproinv.com`.
3. Medir latencia y jugadores simultáneos antes de abrirlo a más gente.
