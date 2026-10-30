# PvE: zonas, Devimon y mochila

El servidor controla movimiento, daño, botín e inventario. Los personajes usan
sprites; no existe selector de personajes 3D.

## Zonas

Las zonas son círculos medidos desde el origen del mapa:

| Zona | Radio | Niveles |
| --- | --- | --- |
| Refugio del Inicio | Hasta 16 m | Sin aggro ni ataques PvE |
| Pradera de Datos | Hasta 32 m | 1–4 |
| Espesura Digital | Hasta 48 m | 5–9 |
| Ruinas Corruptas | Resto del mapa | 10–18 |

Hay 20 salvajes y Devimon (nivel 14, 2400 HP) en `(44, 44)`.
La protección del refugio se calcula sobre la posición del compañero y no
impide duelos consentidos. Los enemigos que pierden su objetivo o exceden
la correa recuperan toda su vida y regresan a casa sin aceptar ataques.

## Devimon

- Garra de la Oscuridad tiene una carga de 1,5 s y alcance de 7 m.
  El círculo violeta avisa del ataque. Salir del círculo evita el golpe.
- `R` o «Retirar compañero» cancela el ataque y activa seguimiento pasivo.
  Hay que alejar al domador para sacar al compañero del círculo.
  Seleccionar otro enemigo vuelve a activar el ataque. No se permite retirar
  al compañero de un duelo.
- Por debajo del 30% de HP, los golpes normales hacen un 35% más de daño
  y la recarga del especial baja de 8 a 5 s.
- Reaparece 2 minutos después de morir; los salvajes normales, a los 12 s.
- Reciben XP y botín completos el jugador que da el golpe final y los
  contribuidores vivos a menos de 30 m que hayan causado al menos un 5% de
  la vida máxima y hayan golpeado en los últimos 30 s. El daño acumulado
  se borra al reiniciar el encuentro. No se duplica el premio por muerte.

## Mochila y mapa

El HUD abre el mapa, las advertencias de nivel y el inventario privado.
Las partidas nuevas y antiguas sin inventario comienzan con 3 discos de vida
y 2 de energía. Los discos recuperan el 35% del máximo más 20 HP o 10 EP.
Comparten 8 s de recarga; no se consumen con el recurso lleno y no pueden
usarse durante duelos, derrota o evolución.

El botín se entrega automáticamente: Bits y probabilidad de discos en salvajes;
Devimon entrega 500 Bits, 2 discos de cada tipo y 1 sello. Máximos: 999 por
objeto y 1 000 000 Bits. El inventario y la recarga se guardan con el perfil.
Bits y sellos pueden usarse en la pestaña **Tienda** del refugio. No hay
intercambio entre jugadores. Precios y reglas: `docs/tienda.md`.

## Misiones

La pestaña **Misiones** de la mochila añade tres objetivos encadenados de pradera,
espesura y Devimon, con entrega en el refugio. El servidor guarda el progreso y
evita premios repetidos. Reglas, recompensas y pruebas: `docs/misiones.md`.

## Pruebas locales

```text
pnpm --filter @digiworld/server exec tsx test/pve.ts
pnpm --filter @digiworld/server exec tsx test/profile-room.ts
```
