# Misiones del refugio

En **Mochila / Mapa → Misiones** hay tres objetivos encadenados. La primera
misión se activa al entrar, también en perfiles antiguos. Cada entrega desbloquea
la siguiente. No se cuentan bajas anteriores al desbloqueo.

| Misión | Objetivo | Nivel recomendado | Recompensa |
| --- | --- | --- | --- |
| Primeros datos | 3 salvajes de la Pradera de Datos | 1+ | 100 XP, 120 Bits, 2 discos de vida y 1 de energía |
| Guardianes del bosque | 4 salvajes de la Espesura Digital | 5+ | 300 XP, 300 Bits, 3 discos de vida y 2 de energía |
| La sombra de las ruinas | Devimon | 14+ o grupo | 500 XP, 800 Bits, 3 discos de cada tipo y 1 sello |

Los premios de misión se suman al botín y XP de los enemigos.

## Reglas

- La zona del enemigo es la de su aparición, no adonde haya sido arrastrado.
- Para salvajes normales cuenta quien da el golpe final. Para Devimon cuentan
  también los contribuidores que cumplen los mismos requisitos del botín:
  vivos, cerca, al menos un 5% de daño y participación reciente.
- Para entregar, domador y compañero deben estar dentro del refugio (radio 16),
  fuera de combate/duelo, con el compañero vivo y sin estar evolucionando.
- Se requiere espacio para **todo** el premio; si se alcanza un límite de
  inventario no se pierde la misión ni se descartan objetos.
- Cada misión se entrega una sola vez. Las peticiones repetidas, falsificadas,
  de misiones futuras o incompletas no conceden nada.
- El servidor guarda progreso parcial, entregas y recompensas. No hay un mensaje
  que permita al cliente notificar bajas o elegir el premio.
- El diario es privado: se envía exclusivamente a su propietario, sin añadirlo
  al estado público de jugadores. Los perfiles anteriores sin `quests` comienzan
  con cero bajas y conservan el resto de su partida.

El catálogo vive en `packages/content/src/quests.ts`. Su orden e identificadores
forman parte del guardado: no deben reordenarse sin una migración explícita.

## Pruebas

```text
pnpm --filter @digiworld/server exec tsx test/quests.ts
node scripts/test-quests-ui.cjs
```

La prueba del servidor cubre las tres entregas, duplicados, mensajes malformados,
zonas, contribución al jefe, capacidad, progreso parcial, perfiles antiguos,
reinicio y validación del disco. La prueba de navegador verifica la pestaña en
1280×800, 390×844, 360×640 y 844×390, bloqueos y continuación. Usa `GAME_URL`
para elegir cliente local o público; requiere Chrome y `puppeteer-core`.

### Entrega en navegador con una fixture aislada

`pnpm --filter @digiworld/server exec tsx test/seed-quest-ui.ts` crea **un nuevo
directorio temporal**, con un perfil listo para entregar la primera misión.
Arrancar un servidor local apuntando `DIGIWORLD_DATA_DIR` a la ruta mostrada,
y Vite con `VITE_SERVER_URL=http://localhost:2567`. Pasar `QUEST_UI_TOKEN`
(mostrado por la fixture) al ejecutar `test-quests-ui.cjs` comprueba la entrega
real, inventario exacto, desbloqueo y restauración tras recarga.

No usar esa clave pública de prueba con perfiles reales ni subir esa base a
producción. La fixture no añade endpoints, comandos ni atajos al juego.
